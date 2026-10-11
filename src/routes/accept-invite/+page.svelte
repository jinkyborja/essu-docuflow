<script lang="ts">
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let firstName = $state('');
	let lastName = $state('');
	let position = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirm = $state(false);
	let submitting = $state(false);
	let error = $state('');
	let success = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		if (password !== confirmPassword) { error = 'Passwords do not match.'; return; }
		if (password.length < 8) { error = 'Password must be at least 8 characters.'; return; }
		submitting = true;
		try {
			const res = await fetch('/api/accept-invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: data.token, firstName, lastName, position, password })
			});
			const result = await res.json();
			if (!res.ok) { error = result.error ?? 'Failed to create account.'; return; }
			success = true;
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="auth-shell">
	<div class="auth-card">
		<aside class="auth-left" aria-label="ESSU DocuFlow introduction">
			<div class="auth-photo" aria-hidden="true"></div>
			<div class="auth-brand-chip"><span class="auth-brand-icon"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i></span><span><strong>ESSU DocuFlow</strong><small>Student Document Request Portal</small></span></div>
			<div class="auth-copy"><h2>Welcome to your ESSU staff workspace.</h2><ol class="auth-steps" aria-label="How DocuFlow works"><li><span>1</span>Request</li><li><span>2</span>Track</li><li><span>3</span>Receive</li></ol><a class="auth-pill" href="/login">Already have an account? Sign in <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div>
		</aside>
		<section class="auth-right" aria-label="Staff account setup">
			<div class="auth-content auth-staff-content">
				{#if !data.valid}
					<div class="auth-status"><div class="auth-status-icon" style="background:#fdecec;color:#a93e3b"><i class="fa-solid fa-link-slash" aria-hidden="true"></i></div><h2>Invalid or Expired Link</h2><p>This invitation link is no longer valid. Please ask your admin to send a new invite.</p></div>
				{:else if success}
					<div class="auth-status"><div class="auth-status-icon"><i class="fa-solid fa-circle-check" aria-hidden="true"></i></div><h2>Account Created!</h2><p>Your {data.role} account has been set up. You can now log in.</p><a href="/login" class="auth-link">Go to Login <i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i></a></div>
				{:else}
					<div class="auth-heading"><div class="auth-accent"></div><h1>Set up your staff account</h1><p>Complete your details to activate your account.</p></div>
					<div class="auth-email-badge"><i class="fa-solid fa-envelope" aria-hidden="true"></i><span>{data.email}</span><span class="auth-role">{data.role}</span></div>
					{#if error}<div class="auth-message" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>{error}</span></div>{/if}
					<form onsubmit={handleSubmit} class="auth-form">
						<div class="auth-grid">
							<div class="auth-field"><label for="staff-first">First Name <span>*</span></label><div class="auth-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><input id="staff-first" bind:value={firstName} type="text" required autocomplete="given-name" /></div></div>
							<div class="auth-field"><label for="staff-last">Last Name <span>*</span></label><div class="auth-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><input id="staff-last" bind:value={lastName} type="text" required autocomplete="family-name" /></div></div>
							<div class="auth-field" style="grid-column:1/-1"><label for="staff-position">Position / Title <span>(optional)</span></label><div class="auth-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><input id="staff-position" bind:value={position} type="text" placeholder="e.g. Registrar, Records Officer" autocomplete="organization-title" /></div></div>
							<div class="auth-field"><label for="staff-password">Password <span>*</span></label><div class="auth-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="staff-password" bind:value={password} type={showPassword ? 'text' : 'password'} required autocomplete="new-password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onclick={() => (showPassword = !showPassword)}><i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i></button></div></div>
							<div class="auth-field"><label for="staff-confirm">Confirm Password <span>*</span></label><div class="auth-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="staff-confirm" bind:value={confirmPassword} type={showConfirm ? 'text' : 'password'} required autocomplete="new-password" /><button type="button" aria-label={showConfirm ? 'Hide password' : 'Show password'} onclick={() => (showConfirm = !showConfirm)}><i class="fa-solid {showConfirm ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i></button></div></div>
						</div>
						<button type="submit" disabled={submitting} class="auth-submit">{#if submitting}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>{/if}Create Account <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
					</form>
				{/if}
			</div>
		</section>
	</div>
	<p class="auth-footer">Eastern Samar State University &middot; Graduate School</p>
</div>
