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
	const headerIcon = $derived(
		$page.url.pathname.includes('reports') ? 'fa-solid fa-chart-simple'
		: $page.url.pathname.includes('notifications') ? 'fa-regular fa-bell'
		: $page.url.pathname.includes('profile') ? 'fa-solid fa-user-gear'
		: $page.url.pathname === '/staff/staff' ? 'fa-solid fa-user-tie'
		: $page.url.pathname.includes('students') ? 'fa-solid fa-user-graduate'
		: $page.url.pathname.includes('forms') ? 'fa-solid fa-file-circle-plus'
		: $page.url.pathname.includes('request') || $page.url.pathname.includes('documents') ? 'fa-solid fa-file-lines'
		: $page.url.pathname.includes('dashboard') ? 'fa-solid fa-gauge-high'
		: 'fa-solid fa-chart-line'
	);
</script>

<div class="portal-page-header" class:dashboard={$page.url.pathname === '/staff/dashboard'}>
	<div class="page-intro-art" aria-hidden="true"><i class={headerIcon}></i></div>
	{#if role === 'student' && $page.url.pathname === '/student/documents'}
		<PageHeader {title} {description}>
			{#snippet actions()}<Button href={$page.data.layoutUser?.idStatus === 'verified' ? '/student/request' : '/student/forms'} icon="fa-solid {$page.data.layoutUser?.idStatus === 'verified' ? 'fa-plus' : 'fa-file-lines'}">{$page.data.layoutUser?.idStatus === 'verified' ? 'New request' : 'Browse forms'}</Button>{/snippet}
		</PageHeader>
	{:else}<PageHeader {title} {description} />{/if}
</div>

<style>
	.portal-page-header { position: relative; isolation: isolate; min-height: 112px; margin-bottom: var(--space-6); padding: var(--space-4) 0; }
	.page-intro-art { position: absolute; top: 50%; right: var(--space-6); display: grid; place-items: center; width: 112px; height: 96px; transform: translateY(-50%); color: color-mix(in srgb, var(--color-primary) 18%, transparent); font-size: 4rem; pointer-events: none; }
	.portal-page-header.dashboard { min-height: 0; margin-bottom: 0.5rem; padding: 0.25rem 0; }
	:global(.staff-portal .portal-main.dashboard) { padding: 1.5rem; }
	:global(.staff-portal .portal-main > .portal-page-header.dashboard) { margin-bottom: 0.5rem; }
	.portal-page-header.dashboard .page-intro-art { display: none; }
	.portal-page-header.dashboard :global(.ui-page-header h1) { font-size: clamp(1.5rem, 3vw, 2rem); letter-spacing: -0.035em; }
	.portal-page-header.dashboard :global(.ui-page-header p) { max-width: 38ch; margin-top: 0.25rem; font-size: 0.8rem; line-height: 1.4; }
	@media (max-width: 639px) { .portal-page-header { min-height: 0; padding: var(--space-2) 0; } .page-intro-art { right: var(--space-2); width: 56px; height: 56px; font-size: 2rem; opacity: .7; } }
	@media (max-width: 639px) { .portal-page-header.dashboard { margin-bottom: 0.5rem; padding: 0.25rem 0; } :global(.staff-portal .portal-main.dashboard) { padding: 1.5rem; } :global(.staff-portal .portal-main > .portal-page-header.dashboard) { margin-bottom: 0.5rem; } }
	@media print { .portal-page-header { display: none; } }
</style>
