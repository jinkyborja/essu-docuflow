<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, message = 'No results found', icon = 'fa-solid fa-inbox', description, action }: {
		title?: string; message?: string; icon?: string; description?: string; action?: Snippet;
	} = $props();
</script>

<div class="ui-empty-state">
	<div class="empty-icon"><i class={icon} aria-hidden="true"></i></div>
	<h3>{title ?? message}</h3>
	{#if description}<p>{description}</p>{/if}
	{#if action}<div class="empty-action">{@render action()}</div>{/if}
</div>

<style>
	.ui-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-8) var(--space-6); text-align: center; font-size: var(--font-size-body); line-height: var(--line-height); }
	.empty-icon { display: grid; place-items: center; width: var(--space-12); height: var(--space-12); margin-bottom: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-primary-soft); color: var(--color-primary); font-size: var(--font-size-card-title); }
	h3 { margin: 0; color: var(--color-text); font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); }
	p { max-width: 60ch; margin: 0; color: var(--color-text-muted); text-wrap: pretty; }
	.empty-action { display: flex; justify-content: center; margin-top: var(--space-4); }
</style>
