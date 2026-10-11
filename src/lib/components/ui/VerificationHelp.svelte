<script lang="ts">
	import Button from './Button.svelte';
 import TextArea from './TextArea.svelte';
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
<section aria-labelledby="id-rejected-heading" class="mb-5 rounded-xl border border-red-200 bg-white p-5 shadow-sm">
	<h2 id="id-rejected-heading" class="text-lg font-semibold text-gray-800">Your ID could not be verified</h2>
	<p class="mt-2 text-sm text-red-800"><span class="font-medium">Reason:</span> {reason || 'Please contact the Graduate School office.'}</p>
	<ol class="my-4 list-decimal space-y-2 pl-5 text-sm text-gray-700"><li>Upload a new, clear photo of your school ID (front).</li><li>Optionally add a note for the office.</li><li>Resubmit for review.</li></ol>
	{#if addingNote}<div class="mb-4"><TextArea label="Note for the office (optional)" bind:value={note} maxlength={275} rows={3} disabled={busy || sent} placeholder="Tell the office what to check again."/></div>{/if}
	<div class="flex flex-wrap gap-3"><Button href="/student/profile#school-id-photo-card">Upload new ID photo</Button><Button variant="secondary" disabled={busy || sent} onclick={() => addingNote = !addingNote}>{addingNote ? 'Hide note' : 'Add a note'}</Button><Button variant="secondary" loading={busy} loadingLabel="Sending…" disabled={!enabled || sent} disabledReason={sent ? 'Your review request has already been sent' : 'Upload a new ID photo or type a note first'} onclick={() => void requestReview()}>Resubmit for review</Button></div>
	{#if !enabled && !sent}<p class="mt-3 text-xs text-gray-600">Upload a new ID photo or type a note to enable resubmission.</p>{/if}
	{#if sent}<p role="status" class="mt-3 text-sm text-essu-green">Your review request was sent. Wait for the office to finish reviewing.</p>{/if}
	{#if error}<p role="alert" class="mt-3 text-sm text-red-700">{error}</p>{/if}
</section>
