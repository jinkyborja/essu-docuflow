<script lang="ts">
	import { onDestroy } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { formatName } from '$lib/formatting';
	import { REQUEST_STATUSES } from '$lib/request-status';
	import { showToast, type ToastMessage } from '$lib/stores/toasts';

	const colors = ['primary', 'primary-hover', 'primary-soft', 'accent', 'bg', 'surface', 'border', 'text', 'text-muted', 'success', 'warning', 'danger', 'info'];
	const variants = ['primary', 'secondary', 'ghost', 'tertiary', 'success', 'warning'] as const;
	const states = ['default', 'hover', 'focus', 'loading', 'disabled'] as const;
	const sampleName = formatName('Maria', 'Santos', 'Dela Cruz');
	const initialMessages: ToastMessage[] = [
		{ id: 1, kind: 'success', message: 'Your changes were saved.' },
		{ id: 2, kind: 'error', message: 'Your changes could not be saved. Try again.' }
	];
	let previewMessages = $state([...initialMessages]);
	let saving = $state(false);
	let dialogOpen = $state(false);
	let dialogLoading = $state(false);
	let dialogScenario = $state('danger');
	let dangerState = $state<(typeof states)[number]>('default');
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let dialogTimer: ReturnType<typeof setTimeout> | undefined;

	function simulateSave() {
		saving = true;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => { saving = false; showToast('Loading preview complete.'); }, 1800);
	}
	function openDialog() {
		dialogOpen = true;
		dialogLoading = dialogScenario === 'loading' || (dialogScenario === 'danger' && dangerState === 'loading');
		clearTimeout(dialogTimer);
		if (dialogLoading) dialogTimer = setTimeout(() => { dialogLoading = false; if (dangerState === 'loading') dangerState = 'default'; }, 1800);
	}
	function confirmPreview() {
		dialogLoading = true;
		dialogTimer = setTimeout(() => { dialogLoading = false; dialogOpen = false; showToast('Confirmation preview complete.'); }, 1800);
	}
	onDestroy(() => { clearTimeout(saveTimer); clearTimeout(dialogTimer); });
</script>

<svelte:head><title>UI foundation · ESSU DocuFlow</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="ui-showcase">
	<PageHeader title="UI foundation" description="ESSU components, variants and interaction states.">
		{#snippet actions()}
			<Button variant="secondary" href="#buttons">View buttons</Button>
			<Button onclick={() => showToast('This is a live success toast.')} icon="fa-solid fa-check">Show toast</Button>
		{/snippet}
	</PageHeader>

	<Card title="Color tokens" description="The existing ESSU palette supplies every component color.">
		<div class="token-grid">
			{#each colors as color}<div class="token-sample"><span class="swatch" style:background={`var(--color-${color})`} aria-hidden="true"></span><code>--color-{color}</code></div>{/each}
		</div>
		<div class="sidebar-sample"><p>Graduate School</p><span>Sidebar section label contrast preview</span></div>
	</Card>

	<Card title="Type and scale">
		<div class="type-samples"><p class="type-page">Page title · 28px / 600</p><p class="type-card">Card title · 20px / 600</p><p class="type-input">Input text · 16px / 400</p><p>Body and tables · 14px / 400</p><p class="type-helper">Helper text and table headings · 12px / 500</p></div>
		<p class="helper">Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48px. Radius: controls 8px, cards 12px, modals 16px. Line height: 1.5.</p>
		<div class="input-samples"><label>Input<input placeholder="Enter a value" /></label><label>Disabled input<input value="Unavailable" disabled /></label></div>
	</Card>

	<section id="buttons" aria-labelledby="buttons-title" class="showcase-section">
		<div><h2 id="buttons-title">Button variants and states</h2><p class="helper">Each cell is an isolated component preview. Hover and focus samples use the component's own tokens; you can also use your pointer or Tab key.</p></div>
		{#each variants as variant}
			<div class="button-state-grid">
				{#each states as state}
					<Card>
						<div class="button-sample state-{state}"><p class="helper">{variant} / {state}</p><Button {variant} loading={state === 'loading'} disabled={state === 'disabled'} loadingLabel="Saving" disabledReason={state === 'disabled' ? 'This action is unavailable in this preview.' : undefined} onclick={() => showToast(`${variant} button selected.`)}>Save changes</Button></div>
					</Card>
				{/each}
			</div>
		{/each}
	</section>

	<div class="example-grid">
		<Card title="Button sizes and icons" description="All sizes are 40px tall, or 44px with a touch pointer.">
			<div class="sample-row"><Button size="sm" variant="secondary">Small</Button><Button size="md" icon="fa-solid fa-plus">Medium</Button><Button size="lg" variant="ghost" icon="fa-solid fa-arrow-right" iconRight>Large</Button><Button variant="ghost" icon="fa-solid fa-circle-info" ariaLabel="About this preview" onclick={() => showToast('Icon buttons include a tooltip and accessible label.')} /></div>
		</Card>
		<Card title="Loading width" description="Select Save changes to compare its width before and during loading.">
			<Button loading={saving} loadingLabel="Saving changes" onclick={simulateSave}>Save changes</Button>
		</Card>
		<Card title="Links and disabled reasons">
			<div class="sample-row"><Button href="#empty-states" variant="secondary">Go to empty states</Button><Button href="#empty-states" variant="ghost" disabled disabledReason="This link is unavailable.">Disabled link</Button><Button href="#empty-states" variant="secondary" loading loadingLabel="Opening">Loading link</Button></div>
		</Card>
		<Card title="Row menu" description="Destructive actions stay inside a menu or confirmation dialog.">
			<div class="sample-row"><span>{sampleName}</span><RowMenu items={[{ label: 'View details', onselect: () => showToast('Details preview selected.') }, { label: 'Unavailable action', disabled: true, reason: 'This action is currently unavailable.' }, { label: 'Delete sample', danger: true, onselect: () => { dialogScenario = 'danger'; openDialog(); } }]} /></div>
		</Card>
	</div>

	<Card title="Status chips" description="Status names come from the existing statusLabel helper.">
		<div class="status-groups">
			{#each ['sm', 'md'] as size}<div class="sample-row"><span class="helper">{size}</span>{#each REQUEST_STATUSES as value}<StatusChip {value} size={size === 'sm' ? 'sm' : 'md'} />{/each}</div>{/each}
			<div class="sample-row"><span class="helper">ID</span><StatusChip kind="id" value={true} /><StatusChip kind="id" value={false} /><StatusChip kind="id" value="rejected" /></div>
			<div class="sample-row"><span class="helper">Email</span><StatusChip kind="email" value={1} /><StatusChip kind="email" value="unverified" /></div>
			<div class="sample-row"><span class="helper">File</span>{#each ['missing', 'uploaded', 'needs_correction', 'in_person'] as value}<StatusChip kind="file" {value} />{/each}</div>
			<div class="sample-row"><span class="helper">Fallback</span><StatusChip value="unknown" /><StatusChip value="completed" /></div>
		</div>
	</Card>

	<div class="example-grid">
		<Card title="Toast variants" description="Dismiss the inline samples or show a live message.">
			<Toast inline messages={previewMessages} ondismiss={id => previewMessages = previewMessages.filter(message => message.id !== id)} />
			{#snippet footer()}<Button variant="secondary" onclick={() => previewMessages = [...initialMessages]}>Restore samples</Button><Button variant="ghost" onclick={() => showToast('This is a live error toast.', 'error')}>Show error toast</Button>{/snippet}
		</Card>
		<Card title="Confirmation dialog" description="Preview normal, reason-required, error, disabled and loading states.">
			<div class="dialog-controls"><label>Scenario<select bind:value={dialogScenario}><option value="danger">Destructive confirmation</option><option value="primary">Primary confirmation</option><option value="reason">Required reason</option><option value="error">Error message</option><option value="disabled">Disabled confirmation</option><option value="loading">Loading confirmation (1.8 seconds)</option></select></label><label>Destructive button state<select bind:value={dangerState}>{#each states as state}<option value={state}>{state}</option>{/each}</select></label><Button onclick={openDialog}>Open dialog</Button></div>
		</Card>
	</div>

	<section id="empty-states" class="example-grid" aria-label="Empty state variants">
		<Card title="Empty state"><EmptyState /></Card>
		<Card title="Empty state with action"><EmptyState title="No documents yet" description="Your documents will appear here." icon="fa-regular fa-folder-open">{#snippet action()}<Button icon="fa-solid fa-plus" onclick={() => showToast('Empty state action selected.')}>Add document</Button>{/snippet}</EmptyState></Card>
	</section>

	<div class="example-grid">
		<Card title="Default card" description="Border, 12px radius, 24px padding."><p>A simple content surface.</p>{#snippet footer()}<Button variant="secondary">Secondary action</Button>{/snippet}</Card>
		<Card title="Hover card" description="A shadow appears on hover." hover><p>Move your pointer over this surface.</p></Card>
		<StatCard label="Sample documents" value={24} icon="fa-solid fa-file-lines" subtitle="Reuses the Card foundation" trend={{ value: 8, label: 'sample trend' }} />
		<Card title="Skeleton variants" description="Static placeholders also respect reduced-motion preferences."><div class="skeleton-samples"><Skeleton /><Skeleton lines={3} width="80%" /><Skeleton variant="avatar" /><Skeleton variant="card" height="96px" /></div></Card>
	</div>

	<Card title="Page header without actions"><PageHeader title="Documents" /></Card>
	<Card title="Page header with a secondary action"><PageHeader title="Documents" description="Browse your available documents.">{#snippet actions()}<Button variant="secondary">Export list</Button>{/snippet}</PageHeader></Card>
</main>

<div class="dialog-preview state-{dangerState}">
	<ConfirmDialog open={dialogOpen} title={dialogScenario === 'primary' ? 'Save changes?' : 'Delete sample?'} message="This is a local UI preview using sample content." variant={dialogScenario === 'primary' ? 'primary' : 'danger'} confirmLabel={dialogScenario === 'primary' ? 'Save changes' : 'Delete sample'} loading={dialogLoading || (dialogScenario === 'danger' && dangerState === 'loading')} disabled={dialogScenario === 'disabled' || (dialogScenario === 'danger' && dangerState === 'disabled')} disabledReason="This action is unavailable in this preview." requireReason={dialogScenario === 'reason'} error={dialogScenario === 'error' ? 'The action could not be completed. Try again.' : ''} onclose={() => { dialogOpen = false; dangerState = 'default'; }} onconfirm={confirmPreview}>
		{#snippet details()}<div class="sample-row"><span>{sampleName}</span><StatusChip value="pending" /></div>{/snippet}
	</ConfirmDialog>
</div>

<style>
	.ui-showcase { display: flex; flex-direction: column; gap: var(--space-8); width: min(1440px, 100%); margin: 0 auto; padding: var(--space-8); color: var(--color-text); font-size: var(--font-size-body); line-height: var(--line-height); }
	h2 { margin: 0; font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); }
	p { margin: 0; }
	.helper, code { color: var(--color-text-muted); font-size: var(--font-size-helper); line-height: var(--line-height); }
	.helper { margin-top: var(--space-2); }
	.token-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-4); }
	.token-sample { display: flex; flex-direction: column; gap: var(--space-2); }
	.swatch { height: var(--space-12); border: 1px solid var(--color-border); border-radius: var(--radius-control); }
	.sidebar-sample { margin-top: var(--space-6); padding: var(--space-6); border-radius: var(--radius-card); background: var(--color-primary); color: var(--color-surface); }
	.sidebar-sample p { color: var(--color-primary-soft); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); text-transform: uppercase; }
	.type-samples, .showcase-section, .status-groups, .skeleton-samples, .dialog-controls { display: flex; flex-direction: column; gap: var(--space-4); }
	.type-page { font-size: var(--font-size-page-title); font-weight: var(--font-weight-semibold); }
	.type-card { font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); }
	.type-input { font-size: var(--font-size-input); }
	.type-helper { font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); }
	.button-state-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--space-4); }
	.button-sample { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); }
	.sample-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
	.example-grid, .input-samples { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6); }
	.input-samples { margin-top: var(--space-6); }
	label { display: flex; flex-direction: column; gap: var(--space-2); font-weight: var(--font-weight-medium); }
	input, select { width: 100%; min-width: 0; height: var(--control-height); padding: 0 var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font-size: var(--font-size-input); font-weight: var(--font-weight-normal); line-height: var(--line-height); }
	input:disabled { background: var(--color-bg); color: var(--color-text-muted); }
	:global(.button-sample.state-hover .ui-button:not(:disabled):not([aria-disabled='true'])), :global(.dialog-preview.state-hover .variant-danger:not(:disabled)) { background: var(--button-hover-bg); border-color: var(--button-hover-border); }
	:global(.button-sample.state-focus .ui-button:not(:disabled):not([aria-disabled='true'])), :global(.dialog-preview.state-focus .variant-danger:not(:disabled)) { outline: 2px solid var(--color-primary); outline-offset: 3px; box-shadow: var(--focus-ring); }
	@media (max-width: 1199px) { .button-state-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
	@media (max-width: 767px) { .button-state-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .example-grid, .input-samples { grid-template-columns: 1fr; } }
	@media (max-width: 639px) { .ui-showcase { padding: var(--space-4); gap: var(--space-6); } .button-state-grid { grid-template-columns: 1fr; } }
	@media (pointer: coarse) { input, select { height: var(--control-height-touch); } }
</style>
