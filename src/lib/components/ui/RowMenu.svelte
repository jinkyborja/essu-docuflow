<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	export type RowMenuItem = { label: string; href?: string; icon?: string; onselect?: () => void; danger?: boolean; disabled?: boolean; reason?: string };
	let { items, label = 'More actions', triggerContent, header, triggerClass = '', placement = 'bottom-end', loading = false, disabled = false }: {
		items: RowMenuItem[];
		label?: string;
		triggerContent?: Snippet;
		header?: Snippet;
		triggerClass?: string;
		placement?: 'bottom-end' | 'top-start';
		loading?: boolean;
		disabled?: boolean;
	} = $props();
	let open = $state(false), active = $state(0);
	let root: HTMLSpanElement, trigger: HTMLButtonElement;
	let menu = $state<HTMLDivElement>()!;
	const id = $props.id();
	function close(restoreFocus = false) {
		if (!open) return;
		menu?.hidePopover(); open = false;
		if (restoreFocus) trigger?.focus();
	}
	async function show(index = 0) {
		if (disabled || loading || !items.length) return;
		open = true; active = index; await tick();
		if (!open || !menu) return;
		menu.showPopover();
		const rect = trigger.getBoundingClientRect(), bounds = menu.getBoundingClientRect();
		const left = placement === 'top-start' ? rect.left : rect.right - bounds.width;
		const above = placement === 'top-start' || rect.bottom + bounds.height + 8 > window.innerHeight;
		const top = above ? rect.top - bounds.height - 8 : rect.bottom + 8;
		menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8))}px`;
		menu.style.top = `${Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8))}px`;
		menu.querySelectorAll<HTMLElement>('[role="menuitem"]')[active]?.focus();
	}
	function move(index: number) {
		active = (index + items.length) % items.length;
		menu.querySelectorAll<HTMLElement>('[role="menuitem"]')[active]?.focus();
	}
	function keys(event: KeyboardEvent) {
		if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
		else if (event.key === 'ArrowDown') { event.preventDefault(); move(active + 1); }
		else if (event.key === 'ArrowUp') { event.preventDefault(); move(active - 1); }
		else if (event.key === 'Home') { event.preventDefault(); move(0); }
		else if (event.key === 'End') { event.preventDefault(); move(items.length - 1); }
		else if (event.key === 'Tab') close(true);
	}
	function select(event: MouseEvent, item: RowMenuItem) {
		if (item.disabled) { event.preventDefault(); return; }
		close(true); item.onselect?.();
	}
</script>

<svelte:document onpointerdown={(event) => { if (open && !root.contains(event.target as Node)) close(); }} />
<svelte:window onresize={() => close()} />
<span bind:this={root} class="row-menu">
	<button bind:this={trigger} type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-busy={loading} disabled={disabled || loading} class="row-menu-trigger {triggerClass}" onclick={() => open ? close(true) : void show()} onkeydown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); void show(event.key === 'ArrowUp' ? items.length - 1 : 0); } }}>
		<span class="trigger-content" class:busy={loading}>{#if triggerContent}{@render triggerContent()}{:else}<span aria-hidden="true">⋯</span>{/if}</span>
		{#if loading}<i class="fa-solid fa-circle-notch menu-spinner" aria-hidden="true"></i>{/if}
	</button>
	{#if open}
		<div bind:this={menu} {id} popover="manual" role="menu" tabindex="-1" aria-label={label} onkeydown={keys} class="row-menu-panel">
			{#if header}<div class="menu-header">{@render header()}</div>{/if}
			{#each items as item, index}
				{#if item.href}
					<a href={item.disabled ? undefined : item.href} role="menuitem" tabindex={active === index ? 0 : -1} aria-disabled={item.disabled ?? false} title={item.disabled ? item.reason : undefined} class="row-menu-item" class:danger={item.danger} onclick={(event) => select(event, item)}>
						{#if item.icon}<i class={item.icon} aria-hidden="true"></i>{/if}<span>{item.label}{#if item.disabled && item.reason}<span class="item-reason">{item.reason}</span>{/if}</span>
					</a>
				{:else}
					<button type="button" role="menuitem" tabindex={active === index ? 0 : -1} aria-disabled={item.disabled ?? false} title={item.disabled ? item.reason : undefined} class="row-menu-item" class:danger={item.danger} onclick={(event) => select(event, item)}>
						{#if item.icon}<i class={item.icon} aria-hidden="true"></i>{/if}<span>{item.label}{#if item.disabled && item.reason}<span class="item-reason">{item.reason}</span>{/if}</span>
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</span>

<style>
	.row-menu { display: inline-flex; flex-shrink: 0; max-width: 100%; }
	.row-menu-trigger { position: relative; display: inline-flex; height: var(--control-height); min-width: var(--control-height); align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font-size: var(--font-size-card-title); font-weight: var(--font-weight-medium); line-height: var(--line-height); transition: background-color var(--motion-fast), color var(--motion-fast); }
	.row-menu-trigger:hover:not(:disabled) { background: var(--color-primary-soft); color: var(--color-primary); }
	.row-menu-trigger:disabled { background: var(--color-bg); color: var(--color-text-muted); cursor: not-allowed; }
	.row-menu-trigger[aria-busy='true'] { cursor: wait; }
	.row-menu-trigger:focus-visible, .row-menu-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; box-shadow: var(--focus-ring); }
	.trigger-content { display: flex; align-items: center; justify-content: center; width: 100%; }
	.trigger-content.busy { opacity: 0; }
	.menu-spinner { position: absolute; animation: menu-spin 900ms linear infinite; }
	.row-menu-panel { position: fixed; inset: auto; margin: 0; padding: var(--space-2); width: 248px; max-width: calc(100vw - var(--space-4)); max-height: min(480px, calc(100dvh - var(--space-4))); overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); box-shadow: var(--shadow-raised); }
	.menu-header { margin-bottom: var(--space-2); padding: var(--space-2) var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); }
	.row-menu-item { display: flex; align-items: center; gap: var(--space-3); width: 100%; min-height: var(--control-height); padding: var(--space-2) var(--space-3); border: 0; border-radius: var(--radius-control); background: transparent; text-align: left; text-decoration: none; color: var(--color-text); font-size: var(--font-size-body); font-weight: var(--font-weight-normal); line-height: var(--line-height); transition: background-color var(--motion-fast); }
	.row-menu-item:hover, .row-menu-item:focus { background: var(--color-primary-soft); }
	.row-menu-item > i { flex-shrink: 0; width: 20px; font-size: var(--font-size-card-title); text-align: center; }
	.row-menu-item.danger { color: var(--color-danger); }
	.row-menu-item[aria-disabled='true'] { color: var(--color-text-muted); cursor: not-allowed; }
	.item-reason { display: block; font-size: var(--font-size-helper); }
	@keyframes menu-spin { to { transform: rotate(360deg); } }
	@media (pointer: coarse) { .row-menu-trigger { height: var(--control-height-touch); min-width: var(--control-height-touch); } .row-menu-item { min-height: var(--control-height-touch); } }
	@media (prefers-reduced-motion: reduce) { .menu-spinner { animation: none; } }
</style>
