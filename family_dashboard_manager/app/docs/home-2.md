# Home 2 and page-specific family views — 0.29.0

Home gains an Overview section (`home.default_section: "overview"`). Existing configured defaults remain supported. It shows live room activity and temperature, lighting, heating, covers and optional cleaning; the existing room floorplan and specialist controls remain available. The inside-lights-off action excludes configured exterior lights and uses the existing bounded lighting service. Energy freshness is retained; unavailable devices remain visible rather than being presented as off.

Room cards open focused controls using the existing room mappings. They retain light details, temperature adjustments, covers, scenes and music. The background is inert, Escape and Done return focus to the room or current filter, and Show on floorplan opens the selected room. Garage actions continue through Security confirmation.

Today, Calendar and Tasks remember independent person selections on the device. Device preferences migrate from version 2 to 3: an old global selection is retained in Tasks only, and shared pages start with everyone. Dates are never persisted. Calendar keeps its own per-person display mode; Tasks keeps its own per-person section. The optional simple view has a separate selection and remains optional. Viewing preferences do not change the signed-in Home Assistant user or permissions.

Validation includes preference migration and unavailable-room unit checks, cross-page/reload browser checks, live room updates, focused controls and read-only behavior, portrait and landscape layouts, both appearances and the existing 200% zoom audit. Live verification uses navigation and unsaved/read-only inspection without operating household devices.
