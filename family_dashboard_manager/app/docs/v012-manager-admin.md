# v0.12 household Admin and child Tasks

Family Dashboard Admin is a Home Assistant administrator-only app ingress panel. It edits the Manager's canonical non-secret schema-v6 household configuration; it is not tablet-local storage and it does not write Lovelace storage directly.

An administrator can manage:

- household name, locale and timezone;
- people, roles, colours and optional presence mappings;
- enabled dashboard experiences;
- calendar sources, creation rights, Ready list and preparation templates;
- ChoreOps child mappings and a verified parent dashboard path;
- two favourite Premier League clubs;
- default view, kiosk and private photo-frame behaviour;
- theme, rooms, floorplans, media, energy, weather, cleaning and security mappings.

OAuth credentials, Home Assistant tokens, app options and Secure MCP Tunnel settings are never sent to the Admin browser. Private floorplan files use their separate inert two-file validator and deploy route. Security, floorplan, location and school edits are labelled protected and require a second acknowledgement in the review dialog.

Every save is one transaction:

1. Require Home Assistant's administrator-only panel and Supervisor ingress source.
2. Read the active non-secret configuration and its exact hash.
3. Validate the complete candidate against schema v6.
4. Reject managed identity changes and stale Admin sessions.
5. Show the exact bounded leaf-level diff.
6. Require one Save confirmation, plus protected acknowledgement when applicable.
7. Snapshot and deploy through the existing Manager hash contract.

Tasks is child-first when location sharing is off. Each child gets a large, colour-coded job surface. A direct claim is available only when the configured ChoreOps status sensor has the exact derived claim button and the job is pending, due, overdue or missed. The dashboard calls only `button.press` on that exact claim entity, prevents double submission and never exposes approve or disapprove buttons. ChoreOps remains authoritative for chore definitions, recurrence, points, adult approval and rejection.

The generic `/choreops` route is intentionally hidden because it can resolve to Home Assistant Overview. **Parent controls** appears only for a separately verified deeper internal path configured by an administrator.
