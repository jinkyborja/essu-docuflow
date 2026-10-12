<script lang="ts">
	import { page } from '$app/stores';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	const { title, role }: { title: string; role: 'student' | 'staff' } = $props();
	const descriptions: Record<string, string> = {
		'/student/dashboard': 'Your requests, updates and next steps, all in one place.',
		'/student/documents': 'Track progress, update requirements and collect your documents.',
		'/student/request': 'Choose your documents. We will guide you through the requirements.',
		'/student/forms': 'Find official forms to download, complete and submit with your request.',
		'/student/notifications': 'Stay up to date with decisions and messages from the office.',
		'/student/profile': 'Keep your personal and academic information up to date.',
		'/staff/dashboard': 'See what needs attention and keep document requests moving.',
		'/staff/requests': 'Review requirements, follow up on corrections and confirm delivery.',
		'/staff/documents': 'Manage requestable documents, templates and their requirements.',
		'/staff/forms': 'Keep official forms available and ready for students to use.',
		'/staff/students': 'Review student identities against the official enrollment masterlist.',
		'/staff/staff': 'Manage the people who support your Graduate School office.',
		'/staff/reports': 'Understand request volumes, decisions and office workload.',
		'/staff/notifications': 'Open updates to go directly to the request or student needing attention.',
		'/staff/profile': 'Manage your office profile and account settings.'
	};
	const description = $derived(descriptions[$page.url.pathname] ?? 'Review the details, requirements and request history.');
</script>

<div class="portal-page-header">
	{#if role === 'student' && $page.url.pathname === '/student/documents'}
		<PageHeader {title} {description}>
			{#snippet actions()}<Button href={$page.data.layoutUser?.idStatus === 'verified' ? '/student/request' : '/student/forms'} icon="fa-solid {$page.data.layoutUser?.idStatus === 'verified' ? 'fa-plus' : 'fa-file-lines'}">{$page.data.layoutUser?.idStatus === 'verified' ? 'New request' : 'Browse forms'}</Button>{/snippet}
		</PageHeader>
	{:else}<PageHeader {title} {description} />{/if}
</div>

<style>
	.portal-page-header { margin-bottom: var(--space-6); }
	@media print { .portal-page-header { display: none; } }
</style>
