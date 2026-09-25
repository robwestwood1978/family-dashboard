# v0.11 Family Planner

## Goal

The Family Planner makes a shared week understandable from across the room: every family member has a stable colour, every event shows who it belongs to, and child events can carry a practical **Get ready** checklist. It extends the existing Family Dashboard and Manager; it does not add an app, tunnel, dashboard or public calendar service.

## Calendar presentation

Day and Week use a first-party tablet layout built from the same bounded Home Assistant calendar event API already used by the dashboard. Person filter chips, coloured event borders and person dots make ownership visible without relying on event-title conventions. Month and Agenda continue to use the already-installed Daylight (formerly Skylight) calendar card because it remains stronger for dense long-range browsing.

The public example uses generic people. Household names, real entity IDs and private calendar data belong only in the deployed configuration.

## Apple Calendar write path

The dashboard does not sign in to iCloud and stores no Apple password or token. Home Assistant's existing CalDAV integration remains the credential boundary. A calendar entry must explicitly opt in with `allow_create: true`; only then can the dashboard call:

```text
calendar.create_event
```

The target is always that exact configured `calendar.*` entity. v0.11 deliberately has no event update or delete path. `display.read_only: true` removes event creation while keeping the schedule visible.

One separate Apple calendar per person gives the clearest colour and ownership model. A shared Family calendar can map to several people for whole-house events.

## Preparation and Ready state

Preparation templates use bounded keyword lists to suggest packs for events such as football or a school trip. A template is never created automatically: an adult selects it while creating an event, or adds it from an event's detail panel.

Checklist items live in one dedicated Home Assistant `todo.*` entity, normally an Apple Reminders list named **Family Prep**. Each item contains a small machine-readable description linking it to the stable event key, person and template. The user-facing item remains ordinary text such as `Football boots` or `Water bottle`.

Allowed to-do calls are limited to:

```text
todo.get_items
todo.add_item
todo.update_item
```

The dashboard cannot delete to-do items and cannot access another list. Read-only mode still permits `todo.get_items` so preparation state remains visible, but blocks add and update calls.

**Ready** means every linked item for that event/person is complete. It does not award ChoreOps points, create a ChoreOps chore or claim that a child completed a household responsibility. The same items appear in the event detail and in the child's Family panel immediately before **Today's jobs**, keeping preparation and rewarded chores visually connected but semantically separate.

## Configuration shape

```json
{
  "calendar": {
    "entities": [
      {
        "id": "child_one",
        "entity_id": "calendar.child_one",
        "label": "Child one",
        "colour": "#E76F51",
        "person_ids": ["child_one"],
        "category": "personal",
        "allow_create": true
      }
    ],
    "preparation": {
      "enabled": true,
      "todo_entity": "todo.family_prep",
      "lookahead_days": 7,
      "templates": [
        {
          "id": "football",
          "label": "Football",
          "keywords": ["football", "training", "match"],
          "items": ["Football kit", "Shin pads", "Boots", "Snack pack", "Water bottle"]
        }
      ]
    }
  }
}
```

Template IDs, keywords and items must be unique after case normalisation. Limits in the schema prevent an unbounded planner payload.

## Reuse boundary

v0.11 reuses the installed Daylight card for Month and Agenda instead of copying it. The first-party Day/Week interaction takes product cues from Week Planner Card/Week Planner Plus (compact multi-calendar weeks) and MIT FamilyBoard (touch-first household organisation), but uses no copied source or assets. Beacon and other standalone dashboards are not installed. This avoids another runtime custom-card dependency and keeps all writes behind the Manager's existing allow-list.

## Rollout boundary

Before household deployment:

1. Create or expose one writable Apple/CalDAV calendar entity for each person who needs their own colour.
2. Create a dedicated Apple Reminders list for preparation and confirm its `todo.*` entity in Home Assistant.
3. Map the household colours and real entity IDs in one candidate configuration.
4. Validate that exact candidate once, deploy its returned hash once, reload once, and retain the Manager rollback snapshot.

Private floorplans, photos, OAuth credentials and Classroom state are outside this change.
