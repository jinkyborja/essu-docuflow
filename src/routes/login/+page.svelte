<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { graduatePrograms } from '$lib/data/programs';
	import { studentTypes, nameSuffixes } from '$lib/data/student-types';
	import Select from '$lib/components/forms/Select.svelte';

	let mode: 'login' | 'signup' | 'check-email' | 'forgot' | 'forgot-sent' = $state('login');
	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let showLoginPassword = $state(false);
	let firstName = $state('');
	let middleName = $state('');
	let lastName = $state('');
	let suffix = $state('');
	let dateOfBirth = $state('');

	const formatName = (v: string) =>
		v
			.replace(/[^\p{L}\s.'-]/gu, '')
			.replace(/^\s+/, '')
			.replace(/\s{2,}/g, ' ')
			.replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

	const formatStudentId = (v: string, deleting = false) => {
		const d = v.replace(/\D/g, '').slice(0, 6);
		if (d.length > 2) return d.slice(0, 2) + '-' + d.slice(2);
		if (d.length === 2 && !deleting) return d + '-';
		return d;
	};

	// Accepted date-of-birth range for graduate-school applicants.
	const DOB_MIN = '1940-01-01';
	const DOB_MAX = '2008-12-31';
	let confirmPassword = $state('');
	let studentId = $state('');
	let studentIdError = $state('');
	let program = $state('');
	let studentType = $state('');
	let lastSchoolYear = $state('');
	let rememberMe = $state(false);
	let error = $state('');
	let loading = $state(false);
	let forgotEmail = $state('');

	async function handleForgotPassword(e: Event) {
		e.preventDefault();
		error = '';
		if (!forgotEmail) { error = 'Please enter your email address.'; return; }
		loading = true;
		try {
			await fetch('/api/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: forgotEmail })
			});
			mode = 'forgot-sent';
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleLogin(e: Event) {
		e.preventDefault();
		error = '';
		if (!email || !password) { error = 'Please fill in all fields.'; return; }
		loading = true;
		try {
			const res = await fetch('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password, rememberMe })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Login failed. Please try again.';
			} else {
				goto(data.role === 'student' ? '/student/dashboard' : '/staff/dashboard');
			}
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleSignup(e: Event) {
		e.preventDefault();
		if (!browser) return;
		error = '';
		studentIdError = '';
		if (!firstName || !lastName || !dateOfBirth || !email || !program || !studentType || !lastSchoolYear || !password || !confirmPassword) { error = 'Please fill in all required fields.'; return; }
		if (dateOfBirth < DOB_MIN || dateOfBirth > DOB_MAX) {
			error = `Date of birth must be between ${DOB_MIN.slice(0, 4)} and ${DOB_MAX.slice(0, 4)}.`;
			return;
		}
		if (!/^\d{2}-\d{4}$/.test(studentId)) {
			studentIdError = 'Student ID must follow the format NN-NNNN.';
			return;
		}
		if (password !== confirmPassword) { error = 'Passwords do not match.'; return; }
		loading = true;
		try {
			const res = await fetch('/api/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ firstName, middleName, lastName, suffix: suffix || null, dateOfBirth, email, studentId, program, studentType, lastSchoolYear: Number(lastSchoolYear), password })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Registration failed. Please try again.';
			} else {
				mode = 'check-email';
			}
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>
<div class="login-page auth-shell">
	<div class="login-card auth-card">
		<aside class="login-story" aria-label="ESSU DocuFlow introduction">
			<div class="story-photo" aria-hidden="true"></div>
			<div class="story-chip"><span class="story-icon"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i></span><span><strong>ESSU DocuFlow</strong><small>Student Document Request Portal</small></span></div>
			<div class="story-copy">
				<h2>Request your school documents, the easy way.</h2>
				<ol class="steps" aria-label="How DocuFlow works"><li class="step"><span>1</span>Request</li><li class="step"><span>2</span>Track</li><li class="step"><span>3</span>Receive</li></ol>
				{#if mode === 'login' || mode === 'signup'}
					<button class="login-switch-card" type="button" onclick={() => { mode = mode === 'login' ? 'signup' : 'login'; error = ''; }}>
						<span>{mode === 'login' ? 'New here?' : 'Already have an account?'}</span><strong>{mode === 'login' ? 'Create account' : 'Sign in'} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></strong>
					</button>
				{/if}
			</div>
		</aside>
		<section class="login-form-panel" aria-label="Account access">
			<div class="form-column" class:signup-column={mode === 'signup'} class:login-column={mode === 'login'}>
				{#if mode === 'login' || mode === 'signup'}
					<div class="login-tabs" role="tablist" aria-label="Account access">
						<button type="button" role="tab" aria-selected={mode === 'login'} onclick={() => { mode = 'login'; error = ''; }} class:active={mode === 'login'}>Sign In</button>
						<button type="button" role="tab" aria-selected={mode === 'signup'} onclick={() => { mode = 'signup'; error = ''; }} class:active={mode === 'signup'}>Create Account</button>
					</div>
					<div class="form-heading"><span class="gold-bar"></span><h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p>{mode === 'login' ? 'Sign in to request and track your documents.' : "Use your official school details. Name, student ID and program can't be changed later."}</p></div>
				{/if}

				{#if mode === 'check-email'}
					<div class="result-state"><div class="result-icon"><i class="fa-solid fa-envelope-circle-check" aria-hidden="true"></i></div><h2>Check your email</h2><p>We sent a verification link to <strong>{email}</strong>. Click it to activate your account. The link expires in 24 hours.</p><button type="button" class="text-action" onclick={() => { mode = 'login'; error = ''; }}>Back to Sign In</button></div>
				{:else if mode === 'forgot'}
					<div class="form-heading secondary-heading"><span class="gold-bar"></span><h1>Forgot your password?</h1><p>Enter your email and we'll send you a reset link.</p></div>
					<form onsubmit={handleForgotPassword} class="access-form compact-form">
						<div class="form-scroll signin-scroll"><div class="field"><label for="forgot-email">Email Address</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM4 7l8 6 8-6"/></svg><input id="forgot-email" bind:value={forgotEmail} type="email" placeholder="yourname@essu.edu.ph" required /></div></div>{#if error}<div class="alert" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>{error}</span></div>{/if}</div>
						<div class="form-actions"><button type="button" class="forgot-link" onclick={() => { mode = 'login'; error = ''; }}>Back to Sign In</button><button type="submit" disabled={loading} class="primary-button">{#if loading}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>{/if}Send Reset Link <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>
					</form>
				{:else if mode === 'forgot-sent'}
					<div class="result-state"><div class="result-icon"><i class="fa-solid fa-envelope-circle-check" aria-hidden="true"></i></div><h2>Check your email</h2><p>If an account exists for <strong>{forgotEmail}</strong>, we've sent a password reset link. It expires in 1 hour.</p><button type="button" class="text-action" onclick={() => { mode = 'login'; error = ''; }}>Back to Sign In</button></div>
				{:else if mode === 'login'}
					<form onsubmit={handleLogin} class="access-form">
						<div class="form-scroll signin-scroll">
							{#if error}<div class="alert" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>{error}</span></div>{/if}
							<div class="field"><label for="login-email">Email Address</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM4 7l8 6 8-6"/></svg><input id="login-email" bind:value={email} type="email" placeholder="yourname@essu.edu.ph" required /></div></div>
							<div class="field"><label for="login-password">Password</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="login-password" bind:value={password} type={showLoginPassword ? 'text' : 'password'} placeholder="Enter your password" required /><button type="button" class="visibility-button" aria-label={showLoginPassword ? 'Hide password' : 'Show password'} onclick={() => (showLoginPassword = !showLoginPassword)}><i class="fa-solid {showLoginPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i></button></div></div>
						</div>
						<div class="form-actions login-actions"><div class="remember-row"><label><input bind:checked={rememberMe} type="checkbox" />Remember me</label><button type="button" class="forgot-link" onclick={() => { mode = 'forgot'; error = ''; forgotEmail = email; }}>Forgot password?</button></div><button type="submit" disabled={loading} class="primary-button auth-submit">{#if loading}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>{/if}Sign In <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button><p class="secure-note"><i class="fa-solid fa-lock" aria-hidden="true"></i>Secure sign-in for ESSU students and staff</p></div>
					</form>
				{:else}
					<form onsubmit={handleSignup} class="access-form signup-form" autocomplete="off">
						<div class="form-scroll signup-scroll">
							<div class="signup-grid">
								<div class="field"><label for="signup-first">First Name</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><input id="signup-first" value={firstName} type="text" placeholder="Juan" required oninput={(e) => { firstName = formatName(e.currentTarget.value); }} onpaste={(e) => { const input = e.currentTarget; const start = input.selectionStart ?? input.value.length; const end = input.selectionEnd ?? input.value.length; const next = formatName(input.value.slice(0, start) + (e.clipboardData?.getData('text') ?? '') + input.value.slice(end)); e.preventDefault(); firstName = next; input.value = next; }} /></div></div>
								<div class="field"><label for="signup-last">Last Name</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><input id="signup-last" value={lastName} type="text" placeholder="Cruz" required oninput={(e) => { lastName = formatName(e.currentTarget.value); }} onpaste={(e) => { const input = e.currentTarget; const start = input.selectionStart ?? input.value.length; const end = input.selectionEnd ?? input.value.length; const next = formatName(input.value.slice(0, start) + (e.clipboardData?.getData('text') ?? '') + input.value.slice(end)); e.preventDefault(); lastName = next; input.value = next; }} /></div></div>
								<div class="field"><label for="signup-middle">Middle Name <span>(optional)</span></label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><input id="signup-middle" value={middleName} type="text" placeholder="Dela" oninput={(e) => { middleName = formatName(e.currentTarget.value); }} onpaste={(e) => { const input = e.currentTarget; const start = input.selectionStart ?? input.value.length; const end = input.selectionEnd ?? input.value.length; const next = formatName(input.value.slice(0, start) + (e.clipboardData?.getData('text') ?? '') + input.value.slice(end)); e.preventDefault(); middleName = next; input.value = next; }} /></div></div>
								<div class="field"><label for="signup-suffix">Suffix <span>(optional)</span></label><div class="field-wrap"><svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M17 14a6 6 0 0 1 4.5 5.8"/></svg><Select bind:value={suffix} options={nameSuffixes} placeholder="None" ariaLabel="Suffix" /></div></div>
								<div class="field"><label for="signup-dob">Date of Birth</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg><input id="signup-dob" bind:value={dateOfBirth} type="date" required min={DOB_MIN} max={DOB_MAX} /></div></div>
								<div class="field"><label for="signup-id">Student ID</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.5 16a3 3 0 0 1 5 0M13 10h5M13 14h5"/></svg><input id="signup-id" value={studentId} type="text" placeholder="00-0000" maxlength="7" inputmode="numeric" oninput={(e) => { studentId = formatStudentId(e.currentTarget.value, (e as unknown as InputEvent).inputType?.startsWith('delete')); e.currentTarget.value = studentId; studentIdError = ''; }} />{#if studentIdError}<small class="field-error">{studentIdError}</small>{/if}</div></div>
								<div class="field span-2"><label for="signup-email">Email Address</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM4 7l8 6 8-6"/></svg><input id="signup-email" bind:value={email} type="email" placeholder="yourname@essu.edu.ph" required /></div></div>
								<div class="field span-2"><label>Program / Course</label><div class="field-wrap"><svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9.5 12 4l10 5.5-10 5.5L2 9.5Z"/><path d="M6 12v5c3.5 2.5 8.5 2.5 12 0v-5M22 10v6"/></svg><Select bind:value={program} options={graduatePrograms} placeholder="Select your program..." ariaLabel="Program or course" /></div></div>
								<div class="field"><label>Student Type</label><div class="field-wrap"><svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M17 14a6 6 0 0 1 4.5 5.8"/></svg><Select bind:value={studentType} options={studentTypes} placeholder="Select your student type..." ariaLabel="Student type" /></div></div>
								<div class="field"><label for="signup-year">Last School Year Attended</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg><input id="signup-year" bind:value={lastSchoolYear} type="number" placeholder="e.g. 2024" min="1990" max="2100" required /></div></div>
								<div class="field"><label for="signup-password">Password</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="signup-password" bind:value={password} type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" required minlength="8" autocomplete="new-password" /><button type="button" class="visibility-button" aria-label={showPassword ? 'Hide password' : 'Show password'} onclick={() => (showPassword = !showPassword)}><i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i></button></div></div>
								<div class="field"><label for="signup-confirm">Confirm</label><div class="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="signup-confirm" bind:value={confirmPassword} type={showConfirmPassword ? 'text' : 'password'} placeholder="Repeat password" required autocomplete="new-password" /><button type="button" class="visibility-button" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} onclick={() => (showConfirmPassword = !showConfirmPassword)}><i class="fa-solid {showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i></button></div></div>
								<div class="review-warning span-2"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><p>Please review all your information carefully before submitting. Your <strong>name, student ID, and program</strong> must match your official school records exactly, as these cannot be changed after registration.</p></div>
							</div>
							{#if error}<div class="alert" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>{error}</span></div>{/if}
						</div>
						<div class="form-actions"><button type="submit" disabled={loading} class="primary-button auth-submit">{#if loading}<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>{/if}Create Account <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>
					</form>
				{/if}
			</div>
		</section>
	</div>
	<p class="login-footer">Eastern Samar State University &middot; Graduate School</p>
</div>

<style>
	.login-page{--green-900:#0b3322;--green-800:#0f4a31;--green-700:#1f6b4a;--gold-500:#f2b705;--gold-600:#d9a400;--ink:#10261c;--muted:#5b6f64;--line:#cfd9d3;--surface:#fff;--field-bg:#f7faf8;min-height:100svh;position:relative;isolation:isolate;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;color:var(--ink);font-family:Poppins,system-ui,sans-serif}
	.login-page:before{position:fixed;z-index:-1;inset:-24px;content:'';background:linear-gradient(rgba(11,51,34,.88),rgba(11,51,34,.88)),url('/login-bg.png') center/cover no-repeat,var(--green-900);filter:blur(10px);transform:scale(1.04)}
	.login-card{width:min(1080px,94vw);height:min(700px,92vh);display:grid;grid-template-columns:5fr 6fr;overflow:hidden;border-radius:24px;background:var(--surface);box-shadow:0 30px 80px rgba(0,0,0,.4)}
	.login-story{position:relative;min-width:0;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:36px 34px;background:var(--green-900);color:#fff}.story-photo{position:absolute;inset:0 0 auto;height:62%;background:url('/login-bg.png') center top/cover no-repeat;filter:saturate(.85);mask-image:linear-gradient(to bottom,#000 35%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,#000 35%,transparent 100%)}
	.story-chip{position:absolute;z-index:1;top:28px;left:28px;display:flex;align-items:center;gap:11px;padding:10px 14px;border:1px solid rgba(255,255,255,.26);border-radius:14px;background:rgba(255,255,255,.16);backdrop-filter:blur(10px);color:#fff}.story-chip>span:last-child{display:grid;gap:2px}.story-chip strong{font-size:14px;font-weight:600}.story-chip small{color:rgba(255,255,255,.85);font-size:12px}.story-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.12);font-size:17px}
	.story-copy{position:relative;z-index:1;width:100%;padding-top:0;}.story-copy h2{max-width:14ch;margin:0 0 24px;color:#fff;font-size:clamp(1.5rem,2.1vw,2.1rem);font-weight:600;line-height:1.25;text-wrap:balance}.steps{display:flex;align-items:center;width:100%;margin:0 0 28px;padding:0;list-style:none}.steps .step{display:flex;align-items:center;gap:8px;flex:1;color:#fff;font-size:13px}.steps .step:last-child{flex:0 0 auto}.steps .step:not(:last-child)::after{content:"";flex:1;height:1px;margin:0 12px;background:rgba(255,255,255,.35)}.steps li span{width:27px;height:27px;display:grid;place-items:center;border-radius:50%;background:var(--gold-500);color:var(--green-900);font-size:12px;font-weight:700}
	.login-switch-card{display:inline-flex;align-items:center;gap:8px;padding:10px 15px;border:1px solid rgba(255,255,255,.35);border-radius:999px;background:transparent;color:#fff;font:500 14px Poppins,system-ui,sans-serif;cursor:pointer;transition:background .2s,transform .2s}.login-switch-card:hover{transform:translateY(-1px);background:rgba(255,255,255,.12)}.login-switch-card span{color:rgba(255,255,255,.88)}.login-switch-card strong{display:flex;align-items:center;gap:6px;font-weight:600;white-space:nowrap}
	.login-form-panel{min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;padding:38px 40px;background:#fff}.form-column{width:100%;height:100%;max-width:400px;max-height:100%;display:flex;flex-direction:column}.signup-column{max-width:520px}.login-tabs{flex:none;height:44px;display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;border:1px solid var(--line);border-radius:12px;background:var(--field-bg)}.login-tabs button{height:36px;border:0;border-radius:9px;background:transparent;color:var(--muted);font:500 13px Poppins,system-ui,sans-serif;white-space:nowrap;cursor:pointer}.login-tabs button.active{background:#fff;color:var(--green-800);font-weight:700;box-shadow:0 2px 8px rgba(16,38,28,.1)}
	.form-heading{flex:none;margin:28px 0 24px;animation:content-in .2s ease both}.gold-bar{width:32px;height:4px;display:block;margin-bottom:10px;border-radius:4px;background:var(--gold-500)}.form-heading h1{margin:0 0 7px;color:var(--ink);font-size:28px;font-weight:700;line-height:1.2}.form-heading p{max-width:44ch;margin:0;color:var(--muted);font-size:14px;line-height:1.5}.secondary-heading{margin:18px 0 20px}.secondary-heading .gold-bar{display:none}
	.access-form{min-height:0;flex:1;display:flex;flex-direction:column;animation:content-in .2s ease both}.form-scroll{min-height:0;flex:1;overflow-y:auto;scrollbar-gutter:stable;padding:4px 8px 8px 0;scrollbar-color:#9caf9f transparent;scrollbar-width:thin;}.form-scroll::-webkit-scrollbar{width:6px}.form-scroll::-webkit-scrollbar-thumb{border-radius:6px;background:#9caf9f}.signin-scroll{display:flex;flex-direction:column;justify-content:center;gap:16px}.field{min-width:0;display:flex;flex-direction:column;gap:6px}.field label{color:var(--ink);font-size:13px;font-weight:600}.field label span{color:var(--muted);font-weight:400}.input-wrap{position:relative;display:flex;align-items:center;color:var(--muted)}.input-wrap>svg{position:absolute;left:13px;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}.input-wrap:focus-within{position:relative;z-index:2;color:var(--green-700)}.input-wrap:focus-within input{outline:none;border-color:var(--green-700);box-shadow:0 0 0 3px rgba(31,107,74,0.18);background:#fff}.input-wrap input{width:100%;height:48px;padding:0 42px;border:1.5px solid var(--line);border-radius:12px;outline:0;background:var(--field-bg);color:var(--ink);font:400 14px Poppins,system-ui,sans-serif;transition:border-color .15s,box-shadow .15s,background .15s}.input-wrap input::placeholder{color:#65766c;opacity:1}.input-wrap input:-webkit-autofill,.input-wrap input:-webkit-autofill:hover,.input-wrap input:autofill,.input-wrap input:autofill:hover{-webkit-text-fill-color:var(--ink);-webkit-box-shadow:inset 0 0 0 1000px var(--field-bg);box-shadow:inset 0 0 0 1000px var(--field-bg)}.input-wrap input:-webkit-autofill:focus,.input-wrap input:-webkit-autofill:focus-visible,.input-wrap input:autofill:focus,.input-wrap input:autofill:focus-visible{-webkit-text-fill-color:var(--ink);-webkit-box-shadow:inset 0 0 0 1000px #fff,0 0 0 3px rgba(31,107,74,.18);box-shadow:inset 0 0 0 1000px #fff,0 0 0 3px rgba(31,107,74,.18)}.input-wrap input:focus,.input-wrap input:focus-visible{outline:none;border-color:var(--green-700);background:#fff;box-shadow:0 0 0 3px rgba(31,107,74,0.18)}.input-wrap input[type=date]{padding-right:10px}.visibility-button{position:absolute;right:4px;width:38px;height:38px;border:0;border-radius:9px;background:transparent;color:var(--muted);cursor:pointer}.visibility-button:hover{color:var(--green-700)}.visibility-button:focus-visible{outline:3px solid var(--green-700);outline-offset:2px;box-shadow:0 0 0 3px rgba(31,107,74,.18)}.field-wrap{position:relative;width:100%;color:var(--muted)}.field-icon{position:absolute;z-index:2;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}.field-wrap:focus-within .field-icon{color:var(--green-700)}.field-wrap :global(button[role=combobox]){position:relative;z-index:1;display:flex;align-items:center;width:100%;height:48px;min-height:48px;padding-block:0;padding-inline:44px 40px;line-height:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1.5px solid var(--line);border-radius:12px;background:var(--field-bg);color:var(--ink);font:400 14px Poppins,system-ui,sans-serif}.field-wrap :global(button[role=combobox] span){min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.field-wrap :global(button[role=combobox]:focus),.field-wrap :global(button[role=combobox]:focus-visible){outline:none;border-color:var(--green-700);box-shadow:inset 0 0 0 1px var(--green-700),0 0 0 3px rgba(31,107,74,.18)}.field-error{color:#b42318;font-size:12px}
	.remember-row{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--ink);font-size:14px}.remember-row label{display:flex;align-items:center;gap:8px;cursor:pointer}.remember-row input{width:16px;height:16px;accent-color:var(--green-700)}.forgot-link,.text-action{border:0;background:transparent;color:var(--green-700);font:600 13px Poppins,system-ui,sans-serif;cursor:pointer}.forgot-link:hover{text-decoration:underline;text-decoration-color:var(--gold-500);text-decoration-thickness:2px;text-underline-offset:4px}.form-actions{position:sticky;bottom:0;z-index:3;flex:none;display:grid;gap:12px;padding:12px 8px 0 0;border-top:1px solid rgba(207,217,211,.72);background:#fff}.primary-button{width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:12px;background:linear-gradient(135deg,var(--green-700),var(--green-900));color:#fff;font:700 14px Poppins,system-ui,sans-serif;box-shadow:0 5px 14px rgba(11,51,34,.16);cursor:pointer;transition:transform .2s,box-shadow .2s}.primary-button.auth-submit{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;height:50px;padding-inline:24px}.primary-button.auth-submit i:last-child{margin:0}.primary-button:hover{transform:translateY(-1px);box-shadow:0 8px 19px rgba(11,51,34,.25)}.primary-button:active{transform:translateY(0)}.primary-button:disabled{opacity:.7;cursor:wait}.secure-note{display:flex;justify-content:center;align-items:center;gap:7px;margin:0;color:var(--muted);font-size:12.5px;text-align:center}.alert{display:flex;align-items:flex-start;gap:9px;padding:11px 12px;border:1px solid #f5b5b5;border-radius:12px;background:#fdecec;color:#8e2929;font-size:14px;line-height:1.45}.alert i{margin-top:2px}.signup-scroll{padding:8px 10px 24px 8px;margin:-8px -8px 0 -8px;scroll-padding-bottom:24px}.signup-form .form-actions{z-index:1;margin-top:0;border-top:1px solid var(--line);background:#fff}.signup-grid .field:focus-within{position:relative;z-index:2}.signup-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 14px;padding-bottom:0}.signup-grid>:last-child{margin-bottom:16px}.span-2{grid-column:1/-1}.review-warning{display:flex;align-items:flex-start;gap:9px;padding:9px 11px;border:1px solid #e8d49a;border-radius:12px;background:#fff8e6;color:#694e16}.review-warning>i{margin-top:2px;color:#a67b00}.review-warning p{margin:0;font-size:12.5px;line-height:1.45}
	@keyframes content-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}.result-state{margin:auto 0;text-align:center;animation:content-in .2s ease both}.result-icon{width:56px;height:56px;display:grid;place-items:center;margin:0 auto 14px;border-radius:50%;background:#e8f3eb;color:var(--green-700);font-size:23px}.result-state h2{margin:0 0 8px;color:var(--ink);font-size:21px}.result-state p{margin:0 0 20px;color:var(--muted);font-size:14px;line-height:1.55}.result-state p strong{color:var(--ink)}.login-footer{margin:0;color:rgba(255,255,255,.8);font-size:12px;text-align:center}.login-page button:focus-visible:not(.visibility-button):not([role=combobox]){outline:3px solid var(--gold-500);outline-offset:3px}
	@media(max-width:900px){.login-page{min-height:100vh;min-height:100dvh;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));overflow-y:auto}.login-card.auth-card{width:100%;max-width:460px;height:auto;max-height:none;margin-block:auto 0;grid-template-columns:1fr;overflow:hidden}.login-story{height:150px;min-height:150px;padding:0 20px}.story-photo{height:100%;mask-image:linear-gradient(to bottom,#000 20%,rgba(0,0,0,.55) 65%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,#000 20%,rgba(0,0,0,.55) 65%,transparent 100%)}.story-chip{top:12px;left:16px;padding:6px 10px}.story-icon{width:28px;height:28px}.story-chip strong{font-size:12px}.story-chip small{font-size:10px}.story-copy{padding:0 0 13px}.story-copy h2{max-width:none;margin:0;font-size:16px;line-height:1.2}.steps,.login-switch-card{display:none}.signup-grid{padding-bottom:0}.login-form-panel{min-height:0;padding:20px}.form-column{height:auto;max-height:none}.form-heading{margin:22px 0 18px}.access-form,.form-scroll{flex:none;min-height:0}.form-scroll,.signup-scroll{overflow:visible;scrollbar-gutter:auto;padding:0;margin:0}.form-actions{position:static;padding:12px 0 0;border:0;background:transparent}.login-footer{margin:16px 0 auto;padding-bottom:0}}
	@media(max-width:600px){.login-page{padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom))}.login-story{height:100px;min-height:100px}.login-form-panel{padding:20px}.signup-grid{grid-template-columns:1fr}.signup-grid .span-2{grid-column:auto}.steps{display:none}.form-heading h1{font-size:25px}.form-heading p{font-size:13px}.input-wrap input,.field-wrap :global(button[role=combobox]){min-height:44px;height:48px}.remember-row{font-size:13px}.login-column .form-heading{margin:16px 0 16px}.login-column .form-heading .gold-bar{margin-bottom:6px}.login-column .signin-scroll{gap:12px}.login-actions .remember-row{margin-bottom:12px}.login-actions .primary-button{margin-bottom:10px}}
	.login-column{height:auto;max-height:100%}.login-column .access-form:not(.signup-form){flex:none}.login-column .signin-scroll{flex:none;overflow:visible;scrollbar-gutter:auto;padding:6px 8px;margin:-6px -8px;gap:16px}.login-column .field .input-wrap{position:relative;z-index:1}.login-column .visibility-button{right:8px;top:50%;transform:translateY(-50%)}.login-column .login-actions{position:static;z-index:auto;gap:0;padding:0;border:0;background:#fff}.login-actions .remember-row{margin-top:16px;margin-bottom:20px}.login-actions .primary-button{margin-bottom:14px}.login-column .form-heading .gold-bar{margin-bottom:8px}.login-column .form-heading h1{margin-bottom:6px}.secondary-heading .gold-bar{display:block}
	@media(max-width:900px){.login-story{height:auto;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:56px clamp(190px,46vw,260px);padding:0}.story-chip{position:relative;grid-column:1;grid-row:1;top:auto;left:auto;z-index:2;width:100%;height:56px;padding:12px 16px;border:0;border-radius:0;background:var(--green-900);backdrop-filter:none}.story-photo{position:relative;grid-column:1;grid-row:2;z-index:0;width:100%;height:100%;inset:auto;background-position:center 12%;background-size:cover;filter:none;-webkit-mask-image:none}.story-photo::after{position:absolute;inset:65% 0 0;content:'';background:linear-gradient(to bottom,transparent,rgba(11,51,34,.76))}.story-copy{grid-column:1;grid-row:2;align-self:end;z-index:2;width:100%;padding:0 12px 12px}.story-copy h2{max-width:none;margin:0;color:#fff;font-size:clamp(1rem,4.4vw,1.2rem);line-height:1.2;text-shadow:0 2px 10px rgba(0,0,0,.5);text-wrap:balance}}
	@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
</style>
