<script lang="ts">
 import TextField from '$lib/components/ui/TextField.svelte';
 import Button from '$lib/components/ui/Button.svelte';
 import FormSection from '$lib/components/ui/FormSection.svelte';
 import FormActions from '$lib/components/ui/FormActions.svelte';
 import {validateForm} from '$lib/components/ui/form-validation';
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
<div class="auth-shell"><div class="auth-card"><aside class="auth-left" aria-label="ESSU DocuFlow introduction"><div class="auth-photo" aria-hidden="true"></div><div class="auth-brand-chip"><span class="auth-brand-icon"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i></span><span><strong>ESSU DocuFlow</strong><small>Student Document Request Portal</small></span></div><div class="auth-copy"><h2>Welcome to your ESSU staff workspace.</h2><a class="auth-pill" href="/login">Already have an account? Sign in <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div></aside><section class="auth-right" aria-label="Staff account setup"><div class="auth-content auth-staff-content">
 {#if !data.valid}<div class="auth-status"><div class="auth-status-icon" style="background:var(--color-danger-soft);color:var(--color-danger)"><i class="fa-solid fa-link-slash" aria-hidden="true"></i></div><h2>Invalid or expired link</h2><p>This invitation link is no longer valid. Please ask your admin to send a new invite.</p><Button variant="secondary" href="/login">Back to sign in</Button></div>
 {:else if success}<div class="auth-status"><div class="auth-status-icon"><i class="fa-solid fa-circle-check" aria-hidden="true"></i></div><h2>Account created</h2><p>Your {data.role} account has been set up. You can now log in.</p><Button href="/login">Sign in</Button></div>
 {:else}<div class="auth-heading"><div class="auth-accent"></div><h1>Set up your staff account</h1><p>Complete your details to activate your account.</p></div><div class="auth-email-badge"><i class="fa-solid fa-envelope" aria-hidden="true"></i><span>{data.email}</span><span class="auth-role">{data.role}</span></div>
 {#if error}<div class="auth-message" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>{error}</span></div>{/if}
 <form use:validateForm onsubmit={handleSubmit} class="auth-form"><FormSection><div class="auth-grid"><TextField label="First name" bind:value={firstName} required autocomplete="given-name" validator={value=>value.trim()?'':'Enter your first name.'}/><TextField label="Last name" bind:value={lastName} required autocomplete="family-name" validator={value=>value.trim()?'':'Enter your last name.'}/></div><TextField label="Position" bind:value={position} placeholder="e.g. Office clerk"/><TextField label="Password" bind:value={password} type="password" minlength={8} required passwordRules autocomplete="new-password"/><TextField label="Confirm password" bind:value={confirmPassword} type="password" required autocomplete="new-password" validator={value=>value===password?'':'Passwords do not match.'}/></FormSection><FormActions><Button type="submit" loading={submitting} loadingLabel="Creating account…">Create account</Button></FormActions></form>{/if}
 </div></section></div><p class="auth-footer">Eastern Samar State University · Graduate School</p></div>
