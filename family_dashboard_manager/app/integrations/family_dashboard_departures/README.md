# Family Dashboard School Mornings

A shared departure clock runs inside Home Assistant every ten seconds, independent of the iPad page. Configure weekday times, Sonos announcement targets, the existing TTS provider, volume, reminder minutes and holiday pauses through the administrator-only Family Dashboard panel. Times use Home Assistant's local timezone.

The dashboard reads one bounded WebSocket view. Only administrators can override today's time/travel method, mute, skip or mark the departure as left. These changes are private, shared between devices and expire with the local day. Original weekday times are retained.

Each reminder is durably claimed before one `media_player.play_media` announcement to configured, enabled Sonos entities, at the saved volume. The message is a fixed school-run phrase encoded into the selected `tts` entity's media-source URL. There is no arbitrary URL, service, message or filesystem endpoint. The selected speech provider's normal processing applies. No announcements run while disabled, paused, skipped, left or muted. Past warnings are not replayed after restarting, changing time, refreshing or waking the tablet. Failed announcements are reported and are not retried in a loop.

The revision and bounded view are published in `sensor.family_dashboard_departure`. Settings, daily changes, sent-warning claims and five prior settings snapshots stay in private Home Assistant storage. No external account or additional credentials are created.
