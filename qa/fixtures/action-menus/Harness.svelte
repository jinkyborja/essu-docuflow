<script>
	import Staff from '../../../src/routes/staff/staff/+page.svelte';
	import Students from '../../../src/routes/staff/students/+page.svelte';
	import Requests from '../../../src/routes/staff/requests/+page.svelte';
	import RowMenu from '../../../src/lib/components/ui/RowMenu.svelte';
	import UserMenu from '../../../src/lib/components/layout/UserMenu.svelte';
	import Documents from '../../../src/routes/student/documents/+page.svelte';
	import Forms from '../../../src/routes/student/forms/+page.svelte';
	import AdminForms from '../../../src/routes/staff/forms/+page.svelte';
	import StaffDocuments from '../../../src/routes/staff/documents/+page.svelte';
	import RequestWizard from '../../../src/routes/student/request/+page.svelte';
	import Login from '../../../src/routes/login/+page.svelte';
	import Pagination from '../../../src/lib/components/ui/Pagination.svelte';
	let { view, role, students, requests } = $props();
	const staff = $derived(students.map((student, index) => ({
		...student,
		email: index === 0 ? 'a-very-long-staff-address-for-responsive-layout-checks@example.invalid' : student.email,
		role: index === 2 ? 'Admin' : 'Staff',
		position: index === 2 ? 'Administrator' : 'Registrar'
	})));
	let selected = $state('');
</script>

{#if view === 'login'}<Login />{:else}<div class="staff-portal portal-layout">
	<div class="portal-content">
		<main class="portal-main">
			<h1>{view}</h1>
			{#if view === 'staff'}
				<Staff data={{ allowed: true, staff, currentUserId: 1 }} />
			{:else if view === 'students'}
				<Students data={{ allowed: true, role, students }} />
			{:else if view === 'requests'}
				<Requests data={{ requests, isAdmin: role === 'Admin' }} />
			{:else if view === 'archived'}
				<Requests data={{ requests: [{ ...requests[3], archived_at: '2026-10-14' }], isAdmin: true, archived: true }} />
			{:else if view === 'pagination'}
				<Pagination totalItems={25} itemsPerPage={10} currentPage={2} onPageChange={page => selected = `page:${page}`} onItemsPerPageChange={size => selected = `size:${size}`} />
				<output>{selected}</output>
			{:else if view === 'documents'}
				<Documents data={{ requests }} />
			{:else if view === 'forms'}
				<Forms />
			{:else if view === 'forms-admin'}
				<AdminForms />
			{:else if view === 'documents-admin'}
				<StaffDocuments data={{ documents: [
					{ document_id: 7, name: 'DOCX Preview Sample', template_path: 'qa/sample.docx', template_name: 'sample.docx', requirements: [], upload_date: '2026-10-15T08:00:00Z', uploaded_by_name: 'QA User' }
				], forms: [] }} />
			{:else if view === 'request-wizard'}
				<RequestWizard data={{ idStatus: 'verified', documents: [
					{ document_id: 1, name: 'Certificate of Enrollment', template_path: null, template_name: null, requirements: [
						{ name: 'Clearance Form', description: 'Student clearance form', in_person: false, needs_signature: false }
					] },
					{ document_id: 2, name: 'Comprehensive Exam Certificate', template_path: null, template_name: null, requirements: [
						{ name: 'Clearance Form', description: 'Student clearance form', in_person: false, needs_signature: false },
						{ name: 'Valid ID', description: 'Additional required document', in_person: false, needs_signature: false }
					] },
					{ document_id: 3, name: 'Transcript of Records', template_path: null, template_name: null, requirements: [] },
					{ document_id: 4, name: 'Certificate of Graduation', template_path: null, template_name: null, requirements: [] },
					{ document_id: 5, name: 'Certificate of Good Moral Character', template_path: null, template_name: null, requirements: [] },
					{ document_id: 6, name: 'A very long document title that wraps safely on narrow mobile screens without causing horizontal overflow', template_path: null, template_name: null, requirements: [] }
				] }} />
			{:else}
				<button id="before-menu">Before menu</button>
				<RowMenu label="Keyboard sample" items={[
					{ label: 'View', onselect: () => selected = 'View' },
					{ label: 'Unavailable', disabled: true, reason: 'An intentionally long permission explanation without truncation: ' + 'longword'.repeat(10), onselect: () => selected = 'Unexpected' },
					{ label: 'Edit', href: '#edit', onselect: () => selected = 'Edit' }
				]} />
				<button id="after-menu">After menu</button>
				<output>{selected}</output>
				<UserMenu user={{ name: 'QA User', initials: 'QU', position: 'Registrar' }} role="staff" location="sidebar" />
			{/if}
		</main>
	</div>
</div>
{/if}
