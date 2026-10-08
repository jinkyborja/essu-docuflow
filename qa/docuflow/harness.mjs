// QA only: loads the unchanged application handlers with in-memory services.
// No .env is read; mysql2, Supabase and email never reach external services.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import ts from 'typescript';
import * as kit from '@sveltejs/kit';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

const require = createRequire(import.meta.url);
export const root = path.resolve(import.meta.dirname, '../..');
export const secret = 'isolated-docuflow-qa-secret-never-production';
export const password = 'Qa-Fake-Password-123!';
const hash = (p) => createHash('sha256').update(p).digest('hex');
export const state = {};
export function reset() {
  Object.assign(state, {
    users: ['Student', 'Student', 'Staff', 'Admin'].map((role, i) => ({
      user_id: i + 1, first_name: 'QA', last_name: role + (i + 1), middle_name: null,
      email: `${role.toLowerCase()}${i + 1}@example.invalid`, password_hash: hash(password),
      role, auth_version: 0, verified: true, id_status: 'verified', student_id: `99-000${i + 1}`,
      program: 'QA Program', position: 'QA Office', student_type: 'Enrolled', last_school_year: 2026
    })),
    requests: [{ request_id: 'REQ-2026-001', student_id: 2, status: 'Pending', purpose: 'Employment',
      approved_file_path: null, approved_file_name: null, admin_message: null, date_requested: '2026-10-08T00:00:00Z' }],
    items: [{ request_id: 'REQ-2026-001', document_id: 1 }],
    documents: [{ document_id: 1, name: 'QA Certificate' }, { document_id: 2, name: 'QA Transcript' }],
    requirements: [{ requirement_id: 1, name: 'QA ID', description: 'Fake ID only' }],
    documentRequirements: [{ document_id: 1, requirement_id: 1, in_person: false, sort_order: 0 }],
    requestRequirements: [{ request_id: 'REQ-2026-001', requirement_id: 1, in_person: false,
      file_path: 'fake-student-2/id.pdf', file_name: 'fake.pdf', submitted_at: null, needs_correction: false, sort_order: 0 }],
    history: [], emails: [], files: new Map([['requirements/fake-student-2/id.pdf', Buffer.from('fake')]]),
    queries: [], signedFiles: [], failUpload: false, failEmail: false, failHistory: false, afterUpload: null
  });
}
reset();

function joined(r) {
  const u = state.users.find((u) => u.user_id === r.student_id) ?? {};
  return { ...r, first_name: u.first_name, last_name: u.last_name, student_code: u.student_id,
    student_name: `${u.first_name} ${u.last_name}`, student_email: u.email, email: u.email,
    program: u.program, student_type: u.student_type };
}
function reqRows(ids) {
  return state.requestRequirements.filter((r) => ids.includes(r.request_id)).map((r) => ({
    ...r, ...state.requirements.find((q) => q.requirement_id === r.requirement_id)
  }));
}
async function execute(sql, args = []) {
  const q = sql.replace(/\s+/g, ' ').trim();
  state.queries.push({ sql: q, args });
  let rows;
  if (/^SELECT.*FROM users WHERE email = \?/.test(q)) rows = state.users.filter((u) => u.email === args[0]);
  else if (/^SELECT.*FROM users WHERE student_id = \?/.test(q)) rows = state.users.filter((u) => u.student_id === args[0]);
  else if (/^SELECT.*FROM users WHERE user_id = \?/.test(q)) rows = state.users.filter((u) => u.user_id === Number(args[0]) && (!q.includes("role = 'Student'") || u.role === 'Student') && (!q.includes('AND password_hash') || u.password_hash === args[1]));
  else if (/^SELECT.*FROM users WHERE role = 'Admin'/.test(q)) rows = state.users.filter((u) => u.role === 'Admin');
  else if (/^SELECT.*FROM users WHERE role = 'Student'/.test(q)) rows = state.users.filter((u) => u.role === 'Student');
  else if (/^INSERT INTO users/.test(q)) {
    const registration = q.includes('middle_name');
    const u = registration ? { first_name: args[0], middle_name: args[1], last_name: args[2], suffix: args[3], date_of_birth: args[4], email: args[5], password_hash: args[6], student_id: args[7], program: args[8], student_type: args[9], last_school_year: args[10], role: 'Student', verified: false, id_status: 'pending' }
      : { first_name: args[0], last_name: args[1], email: args[2], password_hash: args[3], role: args[4], position: args[5], verified: true };
    u.auth_version = 0; u.user_id = Math.max(...state.users.map((x) => x.user_id)) + 1; state.users.push(u); rows = { insertId: u.user_id };
  } else if (q.startsWith('UPDATE users SET verified')) { state.users.filter((u) => u.email === args[0]).forEach((u) => u.verified = true); rows = { affectedRows: 1 }; }
  else if (q.startsWith('UPDATE users SET password_hash')) { const migration = q.includes('AND password_hash'); const users = state.users.filter((u) => (q.includes('WHERE email') ? u.email === args[1] : u.user_id === args[1]) && (!migration || u.password_hash === args[2]) && (!q.includes('AND auth_version') || u.auth_version === args[migration ? 3 : 2])); users.forEach((u) => { u.password_hash = args[0]; if (q.includes('auth_version + 1')) u.auth_version++; }); rows = { affectedRows: users.length }; }
  else if (q.startsWith('UPDATE users SET id_status')) { const u = state.users.find((u) => u.user_id === Number(args[3])); Object.assign(u, { id_status: args[0], id_verified_by: args[1], id_reject_reason: args[2] }); rows = { affectedRows: 1 }; }
  else if (q.startsWith('SELECT document_id FROM documents WHERE BINARY template_path')) rows = state.documents.filter((d) => d.template_path === args[0]);
  else if (q.startsWith("SELECT r.student_id, r.status, 'requirement' AS file_kind")) {
    rows = state.requestRequirements.filter((rr) => rr.file_path === args[0]).flatMap((rr) => state.requests.filter((r) => r.request_id === rr.request_id).map((r) => ({ student_id: r.student_id, status: r.status, file_kind: 'requirement' })));
    rows.push(...state.requests.filter((r) => r.approved_file_path === args[1]).map((r) => ({ student_id: r.student_id, status: r.status, file_kind: 'final' })));
  }
  else if (q.startsWith('SELECT document_id FROM documents WHERE')) rows = state.documents.filter((d) => args.includes(d.document_id));
  else if (q.includes('FROM document_requirements')) rows = state.documentRequirements.filter((r) => args.includes(r.document_id)).map((r) => ({ ...r, ...state.requirements.find((v) => v.requirement_id === r.requirement_id) }));
  else if (q.includes('FROM request_items ri JOIN documents')) rows = state.items.filter((r) => args.includes(r.request_id)).map((r) => ({ ...r, ...state.documents.find((d) => d.document_id === r.document_id) }));
  else if (q.startsWith('SELECT rr.request_id')) rows = reqRows(args);
  else if (q.startsWith('SELECT file_path FROM request_requirements')) rows = reqRows(args).filter((r) => r.file_path);
  else if (q.startsWith('INSERT INTO requirements')) rows = { affectedRows: 1 };
  else if (q.startsWith('SELECT requirement_id, name FROM requirements')) rows = state.requirements.filter((r) => args.includes(r.name));
  else if (q.startsWith('DELETE FROM request_requirements')) { state.requestRequirements = state.requestRequirements.filter((r) => r.request_id !== args[0]); rows = { affectedRows: 1 }; }
  else if (q.startsWith('INSERT INTO request_requirements')) { state.requestRequirements.push({ request_id: args[0], requirement_id: args[1], in_person: args[2], file_path: args[3], file_name: args[4], submitted_at: args[5], needs_correction: args[6], sort_order: args[7] }); rows = { affectedRows: 1 }; }
  else if (q.startsWith('SELECT GET_LOCK')) rows = [{ acquired: 1 }];
  else if (q.startsWith('SELECT RELEASE_LOCK')) rows = [{ released: 1 }];
  else if (q.startsWith('SELECT COALESCE(MAX')) rows = [{ seq: Math.max(0, ...state.requests.map((r) => Number(r.request_id.split('-').at(-1)))) }];
  else if (q.startsWith('INSERT INTO requests')) { state.requests.push({ request_id: args[0], student_id: args[1], document_id: null, purpose: args[2], status: 'Pending', date_requested: new Date().toISOString(), approved_file_path: null }); rows = { affectedRows: 1 }; }
  else if (q.startsWith('INSERT INTO request_items')) { state.items.push({ request_id: args[0], document_id: args[1] }); rows = { affectedRows: 1 }; }
  else if (/^SELECT student_id(?:, status)? FROM requests/.test(q)) rows = state.requests.filter((r) => r.request_id === args[0]);
  else if (/^SELECT.* FROM requests r/.test(q)) {
    rows = state.requests;
    if (q.includes('WHERE r.request_id = ?')) rows = rows.filter((r) => r.request_id === args[0]);
    else if (q.includes('WHERE r.student_id = ?')) rows = rows.filter((r) => r.student_id === args[0]);
    rows = rows.map((r) => ({ ...joined(r), requirements: JSON.stringify(reqRows([r.request_id])) }));
  } else if (q.startsWith('UPDATE requests SET status')) {
    const r = state.requests.find((r) => r.request_id === args.at(-1));
    if (r) { r.status = args[0]; r.admin_message = q.includes('admin_message = NULL') ? null : args[1]; if (args.length > 3) { r.approved_file_path = args[2] ?? r.approved_file_path; r.approved_file_name = args[3] ?? r.approved_file_name; } }
    rows = { affectedRows: r ? 1 : 0 };
  } else if (q.startsWith('UPDATE request_requirements rr')) {
    state.requestRequirements.filter((r) => r.request_id === args.at(-1)).forEach((r) => r.needs_correction = args.slice(0, -1).includes(state.requirements.find((v) => v.requirement_id === r.requirement_id).name)); rows = { affectedRows: 1 };
  } else if (q.startsWith('INSERT INTO request_status_history')) {
    if (state.failHistory) throw new Error('Injected history database failure');
    const notice = q.includes('VALUES (NULL');
    state.history.push(notice ? { history_id: state.history.length + 1, request_id: null, new_status: args[0], changed_by: args[1], notification_user_id: args[2] } : { history_id: state.history.length + 1, request_id: args[0], old_status: args[1], new_status: args[2], changed_by: args[3], changed_at: new Date().toISOString() }); rows = { affectedRows: 1 };
  } else if (q.startsWith('SELECT request_id FROM requests WHERE request_id IN')) rows = state.requests.filter((r) => args.includes(r.request_id));
  else if (q.startsWith('SELECT h.history_id FROM request_status_history h')) {
    const student = q.includes('r.student_id = ?');
    const ids = student ? args.slice(0, -2) : args;
    rows = state.history.filter((h) => ids.includes(h.history_id) && (student
      ? state.requests.some((r) => r.request_id === h.request_id && r.student_id === args.at(-1)) || (h.request_id === null && h.notification_user_id === args.at(-1))
      : state.requests.some((r) => r.request_id === h.request_id) || (h.request_id === null && state.users.some((u) => u.user_id === h.notification_user_id && u.role === 'Admin'))));
  }
  else if (q.startsWith('UPDATE request_status_history h LEFT JOIN')) {
    const student = q.includes('h.student_read'); const ids = student ? args.slice(0, -2) : args;
    const allowed = state.history.filter((h) => ids.includes(h.history_id) && (student
      ? state.requests.some((r) => r.request_id === h.request_id && r.student_id === args.at(-1)) || (h.request_id === null && h.notification_user_id === args.at(-1))
      : state.requests.some((r) => r.request_id === h.request_id) || (h.request_id === null && state.users.some((u) => u.user_id === h.notification_user_id && u.role === 'Admin'))));
    allowed.forEach((h) => h[student ? 'student_read' : 'is_read'] = true); rows = { affectedRows: allowed.length };
  }
  else if (q.includes('FROM request_status_history h')) rows = state.history.filter((h) => h.request_id === args[0]);
  else if (q.startsWith('UPDATE requests SET staff_viewed')) { state.requests.filter((r) => args.includes(r.request_id)).forEach((r) => r.staff_viewed = true); rows = { affectedRows: 1 }; }
  else if (q.startsWith('UPDATE request_status_history SET')) { state.history.filter((h) => args.includes(h.history_id)).forEach((h) => h[q.includes('student_read') ? 'student_read' : 'is_read'] = true); rows = { affectedRows: 1 }; }
  else throw new Error(`Unimplemented QA fixture SQL: ${q}`);
  return [structuredClone(rows), []];
}
const pool = { execute, getConnection: async () => {
  let snapshot;
  return { execute, beginTransaction: async () => snapshot = structuredClone({ users: state.users, requests: state.requests, items: state.items, requestRequirements: state.requestRequirements, history: state.history }),
    commit: async () => {}, rollback: async () => snapshot && Object.assign(state, snapshot), release: () => {} };
} };
const supabase = { storage: { from: (bucket) => ({
  upload: async (p, bytes) => { if (state.failUpload) return { error: { message: 'Injected storage outage' } }; state.files.set(`${bucket}/${p}`, Buffer.from(bytes)); if (state.afterUpload) await state.afterUpload(); return { error: null }; },
  createSignedUrl: async (p) => { state.signedFiles.push({ bucket, path: p }); return { data: { signedUrl: `https://qa-storage.example.invalid/${bucket}/${p}?fake-signature=1` }, error: null }; },
  remove: async (paths) => { paths.forEach((p) => state.files.delete(`${bucket}/${p}`)); return { error: null }; }
}) } };
const cache = new Map();
export function loadSource(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const localRequire = (name) => {
    if (name === '@sveltejs/kit') return kit;
    if (name === '$env/static/private') return { JWT_SECRET: secret };
    if (name === '$env/dynamic/private') return { env: {} };
    if (name === '$lib/server/db' || (name === './db' && file.includes(`${path.sep}server${path.sep}`))) return { default: pool };
    if (name === '$lib/server/supabase') return { supabase };
    if (name === '$lib/server/email') return { sendEmail: async (email) => { if (state.failEmail) throw new Error('Injected email outage'); state.emails.push(email); } };
    if (name.startsWith('$lib/')) return loadSource(`src/lib/${name.slice(5)}.ts`);
    if (name.startsWith('.')) return loadSource(path.relative(root, path.resolve(path.dirname(file), `${name}.ts`)));
    return require(name);
  };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(localRequire, module, module.exports);
  return module.exports;
}
export const jwt = loadSource('src/lib/server/jwt.ts');
export const tokenFor = (id, expires = 3600) => { const u = state.users.find((u) => u.user_id === id); return jwt.signJwt({ userId: id, email: u.email, role: u.role, purpose: 'session', authVersion: u.auth_version }, secret, expires); };

// Render the actual student page and its real child components without a browser.
// This tests the server-rendered requirement markup, not client-side interaction.
function loadSvelte(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const compiled = compile(fs.readFileSync(file, 'utf8'), { filename: file, generate: 'server' });
  const js = ts.transpileModule(compiled.js.code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = (name) => name.startsWith('$lib/') && name.endsWith('.svelte') ? loadSvelte(`src/lib/${name.slice(5)}`) : require(name);
  new vm.Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(localRequire, module, module.exports);
  return module.exports;
}
export const renderPage = (relative, props) => render(loadSvelte(relative).default, { props }).body;

export async function startHarness() {
  const server = createServer(async (req, res) => {
    const outCookies = [];
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const segments = url.pathname.slice(1).split('/');
      let relative = `src/routes/${segments.join('/')}/+server.ts`;
      const params = {};
      if (segments[1] === 'requests' && segments[2]) { params.id = segments[2]; relative = `src/routes/api/requests/[id]/${segments[3] ? segments[3] + '/' : ''}+server.ts`; }
      if (segments[1] === 'forms' && segments[2] && segments[2] !== 'upload-url') { params.id = segments[2]; relative = 'src/routes/api/forms/[id]/+server.ts'; }
      if (segments[1] === 'students' && segments[3] === 'verify') { params.id = segments[2]; relative = 'src/routes/api/students/[id]/verify/+server.ts'; }
      if (!fs.existsSync(path.resolve(root, relative))) { res.writeHead(404); res.end(); return; }
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: Buffer.concat(chunks) } : {}) });
      const cookieMap = new Map((req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')));
      const cookies = { get: (k) => cookieMap.get(k), set: (k, v, opts) => outCookies.push(`${k}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${opts.maxAge}${opts.secure ? '; Secure' : ''}`), delete: (k) => outCookies.push(`${k}=; Path=/; Max-Age=0`) };
      const handler = loadSource(relative)[req.method];
      if (!handler) { res.writeHead(405); res.end(); return; }
      const result = await handler({ request, cookies, url, params });
      res.writeHead(result.status, { ...Object.fromEntries(result.headers), ...(outCookies.length ? { 'set-cookie': outCookies } : {}) });
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
      if (error.location) { res.writeHead(error.status, { location: error.location, ...(outCookies.length ? { 'set-cookie': outCookies } : {}) }); res.end(); }
      else { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }) };
}
