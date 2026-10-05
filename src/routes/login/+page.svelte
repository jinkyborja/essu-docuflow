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

	// Accepted date-of-birth range for graduate-school applicants.
	const DOB_MIN = '1940-01-01';
	const DOB_MAX = '2008-12-31';
	let confirmPassword = $state('');
	let studentId = $state('');
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
		if (!firstName || !lastName || !dateOfBirth || !email || !studentId || !program || !studentType || !lastSchoolYear || !password || !confirmPassword) { error = 'Please fill in all required fields.'; return; }
		if (dateOfBirth < DOB_MIN || dateOfBirth > DOB_MAX) {
			error = `Date of birth must be between ${DOB_MIN.slice(0, 4)} and ${DOB_MAX.slice(0, 4)}.`;
			return;
		}
		if (!/^\d{2}-\d{4}$/.test(studentId)) { error = 'Student ID must follow the format 00-0000.'; return; }
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

<div class="min-h-screen bg-gradient-to-br from-essu-blue via-essu-green to-essu-green-mid flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<!-- Brand -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-3 backdrop-blur-sm">
				<i class="fa-solid fa-graduation-cap text-white text-3xl"></i>
			</div>
			<h1 class="text-2xl font-bold text-white">ESSU DocuFlow</h1>
			<p class="text-white/70 text-sm mt-1">Student Document Request Portal</p>
		</div>

		<!-- Card -->
		<div class="bg-white rounded-2xl shadow-2xl overflow-hidden">
			<!-- Mode toggle (login/signup only) -->
			{#if mode === 'login' || mode === 'signup'}
				<div class="flex border-b border-gray-100">
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

			<div class="p-8">
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
									<button type="button" onclick={() => (showLoginPassword = !showLoginPassword)}
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
									bind:value={firstName}
									type="text"
									placeholder="Juan"
									required
									class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
									autocomplete="off"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Middle Name <span class="text-gray-400 font-normal">(optional)</span></label>
								
<input
									bind:value={middleName}
									type="text"
									placeholder="Dela"
									class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
									autocomplete="off"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
								
<input
									bind:value={lastName}
									type="text"
									placeholder="Cruz"
									required
									class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
									autocomplete="off"
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
										bind:value={studentId}
										type="text"
										placeholder="00-0000"
										required
										class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
										autocomplete="off"
									/>
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

										<button type="button" onclick={() => (showPassword = !showPassword)}
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

										<button type="button" onclick={() => (showConfirmPassword = !showConfirmPassword)}
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

		<p class="text-center text-white/50 text-xs mt-6">
			Eastern Samar State University · Graduate School
		</p>
	</div>
</div>
