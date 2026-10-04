# Corrective tablet design

The v0.16.0 dashboard inherited Home Assistant's dark appearance, added redundant header space, and allowed oversized page content to scroll below the tablet. Its heating and task presentation did not reproduce the approved Home in focus design. This change restores an explicit light presentation and budgets each primary view against the card's actual position in the browser viewport.

## Presentation and behaviour

- `display.appearance` accepts `light`, `dark`, or `auto`. Omission uses `light`; `auto` follows Home Assistant. Changing appearance preserves embedded player state.
- The card fills the space from its actual top edge to the visual viewport bottom. Native Home Assistant navigation remains outside the card. Resize observers and viewport listeners are cleaned up when the card disconnects.
- Tablet pages keep navigation, the page heading, and the music dock visible. Longer collections use contained lists. Below 620 CSS pixels, pages can scroll vertically to preserve enlarged text and touch controls.
- Today uses Home in focus imagery, a greeting, truthful room data, upcoming plans, both children's summaries, checklist preparation and favourite-club matches. A room without a climate mapping links to whole-house heating instead of implying that it has a heating target.
- Heating uses circular target dials with current temperatures, power controls, steppers and existing schedule editors. Six zones fit in the tablet composition; larger collections remain reachable.
- Tasks uses a completion ring, compact actionable jobs, visible reward/badge/achievement progress and the same preparation items used by Calendar. Checklist writes continue through the existing shared preparation service.
- Calendar keeps Day, Week, Month and Agenda, person filters, date navigation, event editing and preparation controls. Week indicators no longer overlap month labels.
- Football preserves favourite fixtures/results, matchweek browsing, the table and FPL squad/bench/leagues. The portrait toolbar lays out before the team selector rather than overlapping it.
- Security uses a single neutral viewer with compact choices for one to three configured exterior cameras and a dropdown for larger collections. Show only the selected camera’s snapshot and activity. Camera selection never wakes video and closes an owned live view before switching; explicit View live, automatic teardown, guarded alarm and garage actions, read-only and unavailable states remain intact.
- Music retains the native multi-player component, playback, room grouping and browsing. Its child configuration receives a bounded full-height layout and the selected dashboard palette.

## Review and validation

The browser fixture uses an offset Home Assistant shell, real MDI icon paths, representative six-zone/two-child/five-player data and shared calendar checklists. It verifies root and primary-view bounds in landscape and portrait. Existing service-boundary, stream teardown, read-only, calendar and FPL tests remain in place.

The approval suite audits 70 screenshots: every primary view and Home tab, camera states, football freshness and representative 200% zoom layouts, across Chromium/WebKit and two landscape tablet sizes. Portrait checks additionally cover all primary views and FPL toolbar geometry.

For a working review export, run the export test with `RESTORED_REVIEW_EXPORT_PATH` pointing to an HTML output and `RESTORED_DESIGN_REVIEW_DIR` pointing to a screenshot folder. Set `NATIVE_MUSIC_CARD_PATH` to an available upstream player bundle to exercise the real player rather than its functional test substitute. The review uses representative data and simulated services; it contains no household credentials.

## Release and device validation

The working implementation was reviewed in landscape and portrait and approved for deployment as Manager 0.17.0. The 0.17.1 patch corrects native Music grouping chip widths found during live deployment verification. Update the existing Manager app, validate and deploy the existing household configuration, and refresh the existing module URL to `/local/family-dashboard/family-hub-card.js?v=0.17.1`. Native Music was checked with upstream v0.30.0; the version installed on the household's device still needs confirmation. Browser tests simulate the Home Assistant shell; actual iPad rendering, native player browsing/grouping and live camera operation need a final device check before calling the correction accepted. Intentional scrolling within larger collections is distinct from a primary page overflowing the tablet.
