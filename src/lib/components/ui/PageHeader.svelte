<script lang="ts">
	import type { Snippet } from 'svelte';
	/** actions accepts one primary Button and, optionally, one secondary Button. */
	let {
		title,
		description,
		icon,
		badges,
		actions,
		variant = 'default'
	}: {
		title: string;
		description?: string;
		icon?: string;
		badges?: Snippet;
		actions?: Snippet;
		variant?: 'default' | 'dashboard' | 'compact';
	} = $props();
</script>

<header class="ui-page-header" class:dashboard={variant === 'dashboard'} class:compact={variant === 'compact'}>
	<div class="header-copy">
		<h1>{title}</h1>
		{#if description}<p>{description}</p>{/if}
		{#if badges}<div class="header-badges">{@render badges()}</div>{/if}
	</div>
	{#if actions}<div class="header-actions">{@render actions()}</div>{/if}
	{#if icon}<div class="header-art" aria-hidden="true"><span class="header-art-shape"><i class={icon}></i></span></div>{/if}
</header>

<style>
	.ui-page-header {
		position: relative;
		isolation: isolate;
		display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-4) var(--space-6);
	min-height: 132px;
		padding: clamp(1.125rem, 2.8vw, 1.75rem);
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--color-primary) 10%, var(--color-border));
		border-radius: var(--radius-panel);
		background:
			radial-gradient(ellipse at 92% 12%, color-mix(in srgb, #b8e0cb 48%, transparent), transparent 17rem),
			linear-gradient(112deg, #ffffff 0%, color-mix(in srgb, var(--color-primary-soft) 52%, #ffffff) 58%, #edf7f1 100%);
		box-shadow: var(--shadow-card);
		line-height: var(--line-height);
	}
	.ui-page-header::before,
	.ui-page-header::after {
		position: absolute;
		z-index: -1;
		content: '';
		pointer-events: none;
	}
	.ui-page-header::before {
		top: -4.5rem;
		right: 4.5rem;
		width: 11rem;
		height: 11rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 9%, transparent);
		border-radius: 2.5rem;
		background: color-mix(in srgb, var(--color-surface) 30%, transparent);
		transform: rotate(28deg);
	}
	.ui-page-header::after {
		right: -2.25rem;
		bottom: -5.5rem;
		width: 13rem;
		height: 13rem;
		border-radius: 50%;
		background: color-mix(in srgb, #a8d6bd 16%, transparent);
	}
	.header-copy { position: relative; z-index: 1; min-width: 0; padding-right: clamp(4rem, 9vw, 7.5rem); }
	h1 { margin: 0; color: var(--color-text); font-size: clamp(1.5rem, 2.6vw, 2rem); font-weight: var(--font-weight-semibold); letter-spacing: -0.035em; line-height: 1.2; }
	p { max-width: 52ch; margin: var(--space-2) 0 0; color: var(--color-text-muted); font-size: var(--font-size-body); line-height: 1.45; }
	.ui-page-header.dashboard p { max-width: none; }
	.header-badges { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
	.header-actions { position: relative; z-index: 2; display: flex; flex-shrink: 0; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-3); }
	.header-art { position: absolute; z-index: 0; top: 50%; right: clamp(1.125rem, 2.8vw, 1.75rem); display: grid; width: clamp(5rem, 9vw, 7.5rem); height: clamp(5rem, 9vw, 7.5rem); place-items: center; color: color-mix(in srgb, var(--color-primary) 34%, transparent); pointer-events: none; transform: translateY(-50%); }
	.header-art-shape { display: grid; width: 100%; height: 100%; place-items: center; border: 1px solid color-mix(in srgb, var(--color-primary) 12%, transparent); border-radius: 32% 42% 35% 46%; background: color-mix(in srgb, var(--color-surface) 42%, transparent); box-shadow: inset 0 0 0 0.55rem color-mix(in srgb, var(--color-primary) 3%, transparent); transform: rotate(-8deg); }
	.header-art i { font-size: clamp(2.25rem, 4.5vw, 3.5rem); transform: rotate(8deg); }
	.ui-page-header.dashboard { grid-template-columns: minmax(0, 1fr); min-height: 106px; }
	.ui-page-header.compact { min-height: 88px; }
	.ui-page-header.dashboard .header-art,
	.ui-page-header.compact .header-art { width: clamp(4rem, 7vw, 5.5rem); height: clamp(4rem, 7vw, 5.5rem); }
	.ui-page-header.dashboard .header-art i,
	.ui-page-header.compact .header-art i { font-size: clamp(1.9rem, 3.5vw, 2.75rem); }
	@media (max-width: 639px) {
		.ui-page-header { min-height: 0; gap: var(--space-3); padding: 1rem; }
		.ui-page-header.dashboard { min-height: 0; }
		.header-actions { grid-column: 1 / -1; justify-content: flex-start; }
		.header-copy { padding-right: 2.75rem; }
		.header-art { right: 1rem; width: 2.5rem; height: 2.5rem; }
		.header-art i { font-size: 1.4rem; }
		.ui-page-header.dashboard .header-art,
		.ui-page-header.compact .header-art { width: 2.5rem; height: 2.5rem; }
		.ui-page-header.dashboard .header-art i,
		.ui-page-header.compact .header-art i { font-size: 1.4rem; }
		p { max-width: 42ch; }
		.ui-page-header.dashboard p { max-width: 42ch; }
	}
	@media (max-width: 359px) {
		.ui-page-header { padding: 0.625rem; }
		.header-copy { padding-right: 0; }
		.header-art { display: none; }
		.header-art i { font-size: 1.4rem; }
		h1 { font-size: 1.35rem; }
	}
</style>
