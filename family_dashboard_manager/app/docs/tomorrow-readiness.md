# Shared preparation

Version 0.24.0 adds the first part of the Family Dashboard 2.0 direction. Today brings saved preparation together with school lunch exceptions and existing homework progress. The evening view uses the next calendar date; the morning uses today. Household timezone and the configured evening hour determine that change. The same preparation item remains the source of completion on both sides of midnight.

The main view shows up to three priorities, or two when landscape height is limited. Open preparation shows the full list. Child selection filters to that child; parent and Family selections show everyone. Home controls remain available under Home, and the school-run countdown keeps its existing behavior. Unavailable source data produces a warning instead of an all-ready claim.

## Ownership and completion

Each saved preparation task has a native parent selector. A parent is a responsibility label, independent of the Home Assistant account and the family viewing picker. The choice is stored as an optional `Owner` field in the existing task description. Changing it fetches the current description and sends only the new description. Completion changes send only status. This preserves a simultaneous completion update from another device. Simultaneous choices of owner follow the task provider's last accepted update.

Calendar, Tasks and Today use the same Home Assistant preparation list. The dashboard polls the list at the minute boundary and reloads it on foregrounding. A write waits for Home Assistant and then reads the list again. Failed writes remain retryable. Read-only displays disable both ownership and completion, including the action handlers.

Reading records open the existing reading checklist; readiness requires the record written, adult signature and books-ready marks. Homework marked finished at home remains distinct from handed in at school. No preparation action awards ChoreOps points or marks a school submission as handed in.

## Automatic packed-lunch tasks

Enable **Calendar & Ready → Preparation → Automatic lunch** in Parent Admin, or set `calendar.preparation.automatic_lunch` to true in the validated household configuration. The default is false for existing installations. A published rotating menu and the dedicated preparation list must already be configured.

The Manager runs a single serial refresh every minute, including while tablets sleep. It reads only the configured preparation list and creates missing packed-lunch tasks for today and tomorrow using the same menu and identity rules as the browser. Dates and child IDs identify the tasks; reloading a tablet or changing the owner does not create another task. Existing completion is retained. Term boundaries, weekdays and explicit school closure dates come from the published lunch configuration. Homework and school-run pauses do not change the menu; use its closure dates for exceptions.

If a menu correction removes a current packed-lunch requirement, only the corresponding marked automatic task for today or tomorrow is withdrawn. Ordinary event preparation and past records remain untouched. The loop performs no writes in read-only mode and never creates tasks after a failed list read. The fixed status entity `sensor.family_dashboard_preparation` contains availability and the last successful refresh time, without child names, task text or ownership. There is no new MCP tool or generic Home Assistant service endpoint.

This release uses the existing task provider and requires no new Home Assistant custom integration or core restart. Update Manager, deploy the validated configuration and refresh the existing Family Dashboard resource to v0.24.0. Normal Manager snapshots cover the dashboard configuration and frontend files; live to-do progress remains in Home Assistant.

The school-message inbox and weekly handover remain subsequent releases.
