<script lang="ts">
	import { page } from '$app/stores';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	const { title, role }: { title: string; role: 'student' | 'staff' } = $props();
	const descriptions: Record<string, string> = {
		'/student/dashboard': 'Your requests, updates and next steps, all in one place.',
		'/student/documents': 'Track progress, update requirements and collect your documents.',
		'/student/request': 'Choose your documents. We will guide you through the requirements.',
		'/student/forms': 'Preview official forms before downloading, completing and submitting them with your request.',
		'/student/notifications': 'Stay up to date with decisions and messages from the office.',
		'/student/help': 'A practical guide to requesting documents, uploading requirements and tracking updates.',
		'/student/profile': 'Keep your personal and academic information up to date.',
		'/staff/dashboard': 'See what needs attention and keep document requests moving.',
		'/staff/requests': 'Review requirements, follow up on corrections and record when documents are released.',
		'/staff/activity': 'A record of what admins, staff and students did in the system.',
		'/staff/documents': 'Manage requestable documents, templates and their requirements.',
		'/staff/forms': 'Keep official forms available and ready for students to use.',
		'/staff/students': 'Review student identities against the official enrollment masterlist.',
		'/staff/staff': 'Manage the people who support your Graduate School office.',
		'/staff/reports': 'Understand request volumes, decisions and office workload.',
		'/staff/notifications': 'Open updates to go directly to the request or student needing attention.',
		'/staff/profile': 'Manage your office profile and account settings.'
	};
	const description = $derived(descriptions[$page.url.pathname] ?? 'Review the details, requirements and request history.');
	const isStudentDocuments = $derived(role === 'student' && $page.url.pathname === '/student/documents');
	const isStudentHelp = $derived(role === 'student' && $page.url.pathname === '/student/help');
	const headerIcon = $derived(
		$page.url.pathname.includes('reports') ? 'fa-solid fa-chart-simple'
		: $page.url.pathname.includes('notifications') ? 'fa-regular fa-bell'
		: $page.url.pathname.includes('help') ? 'fa-solid fa-circle-question'
		: $page.url.pathname.includes('profile') ? 'fa-solid fa-user-gear'
		: $page.url.pathname === '/staff/staff' ? 'fa-solid fa-user-tie'
		: $page.url.pathname.includes('students') ? 'fa-solid fa-user-graduate'
		: $page.url.pathname.includes('forms') ? 'fa-solid fa-file-circle-plus'
		: $page.url.pathname === '/student/documents' ? 'fa-solid fa-folder-open'
		: $page.url.pathname.includes('request') || $page.url.pathname.includes('documents') ? 'fa-solid fa-file-lines'
		: $page.url.pathname.includes('dashboard') ? 'fa-solid fa-gauge-high'
		: 'fa-solid fa-chart-line'
	);
	const headerVariant = $derived(
		$page.url.pathname.endsWith('/dashboard') || isStudentDocuments || isStudentHelp ? 'dashboard' : 'default'
	);
</script>

<div class="portal-page-header page-header" class:dashboard={$page.url.pathname.endsWith('/dashboard')}>
	<PageHeader {title} {description} icon={headerIcon} variant={headerVariant} />
	{#if isStudentDocuments}
		<div class="page-actions">
			<Button href={$page.data.layoutUser?.idStatus === 'verified' ? '/student/request' : '/student/forms'} icon="fa-solid {$page.data.layoutUser?.idStatus === 'verified' ? 'fa-plus' : 'fa-file-lines'}">{$page.data.layoutUser?.idStatus === 'verified' ? 'New request' : 'Browse forms'}</Button>
		</div>
	{/if}
</div>

<style>
	.portal-page-header { display: flex; flex-direction: column; gap: var(--page-content-gap); min-width: 0; }
	.page-actions { display: flex; justify-content: flex-end; }
	@media print { .portal-page-header { display: none; } }
</style>
