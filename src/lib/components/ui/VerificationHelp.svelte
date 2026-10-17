<script lang="ts">
	import Button from './Button.svelte';
	import { showToast } from '$lib/stores/toasts';
	import { newIdPhotoUploaded } from '$lib/stores/id-review';
	let { reason }: { reason: string | null } = $props();
	let note = $state(''), addingNote = $state(false), busy = $state(false), sent = $state(false), error = $state('');
	const enabled = $derived(!!note.trim() || $newIdPhotoUploaded);
	async function requestReview() {
		if (busy || !enabled || sent) return;
		busy = true; error = '';
		try {
			// Photo completion already queues its review; avoid a duplicate review request.
			if (!$newIdPhotoUploaded) {
				const response = await fetch('/api/students/review-request', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({note: note.trim()})});
				const result = await response.json();
				if (!response.ok) throw new Error(result.error ?? 'Could not send your review request.');
			}
			sent = true; showToast('Your ID review request was sent to the Graduate School office.');
		} catch (failure) { error = (failure as Error).message; showToast(error, 'error'); }
		finally { busy = false; }
	}
</script>
<section aria-labelledby="id-rejected-heading" class="verification-card">
	<div class="verification-icon" aria-hidden="true"><i class="fa-solid fa-id-card"></i></div>
	<div class="verification-content">
		<div class="verification-heading">
			<div>
				<p class="verification-eyebrow">Account attention</p>
				<h2 id="id-rejected-heading">Your ID could not be verified</h2>
			</div>
		</div>
		<p class="verification-reason"><span>Reason:</span> {reason || 'Please contact the Graduate School office.'}</p>
		<p class="verification-instructions">Upload a clear photo of the front of your school ID, or add a note for the office, then resubmit for review.</p>
		{#if addingNote}
			<label class="note-label">Note for the office (optional)
				<textarea bind:value={note} maxlength="275" rows="2" disabled={busy || sent} placeholder="Tell the office what to check again."></textarea>
			</label>
		{/if}
		<div class="verification-actions">
			<Button href="/student/profile#school-id-photo-card" icon="fa-solid fa-camera">Upload new ID photo</Button>
			<Button variant="secondary" disabled={busy || sent} onclick={() => addingNote = !addingNote}>{addingNote ? 'Hide note' : 'Add a note'}</Button>
			<Button variant="secondary" loading={busy} loadingLabel="Sending…" disabled={!enabled || sent} disabledReason={sent ? 'Your review request has already been sent' : 'Upload a new ID photo or type a note first'} onclick={() => void requestReview()}>Resubmit for review</Button>
		</div>
		{#if !enabled && !sent}<p class="verification-hint">Upload a new ID photo or type a note to enable resubmission.</p>{/if}
		{#if sent}<p role="status" class="verification-status">Your review request was sent. Wait for the office to finish reviewing.</p>{/if}
		{#if error}<p role="alert" class="verification-error">{error}</p>{/if}
	</div>
</section>

<style>
	.verification-card { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: var(--space-3); padding: var(--space-4) var(--space-5); border: 1px solid color-mix(in srgb, var(--color-danger) 26%, var(--color-border)); border-radius: var(--radius-panel); background: color-mix(in srgb, var(--color-danger) 3%, var(--color-surface)); box-shadow: var(--shadow-card); }
	.verification-icon { display: grid; width: 2.5rem; height: 2.5rem; place-items: center; border-radius: var(--radius-control); background: color-mix(in srgb, var(--color-danger) 9%, var(--color-surface)); color: var(--color-danger); }
	.verification-content { min-width: 0; }
	.verification-eyebrow { margin: 0 0 var(--space-1); color: var(--color-danger); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: .05em; }
	h2 { margin: 0; color: var(--color-text); font-size: var(--font-size-input); font-weight: var(--font-weight-semibold); line-height: var(--line-height); }
	.verification-reason { margin: var(--space-2) 0 0; color: var(--color-danger); font-size: var(--font-size-body); }
	.verification-reason span { font-weight: var(--font-weight-semibold); }
	.verification-instructions { margin: var(--space-1) 0 0; color: var(--color-text-muted); font-size: var(--font-size-helper); line-height: var(--line-height); }
	.note-label { display: block; margin-top: var(--space-3); color: var(--color-text); font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); }
	textarea { display: block; width: 100%; margin-top: var(--space-1); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; font-weight: 400; resize: vertical; }
	textarea:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
	.verification-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
	.verification-actions :global(.button-tooltip) { flex: 1 1 10rem; }
	.verification-actions :global(.ui-button) { width: 100%; }
	.verification-hint, .verification-status, .verification-error { margin: var(--space-2) 0 0; font-size: var(--font-size-helper); }
	.verification-hint { color: var(--color-text-muted); }
	.verification-status { color: var(--color-success); }
	.verification-error { color: var(--color-danger); }
	@media (max-width: 639px) {
		.verification-card { padding: var(--space-3); }
		.verification-actions { display: grid; grid-template-columns: minmax(0, 1fr); }
	}
</style>
