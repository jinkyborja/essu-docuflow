<script lang="ts">
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import PageIntro from '$lib/components/layout/PageIntro.svelte';
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

	const staffNav = $derived([
		{ label: 'Dashboard',     icon: 'fa-solid fa-gauge-high',    href: '/staff/dashboard' },
		{ label: 'All Requests',  icon: 'fa-solid fa-list-check',    href: '/staff/requests' },
		{ label: 'Documents',     icon: 'fa-solid fa-file-lines',    href: '/staff/documents' },
		{ label: 'Forms',         icon: 'fa-solid fa-file-circle-plus', href: '/staff/forms' },
		{ label: 'Students',      icon: 'fa-solid fa-user-graduate', href: '/staff/students' },
		{ label: 'Staff',         icon: 'fa-solid fa-user-tie',      href: '/staff/staff',     adminOnly: true },
		{ label: 'Reports',       icon: 'fa-solid fa-chart-bar',     href: '/staff/reports' },
		{ label: 'Notifications', icon: 'fa-regular fa-bell',        href: '/staff/notifications', badge: unread },
		{ label: 'My Profile',    icon: 'fa-solid fa-circle-user',   href: '/staff/profile' }
	]);

	const titleMap: Record<string, string> = {
		'/staff/dashboard':     'Dashboard',
		'/staff/requests':      'All Requests',
		'/staff/documents':     'Documents',
		'/staff/forms':         'Forms',
		'/staff/students':      'Student Management',
		'/staff/staff':         'Staff Management',
		'/staff/reports':       'Reports & Analytics',
		'/staff/notifications': 'Notifications',
		'/staff/profile':       'My Profile'
	};

	const pageTitle = $derived(
		titleMap[$page.url.pathname] ?? ($page.url.pathname.startsWith('/staff/requests/') ? 'Request details' : data.role?.toLowerCase() === 'admin' ? 'Admin Portal' : 'Staff Portal')
	);
	const collapsed = $derived($sidebarCollapsed);
</script>

<div class="portal-layout flex min-h-screen bg-gray-50">
	<a href="#main-content" class="skip-link">Skip to main content</a>
	<Sidebar items={staffNav} role="staff" userRole={data.role} />

	<!-- Main content area — offset by sidebar width -->
	<div
		class="portal-content min-w-0 flex-1 flex flex-col transition-all duration-300 {collapsed ? 'lg:ml-16' : 'lg:ml-60'}"
	>
		<TopBar title={pageTitle} />

		<main id="main-content" tabindex="-1" class="portal-main flex-1 mt-16 p-6">
			<PageIntro title={pageTitle} role="staff" />
			{@render children()}
		</main>
	</div>
</div>
