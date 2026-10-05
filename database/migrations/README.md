# Migrations

Applied in numeric order. Each is idempotent (safe to re-run) and the rollback
restores the previous shape.

| File | What |
|---|---|
| `2026-09-11-01-up-requirements-relations.sql` | Replaces the `documents.requirements` / `requests.requirements` JSON blobs with `requirements`, `document_requirements`, `request_requirements` (1NF). |
| `2026-09-11-02-up-programs-purposes.sql` | Extracts `programs` and `purposes` lookup tables; adds `users.program_id` and `requests.purpose_id`. |
| `2026-09-11-verify-equivalence.sql` | Field-by-field proof that the migrated rows match the original blobs. Any output row is a discrepancy. |
| `2026-09-11-90-down-rollback.sql` | Full rollback. Valid while the old blob columns still exist. |

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
