<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, description, hover = false, class: extraClass = '', children, footer }: {
		title?: string; description?: string; hover?: boolean; class?: string; children?: Snippet; footer?: Snippet;
	} = $props();
	const titleId = $props.id();
</script>

<div class="ui-card {extraClass}" class:hoverable={hover} role={title ? 'region' : undefined} aria-labelledby={title ? titleId : undefined}>
	{#if title || description}
		<div class="card-heading">
			{#if title}<h2 id={titleId}>{title}</h2>{/if}
			{#if description}<p>{description}</p>{/if}
		</div>
	{/if}
	{#if children}{@render children()}{/if}
	{#if footer}<div class="card-footer">{@render footer()}</div>{/if}
</div>

<style>
	.ui-card { min-width: 0; padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); color: var(--color-text); font-size: var(--font-size-body); line-height: var(--line-height); transition: border-color var(--motion-fast), box-shadow var(--motion-fast); }
	.hoverable:hover { border-color: var(--color-primary); box-shadow: var(--shadow-raised); }
	.card-heading { margin-bottom: var(--space-4); }
	h2 { margin: 0; font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); }
	p { margin: var(--space-1) 0 0; color: var(--color-text-muted); }
	.card-footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-6); padding-top: var(--space-4); border-top: 1px solid var(--color-border); }
</style>
