<script lang="ts">
	import { formatActivityDetails } from '$lib/activity-details';
	let { action, summary, entityId, metadata }: {
		action: string;
		summary: string;
		entityId: string | number | null;
		metadata: unknown;
	} = $props();
	const sections = $derived(formatActivityDetails({ action, summary, entityId, metadata }));
</script>

{#if sections.length}
	<details class="activity-extra-details">
		<summary>
			<span>Activity Details</span>
			<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
		</summary>
		<div class="activity-detail-grid">
			{#each sections as section}
				<div class="activity-detail-section">
					<p>{section.label}</p>
					<div class="activity-detail-values">
						{#each section.values as value}
							<span>{value}</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</details>
{/if}

<style>
	.activity-extra-details {
		min-width: 0;
		margin-top: 8px;
		border-top: 1px solid var(--color-border);
		color: var(--color-text);
		font-size: var(--font-size-helper);
	}
	summary {
		display: flex;
		min-height: 36px;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		color: var(--color-primary);
		cursor: pointer;
		font-weight: var(--font-weight-semibold);
		list-style: none;
	}
	summary::-webkit-details-marker { display: none; }
	summary i { flex: 0 0 auto; color: var(--color-text-muted); transition: transform var(--motion-fast); }
	details[open] summary i { transform: rotate(180deg); }
	summary:focus-visible { border-radius: var(--radius-control); outline: 2px solid var(--color-primary); outline-offset: 2px; }
	.activity-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-2); padding: 0 0 var(--space-2); }
	.activity-detail-section { display: grid; min-width: 0; gap: var(--space-1); }
	.activity-detail-section p { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.activity-detail-values { display: flex; min-width: 0; flex-wrap: wrap; gap: var(--space-1); }
	.activity-detail-values span { max-width: 100%; overflow-wrap: anywhere; border-radius: 999px; background: var(--color-primary-soft); padding: 2px var(--space-2); color: var(--color-text); }
	@media (min-width: 640px) {
		.activity-detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
	}
</style>
