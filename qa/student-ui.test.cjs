const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const {compile}=require('svelte/compiler'),{render}=require('svelte/server');
const {writable}=require('svelte/store');
function load(filename,imports={},source){
 const module={exports:{}};
 const code=filename.endsWith('.svelte')?compile(source??fs.readFileSync(filename,'utf8'),{filename,generate:'server'}).js.code:fs.readFileSync(filename,'utf8');
 const resolve=name=>{if(name in imports)return imports[name];if(name.startsWith('$lib/')){const file=name.replace('$lib/','src/lib/');return load(file.endsWith('.svelte')?file:file+'.ts',imports);}if(name.startsWith('.')){const file=path.resolve(path.dirname(filename),name);return load(path.extname(file)?file:file+'.ts',imports);}return require(name);};
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:resolve,Date,Intl,URL,File,FormData,Response,setTimeout,clearTimeout,fetch:async()=>{throw new Error('No live fetch allowed');}});
 return module.exports;
}
const imports={'$app/environment':{browser:false},'$app/navigation':{goto:async()=>{},invalidateAll:async()=>{}},'$app/stores':{page:writable({url:new URL('http://localhost/student/dashboard'),data:{}}),navigating:writable(null)},'$lib/stores/notifications':{notifUnreadCount:writable(0),startNotifications:()=>()=>{}},'$lib/stores/sidebar':{sidebarCollapsed:writable(false),sidebarMobileOpen:writable(false)},'$lib/stores/toasts':{showToast:()=>{}}};
const html=(file,props,source)=>render(load(file,imports,source).default,{props}).body;
test('Historical and shared requirements are all retained when mapping documents to their files',()=>{
 const {documentRequirementGroups:groups}=load('src/lib/student-request-display.ts');
 const items=[{document_id:1,name:'Enrollment'},{document_id:2,name:'Exam'}],reqs=[{name:'Clearance'},{name:'Valid ID'},{name:'Old requirement'}];
 const result=groups(items,reqs,[{document_id:1,name:'Enrollment',requirements:[{name:'clearance'},{name:'Valid ID'}]},{document_id:2,name:'Exam',requirements:[{name:'Clearance'}]}],'Fallback');
 assert.equal(result[0].requirements.length,2);assert.equal(result[1].requirements[0].name,'Clearance');assert.equal(result[2].requirements[0].name,'Old requirement');
 assert.equal(groups([],reqs,[],'Historical document')[0].name,'Historical document');assert.equal(groups(items,reqs,[],'Fallback').at(-1).requirements.length,3);
});
test('The timeline distinguishes current review, corrections, future release and recorded delivery',()=>{
 const {requestTimeline}=load('src/lib/student-request-display.ts');
 const date='2026-10-11T08:00:00Z';
 const pending=requestTimeline('Pending',date,[{new_status:'Pending',changed_at:date}]);assert.equal(pending.filter(step=>step.state==='current').length,1);assert.equal(pending.filter(step=>step.label==='Office review').length,1);assert.equal(pending.at(-1).state,'upcoming');
 const correction=requestTimeline('Correction Requested',date,[{new_status:'Correction Requested',changed_at:'2026-10-11T09:00:00Z'}]);assert.equal(correction.find(step=>step.state==='current').label,'Needs correction');
 const completed=requestTimeline('Approved',date,[{new_status:'Approved',changed_at:date},{new_status:'Completed',changed_at:'2026-10-11T10:00:00Z'}],true);assert.ok(completed.every(step=>step.state==='done'));assert.equal(completed.at(-1).label,'Delivery recorded');
 const rejected=requestTimeline('Rejected',date);assert.equal(rejected.at(-1).label,'Rejected');assert.ok(!rejected.some(step=>step.state==='upcoming'));
});
test('Rejected review requires an updated detail or note, and renders the reason and three clear steps',()=>{
	const result=html('src/lib/components/ui/VerificationHelp.svelte',{reason:'Name does not match'});
	assert.match(result,/Your ID could not be verified/);assert.match(result,/Name does not match/);assert.equal((result.match(/<li\b/g)??[]).length,3);assert.match(result,/\/student\/profile#academic-information/);assert.match(result,/Edit your details or add a note first/);
 const button=(result.match(/<button\b[^]*?<\/button>/g)??[]).find(button=>button.includes('Resubmit for review'));assert.match(button,/disabled/);
});
test('Dashboard next-step instructions match pending, rejected and verified accounts',()=>{
	const expected={pending:'Wait for the office to finish reviewing. You can browse Forms meanwhile.',rejected:'Check your details, then resubmit.',verified:'Choose Request Document to start.'};
 for(const [idStatus,message]of Object.entries(expected)){
  const result=html('src/routes/student/dashboard/+page.svelte',{data:{layoutUser:{idStatus},requests:[],recentHistory:[]}});assert.ok(result.includes(message));assert.equal(result.includes('Available after your ID is verified'),idStatus!=='verified');assert.equal(result.includes('fa-lock'),idStatus!=='verified');
 }
});
test('Wizard step one uses real checkboxes, names requirements, and has no Back action',()=>{
 const result=html('src/routes/student/request/+page.svelte',{data:{idStatus:'verified',documents:[{document_id:1,name:'Enrollment',requirements:[{name:'Clearance',in_person:false}]}]}});
 assert.match(result,/type="checkbox"/);assert.match(result,/Clearance/);assert.match(result,/Select at least one document/);assert.doesNotMatch(result,/> Back|>Back|1 requirement/);
});
test('Uploaded and correction file chips announce the file status',()=>{
 for(const [value,label]of [['uploaded','Uploaded'],['missing','Missing'],['needs_correction','Needs correction']])assert.ok(html('src/lib/components/ui/StatusChip.svelte',{kind:'file',value}).includes('File status: '+label));
});
test('Loading, load failure and empty request states show a status or next action',()=>{
 assert.match(html('src/lib/components/ui/LoadingState.svelte',{}),/role="status"/);
 const failure=html('src/lib/components/ui/ErrorState.svelte',{status:500,message:'Internal Error'});assert.match(failure,/Try again/);assert.doesNotMatch(failure,/Internal Error/);
 const empty=html('src/routes/student/documents/+page.svelte',{data:{requests:[],layoutUser:{idStatus:"verified"}}});assert.match(empty,/No requests yet/);assert.match(empty,/Request a document/);
});
test('Dates use the office calendar and file sizes are readable',()=>{
 const {formatDate}=load('src/lib/request-flow.ts');assert.equal(formatDate('2026-10-11T08:00:00Z'),'Oct 11, 2026');assert.equal(formatDate('invalid'),'Not recorded');
 const {formatFileSize}=load('src/lib/student-files.ts');assert.equal(formatFileSize(1024),'1 KB');assert.equal(formatFileSize(1048576),'1.0 MB');
});
