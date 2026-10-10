const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { compile } = require('svelte/compiler');
const { render } = require('svelte/server');
const { writable } = require('svelte/store');

// Local modules and fake endpoint dependencies only; never connect to MySQL or send email.
function load(filename, imports = {}, sourceOverride) {
	const module = { exports: {} };
	const source = sourceOverride ?? fs.readFileSync(filename, 'utf8');
	const code = filename.endsWith('.svelte') ? compile(source, { filename, generate: 'server' }).js.code : source;
	const kit = { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) };
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
		if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name), imports);
		return require(name);
	};
	vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
		{ module, exports: module.exports, require: resolver, Date, Intl, URL, URLSearchParams, File, FormData, Buffer, setTimeout, clearTimeout, console });
	return module.exports;
}
const formatting = load('src/lib/formatting.ts');
const years = load('src/lib/school-year.ts');
const cookies = role => ({ get: () => role });
const sessionImports = {
	'$lib/server/jwt': { verifySession: async role => ({ userId: 7, role }), signJwt: () => 'fake-token' },
	'$env/static/private': { JWT_SECRET: 'test-only' }
};

test('Names keep the whole first name and use one middle initial; plurals handle 0, 1 and 2', () => {
	assert.equal(formatting.formatName('Christian Daniel', 'Germones', 'Jongco'), 'Christian Daniel G. Jongco');
	assert.equal(formatting.formatName(' Christian  Daniel ', ' g. ', ' Jongco '), 'Christian Daniel G. Jongco');
	for (const middle of ['', ' ', null, undefined]) assert.equal(formatting.formatName('Juan', middle, 'Cruz'), 'Juan Cruz');
	for (const noun of ['member', 'student', 'request', 'file', 'document', 'requirement']) {
		assert.equal(formatting.pluralize(0, noun), noun + 's');
		assert.equal(formatting.pluralize(1, noun), noun);
		assert.equal(formatting.pluralize(2, noun), noun + 's');
	}
});

test('School year limits reject malformed, future and old Enrolled years', () => {
	const current = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date()));
	assert.equal(years.SCHOOL_YEAR_MAX, current);
	for (const value of [null, undefined, '', true, {}, [], '02000', '2e3', '2026.0', '2026-2027', 2026.5, NaN, Infinity, 1999, current + 1]) {
		assert.ok(years.validateSchoolYear(value, 'Former'), String(value));
	}
	for (const type of ['Former', 'Alumni']) {
		assert.equal(years.validateSchoolYear(2000, type), null);
		assert.equal(years.validateSchoolYear(String(current), type), null);
	}
	assert.equal(years.validateSchoolYear(current, 'Enrolled'), null);
	assert.equal(years.validateSchoolYear(current - 1, 'Enrolled'), null);
	assert.ok(years.validateSchoolYear(current - 2, 'Enrolled'));
});

test('Registration, own profile and admin edit enforce school years before any database write', async () => {
	for (const route of ['register', 'profile', 'students']) {
		const writes = [];
		const endpoint = load(`src/routes/api/${route}/+server.ts`, {
			...sessionImports, '$lib/server/db': { default: { execute: async (sql, args) => { writes.push({ sql, args }); return [[]]; } } },
			'$lib/server/email': { sendEmail: async () => {} }, '$lib/server/supabase': { supabase: {} }
		});
		for (const invalid of [years.SCHOOL_YEAR_MAX + 1, years.SCHOOL_YEAR_MAX - 2, '2e3', 2026.5]) {
			const body = { firstName: 'Juan', lastName: 'Cruz', dateOfBirth: '2000-01-01', email: 'fake@example.invalid', studentId: '26-0001', program: 'QA', studentType: 'Enrolled', lastSchoolYear: invalid, password: 'fake-password', type: 'academic', user_id: 8, student_type: 'Enrolled', last_school_year: invalid };
			const result = await endpoint[route === 'register' ? 'POST' : 'PATCH']({ request: { url: 'http://localhost/api/register', json: async () => body }, cookies: cookies(route === 'students' ? 'Admin' : 'Student') });
			assert.equal(result.status, 400, `${route}: ${invalid}`);
		}
		assert.equal(writes.length, 0);
	}
});

test('Valid school years still save, profiles update their owner, and student edits reject students', async () => {
	for (const route of ['register', 'profile', 'students']) {
		const queries = [], emails = [];
		const endpoint = load(`src/routes/api/${route}/+server.ts`, {
			...sessionImports, '$lib/server/db': { default: { execute: async (sql, args) => { queries.push({ sql, args }); return [[]]; } } },
			'$lib/server/email': { sendEmail: async message => emails.push(message) }, '$lib/server/supabase': { supabase: {} }
		});
		const body = { firstName: 'Christian Daniel', middleName: 'Germones', lastName: 'Jongco', dateOfBirth: '2000-01-01', email: 'fake@example.invalid', studentId: '26-0001', program: 'QA', studentType: 'Enrolled', lastSchoolYear: years.SCHOOL_YEAR_MAX, password: 'fake-password', type: 'academic', user_id: 8, student_type: 'Enrolled', last_school_year: years.SCHOOL_YEAR_MAX };
		const call = role => endpoint[route === 'register' ? 'POST' : 'PATCH']({ request: { url: 'http://localhost/api/register', json: async () => body }, cookies: cookies(role) });
		assert.equal((await call(route === 'students' ? 'Admin' : 'Student')).status, 200);
		if (route === 'register') assert.match(emails[0].html, /Dear Christian Daniel G\. Jongco,/);
		if (route === 'profile') { assert.equal(queries.at(-1).args.at(-1), 7); assert.equal((await call('Staff')).status, 403); }
		if (route === 'students') assert.equal((await call('Student')).status, 403);
	}
});

function revocation({ role = 'Admin', status = 'verified', reason = ' Incorrect student ID ', confirm = true, failNotification = false } = {}) {
	const state = { queries: [], committed: false, rolledBack: false, released: false };
	const conn = {
		beginTransaction: async () => {}, commit: async () => { state.committed = true; },
		rollback: async () => { state.rolledBack = true; }, release: () => { state.released = true; },
		execute: async (sql, args) => {
			state.queries.push({ sql, args });
			if (sql.startsWith('SELECT')) return [[{ user_id: 8, student_id: '26-0001', id_status: status }]];
			if (failNotification && sql.startsWith('INSERT')) throw new Error('Fake notification failure');
			return [{}];
		}
	};
	const endpoint = load('src/routes/api/students/[id]/verify/+server.ts', {
		...sessionImports, '$lib/server/db': { default: { getConnection: async () => conn, execute: () => { throw new Error('Pool used during transaction'); } } }
	});
	return { state, run: () => endpoint.POST({ cookies: cookies(role), params: { id: '8' }, request: { json: async () => ({ action: 'revoke', reason, confirm }) } }) };
}
test('Admin revocation stores rejection and reason and notifies only the target student', async () => {
	const { run, state } = revocation();
	const response = await run();
	assert.equal(response.status, 200);
	assert.equal(response.body.id_status, 'rejected');
	assert.equal(response.body.id_reject_reason, 'Incorrect student ID');
	const update = state.queries.find(query => query.sql.startsWith('UPDATE'));
	assert.equal(update.args[0], 'rejected'); assert.equal(update.args[2], 'Incorrect student ID'); assert.equal(update.args.at(-1), 8);
	const notification = state.queries.find(query => query.sql.startsWith('INSERT'));
	assert.match(notification.args[0], /revoked/); assert.equal(notification.args[2], 8);
	assert.match(notification.sql, /TRUE, FALSE/);
	assert.equal(state.committed, true); assert.equal(state.released, true);
});
test('Revocation refuses other roles, missing reasons and stale statuses; failures roll back and release', async () => {
	for (const options of [{ role: 'Student' }, { role: 'Staff' }, { reason: '' }, { reason: '  ' }, { reason: 'x'.repeat(301) }, { confirm: false }]) {
		const { run, state } = revocation(options); assert.ok((await run()).status >= 400); assert.equal(state.queries.length, 0);
	}
	for (const status of ['pending', 'rejected']) {
		const { run, state } = revocation({ status }); assert.equal((await run()).status, 409); assert.equal(state.rolledBack, true); assert.equal(state.released, true);
	}
	const { run, state } = revocation({ failNotification: true });
	assert.equal((await run()).status, 500); assert.equal(state.committed, false); assert.equal(state.rolledBack, true); assert.equal(state.released, true);
});

function renderPage(filename, data) {
	const imports = {
		'$app/stores': { page: writable({ url: new URL('http://localhost/student/request'), data }) },
		'$app/navigation': { goto: async () => {} }, '$app/environment': { browser: false },
		'$lib/stores/notifications': { notifUnreadCount: writable(0), startNotifications: () => {}, markAllRead: async () => {}, markOneRead: async () => {} },
		'$lib/stores/sidebar': { sidebarCollapsed: writable(false), sidebarMobileOpen: writable(false) }
	};
	return render(load(filename, imports).default, { props: { data } }).body;
}
test('Document summaries render one additional-document count in every request list', () => {
	const items = [{ document_id: 1, name: 'Transcript' }, { document_id: 2, name: 'Certificate' }, { document_id: 3, name: 'Diploma' }];
	for (const filename of ['src/routes/staff/requests/+page.svelte', 'src/routes/staff/dashboard/+page.svelte', 'src/routes/student/dashboard/+page.svelte', 'src/routes/student/documents/+page.svelte']) {
		// Render the actual row markup separately from the list's client effects and page state.
		const lines = fs.readFileSync(filename, 'utf8').split('\n').filter(line => line.includes('more</button>') || (filename.includes('staff/dashboard') && line.includes('{req.document_name}')));
		assert.ok(lines.length, filename);
		for (const line of lines) {
			const source = `<script>let { req } = $props(); let expanded = []; let expandedRequests = []; let expandedItems = []; function toggleItems() {}</script>${line.trim()}`;
			const component = load(filename, {}, source).default;
			const html = render(component, { props: { req: { request_id: 'REQ-2026-001', document_name: 'Transcript +2 more', items } } }).body;
			assert.equal((html.match(/\+2 more/g) ?? []).length, 1, filename);
		}
	}
});
test('Unverified request page has Browse forms and no duplicate banner or wizard', () => {
	for (const status of ['pending', 'rejected']) {
		const html = renderPage('src/routes/student/request/+page.svelte', { documents: [], idStatus: status, idRejectReason: 'Fake reason' });
		assert.match(html, /Browse forms/); assert.match(html, /href="\/student\/forms"/);
		assert.doesNotMatch(html, /Select Document|Submit Requirements|waiting for verification|could not be verified/);
	}
	const html = renderPage('src/routes/student/request/+page.svelte', { documents: [], idStatus: 'verified' });
	assert.match(html, /Select Document/); assert.doesNotMatch(html, /Browse forms/);
});
test('Reports show an em dash without resolved requests and only one visible period selector', () => {
	const row = { request_id: 'REQ-2026-001', status: 'Pending', date_requested: new Date().toISOString(), document_name: 'Transcript', items: [{ document_id: 1, name: 'Transcript' }] };
	const pending = renderPage('src/routes/staff/reports/+page.svelte', { requests: [row] });
	assert.match(pending, /Approval Rate \(resolved requests\)<\/p><strong[^>]*>—<\/strong>/);
	assert.doesNotMatch(pending, /<span class="report-period-chip"/);
	assert.equal((pending.match(/<option value="all"/g) ?? []).length, 1);
	assert.doesNotMatch(pending, /1 requests/);
	const approved = renderPage('src/routes/staff/reports/+page.svelte', { requests: [{ ...row, status: 'Approved' }] });
	assert.match(approved, /Approval Rate \(resolved requests\)<\/p><strong[^>]*>100%<\/strong>/);
});
test('Verified students have View and admin-only Revoke actions in both table layouts', () => {
	const student = { user_id: 8, first_name: 'Christian Daniel', middle_name: 'Germones', last_name: 'Jongco', suffix: null, email: 'fake@example.invalid', student_id: '26-0001', program: 'QA', student_type: 'Enrolled', last_school_year: years.SCHOOL_YEAR_MAX, verified: true, id_status: 'verified', id_verified_at: null, id_reject_reason: null, date_of_birth: null, date_registered: new Date().toISOString() };
	const html = renderPage('src/routes/staff/students/+page.svelte', { allowed: true, role: 'Admin', students: [student] });
	assert.equal((html.match(/>View<\/button>/g) ?? []).length, 2);
	assert.equal((html.match(/>Revoke<\/button>/g) ?? []).length, 2);
	assert.doesNotMatch(html, />Review<\/button>|1 students|Christian Daniel Germones Jongco/);
	assert.match(html, /Christian Daniel G\. Jongco/);
	assert.doesNotMatch(renderPage('src/routes/staff/students/+page.svelte', { allowed: true, role: 'Staff', students: [student] }), />Revoke<\/button>/);
});
