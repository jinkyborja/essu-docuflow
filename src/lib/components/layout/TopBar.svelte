<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import UserMenu from './UserMenu.svelte';
	import { sidebarCollapsed, sidebarMobileOpen } from '$lib/stores/sidebar';

	let { user, role, userRole, unread = 0 }: {
		user: { name: string; initials: string; position?: string; program?: string };
		role: 'staff' | 'student';
		userRole?: string;
		unread?: number;
	} = $props();
	let desktop = $state(false);
	let previousUnread = $state(0);
	let announcement = $state('');
	const notificationHref = $derived(role === 'student' ? '/student/notifications' : '/staff/notifications');
	const menuLabel = $derived(desktop ? $sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation' : 'Open navigation');
	$effect(() => { if (unread > previousUnread) announcement = 'New notification'; previousUnread = unread; });
	onMount(() => { desktop = window.matchMedia('(min-width: 1024px)').matches; });
	function toggleNavigation() {
		if (desktop) sidebarCollapsed.update(value => !value);
		else sidebarMobileOpen.update(value => !value);
	}
</script>

<svelte:window onresize={() => desktop = window.matchMedia('(min-width: 1024px)').matches} />

<header class="portal-topbar" class:collapsed={$sidebarCollapsed} aria-label="Account and navigation">
	<Button variant="ghost" icon="fa-solid fa-bars" ariaLabel={menuLabel} title={desktop ? `${menuLabel} (Ctrl+B)` : menuLabel} ariaControls="portal-navigation" ariaExpanded={desktop ? !$sidebarCollapsed : $sidebarMobileOpen} onclick={toggleNavigation} class="shell-hamburger" />
	<div class="topbar-actions">
		<a href={notificationHref} class="notification-bell" aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications"><i class="fa-regular fa-bell" aria-hidden="true"></i>{#if unread > 0}<span class="notification-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>{/if}</a>
		<span title={`${user.name}, ${role === 'student' ? 'Student' : userRole ?? 'Staff'}`}><UserMenu {user} {role} {userRole} compact /></span>
	</div>
	<span class="sr-only" aria-live="polite">{announcement}</span>
</header>

<style>
	.portal-topbar { position: fixed; inset: 0 0 auto 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; height: 64px; padding: 0 var(--space-4); border-bottom: 1px solid var(--color-border); background: var(--color-surface); transition: left var(--motion-fast); }
	.topbar-actions { display: flex; align-items: center; gap: var(--space-4); }
	:global(.shell-hamburger.ui-button) { padding: 0; }
	:global(.shell-hamburger.ui-button i) { font-size: var(--font-size-card-title); }
	.notification-bell { position: relative; display: grid; place-items: center; width: var(--control-height); height: var(--control-height); border-radius: var(--radius-control); color: var(--color-text-muted); font-size: var(--font-size-card-title); text-decoration: none; transition: background-color var(--motion-fast), color var(--motion-fast); }
	.notification-bell:hover { background: var(--color-primary-soft); color: var(--color-primary); }
	.notification-count { position: absolute; top: 0; right: -4px; display: grid; place-items: center; min-width: 20px; height: 20px; padding-inline: var(--space-1); border-radius: var(--radius-control); background: var(--color-primary); color: var(--color-surface); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); }
	@media (min-width: 1024px) { .portal-topbar { left: var(--sidebar-width); padding-inline: var(--space-8); } .portal-topbar.collapsed { left: var(--sidebar-width-collapsed); } }
	@media (pointer: coarse) { .notification-bell { width: var(--control-height-touch); height: var(--control-height-touch); } }
</style>
