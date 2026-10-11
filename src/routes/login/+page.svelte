<script lang="ts">
	import { SCHOOL_YEAR_MIN, SCHOOL_YEAR_MAX, ENROLLED_SCHOOL_YEAR_MIN, validateSchoolYear } from '$lib/school-year';
	import { goto } from '$app/navigation';
	import { graduatePrograms } from '$lib/data/programs';
	import { campuses, isCampus } from '$lib/data/campuses';
	import { studentTypes, nameSuffixes } from '$lib/data/student-types';
	import TextField from '$lib/components/ui/TextField.svelte';
 import SelectField from '$lib/components/ui/SelectField.svelte';
 import DateField from '$lib/components/ui/DateField.svelte';
 import FormSection from '$lib/components/ui/FormSection.svelte';
 import FormActions from '$lib/components/ui/FormActions.svelte';
 import Button from '$lib/components/ui/Button.svelte';
 import StepIndicator from '$lib/components/forms/StepIndicator.svelte';
 import {validateForm} from '$lib/components/ui/form-validation';

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
	let campus = $state('');
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
				await goto(data.role === 'student' ? '/student/dashboard' : '/staff/dashboard', { invalidateAll: true });
			}
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleSignup(e: Event) {
		e.preventDefault();
		error = '';
		studentIdError = '';
		if (loading) return;
		if (!firstName || !lastName || !dateOfBirth || !email || !program || !studentType || !lastSchoolYear || !password || !confirmPassword) { error = 'Please fill in all required fields.'; return; }
		if (!isCampus(campus)) { error = 'Select your ESSU campus.'; return; }
		const yearError = validateSchoolYear(lastSchoolYear, studentType);
		if (yearError) { error = yearError; return; }
		if (dateOfBirth < DOB_MIN || dateOfBirth > DOB_MAX) {
			error = `Date of birth must be between ${DOB_MIN.slice(0, 4)} and ${DOB_MAX.slice(0, 4)}.`;
			return;
		}
		if (!/^\d{2}-\d{4}$/.test(studentId)) {
			studentIdError = 'Student ID must follow the format NN-NNNN.';
			return;
		}
		if (password !== confirmPassword) { error = 'Passwords do not match.'; return; }
		const registration = { firstName, middleName, lastName, suffix: suffix || null, dateOfBirth, email: email.trim().toLowerCase(), studentId, program, campus, studentType, lastSchoolYear: Number(lastSchoolYear), password };
		loading = true;
		try {
			const res = await fetch('/api/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(registration)
			});
			const data = await res.json();
			if (!res.ok && !data.accountCreated) {
				error = data.error ?? 'Registration failed. Please try again.';
			} else {
				email = registration.email;
				error = data.accountCreated ? data.error : '';
				mode = 'check-email';
			}
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

 let signupStep = $state(1);
 const signupSteps = [{label:'Account',icon:'fa-solid fa-user'},{label:'Student details',icon:'fa-solid fa-graduation-cap'}];
	function nextSignup(event: Event) {event.preventDefault();error='';if(signupStep===1 && password!==confirmPassword){error='Passwords do not match.';return;}if(signupStep===2){const yearError=validateSchoolYear(lastSchoolYear,studentType);if(yearError){error=yearError;document.getElementById('signup-year')?.focus();return;}}signupStep=Math.min(2,signupStep+1);}
</script>
<div class="access-shell"><div class="access-card"><aside class="access-story" aria-label="ESSU DocuFlow introduction"><div class="story-photo" aria-hidden="true"></div><div class="story-brand"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i><div><strong>ESSU DocuFlow</strong><p>Student Document Request Portal</p></div></div><div class="story-copy"><h2>Request your school documents, the easy way.</h2><ol><li>1. Request</li><li>2. Track</li><li>3. Receive</li></ol><Button variant="ghost" onclick={()=>{mode=mode==='login'?'signup':'login';error='';}}> {mode==='login'?'Create account':'Sign in'} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></Button></div></aside>
 <section class="access-panel" aria-label="Account access">
 {#if mode==='login'||mode==='signup'}<div class="access-tabs" aria-label="Account access"><button type="button" aria-pressed={mode==='login'} onclick={()=>{mode='login';error='';}}>Sign in</button><button type="button" aria-pressed={mode==='signup'} onclick={()=>{mode='signup';error='';}}>Create account</button></div><div class="access-heading"><h1>{mode==='login'?'Welcome back':'Create your account'}</h1><p>{mode==='login'?'Sign in to request and track your documents.':'Use your official school details.'}</p></div>{/if}
 {#if mode==='check-email'}<div class="access-result"><i class="fa-solid fa-envelope-circle-check" aria-hidden="true"></i><h1>{error?'Account created':'Check your email'}</h1>{#if error}<p class="access-error" role="alert">{error}</p>{:else}<p>We sent a verification link to <strong>{email}</strong>. Activate your account within 24 hours. Your student ID is waiting for office review.</p>{/if}<Button variant="secondary" onclick={()=>{mode='login';error='';}}>Back to sign in</Button></div>
 {:else if mode==='forgot-sent'}<div class="access-result"><i class="fa-solid fa-envelope-circle-check" aria-hidden="true"></i><h1>Check your email</h1><p>If an account exists for {forgotEmail}, we sent a reset link. It expires in 1 hour.</p><Button variant="secondary" onclick={()=>{mode='login';error='';}}>Back to sign in</Button></div>
 {:else if mode==='forgot'}<div class="access-heading"><h1>Forgot your password?</h1><p>Enter your email and we'll send you a reset link.</p></div><form use:validateForm onsubmit={handleForgotPassword} class="access-form"><TextField label="Email address" type="email" bind:value={forgotEmail} required autocomplete="email" />{#if error}<p role="alert" class="access-error">{error}</p>{/if}<FormActions><Button variant="ghost" onclick={()=>{mode='login';error='';}}>Back to sign in</Button><Button type="submit" loading={loading}>Send reset link</Button></FormActions></form>
 {:else if mode==='login'}<form use:validateForm onsubmit={handleLogin} class="access-form"><FormSection><TextField id="login-email" label="Email address" type="email" bind:value={email} required autocomplete="email" placeholder="yourname@essu.edu.ph" /><TextField id="login-password" label="Password" type="password" bind:value={password} required autocomplete="current-password" /></FormSection>{#if error}<p role="alert" class="access-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{error}</p>{/if}<div class="remember-row"><label><input type="checkbox" bind:checked={rememberMe}/>Remember me</label><Button variant="ghost" onclick={()=>{mode='forgot';error='';forgotEmail=email;}}>Forgot password?</Button></div><FormActions><Button type="submit" loading={loading} loadingLabel="Signing in…" icon="fa-solid fa-arrow-right" iconRight>Sign in</Button></FormActions><p class="field-helper"><i class="fa-solid fa-lock" aria-hidden="true"></i> Secure sign-in for ESSU students and staff</p></form>
 {:else}<div class="signup-stepper"><StepIndicator steps={signupSteps} currentStep={signupStep} disabled={loading} onstep={step=>signupStep=step}/></div><form use:validateForm onsubmit={signupStep===2 ? handleSignup : nextSignup} class="access-form" autocomplete="off">
 {#if signupStep===1}<FormSection title="Account"><TextField id="signup-email" label="Email address" type="email" bind:value={email} required autocomplete="email"/><TextField id="signup-password" label="Password" type="password" bind:value={password} required minlength={8} passwordRules autocomplete="new-password"/><TextField id="signup-confirm" label="Confirm password" type="password" bind:value={confirmPassword} required validator={value=>value===password?'':'Passwords do not match.'} autocomplete="new-password"/></FormSection>
 {:else if signupStep===2}<FormSection title="Student details"><div class="signup-grid"><TextField id="signup-first" label="First name" bind:value={firstName} required oninput={event=>{firstName=formatName(event.currentTarget.value);event.currentTarget.value=firstName;}}/><TextField id="signup-middle" label="Middle name" bind:value={middleName} oninput={event=>{middleName=formatName(event.currentTarget.value);event.currentTarget.value=middleName;}}/><TextField id="signup-last" label="Last name" bind:value={lastName} required oninput={event=>{lastName=formatName(event.currentTarget.value);event.currentTarget.value=lastName;}}/><SelectField label="Suffix" bind:value={suffix}><option value="">None</option>{#each nameSuffixes as item}<option value={item}>{item}</option>{/each}</SelectField><DateField id="signup-dob" label="Date of birth" bind:value={dateOfBirth} required min={DOB_MIN} max={DOB_MAX}/><TextField id="signup-id" label="Student ID" bind:value={studentId} required maxlength={7} pattern="[0-9]{2}-[0-9]{4}" helper="Use NN-NNNN." error={studentIdError} oninput={event=>{studentId=formatStudentId(event.currentTarget.value,(event as unknown as InputEvent).inputType?.startsWith('delete'));event.currentTarget.value=studentId;studentIdError='';}}/></div><SelectField id="signup-program" label="Program" bind:value={program} required><option value="">Choose your program</option>{#each graduatePrograms as item}<option value={item}>{item}</option>{/each}</SelectField><SelectField id="signup-campus" label="Campus" bind:value={campus} required disabled={loading}><option value="">Choose your ESSU campus</option>{#each campuses as item}<option value={item}>{item}</option>{/each}</SelectField><div class="signup-grid"><SelectField id="signup-student-type" label="Student type" bind:value={studentType} required><option value="">Choose student type</option>{#each studentTypes as item}<option value={item}>{item}</option>{/each}</SelectField><TextField id="signup-year" label="Last school year attended" type="number" bind:value={lastSchoolYear} required min={studentType==='Enrolled'?ENROLLED_SCHOOL_YEAR_MIN:SCHOOL_YEAR_MIN} max={SCHOOL_YEAR_MAX} validator={value=>validateSchoolYear(value,studentType)??''}/></div></FormSection>{/if}
 {#if error}<p class="access-error" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{error}</p>{/if}<FormActions><Button variant="ghost" disabled={loading} onclick={()=>signupStep>1?signupStep--:mode='login'}>Back</Button>{#if signupStep<2}<Button type="submit" variant="secondary">Next</Button>{:else}<Button type="submit" loading={loading} loadingLabel="Creating account…">Create account</Button>{/if}</FormActions></form>{/if}
 </section></div><p class="access-footer">ESSU Graduate School · DocuFlow</p></div>
<style>
 .access-shell {min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-4);padding:var(--space-6);background:linear-gradient(var(--color-overlay),var(--color-overlay)),url('/login-bg.jpg') center/cover fixed,var(--color-sidebar);}
 .access-card {width:min(1080px,100%);display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);border-radius:var(--radius-panel);overflow:hidden;background:var(--color-surface);}
 .access-story {position:relative;min-height:640px;display:flex;flex-direction:column;justify-content:space-between;padding:var(--space-8);background:var(--color-sidebar);color:var(--color-surface);overflow:hidden;}
 .story-photo {position:absolute;inset:0;background:url('/login-bg.jpg') center top/cover;opacity:.25;} .story-brand,.story-copy {position:relative;z-index:1;} .story-brand {display:flex;align-items:center;gap:var(--space-3);} .story-brand>i {font-size:28px;color:var(--color-accent);} .story-brand strong {font-weight:var(--weight-semibold);} .story-brand p {font-size:var(--type-helper);} .story-copy h2 {font-size:var(--type-page-title);font-weight:var(--weight-semibold);line-height:var(--line-height);} .story-copy ol {display:flex;gap:var(--space-4);flex-wrap:wrap;margin-block:var(--space-6);} .story-copy :global(.button-ghost) {color:var(--color-surface);} .story-copy :global(.button-ghost:hover) {background:color-mix(in srgb,var(--color-surface) 12%,transparent);}
 .access-panel {min-width:0;padding:var(--space-8);display:flex;flex-direction:column;justify-content:center;gap:var(--space-6);} .access-tabs {display:flex;border-bottom:1px solid var(--color-border);} .access-tabs button {flex:1;min-height:40px;color:var(--color-text-muted);font-weight:var(--weight-medium);} .access-tabs button[aria-pressed='true'] {color:var(--color-primary);box-shadow:inset 0 -3px var(--color-primary);} .access-heading h1,.access-result h1 {font-size:var(--type-page-title);font-weight:var(--weight-semibold);} .access-heading p {color:var(--color-text-muted);margin-top:var(--space-2);} .access-heading::before {content:'';display:block;width:32px;height:4px;background:var(--color-accent);margin-bottom:var(--space-3);border-radius:var(--radius-control);} .access-form {display:grid;gap:var(--space-4);} .remember-row {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--space-2);} .remember-row label {display:flex;align-items:center;gap:var(--space-2);min-height:44px;} .access-error {display:flex;gap:var(--space-2);padding:var(--space-3);border:1px solid var(--color-danger-border);border-radius:var(--radius-control);background:var(--color-danger-soft);color:var(--color-danger);} .signup-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-4);} .access-result {display:grid;gap:var(--space-4);text-align:center;justify-items:center;} .access-result>i {font-size:28px;color:var(--color-primary);} .access-footer {font-size:var(--type-helper);color:var(--color-surface);text-align:center;}
 @media(max-width:900px){.access-card {max-width:600px;grid-template-columns:1fr;} .access-story {min-height:180px;gap:var(--space-4);padding:var(--space-6);} .story-copy h2 {font-size:var(--type-card-title);} .story-copy ol,.story-copy :global(.button-tooltip) {display:none;} .access-panel {padding:var(--space-6);}} @media(max-width:639px){.access-shell {padding:var(--space-4);} .access-panel {padding:var(--space-4);} .signup-grid {grid-template-columns:1fr;}}
@media(pointer:coarse){.access-tabs button{min-height:44px;}}</style>
