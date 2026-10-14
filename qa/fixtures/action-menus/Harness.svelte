<script>
	import Staff from '../../../src/routes/staff/staff/+page.svelte';
	import Students from '../../../src/routes/staff/students/+page.svelte';
	import Requests from '../../../src/routes/staff/requests/+page.svelte';
	import RowMenu from '../../../src/lib/components/ui/RowMenu.svelte';
	import UserMenu from '../../../src/lib/components/layout/UserMenu.svelte';
	import Documents from '../../../src/routes/student/documents/+page.svelte';
	import Forms from '../../../src/routes/student/forms/+page.svelte';
	import Login from '../../../src/routes/login/+page.svelte';
	let { view, role, students, requests } = $props();
	const staff = $derived(students.map(student => ({ ...student, role: 'Staff', position: 'Registrar' })));
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
			{:else if view === 'documents'}
				<Documents data={{ requests }} />
			{:else if view === 'forms'}
				<Forms />
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
