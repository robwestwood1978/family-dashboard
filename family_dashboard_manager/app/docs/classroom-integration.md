# Google Classroom integration

Family Dashboard Classroom is a first-party custom Home Assistant integration.
It creates one read-only open-assignment sensor for each child-owned Google
authorization. It does not ask for, receive or store a child's password.

## Privacy and data contract

- Authorize one config entry separately for each child.
- Request exactly `classroom.courses.readonly` and
  `classroom.coursework.me.readonly`.
- Read only ACTIVE courses, PUBLISHED coursework and the signed-in student's
  own submission records (`userId=me`).
- Treat `NEW`, `CREATED` and `RECLAIMED_BY_STUDENT` as open; treat `TURNED_IN`
  `RETURNED` and `STUDENT_EDITED_AFTER_TURN_IN` as complete. An unknown future
  state fails the poll rather than silently under-counting work.
- Force Google's account chooser on every authorization, bind the entry to a
  one-way hash of the stable submission owner ID, reject the same Google
  account for a second child and reject a different account during reauth. The
  raw Google ID is held only in memory while checking a response and is not
  exposed as a sensor attribute or stored in dashboard configuration.
- Poll every 15 minutes.
- Use the sensor state for the complete open count and expose no more than 20
  assignment summaries in the `assignments` attribute.
- Mark the detailed assignment and freshness attributes as unrecorded so Home
  Assistant's Recorder does not retain their titles, course names or links.
- Keep OAuth client credentials and child tokens in Home Assistant's standard
  Application Credentials/config-entry storage. They never enter
  `household.json`, dashboard YAML, Manager snapshots or Manager logs.
- Retain the last complete result during a transient API failure and mark it
  `data_stale`; a rejected authorization triggers Home Assistant's reauth flow.

Google documents both scopes as read-only and confirms that the coursework
scope is accepted for listing a student's own submission states:

- https://developers.google.com/workspace/classroom/guides/auth
- https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork.studentSubmissions/list

## Fixed-file installation

The v0.9 Manager image bundles the integration. Installation is a separate,
explicit operation from dashboard deployment and OAuth consent:

1. Call `get_classroom_integration_status` and record `bundled_set_hash` and
   `active_set_hash` (which is `null` before first install). If
   `install_available` is false because the standard `custom_components`
   parent is missing, create `/config/custom_components` once with a trusted
   Home Assistant file-management tool; Manager deliberately cannot create a
   broader config path.
2. Call `install_classroom_integration` with `confirm=true`, that exact bundle
   hash and that exact active hash.
3. Confirm the returned `resulting_set_hash` and rollback snapshot.
4. Restart Home Assistant Core once. The Manager never restarts it.

The installer can write only these fixed files under
`/config/custom_components/family_dashboard_classroom`. It rejects symlinks,
missing files, oversized files and any unmanaged path; stages a complete set on
the same filesystem; verifies every file hash; and performs a bounded directory
replacement after taking a restorable snapshot. The standard `/config/custom_components` parent must already exist
as a regular directory; Manager will not create or follow a broader path. A
pre-change snapshot can be restored only with
`rollback_classroom_integration`, `confirm=true` and the exact current set hash.
Rollback changes integration code only—it never changes or deletes OAuth config
entries. Restart Home Assistant Core after a rollback as well.

## Google and Home Assistant setup

1. In the existing Home Assistant Google Cloud project, enable the **Google
   Classroom API**. If there is no project yet, follow Home Assistant's Google
   Web Auth credential procedure and create a Web application OAuth client:
   https://www.home-assistant.io/integrations/google/
2. Configure the Google consent screen and add only the two scopes above. Add
   each child account as a test user while the app is in Testing, or publish the
   app according to Google's policy. School administrators can still block the
   authorization; do not try to bypass that policy. For an External consent
   screen left in Testing, Google expires refresh tokens after seven days when
   scopes beyond basic profile information are requested. These Classroom
   scopes therefore require weekly reauthorization while Testing; use the
   appropriate published/Production status, subject to Google's and the
   school's policies, for a durable household setup. Google documents the
   testing-mode limit here:
   https://developers.google.com/identity/protocols/oauth2#expiration
3. The Web OAuth client's authorized redirect URI must be exactly
   `https://my.home-assistant.io/redirect/oauth`, as specified by Home Assistant.
4. In Home Assistant, open **Settings → Devices & services → ⋮ → Application
   credentials**, select **Family Dashboard Classroom**, and enter the OAuth
   client ID and secret. Home Assistant documents that standard flow here:
   https://www.home-assistant.io/integrations/application_credentials/
5. Open **Settings → Devices & services → Add integration → Family Dashboard
   Classroom**. Enter the first child's dashboard name, then authorize that
   child's own Google school account in Google's forced account chooser and on
   its consent screen. The first connection requires at least one piece of
   assigned coursework so the integration can bind that account safely. Repeat
   by adding the integration again for the second child; reusing the first
   child's Google account is rejected.
6. Check the two generated `sensor.*_classroom_open_assignments` entities. Use
   their actual entity IDs in `school.classroom_students[].assignments_entity`.
7. Enable `features.school` only after both real sensors exist and each family
   card is mapped to the correct child.

No OAuth client ID, client secret, authorization code, access token, refresh
token or child's email address belongs in Family Dashboard configuration.
