<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import FormSection from '$lib/components/ui/FormSection.svelte';
	import FormActions from '$lib/components/ui/FormActions.svelte';
	import {validateForm} from '$lib/components/ui/form-validation';
	import { formatName } from '$lib/formatting';
	import {formatDate} from '$lib/request-flow';
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	let profile = $state({ ...data.profile });

	const fullName = $derived(
		formatName(profile.first_name, profile.middle_name, profile.last_name)
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
					<Button onclick={openPersonal} variant="ghost">
						<i class="fa-solid fa-pen text-xs"></i> Edit
					</Button>
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
						<Button onclick={openProfessional} variant="ghost">
							<i class="fa-solid fa-pen text-xs"></i> Edit
						</Button>
					{/if}
				</div>
				<div class="profile-data-grid grid grid-cols-2 gap-4 p-5 text-sm">
					<div><p class="text-xs text-gray-400 mb-0.5">Role</p><p class="font-medium text-gray-700">{profile.role}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Position</p><p class="font-medium text-gray-700">{profile.position ?? '—'}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Email</p><p class="font-medium text-gray-700">{profile.email}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Date Registered</p><p class="font-medium text-gray-700">{formatDate(profile.date_registered)}</p></div>
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
						<span class="text-sm font-medium text-gray-700">Change password</span>
						<i class="fa-solid fa-chevron-right text-xs text-gray-400 ml-auto"></i>
					</button>
					<button onclick={openEmail} class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
						<div class="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
							<i class="fa-solid fa-envelope text-gray-600 text-sm"></i>
						</div>
						<span class="text-sm font-medium text-gray-700">Change email</span>
						<i class="fa-solid fa-chevron-right text-xs text-gray-400 ml-auto"></i>
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Edit Personal Info Modal -->
<Modal open={personalOpen} closeDisabled={personalLoading} title="Edit Personal Information" size="sm" onclose={() => (personalOpen = false)}>
	{#snippet body()}
		<form use:validateForm onsubmit={savePersonal} id="personal-form" class="space-y-4"><FormSection>
			{#if personalError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
					<i class="fa-solid fa-circle-exclamation mr-1"></i>{personalError}
				</div>
			{/if}
			<TextField label="First Name" bind:value={pFirstName} type="text" required />
			<TextField label="Middle Name (optional)" bind:value={pMiddleName} type="text" />
			<TextField label="Last Name" bind:value={pLastName} type="text" required />
		</FormSection></form>
	{/snippet}
	{#snippet footer()}<FormActions>
		<Button variant="secondary" onclick={() => (personalOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</Button>
		<Button type="submit" form="personal-form" loading={personalLoading}
		 loadingLabel="Saving…">
			
			Save changes
		</Button>
	</FormActions>{/snippet}
</Modal>

<!-- Edit Professional Info Modal (Admin only) -->
<Modal open={professionalOpen} closeDisabled={professionalLoading} title="Edit Professional Information" size="sm" onclose={() => (professionalOpen = false)}>
	{#snippet body()}
		<form use:validateForm onsubmit={saveProfessional} id="professional-form" class="space-y-4"><FormSection>
			{#if professionalError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
					<i class="fa-solid fa-circle-exclamation mr-1"></i>{professionalError}
				</div>
			{/if}
			<TextField label="Position (optional)" bind:value={pPosition} type="text" placeholder="e.g. Registrar" />
		</FormSection></form>
	{/snippet}
	{#snippet footer()}<FormActions>
		<Button variant="secondary" onclick={() => (professionalOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</Button>
		<Button type="submit" form="professional-form" loading={professionalLoading}
		 loadingLabel="Saving…">
			
			Save changes
		</Button>
	</FormActions>{/snippet}
</Modal>

<!-- Change Password Modal -->
<Modal open={passwordOpen} closeDisabled={passwordLoading} title="Change Password" size="sm" onclose={() => (passwordOpen = false)}>
	{#snippet body()}
		{#if passwordSuccess}
			<div class="text-center py-4">
				<i class="fa-solid fa-circle-check text-3xl text-essu-green mb-2"></i>
				<p class="text-sm text-gray-600">Password updated successfully.</p>
			</div>
		{:else}
			<form use:validateForm onsubmit={handlePasswordChange} id="pw-form" class="space-y-4"><FormSection>
				{#if passwordError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{passwordError}
					</div>
				{/if}
				<TextField label="Current Password" bind:value={currentPassword} type="password" required />
				<TextField label="New Password" bind:value={newPassword} type="password" required minlength={8} passwordRules />
				<TextField label="Confirm New Password" bind:value={confirmPassword} type="password" required validator={value => value === newPassword ? '' : 'Passwords do not match.'} />
			</FormSection></form>
		{/if}
	{/snippet}
	{#snippet footer()}<FormActions>
		{#if !passwordSuccess}
			<Button variant="secondary" onclick={() => (passwordOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</Button>
			<Button type="submit" form="pw-form" loading={passwordLoading}
			 loadingLabel="Saving…">
				
				Update password
			</Button>
		{/if}
	</FormActions>{/snippet}
</Modal>

<!-- Change Email Modal -->
<Modal open={emailOpen} closeDisabled={emailLoading} title="Change Email" size="sm" onclose={() => (emailOpen = false)}>
	{#snippet body()}
		{#if emailSuccess}
			<div class="text-center py-4">
				<i class="fa-solid fa-circle-check text-3xl text-essu-green mb-2"></i>
				<p class="text-sm text-gray-600">Email updated successfully.</p>
			</div>
		{:else}
			<form use:validateForm onsubmit={handleEmailChange} id="email-form" class="space-y-4"><FormSection>
				{#if emailError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{emailError}
					</div>
				{/if}
				<TextField label="New Email Address" bind:value={newEmail} type="email" required autocomplete="off" />
				<TextField label="Confirm with Password" bind:value={emailPassword} type="password" required autocomplete="current-password" />
			</FormSection></form>
		{/if}
	{/snippet}
	{#snippet footer()}<FormActions>
		{#if !emailSuccess}
			<Button variant="secondary" onclick={() => (emailOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</Button>
			<Button type="submit" form="email-form" loading={emailLoading}
			 loadingLabel="Saving…">
				
				Update email
			</Button>
		{/if}
	</FormActions>{/snippet}
</Modal>
