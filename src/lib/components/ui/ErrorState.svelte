<script lang="ts">
	import Button from './Button.svelte';
	// Shared body for the +error.svelte pages. When rendered from an error page
	// nested under /staff or /student, the surrounding layout (sidebar + topbar)
	// still renders, so this only draws the inner panel.
	interface Props {
		status: number;
		message?: string;
		homeHref?: string;
		homeLabel?: string;
	}

	const { status, message, homeHref = '/', homeLabel = 'Go to Dashboard' }: Props = $props();

	const isNotFound = $derived(status === 404);
	const heading = $derived(isNotFound ? 'Page not found' : 'Something went wrong');
	const detail = $derived(
		isNotFound
			? "The page you're looking for doesn't exist or may have been moved."
			: status >= 500 ? 'We couldn’t load this page. Please try again in a moment.' : (message ?? 'We couldn’t load this page. Please try again.')
	);
</script>

<div class="flex items-center justify-center py-16 px-4">
	<div class="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-md w-full p-8 text-center">
		<div
			class="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center
				{isNotFound ? 'bg-essu-green/10' : 'bg-red-50'}"
		>
			<i
				class="fa-solid {isNotFound ? 'fa-map-signs text-essu-green' : 'fa-triangle-exclamation text-red-500'} text-2xl"
			></i>
		</div>

		<p class="text-5xl font-bold text-gray-800 tracking-tight">{status}</p>
		<h1 class="text-lg font-semibold text-gray-800 mt-2">{heading}</h1>
		<p class="text-sm text-gray-500 mt-2 leading-relaxed">{detail}</p>

		<div class="mt-6 flex flex-wrap items-center justify-center gap-2">
			{#if !isNotFound}<Button onclick={() => window.location.reload()}>Try again</Button>{/if}
			<Button variant="secondary" onclick={() => history.back()} icon="fa-solid fa-arrow-left">Go back</Button>
			<Button variant="secondary" href={homeHref}>{homeLabel}</Button>
		</div>
	</div>
</div>
