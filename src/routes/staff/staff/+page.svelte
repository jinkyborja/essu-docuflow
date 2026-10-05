<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type StaffMember = {
		user_id: number;
		first_name: string;
		last_name: string;
		email: string;
		role: 'Staff' | 'Admin';
		position: string | null;
		date_registered: string;
	};

	let staffList = $state(data.staff as StaffMember[]);
	const currentUserId = data.currentUserId as number;

	let inviteOpen = $state(false);
	let inviteEmail = $state('');
	let inviteRole = $state<'Staff' | 'Admin'>('Staff');
	let inviting = $state(false);
	let inviteError = $state('');
	let inviteSuccess = $state(false);

	// Edit
	let editOpen = $state(false);
	let editMember = $state<StaffMember | null>(null);
	let editSaving = $state(false);
	let editError = $state('');

	function openEdit(m: StaffMember) {
		editMember = { ...m };
		editError = '';
		editOpen = true;
	}

	async function handleEdit(e: Event) {
		e.preventDefault();
		if (!editMember) return;
		editSaving = true;
		editError = '';
		try {
			const res = await fetch('/api/staff', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editMember)
			});
			const result = await res.json();
			if (!res.ok) { editError = result.error ?? 'Failed to save.'; return; }
			staffList = staffList.map(m => m.user_id === editMember!.user_id ? { ...editMember! } : m);
			editOpen = false;
		} catch {
			editError = 'Network error.';
		} finally {
			editSaving = false;
		}
	}

	// Delete
	let deleteOpen = $state(false);
	let deleteTarget = $state<StaffMember | null>(null);

	function openDelete(m: StaffMember) {
		deleteTarget = m;
		deleteOpen = true;
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		try {
			const res = await fetch('/api/staff', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: deleteTarget.user_id })
			});
			if (res.ok) {
				staffList = staffList.filter(m => m.user_id !== deleteTarget!.user_id);
				deleteOpen = false;
			}
		} catch {
			// silent
		}
	}

	function openInvite() {
		inviteEmail = '';
		inviteRole = 'Staff';
		inviteError = '';
		inviteSuccess = false;
		inviteOpen = true;
	}

	async function handleInvite(e: Event) {
		e.preventDefault();
		inviteError = '';
		inviting = true;
		try {
			const res = await fetch('/api/invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: inviteEmail, role: inviteRole })
			});
			const result = await res.json();
			if (!res.ok) { inviteError = result.error ?? 'Failed to send invitation.'; return; }
			inviteSuccess = true;
		} catch {
			inviteError = 'Network error. Please try again.';
		} finally {
			inviting = false;
		}
	}

	const roleColors: Record<string, string> = {
		Admin: 'bg-purple-100 text-purple-700 border border-purple-200',
		Staff: 'bg-blue-100 text-blue-700 border border-blue-200'
	};
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
	<!-- Header -->
	<div class="flex items-center justify-between">
		<span class="inline-flex items-center rounded-full text-xs px-2.5 py-1 font-medium bg-essu-green/10 text-essu-green border border-essu-green/20">
			{staffList.length} members
		</span>
		<button
			onclick={openInvite}
			class="flex items-center gap-2 px-4 py-2 bg-essu-green text-white text-sm rounded-lg font-medium hover:bg-essu-green-mid transition-colors"
		>
			<i class="fa-solid fa-paper-plane text-xs"></i>
			Invite Staff
		</button>
	</div>

	<!-- Table -->
	<div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
		{#if staffList.length === 0}
			<div class="p-16 text-center">
				<i class="fa-solid fa-user-tie text-4xl text-gray-200 mb-4 block"></i>
				<p class="text-gray-500 text-sm">No staff members yet. Invite someone to get started.</p>
			</div>
		{:else}
			<!-- Mobile card list -->
			<div class="md:hidden divide-y divide-gray-100">
				{#each staffList as member}
					<div class="p-4 flex items-center gap-3">
						<div class="w-10 h-10 rounded-xl bg-essu-green/10 text-essu-green flex items-center justify-center text-sm font-bold shrink-0">
							{member.first_name[0]}{member.last_name[0]}
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<p class="font-medium text-gray-800 text-sm">{member.first_name} {member.last_name}</p>
								<span class="inline-flex items-center rounded-full text-xs px-2 py-0.5 font-medium {roleColors[member.role] ?? 'bg-gray-100 text-gray-600'}">
									{member.role}
								</span>
							</div>
							<p class="text-xs text-gray-400 truncate">{member.email}</p>
							{#if member.position}
								<p class="text-xs text-gray-500 mt-0.5">{member.position}</p>
							{/if}
						</div>
						<div class="flex items-center gap-1 shrink-0">
						<p class="text-xs text-gray-400 mr-1">{new Date(member.date_registered).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
						<button onclick={() => openEdit(member)} class="p-1.5 text-gray-300 hover:text-essu-green transition-colors" title="Edit" aria-label={`Edit ${member.first_name} ${member.last_name}`}><i class="fa-solid fa-pen text-sm"></i></button>
						{#if member.user_id !== currentUserId}
							<button onclick={() => openDelete(member)} class="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="Delete" aria-label={`Delete ${member.first_name} ${member.last_name}`}><i class="fa-solid fa-trash text-sm"></i></button>
						{/if}
					</div>
					</div>
				{/each}
			</div>
			<!-- Desktop table -->
			<div class="hidden md:block overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="bg-gray-50 border-b border-gray-100">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Position</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
							<th class="px-4 py-3"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-50">
						{#each staffList as member}
							<tr class="hover:bg-gray-50 transition-colors">
								<td class="px-4 py-3">
									<div class="flex items-center gap-3">
										<div class="w-8 h-8 rounded-lg bg-essu-green/10 text-essu-green flex items-center justify-center text-xs font-bold shrink-0">
											{member.first_name[0]}{member.last_name[0]}
										</div>
										<div>
											<p class="font-medium text-gray-800">{member.first_name} {member.last_name}</p>
											<p class="text-xs text-gray-400">{member.email}</p>
										</div>
									</div>
								</td>
								<td class="px-4 py-3 text-gray-600">
									{#if member.position}
										{member.position}
									{:else}
										<span class="text-gray-400">—</span>
									{/if}
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex items-center rounded-full text-xs px-2.5 py-1 font-medium {roleColors[member.role] ?? 'bg-gray-100 text-gray-600'}">
										{member.role}
									</span>
								</td>
								<td class="px-4 py-3 text-gray-500 text-xs">
									{new Date(member.date_registered).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-1">
										<button onclick={() => openEdit(member)} class="p-1.5 text-gray-300 hover:text-essu-green transition-colors" title="Edit" aria-label={`Edit ${member.first_name} ${member.last_name}`}><i class="fa-solid fa-pen text-sm"></i></button>
										{#if member.user_id !== currentUserId}
											<button onclick={() => openDelete(member)} class="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="Delete" aria-label={`Delete ${member.first_name} ${member.last_name}`}><i class="fa-solid fa-trash text-sm"></i></button>
										{/if}
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
{/if}

<!-- Edit Modal -->
<Modal open={editOpen} title="Edit Staff Member" size="sm" onclose={() => (editOpen = false)}>
	{#snippet body()}
		{#if editMember}
			<form id="edit-staff-form" onsubmit={handleEdit} class="space-y-4">
				{#if editError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{editError}
					</div>
				{/if}
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">First Name <span class="text-red-500">*</span></label>
						<input bind:value={editMember.first_name} type="text" required class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1.5">Last Name <span class="text-red-500">*</span></label>
						<input bind:value={editMember.last_name} type="text" required class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Position</label>
					<input bind:value={editMember.position} type="text" placeholder="e.g. Registrar Staff" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">Role <span class="text-red-500">*</span></label>
					<div class="grid grid-cols-2 gap-3">
						{#each ['Staff', 'Admin'] as r}
							<button type="button" onclick={() => { if (editMember) editMember.role = r as 'Staff' | 'Admin'; }}
								class="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center
									{editMember.role === r ? 'border-essu-green bg-essu-green/5' : 'border-gray-200 hover:border-gray-300'}">
								<i class="fa-solid {r === 'Admin' ? 'fa-shield-halved' : 'fa-user-tie'} text-lg {editMember.role === r ? 'text-essu-green' : 'text-gray-400'}"></i>
								<span class="text-sm font-medium {editMember.role === r ? 'text-essu-green' : 'text-gray-600'}">{r}</span>
							</button>
						{/each}
					</div>
				</div>
			</form>
		{/if}
	{/snippet}
	{#snippet footer()}
		<button onclick={() => (editOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
		<button type="submit" form="edit-staff-form" disabled={editSaving} class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2">
			{#if editSaving}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
			Save Changes
		</button>
	{/snippet}
</Modal>

<!-- Delete Modal -->
<Modal open={deleteOpen} title="Delete Staff Member" size="sm" onclose={() => (deleteOpen = false)}>
	{#snippet body()}
		{#if deleteTarget}
			<div class="flex items-start gap-4">
				<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
					<i class="fa-solid fa-triangle-exclamation text-red-500"></i>
				</div>
				<p class="text-sm text-gray-700">
					Are you sure you want to delete
					<span class="font-semibold">{deleteTarget.first_name} {deleteTarget.last_name}</span>?
					This will permanently remove their account.
					<span class="font-medium text-red-600">This cannot be undone.</span>
				</p>
			</div>
		{/if}
	{/snippet}
	{#snippet footer()}
		<button onclick={() => (deleteOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
		<button onclick={handleDelete} class="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2">
			<i class="fa-solid fa-trash text-xs"></i> Delete
		</button>
	{/snippet}
</Modal>

<!-- Invite Modal -->
<Modal open={inviteOpen} title="Invite Staff Member" size="sm" onclose={() => (inviteOpen = false)}>
	{#snippet body()}
		{#if inviteSuccess}
			<div class="text-center py-4">
				<div class="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
					<i class="fa-solid fa-circle-check text-green-500 text-lg"></i>
				</div>
				<p class="font-medium text-gray-800">Invitation sent!</p>
				<p class="text-sm text-gray-500 mt-1">An invitation email has been sent to <span class="font-medium">{inviteEmail}</span>.</p>
			</div>
		{:else}
			<form id="invite-form" onsubmit={handleInvite} class="space-y-4">
				{#if inviteError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{inviteError}
					</div>
				{/if}

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Email Address <span class="text-red-500">*</span></label>
					<input
						bind:value={inviteEmail}
						type="email"
						required
						placeholder="staff@essu.edu.ph"
						class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
					/>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">Role <span class="text-red-500">*</span></label>
					<div class="grid grid-cols-2 gap-3">
						{#each ['Staff', 'Admin'] as r}
							<button
								type="button"
								onclick={() => (inviteRole = r as 'Staff' | 'Admin')}
								class="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center
									{inviteRole === r ? 'border-essu-green bg-essu-green/5' : 'border-gray-200 hover:border-gray-300'}"
							>
								<i class="fa-solid {r === 'Admin' ? 'fa-shield-halved' : 'fa-user-tie'} text-lg
									{inviteRole === r ? 'text-essu-green' : 'text-gray-400'}"></i>
								<span class="text-sm font-medium {inviteRole === r ? 'text-essu-green' : 'text-gray-600'}">{r}</span>
								<span class="text-xs text-gray-400 leading-tight">
									{r === 'Admin' ? 'Full access' : 'Limited access'}
								</span>
							</button>
						{/each}
					</div>
				</div>
			</form>
		{/if}
	{/snippet}
	{#snippet footer()}
		{#if inviteSuccess}
			<button
				onclick={() => (inviteOpen = false)}
				class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors"
			>
				Done
			</button>
		{:else}
			<button
				onclick={() => (inviteOpen = false)}
				class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
			>
				Cancel
			</button>
			<button
				type="submit"
				form="invite-form"
				disabled={inviting}
				class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2"
			>
				{#if inviting}<i class="fa-solid fa-circle-notch fa-spin text-xs"></i>{/if}
				Send Invitation
			</button>
		{/if}
	{/snippet}
</Modal>
