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

<div class="space-y-5">
	<div class="staff-page-actions flex justify-end">
		<a href={exportUrl()} class="inline-flex items-center gap-2 rounded-lg bg-essu-green px-4 py-2.5 text-sm font-medium text-white hover:bg-essu-green-mid focus:outline-none focus:ring-2 focus:ring-essu-green/30">
			<i class="fa-solid fa-file-csv" aria-hidden="true"></i> Export CSV
		</a>
	</div>

	<form method="GET" action="/staff/activity" class="staff-filter-bar grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-6">
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
		<div class="flex items-end gap-2 sm:col-span-2 xl:col-span-6">
			<Button type="submit">Apply filters</Button>
			<a href="/staff/activity" class="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Clear filters</a>
			<p class="ml-auto pb-2 text-sm text-gray-500">{data.total} {data.total === 1 ? 'activity' : 'activities'}</p>
		</div>
	</form>

	<div class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
		{#if data.rows.length}
			<div class="overflow-x-auto">
				<table class="activity-log-table w-full min-w-[960px] text-left text-sm">
					<thead class="border-b border-gray-100 bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Date and time</th>
							<th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Who</th>
							<th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
							<th class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Details</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-50">
						{#each data.rows as row (row.id)}
							{@const href = entityHref(row)}
							<tr>
								<td class="whitespace-nowrap px-4 py-4 text-xs text-gray-500">{localDateTime(row.created_at)}</td>
								<td class="px-4 py-4">
									<p class="font-medium text-gray-800">{row.actor_name}</p>
									<span class="mt-1 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{row.actor_role}</span>
								</td>
								<td class="px-4 py-4 font-medium text-gray-700">{data.actionLabels[row.action] ?? row.action}</td>
								<td class="px-4 py-4">
									{#if href}<a href={href} class="font-medium text-essu-green hover:underline">{row.summary}</a>{:else}<p class="font-medium text-gray-800">{row.summary}</p>{/if}
									{#if detailText(row.details)}<p class="mt-1 text-xs text-gray-500">{detailText(row.details)}</p>{/if}
									{#if row.entity_type && row.entity_id}<p class="mt-1 text-xs text-gray-400">{row.entity_type} · {row.entity_id}</p>{/if}
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
