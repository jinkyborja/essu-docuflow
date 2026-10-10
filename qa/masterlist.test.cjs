const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, imports = {}) {
	const exports = {};
	const kit = { json: (body, init = {}) => ({ body, status: init.status ?? 200 }), error: (status, message) => { throw Object.assign(new Error(message), {status}); } };
	vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {exports, require: name => imports[name] ?? (name === '@sveltejs/kit' ? kit : ['$lib/formatting', '$lib/school-year'].includes(name) ? load(name.replace('$lib/', 'src/lib/') + '.ts') : require(name)), Buffer, Date, File, TextDecoder, URL, console: {error() {}}});
	return exports;
}
const logic = load('src/lib/server/masterlist.ts', {'./jwt': {verifySession: async token => ({userId: 9, role: token})}, '$env/static/private': {JWT_SECRET: 'test-secret'}});
const cookies = role => ({get: () => role});
const admin = role => ({requireMasterlistAdmin: c => logic.requireMasterlistAdmin(c), parseCsv: logic.parseCsv, headers: logic.headers, validateRow: logic.validateRow});
const csv = 'student_id,last_name,first_name,middle_name,program,campus,status';
test('CSV supports BOM, CRLF, commas, quotes and multiline fields; rejects malformed CSV', () => {
	assert.equal(JSON.stringify(logic.parseCsv('\uFEFFa,b\r\n"Dela, Cruz","A""B"\r\n"two\nlines",ok')), JSON.stringify([['a','b'],['Dela, Cruz','A"B'],['two\nlines','ok']]));
	assert.throws(() => logic.parseCsv('a,"unclosed'));
	assert.throws(() => logic.parseCsv('"a"suffix,b'));
});
test('Every row validates required values, field sizes, controls and column counts', () => {
	const valid = ['26-0001','Cruz','Juan','','Master of IT','Guiuan','Enrolled'];
	assert.equal(logic.validateRow(valid, logic.headers), null);
	for (const index of [0,1,2,4]) { const row = [...valid]; row[index] = ''; assert.match(logic.validateRow(row, logic.headers), /required/); }
	const long = [...valid]; long[0] = 'x'.repeat(21); assert.match(logic.validateRow(long, logic.headers), /exceeds/);
	const control = [...valid]; control[1] = 'Cruz\u0000'; assert.match(logic.validateRow(control, logic.headers), /control/);
	assert.match(logic.validateRow(valid.slice(1), logic.headers), /Column count/);
});
test('Comparisons ignore accents, case and repeated whitespace; absent campus is missing', () => {
	const row = {id:1,student_id:'26-0001',first_name:'Jos\u00e9',middle_name:null,last_name:'Dela Cruz',program:'Master of IT',campus:'Guiuan'};
	const match = logic.compare({first_name:' JOSE ',middle_name:'',last_name:'dela   cruz',program:' master OF it ',campus:'GUIUAN'}, row);
	assert.equal(match.name, 'match'); assert.equal(match.program,'match'); assert.equal(match.campus,'match');
	assert.equal(logic.compare({...row, campus: null}, row).campus,'missing');
	assert.equal(logic.compare({...row, first_name: 'Other'},row).name,'mismatch');
	assert.equal(logic.compare(row,null).found,false);
});
test('Masterlist role check permits Admin only', async () => {
	await logic.requireMasterlistAdmin(cookies('Admin'));
	for (const role of ['Staff','Student']) await assert.rejects(() => logic.requireMasterlistAdmin(cookies(role)), e => e.status === 403);
	await assert.rejects(() => logic.requireMasterlistAdmin(cookies(null)), e => e.status === 401);
});
function importer(fail = false) {
	const state = {begun:false,committed:false,rolledBack:false,queries:[], ids:new Set()};
	const conn = {beginTransaction:async()=>{state.begun=true;},commit:async()=>{state.committed=true;},rollback:async()=>{state.rolledBack=true;},release(){},execute:async(sql,args)=>{
		state.queries.push({sql,args});
		if(sql.startsWith('SELECT')) return [[...(state.ids.has(args[0]) ? [{id:1}] : [])]];
		if(fail) throw new Error('write failed'); state.ids.add(args[0]); return [{affectedRows:1}];
	}};
	const endpoint = load('src/routes/api/masterlist/import/+server.ts', {'$lib/server/db':{default:{getConnection:async()=>conn}},'$lib/server/masterlist':admin()});
	const call = async (text,role='Admin') => endpoint.POST({cookies:cookies(role), request:{formData:async()=>{const data = new FormData();data.append('file',new File([text],'../../unsafe.sql'));return data;}}});
	return {state,call};
}
test('Import adds, updates duplicate IDs, skips invalid rows, and never writes users', async () => {
	const {state,call} = importer();
	const result = await call(csv + '\n26-0001,Cruz,Juan,,Master of IT,Guiuan,Enrolled\n26-0001,Cruz,Juan,,Updated program,Guiuan,Enrolled\n,Missing,Juan,,Master of IT,Guiuan,');
	assert.equal(result.status,200);assert.equal(result.body.added,1);assert.equal(result.body.updated,1);assert.equal(result.body.skipped,1);assert.equal(result.body.reasons[0].row,4);
	assert.equal(state.committed,true);assert.equal(state.rolledBack,false);
	assert.ok(state.queries.every(q => !q.sql.includes('users')));assert.ok(state.queries.every(q => q.sql.includes('?')));
});
test('Import rolls back on write failure and rejects invalid headers or files above 2 MB', async () => {
	const {state,call} = importer(true);assert.equal((await call(csv+'\n26-0001,Cruz,Juan,,Master of IT,Guiuan,')).status,500);assert.equal(state.rolledBack,true);assert.equal(state.committed,false);
	assert.equal((await importer().call('bad,headers\n1,2')).status,400);
	assert.equal((await importer().call('x'.repeat(2*1024*1024+1))).status,413);
});
function decisions(studentStatus='pending', found=false) {
	const writes=[];let committed=false,rolledBack=false;
	const conn={beginTransaction:async()=>{},commit:async()=>{committed=true;},rollback:async()=>{rolledBack=true;},release(){},execute:async(sql,args)=>{
		if(sql.startsWith('SELECT user_id')) return [[{user_id:1,student_id:'26-0001',id_status:studentStatus,id_photo_path:'1/11111111-1111-4111-8111-111111111111.jpg'}]];
		if(sql.startsWith('SELECT id')) return [found ? [{id:1}] : []];
		writes.push({sql,args});return [{}];
	}};
	const endpoint=load('src/routes/api/students/[id]/verify/+server.ts',{'$lib/server/db':{default:{getConnection:async()=>conn}},'$lib/server/jwt':{verifySession:async token=>({userId:9,role:token})},'$env/static/private':{JWT_SECRET:'test-secret'}});
	return {writes,call:async(body,role='Admin')=>endpoint.POST({request:{json:async()=>body},cookies:cookies(role),params:{id:'1'}}),state:()=>({committed,rolledBack})};
}
test('Missing ID requires explicit override and note; note is stored; found ID remains a manual decision',async()=>{
	for(const body of [{action:'verify'},{action:'verify',verifyAnyway:true},{action:'verify',note:'Checked paper list'}]) { const d=decisions();assert.equal((await d.call(body)).status,400);assert.equal(d.writes.length,0);assert.equal(d.state().rolledBack,true); }
	const override=decisions();assert.equal((await override.call({action:'verify',verifyAnyway:true,note:'Checked paper list'})).status,200);assert.equal(override.writes[0].args[3],'Checked paper list');assert.equal(override.state().committed,true);
	const found=decisions('pending',true);assert.equal((await found.call({action:'verify'})).status,200);assert.equal(found.writes[0].args[0],'verified');
});
test('Decisions require Admin; verified IDs require revocation with a reason and become rejected',async()=>{
	for(const role of ['Staff','Student']) assert.equal((await decisions().call({action:'verify'},role)).status,403);
	assert.equal((await decisions('verified',true).call({action:'verify'})).status,409);
	assert.equal((await decisions('rejected').call({action:'revoke'})).status,400);
	assert.equal((await decisions('verified').call({action:'revoke',confirm:true})).status,400);
	const d=decisions('verified');assert.equal((await d.call({action:'revoke',confirm:true,reason:'Incorrect ID'})).status,200);assert.equal(d.writes[0].args[0],'rejected');assert.equal(d.writes[0].args[2],'Incorrect ID');
	assert.equal((await decisions().call({action:'reject'})).status,400);
	const reject=decisions();assert.equal((await reject.call({action:'reject',reason:'ID not found'})).status,200);assert.equal(reject.writes[0].args[2],'ID not found');
});
test('Registration always inserts pending, ignoring any supplied verified ID status',async()=>{
	const queries=[];const pool={execute:async(sql,args)=>{queries.push({sql,args});return [[]];}};
	const endpoint=load('src/routes/api/register/+server.ts',{'$lib/server/db':{default:pool},'$lib/server/jwt':{signJwt:()=> 'test'},'$lib/server/email':{sendEmail:async()=>{}},'$env/static/private':{JWT_SECRET:'test-secret'}});
	const result=await endpoint.POST({request:{url:'http://localhost/api/register',json:async()=>({firstName:'Juan',lastName:'Cruz',dateOfBirth:'2000-01-01',email:'test@example.invalid',studentId:'26-0001',program:'Master of IT',studentType:'Enrolled',lastSchoolYear:2026,password:'test-password',id_status:'verified'})}});
	assert.equal(result.status,200);assert.match(queries.find(q=>q.sql.includes('INSERT INTO users')).sql, /FALSE, 'pending'/);assert.ok(queries.every(q=>!q.sql.startsWith('UPDATE users')));
});

test('Pending and rejected students remain unable to create requests (403 before uploads)', async () => {
	for (const status of ['pending','rejected']) {
		let formRead = false;
		const endpoint=load('src/routes/api/requests/+server.ts', {'$lib/server/db':{default:{execute:async()=>[[{id_status:status}]]}},'$lib/server/jwt':{verifySession:async()=>({userId:1,role:'Student'})},'$env/static/private':{JWT_SECRET:'test-secret'},'$lib/server/supabase':{supabase:{}},'$lib/server/requirements':{},'$lib/server/request-items':{},'$lib/server/upload-validation':{},'$lib/server/request-journey':{},'$lib/server/requirement-uploads':{}});
		const result=await endpoint.POST({cookies:cookies('Student'),request:{formData:async()=>{formRead=true;throw new Error('Must not accept uploads');}}});
		assert.equal(result.status,403);assert.equal(result.body.code,'ID_NOT_VERIFIED');assert.equal(formRead,false);
	}
});
test('Masterlist search is parameterized, paginated and restricted; delete validates ID', async () => {
	const queries=[];
	const pool={execute:async(sql,args)=>{queries.push({sql,args});return sql.includes('COUNT') ? [[{total:21}]] : sql.startsWith('DELETE') ? [{affectedRows:1}] : [[{id:1}]];}};
	const imports={'$lib/server/db':{default:pool},'$lib/server/masterlist':admin()};
	const list=load('src/routes/api/masterlist/+server.ts',imports);
	const response=await list.GET({cookies:cookies('Admin'),url:new URL('http://localhost/api/masterlist?search=Juan&page=2')});
	assert.equal(response.status,200);assert.equal(response.body.total,21);assert.equal(queries[1].args.at(-1),'20');assert.equal(queries[0].args[0],'%Juan%');
	assert.equal((await list.GET({cookies:cookies('Admin'),url:new URL('http://localhost/api/masterlist?page=0')})).status,400);
	await assert.rejects(()=>list.GET({cookies:cookies('Student'),url:new URL('http://localhost/api/masterlist')}),e=>e.status===403);
	const remove=load('src/routes/api/masterlist/[id]/+server.ts',imports);
	assert.equal((await remove.DELETE({cookies:cookies('Admin'),params:{id:'abc'}})).status,400);
	assert.equal((await remove.DELETE({cookies:cookies('Admin'),params:{id:'1'}})).status,200);
	assert.equal(queries.at(-1).sql,'DELETE FROM enrollment_masterlist WHERE id = ?');
});

test('Request guidance and date display explain every next action', () => {
	const flow=load('src/lib/request-flow.ts');
	assert.match(flow.nextStep('Pending'), /Waiting for office review/);
	assert.match(flow.nextStep('Correction Requested'), /flagged files/);
	assert.match(flow.nextStep('Approved',false,true), /Download/);
	assert.match(flow.nextStep('Approved',false,false), /release instructions/);
	assert.match(flow.nextStep('Rejected'), /reason/);
	assert.match(flow.nextStep('Approved',true,true), /Delivery recorded/);
	assert.equal(flow.formatDate('2008-12-18'), 'Dec 18, 2008');
	assert.equal(flow.formatDate(null),'Not recorded');
});
function delivery(status='Approved', duplicate=false) {
	const writes=[];let committed=false,rolledBack=false;
	const conn={beginTransaction:async()=>{},commit:async()=>{committed=true;},rollback:async()=>{rolledBack=true;},release(){},execute:async(sql,args)=>{
		if(sql.startsWith('SELECT status')) return [[{status}]];
		if(sql.startsWith('SELECT history_id')) return [duplicate?[{history_id:1}]:[]];
		writes.push({sql,args});return [{}];
	}};
	const endpoint=load('src/routes/api/requests/[id]/complete/+server.ts',{'$lib/server/db':{default:{getConnection:async()=>conn}},'$lib/server/jwt':{verifySession:async role=>({userId:9,role})},'$env/static/private':{JWT_SECRET:'test'}});
	return {writes,state:()=>({committed,rolledBack}),call:async(role,body={confirm:true})=>endpoint.POST({cookies:cookies(role),request:{json:async()=>body},params:{id:'REQ-1'}})};
}
test('Delivery requires office role, explicit confirmation and approval; duplicates cannot be recorded',async()=>{
	assert.equal((await delivery().call('Student')).status,403);
	assert.equal((await delivery().call('Admin',{})).status,400);
	assert.equal((await delivery('Pending').call('Admin')).status,409);
	assert.equal((await delivery('Approved',true).call('Staff')).status,409);
	const d=delivery();assert.equal((await d.call('Staff')).status,200);assert.equal(d.state().committed,true);
	assert.equal(d.writes[0].args[2],'Completed');assert.ok(d.writes.every(q=>!q.sql.startsWith('UPDATE requests')));
});
test('Journey includes correction/resubmission and delivery history in order',async()=>{
	const records=[{request_id:'REQ-1',new_status:'Correction Requested',changed_at:'2026-10-01'},{request_id:'REQ-1',new_status:'Pending',changed_at:'2026-10-02'},{request_id:'REQ-1',new_status:'Completed',changed_at:'2026-10-03'}];
	const journey=load('src/lib/server/request-journey.ts',{'./db':{default:{execute:async()=>[records]}}});
	const requests=[{request_id:'REQ-1'},{request_id:'REQ-2'}];await journey.attachRequestJourney(requests);
	assert.equal(requests[0].completed_at,'2026-10-03');assert.equal(requests[0].history.length,3);assert.equal(requests[1].completed_at,null);
});
test('Rejected ID rereview stores a bounded note, notifies admins and never verifies or resets the student',async()=>{
	for(const scenario of ['ok','pending','duplicate']) {
		const writes=[];
		const conn={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},execute:async(sql,args)=>{
			if(sql.startsWith('SELECT id_status')) return [[{id_status:scenario==='pending'?'pending':'rejected',student_id:'26-0001'}]];
			if(sql.startsWith('SELECT history_id')) return [scenario==='duplicate'?[{history_id:1}]:[]];
			if(sql.startsWith('SELECT user_id')) return [[{user_id:9}]];
			writes.push({sql,args});return [{}];
		}};
		const endpoint=load('src/routes/api/students/review-request/+server.ts',{'$lib/server/db':{default:{getConnection:async()=>conn}},'$lib/server/jwt':{verifySession:async role=>({userId:1,role})},'$env/static/private':{JWT_SECRET:'test'}});
		const call=(role,note='Please check my historical enrollment record')=>endpoint.POST({cookies:cookies(role),request:{json:async()=>({note})}});
		assert.equal((await call('Admin')).status,403);assert.equal((await call('Student','')).status,400);
		const response=await call('Student');assert.equal(response.status,scenario==='ok'?200:scenario==='pending'?409:429);
		if(scenario==='ok') {assert.match(writes[0].sql,/id_verification_note/);assert.equal(writes[1].args[0],'Student ID review requested');assert.ok(writes.every(q=>!q.sql.includes('SET id_status')));}
		else assert.equal(writes.length,0);
	}
});

test('Request detail GET still returns uploaded requirements and enforces ownership',async()=>{
	const endpoint=load('src/routes/api/requests/[id]/+server.ts',{'$lib/server/db':{default:{execute:async(sql)=>sql.includes('SELECT r.*')?[[{request_id:'REQ-1',student_id:1}]]:[[]]}},'$lib/server/jwt':{verifySession:async role=>({userId:1,role})},'$env/static/private':{JWT_SECRET:'test'},'$lib/server/requirements':{fetchOneRequestRequirements:async()=>[{name:'Clearance Form',file_path:'upload.pdf'}]},'$lib/server/request-items':{fetchRequestItems:async()=>new Map([['REQ-1',[{document_id:1,name:'Certificate'}]]]),documentNameSummary:items=>items[0].name},'$lib/server/supabase':{},'$lib/server/email':{},'$lib/server/upload-validation':{}});
	const res=await endpoint.GET({params:{id:'REQ-1'},cookies:cookies('Student')});assert.equal(res.status,200);assert.equal(res.body.requirements[0].file_path,'upload.pdf');
});
test('Office corrections are transactional, require real uploaded requirement names, and reject stale decisions',async()=>{
	for(const scenario of ['valid','invalid','stale']) {
		const writes=[];let committed=false,rolledBack=false;
		const conn={beginTransaction:async()=>{},commit:async()=>{committed=true;},rollback:async()=>{rolledBack=true;},release(){},execute:async(sql,args)=>{
			if(sql.startsWith('SELECT status')) return [[{status:scenario==='stale'?'Approved':'Pending'}]];
			if(sql.startsWith('SELECT rq.name')) return [[{name:'Clearance Form',in_person:false}]];
			writes.push({sql,args});return [{}];
		}};
		const pool={getConnection:async()=>conn,execute:async()=>[[{request_id:'REQ-1',status:'Pending',student_email:'test@example.invalid',student_name:'Test Student'}]]};
		const endpoint=load('src/routes/api/requests/[id]/+server.ts',{'$lib/server/db':{default:pool},'$lib/server/jwt':{verifySession:async()=>({userId:9,role:'Staff'})},'$env/static/private':{JWT_SECRET:'test'},'$lib/server/requirements':{},'$lib/server/request-items':{fetchRequestItems:async()=>new Map([['REQ-1',[{document_id:1,name:'Certificate'}]]]),documentNameSummary:items=>items[0].name},'$lib/server/supabase':{},'$lib/server/email':{sendEmail:async()=>{}},'$lib/server/upload-validation':{}});
		const res=await endpoint.PATCH({params:{id:'REQ-1'},cookies:cookies('Staff'),request:{headers:{get:()=> 'application/json'},json:async()=>({action:'correction',admin_message:'Please upload a signed form',flagged_requirements:scenario==='invalid'?['Fake Requirement']:['Clearance Form']})}});
		assert.equal(res.status,scenario==='valid'?200:scenario==='stale'?409:400);
		assert.equal(committed,scenario==='valid');assert.equal(rolledBack,scenario!=='valid');
		if(scenario==='valid'){assert.equal(writes.length,3);assert.equal(writes[1].args[0],'Correction Requested');}else assert.equal(writes.length,0);
	}
});
