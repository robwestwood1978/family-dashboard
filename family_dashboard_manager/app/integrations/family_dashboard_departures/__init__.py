"""Shared school departure clock and narrowly scoped Sonos announcements."""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import timedelta
from urllib.parse import urlencode

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .model import (announcement_message, apply_settings, apply_today, claim_reminder,
    client_data, due_reminder, empty_data, validate_settings)

DOMAIN = "family_dashboard_departures"
ENTITY = "sensor.family_dashboard_departure"
TEST_MESSAGE = "This is a test of your school departure reminders."


class DepartureStore:
    def __init__(self, hass):
        self.hass = hass
        self.store = Store(hass, 1, DOMAIN, private=True, atomic_writes=True)
        self.lock = asyncio.Lock()
        self.data = empty_data()
        self.snapshots = []
        self.unsubscribe = None
        self.stopped = False

    async def load(self):
        saved = await self.store.async_load()
        if saved:
            self.data = saved["data"]
            self.data["settings"] = validate_settings(self.data["settings"])
            self.snapshots = saved.get("snapshots", [])
        self.changed()

    def client(self):
        return client_data(self.data, dt_util.now())

    def changed(self):
        if self.stopped:
            return
        view = self.client()
        self.hass.states.async_set(ENTITY, view["status"], {
            "friendly_name": "School departure", "icon": "mdi:bag-personal-outline", **view})

    async def save(self, candidate, snapshot=False):
        snapshots = (self.snapshots + [{"saved_at": dt_util.utcnow().isoformat(), "data": deepcopy(self.data)}])[-5:] if snapshot else self.snapshots
        await self.store.async_save({"data": candidate, "snapshots": snapshots})
        self.data, self.snapshots = candidate, snapshots
        self.changed()

    def validate_entities(self, settings):
        registry = er.async_get(self.hass)
        for entity_id in settings["speakers"]:
            entity = registry.async_get(entity_id)
            if entity is None or entity.platform != "sonos" or entity.disabled_by:
                raise ValueError("Choose enabled Sonos speakers for departure announcements")
        if settings["tts_entity"]:
            entity = registry.async_get(settings["tts_entity"])
            if entity is None or entity.disabled_by:
                raise ValueError("Choose an enabled speech provider")

    async def announce(self, settings, message):
        self.validate_entities(settings)
        if not settings["speakers"] or not settings["tts_entity"]:
            raise ValueError("Choose announcement speakers and a speech provider first")
        for entity_id in [*settings["speakers"], settings["tts_entity"]]:
            state = self.hass.states.get(entity_id)
            if state is None or state.state == "unavailable" or entity_id in settings["speakers"] and state.state == "unknown":
                raise ValueError("An announcement speaker or the speech provider is unavailable")
        # The provider and speakers are validated entity IDs. Content is an
        # encoded, fixed departure phrase; no arbitrary URL or service is used.
        uri = f"media-source://tts/{settings['tts_entity']}?{urlencode({'message': message, 'cache': 'true'})}"
        await asyncio.wait_for(self.hass.services.async_call("media_player", "play_media", {
            "entity_id": list(settings["speakers"]), "announce": True,
            "media_content_id": uri, "media_content_type": "music", "extra": {"volume": settings["volume"]}
        }, blocking=True), timeout=15)

    async def tick(self, _now=None):
        if self.stopped or self.lock.locked():
            return
        async with self.lock:
            now = dt_util.now()
            minutes = due_reminder(self.data, now)
            if minutes is None:
                self.changed()
                return
            candidate = claim_reminder(self.data, minutes, now)
            # Claim durably before playing, including across a restart. Failure
            # is reported but never retried in a loop or replayed after refresh.
            try:
                await self.save(candidate)
            except Exception:
                return
            status, error = "sent", None
            try:
                await self.announce(self.data["settings"], announcement_message(minutes))
            except Exception:
                status, error = "failed", "Announcement could not play. Check the speaker and speech provider in Parent Admin."
            final = deepcopy(self.data)
            final["days"][now.date().isoformat()]["sent"][str(minutes)]["status"] = status
            final["last_announcement"] = {"at": now.isoformat(), "status": status, "error": error}
            try:
                await self.save(final)
            except Exception:
                # The durable claim is already present. Do not replay it.
                self.changed()

    async def admin(self, body):
        if not isinstance(body, dict) or set(body) - {"operation", "payload", "expected_revision"}:
            raise ValueError("Unknown departure request")
        async with self.lock:
            if type(body.get("expected_revision")) is not int or body["expected_revision"] != self.data["revision"]:
                raise ValueError("School mornings changed on another device. Reload before saving")
            operation = body.get("operation")
            if operation == "settings":
                candidate = apply_settings(self.data, body.get("payload"), dt_util.now())
                if candidate["settings"]["enabled"]:
                    self.validate_entities(candidate["settings"])
                await self.save(candidate, snapshot=True)
            elif operation == "today":
                await self.save(apply_today(self.data, body.get("payload"), dt_util.now()))
            elif operation == "test":
                if body.get("payload") not in (None, {}):
                    raise ValueError("The test message and speakers come from saved settings")
                await self.announce(self.data["settings"], TEST_MESSAGE)
            else:
                raise ValueError("Unknown departure operation")
        return {"data": self.data, "view": self.client()}


def can_read(user):
    return user.is_admin or user.permissions.check_entity(ENTITY, POLICY_READ)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get"})
@websocket_api.async_response
async def get_departure(hass, connection, msg):
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        connection.send_error(msg["id"], "not_ready", "School mornings are not connected")
    elif not can_read(connection.user):
        connection.send_error(msg["id"], "unauthorized", "School mornings are not available to this account")
    else:
        connection.send_result(msg["id"], runtime.client())


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/today", vol.Required("payload"): dict, vol.Required("expected_revision"): int})
@websocket_api.async_response
async def update_today(hass, connection, msg):
    if not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "A parent administrator must change today's departure")
        return
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        connection.send_error(msg["id"], "not_ready", "School mornings are not connected")
        return
    try:
        result = await runtime.admin({"operation": "today", "payload": msg["payload"], "expected_revision": msg["expected_revision"]})
        connection.send_result(msg["id"], result["view"])
    except ValueError as error:
        connection.send_error(msg["id"], "invalid_departure", str(error))
    except Exception:
        connection.send_error(msg["id"], "save_failed", "The departure change could not be saved. Please retry")


class DeparturesAdminView(HomeAssistantView):
    url = "/api/family_dashboard_departures/admin"
    name = "api:family_dashboard_departures:admin"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request):
        if not request["hass_user"].is_admin:
            return self.json({"error": "Administrator access required"}, status_code=403)
        runtime = self.hass.data.get(DOMAIN)
        if runtime is None:
            return self.json({"error": "Add the Family Dashboard School Mornings integration in Home Assistant"}, status_code=503)
        return self.json({"data": runtime.data, "view": runtime.client()}, headers={"Cache-Control": "no-store"})

    async def post(self, request):
        if not request["hass_user"].is_admin:
            return self.json({"error": "Administrator access required"}, status_code=403)
        runtime = self.hass.data.get(DOMAIN)
        if runtime is None:
            return self.json({"error": "School mornings are not connected"}, status_code=503)
        try:
            raw = bytearray()
            async for chunk in request.content.iter_chunked(4096):
                raw.extend(chunk)
                if len(raw) > 16384:
                    raise ValueError("Departure update is too large")
            import json
            body = json.loads(raw)
            return self.json(await runtime.admin(body))
        except ValueError as error:
            return self.json({"error": str(error)}, status_code=400)
        except Exception:
            return self.json({"error": "Departure update could not be saved. Please retry"}, status_code=500)


async def async_setup(hass, config):
    websocket_api.async_register_command(hass, get_departure)
    websocket_api.async_register_command(hass, update_today)
    hass.http.register_view(DeparturesAdminView(hass))
    return True


async def async_setup_entry(hass, entry):
    runtime = DepartureStore(hass)
    await runtime.load()
    hass.data[DOMAIN] = runtime
    runtime.unsubscribe = async_track_time_interval(hass, runtime.tick, timedelta(seconds=10))
    return True


async def async_unload_entry(hass, entry):
    runtime = hass.data.pop(DOMAIN, None)
    if runtime:
        runtime.stopped = True
        if runtime.unsubscribe:
            runtime.unsubscribe()
    hass.states.async_remove(ENTITY)
    return True
