# Home room controls — 0.30.0

Home opens a room’s actual controls beside a compact room selector. It uses the existing `home.default_section: "overview"` setting and `home.default_room`; the first tab is labelled Room controls. The previous floorplan is labelled Floorplan, followed by Lights, Heating, Blinds & doors and optional Cleaning.

The room selector shows configured controls, floor selection and All/Active/Issues filters. Rooms without controls remain in a separate expandable list. Explicit room selections remain stable when devices change state; switching rooms preserves the room list’s scroll position. Room controls adapt to available lighting, comfort, scenes and music mappings. Four lighting controls fit a short landscape screen, with capability-aware brightness and shorter labels when a device name repeats its room name. Accessible names retain full device names.

Room-wide lighting and inside-lights-off use the existing service allowlists. Exterior lights stay excluded from inside-lights-off; read-only and unavailable controls stay disabled. Garage operations still route through protected Security actions. No new Home Assistant integrations or credentials are introduced.

Today, Calendar, Tasks and optional simple mode retain independent viewing preferences. Full dashboard remains the default experience.

Validation covers direct toggles and brightness, unavailable/read-only controls, floor and room selection, long-list scroll preservation, live updates, landscape/portrait/narrow layouts, both appearances and the existing 200% zoom audit. Live checks use navigation without operating household devices.
