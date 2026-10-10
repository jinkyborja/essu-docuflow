const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { compile } = require('svelte/compiler');
const { render } = require('svelte/server');
const { writable } = require('svelte/store');

// Fake endpoint dependencies only: these checks never write to MySQL or send email.
function load(filename, imports = {}, sourceOverride, globals = {}) {
	const module = { exports: {} };
	const source = sourceOverride ?? fs.readFileSync(filename, 'utf8');
	const code = filename.endsWith('.svelte') ? compile(source, { filename, generate: 'server' }).js.code : source;
	const resolver = name => {
		if (Object.hasOwn(imports, name)) { const value = imports[name]; return value && Object.hasOwn(value, 'default') ? { __esModule: true, ...value } : value; }
		if (name === '@sveltejs/kit') return { json: (body, init = {}) => ({ body, status: init.status ?? 200 }), redirect: (status, location) => { throw Object.assign(new Error('Redirect'), { status, location }); } };
		if (name.startsWith('$lib/')) { const target = name.replace('$lib/', 'src/lib/'); return load(path.extname(target) ? target : target + '.ts', imports, undefined, globals); }
		if (name.startsWith('.')) { const target = path.resolve(path.dirname(filename), name); return load(path.extname(target) ? target : target + '.ts', imports, undefined, globals); }
		return require(name);
	};
	vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
		{ module, exports: module.exports, require: resolver, Error, Date, Intl, File, Blob, FormData, Buffer, URL, URLSearchParams, setTimeout, clearTimeout, console: { error() {} }, ...globals });
	return module.exports;
}
const sessions = { '$lib/server/jwt': { verifySession: async role => ({ userId: 7, role }) }, '$env/static/private': { JWT_SECRET: 'test-only' } };
const cookies = role => ({ get: () => role });
const statuses = load('src/lib/request-status.ts');
const year = load('src/lib/school-year.ts').SCHOOL_YEAR_MAX;
const academic = { type: 'academic', studentId: ' 26-0007 ', program: 'Master of Arts', studentType: 'Enrolled', lastSchoolYear: year, user_id: 999, id_status: 'pending' };

function academicEndpoint({ idStatus = 'pending', role = 'Student', duplicate = false, race = false } = {}) {
	const writes = []; const queries = [];
	const pool = { execute: async (sql, args) => {
		queries.push({ sql, args });
		if (!sql.startsWith('UPDATE')) return [[{ user_id: 7, id_status: idStatus }]];
		assert.match(sql, /WHERE user_id = \? AND role = 'Student' AND id_status IN \('pending', 'rejected'\)/);
		assert.equal(args.at(-1), 7, 'The supplied target user ID must be ignored');
		if (race) idStatus = 'verified';
		if (!['pending', 'rejected'].includes(idStatus)) return [{ affectedRows: 0 }];
		if (duplicate) throw Object.assign(new Error('Duplicate ID'), { code: 'ER_DUP_ENTRY' });
		writes.push({ sql, args }); return [{ affectedRows: 1 }];
	} };
	const endpoint = load('src/routes/api/profile/+server.ts', { ...sessions, '$lib/server/db': { default: pool } });
	return { writes, queries, run: (body = academic) => endpoint.PATCH({ cookies: cookies(role), request: { json: async () => body } }) };
}

test('Verified academics cannot be changed, including direct submissions and a concurrent verification', async () => {
	for (const options of [{ idStatus: 'verified' }, { idStatus: 'pending', race: true }]) {
		const f = academicEndpoint(options); const response = await f.run();
		assert.equal(response.status, 403); assert.equal(response.body.error, 'Contact the Graduate School office to change these.'); assert.equal(f.writes.length, 0);
	}
});

test('Pending/rejected students edit all four academic fields on their own account; duplicate IDs are clear', async () => {
	for (const idStatus of ['pending', 'rejected']) {
		const f = academicEndpoint({ idStatus }); assert.equal((await f.run()).status, 200);
		assert.deepEqual(Array.from(f.writes[0].args), ['26-0007', 'Master of Arts', 'Enrolled', year, 7]);
		assert.match(f.writes[0].sql, /student_id = COALESCE\(\?, student_id\), program = \?, student_type = \?, last_school_year = \?/);
		assert.equal((await f.run({ ...academic, studentId: undefined })).status, 200); assert.equal(f.writes.at(-1).args[0], null);
	}
	const duplicate = academicEndpoint({ duplicate: true }); const response = await duplicate.run();
	assert.equal(response.status, 409); assert.match(response.body.error, /Student ID is already in use/);
});

test('Academic edits validate IDs/years and reject office/unknown roles without a write', async () => {
	for (const role of ['Staff', 'Admin', 'Unknown']) {
		const f = academicEndpoint({ role }); assert.equal((await f.run()).status, 403); assert.equal(f.queries.length, 0);
	}
	for (const patch of [{ studentId: '' }, { studentId: 123 }, { studentId: 'X'.repeat(21) }, { lastSchoolYear: year + 1 }, { lastSchoolYear: year - 2 }, { studentType: 'Other' }]) {
		const f = academicEndpoint(); assert.equal((await f.run({ ...academic, ...patch })).status, 400); assert.equal(f.queries.length, 0);
	}
});

test('Admin pencil editing remains allowed for a verified student', async () => {
	const writes = [];
	const endpoint = load('src/routes/api/students/+server.ts', { ...sessions, '$lib/server/supabase': { supabase: {} }, '$lib/server/db': { default: { execute: async (sql, args) => { writes.push({ sql, args }); return [{ affectedRows: 1 }]; } } } });
	const response = await endpoint.PATCH({ cookies: cookies('Admin'), request: { json: async () => ({ user_id: 8, first_name: 'Juan', last_name: 'Cruz', email: 'qa@example.invalid', student_id: '26-0008', program: 'Master of Arts', student_type: 'Enrolled', last_school_year: year, verified: true, id_status: 'verified' }) } });
	assert.equal(response.status, 200); assert.equal(writes[0].args.at(-1), 8); assert.doesNotMatch(writes[0].sql, /id_status IN/);
});

function renderPage(filename, data, sourceOverride, globals = {}) {
	return render(load(filename, { '$app/stores': { page: writable({ data }) }, '$app/navigation': { invalidateAll: async () => {} } }, sourceOverride, globals).default, { props: { data } }).body;
}
const profile = { first_name: 'Juan', middle_name: null, last_name: 'Cruz', student_id: '26-0007', program: 'Master of Arts', student_type: 'Enrolled', last_school_year: year, email: 'qa@example.invalid', date_registered: '2020-10-10', id_status: 'verified', has_id_photo: false };

test('Verified profiles show read-only academics and the office note; pending/rejected profiles retain all controls', () => {
	const filename = 'src/routes/student/profile/+page.svelte';
	for (const idStatus of ['verified', 'pending', 'rejected']) {
		const source = fs.readFileSync(filename, 'utf8').replace('</script>', 'openAcademic();\n</script>');
		const html = renderPage(filename, { profile: { ...profile, id_status: idStatus } }, source);
		assert.match(html, /26-0007/); assert.match(html, /Master of Arts/); assert.match(html, /Currently Enrolled/); assert.match(html, new RegExp(String(year)));
		if (idStatus === 'verified') { assert.match(html, /Contact the Graduate School office to change these\./); assert.doesNotMatch(html, /id="academic-form"|id="academic-student-id"/); }
		else { assert.doesNotMatch(html, /Contact the Graduate School office to change these\./); assert.match(html, /id="academic-student-id"[^>]*maxlength="20"[^>]*required/); assert.match(html, /Program \/ Course|Last School Year Attended/); }
	}
});

test('Eight statuses have shared distinct colors/labels, including legacy correction names and Badge rendering', () => {
	assert.equal(new Set(Object.values(statuses.STATUS_COLORS).map(value => value.color)).size, 8);
	assert.equal(statuses.statusLabel('Pending'), 'Pending review'); assert.equal(statuses.statusLabel('Correction Requested'), 'Needs correction');
	assert.equal(statuses.statusLabel('ready_for_pickup'), 'Ready for pickup');
	const badge = load('src/lib/components/ui/Badge.svelte').default;
	for (const key of statuses.REQUEST_STATUSES) {
		const html = render(badge, { props: { value: key } }).body;
		assert.ok(html.includes(statuses.statusLabel(key))); assert.ok(html.includes(statuses.STATUS_COLORS[key].classes));
	}
	assert.match(render(badge, { props: { value: 'system' } }).body, /System/);
});

function reportRows(counts) {
	let n = 0;
	return Object.entries(counts).flatMap(([status, count]) => Array.from({ length: count }, () => ({ request_id: `REQ-2026-${String(++n).padStart(3, '0')}`, status, date_requested: '2020-10-09T18:00:00Z', document_name: 'Transcript', items: [{ document_id: 1, name: 'Transcript' }] })));
}

test('Reports count every stage and exclude cancelled/pending/corrections from the approval denominator', () => {
	const rows = reportRows({ Pending: 1, 'Correction Requested': 1, correction_requested: 1, Approved: 2, processing: 3, ready_for_pickup: 4, released: 5, Rejected: 3, cancelled: 7 });
	const html = renderPage('src/routes/staff/reports/+page.svelte', { requests: rows });
	assert.match(html, /Approval Rate \(resolved requests\)<\/p><strong[^>]*>82%<\/strong>/); assert.match(html, /17 resolved/);
	for (const [key, count] of Object.entries({ pending: 1, correction_requested: 2, approved: 2, processing: 3, ready_for_pickup: 4, released: 5, rejected: 3, cancelled: 7 })) {
		assert.match(html, new RegExp(`<p[^>]*>${statuses.statusLabel(key)}</p>\\s*<strong[^>]*>${count}</strong>`), key); assert.ok(html.includes(`--legend-color:${statuses.STATUS_COLORS[key].color}`), key);
	}
	assert.match(html, /Total Requests<\/p><strong[^>]*>27<\/strong>/);
	for (const counts of [{ cancelled: 4 }, { pending: 2, correction_requested: 1, cancelled: 3 }]) {
		assert.match(renderPage('src/routes/staff/reports/+page.svelte', { requests: reportRows(counts) }), /Approval Rate \(resolved requests\)<\/p><strong[^>]*>—<\/strong>/);
	}
});

test('CSV exports all selected statuses, payment state and O.R. numbers, escaping values and using Manila dates', async () => {
	const filename = 'src/routes/staff/reports/+page.svelte';
	const rows = reportRows(Object.fromEntries(statuses.REQUEST_STATUSES.map(key => [key, 1])));
	rows[0].document_name = 'Transcript, "Certified"'; rows[0].payment_status = 'submitted'; rows[0].or_number = 'OR-0007';
	let exportCsv, blob, clicked = false;
	class CsvURL extends URL { static createObjectURL(value) { blob = value; return 'blob:test'; } static revokeObjectURL() {} }
	const source = fs.readFileSync(filename, 'utf8').replace('</script>', 'globalThis.captureExport(exportCsv);\n</script>');
	renderPage(filename, { requests: rows }, source, { captureExport: fn => { exportCsv = fn; }, URL: CsvURL, document: { createElement: () => ({ click() { clicked = true; } }) } });
	exportCsv(); const csv = await blob.text();
	assert.equal(clicked, true); assert.match(csv, /^"Request ID","Document","Status","Date Requested","Payment Status","O\.R\. Number"/);
	assert.match(csv, /"REQ-2026-001","Transcript, ""Certified""","Pending review","Oct 10, 2020","submitted","OR-0007"/);
	for (const key of statuses.REQUEST_STATUSES) assert.ok(csv.includes(`"${statuses.statusLabel(key)}"`));
	assert.equal(csv.split('\r\n').length, 9);
});

test('Report windows and chart days use Manila midnight even when the host uses UTC', () => {
	const filename = 'src/routes/staff/reports/+page.svelte';
	const fixed = Date.parse('2026-10-10T18:30:00Z');
	class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }
	for (const range of ['today', 'custom']) {
		let captured;
		let source = fs.readFileSync(filename, 'utf8').replace("let timeRange = $state('all');", `let timeRange = $state('${range}');`).replace("let customStart = $state('');", "let customStart = $state('2026-10-11');").replace("let customEnd = $state('');", "let customEnd = $state('2026-10-11');");
		source = source.replace('</script>', 'globalThis.captureReport({total, selectedWindow, trendBuckets});\n</script>');
		const rows = ['2026-10-10T15:59:59Z', '2026-10-10T16:00:00Z', '2026-10-10T18:00:00Z', '2026-10-11T15:59:59Z', '2026-10-11T16:00:00Z'].map((date_requested, index) => ({ ...reportRows({ processing: 1 })[0], request_id: `REQ-2026-${index}`, date_requested }));
		renderPage(filename, { requests: rows }, source, { Date: FixedDate, captureReport: value => { captured = value; } });
		assert.equal(captured.selectedWindow.start.toISOString(), '2026-10-10T16:00:00.000Z');
		assert.equal(captured.total, range === 'today' ? 2 : 3);
		assert.equal(captured.trendBuckets.length, 1); assert.equal(captured.trendBuckets[0].key, '2026-10-11'); assert.equal(captured.trendBuckets[0].label, 'Oct 11, 2026'); assert.equal(captured.trendBuckets[0].value, range === 'today' ? 2 : 3);
		if (range === 'custom') assert.equal(captured.selectedWindow.end.toISOString(), '2026-10-11T15:59:59.999Z');
	}
});

test('Reports load payment details without multiplying requests and restrict data to admin/staff', async () => {
	for (const role of ['Admin', 'Staff', 'Student', 'Unknown', undefined]) {
		const queries = []; const rows = reportRows({ processing: 1 }); rows[0].payment_status = 'verified'; rows[0].or_number = 'OR-001';
		const endpoint = load('src/routes/staff/reports/+page.server.ts', { ...sessions, '$lib/server/db': { default: { execute: async sql => { queries.push(sql); return [rows]; } } }, '$lib/server/request-items': { fetchRequestItems: async ids => new Map(ids.map(id => [id, rows[0].items])), documentNameSummary: items => items.map(item => item.name).join(', ') } });
		if (['Admin', 'Staff'].includes(role)) {
			const response = await endpoint.load({ cookies: cookies(role) }); assert.equal(response.requests.length, 1); assert.equal(response.requests[0].or_number, 'OR-001'); assert.match(queries[0], /LEFT JOIN request_payments p ON p\.request_id = r\.request_id/);
		} else { await assert.rejects(() => endpoint.load({ cookies: cookies(role) }), error => error.status === 302); assert.equal(queries.length, 0); }
	}
});

test('Needs action loads pending, submitted-payment and processing requests with appropriate links', async () => {
	const rows = [
		{ request_id: 'REQ-2026-001', status: 'Pending', action_needed: 'Review requirements' },
		{ request_id: 'REQ-2026-002', status: 'Approved', payment_status: 'submitted', action_needed: 'Verify payment' },
		{ request_id: 'REQ-2026-003', status: 'processing', action_needed: 'Mark ready for pickup' }
	].map(row => ({ ...row, first_name: 'Juan', last_name: 'Cruz', student_id: '26-0007', program: 'Master of Arts', date_requested: '2020-10-10T00:00:00Z' }));
	for (const role of ['Admin', 'Staff', 'Student', 'Unknown']) {
		const queries = [];
		const endpoint = load('src/routes/staff/dashboard/+page.server.ts', { ...sessions, '$lib/server/db': { default: { execute: async sql => { queries.push(sql); return [sql.includes('CASE WHEN') ? rows.map(row => ({ ...row })) : sql.includes('COUNT(*)') ? [{ n: 0 }] : []]; } } }, '$lib/server/request-items': { fetchRequestItems: async ids => new Map(ids.map(id => [id, [{ document_id: 1, name: 'Transcript' }]])), documentNameSummary: items => items.map(item => item.name).join(', ') } });
		if (!['Admin', 'Staff'].includes(role)) { await assert.rejects(() => endpoint.load({ cookies: cookies(role) }), error => error.status === 302); assert.equal(queries.length, 0); continue; }
		const data = await endpoint.load({ cookies: cookies(role) });
		const query = queries.find(sql => sql.includes('CASE WHEN')); assert.match(query, /r\.status IN \('Pending', 'processing'\)/); assert.match(query, /r\.status = 'Approved' AND p\.status = 'submitted'/); assert.match(query, /r\.archived_at IS NULL/);
		const html = renderPage('src/routes/staff/dashboard/+page.svelte', data);
		assert.match(html, />Needs action<\/h2>/); assert.doesNotMatch(html, /Pending Approval Queue/);
		for (const row of rows) { assert.ok(html.includes(row.action_needed)); assert.ok(html.includes(`/staff/requests/${row.request_id}`)); }
		assert.ok(html.includes('3 requests awaiting action'));
	}
});
