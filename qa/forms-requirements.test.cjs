const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createHmac, webcrypto } = require('node:crypto');
const { compile } = require('svelte/compiler');
const { render } = require('svelte/server');

// Load real code with fake database/storage dependencies. No live writes.
function load(filename, imports = {}, sourceOverride, globals = {}) {
	const module = { exports: {} };
	const source = sourceOverride ?? fs.readFileSync(filename, 'utf8');
	const code = filename.endsWith('.svelte') ? compile(source, { filename, generate: 'server' }).js.code : source;
	const resolver = name => {
		if (Object.hasOwn(imports, name)) { const value = imports[name]; return value && Object.hasOwn(value, 'default') ? { __esModule: true, ...value } : value; }
		if (name === '@sveltejs/kit') return { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) };
		if (name.startsWith('$lib/')) { const target = name.replace('$lib/', 'src/lib/'); return load(path.extname(target) ? target : target + '.ts', imports, undefined, globals); }
		if (name.startsWith('.')) { const target = path.resolve(path.dirname(filename), name); return load(path.extname(target) ? target : target + '.ts', imports, undefined, globals); }
		return require(name);
	};
	vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
		{ module, exports: module.exports, require: resolver, Error, Date, Intl, File, Blob, FormData, Buffer, URL, URLSearchParams, crypto: webcrypto, setTimeout, clearTimeout, console: { error() {} }, ...globals });
	return module.exports;
}
const cookies = role => ({ get: () => role });
const sessions = { '$lib/server/jwt': { verifySession: async role => ({ userId: 7, role }) }, '$env/static/private': { JWT_SECRET: 'requirement-test-secret' } };
const requestId = 'REQ-2026-001';
const catalog = [{ name: 'Clearance Form', description: 'Clearance', in_person: false, needs_correction: true, file_path: 'old.pdf', file_name: 'old.pdf', submitted_at: null }, { name: 'Valid ID', description: 'ID', in_person: false, needs_correction: false, file_path: 'old-id.png', file_name: 'old-id.png', submitted_at: null }];
const png = Buffer.from('89504e470d0a1a0a0000000000000000', 'hex');
const newPath = '7/requirements/11111111-1111-4111-8111-111111111111.png';

function uploadFixture(options = {}) {
	const state = { queries: [], storage: [], transaction: false, committed: false, rolledBack: false, released: false, saved: null };
	const execute = async (sql, args, connection = false) => {
		if (!connection) assert.equal(state.transaction, false, 'Pool queried in transaction');
		state.queries.push({ sql, args, connection });
		if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
		if (sql.includes(' AS seq ')) return [[{ seq: 0 }]];
		if (sql.startsWith('SELECT file_path')) return [options.used ? [{ file_path: newPath }] : []];
		if (sql.includes('SELECT id_status')) return [[{ id_status: options.idStatus ?? 'verified' }]];
		if (sql.includes('SELECT document_id')) return [[{ document_id: 1 }]];
		if (sql.includes('FROM document_requirements')) return [catalog];
		if (sql.includes('SELECT student_id, status')) return [[{ student_id: options.owner ?? 7, status: connection ? options.lockedStatus ?? options.status ?? 'pending' : options.status ?? 'pending' }]];
		return [{ affectedRows: 1 }];
	};
	const conn = { execute: (sql, args) => execute(sql, args, true), beginTransaction: async () => { state.transaction = true; }, commit: async () => { state.committed = true; state.transaction = false; }, rollback: async () => { state.rolledBack = true; state.transaction = false; }, release: () => { state.released = true; } };
	const pool = { execute: (sql, args) => execute(sql, args), getConnection: async () => conn };
	const storage = {
		createSignedUploadUrl: async (path, settings) => { state.storage.push({ action: 'prepare', path, settings }); return { data: { signedUrl: 'https://storage.invalid/upload?token=fake' }, error: null }; },
		download: async path => { assert.equal(state.transaction, false); state.storage.push({ action: 'download', path }); return { data: options.blob ?? new Blob([png], { type: 'image/png' }), error: null }; },
		upload: async (path, buffer) => { assert.equal(state.transaction, false); state.storage.push({ action: 'upload', path, size: buffer.length }); return { error: null }; },
		remove: async paths => { assert.equal(state.transaction, false); state.storage.push({ action: 'remove', paths }); return { error: null }; }
	};
	const supabase = { storage: { from: bucket => { assert.equal(bucket, 'requirements'); return storage; } } };
	const imports = { ...sessions, '$lib/server/db': { default: pool }, './db': { default: pool }, '$lib/server/supabase': { supabase }, './supabase': { supabase }, '$lib/server/requirements': {
		fetchOneRequestRequirements: async () => catalog.map(req => ({ ...req })),
		replaceRequestRequirements: async (connection, id, reqs) => { assert.equal(connection, conn); assert.equal(state.transaction, true); assert.equal(typeof id, 'string'); state.saved = reqs; },
		fetchRequestRequirements: async () => new Map(), fetchRequestFilePaths: async () => []
	}, '$lib/server/request-items': {}, '$lib/server/request-journey': {} };
	const helper = load('src/lib/server/requirement-uploads.ts', imports);
	const token = (context = { requestId, documentIds: [] }, userId = 7, size = png.length) => helper.requirementUploadToken({ requirementName: 'Clearance Form', name: 'signed.png', type: 'image/png', size, path: newPath, userId, context });
	return { state, imports, helper, token };
}

test('Document settings round-trip through existing saves and loaders, including clearing settings', async () => {
	let settings; const writes = [];
	const pool = { execute: async sql => {
		if (sql.includes('FROM form_files')) return [[{ form_id: 4, page_no: 1, storage_path: 'form.pdf', public_url: 'https://forms.invalid/form.pdf' }]];
		return [[{ document_id: 1, name: 'Clearance Form', description: '', in_person: 0, form_id: settings[1], needs_signature: settings[3], signature_note: settings[5], form_title: settings[1] ? 'Graduate clearance' : null }]];
	} };
	const conn = { execute: async (sql, args) => { writes.push({ sql, args }); if (sql.startsWith('SELECT')) return [[{ requirement_id: 3, name: 'Clearance Form' }]]; if (sql.startsWith('UPDATE requirements')) settings = args; return [{}]; } };
	const lib = load('src/lib/server/requirements.ts', { './db': { default: pool } });
	await lib.replaceDocumentRequirements(conn, 1, [{ name: 'Clearance Form', form_id: 4, needs_signature: true, signature_note: ' Adviser and Dean ' }]);
	let row = (await lib.fetchDocumentRequirements([1])).get(1)[0];
	assert.equal(row.form_id, 4); assert.equal(row.needs_signature, true); assert.equal(row.signature_note, 'Adviser and Dean'); assert.equal(row.form_title, 'Graduate clearance'); assert.equal(row.form_files[0].name, 'form.pdf');
	await lib.replaceDocumentRequirements(conn, 1, [{ name: 'Clearance Form', form_id: null, needs_signature: false, signature_note: '' }]);
	row = (await lib.fetchDocumentRequirements([1])).get(1)[0]; assert.equal(row.form_id, null); assert.equal(row.needs_signature, false); assert.equal(row.signature_note, null);
	assert.equal(writes.filter(q => q.sql.startsWith('UPDATE requirements')).length, 2);
});

test('Document chips show independent linked-form/signature icons; editing keeps saved controls', () => {
	const filename = 'src/routes/staff/documents/+page.svelte';
	const source = fs.readFileSync(filename, 'utf8').replace('let modalOpen = $state(false);', 'let modalOpen = $state(true);').replace('let editingId = $state<number | null>(null);', 'let editingId = $state<number | null>(data.documents[0].document_id);').replace('</script>', 'openEdit(data.documents[0]);\n</script>');
	const component = load(filename, {}, source).default;
	const doc = { document_id: 1, name: 'Transcript', uploaded_by_name: 'Office', upload_date: '2026-10-10', requirements: [{ name: 'Clearance Form', in_person: false, form_id: 4, needs_signature: true, signature_note: 'Adviser and Dean' }, { name: 'Custom requirement', in_person: false, form_id: 4, needs_signature: true, signature_note: 'Department head' }, { name: 'Valid ID', in_person: false, form_id: null, needs_signature: false, signature_note: '' }] };
	const html = render(component, { props: { data: { documents: [doc], forms: [{ form_id: 4, title: 'Graduate clearance' }] } } }).body;
	assert.equal((html.match(/aria-label="Linked form"/g) ?? []).length, 2); assert.equal((html.match(/aria-label="Signatures required"/g) ?? []).length, 2);
	assert.match(html, /value="Adviser and Dean"/); assert.match(html, /value="Department head"/); assert.ok((html.match(/selected/g) ?? []).length >= 2);
});

test('Wizard retains form downloads and shows signer instructions only when signatures are needed', () => {
	const filename = 'src/routes/student/request/+page.svelte';
	const source = fs.readFileSync(filename, 'utf8').replace('let currentStep = $state(1);', 'let currentStep = $state(2);').replace('let selectedDocs = $state<DocOption[]>([]);', 'let selectedDocs = $state<DocOption[]>(documents);');
	for (const needsSignature of [true, false]) {
		const data = { idStatus: 'verified', documents: [{ document_id: 1, name: 'Transcript', requirements: [{ name: 'Clearance Form', in_person: false, form_id: 4, needs_signature: needsSignature, signature_note: 'Adviser and Dean', form_title: 'Graduate clearance', form_files: [{ public_url: 'https://forms.invalid/form.pdf', name: 'form.pdf' }] }] }] };
		const html = render(load(filename, { '$app/navigation': { goto() {} } }, source).default, { props: { data } }).body;
		assert.match(html, /Download form/); assert.match(html, /href="https:\/\/forms.invalid\/form.pdf"/); assert.doesNotMatch(html, /multiple/);
		if (needsSignature) assert.match(html, /Get this form signed by: Adviser and Dean, then upload a photo or PDF of the signed form\./);
		else { assert.doesNotMatch(html, /Get this form signed by|Upload the signed form/); assert.match(html, /Upload the completed form/); }
	}
});

test('Existing admin review displays linked form name and signature note beside the uploaded file', () => {
	const data = { request: { request_id: requestId, status: 'Pending', student_name: 'Juan Cruz', requirements: [{ ...catalog[0], form_id: 4, form_title: 'Graduate clearance', signature_note: 'Adviser and Dean', form_files: [{ public_url: 'https://forms.invalid/form.pdf', name: 'form.pdf' }] }] }, history: [] };
	const html = render(load('src/routes/staff/requests/[request_id]/+page.svelte', { '$app/navigation': { invalidateAll() {} } }).default, { props: { data } }).body;
	assert.match(html, /Graduate clearance: form.pdf/); assert.match(html, /Adviser and Dean/); assert.match(html, /<button[^>]*>[\s\S]*?View/);
});

test('Upload preparation authorizes the owner and permits pending/correction statuses with one file per requirement', async () => {
	for (const status of ['Pending', 'pending', 'Correction Requested', 'correction_requested']) {
		const f = uploadFixture({ status }); const endpoint = load('src/routes/api/requests/upload-url/+server.ts', f.imports);
		const body = { requestId, files: [{ requirementName: 'Clearance Form', name: 'signed.png', type: 'image/png', size: 10 * 1024 * 1024 }] };
		const call = (body, role = 'Student') => endpoint.POST({ cookies: cookies(role), request: { json: async () => body } });
		assert.equal((await call(body)).status, 200); assert.match(f.state.storage[0].path, /^7\/requirements\/[a-f0-9-]{36}\.png$/); assert.equal(f.state.storage[0].settings.upsert, false);
		assert.equal((await call({ ...body, files: [...body.files, ...body.files] })).status, 400); assert.equal((await call(body, 'Staff')).status, 403); assert.equal((await call(body, 'Admin')).status, 403);
	}
	for (const options of [{ owner: 8 }, { status: 'approved' }, { status: 'released' }]) {
		const f = uploadFixture(options); const response = await load('src/routes/api/requests/upload-url/+server.ts', f.imports).POST({ cookies: cookies('Student'), request: { json: async () => ({ requestId, files: [{ requirementName: 'Clearance Form', name: 'signed.png', type: 'image/png', size: png.length }] }) } }); assert.ok(response.status >= 400); assert.equal(f.state.storage.length, 0);
	}
});

test('New-request upload preparation requires verified ID and validates JPG/PNG/PDF and the 10 MB boundary', async () => {
	for (const [name, type] of [['signed.jpg', 'image/jpeg'], ['signed.png', 'image/png'], ['signed.pdf', 'application/pdf']]) {
		const f = uploadFixture(); const endpoint = load('src/routes/api/requests/upload-url/+server.ts', f.imports);
		const file = { requirementName: 'Clearance Form', name, type, size: 10 * 1024 * 1024 };
		const call = file => endpoint.POST({ cookies: cookies('Student'), request: { json: async () => ({ documentIds: [1], files: [file] }) } });
		assert.equal((await call(file)).status, 200); assert.equal((await call({ ...file, size: file.size + 1 })).status, 413); assert.equal((await call({ ...file, type: 'text/plain' })).status, 400);
	}
	const f = uploadFixture({ idStatus: 'pending' }); const response = await load('src/routes/api/requests/upload-url/+server.ts', f.imports).POST({ cookies: cookies('Student'), request: { json: async () => ({ documentIds: [1], files: [{ requirementName: 'Clearance Form', name: 'signed.png', type: 'image/png', size: png.length }] }) } }); assert.equal(response.status, 403); assert.equal(f.state.storage.length, 0);
});

test('Upload tokens reject tampering, wrong owners, wrong requests/documents, duplicates and expired uploads', () => {
	const f = uploadFixture(); const context = { requestId, documentIds: [] }; const valid = f.token();
	const read = (token, userId = 7, expected = context) => f.helper.readRequirementUploads(JSON.stringify([{ requirementName: 'Clearance Form', uploadToken: token }]), userId, expected);
	assert.equal(read(valid).size, 1);
	assert.throws(() => read(valid + 'tampered')); assert.throws(() => read(valid, 8)); assert.throws(() => read(valid, 7, { requestId: 'REQ-2026-002', documentIds: [] })); assert.throws(() => read(valid, 7, { requestId: null, documentIds: [1] }));
	assert.throws(() => f.helper.readRequirementUploads(JSON.stringify(Array(2).fill({ requirementName: 'Clearance Form', uploadToken: valid })), 7, context));
	const payload = Buffer.from(JSON.stringify({ ...read(valid).get('Clearance Form'), expiresAt: Date.now() - 1 })).toString('base64url');
	assert.throws(() => read(payload + '.' + createHmac('sha256', 'requirement-test-secret').update('requirement-upload:' + payload).digest('base64url')));
});

test('Server checks stored MIME, actual size and bytes, including a 10 MB file', async () => {
	const full = new Blob([png, new Uint8Array(10 * 1024 * 1024 - png.length)], { type: 'image/png' });
	const f = uploadFixture({ blob: full }); const claim = f.helper.readRequirementUploads(JSON.stringify([{ requirementName: 'Clearance Form', uploadToken: f.token(undefined, 7, full.size) }]), 7, { requestId, documentIds: [] }).get('Clearance Form'); await f.helper.validatePreparedRequirementFile(claim);
	for (const blob of [new Blob([png], { type: 'image/jpeg' }), new Blob([Buffer.alloc(png.length)], { type: 'image/png' }), new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/png' })]) {
		const f = uploadFixture({ blob }); const claim = f.helper.readRequirementUploads(JSON.stringify([{ requirementName: 'Clearance Form', uploadToken: f.token() }]), 7, { requestId, documentIds: [] }).get('Clearance Form'); await assert.rejects(() => f.helper.validatePreparedRequirementFile(claim));
	}
});

test('Update Files replaces one file, preserves the other and checks statuses/ownership again on the transaction connection', async () => {
	for (const status of ['pending', 'correction_requested']) {
		const f = uploadFixture({ status }); const form = new FormData(); form.append('uploads', JSON.stringify([{ requirementName: 'Clearance Form', uploadToken: f.token() }]));
		const response = await load('src/routes/api/requests/[id]/requirements/+server.ts', f.imports).PATCH({ cookies: cookies('Student'), params: { id: requestId }, request: { formData: async () => form } });
		assert.equal(response.status, 200); assert.equal(f.state.saved[0].file_path, newPath); assert.equal(f.state.saved[0].needs_correction, false); assert.equal(f.state.saved[1].file_path, 'old-id.png'); assert.equal(f.state.committed, true); assert.equal(f.state.released, true);
		assert.ok(f.state.queries.filter(q => q.sql.startsWith('UPDATE') || q.sql.startsWith('INSERT')).every(q => q.connection)); assert.ok(f.state.queries.some(q => q.args?.includes(requestId)));
	}
	for (const options of [{ used: true }, { lockedStatus: 'approved' }, { owner: 8 }]) {
		const f = uploadFixture(options); const form = new FormData(); form.append('uploads', JSON.stringify([{ requirementName: 'Clearance Form', uploadToken: f.token() }]));
		const response = await load('src/routes/api/requests/[id]/requirements/+server.ts', f.imports).PATCH({ cookies: cookies('Student'), params: { id: requestId }, request: { formData: async () => form } }); assert.ok(response.status >= 400); assert.equal(f.state.committed, false); assert.equal(f.state.saved, null);
	}
});

test('New request submission accepts the signed-upload manifest, preserving request ID text and requirement files', async () => {
	const f = uploadFixture(); const form = new FormData(); form.append('documentIds', '[1]'); form.append('purpose', 'Employment'); form.append('requirements', '[]');
	const claim = f.token({ requestId: null, documentIds: [1] });
	// Both upload requirements need a file, as in the existing submission rules.
	const second = f.helper.requirementUploadToken({ requirementName: 'Valid ID', name: 'id.png', type: 'image/png', size: png.length, path: '7/requirements/22222222-2222-4222-8222-222222222222.png', userId: 7, context: { requestId: null, documentIds: [1] } });
	form.append('uploads', JSON.stringify([{ requirementName: 'Clearance Form', uploadToken: claim }, { requirementName: 'Valid ID', uploadToken: second }]));
	const response = await load('src/routes/api/requests/+server.ts', f.imports).POST({ cookies: cookies('Student'), request: { formData: async () => form } });
	assert.equal(response.status, 200); assert.match(response.body.request_id, /^REQ-\d{4}-001$/); assert.equal(f.state.saved[0].file_path, newPath); assert.equal(f.state.saved[0].file_name, 'signed.png'); assert.equal(f.state.committed, true); assert.equal(f.state.released, true); assert.equal(f.state.storage.filter(s => s.action === 'upload').length, 0);
});

test('Legacy single-file replacement still works and duplicate file fields are rejected', async () => {
	for (const duplicate of [false, true]) {
		const f = uploadFixture(); const form = new FormData(); form.append('file_Clearance Form', new File([png], 'new.png', { type: 'image/png' })); if (duplicate) form.append('file_Clearance Form', new File([png], 'other.png', { type: 'image/png' }));
		const response = await load('src/routes/api/requests/[id]/requirements/+server.ts', f.imports).PATCH({ cookies: cookies('Student'), params: { id: requestId }, request: { formData: async () => form } }); assert.equal(response.status, duplicate ? 400 : 200); assert.equal(f.state.committed, !duplicate);
	}
});

test('Browser sends file bytes to Storage and only completion tokens through the app', async () => {
	const calls = []; const file = new File([png], 'signed.png', { type: 'image/png' });
	const client = load('src/lib/upload-requirement-files.ts', {}, undefined, { fetch: async (url, init) => { calls.push({ url, init }); return url.startsWith('/api/') ? { ok: true, json: async () => ({ uploads: [{ requirementName: 'Clearance Form', signedUrl: 'https://storage.invalid/upload', uploadToken: 'fake-token' }] }) } : { ok: true }; } });
	const manifest = await client.uploadRequirementFiles({ 'Clearance Form': file }, { requestId });
	assert.equal(calls[0].url, '/api/requests/upload-url'); assert.equal(typeof calls[0].init.body, 'string'); assert.equal(calls[1].url, 'https://storage.invalid/upload'); assert.equal(calls[1].init.method, 'PUT'); assert.equal(calls[1].init.body.get(''), file); assert.equal(manifest[0].uploadToken, 'fake-token'); assert.equal(manifest[0].requirementName, 'Clearance Form');
});
