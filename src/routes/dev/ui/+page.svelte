<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { showToast } from '$lib/stores/toasts';
	import { REQUEST_STATUSES, statusLabel } from '$lib/request-status';
	const variants = ['primary', 'secondary', 'ghost', 'danger', 'success', 'warning'] as const;
	const tokens = ['primary', 'primary-hover', 'primary-soft', 'accent', 'bg', 'surface', 'border', 'text', 'text-muted', 'success', 'warning', 'danger', 'info'];
	let demoLoading = $state(false);
	let dialogOpen = $state(false);
	let dialogMode = $state<'simple' | 'reason' | 'loading' | 'error' | 'disabled'>('simple');
	let confirming = $state(false);
	function openDialog(mode: typeof dialogMode) { dialogMode = mode; dialogOpen = true; }
	async function confirmExample() {
		confirming = true;
		await new Promise(resolve => setTimeout(resolve, 600));
		confirming = false; dialogOpen = false;
		showToast('Example action completed.');
	}
</script>

<svelte:head><title>UI foundation · ESSU DocuFlow</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="ui-gallery">
	<PageHeader title="UI foundation" description="Development preview of the shared ESSU components and their states.">
		{#snippet secondaryAction()}<Button variant="secondary" onclick={() => demoLoading = !demoLoading}>{demoLoading ? 'Reset loading' : 'Preview loading'}</Button>{/snippet}
		{#snippet action()}<Button icon="fa-solid fa-plus" loading={demoLoading} onclick={() => showToast('Example created.')}>Create example</Button>{/snippet}
	</PageHeader>

	<Card title="Colors" description="All colors come from the global CSS variables."><div class="token-grid">{#each tokens as token}<div class="token-example"><span class="swatch" style:background={'var(--color-' + token + ')'} aria-hidden="true"></span><code>--color-{token}</code></div>{/each}</div></Card>
	<Card title="Type and spacing"><div class="type-examples"><p class="type-page">Page title · 28px</p><p class="type-card">Card title · 20px</p><label class="type-input" for="gallery-input">Input text · 16px</label><input id="gallery-input" class="gallery-input" placeholder="Type an example" /><p class="type-body">Body and table text · 14px</p><p class="type-helper">Helper text and table headings · 12px</p><p class="type-body">Weights: <span class="weight-normal">400</span>, <span class="weight-medium">500</span>, <span class="weight-semibold">600</span>. Line height: 1.5.</p><p class="type-body">Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48px.</p></div></Card>

	<section aria-labelledby="button-examples"><h2 id="button-examples" class="section-title">Buttons</h2><p class="section-description">40px controls, 44px on touch screens. Each sample area shows one action.</p><div class="variant-grid">{#each variants as variant}<Card title={variant.charAt(0).toUpperCase() + variant.slice(1)} description={variant === 'success' || variant === 'warning' ? 'Compatibility variant, shown as an outline action.' : undefined}><div class="state-grid">
		<section class="state-example"><h3>Default</h3><Button {variant} onclick={() => showToast('Example action completed.')}>Example action</Button></section>
		<section class="state-example"><h3>Small</h3><Button {variant} size="sm">Small action</Button></section>
		<section class="state-example"><h3>Large</h3><Button {variant} size="lg">Large action</Button></section>
		<section class="state-example"><h3>With icon</h3><Button {variant} icon="fa-solid fa-plus">Add example</Button></section>
		<section class="state-example"><h3>Disabled</h3><Button {variant} disabled disabledReason="Choose an example first">Unavailable</Button></section>
		<section class="state-example"><h3>Loading</h3><Button {variant} loading loadingLabel="Saving…">Save example</Button></section>
	</div></Card>{/each}</div></section>

	<Card title="Links and icon buttons"><div class="sample-row"><Button href="#status-examples">Jump to status chips</Button><Button variant="secondary" href="#status-examples" disabled disabledReason="This example link is disabled">Disabled link</Button><Button variant="ghost" ariaLabel="Open example settings" title="Open example settings" icon="fa-solid fa-gear" onclick={() => showToast('Example settings opened.')} /></div></Card>
	<Card title="Status chips"><div id="status-examples" class="status-groups">
		<section><h3>Requests</h3><div class="sample-row">{#each REQUEST_STATUSES as value}<StatusChip {value} /><StatusChip {value} size="sm" />{/each}<StatusChip value="completed" /></div></section>
		<section><h3>Student ID</h3><div class="sample-row">{#each ['pending', 'verified', 'rejected'] as value}<StatusChip kind="id" {value} />{/each}</div></section>
		<section><h3>Email</h3><div class="sample-row"><StatusChip kind="email" value={true} /><StatusChip kind="email" value={false} /><StatusChip kind="email" value="unverified" /></div></section>
		<section><h3>Files</h3><div class="sample-row">{#each ['missing', 'uploaded', 'needs_correction', 'in_person'] as value}<StatusChip kind="file" {value} />{/each}</div></section>
	</div></Card>
	<Card title="Menus and confirmations" description="Use the keyboard to check menus, focus trapping and dismissal."><div class="sample-row"><Button onclick={() => openDialog('simple')}>Open confirmation</Button><Button variant="secondary" onclick={() => openDialog('reason')}>Required reason</Button><Button variant="ghost" onclick={() => openDialog('loading')}>Loading state</Button><Button variant="ghost" onclick={() => openDialog('error')}>Error state</Button><Button variant="ghost" onclick={() => openDialog('disabled')}>Disabled state</Button><RowMenu label="Example actions" items={[{ label: 'Edit example', onselect: () => showToast('Example editor opened.') }, { label: 'Delete example', danger: true, onselect: () => openDialog('reason') }, { label: 'Archive', disabled: true, reason: 'Not available yet' }]} /></div></Card>
	<Card title="Toast messages" description="Messages dismiss automatically after four seconds."><div class="sample-row"><Button onclick={() => showToast('Changes saved successfully.')}>Show success</Button><Button variant="secondary" onclick={() => showToast('Could not save changes. Please try again.', 'error')}>Show error</Button></div></Card>
	<div class="variant-grid"><Card title="Default card" description="1px border, 12px radius, 24px padding."><p>No resting shadow.</p>{#snippet footer()}<Button variant="secondary">Secondary action</Button><Button>Primary action</Button>{/snippet}</Card><Card title="Hover card" description="An optional shadow appears on hover." hover><p>Use this for a surface that needs hover feedback.</p></Card></div>
	<Card title="Empty states"><EmptyState title="No requests yet" description="Request a document to get started.">{#snippet action()}<Button icon="fa-solid fa-plus" onclick={() => showToast('Example request started.')}>Request a document</Button>{/snippet}</EmptyState><EmptyState message="No matching results" icon="fa-solid fa-magnifying-glass" description="Try another search." /></Card>
	<Card title="Skeletons" description="Reduced motion keeps placeholders static."><div class="skeleton-examples"><Skeleton variant="circle" label="Loading avatar…" /><Skeleton lines={3} label="Loading text…" /><Skeleton variant="card" label="Loading card…" /></div></Card>
	<Card title="Labels"><p>Existing status labels are reused: {statusLabel('correction_requested')}.</p></Card>
</main>

<ConfirmDialog open={dialogOpen} title={dialogMode === 'reason' ? 'Delete example' : 'Confirm example action'} message={dialogMode === 'reason' ? 'Delete “Example item”? This is a preview action.' : 'This example demonstrates the shared confirmation dialog.'} requireReason={dialogMode === 'reason'} minLength={10} confirmLabel={dialogMode === 'reason' ? 'Delete example' : 'Confirm action'} variant={dialogMode === 'reason' ? 'danger' : 'primary'} loading={confirming || dialogMode === 'loading'} disabled={dialogMode === 'disabled'} disabledReason="Choose an example first" error={dialogMode === 'error' ? 'Could not complete the example. Try again.' : ''} onclose={() => dialogOpen = false} onconfirm={confirmExample}>
	{#snippet details()}{#if dialogMode === 'loading'}<Button variant="secondary" onclick={() => dialogMode = 'simple'}>Finish loading preview</Button>{/if}{/snippet}
</ConfirmDialog>

<style>
	.ui-gallery { display: flex; flex-direction: column; gap: var(--space-8); width: min(100%, 1200px); margin-inline: auto; padding: var(--space-6); color: var(--color-text); font-size: var(--type-body); line-height: var(--line-height); }
	.token-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); }
	.token-example { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
	.swatch { width: var(--space-8); height: var(--space-8); flex-shrink: 0; border: 1px solid var(--color-border); border-radius: var(--radius-control); }
	code { font-size: var(--type-helper); overflow-wrap: anywhere; }
	.type-examples, .status-groups { display: grid; gap: var(--space-4); }
	.type-page { font-size: var(--type-page-title); font-weight: var(--weight-semibold); }
	.type-card, .section-title { font-size: var(--type-card-title); font-weight: var(--weight-semibold); }
	.type-input { font-size: var(--type-input); }
	.type-body { font-size: var(--type-body); }
	.type-helper { font-size: var(--type-helper); color: var(--color-text-muted); }
	.weight-normal { font-weight: var(--weight-normal); } .weight-medium { font-weight: var(--weight-medium); } .weight-semibold { font-weight: var(--weight-semibold); }
	.gallery-input { width: 100%; max-width: 400px; min-height: var(--control-height); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font-size: var(--type-input); }
	.gallery-input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; box-shadow: var(--focus-ring); }
	.section-title { margin: 0 0 var(--space-1); }
	.section-description { margin: 0 0 var(--space-4); color: var(--color-text-muted); }
	.variant-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6); }
	.state-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-4); }
	.state-example { display: grid; align-content: start; justify-items: start; gap: var(--space-2); min-width: 0; }
	h3 { margin: 0 0 var(--space-2); font-size: var(--type-body); font-weight: var(--weight-medium); }
	.sample-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
	p { margin: 0; }
	.skeleton-examples { display: grid; gap: var(--space-6); }
	@media (max-width: 767px) { .variant-grid { grid-template-columns: 1fr; } }
</style>
