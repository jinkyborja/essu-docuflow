const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createHmac } = require('node:crypto');
const { compile } = require('svelte/compiler');
const { render } = require('svelte/server');
const { writable } = require('svelte/store');

// These tests use fake database, storage and email services only.
function load(filename, imports = {}, sourceOverride, globals = {}) {
	const module = { exports: {} };
	const source = sourceOverride ?? fs.readFileSync(filename, 'utf8');
	const code = filename.endsWith('.svelte') ? compile(source, { filename, generate: 'server' }).js.code : source;
	const resolver = name => {
		if (Object.hasOwn(imports, name)) { const value = imports[name]; return value && Object.hasOwn(value, 'default') ? { __esModule: true, ...value } : value; }
		if (name === '@sveltejs/kit') return { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers }) };
		if (name.startsWith('$lib/')) { const target = name.replace('$lib/', 'src/lib/'); return load(path.extname(target) ? target : target + '.ts', imports); }
		if (name.startsWith('.')) { const target = path.resolve(path.dirname(filename), name); return load(path.extname(target) ? target : target + '.ts', imports); }
		return require(name);
	};
	vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
		{ module, exports: module.exports, require: resolver, Date, Intl, File, Blob, FormData, Buffer, URL, URLSearchParams, setTimeout, clearTimeout, console: { error() {} }, ...globals });
	return module.exports;
}
const secret = 'signup-test-secret';
const photoPath = 'signup/11111111-1111-4111-8111-111111111111.png';
const png = Buffer.from('89504e470d0a1a0a0000000000000000', 'hex');
const photo = new File([png], 'school-id.png', { type: 'image/png' });
const body = { firstName: 'Juan', middleName: 'Santos', lastName: 'Cruz', dateOfBirth: '2000-01-01', email: 'qa@example.invalid', studentId: '26-0001', program: 'Master of IT', campus: 'Guiuan', studentType: 'Enrolled', lastSchoolYear: load('src/lib/school-year.ts').SCHOOL_YEAR_MAX, password: 'fake-password' };
const helpers = load('src/lib/server/signup-id-photo.ts', { '$env/static/private': { JWT_SECRET: secret } });

function fixture(options = {}) {
	const state = { queries: [], storage: [], emails: [], held: false, committed: false, rolledBack: false, released: false, student: null };
	const execute = async (sql, args, connection) => {
		state.queries.push({ sql, args, connection });
		if (sql.includes('INSERT INTO users')) {
			if (options.duplicateRace) throw Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' });
			if (options.failInsert) throw new Error('Fake database failure');
			state.student = { user_id: 8, first_name: args[0], middle_name: args[1], last_name: args[2], student_id: args[7], program: args[8], campus: args[11], id_photo_path: args[12], id_photo_uploaded_at: args[13], id_status: 'pending' };
			return [{ insertId: 8 }];
		}
		if (sql.includes('request_status_history') && options.failNotice) throw new Error('Fake notification failure');
		if (sql.includes('enrollment_masterlist')) return [[{ ...state.student, id: 1, campus: options.masterlistCampus ?? 'Guiuan' }]];
		if (sql.includes('u.user_id')) return [[state.student]];
		if (sql.includes("role = 'Admin'")) return [[{ user_id: 9 }]];
		return [options.duplicate ? [{ user_id: 7 }] : []];
	};
	const conn = { beginTransaction: async () => {}, commit: async () => { state.committed = true; }, rollback: async () => { state.rolledBack = true; state.student = null; }, release: () => { state.held = false; state.released = true; }, execute: (sql, args) => execute(sql, args, true) };
	const pool = { execute: (sql, args) => { assert.equal(state.held, false, 'No pool calls while holding its only connection'); return execute(sql, args, false); }, getConnection: async () => { state.held = true; return conn; } };
	const storage = {
		createSignedUploadUrl: async (path, settings) => { state.storage.push({ action: 'prepare', path, settings }); return { data: options.failPrepare ? null : { signedUrl: 'https://storage.invalid/upload' }, error: options.failPrepare ? 'Fake failure' : null }; },
		download: async path => { assert.equal(state.held, false); state.storage.push({ action: 'download', path }); return { data: options.storedPhoto ?? photo, error: options.failDownload ? 'Fake failure' : null }; },
		createSignedUrl: async (path, ttl) => { state.storage.push({ action: 'sign', path, ttl }); return { data: { signedUrl: 'https://storage.invalid/read' }, error: null }; }
	};
	const supabase = { storage: { from: bucket => { assert.equal(bucket, 'student-ids'); return storage; } } };
	const imports = { '$lib/server/db': { default: pool }, '$lib/server/supabase': { supabase }, './supabase': { supabase }, '$lib/server/jwt': { signJwt: () => 'fake-email-token', verifySession: async role => ({ userId: 9, role }) }, '$env/static/private': { JWT_SECRET: secret }, '$lib/server/email': { sendEmail: async email => { assert.equal(state.released, true); assert.equal(state.committed, true); state.emails.push(email); if (options.failEmail) throw new Error('Fake email failure'); } } };
	const endpoint = load('src/routes/api/register/+server.ts', imports);
	const prepare = load('src/routes/api/register/id-photo/+server.ts', imports);
	const token = helpers.createSignupIdPhotoUploadToken(body.email, body.studentId, photoPath, photo.type, photo.size);
	const run = (patch = {}) => endpoint.POST({ request: { url: 'http://localhost/api/register', json: async () => ({ ...body, idPhotoUploadToken: token, ...patch }) } });
	return { state, imports, token, run, prepare: (patch = {}) => prepare.POST({ request: { json: async () => ({ email: body.email, studentId: body.studentId, name: photo.name, contentType: photo.type, size: photo.size, ...patch }) } }) };
}

test('Signup prepares a private upload bound to the email and Student ID, up to 5 MB, without overwriting', async () => {
	const f = fixture(); const response = await f.prepare({ email: ' QA@EXAMPLE.INVALID ', size: 5 * 1024 * 1024 });
	assert.equal(response.status, 200); assert.equal(response.headers['Cache-Control'], 'private, no-store');
	const prepared = f.state.storage[0];
	assert.match(prepared.path, /^signup\/[a-f0-9-]{36}\.png$/); assert.equal(prepared.settings.upsert, false);
	const upload = helpers.readSignupIdPhotoUploadToken(response.body.uploadToken, body.email, body.studentId);
	assert.equal(upload.path, prepared.path); assert.equal(upload.size, 5 * 1024 * 1024);
	assert.equal(f.state.queries.some(query => query.sql.startsWith('INSERT')), false);
});

test('Invalid identities/metadata and duplicate accounts cannot prepare signup uploads', async () => {
	for (const patch of [{ email: 'bad' }, { studentId: '26' }, { name: 'id.pdf', contentType: 'application/pdf' }, { size: 0 }, { size: 5 * 1024 * 1024 + 1 }]) {
		const f = fixture(); assert.ok((await f.prepare(patch)).status >= 400); assert.equal(f.state.storage.length, 0); assert.equal(f.state.queries.length, 0);
	}
	const duplicate = fixture({ duplicate: true }); assert.equal((await duplicate.prepare()).status, 409); assert.equal(duplicate.state.storage.length, 0);
	assert.equal((await fixture({ failPrepare: true }).prepare()).status, 502);
});

test('Registration rejects missing campus/photos, arbitrary paths, tampered, expired and other-owner photo tokens', async () => {
	const payload = Buffer.from(JSON.stringify({ email: body.email, studentId: body.studentId, path: photoPath, contentType: photo.type, size: photo.size, expiresAt: Date.now() - 1 })).toString('base64url');
	const expired = payload + '.' + createHmac('sha256', secret).update('signup-id-photo:' + payload).digest('base64url');
	for (const patch of [{ campus: undefined }, { campus: 'Unknown' }, { idPhotoUploadToken: undefined }, { idPhotoUploadToken: 'fake' }, { idPhotoUploadToken: expired }, { idPhotoUploadToken: helpers.createSignupIdPhotoUploadToken('other@example.invalid', body.studentId, photoPath, photo.type, photo.size) }, { idPhotoUploadToken: helpers.createSignupIdPhotoUploadToken(body.email, '26-0002', photoPath, photo.type, photo.size) }, { idPhotoUploadToken: helpers.createSignupIdPhotoUploadToken(body.email, body.studentId, '7/private.png', photo.type, photo.size) }]) {
		const f = fixture(); assert.equal((await f.run(patch)).status, 400); assert.equal(f.state.queries.length, 0); assert.equal(f.state.storage.length, 0); assert.equal(f.state.emails.length, 0);
	}
});

test('Signup validates stored MIME, size and image contents before creating any account', async () => {
	for (const options of [{ failDownload: true }, { storedPhoto: new Blob([png], { type: 'image/jpeg' }) }, { storedPhoto: new Blob([png, 'extra'], { type: 'image/png' }) }, { storedPhoto: new Blob([Buffer.alloc(png.length)], { type: 'image/png' }) }, { storedPhoto: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' }) }]) {
		const f = fixture(options); assert.ok((await f.run()).status >= 400); assert.equal(f.state.committed, false); assert.equal(f.state.student, null); assert.equal(f.state.held, false); assert.equal(f.state.emails.length, 0);
	}
});

test('Signup saves the selected campus/photo/timestamp and pending status atomically, then sends the email', async () => {
	const f = fixture(); const response = await f.run({ id_status: 'verified', verified: true, id_photo_path: '7/private.png' });
	assert.equal(response.status, 200); assert.equal(f.state.committed, true); assert.equal(f.state.released, true);
	assert.equal(f.state.student.campus, 'Guiuan'); assert.equal(f.state.student.id_photo_path, photoPath); assert.ok(f.state.student.id_photo_uploaded_at instanceof Date);
	assert.match(f.state.queries.find(query => query.sql.startsWith('INSERT INTO users')).sql, /FALSE, 'pending'/);
	assert.ok(f.state.queries.filter(query => query.sql.startsWith('INSERT')).every(query => query.connection));
	assert.equal(f.state.emails.length, 1);
});

test('Registration rollback and duplicate races leave no account or notices and send no email', async () => {
	for (const options of [{ failInsert: true }, { failNotice: true }, { duplicateRace: true }]) {
		const f = fixture(options); const response = await f.run();
		assert.equal(response.status, options.duplicateRace ? 409 : 500); assert.equal(f.state.committed, false); assert.equal(f.state.rolledBack, true); assert.equal(f.state.released, true); assert.equal(f.state.student, null); assert.equal(f.state.emails.length, 0);
	}
	const duplicate = fixture({ duplicate: true }); assert.equal((await duplicate.run()).status, 409); assert.equal(duplicate.state.storage.length, 0);
});

test('Email failure reports that the account and photo were already saved', async () => {
	const f = fixture({ failEmail: true }); const response = await f.run();
	assert.equal(response.status, 502); assert.equal(response.body.accountCreated, true); assert.equal(f.state.committed, true); assert.equal(f.state.student.id_photo_path, photoPath); assert.match(response.body.error, /Graduate School office/);
});

test('A signup campus and photo appear in admin review; campus matches and mismatches reflect account data', async () => {
	for (const masterlistCampus of ['Guiuan', 'Borongan']) {
		const f = fixture({ masterlistCampus }); assert.equal((await f.run()).status, 200);
		const endpoint = load('src/routes/api/students/[id]/+server.ts', f.imports);
		const response = await endpoint.GET({ cookies: { get: () => 'Admin' }, params: { id: '8' } });
		assert.equal(response.status, 200); assert.equal(response.body.campus, 'Guiuan'); assert.equal(response.body.masterlistMatch.campus, masterlistCampus === 'Guiuan' ? 'match' : 'mismatch');
		assert.equal(response.body.has_id_photo, true); assert.equal(response.body.id_photo_url, 'https://storage.invalid/read'); assert.equal(response.body.id_photo_path, undefined);
	}
});

function signupClient(options = {}) {
	const source = fs.readFileSync('src/routes/login/+page.svelte', 'utf8').match(/<script lang="ts">([\s\S]*?)<\/script>/)[1];
	const calls = []; let registrationAttempts = 0;
	const fetch = async (url, init) => {
		calls.push({ url, init });
		if (url === '/api/register/id-photo') return { ok: !options.failPrepare, json: async () => options.failPrepare ? { error: 'Prepare failed' } : { uploadUrl: 'https://storage.invalid/upload', uploadToken: 'fake-upload-token', expiresIn: 600 } };
		if (url === 'https://storage.invalid/upload') { assert.ok(init.body instanceof FormData); return { ok: !options.failUpload }; }
		assert.equal(url, '/api/register'); registrationAttempts++;
		const failed = options.failFirstRegistration && registrationAttempts === 1;
		return { ok: !failed && !options.failEmail, json: async () => options.failEmail ? { accountCreated: true, error: 'Account saved; contact the office.' } : failed ? { error: 'Retry registration' } : { success: true } };
	};
	const client = load('signup-client.ts', { '$app/environment': { browser: true }, '$app/navigation': { goto: async () => {} }, '$lib/components/forms/Select.svelte': { default: () => {} } }, source + `
exports.set = values => { firstName = values.firstName; middleName = values.middleName; lastName = values.lastName; dateOfBirth = values.dateOfBirth; email = values.email; studentId = values.studentId; program = values.program; campus = values.campus; studentType = values.studentType; lastSchoolYear = String(values.lastSchoolYear); password = values.password; confirmPassword = values.password; idPhoto = values.photo; };
exports.submit = handleSignup;
exports.state = () => ({ mode, error, idPhotoError, loading });`, { $state: value => value, $effect: () => {}, fetch });
	client.set({ ...body, photo });
	return { calls, client, run: () => client.submit({ preventDefault() {} }) };
}

test('Signup client uploads directly to storage before creating the account and reuses a successful upload on retry', async () => {
	const f = signupClient({ failFirstRegistration: true }); await f.run(); await f.run();
	assert.deepEqual(f.calls.map(call => call.url), ['/api/register/id-photo', 'https://storage.invalid/upload', '/api/register', '/api/register']);
	const registered = JSON.parse(f.calls.at(-1).init.body); assert.equal(registered.campus, 'Guiuan'); assert.equal(registered.idPhotoUploadToken, 'fake-upload-token'); assert.equal(registered.photo, undefined);
	assert.equal(f.client.state().mode, 'check-email'); assert.equal(f.client.state().loading, false);
});

test('Signup client stops before account creation for invalid fields and failed uploads', async () => {
	for (const options of [{ failPrepare: true }, { failUpload: true }]) { const f = signupClient(options); await f.run(); assert.ok(f.calls.every(call => call.url !== '/api/register')); assert.equal(f.client.state().loading, false); }
	for (const patch of [{ campus: '' }, { photo: null }, { photo: new File(['text'], 'bad.txt', { type: 'text/plain' }) }]) {
		const f = signupClient(); f.client.set({ ...body, photo, ...patch }); await f.run(); assert.equal(f.calls.length, 0);
	}
	const email = signupClient({ failEmail: true }); await email.run(); assert.equal(email.client.state().mode, 'check-email'); assert.match(email.client.state().error, /contact the office/);
});

test('Signup renders labeled campus and required photo controls; uploaded pending students see review guidance', () => {
	const filename = 'src/routes/login/+page.svelte'; const source = fs.readFileSync(filename, 'utf8').replace("= $state('login');", "= $state('signup');");
	const account = render(load(filename, { '$app/environment': { browser: false }, '$app/navigation': { goto: async () => {} } }, source).default).body;
 assert.match(account,/Account/); assert.match(account,/id="signup-email"/); assert.doesNotMatch(account,/id="signup-campus"/);
 const details = render(load(filename, { '$app/environment': { browser: false }, '$app/navigation': { goto: async () => {} } }, source.replace(/signupStep\s*=\s*\$state\(1\)/,'signupStep=$state(2)')).default).body;
 assert.match(details,/id="signup-campus"/); assert.match(details,/id="signup-dob"/);
 const photo = render(load(filename, { '$app/environment': { browser: false }, '$app/navigation': { goto: async () => {} } }, source.replace(/signupStep\s*=\s*\$state\(1\)/,'signupStep=$state(3)')).default).body;
 assert.match(photo,/aria-label="School ID photo \(front\)"[^>]*required/); assert.match(photo,/up to 5 MB/); assert.match(photo,/Create account/);

	const data = { layoutUser: { name: 'Juan Cruz', initials: 'JC', idStatus: 'pending', hasIdPhoto: true }, notifCount: 0 };
	const layout = render(load('src/routes/student/+layout.svelte', { '$app/navigation': { goto: async () => {} }, '$app/stores': { page: writable({ url: new URL('http://localhost/student/dashboard'), data }) }, '$lib/stores/notifications': { notifUnreadCount: writable(0), startNotifications() {} }, '$lib/stores/sidebar': { sidebarCollapsed: writable(false), sidebarMobileOpen: writable(false) } }).default, { props: { data, children: () => {} } }).body;
	assert.match(layout, /Your account is being reviewed by the Graduate School office/); assert.doesNotMatch(layout, /Upload on My Profile/);
});
