"""Private homework plans and weekly school routines; no external accounts."""
from copy import deepcopy
from datetime import date, timedelta
import re
from urllib.parse import urlsplit
from uuid import uuid4

DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
KINDS = ("assignment", "spelling", "maths", "activity")


def text(value, limit=400, required=False):
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError("Text is missing or too long")
    value = value.strip()
    if required and not value:
        raise ValueError("Please enter the required text")
    return value


def day(value):
    if value is None:
        return None
    if type(value) is not int or not 0 <= value <= 6:
        raise ValueError("Choose a weekday")
    return value


def iso(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Choose a valid date")
    return date.fromisoformat(value).isoformat()


def next_due(today, weekday):
    """A deadline remains due throughout that school day."""
    return today + timedelta(days=(weekday - today.weekday()) % 7)


def validate_profile(raw):
    ident = text(raw.get("id"), 60, True)
    if not re.fullmatch(r"[a-z][a-z0-9_]*", ident):
        raise ValueError("Child identifier is invalid")
    profile = {"id": ident, "name": text(raw.get("name"), 80, True),
               "year": text(raw.get("year", ""), 80), "paused_until": None}
    for key in ("reading_day", "spelling_day", "homework_day", "maths_set_day", "maths_day"):
        profile[key] = day(raw.get(key))
    if profile["reading_day"] is None:
        raise ValueError("Choose the reading book return day")
    for key, default in (("reading_goal", 3), ("tables_goal", 0)):
        value = raw.get(key, default)
        if type(value) is not int or not 0 <= value <= 14:
            raise ValueError("Weekly goals must be between 0 and 14")
        profile[key] = value
    if raw.get("paused_until"):
        profile["paused_until"] = iso(raw["paused_until"])
    if (profile["maths_day"] is None) != (profile["maths_set_day"] is None):
        raise ValueError("Choose both the maths set day and hand-in day")
    return profile


def validate_plan(raw, profiles):
    person = text(raw.get("person_id"), 60, True)
    if person not in {p["id"] for p in profiles}:
        raise ValueError("Choose a configured child")
    kind = raw.get("kind")
    if kind not in KINDS:
        raise ValueError("Choose a homework type")
    links = raw.get("links", [])
    words = raw.get("words", [])
    if not isinstance(links, list) or len(links) > 12 or not isinstance(words, list) or len(words) > 40:
        raise ValueError("Too many links or spelling words")
    safe_links = []
    for link in links:
        url = text(link.get("url"), 2000, True)
        parsed = urlsplit(url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Document links must use HTTPS")
        safe_links.append({"label": text(link.get("label", "School document"), 120, True), "url": url})
    cleaned_words = list(dict.fromkeys(text(word, 60, True) for word in words))
    if kind != "spelling" and cleaned_words:
        raise ValueError("Words belong to a spelling plan")
    due = iso(raw.get("due"))
    set_date = iso(raw.get("set_date", due))
    if set_date > due:
        raise ValueError("The set date must be on or before the deadline")
    return {"id": raw.get("id") or uuid4().hex, "person_id": person, "kind": kind,
            "title": text(raw.get("title"), 160, True), "subject": text(raw.get("subject", ""), 80),
            "due": due, "set_date": set_date, "notes": text(raw.get("notes", ""), 6000),
            "source": text(raw.get("source", "Parent added"), 160), "links": safe_links,
            "words": cleaned_words, "archived": False}


def empty_data():
    return {"revision": 0, "profiles": [], "plans": [], "logs": [], "marks": {}, "requests": []}


def routines(profile, today, data):
    if profile.get("paused_until") and today.isoformat() <= profile["paused_until"]:
        return []
    result = []
    for kind, key, title in (("reading", "reading_day", "Return reading record and books"),
                             ("spelling", "spelling_day", "Spelling test"),
                             ("assignment", "homework_day", "Hand in weekly homework"),
                             ("maths", "maths_day", "Hand in maths homework")):
        if profile.get(key) is None:
            continue
        due = next_due(today, profile[key]).isoformat()
        ident = f"{profile['id']}:{kind}:{due}"
        matching = [p for p in data["plans"] if p["person_id"] == profile["id"]
                    and p["kind"] == kind and p["due"] == due and not p["archived"]]
        result.append({"id": ident, "kind": kind, "title": title, "due": due,
                       "marks": data["marks"].get(ident, {}), "plan_ids": [p["id"] for p in matching]})
    if profile.get("tables_goal"):
        due = next_due(today, profile.get("spelling_day") if profile.get("spelling_day") is not None else profile["reading_day"]).isoformat()
        result.append({"id": f"{profile['id']}:tables:{due}", "kind": "tables", "title": "Tackling Tables", "due": due, "marks": {}, "plan_ids": []})
    for routine in result:
        start = date.fromisoformat(routine["due"]) - timedelta(days=6)
        routine["count"] = len([log for log in data["logs"] if log["person_id"] == profile["id"]
                                and log["kind"] == routine["kind"] and start.isoformat() <= log["date"] <= routine["due"]])
        routine["goal"] = profile.get("reading_goal", 3) if routine["kind"] == "reading" else profile.get("tables_goal", 0) if routine["kind"] == "tables" else 0
    return result


def client_data(data, today):
    children = []
    for profile in data["profiles"]:
        child = deepcopy(profile)
        child["routines"] = routines(profile, today, data)
        child["plans"] = [dict(deepcopy(p), marks=deepcopy(data["marks"].get(p["id"], {}))) for p in data["plans"]
                          if p["person_id"] == profile["id"] and not p["archived"] and p["set_date"] <= today.isoformat()
                          and p["due"] >= (today - timedelta(days=14)).isoformat()]
        child["logs"] = [deepcopy(log) for log in data["logs"] if log["person_id"] == profile["id"] and log["date"] >= (today - timedelta(days=14)).isoformat()]
        children.append(child)
    return {"revision": data["revision"], "today": today.isoformat(), "children": children}


def apply_admin(data, operation, payload):
    result = deepcopy(data)
    if operation == "profiles":
        entries = payload.get("profiles")
        if not isinstance(entries, list) or not 1 <= len(entries) <= 12:
            raise ValueError("Configure between 1 and 12 children")
        profiles = [validate_profile(p) for p in entries]
        if len({p["id"] for p in profiles}) != len(profiles):
            raise ValueError("Each child must appear once")
        result["profiles"] = profiles
    elif operation == "publish":
        plan = validate_plan(payload.get("plan", {}), result["profiles"])
        if not re.fullmatch(r"[a-f0-9]{32}", plan["id"]):
            raise ValueError("Plan identifier is invalid")
        previous = next((p for p in result["plans"] if p["id"] == plan["id"]), None)
        if previous and (previous["person_id"], previous["kind"], previous["due"]) != (plan["person_id"], plan["kind"], plan["due"]):
            raise ValueError("Create a new plan to change its child, type or deadline")
        if not previous and any(p["person_id"] == plan["person_id"] and p["kind"] == plan["kind"] and p["due"] == plan["due"] and not p["archived"] for p in result["plans"]):
            if plan["kind"] in ("spelling", "maths"):
                raise ValueError("A plan already exists for this deadline. Edit it instead")
        result["plans"] = [p for p in result["plans"] if p["id"] != plan["id"]] + [plan]
        if len(result["plans"]) > 1000:
            raise ValueError("The plan archive is full")
    elif operation == "archive":
        plan = next((p for p in result["plans"] if p["id"] == payload.get("id")), None)
        if not plan:
            raise ValueError("Plan was not found")
        plan["archived"] = True
    else:
        raise ValueError("Unknown homework operation")
    result["revision"] += 1
    return result


def apply_progress(data, payload, today):
    """Merge only one bounded action. A request id makes retries idempotent."""
    request_id = text(payload.get("request_id"), 80, True)
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", request_id):
        raise ValueError("Request identifier is invalid")
    if request_id in data["requests"]:
        return data
    result = deepcopy(data)
    profile = next((p for p in result["profiles"] if p["id"] == payload.get("person_id")), None)
    if not profile:
        raise ValueError("Child was not found")
    if profile.get("paused_until") and today.isoformat() <= profile["paused_until"]:
        raise ValueError("Homework is paused for this child")
    operation = payload.get("operation")
    if operation == "log":
        kind = payload.get("kind")
        if kind not in ("reading", "tables", "spelling"):
            raise ValueError("Unknown practice type")
        recorded = iso(payload.get("date", today.isoformat()))
        if not (today - timedelta(days=6)).isoformat() <= recorded <= today.isoformat():
            raise ValueError("Choose a date from the last seven days")
        details = payload.get("details", {})
        if not isinstance(details, dict):
            raise ValueError("Session details are invalid")
        if kind == "reading":
            details = {"book": text(details.get("book"), 160, True), "pages": text(details.get("pages", ""), 60), "aloud": details.get("aloud") is True}
        elif kind == "tables":
            mode = details.get("mode", "Learn")
            if mode not in ("Learn", "Play", "Test"):
                raise ValueError("Choose Learn, Play or Test")
            details = {"mode": mode}
        else:
            plan = next((p for p in result["plans"] if p["id"] == details.get("plan_id") and p["person_id"] == profile["id"] and p["kind"] == "spelling" and not p["archived"]), None)
            score, total = details.get("score"), details.get("total")
            if not plan or type(score) is not int or type(total) is not int or total != len(plan["words"]) or not 0 <= score <= total:
                raise ValueError("Spelling result is invalid")
            details = {"plan_id": plan["id"], "score": score, "total": total, "mode": "Practice" if details.get("mode") == "Practice" else "Mock test"}
        result["logs"].append({"id": uuid4().hex, "person_id": profile["id"], "kind": kind, "date": recorded, "details": details})
    elif operation == "remove_log":
        result["logs"] = [log for log in result["logs"] if not (log["id"] == payload.get("id") and log["person_id"] == profile["id"])]
    elif operation == "mark":
        target = payload.get("target")
        plan = next((p for p in result["plans"] if p["id"] == target and p["person_id"] == profile["id"] and not p["archived"]), None)
        routine = next((r for r in routines(profile, today, result) if r["id"] == target), None)
        allowed = (("handed_in", "handwriting") if plan["kind"] == "spelling" else ("finished", "handed_in")) if plan else ("record_written", "adult_signed", "books_ready", "returned") if routine and routine["kind"] == "reading" else ("test_done",) if routine and routine["kind"] == "spelling" else ("handed_in",) if routine and routine["kind"] in ("maths", "assignment") else ()
        field = payload.get("field")
        if field not in allowed or type(payload.get("value")) is not bool:
            raise ValueError("Progress update is invalid")
        result["marks"].setdefault(target, {})[field] = payload["value"]
    else:
        raise ValueError("Unknown progress operation")
    if len(result["logs"]) > 10000:
        raise ValueError("The reading and practice archive is full")
    result["requests"] = (result["requests"] + [request_id])[-500:]
    result["revision"] += 1
    return result
