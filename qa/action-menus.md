# Actions column and dropdown verification

The Staff Management, Student Management and All Requests pages now use `ActionMenu.svelte` for their inline action groups. Existing primary buttons remain page-owned snippets, so their labels, variants, callbacks and permissions are retained. `RowMenu.svelte` remains the shared dropdown used elsewhere in the portal.

## App-wide interaction audit

The shared action-menu patterns were checked against the staff requests, students, staff, documents, forms, masterlist and user menus, as well as the student registration, request and document views. `ActionMenu.svelte` remains the inline primary-action plus overflow pattern; `RowMenu.svelte` remains the reusable action menu, including destructive styling and existing permission guards.

The audit found two separate floating controls outside that shared menu: the registration `Select.svelte` dropdown was positioned inside its form and could be clipped by the mobile scroll area, while `DocumentPopover.svelte` used a manual popover that did not participate in the page's auto-dismiss behavior and closed on every resize. Both now use the same viewport-aware floating-panel positioning helper as action menus. Registration options and document details use the browser popover top layer, fit the visible viewport, reposition after scroll/resize, and close on Escape or outside interaction. Short menus remain unscrolled; scrolling is only available when content exceeds the actual available viewport height.

The shared `FilterBar.svelte` was also aligned to the button and control tokens, full-width mobile fields, labeled search/filter controls, and the shared secondary reset button. Activity CSV/clear and Report CSV/print actions now use `Button.svelte`, retaining their existing destinations and callbacks while sharing focus, disabled, and sizing behavior. Existing page-specific filters remain in place where they carry page-specific state or layouts; no search or filter callbacks were changed.

The route review covered Admin/Staff dashboard, requests and request details, students, staff, documents, forms, reports, activity, notifications and profile; Student dashboard, request, documents, forms, notifications and profile; and login/registration. Existing modal confirmations continue to use `Modal.svelte` and `ConfirmDialog.svelte`. `Pagination.svelte` was aligned to the shared control dimensions and now marks the current page accessibly, labels page-size selection, and uses explicit non-submit button types.

The three Actions columns share a 180px token. Button heights use the existing 40px control and 44px mobile/touch tokens, with an 8px gap and consistent padding. Removed the old global descendant button rules and student-only 2px gap/28px trigger overrides. Student table columns reserve the action width before dividing the remaining space; its table uses the existing horizontal scroll wrapper at narrower laptop widths.

Floating controls use the browser popover top layer to escape table and form clipping. Their width follows their content within viewport bounds; labels and permission reasons wrap. Menus choose above/below placement, clamp to the visible viewport, and update after scroll, resize or content size changes. Native dismissal keeps open state synchronized; keyboard controls include arrows, Home/End, letter navigation, Enter/Space, Tab/Shift+Tab and Escape.

## Reproduce browser verification

Run `node qa/action-menus.browser.mjs` from the repository root. It uses installed Vite/Svelte and headless Edge or Chrome; no new dependency is required. Set `QA_BROWSER_PATH` if the browser is outside the detected locations.

The runner mounts the actual three page components with fake data in a local fixture. All fixture API calls are intercepted, and unexpected endpoints throw. No real accounts or records are used. Screenshots are saved to the ignored `.svelte-kit/action-menu-qa/` directory.

## Results

- 72 first/middle/last-row dropdown cases passed: three pages at 320, 375, 767, 768, 1024, 1280, 1440 and 1920px.
- Verified common column width, matching control heights, 8px gaps, header alignment, reachable triggers through table scrolling, and no page or menu overflow.
- Verified edit/view/delete/revoke callbacks open the existing dialogs, Review links retain their destination, and disabled actions remain unavailable for own-account, linked-request and staff-role restrictions.
- Keyboard controls, focus restoration, outside dismissal, one menu at a time, long disabled reasons, touch sizing, scroll/resize updates, explicit above/below placement, and a clipped table ancestor passed.
- The responsive browser runner also checks registration select placement, request document-popover dismissal, and search/filter/pagination sizing at 320, 375, 390, 430, 768 and 1440px, including keyboard selection and page-size callbacks.
- `npm run check`: 0 errors, 56 existing warnings, unchanged from the initial check.
- `npm run build`: passed. No lint script is defined in `package.json`.
- Existing targeted QA: 10 passed and 8 failed across `admin-actions.test.cjs`, `student-delete.test.cjs` and `student-ui.test.cjs`. The same eight failures were reproduced with the original versions of the modified source modules: an obsolete badge-class assertion, five backend mocks missing `$lib/server/activity-log`, and two existing timeline/wizard expectations. They are outside this layout change.

Backend code, API calls, schema, dependency manifests and unrelated existing edits were preserved. Browser verification covers UI callbacks and guards; it does not exercise real backend mutations.
