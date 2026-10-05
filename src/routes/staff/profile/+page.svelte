<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	let profile = $state({ ...data.profile });

	const fullName = $derived(
		[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ')
	);
	const initials = $derived(
		[profile.first_name, profile.last_name].map((n) => n[0]).join('').toUpperCase()
	);

	// ── Edit Personal Info ───────────────────────────────────────────
	let personalOpen = $state(false);
	let personalError = $state('');
	let personalLoading = $state(false);
	let pFirstName = $state('');
	let pMiddleName = $state('');
	let pLastName = $state('');

	function openPersonal() {
		pFirstName  = profile.first_name;
		pMiddleName = profile.middle_name ?? '';
		pLastName   = profile.last_name;
		personalError = '';
		personalOpen = true;
	}

	async function savePersonal(e: Event) {
		e.preventDefault();
		personalError = '';
		personalLoading = true;
		try {
			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'staff-personal', firstName: pFirstName, middleName: pMiddleName || null, lastName: pLastName })
			});
			const data = await res.json();
			if (!res.ok) {
				personalError = data.error ?? 'Failed to save changes.';
			} else {
				profile.first_name  = pFirstName;
				profile.middle_name = pMiddleName || null;
				profile.last_name   = pLastName;
				personalOpen = false;
			}
		} catch {
			personalError = 'Network error. Please try again.';
		} finally {
			personalLoading = false;
		}
	}

	// ── Edit Professional Info (Admin only) ──────────────────────────
	let professionalOpen = $state(false);
	let professionalError = $state('');
	let professionalLoading = $state(false);
	let pPosition = $state('');

	function openProfessional() {
		pPosition = profile.position ?? '';
		professionalError = '';
		professionalOpen = true;
	}

	async function saveProfessional(e: Event) {
		e.preventDefault();
		professionalError = '';
		professionalLoading = true;
		try {
			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'staff-professional', position: pPosition || null })
			});
			const data = await res.json();
			if (!res.ok) {
				professionalError = data.error ?? 'Failed to save changes.';
			} else {
				profile.position = pPosition || null;
				professionalOpen = false;
			}
		} catch {
			professionalError = 'Network error. Please try again.';
		} finally {
			professionalLoading = false;
		}
	}

	// ── Change Password ──────────────────────────────────────────────
	let passwordOpen = $state(false);
	let passwordError = $state('');
	let passwordSuccess = $state(false);
	let passwordLoading = $state(false);
	let showCurrent = $state(false);
	let showNew = $state(false);
	let showConfirm = $state(false);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	function openPassword() {
		currentPassword = newPassword = confirmPassword = '';
		passwordError = '';
		passwordSuccess = false;
		showCurrent = showNew = showConfirm = false;
		passwordOpen = true;
	}

	async function handlePasswordChange(e: Event) {
		e.preventDefault();
		passwordError = '';
		if (newPassword.length < 8) { passwordError = 'Password must be at least 8 characters.'; return; }
		if (newPassword !== confirmPassword) { passwordError = 'Passwords do not match.'; return; }
		passwordLoading = true;
		try {
			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'password', currentPassword, newPassword })
			});
			const data = await res.json();
			if (!res.ok) {
				passwordError = data.error ?? 'Failed to update password.';
			} else {
				passwordSuccess = true;
				setTimeout(() => (passwordOpen = false), 1500);
			}
		} catch {
			passwordError = 'Network error. Please try again.';
		} finally {
			passwordLoading = false;
		}
	}

	// ── Change Email ─────────────────────────────────────────────────
	let emailOpen = $state(false);
	let emailError = $state('');
	let emailSuccess = $state(false);
	let emailLoading = $state(false);
	let newEmail = $state('');
	let emailPassword = $state('');
	let showEmailPassword = $state(false);

	function openEmail() {
		newEmail = '';
		emailPassword = '';
		emailError = '';
		emailSuccess = false;
		showEmailPassword = false;
		emailOpen = true;
	}

	async function handleEmailChange(e: Event) {
		e.preventDefault();
		emailError = '';
		emailLoading = true;
		try {
			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'email', newEmail, password: emailPassword })
			});
			const data = await res.json();
			if (!res.ok) {
				emailError = data.error ?? 'Failed to update email.';
			} else {
				profile.email = newEmail;
				emailSuccess = true;
				setTimeout(() => (emailOpen = false), 1500);
			}
		} catch {
			emailError = 'Network error. Please try again.';
		} finally {
			emailLoading = false;
		}
	}
</script>

<div class="max-w-4xl mx-auto space-y-5">
	<!-- Profile header -->
	<div class="profile-header bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
		<div class="flex items-center gap-5">
			<div class="w-20 h-20 rounded-2xl bg-essu-green/10 border border-essu-green/20 flex items-center justify-center text-2xl font-bold text-essu-green shrink-0">
				{initials}
			</div>
			<div>
				<h2 class="text-xl font-bold text-gray-800">{fullName}</h2>
				<p class="text-sm text-gray-500 mt-0.5">{profile.position ?? '—'} · {profile.role}</p>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 xl:grid-cols-3 gap-5">
		<div class="xl:col-span-2 space-y-4">
			<!-- Personal Info -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700">Personal Information</h3>
					<button onclick={openPersonal} class="text-sm text-essu-green hover:underline flex items-center gap-1">
						<i class="fa-solid fa-pen text-xs"></i> Edit
					</button>
				</div>
				<div class="profile-data-grid grid grid-cols-2 gap-4 p-5 text-sm">
					<div><p class="text-xs text-gray-400 mb-0.5">First Name</p><p class="font-medium text-gray-700">{profile.first_name}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Middle Name</p><p class="font-medium text-gray-700">{profile.middle_name ?? '—'}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Last Name</p><p class="font-medium text-gray-700">{profile.last_name}</p></div>
				</div>
			</div>

			<!-- Professional Info -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700">Professional Information</h3>
					{#if profile.role === 'Admin'}
						<button onclick={openProfessional} class="text-sm text-essu-green hover:underline flex items-center gap-1">
							<i class="fa-solid fa-pen text-xs"></i> Edit
						</button>
					{/if}
				</div>
				<div class="profile-data-grid grid grid-cols-2 gap-4 p-5 text-sm">
					<div><p class="text-xs text-gray-400 mb-0.5">Role</p><p class="font-medium text-gray-700">{profile.role}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Position</p><p class="font-medium text-gray-700">{profile.position ?? '—'}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Email</p><p class="font-medium text-gray-700">{profile.email}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Date Registered</p><p class="font-medium text-gray-700">{profile.date_registered ?? '—'}</p></div>
				</div>
			</div>
		</div>

		<!-- Account Settings -->
		<div>
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700">Account Settings</h3>
				</div>
				<div class="p-4 space-y-2">
					<button onclick={openPassword} class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
						<div class="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
							<i class="fa-solid fa-lock text-gray-600 text-sm"></i>
						</div>
						<span class="text-sm font-medium text-gray-700">Change Password</span>
						<i class="fa-solid fa-chevron-right text-xs text-gray-400 ml-auto"></i>
					</button>
					<button onclick={openEmail} class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
						<div class="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
							<i class="fa-solid fa-envelope text-gray-600 text-sm"></i>
						</div>
						<span class="text-sm font-medium text-gray-700">Change Email</span>
						<i class="fa-solid fa-chevron-right text-xs text-gray-400 ml-auto"></i>
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Edit Personal Info Modal -->
<Modal open={personalOpen} title="Edit Personal Information" size="sm" onclose={() => (personalOpen = false)}>
	{#snippet body()}
		<form onsubmit={savePersonal} id="personal-form" class="space-y-4">
			{#if personalError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
					<i class="fa-solid fa-circle-exclamation mr-1"></i>{personalError}
				</div>
			{/if}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
				<input bind:value={pFirstName} type="text" required
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Middle Name <span class="text-gray-400 font-normal">(optional)</span></label>
				<input bind:value={pMiddleName} type="text"
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
				<input bind:value={pLastName} type="text" required
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
			</div>
		</form>
	{/snippet}
	{#snippet footer()}
		<button onclick={() => (personalOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
		<button type="submit" form="personal-form" disabled={personalLoading}
			class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2">
			{#if personalLoading}<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>{/if}
			Save Changes
		</button>
	{/snippet}
</Modal>

<!-- Edit Professional Info Modal (Admin only) -->
<Modal open={professionalOpen} title="Edit Professional Information" size="sm" onclose={() => (professionalOpen = false)}>
	{#snippet body()}
		<form onsubmit={saveProfessional} id="professional-form" class="space-y-4">
			{#if professionalError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
					<i class="fa-solid fa-circle-exclamation mr-1"></i>{professionalError}
				</div>
			{/if}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Position <span class="text-gray-400 font-normal">(optional)</span></label>
				<input bind:value={pPosition} type="text" placeholder="e.g. Registrar"
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
			</div>
		</form>
	{/snippet}
	{#snippet footer()}
		<button onclick={() => (professionalOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
		<button type="submit" form="professional-form" disabled={professionalLoading}
			class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2">
			{#if professionalLoading}<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>{/if}
			Save Changes
		</button>
	{/snippet}
</Modal>

<!-- Change Password Modal -->
<Modal open={passwordOpen} title="Change Password" size="sm" onclose={() => (passwordOpen = false)}>
	{#snippet body()}
		{#if passwordSuccess}
			<div class="text-center py-4">
				<i class="fa-solid fa-circle-check text-3xl text-essu-green mb-2"></i>
				<p class="text-sm text-gray-600">Password updated successfully.</p>
			</div>
		{:else}
			<form onsubmit={handlePasswordChange} id="pw-form" class="space-y-4">
				{#if passwordError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{passwordError}
					</div>
				{/if}
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
					<div class="relative">
						<input bind:value={currentPassword} type={showCurrent ? 'text' : 'password'} required
							class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
						<button type="button" onclick={() => (showCurrent = !showCurrent)}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
							<i class="fa-solid {showCurrent ? 'fa-eye-slash' : 'fa-eye'} text-sm"></i>
						</button>
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
					<div class="relative">
						<input bind:value={newPassword} type={showNew ? 'text' : 'password'} required minlength="8"
							class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
						<button type="button" onclick={() => (showNew = !showNew)}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
							<i class="fa-solid {showNew ? 'fa-eye-slash' : 'fa-eye'} text-sm"></i>
						</button>
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
					<div class="relative">
						<input bind:value={confirmPassword} type={showConfirm ? 'text' : 'password'} required
							class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
						<button type="button" onclick={() => (showConfirm = !showConfirm)}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
							<i class="fa-solid {showConfirm ? 'fa-eye-slash' : 'fa-eye'} text-sm"></i>
						</button>
					</div>
				</div>
			</form>
		{/if}
	{/snippet}
	{#snippet footer()}
		{#if !passwordSuccess}
			<button onclick={() => (passwordOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
			<button type="submit" form="pw-form" disabled={passwordLoading}
				class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2">
				{#if passwordLoading}<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>{/if}
				Update Password
			</button>
		{/if}
	{/snippet}
</Modal>

<!-- Change Email Modal -->
<Modal open={emailOpen} title="Change Email" size="sm" onclose={() => (emailOpen = false)}>
	{#snippet body()}
		{#if emailSuccess}
			<div class="text-center py-4">
				<i class="fa-solid fa-circle-check text-3xl text-essu-green mb-2"></i>
				<p class="text-sm text-gray-600">Email updated successfully.</p>
			</div>
		{:else}
			<form onsubmit={handleEmailChange} id="email-form" class="space-y-4">
				{#if emailError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{emailError}
					</div>
				{/if}
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">New Email Address</label>
					<input bind:value={newEmail} type="email" required autocomplete="off"
						class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Confirm with Password</label>
					<div class="relative">
						<input bind:value={emailPassword} type={showEmailPassword ? 'text' : 'password'} required autocomplete="current-password"
							class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
						<button type="button" onclick={() => (showEmailPassword = !showEmailPassword)}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
							<i class="fa-solid {showEmailPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm"></i>
						</button>
					</div>
				</div>
			</form>
		{/if}
	{/snippet}
	{#snippet footer()}
		{#if !emailSuccess}
			<button onclick={() => (emailOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
			<button type="submit" form="email-form" disabled={emailLoading}
				class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2">
				{#if emailLoading}<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>{/if}
				Update Email
			</button>
		{/if}
	{/snippet}
</Modal>
