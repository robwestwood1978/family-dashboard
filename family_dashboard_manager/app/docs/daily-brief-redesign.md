# Daily brief implementation

The accepted Daily brief direction now styles the real dashboard component. The
interactive concept was deliberately simplified; this implementation retains the
current feature surfaces and their existing service boundaries.

## Experience

- Group the labelled navigation into Family, House and Your world, with Today
  always available and disabled features omitted.
- Use an open greeting, one weather summary, a warm decorative room illustration,
  direct Home summaries, a next-event card, equally sized family/football panels
  and an album-art Music strip on Today.
- Share quiet surfaces, green accents, readable type, status colours and native
  MDI icons throughout the detailed screens. Retain actual floorplans, live camera
  images, safe club crests and the Music player's album artwork.
- Follow Home Assistant's light/dark appearance. Apply a palette change in place
  so a theme switch does not rebuild an active Music browser or camera viewer.
- Let dense content flow and scroll rather than shrink text. Four Today matches
  remain accessible; FPL player names, positions, scores and league rows use
  readable 12px minimum labels.

## Feature parity

| Screen | Retained functionality |
| --- | --- |
| Today | Next event, preparation checklist, child/points summaries, Home links, security/energy status, both clubs' latest/live and next games, playback toggle |
| Calendar | Day/week/month/agenda, period navigation, family filters, event creation, event details and preparation templates/checklists |
| Home | Floorplans and room selection, all lights and dimmers, whole-house lighting, heating targets/power and schedules, blinds/doors, scenes, cleaning actions/map/consumables |
| Tasks | Child selection, actual jobs and claims, points, featured rewards and reward claims, badges, achievements, school/preparation information, configured native ChoreOps link |
| Security | Camera stills and deliberate viewing, one-camera lifecycle, close/recovery, alarm actions and protected garage confirmation |
| Energy | Electricity/gas totals, tariffs, freshness, configured history charts and honest unavailable/stale states |
| Football | Equal favourites, shared derbies, matchweek selection, fixtures/results, league table, FPL entries/squads/captain points/bench and complete leagues |
| Music | Configured native player, room choices, browsing/search, playback/volume/grouping capabilities provided by that player, read-only enforcement |

No new write authority is introduced. Existing feature flags, read-only guards,
native-player boundaries and protected Security actions stay in place.

## Assets and delivery

`frontend/assets/home-illustration.js` contains an original AI-generated JPEG as
a data URL. It is decorative and never represents a real room, camera or live
state. It requires no image-host account or runtime download. The shared palette
and presentation are in `frontend/daily-brief-styles.js`.

Both modules join Manager's fixed managed-file list, so deployment and snapshot
rollback include the imports. The Manager rollback test corrupts and restores the
component, stylesheet and illustration together.

The browser suite covers all eight screens and every Home section in both
appearances, including contrast, touch targets, image decoding, and Music instance
preservation. Existing functional tests cover the controls listed above. The
approval suite renders the actual component with synthetic Home Assistant data
at both iPad sizes and exercises 200% zoom. Physical household integration checks
still require the real iPad and devices after an approved deployment.

This work does not merge a release, upgrade Manager, or deploy household
configuration. It builds on the separate Today football correction.
