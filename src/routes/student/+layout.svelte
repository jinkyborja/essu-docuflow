<script lang="ts">
	import VerificationHelp from '$lib/components/ui/VerificationHelp.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import { page } from '$app/stores';
	import { sidebarCollapsed } from '$lib/stores/sidebar';
	import { notifUnreadCount, startNotifications } from '$lib/stores/notifications';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	const { children, data }: { children: Snippet; data: LayoutData } = $props();

	onMount(() => startNotifications(data.notifCount ?? 0));
	$effect(() => { notifUnreadCount.set(data.notifCount ?? 0); });

	const unread = $derived($notifUnreadCount);

	const studentNav = $derived([
		{ label: 'Dashboard',        icon: 'fa-solid fa-gauge-high',       href: '/student/dashboard' },
		{ label: 'My Documents',     icon: 'fa-solid fa-folder-open',      href: '/student/documents' },
		{ label: 'Request Document', icon: 'fa-solid fa-file-circle-plus', href: '/student/request' },
		{ label: 'Forms',            icon: 'fa-solid fa-file-lines',       href: '/student/forms' },
		{ label: 'Notifications',    icon: 'fa-regular fa-bell',           href: '/student/notifications', badge: unread },
		{ label: 'My Profile',       icon: 'fa-solid fa-circle-user',      href: '/student/profile' }
	]);

	const titleMap: Record<string, string> = {
		'/student/dashboard': 'Dashboard',
		'/student/documents': 'My Documents',
		'/student/request': 'Request Document',
		'/student/forms': 'Forms',
		'/student/notifications': 'Notifications',
		'/student/profile': 'My Profile'
	};

	const pageTitle = $derived(titleMap[$page.url.pathname] ?? 'Student Portal');
	const collapsed = $derived($sidebarCollapsed);
</script>

<div class="portal-layout flex min-h-screen bg-gray-50">
	<Sidebar items={studentNav} role="student" />

	<div
		class="flex-1 flex flex-col transition-all duration-300 {collapsed ? 'lg:ml-16' : 'lg:ml-60'}"
	>
		<TopBar title={pageTitle} />

		<main class="portal-main flex-1 mt-16 p-6">
			{#if data.layoutUser.idStatus === 'pending'}
				<div class="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">Your account is waiting for verification by the Graduate School office. We check your student ID against the master's enrollment list.</div>
			{:else if data.layoutUser.idStatus === 'rejected'}
				<div class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">Your student ID could not be verified. Reason: {data.layoutUser.idRejectReason ?? 'Please contact the Graduate School office.'}<VerificationHelp /></div>
			{/if}
			{@render children()}
		</main>
	</div>
</div>
