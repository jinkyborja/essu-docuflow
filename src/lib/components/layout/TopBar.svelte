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
	<div class="topbar-brand-group">
		<Button variant="ghost" icon="fa-solid fa-bars" ariaLabel={menuLabel} title={desktop ? `${menuLabel} (Ctrl+B)` : menuLabel} ariaControls="portal-navigation" ariaExpanded={desktop ? !$sidebarCollapsed : $sidebarMobileOpen} onclick={toggleNavigation} class="shell-hamburger" />
		<a class="topbar-brand" href={role === 'student' ? '/student/dashboard' : '/staff/dashboard'} aria-label="ESSU DocuFlow Graduate School Office home">
			<span class="topbar-brand-mark" aria-hidden="true"><i class="fa-solid fa-building-columns"></i></span>
			<span class="topbar-brand-copy"><strong>ESSU DocuFlow</strong><span>Graduate School Office</span></span>
		</a>
	</div>
	<div class="topbar-actions">
		<a href={notificationHref} class="notification-bell" aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications"><i class="fa-regular fa-bell" aria-hidden="true"></i>{#if unread > 0}<span class="notification-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>{/if}</a>
		<span title={`${user.name}, ${role === 'student' ? 'Student' : userRole ?? 'Staff'}`}><UserMenu {user} {role} {userRole} compact /></span>
	</div>
	<span class="sr-only" aria-live="polite">{announcement}</span>
</header>

<style>
	.portal-topbar { position: fixed; inset: 0 0 auto 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; height: 64px; padding: 0 var(--space-4); border-bottom: 1px solid var(--color-border); background: var(--color-surface); box-shadow: 0 1px 4px color-mix(in srgb, var(--color-text) 5%, transparent); transition: left var(--motion-fast); }
	.topbar-brand-group { display: flex; min-width: 0; align-items: center; gap: var(--space-3); }
	.topbar-brand { display: flex; min-width: 0; align-items: center; gap: var(--space-3); color: var(--color-primary); text-decoration: none; }
	.topbar-brand-mark { display: grid; flex: 0 0 auto; place-items: center; width: 40px; height: 40px; color: var(--color-primary); font-size: 2rem; }
	.topbar-brand-copy { display: flex; min-width: 0; flex-direction: column; line-height: 1.2; }
	.topbar-brand-copy strong { overflow: hidden; font-size: var(--font-size-body); font-weight: var(--font-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
	.topbar-brand-copy span { color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.topbar-actions { display: flex; align-items: center; gap: var(--space-4); }
	:global(.shell-hamburger.ui-button) { padding: 0; }
	:global(.shell-hamburger.ui-button i) { font-size: var(--font-size-card-title); }
	.notification-bell { position: relative; display: grid; place-items: center; width: var(--control-height); height: var(--control-height); border-radius: var(--radius-control); color: var(--color-text-muted); font-size: var(--font-size-card-title); text-decoration: none; transition: background-color var(--motion-fast), color var(--motion-fast); }
	.notification-bell:hover { background: var(--color-primary-soft); color: var(--color-primary); }
	.notification-count { position: absolute; top: 0; right: -4px; display: grid; place-items: center; min-width: 20px; height: 20px; padding-inline: var(--space-1); border-radius: var(--radius-control); background: var(--color-primary); color: var(--color-surface); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); }
	@media (min-width: 1024px) { .portal-topbar { left: var(--sidebar-width); padding-inline: var(--space-8); } .portal-topbar.collapsed { left: var(--sidebar-width-collapsed); } }
	@media (max-width: 639px) { .portal-topbar { height: 48px; padding-inline: var(--space-3); } .topbar-brand-mark { width: 28px; height: 28px; font-size: 1.5rem; } .topbar-brand-group { gap: var(--space-2); } .topbar-brand { gap: var(--space-2); } .topbar-brand-copy strong { font-size: 0.75rem; } .topbar-brand-copy span { font-size: 0.625rem; } }
	@media (max-width: 380px) { .topbar-brand-group { gap: var(--space-1); } .topbar-actions { gap: var(--space-2); } }
	@media (max-width: 360px) { .topbar-brand-copy span { display: none; } }
	@media (pointer: coarse) { .notification-bell { width: var(--control-height-touch); height: var(--control-height-touch); } }
</style>
