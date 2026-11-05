# Music 2

The Music view is a first-party `family-music-page` component. It replaces the embedded third-party Music card while retaining the existing `media.players` mappings. Native `entity_id` controls transport and volume; `ma_entity_id` supplies collection browsing and Music Assistant playback. `media.card_type` remains a legacy compatibility field and is no longer mounted for Music.

The selected room is shared by the Music room chips and persistent dashboard playback dock. Search and collection selection do not change rooms. Grouping is behind a labelled panel, uses only configured groupable rooms, and keeps the current configured coordinator as the main room. An unconfigured group coordinator cannot receive actions.

## Search and library

Search first calls `music_assistant.search` with `library_only: true`, then performs one full-catalogue request. Saved results can be used while the catalogue is loading. All shows a short section for each category; category buttons request the larger category result. Successful searches are cached for five minutes, empty responses briefly for thirty seconds, and matching in-flight requests are deduplicated. A manual retry refreshes the result. Late responses cannot overwrite a newer search.

Playlists, favourites and recent library tracks use `music_assistant.get_library`. Pages contain 24 items per requested type and Load more uses explicit offsets; favourites combine albums, playlists and tracks. Recent tracks use `last_played_desc` and reflect Music Assistant's library history, not Spotify's entire external listening history. Collection details use HA's configured Music Assistant `media_player/browse_media` action; the number shown is explicit because the upstream browse interface may return a bounded collection.

Only one loaded Music Assistant connection is automatically selected. Multiple connections or an unavailable connection produce a useful error rather than guessing. No credentials, arbitrary URLs or service selectors are collected by the dashboard.

## Playback and queue identity

Playback actions use the exact returned item URI. Play now explicitly replaces the room's Music Assistant queue. If native playback and Music Assistant current-item metadata agree, Play next and Add to queue target that Music Assistant player. External Spotify playback receives compatible Spotify items through the native player's enqueue action instead, preserving its current queue. Saved collections represented only by library URIs cannot be appended to an external Spotify queue; the page explains this and offers Play now. Individual compatible songs can be appended.

Up next uses the configured group coordinator. A matching Music Assistant current item permits `mass_queue.get_queue_items`; otherwise `sonos.get_queue` reads the actual native queue. The current item is matched by normalised Spotify URI, then title and artist. Subsequent items retain their absolute Sonos positions or returned Music Assistant queue IDs. When the current position is unknown, the page labels the saved order and disables queue jumping. Unsupported sources and failed reads show an explanation, never another room's queue.

Only current fetched queue items can be selected. No arbitrary queue commands or third-party service facade are exposed. Read-only mode independently guards playback, queue selection and grouping in the handlers. Detached views cannot send new playback requests. Queue polling runs only while the Music element is mounted and the document is visible; it does not perform catalogue searches.

## Provider limits

An empty catalogue response can represent a service timeout, not proof that a song does not exist. Keep saved matches and retry controls visible. Spotify can rate-limit Music Assistant's shared allowance; repeated searches or restarts do not remove that limit. [Music Assistant's Spotify documentation](https://www.music-assistant.io/music-providers/spotify/#optional-add-a-personal-client-id) describes an optional personal Client ID. That account setup stays in Music Assistant/Spotify and is not stored in this public repository or dashboard configuration.

## Layout and verification

Browsing and Up next have separate bounded scroll areas in tablet landscape. Narrow layouts provide labelled Browse music / Up next switches. The same component survives parent shell redraws; the shell restores its focused input and both scroll positions. Playback updates do not rebuild the search form. Inputs use 16px text and controls use 48px touch targets.

Tests cover native/Music Assistant URI matching, queue source mismatch, exact playback targets, detached/read-only writes, late search responses, input and scroll preservation, provider failures, theme readability, portrait and keyboard-sized viewports. The module is included in the manager's fixed managed-frontend file list and snapshots.
