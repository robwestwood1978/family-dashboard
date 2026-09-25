# v0.11 Family Planner

## Goal

The Family Planner makes a shared week understandable from across the room: every family member has a stable colour, every event shows who it belongs to, and child events can carry a practical **Get ready** checklist. It extends the existing Family Dashboard and Manager; it does not add an app, tunnel, dashboard or public calendar service.

## Calendar presentation

Day, Week, Month and Agenda use one first-party tablet layout built from the same bounded Home Assistant calendar event API already used by the dashboard. Person filter chips, coloured event borders and person dots make ownership visible without relying on event-title conventions. Previous, Today and Next move the visible period, while Refresh bypasses the short cache so Apple-side changes and deletions can be read immediately.

The public example uses generic people. Household names, real entity IDs and private calendar data belong only in the deployed configuration.

## Apple Calendar write path

The dashboard does not sign in to iCloud and stores no Apple password or token. Home Assistant's existing CalDAV integration remains the credential boundary. A calendar entry must explicitly opt in with `allow_create: true`; only then can the dashboard call:

```text
calendar.create_event
```

The target is always that exact configured `calendar.*` entity. Home Assistant's CalDAV entities expose creation but not a supported event update/delete service, so event details must still be changed in Apple Calendar. The dashboard says this explicitly and provides an immediate Refresh path. It never simulates an edit by creating a duplicate. `display.read_only: true` removes event creation while keeping the schedule visible.

One separate Apple calendar per person gives the clearest colour and ownership model. A shared Family calendar can map to several people for whole-house events.

## Preparation and Ready state

Preparation templates use bounded keyword lists to suggest packs for events such as football or a school trip. A template is never created automatically: an adult selects it while creating an event, or adds it from an event's detail panel. One-off items can also be entered while creating an event or added later from that event, and individual Ready items can be removed.

Checklist items live in one dedicated Home Assistant Local to-do `todo.*` entity, normally named **Family Prep**. Each item contains a small machine-readable description linking it to the stable event key, person and template. The user-facing item remains ordinary text such as `Football boots` or `Water bottle`.

Allowed to-do calls are limited to:

```text
todo.get_items
todo.add_item
todo.update_item
todo.remove_item
```

The dashboard can remove only linked Ready items from the configured list and cannot access another list. Read-only mode still permits `todo.get_items` so preparation state remains visible, but blocks add, update and remove calls.

**Ready** means every linked item for that event/person is complete. It does not award ChoreOps points, create a ChoreOps chore or claim that a child completed a household responsibility. The same items appear in the event detail and in the child's **Tasks** panel the day before they are due, immediately before **Today's jobs**, keeping preparation and rewarded chores visually connected but semantically separate.

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
      "lookahead_days": 1,
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

The first-party planner takes product cues from Week Planner Card/Week Planner Plus (compact multi-calendar weeks), Daylight's multi-view usability and MIT FamilyBoard's touch-first household organisation, but uses no copied source or assets. Daylight remains installed for other dashboards but is no longer a runtime dependency of this planner. Beacon and other standalone dashboards are not installed. All writes remain behind the Manager's existing allow-list.

## Rollout boundary

Before household deployment:

1. Create or expose one writable Apple/CalDAV calendar entity for each person who needs their own colour.
2. Create a dedicated Apple Reminders list for preparation and confirm its `todo.*` entity in Home Assistant.
3. Map the household colours and real entity IDs in one candidate configuration.
4. Validate that exact candidate once, deploy its returned hash once, reload once, and retain the Manager rollback snapshot.

Private floorplans, photos, OAuth credentials and Classroom state are outside this change.
