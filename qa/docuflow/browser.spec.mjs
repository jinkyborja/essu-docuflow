// Requires a separate, fake-only QA database. All mutation targets are created by
// the current test, except QA_OTHER_REQUEST_ID, which must be a seeded fake record.
import { test, expect } from '@playwright/test';

const env = process.env;
const fakePdf = { name: 'docuflow-qa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% QA fake document\n%%EOF') };
function requireRole(role) {
  test.skip(!env[`QA_${role}_EMAIL`] || !env[`QA_${role}_PASSWORD`], `${role} QA credentials unavailable`);
}
async function login(page, role) {
  await page.goto('/login');
  await page.locator('#login-email').fill(env[`QA_${role}_EMAIL`]);
  await page.locator('#login-password').fill(env[`QA_${role}_PASSWORD`]);
  await page.getByRole('button', { name: /^Sign In/i }).click();
  await expect(page).toHaveURL(role === 'STUDENT' ? /\/student\/dashboard/ : /\/staff\/dashboard/);
}
async function apiLogin(request, role) {
  const response = await request.post('/api/login', { data: { email: env[`QA_${role}_EMAIL`], password: env[`QA_${role}_PASSWORD`] } });
  expect(response.status()).toBe(200);
}
async function createOwnRequest(request) {
  const result = await request.post('/api/requests', { multipart: {
    documentIds: JSON.stringify([Number(env.QA_DOCUMENT_ID)]), purpose: 'Employment', requirements: '[]',
    [`file_${env.QA_REQUIREMENT_NAME}`]: { name: fakePdf.name, mimeType: fakePdf.mimeType, buffer: fakePdf.buffer }
  } });
  expect(result.status()).toBe(200); return (await result.json()).request_id;
}

test('Student happy path: login, submit uploaded requirements, track and logout', async ({ page }) => {
  requireRole('STUDENT'); test.skip(!env.QA_DOCUMENT_NAME, 'QA document fixture unavailable');
  await login(page, 'STUDENT'); await page.goto('/student/request');
  await page.getByRole('button', { name: new RegExp(env.QA_DOCUMENT_NAME), exact: false }).click();
  await page.getByRole('button', { name: /^Next/ }).click();
  for (const input of await page.locator('input[type=file]').all()) await input.setInputFiles(fakePdf);
  await page.getByRole('button', { name: /^Next/ }).click();
  await page.locator('select').selectOption('Employment');
  const posted = page.waitForResponse((r) => r.url().endsWith('/api/requests') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Submit Request/i }).click();
  const response = await posted; expect(response.ok()).toBeTruthy(); const id = (await response.json()).request_id;
  await page.goto('/student/documents'); await expect(page.getByText(id, { exact: false })).toBeVisible();
  await expect(page.getByText(env.QA_REQUIREMENT_NAME, { exact: true }).first()).toBeVisible();
  await page.request.post('/api/logout'); await page.goto('/student/documents'); await expect(page).toHaveURL(/\/login/);
});

test('Office happy path: queue, search, upload final PDF, Student view/download', async ({ browser }) => {
  requireRole('STUDENT'); requireRole('STAFF'); test.skip(!env.QA_DOCUMENT_ID || !env.QA_REQUIREMENT_NAME, 'QA document fixture unavailable');
  const student = await browser.newContext(); const office = await browser.newContext();
  try {
    await apiLogin(student.request, 'STUDENT'); const id = await createOwnRequest(student.request);
    const page = await office.newPage(); await login(page, 'STAFF'); await page.goto('/staff/requests');
    await page.getByPlaceholder('Search by name, request ID or student ID...').fill(id);
    await page.locator('select').selectOption('Pending');
    await page.getByRole('link', { name: 'Review', exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText(env.QA_REQUIREMENT_NAME, { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /^Approve/ }).first().click();
    await page.getByRole('dialog').locator('input[type=file]').setInputFiles(fakePdf);
    await page.getByRole('dialog').getByRole('button', { name: /^Approve/ }).click();
    await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
    const studentPage = await student.newPage(); await studentPage.goto('/student/documents');
    await expect(studentPage.getByText('Document Ready', { exact: false })).toBeVisible();
    await expect(studentPage.getByRole('button', { name: 'Download', exact: true }).first()).toBeVisible();
    // Signed URL issuance is checked separately from browser download behavior.
    const detail = await (await student.request.get(`/api/requests/${id}`)).json();
    const signed = await student.request.get('/api/storage', { params: { bucket: 'requirements', path: detail.approved_file_path } });
    expect(signed.status()).toBe(200); expect((await signed.json()).url).toBeTruthy();
    const downloading = studentPage.waitForEvent('download');
    await studentPage.getByRole('button', { name: 'Download', exact: true }).first().click();
    const download = await downloading;
    expect(await download.failure()).toBeNull();
    expect(await download.path()).toBeTruthy();
  } finally { await student.close(); await office.close(); }
});

test('Admin happy path: admin-only management and reports CSV', async ({ page }) => {
  requireRole('ADMIN'); await login(page, 'ADMIN'); await page.goto('/staff/staff');
  await expect(page.getByText('Staff Management', { exact: true }).first()).toBeVisible();
  await page.goto('/staff/students'); await expect(page.getByText('Student Management', { exact: true }).first()).toBeVisible();
  await page.goto('/staff/reports'); const exportButton = page.getByRole('button', { name: 'Export CSV' });
  await expect(exportButton).toBeVisible();
  if (await exportButton.isEnabled()) { const downloaded = page.waitForEvent('download'); await exportButton.click(); expect((await downloaded).suggestedFilename()).toMatch(/\.csv$/); }
});

test('Wrong password and empty login have useful validation', async ({ page }) => {
  requireRole('STUDENT'); await page.goto('/login'); await page.getByRole('button', { name: /^Sign In/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.locator('#login-email').fill(env.QA_STUDENT_EMAIL); await page.locator('#login-password').fill('QA-intentionally-wrong');
  await page.getByRole('button', { name: /^Sign In/i }).click(); await expect(page.getByRole('alert')).toContainText('Invalid email or password');
});
test('Failure 1: Student cannot approve a request', async ({ request }) => {
  requireRole('STUDENT'); test.skip(!env.QA_OTHER_REQUEST_ID, 'Fake second-student request unavailable'); await apiLogin(request, 'STUDENT');
  const r = await request.patch(`/api/requests/${env.QA_OTHER_REQUEST_ID}`, { data: { action: 'approve' } }); expect(r.status()).toBe(403);
});
test('Failure 2: Student cannot read another student request', async ({ request }) => {
  requireRole('STUDENT'); test.skip(!env.QA_OTHER_REQUEST_ID, 'Fake second-student request unavailable'); await apiLogin(request, 'STUDENT');
  expect([403,404]).toContain((await request.get(`/api/requests/${env.QA_OTHER_REQUEST_ID}`)).status());
});
test('Failure 3: Student cannot sign another student file', async ({ request }) => {
  requireRole('STUDENT'); test.skip(!env.QA_OTHER_FILE_PATH, 'Fake second-student file unavailable'); await apiLogin(request, 'STUDENT');
  expect([403,404]).toContain((await request.get('/api/storage', { params: { bucket: 'requirements', path: env.QA_OTHER_FILE_PATH } })).status());
});
test('Failure 4: verification token cannot become a session', async ({ request }) => {
  test.skip(!env.QA_VERIFICATION_TOKEN, 'Token from fake QA verification email unavailable');
  expect((await request.get('/api/students', { headers: { cookie: `session=${env.QA_VERIFICATION_TOKEN}` } })).status()).toBe(401);
});
test('Failure 5: empty resubmission cannot reopen an approved request', async ({ browser }) => {
  requireRole('STUDENT'); requireRole('STAFF'); test.skip(!env.QA_DOCUMENT_ID || !env.QA_REQUIREMENT_NAME, 'QA document fixture unavailable');
  const student = await browser.newContext(); const office = await browser.newContext();
  try {
    await apiLogin(student.request, 'STUDENT'); const id = await createOwnRequest(student.request); await apiLogin(office.request, 'STAFF');
    expect((await office.request.patch(`/api/requests/${id}`, { multipart: { action: 'approve', approved_file: { name: fakePdf.name, mimeType: fakePdf.mimeType, buffer: fakePdf.buffer } } })).status()).toBe(200);
    expect([400,409]).toContain((await student.request.patch(`/api/requests/${id}/requirements`, { multipart: {} })).status());
  } finally { await student.close(); await office.close(); }
});
test('Responsive login and keyboard access', async ({ page }) => {
  await page.goto('/login'); await expect(page.locator('#login-email')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.locator('#login-email').focus(); await page.keyboard.press('Tab'); await expect(page.locator('#login-password')).toBeFocused();
});
test('Network failure during login exposes retryable error', async ({ page }) => {
  await page.goto('/login'); await page.route('**/api/login', (route) => route.abort('internetdisconnected'));
  await page.locator('#login-email').fill('fake@example.invalid'); await page.locator('#login-password').fill('fake-password');
  await page.getByRole('button', { name: /^Sign In/i }).click(); await expect(page.getByRole('alert')).toContainText('Network error');
});
