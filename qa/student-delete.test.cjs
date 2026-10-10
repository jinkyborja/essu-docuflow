const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ requests = [{request_id: 'REQ-1', approved_file_path: 'approved.pdf'}], failDelete = false, failStorage = false } = {}) {
	const state = { held: false, committed: false, rolledBack: false, removed: [], queries: [] };
	const connection = {
		beginTransaction: async () => {},
		commit: async () => { state.committed = true; },
		rollback: async () => { state.rolledBack = true; },
		release: () => { state.held = false; },
		execute: async (sql, args) => {
			state.queries.push({ sql, args });
			if (sql.startsWith('SELECT user_id')) return [[{ user_id: 42 }]];
			if (sql.startsWith('SELECT request_id')) return [requests];
			if (sql.startsWith('SELECT file_path')) return [[{file_path:'signed.pdf'}, {file_path:'signed.pdf'}]];
			if (failDelete && sql.startsWith('DELETE FROM users')) throw Error('Database failure');
			return [{ affectedRows: 1 }];
		}
	};
	const pool = {
		execute: async () => { assert.equal(state.held, false, 'Must not request a second pool connection'); return [[{user_id:42}]]; },
		getConnection: async () => { state.held = true; return connection; }
	};
	const storage = { from: () => ({ remove: async paths => {
		assert.equal(state.held, false, 'Release DB connection before storage cleanup');
		assert.equal(state.committed, true, 'Commit before deleting files');
		state.removed = paths;
		if (failStorage) throw Error('Storage unavailable');
		return {error:null};
	} }) };
	const exports = {};
	const imports = {
		'@sveltejs/kit': {json: (body, options={}) => ({body,status:options.status ?? 200})},
		'$lib/server/db': {default:pool},
		'$lib/server/supabase': {supabase:{storage}},
		'$lib/server/jwt': {verifySession:async role => ({userId:9,role})},
		'$lib/school-year': {validateSchoolYear: () => null},
		'$env/static/private': {JWT_SECRET:'test'}
	};
	const code = ts.transpileModule(fs.readFileSync('src/routes/api/students/+server.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
	vm.runInNewContext(code,{exports,require: name => {if (!(name in imports)) throw Error('Unexpected import '+name);return imports[name];},console:{error(){}}});
	return {state, call: role => exports.DELETE({cookies:{get:()=>role},request:{json:async()=>({user_id:42})}})};
}

test('Student with requests deletes using one connection and releases it before deduplicated file cleanup', async () => {
	const {state,call} = fixture();
	const result = await call('Admin');
	assert.equal(result.status,200); assert.equal(result.body.deleted_requests,1);
	assert.equal(state.committed,true); assert.equal(state.rolledBack,false);
	assert.deepEqual(Array.from(state.removed),['signed.pdf','approved.pdf']);
	const files = state.queries.find(q=>q.sql.startsWith('SELECT file_path'));
	assert.ok(files.sql.includes('IN (?)')); assert.deepEqual(Array.from(files.args),['REQ-1']);
});
test('Student without requests skips storage cleanup',async()=>{
	const {state,call}=fixture({requests:[]}); assert.equal((await call('Admin')).status,200);
	assert.equal(state.committed,true); assert.equal(state.removed.length,0);
});
test('Database failure rolls back, releases connection and preserves stored files',async()=>{
	const {state,call}=fixture({failDelete:true}); assert.equal((await call('Admin')).status,500);
	assert.equal(state.rolledBack,true); assert.equal(state.committed,false); assert.equal(state.held,false); assert.equal(state.removed.length,0);
});
test('Storage failure cannot report an already committed deletion as failed',async()=>{
	const {state,call}=fixture({failStorage:true}); assert.equal((await call('Admin')).status,200);
	assert.equal(state.committed,true); assert.equal(state.rolledBack,false);
});
test('Student deletion remains admin only',async()=>{
	for (const role of ['Staff','Student']) {const {state,call}=fixture();assert.equal((await call(role)).status,403);assert.equal(state.queries.length,0);}
});
