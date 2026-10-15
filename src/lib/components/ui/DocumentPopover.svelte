<script lang="ts">
	import { tick } from 'svelte';
	import { positionFloatingPanel } from '$lib/floating-panel';
	let { items }: { items: Array<{name: string}> } = $props();
	let open = $state(false);
	let trigger = $state<HTMLButtonElement>()!, panel = $state<HTMLDivElement>()!;
	const id = $props.id();
	function close() { if (!open) return; panel?.hidePopover(); open = false; }
	function onTriggerKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			close();
		}
	}
	async function toggle() {
		if (open) { close(); return; }
		open = true; await tick();
		if (!open || !panel) return;
		panel.showPopover();
		position();
	}
	function position() { if (open && panel?.matches(':popover-open')) positionFloatingPanel(trigger, panel, { placement: 'bottom-start', width: 290, maxHeight: (window.visualViewport?.height ?? window.innerHeight) * 0.6 }); }
	$effect(() => {
		if (!open || !panel) return;
		const observer = new ResizeObserver(position);
		observer.observe(panel);
		observer.observe(trigger);
		window.addEventListener('scroll', position, true);
		window.addEventListener('resize', position);
		window.visualViewport?.addEventListener('resize', position);
		window.visualViewport?.addEventListener('scroll', position);
		return () => {
			observer.disconnect();
			window.removeEventListener('scroll', position, true);
			window.removeEventListener('resize', position);
			window.visualViewport?.removeEventListener('resize', position);
			window.visualViewport?.removeEventListener('scroll', position);
		};
	});
</script>
{#if items.length > 1}<span class="inline-flex"><button bind:this={trigger} type="button" aria-expanded={open} aria-controls={id} title="Show all documents" onclick={() => void toggle()} onkeydown={onTriggerKeydown} class="ml-1 min-h-9 rounded-full bg-gray-100 px-2 text-xs text-essu-green focus:outline-none focus:ring-2 focus:ring-essu-green/30">+{items.length - 1} more</button>{#if open}<div bind:this={panel} {id} popover="auto" role="region" aria-label="Documents in this request" onbeforetoggle={(event) => { if (event.newState === 'closed') open = false; }} class="document-popover"><p class="mb-2 text-xs font-semibold text-gray-500">Documents in this request</p><ul class="list-disc space-y-2 pl-4 text-sm text-gray-800">{#each items as item}<li>{item.name}</li>{/each}</ul></div>{/if}</span>{/if}
<style>
	button { min-height: var(--control-height); border-radius: var(--radius-control); }
	.document-popover { position: fixed; inset: auto; margin: 0; box-sizing: border-box; max-width: var(--floating-available-width, calc(100vw - var(--space-4))); overflow-y: auto; padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); box-shadow: var(--shadow-raised); }
	@media (pointer: coarse) { button { min-height: var(--control-height-touch); } }
</style>
