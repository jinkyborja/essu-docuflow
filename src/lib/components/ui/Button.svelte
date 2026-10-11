<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		loadingLabel?: string;
		disabledReason?: string;
		href?: string;
		form?: string;
		title?: string;
		ariaLabel?: string;
		ariaExpanded?: boolean;
		icon?: string;
		iconRight?: boolean;
		class?: string;
		onclick?: (event: MouseEvent) => void;
		children?: Snippet;
	}

	const {
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		loading = false,
		loadingLabel,
		disabledReason = '', href, form, title, ariaLabel, ariaExpanded,
		icon,
		iconRight = false,
		class: extraClass = '',
		onclick,
		children
	}: Props = $props();

	const tooltipId = $props.id();
	const unavailable = $derived(disabled || loading);
	const accessibleLabel = $derived(ariaLabel ?? (!children ? title : undefined));
</script>

{#snippet content()}
	<span class="inline-grid items-center justify-center gap-[inherit]">
	<span class="inline-flex items-center justify-center gap-[inherit] [grid-area:1/1]" class:opacity-0={loading}>
		{#if icon && !iconRight}<i class="button-icon {icon}" aria-hidden="true"></i>{/if}
		{#if children}{@render children()}{/if}
		{#if icon && iconRight}<i class="button-icon {icon}" aria-hidden="true"></i>{/if}
	</span>
	{#if loadingLabel}<span class="invisible inline-flex items-center gap-2 [grid-area:1/1]" aria-hidden="true"><i class="button-icon fa-solid fa-circle-notch"></i>{loadingLabel}</span>{/if}
	</span>
	{#if loading}<span class="absolute inset-0 flex items-center justify-center gap-2" aria-hidden="true"><i class="button-icon button-spinner fa-solid fa-circle-notch fa-spin"></i>{loadingLabel ?? ''}</span>{/if}
{/snippet}
<!-- svelte-ignore a11y_no_noninteractive_tabindex (The disabled button's wrapper receives focus so keyboard users can read its reason.) -->
<span class="button-tooltip inline-flex relative" role={disabled && disabledReason ? 'group' : undefined} aria-label={disabled && disabledReason ? disabledReason : undefined} tabindex={disabled && disabledReason ? 0 : undefined} title={disabled && disabledReason ? disabledReason : undefined}>
	{#if href}
		<a href={unavailable ? undefined : href} role={unavailable ? 'link' : undefined} tabindex={unavailable ? -1 : undefined} aria-disabled={unavailable} aria-busy={loading} aria-label={accessibleLabel} aria-describedby={disabled && disabledReason ? tooltipId : undefined} title={title ?? ariaLabel} onclick={(event) => { if (unavailable) event.preventDefault(); else onclick?.(event); }} class="ui-button relative whitespace-nowrap button-{variant} button-{size} {extraClass}">{@render content()}</a>
	{:else}
		<button {type} {form} disabled={unavailable} aria-busy={loading} aria-label={accessibleLabel} aria-expanded={ariaExpanded} aria-describedby={disabled && disabledReason ? tooltipId : undefined} title={disabled && disabledReason ? disabledReason : title ?? ariaLabel} onclick={(event) => { if (!unavailable) onclick?.(event); }} class="ui-button relative whitespace-nowrap button-{variant} button-{size} {extraClass}">{@render content()}</button>
	{/if}
	{#if disabled && disabledReason}<span id={tooltipId} role="tooltip" class="reason-tooltip">{disabledReason}</span>{/if}
</span>
<style>
	.ui-button { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); min-width: var(--control-height); min-height: var(--control-height); height: var(--control-height); padding: 0 var(--space-4); border: 1px solid transparent; border-radius: var(--radius-control); font-size: var(--type-body); font-weight: var(--weight-semibold); line-height: var(--line-height); text-decoration: none; cursor: pointer; transition: color var(--motion-fast), background-color var(--motion-fast), border-color var(--motion-fast), box-shadow var(--motion-fast); }
	.button-primary { background: var(--color-primary); color: var(--color-on-primary); }
	.button-primary:hover:not(:disabled):not([aria-disabled="true"]) { background: var(--color-primary-hover); }
	.button-secondary { background: var(--color-surface); border-color: var(--color-border); color: var(--color-text); }
	.button-secondary:hover:not(:disabled):not([aria-disabled="true"]) { background: var(--color-primary-soft); border-color: var(--color-primary); }
	.button-ghost { background: transparent; color: var(--color-primary); }
	.button-ghost:hover:not(:disabled):not([aria-disabled="true"]) { background: var(--color-primary-soft); }
	.button-danger { background: var(--color-surface); border-color: var(--color-danger); color: var(--color-danger); }
	.button-danger:hover:not(:disabled):not([aria-disabled="true"]) { background: var(--color-danger-soft); }
	/* Preserve legacy variants as outline actions; green remains the sole solid action. */
	.button-success { background: var(--color-surface); border-color: var(--color-success); color: var(--color-success); }
	.button-success:hover:not(:disabled):not([aria-disabled="true"]) { background: var(--color-success-soft); }
	.button-warning { background: var(--color-surface); border-color: var(--color-warning); color: var(--color-warning); }
	.button-warning:hover:not(:disabled):not([aria-disabled="true"]) { background: var(--color-warning-soft); }
	.button-sm { padding-inline: var(--space-3); font-size: var(--type-helper); }
	.button-lg { padding-inline: var(--space-6); font-size: var(--type-input); }
	.ui-button:focus-visible, .button-tooltip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; box-shadow: var(--focus-ring); }
	.ui-button:disabled:not([aria-busy="true"]), .ui-button[aria-disabled="true"]:not([aria-busy="true"]) { background: var(--color-surface-muted); border-color: var(--color-border); color: var(--color-text-muted); cursor: not-allowed; }
	.ui-button[aria-busy="true"] { opacity: 1; cursor: wait; }
	.button-icon { width: var(--icon-size); font-size: var(--icon-size); text-align: center; }
	.button-spinner { animation: button-spin 150ms ease infinite; }
	@keyframes button-spin { to { transform: rotate(1turn); } }
	.reason-tooltip { display: none; position: absolute; bottom: calc(100% + var(--space-2)); right: 0; z-index: 90; width: max-content; max-width: min(240px, calc(100vw - var(--space-8))); padding: var(--space-2) var(--space-3); border-radius: var(--radius-control); background: var(--color-tooltip); color: var(--color-surface); font-size: var(--type-helper); line-height: var(--line-height); white-space: normal; }
	.button-tooltip:hover .reason-tooltip, .button-tooltip:focus .reason-tooltip, .button-tooltip:focus-within .reason-tooltip { display: block; }
	@media (pointer: coarse) { .ui-button { min-width: var(--control-height-touch); min-height: var(--control-height-touch); height: var(--control-height-touch); } }
	@media (prefers-reduced-motion: reduce) { .button-spinner { animation: none; } }
</style>
