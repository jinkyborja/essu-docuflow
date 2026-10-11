const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(filename, imports = {}) {
	const module = { exports: {} };
	const source = fs.readFileSync(filename, 'utf8');
	const resolve = (name) => {
		if (Object.hasOwn(imports, name)) return imports[name];
		if (name === '@sveltejs/kit') return { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers }) };
		if (name.startsWith('$lib/')) {
			const target = name.replace('$lib/', 'src/lib/');
			return load(path.extname(target) ? target : `${target}.ts`, imports);
		}
		if (name.startsWith('.')) {
			const target = path.resolve(path.dirname(filename), name);
			return load(path.extname(target) ? target : `${target}.ts`, imports);
		}
		return require(name);
	};
	vm.runInNewContext(
		ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
		{ module, exports: module.exports, require: resolve, Date, Intl, URL, URLSearchParams, console }
	);
	return module.exports;
}

const body = {
	firstName: 'Juan', middleName: 'Santos', lastName: 'Cruz', dateOfBirth: '2000-01-01',
	email: 'qa@example.invalid', studentId: '26-0001', program: 'Master of IT', campus: 'Guiuan',
	studentType: 'Enrolled', lastSchoolYear: 2026, password: 'fake-password'
};

function fixture(options = {}) {
	const state = { queries: [], emails: [], committed: false, rolledBack: false, released: false, student: null };
	const execute = async (sql, args, connection) => {
		state.queries.push({ sql, args, connection });
		if (sql.includes('INSERT INTO users')) {
			if (options.failInsert) throw new Error('Fake database failure');
			if (options.duplicateRace) throw Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' });
			state.student = { user_id: 8, first_name: args[0], middle_name: args[1], last_name: args[2], student_id: args[7], program: args[8], campus: args[11], id_status: 'pending' };
			return [{ insertId: 8 }];
		}
		if (sql.includes("role = 'Admin'")) return [[{ user_id: 9 }]];
		return [options.duplicate ? [{ user_id: 7 }] : []];
	};
	const conn = {
		beginTransaction: async () => {}, commit: async () => { state.committed = true; }, rollback: async () => { state.rolledBack = true; state.student = null; },
		release: () => { state.released = true; }, execute: (sql, args) => execute(sql, args, true)
	};
	const pool = { execute: (sql, args) => execute(sql, args, false), getConnection: async () => conn };
	const endpoint = load('src/routes/api/register/+server.ts', {
		'$lib/server/db': { __esModule: true, default: pool }, '$lib/server/jwt': { signJwt: () => 'fake-email-token' },
		'$lib/server/email': { sendEmail: async (email) => { state.emails.push(email); if (options.failEmail) throw new Error('Fake email failure'); } },
		'$env/static/private': { JWT_SECRET: 'signup-test-secret' }
	});
	return { state, run: (patch = {}) => endpoint.POST({ request: { url: 'http://localhost/api/register', json: async () => ({ ...body, ...patch }) } }) };
}

test('Registration creates a pending student without accepting client verification state', async () => {
	const f = fixture();
	const response = await f.run({ id_status: 'verified', verified: true });
	assert.equal(response.status, 200);
	assert.equal(f.state.committed, true);
	assert.equal(f.state.released, true);
	assert.equal(f.state.student.id_status, 'pending');
	const insert = f.state.queries.find((query) => query.sql.includes('INSERT INTO users'));
	assert.match(insert.sql, /FALSE, 'pending'/);
	assert.equal(f.state.emails.length, 1);
});

test('Registration validates the required campus before writing an account', async () => {
	for (const patch of [{ campus: '' }, { campus: 'Unknown' }]) {
		const f = fixture();
		assert.equal((await f.run(patch)).status, 400);
		assert.equal(f.state.queries.length, 0);
	}
});

test('Registration rolls back failed writes and reports email failures after the account is saved', async () => {
	for (const options of [{ failInsert: true }, { duplicateRace: true }]) {
		const f = fixture(options);
		assert.equal((await f.run()).status, options.duplicateRace ? 409 : 500);
		assert.equal(f.state.committed, false);
		assert.equal(f.state.rolledBack, true);
	}
	const emailFailure = fixture({ failEmail: true });
	const response = await emailFailure.run();
	assert.equal(response.status, 502);
	assert.equal(response.body.accountCreated, true);
	assert.equal(emailFailure.state.committed, true);
});
