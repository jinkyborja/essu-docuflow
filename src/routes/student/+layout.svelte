<script lang="ts">
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import { page } from '$app/stores';
	import { sidebarCollapsed } from '$lib/stores/sidebar';
	import { notifUnreadCount } from '$lib/stores/notifications';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	const { children, data }: { children: Snippet; data: LayoutData } = $props();

	onMount(() => {
		notifUnreadCount.set(data.notifCount ?? 0);
	});

	const unread = $derived($notifUnreadCount);

	const studentNav = $derived([
		{ label: 'Dashboard',        icon: 'fa-solid fa-gauge-high',       href: '/student/dashboard' },
		{ label: 'My Documents',     icon: 'fa-solid fa-folder-open',      href: '/student/documents' },
		{ label: 'Request Document', icon: 'fa-solid fa-file-circle-plus', href: '/student/request' },
		{ label: 'Notifications',    icon: 'fa-regular fa-bell',           href: '/student/notifications', badge: unread },
		{ label: 'My Profile',       icon: 'fa-solid fa-circle-user',      href: '/student/profile' }
	]);

	const titleMap: Record<string, string> = {
		'/student/dashboard': 'Dashboard',
		'/student/documents': 'My Documents',
		'/student/request': 'Request Document',
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
			{@render children()}
		</main>
	</div>
</div>
