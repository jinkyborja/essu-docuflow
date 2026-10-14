<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { sidebarCollapsed, sidebarMobileOpen, logoutPending } from '$lib/stores/sidebar';

	type NavItem = { label: string; icon: string; href: string; adminOnly?: boolean; hideFromStaff?: boolean; badge?: number; locked?: boolean; lockedReason?: string };
	interface Props {
		items: NavItem[];
		role: 'staff' | 'student';
		userRole?: string;
		user: { name: string; initials: string; position?: string; program?: string };
	}
	const { items, role, userRole, user }: Props = $props();
	let desktop = $state(false);
	const collapsed = $derived(desktop && $sidebarCollapsed);
	const mobileOpen = $derived(!desktop && $sidebarMobileOpen);
	const currentPath = $derived($page.url.pathname);
	const requestAction = $derived(role === 'student' ? items.find(item => item.href === '/student/request') : undefined);
	const logoLabel = $derived(role === 'staff' ? userRole?.toLowerCase() === 'admin' ? 'Admin Portal' : 'Staff Portal' : 'Student Portal');
	let navigation: HTMLElement;

	onMount(handleResize);
	$effect(() => {
		if (!mobileOpen) return;
		const previousFocus = document.activeElement as HTMLElement | null;
		const previousOverflow = document.body.style.overflow;
		let active = true;
		document.body.style.overflow = 'hidden';
		void tick().then(() => { if (active) navigation?.querySelector<HTMLElement>('.drawer-close button')?.focus(); });
		return () => {
			active = false;
			document.body.style.overflow = previousOverflow;
			void tick().then(() => { if (previousFocus?.isConnected) previousFocus.focus(); });
		};
	});

	function isActive(href: string) {
		return currentPath === href || (href !== '/' && currentPath.startsWith(href));
	}
	function closeMobile() { sidebarMobileOpen.set(false); }
	async function handleLogout() {
		if ($logoutPending) return;
		logoutPending.set(true);
		try { await fetch('/api/logout', { method: 'POST' }); closeMobile(); await goto('/login'); }
		finally { logoutPending.set(false); }
	}
	function handleResize() {
		desktop = window.matchMedia('(min-width: 1024px)').matches;
		if (desktop && $sidebarMobileOpen) closeMobile();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (mobileOpen && event.key === 'Escape') { event.preventDefault(); closeMobile(); return; }
		if (mobileOpen && event.key === 'Tab') {
			const controls = Array.from(navigation.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')).filter(control => control.getClientRects().length > 0);
			const first = controls[0], last = controls[controls.length - 1];
			if (!first) { event.preventDefault(); navigation.focus(); return; }
			if (!navigation.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
			else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
			else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
		}
		if (desktop && (event.ctrlKey || event.metaKey) && event.key === 'b') {
			event.preventDefault(); sidebarCollapsed.update(value => !value);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} onresize={handleResize} />

{#if mobileOpen}<div class="sidebar-overlay" onclick={closeMobile} role="presentation"></div>{/if}

<aside bind:this={navigation} id="portal-navigation" class="portal-sidebar" class:collapsed class:mobile-open={mobileOpen} inert={!desktop && !mobileOpen} role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? true : undefined} aria-label="Sidebar navigation" tabindex="-1">
	<div class="sidebar-brand">
		<div class="portal-brand-mark" aria-hidden="true"><i class="fa-solid fa-graduation-cap"></i></div>
		{#if !collapsed}<div class="brand-copy"><p>ESSU</p><span>{logoLabel}</span></div>{/if}
		<div class="drawer-close"><Button variant="ghost" icon="fa-solid fa-xmark" ariaLabel="Close navigation" onclick={closeMobile} class="sidebar-close" /></div>
	</div>

	<nav class="sidebar-nav" aria-label="Main navigation">
		{#if requestAction}
			<div class="request-button-slot">
				<Button variant="secondary" href={requestAction.href} icon={requestAction.locked ? 'fa-solid fa-lock' : requestAction.icon} disabled={requestAction.locked} disabledReason={requestAction.lockedReason} title={requestAction.locked ? 'Available after your ID is verified' : requestAction.label} ariaLabel={collapsed ? requestAction.label : undefined} onclick={closeMobile} class="request-button">
					{#if !collapsed}{requestAction.label}{/if}
				</Button>
			</div>
		{/if}
		{#each items.filter(item => item !== requestAction && !(item.hideFromStaff && userRole !== 'Admin')) as item}
			{@const active = isActive(item.href)}
			{@const disabled = item.adminOnly && userRole !== 'Admin'}
			{#if role === 'staff' && item.href === '/staff/requests'}
				<p class="portal-nav-section" class:rail-label={collapsed}>Work queue</p>
			{:else if role === 'staff' && item.href === '/staff/students'}
				<p class="portal-nav-section" class:rail-label={collapsed}>Administration</p>
			{:else if role === 'staff' && item.href === '/staff/reports'}
				<p class="portal-nav-section" class:rail-label={collapsed}>Workspace</p>
			{:else if role === 'student' && item.href === '/student/documents'}
				<p class="portal-nav-section" class:rail-label={collapsed}>Requests</p>
			{:else if role === 'student' && item.href === '/student/notifications'}
				<p class="portal-nav-section" class:rail-label={collapsed}>Account</p>
			{/if}
			{#if disabled}
				<span class="portal-nav-link unavailable" role="link" aria-disabled="true" tabindex="0" title={`${item.label}: Admin only`} aria-label={`${item.label}: Admin only`}><i class={item.icon} aria-hidden="true"></i>{#if !collapsed}<span class="nav-label">{item.label}</span><i class="fa-solid fa-lock nav-lock" aria-hidden="true"></i>{/if}</span>
			{:else}
				<a href={item.href} onclick={closeMobile} class="portal-nav-link" aria-current={active ? 'page' : undefined} aria-label={collapsed ? `${item.label}${item.badge ? `, ${item.badge} unread` : ''}` : undefined} title={collapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}>
					<i class={item.icon} aria-hidden="true"></i>
					{#if !collapsed}<span class="nav-label">{item.label}</span>{/if}
					{#if item.badge && item.badge > 0}<span class="nav-count" aria-label={`${item.badge} unread`}>{item.badge > 99 ? '99+' : item.badge}</span>{/if}
				</a>
			{/if}
		{/each}
	</nav>

	<div class="sidebar-footer">
		<Button variant="ghost" icon="fa-solid fa-right-from-bracket" ariaLabel="Log out" title="Log out" loading={$logoutPending} disabled={$logoutPending} onclick={handleLogout} class="sidebar-logout">{#if !collapsed}Log out{/if}</Button>
	</div>
</aside>

<style>
	.portal-sidebar { position: fixed; inset: 0 auto 0 0; z-index: 40; display: flex; flex-direction: column; width: var(--sidebar-width); height: 100dvh; border-right: 1px solid color-mix(in srgb, var(--color-surface) 16%, var(--color-primary)); background: var(--color-primary); color: var(--color-surface); transform: translateX(-100%); transition: width var(--motion-fast), transform var(--motion-fast); }
	.portal-sidebar.mobile-open { transform: translateX(0); }
	.sidebar-overlay { position: fixed; inset: 0; z-index: 30; background: color-mix(in srgb, var(--color-text) 56%, transparent); }
	.sidebar-brand { display: flex; flex-shrink: 0; align-items: center; gap: var(--space-3); height: 64px; padding: 0 var(--space-4); border-bottom: 1px solid color-mix(in srgb, var(--color-surface) 16%, var(--color-primary)); }
	.portal-brand-mark { display: grid; place-items: center; flex-shrink: 0; width: var(--control-height); height: var(--control-height); border: 1px solid color-mix(in srgb, var(--color-accent) 50%, var(--color-primary)); border-radius: var(--radius-control); background: color-mix(in srgb, var(--color-accent) 12%, var(--color-primary)); color: var(--color-accent); font-size: var(--font-size-card-title); }
	.brand-copy { min-width: 0; }
	.brand-copy p { margin: 0; font-size: var(--font-size-body); font-weight: var(--font-weight-semibold); }
	.brand-copy span { color: var(--color-primary-soft); font-size: var(--font-size-helper); }
	.drawer-close { margin-left: auto; }
	.drawer-close :global(.sidebar-close.ui-button) { padding: 0; border-color: transparent; color: var(--color-primary-soft); }
	.drawer-close :global(.sidebar-close.ui-button:hover) { background: var(--color-primary-hover); }
	.drawer-close :global(.sidebar-close i) { font-size: var(--font-size-card-title); }
	.sidebar-nav { flex: 1; min-height: 0; overflow-y: auto; padding: var(--space-4); }
	.portal-nav-section { margin: var(--space-6) 0 var(--space-2); padding-inline: var(--space-3); color: var(--color-primary-soft); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); line-height: var(--line-height); letter-spacing: 0.06em; text-transform: uppercase; }
	.rail-label { height: 1px; margin: var(--space-4) 0; padding: 0; overflow: hidden; clip-path: inset(50%); }
	.portal-nav-link { position: relative; display: flex; align-items: center; gap: var(--space-3); width: 100%; height: var(--control-height); margin-bottom: var(--space-1); padding: 0 var(--space-3); border-radius: var(--radius-control); background: transparent; color: var(--color-primary-soft); font-size: var(--font-size-body); font-weight: var(--font-weight-medium); line-height: var(--line-height); text-decoration: none; transition: background-color var(--motion-fast), color var(--motion-fast); }
	.portal-nav-link > i { width: 20px; flex-shrink: 0; font-size: var(--font-size-card-title); text-align: center; }
	.portal-nav-link:hover { background: color-mix(in srgb, var(--color-primary-hover) 80%, var(--color-primary)); color: var(--color-surface); }
	.portal-nav-link:focus-visible, .drawer-close :global(button:focus-visible), .request-button-slot :global(a:focus-visible), .request-button-slot :global(.button-tooltip:focus-visible) { outline: 2px solid var(--color-accent); outline-offset: 3px; box-shadow: var(--focus-ring); }
	.portal-nav-link[aria-current='page'] { background: var(--color-primary-hover); color: var(--color-surface); }
	.portal-nav-link[aria-current='page']::before { position: absolute; inset: 0 auto 0 0; width: 3px; border-radius: var(--radius-control) 0 0 var(--radius-control); background: var(--color-accent); content: ''; }
	.nav-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.nav-count { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding-inline: var(--space-1); border-radius: var(--radius-control); background: var(--color-accent); color: var(--color-text); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); }
	.portal-nav-link.unavailable { cursor: not-allowed; }
	.portal-nav-link > .nav-lock { width: auto; font-size: var(--font-size-helper); }
	.request-button-slot { margin-bottom: var(--space-4); }
	.request-button-slot :global(.button-tooltip) { width: 100%; }
	.request-button-slot :global(.request-button.ui-button) { width: 100%; padding-inline: var(--space-3); border-color: var(--color-accent); background: var(--color-accent); color: var(--color-text); }
	.request-button-slot :global(.request-button.ui-button:hover:not(:disabled):not([aria-disabled='true'])) { background: color-mix(in srgb, var(--color-accent) 90%, var(--color-surface)); border-color: var(--color-accent); }
	.request-button-slot :global(.request-button.ui-button:disabled), .request-button-slot :global(.request-button.ui-button[aria-disabled='true']) { background: color-mix(in srgb, var(--color-accent) 12%, var(--color-primary)); border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-primary)); color: var(--color-primary-soft); }
	.request-button-slot :global(.request-button i) { font-size: var(--font-size-card-title); }
	.request-button-slot :global(.reason-tooltip) { top: calc(100% + var(--space-2)); bottom: auto; max-width: 100%; }
	.sidebar-footer { display: flex; flex-direction: column; gap: var(--space-2); flex-shrink: 0; padding: var(--space-4); padding-bottom: max(var(--space-4), env(safe-area-inset-bottom)); border-top: 1px solid color-mix(in srgb, var(--color-surface) 16%, var(--color-primary)); }
	.sidebar-footer :global(.sidebar-logout.ui-button) { width: 100%; justify-content: flex-start; padding-inline: var(--space-3); border-color: transparent; background: transparent; color: var(--color-primary-soft); }
	.sidebar-footer :global(.sidebar-logout.ui-button:hover:not(:disabled)) { background: var(--color-primary-hover); color: var(--color-surface); }
	.sidebar-footer :global(.sidebar-logout.ui-button:focus-visible) { outline: 2px solid var(--color-accent); outline-offset: 3px; box-shadow: var(--focus-ring); }
	.sidebar-footer :global(.sidebar-logout i) { font-size: var(--font-size-card-title); }
	@media (min-width: 1024px) { .portal-sidebar { transform: none; } .portal-sidebar.collapsed { width: var(--sidebar-width-collapsed); } .drawer-close { display: none; } .collapsed .sidebar-brand { justify-content: center; padding-inline: var(--space-4); } .collapsed .portal-nav-link { justify-content: center; padding-inline: 0; } .collapsed .nav-count { position: absolute; top: 0; right: -4px; min-width: 20px; height: 20px; } .collapsed .request-button-slot :global(.request-button.ui-button), .collapsed .sidebar-footer :global(.sidebar-logout.ui-button) { justify-content: center; padding: 0; } }
	@media (pointer: coarse) { .portal-nav-link { height: var(--control-height-touch); } .collapsed .sidebar-nav, .collapsed .sidebar-footer { padding-inline: var(--space-3); } }
</style>
