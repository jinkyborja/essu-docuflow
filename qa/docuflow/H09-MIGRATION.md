# H09 password migration

**Draft only — not applied or verified.** The proposed files are preserved in
`h09-draft/`. bcryptjs installation failed (sandbox EACCES, escalated Windows
startup error -1073741502, offline ENOTCACHED). Application changes were restored
to their pre-H09 state. H09 remains open; install bcryptjs before resuming.

New passwords use bcryptjs, cost 12, with a fresh random salt. The versioned
`$docuflow-bcrypt-sha256$v1$` format bcrypt-hashes the base64 SHA-256 digest of
the full UTF-8 password. This bounds bcrypt input below its 72-byte limit
without truncating long legacy passwords. A standalone SHA-256 digest is never
written by the new code. The bcrypt implementation remains the audited library,
not a custom implementation.

Existing lowercase 64-hex SHA-256 hashes remain verifiable. After successful
login of an email-verified account, a conditional update matches user ID, old
hash and auth version before replacing that hash. Wrong passwords and blocked
unverified logins do not migrate. A failed conditional update returns 401 and
issues no session. Login migration does not revoke unrelated existing sessions;
password changes/resets still increment auth_version and revoke them.

Registration, invite acceptance, reset, profile password changes and password
confirmation share one helper. Existing VARCHAR(255) accommodates the format;
no password migration SQL or bulk production job is needed. Dormant accounts
remain legacy until login/reset; already compromised passwords should be reset.
Do not remove legacy verification until remaining legacy accounts are handled.

Deploy the updated package lock with the code. H06's auth_version migration is
still a separate prerequisite. No database changes were performed for H09 QA.

Reference: https://github.com/dcodeIO/bcrypt.js (async API, salts and 72-byte limit).
