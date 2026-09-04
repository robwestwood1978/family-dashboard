# Family Dashboard Classroom

This custom Home Assistant integration creates one sensor per child-owned Google
Classroom authorization. It requests exactly two read-only scopes:

- `classroom.courses.readonly`
- `classroom.coursework.me.readonly`

Every 15 minutes it reads active courses, published coursework and the signed-in
student's own submission states. `NEW`, `CREATED` and
`RECLAIMED_BY_STUDENT` are open; `TURNED_IN` and `RETURNED` are complete.
The sensor state is the complete open count and its `assignments` attribute is
limited to the next 20 items. Those detailed attributes are excluded from Home
Assistant Recorder history. OAuth credentials and tokens are owned by Home
Assistant config entries and never enter the Family Dashboard household file.

Installation and authorization are deliberately separate. Installing these
fixed integration files requires a Home Assistant restart; adding each child
then requires their own Google consent in **Settings → Devices & services**.
