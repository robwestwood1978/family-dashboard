# v0.9 design direction

v0.9 is a product correction, not a reskin. It reduces duplicated controls, makes
the information hierarchy denser and more useful at 1112x834, and replaces UI
states that the real integrations cannot reliably support.

## Shell and navigation

- Keep one left rail with one ordered list: Today, Calendar, Home, Family,
  Security, Music, Energy and Football when enabled.
- Namespace shell-critical navigation, brand, content and topbar classes so
  third-party light-DOM cards cannot restyle the dashboard chrome.
- Use one clear page title and one contextual toolbar per view. Avoid nested hero
  copy that repeats the current navigation label.

## Security and cameras

- Security opens on two latest-image tiles and never starts a camera by itself.
- The image is the action: tapping it opens the selected live view.
- A still remains visible while the live stream wakes or fails.
- Home Assistant's native live `picture-entity` is the player and remains scoped to
  the selected exterior camera. The UI says **Live** only after video readiness,
  never merely because Eufy reports `streaming`, and drops back to loading on a
  playback stall.
- Only one exterior camera can stream at once. Close, camera switching, leaving
  Security, page hiding and a 120-second expiry all stop the session.
- Garage uses its configured RTSP start/stop pair; Front door retains its
  configured P2P pair until an RTSP-capable path is proven.

## Home and Energy

- Home opens on the configured default room, not the first floorplan hotspot.
- The Home toolbar reports the state of the selected section instead of repeating
  “room by room” everywhere.
- Lighting cards use a balanced 3x2 grid and logical room-level circuits. Parent
  groups and their child lights must not be configured together.
- Heating distinguishes the five underfloor zones from the upstairs radiator
  zone while retaining direct, labelled controls.
- Energy is a first-class view. It reports electricity and gas usage/cost **today
  so far**, tariff and source freshness. It must not imply instantaneous power,
  trends or savings when those data are not configured.

## Family and ChoreOps

- Use **Jobs & rewards** in family-facing language and **Today’s jobs** within a
  child card. Do not use the v0.8 “Small routines, visible progress” banner.
- Keep Family as the glanceable household summary; use the native ChoreOps
  dashboard/OpsCenter for creating, editing, claiming and approving work.
- Rewards are first-class: Family may feature one reward, badge and achievement
  per child. Detailed ranks, quests and challenges remain in native ChoreOps
  until an explicit dashboard mapping is added.
- A native-dashboard link is shown only when an exact internal path is configured.

## Google Classroom

- Classroom remains one read-only authorization per child account.
- The dashboard consumes only a bounded assignments sensor; OAuth credentials and
  tokens never belong in household configuration, generated YAML, snapshots or
  logs.
- School must not be shown as connected until the adapter exists, the Classroom
  API is enabled, and both child accounts have completed Google consent.

## Calendar and Music

- Calendar has one view selector and one period-navigation layer. Its embedded
  card owns the calendar body and exactly one scroll container.
- Music uses a solid card surface, one scroll owner and five persistent room
  choices. It does not force transparent child backgrounds or clip grouping and
  search dialogs.
- SpotifyPlus remains outside the service allowlist until it is deliberately
  configured and tested; Music Assistant browsing is not labelled as native
  SpotifyPlus browsing.

## Football

- Tottenham and Aston Villa receive equal favourite cards. Fixture ordering may
  never decide which club gets the hero treatment.
- A Spurs-Villa fixture becomes one shared Family derby card.
- Today follows the same one-card-per-club selection rule.

## Compatibility boundary

- `features.lists` remains in schema v6 only for backward compatibility. It is
  not a v0.9 surface; new configurations keep it `false`, and reminders/shopping
  remain outside this correction release.

## Acceptance

- Functional and layout checks cover Chromium and WebKit at 1112x834 and 1024x768
  plus the existing 200% zoom cases.
- Approval evidence remains representative rather than exhaustive.
- Camera acceptance is physical: five opens per camera, one camera switch, one
  close and one iPad-background teardown. Synthetic screenshots do not qualify
  Eufy transport.
- Merge, Manager upgrade, household-config deployment and physical acceptance are
  separate guarded actions with a v0.8 rollback snapshot retained.
