# ESSU DocuFlow — TODO

Feature requests and known gaps. Sources: client requirements doc (`programcourse.docx`, 2026-08-18), client follow-up answers (2026-08-19), and a codebase audit (2026-08-18). Check items off as they land; add new ones as they come in — this file is the single place to look.

## Database normalization (3NF) — done 2026-09-11

- [x] **Replaced the two JSON blob columns with relations.** `documents.requirements` and `requests.requirements` held JSON arrays (a 1NF violation, and the reason a failed upload was invisible to queries). Now `requirements` (master list), `document_requirements`, `request_requirements`. "Clearance Form" went from 6 duplicated copies to **one row shared by 6 documents**.
- [x] **Extracted `programs` and `purposes` lookup tables**, with `users.program_id` and `requests.purpose_id` FKs. Free-text program values that didn't match the official list (`MAED`, `MSIT`, `Bachelor of Science in Information Technology`) were preserved as `is_active = FALSE` rows rather than dropped, so no student lost their program.
- [x] Migration rehearsed on a full copy of live, proven equivalent field-by-field, rollback tested, idempotent. Scripts in `database/migrations/`. Applied to live 2026-09-11 and verified end-to-end through the app (create → correction → resubmit → approve, with real file uploads).
- [ ] **Follow-up: drop the legacy columns.** `documents.requirements`, `requests.requirements`, `users.program`, `requests.purpose` are still present and still written to, deliberately, as the rollback safety net. Drop them once this has run in production for a while — rollback stops being trivial after that.
- [ ] Optional, not done: splitting `users` into student/staff subtype tables. Judged high-risk (touches auth, register, profile) for little practical gain.

## Still blocked

- [ ] **Reports for Certificates** — spec is complete *except one column*. **Release/Claim Date has no source in the schema**; nothing records when a certificate was actually claimed. Proposed: add `released_at DATETIME NULL` to `requests` plus a staff "Mark as Claimed" action for the walk-in counter. Needs a go-ahead because it is a live-DB schema change. Everything else is ready to build:
  - Columns: Student Name, Student ID, Program, Certificate Type, Request Date, Status, Release/Claim Date
  - Filters: Date Range, Program, Certificate Type, Status
  - Exports: PDF, Excel, CSV
- [ ] **Student Feedback** — still unspecified. Who leaves feedback, on what (a completed request? the service overall?), what fields, and who reads it? Needs a new table either way.
- [ ] **Delayed notifications** — still need a repro: which dashboard, how long a delay, and does a manual refresh fix it? Prime suspect is that counts come from `+layout.server.ts`, which only runs on navigation, so the badge stays stale until the next page load. Confirm the symptom before fixing the wrong thing.

## Done — client requirements

### 2026-08-19
- [x] **Purpose dropdown** — Employment, Further Studies, Promotion, Personal/Other. `src/lib/data/purposes.ts`, wired into `src/routes/student/request/+page.svelte` (was a free-text textarea). Scholarship was in the original list but the client removed it on 2026-08-19 — noted in the data file so nobody re-adds it.
- [x] **Units of Education** — the client's 5 official program names are now the single source of truth in `src/lib/data/programs.ts`, used by the sign-up dropdown and available for report filters. The full per-program curriculum/unit breakdown also lives there (`programCurricula`), unused so far.
- [x] **Program/Course dropdown overflow fixed** — replaced the verbose generated labels ("… — Major in Hotel and Restaurant Management") with the client's official short names. Longest is now 54 chars, well inside `users.program VARCHAR(100)`.
- [x] **Name fields stacked one per row** — First → Middle → Last → Suffix on the sign-up form, instead of two-column grids.
- [x] **Claim stub reverted entirely** — client said to keep the plain upload field and that the email must not mention a claim stub. The approve upload reads "Upload Requested Document"; the approval email is generic ("Your request for X has been approved" / "View/Download Your Document"). No claim-stub wording remains anywhere in `src/`.
- [x] **Sign-up errors now show below the Create Account button** (with `role="alert"`), rather than at the top of the card. The top banner is now Sign-In-only.
- [x] **Requirement uploads accept images as well as PDF** — `accept` already allowed `image/*`, but the visible label said "Click to upload file (PDF)", which was simply wrong. Label now reads "Click to upload (PDF or image)" and the accepted extensions are explicit (`.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif`) since `image/*` is unreliable in some file pickers.
- [x] **Long filenames wrap instead of overflowing** in the Resubmit Requirements modal and the new-request upload. The fix needed `min-w-0` on the text span (a flex child will not shrink below its content width without it), plus `break-words`, and `shrink-0` on the icon.
- [x] **404 pages that keep the sidebar** — `src/lib/components/ui/ErrorState.svelte` plus `+error.svelte` at root, `staff/`, and `student/`. **Non-obvious part:** SvelteKit runs *no layout* for an unmatched URL, so a scoped `+error.svelte` alone renders bare with no sidebar. Catch-all routes (`staff/[...path]`, `student/[...path]`) make the URL match so the layout runs. Verified: 404 + sidebar in both portals, and all 13 real routes still resolve (concrete routes take precedence over the rest parameter).

### 2026-08-18
- [x] Remove **Payment** and **Priority** from the Admin menu and all Admin dashboard pages. They never appeared in any live page or nav — only in the orphaned mock pages, mock data, the stale types file, and `Badge.svelte` colour map. All removed.
- [x] Remove the "3rd Year" label top-right. `TopBar` now reads real session data from `page.data.layoutUser` and shows staff position / student program, no year. The old label was fabricated client-side: `student/+layout.svelte` hardcoded `year: 1` while the login handler sent `last_school_year`.
- [x] Student Type as a single-choice control — already implemented as a card-select (functionally equivalent to a dropdown); revisit only if a literal `<select>` is specifically wanted.

## Done — bug fixes (2026-08-19)

- [x] **Status emails were never arriving.** Root cause was the retired `jersondev.com` sender domain — Resend rejected every send with "domain is not verified", and the code **discarded the send result**, so staff saw a success toast while nothing was delivered. Fixed by moving to the verified `scalesite.io` and centralizing the sender in `src/lib/server/email.ts` (was hardcoded in four places). Proven side by side: `jersondev.com` → rejected, `scalesite.io` → delivered.
- [x] **Approval emails were skipped when staff approved without attaching a file.** The condition was `if (action === 'approve' && approvedFilePath)`, so a fileless approval notified the student of nothing. Students are now always notified; the download button only renders when a file exists. Verified end-to-end: approved a request with no file, Resend confirmed delivery.
- [x] **Email send failures are surfaced.** The Resend result is checked, logged, and returned as `email_warning`; the staff toast now says "Request approved — but the email failed to send" instead of claiming success.
- [x] **Silent file-upload failures fixed** in all three upload paths (`api/requests` POST, `api/requests/[id]` approve, `api/requests/[id]/requirements` PATCH). Each used `if (!error) { ... }` with no `else`, so a failed upload saved `file_path: null` / `submitted_at: null` and both portals showed "Not yet submitted" with no explanation. Uploads now return a real error and refuse to persist a broken request.
- [x] **Students can update files while a request is still Pending.** Previously the resubmit button only appeared once staff clicked "Request Correction", so a student whose upload failed was permanently stuck. Button reads "Update Files" (Pending) / "Resubmit" (Correction Requested).

## Done — codebase audit (2026-08-18)

- [x] Removed 4 orphaned mock-data pages (`staff/registry`, `staff/requests/pending`, `staff/documents/process`, `staff/documents/templates`) and the 4 mock data modules they depended on. All were unreachable from the nav and superseded by real pages. **One idea worth keeping:** `documents/process` sketched a clearance-verification checklist (library / accounting / department / graduate-school sign-offs) that exists nowhere else — see below.
- [x] Deleted the mock auth store `src/lib/stores/auth.ts` — a redundant client-side cache seeded with fake defaults ("Admin User") and re-populated on mount from real server data. `TopBar` now reads `page.data.layoutUser` directly.
- [x] `src/lib/types/index.ts` rewritten to mirror the live schema. Real enums (`RequestStatus`, `UserRole`, `StudentType`) replace the mock-era ones; unused mock models dropped. `Badge.svelte` trimmed to the statuses that actually occur.
- [x] Removed dead `DROP TABLE` statements for `clearance_forms`, `download_history`, `request_files` from `database/db.sql` — none were ever created or referenced.
- [x] README.md replaced with real project documentation.

## Remaining technical debt

- [ ] **Password hashing is unsalted SHA-256** (`api/login`, `api/register`, `api/accept-invite`, `api/profile`, `api/reset-password`) — swap for bcrypt/argon2 before production. Wants its own focused change: it touches all five auth endpoints and needs a migrate-on-login path (verify the old SHA-256 hash, then transparently re-hash) so existing accounts keep working. `bcryptjs` is the safer dependency on Windows (pure JS, no native build).
- [ ] **Clearance verification** — no table, no UI; was only ever a mock checklist. Confirm with the client whether graduate-school clearance sign-off belongs in this system at all.
- [ ] **Download/claim audit trail** — nothing records who downloaded or claimed a document. Overlaps with the `released_at` column proposed for the certificates report above.
- [ ] **Normalized request files** — requirement file metadata lives as a JSON blob in `requests.requirements`. Works, but cannot be queried or indexed.
- [ ] **~104 svelte-check warnings**, mostly form labels not associated with their controls (screen readers cannot announce them, clicking a label does not focus the field). Mechanical `for`/`id` fix. ESSU is a public university, so accessibility compliance may be a real requirement.
- [ ] **3 captured-`data` reactivity spots** (`student/profile`, `student/notifications`, `student/request`) — a plain `const x = data.y` snapshots the initial value, so the view goes stale on a client-side revisit. Fix with `$derived`.

## Environment notes

- **Supabase** went unreachable on 2026-08-18 (DNS returned NXDOMAIN from multiple resolvers) and was fixed by the project owner on 2026-08-19. Storage is confirmed healthy: buckets `requirements` and `templates`, uploads and signed URLs working.
- **Resend**: `scalesite.io` is verified with sending enabled. The retired `jersondev.com` is gone from the account entirely. Note the account-verification email still uses a Resend **dashboard-hosted template** (`email-verification`) — its contents live in Resend, not in this repo, so check it separately for stale branding or links.
- **Dev accounts** on the shared Aiven database, all with password `password`: `jersoncaibog1@gmail.com` (Admin), `admin@gmail.com` (Admin), `staff@gmail.com` (Staff), `jersoncaibog1+devstudent@gmail.com` (Student — created 2026-08-18, repointed from `student@gmail.com` on 2026-08-19 because that was a stranger's real Gmail and test emails were reaching it). The three real student registrations have unrecoverable passwords.
- These accounts exist only in the live DB, not in `database/seed.sql` — a fresh `seed.sql` run will not recreate them. Worth adding if the team needs reproducible dev logins.
- `.env` points at the **shared live database**. Approving/rejecting requests while testing writes real data that real student accounts can see. `REQ-2026-003` was set to Approved during testing on 2026-08-19.
- `database/db.sql` still drops and recreates all four tables — never run it against the live database.

## Not committed

As of 2026-08-19 all of the above sits **uncommitted** on `main` (~30 changed/new files). Worth committing before the next round of work.
