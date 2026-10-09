# Portal layout update

Both portals now share a clear page heading and purpose, a compact top bar, quieter cards, consistent spacing and a readable content width. ESSU green and gold remain the brand colors. Green focus indicators, visible navigation controls and a skip link support keyboard use.

Student dashboard shortcuts now use one clear primary action with neutral secondary links. Request statuses sit below the title on phones. Wizard step labels remain visible on phones, upload controls support Enter and Space, and dialogs capture and restore keyboard focus.

The office dashboard has mobile review cards and a compact desktop queue with visible Review actions. Request and student lists switch to cards on smaller screens; wider screens show additional columns. Full record details remain available through Review. Form titles wrap instead of being cut off.

## Previews

These images use the actual layout and dashboard components with sample data, not live student records.

- [Student desktop](ui/student-desktop.png)
- [Student phone](ui/student-mobile.png)
- [Office desktop](ui/office-desktop.png)
- [Office phone](ui/office-mobile.png)

## Files changed

- `src/app.css`: shared presentation, responsive tables, page headings, cards and focus styles.
- `src/lib/components/layout/PageIntro.svelte`: shared page heading, guidance and student primary action.
- `src/lib/components/layout/Sidebar.svelte`: mobile close control, focus handling, Escape and resize behavior.
- `src/lib/components/layout/TopBar.svelte`: visible desktop collapse control, compact header, constrained profile text and larger mobile menu target.
- `src/lib/components/ui/Modal.svelte`: unique dialog labels, focus handling and background scroll locking.
- `src/lib/components/ui/StatCard.svelte`: readable labels.
- `src/lib/components/forms/FileUpload.svelte`: accessible upload naming, reactive input and keyboard controls.
- `src/lib/components/forms/StepIndicator.svelte`: phone step labels.
- `src/lib/components/forms/FormsLibrary.svelte`: streamlined toolbar and wrapping form titles.
- `src/routes/student/+layout.svelte` and `src/routes/staff/+layout.svelte`: shared headings, skip targets and flexible content containers.
- `src/routes/student/dashboard/+page.svelte`: simpler shortcuts, next-step panel and responsive request cards.
- `src/routes/staff/dashboard/+page.svelte`: mobile queue cards and compact desktop queue.
- `src/routes/staff/requests/+page.svelte` and `src/routes/staff/students/+page.svelte`: responsive table layouts.
- `src/routes/student/documents/+page.svelte`, `src/routes/staff/documents/+page.svelte` and `src/routes/staff/reports/+page.svelte`: remove duplicate headings and align toolbars.
- `src/routes/student/request/+page.svelte`: wider wizard workspace.
- `src/routes/login/+page.svelte`: green keyboard focus indicator.
- This document and the four sample screenshots.

## Verification

Browser preview checks cover both dashboards at 1440px and 390px, one main heading, no horizontal page overflow, no sideways scrolling in the office dashboard queue, mobile navigation and dialog focus handling. These are layout checks using sample data; they do not replace end-to-end testing with authenticated accounts.

- `npm run check`: passed with 0 errors and 67 warnings in 10 files, down from 71 warnings before this update.
- `npm run build`: passed. The existing adapter-auto configuration cannot identify a production hosting environment locally.

No backend, database, authentication behavior or configuration changes are part of this update.
