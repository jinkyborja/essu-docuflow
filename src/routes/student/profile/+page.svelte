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

<div class="account-profile-page">
	<div class="profile-header bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
		<div class="flex items-center gap-5">
			<div class="w-20 h-20 rounded-2xl bg-essu-green/10 border border-essu-green/20 flex items-center justify-center text-2xl font-bold text-essu-green shrink-0" aria-hidden="true">{initials}</div>
			<div>
				<h2 class="text-xl font-bold text-gray-800">{fullName}</h2>
				<p class="text-sm text-gray-500 mt-0.5">{profile.program} · {profile.student_id}</p>
			</div>
		</div>
	</div>

	<div class="profile-content-grid grid grid-cols-1 gap-5">
		<div class="profile-main-sections space-y-4">
			<section id="school-id-photo-card" class="profile-section scroll-mt-24 rounded-xl border border-gray-100 bg-white shadow-sm" aria-label="School ID photo">
				<div class="profile-section-heading flex-wrap"><h3>School ID photo</h3><StatusChip kind="id" value={profile.id_status} /></div>
				<div class="profile-section-content space-y-4">
					<p class="text-sm text-gray-600">School ID front · JPG, PNG or WebP · up to 5 MB</p>
					<div class="school-id-content">
						<div class="school-id-preview">{#if selectedPhotoUrl || photoUrl}<img src={selectedPhotoUrl || photoUrl} alt={selectedPhotoUrl ? 'New school ID photo preview' : 'Your uploaded school ID front'} onerror={() => { photoUrl = ''; photoPreviewError = 'Photo preview could not load. Refresh the preview.'; }} />{:else}<p class="text-center text-xs text-gray-500">{photoPreviewLoading ? 'Loading photo…' : profile.has_id_photo ? 'Refresh to view your uploaded photo' : 'No ID photo uploaded'}</p>{/if}</div>
						<div class="space-y-3">
							<Button variant="secondary" icon="fa-solid fa-camera" disabled={profile.id_status === 'verified' || photoUploading} disabledReason={profile.id_status === 'verified' ? 'Contact the Graduate School office to replace a verified ID photo' : undefined} onclick={() => photoInput?.click()}>Replace photo</Button>
							{#if academicLocked}<p class="locked-note"><i class="fa-solid fa-lock" aria-hidden="true"></i>Verified ID photos are locked. Contact the Graduate School office to replace yours.</p>{/if}
							{#if profile.id_status !== 'verified'}<form onsubmit={uploadIdPhoto} class="space-y-3"><label for="school-id-photo" class="sr-only">Choose a new school ID photo (front)</label><input id="school-id-photo" bind:this={photoInput} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={photoUploading} class="hidden" onchange={(event) => { const selected = event.currentTarget.files?.[0]; if (!selected) return; photoError = validateStudentIdPhoto(selected) ?? ''; photoMessage = ''; if (photoError) { event.currentTarget.value = ''; showToast(photoError, 'error'); } else photoFile = selected; }} />{#if photoFile}<p class="break-words text-sm font-medium text-gray-800">{photoFile.name} <span class="text-xs font-normal text-gray-500">· {formatFileSize(photoFile.size)}</span></p><div class="flex flex-wrap gap-2"><Button type="submit" loading={photoUploading} loadingLabel="Uploading…" disabled={!!photoError}>Upload photo</Button><Button variant="ghost" disabled={photoUploading} onclick={() => { photoFile = null; photoError = ''; if (photoInput) photoInput.value = ''; }}>Remove selection</Button></div><p class="text-xs text-gray-600">Uploading the new photo automatically resubmits your ID for office review.</p>{/if}</form>{/if}
							{#if profile.has_id_photo}<div class="photo-preview-tools"><p class="text-xs text-gray-500">Last uploaded: {formatDate(profile.id_photo_uploaded_at)}</p><Button variant="ghost" icon="fa-solid fa-arrows-rotate" ariaLabel="Refresh photo preview" title="Refresh photo preview" loading={photoPreviewLoading} disabled={photoUploading} onclick={previewIdPhoto} /></div>{/if}
						</div>
					</div>
					{#if photoError}<p class="text-sm text-red-700" role="alert">{photoError}</p>{/if}{#if photoMessage}<p class="text-sm text-essu-green" role="status">{photoMessage}</p>{/if}{#if photoPreviewError}<LoadError message="We couldn’t load your ID photo preview. Please try again." onretry={previewIdPhoto} />{/if}
				</div>
			</section>

			<!-- Personal Info -->
			<div class="profile-section bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="profile-section-heading">
					<h3 class="font-semibold text-gray-700">Personal Information</h3>
					<Button variant="ghost" icon="fa-solid fa-pen" onclick={openEdit}>Edit</Button>
				</div>
				<div class="profile-section-content profile-data-grid grid grid-cols-2 gap-4 text-sm">
					<div><p class="text-xs text-gray-400">First Name</p><p class="font-medium">{profile.first_name}</p></div>
					<div><p class="text-xs text-gray-400">Middle Name</p><p class="font-medium">{profile.middle_name || '—'}</p></div>
					<div><p class="text-xs text-gray-400">Last Name</p>
						<p class="font-medium">{profile.last_name}{profile.suffix ? ', ' + profile.suffix : ''}</p>
					</div>
					<div><p class="text-xs text-gray-400">Date of Birth</p><p class="font-medium">{formatDate(profile.date_of_birth)}</p></div>
					<div class="col-span-2"><p class="text-xs text-gray-400"><i class="fa-solid fa-lock" aria-hidden="true"></i> Email</p><p class="font-medium">{profile.email}</p><span class="locked-note">Use Change email in Account Settings to update this.</span></div>
				</div>
			</div>

			<!-- Academic Info -->
			<div class="profile-section bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="profile-section-heading">
					<h3 class="font-semibold text-gray-700">Academic Information</h3>
					{#if !academicLocked}
						<Button variant="ghost" icon="fa-solid fa-pen" onclick={openAcademic}>Edit</Button>
					{/if}
				</div>
				<div class="profile-section-content profile-data-grid grid grid-cols-2 gap-4 text-sm">
					<div><p class="text-xs text-gray-400">{#if academicLocked}<i class="fa-solid fa-lock" aria-hidden="true"></i> {/if}Student ID</p><p class="font-medium">{profile.student_id}</p></div>
					<div><p class="text-xs text-gray-400">{#if academicLocked}<i class="fa-solid fa-lock" aria-hidden="true"></i> {/if}Program</p><p class="font-medium">{profile.program}</p></div>
					<div class="col-span-2"><p class="text-xs text-gray-400">{#if academicLocked}<i class="fa-solid fa-lock" aria-hidden="true"></i> {/if}Campus</p><p class="font-medium">{profile.campus ?? 'Not collected'}</p></div>
					<div class="col-span-2"><p class="text-xs text-gray-400">{#if academicLocked}<i class="fa-solid fa-lock" aria-hidden="true"></i> {/if}Student Type</p><p class="font-medium">
						{#if profile.student_type === 'Enrolled'}Currently Enrolled
						{:else if profile.student_type === 'Former'}Former Student
						{:else if profile.student_type === 'Alumni'}Alumni
						{:else}—{/if}
					</p></div>
					<div><p class="text-xs text-gray-400">{#if academicLocked}<i class="fa-solid fa-lock" aria-hidden="true"></i> {/if}Last School Year</p><p class="font-medium">{profile.last_school_year ?? '—'}</p></div>
					<div><p class="text-xs text-gray-400">Date Registered</p><p class="font-medium">{formatDate(profile.date_registered)}</p></div>
					{#if academicLocked}<p class="col-span-2 locked-note"><i class="fa-solid fa-lock" aria-hidden="true"></i>Verified academic details are locked. Contact the Graduate School office to change these.</p>{/if}
				</div>
			</div>
		</div>

		<!-- Account Settings -->
		<div class="profile-settings space-y-4">
			<div class="profile-section bg-white rounded-xl border border-gray-100">
				<div class="profile-section-heading">
					<h3 class="font-semibold text-gray-700">Account Settings</h3>
				</div>
				<div class="profile-section-content">
					<Button variant="ghost" icon="fa-solid fa-lock" onclick={openPassword} class="account-action">Change password</Button>
					<Button variant="ghost" icon="fa-solid fa-envelope" onclick={openEmail} class="account-action">Change email</Button>
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
		<Button variant="secondary" onclick={() => (editOpen = false)}>Cancel</Button>
		<Button type="submit" form="edit-form" loading={editLoading}>Save changes</Button>
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
						<span class="password-toggle"><Button variant="ghost" ariaLabel={showCurrent ? 'Hide current password' : 'Show current password'} title={showCurrent ? 'Hide current password' : 'Show current password'} icon={'fa-solid ' + (showCurrent ? 'fa-eye-slash' : 'fa-eye')} onclick={() => (showCurrent = !showCurrent)} /></span>
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
					<div class="relative">
						<input bind:value={newPassword} type={showNew ? 'text' : 'password'} required minlength="8"
							class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
						<span class="password-toggle"><Button variant="ghost" ariaLabel={showNew ? 'Hide new password' : 'Show new password'} title={showNew ? 'Hide new password' : 'Show new password'} icon={'fa-solid ' + (showNew ? 'fa-eye-slash' : 'fa-eye')} onclick={() => (showNew = !showNew)} /></span>
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
					<div class="relative">
						<input bind:value={confirmPassword} type={showConfirm ? 'text' : 'password'} required
							class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
						<span class="password-toggle"><Button variant="ghost" ariaLabel={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'} title={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'} icon={'fa-solid ' + (showConfirm ? 'fa-eye-slash' : 'fa-eye')} onclick={() => (showConfirm = !showConfirm)} /></span>
					</div>
				</div>
			</form>
		{/if}
	{/snippet}
	{#snippet footer()}
		{#if !passwordSuccess}
			<Button variant="secondary" onclick={() => (passwordOpen = false)}>Cancel</Button>
			<Button type="submit" form="pw-form" loading={passwordLoading}>Update password</Button>
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
						<span class="password-toggle"><Button variant="ghost" ariaLabel={showEmailPassword ? 'Hide password' : 'Show password'} title={showEmailPassword ? 'Hide password' : 'Show password'} icon={'fa-solid ' + (showEmailPassword ? 'fa-eye-slash' : 'fa-eye')} onclick={() => (showEmailPassword = !showEmailPassword)} /></span>
					</div>
				</div>
			</form>
		{/if}
	{/snippet}
	{#snippet footer()}
		{#if !emailSuccess}
			<Button variant="secondary" onclick={() => (emailOpen = false)}>Cancel</Button>
			<Button type="submit" form="email-form" loading={emailLoading}>Update email</Button>
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
						<div><Button variant="secondary" ariaPressed={aStudentType === opt.value} class={aStudentType === opt.value ? 'student-type-option selected' : 'student-type-option'} onclick={() => (aStudentType = opt.value)}>{opt.label}</Button><p class="mt-2 text-xs text-gray-500">{opt.description}</p></div>
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
		<Button variant="secondary" onclick={() => (academicOpen = false)}>Cancel</Button>
		<Button type="submit" form="academic-form" loading={academicLoading}>Save changes</Button>
	{/snippet}
</Modal>

<style>
	.school-id-content { display: grid; gap: var(--space-4); align-items: start; }
	.school-id-preview { display: grid; place-items: center; width: 144px; min-height: 160px; padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-bg); }
	.school-id-preview img { width: 120px; max-width: 100%; max-height: 200px; border-radius: var(--radius-control); object-fit: contain; }
	.photo-preview-tools { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
	.locked-note { display: block; color: var(--color-text-muted); font-size: var(--font-size-helper); font-weight: var(--font-weight-normal); line-height: var(--line-height); }
	.locked-note > i { margin-right: var(--space-1); }
	:global(.account-action.ui-button) { width: 100%; justify-content: flex-start; }
	.password-toggle { position: absolute; top: 50%; right: var(--space-1); transform: translateY(-50%); }
	.password-toggle :global(.ui-button) { padding: 0; }
	:global(.student-type-option.ui-button) { width: 100%; justify-content: flex-start; }
	:global(.student-type-option.selected.ui-button) { border-color: var(--color-primary); background: var(--color-primary-soft); }
	@media (min-width: 640px) { .school-id-content { grid-template-columns: 144px minmax(0, 1fr); } }
	@media (max-width: 639px) {
		:global(.profile-data-grid) { grid-template-columns: minmax(0, 1fr); }
		:global(.profile-data-grid > *) { grid-column: 1 / -1; min-width: 0; overflow-wrap: anywhere; }
	}
</style>
