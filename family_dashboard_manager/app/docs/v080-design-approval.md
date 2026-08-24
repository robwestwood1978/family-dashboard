# Proposed v0.8 design approval screens

This review branch renders the real `family-hub-card` component with the repository's synthetic Home Assistant fixture. It remains packaged as Manager `0.7.4`; the v0.8 label describes a design proposal only. It does not create a second dashboard app, tunnel, or deployable preview service, and the approval workflow does not deploy anything to Home Assistant.

The approval run freezes the household clock at 24 August 2026, then captures each important state in Chromium and WebKit at 1024 × 768, 1112 × 834, and 1440 × 900:

- Today
- Home: Rooms, Lights, Heating, Blinds & doors, and Cleaning
- Security: idle, waking, first-frame buffering, protected confirmation, and alert/unavailable
- Football: live, cached, and stale health
- Calendar, Family, and Music visual smoke screens

The Security captures retain the v0.7.4 privacy boundary: exterior entry cameras only, one viewer at a time, no preload, and the same guarded Start → buffering → first-frame → Stop lifecycle. The viewer opens only after a deliberate choice; a stream started by the dashboard is stopped when the view closes or the family leaves Security.

Football screenshot state is generated through `normaliseFootballData` and `buildFootballStates`, including provisional completion and the same health attributes used at runtime. The component consumes the resulting official Premier League crest URLs; the browser harness answers them with deterministic club-coloured shields and deliberately fails one crest to verify the visible team-code fallback.

Run locally after installing Playwright Chromium and WebKit:

```sh
npm run test:approval
```

On a pull request, the `Validate` workflow uploads the images and their SHA-256 manifest as the `v080-design-approval-screens` artifact. The manifest gate requires all 102 nominal view/project combinations and four representative 200% zoom captures before upload. All entities, events, camera names, states, and club data used by the renderer are synthetic example data. The simulated card exercises the camera lifecycle but never connects to or opens a household camera.

The design approval run also checks root overflow, Security-label clipping, meaningful text at 12px or larger, enabled controls at 48 × 48px or larger, floorplan hotspot size, every visible text run under a cross-browser 200% browser-zoom equivalent (half-sized CSS viewport with effective physical text-scale verification), nearest-ancestor clipping and text overlaps, named navigation controls, every match for key WCAG contrast pairs on its composited backdrop, and the absence of operator-facing telemetry copy.
