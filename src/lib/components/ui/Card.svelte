<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, description, hover = false, class: extraClass = '', children, footer }: {
		title?: string; description?: string; hover?: boolean; class?: string; children?: Snippet; footer?: Snippet;
	} = $props();
	const titleId = $props.id();
</script>

<section class="ui-card {extraClass}" class:hoverable={hover} aria-labelledby={title ? titleId : undefined}>
	{#if title || description}<header class="card-header">{#if title}<h2 id={titleId}>{title}</h2>{/if}{#if description}<p>{description}</p>{/if}</header>{/if}
	{#if children}<div class="card-body">{@render children()}</div>{/if}
	{#if footer}<footer class="card-footer">{@render footer()}</footer>{/if}
</section>

<style>
	.ui-card { min-width: 0; padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); color: var(--color-text); font-size: var(--type-body); line-height: var(--line-height); box-shadow: none; transition: box-shadow var(--motion-fast), border-color var(--motion-fast); }
	.card-header { margin-bottom: var(--space-4); }
	h2 { margin: 0; font-size: var(--type-card-title); font-weight: var(--weight-semibold); line-height: var(--line-height); }
	p { margin: var(--space-1) 0 0; color: var(--color-text-muted); }
	.card-body { min-width: 0; }
	.card-footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-6); padding-top: var(--space-4); border-top: 1px solid var(--color-border); }
	.hoverable:hover { border-color: var(--color-border-strong); box-shadow: var(--shadow-raised); }
</style>
