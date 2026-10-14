# Actions column and dropdown verification

The Staff Management, Student Management and All Requests pages now use `ActionMenu.svelte` for their inline action groups. Existing primary buttons remain page-owned snippets, so their labels, variants, callbacks and permissions are retained. `RowMenu.svelte` remains the shared dropdown used elsewhere in the portal.

The three Actions columns share a 180px token. Button heights use the existing 40px control and 44px mobile/touch tokens, with an 8px gap and consistent padding. Removed the old global descendant button rules and student-only 2px gap/28px trigger overrides. Student table columns reserve the action width before dividing the remaining space; its table uses the existing horizontal scroll wrapper at narrower laptop widths.

Dropdowns use the existing browser popover top layer to escape table clipping. Their width follows their content within viewport bounds; labels and permission reasons wrap. There is no menu height cap or internal scroll container. Menus choose above/below placement, clamp to the visible viewport, and update after scroll, resize or content size changes. Native dismissal keeps open state synchronized; keyboard controls include arrows, Home/End, letter navigation, Enter/Space, Tab/Shift+Tab and Escape.

## Reproduce browser verification

Run `node qa/action-menus.browser.mjs` from the repository root. It uses installed Vite/Svelte and headless Edge or Chrome; no new dependency is required. Set `QA_BROWSER_PATH` if the browser is outside the detected locations.

The runner mounts the actual three page components with fake data in a local fixture. All fixture API calls are intercepted, and unexpected endpoints throw. No real accounts or records are used. Screenshots are saved to the ignored `.svelte-kit/action-menu-qa/` directory.

## Results

- 72 first/middle/last-row dropdown cases passed: three pages at 320, 375, 767, 768, 1024, 1280, 1440 and 1920px.
- Verified common column width, matching control heights, 8px gaps, header alignment, reachable triggers through table scrolling, and no page or menu overflow.
- Verified edit/view/delete/revoke callbacks open the existing dialogs, Review links retain their destination, and disabled actions remain unavailable for own-account, linked-request and staff-role restrictions.
- Keyboard controls, focus restoration, outside dismissal, one menu at a time, long disabled reasons, touch sizing, scroll/resize updates, explicit above/below placement, and a clipped table ancestor passed.
- `npm run check`: 0 errors, 56 existing warnings, unchanged from the initial check.
- `npm run build`: passed. No lint script is defined in `package.json`.
- Existing targeted QA: 10 passed and 8 failed across `admin-actions.test.cjs`, `student-delete.test.cjs` and `student-ui.test.cjs`. The same eight failures were reproduced with the original versions of the modified source modules: an obsolete badge-class assertion, five backend mocks missing `$lib/server/activity-log`, and two existing timeline/wizard expectations. They are outside this layout change.

Backend code, API calls, schema, dependency manifests and unrelated existing edits were preserved. Browser verification covers UI callbacks and guards; it does not exercise real backend mutations.
