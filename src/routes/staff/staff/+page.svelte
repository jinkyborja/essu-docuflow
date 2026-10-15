<script lang="ts">
	import { deserialize } from '$app/forms';
	import { formatName, pluralize } from '$lib/formatting';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import RowMenu, { type RowMenuItem } from '$lib/components/ui/RowMenu.svelte';
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
	let editPosition = $state('');
	let editSaving = $state(false);
	let editError = $state('');

	function openEdit(m: StaffMember) {
		editMember = { ...m };
		editPosition = m.position ?? '';
		editError = '';
		editOpen = true;
	}

	async function handleEdit(e: Event) {
		e.preventDefault();
		if (!editMember) return;
		editSaving = true;
		editError = '';
		editMember.position = editPosition || null;
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
		if (m.role !== 'Staff' || m.user_id === currentUserId) return;
		deleteError = ''; deleteTarget = m;
		deleteOpen = true;
	}

	function staffMenuItems(member: StaffMember): RowMenuItem[] {
		const items: RowMenuItem[] = [
			{ label: 'Edit', icon: 'fa-solid fa-pen', onselect: () => openEdit(member) }
		];
		if (member.role === 'Staff' && member.user_id !== currentUserId) {
			items.push({ label: 'Delete staff', icon: 'fa-solid fa-trash', danger: true, onselect: () => openDelete(member) });
		}
		return items;
	}

	async function handleDelete() {
		if (!deleteTarget || deleting) return; deleting = true; deleteError = ''; const target = deleteTarget;
		try {
			const response = await fetch('?/delete', {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body: new URLSearchParams({ user_id: String(target.user_id) })
			});
			const result = deserialize(await response.text());
			if (result.type !== 'success') {
				const failureData = 'data' in result && typeof result.data === 'object' && result.data !== null
					? result.data as { deleteError?: unknown }
					: null;
				const message = typeof failureData?.deleteError === 'string'
					? failureData.deleteError
					: result.type === 'error' && result.error instanceof Error
						? result.error.message
						: 'Could not delete staff member.';
				throw new Error(message);
			}
			staffList = staffList.filter(member => member.user_id !== target.user_id); deleteOpen = false; showToast('Staff member deleted.');
			deleteTarget = null;
		} catch (error) {
			deleteError = error instanceof Error ? error.message : 'Could not delete staff member.';
		} finally { deleting = false; }
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
	function positionLabel(member: StaffMember) {
		const position = member.position?.trim();
		return position && position.toLocaleLowerCase() !== member.role.toLocaleLowerCase() ? position : '';
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
<div class="staff-management-page space-y-4">
	<div class="staff-page-actions flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
		<span class="inline-flex items-center rounded-full text-xs px-2.5 py-1 font-medium bg-essu-green/10 text-essu-green border border-essu-green/20">
			{staffList.length} {pluralize(staffList.length, 'member')}
		</span>
		<Button onclick={openInvite} icon="fa-solid fa-paper-plane">Invite staff</Button>
	</div>

	{#if staffList.length === 0}
		<div class="rounded-xl border border-gray-100 bg-white p-10 text-center shadow-sm">
				<i class="fa-solid fa-user-tie text-4xl text-gray-200 mb-4 block"></i>
				<p class="text-gray-500 text-sm">No staff members yet. Invite someone to get started.</p>
		</div>
	{:else}
		<div class="staff-card-grid">
			{#each staffList as member (member.user_id)}
				<article class="staff-member-card">
					<div class="staff-member-main">
						<div class="staff-avatar" aria-hidden="true">{member.first_name[0]}{member.last_name[0]}</div>
						<div class="staff-identity">
							<div class="staff-name-row">
								<h2 class="staff-name" title={formatName(member.first_name, member.middle_name, member.last_name)}>{formatName(member.first_name, member.middle_name, member.last_name)}</h2>
								<span class="staff-role {roleColors[member.role] ?? 'bg-gray-100 text-gray-600'}">{member.role}</span>
							</div>
							<p class="staff-email" title={member.email}>{member.email}</p>
							{#if positionLabel(member)}<p class="staff-position" title={positionLabel(member)}>{positionLabel(member)}</p>{/if}
						</div>
					</div>
					<div class="staff-card-footer">
						<p class="staff-joined"><i class="fa-regular fa-calendar" aria-hidden="true"></i>Joined {new Date(member.date_registered).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}</p>
						<RowMenu label={'Actions for ' + formatName(member.first_name, member.middle_name, member.last_name)} items={staffMenuItems(member)} />
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>
{/if}

<style>
	.staff-card-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
	}
	.staff-member-card {
		display: flex;
		min-width: 0;
		flex-direction: column;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		background: var(--color-surface);
		box-shadow: var(--shadow-sm, 0 1px 2px rgb(0 0 0 / 5%));
	}
	.staff-member-main {
		display: flex;
		min-width: 0;
		align-items: flex-start;
		gap: var(--space-3);
	}
	.staff-avatar {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		flex: 0 0 2.75rem;
		place-items: center;
		border-radius: var(--radius-control);
		background: var(--color-primary-soft);
		color: var(--color-primary);
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
	}
	.staff-identity { min-width: 0; flex: 1; }
	.staff-name-row { display: flex; min-width: 0; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
	.staff-name { min-width: 0; margin: 0; color: var(--color-text); font-size: var(--font-size-body); font-weight: var(--font-weight-semibold); line-height: 1.35; overflow-wrap: anywhere; }
	.staff-role { display: inline-flex; flex: 0 0 auto; align-items: center; border-radius: 999px; padding: 0.15rem 0.55rem; font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); }
	.staff-email, .staff-position { margin: var(--space-1) 0 0; font-size: var(--font-size-helper); line-height: 1.4; overflow-wrap: anywhere; }
	.staff-email { color: var(--color-text-muted); }
	.staff-position { color: var(--color-text); }
	.staff-card-footer { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--color-border); }
	.staff-joined { display: flex; min-width: 0; align-items: center; gap: var(--space-2); margin: 0; color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.staff-joined i { flex: 0 0 auto; }
	.staff-card-footer :global(.button-tooltip) { flex: 0 0 auto; }
	@media (min-width: 640px) {
		.staff-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
		.staff-member-card { min-height: 9.5rem; }
	}
	@media (min-width: 1024px) {
		.staff-card-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	}
</style>

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
				<TextField label="First Name" bind:value={editMember.first_name} required />
				<TextField label="Last Name" bind:value={editMember.last_name} required />
				<TextField label="Position" bind:value={editPosition} placeholder="e.g. Registrar Staff" />
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">Role <span class="text-red-500">*</span></label>
					<div class="grid grid-cols-2 gap-3">
						{#each ['Staff', 'Admin'] as r}
							<button
								type="button"
								disabled={editMember.user_id === currentUserId}
								aria-pressed={editMember.role === r}
								title={editMember.user_id === currentUserId ? 'You cannot change your own role' : undefined}
								onclick={() => { if (editMember && editMember.user_id !== currentUserId) editMember.role = r as 'Staff' | 'Admin'; }}
								class="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center disabled:cursor-not-allowed disabled:opacity-60
									{editMember.role === r ? 'border-essu-green bg-essu-green/5' : 'border-gray-200 hover:border-gray-300'}"
							>
								<i class="fa-solid {r === 'Admin' ? 'fa-shield-halved' : 'fa-user-tie'} text-lg
									{editMember.role === r ? 'text-essu-green' : 'text-gray-400'}"></i>
								<span class="text-sm font-medium {editMember.role === r ? 'text-essu-green' : 'text-gray-600'}">{r}</span>
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
		<Button variant="secondary" disabled={editSaving} onclick={() => (editOpen = false)}>Cancel</Button>
		<Button type="submit" form="edit-staff-form" loading={editSaving}>Save changes</Button>
	{/snippet}
</Modal>

<ConfirmDialog open={deleteOpen} title="Delete staff member" message={'Delete ' + (deleteTarget ? formatName(deleteTarget.first_name, deleteTarget.middle_name, deleteTarget.last_name) : 'this staff member') + '? This cannot be undone.'} confirmLabel="Delete" cancelLabel="Cancel" variant="danger" loading={deleting} error={deleteError} onclose={() => deleteOpen = false} onconfirm={() => void handleDelete()} />
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
