<script lang="ts">
	let note=$state(''),busy=$state(false),sent=$state(false),error=$state('');
	async function requestReview() {
		busy=true;error='';
		try {const res=await fetch('/api/students/review-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({note})});const data=await res.json();if(!res.ok){error=data.error??'Could not send review request.';return;}sent=true;} catch {error='Could not send review request. Please try again.';} finally {busy=false;}
	}
</script>
<details class="mt-3 text-sm"><summary class="cursor-pointer font-medium focus:outline-none focus:ring-2 focus:ring-essu-green/30">Need another ID review?</summary><div class="mt-2 space-y-2">
	<p>Explain any incorrect details or historical enrollment records the office should check. Your account stays restricted until an administrator reviews it. You can also contact the Graduate School office with your student ID.</p>
	{#if sent}<p role="status" class="text-essu-green font-medium">Your review request was sent to the office.</p>{:else}<label class="block">What should the office check?<textarea bind:value={note} maxlength="275" rows="2" class="block mt-1 w-full rounded-lg border border-gray-200 p-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-essu-green/30"></textarea></label><button onclick={requestReview} disabled={busy || !note.trim()} class="rounded-lg bg-essu-green text-white px-3 py-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30">{busy?'Sending...':'Request another review'}</button>{/if}
	{#if error}<p role="alert" class="text-red-700">{error}</p>{/if}
</div></details>
