<script lang="ts">
	import type { Snippet } from 'svelte';
	/** Supply one Button to each action slot: primary in action, outline in secondaryAction. */
	let { title, description, action, secondaryAction }: {
		title: string; description?: string; action?: Snippet; secondaryAction?: Snippet;
	} = $props();
</script>

<header class="ui-page-header">
	<div class="heading"><h1>{title}</h1>{#if description}<p title={description}>{description}</p>{/if}</div>
	{#if action || secondaryAction}<div class="header-actions">{#if secondaryAction}{@render secondaryAction()}{/if}{#if action}{@render action()}{/if}</div>{/if}
</header>

<style>
	.ui-page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); color: var(--color-text); line-height: var(--line-height); }
	.heading { flex: 1; min-width: 0; }
	h1 { margin: 0; font-size: var(--type-page-title); font-weight: var(--weight-semibold); line-height: var(--line-height); overflow-wrap: anywhere; }
	p { margin: var(--space-1) 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-muted); font-size: var(--type-body); }
	.header-actions { display: flex; flex: 0 0 auto; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); }
	@media (max-width: 639px) { .ui-page-header { flex-direction: column; gap: var(--space-4); } .heading, .header-actions { width: 100%; } .header-actions { justify-content: flex-start; } }
</style>
