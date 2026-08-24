# Proposed v0.8 design approval screens

This release-candidate branch renders the real `family-hub-card` component with the repository's synthetic Home Assistant fixture and is packaged as Manager `0.8.0`. It upgrades the existing dashboard in place without creating a second app, tunnel or deployable preview service, and the approval workflow does not deploy anything to Home Assistant.

The approval run freezes the household clock at 24 August 2026, then captures each important state in Chromium and WebKit at 1024 × 768, 1112 × 834, and 1440 × 900:

- Today
- Home: Rooms, Lights, four-zone Heating, exact six-zone Heating, Blinds & doors, and Cleaning
- Security: idle, read-only, signals-only, not-ready, waking, first-frame buffering, live, stopping, retry/error, protected garage confirmation, and alert/unavailable
- Football: live, cached, and stale health
- Calendar navigation/source controls, the production location-sharing-off Family layout, and a five-room Spotify/Sonos Music surface

The Security captures carry the established privacy boundary into v0.8.0: exterior entry cameras only, one viewer at a time, no preload, and the same guarded Start → buffering → first-frame → Stop lifecycle. The viewer opens only after a deliberate choice; a stream started by the dashboard is stopped when the view closes or the family leaves Security.

Football screenshot state is generated through `normaliseFootballData` and `buildFootballStates`, including provisional completion and the same health attributes used at runtime. The component consumes the resulting official Premier League crest URLs; the browser harness answers them with deterministic club-coloured shields and deliberately fails one crest to verify the visible team-code fallback.

Run locally after installing Playwright Chromium and WebKit:

```sh
npm run test:approval
```

On a pull request, the `Validate` workflow uploads the images and their SHA-256 manifest as the `v080-design-approval-screens` artifact. The manifest gate requires all 144 nominal view/project combinations and ten representative 200% zoom captures across Chromium and WebKit before upload. The six-zone evidence proves a 3 × 2 tablet/wide grid with every zone visible together and a one-column 200%-zoom reflow. All entities, events, camera names, states, and club data used by the renderer are synthetic example data. The Rooms capture uses a structural public example floorplan rather than a private household plan or a cleaning-route map. The simulated card exercises the camera lifecycle but never connects to or opens a household camera.

The design approval run also checks root overflow, Security-label clipping, meaningful text at 12px or larger, enabled controls at 48 × 48px or larger, painted MDI-format icons, floorplan hotspot size, every visible text run under a cross-browser 200% browser-zoom equivalent (half-sized CSS viewport with effective physical text-scale verification), nearest-ancestor clipping and text overlaps, visibly distinct zoom navigation icons with named controls, exact six-zone row/column and visibility geometry, every match for key WCAG contrast pairs on its composited backdrop, and the absence of operator-facing telemetry copy.
