import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { reset, state, tokenFor, jwt, secret, password, startHarness, loadSource, renderPage, root } from './harness.mjs';

let server;
before(async () => server = await startHarness());
after(async () => server.close());
beforeEach(reset);
const call = (route, { id, token, method = 'GET', body } = {}) => fetch(server.base + route, {
  method, redirect: 'manual', headers: { ...(id || token ? { cookie: `session=${token ?? tokenFor(id)}` } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
  ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {})
});
function requestForm({ upload = true, purpose = 'Employment', ids = [1], type = 'application/pdf', size = 10, name = 'fake.pdf' } = {}) {
  const fd = new FormData(); fd.set('documentIds', JSON.stringify(ids)); fd.set('purpose', purpose); fd.set('requirements', '[]');
  if (upload) fd.set('file_QA ID', new File([Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(Math.max(0, size - 8))])], name, { type }));
  return fd;
}
test('Happy path: Student login, upload, own request list and logout', async () => {
  const login = await call('/api/login', { method: 'POST', body: { email: state.users[0].email, password } });
  assert.equal(login.status, 200); assert.equal((await login.json()).role, 'student');
  const cookie = login.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/);
  const token = cookie.match(/^session=([^;]+)/)[1];
  assert.equal((await jwt.verifySession(token, secret)).purpose, 'session');
  const created = await call('/api/requests', { token, method: 'POST', body: requestForm() }); assert.equal(created.status, 200);
  const requestId = (await created.json()).request_id;
  const list = await (await call('/api/requests', { id: 1 })).json(); assert.equal(list.length, 1); assert.equal(list[0].request_id, requestId);
  assert.equal(list[0].requirements[0].file_name, 'fake.pdf'); assert.ok(state.files.size > 1);
  const logout = await call('/api/logout', { id: 1, method: 'POST' }); assert.equal(logout.status, 302); assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});
test('Happy path: Staff correction, Student fixed file, Staff final upload and digital link', async () => {
  const correction = await call('/api/requests/REQ-2026-001', { id: 3, method: 'PATCH', body: { action: 'correction', admin_message: 'Use a readable fake ID', flagged_requirements: ['QA ID'] } }); assert.equal(correction.status, 200);
  const resubmitted = await call('/api/requests/REQ-2026-001/requirements', { id: 2, method: 'PATCH', body: requestForm() }); assert.equal(resubmitted.status, 200);
  const fd = new FormData(); fd.set('action', 'approve'); fd.set('approved_file', new File(['%PDF-1.4\nQA final'], 'qa-final.pdf', { type: 'application/pdf' }));
  const approved = await call('/api/requests/REQ-2026-001', { id: 3, method: 'PATCH', body: fd }); assert.equal(approved.status, 200); assert.equal(state.requests[0].status, 'Approved');
  const url = await (await call(`/api/storage?bucket=requirements&path=${encodeURIComponent(state.requests[0].approved_file_path)}`, { id: 2 })).json(); assert.match(url.url, /qa-storage/);
  assert.equal(state.history.at(-1).changed_by, 3); assert.equal(state.emails.length, 2);
});
test('Happy path: Admin invite, acceptance, ID verification and Student notification', async () => {
  assert.equal((await call('/api/invite', { id: 4, method: 'POST', body: { email: 'new-staff@example.invalid', role: 'Staff' } })).status, 200);
  const invite = state.emails[0].html.match(/token=([^"\s]+)/)[1];
  assert.equal((await call('/api/accept-invite', { method: 'POST', body: { token: invite, firstName: 'Fake', lastName: 'Office', password } })).status, 200);
  assert.equal(state.users.at(-1).role, 'Staff');
  state.users[0].id_status = 'pending';
  assert.equal((await call('/api/students/1/verify', { id: 4, method: 'POST', body: { action: 'verify' } })).status, 200);
  assert.equal(state.users[0].id_status, 'verified'); assert.equal(state.history.at(-1).notification_user_id, 1);
});
test('Happy path: register, email verify, login; unverified ID remains gated', async () => {
  const body = { firstName: 'Fake', lastName: 'Student', dateOfBirth: '2000-01-01', email: 'new-student@example.invalid', studentId: '99-9999', program: 'QA Program', studentType: 'Enrolled', lastSchoolYear: '2026', password };
  assert.equal((await call('/api/register', { method: 'POST', body })).status, 200);
  assert.equal((await call('/api/login', { method: 'POST', body: { email: body.email, password } })).status, 403);
  const verification = state.emails[0].html.match(/token=([^"\s]+)/)[1];
  assert.equal((await call(`/api/verify?token=${verification}`)).status, 302);
  assert.equal((await call('/api/login', { method: 'POST', body: { email: body.email, password } })).status, 200);
  assert.equal((await call('/api/requests', { id: state.users.at(-1).user_id, method: 'POST', body: requestForm() })).status, 403);
});
test('Happy path: forgot and reset password with captured fake email', async () => {
  assert.equal((await call('/api/forgot-password', { method: 'POST', body: { email: state.users[0].email } })).status, 200);
  const token = state.emails[0].html.match(/token=([^"\s]+)/)[1];
  assert.equal((await call('/api/reset-password', { method: 'POST', body: { token, password: 'Different-fake-password1!' } })).status, 200);
  assert.equal((await call('/api/login', { method: 'POST', body: { email: state.users[0].email, password: 'Different-fake-password1!' } })).status, 200);
});
test('Happy path: Staff and Admin login and see the fake incoming queue', async () => {
  for (const id of [3,4]) {
    const result = await call('/api/login', { method: 'POST', body: { email: state.users[id-1].email, password } });
    assert.equal(result.status, 200); assert.equal((await result.json()).role, 'staff');
    const token = result.headers.get('set-cookie').match(/^session=([^;]+)/)[1];
    const queue = await (await call('/api/requests', { token })).json();
    assert.equal(queue[0].request_id, 'REQ-2026-001');
    const detail = await (await call('/api/requests/REQ-2026-001', { id })).json();
    assert.equal(detail.requirements[0].name, 'QA ID');
  }
});
test('Guard: wrong password returns 401 without session', async () => { const r = await call('/api/login', { method: 'POST', body: { email: state.users[0].email, password: 'wrong' } }); assert.equal(r.status, 401); assert.equal(r.headers.get('set-cookie'), null); });
test('Guard: unauthenticated API access returns 401', async () => assert.equal((await call('/api/requests')).status, 401));
test('Guard: expired genuine session returns 401', async () => assert.equal((await call('/api/requests', { token: tokenFor(1, -10) })).status, 401));
test('Guard: Student office layout redirects before data query', async () => {
  await assert.rejects(() => loadSource('src/routes/staff/+layout.server.ts').load({ cookies: { get: () => tokenFor(1) } }), (e) => e.status === 302 && e.location === '/student/dashboard'); assert.equal(state.queries.length, 1);
});
test('Guard: Staff cannot invite or verify identity', async () => { assert.equal((await call('/api/invite', { id: 3, method: 'POST', body: { email: 'fake@example.invalid', role: 'Admin' } })).status, 403); assert.equal((await call('/api/students/1/verify', { id: 3, method: 'POST', body: { action: 'verify' } })).status, 403); });
test('Guard: Student cannot resubmit another student request', async () => assert.equal((await call('/api/requests/REQ-2026-001/requirements', { id: 1, method: 'PATCH', body: requestForm() })).status, 403));
test('Guard: zero, repeated or more than five document selections rejected', async () => { for (const ids of [[], [1,1], [1,2,3,4,5,6]]) assert.equal((await call('/api/requests', { id: 1, method: 'POST', body: requestForm({ ids }) })).status, 400); });
test('Guard: storage outage does not persist a request', async () => { state.failUpload = true; assert.equal((await call('/api/requests', { id: 1, method: 'POST', body: requestForm() })).status, 502); assert.equal(state.requests.length, 1); });
test('Guard: failed final upload preserves Pending', async () => { state.failUpload = true; const fd = new FormData(); fd.set('action', 'approve'); fd.set('approved_file', new File(['%PDF-1.4 fake'], 'fake.pdf', { type: 'application/pdf' })); assert.equal((await call('/api/requests/REQ-2026-001', { id: 3, method: 'PATCH', body: fd })).status, 502); assert.equal(state.requests[0].status, 'Pending'); });
test('Guard: status email outage is surfaced after successful status change', async () => { state.failEmail = true; const r = await call('/api/requests/REQ-2026-001', { id: 3, method: 'PATCH', body: { action: 'reject', admin_message: 'Fake reason' } }); assert.equal(r.status, 200); assert.match((await r.json()).email_warning, /failed/); assert.equal(state.requests[0].status, 'Rejected'); });

// Desired-behavior regressions: failures below deliberately remain red until approved fixes.
test('C01: Student decisions return 403; Staff/Admin decisions remain allowed', async () => {
  for (const id of [1, 2]) {
    for (const action of ['approve', 'reject', 'correction']) {
      for (const multipart of [false, true]) {
        const fd = new FormData(); fd.set('action', action);
        const response = await call('/api/requests/REQ-2026-001', { id, method: 'PATCH', body: multipart ? fd : { action } });
        assert.equal(response.status, 403, `Student ${id} ${action}, multipart=${multipart}`);
      }
    }
  }
  assert.ok(state.queries.every((q) => q.sql.startsWith('SELECT auth_version')), 'Denied decisions may only validate sessions');
  assert.equal(state.requests[0].status, 'Pending');
  assert.equal(state.history.length, 0);
  assert.equal(state.emails.length, 0);
  assert.equal(state.files.size, 1);
  for (const id of [3, 4]) {
    for (const action of ['approve', 'reject', 'correction']) {
      reset();
      const fd = new FormData(); fd.set('action', action); fd.set('admin_message', 'QA decision remark');
      if (action === 'approve') fd.set('approved_file', new File(['%PDF-1.4\nQA final'], 'qa-final.pdf', { type: 'application/pdf' }));
      const response = await call('/api/requests/REQ-2026-001', { id, method: 'PATCH', body: fd });
      assert.equal(response.status, 200, `Office user ${id} ${action}`);
      assert.equal(state.history.at(-1).changed_by, id);
    }
  }
});
test('C02: Student detail ownership enforced; owner and Staff/Admin retain access', async () => {
  const denied = await call('/api/requests/REQ-2026-001', { id: 1 });
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: 'Forbidden' }, 'Denied response must not expose request data');
  assert.equal(state.queries.length, 2, 'Denied reads must not load request items, requirements or history');
  assert.equal(state.requests[0].status, 'Pending');
  assert.equal(state.history.length, 0);
  assert.equal(state.emails.length, 0);
  for (const id of [2, 3, 4]) {
    const response = await call('/api/requests/REQ-2026-001', { id });
    assert.equal(response.status, 200, `Owner/office user ${id} can read detail`);
    const detail = await response.json();
    assert.equal(detail.request_id, 'REQ-2026-001');
    assert.equal(detail.requirements[0].name, 'QA ID');
    assert.equal(detail.items[0].name, 'QA Certificate');
    assert.deepEqual(detail.history, []);
  }
  assert.equal((await call('/api/requests/REQ-2026-999', { id: 2 })).status, 404);
  assert.equal((await call('/api/requests/REQ-2026-001')).status, 401);
  assert.equal((await call('/api/requests/REQ-2026-001', { token: tokenFor(2, -10) })).status, 401);
});
test('C03: file signing enforces ownership, release status and catalogued buckets', async () => {
  state.requests[0].approved_file_path = 'REQ-2026-001/final.pdf';
  state.requests[0].status = 'Approved';
  state.documents[0].template_path = 'qa-template.pdf';
  const storage = (id, bucket, path) => call(`/api/storage?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`, { id });
  for (const path of ['fake-student-2/id.pdf', 'REQ-2026-001/final.pdf']) {
    const denied = await storage(1, 'requirements', path);
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { error: 'Forbidden' });
  }
  for (const id of [1, 2, 3, 4]) {
    assert.equal((await storage(id, 'private', 'secret.pdf')).status, 403);
    assert.equal((await storage(id, 'requirements', 'unregistered.pdf')).status, 403);
    assert.equal((await storage(id, 'templates', 'unregistered.pdf')).status, 403);
  }
  assert.equal((await storage(2, 'requirements', 'FAKE-STUDENT-2/ID.PDF')).status, 403);
  assert.equal(state.signedFiles.length, 0, 'Denied requests must never invoke the signer');
  for (const id of [2, 3, 4]) {
    for (const path of ['fake-student-2/id.pdf', 'REQ-2026-001/final.pdf']) {
      const allowed = await storage(id, 'requirements', path);
      assert.equal(allowed.status, 200, `Owner/office ${id} can sign ${path}`);
      assert.match((await allowed.json()).url, /qa-storage/);
    }
  }
  for (const id of [1, 2, 3, 4]) assert.equal((await storage(id, 'templates', 'qa-template.pdf')).status, 200);
  for (const status of ['Pending', 'Rejected', 'Correction Requested']) {
    state.requests[0].status = status;
    const signedBefore = state.signedFiles.length;
    assert.equal((await storage(2, 'requirements', 'REQ-2026-001/final.pdf')).status, 403);
    assert.equal(state.signedFiles.length, signedBefore);
    assert.equal((await storage(3, 'requirements', 'REQ-2026-001/final.pdf')).status, 200);
    assert.equal((await storage(2, 'requirements', 'fake-student-2/id.pdf')).status, 200);
  }
  assert.equal((await call('/api/storage?bucket=requirements&path=fake-student-2/id.pdf')).status, 401);
  assert.equal((await call('/api/storage?bucket=requirements&path=fake-student-2/id.pdf', { token: tokenFor(2, -10) })).status, 401);
  assert.equal((await call('/api/storage?bucket=requirements', { id: 2 })).status, 400);
});
test('C04: non-session and invalid-identity tokens rejected across all protected APIs and portal guards', async () => {
  const payloads = [
    { email: 'fake@example.invalid' },
    { email: 'fake@example.invalid', purpose: 'email-verification' },
    { email: 'fake@example.invalid', purpose: 'reset' },
    { email: 'fake@example.invalid', role: 'Staff', purpose: 'staff-invite' },
    { email: 'fake@example.invalid', role: 'Admin', purpose: 'staff-invite' },
    { email: 'fake@example.invalid', role: 'Admin', purpose: 'session' },
    { email: 'fake@example.invalid', role: 'Admin', purpose: 'session', userId: '4' },
    { email: 'fake@example.invalid', role: 'Admin', purpose: 'session', userId: 0 },
    { email: 'fake@example.invalid', role: 'Root', purpose: 'session', userId: 4 },
    { role: 'Admin', purpose: 'session', userId: 4 },
    { email: state.users[3].email, role: 'Admin', userId: 4 },
    { email: state.users[3].email, role: 'Admin', userId: 4, purpose: 'staff-invite' }
  ];
  const tokens = payloads.map((payload) => jwt.signJwt(payload, secret, 3600));
  tokens.push(jwt.signJwt({ email: state.users[3].email, role: 'Admin', userId: 4, purpose: 'session' }, secret, NaN));
  const publicPaths = new Set(['/api/login', '/api/logout', '/api/register', '/api/verify', '/api/forgot-password', '/api/reset-password', '/api/accept-invite']);
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'qa/docuflow/inventory.json'), 'utf8'));
  const protectedMethods = inventory.endpoints.flatMap(({ route, methods }) => publicPaths.has(route) ? [] : methods.filter((method) => !(route === '/api/documents' && method === 'GET')).map((method) => ({ route, method })));
  for (const token of tokens) {
    for (const { route, method } of protectedMethods) {
      const url = route.replace('[id]', route.includes('/students/') || route.includes('/forms/') ? '1' : 'REQ-2026-001');
      const response = await call(url, { token, method, ...(method === 'GET' ? {} : { body: {} }) });
      assert.equal(response.status, 401, `${method} ${route} must reject non-session/invalid claims`);
    }
    for (const portal of ['student', 'staff']) {
      await assert.rejects(() => loadSource(`src/routes/${portal}/+layout.server.ts`).load({ cookies: { get: () => token } }), (e) => e.status === 302 && e.location === '/login');
    }
  }
  assert.equal(state.queries.length, 0, 'Invalid sessions must be rejected before database access');
  assert.equal(state.emails.length, 0);
  assert.equal(state.signedFiles.length, 0);
  // Token purpose is enforced on account verification too; existing verification
  // links are narrowly supported without accepting them as sessions.
  for (const token of [tokenFor(1), tokens[2], tokens[3], tokens[4]]) {
    const response = await call(`/api/verify?token=${encodeURIComponent(token)}`);
    assert.equal(response.status, 302);
    assert.match(response.headers.get('location'), /invalid_or_expired/);
  }
  assert.equal(state.queries.length, 0);
  for (const token of [tokens[0], tokens[1]]) {
    const response = await call(`/api/verify?token=${encodeURIComponent(token)}`);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/student/dashboard');
  }
});
test('H01: resubmission rejects final states, empty/incomplete uploads and status changes during upload', async () => {
  const resubmit = (body) => call('/api/requests/REQ-2026-001/requirements', { id: 2, method: 'PATCH', body });
  for (const status of ['Approved', 'Rejected']) {
    for (const withFile of [false, true]) {
      reset(); state.requests[0].status = status; state.requests[0].admin_message = 'Preserve decision';
      state.requests[0].approved_file_path = 'fake-final.pdf';
      const before = structuredClone(state.requests[0]); const requirements = structuredClone(state.requestRequirements);
      assert.equal((await resubmit(withFile ? requestForm() : new FormData())).status, 409);
      assert.deepEqual(state.requests[0], before); assert.deepEqual(state.requestRequirements, requirements);
      assert.equal(state.files.size, 1); assert.equal(state.history.length, 0); assert.equal(state.emails.length, 0);
    }
  }
  for (const status of ['Pending', 'Correction Requested']) {
    for (const kind of ['empty', 'zero-byte', 'unknown-file', 'text-field']) {
      reset(); state.requests[0].status = status; state.requests[0].admin_message = 'Keep remarks';
      const before = structuredClone(state.requests[0]); const fd = new FormData();
      if (kind === 'zero-byte') fd.set('file_QA ID', new File([], 'empty.pdf'));
      if (kind === 'unknown-file') fd.set('file_Unknown', new File(['fake'], 'unknown.pdf'));
      if (kind === 'text-field') fd.set('file_QA ID', 'not a file');
      assert.equal((await resubmit(fd)).status, 400, `${status}: ${kind}`);
      assert.deepEqual(state.requests[0], before); assert.equal(state.files.size, 1);
    }
  }
  reset(); state.requests[0].status = 'Correction Requested'; state.requestRequirements[0].needs_correction = true;
  state.requirements.push({ requirement_id: 2, name: 'QA Clearance', description: 'Fake only' });
  state.requestRequirements.push({ ...state.requestRequirements[0], requirement_id: 2 });
  assert.equal((await resubmit(requestForm())).status, 400, 'Every flagged digital requirement must have a corrected file');
  assert.equal(state.requests[0].status, 'Correction Requested'); assert.equal(state.files.size, 1);
  for (const status of ['Pending', 'Correction Requested']) {
    reset(); state.requests[0].status = status; state.requestRequirements[0].needs_correction = true;
    assert.equal((await resubmit(requestForm())).status, 200);
    assert.equal(state.requests[0].status, 'Pending'); assert.equal(state.requestRequirements[0].needs_correction, 0);
  }
  for (const status of ['Approved', 'Rejected']) {
    reset(); const beforeRequirements = structuredClone(state.requestRequirements);
    state.afterUpload = () => { state.requests[0].status = status; state.requests[0].admin_message = 'Office decided during upload'; };
    assert.equal((await resubmit(requestForm())).status, 409);
    assert.equal(state.requests[0].status, status);
    assert.equal(state.requests[0].admin_message, 'Office decided during upload');
    assert.deepEqual(state.requestRequirements, beforeRequirements);
  }
});
test('H02: required requirement file must be enforced by server', async () => assert.equal((await call('/api/requests', { id: 1, method: 'POST', body: requestForm({ upload: false }) })).status, 400));
test('H02: executable requirement upload rejected by server', async () => assert.equal((await call('/api/requests', { id: 1, method: 'POST', body: requestForm({ type: 'application/x-msdownload', name: 'fake.exe' }) })).status, 400));
test('H02: requirement over 10 MiB rejected with 400 or 413', async () => assert.ok([400,413].includes((await call('/api/requests', { id: 1, method: 'POST', body: requestForm({ size: 11 * 1024 * 1024 }) })).status)));
test('H02: upload validation protects creation, resubmission, final documents and templates before storage', async () => {
  const invalidFiles = [
    new File(['MZ harmless fixture'], 'fake.exe', { type: 'application/x-msdownload' }),
    new File(['MZ harmless fixture'], 'fake.pdf', { type: 'application/pdf' }),
    new File(['%PDF-1.4'], 'fake.pdf', { type: 'image/png' }),
    new File([Buffer.alloc(10 * 1024 * 1024 + 1)], 'fake.pdf', { type: 'application/pdf' })
  ];
  for (const file of invalidFiles) for (const flow of ['create', 'resubmit', 'final', 'template', 'replace-template']) {
    reset();
    const fd = requestForm(); fd.set('file_QA ID', file);
    let route = '/api/requests', id = 1, method = 'POST';
    if (flow === 'resubmit') { route += '/REQ-2026-001/requirements'; id = 2; method = 'PATCH'; }
    if (flow === 'final') { route += '/REQ-2026-001'; id = 3; method = 'PATCH'; fd.set('action', 'approve'); fd.set('approved_file', file); }
    if (flow.includes('template')) { route = '/api/documents'; id = 3; fd.set('name', 'QA template'); fd.set('template', file); fd.set('document_id', '1'); if (flow === 'replace-template') method = 'PATCH'; }
    assert.equal((await call(route, { id, method, body: fd })).status, file.size > 10 * 1024 * 1024 ? 413 : 400, flow);
    assert.equal(state.files.size, 1); assert.equal(state.requests.length, 1); assert.equal(state.requests[0].status, 'Pending');
    assert.equal(state.history.length, 0); assert.equal(state.emails.length, 0);
  }
  reset();
  const valid = requestForm({ size: 10 * 1024 * 1024 });
  assert.equal((await call('/api/requests', { id: 1, method: 'POST', body: valid })).status, 200);
  reset(); state.documentRequirements[0].in_person = 1;
  assert.equal((await call('/api/requests', { id: 1, method: 'POST', body: requestForm({ upload: false }) })).status, 200);
  for (const resubmit of [false, true]) {
    reset();
    state.requirements.push({ requirement_id: 2, name: 'QA Clearance', description: 'Fake clearance' });
    if (resubmit) state.requestRequirements.push({ ...state.requestRequirements[0], requirement_id: 2 });
    else state.documentRequirements.push({ document_id: 1, requirement_id: 2, in_person: 0, sort_order: 1 });
    const fd = requestForm();
    fd.set('file_QA Clearance', new File(['%PDF-1.4 QA clearance'], 'clearance.pdf', { type: 'application/pdf' }));
    state.afterUpload = () => { state.failUpload = true; };
    assert.equal((await call(resubmit ? '/api/requests/REQ-2026-001/requirements' : '/api/requests', { id: resubmit ? 2 : 1, method: resubmit ? 'PATCH' : 'POST', body: fd })).status, 502);
    assert.equal(state.files.size, 1, 'Failed batches must remove newly uploaded files');
    assert.equal(state.requests.length, 1); assert.equal(state.requests[0].status, 'Pending');
  }
});
test('H03: approval requires a nonempty final deliverable and terminal requests reject decisions', async () => {
  for (const id of [3, 4]) {
    for (const invalid of [null, '', new File([], 'empty.pdf')]) {
      reset();
      const fd = new FormData(); fd.set('action', 'approve');
      if (invalid !== null) fd.set('approved_file', invalid);
      assert.equal((await call('/api/requests/REQ-2026-001', { id, method: 'PATCH', body: fd })).status, 400);
      assert.equal(state.requests[0].status, 'Pending');
      assert.equal(state.files.size, 1); assert.equal(state.history.length, 0); assert.equal(state.emails.length, 0);
    }
    reset();
    assert.equal((await call('/api/requests/REQ-2026-001', { id, method: 'PATCH', body: { action: 'approve' } })).status, 400);
    for (const status of ['Approved', 'Rejected']) {
      for (const action of ['approve', 'reject', 'correction']) {
        reset(); state.requests[0].status = status;
        const fd = new FormData(); fd.set('action', action); fd.set('admin_message', 'QA reason');
        fd.set('approved_file', new File(['QA final'], 'final.pdf', { type: 'application/pdf' }));
        assert.equal((await call('/api/requests/REQ-2026-001', { id, method: 'PATCH', body: fd })).status, 409);
        assert.equal(state.requests[0].status, status); assert.equal(state.files.size, 1);
        assert.equal(state.history.length, 0); assert.equal(state.emails.length, 0);
      }
    }
  }
});
test('H03: rejection and correction require text remarks in JSON and multipart', async () => {
  for (const id of [3, 4]) for (const action of ['reject', 'correction']) {
    for (const message of [undefined, '', '   ', 42, {}]) {
      reset();
      assert.equal((await call('/api/requests/REQ-2026-001', { id, method: 'PATCH', body: { action, admin_message: message, flagged_requirements: ['QA ID'] } })).status, 400);
      assert.equal(state.requests[0].status, 'Pending'); assert.equal(state.history.length, 0); assert.equal(state.emails.length, 0);
      assert.ok(!state.requestRequirements[0].needs_correction);
    }
    for (const message of ['', '   ']) {
      reset(); const fd = new FormData(); fd.set('action', action); fd.set('admin_message', message);
      assert.equal((await call('/api/requests/REQ-2026-001', { id, method: 'PATCH', body: fd })).status, 400);
      assert.equal(state.requests[0].status, 'Pending'); assert.equal(state.history.length, 0);
    }
    reset();
    assert.equal((await call('/api/requests/REQ-2026-001', { id, method: 'PATCH', body: { action, admin_message: '  QA reason  ' } })).status, 200);
    assert.equal(state.requests[0].admin_message, 'QA reason');
  }
});
test('H04: notification read endpoint must not let Student hide office request', async () => assert.equal((await call('/api/notifications/read', { id: 1, method: 'POST', body: { type: 'request', ids: ['REQ-2026-001'] } })).status, 403));
test('H04: notification reads enforce roles, ownership and all-or-nothing mixed batches', async () => {
  const seed = () => {
    reset(); state.history = [
      { history_id: 1, request_id: 'REQ-2026-001', student_read: false, is_read: false },
      { history_id: 2, request_id: null, notification_user_id: 1, student_read: false, is_read: false },
      { history_id: 3, request_id: null, notification_user_id: 2, student_read: false, is_read: false },
      { history_id: 4, request_id: null, notification_user_id: 4, student_read: false, is_read: false }
    ];
  };
  const read = (id, type, ids) => call('/api/notifications/read', { id, method: 'POST', body: { type, ids } });
  for (const id of [1, 2]) for (const type of ['request', 'history']) {
    seed(); assert.equal((await read(id, type, type === 'request' ? ['REQ-2026-001'] : [1])).status, 403);
    assert.ok(state.history.every((h) => !h.student_read && !h.is_read)); assert.ok(!state.requests[0].staff_viewed);
  }
  for (const [id, ids] of [[1, [1]], [1, [2, 3]], [2, [1, 2]], [2, [1, 999]]]) {
    seed(); assert.equal((await read(id, 'student-history', ids)).status, 403);
    assert.ok(state.history.every((h) => !h.student_read && !h.is_read));
  }
  for (const [id, ids] of [[1, [2, 2]], [2, [1, 3]]]) {
    seed(); assert.equal((await read(id, 'student-history', ids)).status, 200);
    for (const h of state.history) { assert.equal(h.student_read, ids.includes(h.history_id)); assert.equal(h.is_read, false); }
  }
  for (const id of [3, 4]) {
    seed(); assert.equal((await read(id, 'student-history', [1])).status, 403);
    assert.equal((await read(id, 'history', [1, 2])).status, 403);
    assert.ok(state.history.every((h) => !h.is_read));
    assert.equal((await read(id, 'history', [1, 4])).status, 200);
    assert.equal(state.history[0].is_read, true); assert.equal(state.history[3].is_read, true);
    assert.equal(state.history[0].student_read, false);
    assert.equal((await read(id, 'request', ['REQ-2026-001', 'missing'])).status, 403);
    assert.ok(!state.requests[0].staff_viewed);
    assert.equal((await read(id, 'request', ['REQ-2026-001'])).status, 200);
    assert.equal(state.requests[0].staff_viewed, true);
  }
  for (const [type, ids] of [['unknown', [1]], ['history', ['1']], ['history', [0]], ['history', [-1]], ['history', [1.5]], ['request', [1]], ['request', ['']], ['history', Array(501).fill(1)]]) {
    seed(); assert.equal((await read(3, type, ids)).status, 400);
    assert.ok(state.history.every((h) => !h.is_read));
  }
  seed(); assert.equal((await read(1, 'student-history', [])).status, 200);
  assert.equal((await call('/api/notifications/read', { method: 'POST', body: { type: 'history', ids: [1] } })).status, 401);
});
test('H05: initial load and API refresh preserve and render submitted/corrected requirements', async () => {
  const load = loadSource('src/routes/student/documents/+page.server.ts').load;
  const loaded = () => load({ cookies: { get: () => tokenFor(2) } });
  const assertVisible = (data, action) => {
    const html = renderPage('src/routes/student/documents/+page.svelte', { data });
    assert.match(html, /QA ID/, 'Real student page must render the requirement name');
    assert.match(html, />View</, 'Submitted requirement must have a View action');
    assert.ok(html.includes(action), `Real student page must expose ${action}`);
  };
  const initial = await loaded();
  assert.ok(Array.isArray(initial.requests[0].requirements));
  assert.equal(initial.requests[0].requirements[0].file_name, 'fake.pdf');
  assertVisible(initial, 'Update Files');
  const initialList = await (await call('/api/requests', { id: 2 })).json();
  assert.deepEqual(initialList[0].requirements, initial.requests[0].requirements);
  assertVisible({ requests: initialList }, 'Update Files');
  assert.equal((await call('/api/requests/REQ-2026-001', { id: 3, method: 'PATCH', body: { action: 'correction', admin_message: 'Correct fake ID', flagged_requirements: ['QA ID'] } })).status, 200);
  const corrected = await loaded();
  assert.equal(corrected.requests[0].requirements[0].needs_correction, true);
  assertVisible(corrected, 'Resubmit');
  const fd = new FormData(); fd.set('file_QA ID', new File(['%PDF-1.4 fake corrected'], 'corrected.pdf', { type: 'application/pdf' }));
  assert.equal((await call('/api/requests/REQ-2026-001/requirements', { id: 2, method: 'PATCH', body: fd })).status, 200);
  const refreshed = await (await call('/api/requests', { id: 2 })).json();
  const reloaded = await loaded();
  assert.deepEqual(refreshed[0].requirements, reloaded.requests[0].requirements);
  assert.equal(refreshed[0].requirements[0].file_name, 'corrected.pdf');
  assert.equal(refreshed[0].requirements[0].needs_correction, false);
  assertVisible({ requests: refreshed }, 'Update Files');
  state.requestRequirements = [];
  const empty = await (await call('/api/requests', { id: 2 })).json();
  assert.deepEqual(empty[0].requirements, []);
  assert.doesNotThrow(() => renderPage('src/routes/student/documents/+page.svelte', { data: { requests: empty } }));
});
test('H06: password reset link is single use', async () => { const token = jwt.signJwt({ email: state.users[0].email, purpose: 'reset', authVersion: state.users[0].auth_version }, secret, 3600); const r = () => call('/api/reset-password', { method: 'POST', body: { token, password: 'Another-fake-password!' } }); assert.equal((await r()).status, 200); assert.ok([400,401,409].includes((await r()).status)); });
test('H07: status update and audit history remain atomic on database failure', async () => { state.failHistory = true; assert.equal((await call('/api/requests/REQ-2026-001', { id: 3, method: 'PATCH', body: { action: 'reject', admin_message: 'Fake reason' } })).status, 500); assert.equal(state.requests[0].status, 'Pending'); });
test('H07: corrected resubmission records its Pending transition for notifications', async () => { state.requests[0].status = 'Correction Requested'; assert.equal((await call('/api/requests/REQ-2026-001/requirements', { id: 2, method: 'PATCH', body: requestForm() })).status, 200); assert.ok(state.history.some((h) => h.request_id === 'REQ-2026-001' && h.new_status === 'Pending' && h.changed_by === 2)); });
test('H06: resetting password invalidates earlier sessions', async () => { const oldSession = tokenFor(1); const token = jwt.signJwt({ email: state.users[0].email, purpose: 'reset', authVersion: state.users[0].auth_version }, secret, 3600); assert.equal((await call('/api/reset-password', { method: 'POST', body: { token, password: 'Another-fake-password!' } })).status, 200); assert.equal((await call('/api/requests', { token: oldSession })).status, 401); });
test('H06: concurrent same-password resets consume one version; revocation covers APIs and account changes', async () => {
  for (const id of [1, 3, 4]) {
    reset(); const oldSession = tokenFor(id); const email = state.users[id - 1].email;
    await call('/api/forgot-password', { method: 'POST', body: { email } });
    const token = state.emails.at(-1).html.match(/token=([^"\s]+)/)[1];
    const results = await Promise.all([1, 2].map(() => call('/api/reset-password', { method: 'POST', body: { token, password } })));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    assert.equal(state.users[id - 1].auth_version, 1);
    const inventory = JSON.parse(fs.readFileSync(path.join(root, 'qa/docuflow/inventory.json'), 'utf8'));
    const publicPaths = new Set(['/api/login', '/api/logout', '/api/register', '/api/verify', '/api/forgot-password', '/api/reset-password', '/api/accept-invite']);
    for (const { route, methods } of inventory.endpoints) {
      if (publicPaths.has(route)) continue;
      for (const method of methods) {
        if (route === '/api/documents' && method === 'GET') continue;
        const url = route.replace('[id]', route.includes('/students/') || route.includes('/forms/') ? '1' : 'REQ-2026-001');
        assert.equal((await call(url, { token: oldSession, method, ...(method === 'GET' ? {} : { body: {} }) })).status, 401, `${method} ${route}`);
      }
    }
    for (const portal of ['student', 'staff']) await assert.rejects(() => loadSource(`src/routes/${portal}/+layout.server.ts`).load({ cookies: { get: () => oldSession } }), (e) => e.status === 302 && e.location === '/login');
    assert.equal((await call('/api/login', { method: 'POST', body: { email, password } })).status, 200);
    assert.equal((await call('/api/requests', { id })).status, 200);
  }
  reset(); const oldSession = tokenFor(1);
  assert.equal((await call('/api/profile', { token: oldSession, method: 'PATCH', body: { type: 'password', currentPassword: password, newPassword: password } })).status, 200);
  assert.equal((await call('/api/requests', { token: oldSession })).status, 401);
  for (const change of ['role', 'email', 'unverified', 'deleted']) {
    reset(); const token = tokenFor(4);
    if (change === 'role') state.users[3].role = 'Staff';
    if (change === 'email') state.users[3].email = 'changed@example.invalid';
    if (change === 'unverified') state.users[3].verified = false;
    if (change === 'deleted') state.users.pop();
    assert.equal((await call('/api/requests', { token })).status, 401, change);
  }
});
test('M01: retrying identical submission does not create two requests', async () => { for (let i=0; i<2; i++) await call('/api/requests', { id: 1, method: 'POST', body: requestForm() }); assert.equal(state.requests.filter((r) => r.student_id === 1).length, 1); });
test('M02: noncatalog purpose rejected', async () => assert.equal((await call('/api/requests', { id: 1, method: 'POST', body: requestForm({ purpose: '   ' }) })).status, 400));
test('M03: signup API enforces password minimum', async () => assert.equal((await call('/api/register', { method: 'POST', body: { firstName: 'Fake', lastName: 'Student', dateOfBirth: '2000-01-01', email: 'weak@example.invalid', studentId: '99-9998', program: 'QA Program', studentType: 'Enrolled', lastSchoolYear: '2026', password: 'x' } })).status, 400));
test('M04: every seeded local form preview exists', () => { const schema = fs.readFileSync(path.join(root, 'database/db.sql'), 'utf8'); const files = [...schema.matchAll(/'(\/forms\/[^']+)'/g)].map((m) => m[1]); assert.ok(files.length); assert.deepEqual(files.filter((p) => !fs.existsSync(path.join(root, 'static', p))), []); });
