# School mornings

Version 0.22.0 adds a shared school departure clock. Home Assistant runs it independently of any open browser or iPad. The dashboard only displays the countdown and sends parent changes.

## First setup

1. Update Family Dashboard Manager and deploy the current household configuration to install the matching frontend resources.
2. In Parent Admin → School mornings, install the bundled integration. Restart Home Assistant, then add **Family Dashboard School Mornings** under Settings → Devices & services → Add integration. It starts disabled.
3. Review and save weekday times, an enabled Sonos speaker, an existing TTS provider, announcement volume and reminder minutes. Zero means the departure announcement. A blank weekday has no run. Weekend days can be enabled explicitly.
4. Use the test announcement to check the saved speaker and volume.

The countdown appears on Today during the chosen lead time, and remains until 30 minutes after departure. It replaces the next event panel to preserve the layout. Shared countdown context also appears on the idle photo frame.

## Parent controls

- **Change today** sets an actual departure time and travel method. Drive, walk, cycle and scoot are labels, with no guessed journey duration. The usual week is unchanged. The same controls are available in Admin before the countdown is visible.
- **We’ve left**, **Skip today** and **Mute today** stop remaining spoken warnings today. Restore usual time or unmute to resume; a warning already claimed never repeats that day.
- **Pause through this date** includes the chosen date; clear it to resume immediately.
- Weekday times and the display use Home Assistant’s local timezone, including daylight saving changes.

## Reliability and boundaries

The integration checks every ten seconds. It durably claims each reminder before sending a fixed phrase, and accepts a crossing only within twenty seconds. It never catches up a backlog or retries failed speech in a loop. A saved failure is shown on Today and in Admin. The current and five previous settings are stored privately; the bounded sensor contains no credentials.

Only parent administrators can change the daily run. The Admin proxy retains its ingress authorization and mutation header. The audio boundary accepts only saved, enabled Sonos targets and a validated TTS entity; the message and service are fixed by code. The selected speech provider processes these generic reminder phrases using its normal configuration. Sonos announcement support and network access to Home Assistant’s audio must work; a sent service call does not prove sound was heard.

A hash-guarded installer manages only the fixed integration files and creates a rollback snapshot. Updating it requires a Home Assistant restart. Existing Homework and Classroom data and integrations are independent.
