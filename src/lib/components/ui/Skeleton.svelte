<script lang="ts">
	let { variant = 'text', lines = 1, width, height, label = 'Loading content' }: {
		variant?: 'text' | 'avatar' | 'card'; lines?: number; width?: string; height?: string; label?: string;
	} = $props();
</script>

<div class="ui-skeleton skeleton-{variant}" role="status" aria-label={label} style:--skeleton-width={width} style:--skeleton-height={height}>
	{#each Array.from({ length: variant === 'text' ? Math.max(1, lines) : 1 }) as _, index}
		<span class="skeleton-block" class:last-line={variant === 'text' && lines > 1 && index === lines - 1} aria-hidden="true"></span>
	{/each}
</div>

<style>
	.ui-skeleton { display: flex; flex-direction: column; gap: var(--space-2); width: var(--skeleton-width, 100%); max-width: 100%; }
	.skeleton-block { display: block; width: 100%; height: var(--skeleton-height, var(--space-4)); border-radius: var(--radius-control); background: var(--color-border); }
	.last-line { width: 80%; }
	.skeleton-avatar { width: var(--skeleton-width, var(--space-12)); }
	.skeleton-avatar .skeleton-block { height: var(--skeleton-height, var(--space-12)); border-radius: 50%; }
	.skeleton-card .skeleton-block { height: var(--skeleton-height, 128px); border-radius: var(--radius-card); }
</style>
