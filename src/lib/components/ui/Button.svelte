<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		icon?: string;
		iconRight?: boolean;
		class?: string;
		onclick?: () => void;
		children?: Snippet;
	}

	const {
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		loading = false,
		icon,
		iconRight = false,
		class: extraClass = '',
		onclick,
		children
	}: Props = $props();

	const variantClasses: Record<string, string> = {
		primary: 'bg-essu-green text-white hover:bg-essu-green-mid active:bg-essu-green border-transparent',
		secondary: 'bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 border border-gray-300',
		danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border-transparent',
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

<button
	{type}
	disabled={disabled || loading}
	{onclick}
	class="{baseClass} {variantClasses[variant]} {sizeClasses[size]} {extraClass}"
>
	{#if loading}
		<i class="fa-solid fa-circle-notch fa-spin"></i>
	{:else if icon && !iconRight}
		<i class="{icon}"></i>
	{/if}

	{#if children}
		{@render children()}
	{/if}

	{#if icon && iconRight && !loading}
		<i class="{icon}"></i>
	{/if}
</button>
