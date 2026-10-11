<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import LoadError from '$lib/components/ui/LoadError.svelte';
	import { showToast } from '$lib/stores/toasts';
	import { newIdPhotoUploaded } from '$lib/stores/id-review';
	import { formatFileSize } from '$lib/student-files';
	import { STUDENT_ID_PHOTO_URL_TTL, validateStudentIdPhoto } from '$lib/student-id-photo';
	import { formatName } from '$lib/formatting';
	import { SCHOOL_YEAR_MIN, SCHOOL_YEAR_MAX, ENROLLED_SCHOOL_YEAR_MIN, validateSchoolYear } from '$lib/school-year';
	import {formatDate} from '$lib/request-flow';
	import { campuses, isCampus } from '$lib/data/campuses';
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let profile = $state({ ...data.profile });
	$effect(() => { profile = { ...data.profile }; });
	let photoFile = $state<File | null>(null);
	let photoInput = $state<HTMLInputElement>();
	let photoUploading = $state(false);
	let photoError = $state('');
	let photoMessage = $state('');
	let photoUrl = $state('');
	let photoPreviewLoading = $state(false);
	let photoPreviewError = $state('');
	let selectedPhotoUrl = $state('');
	onMount(() => { if (profile.has_id_photo) void previewIdPhoto(); });
	$effect(() => {
		const url = photoFile ? URL.createObjectURL(photoFile) : '';
		selectedPhotoUrl = url;
		return () => { if (url) URL.revokeObjectURL(url); };
	});
	$effect(() => {
		if (!photoUrl) return;
		const timer = setTimeout(() => photoUrl = '', STUDENT_ID_PHOTO_URL_TTL * 1000);
		return () => clearTimeout(timer);
	});

	async function uploadIdPhoto(event: Event) {
		event.preventDefault();
		if (photoUploading || profile.id_status === 'verified') return;
		photoError = validateStudentIdPhoto(photoFile) ?? '';
		photoMessage = '';
		if (photoError || !photoFile) { showToast(photoError || 'Choose an ID photo first.', 'error'); return; }
		photoUploading = true;
		try {
			const prepared = await fetch('/api/profile/id-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare', name: photoFile.name, contentType: photoFile.type, size: photoFile.size }) });
			const upload = await prepared.json();
			if (!prepared.ok) throw new Error(upload.error ?? 'Could not start the upload.');
			const form = new FormData();
			form.append('cacheControl', '0');
			form.append('', photoFile);
			const stored = await fetch(upload.uploadUrl, { method: 'PUT', body: form });
			if (!stored.ok) throw new Error('Could not upload the ID photo. Please try again.');
			const response = await fetch('/api/profile/id-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete', uploadToken: upload.uploadToken }) });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? 'Could not save the ID photo.');
			profile.id_status = result.id_status;
			profile.has_id_photo = true;
			profile.id_photo_uploaded_at = result.id_photo_uploaded_at ?? profile.id_photo_uploaded_at;
			photoUrl = ''; photoPreviewError = ''; photoFile = null;
			if (photoInput) photoInput.value = '';
			newIdPhotoUploaded.set(true);
			photoMessage = 'ID photo uploaded and submitted for office review.';
			showToast(photoMessage);
			if (result.warning) showToast(result.warning, 'error');
			await previewIdPhoto();
			try { await invalidateAll(); } catch { showToast('Your photo was saved. Refresh the page to see your latest review status.', 'error'); }
		} catch (error) { photoError = error instanceof Error ? error.message : 'Could not complete the upload. Please try again.'; showToast(photoError, 'error'); }
		finally { photoUploading = false; }
	}

	async function previewIdPhoto() {
		photoPreviewLoading = true; photoPreviewError = ''; photoUrl = '';
		try {
			const response = await fetch('/api/profile/id-photo');
			const result = await response.json();
			if (!response.ok || !result.url) throw new Error(result.error ?? 'Could not load the ID photo.');
			photoUrl = result.url;
		} catch (error) { photoPreviewError = error instanceof Error ? error.message : 'Could not load the ID photo. Please try again.'; showToast(photoPreviewError, 'error'); }
		finally { photoPreviewLoading = false; }
	}

	const fullName = $derived(
		formatName(profile.first_name, profile.middle_name, profile.last_name)
	);
	const academicLocked = $derived(profile.id_status === 'verified');
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

	let aStudentId = $state('');
	let aProgram = $state('');
	let aStudentType = $state('');
	let aLastSchoolYear = $state('');
	let aCampus = $state('');

	function openAcademic() {
		if (academicLocked) return;
		aStudentId     = profile.student_id ?? '';
		aProgram       = profile.program ?? '';
		aCampus        = profile.campus ?? '';
		aStudentType   = profile.student_type ?? '';
		aLastSchoolYear = String(profile.last_school_year ?? '');
		academicError  = '';
		academicOpen   = true;
	}

	async function saveAcademic(e: Event) {
		e.preventDefault();
		academicError = '';
		if (academicLocked) { academicError = 'Contact the Graduate School office to change these.'; return; }
		const yearError = validateSchoolYear(aLastSchoolYear, aStudentType);
		if (yearError) { academicError = yearError; return; }
		if (!isCampus(aCampus)) { academicError = 'Select your ESSU campus.'; return; }
		academicLoading = true;
		try {
			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'academic',
					studentId: aStudentId.trim(),
					program: aProgram,
					campus: aCampus,
					studentType: aStudentType,
					lastSchoolYear: Number(aLastSchoolYear)
				})
			});
			const data = await res.json();
			if (!res.ok) {
				academicError = data.error ?? 'Failed to save changes.';
			} else {
				profile.student_id       = aStudentId.trim();
				profile.program          = aProgram;
				profile.campus           = aCampus;
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
	<section id="school-id-photo-card" class="scroll-mt-24 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="School ID photo">
		<div class="flex flex-wrap items-center justify-between gap-3"><h3 class="font-semibold text-gray-800">School ID photo</h3><StatusChip kind="id" value={profile.id_status} /></div>
		<p class="text-sm text-gray-600">School ID front · JPG, PNG or WebP · up to 5 MB</p>
		<div class="grid items-start gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
			<div class="flex min-h-40 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-3">{#if selectedPhotoUrl || photoUrl}<img src={selectedPhotoUrl || photoUrl} alt={selectedPhotoUrl ? 'New school ID photo preview' : 'Your uploaded school ID front'} class="max-h-64 max-w-full rounded-lg object-contain" onerror={() => { photoUrl = ''; photoPreviewError = 'Photo preview could not load. Refresh the preview.'; }} />{:else}<p class="text-center text-sm text-gray-500">{photoPreviewLoading ? 'Loading photo…' : profile.has_id_photo ? 'Refresh to view your uploaded photo' : 'No ID photo uploaded'}</p>{/if}</div>
			<div class="space-y-3">
				<Button variant="secondary" icon="fa-solid fa-camera" disabled={profile.id_status === 'verified' || photoUploading} disabledReason={profile.id_status === 'verified' ? 'Contact the Graduate School office to replace a verified ID photo' : undefined} onclick={() => photoInput?.click()}>Replace photo</Button>
				{#if profile.id_status !== 'verified'}<form onsubmit={uploadIdPhoto} class="space-y-3"><label for="school-id-photo" class="sr-only">Choose a new school ID photo (front)</label><input id="school-id-photo" bind:this={photoInput} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={photoUploading} class="hidden" onchange={(event) => { const selected = event.currentTarget.files?.[0]; if (!selected) return; photoError = validateStudentIdPhoto(selected) ?? ''; photoMessage = ''; if (photoError) { event.currentTarget.value = ''; showToast(photoError, 'error'); } else photoFile = selected; }} />{#if photoFile}<p class="break-words text-sm font-medium text-gray-800">{photoFile.name} <span class="text-xs font-normal text-gray-500">· {formatFileSize(photoFile.size)}</span></p><div class="flex flex-wrap gap-2"><Button type="submit" loading={photoUploading} loadingLabel="Uploading…" disabled={!!photoError}>Upload photo</Button><Button variant="ghost" disabled={photoUploading} onclick={() => { photoFile = null; photoError = ''; if (photoInput) photoInput.value = ''; }}>Remove selection</Button></div><p class="text-xs text-gray-600">Uploading the new photo automatically resubmits your ID for office review.</p>{/if}</form>{/if}
				{#if profile.has_id_photo}<p class="text-xs text-gray-500">Last uploaded: {formatDate(profile.id_photo_uploaded_at)}</p><Button variant="ghost" size="sm" loading={photoPreviewLoading} disabled={photoUploading} onclick={previewIdPhoto}>Refresh photo preview</Button>{/if}
			</div>
		</div>
		{#if photoError}<p class="text-sm text-red-700" role="alert">{photoError}</p>{/if}{#if photoMessage}<p class="text-sm text-essu-green" role="status">{photoMessage}</p>{/if}{#if photoPreviewError}<LoadError message="We couldn’t load your ID photo preview. Please try again." onretry={previewIdPhoto} />{/if}
	</section>
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
					<div><p class="text-xs text-gray-400">Date of Birth</p><p class="font-medium">{formatDate(profile.date_of_birth)}</p></div>
					<div class="col-span-2"><p class="text-xs text-gray-400">Email</p><p class="font-medium">{profile.email}</p></div>
				</div>
			</div>

			<!-- Academic Info -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700">Academic Information</h3>
					{#if !academicLocked}
						<button onclick={openAcademic} class="text-sm text-essu-green hover:underline flex items-center gap-1">
							<i class="fa-solid fa-pen text-xs"></i> Edit
						</button>
					{/if}
				</div>
				<div class="profile-data-grid grid grid-cols-2 gap-4 p-5 text-sm">
					<div><p class="text-xs text-gray-400">Student ID</p><p class="font-medium">{profile.student_id}</p></div>
					<div><p class="text-xs text-gray-400">Program</p><p class="font-medium">{profile.program}</p></div>
					<div class="col-span-2"><p class="text-xs text-gray-400">Campus</p><p class="font-medium">{profile.campus ?? 'Not collected'}</p></div>
					<div class="col-span-2"><p class="text-xs text-gray-400">Student Type</p><p class="font-medium">
						{#if profile.student_type === 'Enrolled'}Currently Enrolled
						{:else if profile.student_type === 'Former'}Former Student
						{:else if profile.student_type === 'Alumni'}Alumni
						{:else}—{/if}
					</p></div>
					<div><p class="text-xs text-gray-400">Last School Year</p><p class="font-medium">{profile.last_school_year ?? '—'}</p></div>
					<div><p class="text-xs text-gray-400">Date Registered</p><p class="font-medium">{formatDate(profile.date_registered)}</p></div>
					{#if academicLocked}<p class="col-span-2 text-xs text-gray-500">Contact the Graduate School office to change these.</p>{/if}
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
						<span class="text-sm font-medium text-gray-700">Change password</span>
						<i class="fa-solid fa-chevron-right text-xs text-gray-400 ml-auto"></i>
					</button>
					<button
						onclick={openEmail}
						class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
					>
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
			Save changes
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
						<button type="button" aria-label={showCurrent ? 'Hide current password' : 'Show current password'} title={showCurrent ? 'Hide current password' : 'Show current password'} onclick={() => (showCurrent = !showCurrent)}
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
						<button type="button" aria-label={showNew ? 'Hide new password' : 'Show new password'} title={showNew ? 'Hide new password' : 'Show new password'} onclick={() => (showNew = !showNew)}
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
						<button type="button" aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'} title={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'} onclick={() => (showConfirm = !showConfirm)}
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
				Update password
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
						<button type="button" aria-label={showEmailPassword ? 'Hide password' : 'Show password'} title={showEmailPassword ? 'Hide password' : 'Show password'} onclick={() => (showEmailPassword = !showEmailPassword)}
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
				Update email
			</button>
		{/if}
	{/snippet}
</Modal>

<!-- Edit Academic Info Modal -->
<Modal open={academicOpen && !academicLocked} title="Edit Academic Information" size="md" onclose={() => (academicOpen = false)}>
	{#snippet body()}
		<form onsubmit={saveAcademic} id="academic-form" class="space-y-4">
			{#if academicError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
					<i class="fa-solid fa-circle-exclamation mr-1"></i>{academicError}
				</div>
			{/if}
			<div>
				<label for="academic-student-id" class="block text-sm font-medium text-gray-700 mb-1.5">Student ID</label>
				<input id="academic-student-id" bind:value={aStudentId} type="text" maxlength="20" required
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Program / Course</label>
				<input bind:value={aProgram} type="text" required
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
			</div>
			<div>
				<label for="profile-campus" class="block text-sm font-medium text-gray-700 mb-1.5">Campus</label>
				<select id="profile-campus" bind:value={aCampus} required class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30">
					<option value="" disabled>Select your ESSU campus...</option>
					{#each campuses as option}<option value={option.value}>{option.label}</option>{/each}
				</select>
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
						<input bind:value={aLastSchoolYear} type="number" min={aStudentType === 'Enrolled' ? ENROLLED_SCHOOL_YEAR_MIN : SCHOOL_YEAR_MIN} max={SCHOOL_YEAR_MAX} step="1" required
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
			</div>
		</form>
	{/snippet}
	{#snippet footer()}
		<button onclick={() => (academicOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
		<button type="submit" form="academic-form" disabled={academicLoading}
			class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2">
			{#if academicLoading}<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>{/if}
			Save changes
		</button>
	{/snippet}
</Modal>
