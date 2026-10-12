<script lang="ts">
	import { formatName, pluralize } from '$lib/formatting';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import TextField from '$lib/components/forms/TextField.svelte';
	import { showToast } from '$lib/stores/toasts';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type StaffMember = {
		user_id: number;
		first_name: string;
		middle_name: string | null;
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
			if (!res.ok) { editError = result.error ?? 'Failed to save.'; showToast(editError, 'error'); return; }
			staffList = staffList.map(m => m.user_id === editMember!.user_id ? { ...editMember! } : m);
			editOpen = false; showToast('Staff details updated.');
		} catch {
			editError = 'Network error.'; showToast(editError, 'error');
		} finally {
			editSaving = false;
		}
	}

	// Delete
	let deleteOpen = $state(false), deleting = $state(false), deleteError = $state('');
	let deleteTarget = $state<StaffMember | null>(null);

	function openDelete(m: StaffMember) {
		if (m.user_id === currentUserId) return;
		deleteError = ''; deleteTarget = m;
		deleteOpen = true;
	}

	async function handleDelete() {
		if (!deleteTarget || deleting) return; deleting = true; deleteError = ''; const target = deleteTarget;
		try {
			const response = await fetch('/api/staff', {method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({user_id: target.user_id})});
			const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Could not delete staff member.');
			staffList = staffList.filter(member => member.user_id !== target.user_id); deleteOpen = false; showToast('Staff member deleted.');
		} catch (error) { deleteError = (error as Error).message; showToast(deleteError, 'error'); } finally { deleting = false; }
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
			if (!res.ok) { inviteError = result.error ?? 'Failed to send invitation.'; showToast(inviteError, 'error'); return; }
			inviteSuccess = true; showToast('Invitation sent.');
		} catch {
			inviteError = 'Network error. Please try again.'; showToast(inviteError, 'error');
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
	<div class="staff-page-actions flex items-center justify-between">
		<span class="inline-flex items-center rounded-full text-xs px-2.5 py-1 font-medium bg-essu-green/10 text-essu-green border border-essu-green/20">
			{staffList.length} {pluralize(staffList.length, 'member')}
		</span>
		<Button onclick={openInvite} icon="fa-solid fa-paper-plane">Invite staff</Button>
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
					<article class="p-4 flex flex-wrap items-center gap-3">
						<div class="w-10 h-10 rounded-xl bg-essu-green/10 text-essu-green flex items-center justify-center text-sm font-bold shrink-0">
							{member.first_name[0]}{member.last_name[0]}
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<p class="font-medium text-gray-800 text-sm">{formatName(member.first_name, member.middle_name, member.last_name)}</p>
								<span class="inline-flex items-center rounded-full text-xs px-2 py-0.5 font-medium {roleColors[member.role] ?? 'bg-gray-100 text-gray-600'}">
									{member.role}
								</span>
							</div>
							<p class="text-xs text-gray-500 break-words">{member.email}</p>
							{#if member.position}
								<p class="text-xs text-gray-500 mt-0.5">{member.position}</p>
							{/if}
						</div>
						<div class="w-full border-t border-gray-100 pt-3">
						<p class="mb-3 text-xs text-gray-500">Joined {new Date(member.date_registered).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}</p>
						<div class="flex items-center gap-2">
						<Button variant="secondary" size="sm" onclick={() => openEdit(member)}>Edit</Button><RowMenu label={'Actions for ' + formatName(member.first_name, member.middle_name, member.last_name)} items={[{label: 'Delete', danger: true, disabled: member.user_id === currentUserId, reason: 'You cannot delete your own account', onselect: () => openDelete(member)}]} />
					</div>
						</div>
					</article>
				{/each}
			</div>
			<!-- Desktop table -->
			<div class="admin-table-wrap staff-table-wrap hidden md:block">
				<table class="admin-table admin-table--staff">
					<colgroup>
						<col class="staff-col-name" />
						<col class="staff-col-position" />
						<col class="staff-col-role" />
						<col class="staff-col-joined" />
						<col class="staff-col-actions" />
					</colgroup>
					<thead>
						<tr>
							<th scope="col">Name</th>
							<th scope="col">Position</th>
							<th scope="col">Role</th>
							<th scope="col">Joined</th>
							<th scope="col" class="actions-header">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each staffList as member}
							<tr>
								<td>
									<div class="flex items-center gap-3">
										<div class="w-8 h-8 rounded-lg bg-essu-green/10 text-essu-green flex items-center justify-center text-xs font-bold shrink-0">
											{member.first_name[0]}{member.last_name[0]}
										</div>
										<div>
											<p class="font-medium text-gray-800">{formatName(member.first_name, member.middle_name, member.last_name)}</p>
											<p class="staff-email text-xs text-gray-400">{member.email}</p>
										</div>
									</div>
								</td>
								<td class="staff-position">
									{#if member.position}
										{member.position}
									{:else}
										<span class="text-gray-400">—</span>
									{/if}
								</td>
								<td>
									<span class="inline-flex items-center rounded-full text-xs px-2.5 py-1 font-medium {roleColors[member.role] ?? 'bg-gray-100 text-gray-600'}">
										{member.role}
									</span>
								</td>
								<td class="staff-joined">
									{new Date(member.date_registered).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
								</td>
								<td class="actions-cell">
									<div class="action-buttons">
										<Button variant="secondary" size="sm" onclick={() => openEdit(member)}>Edit</Button><RowMenu label={'Actions for ' + formatName(member.first_name, member.middle_name, member.last_name)} items={[{label: 'Delete', danger: true, disabled: member.user_id === currentUserId, reason: 'You cannot delete your own account', onselect: () => openDelete(member)}]} />
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
<Modal open={editOpen} title="Edit Staff Member" size="sm" onclose={() => { if (!editSaving) editOpen = false; }}>
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
							<Button variant={editMember.role === r ? 'primary' : 'secondary'} disabled={editMember.user_id === currentUserId} disabledReason="You cannot change your own role" onclick={() => { if (editMember && editMember.user_id !== currentUserId) editMember.role = r as 'Staff' | 'Admin'; }}>{r}</Button>
						{/each}
					</div>
				</div>
			</form>
		{/if}
	{/snippet}
	{#snippet footer()}
		<Button variant="secondary" disabled={editSaving} onclick={() => (editOpen = false)}>Cancel</Button>
		<Button type="submit" form="edit-staff-form" loading={editSaving}>Save changes</Button>
	{/snippet}
</Modal>

<ConfirmDialog open={deleteOpen} title="Delete staff member" message={'Delete ' + (deleteTarget ? formatName(deleteTarget.first_name, deleteTarget.middle_name, deleteTarget.last_name) : 'this staff member') + '? This permanently removes their account.'} confirmLabel="Delete staff member" loading={deleting} error={deleteError} onclose={() => deleteOpen = false} onconfirm={() => void handleDelete()} />
<!-- Invite Modal -->
<Modal open={inviteOpen} title="Invite Staff Member" size="sm" onclose={() => { if (!inviting) inviteOpen = false; }}>
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

				<TextField label="Email address" bind:value={inviteEmail} type="email" required placeholder="staff@essu.edu.ph" error={inviteError} />

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
			<Button type="submit" form="invite-form" loading={inviting}>Send invitation</Button>
		{/if}
	{/snippet}
</Modal>
