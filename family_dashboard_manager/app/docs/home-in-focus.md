# Home in focus — Manager 0.16.0

Today leads with a room illustration and actual Home Assistant lighting state, direct lighting controls, and a shortcut to that room’s heating controls. Plans and jobs sit alongside the room. Both favourite clubs retain their latest result or live match and next available fixture, with shared derbies shown once.

Calendar keeps Day, Week, Month and Agenda, all configured calendars, family filters, period navigation, refresh, event details and creation. Week and Month add date selection, a focused agenda and a Get ready panel. Existing preparation templates and custom items remain available in the event editor.

## Shared checklists

Today, Calendar and Tasks read and update the same configured Home Assistant to-do list. No duplicate task database is introduced. Tasks groups all upcoming preparation items by event for the selected child, rather than limiting the list to tomorrow or six items. When an event is outside the currently loaded calendar period, its to-do due date still makes the preparation items visible, with an honest “Event checklist” label until the event is loaded. Past dated preparation items are omitted from the upcoming list.

Completing or reopening a checklist item updates its existing UID through the bounded `todo.update_item` path. A failed update restores its previous state. These items do not award or remove ChoreOps points. Actual jobs, claims, rewards, badges and achievements retain their existing service boundaries and data sources.

## Features retained

| Screen | Features |
| --- | --- |
| Today | Room lighting, heating shortcut, whole-home summaries, next plan, checklists, child jobs and points, both clubs’ matches |
| Calendar | Day/Week/Month/Agenda, person filters, period navigation, event creation, details, preparation templates and custom items |
| Home | Private floorplans, rooms, all lights, capability-aware dimming, scenes, room heating, whole-home targets, persisted schedules, blinds and doors, cleaning |
| Tasks | Actual jobs and claim status, selected child, reward claims, badges, achievements, school data, event checklists; location map only when configured |
| Security | Alarm/garage confirmation, signals, bounded camera sessions, private camera restrictions and recovery |
| Energy | Electricity and gas totals, rates, standing charges, stale/unavailable states |
| Football | Latest/next favourite matches, fixtures and results, full table, both children’s FPL squads, captains, chips and leagues |
| Music | Full configured player, browsing, grouping and room controls; persistent playback dock |

## Orientation and appearance

Landscape remains the default for the household tablet. Portrait uses a compact horizontal navigation bar and stacked content. Narrow layouts preserve all views and keep Music playback visible; room and volume controls remain available in the full Music screen. Light and dark palettes follow Home Assistant without recreating the full player on playback or theme updates.

## Deployment

Update the existing Family Dashboard Manager app to **0.16.0**. Do not install a second app or change the tunnel. Validate and deploy the unchanged household configuration through Manager, then refresh the existing Lovelace JavaScript module URL to:

```
/local/family-dashboard/family-hub-card.js?v=0.16.0
```

The shared stylesheet import is versioned too. Manager’s existing fixed file allow-list deploys and snapshots the component, stylesheet and illustration together. Private floorplans and household mappings remain unchanged. `reload_dashboard` verifies files and returns the bounded resource refresh step; it does not upgrade the Manager app or edit Home Assistant’s resource registry.
