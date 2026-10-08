# EssU DocuFlow QA and product audit

Latest re-audit: **8 October 2026 (Asia/Shanghai), 23:00 local**. Scope: current workspace after the approved fixes. This is not deployed-production certification. Issue IDs retain the original report numbering: there are four Critical issues C01–C04; subsequent fixes were H05, H01, H03, H02, H06 and H04.

**Current outcome:** 10 original issues are fixed at the stated local test scope. The paperless goal remains unmet. Six assertions still fail, representing H07 and M01–M04; additional source-confirmed issues and untested browser/database scenarios remain open. Two new Medium regressions were identified. No application code, production records, dependencies or migrations were changed during this re-audit.

| Check rerun | Result | Evidence |
|---|---|---|
| Full isolated audit | **39 tests: 33 passed, 6 failed, 0 skipped; exit 1** | [reaudit-test-results.txt](reaudit-test-results.txt); real handlers with fake DB/storage/email. All six role happy paths and C01–C04/H01–H06 checks pass. H07 has two failed assertions; M01–M04 each have one. |
| Browser command | **Blocked before test discovery; zero browser cases executed** | [reaudit-browser-results.txt](reaudit-browser-results.txt): `MODULE_NOT_FOUND` for `@playwright/test/cli.js`. `QA_BASE_URL` is unset and `QA_ISOLATED` is not enabled; no supplied isolated deployment/credentials. The 11 definitions across three viewports are not a runtime Pass. |
| Type/Svelte check | **0 errors; 75 existing warnings in 13 files** | [reaudit-check-results.txt](reaudit-check-results.txt), `npm run check`. |
| Additional regression probes | **R01/R02 reproduced; H12 reproduced** | [reaudit-regression-results.txt](reaudit-regression-results.txt), `node qa/docuflow/reaudit-regressions.mjs`. Source + isolated HTTP checks, not browser runs. |
| Real DB, migrations, cloud delivery, production/browser build | **Not tested in this re-audit** | No live service access or ordinary dev server was used. The auth-version migration remains unapplied. The original build result below is historical, not a fresh build result. |

An initial audit process failed to start with Windows exit `-1073741502`; the retry completed and its results above are authoritative. Installing Playwright alone would not enable a safe browser run: a fake-only QA deployment, role accounts and fixture IDs are also needed. We did not invent credentials or target production mutation tests.

## Status of every original issue

`Fixed` means the original local acceptance checks pass, with the limits shown. `Still failing` includes fresh failing assertions or a defect still visible in current source. `Not tested` means its required runtime reproduction is unavailable; it does not imply that the issue disappeared. The original reproduction steps and line numbers below are historical; current source locations for new findings are listed separately.

| ID | Severity | Status | Evidence |
|---|---|---|---|
| C01 | Critical | Fixed | Student decisions 403; Staff/Admin valid decisions 200. Only session-validation DB reads occur on denial. |
| C02 | Critical | Fixed | Other Student detail 403; owner/office 200; request data not returned on denial. |
| C03 | Critical | Fixed | File ownership, release status, bucket/path registration and case checks pass before signing. |
| C04 | Critical | Fixed | Non-session/invalid claims denied across all protected API methods and both portal guards. |
| H01 | High | Fixed | Final-state resubmission 409; empty/incomplete correction 400; upload-time decision race rejected. |
| H02 | High | Fixed | Missing digital file 400; wrong type/signature 400; >10 MiB 413; exact limit allowed; failed request batches cleaned. Basic signature checks do not establish full format validity or malware safety. See R01 for new UI mismatch. |
| H03 | High | Fixed | Final deliverable/remarks enforced; terminal-state decisions 409; Staff/Admin paths pass. Real concurrent office decisions are not tested. |
| H04 | High | Fixed | Role/owner scope passes; mixed unauthorized IDs denied before writes; valid Student/Staff/Admin reads preserved. Office receipts remain shared as before. |
| H05 | High | Fixed | Real server-rendered student component and API/loader agree on requirement arrays, submitted files and correction actions. Interactive browser flow untested. |
| H06 | High | Fixed | Replay and concurrent same-password reset rejected; old sessions denied across protected APIs/layouts; new login succeeds. Requires `20261008_auth_version.sql` before deployment; real DB concurrency untested. See R02. |
| H07 | High | Still failing | History failure leaves changed status; Student resubmission records no Pending event. Two full-suite failures. Immutable remarks/retention/outbox still absent in source. |
| H08 | High | Not tested | Current one-connection pool + Student-delete connection calls pool-backed `fetchRequestFilePaths`; predicted deadlock persists in source. No disposable real MySQL reproduction. |
| H09 | High | Still failing | Current registration/login/reset/profile/invite code still uses deterministic unsalted SHA-256. Source-confirmed. |
| H10 | High | Still failing | Current legacy template PATCH removes old object before upload and ignores upload errors. H02 validates input but does not fix replacement outage behavior; source-confirmed, not freshly runtime reproduced. |
| H11 | High | Not tested | Queue/detail still capture initial data; existing compiler state-capture warnings remain. Required same-component navigation/polling browser reproduction blocked. |
| H12 | High | Still failing | Fresh fake email failure returns 502 after unverified account persists; no resend recovery route. Additional probe confirms original issue. |
| M01 | Medium | Still failing | Identical submission retry creates two requests; audit assertion fails. |
| M02 | Medium | Still failing | Whitespace/noncatalog purpose accepted; audit assertion fails. |
| M03 | Medium | Still failing | Weak registration password accepted; audit assertion fails. Other malformed field cases remain incompletely tested. |
| M04 | Medium | Still failing | Seeded form previews absent from repository; audit asset assertion fails. Live catalog URLs untested. |
| M05 | Medium | Still failing | Forgot-password client still changes to sent state without checking response status; source-confirmed. |
| M06 | Medium | Still failing | Invalid verification redirects to missing `/verify-email`; source and unchanged redirect guard test. |
| M07 | Medium | Still failing | Existing accessibility warnings, hidden upload controls and generic modal focus gaps remain; source/compiler evidence. Browser keyboard/contrast untested. |
| M08 | Medium | Still failing | File view/download code still lacks checked-response feedback; source-confirmed. Popup/download behavior untested. |
| M09 | Medium | Still failing | Office layout counts new Pending requests only, excluding unread history/ID notices; source-confirmed. |
| M10 | Medium | Still failing | Login still sets `secure: false`; source-confirmed. Real HTTPS cookie transport untested. |
| M11 | Medium | Still failing | Registration/profile/student edits still write program text without maintaining program FK; source-confirmed. |
| L01 | Low | Still failing | Submission says request cannot be edited; Pending UI still offers Update Files. Source-confirmed. |
| L02 | Low | Still failing | Setup/feature docs remain stale, including QA README's old unchanged-source claim. Auth migration deployment state is unverified. |

## New regressions introduced by fixes

**R01 — Medium: Student upload picker and API allowlist disagree after H02.** Reproduce: on new request or Update Files, choose a GIF offered by `image/*`; submit it. Expected: the picker/help reflects the supported PDF/JPEG/PNG/WebP/HEIC/HEIF policy and rejects unsupported formats early. Actual: current picker advertises all images, but a fake `image/gif` upload returns HTTP 400 at submission. Source: `src/routes/student/request/+page.svelte` and `src/routes/student/documents/+page.svelte`, `accept` attributes; restriction: `src/lib/server/upload-validation.ts`. The isolated response and current source mismatch are confirmed; browser interaction was not executed. Do not broaden the server allowlist without a deliberate policy.

**R02 — Medium: Credential-change success leaves the current UI with a revoked session after H06.** Reproduce as Student or office user: change password in Profile, then attempt another API operation without reloading. Expected: clear reauthentication notice and navigation, or an explicitly authorized renewed session while older sessions stay revoked. Actual: PATCH succeeds without clearing/replacing the cookie; the previous cookie then gets 401. Both profile clients show success and close the modal, with no login navigation/message. Source: `src/routes/api/profile/+server.ts` credential updates; `src/routes/student/profile/+page.svelte` and `src/routes/staff/profile/+page.svelte`, success handlers; `src/lib/server/jwt.ts` version check. Password-change HTTP sequence and client-source behavior are confirmed. Email-change has the same source pattern; it was not separately exercised. Revoking sessions is intended; the missing user guidance is the regression.

No additional regressions were detected in the six existing role happy paths, auth guards, corrected-request rendering, upload-failure handling, or earlier fixed-issue tests. This does not rule out unexecuted browser, real MySQL, storage-policy or deployment regressions.

## Still open, ordered by severity

- **Critical:** none still failing in the local suite. Deployed security remains unverified.
- **High:** H07 atomic/complete immutable audit and notifications; H08 predicted Student-delete pool deadlock (runtime untested); H09 adaptive password hashing; H10 safe template replacement; H11 office data reactivity (browser untested); H12 verification recovery.
- **Medium:** M01 retry idempotency; M02 purpose validation; M03 registration validation; M04 missing form assets; M05 forgot-password feedback; M06 verification destination; M07 accessibility; M08 download feedback; M09 badge consistency; M10 Secure cookie; M11 program FK; R01 upload-policy UI mismatch; R02 credential-change reauthentication UX.
- **Low:** L01 amendment copy; L02 setup/feature/migration documentation.
- **Product capabilities still missing:** digital replacement for `in_person` requirements, submitted online forms/clearance sign-offs, generated and signed final documents, public authenticity verification, distinct review/ready/issued states, per-document fulfillment, issuance/access receipts, rejected-request reapplication, durable delivery retries, complete certificate reports and draft recovery. These are gaps from the original report, not new numbered defects.

No fixes were made during this re-audit. All records and uploaded fixtures were fake. Next work requires the user's selection/approval; browser sign-off remains blocked on isolated tooling and fixtures.
