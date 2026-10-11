# Migrations

Applied in numeric order. Each is idempotent (safe to re-run) and the rollback
restores the previous shape.

| File | What |
|---|---|
| `2026-09-11-01-up-requirements-relations.sql` | Replaces the `documents.requirements` / `requests.requirements` JSON blobs with `requirements`, `document_requirements`, `request_requirements` (1NF). |
| `2026-09-11-02-up-programs-purposes.sql` | Extracts `programs` and `purposes` lookup tables; adds `users.program_id` and `requests.purpose_id`. |
| `2026-09-11-verify-equivalence.sql` | Field-by-field proof that the migrated rows match the original blobs. Any output row is a discrepancy. |
| `2026-09-11-90-down-rollback.sql` | Full rollback. Valid while the old blob columns still exist. |
| `2026-10-11-student-id-photos.sql` | Adds nullable `users.id_photo_path` and `users.id_photo_uploaded_at` for ID uploads and review; safe to re-run. |
| `2026-10-11-student-campus.sql` | Adds nullable `users.campus`; signup requires a campus, and ID review compares it with the masterlist. Safe to re-run. |

Student ID uploads and `/api/students/[id]` require the student ID photo migration,
in addition to the ID verification and enrollment masterlist migrations. Without
the photo columns, opening a student review fails with HTTP 500. Apply
`2026-10-11-student-id-photos.sql` to existing databases before using these features.
It only adds missing columns; existing records and verification decisions remain
unchanged. Photo uploads also require a private Supabase Storage bucket named
`student-ids`.

Campus collection requires `2026-10-11-student-campus.sql` before deploying the
signup changes. Existing students keep a null campus until they or the office
enter it. New students select a campus and upload their front school ID photo
during signup. The photo uploads directly to private Storage; the registration
endpoint validates its signed token and stored contents before saving the
account, campus, photo path, timestamp and admin notices in one transaction.

## Important

The up-migrations deliberately **do not drop** `documents.requirements` and
`requests.requirements`. They remain as a safety net until the application has
run against the new tables in production; dropping them is a separate follow-up
once you're satisfied. Rollback is only trivial while they exist.

Rehearse on a copy first:

```sh
mysqldump --set-gtid-purged=OFF --no-tablespaces <conn> defaultdb > backup.sql
mysql <conn> scratch_db < backup.sql
mysql <conn> scratch_db < 2026-09-11-01-up-requirements-relations.sql
mysql <conn> scratch_db < 2026-09-11-02-up-programs-purposes.sql
mysql <conn> scratch_db < 2026-09-11-verify-equivalence.sql   # expect no rows
```
