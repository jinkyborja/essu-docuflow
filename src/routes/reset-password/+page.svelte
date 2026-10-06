<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	const token = $derived($page.url.searchParams.get('token') ?? '');

	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirm = $state(false);
	let error = $state('');
	let loading = $state(false);
	let success = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		if (password.length < 8) { error = 'Password must be at least 8 characters.'; return; }
		if (password !== confirmPassword) { error = 'Passwords do not match.'; return; }
		loading = true;
		try {
			const res = await fetch('/api/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, password })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Something went wrong.';
			} else {
				success = true;
				setTimeout(() => goto('/login'), 3000);
			}
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="auth-shell">
	<div class="auth-card">
		<aside class="auth-left" aria-label="ESSU DocuFlow introduction">
			<div class="auth-photo" aria-hidden="true"></div>
			<div class="auth-brand-chip"><span class="auth-brand-icon"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i></span><span><strong>ESSU DocuFlow</strong><small>Student Document Request Portal</small></span></div>
			<div class="auth-copy"><h2>Protect your account with a new password.</h2><ol class="auth-steps" aria-label="Password reset steps"><li><span>1</span>Verify</li><li><span>2</span>Update</li><li><span>3</span>Sign in</li></ol><a href="/login" class="auth-pill">Back to Sign In <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div>
		</aside>
		<section class="auth-right" aria-label="Reset password">
			<div class="auth-content">
				<div class="auth-heading"><div class="auth-accent"></div><h1>Create a new password</h1><p>Choose a strong password you haven't used before.</p></div>
				{#if !token}
					<div class="auth-status"><div class="auth-status-icon" style="background:#fdecec;color:#a93e3b"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i></div><p>Invalid or missing reset link.</p><a href="/login" class="auth-link">Back to Sign In</a></div>
				{:else if success}
					<div class="auth-status"><div class="auth-status-icon"><i class="fa-solid fa-circle-check" aria-hidden="true"></i></div><h2>Password updated!</h2><p>Redirecting you to the login page…</p></div>
				{:else}
					{#if error}<div class="auth-message" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>{error}</span></div>{/if}
					<form onsubmit={handleSubmit} class="auth-form">
						<div class="auth-field"><label for="reset-password">New Password</label><div class="auth-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="reset-password" bind:value={password} type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" required minlength="8" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onclick={() => (showPassword = !showPassword)}><i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i></button></div></div>
						<div class="auth-field"><label for="reset-confirm">Confirm Password</label><div class="auth-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="reset-confirm" bind:value={confirmPassword} type={showConfirm ? 'text' : 'password'} placeholder="Repeat password" required /><button type="button" aria-label={showConfirm ? 'Hide password' : 'Show password'} onclick={() => (showConfirm = !showConfirm)}><i class="fa-solid {showConfirm ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i></button></div></div>
						<button type="submit" disabled={loading} class="auth-submit">{#if loading}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>{/if}Set New Password <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
					</form>
					<div class="auth-status-link"><a href="/login" class="auth-link">← Back to Sign In</a></div>
				{/if}
			</div>
		</section>
	</div>
	<p class="auth-footer">Eastern Samar State University &middot; Graduate School</p>
</div>
