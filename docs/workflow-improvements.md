# ESSU DocuFlow workflow improvements

## Student journey

Register (student ID status is always pending) → office verification → select documents → download linked forms and obtain signatures → upload requirements → review and submit → track the request.

For corrections, students see the office's reason and replace the flagged files before resubmitting. Approved requests explain how to obtain the document. The office records completion after delivery. Rejected student ID decisions display the reason and allow a bounded note requesting another review; this never automatically verifies the account.

## Graduate School office journey

Import the official enrollment CSV in Students → Masterlist. Include historical records when reviewing former students or alumni. Review the entered details against the masterlist and make an explicit verification decision. Missing IDs require a recorded override note. Previous decisions can be revoked with confirmation.

Manage official blank forms in the existing Forms library and link them to document requirements. Review requests from the dashboard or request queue, identify specific uploads needing corrections, approve or reject with a reason, then record delivery when the student receives the document.

Notifications link to the relevant request or student review. Request histories show corrections, resubmissions and delivery. Dashboard queues distinguish requests needing office action from approved documents awaiting delivery. Reports explain the approval-rate denominator.

## Validation

- 17 focused Node tests passed, including authorization, CSV validation and rollback, manual verification, pending registration, unverified request blocking, corrections, stale decisions, delivery and rereview.
- `npm run check`: 0 errors, 71 warnings in 12 files.
- Production build passed; adapter-auto could not identify a production hosting environment locally.
- Approved enrollment migration applied: created enrollment_masterlist using the users.student_id collation and added users.id_verification_note. Database dependency queries passed. Existing student decisions and records were preserved.

## Office setup and practical limits

Import real official enrollment records and upload/link the actual clearance and further-studies forms before office use. The current student account schema does not collect campus; comparisons honestly show that value as missing. Delivery is manually confirmed by the office. Browser testing with real student and office accounts is still needed before deployment.

The migration SQL is in database/migrations/2026-10-09-enrollment-masterlist.sql. No deployment or changes to environment/configuration files were performed.
