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

<div class="min-h-screen bg-gradient-to-br from-essu-blue via-essu-green to-essu-green-mid flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-3 backdrop-blur-sm">
				<i class="fa-solid fa-lock-open text-white text-3xl"></i>
			</div>
			<h1 class="text-2xl font-bold text-white">ESSU DocuFlow</h1>
			<p class="text-white/70 text-sm mt-1">Reset your password</p>
		</div>

		<div class="bg-white rounded-2xl shadow-2xl p-8">
			{#if !token}
				<div class="text-center py-4">
					<i class="fa-solid fa-circle-xmark text-4xl text-red-400 mb-3"></i>
					<p class="text-gray-600 text-sm">Invalid or missing reset link.</p>
					<a href="/login" class="mt-4 inline-block text-sm text-essu-green hover:underline">← Back to Sign In</a>
				</div>
			{:else if success}
				<div class="text-center py-4">
					<div class="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
						<i class="fa-solid fa-circle-check text-2xl text-essu-green"></i>
					</div>
					<h2 class="text-lg font-semibold text-gray-800 mb-2">Password updated!</h2>
					<p class="text-sm text-gray-500">Redirecting you to the login page…</p>
				</div>
			{:else}
				{#if error}
					<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
						<i class="fa-solid fa-circle-exclamation shrink-0"></i>
						{error}
					</div>
				{/if}

				<form onsubmit={handleSubmit} class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
						<div class="relative">
							<input
								bind:value={password}
								type={showPassword ? 'text' : 'password'}
								placeholder="Min. 8 characters"
								required
								minlength="8"
								class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
							/>
							<button type="button" onclick={() => (showPassword = !showPassword)}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
								<i class="fa-solid {showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm"></i>
							</button>
						</div>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
						<div class="relative">
							<input
								bind:value={confirmPassword}
								type={showConfirm ? 'text' : 'password'}
								placeholder="Repeat password"
								required
								class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light"
							/>
							<button type="button" onclick={() => (showConfirm = !showConfirm)}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
								<i class="fa-solid {showConfirm ? 'fa-eye-slash' : 'fa-eye'} text-sm"></i>
							</button>
						</div>
					</div>
					<button
						type="submit"
						disabled={loading}
						class="w-full py-2.5 bg-essu-green text-white rounded-lg font-medium text-sm hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
					>
						{#if loading}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
						Set New Password
					</button>
				</form>

				<div class="mt-4 text-center">
					<a href="/login" class="text-sm text-essu-green hover:underline">← Back to Sign In</a>
				</div>
			{/if}
		</div>

		<p class="text-center text-white/50 text-xs mt-6">
			Eastern Samar State University · Graduate School
		</p>
	</div>
</div>
