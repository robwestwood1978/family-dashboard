# Family day experience

Version 0.21.0 adds three features to the existing dashboard. No extra integration or sign-in is needed.

## Whose day?

Use the Family button in the header to choose Everyone or a family member. Today, Calendar, Tasks and Homework use that selection together. The existing calendar filters and child tabs also update it. Each person's calendar mode, selected date and task section are remembered in this browser. Clearing website data clears those viewing preferences.

Choosing a parent shows the children's task overview. This is a viewing preference: it does not sign into another Home Assistant account or grant parent permissions. Device controls, protected confirmations and parent administration continue to use the existing account and configuration.

## Today follows the day

With Homework enabled and profiles configured, Today brings two useful actions forward:

- Morning and lunchtime: reading records, books and school returns due today or tomorrow, including overdue work.
- After school: unfinished school work and available spelling practice, then reading and Tackling Tables.
- Evening: reading together, then unfinished work or tomorrow's reading-record preparation.

The buttons open the corresponding Homework activity for the correct child. Viewing or launching an activity never records completion. Existing jobs appear when there are no applicable school actions. Shared checklists, school deadlines and football remain available.

In Parent Admin, open Kiosk & photos → Day rhythm. After school defaults to 15 (3 pm), evening to 19 (7 pm), using the household timezone. Weekend afternoons use “This afternoon”. Homework holiday pauses are respected; parents still manage school work, goals and return days under Homework.

## Useful family photos

The photo frame supports the existing iPad-local album and private Home Assistant album. It adds weather and the next outstanding school return; when there is no school reminder, it can show the next shared Family calendar plan. Personal calendars are excluded from the photo frame. The clock and reminder update without restarting the current photo.

Parent Admin → Kiosk & photos → Photo frame has independent Show clock, Show weather and Show reminder switches. Weather and reminders default on for existing configurations. A tap, key press or motion from the already-configured motion entity returns to Today. This does not enable cameras, facial recognition or new device permissions.

Photos selected on the iPad remain in that browser's local album. This release does not upload them, change the original photo library or share the local album with other devices.
