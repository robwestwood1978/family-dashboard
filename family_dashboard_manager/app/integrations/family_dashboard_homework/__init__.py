"""Authenticated Home Assistant bridge for the Family Hub homework area."""
from __future__ import annotations

import asyncio
from copy import deepcopy

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.auth.permissions.const import POLICY_READ, POLICY_CONTROL
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .model import apply_admin, apply_progress, client_data, empty_data, read_admin_payload

DOMAIN = "family_dashboard_homework"
ENTITY = "sensor.family_dashboard_homework_revision"


class HomeworkStore:
    def __init__(self, hass):
        self.hass = hass
        self.store = Store(hass, 1, DOMAIN, private=True, atomic_writes=True)
        self.lock = asyncio.Lock()
        self.data = empty_data()
        self.snapshots = []

    async def load(self):
        saved = await self.store.async_load()
        if saved:
            self.data = saved["data"]
            self.snapshots = saved.get("snapshots", [])
        self.changed()

    def changed(self):
        self.hass.states.async_set(ENTITY, self.data["revision"], {"friendly_name": "Homework update", "icon": "mdi:book-open-page-variant-outline"})

    async def save(self, candidate, snapshot=False):
        snapshots = (self.snapshots + [{"saved_at": dt_util.utcnow().isoformat(), "data": deepcopy(self.data)}])[-5:] if snapshot else self.snapshots
        # Publish in memory only after durable storage succeeds.
        await self.store.async_save({"data": candidate, "snapshots": snapshots})
        self.data, self.snapshots = candidate, snapshots
        self.changed()

    def client(self):
        return client_data(self.data, dt_util.now().date())


def authorised(user, policy):
    return user.is_admin or user.permissions.check_entity(ENTITY, policy)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get"})
@websocket_api.async_response
async def get_homework(hass, connection, msg):
    if not authorised(connection.user, POLICY_READ):
        connection.send_error(msg["id"], "unauthorized", "Homework access is not allowed")
        return
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        connection.send_error(msg["id"], "not_ready", "Homework integration is not set up")
        return
    connection.send_result(msg["id"], runtime.client())


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/progress", vol.Required("payload"): dict})
@websocket_api.async_response
async def progress_homework(hass, connection, msg):
    if not authorised(connection.user, POLICY_CONTROL):
        connection.send_error(msg["id"], "unauthorized", "This account cannot update homework")
        return
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        connection.send_error(msg["id"], "not_ready", "Homework integration is not set up")
        return
    try:
        async with runtime.lock:
            candidate = apply_progress(runtime.data, msg["payload"], dt_util.now().date())
            if candidate is not runtime.data:
                await runtime.save(candidate)
        connection.send_result(msg["id"], runtime.client())
    except ValueError as error:
        connection.send_error(msg["id"], "invalid_progress", str(error))
    except Exception:
        connection.send_error(msg["id"], "save_failed", "Homework could not be saved. Please retry")


class HomeworkAdminView(HomeAssistantView):
    url = "/api/family_dashboard_homework/admin"
    name = "api:family_dashboard_homework:admin"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request):
        if not request["hass_user"].is_admin:
            return self.json({"error": "Administrator access required"}, status_code=403)
        runtime = self.hass.data.get(DOMAIN)
        if runtime is None:
            return self.json({"error": "Add the Family Dashboard Homework integration in Home Assistant"}, status_code=503)
        return self.json({"data": runtime.data, "preview": runtime.client()}, headers={"Cache-Control": "no-store"})

    async def post(self, request):
        if not request["hass_user"].is_admin:
            return self.json({"error": "Administrator access required"}, status_code=403)
        runtime = self.hass.data.get(DOMAIN)
        if runtime is None:
            return self.json({"error": "Homework integration is not set up"}, status_code=503)
        try:
            if request.content_length is not None and request.content_length > 128 * 1024:
                raise ValueError("Homework update is too large")
            body = await read_admin_payload(request.content.iter_chunked(16384))
            async with runtime.lock:
                if body.get("expected_revision") != runtime.data["revision"]:
                    return self.json({"error": "Homework changed on another device. Reload this page before saving"}, status_code=409)
                candidate = apply_admin(runtime.data, body.get("operation"), body.get("payload", {}))
                await runtime.save(candidate, snapshot=True)
            return self.json({"data": runtime.data, "preview": runtime.client()})
        except (ValueError, TypeError, AttributeError) as error:
            return self.json({"error": str(error)}, status_code=400)
        except Exception:
            return self.json({"error": "Homework could not be saved. Please retry"}, status_code=500)


async def async_setup(hass, config):
    websocket_api.async_register_command(hass, get_homework)
    websocket_api.async_register_command(hass, progress_homework)
    hass.http.register_view(HomeworkAdminView(hass))
    return True


async def async_setup_entry(hass, entry):
    runtime = HomeworkStore(hass)
    await runtime.load()
    hass.data[DOMAIN] = runtime
    return True


async def async_unload_entry(hass, entry):
    hass.data.pop(DOMAIN, None)
    hass.states.async_remove(ENTITY)
    return True
