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


## Original audit baseline (historical, before approved fixes)

The following discovery, feature tables, reproductions and original priority list are retained as historical evidence. Current statuses and test totals are in the re-audit above; original missing-guard statements and source line numbers do not describe the fixed code.

Audit date: **8 October 2026 (Asia/Shanghai)**. Target supplied: https://essu-docuflow-alpha.vercel.app/login. Findings concern the current workspace source; its equivalence to the deployed build is unverified.

**Outcome: the fully paperless goal is not met. Four critical authorization defects are confirmed in isolated tests.** Basic API workflows work with fake services, but security, student corrections, state transitions, audit completeness and validation fail. Application fixes require the user's approval.

Only QA files under `qa/docuflow/` were added. Application source, package files, `.env`, database schemas and production records were not changed. Ordinary `npm run dev` was deliberately not started because README says `.env` points at the live database. Existing shared account credentials in TODO were not used. All runtime records, uploads and messages were fake and local; test email addresses use `example.invalid`.

## Evidence and limits

| Check | Result | Meaning |
|---|---|---|
| Isolated regression suite | **36 tests: 16 Pass, 20 Fail, 0 skipped** | Real API handlers/JWT/data-access helpers exercised over localhost HTTP with fake DB, storage and email; two checks execute a page parser/check repository assets. |
| Svelte/TypeScript check | **0 errors; 75 warnings in 13 files** | `npm run check` completed. Warnings include accessibility and captured/nonreactive state. |
| Production build | **Pass** | `npm run build` completed. Adapter-auto reports no supported deployment environment detected locally; this does not verify Vercel deployment. |
| Playwright browser suite | **Written; execution blocked** | Playwright unavailable. npm registry attempt failed EACCES; escalated process failed to start, Windows exit `-1073741502`. Syntax checks passed. |
| Deployed app | **Unverified** | Web opener could not access the URL; curl sandbox connection failed; escalated curl process failed to start. This is not proof of a site outage. |
| Real MySQL/storage/email delivery | **Unverified** | No isolated deployed QA accounts, inbox, database or service fixtures supplied. No production records were queried. |
| Mobile/tablet/desktop, contrast, browser file download, interrupted browser upload | **Unverified** | Browser execution blocked. Source observations below are explicitly identified. |

Reproduce local tests: `node --test --test-reporter=spec qa/docuflow/audit.test.mjs`. Raw results: `test-results.txt`. Build output: `build-results.txt`. Inventory: `inventory.json`. Browser setup and safe targeting instructions: `README.md` in this directory.

The HTTP harness does not run SvelteKit's real request middleware/cookie implementation or a real MySQL database. Passing tests cannot establish MySQL constraints, concurrent named locking, storage bucket policies, TLS, email arrival, browser rendering or operational readiness. Failing tests demonstrate behavior of the unchanged handlers under the stated fake inputs. File size tests use a proposed 10 MiB requirement limit consistent with the existing forms-upload limit; no such limit currently exists for request uploads.

## 1. Discovery — what the system actually does

EssU DocuFlow is a Graduate School document-request portal. Students self-register, verify email, await an Admin's student-ID verification, select **one to five** office-configured document types, upload the union of their requirements and choose a purpose. Staff see a shared queue, request corrections, reject, or approve while uploading a prepared final file. Students can view/download that file through signed storage URLs. Admins also invite/manage office accounts and verify student identity. A separate forms library distributes static or staff-uploaded forms; reports summarize request activity and export CSV.

It is a request/review/file-delivery system. It has no online clearance sign-off, final-document generation, digital-signature engine, public document-authenticity verifier, or completed-form submission workflow.

### Roles and account types

| Role/type | Actual scope |
|---|---|
| Student | Self-registration, own dashboard/list/profile/notifications/forms, submit and update files. Submission requires `id_status='verified'`. |
| Staff | Shared office dashboard, requests/review, document and form management, reports, notifications, own profile; may list/edit students. Cannot verify student IDs, invite staff, delete students or manage staff through correctly guarded endpoints. |
| Admin | Staff capabilities plus student ID verify/reject, student deletion, staff invite/edit/delete. Shares `/staff` portal. |
| Enrolled / Former / Alumni | Student classifications, **not** access-control roles. |

The old README description that student management is exclusively Admin is stale: current staff navigation, student loader and PATCH allow Staff. Whether editing students should be Admin-only is a policy question, not a confirmed defect.

### Pages and routes

| Group | All page routes |
|---|---|
| Public/entry | `/`, `/login` (sign-in, sign-up, forgot-password modes), `/reset-password`, `/accept-invite` |
| Student | `/student/dashboard`, `/student/request`, `/student/documents`, `/student/forms`, `/student/notifications`, `/student/profile` |
| Office | `/staff/dashboard`, `/staff/requests`, `/staff/requests/[request_id]`, `/staff/documents`, `/staff/forms`, `/staff/students`, `/staff/staff`, `/staff/reports`, `/staff/notifications`, `/staff/profile` |
| Unknown-route handlers | `/student/[...path]`, `/staff/[...path]`; portal-scoped error pages also exist. |

No `/verify-email` page exists, although the verification API redirects invalid links there. There are 20 concrete page routes including `/`, plus two catch-all page routes. Portal layouts provide server role guards, user display data and badges. API endpoints do not inherit those page-layout guards.

### Database tables

Current bootstrap schema has **12 tables**, rather than the nine described by README:

| Table | Purpose |
|---|---|
| `programs` | Graduate program lookup; `users.program_id` FK. |
| `purposes` | Request-purpose lookup; `requests.purpose_id` FK. |
| `requirements` | Shared requirement definitions. |
| `users` | All roles, credentials, email verification, academic/profile data, student ID verification and verifier/time/reason. |
| `documents` | Office-configured requestable document catalog; optional template. |
| `requests` | Student, purpose, status, latest remarks, one final-file path/name, requested time, office read flag. |
| `request_items` | One to five selected document types per request; unique request/document pair. |
| `document_requirements` | Requirements associated with each document; order and `in_person`. |
| `request_requirements` | Submitted file metadata, correction flag and in-person marker per request/requirement. |
| `request_status_history` | Status/actor/time and shared read flags; also standalone identity/admin notifications. |
| `forms` | Downloadable form metadata, category, fields JSON, creator/timestamps. |
| `form_files` | Form pages and cloud/public file URLs. |

Schema and migrations describe source expectations only; production migration state was not checked. Bootstrap/seed SQL is destructive and was not run. The seed contains accounts but **no requestable document inserts**; its old truncation list also does not cover the newer child tables.

### API endpoints — 21 paths, 32 methods

| Endpoint | Methods | Purpose / observed intended guard |
|---|---|---|
| `/api/login` | POST | Credential check; session cookie. |
| `/api/logout` | POST | Delete session cookie; redirect. |
| `/api/register` | POST | Public Student creation and verification email. |
| `/api/verify` | GET | Verify an emailed JWT; mark email verified. |
| `/api/forgot-password` | POST | Public reset email. |
| `/api/reset-password` | POST | Reset-purpose token and password change. |
| `/api/invite` | POST | Admin-only Staff/Admin invitation email. |
| `/api/accept-invite` | POST | Invite-purpose token; create Staff/Admin. |
| `/api/profile` | GET, PATCH | Own profile; personal/email/password/academic or staff fields. |
| `/api/documents` | GET, POST, PATCH, DELETE | GET publicly lists document metadata/requirements; mutations nominally office-only. Negative Student checks are vulnerable to token confusion. |
| `/api/requests` | GET, POST, DELETE | Own list for Student, full list otherwise; verified-ID Student submission; office deletion. |
| `/api/requests/[id]` | GET, PATCH | Detail/history and office actions; **missing ownership/role enforcement**. |
| `/api/requests/[id]/requirements` | PATCH | Student owner enforced; **no status guard**. |
| `/api/storage` | GET | Sign arbitrary caller-provided bucket/path; **no file entitlement guard**. |
| `/api/notifications/read` | POST | Mark request/history read; **no role/owner scoping**. |
| `/api/students` | GET, PATCH, DELETE | List: non-Student token; edit: Staff/Admin; delete: Admin. |
| `/api/students/[id]/verify` | POST | Admin-only ID verify/reject, transactional notice. |
| `/api/staff` | PATCH, DELETE | Admin-only office-account management. |
| `/api/forms` | GET, POST | All valid roles read; Staff/Admin create. |
| `/api/forms/[id]` | PUT, DELETE | Staff/Admin edit/delete. |
| `/api/forms/upload-url` | POST | Staff/Admin signed upload URL, 1–5 files, allowed MIME/extensions, 10 MiB each. |

The inventory script derives route/method counts from source. There is no separate final-document generation, signing, QR verification, claim/release, feedback, bulk processing, or report-export API. CSV export is client-side.

### Every document/form/request type found

**Requestable document types:** dynamic rows in `documents`, administratively created with arbitrary names and requirements. No complete fixed document-name list is present in source/seed. The deployed catalog could not be read. Therefore the current production requestable types, and which have physical requirements, are **unknown**, not assumed to be Transcript/Diploma/etc. `QA Certificate` and `QA Transcript` are explicitly artificial harness fixtures.

**All eight seeded downloadable forms:** Certificate of Registration; Clearance Credential; Grade Change Request; MAEd Educational Management Evaluation; MAEd Kindergarten Evaluation; MAIT Evaluation; MAM Evaluation; MSHM Evaluation. These are library items, not proven requestable document types. Static files also include four Word prospectus assets for MSHM, MAM, MAIT, and MAEd EM/KE; no source seed proves they are linked in the live catalog. Staff can create further arbitrary categories/items.

**Request purposes:** Employment, Further Studies, Promotion, Personal/Other. **Request statuses:** Pending, Approved, Rejected, Correction Requested. **Staff actions:** approve, reject, correction. **Student ID actions/statuses:** verify/reject; pending/verified/rejected. There is no persisted In Review or Ready status. Ready is inferred from presence of a final file. A multi-document request has one status and one final-file slot, with no independent release state per item.

### Planned or unfinished

Certificate-specific report columns/filters, release/download timestamps, PDF/Excel export, feedback, clearance approvals, final-document generation/signing, public authenticity verification and independent multi-document release are absent. Program curricula exist as unused data in `src/lib/data/programs.ts:8`. General CSV reporting and 15-second notification polling **are already present**. README/FEATURES/TODO references to Resend, nine tables, report export and old reactivity gaps are stale; current email integration is Brevo (`src/lib/server/email.ts:1`).

## 2. Role flow and feature summary

`Pass` means the stated isolated API scenario passed, not that deployed/browser delivery was certified. `Fail` means a required behavior has a demonstrated or explicitly identified source defect. `Missing` means no implementation exists. Code-present features that could not be executed are separately listed as unverified rather than assigned a fictional Pass.

| Feature | Student | Office | Status | Notes |
|---|---|---|---|---|
| Correct login / logout | API passed | Staff/Admin login passed | Pass | Cookie create/delete; actual browser logout/session caching unverified. |
| Wrong password / expired session | 401 | Same handler | Pass | Signed expired fake sessions rejected. Remember-me is 30 days vs default one day; persistence unverified. |
| Registration and verification | API lifecycle passed | Admin ID verification passed | Pass | Fake email captured, not delivered. Registration recovery defect H12. |
| Forgot/reset password security | Normal API reset passed | Same handler | Fail | Reset token replay and old-session survival H06; client false success M05. |
| Identity gate | Pending ID blocked | Admin verify/reject API | Pass | No online identity evidence or external ID match process; office practice unverified. |
| Select/upload/submit 1–5 documents | Happy path passed | Queue API readable | Fail | Missing/type/size validation H02 and retry duplicates M01. |
| Own request list / other-user detail | Own list scoped | Detail readable | Fail | Detail/API/file authorization C01–C04. |
| Pending/approved/rejected/correction tracking | Implemented | Implemented | Fail | Student requirements hidden H05; office state snapshots H11. |
| In Review / explicit Ready status | Absent | Absent | Missing | Schema has four statuses only. |
| Every-change notification | Status messages captured | Shared read state | Fail | Resubmission not recorded; read endpoint unscoped H04/H07. Real delivery unverified. |
| Review files / approve/reject/correct | Correction UI broken | API actions work with fake services | Fail | H01/H03/H05; UI and API disagree on mandatory file/remarks. |
| Final digital-file link | Signing API works | Final upload API works | Fail | File ACL missing; browser PDF validity/download and file delivery unverified. |
| Generate final document / digital sign/stamp | No authenticity evidence | Absent | Missing | Only upload a prepared file. |
| QR/public document verification | Absent | Absent | Missing | `/api/verify` verifies accounts, not documents. |
| Fix correction/rejection | Corrections exposed in intent | Can return with remarks | Fail | Array/parser defect blocks upload fields; rejected request has no resubmit UI. |
| Audit who/when/every change | Recent status activity | Timeline | Fail | Not atomic or complete, remarks not immutable, deletion erases history H07. |
| Bulk operations / user-selectable sorting | Not applicable | Absent | Missing | Request list has search/status filter and fixed date order only. |
| Certificate-specific complete report | Not applicable | Absent | Missing | No student/program/release columns or program/type filters. |
| Zero visits for all requirements | Explicit visits supported | Physical handoff outside app | Fail | `in_person` forces Graduate School submission. |
| Accessibility basics | Source defects | Source defects | Fail | Hidden upload controls, unassociated labels and modal focus M07; contrast unverified. |

**Present but unverified in a browser:** office queue rendering; search/status filters; CSV export/date filters/charts; profile edits; form CRUD/previews/downloads; actual in-app notifications; Admin account management UI; responsive sidebar/cards; loading indicators and keyboard combobox behavior. Source confirms these implementations. None is certified as runtime Pass. The isolated tests validate Staff/Admin queue/detail APIs and Admin invite/accept/ID verification, not every admin mutation.

## 3. Paperless check, process by process

“Paperless” requires completing the business process, not merely submitting a request online. A missing digital step is not proof that every office currently prints; it is a gap preventing verification of the zero-paper goal.

| Process | Zero printing? | Zero visits? | Zero manual paperwork? | Evidence / digital replacement |
|---|---|---|---|---|
| Registration and email verification | Possible | Possible | Possible | Digital fields/link; real inbox delivery unverified. Add resend/recovery. |
| Student ID verification | Not proven | Not proven | Not proven | Admin toggles a record without submitted ID evidence or authoritative ID match. Add remote evidence upload, registrar-record match and electronic decision/audit. Do not assume a visit is mandatory. |
| Requirements marked digital | Possible if existing digital files | Possible | Not proven for signed forms | Upload supported, but broken display/correction and validation. Add fillable forms, evidence checking and accessible uploads. |
| Requirements marked `in_person` | Not guaranteed | **No** | Not guaranteed | Explicit “must be submitted in person” message; no upload or sign-off receipt. Replace with electronic submission and office-owned approval tasks. |
| Clearance Credential | Not supported end-to-end | Not supported end-to-end | Not supported end-to-end | Downloadable form only; no department/library/accounting approval records. Add electronic parallel sign-offs, remarks and final clearance certificate. |
| Certificate of Registration / Grade Change / evaluation forms | Not supported end-to-end | Not supported end-to-end | Not supported end-to-end | Library downloads are not online completed applications. Add authenticated fill/save/submit, routing and decision tracking. Institution rules were not supplied. |
| Request submission/status lookup | Possible | Possible | Possible | Digital workflow exists but has confirmed security/correction/state failures. |
| Return/correct/reject workflow | Currently fails | Not guaranteed | Not guaranteed | H05 blocks correction files; Rejected cannot be reopened in UI. Add controlled amendment/reapply with preserved request relationship and audit. |
| Review and approve | Possible | Possible | Possible for digital evidence | Human decision is compatible with paperless operation. It needs safe authorization and immutable evidence/history. |
| Final document preparation/signature | **Not supported within app** | Not proven | **Not supported within app** | Staff must supply a prepared file. Add templates, PDF generation, authorized digital signature/stamp, issuance metadata and verification. Offline preparation may be digital; do not assume it currently requires printing. |
| Final digital release | Possible conditionally | Possible conditionally | Possible conditionally | Upload + signed URLs; fileless approval permitted, ACL missing, no release/download receipt. Require deliverable and log digital issuance/access. |
| Multi-document fulfillment | Incomplete | Incomplete | Incomplete | One final-file slot for up to five requested types. Add item-level documents/statuses/signatures or enforce a complete combined package. |
| Reports | CSV can remain digital | Possible | Partially supported | Print button is **optional**, not a forced paper step; Save as PDF is possible via browser. Add direct PDF/XLSX, complete certificate fields and digital release time. |

Confirmed forced physical step: **every configured `in_person` requirement**. Exact affected document names/counts cannot be established without the live or isolated catalog. The printed content/signature expectations of supplied forms cannot be inspected fully: all ten seeded JPEG pages are missing locally. Static Word prospectus assets do not prove a paperless workflow.

## 4. Bugs ranked with reproduction and source lines

All repros below use fake records only. API URLs are relative to the isolated harness/QA deployment. “Source review” means browser/deployed reproduction remains unverified.

### Critical

**C01 — A Student can approve/reject/return any known request. Confirmed isolated HTTP.**

1. Sign in as fake Student A; identify fake Student B's `REQ-2026-001` fixture.
2. PATCH `/api/requests/REQ-2026-001` with JSON `{ "action": "approve" }`.
3. Expected: 403, no changes or mail. Actual: **200**, status Approved, history attributes the action to Student A and an approval message is captured. Reject/correction use the same unguarded path.

Cause: `src/routes/api/requests/[id]/+server.ts:53` / `:59` validates signature but never enforces Staff/Admin before `:144` update. Office page guards do not protect this endpoint. Fix: centralized validated session + explicit office role guard before record access/uploads.

**C02 — Request-detail IDOR exposes other students' data and file paths. Confirmed isolated HTTP.**

1. As fake Student A GET `/api/requests/REQ-2026-001` owned by fake B.
2. Expected: 403/404; actual: **200** with student email/profile, request fields, requirement file paths and history.

Cause: `src/routes/api/requests/[id]/+server.ts:27` selects only by request ID; `:50` returns everything without owner check. Fix: Student owner scope or office role on every detail read. Own-list scoping already works and does not mitigate detail access.

**C03 — Any signed-in caller can request a signed URL for another student's file. Confirmed isolated entitlement failure.**

1. As fake A GET `/api/storage?bucket=requirements&path=fake-student-2/id.pdf`.
2. Expected: 403/404. Actual: **200** signed URL from fake signer, with no DB/file-owner query.

Cause: `src/routes/api/storage/+server.ts:11` checks only JWT signature; `:16` accepts caller bucket/path; `:20` invokes service-role signing. C02 supplies paths. Fix: allowlisted bucket and database-backed file authorization before signing. Real bucket policies/download access were not probed.

**C04 — Email verification/reset/invite JWTs can be used as session cookies. Confirmed isolated HTTP.**

1. Capture the genuine token issued for a fake registration (payload has email, iat, exp but no userId/role).
2. Set `session` cookie to that token; GET `/api/students` or `/api/requests`.
3. Expected: 401 for a non-session token. Actual: **200**, because absent role is treated as “not Student,” granting the office list branch. Invitations also carry office role without a session user ID.

Cause: `src/lib/server/jwt.ts:21` validates signature/expiration but not purpose or claims; `src/routes/api/register/+server.ts:59` uses the same signing secret; `src/routes/api/students/+server.ts:22` and `src/routes/api/requests/+server.ts:21` use negative role checks. Storage/notification handlers accept any signed token. Fix: separate token purpose/audience, positive role/userId validation, authenticated-user lookup, and explicit allowlists across APIs. The ordinary portal may redirect such tokens; API exposure still exists.

### High

**H01 — Empty resubmission can reopen an Approved/Rejected request and clear remarks. Confirmed isolated HTTP.**

1. Make a fake B request Approved; PATCH its `/requirements` as B with an empty multipart body.
2. Expected: 409 for final states, or 400 for no corrected file. Actual: **200**, status Pending, remarks cleared; existing final-file path is retained.

Cause: `src/routes/api/requests/[id]/requirements/+server.ts:22` selects owner only; `:56` checks upload errors rather than whether anything uploaded; `:70` always resets status. Student UI only offers Pending/Correction but API ignores that policy. Fix: permitted state + nonempty meaningful corrected uploads + full correction validation + transactional transition/audit. File access must also respect release state.

**H02 — Required files and request-upload type/size limits are not enforced by the server. Confirmed isolated HTTP.**

1. As verified fake Student POST a request requiring `QA ID`, first with no file, then a harmless `.exe` fixture, then an 11 MiB fixture.
2. Expected: missing/type validation 400; size beyond a configured limit 400/413. Actual: **200** for each with accepting fake storage. The app buffers whole files and forwards supplied MIME. Real storage may reject independently; the application has no validation.

Cause: `src/routes/api/requests/+server.ts:132` only tests existence/positive size and `:136` buffers content. Similar gaps: resubmission `.../[id]/requirements/+server.ts:38`, final approval `.../[id]/+server.ts:106`, legacy document template upload. Browser `accept` is not validation. Fix: explicit limits, extension/MIME/content checks, required-file completeness, malware scanning/quarantine as appropriate and failed-batch cleanup.

**H03 — Office mutation API can approve without a final document or reject/return without remarks. Confirmed isolated HTTP.**

1. As fake Staff PATCH `{action:'approve'}` without file; separately reject without message.
2. Expected: 400 with required-field errors. Actual: **200**; fileless Approved requests lack digital deliverables; rejection need not explain corrective action.

Cause: `src/routes/api/requests/[id]/+server.ts:104` allows optional final file; `:124` / `:126` accept nullable remarks. UI requires approval upload at `src/routes/staff/requests/[request_id]/+page.svelte:296` and reject/correction messages at `:329` / `:351`. Fix: enforce identical rules on server, reject invalid terminal-state transitions and define multi-document completeness.

**H04 — Student can mark office queues or others' notification history as read. Confirmed isolated HTTP.**

1. As fake A POST `/api/notifications/read` with `{type:'request',ids:['REQ-2026-001']}` belonging to fake B.
2. Expected: 403 and unchanged `staff_viewed`. Actual: **200**, office read flag changes. Arbitrary history IDs are similarly unscoped.

Cause: `src/routes/api/notifications/read/+server.ts:10` discards identity; `:17`, `:23`, `:30` update IDs without ownership/role scope. Fix: positive type/role validation, owner-scoped Student updates and per-office-user read receipts when required.

**H05 — Student requirements and correction upload fields disappear on initial load. Confirmed parser execution + source contract; browser blocked.**

1. Create a fake request with one submitted requirement; navigate directly to `/student/documents` or refresh; open Update Files/Resubmit.
2. Expected: requirement name/file and correction input visible. Actual from the exact page parser: server array becomes `[]`; requirement sections and resubmit inputs have no rows.

Cause: `src/routes/student/documents/+page.server.ts:33` supplies an array; `+page.svelte:16` declares string and `:35` uses `JSON.parse`. Its `/api/requests` refresh returns a string, so initial-load and refreshed shapes differ. Fix: one typed array contract throughout. The test executes the current parser on the loader's array; no browser rendering result is claimed.

**H06 — Reset tokens can be reused and old sessions remain valid. Confirmed isolated HTTP.**

1. Obtain a reset token for fake A; reset once; reset again with the same token.
2. Reuse A's session captured before reset to GET `/api/requests`.
3. Expected: second reset refused; pre-reset session invalidated. Actual: both resets **200**, old session **200**. Token lifetime is one hour; sessions last one or 30 days.

Cause: `src/routes/api/reset-password/+server.ts:15` / `:25` has no consumed-token/session-version store; `src/routes/api/login/+server.ts:38` signs identity/role without revocation version. Fix: one-time reset nonce, expiry/consumption transaction, revoke previous sessions on password change/reset and role/account changes.

**H07 — Audit/notifications omit resubmissions and can diverge from persisted status. Confirmed failure injection and resubmission tests; other aspects source review.**

1. Ask fake Staff for correction; re-upload as owner. Expected: Pending event with Student actor/time and notifications. Actual: Pending update but **no history row**.
2. Inject a history-write failure while Staff rejects. Expected: update/history succeed together or roll back. Actual: response **500**, status remains Rejected with no audit row.
3. Change remarks across successive decisions: old notification queries use the latest request remarks, not an immutable message for that event. Office deletion removes history outright.

Cause: resubmission `src/routes/api/requests/[id]/requirements/+server.ts:70`; separate update/history `.../[id]/+server.ts:144` / `:153`; notification `src/routes/student/notifications/+page.server.ts:9`; deletion `src/routes/api/requests/+server.ts:257`. Initial submission also has no Student history/email event. Fix: atomic immutable event records (actor, time, transition, remarks, file/version), durable outbox/retry for notifications and retention instead of audit erasure.

**H08 — Deleting a Student with requests can deadlock the one-connection pool. Source review; real MySQL reproduction blocked.**

1. In a disposable MySQL QA DB, Admin deletes a fake Student with at least one request.
2. Expected: completion/controlled failure and pool released. Predicted actual: hangs; unrelated database work queues behind it.

Cause: `src/lib/server/db.ts:11` sets `connectionLimit:1`. `src/routes/api/students/+server.ts:99` checks out the only connection, then `:109` calls `fetchRequestFilePaths`, which uses `pool.execute` (`src/lib/server/requirements.ts:197`) and waits for a second available connection. The held one is released only after the awaited call. Fix: run all reads on the checked-out connection or fetch before acquiring it; increasing pool size alone masks the design issue. No destructive live deletion was attempted.

**H09 — Passwords use fast unsalted SHA-256. Source-confirmed.**

1. Register two fake accounts with the same password in isolation; inspect fake stored hash or review the hash creation.
2. Expected: independent salted adaptive hashes. Actual: deterministic identical SHA-256; a leaked database permits fast offline guessing.

Cause: `src/routes/api/register/+server.ts:26`, login `:27`, accept-invite `:35`, profile `:85` / `:96`, reset `:24`. Fix: Argon2id/bcrypt with a migration path and consistent minimum policy. No password cracking or real credential use performed.

**H10 — Failed legacy template replacement deletes the working file and reports success. Source review.**

1. Give a fake document a template; replace through `/api/documents` PATCH while storage upload fails.
2. Expected: fail clearly and preserve old file/path. Source behavior: old object removed first; failed upload is ignored; old path can be saved despite missing object, followed by success.

Cause: `src/routes/api/documents/+server.ts:118` removes old file; `:123` handles success only. Fix: upload replacement first, commit new metadata, delete prior object afterward; surface failures and clean orphans. New forms CRUD does not eliminate this still-exposed endpoint.

**H11 — Office request UI captures initial data, defeating polling and leaving stale detail/history. Source review; browser blocked.**

1. Open fake request A then client-navigate to B using the same route component; or leave the queue/detail open while another office account updates it.
2. Expected: current queue, request identity/files/status and timeline after navigation/poll. Source behavior: queue snapshots `$state(data.requests)`; detail snapshots `const req=data.request`, `const history=data.history`, and initial `currentStatus`. Local approval changes only the badge and closes actions, not file/timeline data.

Cause: `src/routes/staff/requests/+page.svelte:15`; `src/routes/staff/requests/[request_id]/+page.svelte:14`, `:23`, `:40`, `:75`. The store invalidates loads every 15 seconds (`src/lib/stores/notifications.ts:56`), but these captured views do not reconcile new data. Fix: derived server data and carefully scoped local state; invalidate/refresh after successful mutation. Potential wrong displayed/action target on same-component navigation warrants browser reproduction before fixing.

**H12 — Verification-email failure leaves a created account with no resend recovery. Source review; fake error injection possible.**

1. Register a fake account with email service failing, or let its verification token expire.
2. Expected: retry/resend pathway. Source behavior: user insert already completed; registration returns 502; retry returns email-already-registered; login blocked unverified. No resend endpoint/UI exists.

Cause: `src/routes/api/register/+server.ts:45` inserts before mail `:63`; `:75` returns failure without recovery. Fix: clear account-created state, rate-limited resend verification and durable delivery retries. Resetting a password does not verify email.

### Medium

**M01 — Lost-response retries create duplicate requests. Confirmed isolated HTTP.** Submit identical fake form twice. Expected: same result for the same retry/idempotency key. Actual: two new IDs/rows/files. Cause: `src/routes/api/requests/+server.ts:114` random batch and `:188` insert; lock guarantees unique IDs, not deduplication. UI disabled-submit helps normal double-clicks but not retry after unknown outcome. Fix: per-submission key persisted transactionally; browser double-click behavior remains unverified.

**M02 — Whitespace/noncatalog purpose is accepted. Confirmed isolated HTTP.** POST purpose `'   '`. Expected: 400. Actual: 200; text stored with nullable lookup FK. Cause: `src/routes/api/requests/+server.ts:98` truthiness only and `:185` nullable subquery. Fix: trim/length limits and positive active-purpose lookup.

**M03 — Registration API bypasses browser validation. Confirmed weak-password case; other fields source review.** Direct fake registration with password `'x'` returns 200 instead of minimum-eight error. Student ID format, email syntax, year bounds, allowed program and actual date validity likewise lack complete server validation. Invite acceptance has no minimum password length. Cause: `src/routes/api/register/+server.ts:12`, `:35`; `src/routes/api/accept-invite/+server.ts:11`. Fix: shared typed schema and field-specific 400 errors; catch malformed JSON/types instead of unhandled 500.

**M04 — All ten seeded form preview files are missing. Confirmed repository asset check.** Bootstrap a disposable QA DB and open a seeded preview URL. Expected: its JPEG page. Local source artifact: ten `/forms/*.jpg.jpg` references have no corresponding `static` files. Cause: `database/db.sql:187` through `:205` and matching forms migration. Current deployed catalog may have been edited; deployed 404s were not tested. Fix: restore official assets or migrate to validated cloud files; verify each URL.

**M05 — Forgot-password UI claims success after server/mail failure. Source review.** Return 500/502 from `/api/forgot-password` for a fake inbox. Expected: delivery/service error or honest queued status. Source behavior: client sets `forgot-sent` regardless of `res.ok`. Cause: `src/routes/login/+page.svelte:55` / `:60`; server `src/routes/api/forgot-password/+server.ts:27` can throw on email failure. Fix: inspect response status and provide retry feedback without exposing account existence.

**M06 — Invalid email verification routes to a missing page. Source review.** GET `/api/verify?token=invalid`. Expected: useful expired-link/resend page. Actual handler redirect: `/verify-email?error=invalid_or_expired`, with no matching page. Successful verification does not create a session, so a newly registered visitor still needs login. Cause: `src/routes/api/verify/+server.ts:11`, `:19`, `:23`. Fix: implemented verification-result/resend/login destination and clear message.

**M07 — Essential upload and modal accessibility defects. Compiler/source-confirmed; keyboard/contrast browser execution blocked.** Tab through new-request requirements: hidden file input and nonfocusable label offer no keyboard upload action. Open a shared modal and Tab beyond controls: no generic focus trap/initial focus/restore/inert background. Multiple modals reuse `modal-title`. Purpose/profile/office labels lack control association; unnamed icon buttons remain. Cause: `src/routes/student/request/+page.svelte:208` / `:213` / `:231`; `src/lib/components/ui/Modal.svelte:37` / `:52`; profile compiler diagnostics. FormsLibrary adds its own focus trap; that does not fix other modals. Fix: accessible button/file input, unique labelled dialog, focus lifecycle, proper labels/names; verify contrast at each viewport.

**M08 — File view/download failures have no useful feedback. Source review.** Make `/api/storage` return 401/500 or abort request. Expected: alert/retry and reauthentication if needed. Code returns empty URL or uncaught rejected promise and shows nothing. Async `window.open` can also be popup-blocked; cross-origin `<a download>` is not guaranteed to save with the requested filename. Cause: `src/routes/student/documents/+page.svelte:49`, `:55`, `:61`; office detail `:47`. Fix: checked responses, visible error/retry, authorized document response or blob download, safe synchronous window creation where needed. Actual popup/download behavior unverified.

**M09 — Office badge count excludes unread history and ID notices. Source review.** Leave a fake new-student identity notice or status history unread, then navigate between office Notifications and Dashboard. Expected: consistent count. Layout counts only new Pending/unviewed requests with no history (`src/routes/staff/+layout.server.ts:31`); notifications page counts combined history/list (`src/routes/staff/notifications/+page.svelte:72`). Fix: same actor-scoped query/store semantics everywhere; record resubmissions so office sees new work.

**M10 — Session cookie lacks Secure flag. Source-confirmed configuration.** Sign in and inspect cookie options; expected HTTPS Secure cookie, actual `secure:false`. Cause: `src/routes/api/login/+server.ts:45`. A TLS-only deployment may reduce exposure but was not verified. Fix: Secure in deployed HTTPS environments, preserve local development behavior, and test cookie attributes through actual SvelteKit/browser transport.

**M11 — Normalized program FK is not maintained. Source review.** Register or change a fake program, inspect `users.program_id`; expected program FK consistent with selection, actual handlers write only `users.program`. Cause: registration `src/routes/api/register/+server.ts:46`, academic update `src/routes/api/profile/+server.ts:111`, student management `src/routes/api/students/+server.ts:57`. Fix: validate program lookup and update FK and any temporary legacy value consistently. Current UI mostly reads the legacy field, so the mismatch is concealed until normalized reports/queries are used.

### Low

**L01 — Submission copy contradicts file-update behavior. Source-confirmed.** Read the final request step, then a Pending request in My Documents. Expected: accurate amendment policy. Actual: “cannot edit this request” vs Update Files. Cause: `src/routes/student/request/+page.svelte:276`, `src/routes/student/documents/+page.svelte:128`. Fix: distinguish immutable selection/purpose from editable pending files and correction workflow.

**L02 — Setup/features/migration docs no longer describe current source. Source-confirmed.** Follow README's email/variable/table descriptions or FEATURES report statement; expected current architecture, actual Resend vs Brevo, nine vs twelve tables, export listed unbuilt though CSV exists, and `.env.example` Supabase key names differ from imported static variables (`src/lib/server/supabase.ts:2`). Migration README also claims all reruns are safe while newer migrations use plain ADD/CREATE. Fix: update docs and validate a clean disposable setup. Files: `README.md:7`, `FEATURES.md:68`, `.env.example:10`, `database/migrations/README.md:3`. No migrations were run or assumed deployed.

## 5. Break-test coverage and open work

| Case | Actual audit evidence |
|---|---|
| Student entering office page | Server-layout guard test passed; browser URL/navigation not run. |
| Another Student's request/file | Critical IDOR/file-signing failures confirmed against fake records. |
| Empty/invalid forms | Invalid document count/duplicates correctly 400; missing requirement, weak password, blank purpose wrongly accepted. Other malformed field types source-reviewed. |
| Wrong/large file | Harmless executable and 11 MiB requirement accepted by handler/fake storage. Real Vercel/Supabase limits unknown. Forms-upload endpoint has distinct validation and does not fix request uploads. |
| Duplicate submit/double-click | Repeated identical HTTP submission creates duplicates. Browser button disables while submitting; actual rapid double-click not tested. Concurrent MySQL ID locking not tested with mock DB. |
| Refresh/back mid-wizard | State/files exist only in component memory; no saved draft or leave confirmation in request wizard. Expected loss inferred from source; browser recovery behavior unverified. |
| Network/storage failure | Injected storage failure correctly prevents creating/approving request; email failure returns warning after status commit. Client catches submit network errors. Mid-upload disconnect, partial object cleanup and unknown commit outcome require browser/service test. |
| Slow network | Forms library skeleton and disabled-submit spinners exist; request forms use submitting flags. Timing, skeleton usefulness and accessible announcements unverified. |
| Mobile/tablet/desktop | Responsive layouts/cards exist and Playwright projects are configured at 390×844, 768×1024 and 1440×900. No layout Pass claimed. |
| Accessibility | 75 warnings and source issues above; custom Select implements keyboard navigation/aria labels. Actual keyboard flow, screen reader names, contrast and zoom unverified. |

### Automation delivered

`audit.test.mjs` + `harness.mjs`: 36 executed tests, **16 passed / 20 failed**. Successful scenarios cover Student registration/email verification/login/ID gate/request/upload/logout; Staff correction/Student resubmission/final file and fake signing; Admin invite/accept/ID verify; password-reset happy path; Staff/Admin login/queue/detail; expiration, role guards, invalid selection, upload outage and email warning. Failed assertions enforce desired behavior, rather than treating unsafe 200 responses as successful tests.

The top five failure regressions are C01 (Student status mutation), C02 (other Student detail), C03 (other Student file signing), C04 (non-session JWT used as session), H01 (empty final-state resubmission).

`browser.spec.mjs` + `playwright.config.mjs`: 12 test definitions across three viewport projects (36 potential browser executions), written for a separate fake-only deployment. Includes role happy paths, the five failures, login validation/network failure and responsive keyboard checks. Actual Playwright execution **was blocked**, not passed or silently skipped. Real email inbox receipt, signature authenticity, session revocation across browsers, detailed mobile form use and mid-upload interruption still require additional execution/fixtures. Browser suite intentionally does not start the ordinary dev server or target the supplied live site for mutation tests.

## 6. Missing capabilities for a truly paperless service

1. Replace in-person requirements with digital uploads, authoritative evidence checks and electronic departmental approval tasks.
2. Online completion/submission of clearance, registration, grade-change and evaluation forms; preserve structured answers, versions and signatures.
3. Final-document templates/PDF generation, authorized signature/stamp, issuer metadata, revocation and QR/public authenticity verification.
4. Distinct review/ready/issued states, clear release date and digital receipt/access audit.
5. Complete deliverables for every selected document: per-item files/states or a validated combined signed package.
6. Controlled correction/reapplication for rejected requests, connected history and no lost evidence.
7. Durable every-transition notifications, pending/resubmission events, email retries and verification resend.
8. Immutable full audit: decisions/remarks, submissions/resubmissions, file versions, identity review, release/download and account/catalog changes.
9. Certificate reports with Student name/ID/program/type/request/release dates, status/date/program/type filters, CSV/XLSX/PDF and export audit.
10. Draft recovery, resumable/validated uploads, retry-safe submissions and accessible remote use.

Human review is compatible with paperless processing. Optional report printing is not a blocker if a complete digital output exists. Which original academic documents must be accepted legally/operationally in digital form requires institution policy; this audit does not invent that policy.

## Prioritized fix list — top 10

| Priority | Concrete fix | Acceptance evidence |
|---|---|---|
| 1 | C01: Staff/Admin guard on every decision mutation | Student actions 403 without reads/uploads/writes/emails; Staff/Admin happy paths remain green. |
| 2 | C02: Request-detail ownership scope | Student A cannot read fake B; A can read own; office can read both. |
| 3 | C03: File entitlement/bucket allowlist | Other-user paths/buckets denied; own requirements and released finals accessible. |
| 4 | C04: Typed/purpose-bound validated sessions across APIs | Verification/reset/invite tokens rejected as sessions; valid role sessions continue working. |
| 5 | H05: One requirements array contract | Refresh/correction UI shows submitted/flagged files and usable upload fields. |
| 6 | H01/H03: Server-side transition and completion rules | Empty/terminal resubmission denied; final deliverable and reject/correct remarks required. |
| 7 | H02: Required uploads and explicit file limits/types | Missing, wrong-type, oversize inputs rejected before storage; valid upload/outage handling verified. |
| 8 | H06: One-time resets and session revocation | Used reset token and prior sessions denied after reset/credential or role changes. |
| 9 | H07/H04: Atomic immutable audit and owner-scoped notifications | Every transition recorded once; injected failure rolls back; Student cannot alter office/others' read state. |
| 10 | H08: Remove checked-out-connection/pool deadlock | Disposable MySQL deletion completes, pool remains responsive, history retention policy preserved. |

Next High work: H09 adaptive password hashes, H10 safe template replacement, H11 reactive office data, H12 verification recovery. Then retry idempotency, other Medium issues and missing paperless capabilities. Digital issuance/sign-off/verification is the first product milestone after critical access controls and broken flows are corrected.

**Approval boundary:** per the user's instruction, no application fix has been made. After approval, start with C01, fix one Critical/High issue at a time, rerun its regressions plus the relevant role happy paths after each, and report remaining failures honestly. Browser/deployed sign-off remains pending isolated credentials/tool access even after local regressions turn green.
