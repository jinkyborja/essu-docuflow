<script lang="ts">
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
			: (message ?? 'An unexpected error occurred. Please try again.')
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

		<div class="flex items-center justify-center gap-2 mt-6">
			<button
				onclick={() => history.back()}
				class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
			>
				<i class="fa-solid fa-arrow-left mr-1.5 text-xs"></i>Go Back
			</button>
			<a
				href={homeHref}
				class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors font-medium"
			>
				{homeLabel}
			</a>
		</div>
	</div>
</div>
