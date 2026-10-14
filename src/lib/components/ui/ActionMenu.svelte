<script lang="ts">
	import type { Snippet } from 'svelte';
	import RowMenu, { type RowMenuItem } from './RowMenu.svelte';

	let { items, label = 'More actions', children }: {
		items: RowMenuItem[];
		label?: string;
		children: Snippet;
	} = $props();
</script>

<div class="action-buttons">
	{@render children()}
	<RowMenu {items} {label} />
</div>

<style>
	.action-buttons {
		--action-control-height: var(--control-height);
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		flex-shrink: 0;
		white-space: nowrap;
	}
	.action-buttons > :global(*) { flex-shrink: 0; }
	.action-buttons :global(.ui-button),
	.action-buttons :global(.row-menu-trigger) {
		height: var(--action-control-height);
		min-height: var(--action-control-height);
		border-radius: var(--radius-control);
	}
	.action-buttons :global(.ui-button) {
		min-width: var(--action-primary-width);
		padding-inline: var(--space-3);
	}
	.action-buttons :global(.row-menu-trigger) {
		width: var(--action-control-height);
		min-width: var(--action-control-height);
		padding: 0;
	}
	@media (max-width: 767px), (pointer: coarse) {
		.action-buttons { --action-control-height: var(--control-height-touch); }
	}
</style>
