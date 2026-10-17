<script lang="ts">
	import VerificationHelp from '$lib/components/ui/VerificationHelp.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { newIdPhotoUploaded } from '$lib/stores/id-review';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import PageIntro from '$lib/components/layout/PageIntro.svelte';
	import StudentTutorial from '$lib/components/student/StudentTutorial.svelte';
	import { page, navigating } from '$app/stores';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import { sidebarCollapsed, sidebarMobileOpen } from '$lib/stores/sidebar';
	import { notifUnreadCount, startNotifications } from '$lib/stores/notifications';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	const { children, data }: { children: Snippet; data: LayoutData } = $props();

	let mounted = $state(false);
	onMount(() => { mounted = true; return startNotifications(data.notifCount ?? 0); });
	$effect(() => { notifUnreadCount.set(data.notifCount ?? 0); });
	$effect(() => { if (data.layoutUser.idStatus === 'rejected') { void data.layoutUser.idRejectReason; newIdPhotoUploaded.set(false); } });

	const unread = $derived(mounted ? $notifUnreadCount : data.notifCount ?? 0);

	const studentNav = $derived([
		{ label: 'Dashboard',        icon: 'fa-solid fa-gauge-high',       href: '/student/dashboard' },
		{ label: 'My Documents',     icon: 'fa-solid fa-folder-open',      href: '/student/documents' },
		{ label: 'Request Document', icon: 'fa-solid fa-file-circle-plus', href: '/student/request', locked: data.layoutUser.idStatus !== 'verified', lockedReason: 'Available after your ID is verified' },
		{ label: 'Forms',            icon: 'fa-solid fa-file-lines',       href: '/student/forms' },
		{ label: 'Notifications',    icon: 'fa-regular fa-bell',           href: '/student/notifications', badge: unread },
		{ label: 'Tutorial & Help',  icon: 'fa-solid fa-circle-question',  href: '/student/help' },
		{ label: 'My Profile',       icon: 'fa-solid fa-circle-user',      href: '/student/profile' }
	]);

	const titleMap: Record<string, string> = {
		'/student/dashboard': 'Dashboard',
		'/student/documents': 'My Documents',
		'/student/request': 'Request Document',
		'/student/forms': 'Forms',
		'/student/notifications': 'Notifications',
		'/student/help': 'Tutorial & Help',
		'/student/profile': 'My Profile'
	};

	const pageTitle = $derived(titleMap[$page.url.pathname] ?? 'Student Portal');
	const collapsed = $derived($sidebarCollapsed);
</script>

<div class="portal-layout student-portal flex min-h-screen bg-gray-50">
	<a href="#main-content" class="skip-link">Skip to main content</a>
	<Sidebar items={studentNav} role="student" user={data.layoutUser} />

	<div
		class="portal-content"
		class:collapsed
		inert={$sidebarMobileOpen}
	>
		<TopBar role="student" user={data.layoutUser} {unread} />

		<main id="main-content" tabindex="-1" class="portal-main page-layout page-container page-main">
			<PageIntro title={pageTitle} role="student" />
			<div class="page-body">
				{#if data.layoutUser.idStatus === 'pending'}
					<section class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" aria-label="Account review"><p>Your account is being reviewed by the Graduate School office.</p><Button href="/student/forms">Browse forms</Button></section>
				{:else if data.layoutUser.idStatus === 'rejected'}
					<VerificationHelp reason={data.layoutUser.idRejectReason} />
				{/if}
				{#if $navigating}<LoadingState label="Loading your workspace…" />{:else}{@render children()}{/if}
			</div>
		</main>
	</div>
</div>
<StudentTutorial userId={data.userId} />
