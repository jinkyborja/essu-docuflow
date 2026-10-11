<script lang="ts">
	import { tick } from 'svelte';
	export type RowMenuItem = { label: string; onselect?: () => void; danger?: boolean; disabled?: boolean; reason?: string };
	let { items, label = 'More actions' }: { items: RowMenuItem[]; label?: string } = $props();
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
	<button bind:this={trigger} type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} class="row-menu-trigger" onclick={() => open ? close(true) : void show()} onkeydown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); void show(event.key === 'ArrowUp' ? items.length - 1 : 0); } }}>⋯</button>
	{#if open}
		<div bind:this={menu} {id} popover="manual" role="menu" tabindex="-1" aria-label={label} onkeydown={keys} class="row-menu-panel">
			{#each items as item, index}<button type="button" role="menuitem" tabindex={active === index ? 0 : -1} aria-disabled={item.disabled ?? false} title={item.disabled ? item.reason : undefined} class="row-menu-item" class:danger={item.danger} onclick={() => { if (item.disabled) return; close(true); item.onselect?.(); }}><span>{item.label}</span>{#if item.disabled && item.reason}<span class="block text-xs font-normal text-gray-500">{item.reason}</span>{/if}</button>{/each}
		</div>
	{/if}
</span>
<style>
	.row-menu-trigger { display: inline-flex; height: 36px; width: 36px; align-items: center; justify-content: center; border: 1px solid #d9e3dd; border-radius: 8px; background: white; color: #344d40; font-size: 23px; line-height: 1; }
	.row-menu-trigger:hover { background: #f3f7f4; }
	.row-menu-trigger:focus-visible, .row-menu-item:focus-visible { outline: 2px solid #1f6b4a; outline-offset: 2px; }
	.row-menu-panel { position: fixed; inset: auto; margin: 0; padding: 5px; width: 224px; max-width: calc(100vw - 16px); max-height: min(320px, 80vh); overflow-y: auto; border: 1px solid #d9e3dd; border-radius: 10px; background: white; box-shadow: 0 8px 30px #10251a26; }
	.row-menu-item { display: block; width: 100%; min-height: 36px; padding: 8px 10px; border-radius: 6px; text-align: left; color: #263c30; font-size: 13px; }
	.row-menu-item:hover, .row-menu-item:focus { background: #f0f5f1; }
	.row-menu-item.danger { color: #b42318; }
	.row-menu-item[aria-disabled="true"] { color: #728077; cursor: not-allowed; }
	@media (pointer: coarse) { .row-menu-trigger { width: 44px; height: 44px; } .row-menu-item { min-height: 44px; } }
</style>
