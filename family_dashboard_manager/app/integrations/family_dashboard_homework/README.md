# Family Dashboard Homework

Local, authenticated homework plans and progress. Add this integration once after installing its fixed bundle and restarting Home Assistant. Configure children and weekly plans in Family Dashboard Admin.

Data stays in a private Home Assistant Store with atomic writes. Parent edits require an administrator and the current revision; five previous parent edits are retained. Progress merges bounded operations under a lock; request IDs make retries idempotent. No credentials, public files, external callbacks or school submissions are used. Read-only accounts cannot update progress. The state entity carries only a revision, never children's reading logs or spelling words.

Reading counts use the seven days ending on each child's book-return day, inclusive. Spelling and tables follow the test day. Maths has independent set and hand-in days. Holidays can pause routines through an inclusive date. A published plan has explicit dates and never rolls its contents into another week.
