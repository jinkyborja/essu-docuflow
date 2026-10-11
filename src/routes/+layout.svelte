<script lang="ts">
	import '../app.css';
	import Toast from '$lib/components/ui/Toast.svelte';
	import type { Snippet } from 'svelte';

	const { children }: { children: Snippet } = $props();
</script>

{@render children()}
<Toast />
