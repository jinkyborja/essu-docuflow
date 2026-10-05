<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { sidebarCollapsed, sidebarMobileOpen } from '$lib/stores/sidebar';

	type NavItem = { label: string; icon: string; href: string; adminOnly?: boolean; badge?: number };
	interface Props { items: NavItem[]; role: 'staff' | 'student'; userRole?: string }

	const { items, role, userRole }: Props = $props();

	const collapsed  = $derived($sidebarCollapsed);
	const mobileOpen = $derived($sidebarMobileOpen);
	const currentPath = $derived($page.url.pathname);

	const logoLabel  = role === 'staff' ? 'Staff Portal' : 'Student Portal';
	const activeItem = 'bg-essu-gold/25 text-essu-gold';
	const activeIcon = 'text-essu-gold';
	const activeDot  = 'bg-essu-gold';
	const logoSub    = 'text-essu-gold/90';
	const logoBadge  = 'bg-essu-gold/20 text-essu-gold';
	const logoutCls  = 'text-essu-gold/80 hover:bg-essu-gold/10 hover:text-essu-gold';

	function isActive(href: string) {
		return currentPath === href || (href !== '/' && currentPath.startsWith(href));
	}

	function closeMobile() { sidebarMobileOpen.set(false); }

	async function logout() {
		await fetch('/api/logout', { method: 'POST' });
		goto('/login');
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
			e.preventDefault();
			sidebarCollapsed.update((v) => !v);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Mobile backdrop -->
{#if mobileOpen}
	<div class="fixed inset-0 z-30 bg-black/40 lg:hidden" onclick={closeMobile} role="presentation"></div>
{/if}

<!-- Sidebar — same green background for both roles -->
<aside
	class="fixed top-0 left-0 h-full z-40 flex flex-col bg-linear-to-b from-essu-green to-essu-green-mid
		text-white shadow-xl transition-all duration-300 ease-in-out
		{collapsed ? 'w-16' : 'w-60'}
		{mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}"
	aria-label="Sidebar navigation"
>
	<!-- Brand -->
	<div class="flex items-center h-16 px-3 border-b border-white/10 shrink-0">
		<div class="w-10 h-10 rounded-xl {logoBadge} flex items-center justify-center shrink-0">
			<i class="fa-solid fa-graduation-cap text-lg"></i>
		</div>
		{#if !collapsed}
			<div class="ml-3 overflow-hidden">
				<p class="text-sm font-bold leading-tight">ESSU</p>
				<p class="text-xs leading-tight {logoSub}">{logoLabel}</p>
			</div>
		{/if}
	</div>

	<!-- Nav -->
	<nav class="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Main navigation">
		{#each items as item}
			{@const active = isActive(item.href)}
			{@const disabled = item.adminOnly && userRole !== 'Admin'}
			{#if disabled}
				<div
					class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium opacity-40 cursor-not-allowed select-none"
					title={collapsed ? item.label : 'Admin only'}
				>
					<i class="{item.icon} w-5 text-center shrink-0 text-white/50"></i>
					{#if !collapsed}
						<span class="truncate text-white/50">{item.label}</span>
						<i class="fa-solid fa-lock ml-auto text-xs text-white/40 shrink-0"></i>
					{/if}
				</div>
			{:else}
				<a
					href={item.href}
					onclick={closeMobile}
					class="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
						{active ? activeItem : 'text-white/70 hover:bg-white/10 hover:text-white'}"
					aria-current={active ? 'page' : undefined}
					title={collapsed ? item.label : undefined}
				>
					<div class="relative shrink-0">
						<i class="{item.icon} w-5 text-center
							{active ? activeIcon : 'text-white/70 group-hover:text-white'}"></i>
						{#if collapsed && item.badge && item.badge > 0}
							<span class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
						{/if}
					</div>
					{#if !collapsed}
						<span class="truncate">{item.label}</span>
						{#if item.badge && item.badge > 0}
							<span class="ml-auto text-xs bg-red-500 text-white rounded-full px-1.5 leading-5 font-semibold min-w-5 text-center shrink-0">
								{item.badge > 99 ? '99+' : item.badge}
							</span>
						{:else if active}
							<span class="ml-auto w-1.5 h-1.5 rounded-full {activeDot} shrink-0"></span>
						{/if}
					{/if}
				</a>
			{/if}
		{/each}
	</nav>

	<!-- Logout -->
	<div class="shrink-0 border-t border-white/10 p-2">
		<button
			onclick={logout}
			class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm {logoutCls}"
			aria-label="Log out"
		>
			<i class="fa-solid fa-right-from-bracket w-5 text-center shrink-0"></i>
			{#if !collapsed}
				<span>Log out</span>
			{/if}
		</button>
	</div>
</aside>
