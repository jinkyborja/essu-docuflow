QA artifacts only. Application source, dependencies, environment and schema are unchanged.

Run the isolated API regression suite from the repository root:

```powershell
node --test --test-reporter=spec qa/docuflow/audit.test.mjs
```

It executes the real TypeScript handlers, JWT utilities, requirements helpers and request-item helpers through localhost HTTP. Only external database/storage/email services and SvelteKit cookie transport are replaced. It uses `example.invalid` accounts, never reads `.env`, and never imports the real database client. Unimplemented SQL fails loudly. This verifies application logic, not MySQL constraints/locking, SvelteKit middleware, deployed infrastructure, email delivery or browser rendering. Expected-behavior regressions intentionally fail until fixes are approved. The requirement-array check executes the page's parser; the form-file check inspects actual repository files.

Browser tests are written but could not run in this environment: Playwright is not installed, npm registry access was blocked, and the escalated npm process failed to start (Windows exit `-1073741502`). The deployed-site connection also failed; this is not proof that the site is down.

To run browser tests later, install `@playwright/test` in an isolated tooling directory and install its Chromium browser. Make the package resolvable from this directory. Set `QA_ISOLATED=true` and `QA_BASE_URL` to a separate deployment with a fake-only database; the config refuses the named production deployment and never starts the ordinary dev server. Supply:

```text
QA_STUDENT_EMAIL / QA_STUDENT_PASSWORD
QA_STAFF_EMAIL / QA_STAFF_PASSWORD
QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD
QA_DOCUMENT_ID / QA_DOCUMENT_NAME / QA_REQUIREMENT_NAME
QA_OTHER_REQUEST_ID / QA_OTHER_FILE_PATH   # seeded second fake student only
QA_VERIFICATION_TOKEN                     # captured fake registration email
```

Use an email-verified, ID-verified Student and a document with exactly one digital requirement. Browser mutations intentionally remain in the disposable QA database for inspection. Reset that QA database between runs/projects. No test may target a real record. Registration, real email receipt, reset-link delivery, mobile/tablet rendering, contrast, slow networks, draft recovery and browser download semantics remain blocked/unverified in the current audit.

```powershell
npx playwright test --config qa/docuflow/playwright.config.mjs
```

Use the node suite for full fake registration/reset/invite/ID-verification lifecycle coverage while QA inbox credentials are unavailable. Browser role credentials missing from the environment are explicitly skipped, never assumed to work.
