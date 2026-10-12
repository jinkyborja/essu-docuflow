<script lang="ts">
	import { responsiveTable } from '$lib/responsive-table';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import LoadError from '$lib/components/ui/LoadError.svelte';
	import { formatName, pluralize } from '$lib/formatting';
	import { SCHOOL_YEAR_MIN, SCHOOL_YEAR_MAX, ENROLLED_SCHOOL_YEAR_MIN, validateSchoolYear } from '$lib/school-year';
	import {onMount} from 'svelte';
	import { campuses } from '$lib/data/campuses';
	import MasterlistModal from '$lib/components/ui/MasterlistModal.svelte';
	import type { MasterlistMatch } from '$lib/server/masterlist';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import { showToast } from '$lib/stores/toasts';
	import { fetchAdminRequests, studentHasRequests, type AdminRequest } from '$lib/admin-requests';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type Student = {
		has_id_photo?: boolean; id_photo_url?: string | null; id_photo_uploaded_at?: string | null;
		campus?: string | null; masterlistMatch?: MasterlistMatch; id_verified_by_name?: string | null; id_verification_note?: string | null;
		user_id: number;
		first_name: string;
		middle_name: string | null;
		last_name: string;
		suffix: string | null;
		email: string;
		student_id: string | null;
		program: string | null;
		student_type: 'Enrolled' | 'Former' | 'Alumni' | null;
		last_school_year: number | null;
		verified: boolean | number;
		id_status: 'pending' | 'verified' | 'rejected';
		id_verified_at: string | null;
		id_reject_reason: string | null;
		date_of_birth: string | null;
		date_registered: string;
	};

	let students = $state(data.students as Student[]);
	let search = $state('');
	let filterType = $state('');
	let statusTab = $state<'pending'|'verified'|'rejected'|'all'>((new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('status') as 'pending'|'verified'|'rejected') || 'all');
	let reviewStudent = $state<Student | null>(null);
	let rejectReason = $state('');
	let revokeTarget = $state<Student | null>(null), revokeSaving = $state(false), revokeError = $state('');
	let requestUsage = $state<AdminRequest[]>([]), usageLoaded = $state(false), usageError = $state('');
	async function loadRequestUsage() {
		try { requestUsage = await fetchAdminRequests(); usageLoaded = true; usageError = ''; }
		catch (error) { usageLoaded = false; usageError = (error as Error).message; showToast(usageError, 'error'); }
	}
	function deleteReason(student: Student) {
		return data.role !== 'Admin' ? 'Admin access required' : !usageLoaded ? usageError ? 'Could not check requests' : 'Checking requests' : studentHasRequests(student.student_id, requestUsage) ? 'Has requests' : '';
	}
	function rowItems(student: Student) {
		return [{label: 'Edit details', onselect: () => openEdit(student)}, ...(student.id_status === 'verified' ? [{label: 'Revoke verification', danger: true, disabled: data.role !== 'Admin', reason: 'Admin access required', onselect: () => openRevoke(student)}] : []), {label: 'Delete', danger: true, disabled: !!deleteReason(student), reason: deleteReason(student), onselect: () => openDelete(student)}];
	}
	async function confirmRevoke(reason: string) {
		if (!revokeTarget || revokeSaving) return;
		const target = revokeTarget; revokeSaving = true; revokeError = '';
		try {
			const response = await fetch('/api/students/' + target.user_id + '/verify', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'revoke', confirm: true, reason})});
			const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Could not revoke verification.');
			students = students.map(student => student.user_id === target.user_id ? {...student, id_status: result.id_status, id_verified_at: result.id_verified_at, id_reject_reason: result.id_reject_reason} : student);
			revokeTarget = null; showToast('Verification revoked for ' + fullName(target) + '.');
		} catch (error) { revokeError = (error as Error).message; showToast(revokeError, 'error'); }
		finally { revokeSaving = false; }
	}
	let masterlistOpen = $state(false), reviewLoading = $state(false), rejecting = $state(false), verifyAnyway = $state(false), overrideNote = $state('');
	let reviewVersion = 0;
	let photoPreviewError = $state(false);
	let photoRefreshing = $state(false);
	const differing = $derived(reviewStudent?.masterlistMatch ? (['name', 'program', 'campus'] as const).filter(key => reviewStudent!.masterlistMatch![key] !== 'match') : []);
	async function openReview(student: Student) {
		const version = ++reviewVersion;
		photoPreviewError = false;
		reviewStudent = {...student}; reviewLoading = true; reviewError = ''; rejectReason = ''; rejecting = false; verifyAnyway = false; overrideNote = '';
		try {
			const res = await fetch('/api/students/' + student.user_id);
			const result = await res.json();
			if (version !== reviewVersion || reviewStudent?.user_id !== student.user_id) return;
			if (!res.ok) { reviewError = result.error ?? result.message ?? 'Could not load review.'; showToast(reviewError, 'error'); return; }
			reviewStudent = result;
		} catch { if (version === reviewVersion) { reviewError = 'Could not load student review.'; showToast(reviewError, 'error'); } }
		finally { if (version === reviewVersion) reviewLoading = false; }
	}
	function closeReview() { reviewVersion++; reviewStudent = null; reviewLoading = false; }
	async function refreshIdPhoto() {
		if (!reviewStudent || photoRefreshing) return;
		const studentId = reviewStudent.user_id, version = reviewVersion;
		photoRefreshing = true;
		try {
			const response = await fetch('/api/students/' + studentId);
			const result = await response.json();
			if (version !== reviewVersion || reviewStudent?.user_id !== studentId) return;
			if (!response.ok) { photoPreviewError = true; showToast(result.error ?? 'Could not refresh the ID photo.', 'error'); return; }
			reviewStudent = { ...reviewStudent, ...result };
			photoPreviewError = false;
		} catch { if (version === reviewVersion) { photoPreviewError = true; showToast('Could not refresh the ID photo.', 'error'); } }
		finally { photoRefreshing = false; }
	}
	function openRevoke(student: Student) {
		if (data.role !== 'Admin' || student.id_status !== 'verified') return;
		revokeTarget = student; revokeError = '';
	}
	function formatDate(value: string | null) {
		if (!value) return '-'; const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
	}
	function age(value: string | null): number | null {
		if (!value) return null; const birth = new Date(value);
		if (Number.isNaN(birth.getTime())) return null;
		const parts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Manila' }).formatToParts(date).map(p => [p.type, Number(p.value)]));
		const b = parts(birth), today = parts(new Date());
		return today.year - b.year - (today.month < b.month || (today.month === b.month && today.day < b.day) ? 1 : 0);
	}
	let reviewError = $state('');
	let reviewing = $state(false);
	onMount(() => {
		void loadRequestUsage();
		const id = Number(new URLSearchParams(window.location.search).get('review'));
		const student = students.find(row => row.user_id === id);
		if (student) void openReview(student);
	});
	const tabCounts = $derived({pending: students.filter(s => s.id_status === 'pending').length, verified: students.filter(s => s.id_status === 'verified').length, rejected: students.filter(s => s.id_status === 'rejected').length, all: students.length});

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return students.filter((s) => {
			const fullName = [s.first_name, s.middle_name, s.last_name, s.suffix]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			const matchSearch =
				!q ||
				fullName.includes(q) ||
				(s.student_id ?? '').toLowerCase().includes(q) ||
				s.email.toLowerCase().includes(q) ||
				(s.program ?? '').toLowerCase().includes(q);
			const matchType = !filterType || s.student_type === filterType;
			return matchSearch && matchType && (statusTab === 'all' || s.id_status === statusTab);
		});
	});

	async function decideId(action: 'verify'|'reject'|'revoke') {
		if (data.role !== 'Admin' || !reviewStudent || reviewLoading || reviewing || !reviewStudent.masterlistMatch) return;
		if (action === 'verify' && (!reviewStudent.has_id_photo || !reviewStudent.id_photo_url || photoPreviewError || photoRefreshing)) { reviewError = 'Load the uploaded school ID photo before verification.'; return; }
		if ((action === 'reject' || action === 'revoke') && !rejectReason.trim()) { reviewError = 'A reason is required.'; return; }
		const studentUserId = reviewStudent.user_id;
		reviewing = true; reviewError = '';
		try {
			const res = await fetch(`/api/students/${reviewStudent.user_id}/verify`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action, reason: rejectReason, verifyAnyway, note: overrideNote, confirm: action === 'revoke' }) });
			const result = await res.json();
			if (!res.ok) { reviewError = result.error ?? 'Could not update verification.'; showToast(reviewError, 'error'); return; }
			students = students.map(s => s.user_id === studentUserId ? {...s, id_status: result.id_status, id_verified_at: result.id_verified_at, id_reject_reason: result.id_reject_reason} : s);
			showToast(action === 'verify' ? 'Student ID verified.' : 'Student ID rejected.'); rejecting = false; closeReview(); rejectReason = '';
		} catch { reviewError = 'Network error.'; showToast(reviewError, 'error'); } finally { reviewing = false; }
	}

	let editOpen = $state(false);
	let deleteOpen = $state(false);
	let saving = $state(false);
	let saveError = $state('');
	let editStudent = $state<Student | null>(null);
	let deleteTarget = $state<Student | null>(null);

	function openEdit(s: Student) {
		editStudent = { ...s };
		saveError = '';
		editOpen = true;
	}

	function openDelete(s: Student) {
		if (deleteReason(s)) return;
		deleteTarget = s;
		deleteError = '';
		deleteOpen = true;
	}

	async function handleEdit(e: Event) {
		e.preventDefault();
		if (!editStudent) return;
		saveError = '';
		const yearError = validateSchoolYear(editStudent.last_school_year, editStudent.student_type);
		if (yearError) { saveError = yearError; return; }
		saving = true;
		try {
			const res = await fetch('/api/students', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editStudent)
			});
			const result = await res.json();
			if (!res.ok) { saveError = result.error ?? 'Failed to save.'; showToast(saveError, 'error'); return; }
			students = students.map((s) => (s.user_id === editStudent!.user_id ? { ...editStudent! } : s));
			editOpen = false; showToast('Student details updated.');
		} catch {
			saveError = 'Network error.'; showToast(saveError, 'error');
		} finally {
			saving = false;
		}
	}

	let deleteError = $state('');
	let deleting = $state(false);

	async function handleDelete() {
		if (!deleteTarget || deleting) return;
		const targetId = deleteTarget.user_id;
		deleting = true;
		deleteError = '';
		try {
			requestUsage = await fetchAdminRequests(); usageLoaded = true;
			if (studentHasRequests(deleteTarget.student_id, requestUsage)) { deleteError = 'Has requests'; showToast('This student has requests and cannot be deleted.', 'error'); return; }
			const res = await fetch('/api/students', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: targetId })
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok) {
				deleteError = result.error ?? 'Could not delete this student.'; showToast(deleteError, 'error');
				return;
			}
			students = students.filter((s) => s.user_id !== targetId);
			deleteOpen = false; showToast('Student deleted.');
		} catch {
			deleteError = 'Could not delete this student. Please try again.'; showToast(deleteError, 'error');
		} finally {
			deleting = false;
		}
	}

	function fullName(s: Student) {
		return formatName(s.first_name, s.middle_name, s.last_name);
	}

	const typeColors: Record<string, string> = {
		Enrolled: 'bg-blue-100 text-blue-700 border border-blue-200',
		Former: 'bg-gray-100 text-gray-600 border border-gray-200',
		Alumni: 'bg-green-100 text-green-700 border border-green-200'
	};

	function highlight(text: string | null | undefined, q: string): string {
		if (!text) return '—';
		if (!q) return text;
		const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-yellow-200 text-yellow-900 rounded px-0.5">$1</mark>');
	}

</script>

{#if !data.allowed}
<div class="flex flex-col items-center justify-center py-24 text-center">
	<div class="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
		<i class="fa-solid fa-lock text-2xl text-red-400"></i>
	</div>
	<h2 class="text-lg font-semibold text-gray-800 mb-1">Access Restricted</h2>
	<p class="text-sm text-gray-500 max-w-xs">This page is only accessible to administrators. Contact your admin if you need access.</p>
</div>
{:else}
<div class="space-y-5">
	{#if data.role === 'Admin'}<div class="flex justify-end"><Button onclick={() => masterlistOpen = true}>Masterlist</Button></div>{/if}
	{#if usageError}<LoadError message="We couldn’t check linked requests. Please try again." onretry={() => void loadRequestUsage()} />{:else if !usageLoaded}<p role="status" class="flex items-center gap-2 text-sm text-gray-600"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>Checking linked requests…</p>{/if}
	<!-- Search / Filter -->
	<div class="flex flex-col sm:flex-row gap-3">
		<div class="flex gap-1 overflow-x-auto">
			{#each [{key:'pending',label:'Pending'},{key:'verified',label:'Verified'},{key:'rejected',label:'Rejected'},{key:'all',label:'All'}] as tab}
				<button aria-pressed={statusTab === tab.key} onclick={() => statusTab = tab.key as typeof statusTab} class="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap {statusTab === tab.key ? 'bg-essu-green text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}">{tab.label} ({tabCounts[tab.key as keyof typeof tabCounts]})</button>
			{/each}
		</div>
		<span class="inline-flex items-center self-center rounded-full text-xs px-2.5 py-1 font-medium bg-essu-green/10 text-essu-green border border-essu-green/20 whitespace-nowrap shrink-0">
			{filtered.length}{filtered.length !== students.length ? ` / ${students.length}` : ''} {pluralize(filtered.length !== students.length ? students.length : filtered.length, 'student')}
		</span>
		<div class="relative flex-1">
			<i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
			<input
				bind:value={search}
				type="text"
				placeholder="Search by name, ID, email, or program..."
				class="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
			/>
		</div>
		<select
			bind:value={filterType}
			class="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 bg-white text-gray-700"
		>
			<option value="">All Types</option>
			<option value="Enrolled">Enrolled</option>
			<option value="Former">Former</option>
			<option value="Alumni">Alumni</option>
		</select>
		{#if search || filterType}
			<button
				onclick={() => { search = ''; filterType = ''; }}
				class="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors whitespace-nowrap"
			>
				<i class="fa-solid fa-xmark mr-1"></i> Clear
			</button>
		{/if}
	</div>

	<!-- Table -->
	<div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
		{#if filtered.length === 0}
			<div class="p-16 text-center">
				<i class="fa-solid fa-users text-4xl text-gray-200 mb-4 block"></i>
				<p class="text-gray-500 text-sm">
					{search || filterType ? 'No students match your search.' : 'No students in this view. Choose All to see every account.'}
				</p>
			</div>
			<div class="flex justify-center pb-6"><Button variant="secondary" onclick={() => { search = ''; filterType = ''; statusTab = 'all'; }}>View all students</Button></div>
		{:else}
			<!-- Mobile card list -->
			<div class="xl:hidden divide-y divide-gray-100">
				{#each filtered as s}
					<div class="p-4 space-y-2">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="font-medium text-gray-800 text-sm">{@html highlight(fullName(s), search.trim())}</p>
								<p class="text-xs text-gray-400 mt-0.5">{@html highlight(s.email, search.trim())}</p>
							</div>
							<div class="flex flex-wrap items-center gap-1.5 shrink-0">
								<StatusChip value={s.id_status} kind="id" />
								<StatusChip value={s.verified} kind="email" />
								{#if s.student_type}
									<span class="inline-flex items-center rounded-full text-xs px-2 py-0.5 font-medium {typeColors[s.student_type] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}">
										{s.student_type}
									</span>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-3 text-xs text-gray-500">
							<span class="font-mono">{@html highlight(s.student_id, search.trim())}</span>
							<span class="program-value" title={s.program ?? ''}>{@html highlight(s.program, search.trim())}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-xs text-gray-400">{new Date(s.date_registered).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}</span>
							<div class="row-actions flex flex-nowrap items-center gap-2"><Button size="sm" onclick={() => void openReview(s)}>{s.id_status === 'verified' ? 'View' : 'Review'}</Button><RowMenu items={rowItems(s)} label={'Actions for ' + fullName(s)} /></div>
						</div>
					</div>
				{/each}
			</div>
			<!-- Desktop table -->
			<div class="hidden xl:block overflow-x-auto">
				<table class="student-list-table w-full min-w-[1040px] text-sm">
					<thead>
						<tr class="bg-gray-50 border-b border-gray-100">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Student ID</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Program</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap min-w-[72px]">Last S.Y.</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[104px]">Email</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[112px]">ID Status</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Registered</th>
							<th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-50">
						{#each filtered as s}
							<tr class="hover:bg-gray-50 transition-colors">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-800">{@html highlight(fullName(s), search.trim())}</p>
									<p class="text-xs text-gray-400 mt-0.5">{@html highlight(s.email, search.trim())}</p>
								</td>
								<td class="px-4 py-3">
									<span class="font-mono text-xs text-gray-500">{@html highlight(s.student_id, search.trim())}</span>
								</td>
								<td class="px-4 py-3 max-w-[140px]">
									<span class="program-value block text-gray-700" title={s.program ?? ''}>{@html highlight(s.program, search.trim())}</span>
								</td>
								<td class="px-4 py-3">
									{#if s.student_type}
										<span class="inline-flex items-center rounded-full text-xs px-2.5 py-1 font-medium {typeColors[s.student_type] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}">
											{s.student_type}
										</span>
									{:else}
										<span class="text-gray-400">—</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-gray-700">
									{s.last_school_year ?? '—'}
								</td>
								<td class="px-4 py-3">
									<StatusChip value={s.verified} kind="email" />
								</td>
								<td class="px-4 py-3"><StatusChip value={s.id_status} kind="id" /></td>
								<td class="px-4 py-3 text-gray-500 text-xs">
									{new Date(s.date_registered).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
								</td>
								<td class="px-4 py-3">
									<div class="row-actions flex flex-nowrap items-center gap-2"><Button size="sm" onclick={() => void openReview(s)}>{s.id_status === 'verified' ? 'View' : 'Review'}</Button><RowMenu items={rowItems(s)} label={'Actions for ' + fullName(s)} /></div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

{#if data.role === 'Admin'}<MasterlistModal open={masterlistOpen} onclose={() => masterlistOpen = false} />{/if}
<Modal open={!!reviewStudent} title={reviewStudent?.id_status === 'verified' ? 'View student ID' : 'Review student ID'} size="lg" onclose={() => { if (!reviewing && !rejecting) closeReview(); }}>
	{#snippet body()}
		{#if reviewStudent}
			{@const years = age(reviewStudent.date_of_birth)}
			<div class="space-y-4">
				{#if reviewLoading}<LoadingState label="Loading enrollment comparison…" />
				{:else if reviewStudent.masterlistMatch}
					{@const match = reviewStudent.masterlistMatch}
					<div role="status" class="rounded-lg border p-3 text-sm { !match.found ? 'border-red-200 bg-red-50 text-red-800' : differing.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-800'}">
						{!match.found ? 'Student ID not found in the masterlist' : differing.length ? 'Found, but some details differ' : 'Found in the Graduate School masterlist, all fields match'}
						{#if match.found && differing.length}<p class="mt-1 text-xs">Check: {differing.join(', ')}. Missing values require a manual check.</p>{/if}
					</div>
					<div class="overflow-x-auto"><table use:responsiveTable class="responsive-table w-full text-sm text-left"><thead><tr class="text-xs text-gray-500"><th class="p-2">Field</th><th class="p-2">Student account</th><th class="p-2">Masterlist</th></tr></thead><tbody>
						{#each ['name','program','campus'] as field}
							{@const state = match[field as 'name'|'program'|'campus']}
							<tr class="border-t border-gray-100"><th class="p-2 capitalize"><i aria-hidden="true" class="fa-solid {state === 'match' ? 'fa-check text-essu-green' : 'fa-triangle-exclamation text-amber-600'} mr-1"></i>{field}<span class="sr-only">: {state}</span></th><td class="p-2">{field === 'name' ? formatName(reviewStudent.first_name, reviewStudent.middle_name, reviewStudent.last_name) : field === 'program' ? reviewStudent.program ?? 'Not collected' : reviewStudent.campus ?? 'Not collected'}</td><td class="p-2">{field === 'name' ? formatName(match.values?.first_name, match.values?.middle_name, match.values?.last_name) || '-' : field === 'program' ? match.values?.program ?? '-' : match.values?.campus ?? '-'}</td></tr>
						{/each}
					</tbody></table></div>
				{/if}
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">For Former students and Alumni, check historical enrollment records. Absence from the current masterlist alone does not establish that an ID is invalid.</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="grid grid-cols-2 gap-3 text-sm">
					<div class="col-span-2"><p class="text-xs text-gray-400">Student ID</p><p class="font-mono text-2xl font-bold">{reviewStudent.student_id ?? '-'}</p></div>
					<div><p class="text-xs text-gray-400">Student type</p>{reviewStudent.student_type ?? '-'}</div><div><p class="text-xs text-gray-400">Last school year attended</p>{reviewStudent.last_school_year ?? '-'}</div>
					<div><p class="text-xs text-gray-400">Date of birth</p>{formatDate(reviewStudent.date_of_birth)}
						{#if years !== null}<p class="mt-1 text-xs text-gray-600">Age: {years}{#if years < 21}<span class="ml-2 text-amber-700">Check date of birth</span>{/if}</p>{/if}
					</div><div><p class="text-xs text-gray-400">Date registered</p>{formatDate(reviewStudent.date_registered)}</div>
					<div class="col-span-2"><p class="text-xs text-gray-400">Email</p>{reviewStudent.email}</div>
				</div>
				{#if data.role === 'Admin'}
					<div class="rounded-lg border border-gray-200 p-3 space-y-2">
						<p class="text-sm font-medium text-gray-700">School ID photo (front)</p>
						{#if reviewLoading}<p class="text-sm text-gray-500">Loading ID photo…</p>
						{:else if !reviewStudent.masterlistMatch}<p class="text-sm text-gray-500">ID photo details could not be loaded.</p>
						{:else if !reviewStudent.has_id_photo}<p class="text-sm text-gray-500">No ID photo uploaded</p>
						{:else}
							{#if reviewStudent.id_photo_url && !photoPreviewError}<img src={reviewStudent.id_photo_url} alt="Uploaded school ID front" class="max-h-64 w-full rounded-lg object-contain" onerror={() => photoPreviewError = true} />
							{:else}<p class="text-sm text-gray-500">ID photo preview expired or unavailable.</p>{/if}
							<p class="text-xs text-gray-500">Uploaded: {formatDate(reviewStudent.id_photo_uploaded_at ?? null)}</p>
							<button type="button" onclick={refreshIdPhoto} disabled={photoRefreshing || reviewing} class="text-xs text-essu-green hover:underline disabled:opacity-50">{photoRefreshing ? 'Loading…' : 'Refresh photo preview'}</button>
						{/if}
					</div>
				{/if}
				</div>
				{#if reviewStudent.id_status !== 'pending'}
					<div class="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm"><p class="font-medium capitalize">Decision: {reviewStudent.id_status}</p><p class="mt-1 text-xs text-gray-600">By {reviewStudent.id_verified_by_name ?? 'Not recorded'} on {formatDate(reviewStudent.id_verified_at)}</p>{#if reviewStudent.id_reject_reason}<p class="mt-2">Reason: {reviewStudent.id_reject_reason}</p>{/if}{#if reviewStudent.id_verification_note}<p class="mt-2">Review / verification note: {reviewStudent.id_verification_note}</p>{/if}</div>
				{/if}
				{#if reviewStudent.id_status !== 'verified' && data.role === 'Admin' && !reviewLoading && reviewStudent.masterlistMatch}
					{#if !reviewStudent.masterlistMatch.found}
						<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2"><label class="flex gap-2 text-sm text-amber-900"><input type="checkbox" bind:checked={verifyAnyway} class="accent-essu-green focus:ring-essu-green/30" />Verify anyway</label><label class="block text-sm text-gray-700">Short verification note (required)<textarea bind:value={overrideNote} maxlength="300" rows="2" class="mt-1 w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"></textarea></label></div>
					{/if}
				{/if}
				{#if reviewError}
					<p class="text-sm text-red-700" role="alert">{reviewError}</p>
					{#if !reviewLoading && !reviewStudent.masterlistMatch}
						<button type="button" onclick={() => { if (reviewStudent) void openReview(reviewStudent); }} class="text-sm text-essu-green hover:underline focus:outline-none focus:ring-2 focus:ring-essu-green/30">Try again</button>
					{/if}
				{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet footer()}
		<button onclick={closeReview} disabled={reviewing} class="px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-essu-green/30">Close</button>
		{#if data.role === 'Admin' && reviewStudent && !reviewLoading && reviewStudent.masterlistMatch}
			{#if reviewStudent.id_status !== 'verified'}
				<Button variant="danger" onclick={() => { reviewError = ''; rejecting = true; }} disabled={reviewing}>Reject</Button><Button onclick={() => void decideId('verify')} loading={reviewing} disabled={photoRefreshing || !reviewStudent.has_id_photo || !reviewStudent.id_photo_url || photoPreviewError || (!reviewStudent.masterlistMatch.found && (!verifyAnyway || !overrideNote.trim()))} disabledReason={!reviewStudent.has_id_photo ? 'Upload a school ID photo first' : !reviewStudent.masterlistMatch.found && (!verifyAnyway || !overrideNote.trim()) ? 'Confirm the masterlist override and enter a note' : undefined}>Verify student</Button>
			{/if}
		{/if}
	{/snippet}
</Modal>

<!-- Edit Modal -->
<Modal open={editOpen} title="Edit Student" size="md" onclose={() => { if (!saving) editOpen = false; }}>
	{#snippet body()}
		{#if editStudent}
			<form id="edit-student-form" onsubmit={handleEdit} class="space-y-4">
				{#if saveError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{saveError}
					</div>
				{/if}

				<!-- Name row 1: First, Middle -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">
							First Name <span class="text-red-500">*</span>
						</label>
						<input
							bind:value={editStudent.first_name}
							type="text"
							required
							class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">
							Middle Name <span class="text-xs text-gray-400 font-normal">(optional)</span>
						</label>
						<input
							bind:value={editStudent.middle_name}
							type="text"
							class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
						/>
					</div>
				</div>

				<!-- Name row 2: Last, Suffix -->
				<div class="grid grid-cols-3 gap-3">
					<div class="col-span-2">
						<label class="block text-sm font-medium text-gray-700 mb-1.5">
							Last Name <span class="text-red-500">*</span>
						</label>
						<input
							bind:value={editStudent.last_name}
							type="text"
							required
							class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">Suffix</label>
						<select
							bind:value={editStudent.suffix}
							class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 bg-white"
						>
							<option value={null}>None</option>
							<option value="Jr.">Jr.</option>
							<option value="Sr.">Sr.</option>
							<option value="II">II</option>
							<option value="III">III</option>
							<option value="IV">IV</option>
						</select>
					</div>
				</div>

				<!-- Student ID + Email -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">
							Student ID <span class="text-red-500">*</span>
						</label>
						<input
							bind:value={editStudent.student_id}
							type="text"
							required
							class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-essu-green/30"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">
							Email <span class="text-red-500">*</span>
						</label>
						<input
							bind:value={editStudent.email}
							type="email"
							required
							class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
						/>
					</div>
				</div>

				<!-- Program + Student Type -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">
							Program <span class="text-red-500">*</span>
						</label>
						<input
							bind:value={editStudent.program}
							type="text"
							placeholder="e.g. Master of IT"
							required
							class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
						/>
					</div>
					<div>
						<label for="edit-student-campus" class="block text-sm font-medium text-gray-700 mb-1.5">Campus</label>
						<select id="edit-student-campus" bind:value={editStudent.campus} class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30">
							<option value={null}>Not collected</option>
							{#each campuses as option}<option value={option.value}>{option.label}</option>{/each}
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">
							Student Type <span class="text-red-500">*</span>
						</label>
						<select
							bind:value={editStudent.student_type}
							required
							class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 bg-white"
						>
							<option value={null}>Select type</option>
							<option value="Enrolled">Currently Enrolled</option>
							<option value="Former">Former</option>
							<option value="Alumni">Alumni</option>
						</select>
					</div>
				</div>

				<!-- Last School Year -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">
						Last School Year <span class="text-red-500">*</span>
					</label>
					<input
						bind:value={editStudent.last_school_year}
						type="number"
						min={editStudent.student_type === 'Enrolled' ? ENROLLED_SCHOOL_YEAR_MIN : SCHOOL_YEAR_MIN}
						max={SCHOOL_YEAR_MAX}
						step="1"
						required
						class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
					/>
				</div>

				<!-- Verified toggle -->
				<div class="flex items-center justify-between px-3 py-3 bg-gray-50 rounded-lg border border-gray-100">
					<div>
						<p class="text-sm font-medium text-gray-700">Email Verified</p>
						<p class="text-xs text-gray-400 mt-0.5">Email verification is separate from student ID approval. Requests require office ID verification.</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							class="sr-only peer"
							checked={!!editStudent.verified}
							onchange={(e) => {
								if (editStudent) editStudent.verified = (e.target as HTMLInputElement).checked ? 1 : 0;
							}}
						/>
						<div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-essu-green/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-essu-green"></div>
					</label>
				</div>
			</form>
		{/if}
	{/snippet}
	{#snippet footer()}
		<Button variant="secondary" disabled={saving} onclick={() => (editOpen = false)}>Cancel</Button>
		<Button type="submit" form="edit-student-form" loading={saving}>Save changes</Button>
	{/snippet}
</Modal>

<ConfirmDialog open={deleteOpen} title="Delete student" message={'Delete ' + (deleteTarget ? fullName(deleteTarget) : 'this student') + '? This permanently removes their account.'} confirmLabel="Delete student" loading={deleting} error={deleteError} onclose={() => deleteOpen = false} onconfirm={() => void handleDelete()} />
<ConfirmDialog open={!!revokeTarget} title="Revoke verification" message={'Revoke student ID verification for ' + (revokeTarget ? fullName(revokeTarget) : 'this student') + '? The student will need another office review.'} requireReason minLength={10} confirmLabel="Revoke verification" loading={revokeSaving} error={revokeError} onclose={() => revokeTarget = null} onconfirm={confirmRevoke} />
<ConfirmDialog open={rejecting} title="Reject student ID" message={'Reject student ID verification for ' + (reviewStudent ? fullName(reviewStudent) : 'this student') + '?'} requireReason minLength={10} confirmLabel="Reject student ID" loading={reviewing} error={reviewError} onclose={() => rejecting = false} onconfirm={reason => { rejectReason = reason; void decideId('reject'); }} />
{/if}
