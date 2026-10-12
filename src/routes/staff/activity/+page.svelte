<script lang="ts">
	import { page as currentPage } from '$app/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

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

	function localDateTime(value: string | Date): string {
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? '—'
			: date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
	}

	function detailText(value: unknown): string {
		let details: unknown = value;
		if (typeof details === 'string') {
			try { details = JSON.parse(details); }
			catch { return 'Details unavailable'; }
		}
		if (!details || typeof details !== 'object') return '';
		const record = details as { changedFields?: unknown; ids?: unknown };
		return [
			Array.isArray(record.changedFields) && record.changedFields.length ? `Changed: ${record.changedFields.join(', ')}` : '',
			Array.isArray(record.ids) && record.ids.length ? `Related IDs: ${record.ids.join(', ')}` : ''
		].filter(Boolean).join(' · ');
	}

	function entityHref(row: PageData['rows'][number]): string | null {
		if (!row.entity_exists) return null;
		if (row.entity_type === 'request') return `/staff/requests/${encodeURIComponent(String(row.entity_id))}`;
		if (row.entity_type === 'student') return `/staff/students?review=${encodeURIComponent(String(row.entity_id))}`;
		return null;
	}
</script>

<div class="activity-page space-y-5">
	<div class="activity-export">
		<a href={exportUrl()} class="inline-flex items-center gap-2 rounded-lg bg-essu-green px-4 py-2.5 text-sm font-medium text-white hover:bg-essu-green-mid focus:outline-none focus:ring-2 focus:ring-essu-green/30">
			<i class="fa-solid fa-file-csv" aria-hidden="true"></i> Export CSV
		</a>
	</div>

	<form method="GET" action="/staff/activity" class="activity-filter-form rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
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
			<p class="activity-count">{data.total} {data.total === 1 ? 'activity' : 'activities'}</p>
			<Button type="submit">Apply filters</Button>
			<a href="/staff/activity" class="activity-clear rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Clear filters</a>
		</div>
	</form>

	<div class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
		{#if data.rows.length}
			<div class="admin-table-wrap activity-table-wrap">
				<table class="admin-table admin-table--activity">
					<colgroup>
						<col class="activity-col-date" />
						<col class="activity-col-who" />
						<col class="activity-col-action" />
						<col class="activity-col-details" />
					</colgroup>
					<thead class="border-b border-gray-100 bg-gray-50">
						<tr>
							<th scope="col">Date and time</th>
							<th scope="col">Who</th>
							<th scope="col">Action</th>
							<th scope="col">Details</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-50">
						{#each data.rows as row (row.id)}
							{@const href = entityHref(row)}
							{@const detailLines = detailText(row.details).split(' · ')}
							<tr>
								<td class="activity-date" data-label="Date and time">
									<span>{new Date(row.created_at).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'Asia/Manila' })}</span>
									<time>{new Date(row.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}</time>
								</td>
								<td class="activity-who" data-label="Who">
									<p>{row.actor_name}</p>
									<span class="activity-role">{row.actor_role}</span>
								</td>
								<td data-label="Action">
									<span class="activity-action" class:submitted={row.action === 'request.submitted'} class:read={row.action === 'notifications.read'} class:approved={row.action === 'request.approved'} class:rejected={row.action === 'request.rejected'}>{data.actionLabels[row.action] ?? row.action}</span>
								</td>
								<td class="activity-details" data-label="Details">
									{#if href}<a href={href} class="activity-summary">{row.summary}</a>{:else}<p class="activity-summary">{row.summary}</p>{/if}
									{#if detailLines[0]}
										<div class="activity-details-meta">{#each detailLines as line}<p>{line}</p>{/each}</div>
									{/if}
									{#if row.entity_type && row.entity_id}<p class="activity-entity">{row.entity_type} · {row.entity_id}</p>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="p-8 text-center">
				<EmptyState message="No activity found" description="Try adjusting the date range or clearing filters." icon="fa-solid fa-clipboard-list" />
				<a href="/staff/activity" class="mt-3 inline-block text-sm font-medium text-essu-green hover:underline">Clear filters</a>
			</div>
		{/if}
	</div>
	{#if data.pages > 1}
		<nav aria-label="Activity log pages" class="flex items-center justify-between gap-3">
			<a aria-disabled={data.page <= 1} href={activityUrl(data.page - 1)} class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 aria-disabled:pointer-events-none aria-disabled:opacity-50">Previous</a>
			<p class="text-sm text-gray-500">Page {data.page} of {data.pages}</p>
			<a aria-disabled={data.page >= data.pages} href={activityUrl(data.page + 1)} class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 aria-disabled:pointer-events-none aria-disabled:opacity-50">Next</a>
		</nav>
	{/if}
</div>

	<style>
		.activity-page { position: relative; }
		.activity-export { position: absolute; z-index: 2; top: -5.25rem; right: 0; }
		.activity-filter-form {
			display: grid;
			grid-template-columns: repeat(6, minmax(0, 1fr));
			align-items: end;
			gap: 12px;
		}
		.activity-filter-form label { display: block; min-width: 0; }
		.activity-filter-form input,
		.activity-filter-form select {
			display: block;
			box-sizing: border-box;
			height: 40px;
			min-height: 40px;
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
			align-items: center;
			gap: 8px;
		}
		.activity-count { margin-right: auto; color: #607168; font-size: 13px; }
		.activity-filter-actions :global(button),
		.activity-clear { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; }
		.activity-table-wrap .activity-date,
		.activity-table-wrap .activity-who { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
		.activity-date { color: #33483d; font-size: 13px; }
		.activity-date time { color: #77857d; font-size: 12px; }
		.activity-who p { margin: 0; color: #26372f; font-size: 13px; font-weight: 600; }
		.activity-role,
		.activity-action { display: inline-flex; align-items: center; width: fit-content; border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 600; line-height: 1.25; }
		.activity-role { border: 1px solid #d5e4f7; background: #eff6ff; color: #285b9a; }
		.activity-action { border: 1px solid #dce4df; background: #f3f6f4; color: #53645b; }
		.activity-action.submitted { border-color: #bfdbfe; background: #eff6ff; color: #1d4ed8; }
		.activity-action.read { border-color: #e5e7eb; background: #f3f4f6; color: #4b5563; }
		.activity-action.approved { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; }
		.activity-action.rejected { border-color: #fecaca; background: #fef2f2; color: #b91c1c; }
		.activity-summary { display: block; margin: 0; color: #26372f; font-size: 13px; font-weight: 600; line-height: 1.45; }
		.activity-details a.activity-summary { color: #176447; text-decoration: none; }
		.activity-details a.activity-summary:hover { text-decoration: underline; }
		.activity-details-meta { display: grid; gap: 3px; margin-top: 5px; }
		.activity-details-meta p,
		.activity-entity { margin: 0; color: #77857d; font-size: 12px; line-height: 1.4; }
		.activity-entity { margin-top: 4px; }
		@media (max-width: 1100px) {
			.activity-filter-form { grid-template-columns: repeat(3, minmax(0, 1fr)); }
		}
		@media (max-width: 899px) {
			.activity-export { top: -5rem; }
			.activity-table-wrap { overflow: visible !important; }
			.activity-table-wrap .admin-table {
				display: block;
				width: 100%;
				min-width: 0 !important;
			}
			.activity-table-wrap .admin-table thead { display: none; }
			.activity-table-wrap .admin-table tbody { display: grid; gap: 12px; }
			.activity-table-wrap .admin-table tr {
				display: block;
				overflow: hidden;
				border: 1px solid #e3ebe5;
				border-radius: 12px;
				background: #fff;
				box-shadow: 0 1px 3px rgb(19 49 37 / 0.05);
			}
			.activity-table-wrap .admin-table td {
				display: grid;
				grid-template-columns: 110px minmax(0, 1fr);
				align-items: center;
				gap: 12px;
				padding: 10px 16px 10px 14px;
				text-align: left;
			}
			.activity-table-wrap .admin-table td::before {
				content: attr(data-label);
				color: #718078;
				font-size: 10px;
				font-weight: 700;
				letter-spacing: .05em;
				text-transform: uppercase;
			}
			.activity-table-wrap .admin-table td + td { border-top: 1px solid #edf1ee; }
			.activity-table-wrap .activity-date,
			.activity-table-wrap .activity-who { align-items: flex-start; }
			.activity-table-wrap .activity-details { align-items: start; }
		}
		@media (max-width: 767px) {
			.activity-export { position: static; display: flex; justify-content: flex-end; margin-bottom: 12px; }
			.activity-filter-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		}
		@media (max-width: 480px) {
			.activity-filter-form { grid-template-columns: minmax(0, 1fr); }
			.activity-filter-actions { flex-wrap: wrap; }
			.activity-count { flex-basis: 100%; }
		}
	</style>
