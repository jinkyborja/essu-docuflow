const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
const { compile } = require('svelte/compiler'), { render } = require('svelte/server');

function load(file, imports = {}) {
	const module = { exports: {} };
	let source = fs.readFileSync(file, 'utf8');
	if (file.endsWith('.svelte')) source = compile(source, { filename: file, generate: 'server' }).js.code;
	const requireModule = name => {
		if (Object.hasOwn(imports, name)) { const value = imports[name]; return value?.default ? { __esModule: true, ...value } : value; }
		if (name === '@sveltejs/kit') return { json: (body, init) => Response.json(body, init), redirect: (status, location) => { throw { status, location }; }, error: (status, message) => { throw { status, message }; } };
		if (name.startsWith('$lib/')) { const target = name.replace('$lib/', 'src/lib/'); return load(path.extname(target) ? target : target + '.ts', imports); }
		if (name.startsWith('.')) { const target = path.resolve(path.dirname(file), name); return load(path.extname(target) ? target : target + '.ts', imports); }
		return require(name);
	};
	vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
		{ module, exports: module.exports, require: requireModule, Response, Request, URL, URLSearchParams, Blob, File, Buffer, TextDecoder, Date, Intl, setTimeout, clearTimeout, console: { error() {} } });
	return module.exports;
}
const cookies = role => ({ get: () => role });
const sessions = {
	'$lib/server/jwt': { verifySession: async role => { if (role === 'invalid') throw Error('revoked'); return { userId: 7, role }; } },
	'$env/static/private': { JWT_SECRET: 'qa-only' }, '$env/dynamic/private': { env: {} }
};

test('Old/new ready labels share one workflow key; completion and cancellation remain clear', () => {
	const status = load('src/lib/request-status.ts');
	for (const value of ['Ready for Pickup', 'ready_for_pickup', 'Ready for Release', 'ready_for_release']) {
		assert.equal(status.requestStatusKey(value), 'ready_for_pickup'); assert.equal(status.statusLabel(value), 'Ready for Release');
	}
	assert.equal(status.REQUEST_STATUSES.filter(key => key.startsWith('ready_for_')).length, 1);
	assert.equal(status.statusLabel('Completed'), 'Released');
	assert.equal(status.statusLabel('Cancelled'), 'Cancelled');
	assert.equal(status.releaseWording('Request ready for pickup at the office'), 'Request Ready for Release at the office');
	const { requestTimeline } = load('src/lib/student-request-display.ts');
	const steps = requestTimeline('Cancelled', '2026-10-01', [{ new_status: 'Cancelled', changed_at: '2026-10-02' }]);
	assert.equal(steps.at(-1).label, 'Cancelled'); assert(!steps.some(step => step.state === 'upcoming'));
	assert.match(load('src/lib/request-flow.ts').nextStep('Cancelled'), /cancelled/);
});

test('Lifecycle eligibility protects completed, released, archived and terminal requests', () => {
	const { cancellationReason, archiveReason } = load('src/lib/request-lifecycle.ts');
	for (const status of ['Pending', 'Correction Requested', 'Approved', 'processing', 'ready_for_pickup']) assert.equal(cancellationReason({ status }), '');
	for (const row of [{ status: 'Completed' }, { status: 'Released' }, { status: 'Approved', completed_at: '2026-10-01' }, { status: 'Approved', history: [{ new_status: 'Completed' }] }, { status: 'Pending', archived_at: '2026-10-01' }, { status: 'Cancelled' }, { status: 'Rejected' }]) assert(cancellationReason(row));
	for (const status of ['Rejected', 'Cancelled', 'Completed', 'Released']) assert.equal(archiveReason({ status }), '');
	assert.equal(archiveReason({ status: 'Approved', history: [{ new_status: 'Completed' }] }), '');
	assert(archiveReason({ status: 'Pending' })); assert(archiveReason({ status: 'Released', archived_at: '2026-10-01' }));
});

function lifecycleFixture(row = { status: 'Pending', archived_at: null }, history = [], fail = false) {
	const state = { queries: [], began: false, committed: false, rolledBack: false, released: false };
	const conn = {
		beginTransaction: async () => state.began = true, commit: async () => state.committed = true,
		rollback: async () => state.rolledBack = true, release: () => state.released = true,
		execute: async (sql, args) => {
			state.queries.push({ sql, args });
			if (sql.startsWith('SELECT status')) return [[...(row ? [{ ...row }] : [])]];
			if (sql.startsWith('SELECT new_status')) return [history];
			if (fail) throw Error('database unavailable');
			return [{ affectedRows: 1 }];
		}
	};
	const endpoint = load('src/routes/api/requests/[id]/lifecycle/+server.ts', { ...sessions,
		'$lib/server/db': { default: { getConnection: async () => conn } },
		'$lib/server/activity-log': { logActivitySafely: async (_, event) => state.activity = event }
	});
	return { state, invoke: (action, role = 'Admin', confirm = true) => endpoint.POST({ cookies: cookies(role), params: { id: 'QA-REQ' }, request: new Request('http://qa.invalid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, confirm }) }) }) };
}

test('Cancel/Archive requires an authenticated admin and explicit confirmation', async () => {
	for (const [role, status] of [[null, 401], ['invalid', 401], ['Student', 403], ['Staff', 403]]) {
		const { state, invoke } = lifecycleFixture(); assert.equal((await invoke('cancel', role)).status, status); assert(!state.began);
	}
	for (const [action, confirm] of [['cancel', false], ['archive', false], ['delete', true]]) {
		const { state, invoke } = lifecycleFixture(); assert.equal((await invoke(action, 'Admin', confirm)).status, 400); assert(!state.began);
	}
});

test('Cancellation saves status plus student-visible history atomically and releases the connection', async () => {
	const { state, invoke } = lifecycleFixture({ status: 'Approved', archived_at: null });
	const response = await invoke('cancel'); assert.equal(response.status, 200); assert.equal((await response.json()).status, 'Cancelled');
	assert(state.committed && state.released && !state.rolledBack);
	assert(state.queries[0].sql.includes('FOR UPDATE'));
	assert(state.queries.some(query => query.sql.includes("status = 'Cancelled'")));
	const history = state.queries.find(query => query.sql.startsWith('INSERT INTO request_status_history'));
	assert.equal(JSON.stringify(history.args), JSON.stringify(['QA-REQ', 'Approved', 'Cancelled', 7]));
	assert.equal(state.activity.action, 'request.cancelled');
	assert(!state.queries.some(query => /DELETE|approved_file_path\s*=/.test(query.sql)));
});

test('Archive retains status, all files and original history; ineligible/repeated actions roll back', async () => {
	const { state, invoke } = lifecycleFixture({ status: 'Approved', archived_at: null }, [{ new_status: 'Completed' }]);
	assert.equal((await invoke('archive')).status, 200); assert(state.committed && state.released);
	const mutations = state.queries.filter(query => !query.sql.startsWith('SELECT'));
	assert.equal(mutations.length, 1); assert.match(mutations[0].sql, /^UPDATE requests SET archived_at/);
	assert(!mutations[0].sql.includes('status =')); assert.equal(state.activity.action, 'request.archived');
	for (const [action, row, history] of [['cancel', { status: 'Approved' }, [{ new_status: 'Completed' }]], ['cancel', { status: 'Released' }, []], ['cancel', { status: 'Cancelled' }, []], ['archive', { status: 'Pending' }, []], ['archive', { status: 'Rejected', archived_at: '2026-10-01' }, []]]) {
		const fixture = lifecycleFixture(row, history); assert.equal((await fixture.invoke(action)).status, 409); assert(fixture.state.rolledBack && fixture.state.released && !fixture.state.committed);
	}
	const missing = lifecycleFixture(null); assert.equal((await missing.invoke('cancel')).status, 404); assert(missing.state.released);
	const failure = lifecycleFixture({ status: 'Pending' }, [], true); assert.equal((await failure.invoke('cancel')).status, 500); assert(failure.state.rolledBack && failure.state.released && !failure.state.committed);
});

function pdfFixture(files, contents = '%PDF-1.7\nfixture\n%%EOF') {
	const calls = [];
	const { GET } = load('src/routes/api/forms/[id]/download/+server.ts', { ...sessions,
		'$lib/server/db': { default: { execute: async () => [files] } },
		'$lib/server/supabase': { supabase: { storage: { from: () => ({ download: async value => { calls.push(value); return { data: new Blob([contents]) }; } }) } } }
	});
	return { calls, invoke: (role = 'Student', preview = false) => GET({ cookies: cookies(role), params: { id: '4' }, url: new URL('http://qa.invalid/api/forms/4/download' + (preview ? '?preview=1' : '')), fetch: async value => { calls.push(value); return new Response(contents); } }) };
}

test('Form downloads authenticate, use actual PDF bytes and correct headers; missing/renamed DOCX is rejected', async () => {
	const fixture = pdfFixture([{ title: 'Prospectus', storage_path: null, public_url: '/forms/Prospectus-MAIT.docx' }]);
	const response = await fixture.invoke(); assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/pdf');
	assert.match(response.headers.get('content-disposition'), /attachment; filename="ESSU-prospectus.pdf"/);
	assert.match(await response.text(), /^%PDF-/); assert.deepEqual(fixture.calls, ['/forms/Prospectus-MAIT.pdf']);
	const inline = await fixture.invoke('Student', true); assert.match(inline.headers.get('content-disposition'), /^inline/);
	assert.equal((await fixture.invoke('invalid')).status, 401);
	assert.equal((await pdfFixture([]).invoke()).status, 404);
	assert.equal((await pdfFixture([{ title: 'Custom', storage_path: null, public_url: '/forms/custom.docx' }]).invoke()).status, 409);
	assert.equal((await pdfFixture([{ title: 'Bad PDF', storage_path: null, public_url: '/forms/bad.pdf' }], 'PK\x03\x04docx').invoke()).status, 502);
});

test('Form PDF preview selects the PDF file and never serves the editable DOCX', async () => {
	const fixture = pdfFixture([
		{ title: 'Editable form', storage_path: 'forms/qa/editable.docx', public_url: 'https://unused.example.invalid/docx' },
		{ title: 'Preview form', storage_path: 'forms/qa/preview.pdf', public_url: 'https://unused.example.invalid/pdf' }
	]);
	const response = await fixture.invoke('Student', true);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('content-type'), 'application/pdf');
	assert.match(response.headers.get('content-disposition'), /^inline/);
	assert.match(await response.text(), /^%PDF-/);
	assert.deepEqual(fixture.calls, ['forms/qa/preview.pdf']);
});

test('Uploaded PDF versions are read from the existing forms storage bucket', async () => {
	const fixture = pdfFixture([{ title: 'Uploaded', storage_path: 'forms/qa/form.pdf', public_url: 'https://unused.example.invalid' }]);
	assert.equal((await fixture.invoke()).status, 200); assert.deepEqual(fixture.calls, ['forms/qa/form.pdf']);
});

test('Private document signing permits only the owner or office and retains released-file access', async () => {
	for (const [owner, role, expected] of [[7, 'Student', 200], [8, 'Student', 403], [8, 'Admin', 200]]) {
		let signed = false;
		const { GET } = load('src/routes/api/storage/+server.ts', { ...sessions,
			'$lib/server/db': { default: { execute: async () => [[{ student_id: owner, status: 'Released', file_kind: 'final' }]] } },
			'$lib/server/supabase': { supabase: { storage: { from: () => ({ createSignedUrl: async () => { signed = true; return { data: { signedUrl: 'https://qa.invalid/file.pdf' } }; } }) } } }
		});
		const response = await GET({ cookies: cookies(role), url: new URL('http://qa.invalid/api/storage?bucket=requirements&path=qa.pdf') });
		assert.equal(response.status, expected); assert.equal(signed, expected === 200);
	}
});

test('Login title follows the tagline exactly once in the introduction', () => {
	const html = render(load('src/routes/login/+page.svelte', { '$app/navigation': {}, '$app/environment': { browser: false } }).default).body;
	const intro = html.slice(html.indexOf('<aside'), html.indexOf('</aside>'));
	assert.equal((intro.match(/>ESSU DocuFlow</g) ?? []).length, 1);
	assert(intro.indexOf('Request your school documents') < intro.indexOf('>ESSU DocuFlow<'));
});

test('Active and archived request loads use separate database views and restrict archives to admins', async () => {
	for (const [view, role] of [['active', 'Admin'], ['archived', 'Admin'], ['archived', 'Staff']]) {
		const queries = [];
		const { load: pageLoad } = load('src/routes/staff/requests/+page.server.ts', { ...sessions,
			'$lib/server/db': { default: { execute: async sql => { queries.push(sql); return [[]]; } } },
			'$lib/server/request-items': { fetchRequestItems: async () => new Map() },
			'$lib/server/request-journey': { attachRequestJourney: async () => {} },
			'$lib/server/timing': { timedLoad: (_, work) => work(), timedQuery: (_, work) => work() }
		});
		const run = () => pageLoad({ cookies: cookies(role), url: new URL('http://qa.invalid/staff/requests?view=' + view) });
		if (role === 'Staff') { await assert.rejects(run, value => value.status === 403); assert.equal(queries.length, 0); }
		else { const data = await run(); assert.equal(data.archived, view === 'archived'); assert(queries[0].includes('WHERE r.archived_at IS ' + (view === 'archived' ? 'NOT NULL' : 'NULL'))); }
	}
});
