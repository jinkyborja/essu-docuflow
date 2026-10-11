const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const {compile}=require('svelte/compiler'),{render}=require('svelte/server');
function load(filename,fetch) {
 const module={exports:{}};
 const source=fs.readFileSync(filename,'utf8');
 const code=filename.endsWith('.svelte')?compile(source,{filename,generate:'server'}).js.code:source;
 const requireModule=name=>{if(name.startsWith('$lib/')) {const file=name.replace('$lib/','src/lib/');return load(file.endsWith('.svelte')?file:file+'.ts',fetch);}if(name.startsWith('.')){const file=path.resolve(path.dirname(filename),name);return load(path.extname(file)?file:file+'.ts',fetch);}return require(name);};
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireModule,fetch,Date,Intl,URL,setTimeout,clearTimeout});
 return module.exports;
}
test('Names retain complete middle names and omit missing components without double spaces',()=>{
 const {formatName}=load('src/lib/formatting.ts');
 assert.equal(formatName('Jericho','Samonte','Cortez'),'Jericho Samonte Cortez');
 assert.equal(formatName(' Mark   Anthony ',' Aquino ',' Lacro '),'Mark Anthony Aquino Lacro');
 for(const middle of [null,undefined,'','  ']) assert.equal(formatName('Jhon',middle,'Doe'),'Jhon Doe');
});
test('Request chips use the exact KPI labels and include an accessible icon/text label',()=>{
 const {statusLabel}=load('src/lib/request-status.ts');
 for(const [value,label] of [['pending','Pending'],['Correction Requested','Correction Requested'],['approved','Approved'],['rejected','Rejected']]) {
  assert.equal(statusLabel(value),label);
  const html=render(load('src/lib/components/ui/StatusChip.svelte').default,{props:{value}}).body;
  assert.ok(html.includes(`Request status: ${label}`));assert.match(html,/aria-hidden="true"/);assert.ok(html.includes(label));
 }
 for(const kind of ['email','id']) {
  const html=render(load('src/lib/components/ui/StatusChip.svelte').default,{props:{kind,value:'verified'}}).body;
  assert.ok(html.includes('status: Verified'));assert.ok(html.includes(kind==='email'?'text-blue-800':'text-green-800'));
 }
});
test('Usage guards prevent deleting students and documents referenced by requests',()=>{
 const {studentHasRequests,documentHasRequests}=load('src/lib/admin-requests.ts');
 const requests=[{request_id:'REQ-1',student_code:'24-0110',items:[{document_id:5,name:'Enrollment'}]}];
 assert.equal(studentHasRequests(' 24-0110 ',requests),true);assert.equal(studentHasRequests('21-0054',requests),false);
 assert.equal(documentHasRequests(5,requests),true);assert.equal(documentHasRequests(6,requests),false);
});
test('Recent activity includes submitted requests even without status history, then merges and sorts both sources',()=>{
 const {recentActivity}=load('src/lib/admin-requests.ts');
 const requests=[{request_id:'REQ-1',date_requested:'2026-10-11T09:00:00',items:[{document_id:5,name:'Enrollment'}]}];
 const submitted=recentActivity([],requests);assert.equal(submitted.length,1);assert.equal(submitted[0].new_status,'Request submitted');assert.equal(submitted[0].document_name,'Enrollment');
 const activity=recentActivity([{history_id:1,request_id:'REQ-1',new_status:'Approved',changed_at:'2026-10-11T10:00:00'}],requests);
 assert.equal(activity.length,2);assert.equal(activity[0].new_status,'Approved');assert.equal(activity[1].new_status,'Request submitted');
 const latest=recentActivity([],Array.from({length:8},(_,index)=>({...requests[0],request_id:'REQ-'+index,date_requested:`2026-10-${String(index+1).padStart(2,'0')}T09:00:00`})));assert.equal(latest.length,5);assert.equal(latest[0].request_id,'REQ-7');
});
test('Request usage loading reports server, network and invalid response failures',async()=>{
 for(const fetch of [async()=>Response.json({error:'Not authorized'},{status:403}),async()=>Response.json({invalid:true}),async()=>{throw new Error('Network failed');}]) await assert.rejects(load('src/lib/admin-requests.ts',fetch).fetchAdminRequests());
 const calls=[];const {fetchAdminRequests}=load('src/lib/admin-requests.ts',async url=>{calls.push(url);return Response.json([]);});
 assert.equal((await fetchAdminRequests()).length,0);assert.deepEqual(calls,['/api/requests']);
});
