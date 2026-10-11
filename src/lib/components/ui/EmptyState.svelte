<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		title?: string;
		message?: string;
		icon?: string;
		description?: string;
		action?: Snippet;
	}

	const {
		title,
		message = 'No results found',
		icon = 'fa-solid fa-inbox',
		description,
		action
	}: Props = $props();
</script>

<div class="ui-empty-state">
	<div class="empty-icon"><i class={icon} aria-hidden="true"></i></div>
	<h2>{title ?? message}</h2>
	{#if description}<p title={description}>{description}</p>{/if}
	{#if action}<div class="empty-action">{@render action()}</div>{/if}
</div>

<style>
	.ui-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); padding: var(--space-12) var(--space-6); text-align: center; color: var(--color-text); line-height: var(--line-height); }
	.empty-icon { display: grid; place-items: center; width: var(--space-12); height: var(--space-12); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-primary-soft); color: var(--color-primary); font-size: var(--type-card-title); }
	h2 { margin: 0; font-size: var(--type-card-title); font-weight: var(--weight-semibold); line-height: var(--line-height); }
	p { max-width: min(100%, 48ch); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-muted); font-size: var(--type-body); }
	.empty-action { margin-top: var(--space-1); }
</style>
