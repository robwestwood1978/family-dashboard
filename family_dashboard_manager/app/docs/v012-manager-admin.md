# Manager-backed Admin design

The Family Dashboard needs an administrator-only place for household choices that should not require source edits. The first scope is **Ready templates**: add, rename, reorder and remove templates; edit their keyword matches; and edit the checklist items applied to an event.

This must be a Manager-backed surface, not browser local storage and not a dashboard card rewriting Lovelace storage. The Manager owns the canonical household configuration, schema validation, exact deployment hash and rollback snapshots. Saving an Admin change must therefore follow the same sequence:

1. Require a Home Assistant administrator through authenticated app ingress.
2. Read only the non-secret household configuration already owned by the Manager.
3. Edit a strict allow-list of household-preference fields.
4. Validate the complete candidate against schema v6.
5. Present the exact bounded diff and require one Save confirmation.
6. Create a rollback snapshot, deploy the validated hash and reload the existing dashboard resource.
7. Verify the new active hashes while preserving private floorplans and unrelated mappings.

The initial editable fields should be:

- Ready template label, keyword triggers, checklist items and display order;
- family member display colour;
- writable calendar choice and label;
- Ready look-ahead window;
- kiosk photo-frame timing and clock choice.

Device/entity mappings, Secure MCP Tunnel settings, OAuth credentials, secrets, private floorplans, camera routes, alarm controls and garage controls stay outside this page. They require the existing managed deployment path because a mistaken value could remove controls, expose private data or weaken a protected action boundary.

The shared kiosk must not display Admin. An administrator reaches the page from Home Assistant on their own authenticated device. The dashboard may show an Admin link only when Home Assistant reports `user.is_admin === true`; the actual Manager route must still independently enforce ingress authentication.
