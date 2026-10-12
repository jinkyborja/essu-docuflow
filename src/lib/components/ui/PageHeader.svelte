<script lang="ts">
	import type { Snippet } from 'svelte';
	/** actions accepts one primary Button and, optionally, one secondary Button. */
	let { title, description, actions }: { title: string; description?: string; actions?: Snippet } = $props();
</script>

<header class="ui-page-header">
	<div class="header-copy">
		<h1>{title}</h1>
		{#if description}<p>{description}</p>{/if}
	</div>
	{#if actions}<div class="header-actions">{@render actions()}</div>{/if}
</header>

<style>
	.ui-page-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-6); line-height: var(--line-height); }
	.header-copy { min-width: 0; }
	h1 { margin: 0; color: var(--color-text); font-size: var(--font-size-page-title); font-weight: var(--font-weight-semibold); }
	p { margin: var(--space-1) 0 0; color: var(--color-text-muted); font-size: var(--font-size-body); }
	.header-actions { display: flex; flex-shrink: 0; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-3); }
	@media (max-width: 639px) { .ui-page-header { align-items: flex-start; flex-direction: column; gap: var(--space-4); } .header-actions { width: 100%; justify-content: flex-start; } }
</style>
