import { mount } from 'svelte';
import '../../../src/app.css';
import Harness from './Harness.svelte';

const students = Array.from({ length: 9 }, (_, index) => ({
	user_id: index + 1, first_name: 'Student', middle_name: 'Middle', last_name: String(index + 1),
	suffix: null, email: index === 0 ? 'a-very-long-student-email-address-for-responsive-layout-checks@example.invalid' : `student${index + 1}@example.invalid`, student_id: `QA-00${index + 1}`,
	program: index === 0 ? 'Master of Science in Hospitality Management and Sustainable Tourism' : 'Master of Arts in Education', student_type: 'Enrolled', last_school_year: 2026,
	verified: true, id_status: index % 2 ? 'pending' : 'verified', id_verified_at: null,
	id_reject_reason: null, date_of_birth: null, date_registered: `2026-10-${String(index + 1).padStart(2, '0')}T08:00:00Z`
}));
const statuses = ['Pending', 'Approved', 'Cancelled', 'Rejected', 'Approved', 'ready_for_pickup', 'Released', 'Correction Requested', 'Pending'];
const requests = students.map((student, index) => ({
	request_id: `QA-REQ-${student.user_id}`, student_name: `Student Middle ${student.user_id}`,
	student_code: student.student_id, program: student.program, status: statuses[index],
	purpose: 'Employment', requirements: [], approved_file_path: index === 1 ? 'qa/final.pdf' : null,
	approved_file_name: index === 1 ? 'Enrollment.pdf' : null,
	completed_at: index === 4 ? '2026-10-14' : null,
	document_name: 'Certificate of Enrollment', date_requested: student.date_registered,
	items: [
		{ document_id: 1, name: 'Certificate of Enrollment' },
		{ document_id: 2, name: 'Official Transcript of Records' }
	]
}));
window.fixtureCalls = [];
const nativeAnchorClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
	if (this.hasAttribute('download')) { window.fixtureDownload = this.download; return; }
	return nativeAnchorClick.call(this);
};
function samplePdf() {
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
	];
	for (const [label, y] of [['ESSU DocuFlow QA page 1', 300], ['ESSU DocuFlow QA page 2', 260]]) {
		const stream = `BT /F1 18 Tf 30 ${y} Td (${label}) Tj ET`;
		objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
		if (label.endsWith('page 1')) objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>');
	}
	let result = '%PDF-1.4\n', offsets = [0];
	objects.forEach((object, index) => { offsets.push(result.length); result += `${index + 1} 0 obj\n${object}\nendobj\n`; });
	const xref = result.length;
	result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
	return result + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}
// Only fake data is used; an unexpected endpoint fails the test instead of contacting a server.
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
	const url = String(input), method = init?.method ?? 'GET';
	if (url.startsWith('blob:')) return nativeFetch(input, init);
	window.fixtureCalls.push({ url, method });
	if (url === '/api/requests') return Response.json(requests.slice(0, 1));
	if (/^\/api\/requests\/[^/]+\/lifecycle$/.test(url)) {
		const body = JSON.parse(init.body); window.fixtureLifecycle = body;
		if (window.fixtureFailAction) return Response.json({error:'Could not save request'}, {status:500});
		return Response.json({success:true, status:body.action === 'cancel' ? 'Cancelled' : 'Rejected'});
	}
	if (url.startsWith('/api/storage?bucket=templates')) return Response.json({url:'/qa/template.docx'});
	if (url === '/qa/template.docx') return new Response('PKfixture-docx-bytes', {headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}});
	if (url === '/api/documents') return Response.json([{document_id:1, name:'Certificate of Enrollment', requirements:[]}]);
	if (url.startsWith('/api/storage?')) {
		if (window.fixtureFailPreview) return Response.json({error:'Document unavailable'}, {status:403});
		await new Promise(resolve => setTimeout(resolve, window.fixturePreviewDelay ?? 0));
		return Response.json({url:'/qa/final.pdf'});
	}
	if (url.startsWith('/api/forms/4/download') && window.fixtureMissingPdf) return Response.json({error:'PDF preview unavailable'}, {status:409});
	if (url === '/qa/final.pdf' || url.startsWith('/api/forms/4/download') || url === '/forms/Prospectus-MAIT.pdf') return new Response(window.fixtureInvalidPdf ? 'PKdocx' : samplePdf(), {headers:{'Content-Type':'application/pdf'}});
	if (url === '/forms/Prospectus-MAIT.docx') return new Response('fixture docx', {headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}});
	if (url === '/api/forms') return Response.json([{form_id:4, title:'Prospectus', category:'Prospectus', code:null, description:'Official program prospectus', fields:[], download_name:'ESSU-Prospectus', files:[
		{page_no:1,storage_path:null,public_url:'/forms/Prospectus-MAIT.pdf',name:'Prospectus-MAIT.pdf',type:'application/pdf'},
		{page_no:0,storage_path:'qa/Prospectus-MAIT.docx',public_url:'/forms/Prospectus-MAIT.docx',name:'Prospectus-MAIT.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
	]}]);
	if (/^\/api\/students\/\d+$/.test(url)) return Response.json(students.find(student => student.user_id === Number(url.split('/').pop())));
	throw new Error(`Unexpected fixture request: ${method} ${url}`);
};
window.addEventListener('click', event => {
	const download = event.target.closest('a[download]');
	if (download) { event.preventDefault(); window.fixtureDownload = download.download; }
	const link = event.target.closest('a[href^="/staff/requests/"]');
	if (link) { event.preventDefault(); window.fixtureNavigation = link.getAttribute('href'); }
});
mount(Harness, { target: document.getElementById('app'), props: {
	view: new URLSearchParams(location.search).get('view') ?? 'staff',
	role: new URLSearchParams(location.search).get('role') ?? 'Admin', students, requests
} });
window.fixtureRun = new URLSearchParams(location.search).get('run');
