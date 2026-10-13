# Homework hub

The first version lives under Tasks → Homework and uses the same child switcher as Jobs. A local `Family Dashboard Homework` integration stores content and progress centrally in private Home Assistant storage. The Manager cannot read or write Home Assistant’s `.storage` files directly.

## One-time setup

1. Update Manager to 0.20.2.
2. Open Admin → Homework and install its fixed local integration bundle.
3. Restart Home Assistant and add Family Dashboard Homework under Devices & services.
4. Save each child’s regular school deadlines and practice goals in Admin → Homework.
5. Enable `school.homework_enabled` in household settings and refresh the existing dashboard resource.

## Each week

Add the main school work, exact spelling words and separate maths sheet as dated plans. A DOCX import extracts text and HTTPS links for a parent to review. It does not fetch private linked Google documents, infer missing deadlines or publish anything automatically. Edit the text down to the child’s instructions, select relevant links, enter dates, then Review & publish. PDF/OCR and automated Classroom imports are future adapters.

Reading logs count the seven days ending on that child’s book-return day. The dashboard log supplements the paper school record, which still needs an adult signature. Finished at home and handed in at school remain separate. Maths has its own set and due days and does not depend on Classroom.

Spelling uses the browser’s speech synthesis when available, with adult dictation as an offline fallback. Practice offers peeking and feedback; the mock test gives results at the end. Results are family practice records, not teacher grades. Tackling Tables opens the school website; launching it does not record completion. Log a Learn, Play or Test session after completing it.

Today shows approaching school deadlines and Calendar shows the recurring school days. This release does not send push messages or submit school work. A holiday pause is inclusive through its chosen date. Parent rules are editable as children grow; old dated plans and logs remain available, and old words are never reused for the next test.

## Boundaries

Authenticated users may read homework if they can read its revision entity. Updates require control permission. Parent content changes require an administrator and an exact current revision, with five prior parent snapshots retained. Progress actions merge under a lock, persist before confirming, and use request IDs to prevent duplicated retries. Read-only dashboard mode disables all progress controls.

Only a revision number appears as a sensor. Document text, words and reading logs are not deployed as public frontend files. School documents remain links under the school’s permissions.
