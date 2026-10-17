const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const {compile}=require('svelte/compiler'),{render}=require('svelte/server');
const {writable}=require('svelte/store');
function load(filename,imports={},source){
 const module={exports:{}};
 const code=filename.endsWith('.svelte')?compile(source??fs.readFileSync(filename,'utf8'),{filename,generate:'server'}).js.code:fs.readFileSync(filename,'utf8');
 const resolve=name=>{if(name in imports)return imports[name];if(name==='pdfjs-dist/build/pdf.worker.min.mjs?url')return 'qa-pdf-worker.mjs';if(name.startsWith('$lib/')){const file=name.replace('$lib/','src/lib/');return load(file.endsWith('.svelte')?file:file+'.ts',imports);}if(name.startsWith('.')){const file=path.resolve(path.dirname(filename),name);return load(path.extname(file)?file:file+'.ts',imports);}return require(name);};
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:resolve,Date,Intl,URL,File,FormData,Response,setTimeout,clearTimeout,fetch:async()=>{throw new Error('No live fetch allowed');}});
 return module.exports;
}
const imports={'$app/navigation':{goto:async()=>{},invalidateAll:async()=>{},beforeNavigate:()=>{}},'$app/stores':{page:writable({url:new URL('http://localhost/student/dashboard'),data:{}}),navigating:writable(null)},'$lib/stores/notifications':{notifUnreadCount:writable(0),startNotifications:()=>()=>{}},'$lib/stores/sidebar':{sidebarCollapsed:writable(false),sidebarMobileOpen:writable(false)}};
const html=(file,props,source)=>render(load(file,imports,source).default,{props}).body;
test('Historical and shared requirements are all retained when mapping documents to their files',()=>{
 const {documentRequirementGroups:groups}=load('src/lib/student-request-display.ts');
 const items=[{document_id:1,name:'Enrollment'},{document_id:2,name:'Exam'}],reqs=[{name:'Clearance'},{name:'Valid ID'},{name:'Old requirement'}];
 const result=groups(items,reqs,[{document_id:1,name:'Enrollment',requirements:[{name:'clearance'},{name:'Valid ID'}]},{document_id:2,name:'Exam',requirements:[{name:'Clearance'}]}],'Fallback');
 assert.equal(result[0].requirements.length,2);assert.equal(result[1].requirements[0].name,'Clearance');assert.equal(result[2].requirements[0].name,'Old requirement');
 assert.equal(groups([],reqs,[],'Historical document')[0].name,'Historical document');assert.equal(groups(items,reqs,[],'Fallback').at(-1).requirements.length,3);
});
test('The timeline distinguishes current review, corrections, future pickup and release',()=>{
 const {requestTimeline}=load('src/lib/student-request-display.ts');
 const date='2026-10-11T08:00:00Z';
 const pending=requestTimeline('Pending',date,[{new_status:'Pending',changed_at:date}]);assert.equal(pending.filter(step=>step.state==='current').length,1);assert.equal(pending.filter(step=>step.label==='Office review').length,1);assert.ok(pending.some(step=>step.label==='Ready for Release' && step.state==='upcoming'));assert.equal(pending.at(-1).label,'Released');assert.equal(pending.at(-1).state,'upcoming');
 const correction=requestTimeline('Correction Requested',date,[{new_status:'Correction Requested',changed_at:'2026-10-11T09:00:00Z'}]);assert.equal(correction.find(step=>step.state==='current').label,'Needs correction');
 const ready=requestTimeline('Approved',date,[{new_status:'Approved',changed_at:date}],true);assert.equal(ready.find(step=>step.state==='current').label,'Ready for Release');assert.equal(ready.at(-1).label,'Released');
 const completed=requestTimeline('Approved',date,[{new_status:'Approved',changed_at:date},{new_status:'Completed',changed_at:'2026-10-11T10:00:00Z'}],true);assert.ok(completed.every(step=>step.state==='done'));assert.equal(completed.at(-1).label,'Released');
 assert.match(html('src/lib/components/ui/StatusChip.svelte',{value:'completed',kind:'request'}),/>Released</);
 const rejected=requestTimeline('Rejected',date);assert.equal(rejected.at(-1).label,'Rejected');assert.ok(!rejected.some(step=>step.state==='upcoming'));
});
test('Rejected review requires a new photo or note, and renders the reason and three clear steps',()=>{
 const result=html('src/lib/components/ui/VerificationHelp.svelte',{reason:'Photo is blurry'});
 assert.match(result,/Your ID could not be verified/);assert.match(result,/Photo is blurry/);assert.match(result,/Upload a clear photo/);assert.match(result,/Add a note/);assert.match(result,/\/student\/profile#school-id-photo-card/);assert.match(result,/Upload a new ID photo or type a note/);
 const button=(result.match(/<button\b[^]*?<\/button>/g)??[]).find(button=>button.includes('Resubmit for review'));assert.match(button,/disabled/);
});
test('Dashboard next-step instructions match pending, rejected and verified accounts',()=>{
 const expected={pending:'Wait for the office to finish reviewing. You can browse Forms meanwhile.',rejected:'Upload a new ID photo, then resubmit.',verified:'Choose Request Document to start.'};
 for(const [idStatus,message]of Object.entries(expected)){
  const result=html('src/routes/student/dashboard/+page.svelte',{data:{layoutUser:{idStatus},requests:[],recentHistory:[]}});assert.ok(result.includes(message));assert.equal(result.includes('Available after your ID is verified'),idStatus!=='verified');assert.equal(result.includes('fa-lock'),idStatus!=='verified');
 }
});
test('Student tutorial renders workflow steps and searchable help topics',()=>{
 const result=html('src/routes/student/help/+page.svelte',{});
 assert.match(result,/New to DocuFlow\?/);assert.match(result,/Start tutorial/);assert.match(result,/Request Document/);
 assert.match(result,/How DocuFlow Works/);assert.equal((result.match(/class="guide-icon\b/g)??[]).length,6);
 for(const title of ['Getting Started','Requesting Documents','Uploading Requirements','Reviewing and Submitting','Tracking Requests','Notifications'])assert.match(result,new RegExp(title));
 assert.match(result,/Frequently Asked Questions/);assert.equal((result.match(/<details\b/g)??[]).length,12);
 assert.match(result,/How do I request school documents\?/);assert.match(result,/What if my ID verification fails\?/);assert.match(result,/What if I upload the wrong file\?/);assert.match(result,/What should I do if a request requires corrections\?/);
 assert.match(result,/type="search"/);assert.match(result,/My Documents/);assert.match(result,/data-student-tour="student-help-restart"/);assert.match(result,/Need More Help\?/);
});
test('Student tutorial uses persisted per-student completion and stable targets without mutating requests',()=>{
 const source=fs.readFileSync('src/lib/components/student/StudentTutorial.svelte','utf8');
 assert.match(source,/essu-docuflow:student-tutorial:v1:\$\{userId\}/);
 assert.match(source,/localStorage\.getItem\(storageKey\)/);assert.match(source,/localStorage\.setItem\(storageKey, 'completed'\)/);
 assert.match(source,/student-tutorial:start/);assert.match(source,/data-student-tour/);
 assert.match(source,/Navigation was cancelled/);assert.match(source,/Escape/);assert.match(source,/ArrowRight/);assert.match(source,/ArrowLeft/);
 assert.match(source,/!tutorialCompleted && !tutorialOpen && \$page\.url\.pathname === '\/student\/dashboard'/);
 assert.match(source,/Welcome to ESSU DocuFlow/);assert.match(source,/Start tutorial/);assert.match(source,/Skip tutorial/);
 assert.match(source,/You’re ready to get started/);assert.match(source,/role="dialog"/);assert.match(source,/aria-modal="true"/);
 assert.match(source,/tutorial-spotlight/);assert.match(source,/ResizeObserver/);assert.match(source,/visualViewport/);assert.match(source,/portal\.inert = true/);
 assert.match(source,/@media \(max-width: 767px\)/);assert.match(source,/safe-area-inset-bottom/);assert.match(source,/prefers-reduced-motion/);
 assert.doesNotMatch(source,/fetch\(|uploadRequirementFiles|\/api\/requests/);
 const help=html('src/routes/student/help/+page.svelte',{});
 assert.match(help,/data-student-tour="student-help-restart"/);
});
test('Wizard step one uses real checkboxes, names requirements, and has no Back action',()=>{
 const result=html('src/routes/student/request/+page.svelte',{data:{idStatus:'verified',documents:[{document_id:1,name:'Enrollment',requirements:[{name:'Clearance',in_person:false}]}]}});
 assert.match(result,/type="checkbox"/);assert.match(result,/Clearance/);assert.match(result,/Select at least one document/);assert.match(result,/<button[^>]*disabled[^>]*>[^]*?Back[^]*?<\/button>/);
 assert.match(result,/data-student-tour="request-select-document"/);assert.match(result,/data-student-tour="request-requirements-step"/);assert.match(result,/data-student-tour="request-review-step"/);
 assert.match(result,/Choose up to 5 documents/);assert.match(result,/shared by selected documents/);
 const source=fs.readFileSync('src/routes/student/request/+page.svelte','utf8');
 assert.match(source,/ConfirmDialog open=\{submitConfirmOpen\}/);assert.match(source,/Confirm submission/);
 assert.match(source,/beforeNavigate/);assert.match(source,/onbeforeunload=\{guardUnsavedUnload\}/);
});
test('Uploaded and correction file chips announce the file status',()=>{
 for(const [value,label]of [['uploaded','Uploaded'],['missing','Missing'],['needs_correction','Needs correction']])assert.ok(html('src/lib/components/ui/StatusChip.svelte',{kind:'file',value}).includes('File status: '+label));
});
test('Loading, load failure and empty request states show a status or next action',()=>{
 assert.match(html('src/lib/components/ui/LoadingState.svelte',{}),/role="status"/);
 const failure=html('src/lib/components/ui/ErrorState.svelte',{status:500,message:'Internal Error'});assert.match(failure,/Try again/);assert.doesNotMatch(failure,/Internal Error/);
 const empty=html('src/routes/student/documents/+page.svelte',{data:{requests:[]}});assert.match(empty,/No requests yet/);assert.match(empty,/Request a document/);
});
test('Dates use the office calendar and file sizes are readable',()=>{
 const {formatDate}=load('src/lib/request-flow.ts');assert.equal(formatDate('2026-10-11T08:00:00Z'),'Oct 11, 2026');assert.equal(formatDate('invalid'),'Not recorded');
 const {formatFileSize}=load('src/lib/student-files.ts');assert.equal(formatFileSize(1024),'1 KB');assert.equal(formatFileSize(1048576),'1.0 MB');
});
