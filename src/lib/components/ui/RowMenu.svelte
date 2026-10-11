<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	export type RowMenuItem = { label: string; href?: string; onselect?: () => void; danger?: boolean; disabled?: boolean; reason?: string };
	let { items, label = 'More actions', triggerContent, header, triggerClass = '' }: { items: RowMenuItem[]; label?: string; triggerContent?: Snippet; header?: Snippet; triggerClass?: string } = $props();
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
		open = true; active = index; await tick();
		menu.showPopover();
		const rect = trigger.getBoundingClientRect(), bounds = menu.getBoundingClientRect();
		menu.style.left = `${Math.max(8, Math.min(rect.right - bounds.width, window.innerWidth - bounds.width - 8))}px`;
		menu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - bounds.height - 8))}px`;
		menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[active]?.focus();
	}
	function move(index: number) {
		active = (index + items.length) % items.length;
		menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[active]?.focus();
	}
	function keys(event: KeyboardEvent) {
		if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
		else if (event.key === 'ArrowDown') { event.preventDefault(); move(active + 1); }
		else if (event.key === 'ArrowUp') { event.preventDefault(); move(active - 1); }
		else if (event.key === 'Home') { event.preventDefault(); move(0); }
		else if (event.key === 'End') { event.preventDefault(); move(items.length - 1); }
		else if (event.key === 'Tab') close();
	}
</script>
<svelte:document onpointerdown={(event) => { if (open && !root.contains(event.target as Node)) close(); }} />
<svelte:window onresize={() => close()} />
<span bind:this={root} class="inline-flex shrink-0">
	<button bind:this={trigger} type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} class="row-menu-trigger {triggerClass}" class:custom-trigger={!!triggerContent} onclick={() => open ? close(true) : void show()} onkeydown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); void show(event.key === 'ArrowUp' ? items.length - 1 : 0); } }}>{#if triggerContent}{@render triggerContent()}{:else}⋯{/if}</button>
	{#if open}
		<div bind:this={menu} {id} popover="manual" role="menu" tabindex="-1" aria-label={label} onkeydown={keys} class="row-menu-panel">
			{#if header}<div class="menu-header">{@render header()}</div>{/if}
			{#each items as item, index}{#if item.href && !item.disabled}<a href={item.href} role="menuitem" tabindex={active === index ? 0 : -1} class="row-menu-item" class:danger={item.danger} onclick={() => { close(); item.onselect?.(); }}>{item.label}</a>{:else}<button type="button" role="menuitem" tabindex={active === index ? 0 : -1} aria-disabled={item.disabled ?? false} title={item.disabled ? item.reason : undefined} class="row-menu-item" class:danger={item.danger} onclick={() => { if (item.disabled) return; close(true); item.onselect?.(); }}><span>{item.label}</span>{#if item.disabled && item.reason}<span class="block text-xs font-normal text-gray-500">{item.reason}</span>{/if}</button>{/if}{/each}
		</div>
	{/if}
</span>
<style>
	.row-menu-trigger { display: inline-flex; height: var(--control-height); width: var(--control-height); align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font-size: var(--type-card-title); line-height: var(--line-height); transition: background-color var(--motion-fast), border-color var(--motion-fast); }
	.row-menu-trigger:hover { background: var(--color-primary-soft); border-color: var(--color-primary); }
	.row-menu-trigger.custom-trigger { width: auto; max-width: 100%; gap: var(--space-2); padding: 0 var(--space-2); font-size: var(--type-body); }
	.menu-header { padding: var(--space-2) var(--space-3) var(--space-3); margin-bottom: var(--space-1); border-bottom: 1px solid var(--color-border); color: var(--color-text-muted); font-size: var(--type-helper); overflow-wrap: anywhere; }
	.row-menu-trigger:focus-visible, .row-menu-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; box-shadow: var(--focus-ring); }
	.row-menu-panel { position: fixed; inset: auto; margin: 0; padding: var(--space-2); width: 224px; max-width: calc(100vw - var(--space-8)); max-height: min(320px, 80vh); overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); box-shadow: var(--shadow-raised); }
	.row-menu-item { display: block; width: 100%; min-height: var(--control-height); padding: var(--space-2) var(--space-3); border-radius: var(--radius-control); text-align: left; color: var(--color-text); font-size: var(--type-body); font-weight: var(--weight-medium); line-height: var(--line-height); transition: color var(--motion-fast), background-color var(--motion-fast); }
	.row-menu-item:hover, .row-menu-item:focus { background: var(--color-primary-soft); }
	.row-menu-item.danger { color: var(--color-danger); }
	.row-menu-item.danger:hover { background: var(--color-danger-soft); }
	.row-menu-item[aria-disabled="true"] { color: var(--color-text-muted); cursor: not-allowed; }
	@media (pointer: coarse) { .row-menu-trigger { width: var(--control-height-touch); height: var(--control-height-touch); } .row-menu-item { min-height: var(--control-height-touch); } }
</style>
