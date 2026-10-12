<script lang="ts">
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import { goto } from '$app/navigation';
	import { logoutPending, sidebarMobileOpen } from '$lib/stores/sidebar';
	let { user, role, userRole, compact = false, location = 'topbar' }: {
		user: { name: string; initials: string; position?: string; program?: string };
		role: 'staff' | 'student';
		userRole?: string;
		compact?: boolean;
		location?: 'topbar' | 'sidebar';
	} = $props();
	const roleLabel = $derived(role === 'student' ? 'Student' : userRole ?? 'Staff');
	const profileHref = $derived(role === 'student' ? '/student/profile' : '/staff/profile');
	async function logout() { if ($logoutPending) return; logoutPending.set(true); try { await fetch('/api/logout', { method: 'POST' }); await goto('/login'); } finally { logoutPending.set(false); } }
</script>

<div class="user-menu" class:compact class:sidebar={location === 'sidebar'}>
	<RowMenu label={`Open user menu for ${user.name}`} triggerClass="user-menu-trigger" placement={location === 'sidebar' ? 'top-start' : 'bottom-end'} loading={$logoutPending} items={[
		{ label: 'My Profile', href: profileHref, icon: 'fa-solid fa-circle-user', onselect: () => sidebarMobileOpen.set(false) },
		...(location === 'sidebar' ? [{ label: 'Log out', icon: 'fa-solid fa-right-from-bracket', disabled: $logoutPending, reason: 'Logging out…', onselect: logout }] : [])
	]}>
		{#snippet triggerContent()}
			<span class="user-avatar" aria-hidden="true">{user.initials}</span>
			{#if !compact}<span class="user-copy"><span class="user-name">{user.name}</span><span class="user-role">{roleLabel}</span></span><i class="fa-solid fa-chevron-up user-chevron" aria-hidden="true"></i>{/if}
		{/snippet}
		{#snippet header()}
			<div class="user-details"><p class="full-name">{user.name}</p><p>{roleLabel}</p>{#if role === 'student' && user.program}<p class="program">{user.program}</p>{:else if user.position && user.position !== roleLabel}<p class="program">{user.position}</p>{/if}</div>
		{/snippet}
	</RowMenu>
</div>

<style>
	.user-menu { min-width: 0; }
	.user-menu :global(.row-menu) { width: 100%; }
	.user-menu :global(.user-menu-trigger) { width: 100%; padding: 0 var(--space-2); border-color: transparent; background: transparent; color: var(--color-text); font-size: var(--font-size-body); }
	.user-menu :global(.user-menu-trigger .trigger-content) { gap: var(--space-2); }
	.user-menu.compact :global(.user-menu-trigger) { width: var(--control-height); padding: 0; }
	.user-avatar { display: grid; place-items: center; flex-shrink: 0; width: var(--space-8); height: var(--space-8); border-radius: 50%; background: var(--color-primary); color: var(--color-surface); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); }
	.user-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; text-align: left; }
	.user-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-size-body); font-weight: var(--font-weight-medium); }
	.user-role { color: var(--color-text-muted); font-size: var(--font-size-helper); font-weight: var(--font-weight-normal); }
	.user-chevron { flex-shrink: 0; font-size: var(--font-size-helper); color: var(--color-text-muted); }
	.user-details { color: var(--color-text); font-size: var(--font-size-helper); line-height: var(--line-height); overflow-wrap: anywhere; }
	.user-details p { margin: 0; }
	.user-details .full-name { margin-bottom: var(--space-1); font-size: var(--font-size-body); font-weight: var(--font-weight-semibold); }
	.user-details .program { margin-top: var(--space-2); color: var(--color-text-muted); font-size: var(--font-size-body); }
	.sidebar.compact :global(.user-menu-trigger) { color: var(--color-surface); }
	.sidebar.compact :global(.user-menu-trigger:hover:not(:disabled)) { background: var(--color-primary-hover); }
	.sidebar.compact :global(.user-menu-trigger:focus-visible) { outline-color: var(--color-accent); }
	.sidebar.compact .user-avatar { background: var(--color-primary-hover); }
	@media (pointer: coarse) { .user-menu.compact :global(.user-menu-trigger) { width: var(--control-height-touch); } }
</style>
