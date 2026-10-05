<script lang="ts">
	import { page } from '$app/stores';
	import { sidebarCollapsed, sidebarMobileOpen } from '$lib/stores/sidebar';

	interface Props {
		title: string;
	}

	const { title }: Props = $props();

	const collapsed = $derived($sidebarCollapsed);

	// Session data comes straight from the layout server load (staff/+layout.server.ts
	// and student/+layout.server.ts both return `layoutUser`) — no client-side store.
	type LayoutUser = { name: string; initials: string; position?: string; program?: string };
	const user = $derived($page.data.layoutUser as LayoutUser | undefined);

	const avatarLabel = $derived(user?.initials || '?');
	const displayName = $derived(user?.name ?? 'User');
	// Staff show their position; students show their program. Graduate School has no
	// year levels, so no year is displayed.
	const displayRole = $derived(user?.position ?? user?.program ?? '');
</script>

<header
	class="fixed top-0 right-0 z-20 h-16 bg-white border-b border-gray-100 shadow-sm flex items-center px-4 gap-3 transition-all duration-300
		{collapsed ? 'left-16' : 'left-60'}
		max-lg:left-0"
>
	<!-- Mobile hamburger -->
	<button
		onclick={() => sidebarMobileOpen.update((v) => !v)}
		class="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
		aria-label="Toggle sidebar"
	>
		<i class="fa-solid fa-bars"></i>
	</button>

	<!-- Page title -->
	<h1 class="text-lg font-semibold text-gray-800 flex-1 truncate">{title}</h1>

	<div class="flex items-center gap-2">
		<!-- User avatar -->
		<div class="flex items-center gap-2 pl-2 border-l border-gray-100">
			<div class="w-8 h-8 rounded-full bg-essu-green flex items-center justify-center text-white text-xs font-bold shrink-0">
				{avatarLabel}
			</div>
			<div class="hidden sm:block text-left">
				<p class="text-sm font-medium text-gray-800 leading-tight">{displayName}</p>
				{#if displayRole}
					<p class="text-xs text-gray-500 leading-tight">{displayRole}</p>
				{/if}
			</div>
		</div>
	</div>
</header>
