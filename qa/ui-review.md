# UI review

This report covers the shared admin controls, student page improvements, and the final consistency pass. All implementation changes are in UI components, client helpers, styles, and tests. No API routes, database schema, or server logic changed.

## Validation

- 103 automated tests passed across the suite and the targeted rerun after updating the empty-state expectation.
- `npm run check`: 0 errors; 55 accessibility/initial-state warnings remain.
- `npm run build`: passed.
- Browser checks used mocked data and uploads. No live accounts, requests, photos, or masterlist records were changed.
- All 16 portal views checked at 375px, 768px, and 1280px had no horizontal page overflow. All visible mobile buttons met the 44px minimum.
- Every visible button, link, input and select in those views had a green focus ring. Keyboard menus, Escape, and modal focus trapping passed.
- Checked chip and banner text met 4.5:1 contrast; the lowest measured ratio was 4.88:1. The red notification counter was darkened to fix its contrast.
- Request submission spinner, stable width, double-click guard, failure recovery with retained files, successful request confirmation, ID note retry, replacement photo preview, automatic office review, and correction-file validation passed browser checks.

## Pages to open

Check each page at 375px, 768px, and 1280px. Use Tab/Shift+Tab as well as mouse or touch. Use test accounts/data for actions.

| Page | Route | What to check |
| --- | --- | --- |
| Admin Dashboard | `/staff/dashboard` | Neutral zero-count verification banner, Review button, submitted-request activity, empty-state actions. |
| All Requests | `/staff/requests` | Mobile cards, primary Review at the bottom, overflow menu, KPI filters, Awaiting delivery chip, full document popover, readable dates. |
| Request details | `/staff/requests/<request ID>` | Responsive requirement rows, focus rings, confirmation dialogs, action feedback. |
| Students | `/staff/students` | Counted tabs, full names, ID/email chips, two-line program, Review/View plus overflow menu, empty-state action. |
| Enrollment Masterlist | Students → Masterlist | Stacked mobile rows, delete action at the bottom, loading/error retry, CSV import empty-state guidance. |
| Staff | `/staff/staff` | Mobile cards with Edit at the bottom, readable joined date, own-role disabled reason. |
| Documents | `/staff/documents` | Visible View/Download, overflow Edit/Delete, request usage guard, loading/error retry, Add document empty-state action. |
| Admin Forms | `/staff/forms` | Skeleton, friendly Try again panel, clear-filter/add-form empty states, card menus and confirmations. |
| Reports | `/staff/reports` | Recent requests become labeled cards below 768px, Review at the bottom, filter/export controls, empty-period action. |
| Admin Notifications | `/staff/notifications` | Wrapping text and dates, View notification at the bottom on mobile, clear-filter/requests empty-state actions. |
| Admin Profile | `/staff/profile` | Focus rings, touch targets, sentence-case buttons, labeled password visibility controls. |
| Student Dashboard | `/student/dashboard` | Pending yellow banner, rejected reason and three steps, note enable/retry, verified account with no banner, matching next step and locked Request Document actions. |
| Request Document | `/student/request` | All three steps: real checkboxes, named requirements, sticky count/Next, file names/sizes/Replace/Remove, missing-file reasons, spaced summary, submission failure and success. |
| My Documents | `/student/documents` | All document names and requirements, newest vertical timeline open, uploaded/correction chips, View/Replace only while editable, correction update guard. |
| My Profile | `/student/profile#school-id-photo-card` | School ID photo card, current status, uploaded preview, local replacement preview and upload feedback. |
| Student Forms | `/student/forms` | Skeleton, retry after load failure, downloads and empty-state next action. |
| Student Notifications | `/student/notifications` | Mobile card action at the bottom, date wrapping, filters and empty-state next action. |

During a slow page navigation, both portals show the shared skeleton. A failed server page load shows a friendly error page with Try again. Forms, document mapping, request usage checks, ID photo preview, student review and the masterlist also have local loading/error recovery.

The existing ID upload endpoint automatically submits a replacement photo for office review. The UI explains this after selecting a new photo. A rejected account can separately send a review note with the existing endpoint. Student request cancellation is omitted because a student cancel route is not available. In-person requirements retain their existing exemption from file uploads. Historical requirements that cannot be mapped to the current document catalog remain visible under Other request requirements.

The current portal pages do not display monetary amounts, so no price or payment field required a currency conversion.

## Every changed source and QA file

The complete list below includes the preceding shared admin component pass and the student/consistency work. The user's existing `backup-before-restore.patch` was left untouched. Temporary mocked browser harnesses and logs stay in the ignored `.svelte-kit/` directory.

- [qa/academics-reports.test.cjs](C:/Users/1/Desktop/essu-docuflow-main/qa/academics-reports.test.cjs)
- [qa/admin-actions.test.cjs](C:/Users/1/Desktop/essu-docuflow-main/qa/admin-actions.test.cjs)
- [qa/forms-requirements.test.cjs](C:/Users/1/Desktop/essu-docuflow-main/qa/forms-requirements.test.cjs)
- [qa/masterlist-clear.test.cjs](C:/Users/1/Desktop/essu-docuflow-main/qa/masterlist-clear.test.cjs)
- [qa/signup-verification.test.cjs](C:/Users/1/Desktop/essu-docuflow-main/qa/signup-verification.test.cjs)
- [qa/student-id-photo.test.cjs](C:/Users/1/Desktop/essu-docuflow-main/qa/student-id-photo.test.cjs)
- [qa/student-ui.test.cjs](C:/Users/1/Desktop/essu-docuflow-main/qa/student-ui.test.cjs)
- [qa/task-bugs.test.cjs](C:/Users/1/Desktop/essu-docuflow-main/qa/task-bugs.test.cjs)
- [qa/ui-review.md](C:/Users/1/Desktop/essu-docuflow-main/qa/ui-review.md)
- [src/app.css](C:/Users/1/Desktop/essu-docuflow-main/src/app.css)
- [src/lib/admin-requests.ts](C:/Users/1/Desktop/essu-docuflow-main/src/lib/admin-requests.ts)
- [src/lib/components/forms/FormsLibrary.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/forms/FormsLibrary.svelte)
- [src/lib/components/layout/Sidebar.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/layout/Sidebar.svelte)
- [src/lib/components/layout/TopBar.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/layout/TopBar.svelte)
- [src/lib/components/ui/Badge.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/Badge.svelte)
- [src/lib/components/ui/Button.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/Button.svelte)
- [src/lib/components/ui/ConfirmDialog.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/ConfirmDialog.svelte)
- [src/lib/components/ui/DocumentPopover.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/DocumentPopover.svelte)
- [src/lib/components/ui/ErrorState.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/ErrorState.svelte)
- [src/lib/components/ui/LoadError.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/LoadError.svelte)
- [src/lib/components/ui/LoadingState.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/LoadingState.svelte)
- [src/lib/components/ui/MasterlistModal.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/MasterlistModal.svelte)
- [src/lib/components/ui/Modal.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/Modal.svelte)
- [src/lib/components/ui/RequestJourney.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/RequestJourney.svelte)
- [src/lib/components/ui/RequirementFilePicker.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/RequirementFilePicker.svelte)
- [src/lib/components/ui/RowMenu.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/RowMenu.svelte)
- [src/lib/components/ui/StatusChip.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/StatusChip.svelte)
- [src/lib/components/ui/Toast.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/Toast.svelte)
- [src/lib/components/ui/VerificationHelp.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/lib/components/ui/VerificationHelp.svelte)
- [src/lib/formatting.ts](C:/Users/1/Desktop/essu-docuflow-main/src/lib/formatting.ts)
- [src/lib/request-status.ts](C:/Users/1/Desktop/essu-docuflow-main/src/lib/request-status.ts)
- [src/lib/responsive-table.ts](C:/Users/1/Desktop/essu-docuflow-main/src/lib/responsive-table.ts)
- [src/lib/stores/id-review.ts](C:/Users/1/Desktop/essu-docuflow-main/src/lib/stores/id-review.ts)
- [src/lib/stores/toasts.ts](C:/Users/1/Desktop/essu-docuflow-main/src/lib/stores/toasts.ts)
- [src/lib/student-files.ts](C:/Users/1/Desktop/essu-docuflow-main/src/lib/student-files.ts)
- [src/lib/student-request-display.ts](C:/Users/1/Desktop/essu-docuflow-main/src/lib/student-request-display.ts)
- [src/routes/+error.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/+error.svelte)
- [src/routes/+layout.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/+layout.svelte)
- [src/routes/staff/+error.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/+error.svelte)
- [src/routes/staff/+layout.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/+layout.svelte)
- [src/routes/staff/dashboard/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/dashboard/+page.svelte)
- [src/routes/staff/documents/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/documents/+page.svelte)
- [src/routes/staff/notifications/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/notifications/+page.svelte)
- [src/routes/staff/profile/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/profile/+page.svelte)
- [src/routes/staff/reports/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/reports/+page.svelte)
- [src/routes/staff/requests/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/requests/+page.svelte)
- [src/routes/staff/requests/[request_id]/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/requests/[request_id]/+page.svelte)
- [src/routes/staff/staff/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/staff/+page.svelte)
- [src/routes/staff/students/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/staff/students/+page.svelte)
- [src/routes/student/+error.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/student/+error.svelte)
- [src/routes/student/+layout.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/student/+layout.svelte)
- [src/routes/student/dashboard/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/student/dashboard/+page.svelte)
- [src/routes/student/documents/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/student/documents/+page.svelte)
- [src/routes/student/notifications/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/student/notifications/+page.svelte)
- [src/routes/student/profile/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/student/profile/+page.svelte)
- [src/routes/student/request/+page.svelte](C:/Users/1/Desktop/essu-docuflow-main/src/routes/student/request/+page.svelte)

