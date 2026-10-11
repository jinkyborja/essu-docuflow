<script lang="ts">
	let { variant = 'text', lines = 3, width = '100%', height, label = 'Loading content…', announce = true }: {
		variant?: 'text' | 'circle' | 'card'; lines?: number; width?: string; height?: string; label?: string; announce?: boolean;
	} = $props();
	const lineCount = $derived(Math.max(1, Math.min(10, Math.floor(lines) || 1)));
</script>

<div class="ui-skeleton" class:circle={variant === 'circle'} class:card={variant === 'card'} style:width={variant === 'circle' && width === '100%' ? 'var(--space-12)' : width} style:height={height} role={announce ? 'status' : undefined} aria-live={announce ? 'polite' : undefined} aria-busy={announce ? true : undefined}>
	{#if announce}<span class="sr-only">{label}</span>{/if}
	<div class="skeleton-presentation" aria-hidden="true">
		{#if variant === 'circle'}<div class="skeleton-shape skeleton-circle"></div>
		{:else if variant === 'card'}<div class="skeleton-shape skeleton-title"></div><div class="skeleton-shape skeleton-line"></div><div class="skeleton-shape skeleton-block"></div>
		{:else}{#each Array(lineCount) as _, index}<div class="skeleton-shape skeleton-line" class:last-line={index === lineCount - 1 && lineCount > 1}></div>{/each}{/if}
	</div>
</div>

<style>
	.ui-skeleton { min-width: 0; }
	.skeleton-presentation { display: grid; gap: var(--space-3); height: 100%; }
	.skeleton-shape { border-radius: var(--radius-control); background: var(--color-skeleton); animation: skeleton-loading 150ms ease; }
	.skeleton-line { height: var(--space-4); }
	.last-line { width: 70%; }
	.skeleton-title { width: 40%; height: var(--space-6); }
	.skeleton-block { min-height: calc(var(--space-12) * 2); }
	.skeleton-circle { width: 100%; height: 100%; min-height: var(--space-12); border-radius: var(--radius-pill); aspect-ratio: 1; }
	.card { padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
	@keyframes skeleton-loading { from { background: var(--color-skeleton-highlight); } to { background: var(--color-skeleton); } }
	@media (prefers-reduced-motion: reduce) { .skeleton-shape { animation: none; } }
</style>
