<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'tertiary' | 'success' | 'warning';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		loadingLabel?: string;
		disabledReason?: string;
		href?: string;
		form?: string;
		id?: string;
		title?: string;
		ariaLabel?: string;
		ariaExpanded?: boolean;
		ariaPressed?: boolean;
		ariaControls?: string;
		icon?: string;
		iconRight?: boolean;
		class?: string;
		onclick?: (event: MouseEvent) => void;
		children?: Snippet;
	}

	const {
		variant = 'primary', size = 'md', type = 'button', disabled = false,
		loading = false, loadingLabel, disabledReason = '', href, form, id, title,
		ariaLabel, ariaExpanded, ariaPressed, ariaControls, icon, iconRight = false, class: extraClass = '', onclick, children
	}: Props = $props();
	const tooltipId = $props.id();
</script>

{#snippet content()}
	<span class="button-content">
		<span class="button-label" class:hidden-label={loading}>
			{#if icon && !iconRight}<i class={icon} aria-hidden="true"></i>{/if}
			{#if children}{@render children()}{/if}
			{#if icon && iconRight}<i class={icon} aria-hidden="true"></i>{/if}
		</span>
		{#if loadingLabel}
			<span class="loading-placeholder" aria-hidden="true"><i class="fa-solid fa-circle-notch"></i>{loadingLabel}</span>
		{/if}
		{#if loading}
			<span class="loading-content" aria-hidden="true"><i class="fa-solid fa-circle-notch button-spinner"></i>{loadingLabel ?? ''}</span>
		{/if}
	</span>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_tabindex (The wrapper makes a disabled reason available to keyboard users.) -->
<span class="button-tooltip" role={disabled && disabledReason ? 'group' : undefined} aria-label={disabled && disabledReason ? disabledReason : undefined} tabindex={disabled && disabledReason ? 0 : undefined} aria-describedby={disabled && disabledReason ? tooltipId : undefined} title={disabled && disabledReason ? disabledReason : undefined}>
	{#if href}
		<a {id} href={disabled || loading ? undefined : href} role={disabled || loading ? 'link' : undefined} tabindex={disabled || loading ? -1 : undefined} aria-disabled={disabled || loading} aria-busy={loading} aria-label={ariaLabel} aria-expanded={ariaExpanded} aria-pressed={ariaPressed} aria-controls={ariaControls} title={title ?? ariaLabel} onclick={(event) => { if (disabled || loading) event.preventDefault(); else onclick?.(event); }} class="ui-button variant-{variant} size-{size} {extraClass}">{@render content()}</a>
	{:else}
		<button {id} {type} {form} disabled={disabled || loading} aria-busy={loading} aria-label={ariaLabel} aria-expanded={ariaExpanded} aria-pressed={ariaPressed} aria-controls={ariaControls} title={disabled && disabledReason ? disabledReason : title ?? ariaLabel} {onclick} class="ui-button variant-{variant} size-{size} {extraClass}">{@render content()}</button>
	{/if}
	{#if disabled && disabledReason}<span id={tooltipId} role="tooltip" class="reason-tooltip">{disabledReason}</span>{/if}
</span>

<style>
	.button-tooltip { position: relative; display: inline-flex; max-width: 100%; vertical-align: middle; }
	.ui-button { --button-hover-bg: var(--color-primary-hover); --button-hover-border: var(--color-primary-hover); display: inline-flex; align-items: center; justify-content: center; height: var(--control-height); min-height: var(--control-height); min-width: var(--control-height); max-width: 100%; padding: 0 var(--space-4); border: 1px solid var(--color-primary); border-radius: var(--radius-control); background: var(--color-primary); color: var(--color-surface); font-size: var(--font-size-body); font-weight: var(--font-weight-medium); line-height: var(--line-height); text-decoration: none; white-space: nowrap; cursor: pointer; transition: background-color var(--motion-fast), border-color var(--motion-fast), color var(--motion-fast), box-shadow var(--motion-fast); }
	.ui-button:hover:not(:disabled):not([aria-disabled='true']) { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
	.ui-button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; box-shadow: var(--focus-ring); }
	.ui-button:disabled, .ui-button[aria-disabled='true'] { background: var(--color-bg); border-color: var(--color-border); color: var(--color-text-muted); cursor: not-allowed; }
	.ui-button[aria-busy='true'] { cursor: wait; }
	.size-sm { padding-inline: var(--space-3); font-size: var(--font-size-helper); }
	.size-lg { padding-inline: var(--space-6); font-size: var(--font-size-input); }
	.variant-secondary, .variant-success, .variant-warning, .variant-danger { background: var(--color-surface); color: var(--color-primary); }
	.variant-secondary { --button-hover-bg: var(--color-primary-soft); }
	.variant-secondary:hover:not(:disabled):not([aria-disabled='true']) { background: var(--color-primary-soft); }
	.variant-ghost, .variant-tertiary { --button-hover-bg: var(--color-primary-soft); --button-hover-border: transparent; background: transparent; border-color: transparent; color: var(--color-primary); }
	.variant-ghost:hover:not(:disabled):not([aria-disabled='true']), .variant-tertiary:hover:not(:disabled):not([aria-disabled='true']) { background: var(--color-primary-soft); border-color: transparent; }
	.variant-danger { --button-hover-bg: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface)); --button-hover-border: var(--color-danger); color: var(--color-danger); border-color: var(--color-danger); }
	.variant-success { --button-hover-bg: color-mix(in srgb, var(--color-success) 8%, var(--color-surface)); --button-hover-border: var(--color-success); color: var(--color-success); border-color: var(--color-success); }
	.variant-warning { --button-hover-bg: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface)); --button-hover-border: var(--color-warning); color: var(--color-warning); border-color: var(--color-warning); }
	.variant-danger:hover:not(:disabled):not([aria-disabled='true']) { background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface)); border-color: var(--color-danger); }
	.variant-success:hover:not(:disabled):not([aria-disabled='true']) { background: color-mix(in srgb, var(--color-success) 8%, var(--color-surface)); border-color: var(--color-success); }
	.variant-warning:hover:not(:disabled):not([aria-disabled='true']) { background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface)); border-color: var(--color-warning); }
	.button-content { display: inline-grid; align-items: center; justify-items: center; }
	.button-label, .loading-placeholder, .loading-content { grid-area: 1 / 1; display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); }
	.hidden-label { opacity: 0; }
	.loading-placeholder { visibility: hidden; }
	.button-spinner { animation: button-spin 900ms linear infinite; }
	.reason-tooltip { display: none; position: absolute; bottom: calc(100% + var(--space-2)); right: 0; z-index: 90; width: max-content; max-width: min(240px, 80vw); padding: var(--space-2) var(--space-3); border-radius: var(--radius-control); background: var(--color-text); color: var(--color-surface); font-size: var(--font-size-helper); line-height: var(--line-height); white-space: normal; }
	.button-tooltip:hover .reason-tooltip, .button-tooltip:focus .reason-tooltip, .button-tooltip:focus-within .reason-tooltip { display: block; }
	@keyframes button-spin { to { transform: rotate(360deg); } }
	@media (pointer: coarse) { .ui-button { height: var(--control-height-touch); min-height: var(--control-height-touch); min-width: var(--control-height-touch); } }
	@media (prefers-reduced-motion: reduce) { .button-spinner { animation: none; } }
</style>
