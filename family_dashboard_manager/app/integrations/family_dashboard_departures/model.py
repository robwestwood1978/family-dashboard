"""Pure school departure rules. No network, device access or browser timing."""
from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, time, timedelta
from math import ceil
import re

MODES = ("drive", "walk", "cycle", "scoot")
TIME = re.compile(r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
ENTITY = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")


def empty_data():
    return {"revision": 0, "settings": {"enabled": False, "times": [None] * 7,
        "speakers": [], "tts_entity": "", "volume": 20, "reminders": [20, 10, 5, 0],
        "show_before_minutes": 60, "paused_until": None, "default_mode": "drive"},
        "days": {}, "last_announcement": None}


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"20\d\d-\d\d-\d\d", value):
        raise ValueError("Choose a valid date")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError("Choose a valid date") from error


def valid_time(value):
    if not isinstance(value, str) or not TIME.fullmatch(value):
        raise ValueError("Departure times must use hours and minutes")
    return value


def validate_settings(value):
    defaults = empty_data()["settings"]
    if not isinstance(value, dict) or set(value) != set(defaults):
        raise ValueError("Departure settings are incomplete or contain unknown fields")
    candidate = deepcopy(value)
    if type(candidate["enabled"]) is not bool:
        raise ValueError("Choose whether school mornings are enabled")
    times = candidate["times"]
    if not isinstance(times, list) or len(times) != 7:
        raise ValueError("Set one departure time for each weekday; leave non-school days blank")
    for value in times:
        if value is not None:
            valid_time(value)
    speakers = candidate["speakers"]
    if not isinstance(speakers, list) or len(speakers) > 8 or len(set(str(s) for s in speakers)) != len(speakers):
        raise ValueError("Choose up to eight distinct speakers")
    if any(not isinstance(s, str) or not ENTITY.fullmatch(s) or not s.startswith("media_player.") for s in speakers):
        raise ValueError("Choose valid announcement speakers")
    tts = candidate["tts_entity"]
    if not isinstance(tts, str) or tts and (not ENTITY.fullmatch(tts) or not tts.startswith("tts.")):
        raise ValueError("Choose a valid speech provider")
    if type(candidate["volume"]) is not int or not 1 <= candidate["volume"] <= 60:
        raise ValueError("Announcement volume must be between 1 and 60 percent")
    reminders = candidate["reminders"]
    if not isinstance(reminders, list) or not 1 <= len(reminders) <= 8 or any(type(r) is not int or not 0 <= r <= 60 for r in reminders) or len(set(reminders)) != len(reminders):
        raise ValueError("Use distinct reminder minutes from 0 to 60; 0 means departure time")
    candidate["reminders"] = sorted(reminders, reverse=True)
    lead = candidate["show_before_minutes"]
    if type(lead) is not int or not max(reminders) <= lead <= 180 or lead < 20:
        raise ValueError("Show the countdown 20–180 minutes before leaving, before the first reminder")
    if candidate["paused_until"] is not None:
        valid_date(candidate["paused_until"])
    if candidate["default_mode"] not in MODES:
        raise ValueError("Choose driving, walking, cycling or scooting")
    if candidate["enabled"] and (not any(times) or not speakers or not tts):
        raise ValueError("Choose school times, a speaker and a speech provider before enabling reminders")
    return candidate


def changed(data, now):
    candidate = deepcopy(data)
    candidate["revision"] += 1
    cutoff = (now.date() - timedelta(days=14)).isoformat()
    candidate["days"] = {key: value for key, value in candidate["days"].items() if key >= cutoff}
    return candidate


def apply_settings(data, settings, now):
    value = validate_settings(settings)
    candidate = changed(data, now)
    candidate["settings"] = value
    return candidate


def apply_today(data, payload, now):
    if not isinstance(payload, dict) or set(payload) - {"operation", "date", "time", "mode", "muted"}:
        raise ValueError("Unknown departure action")
    key = payload.get("date")
    if key != now.date().isoformat():
        raise ValueError("This is a new day. Refresh the countdown before changing it")
    operation = payload.get("operation")
    permitted = {"override": {"operation", "date", "time", "mode"}, "restore": {"operation", "date"},
        "left": {"operation", "date"}, "skip": {"operation", "date"}, "mute": {"operation", "date", "muted"}}
    if operation not in permitted or set(payload) != permitted[operation]:
        raise ValueError("Unknown or incomplete departure action")
    candidate = changed(data, now)
    day = candidate["days"].setdefault(key, {})
    if operation == "override":
        day["time"] = valid_time(payload["time"])
        if payload["mode"] not in MODES:
            raise ValueError("Choose driving, walking, cycling or scooting")
        day["mode"] = payload["mode"]
        day["skip"] = False
        day["left"] = False
    elif operation == "restore":
        day.pop("time", None)
        day.pop("mode", None)
        day["skip"] = day["left"] = False
    elif operation in ("left", "skip"):
        day[operation] = True
    else:
        if type(payload["muted"]) is not bool:
            raise ValueError("Choose whether to mute today")
        day["muted"] = payload["muted"]
    # Sent reminders deliberately survive time/mode changes and restoring the
    # usual schedule. The same warning is never replayed during this day.
    return candidate


def departure_target(data, now):
    settings = data["settings"]
    key = now.date().isoformat()
    if not settings["enabled"] or settings["paused_until"] and key <= settings["paused_until"]:
        return None
    day = data["days"].get(key, {})
    value = day.get("time") or settings["times"][now.weekday()]
    if not value:
        return None
    return datetime.combine(now.date(), time.fromisoformat(value), tzinfo=now.tzinfo)


def client_data(data, now):
    key = now.date().isoformat()
    target = departure_target(data, now)
    day = data["days"].get(key, {})
    minutes = ceil((target.timestamp() - now.timestamp()) / 60) if target else None
    status = "off"
    if data["settings"]["paused_until"] and key <= data["settings"]["paused_until"]:
        status = "paused"
    elif target:
        status = "left" if day.get("left") else "skipped" if day.get("skip") else "leaving" if minutes <= 0 else "countdown"
    return {"revision": data["revision"], "today": key, "enabled": data["settings"]["enabled"],
        "show_before_minutes": data["settings"]["show_before_minutes"], "departure_at": target.isoformat() if target else None,
        "usual_time": data["settings"]["times"][now.weekday()], "time": target.strftime("%H:%M") if target else None,
        "mode": day.get("mode", data["settings"]["default_mode"]), "overridden": bool(day.get("time")),
        "minutes": minutes, "muted": bool(day.get("muted")), "status": status,
        "visible": target is not None and -30 <= minutes <= data["settings"]["show_before_minutes"],
        "last_announcement": deepcopy(data.get("last_announcement"))}


def due_reminder(data, now):
    target = departure_target(data, now)
    day = data["days"].get(now.date().isoformat(), {})
    if target is None or day.get("left") or day.get("skip") or day.get("muted"):
        return None
    # Only a warning crossing within the last 20 seconds is eligible. A restart
    # or late-opened dashboard cannot cause a burst of old announcements.
    for minutes in sorted(data["settings"]["reminders"]):
        elapsed = now.timestamp() - (target.timestamp() - minutes * 60)
        if 0 <= elapsed <= 20 and str(minutes) not in day.get("sent", {}):
            return minutes
    return None


def claim_reminder(data, minutes, now):
    if due_reminder(data, now) != minutes:
        return None
    candidate = changed(data, now)
    day = candidate["days"].setdefault(now.date().isoformat(), {})
    day.setdefault("sent", {})[str(minutes)] = {"at": now.isoformat(), "status": "claimed"}
    return candidate


def announcement_message(minutes):
    if minutes == 0:
        return "It is time to leave for school. Have a lovely day."
    suffix = " Shoes and coats on, please." if minutes <= 5 else " Check your school bags." if minutes <= 10 else ""
    return f"We leave for school in {minutes} minute{'s' if minutes != 1 else ''}.{suffix}"
