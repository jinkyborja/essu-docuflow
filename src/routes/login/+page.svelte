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


<div class="login-page">
	<div class="login-card">
		<aside class="login-story" aria-label="ESSU DocuFlow introduction">
			<div class="login-story-content">
				<h2>Request your school documents,<br />the easy way.</h2>
				<ul class="login-features">
					<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 16v4h14v-4" /></svg>Request documents online</li>
					<li><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>Track your request status</li>
					<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" /></svg>Get notified when ready</li>
				</ul>
				{#if mode === 'login' || mode === 'signup'}
					<button class="login-switch-card" type="button" onclick={() => { mode = mode === 'login' ? 'signup' : 'login'; error = ''; }}>
						<span>{mode === 'login' ? 'New here?' : 'Already have an account?'}</span>
						<strong>{mode === 'login' ? 'Create account' : 'Sign in'} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></strong>
					</button>
				{/if}
			</div>
		</aside>
		<section class="login-form-panel">
			<div class="login-brand">
				<div class="login-brand-icon"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i></div>
				<div><h1>ESSU DocuFlow</h1><p>Student Document Request Portal</p></div>
			</div>
			<!-- Mode toggle (login/signup only) -->
			<!-- Mode toggle (login/signup only) -->
			{#if mode === 'login' || mode === 'signup'}
				<div class="login-tabs flex border-b border-gray-100">
					<button
						onclick={() => { mode = 'login'; error = ''; }}
						class="flex-1 py-4 text-sm font-semibold transition-colors
							{mode === 'login' ? 'text-essu-green border-b-2 border-essu-green' : 'text-gray-400 hover:text-gray-600'}"
					>
						Sign In
					</button>
					<button
						onclick={() => { mode = 'signup'; error = ''; }}
						class="flex-1 py-4 text-sm font-semibold transition-colors
							{mode === 'signup' ? 'text-essu-green border-b-2 border-essu-green' : 'text-gray-400 hover:text-gray-600'}"
					>
						Create Account
					</button>
				</div>
			{/if}

			<div class="login-form-content">
				{#if mode === 'login' || mode === 'signup'}
					{#key mode}
						<div class="login-heading"><h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p>{mode === 'login' ? 'Sign in to request and track your documents.' : "Use your official school details. Name, student ID and program can't be changed later."}</p></div>
					{/key}
				{/if}
				{#if mode === 'check-email'}
					<div class="text-center py-4">
						<div class="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
							<i class="fa-solid fa-envelope-circle-check text-2xl text-essu-green"></i>
						</div>
						<h2 class="text-lg font-semibold text-gray-800 mb-2">Check your email</h2>
						<p class="text-sm text-gray-500 mb-6">
							We sent a verification link to <span class="font-medium text-gray-700">{email}</span>.
							Click it to activate your account. The link expires in 24 hours.
						</p>
						<button
							onclick={() => { mode = 'login'; error = ''; }}
							class="text-sm text-essu-green hover:underline"
						>
							Back to Sign In
						</button>
					</div>
			{:else if mode === 'forgot'}
				<div>
					<button onclick={() => { mode = 'login'; error = ''; }} class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-5">
						<i class="fa-solid fa-arrow-left text-xs"></i> Back to Sign In
					</button>
					<h2 class="text-lg font-semibold text-gray-800 mb-1">Forgot your password?</h2>
					<p class="text-sm text-gray-400 mb-5">Enter your email and we'll send you a reset link.</p>
					{#if error}
						<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
							<i class="fa-solid fa-circle-exclamation shrink-0"></i>
							{error}
						</div>
					{/if}
					<form onsubmit={handleForgotPassword} class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
							<input
								bind:value={forgotEmail}
								type="email"
								placeholder="yourname@essu.edu.ph"
								required
								class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
							/>
						</div>
						<button
							type="submit"
							disabled={loading}
							class="w-full py-2.5 bg-essu-green text-white rounded-lg font-medium text-sm hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
						>
							{#if loading}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
							Send Reset Link
						</button>
					</form>
				</div>
			{:else if mode === 'forgot-sent'}
				<div class="text-center py-4">
					<div class="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
						<i class="fa-solid fa-envelope-circle-check text-2xl text-essu-green"></i>
					</div>
					<h2 class="text-lg font-semibold text-gray-800 mb-2">Check your email</h2>
					<p class="text-sm text-gray-500 mb-6">
						If an account exists for <span class="font-medium text-gray-700">{forgotEmail}</span>,
						we've sent a password reset link. It expires in 1 hour.
					</p>
					<button onclick={() => { mode = 'login'; error = ''; }} class="text-sm text-essu-green hover:underline">
						Back to Sign In
					</button>
				</div>
			{:else}
					{#if error && mode === 'login'}
						<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
							<i class="fa-solid fa-circle-exclamation shrink-0"></i>
							{error}
						</div>
					{/if}

					{#if mode === 'login'}
						<form onsubmit={handleLogin} class="space-y-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
								<input
									bind:value={email}
									type="email"
									placeholder="yourname@essu.edu.ph"
									required
									class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
								<div class="relative">
									<input
										bind:value={password}
										type={showLoginPassword ? 'text' : 'password'}
										placeholder="Enter your password"
										required
										class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
									/>
									<button type="button" aria-label={showLoginPassword ? 'Hide password' : 'Show password'} onclick={() => (showLoginPassword = !showLoginPassword)}
										class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
										<i class="fa-solid {showLoginPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm"></i>
									</button>
								</div>
							</div>
							<div class="flex items-center justify-between text-sm">
								<label class="flex items-center gap-2 text-gray-500 cursor-pointer">
									<input bind:checked={rememberMe} type="checkbox" class="rounded" />
									Remember me
								</label>
								<button type="button" onclick={() => { mode = 'forgot'; error = ''; forgotEmail = email; }} class="text-essu-green hover:underline">Forgot password?</button>
							</div>
							<button
								type="submit"
								disabled={loading}
								class="w-full py-2.5 bg-essu-green text-white rounded-lg font-medium text-sm hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
							>
								{#if loading}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
								Sign In
							</button>
						</form>

					{:else}
						<form onsubmit={handleSignup} class="space-y-4" autocomplete="off">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
								<input
									value={firstName}
									type="text"
									placeholder="Juan"
									required
									class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
									autocomplete="off"
									oninput={(e) => {
										firstName = formatName(e.currentTarget.value);
									}}
									onpaste={(e) => {
										const input = e.currentTarget;
										const start = input.selectionStart ?? input.value.length;
										const end = input.selectionEnd ?? input.value.length;
										const next = formatName(input.value.slice(0, start) + (e.clipboardData?.getData('text') ?? '') + input.value.slice(end));
										e.preventDefault();
										firstName = next;
										input.value = next;
									}}
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Middle Name <span class="text-gray-400 font-normal">(optional)</span></label>
								<input
									value={middleName}
									type="text"
									placeholder="Dela"
									class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
									autocomplete="off"
									oninput={(e) => {
										middleName = formatName(e.currentTarget.value);
									}}
									onpaste={(e) => {
										const input = e.currentTarget;
										const start = input.selectionStart ?? input.value.length;
										const end = input.selectionEnd ?? input.value.length;
										const next = formatName(input.value.slice(0, start) + (e.clipboardData?.getData('text') ?? '') + input.value.slice(end));
										e.preventDefault();
										middleName = next;
										input.value = next;
									}}
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
								<input
									value={lastName}
									type="text"
									placeholder="Cruz"
									required
									class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
									autocomplete="off"
									oninput={(e) => {
										lastName = formatName(e.currentTarget.value);
									}}
									onpaste={(e) => {
										const input = e.currentTarget;
										const start = input.selectionStart ?? input.value.length;
										const end = input.selectionEnd ?? input.value.length;
										const next = formatName(input.value.slice(0, start) + (e.clipboardData?.getData('text') ?? '') + input.value.slice(end));
										e.preventDefault();
										lastName = next;
										input.value = next;
									}}
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Suffix <span class="text-gray-400 font-normal">(optional)</span></label>
								<Select
									bind:value={suffix}
									options={nameSuffixes}
									placeholder="None"
									ariaLabel="Suffix"
								/>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1.5">Date of Birth</label>
									
<input
										bind:value={dateOfBirth}
										type="date"
										required
										min={DOB_MIN}
										max={DOB_MAX}
										class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
										autocomplete="off"
									/>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1.5">Student ID</label>
									<input
										value={studentId}
										type="text"
										placeholder="00-0000"
										maxlength="7"
										inputmode="numeric"
										class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
										autocomplete="off"
										oninput={(e) => {
											studentId = formatStudentId(
												e.currentTarget.value,
												(e as unknown as InputEvent).inputType?.startsWith('delete')
											);
											e.currentTarget.value = studentId;
											studentIdError = '';
										}}
									/>
									{#if studentIdError}
										<p class="mt-1 text-xs text-red-600">{studentIdError}</p>
									{/if}
								</div>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
								
<input
									bind:value={email}
									type="email"
									placeholder="yourname@essu.edu.ph"
									required
									class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
									autocomplete="off"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Program / Course</label>
								<Select
									bind:value={program}
									options={graduatePrograms}
									placeholder="Select your program..."
									ariaLabel="Program or course"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Student Type</label>
								<Select
									bind:value={studentType}
									options={studentTypes}
									placeholder="Select your student type..."
									ariaLabel="Student type"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Last School Year Attended</label>
								
<input
									bind:value={lastSchoolYear}
									type="number"
									placeholder="e.g. 2024"
									min="1990"
									max="2100"
									required
									class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
									autocomplete="off"
								/>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
									<div class="relative">
										
<input
											bind:value={password}
											type={showPassword ? 'text' : 'password'}
											placeholder="Min. 8 characters"
											required
											minlength="8"
											autocomplete="new-password"
											class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
										/>

										<button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onclick={() => (showPassword = !showPassword)}
											class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
											<i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm"></i>
										</button>
									</div>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1.5">Confirm</label>
									<div class="relative">
										
<input
											bind:value={confirmPassword}
											type={showConfirmPassword ? 'text' : 'password'}
											placeholder="Repeat password"
											required
											autocomplete="new-password"
											class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
										/>

										<button type="button" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} onclick={() => (showConfirmPassword = !showConfirmPassword)}
											class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
											<i class="fa-solid {showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm"></i>
										</button>
									</div>
								</div>
							</div>
							<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
								<i class="fa-solid fa-triangle-exclamation text-amber-500 text-sm mt-0.5 shrink-0"></i>
								<p class="text-xs text-amber-700 leading-relaxed">
									Please review all your information carefully before submitting.
									Your <strong>name, student ID, and program</strong> must match your official school records exactly, as these cannot be changed after registration.
								</p>
							</div>
							<button
								type="submit"
								disabled={loading}
								class="w-full py-2.5 bg-essu-blue text-white rounded-lg font-medium text-sm hover:bg-essu-blue-mid transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
							>
								{#if loading}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
								Create Account
							</button>
							{#if error}
								<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-start gap-2" role="alert">
									<i class="fa-solid fa-circle-exclamation shrink-0 mt-0.5"></i>
									<span>{error}</span>
								</div>
							{/if}
						</form>
					{/if}
				{/if}
			</div>
	</div>
		<p class="login-footer">
			Eastern Samar State University · Graduate School
		</p>

	</div>

<style>
	.login-page { min-height: 100svh; display: grid; place-items: center; padding: clamp(1rem, 4vw, 3.5rem); background: linear-gradient(135deg, rgb(9 43 32 / 78%), rgb(19 83 58 / 72%)), url('/login-bg.jpg') center / cover fixed, linear-gradient(135deg, #123d30, #28694d); color: #17372b; }
	.login-card { width: min(1180px, 100%); min-height: min(740px, calc(100svh - 4rem)); display: grid; grid-template-columns: minmax(0, .92fr) minmax(420px, 1.08fr); overflow: hidden; border: 1px solid rgb(255 255 255 / 45%); border-radius: 30px; background: rgb(244 250 246 / 78%); box-shadow: 0 30px 90px rgb(5 29 20 / 34%); backdrop-filter: blur(16px); }
	.login-story { position: relative; display: flex; align-items: flex-end; min-height: 600px; padding: clamp(2rem, 5vw, 4rem); color: white; background: linear-gradient(180deg, rgb(10 48 35 / 35%) 5%, rgb(8 40 29 / 78%) 100%), url('/login-bg.jpg') center / cover no-repeat, linear-gradient(145deg, #1a6347, #103b2e); }
	.login-story-content { max-width: 34rem; }
	.login-eyebrow { margin: 0 0 1.1rem; color: #e8d69a; font-size: .7rem; font-weight: 600; letter-spacing: .18em; }
	.login-story h2 { margin: 0 0 1.8rem; color: white; font-size: clamp(2.1rem, 3.5vw, 3.15rem); font-weight: 300; line-height: 1.18; letter-spacing: -.035em; }
	.login-switch-card { display: flex; width: min(100%, 350px); flex-direction: column; align-items: flex-start; gap: .25rem; padding: 1rem 1.25rem; border: 1px solid rgb(255 255 255 / 42%); border-radius: 18px; background: rgb(255 255 255 / 14%); color: white; text-align: left; cursor: pointer; backdrop-filter: blur(16px); transition: transform .18s ease, background .18s ease, box-shadow .18s ease; }
	.login-switch-card:hover { transform: translateY(-2px); background: rgb(255 255 255 / 21%); box-shadow: 0 12px 28px rgb(0 0 0 / 15%); }
	.login-switch-card span { color: rgb(255 255 255 / 78%); font-size: .78rem; }
	.login-switch-card strong { display: flex; align-items: center; gap: .65rem; font-size: 1rem; }
	.login-form-panel { min-width: 0; display: flex; flex-direction: column; padding: clamp(1.5rem, 4vw, 3rem); background: rgb(248 252 249 / 82%); backdrop-filter: blur(16px); }
	.login-brand { display: flex; align-items: center; gap: .9rem; margin-bottom: 1.9rem; }
	.login-brand-icon { display: grid; width: 3rem; height: 3rem; flex: 0 0 auto; place-items: center; border: 1px solid rgb(31 107 80 / 13%); border-radius: 15px; background: #e6f0e9; color: #174f3e; font-size: 1.35rem; }
	.login-brand h1 { margin: 0; color: #173b2e; font-size: 1.1rem; font-weight: 650; }
	.login-brand p { margin: .1rem 0 0; color: #5b7065; font-size: .73rem; }
	.login-heading { margin: 1.5rem 0 1.25rem; }
	.login-heading span { color: #547364; font-size: .64rem; font-weight: 650; letter-spacing: .15em; }
	.login-heading h2 { margin: .2rem 0 0; color: #173b2e; font-size: 2rem; font-weight: 300; letter-spacing: -.04em; }
	.login-form-panel > .flex.border-b { align-self: flex-start; gap: .35rem; padding: .3rem; border: 1px solid rgb(31 107 80 / 12%); border-radius: 999px; background: rgb(226 238 230 / 70%); }
	.login-form-panel > .flex.border-b button { min-height: 40px; padding: .55rem 1.15rem; border: 0; border-radius: 999px; color: #52685c; }
	.login-form-panel > .flex.border-b button[class*='border-b-2'] { border: 0; background: #fff; color: #174f3e; box-shadow: 0 2px 8px rgb(23 79 62 / 10%); }
	.login-form-content { flex: 1; }
	.login-form-content form { display: grid; gap: .9rem; }
	.login-form-content label.block { display: block; margin-bottom: .35rem; color: #314b3e; font-size: .75rem; font-weight: 550; }
	.login-form-content input:not([type='checkbox']), .login-form-content select { width: 100%; min-height: 46px; border: 1px solid rgb(30 83 59 / 14%); border-radius: 999px; background: rgb(255 255 255 / 72%); color: #183b2e; padding: .7rem 1rem; font-size: .82rem; }
	.login-form-content input:not([type='checkbox']):focus, .login-form-content select:focus { border-color: #287553; outline: 0; box-shadow: 0 0 0 3px rgb(40 117 83 / 27%); }
	.login-form-content input::placeholder { color: #75877c; }
	:global(.login-form-content form button[role='combobox']) { min-height: 46px; border: 1px solid rgb(30 83 59 / 14%); border-radius: 999px; background: rgb(255 255 255 / 72%); padding: .7rem 1rem; }
	.login-form-content .relative input { padding-right: 2.8rem; }
	.login-form-content form > button[type='submit'] { min-height: 48px; margin-top: .25rem; border: 1px solid rgb(255 255 255 / 80%); border-radius: 999px; background: #fff; color: #174f3e; font-weight: 700; box-shadow: 0 8px 20px rgb(23 79 62 / 10%); transition: transform .18s ease, box-shadow .18s ease; }
	.login-form-content form > button[type='submit']:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgb(23 79 62 / 18%); }
	.login-form-content [role='alert'], .login-form-content .bg-red-50 { border-color: #e9b9b5; border-radius: 14px; background: #fff0ee; color: #8f302c; }
	.login-form-content .bg-amber-50 { border: 1px solid #e8d49a; border-radius: 14px; background: #fff8e6; color: #694e16; }
	.login-form-panel > p.text-center { margin: auto 0 0; padding-top: 1.5rem; color: #667a6e; font-size: .68rem; }
	.login-page :focus-visible { outline: 3px solid #246c4b; outline-offset: 3px; }
	@media (max-width: 760px) { .login-page { padding: .75rem; } .login-card { min-height: calc(100svh - 1.5rem); grid-template-columns: 1fr; border-radius: 24px; } .login-story { min-height: 230px; padding: 1.5rem; } .login-story h2 { margin-bottom: 1rem; font-size: 1.8rem; } .login-eyebrow { margin-bottom: .55rem; } .login-switch-card { width: auto; padding: .7rem 1rem; } .login-form-panel { padding: 1.4rem; } .login-brand { margin-bottom: 1.2rem; } .login-heading { margin-top: 1rem; } }
	@media (max-width: 420px) { .login-form-panel { padding: 1.15rem; } .login-form-content .grid.grid-cols-2 { grid-template-columns: 1fr; } }
	.login-page { position: relative; isolation: isolate; display: flex; flex-direction: column; justify-content: center; gap: 1.1rem; overflow: hidden; background: transparent; }
	.login-page::before { position: fixed; z-index: -1; inset: -28px; content: ''; background: linear-gradient(135deg, rgb(8 43 31 / 76%), rgb(12 63 43 / 76%)), url('/login-bg.jpg') center / cover no-repeat, linear-gradient(135deg, #0d382b, #174f3e); filter: blur(6px); transform: scale(1.08); }
	.login-card { width: min(1080px, 100%); height: min(720px, calc(100svh - 7rem)); min-height: 600px; grid-template-columns: 1fr 1fr; border: 1px solid rgb(255 255 255 / 18%); border-radius: 24px; background: rgb(255 255 255 / 96%); box-shadow: 0 30px 80px rgb(0 0 0 / 35%); }
	.login-story { min-height: 0; padding: clamp(2rem, 4vw, 3.5rem); background: linear-gradient(180deg, transparent 24%, rgba(6, 38, 26, .92) 100%), url('/login-bg.jpg') center / cover no-repeat, #123d30; }
	.login-story-content { width: 100%; }
	.login-story h2 { max-width: 15ch; margin: 0 0 1.15rem; font-size: clamp(1.75rem, 2.6vw, 2.5rem); font-weight: 600; line-height: 1.2; letter-spacing: -.025em; }
	.login-features { display: grid; gap: .68rem; margin: 0 0 1.25rem; padding: 0; list-style: none; color: rgb(255 255 255 / 92%); font-size: .86rem; }
	.login-features li { display: flex; align-items: center; gap: .7rem; }
	.login-features svg { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: #d8ebde; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
	.login-switch-card { display: inline-flex; width: auto; flex-direction: row; align-items: center; gap: .4rem; padding: .65rem 1rem; border-radius: 999px; background: rgb(255 255 255 / 18%); color: #fff; font-size: 14px; backdrop-filter: blur(16px); }
	.login-switch-card span { color: rgb(255 255 255 / 90%); font-size: 14px; }
	.login-switch-card strong { gap: .35rem; font-size: 14px; white-space: nowrap; }
	.login-form-panel { min-height: 0; justify-content: center; padding: 2.25rem clamp(1.6rem, 3.2vw, 3rem); background: rgb(255 255 255 / 96%); }
	.login-brand { gap: 1rem; margin-bottom: 1.5rem; }
	.login-brand-icon { width: 48px; height: 48px; border-radius: 15px; font-size: 1.5rem; }
	.login-tabs { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: .25rem; padding: .25rem; border: 0; border-radius: 999px; background: #edf2ee; }
	.login-form-panel > .login-tabs button { min-width: 0; height: 44px; padding: 0 .5rem; border: 0; border-radius: 999px; color: #527060; font-size: .82rem; font-weight: 550; white-space: nowrap; }
	.login-form-panel > .login-tabs button:hover { color: #174f3e; background: rgb(255 255 255 / 65%); }
	.login-form-panel > .login-tabs button[class*='border-b-2'] { color: #174f3e; background: #fff; font-weight: 700; box-shadow: 0 2px 8px rgb(23 79 62 / 12%); }
	.login-form-content { min-height: 0; flex: 1; overflow-y: auto; scrollbar-color: #a8b9ad transparent; scrollbar-width: thin; }
	.login-form-content::-webkit-scrollbar { width: 6px; }
	.login-form-content::-webkit-scrollbar-thumb { border-radius: 999px; background: #a8b9ad; }
	.login-heading { margin: 1.35rem 0 1.2rem; animation: login-enter 200ms ease both; }
	.login-heading h1 { margin: 0 0 .35rem; color: #193c2e; font-size: 28px; font-weight: 600; line-height: 1.2; letter-spacing: -.025em; }
	.login-heading p { margin: 0; color: #617268; font-size: .82rem; line-height: 1.5; }
	.login-form-content form { gap: 1.15rem; }
	.login-form-content label.block { margin-bottom: 6px; color: #334b3e; font-size: 13px; font-weight: 600; }
	.login-form-content input:not([type='checkbox']) { min-height: 48px; padding: .7rem 1rem; border: 1px solid #c5d2ca; border-radius: 12px; background: #fff; font-size: .875rem; }
	:global(.login-form-content form button[role='combobox']) { min-height: 48px; border: 1px solid #c5d2ca; border-radius: 12px; background: #fff; padding: .7rem 1rem; }
	.login-form-content input:not([type='checkbox']):focus, .login-form-content select:focus { border-color: #1f6b4a; box-shadow: 0 0 0 3px rgb(31 107 74 / 25%); }
	.login-form-content .relative > button[type='button'] { width: 44px; height: 44px; right: 2px; border-radius: 999px; }
	.login-form-content form > button[type='submit'] { min-height: 48px; border: 0; border-radius: 12px; background: linear-gradient(110deg, #1f6b4a, #17503a); color: #fff; font-size: .9rem; font-weight: 700; box-shadow: 0 8px 18px rgb(23 80 58 / 18%); }
	.login-form-content form > button[type='submit']:hover { background: linear-gradient(110deg, #287b57, #1c6043); transform: translateY(-1px); box-shadow: 0 11px 24px rgb(23 80 58 / 25%); }
	.login-form-content form > button[type='submit']:active { transform: translateY(0); }
	.login-form-content form > button[type='submit']:disabled { cursor: default; opacity: .62; }
	.login-form-content .flex.items-center.justify-between { font-size: 14px; }
	.login-form-content .flex.items-center.justify-between button:hover { text-decoration: underline; text-underline-offset: 3px; }
	.login-form-content [role='alert'], .login-form-content .bg-red-50 { border: 1px solid #e5b6b3; border-radius: 12px; background: #fff0ef; color: #8f302c; font-size: 14px; }
	.login-form-content .bg-amber-50 { border-radius: 12px; font-size: 13px; }
	.login-footer { margin: 0; color: rgb(255 255 255 / 80%); font-size: 12px; text-align: center; }
	@keyframes login-enter { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
	@media (max-width: 900px) {
		.login-page { justify-content: flex-start; padding: 1rem; }
		.login-card { width: min(600px, 100%); height: auto; max-height: calc(100svh - 4.5rem); min-height: 0; grid-template-columns: 1fr; overflow-y: auto; }
		.login-story { min-height: 140px; padding: 1rem 1.4rem; }
		.login-story h2 { max-width: 100%; margin: 0; font-size: 1.35rem; line-height: 1.25; }
		.login-features { display: none; }
		.login-switch-card { margin-top: .65rem; padding: .45rem .85rem; }
		.login-form-panel { min-height: 0; padding: 1.4rem; }
		.login-form-content { overflow: visible; }
	}
	@media (max-width: 480px) { .login-card { max-height: none; } .login-form-panel { padding: 1.1rem; } .login-form-content .grid.grid-cols-2 { grid-template-columns: 1fr; } .login-form-panel > .login-tabs button { font-size: .74rem; } }
	@media (prefers-reduced-motion: reduce) { .login-heading { animation: none; } .login-switch-card, .login-form-content form > button[type='submit'] { transition: none; } }
</style>
