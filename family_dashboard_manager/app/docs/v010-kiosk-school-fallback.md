# v0.10 kiosk photo frame and School fallback

Version 0.10.0 updates the existing Family Dashboard Manager in place. It does not create a second Home Assistant app, dashboard, configuration store or Secure MCP Tunnel. The accepted v0.9 dashboard remains the rollback point until the v0.10 candidate is separately validated.

## Kiosk photo frame

The dashboard can replace its active surface with a private photo frame after inactivity. A tap, key press, or an `on` transition from the configured Companion App camera-motion entity returns to the same dashboard view. The Home Assistant Companion kiosk keeps the iPad display awake; the dashboard does not attempt to bypass iOS screen-lock controls.

Photo access is deliberately narrow:

- the configured album must be below `media-source://media_source/local/family-dashboard`;
- only direct image children are considered, with a maximum of 250;
- each image is resolved through Home Assistant's signed `/media/local/family-dashboard/` path;
- public iCloud Shared Album URLs, arbitrary web images, traversal paths and video are rejected;
- photo names and media contents are never written to the repository or dashboard configuration.

Example contract:

```json
{
  "display": {
    "kiosk": true,
    "photo_frame": {
      "enabled": true,
      "idle_seconds": 300,
      "slide_seconds": 20,
      "media_source": "media-source://media_source/local/family-dashboard/photos",
      "motion_entity": "binary_sensor.example_ipad_camera_motion",
      "show_clock": true
    }
  }
}
```

The first household rollout should use a curated export from iCloud Shared Library placed in the private Home Assistant media folder. Continuous iCloud synchronisation is not part of this release because Apple does not provide the dashboard with an approved Shared Library media source.

## School while Workspace approval is pending

`school.source` has two explicit modes:

- `classroom` keeps the existing read-only, per-child Classroom sensor contract and still requires one real assignment sensor for every child;
- `calendar` allows School to operate from read-only school calendar entities already present in `calendar.entities`.

Calendar fallback requirements are fail-closed: every configured School calendar must also be a `category: "school"` calendar source, and the sources must cover every child through `person_ids`. The Family surface labels this mode as `Calendar-only fallback · Classroom remains disconnected` so dates cannot be mistaken for assignment status or grades.

## Rollout gates

1. Merge and publish Manager v0.10.0 through the existing app repository.
2. Update the installed Family Dashboard Manager in place and confirm `/health` reports `0.10.0` through the existing Secure MCP Tunnel.
3. Put curated photos in the private Home Assistant `family-dashboard/photos` media folder.
4. Read and validate the current household configuration without writing it. Add only the photo-frame block and, if suitable school calendars exist, `school.source: "calendar"`.
5. Confirm the private floorplan hashes are unchanged.
6. Make one hash-confirmed household deployment. Preserve the new rollback snapshot identifier.
7. Refresh the existing Lovelace resource to `/local/family-dashboard/family-hub-card.js?v=0.10.0`, reload the existing dashboard, then test photo idle, tap return and motion return once each.

Do not enable `school.source: "classroom"` until both real Classroom sensor IDs exist. Do not paste OAuth credentials, child account details or private photos into GitHub, dashboard configuration or support chat.
