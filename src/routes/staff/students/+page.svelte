<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type Student = {
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
	let reviewError = $state('');
	let reviewing = $state(false);
	const pendingCount = $derived(students.filter(s => s.id_status === 'pending').length);

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

	async function decideId(action: 'verify'|'reject') {
		if (!reviewStudent) return;
		reviewing = true; reviewError = '';
		try {
			const res = await fetch(`/api/students/${reviewStudent.user_id}/verify`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action, reason: rejectReason }) });
			const result = await res.json();
			if (!res.ok) { reviewError = result.error ?? 'Could not update verification.'; return; }
			students = students.map(s => s.user_id === reviewStudent!.user_id ? {...s, id_status: result.id_status, id_verified_at: result.id_verified_at, id_reject_reason: result.id_reject_reason} : s);
			reviewStudent = null; rejectReason = '';
		} catch { reviewError = 'Network error.'; } finally { reviewing = false; }
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
		deleteTarget = s;
		deleteError = '';
		deleteOpen = true;
	}

	async function handleEdit(e: Event) {
		e.preventDefault();
		if (!editStudent) return;
		saveError = '';
		saving = true;
		try {
			const res = await fetch('/api/students', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editStudent)
			});
			const result = await res.json();
			if (!res.ok) { saveError = result.error ?? 'Failed to save.'; return; }
			students = students.map((s) => (s.user_id === editStudent!.user_id ? { ...editStudent! } : s));
			editOpen = false;
		} catch {
			saveError = 'Network error.';
		} finally {
			saving = false;
		}
	}

	let deleteError = $state('');
	let deleting = $state(false);

	async function handleDelete() {
		if (!deleteTarget) return;
		deleting = true;
		deleteError = '';
		try {
			const res = await fetch('/api/students', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: deleteTarget.user_id })
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok) {
				deleteError = result.error ?? 'Could not delete this student.';
				return;
			}
			students = students.filter((s) => s.user_id !== deleteTarget!.user_id);
			deleteOpen = false;
		} catch {
			deleteError = 'Network error. Please try again.';
		} finally {
			deleting = false;
		}
	}

	function fullName(s: Student) {
		const parts = [s.first_name];
		if (s.middle_name) parts.push(s.middle_name[0] + '.');
		parts.push(s.last_name);
		if (s.suffix) parts.push(s.suffix);
		return parts.join(' ');
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
	<!-- Search / Filter -->
	<div class="flex flex-col sm:flex-row gap-3">
		<div class="flex gap-1 overflow-x-auto">
			{#each [{key:'pending',label:`Pending (${pendingCount})`},{key:'verified',label:'Verified'},{key:'rejected',label:'Rejected'},{key:'all',label:'All'}] as tab}
				<button onclick={() => statusTab = tab.key as typeof statusTab} class="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap {statusTab === tab.key ? 'bg-essu-green text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}">{tab.label}</button>
			{/each}
		</div>
		<span class="inline-flex items-center self-center rounded-full text-xs px-2.5 py-1 font-medium bg-essu-green/10 text-essu-green border border-essu-green/20 whitespace-nowrap shrink-0">
			{filtered.length}{filtered.length !== students.length ? ` / ${students.length}` : ''} students
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
					{search || filterType ? 'No students match your search.' : 'No students registered yet.'}
				</p>
			</div>
		{:else}
			<!-- Mobile card list -->
			<div class="md:hidden divide-y divide-gray-100">
				{#each filtered as s}
					<div class="p-4 space-y-2">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="font-medium text-gray-800 text-sm">{@html highlight(fullName(s), search.trim())}</p>
								<p class="text-xs text-gray-400 mt-0.5">{@html highlight(s.email, search.trim())}</p>
							</div>
							<div class="flex items-center gap-1.5 shrink-0">
								{#if s.verified}
									<span class="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
										<i class="fa-solid fa-circle-check"></i>
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 text-xs text-orange-500 font-medium">
										<i class="fa-solid fa-clock"></i>
									</span>
								{/if}
								{#if s.student_type}
									<span class="inline-flex items-center rounded-full text-xs px-2 py-0.5 font-medium {typeColors[s.student_type] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}">
										{s.student_type}
									</span>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-3 text-xs text-gray-500">
							<span class="font-mono">{@html highlight(s.student_id, search.trim())}</span>
							<span class="truncate">{@html highlight(s.program, search.trim())}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-xs text-gray-400">{new Date(s.date_registered).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
							<div class="flex items-center gap-1">
								<button onclick={() => openEdit(s)} class="p-1.5 text-gray-400 hover:text-essu-green transition-colors" title="Edit" aria-label={`Edit ${fullName(s)}`}>
									<i class="fa-solid fa-pen text-sm"></i>
								</button>
								<button onclick={() => openDelete(s)} class="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete" aria-label={`Delete ${fullName(s)}`}>
									<i class="fa-solid fa-trash text-sm"></i>
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
			<!-- Desktop table -->
			<div class="hidden md:block overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="bg-gray-50 border-b border-gray-100">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student ID</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Program</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last S.Y.</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID Status</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Registered</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
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
									<span class="program-value truncate block text-gray-700" title={s.program ?? ''}>{@html highlight(s.program, search.trim())}</span>
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
									{#if s.verified}<span class="text-xs text-green-700">Verified</span>{:else}<span class="text-xs text-amber-700">Pending</span>{/if}
								</td>
								<td class="px-4 py-3"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {s.id_status === 'verified' ? 'bg-green-100 text-green-700' : s.id_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}">{s.id_status}</span></td>
								<td class="px-4 py-3 text-gray-500 text-xs">
									{new Date(s.date_registered).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-1">
										<button onclick={() => { reviewStudent = s; reviewError = ''; rejectReason = ''; }} class="px-2 py-1 text-xs rounded-md border border-gray-200 text-essu-green hover:bg-gray-50">Review</button>
										<button
											onclick={() => openEdit(s)}
											class="p-1.5 text-gray-300 hover:text-essu-green transition-colors"
											title="Edit"
											aria-label={`Edit ${fullName(s)}`}
										>
											<i class="fa-solid fa-pen text-sm"></i>
										</button>
										<button
											onclick={() => openDelete(s)}
											class="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
											title="Delete"
											aria-label={`Delete ${fullName(s)}`}
										>
											<i class="fa-solid fa-trash text-sm"></i>
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<Modal open={!!reviewStudent} title="Review student ID" size="md" onclose={() => reviewStudent = null}>
	{#snippet body()}
		{#if reviewStudent}
			<div class="space-y-4">
				{#if students.some(s => s.user_id !== reviewStudent!.user_id && s.student_id === reviewStudent!.student_id)}<div class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Another account has the same student ID. Cross-check before deciding.</div>{/if}
				<div class="grid grid-cols-2 gap-3 text-sm">
					<div class="col-span-2"><p class="text-xs text-gray-400">Full name</p><p class="font-medium">{fullName(reviewStudent)}</p></div>
					<div class="col-span-2"><p class="text-xs text-gray-400">Student ID</p><p class="font-mono text-2xl font-bold tracking-wide">{reviewStudent.student_id ?? '—'}</p></div>
					<div><p class="text-xs text-gray-400">Program</p>{reviewStudent.program ?? '—'}</div><div><p class="text-xs text-gray-400">Student type</p>{reviewStudent.student_type ?? '—'}</div>
					<div><p class="text-xs text-gray-400">Last school year attended</p>{reviewStudent.last_school_year ?? '—'}</div><div><p class="text-xs text-gray-400">Date of birth</p>{reviewStudent.date_of_birth ?? '—'}</div>
					<div><p class="text-xs text-gray-400">Email</p>{reviewStudent.email}</div><div><p class="text-xs text-gray-400">Date registered</p>{reviewStudent.date_registered}</div>
				</div>
				{#if data.role === 'Admin'}<label class="block text-sm font-medium text-gray-700">Rejection reason<textarea bind:value={rejectReason} maxlength="300" rows="3" placeholder="Required when rejecting" class="mt-1 w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"></textarea></label>{/if}
				{#if reviewError}<p class="text-sm text-red-700" role="alert">{reviewError}</p>{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet footer()}
		<button onclick={() => reviewStudent = null} class="px-4 py-2 text-sm border rounded-lg">Close</button>
		{#if data.role === 'Admin'}<button onclick={() => decideId('reject')} disabled={reviewing || !rejectReason.trim()} class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50">Reject</button><button onclick={() => decideId('verify')} disabled={reviewing} class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg disabled:opacity-50">Verify student</button>{/if}
	{/snippet}
</Modal>

<!-- Edit Modal -->
<Modal open={editOpen} title="Edit Student" size="md" onclose={() => (editOpen = false)}>
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
						min="2000"
						max="2099"
						required
						class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
					/>
				</div>

				<!-- Verified toggle -->
				<div class="flex items-center justify-between px-3 py-3 bg-gray-50 rounded-lg border border-gray-100">
					<div>
						<p class="text-sm font-medium text-gray-700">Account Verified</p>
						<p class="text-xs text-gray-400 mt-0.5">Verified accounts can submit document requests.</p>
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
		<button
			onclick={() => (editOpen = false)}
			class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
		>
			Cancel
		</button>
		<button
			type="submit"
			form="edit-student-form"
			disabled={saving}
			class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2"
		>
			{#if saving}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
			Save Changes
		</button>
	{/snippet}
</Modal>

<!-- Delete Modal -->
<Modal open={deleteOpen} title="Delete Student" size="sm" onclose={() => (deleteOpen = false)}>
	{#snippet body()}
		{#if deleteTarget}
			<div class="flex items-start gap-4">
				<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
					<i class="fa-solid fa-triangle-exclamation text-red-500"></i>
				</div>
				<div>
					<p class="text-sm text-gray-700">
						Are you sure you want to delete
						<span class="font-semibold">{fullName(deleteTarget)}</span>?
						This will permanently remove their account and all associated requests.
						<span class="font-medium text-red-600">This cannot be undone.</span>
					</p>
				</div>
			</div>
			{#if deleteError}
				<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-start gap-2" role="alert">
					<i class="fa-solid fa-circle-exclamation shrink-0 mt-0.5"></i>
					<span>{deleteError}</span>
				</div>
			{/if}
		{/if}
	{/snippet}
	{#snippet footer()}
		<button
			onclick={() => (deleteOpen = false)}
			class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
		>
			Cancel
		</button>
		<button
			onclick={handleDelete}
			disabled={deleting}
			class="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center gap-2"
		>
			{#if deleting}
				<i class="fa-solid fa-circle-notch fa-spin text-xs"></i> Deleting...
			{:else}
				<i class="fa-solid fa-trash text-xs"></i> Delete
			{/if}
		</button>
	{/snippet}
</Modal>
{/if}
