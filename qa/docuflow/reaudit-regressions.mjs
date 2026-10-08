// Fake-only regression probes; source checks are not browser execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { reset, state, tokenFor, password, startHarness, root } from './harness.mjs';
const server = await startHarness();
const call = (url, id, body, method = 'POST') => fetch(server.base + url, {
  method, headers: { cookie: `session=${tokenFor(id)}`, ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }) },
  ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {})
});
try {
  reset();
  const fd = new FormData(); fd.set('documentIds', '[1]'); fd.set('purpose', 'Employment'); fd.set('requirements', '[]');
  fd.set('file_QA ID', new File(['GIF89a fake image fixture'], 'qa.gif', { type: 'image/gif' }));
  const response = await call('/api/requests', 1, fd);
  assert.equal(response.status, 400);
  for (const file of ['src/routes/student/request/+page.svelte', 'src/routes/student/documents/+page.svelte']) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /accept="[^"]*image\/\*/);
  }
  console.log('R01 Medium CONFIRMED: Student picker advertises image/*, but a GIF requirement receives HTTP 400. Source + isolated HTTP; browser untested.');
  reset(); const token = tokenFor(1);
  const changed = await fetch(server.base + '/api/profile', { method: 'PATCH', headers: { cookie: `session=${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'password', currentPassword: password, newPassword: password }) });
  assert.equal(changed.status, 200);
  assert.equal(changed.headers.get('set-cookie'), null);
  assert.equal((await fetch(server.base + '/api/profile', { headers: { cookie: `session=${token}` } })).status, 401);
  for (const file of ['src/routes/student/profile/+page.svelte', 'src/routes/staff/profile/+page.svelte']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /passwordSuccess = true/);
    assert.doesNotMatch(source, /goto\(|location\.(?:href|assign|replace)/);
  }
  console.log('R02 Medium CONFIRMED: Profile password change returns success with no replacement/cleared cookie; next API request is 401, while client only closes the modal. Source + isolated HTTP; browser untested.');
  reset(); state.failEmail = true;
  const signup = await fetch(server.base + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ firstName: 'Fake', lastName: 'Reaudit', dateOfBirth: '2000-01-01', email: 'reaudit@example.invalid', studentId: '99-9911', program: 'QA Program', studentType: 'Enrolled', lastSchoolYear: '2026', password }) });
  assert.equal(signup.status, 502); assert.ok(state.users.some((u) => u.email === 'reaudit@example.invalid' && !u.verified));
  console.log('H12 STILL FAILING: Injected verification-email failure returns 502 after persisting an unverified fake account.');
} finally { await server.close(); }
