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

<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<!-- Logo / Brand -->
		<div class="text-center mb-8">
			<div class="w-14 h-14 rounded-2xl bg-essu-green flex items-center justify-center mx-auto mb-3 shadow-lg">
				<i class="fa-solid fa-graduation-cap text-2xl text-white"></i>
			</div>
			<h1 class="text-xl font-bold text-gray-900">ESSU DocuFlow</h1>
			<p class="text-sm text-gray-500 mt-0.5">Eastern Samar State University</p>
		</div>

		<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
			{#if !data.valid}
				<!-- Invalid/expired token -->
				<div class="text-center py-6">
					<div class="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
						<i class="fa-solid fa-link-slash text-red-400 text-lg"></i>
					</div>
					<h2 class="font-semibold text-gray-800 mb-1">Invalid or Expired Link</h2>
					<p class="text-sm text-gray-500">This invitation link is no longer valid. Please ask your admin to send a new invite.</p>
				</div>
			{:else if success}
				<!-- Success state -->
				<div class="text-center py-6">
					<div class="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
						<i class="fa-solid fa-circle-check text-green-500 text-lg"></i>
					</div>
					<h2 class="font-semibold text-gray-800 mb-1">Account Created!</h2>
					<p class="text-sm text-gray-500 mb-4">Your {data.role} account has been set up. You can now log in.</p>
					<a href="/login" class="inline-flex items-center gap-2 px-4 py-2 bg-essu-green text-white text-sm rounded-lg font-medium hover:bg-essu-green-mid transition-colors">
						<i class="fa-solid fa-arrow-right-to-bracket text-xs"></i> Go to Login
					</a>
				</div>
			{:else}
				<!-- Registration form -->
				<div class="mb-5">
					<h2 class="text-lg font-semibold text-gray-800">Accept Invitation</h2>
					<p class="text-sm text-gray-500 mt-0.5">You've been invited as <span class="font-medium text-essu-green">{data.role}</span>. Complete your profile to get started.</p>
				</div>

				<!-- Email badge (read-only) -->
				<div class="mb-5 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-2">
					<i class="fa-solid fa-envelope text-gray-400 text-sm"></i>
					<span class="text-sm text-gray-600">{data.email}</span>
					<span class="ml-auto text-xs px-2 py-0.5 rounded-full bg-essu-green/10 text-essu-green font-medium">{data.role}</span>
				</div>

				{#if error}
					<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{error}
					</div>
				{/if}

				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1.5">First Name <span class="text-red-500">*</span></label>
							<input
								bind:value={firstName}
								type="text"
								required
								autocomplete="given-name"
								class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1.5">Last Name <span class="text-red-500">*</span></label>
							<input
								bind:value={lastName}
								type="text"
								required
								autocomplete="family-name"
								class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
							/>
						</div>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">Position / Title <span class="text-gray-400 text-xs font-normal">(optional)</span></label>
						<input
							bind:value={position}
							type="text"
							placeholder="e.g. Registrar, Records Officer"
							autocomplete="organization-title"
							class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">Password <span class="text-red-500">*</span></label>
						<div class="relative">
							<input
								bind:value={password}
								type={showPassword ? 'text' : 'password'}
								required
								autocomplete="new-password"
								class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
							/>
							<button
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
							>
								<i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
							</button>
						</div>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password <span class="text-red-500">*</span></label>
						<div class="relative">
							<input
								bind:value={confirmPassword}
								type={showConfirm ? 'text' : 'password'}
								required
								autocomplete="new-password"
								class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
							/>
							<button
								type="button"
								onclick={() => (showConfirm = !showConfirm)}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
							>
								<i class="fa-solid {showConfirm ? 'fa-eye-slash' : 'fa-eye'}"></i>
							</button>
						</div>
					</div>

					<button
						type="submit"
						disabled={submitting}
						class="w-full py-2.5 bg-essu-green text-white rounded-lg text-sm font-semibold hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
					>
						{#if submitting}
							<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>
						{/if}
						Create Account
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
