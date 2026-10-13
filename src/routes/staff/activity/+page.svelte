<script lang="ts">
	import { navigating, page as currentPage } from '$app/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	let filterForm: HTMLFormElement;
	let hideRoutineActivity = $state(true);
	const routineAction = 'notifications.read';
	const routineEntryCount = $derived(data.rows.filter(row => row.action === routineAction).length);
	const visibleRows = $derived(hideRoutineActivity
		? data.rows.filter(row => row.action !== routineAction)
		: data.rows);

	function activityUrl(pageNumber: number): string {
		const params = new URLSearchParams($currentPage.url.searchParams);
		if (pageNumber <= 1) params.delete('page');
		else params.set('page', String(pageNumber));
		return `/staff/activity${params.size ? `?${params.toString()}` : ''}`;
	}

	function exportUrl(): string {
		const params = new URLSearchParams($currentPage.url.searchParams);
		params.delete('page');
		return `/staff/activity/export.csv${params.size ? `?${params.toString()}` : ''}`;
	}

	function activityDate(value: string | Date): Date {
		if (value instanceof Date) return new Date(value.getTime());
		const normalized = value.trim().replace(' ', 'T');
		const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
		return new Date(hasTimezone ? normalized : `${normalized}Z`);
	}

	function localDate(value: string | Date): string {
		const date = activityDate(value);
		return Number.isNaN(date.getTime())
			? '—'
			: new Intl.DateTimeFormat('en-US', {
				month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila'
			}).format(date);
	}

	function localTime(value: string | Date): string {
		const date = activityDate(value);
		return Number.isNaN(date.getTime())
			? '—'
			: new Intl.DateTimeFormat('en-US', {
				hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila'
			}).format(date);
	}

	function filterDateLabel(value: string): string {
		const date = new Date(`${value}T00:00:00+08:00`);
		return Number.isNaN(date.getTime())
			? value
			: new Intl.DateTimeFormat('en-US', {
				month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila'
			}).format(date);
	}

	function requestHrefFromId(value: string): string | null {
		return /^REQ-\d{4}-\d{3}$/i.test(value)
			? `/staff/requests/${encodeURIComponent(value)}`
			: null;
	}

	type ActivityDetails = { changedFields?: unknown[]; ids?: unknown[] };
	function parsedDetails(value: unknown): ActivityDetails | null {
		let details = value;
		if (typeof details === 'string') {
			try { details = JSON.parse(details); }
			catch { return null; }
		}
		if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
		return details as ActivityDetails;
	}

	const fieldLabels: Record<string, string> = {
		verified: 'Email verification status',
		email: 'Email',
		password: 'Password',
		id_status: 'Student ID status',
		id_verified_at: 'ID verification date',
		id_reject_reason: 'ID rejection reason',
		id_verification_note: 'ID review note',
		id_photo_path: 'ID photo',
		id_photo_uploaded_at: 'ID photo upload date',
		id_photo: 'ID photo',
		'student account': 'Student account',
		requests: 'Requests',
		'request history': 'Request history',
		first_name: 'First name',
		middle_name: 'Middle name',
		last_name: 'Last name',
		suffix: 'Name suffix',
		date_of_birth: 'Date of birth',
		student_id: 'Student ID',
		program: 'Program',
		student_type: 'Student type',
		last_school_year: 'Last school year',
		campus: 'Campus',
		position: 'Position',
		role: 'Role',
		staff: 'Staff account',
		invitation: 'Invitation',
		requirements: 'Requirements',
		status: 'Status',
		document: 'Document',
		template: 'Template',
		form: 'Form',
		'form fields': 'Form fields',
		files: 'Files',
		'masterlist entry': 'Masterlist entry',
		'masterlist entries': 'Masterlist entries'
	};

	function readableField(value: unknown): string {
		const key = String(value);
		if (fieldLabels[key]) return fieldLabels[key];
		const words = key.split('_').join(' ');
		return words ? words[0].toUpperCase() + words.slice(1) : words;
	}

	function roleIcon(role: string): string {
		if (role === 'Admin') return 'fa-solid fa-shield-halved';
		if (role === 'Staff') return 'fa-solid fa-user-tie';
		return 'fa-solid fa-user-graduate';
	}

	function initials(name: string): string {
		const parts = name.trim().split(/\s+/).filter(Boolean);
		return parts.slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';
	}

	function actionCategory(action: string): string {
		if (action.startsWith('request.')) return 'request';
		if (action.startsWith('student.') || action.startsWith('masterlist.')) return action.startsWith('student.') ? 'student' : 'masterlist';
		if (action.startsWith('document.') || action.startsWith('form.')) return 'content';
		if (action.startsWith('staff.')) return 'staff';
		if (action.startsWith('account.')) return 'account';
		if (action.startsWith('notifications.')) return 'notification';
		return 'system';
	}

	function actionIcon(action: string): string {
		const category = actionCategory(action);
		const icons: Record<string, string> = {
			request: 'fa-solid fa-file-lines',
			student: 'fa-solid fa-user-graduate',
			masterlist: 'fa-solid fa-list-check',
			content: 'fa-solid fa-file-circle-check',
			staff: 'fa-solid fa-users-gear',
			account: 'fa-solid fa-user-gear',
			notification: 'fa-solid fa-bell',
			system: 'fa-solid fa-gear'
		};
		return icons[category];
	}

	function clearFilterUrl(...keys: string[]): string {
		const params = new URLSearchParams($currentPage.url.searchParams);
		for (const key of keys) params.delete(key);
		params.delete('page');
		return `/staff/activity${params.size ? `?${params.toString()}` : ''}`;
	}

	function containsWholeIdentifier(text: string, identifier: string): boolean {
		if (!identifier) return false;
		let position = text.indexOf(identifier);
		while (position !== -1) {
			const before = text[position - 1] ?? '';
			const after = text[position + identifier.length] ?? '';
			const isWord = (character: string) =>
				(character >= '0' && character <= '9') ||
				(character.toLowerCase() !== character.toUpperCase());
			if (!isWord(before) && !isWord(after)) return true;
			position = text.indexOf(identifier, position + 1);
		}
		return false;
	}

	function dateKey(date: Date): string {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
		}).formatToParts(date);
		const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
		return `${part('year')}-${part('month')}-${part('day')}`;
	}

	function shiftDateKey(value: string, offset: number): string {
		const [year, month, day] = value.split('-').map(Number);
		const date = new Date(Date.UTC(year, month - 1, day + offset));
		return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
	}

	function applyQuickRange(days: number) {
		const today = dateKey(new Date());
		(filterForm.elements.namedItem('from') as HTMLInputElement).value = shiftDateKey(today, 1 - days);
		(filterForm.elements.namedItem('to') as HTMLInputElement).value = today;
		filterForm.requestSubmit();
	}
</script>

<div class="activity-page space-y-5">
	<div class="activity-export">
		<a href={exportUrl()} class="inline-flex items-center gap-2 rounded-lg bg-essu-green px-4 py-2.5 text-sm font-medium text-white hover:bg-essu-green-mid focus:outline-none focus:ring-2 focus:ring-essu-green/30">
			<i class="fa-solid fa-file-csv" aria-hidden="true"></i> Export CSV
		</a>
	</div>

	<form bind:this={filterForm} method="GET" action="/staff/activity" class="activity-filter-form rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
		<label class="text-xs font-medium text-gray-600">From
			<input type="date" name="from" value={data.filters.from} class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
		</label>
		<label class="text-xs font-medium text-gray-600">To
			<input type="date" name="to" value={data.filters.to} class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
		</label>
		<label class="text-xs font-medium text-gray-600">Person
			<select name="person" value={data.filters.person} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-essu-green/30">
				<option value="">All people</option>
				{#each data.people as person}<option value={person.actor_user_id}>{person.actor_name} · {person.actor_role}</option>{/each}
			</select>
		</label>
		<label class="text-xs font-medium text-gray-600">Role
			<select name="role" value={data.filters.role} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-essu-green/30">
				<option value="">All roles</option><option value="Admin">Admin</option><option value="Staff">Staff</option><option value="Student">Student</option>
			</select>
		</label>
		<label class="text-xs font-medium text-gray-600">Action type
			<select name="action" value={data.filters.action} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-essu-green/30">
				<option value="">All actions</option>
				{#each Object.entries(data.actionLabels) as [action, label]}<option value={action}>{label}</option>{/each}
			</select>
		</label>
		<label class="text-xs font-medium text-gray-600">Search
			<input type="search" name="search" value={data.filters.search} placeholder="Search activity…" class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
		</label>
		<div class="activity-filter-actions">
			<div class="activity-quick-ranges" aria-label="Quick date ranges">
				<button type="button" onclick={() => applyQuickRange(1)}>Today</button>
				<button type="button" onclick={() => applyQuickRange(7)}>Last 7 days</button>
				<button type="button" onclick={() => applyQuickRange(30)}>Last 30 days</button>
			</div>
			<Button type="submit">Apply filters</Button>
			<a href="/staff/activity" class="activity-clear rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Clear filters</a>
		</div>
	</form>

	{#if data.filters.from || data.filters.to || data.filters.person || data.filters.role || data.filters.action || data.filters.search}
		<div class="activity-active-filters" aria-label="Active filters">
			{#if data.filters.from || data.filters.to}<a href={clearFilterUrl('from', 'to')} class="activity-filter-chip">Dates: {data.filters.from ? filterDateLabel(data.filters.from) : '—'} to {data.filters.to ? filterDateLabel(data.filters.to) : '—'}<span aria-hidden="true">×</span><span class="sr-only">Clear date range</span></a>{/if}
			{#if data.filters.person}<a href={clearFilterUrl('person')} class="activity-filter-chip">Person: {data.people.find(person => String(person.actor_user_id) === data.filters.person)?.actor_name ?? data.filters.person}<span aria-hidden="true">×</span><span class="sr-only">Clear person filter</span></a>{/if}
			{#if data.filters.role}<a href={clearFilterUrl('role')} class="activity-filter-chip">Role: {data.filters.role}<span aria-hidden="true">×</span><span class="sr-only">Clear role filter</span></a>{/if}
			{#if data.filters.action}<a href={clearFilterUrl('action')} class="activity-filter-chip">Action: {data.actionLabels[data.filters.action] ?? data.filters.action}<span aria-hidden="true">×</span><span class="sr-only">Clear action filter</span></a>{/if}
			{#if data.filters.search}<a href={clearFilterUrl('search')} class="activity-filter-chip">Search: {data.filters.search}<span aria-hidden="true">×</span><span class="sr-only">Clear search filter</span></a>{/if}
		</div>
	{/if}

	<div class="activity-routine-toggle">
		<label>
			<input type="checkbox" checked={hideRoutineActivity} onchange={event => hideRoutineActivity = event.currentTarget.checked} />
			<span>Hide routine activity</span>
		</label>
		<span>{routineEntryCount} routine {routineEntryCount === 1 ? 'entry' : 'entries'} {hideRoutineActivity ? 'hidden' : 'shown'}</span>
	</div>

	<p class="activity-result-count">
		Showing {data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1} to {Math.min(data.page * data.pageSize, data.total)} of {data.total} activities
	</p>

	<div class="activity-results rounded-xl border border-gray-100 bg-white shadow-sm">
		{#if $navigating}
			<div class="activity-skeleton" role="status" aria-label="Loading activities">
				{#each Array.from({ length: 5 }) as _}
					<div class="activity-skeleton-row">
						<Skeleton variant="text" lines={2} />
						<Skeleton variant="text" lines={2} />
						<Skeleton variant="text" lines={1} />
						<Skeleton variant="text" lines={2} />
					</div>
				{/each}
			</div>
		{:else if visibleRows.length}
			<div class="activity-table-wrap">
				<table class="admin-table admin-table--activity">
					<colgroup>
						<col class="activity-col-date" />
						<col class="activity-col-who" />
						<col class="activity-col-action" />
						<col class="activity-col-details" />
					</colgroup>
					<thead>
						<tr>
							<th scope="col">When</th>
							<th scope="col">Who</th>
							<th scope="col">Action</th>
							<th scope="col">Details</th>
						</tr>
					</thead>
					<tbody>
						{#each visibleRows as row (row.id)}
							{@const details = parsedDetails(row.details)}
							{@const summaryHasEntityId = !!row.entity_id && containsWholeIdentifier(row.summary, String(row.entity_id))}
							{@const isRequest = row.entity_type === 'request'}
							{@const entityHref = isRequest && row.entity_exists ? `/staff/requests/${encodeURIComponent(String(row.entity_id))}` : null}
							{@const friendlyFields = Array.isArray(details?.changedFields) ? details.changedFields.map(readableField) : []}
							{@const relatedIds = Array.isArray(details?.ids) ? details.ids.map(String).filter((id, index, ids) => id !== String(row.entity_id ?? '') && !containsWholeIdentifier(row.summary, id) && ids.indexOf(id) === index) : []}
							{@const extras = [...(friendlyFields.length ? [`Changed: ${friendlyFields.join(', ')}`] : []), ...(row.entity_id && !summaryHasEntityId && !isRequest && row.entity_type ? [`${row.entity_type} · ${row.entity_id}`] : []), ...(isRequest && row.entity_id && !summaryHasEntityId ? [`Request ${row.entity_id}`] : [])]}
							{@const isLowImportance = row.action === 'notifications.read'}
							<tr class:low-importance={isLowImportance}>
								<td class="activity-date" data-label="When">
									<span>{localDate(row.created_at)}</span>
									<time>{localTime(row.created_at)}</time>
								</td>
								<td class="activity-who" data-label="Who">
									<div class="activity-person">
										<span class="activity-avatar" aria-hidden="true">{initials(row.actor_name)}</span>
										<div class="activity-person-copy">
											<p>{row.actor_name}</p>
											<span class="activity-role role-{row.actor_role.toLowerCase()}"><i class={roleIcon(row.actor_role)} aria-hidden="true"></i>{row.actor_role}</span>
										</div>
									</div>
								</td>
								<td data-label="Action">
									<span class="activity-action action-{actionCategory(row.action)}"><i class={actionIcon(row.action)} aria-hidden="true"></i>{data.actionLabels[row.action] ?? row.action}</span>
								</td>
								<td class="activity-details" data-label="Details">
									{#if entityHref && summaryHasEntityId}<a href={entityHref} class="activity-summary">{row.summary}</a>
									{:else}<p class="activity-summary">{row.summary}</p>{/if}
									{#if extras.length}<p class="activity-details-meta">{#each extras as line, index}{#if index}<span aria-hidden="true"> · </span>{/if}{#if isRequest && row.entity_id && !summaryHasEntityId && line === `Request ${row.entity_id}` && entityHref}<a href={entityHref}>{line}</a>{:else}{line}{/if}{/each}</p>{/if}
									{#if relatedIds.length}<p class="activity-details-meta">Related IDs: {#each relatedIds as id, index}{#if index}<span aria-hidden="true">, </span>{/if}{#if requestHrefFromId(id)}<a href={requestHrefFromId(id)!}>{id}</a>{:else}{id}{/if}{/each}</p>{/if}
									{#if row.details}
										<details class="activity-technical">
											<summary>Technical details</summary>
											<pre>{typeof row.details === 'string' ? row.details : JSON.stringify(row.details, null, 2)}</pre>
										</details>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="activity-mobile-list">
				{#each visibleRows as row (row.id)}
					{@const details = parsedDetails(row.details)}
					{@const summaryHasEntityId = !!row.entity_id && containsWholeIdentifier(row.summary, String(row.entity_id))}
					{@const isRequest = row.entity_type === 'request'}
					{@const entityHref = isRequest && row.entity_exists ? `/staff/requests/${encodeURIComponent(String(row.entity_id))}` : null}
					{@const friendlyFields = Array.isArray(details?.changedFields) ? details.changedFields.map(readableField) : []}
					{@const relatedIds = Array.isArray(details?.ids) ? details.ids.map(String).filter((id, index, ids) => id !== String(row.entity_id ?? '') && !containsWholeIdentifier(row.summary, id) && ids.indexOf(id) === index) : []}
					{@const extras = [...(friendlyFields.length ? [`Changed: ${friendlyFields.join(', ')}`] : []), ...(row.entity_id && !summaryHasEntityId && !isRequest && row.entity_type ? [`${row.entity_type} · ${row.entity_id}`] : []), ...(isRequest && row.entity_id && !summaryHasEntityId ? [`Request ${row.entity_id}`] : [])]}
					<article class="activity-mobile-card" class:low-importance={row.action === 'notifications.read'}>
						<div class="activity-mobile-time"><span>{localDate(row.created_at)}</span><time>{localTime(row.created_at)}</time></div>
						<div class="activity-person">
							<span class="activity-avatar" aria-hidden="true">{initials(row.actor_name)}</span>
							<div class="activity-person-copy">
								<p>{row.actor_name}</p>
								<span class="activity-role role-{row.actor_role.toLowerCase()}"><i class={roleIcon(row.actor_role)} aria-hidden="true"></i>{row.actor_role}</span>
							</div>
						</div>
						<span class="activity-action action-{actionCategory(row.action)}"><i class={actionIcon(row.action)} aria-hidden="true"></i>{data.actionLabels[row.action] ?? row.action}</span>
						<div class="activity-details">
							{#if entityHref && summaryHasEntityId}<a href={entityHref} class="activity-summary">{row.summary}</a>
							{:else}<p class="activity-summary">{row.summary}</p>{/if}
							{#if extras.length}<p class="activity-details-meta">{#each extras as line, index}{#if index}<span aria-hidden="true"> · </span>{/if}{#if isRequest && row.entity_id && !summaryHasEntityId && line === `Request ${row.entity_id}` && entityHref}<a href={entityHref}>{line}</a>{:else}{line}{/if}{/each}</p>{/if}
							{#if relatedIds.length}<p class="activity-details-meta">Related IDs: {#each relatedIds as id, index}{#if index}<span aria-hidden="true">, </span>{/if}{#if requestHrefFromId(id)}<a href={requestHrefFromId(id)!}>{id}</a>{:else}{id}{/if}{/each}</p>{/if}
							{#if row.details}
								<details class="activity-technical">
									<summary>Technical details</summary>
									<pre>{typeof row.details === 'string' ? row.details : JSON.stringify(row.details, null, 2)}</pre>
								</details>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<div class="p-8 text-center">
				<EmptyState message="No activity for these filters" description="Try adjusting the date range or clearing filters." icon="fa-solid fa-clipboard-list" />
				<a href="/staff/activity" class="activity-empty-clear mt-3 inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Clear filters</a>
			</div>
		{/if}
	</div>
	{#if data.pages > 1}
		<nav aria-label="Activity log pages" class="activity-pagination">
			<a aria-disabled={data.page <= 1} href={activityUrl(data.page - 1)}>Previous</a>
			<span>Page {data.page} of {data.pages}</span>
			<a aria-disabled={data.page >= data.pages} href={activityUrl(data.page + 1)}>Next</a>
		</nav>
	{/if}
</div>

<style>
	.activity-page {
		position: relative;
		min-width: 0;
	}

	.activity-export {
		position: absolute;
		z-index: 2;
		top: -5.25rem;
		right: 0;
	}

	.activity-filter-form {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		align-items: end;
		gap: 12px;
		min-width: 0;
	}

	.activity-filter-form label {
		display: block;
		min-width: 0;
		color: #37483e;
		font-size: 13px;
		font-weight: 600;
	}

	.activity-filter-form input,
	.activity-filter-form select {
		display: block;
		box-sizing: border-box;
		height: 42px;
		min-height: 42px;
		width: 100%;
		margin-top: 4px;
		padding: 0 10px;
		border: 1px solid #d7e1da;
		border-radius: 8px;
		background: #fff;
		font: inherit;
		font-size: 13px;
	}

	.activity-filter-actions {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.activity-quick-ranges {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-right: auto;
	}

	.activity-quick-ranges button,
	.activity-clear,
	.activity-empty-clear {
		min-height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
	}

	.activity-quick-ranges button {
		padding: 0 10px;
		border: 1px solid #d5e1d9;
		background: #fff;
		color: #28583d;
		font-size: 13px;
		font-weight: 600;
	}

	.activity-filter-actions :global(button) {
		min-height: 40px;
	}

	.activity-active-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.activity-filter-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		max-width: 100%;
		padding: 5px 9px;
		border: 1px solid #d4e0d7;
		border-radius: 999px;
		background: #f4f8f5;
		color: #294b37;
		font-size: 12px;
		overflow-wrap: anywhere;
	}

	.activity-filter-chip span[aria-hidden='true'] {
		font-size: 16px;
		font-weight: 700;
		line-height: 1;
	}

	.activity-result-count {
		margin: 0;
		color: #4b5b51;
		font-size: 13px;
	}

	.activity-routine-toggle {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		color: #44564b;
		font-size: 13px;
	}

	.activity-routine-toggle label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		cursor: pointer;
	}

	.activity-routine-toggle input {
		width: 16px;
		height: 16px;
		accent-color: #176b3d;
	}

	.activity-routine-toggle > span {
		color: #4b5b51;
		font-size: 12px;
	}

	.activity-results {
		width: 100%;
		min-width: 0;
	}

	.activity-table-wrap {
		width: 100%;
		max-width: 100%;
		min-width: 0;
		overflow: visible !important;
	}

	:global(.staff-portal .portal-main table.admin-table--activity) {
		width: 100%;
		min-width: 0 !important;
		table-layout: fixed;
		border-collapse: separate;
		border-spacing: 0;
	}

	:global(.staff-portal .portal-main table.admin-table--activity col.activity-col-date) { width: 14% !important; }
	:global(.staff-portal .portal-main table.admin-table--activity col.activity-col-who) { width: 22% !important; }
	:global(.staff-portal .portal-main table.admin-table--activity col.activity-col-action) { width: 20% !important; }
	:global(.staff-portal .portal-main table.admin-table--activity col.activity-col-details) { width: 44% !important; }

	:global(.activity-table-wrap .admin-table--activity th) {
		position: sticky;
		top: 0;
		z-index: 2;
		border-bottom: 1px solid #e3ebe5;
		background: #f5f8f6;
		color: #33483d;
		font-size: 11px;
		white-space: normal;
	}

	:global(.activity-table-wrap .admin-table--activity th),
	:global(.activity-table-wrap .admin-table--activity td) {
		padding: 10px 8px;
		overflow-wrap: anywhere;
		vertical-align: middle;
	}

	:global(.activity-table-wrap .admin-table--activity tbody tr) {
		min-height: 64px;
		border-bottom: 1px solid #e8eee9;
	}

	:global(.activity-table-wrap .admin-table--activity tbody tr:hover) {
		background: #f7faf8;
	}

	:global(.activity-table-wrap .admin-table--activity tbody td) {
		min-height: 64px;
		color: #293a30;
		font-size: 13px;
	}

	:global(.activity-table-wrap .admin-table--activity tbody tr.low-importance td),
	.activity-mobile-card.low-importance {
		color: #536258;
		background-color: #fbfcfb;
	}

	:global(.activity-table-wrap .admin-table--activity tbody tr.low-importance .activity-summary),
	:global(.activity-table-wrap .admin-table--activity tbody tr.low-importance .activity-person-copy p),
	:global(.activity-table-wrap .admin-table--activity tbody tr.low-importance .activity-date),
	:global(.activity-table-wrap .admin-table--activity tbody tr.low-importance .activity-details-meta),
	.activity-mobile-card.low-importance .activity-summary,
	.activity-mobile-card.low-importance .activity-person-copy p,
	.activity-mobile-card.low-importance .activity-mobile-time,
	.activity-mobile-card.low-importance .activity-details-meta {
		color: #536258;
	}

	.activity-date {
		color: #293a30;
		font-size: 12px;
	}

	.activity-date span,
	.activity-date time,
	.activity-mobile-time span,
	.activity-mobile-time time {
		display: block;
		white-space: nowrap;
	}

	.activity-date time,
	.activity-mobile-time time {
		margin-top: 4px;
		color: #536258;
		font-size: 12px;
	}

	.activity-person {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 8px;
	}

	.activity-avatar {
		display: inline-flex;
		flex: 0 0 34px;
		width: 34px;
		height: 34px;
		align-items: center;
		justify-content: center;
		border: 1px solid #c8d8cd;
		border-radius: 50%;
		background: #eaf2ec;
		color: #244b33;
		font-size: 11px;
		font-weight: 700;
	}

	.activity-person-copy {
		display: grid;
		min-width: 0;
		gap: 5px;
	}

	.activity-person-copy p {
		margin: 0;
		color: #26372f;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.activity-role,
	.activity-action {
		display: inline-flex;
		width: fit-content;
		max-width: 100%;
		align-items: center;
		gap: 5px;
		border: 1px solid transparent;
		border-radius: 999px;
		padding: 4px 8px;
		font-size: 11px;
		font-weight: 600;
		line-height: 1.3;
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.activity-role i,
	.activity-action i {
		flex: 0 0 auto;
	}

	.role-admin { border-color: #ddd6fe; background: #f5f3ff; color: #5b21b6; }
	.role-staff { border-color: #bae6fd; background: #f0f9ff; color: #075985; }
	.role-student { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
	.activity-action { border-color: #d1d9d3; background: #f3f6f4; color: #37483e; }
	.action-request { border-color: #bfdbfe; background: #eff6ff; color: #1e40af; }
	.action-student { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
	.action-masterlist { border-color: #e9d5ff; background: #faf5ff; color: #6b21a8; }
	.action-content { border-color: #fed7aa; background: #fff7ed; color: #9a3412; }
	.action-staff { border-color: #bae6fd; background: #f0f9ff; color: #075985; }
	.action-account { border-color: #d1d5db; background: #f3f4f6; color: #374151; }
	.action-notification,
	.action-system { border-color: #d1d5db; background: #f3f4f6; color: #4b5563; }

	.activity-summary {
		display: block;
		margin: 0;
		color: #26372f;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.activity-details a.activity-summary,
	.activity-details-meta a {
		color: #155e3b;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.activity-details-meta {
		margin: 5px 0 0;
		color: #536258;
		font-size: 12px;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.activity-technical {
		margin-top: 7px;
		color: #46574c;
		font-size: 11px;
	}

	.activity-technical summary {
		width: fit-content;
		cursor: pointer;
		font-weight: 600;
	}

	.activity-technical pre {
		max-width: 100%;
		margin: 6px 0 0;
		overflow: auto;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		color: #37483e;
		font-size: 11px;
	}

	.activity-mobile-list {
		display: none;
	}

	.activity-skeleton {
		display: grid;
		gap: 0;
		padding: 0 12px;
	}

	.activity-skeleton-row {
		display: grid;
		grid-template-columns: 14% 22% 20% minmax(0, 1fr);
		align-items: center;
		gap: 8px;
		min-height: 64px;
		border-bottom: 1px solid #e8eee9;
	}

	.activity-pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: #44564b;
		font-size: 13px;
	}

	.activity-pagination a {
		display: inline-flex;
		min-height: 40px;
		align-items: center;
		justify-content: center;
		padding: 0 14px;
		border: 1px solid #d5e1d9;
		border-radius: 8px;
		background: #fff;
		color: #28583d;
		font-weight: 600;
		text-decoration: none;
	}

	.activity-pagination a[aria-disabled='true'] {
		pointer-events: none;
		color: #536258;
		background: #f3f5f3;
	}

	.activity-mobile-card {
		display: grid;
		gap: 12px;
		min-width: 0;
		padding: 16px;
		border-bottom: 1px solid #e8eee9;
	}

	.activity-mobile-time {
		color: #293a30;
		font-size: 12px;
	}

	:global(.activity-page :is(a, button, input, select, summary):focus-visible) {
		outline: 2px solid #176b3d;
		outline-offset: 2px;
		box-shadow: 0 0 0 3px rgb(23 107 61 / 18%);
	}

	@media (max-width: 1100px) {
		.activity-filter-form { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	}

	@media (max-width: 767px) {
		.activity-export {
			position: static;
			display: flex;
			justify-content: flex-end;
			margin-bottom: 12px;
		}

		.activity-filter-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.activity-table-wrap { display: none; }
		.activity-mobile-list { display: grid; }
		.activity-skeleton { padding: 0; }
		.activity-skeleton-row {
			grid-template-columns: minmax(0, 1fr);
			gap: 10px;
			padding: 14px 8px;
		}
	}

	@media (max-width: 480px) {
		.activity-filter-form { grid-template-columns: minmax(0, 1fr); }
		.activity-filter-actions { align-items: stretch; }
		.activity-quick-ranges { width: 100%; margin-right: 0; }
		.activity-quick-ranges button { flex: 1 1 auto; }
		.activity-filter-actions :global(button),
		.activity-clear { flex: 1 1 auto; }
		.activity-pagination { gap: 6px; }
		.activity-pagination a { padding-inline: 10px; }
	}
</style>
