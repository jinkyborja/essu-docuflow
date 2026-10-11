<script lang="ts">
	import { tick } from 'svelte';
	let { items }: { items: Array<{name: string}> } = $props();
	let open = $state(false);
	let root = $state<HTMLSpanElement>()!, trigger = $state<HTMLButtonElement>()!, panel = $state<HTMLDivElement>()!;
	const id = $props.id();
	function close(focus = false) { if (!open) return; panel?.hidePopover(); open = false; if (focus) trigger.focus(); }
	async function toggle() {
		if (open) { close(); return; }
		open = true; await tick(); panel.showPopover();
		const rect = trigger.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
		panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - bounds.width - 8))}px`;
		panel.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - bounds.height - 8))}px`;
	}
</script>
<svelte:document onpointerdown={event => { if (open && !root.contains(event.target as Node)) close(); }} />
<svelte:window onkeydown={event => { if (open && event.key === 'Escape') { event.stopPropagation(); close(true); } }} onresize={() => close()} />
{#if items.length > 1}<span bind:this={root} class="inline-flex"><button bind:this={trigger} type="button" aria-expanded={open} aria-controls={id} title="Show all documents" onclick={() => void toggle()} class="ml-1 min-h-9 rounded-full bg-gray-100 px-2 text-xs text-essu-green focus:outline-none focus:ring-2 focus:ring-essu-green/30">+{items.length - 1} more</button>{#if open}<div bind:this={panel} {id} popover="manual" class="document-popover"><p class="mb-2 text-xs font-semibold text-gray-500">Documents in this request</p><ul class="list-disc space-y-2 pl-4 text-sm text-gray-800">{#each items as item}<li>{item.name}</li>{/each}</ul></div>{/if}</span>{/if}
<style>.document-popover { position: fixed; inset: auto; margin: 0; width: 290px; max-width: calc(100vw - 16px); max-height: 60vh; overflow-y: auto; padding: 14px; border: 1px solid #d9e3dd; border-radius: 10px; background: white; box-shadow: 0 8px 30px #10251a26; } @media (pointer: coarse) { button { min-height: 44px; } }</style>
