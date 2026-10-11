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
		disabledReason = '', href, form, title, ariaLabel,
		icon,
		iconRight = false,
		class: extraClass = '',
		onclick,
		children
	}: Props = $props();

	const variantClasses: Record<string, string> = {
		primary: 'bg-essu-green text-white hover:bg-essu-green-mid active:bg-essu-green border-transparent',
		secondary: 'bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 border border-gray-300',
		danger: 'bg-white text-red-700 hover:bg-red-50 active:bg-red-100 border-red-300',
		ghost: 'bg-transparent text-essu-green hover:bg-green-50 active:bg-green-100 border-transparent',
		success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 border-transparent',
		warning: 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 border-transparent'
	};

	const sizeClasses: Record<string, string> = {
		sm: 'text-xs px-3 py-1.5 gap-1.5',
		md: 'text-sm px-4 py-2 gap-2',
		lg: 'text-base px-5 py-2.5 gap-2.5'
	};

	const baseClass =
		'inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-essu-green/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
</script>

{#snippet content()}
	<span class="inline-grid items-center justify-center gap-[inherit]">
	<span class="inline-flex items-center justify-center gap-[inherit] [grid-area:1/1]" class:opacity-0={loading}>
		{#if icon && !iconRight}<i class={icon} aria-hidden="true"></i>{/if}
		{#if children}{@render children()}{/if}
		{#if icon && iconRight}<i class={icon} aria-hidden="true"></i>{/if}
	</span>
	{#if loadingLabel}<span class="invisible inline-flex items-center gap-2 [grid-area:1/1]" aria-hidden="true"><i class="fa-solid fa-circle-notch"></i>{loadingLabel}</span>{/if}
	</span>
	{#if loading}<span class="absolute inset-0 flex items-center justify-center gap-2" aria-hidden="true"><i class="fa-solid fa-circle-notch fa-spin"></i>{loadingLabel ?? ''}</span>{/if}
{/snippet}
<!-- svelte-ignore a11y_no_noninteractive_tabindex (The disabled button's wrapper receives focus so keyboard users can read its reason.) -->
<span class="button-tooltip inline-flex relative" role={disabled && disabledReason ? 'group' : undefined} aria-label={disabled && disabledReason ? disabledReason : undefined} tabindex={disabled && disabledReason ? 0 : undefined} title={disabled && disabledReason ? disabledReason : undefined}>
	{#if href}
		<a href={disabled || loading ? undefined : href} aria-disabled={disabled || loading} aria-busy={loading} aria-label={ariaLabel} title={title ?? ariaLabel} onclick={(event) => { if (disabled || loading) event.preventDefault(); else onclick?.(event); }} class="ui-button relative whitespace-nowrap {baseClass} {variantClasses[variant]} {sizeClasses[size]} {extraClass}">{@render content()}</a>
	{:else}
		<button {type} {form} disabled={disabled || loading} aria-busy={loading} aria-label={ariaLabel} title={disabled && disabledReason ? disabledReason : title ?? ariaLabel} {onclick} class="ui-button relative whitespace-nowrap {baseClass} {variantClasses[variant]} {sizeClasses[size]} {extraClass}">{@render content()}</button>
	{/if}
	{#if disabled && disabledReason}<span role="tooltip" class="reason-tooltip">{disabledReason}</span>{/if}
</span>
<style>
	.ui-button { min-height: 36px; }
	.ui-button[aria-disabled="true"] { opacity: .5; cursor: not-allowed; }
	.reason-tooltip { display: none; position: absolute; bottom: calc(100% + 6px); right: 0; z-index: 90; width: max-content; max-width: 240px; padding: 6px 10px; border-radius: 6px; background: #253b31; color: white; font-size: 12px; white-space: normal; }
	.button-tooltip:hover .reason-tooltip, .button-tooltip:focus .reason-tooltip, .button-tooltip:focus-within .reason-tooltip { display: block; }
	@media (pointer: coarse) { .ui-button { min-height: 44px; } }
</style>
