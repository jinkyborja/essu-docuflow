<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let profile = $state({ ...data.profile });

	const fullName = $derived(
		[profile.first_name, profile.middle_name, profile.last_name, profile.suffix]
			.filter(Boolean).join(' ')
	);
	const initials = $derived(
		[profile.first_name, profile.last_name].map((n) => n[0]).join('').toUpperCase()
	);

	// ── Edit Personal Info ───────────────────────────────────────────
	let editOpen = $state(false);
	let editError = $state('');
	let editLoading = $state(false);

	let eFirstName = $state('');
	let eMiddleName = $state('');
	let eLastName = $state('');
	let eSuffix = $state('');
	let eDateOfBirth = $state('');

	function openEdit() {
		eFirstName   = profile.first_name;
		eMiddleName  = profile.middle_name ?? '';
		eLastName    = profile.last_name;
		eSuffix      = profile.suffix ?? '';
		eDateOfBirth = profile.date_of_birth ?? '';
		editError = '';
		editOpen = true;
	}

	async function savePersonal(e: Event) {
		e.preventDefault();
		editError = '';
		editLoading = true;
		try {
			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'personal',
					firstName: eFirstName,
					middleName: eMiddleName || null,
					lastName: eLastName,
					suffix: eSuffix || null,
					dateOfBirth: eDateOfBirth
				})
			});
			const data = await res.json();
			if (!res.ok) {
				editError = data.error ?? 'Failed to save changes.';
			} else {
				profile.first_name    = eFirstName;
				profile.middle_name   = eMiddleName || null;
				profile.last_name     = eLastName;
				profile.suffix        = eSuffix || null;
				profile.date_of_birth = eDateOfBirth;
				editOpen = false;
			}
		} catch {
			editError = 'Network error. Please try again.';
		} finally {
			editLoading = false;
		}
	}

	// ── Edit Academic Info ───────────────────────────────────────────
	let academicOpen = $state(false);
	let academicError = $state('');
	let academicLoading = $state(false);

	let aProgram = $state('');
	let aStudentType = $state('');
	let aLastSchoolYear = $state('');

	function openAcademic() {
		aProgram       = profile.program ?? '';
		aStudentType   = profile.student_type ?? '';
		aLastSchoolYear = String(profile.last_school_year ?? '');
		academicError  = '';
		academicOpen   = true;
	}

	async function saveAcademic(e: Event) {
		e.preventDefault();
		academicError = '';
		academicLoading = true;
		try {
			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'academic',
					program: aProgram,
					studentType: aStudentType,
					lastSchoolYear: Number(aLastSchoolYear)
				})
			});
			const data = await res.json();
			if (!res.ok) {
				academicError = data.error ?? 'Failed to save changes.';
			} else {
				profile.program          = aProgram;
				profile.student_type     = aStudentType;
				profile.last_school_year = Number(aLastSchoolYear);
				academicOpen = false;
			}
		} catch {
			academicError = 'Network error. Please try again.';
		} finally {
			academicLoading = false;
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
				<p class="text-sm text-gray-500 mt-0.5">{profile.program} · {profile.student_id}</p>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 xl:grid-cols-3 gap-5">
		<div class="xl:col-span-2 space-y-4">
			<!-- Personal Info -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700">Personal Information</h3>
					<button onclick={openEdit} class="text-sm text-essu-green hover:underline flex items-center gap-1">
						<i class="fa-solid fa-pen text-xs"></i> Edit
					</button>
				</div>
				<div class="profile-data-grid grid grid-cols-2 gap-4 p-5 text-sm">
					<div><p class="text-xs text-gray-400">First Name</p><p class="font-medium">{profile.first_name}</p></div>
					<div><p class="text-xs text-gray-400">Middle Name</p><p class="font-medium">{profile.middle_name || '—'}</p></div>
					<div><p class="text-xs text-gray-400">Last Name</p>
						<p class="font-medium">{profile.last_name}{profile.suffix ? ', ' + profile.suffix : ''}</p>
					</div>
					<div><p class="text-xs text-gray-400">Date of Birth</p><p class="font-medium">{profile.date_of_birth ?? '—'}</p></div>
					<div class="col-span-2"><p class="text-xs text-gray-400">Email</p><p class="font-medium">{profile.email}</p></div>
				</div>
			</div>

			<!-- Academic Info — read-only -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700">Academic Information</h3>
					<button onclick={openAcademic} class="text-sm text-essu-green hover:underline flex items-center gap-1">
						<i class="fa-solid fa-pen text-xs"></i> Edit
					</button>
				</div>
				<div class="profile-data-grid grid grid-cols-2 gap-4 p-5 text-sm">
					<div><p class="text-xs text-gray-400">Student ID</p><p class="font-medium">{profile.student_id}</p></div>
					<div><p class="text-xs text-gray-400">Program</p><p class="font-medium">{profile.program}</p></div>
					<div class="col-span-2"><p class="text-xs text-gray-400">Student Type</p><p class="font-medium">
						{#if profile.student_type === 'Enrolled'}Currently Enrolled
						{:else if profile.student_type === 'Former'}Former Student
						{:else if profile.student_type === 'Alumni'}Alumni
						{:else}—{/if}
					</p></div>
					<div><p class="text-xs text-gray-400">Last School Year</p><p class="font-medium">{profile.last_school_year ?? '—'}</p></div>
					<div><p class="text-xs text-gray-400">Date Registered</p><p class="font-medium">{profile.date_registered ?? '—'}</p></div>
				</div>
			</div>
		</div>

		<!-- Account Settings -->
		<div class="space-y-4">
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700">Account Settings</h3>
				</div>
				<div class="p-4 space-y-2">
					<button
						onclick={openPassword}
						class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
					>
						<div class="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
							<i class="fa-solid fa-lock text-gray-600 text-sm"></i>
						</div>
						<span class="text-sm font-medium text-gray-700">Change Password</span>
						<i class="fa-solid fa-chevron-right text-xs text-gray-400 ml-auto"></i>
					</button>
					<button
						onclick={openEmail}
						class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
					>
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
<Modal open={editOpen} title="Edit Personal Information" size="md" onclose={() => (editOpen = false)}>
	{#snippet body()}
		<form onsubmit={savePersonal} id="edit-form" class="space-y-4">
			{#if editError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
					<i class="fa-solid fa-circle-exclamation mr-1"></i>{editError}
				</div>
			{/if}
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
					<input bind:value={eFirstName} type="text" required
						class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Middle Name <span class="text-gray-400 font-normal">(optional)</span></label>
					<input bind:value={eMiddleName} type="text"
						class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
				</div>
			</div>
			<div class="grid grid-cols-3 gap-3">
				<div class="col-span-2">
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
					<input bind:value={eLastName} type="text" required
						class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Suffix <span class="text-gray-400 font-normal">(opt.)</span></label>
					<select bind:value={eSuffix} class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30">
						<option value="">—</option>
						<option value="Jr.">Jr.</option>
						<option value="Sr.">Sr.</option>
						<option value="II">II</option>
						<option value="III">III</option>
						<option value="IV">IV</option>
					</select>
				</div>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Date of Birth</label>
				<input bind:value={eDateOfBirth} type="date" required
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
			</div>
		</form>
	{/snippet}
	{#snippet footer()}
		<button onclick={() => (editOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
		<button type="submit" form="edit-form" disabled={editLoading}
			class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2">
			{#if editLoading}<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>{/if}
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

<!-- Edit Academic Info Modal -->
<Modal open={academicOpen} title="Edit Academic Information" size="md" onclose={() => (academicOpen = false)}>
	{#snippet body()}
		<form onsubmit={saveAcademic} id="academic-form" class="space-y-4">
			{#if academicError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
					<i class="fa-solid fa-circle-exclamation mr-1"></i>{academicError}
				</div>
			{/if}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Program / Course</label>
				<input bind:value={aProgram} type="text" required
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Student Type</label>
				<div class="space-y-2">
					{#each [
						{ value: 'Enrolled', label: 'Currently Enrolled', description: 'You are actively taking classes and are currently enrolled this semester.' },
						{ value: 'Former', label: 'Former Student', description: 'You have previously attended ESSU but are no longer actively enrolled.' },
						{ value: 'Alumni', label: 'Alumni', description: 'You have already graduated from ESSU and are requesting documents as a graduate.' }
					] as opt}
						<button type="button" onclick={() => (aStudentType = opt.value)}
							class="w-full text-left px-4 py-3 rounded-lg border-2 transition-all
								{aStudentType === opt.value ? 'border-essu-green bg-essu-green/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}">
							<p class="text-sm font-medium {aStudentType === opt.value ? 'text-essu-green' : 'text-gray-700'}">{opt.label}</p>
							<p class="text-xs text-gray-400 mt-0.5">{opt.description}</p>
						</button>
					{/each}
				</div>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Last School Year Attended</label>
				<input bind:value={aLastSchoolYear} type="number" min="1990" max="2100" required
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
			</div>
		</form>
	{/snippet}
	{#snippet footer()}
		<button onclick={() => (academicOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
		<button type="submit" form="academic-form" disabled={academicLoading}
			class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2">
			{#if academicLoading}<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>{/if}
			Save Changes
		</button>
	{/snippet}
</Modal>
