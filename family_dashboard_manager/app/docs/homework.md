# Homework hub

The first version lives under Tasks → Homework and uses the same child switcher as Jobs. A local `Family Dashboard Homework` integration stores content and progress centrally in private Home Assistant storage. The Manager cannot read or write Home Assistant’s `.storage` files directly.

## One-time setup

1. Update Manager to 0.21.0.
2. Open Admin → Homework and install its fixed local integration bundle.
3. Restart Home Assistant and add Family Dashboard Homework under Devices & services.
4. Save each child’s regular school deadlines and practice goals in Admin → Homework.
5. Enable `school.homework_enabled` in household settings and refresh the existing dashboard resource.

## Each week

Add the main school work, exact spelling words and separate maths sheet as dated plans. A DOCX import extracts text and HTTPS links for a parent to review. It does not fetch private linked Google documents, infer missing deadlines or publish anything automatically. Edit the text down to the child’s instructions, select relevant links, enter dates, then Review & publish. PDF/OCR and automated Classroom imports are future adapters.

Reading logs count the seven days ending on that child’s book-return day. The dashboard log supplements the paper school record, which still needs an adult signature. Finished at home and handed in at school remain separate. Maths has its own set and due days and does not depend on Classroom.

Spelling can play through the Home Assistant speech provider selected under School → Spelling TTS entity. Choose the existing Google Translate provider and `en-gb` for British English. Only the active spelling word is sent; Home Assistant caches its audio and playback is on the tablet, independently of the departure speakers. The button waits for an audio URL before enabling playback so the iPad tap starts sound directly. On failure, retry or explicitly choose a device voice under Voice options. With no provider configured, the device voice picker remains available. Practice offers peeking and feedback; the mock test gives results at the end. Results are family practice records, not teacher grades. Tackling Tables opens the school website; launching it does not record completion. Log a Learn, Play or Test session after completing it.

Today shows approaching school deadlines and Calendar shows the recurring school days. This release does not send push messages or submit school work. A holiday pause is inclusive through its chosen date. Parent rules are editable as children grow; old dated plans and logs remain available, and old words are never reused for the next test.

## Boundaries

Authenticated users may read homework if they can read its revision entity. Updates require control permission. Parent content changes require an administrator and an exact current revision, with five prior parent snapshots retained. Progress actions merge under a lock, persist before confirming, and use request IDs to prevent duplicated retries. Read-only dashboard mode disables all progress controls.

Only a revision number appears as a sensor. Document text, words and reading logs are not deployed as public frontend files. School documents remain links under the school’s permissions.

## Spelling changeover

Under Children & regular deadlines, optionally set Next spelling list after test (time), for example 09:00. On the child’s spelling-test day, practice switches to the following test’s saved list after that local Home Assistant time. Blank retains the previous all-day behaviour. The actual school test and sheet remain attached to their original date; logs and results are retained. A next list dated to start the following day may become available at the changeover; later plans and other school work remain hidden until their set dates. Missing lists never reuse old words. An open practice session can finish its current list.

Updating the local Homework integration to 1.1.0 and restarting Home Assistant is required for timed changeover; existing plans and progress are preserved.
