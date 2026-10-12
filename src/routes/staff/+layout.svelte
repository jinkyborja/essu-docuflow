<script lang="ts">
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import PageIntro from '$lib/components/layout/PageIntro.svelte';
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

	const unread = $derived(mounted ? $notifUnreadCount : data.notifCount ?? 0);

	const staffNav = $derived([
		{ label: 'Dashboard',     icon: 'fa-solid fa-gauge-high',    href: '/staff/dashboard' },
		{ label: 'All Requests',  icon: 'fa-solid fa-list-check',    href: '/staff/requests' },
		{ label: 'Documents',     icon: 'fa-solid fa-file-lines',    href: '/staff/documents' },
		{ label: 'Forms',         icon: 'fa-solid fa-file-circle-plus', href: '/staff/forms' },
		{ label: 'Students',      icon: 'fa-solid fa-user-graduate', href: '/staff/students' },
		{ label: 'Staff',         icon: 'fa-solid fa-user-tie',      href: '/staff/staff',     adminOnly: true },
		{ label: 'Activity log',  icon: 'fa-solid fa-clipboard-list', href: '/staff/activity', adminOnly: true, hideFromStaff: true },
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
		'/staff/activity':      'Activity log',
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
	<Sidebar items={staffNav} role="staff" userRole={data.role} user={data.layoutUser} />

	<!-- Main content area — offset by sidebar width -->
	<div
		class="portal-content"
		class:collapsed
		inert={$sidebarMobileOpen}
	>
		<TopBar role="staff" userRole={data.role} user={data.layoutUser} {unread} />

		<main id="main-content" tabindex="-1" class="portal-main">
			<PageIntro title={pageTitle} role="staff" />
			{#if $navigating}<LoadingState label="Loading your workspace…" />{:else}{@render children()}{/if}
		</main>
	</div>
</div>
