## 0.19.1

- Request compatible JPEG/PNG copies from the iPad photo-library picker instead of accepting original HEIC files. Preserve local-only storage and original library photos.
- Detect image format from its bytes when a picker retains a stale MIME label, add native bitmap and memory-only image decoding fallbacks, and show per-photo import progress.

## 0.19.0

- Add a device-only screensaver photo picker and collection manager. Selected photos are resized and stored in this browser; they are never uploaded to Home Assistant or included in household configuration.
- Remember the photo source per device, preserve idle timing, clock and motion wake-up, and keep an empty local collection local. Add, remove and preview photos in a readable dialog with persistent actions.

## 0.18.1

- Keep native Music search filters sized to their full labels and wrap them into additional rows on tablets. Preserve touch targets, search selection, room grouping and playback.

## 0.18.0

- Add a review-first New devices page in Household Admin. Opening or refreshing it discovers supported enabled room controls from Home Assistant, suggests rooms by area, and stages selected additions for the existing validated Review & save flow. No device is added automatically.
- Show explicitly disabled room mappings for reviewed removal. Ignore hidden and diagnostic candidates, keep temporarily offline devices mapped, and preserve dedicated Security, Cleaning, floorplan and household setup.
- Exclude disabled and hidden entities from normal mapping choices while preserving currently configured entries for correction.

## 0.17.1

- Give native Music room grouping buttons enough width for full room names and wrap them into additional rows when needed. Preserve 48-pixel touch targets and playback behavior.
- Keep Calendar week tile times fully visible by tightening the spacing between the date, event dots and event summary.

## 0.17.0

- Use one neutral Security viewer with compact camera choices, selected-camera activity and a dropdown for larger camera collections. Browsing does not start video; private viewing and protected alarm/garage actions keep their existing safeguards.

- Restore the approved tablet design across all eight pages: white navigation and masthead, a warm grey canvas, consistent blue actions, and regular body text with medium headings and lighter temperature readouts.
- Keep the master and room heating controls beside their circular dials. Move daily and whole-house schedules into a readable four-period dialog with persistent Save and Close actions.
- Reduce scrolling with dedicated Jobs, Get ready and Rewards sections; room control sections; Cleaning sections; and a starting-eleven/bench switch for FPL. Keep complete lists available in one contained scroll area where necessary.
- Make Today’s next plan and essential controls fit the smaller supported tablet, keep Calendar’s add-item control reachable, and preserve the full native Music player with consistent typography and touch targets.
- Preserve existing entity mappings, read-only protections, shared checklist IDs, ChoreOps boundaries and private camera lifecycle.

## 0.16.0

- Replace Today’s brief with Home in focus: a large room illustration, direct lighting, a heating shortcut, the next family plan, jobs, and both favourite clubs’ match summaries.
- Rebuild Calendar around a selectable week or month, a focused agenda and an inline Get ready panel. Keep Day, Week, Month and Agenda, family filters, event creation, templates and custom checklist items.
- Show each child’s complete upcoming event checklists alongside their actual jobs in Tasks, including events beyond tomorrow. Share the existing to-do item IDs across Today, Calendar and Tasks; completion does not change ChoreOps points.
- Add persistent, capability-aware Music playback, room selection and volume without resetting the full player on state updates.
- Use neutral light/dark surfaces throughout, separate jobs from rewards and awards, and adapt all eight screens to portrait. Preserve heating schedules, lighting, blinds, cleaning, private floorplans, Security, Energy, football tables and FPL.
- Version the shared stylesheet import so the tablet loads the new layout after updating the existing resource.

## 0.15.0

- Apply the Daily brief design across Today, Calendar, Home, Tasks, Security, Energy, Football and Music, with calmer typography, grouped navigation, a warm room illustration, and shared light/dark palettes that follow Home Assistant's appearance setting.
- Preserve the existing control surfaces, ChoreOps rewards and awards, calendar preparation, football tables and FPL, and the full room-based Music player. Keep appearance changes from resetting Music browsing.
- Improve FPL label readability and bundle the illustration and shared stylesheet in Manager deployment snapshots and rollback.
- Give both favourite clubs their latest result or live match and next fixture on Today, rather than limiting the whole family to one result and one upcoming match. Keep shared derbies deduplicated.
- Stack compact match team names beside the score and kickoff details so names and crests remain readable. Let Today grow for a full four-match summary instead of clipping the extra rows.

## 0.14.1

- Let the iPad use one predictable page scroll for Lights, Heating, FPL and Music instead of clipping room content inside nested fixed-height panels.
- Keep all room lights visible, align the whole-house target with its action buttons and prevent schedule names from overlapping their period descriptions.
- Make the FPL squad and league panels flow to their full height, and show both the latest family result and the next available fixture on Today.

## 0.14.0

- Redesign Heating as a tablet-first control surface with aligned whole-house controls, persistent room accordions and clearly paired time and temperature fields for every schedule period.
- Preserve an open schedule and its unsaved field values across live Home Assistant refreshes so room cards no longer collapse while being edited.
- Redesign Lights with room-level status, stronger on-state feedback and native brightness sliders for supported dimmable entities while keeping lamp controls binary.
- Enforce 48-pixel touch targets, unclipped landscape layouts and 200% zoom quality checks across the updated Heating and Lights views.

## 0.13.3

- Retry each current-gameweek squad request after the core FPL profile and fixture feeds complete, avoiding a transient optional request failure that could leave the squad panel blank while leagues remained current.
- Retain the last good current-gameweek squad when the picks endpoint is temporarily unavailable and publish an explicit bounded squad status instead of silently replacing it with an empty list.

## 0.13.2

- Publish the complete configured entry's classic-league list instead of silently truncating it after eight leagues.
- Fetch each public entry's current-gameweek picks and add a tablet-first squad view with starting XI, bench, position, club, captain and vice-captain markers, availability warnings and contributed Gameweek points.
- Keep public FPL entry IDs as the only account input: no FPL login, cookie or manager identity is stored or published.
- Prefer the household's existing Tuya Local thermostat entities for dashboard temperature and power control while retaining the direct local schedule mappings.

## 0.13.1

- Populate all six household heating schedules with their exact Tuya Local text, auto-schedule and refresh entities so the master and room editors are enabled.
- Show an explicit **Not configured** value for empty Admin entity mappings instead of visually selecting the first unrelated Home Assistant entity.
- Limit heating Admin choices to genuine temperature sensors, schedule text entities, auto-schedule selectors and refresh-schedule buttons, with area and entity IDs shown for disambiguation.

## 0.13.0

- Add per-room light group actions and one bounded whole-house internal-lights-off action that excludes configured exterior lights.
- Add whole-house heating temperature and power controls, plus validated four-period Tuya Local schedule reading/editing for one room or every mapped zone.
- Expand Cleaning with room, mode, suction, mop, water, area, duration, consumables and dock-command controls, and replace the empty map with an actionable integration-capability state.
- Give Tasks a child-coloured mission meter and completion treatment while preserving exact-entity ChoreOps claim and adult-approval boundaries.
- Stop mounting unavailable camera stills, show a deterministic live-on-demand state, and allow a separate configured snapshot camera without weakening the bounded stream lifecycle.
- Fill Energy with Home Assistant 24-hour meter history and clearly separate DCC readings from unconfigured supplier-portal data.
- Merge the duplicate Family/Today navigation affordance into one Today home button.
- Add public FPL entry IDs in Admin and publish bounded team points, rank and classic-league positions without storing FPL credentials or manager identity.

## 0.12.1

- Keep the Tasks child selector in its own visible row on landscape tablets so switching between children never depends on rotating the iPad.
- Let every Admin settings group use the available page width, including nested objects such as Photo Frame and Energy mappings, instead of compressing them into repeated half-width columns.
- Replace the Home default-room free-text field with a dropdown built from the household's configured rooms and floor names.
- Turn the Admin section navigation into a touch-friendly horizontal strip on portrait tablets while retaining the desktop sidebar on wider screens.

## 0.12.0

- Add **Family Dashboard Admin** as an administrator-only Home Assistant ingress panel. It edits the Manager's canonical non-secret household configuration, validates the whole candidate, shows an exact leaf-level diff and deploys only after a rollback snapshot and hash checks.
- Make the complete household setup editable without source changes: people and colours, features, calendars and Ready templates, ChoreOps mappings, favourite football clubs, kiosk/photo-frame behaviour, theme, rooms and devices, music, energy, weather, lists and cleaning.
- Keep security, floorplan, location and school mappings behind an additional protected-change acknowledgement. OAuth credentials, Home Assistant tokens, app options and Secure MCP Tunnel settings never enter the Admin payload.
- Turn Tasks into a child-first ChoreOps surface with a per-child switcher, large job cards, progress and reward summaries, and direct claim buttons derived only from each configured status sensor. Approval, rejection, points, schedules and chore definitions remain in ChoreOps for adults.
- Hide the generic `/choreops` link that resolves to Home Assistant Overview; show **Parent controls** only when an administrator configures a verified deeper ChoreOps path.
- Allow any two distinct three-letter Premier League club codes instead of requiring Tottenham and Aston Villa, while retaining the current household's club-specific presentation.

## 0.11.2

- Put event-linked **Ready next** items on Today when they are due today or tomorrow, with direct tick-off through the existing bounded local to-do service and compact ChoreOps summaries retained underneath.
- Redesign the compact Spurs/Villa fixture with both club crests, a clearer score hierarchy and separate navy/claret edge accents for a family derby.
- Remove the overlapping favourite-club accents from full fixture rows and give a Spurs–Villa match one deliberate accent on each side.
- Replace browser-default planner and matchweek dropdown chrome with consistent 48-pixel touch controls and one explicit chevron, while retaining native accessible selection behaviour.
- Document the safe follow-on Admin design: administrator-only editing backed by the Manager's canonical configuration and validation/rollback flow, rather than fragile per-device browser storage.

## 0.11.1

- Replace the failing Month and Agenda child-card mounts with first-party views that share the same family colours, event detail, filtering and bounded calendar API as Day and Week.
- Add Previous, Today, Next and explicit Refresh controls. Refresh bypasses the short event cache so Apple-side edits and deletions can be read without waiting for an entity timestamp change.
- Fix the event-creation race that reset the selected Ready template while the Apple Calendar write was in flight; the complete form is now captured before rendering the saving state.
- Let an adult add template and one-off Ready items during event creation or later from the event, and remove individual Ready items from the one configured local to-do list.
- Rename the Family navigation surface to **Tasks**, show Ready items from the calendar day before they are due, and omit the Classroom placeholder while School is disabled.
- Expand the public example with birthday, swimming, sleepover and day-out templates while keeping arbitrary per-event items available.

## 0.11.0

- Replace the Day and Week calendar surfaces with a first-party Family Planner that makes each person's colour and daily commitments visible at a glance while retaining the installed Daylight card for Month and Agenda.
- Add confirmation-free event creation only for explicitly writable `calendar.*` mappings. New events use Home Assistant's bounded `calendar.create_event` service and therefore flow to the selected Apple CalDAV calendar without exposing Apple credentials to the dashboard.
- Add keyword-matched preparation templates and a dedicated `todo.*` checklist. Event-linked items are shown in the planner and alongside each child's existing ChoreOps jobs, can be ticked off as **Ready**, and do not create ChoreOps points or disposable chores.
- Keep Classroom optional, preserve the private kiosk photo frame and floorplans, and retain the manager-wide read-only switch. Read-only mode can display planner/checklist data but blocks every planner write.
- Add schema, action-boundary, stable event-key, checklist parsing and progress regression coverage using generic public fixtures only.

## 0.10.1

- Keep the active kiosk photo image mounted across ordinary Home Assistant state updates so its reveal animation cannot restart and pulse between the configured slide changes.
- Apply the reveal animation only when the private Home Assistant photo URL genuinely changes, preserving the 20-second rotation without changing the album, idle delay or motion-return contract.
- Add unit and cross-browser regression coverage proving a relevant entity update retains the exact active image element while camera motion still returns to the dashboard.

## 0.10.0

- Add an optional dashboard-native photo frame for kiosk tablets. After a bounded idle period it browses only the private local `media-source://media_source/local/family-dashboard/...` source, rotates image media through Home Assistant's signed local-media path, and returns immediately on the configured Companion App camera-motion sensor or a tap/key press.
- Keep the display awake in the existing Home Assistant Companion kiosk rather than embedding iCloud or publishing a Shared Album. The first rollout uses curated copies under Home Assistant local media; public and arbitrary image URLs are rejected.
- Add `school.source: calendar` as an honest read-only fallback while Google Workspace approval is pending. It requires school-category calendars mapped to every child and never labels calendar dates as Classroom assignments, completion, or grades.
- Preserve schema-v6 compatibility, the existing Manager/app/tunnel identity, bounded live controls, rollback snapshots, private floorplans, and the separate per-child Classroom OAuth path.
- Add unit, schema and cross-browser regression coverage for private photo resolution, motion return, and calendar-only School presentation.

## 0.9.0

- Rebuild Security around immediate latest-image camera tiles and deliberate WebRTC live viewing, with one bounded player recovery, a hard session expiry and complete teardown.
- Isolate dashboard navigation styles from third-party Calendar light-DOM CSS and simplify Calendar's control hierarchy.
- Turn Home into a useful control overview, correct grouped-light counting and add an honest electricity/gas **Today so far** Energy view.
- Replace the Family “routines” presentation with **Jobs & rewards**, surface ChoreOps reward/progress data and retain the native ChoreOps dashboard as the detailed action layer.
- Give Tottenham and Aston Villa equal favourite treatment, including a single shared Family derby state.
- Remove Music's transparent-background, forced-height and hidden-overflow traps while retaining the existing five-room Sonos/Music Assistant boundary.
- Bundle a first-party, per-child Google Classroom OAuth integration using exactly two read-only scopes, a 15-minute bounded sensor and fixed-file hash-guarded installation/rollback; School remains disabled until both real child sensors and consent are present.

## 0.8.0

- Introduce the Family OS tablet hierarchy across Today, Calendar, Home, Family, Security, Music and Football while retaining the existing dashboard, app, image and tunnel identities.
- Carry forward the v0.7.4 adaptive football polling, last-good recovery and deliberate camera wake, buffering, first-frame and stopping lifecycle.
- Remove the slow-player manual promotion to **Live**; the viewer now waits for a positive image/video readiness event or times out to the existing safe Stop-and-Retry path.
- Tighten football staleness to 2.5 times the published polling cadence, keep saved/delayed health readable, and collapse a duplicated favourite-club fixture.
- Make all six heating zones visible together in a 3 × 2 tablet grid, approve the real location-sharing-off Family layout, and use a structural public floorplan fixture instead of a cleaning-map route.
- Restore visible calendar navigation and source toggles, qualify five Sonos rooms with Spotify/Music Assistant browse and search, paint deterministic approval icons, and preserve long Today track titles without clipping.
- Refresh the existing Lovelace module query to v0.8.0 so Home Assistant loads the corrected frontend instead of retaining the previous cached resource.
- Curate the approval artifact to 70 decision-useful iPad images while retaining the complete cross-engine functional and quality assertion suite plus the 1440-pixel wide-layout check.
- Preserve schema-v6 controlled-live validation, bounded household mappings, read-only Calendar and Classroom, one-at-a-time exterior cameras, and second confirmation for garage and alarm changes.

## 0.7.4

- Restores the Premier League poller for the accepted schema-v6 household configuration; the stale schema-v5 gate had silently prevented every scheduled refresh.
- Refreshes immediately and then adapts to the fixture state: every three minutes for live or near-kickoff matches, every 15 minutes on matchdays and hourly between matchdays, without overlapping requests.
- Preserves the last good football data during an upstream failure, publishes bounded stale health on the existing football index without disturbing Manager deployment errors, and presents clear live, saved or delayed freshness instead of provider telemetry.
- Recreates all transient football sensors in the same adaptive polling cycle when Home Assistant Core reports that the football index was recreated after a restart, while retaining hash-based suppression during normal operation.
- Preserves Fantasy Premier League's provisional-finish signal so an ended match is shown as full-time and included in the provisional table rather than remaining falsely live.
- Publishes fixed-origin official Premier League crest URLs from FPL's numeric team codes, with code badges retained as the safe fallback.
- Separates camera wake-up, video buffering, live and stopping phases; Home Assistant's native player is mounted as soon as the secure stream exists but remains behind a calm loading surface until its first frame arrives.
- Adds slow-camera guidance after ten seconds, including a guarded **Show video now** fallback for Home Assistant players that cannot report first-frame readiness, without restarting the stream.
- Requires a fresh camera `idle` state after Stop before another exterior camera can open, disables every camera-open control during Stop/recovery, and retains bounded timeout, Retry, cancellation and late-frame rejection.

## 0.7.3

- Makes deliberate exterior-camera viewing state-driven: an idle Eufy camera starts once, an already-streaming camera is adopted without a duplicate command, and the native viewer mounts only after Home Assistant reports `streaming`.
- Adds bounded Starting, Stopping and recovery states so repeated taps, rejected commands and slow P2P startup cannot leave a black or stale viewer behind.
- Serialises camera switching and waits for the previous exact Stop control before starting another camera, retaining the one-camera-at-a-time privacy boundary.
- Uses Home Assistant's paired `camera.turn_on`/`camera.turn_off` route for the same configured exterior camera when its configured Eufy diagnostic Start/Stop buttons are both missing or unavailable at runtime; an unpaired configuration still fails closed.
- Evicts failed camera children and catches bounded start/stop failures instead of exposing raw integration errors or reusing a broken player.
- Keeps exterior-only validation, paired exact Start/Stop mappings, read-only child cards and all alarm/garage confirmation boundaries unchanged.

## 0.7.2

- Refines every heating card around a larger measured current temperature and a compact, connected target-temperature stepper.
- Presents Heating, Idle, Cooling, Auto, On, Off and Unavailable from Home Assistant thermostat state without inferring demand from measured versus target temperature.
- Keeps heating power and target controls at least 44 pixels high while preserving the supported three-column and two-column iPad layouts.
- Shows missing or unavailable Security signals as Unavailable instead of the falsely reassuring Clear state.
- Disables and revalidates alarm, garage and camera actions when their mapped entity or camera stream control is unavailable or does not advertise the required Home Assistant feature.
- Prevents reversing a moving garage door, expires stale alarm/garage confirmations after a state change, and stops an active exterior stream if the camera fails or dashboard configuration reloads.
- Retains deliberate one-at-a-time exterior camera viewing, exact entity allow-lists, second confirmation for alarm and garage changes, and the global read-only boundary.

## 0.7.1

- Labels each heating zone's measured current temperature separately from its target temperature.
- Shows an explicit unavailable marker when Home Assistant supplies no current-temperature measurement.
- Adds a stateful On/Off control using only native `climate.turn_on` and `climate.turn_off` services for configured heating zones.
- Preserves the thermostat target across power changes and retains the global read-only safety boundary.
- Adds tablet coverage for on, off, missing-current-temperature, read-only and tampered-action cases.

## 0.7.0

- Promote the accepted schema-v6 dashboard from read-only qualification to controlled live operation without changing the existing app, tunnel, panel or storage identities.
- Restrict first-party light, scene, heating, blind, vacuum, media, camera-button, alarm and garage writes to the exact entities and service names present in validated household configuration.
- Give the configured Mediocre Sonos/Music Assistant card a bounded live Home Assistant proxy for playback, volume, grouping, browsing, search and queue operations on configured players only.
- Keep Calendar event management, Classroom, camera presentation cards and the vacuum map read-only; retain exterior-only camera validation and the child/bedroom camera ban.
- Preserve mandatory second confirmation for every garage and alarm change and keep the optional manager-wide read-only safety flag available for rollback or diagnostics.
- Add controlled-live, DOM-tampering, media-boundary and supported-iPad regression coverage.

## 0.6.0

- Reorganise the tablet into Today, Calendar, Home, Family, Security, Music and Football, with Rooms, Lights, Heating, Blinds & doors and Cleaning grouped inside Home.
- Wrap the installed Daylight/legacy Skylight calendar with Day, Week, Month and Agenda modes, persistent calendar preferences and an explicit read-only event boundary.
- Add schema-v6 cleaning, whole-home and Security contracts, including signals-only exterior cameras, deliberate live viewing, child/bedroom camera rejection and confirmation-gated alarm and garage actions.
- Package the accepted two-floor Sweet Home 3D renders as inert private SVG assets, preserving the Hall-to-Hall U-return stair and keeping Bedroom 4 stair-free.
- Map the current household inventory across 19 lights, six heating zones, four blind channels, the garage, five primary media zones and the Eufy vacuum without inventing private stream IDs.
- Keep Google Classroom behind separate read-only consent for each child and retain the release-wide Home Assistant write block during qualification.
- Expand unit and `1112×834`/`1024×768` browser coverage for all seven surfaces, Home controls, deliberate Security streams, confirmations and read-only enforcement.

## 0.5.3

- Select **Up Next** from current or future calendar events so a finished stale event can no longer displace the genuine next appointment.
- Expand the private floorplans into furnished raised-wall dollhouses while preserving the approved geometry and all 18 room hotspots.
- Give the Rooms plan more of the tablet canvas, tighten its crop and reduce the inactive room-detail column.
- Keep the genuine Mediocre Spotify/Sonos card scrollable in read-only mode while blocking its Home Assistant service-call boundary.
- Remove the Music lock overlay that obscured player rows and contain long speaker lists and grouping chips within the card.
- Format ChoreOps points without spurious trailing zeroes, use recognisable featured-club names, and centre sparse Today content.
- Add exact `1024×768` physical-iPad chrome coverage, stale-calendar regression tests and read-only media-scroll checks.

## 0.5.2

- Enlarge both private floorplans by cropping unused plan margin while keeping every hotspot aligned to its room.
- Replace furniture-like room symbols with architectural floor finishes, walls, windows and plain labels; remove the unexplained selected-room pin.
- Reserve the fixed Home Assistant tablet header so page titles, status pills and the navigation rail no longer sit underneath it.
- Constrain the embedded Mediocre player to the available Music surface and provide explicit dark chip colours so grouping labels remain visible.
- Treat absent temperature entities as unavailable instead of coercing them to a false `0°` average.
- Add Home Assistant chrome, realistic media height and chip-contrast assertions to the supported Chromium and WebKit tablet checks.

## 0.5.1

- Replace the visible survey-plan layer with clean vector dollhouses built from the approved room geometry, including raised walls, floor finishes, furniture cues and the approved household room names.
- Add an explicit floorplan asset revision so Home Assistant cannot reuse the prior cached SVG after a private asset update.
- Replace the pale card-dominant treatment with dark translucent, page-specific surfaces while retaining strong calendar and chore contrast.
- Restore the configured Mediocre Spotify/Sonos player as the Music view; the real card is visible but inert while the dashboard remains in read-only qualification.
- Reduce the interactive room overlay to a subtle state glow so it no longer resembles a second plan drawn over the house.

## 0.5.0

- Redesign the first-party tablet shell with a richer navy-to-coral backdrop, translucent surfaces and intentional Today, Music and Football states while retaining the existing dashboard, app and tunnel identities.
- Replace the embedded calendar card with a legible first-party seven-day agenda backed by Home Assistant's bounded calendar API.
- Add schema-v5 mappings for each child's individual ChoreOps status sensors and render the actual routine name, status and points instead of aggregate counts alone.
- Keep location sharing disabled without leaving an empty Family map by presenting two private child routine panels.
- Support private isometric/cutaway floorplan artwork while preserving explicit percentage-coordinate hotspots and the read-only interaction boundary.
- Retain the v0.4 deployment as a raw hash-verified rollback target and continue to reject camera, entry, location, Classroom, vacuum and device actions during qualification.

## 0.4.2

- Make schema-v4 timezone validation independent of ICU locale data in the minimal Home Assistant app image.
- Add a regression covering the exact `Internal error. Icu error.` failure seen through the live manager tunnel.

## 0.4.1

- Raise the loopback MCP JSON request ceiling to a bounded 1.5 MB so the existing manager can receive the two already-limited private floorplan SVGs.
- Retain the 512 KiB per-file validation, inert-SVG checks, exact asset-set hash confirmation and existing tunnel identity.
- Add regression coverage for a floorplan validation request larger than the SDK's former 100 KiB default.

## 0.4.0

- Replace the multi-view third-party YAML tree with one bundled first-party Family Hub panel sized for the 10.5-inch iPad Pro (`1112×834`) and a `1024×768` fallback.
- Add a two-floor interactive room-plan engine with explicit polygon hotspots, light overlays and selected-room low-risk controls; never infer private house geometry.
- Separate the Home Assistant-native private family map from the house floorplan and add per-child ChoreOps/Classroom read-only summaries.
- Add a server-side, last-good-cache Premier League provider covering all 38 matchweeks, results, scorers and a calculated table, with Tottenham and Aston Villa spotlights.
- Package and snapshot the first-party card through a fixed frontend allow-list while preserving household floorplan assets.
- Restore raw hash-verified snapshots so the installed schema-v3 release remains a valid rollback target.
- Keep Cameras & Entry disabled until separately qualified and add Chromium/WebKit tablet browser projects.
- Upgrade the existing manager and tunnel in place; add a mandatory read-only first deployment plus hash-bound validation and transfer for exactly two inert private floorplan SVGs.

## 0.3.0

- Replace the flat v0.2 card grid with the approved warm-glass family command centre using static gradients, opacity and bounded shadows suitable for the older iPad.
- Move navigation to a slim persistent rail and keep the calendar as the dominant Today and Week surface.
- Add progressive Home controls for room lighting, zoned heating, Cameras & Entry and the existing full media experience.
- Add schema-v3 camera, doorbell-event and garage-cover mappings without exposing camera entities, images, streams, states or history through sanitised inventory.
- Render configured camera start/stop-stream buttons and omit heating-only rooms from the Lighting surface.
- Limit the entry surface to one live camera and require a press-and-hold action plus explicit confirmation before garage movement.
- Extend regression coverage for warm-glass rendering, responsive layout, camera-domain validation and garage safety.

## 0.2.0

- Add the schema-v2 presentation contract for landscape, kiosk, legacy-iOS, theme, weather, lists, covers, ChoreOps helper and Team Tracker mappings.
- Replace placeholder view content with Daylight calendar, native weather/to-do/home controls, Mediocre media, ChoreOps legacy-lite and Team Tracker surfaces.
- Add persistent large-touch navigation for every enabled view and preserve normal Home Assistant chrome for administrators.
- Keep calendar event management disabled pending separate live write qualification.
- Add a deterministic 1024 by 768 generic preview and presentation-layer regression coverage.

## 0.1.2

- Make sanitised inventory and rollback snapshot ordering independent of ICU locale data in the minimal Home Assistant app image.
- Add regression coverage for the exact `Internal error. Icu error.` runtime failure.

## 0.1.1

- Fix Home Assistant OS startup by granting the S6 `/init` launcher the read permission required by its shell interpreter.
- Restore the standard S6 runtime paths to the custom AppArmor profile.
- Add a packaging regression check for startup permissions and release-version consistency.

## 0.1.0

- Add deterministic dashboard configuration validation and compilation.
- Add confirmation-bound deployment and rollback snapshots.
- Add sanitised Home Assistant inventory access.
- Add a bounded MCP tool surface on a private loopback interface.
- Add optional outbound-only OpenAI Secure MCP Tunnel support, disabled by default.
