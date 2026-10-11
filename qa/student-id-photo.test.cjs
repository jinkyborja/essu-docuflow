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

// Fake MySQL/Storage only: these tests never write to a live service.
function load(filename, imports = {}, sourceOverride) {
	const module = { exports: {} };
	const source = sourceOverride ?? fs.readFileSync(filename, 'utf8');
	const code = filename.endsWith('.svelte') ? compile(source, { filename, generate: 'server' }).js.code : source;
	const kit = { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers }) };
	const resolver = name => {
		if (Object.hasOwn(imports, name)) {
			const value = imports[name];
			return value && Object.hasOwn(value, 'default') ? { __esModule: true, ...value } : value;
		}
		if (name === '@sveltejs/kit') return kit;
		if (name.startsWith('$lib/')) {
			const target = name.replace('$lib/', 'src/lib/');
			return load(target.endsWith('.svelte') ? target : target + '.ts', imports);
		}
		if (name.startsWith('.')) {
			const target = path.resolve(path.dirname(filename), name);
			return load(path.extname(target) ? target : target + '.ts', imports);
		}
		return require(name);
	};
	vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
		{ module, exports: module.exports, require: resolver, Date, Intl, URL, URLSearchParams, File, Blob, FormData, Buffer, setTimeout, clearTimeout, console: { error() {} } });
	return module.exports;
}

const sessionImports = {
	'$lib/server/jwt': { verifySession: async role => { if (role === 'invalid') throw new Error('Invalid session'); return { userId: 7, role }; } },
	'$env/static/private': { JWT_SECRET: 'photo-test-secret' }
};
const cookies = role => ({ get: () => role });
const png = Buffer.from('89504e470d0a1a0a0000000000000000', 'hex');
const photoPath = '7/11111111-1111-4111-8111-111111111111.png';
const oldPath = '7/22222222-2222-4222-8222-222222222222.jpg';
const limits = load('src/lib/student-id-photo.ts');

function fixture(options = {}) {
	const state = { queries: [], storage: [], currentPath: options.previousPath === undefined ? oldPath : options.previousPath, currentStatus: options.status ?? 'pending', transaction: false, released: false, committed: false, rolledBack: false, pending: null };
	const conn = {
		beginTransaction: async () => { state.transaction = true; },
		commit: async () => { state.transaction = false; state.committed = true; if (state.pending) { state.currentPath = state.pending[0]; state.currentStatus = 'pending'; } },
		rollback: async () => { state.transaction = false; state.rolledBack = true; state.pending = null; },
		release: () => { state.released = true; },
		execute: async (sql, args) => {
			state.queries.push({ sql, args, connection: true });
			if (sql.startsWith('SELECT')) return [[{ id_status: options.lockedStatus ?? state.currentStatus, id_photo_path: options.lockedPath ?? state.currentPath }]];
			if (options.failUpdate) throw new Error('Fake database failure');
			state.pending = args;
			return [{ affectedRows: 1 }];
		}
	};
	const pool = {
		getConnection: async () => conn,
		execute: async (sql, args) => {
			assert.equal(state.transaction, false, 'Pool queried inside transaction');
			state.queries.push({ sql, args, connection: false });
			return [[{ id_status: state.currentStatus, id_photo_path: state.currentPath }]];
		}
	};
	const storage = {
		createSignedUploadUrl: async (path, settings) => { state.storage.push({ action: 'prepare', path, settings }); return options.failPrepare ? { data: null, error: 'Fake failure' } : { data: { signedUrl: 'https://storage.invalid/upload?token=fake' }, error: null }; },
		download: async path => { assert.equal(state.transaction, false); state.storage.push({ action: 'download', path }); return { data: options.blob ?? new Blob([png], { type: 'image/png' }), error: options.failDownload ? 'Fake failure' : null }; },
		remove: async paths => { assert.equal(state.transaction, false, 'Storage call inside transaction'); state.storage.push({ action: 'remove', paths, released: state.released, committed: state.committed }); return { error: options.failCleanup ? 'Fake failure' : null }; },
		createSignedUrl: async (path, ttl) => { state.storage.push({ action: 'sign', path, ttl }); return { data: { signedUrl: 'https://storage.invalid/read?token=fake' }, error: options.failSign ? 'Fake failure' : null }; }
	};
	const supabase = { storage: { from: bucket => { assert.equal(bucket, 'student-ids'); return storage; } } };
	const imports = { ...sessionImports, '$lib/server/db': { default: pool }, '$lib/server/supabase': { supabase }, './supabase': { supabase } };
	const endpoint = load('src/routes/api/profile/id-photo/+server.ts', imports);
	const helper = load('src/lib/server/student-id-photo.ts', imports);
	const token = (userId = 7, path = photoPath, type = 'image/png', size = png.length) => helper.createStudentIdPhotoUploadToken(userId, path, type, size);
	const post = (body, role = 'Student') => endpoint.POST({ cookies: cookies(role), request: { json: async () => body } });
	return { state, imports, helper, token, post, get: role => endpoint.GET({ cookies: cookies(role), url: new URL('http://localhost/api/profile/id-photo?userId=99&path=99/private.png') }) };
}

test('Photo metadata accepts images up to 5 MB and rejects extensions, MIME mismatches and malformed sizes', () => {
	for (const [name, type] of [['id.jpg', 'image/jpeg'], ['ID.JPEG', 'image/jpeg'], ['id.png', 'image/png'], ['id.webp', 'image/webp']]) {
		assert.equal(limits.validateStudentIdPhotoMetadata(name, type, 5 * 1024 * 1024), null);
	}
	for (const [name, type, size] of [['id.pdf', 'application/pdf', 10], ['jpg', 'image/jpeg', 10], ['id.jpg', 'image/png', 10], ['id.png', 'application/octet-stream', 10], ['id.webp', 'image/webp', 0], ['id.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1], ['id.jpg', 'image/jpeg', '100'], ['id.jpg', 'image/jpeg', 1.5]]) assert.ok(limits.validateStudentIdPhotoMetadata(name, type, size));
	assert.ok(limits.validateStudentIdPhoto(null));
});

test('Only unverified students may prepare uploads; server generates an owner UUID path without overwriting', async () => {
	const data = { action: 'prepare', name: '../../ID.PNG', contentType: 'image/png', size: 5 * 1024 * 1024, userId: 99 };
	const f = fixture();
	const response = await f.post(data);
	assert.equal(response.status, 200);
	assert.match(f.state.storage[0].path, /^7\/[a-f0-9-]{36}\.png$/);
	assert.equal(f.state.storage[0].settings.upsert, false);
	assert.equal(f.state.queries[0].args[0], 7);
	assert.equal(f.helper.readStudentIdPhotoUploadToken(response.body.uploadToken, 7).size, 5 * 1024 * 1024);
	assert.equal(response.headers['Cache-Control'], 'private, no-store');
	for (const role of ['Admin', 'Staff', 'Unknown', null, 'invalid']) {
		const denied = fixture(); assert.ok((await denied.post(data, role)).status >= 400); assert.equal(denied.state.storage.length, 0); assert.equal(denied.state.queries.length, 0);
	}
	assert.equal((await fixture({ status: 'verified' }).post(data)).status, 409);
	const oversized = fixture(); assert.equal((await oversized.post({ ...data, size: 5 * 1024 * 1024 + 1 })).status, 413); assert.equal(oversized.state.queries.length, 0);
	assert.equal((await fixture({ failPrepare: true }).post(data)).status, 502);
});

test('Completion rejects another owner, tampered or expired tokens before storage and database access', async () => {
	const f = fixture();
	const valid = f.token();
	const payload = Buffer.from(JSON.stringify({ userId: 7, path: photoPath, contentType: 'image/png', size: png.length, expiresAt: Date.now() - 1 })).toString('base64url');
	const expired = payload + '.' + createHmac('sha256', 'photo-test-secret').update('student-id-photo:' + payload).digest('base64url');
	for (const token of [null, '', valid + 'tampered', f.token(8, photoPath.replace('7/', '8/')), expired]) assert.equal((await f.post({ action: 'complete', uploadToken: token })).status, 400);
	assert.equal(f.state.storage.length, 0); assert.equal(f.state.queries.length, 0);
});

test('Pending and rejected re-uploads save the owner path and timestamp, then delete the previous file after release', async () => {
	for (const status of ['pending', 'rejected']) {
		const f = fixture({ status });
		const response = await f.post({ action: 'complete', uploadToken: f.token() });
		assert.equal(response.status, 200); assert.equal(response.body.id_status, 'pending'); assert.ok(response.body.id_photo_uploaded_at);
		const update = f.state.queries.find(q => q.sql.startsWith('UPDATE'));
		assert.match(update.sql, /id_photo_uploaded_at = \?, id_status = 'pending'/);
		assert.equal(update.args[0], photoPath); assert.equal(update.args[2], 7); assert.equal(update.connection, true);
		const removal = f.state.storage.find(s => s.action === 'remove');
		assert.equal(removal.paths[0], oldPath); assert.equal(removal.committed, true); assert.equal(removal.released, true);
		assert.equal(f.state.currentPath, photoPath); assert.equal(f.state.released, true);
	}
});

test('Stored file validation rejects MIME, actual size, metadata and content mismatches without replacing the old photo', async () => {
	for (const options of [
		{ blob: new Blob([png], { type: 'image/jpeg' }) },
		{ blob: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' }) },
		{ blob: new Blob([png, 'extra'], { type: 'image/png' }) },
		{ blob: new Blob([Buffer.alloc(png.length)], { type: 'image/png' }) }
	]) {
		const f = fixture(options); const response = await f.post({ action: 'complete', uploadToken: f.token() });
		assert.ok(response.status >= 400); assert.equal(f.state.currentPath, oldPath); assert.equal(f.state.committed, false);
		assert.equal(f.state.queries.filter(q => q.sql.startsWith('UPDATE')).length, 0);
		assert.equal(f.state.storage.find(s => s.action === 'remove').paths[0], photoPath);
	}
	const f = fixture({ failDownload: true }); assert.equal((await f.post({ action: 'complete', uploadToken: f.token() })).status, 502); assert.equal(f.state.currentPath, oldPath);
});

test('A full 5 MB stored image passes; status races and database failures cannot reset verification or remove the old photo', async () => {
	const full = new Blob([png, new Uint8Array(5 * 1024 * 1024 - png.length)], { type: 'image/png' });
	const maximum = fixture({ blob: full }); assert.equal((await maximum.post({ action: 'complete', uploadToken: maximum.token(7, photoPath, 'image/png', full.size) })).status, 200);
	const raced = fixture({ lockedStatus: 'verified' }); assert.equal((await raced.post({ action: 'complete', uploadToken: raced.token() })).status, 409);
	assert.equal(raced.state.rolledBack, true); assert.equal(raced.state.released, true); assert.equal(raced.state.currentPath, oldPath);
	assert.equal(raced.state.storage.find(s => s.action === 'remove').paths[0], photoPath);
	const failed = fixture({ failUpdate: true }); assert.equal((await failed.post({ action: 'complete', uploadToken: failed.token() })).status, 500);
	assert.equal(failed.state.rolledBack, true); assert.equal(failed.state.released, true); assert.equal(failed.state.currentPath, oldPath); assert.equal(failed.state.storage.filter(s => s.action === 'remove').length, 0);
	const cleanup = fixture({ failCleanup: true }); const response = await cleanup.post({ action: 'complete', uploadToken: cleanup.token() }); assert.equal(response.status, 200); assert.match(response.body.warning, /previous photo/); assert.equal(cleanup.state.committed, true);
});

test('Completed upload retries preserve the current photo and any subsequent verification decision', async () => {
	for (const options of [{ previousPath: photoPath, status: 'verified' }, { lockedPath: photoPath, lockedStatus: 'verified' }]) {
		const f = fixture(options); const response = await f.post({ action: 'complete', uploadToken: f.token() });
		assert.equal(response.status, 200); assert.equal(response.body.id_status, 'verified'); assert.equal(f.state.committed, false); assert.equal(f.state.storage.filter(s => s.action === 'remove').length, 0);
	}
});

test('Student previews sign only the session owner’s photo for 60 seconds and disable caching', async () => {
	const f = fixture(); const response = await f.get('Student');
	assert.equal(response.status, 200); assert.equal(response.body.expiresIn, 60); assert.equal(response.headers['Cache-Control'], 'private, no-store');
	assert.equal(f.state.queries[0].args[0], 7); assert.equal(f.state.storage[0].path, oldPath); assert.equal(f.state.storage[0].ttl, 60); assert.equal(response.body.id_photo_path, undefined);
	for (const role of ['Admin', 'Staff', null]) assert.ok((await fixture().get(role)).status >= 400);
	assert.equal((await fixture({ previousPath: null }).get('Student')).status, 404);
	assert.equal((await fixture({ failSign: true }).get('Student')).status, 502);
});

test('Admin review signs a private photo, staff never receive its URL, and comparison values stay intact', async () => {
	for (const role of ['Admin', 'Staff', 'Student']) {
		const f = fixture(); const student = { user_id: 8, student_id: '26-0001', first_name: 'Juan', middle_name: null, last_name: 'Cruz', program: 'QA', id_photo_path: '8/33333333-3333-4333-8333-333333333333.png' };
		const pool = { execute: async sql => [sql.includes('enrollment_masterlist') ? [{ ...student, id: 1 }] : [student]] };
		const endpoint = load('src/routes/api/students/[id]/+server.ts', { ...f.imports, '$lib/server/db': { default: pool } });
		const response = await endpoint.GET({ cookies: cookies(role), params: { id: '8' } });
		if (role === 'Student') { assert.equal(response.status, 403); continue; }
		assert.equal(response.body.id_photo_path, undefined); assert.equal(response.body.has_id_photo, true);
		assert.equal(response.body.masterlistMatch.name, 'match'); assert.equal(response.body.masterlistMatch.program, 'match');
		assert.equal(response.body.id_photo_url !== null, role === 'Admin'); assert.equal(f.state.storage.length, role === 'Admin' ? 1 : 0);
		if (role === 'Admin') assert.equal(f.state.storage[0].ttl, 60);
	}
});

test('Review database failures return a useful JSON error without exposing database details', async () => {
	for (const failMasterlist of [false, true]) {
		const f = fixture();
		const pool = { execute: async sql => {
			if (!failMasterlist || sql.includes('enrollment_masterlist')) {
				throw Object.assign(new Error("Unknown column 'u.id_photo_path' in 'field list'"), { code: 'ER_BAD_FIELD_ERROR' });
			}
			return [[{ user_id: 8, student_id: '26-0001', id_photo_path: oldPath }]];
		} };
		const endpoint = load('src/routes/api/students/[id]/+server.ts', { ...f.imports, '$lib/server/db': { default: pool } });
		const response = await endpoint.GET({ cookies: cookies('Admin'), params: { id: '8' } });
		assert.equal(response.status, 500);
		assert.equal(response.body.error, 'Could not load student review. Please try again.');
		assert.doesNotMatch(JSON.stringify(response.body), /Unknown column|id_photo_path|ER_BAD_FIELD_ERROR/);
		assert.equal(response.headers['Cache-Control'], 'private, no-store');
		assert.equal(f.state.storage.length, 0);
	}
});

test('Existing students without a photo or masterlist entry still load successfully', async () => {
	const f = fixture();
	const pool = { execute: async (sql, args) => {
		if (sql.includes('enrollment_masterlist')) { assert.equal(args[0], null); return [[]]; }
		return [[{ user_id: 8, student_id: null, first_name: 'Juan', last_name: 'Cruz', id_photo_path: null, id_photo_uploaded_at: null }]];
	} };
	const endpoint = load('src/routes/api/students/[id]/+server.ts', { ...f.imports, '$lib/server/db': { default: pool } });
	const response = await endpoint.GET({ cookies: cookies('Admin'), params: { id: '8' } });
	assert.equal(response.status, 200);
	assert.equal(response.body.has_id_photo, false);
	assert.equal(response.body.id_photo_url, null);
	assert.equal(response.body.id_photo_uploaded_at, null);
	assert.equal(response.body.masterlistMatch.found, false);
	assert.equal(f.state.storage.length, 0);
});

test('Admin verification rejects missing photos even with a masterlist override; rejection and existing verification remain usable', async () => {
	for (const [action, idStatus, expected] of [['verify', 'pending', 400], ['reject', 'pending', 200], ['revoke', 'verified', 200]]) {
		const writes = []; let rolledBack = false, released = false;
		const conn = { beginTransaction: async () => {}, commit: async () => {}, rollback: async () => { rolledBack = true; }, release: () => { released = true; }, execute: async (sql, args) => { if (sql.startsWith('SELECT')) return [[{ user_id: 8, student_id: '26-0001', id_status: idStatus, id_photo_path: null }]]; writes.push({ sql, args }); return [{}]; } };
		const endpoint = load('src/routes/api/students/[id]/verify/+server.ts', { ...sessionImports, '$lib/server/db': { default: { getConnection: async () => conn, execute: () => { throw new Error('Pool in transaction'); } } } });
		const response = await endpoint.POST({ cookies: cookies('Admin'), params: { id: '8' }, request: { json: async () => ({ action, confirm: true, reason: 'Incorrect ID', verifyAnyway: true, note: 'Paper check' }) } });
		assert.equal(response.status, expected); assert.equal(released, true); if (action === 'verify') { assert.equal(rolledBack, true); assert.equal(writes.length, 0); assert.match(response.body.error, /photo/); }
	}
});

function renderPage(filename, data, location, source) {
	const imports = { '$app/stores': { navigating: writable(null), page: writable({ url: new URL('http://localhost' + location), data }) }, '$app/navigation': { goto: async () => {}, invalidateAll: async () => {} }, '$app/environment': { browser: false }, '$lib/stores/notifications': { notifUnreadCount: writable(0), startNotifications: () => {} }, '$lib/stores/sidebar': { sidebarCollapsed: writable(false), sidebarMobileOpen: writable(false) } };
	return render(load(filename, imports, source).default, { props: { data, children: () => {} } }).body;
}

test('Dashboard/profile banners appear once for pending/rejected students; verified students have no upload controls', () => {
	for (const status of ['pending', 'rejected', 'verified']) {
		for (const location of ['/student/dashboard', '/student/profile']) {
			const html = renderPage('src/routes/student/+layout.svelte', { layoutUser: { name: 'Juan Cruz', initials: 'JC', idStatus: status }, notifCount: 0 }, location);
			assert.equal((html.match(/Your account is being reviewed by the Graduate School office\./g) ?? []).length, status === 'pending' ? 1 : 0);
			assert.equal((html.match(/Your ID could not be verified/g) ?? []).length, status === 'rejected' ? 1 : 0);
		}
		const html = renderPage('src/routes/student/profile/+page.svelte', { profile: { first_name: 'Juan', middle_name: null, last_name: 'Cruz', id_status: status, has_id_photo: false } }, '/student/profile');
		assert.equal(html.includes('aria-label="School ID photo (front)"'), status !== 'verified'); assert.doesNotMatch(html, /<img/);
	}
});

test('Admin review displays the photo beside details and disables Verify when no photo was uploaded', () => {
	const filename = 'src/routes/staff/students/+page.svelte';
	const source = fs.readFileSync(filename, 'utf8').replace('let reviewStudent = $state<Student | null>(null);', 'let reviewStudent = $state<Student | null>(data.students[0] as Student);');
	for (const hasPhoto of [false, true]) {
		const student = { user_id: 8, first_name: 'Juan', last_name: 'Cruz', email: 'fake@example.invalid', student_id: '26-0001', program: 'QA', id_status: 'pending', has_id_photo: hasPhoto, id_photo_url: hasPhoto ? 'https://storage.invalid/read?token=fake' : null, masterlistMatch: { found: true, name: 'match', program: 'match', campus: 'missing', values: {} } };
		const html = renderPage(filename, { allowed: true, role: 'Admin', students: [student] }, '/staff/students', source);
		const verifyButton = (html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []).find(button => button.includes('Verify student'));
		assert.ok(verifyButton, 'Verify action is present');
		assert.equal(/\sdisabled(?:[ >]|=)/.test(verifyButton), !hasPhoto);
		if (hasPhoto) assert.match(html, /<img[^>]*src="https:\/\/storage.invalid\/read\?token=fake"/);
		else assert.match(html, /No ID photo uploaded/);
	}
});

test('A failed review load offers a retry and does not claim the student has no photo', () => {
	const filename = 'src/routes/staff/students/+page.svelte';
	const source = fs.readFileSync(filename, 'utf8')
		.replace('let reviewStudent = $state<Student | null>(null);', 'let reviewStudent = $state<Student | null>(data.students[0] as Student);')
		.replace("let reviewError = $state('');", "let reviewError = $state('Could not load student review. Please try again.');");
	const student = { user_id: 8, first_name: 'Juan', last_name: 'Cruz', email: 'fake@example.invalid', student_id: '26-0001', program: 'QA', id_status: 'pending' };
	const html = renderPage(filename, { allowed: true, role: 'Admin', students: [student] }, '/staff/students', source);
	assert.match(html, /ID photo details could not be loaded/);
	assert.match(html, /Try again/);
	assert.doesNotMatch(html, /No ID photo uploaded|>Verify student<|>Reject</);
});
