import { defineConfig } from '@playwright/test';

// Never implicitly start npm run dev: this repository's .env points at production.
const baseURL = process.env.QA_BASE_URL;
if (process.env.QA_ISOLATED !== 'true' || !baseURL) {
  throw new Error('Set QA_ISOLATED=true and QA_BASE_URL to a separately seeded QA deployment. Do not use the live database.');
}
if (new URL(baseURL).hostname === 'essu-docuflow-alpha.vercel.app') {
  throw new Error('Mutation tests are disabled on the live DocuFlow deployment.');
}
export default defineConfig({
  testDir: '.', testMatch: 'browser.spec.mjs', workers: 1, retries: 0,
  outputDir: './browser-results', reporter: [['list'], ['html', { outputFolder: './browser-report', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', acceptDownloads: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } }
  ]
});
