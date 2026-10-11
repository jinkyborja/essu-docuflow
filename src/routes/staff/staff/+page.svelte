<script lang="ts">
	import SelectField from '$lib/components/ui/SelectField.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import FormSection from '$lib/components/ui/FormSection.svelte';
	import FormActions from '$lib/components/ui/FormActions.svelte';
	import {validateForm} from '$lib/components/ui/form-validation';
	import { formatName, pluralize } from '$lib/formatting';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
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
<PageHeader title="Staff Management" description="Manage the people who support your Graduate School office.">{#snippet action()}<Button onclick={openInvite} icon="fa-solid fa-paper-plane">Invite staff</Button>{/snippet}</PageHeader><p class="text-xs text-gray-500">{staffList.length} {pluralize(staffList.length,'member')}</p>
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
											<p class="font-medium text-gray-800">{formatName(member.first_name, member.middle_name, member.last_name)}</p>
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
									{new Date(member.date_registered).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-1">
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
			<form use:validateForm id="edit-staff-form" onsubmit={handleEdit} class="space-y-4"><FormSection>
				{#if editError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{editError}
					</div>
				{/if}
				<div class="grid grid-cols-2 gap-3">
					<TextField label="First Name" bind:value={editMember.first_name} type="text" required />
					<TextField label="Last Name" bind:value={editMember.last_name} type="text" required />
				</div>
				<TextField label="Position" bind:value={editMember.position} type="text" placeholder="e.g. Registrar Staff" />
				<SelectField label="Role" bind:value={editMember.role} required disabled={editMember.user_id===currentUserId} helper={editMember.user_id===currentUserId ? 'You cannot change your own role':''}><option value="Staff">Staff</option><option value="Admin">Admin</option></SelectField>
			</FormSection></form>
		{/if}
	{/snippet}
	{#snippet footer()}<FormActions>
		<Button variant="secondary" disabled={editSaving} onclick={() => (editOpen = false)}>Cancel</Button>
		<Button type="submit" form="edit-staff-form" loading={editSaving}>Save changes</Button>
	</FormActions>{/snippet}
</Modal>

<ConfirmDialog open={deleteOpen} title="Delete staff member" message={'Delete ' + (deleteTarget ? formatName(deleteTarget.first_name, deleteTarget.middle_name, deleteTarget.last_name) : 'this staff member') + '? This permanently removes their account.'} confirmLabel="Delete staff member" loading={deleting} error={deleteError} onclose={() => deleteOpen = false} onconfirm={() => void handleDelete()} />
<!-- Invite Modal -->
<Modal open={inviteOpen} closeDisabled={inviting} title="Invite Staff Member" size="sm" onclose={() => { if (!inviting) inviteOpen = false; }}>
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
			<form use:validateForm id="invite-form" onsubmit={handleInvite} class="space-y-4"><FormSection>
				{#if inviteError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{inviteError}
					</div>
				{/if}

				<TextField label="Email Address" bind:value={inviteEmail} type="email" required placeholder="staff@essu.edu.ph" />

				<SelectField label="Role" bind:value={inviteRole} required><option value="Staff">Staff</option><option value="Admin">Admin</option></SelectField>
			</FormSection></form>
		{/if}
	{/snippet}
	{#snippet footer()}<FormActions>
		{#if inviteSuccess}
			<Button
				variant="secondary" onclick={() => (inviteOpen = false)}
				class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors"
			>
				Done
			</Button>
		{:else}
			<Button
				variant="secondary" onclick={() => (inviteOpen = false)}
				class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
			>
				Cancel
			</Button>
			<Button type="submit" form="invite-form" loading={inviting}>Send invitation</Button>
		{/if}
	</FormActions>{/snippet}
</Modal>
