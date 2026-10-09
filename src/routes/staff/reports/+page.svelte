<script lang="ts">
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type Row = { request_id: string; status: string; date_requested: string; document_name: string; items: Array<{document_id:number;name:string}> };
	type DocStat = { document_name: string; total: number; approved: number; rejected: number };
	type DateWindow = { start: Date | null; end: Date };
	type TrendBucket = { key: string; label: string; value: number };

	let timeRange = $state('all');
	let customStart = $state('');
	let customEnd = $state('');

	const now = new Date();
	const allRows = $derived(data.requests as Row[]);

	function startOfDay(date: Date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}

	function endOfDay(date: Date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
	}

	function dateWindow(range: string): DateWindow {
		const end = new Date();
		if (range === 'all') return { start: null, end };
		if (range === 'today') return { start: startOfDay(end), end };
		if (range === '7d') {
			const start = startOfDay(end);
			start.setDate(start.getDate() - 6);
			return { start, end };
		}
		if (range === '30d') {
			const start = startOfDay(end);
			start.setDate(start.getDate() - 29);
			return { start, end };
		}
		if (range === 'month') return { start: new Date(end.getFullYear(), end.getMonth(), 1), end };
		if (range === 'school-year') {
			const schoolYear = end.getMonth() >= 7 ? end.getFullYear() : end.getFullYear() - 1;
			return { start: new Date(schoolYear, 7, 1), end };
		}
		if (range === 'custom') {
			if (!customStart || !customEnd) return { start: new Date(Number.NaN), end };
			return {
				start: startOfDay(new Date(`${customStart}T00:00:00`)),
				end: endOfDay(new Date(`${customEnd}T00:00:00`))
			};
		}
		return { start: null, end };
	}

	function inWindow(row: Row, window: DateWindow) {
		const requestedAt = new Date(row.date_requested);
		return !isNaN(requestedAt.getTime()) && (!window.start || requestedAt >= window.start) && requestedAt <= window.end;
	}

	const selectedWindow = $derived(dateWindow(timeRange));
	const filtered = $derived(allRows.filter((row) => inWindow(row, selectedWindow)));
	const total = $derived(filtered.length);
	const pending = $derived(filtered.filter((row) => row.status === 'Pending').length);
	const approved = $derived(filtered.filter((row) => row.status === 'Approved').length);
	const rejected = $derived(filtered.filter((row) => row.status === 'Rejected').length);
	const correctionRequested = $derived(filtered.filter((row) => row.status === 'Correction Requested').length);
	const resolved = $derived(approved + rejected);
	const approvalRate = $derived(resolved ? (approved / resolved) * 100 : 0);
	const rejectionRate = $derived(resolved ? (rejected / resolved) * 100 : 0);

	const periodOptions = [
		{ value: 'today', label: 'Today' },
		{ value: '7d', label: 'Last 7 days' },
		{ value: '30d', label: 'Last 30 days' },
		{ value: 'month', label: 'This month' },
		{ value: 'school-year', label: 'This school year' },
		{ value: 'all', label: 'All time' },
		{ value: 'custom', label: 'Custom range' }
	];

	const periodLabel = $derived(
		timeRange === 'custom' && customStart && customEnd
			? `${new Date(`${customStart}T00:00:00`).toLocaleDateString()} – ${new Date(`${customEnd}T00:00:00`).toLocaleDateString()}`
			: periodOptions.find((option) => option.value === timeRange)?.label ?? 'All time'
	);

	const previousWindow = $derived.by((): DateWindow | null => {
		if (!selectedWindow.start) return null;
		const duration = selectedWindow.end.getTime() - selectedWindow.start.getTime();
		const end = new Date(selectedWindow.start.getTime() - 1);
		return { start: new Date(end.getTime() - duration), end };
	});
	const previousRows = $derived(previousWindow ? allRows.filter((row) => inWindow(row, previousWindow)) : []);
	const previousApproved = $derived(previousRows.filter((row) => row.status === 'Approved').length);
	const previousRejected = $derived(previousRows.filter((row) => row.status === 'Rejected').length);
	const previousResolved = $derived(previousApproved + previousRejected);
	const previousApprovalRate = $derived(previousResolved ? (previousApproved / previousResolved) * 100 : 0);

	function percentChange(current: number, previous: number): number | null {
		if (previous === 0) return current === 0 ? 0 : null;
		return ((current - previous) / previous) * 100;
	}

	function deltaLabel(current: number, previous: number, suffix = '') {
		const change = percentChange(current, previous);
		if (change === null) return 'No prior-period baseline';
		if (change === 0) return `No change vs previous period${suffix}`;
		return `${Math.abs(change).toFixed(0)}% ${change > 0 ? 'higher' : 'lower'} vs previous period${suffix}`;
	}

	const totalDelta = $derived(previousWindow ? percentChange(total, previousRows.length) : null);
	const pendingDelta = $derived(previousWindow ? percentChange(pending, previousRows.filter((row) => row.status === 'Pending').length) : null);
	const approvedDelta = $derived(previousWindow ? percentChange(approved, previousApproved) : null);
	const rejectedDelta = $derived(previousWindow ? percentChange(rejected, previousRejected) : null);
	const correctionDelta = $derived(previousWindow ? percentChange(correctionRequested, previousRows.filter((row) => row.status === 'Correction Requested').length) : null);
	const approvalRateDelta = $derived(previousWindow ? approvalRate - previousApprovalRate : null);

	function buildDocStats(rows: Row[]): DocStat[] {
		const counts = new Map<string, DocStat>();
		for (const row of rows) {
			for (const doc of row.items ?? []) {
				const item = counts.get(doc.name) ?? { document_name: doc.name, total: 0, approved: 0, rejected: 0 };
				item.total += 1;
				if (row.status === 'Approved') item.approved += 1;
				if (row.status === 'Rejected') item.rejected += 1;
				counts.set(doc.name, item);
			}
		}
		return [...counts.values()].sort((a, b) => b.total - a.total || a.document_name.localeCompare(b.document_name));
	}

	const docStats = $derived(buildDocStats(filtered));
	const topDocuments = $derived(docStats.slice(0, 5));
	const statusBreakdown = $derived([
		{ label: 'Approved', count: approved, color: '#28724d', share: total ? (approved / total) * 100 : 0 },
		{ label: 'Pending', count: pending, color: '#96600b', share: total ? (pending / total) * 100 : 0 },
		{ label: 'Rejected', count: rejected, color: '#a93e3b', share: total ? (rejected / total) * 100 : 0 },
		{ label: 'Correction Requested', count: correctionRequested, color: '#8b6811', share: total ? (correctionRequested / total) * 100 : 0 }
	]);
	const statusGradient = $derived.by(() => {
		let edge = 0;
		const stops = statusBreakdown.map((item) => {
			const start = edge;
			edge += item.share;
			return `${item.color} ${start}% ${edge}%`;
		});
		return `conic-gradient(${stops.join(', ')})`;
	});

	function bucketConfig(): { unit: 'day' | 'week' | 'month'; start: Date; end: Date } {
		const range = selectedWindow;
		let start = range.start ? new Date(range.start) : new Date(range.end.getFullYear(), range.end.getMonth() - 11, 1);
		const end = new Date(range.end);
		const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
		const unit = ['today', '7d', '30d'].includes(timeRange) || (timeRange === 'custom' && days <= 35)
			? 'day'
			: timeRange === 'custom' && days <= 150 ? 'week' : 'month';
		if (!range.start) start = new Date(range.end.getFullYear(), range.end.getMonth() - 11, 1);
		return { unit, start, end };
	}

	function bucketKey(date: Date, unit: 'day' | 'week' | 'month') {
		if (unit === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		if (unit === 'day') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		const monday = startOfDay(date);
		monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
		return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
	}

	function bucketLabel(date: Date, unit: 'day' | 'week' | 'month') {
		if (unit === 'month') return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
		if (unit === 'week') return `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	const trendBuckets = $derived.by((): TrendBucket[] => {
		const { unit, start, end } = bucketConfig();
		const counts = new Map<string, number>();
		for (const row of filtered) {
			const date = new Date(row.date_requested);
			if (!isNaN(date.getTime())) {
				const key = bucketKey(date, unit);
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}
		}
		const buckets: TrendBucket[] = [];
		const cursor = new Date(start);
		if (unit === 'week') cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
		else if (unit === 'month') cursor.setDate(1);
		let guard = 0;
		while (cursor <= end && guard < 400) {
			const key = bucketKey(cursor, unit);
			buckets.push({ key, label: bucketLabel(cursor, unit), value: counts.get(key) ?? 0 });
			if (unit === 'day') cursor.setDate(cursor.getDate() + 1);
			else if (unit === 'week') cursor.setDate(cursor.getDate() + 7);
			else cursor.setMonth(cursor.getMonth() + 1);
			guard += 1;
		}
		return buckets;
	});

	const trendMax = $derived(Math.max(1, ...trendBuckets.map((bucket) => bucket.value)));
	const trendTotal = $derived(trendBuckets.reduce((sum, bucket) => sum + bucket.value, 0));
	const trendPoints = $derived(trendBuckets.map((bucket, index) => {
		const x = trendBuckets.length > 1 ? (index / (trendBuckets.length - 1)) * 700 + 10 : 360;
		const y = 190 - (bucket.value / trendMax) * 160;
		return `${x},${y}`;
	}).join(' '));
	const trendBasePoints = $derived(`10,200 ${trendPoints} 710,200`);
	const recentRequests = $derived([...filtered].sort((a, b) => new Date(b.date_requested).getTime() - new Date(a.date_requested).getTime()).slice(0, 10));
	const staffName = $derived((($page.data.layoutUser as { name?: string } | undefined)?.name) ?? 'Staff');

	function formatDate(value: string) {
		const date = new Date(value);
		return isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function tryWiderPeriod() {
		timeRange = 'all';
	}

	function exportCsv() {
		const csvRows = [
			['Request ID', 'Document', 'Status', 'Date Requested'],
			...recentExportRows().map((row) => [row.request_id, row.document_name, row.status, row.date_requested])
		];
		const csv = csvRows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = `docuflow-requests-${timeRange}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function recentExportRows() {
		return [...filtered].sort((a, b) => new Date(b.date_requested).getTime() - new Date(a.date_requested).getTime());
	}

	const comparisonText = $derived(timeRange === 'all' ? 'Compared with previous period: unavailable' : 'Compared with previous period');
</script>

<svelte:head>
	<title>Reports &amp; Analytics | ESSU DocuFlow</title>
	<meta name="description" content="Overview of ESSU DocuFlow document requests." />
</svelte:head>

<div class="report-layout">
	<div class="report-print-meta" aria-hidden="true">
		<p class="report-print-title">ESSU DocuFlow · Reports &amp; Analytics</p>
		<p>{periodLabel} · Generated {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} · {staffName}</p>
	</div>

	<header class="report-page-header">
		<div>
			<p class="report-eyebrow">Registrar analytics</p>
			<h2>Reports &amp; Analytics</h2>
			<p class="report-subtitle">Counts refer to requests; one request can include several documents.</p>
		</div>
		<div class="report-heading-meta">
			<span class="report-period-chip"><i class="fa-regular fa-calendar" aria-hidden="true"></i>{periodLabel}</span>
			<div class="report-toolbar" aria-label="Report controls">
				<label class="sr-only" for="report-period">Report period</label>
				<select id="report-period" bind:value={timeRange}>
					{#each periodOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				{#if timeRange === 'custom'}
					<label class="sr-only" for="report-start">Start date</label>
					<input id="report-start" type="date" bind:value={customStart} />
					<label class="sr-only" for="report-end">End date</label>
					<input id="report-end" type="date" bind:value={customEnd} min={customStart} />
				{/if}
				<button class="report-control-button report-export" onclick={exportCsv} disabled={filtered.length === 0}>
					<i class="fa-solid fa-download" aria-hidden="true"></i> Export CSV
				</button>
				<button class="report-control-button report-print-button" onclick={() => window.print()}>
					<i class="fa-solid fa-print" aria-hidden="true"></i> Print
				</button>
			</div>
		</div>
	</header>

	{#if filtered.length === 0}
		<section class="report-empty-page" aria-live="polite">
			<EmptyState
				message={timeRange === 'custom' && (!customStart || !customEnd) ? 'Choose a custom date range' : 'No requests in this period'}
				description={timeRange === 'custom' && (!customStart || !customEnd) ? 'Select both a start date and an end date to view report activity.' : 'There are no document requests for the selected dates. Widen the period to see more activity.'}
				icon="fa-solid fa-chart-column"
			/>
			<button class="report-control-button report-export" onclick={tryWiderPeriod}>Try a wider period</button>
		</section>
	{:else}
		<section class="report-kpis" aria-label="Request key performance indicators">
			<article class="report-kpi report-kpi-total">
				<div class="report-kpi-icon"><i class="fa-solid fa-file-lines" aria-hidden="true"></i></div>
				<div class="report-kpi-copy"><p>Total Requests</p><strong>{total}</strong><span>{total ? '100% of selected requests' : 'No requests'}</span></div>
				{#if totalDelta !== null}<small class:positive={totalDelta <= 0} class:negative={totalDelta > 0} aria-label={deltaLabel(total, previousRows.length)}><i class="fa-solid {totalDelta > 0 ? 'fa-arrow-up' : totalDelta < 0 ? 'fa-arrow-down' : 'fa-minus'}" aria-hidden="true"></i>{Math.abs(totalDelta).toFixed(0)}%</small>{/if}
			</article>
			<article class="report-kpi report-kpi-pending">
				<div class="report-kpi-icon"><i class="fa-regular fa-clock" aria-hidden="true"></i></div>
				<div class="report-kpi-copy"><p>Pending</p><strong>{pending}</strong><span>{total ? `${((pending / total) * 100).toFixed(0)}% of total` : 'No requests'}</span></div>
				{#if pendingDelta !== null}<small class:positive={pendingDelta <= 0} class:negative={pendingDelta > 0} aria-label={deltaLabel(pending, previousRows.filter((row) => row.status === 'Pending').length)}><i class="fa-solid {pendingDelta > 0 ? 'fa-arrow-up' : pendingDelta < 0 ? 'fa-arrow-down' : 'fa-minus'}" aria-hidden="true"></i>{Math.abs(pendingDelta).toFixed(0)}%</small>{/if}
			</article>
			<article class="report-kpi report-kpi-approved">
				<div class="report-kpi-icon"><i class="fa-solid fa-circle-check" aria-hidden="true"></i></div>
				<div class="report-kpi-copy"><p>Approved</p><strong>{approved}</strong><span>{total ? `${((approved / total) * 100).toFixed(0)}% of total` : 'No requests'}</span></div>
				{#if approvedDelta !== null}<small class:positive={approvedDelta >= 0} class:negative={approvedDelta < 0} aria-label={deltaLabel(approved, previousApproved)}><i class="fa-solid {approvedDelta > 0 ? 'fa-arrow-up' : approvedDelta < 0 ? 'fa-arrow-down' : 'fa-minus'}" aria-hidden="true"></i>{Math.abs(approvedDelta).toFixed(0)}%</small>{/if}
			</article>
			<article class="report-kpi report-kpi-rejected">
				<div class="report-kpi-icon"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i></div>
				<div class="report-kpi-copy"><p>Rejected</p><strong>{rejected}</strong><span>{total ? `${((rejected / total) * 100).toFixed(0)}% of total` : 'No requests'}</span></div>
				{#if rejectedDelta !== null}<small class:positive={rejectedDelta <= 0} class:negative={rejectedDelta > 0} aria-label={deltaLabel(rejected, previousRejected)}><i class="fa-solid {rejectedDelta > 0 ? 'fa-arrow-up' : rejectedDelta < 0 ? 'fa-arrow-down' : 'fa-minus'}" aria-hidden="true"></i>{Math.abs(rejectedDelta).toFixed(0)}%</small>{/if}
			</article>
			<article class="report-kpi report-kpi-correction">
				<div class="report-kpi-icon"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></div>
				<div class="report-kpi-copy"><p>Correction Requested</p><strong>{correctionRequested}</strong><span>{total ? `${((correctionRequested / total) * 100).toFixed(0)}% of total` : 'No requests'}</span></div>
				{#if correctionDelta !== null}<small class:positive={correctionDelta <= 0} class:negative={correctionDelta > 0} aria-label={deltaLabel(correctionRequested, previousRows.filter((row) => row.status === 'Correction Requested').length)}><i class="fa-solid {correctionDelta > 0 ? 'fa-arrow-up' : correctionDelta < 0 ? 'fa-arrow-down' : 'fa-minus'}" aria-hidden="true"></i>{Math.abs(correctionDelta).toFixed(0)}%</small>{/if}
			</article>
			<article class="report-kpi report-kpi-rate">
				<div class="report-kpi-icon"><i class="fa-solid fa-chart-line" aria-hidden="true"></i></div>
				<div class="report-kpi-copy"><p>Approval Rate (resolved requests)</p><strong>{approvalRate.toFixed(0)}%</strong><span>{resolved} resolved · {rejectionRate.toFixed(0)}% rejected</span></div>
				{#if approvalRateDelta !== null}<small class:positive={approvalRateDelta >= 0} class:negative={approvalRateDelta < 0} aria-label={`${Math.abs(approvalRateDelta).toFixed(0)} percentage points vs previous period`}><i class="fa-solid {approvalRateDelta > 0 ? 'fa-arrow-up' : approvalRateDelta < 0 ? 'fa-arrow-down' : 'fa-minus'}" aria-hidden="true"></i>{Math.abs(approvalRateDelta).toFixed(0)} pts</small>{/if}
			</article>
		</section>

		<p class="report-comparison-note">{comparisonText}</p>

		<section class="report-grid report-grid-primary">
			<article class="report-card report-trend-card">
				<header class="report-card-header">
					<div><h3>Requests Over Time</h3><p>{timeRange === 'all' ? 'Monthly · last 12 months' : `${trendBuckets.length} ${bucketConfig().unit === 'day' ? 'daily' : bucketConfig().unit === 'week' ? 'weekly' : 'monthly'} intervals`}</p></div>
					<span class="report-chart-total">{trendTotal} requests</span>
				</header>
				{#if trendBuckets.length}
					<div class="report-trend-plot">
						<svg viewBox="0 0 720 220" preserveAspectRatio="none" role="img" aria-label={`Requests over time, with ${trendTotal} requests across ${trendBuckets.length} intervals`}>
							<line x1="10" y1="190" x2="710" y2="190" class="chart-axis" />
							<line x1="10" y1="110" x2="710" y2="110" class="chart-gridline" />
							<line x1="10" y1="30" x2="710" y2="30" class="chart-gridline" />
							<polygon points={trendBasePoints} class="chart-area" />
							<polyline points={trendPoints} class="chart-line" />
							{#each trendBuckets as bucket, index}
								{@const x = trendBuckets.length > 1 ? (index / (trendBuckets.length - 1)) * 700 + 10 : 360}
								{@const y = 190 - (bucket.value / trendMax) * 160}
								<circle cx={x} cy={y} r="3.5" class="chart-point"><title>{bucket.label}: {bucket.value} requests</title></circle>
							{/each}
						</svg>
					</div>
					<div class="report-trend-labels" aria-hidden="true">
						<span>{trendBuckets[0].label}</span><span>{trendBuckets[Math.floor((trendBuckets.length - 1) / 2)]?.label}</span><span>{trendBuckets.at(-1)?.label}</span>
					</div>
					<table class="sr-only"><caption>Request counts by {bucketConfig().unit}</caption><thead><tr><th>Period</th><th>Requests</th></tr></thead><tbody>{#each trendBuckets as bucket}<tr><td>{bucket.label}</td><td>{bucket.value}</td></tr>{/each}</tbody></table>
				{:else}
					<p class="report-chart-empty">No request dates are available for this period.</p>
				{/if}
			</article>

			<article class="report-card report-status-card">
				<header class="report-card-header"><div><h3>Status Breakdown</h3><p>Share of selected requests</p></div></header>
				<div class="report-donut-layout">
					<div class="report-donut" role="img" aria-label={`Status breakdown: ${statusBreakdown.map((status) => `${status.label} ${status.count}`).join(', ')}`} style={`background: ${statusGradient}`}>
						<div><strong>{total}</strong><span>Total</span></div>
					</div>
					<ul class="report-status-legend">
						{#each statusBreakdown as status}
							<li><span class="report-legend-key" style={`--legend-color:${status.color}`} aria-hidden="true"></span><span class="report-legend-name">{status.label}</span><strong>{status.count}</strong><small>{status.share.toFixed(0)}%</small></li>
						{/each}
					</ul>
				</div>
				<table class="sr-only"><caption>Status share in selected period</caption><thead><tr><th>Status</th><th>Count</th><th>Share</th></tr></thead><tbody>{#each statusBreakdown as status}<tr><td>{status.label}</td><td>{status.count}</td><td>{status.share.toFixed(0)}%</td></tr>{/each}</tbody></table>
			</article>
		</section>

		<section class="report-grid report-grid-secondary">
			<article class="report-card report-document-card">
				<header class="report-card-header"><div><h3>Requests by Document Type</h3><p>A request is counted once for each document type it contains.</p></div></header>
				{#if docStats.length}
					<div class="report-document-bars">
						{#each docStats as stat}
							<div class="report-document-row">
								<div class="report-document-label"><span title={stat.document_name}>{stat.document_name}</span><strong>{stat.total}</strong></div>
								<div class="report-document-track" role="img" aria-label={`${stat.document_name}: ${stat.total} requests, ${total ? ((stat.total / total) * 100).toFixed(0) : 0}% of total`}><span style={`width:${total ? (stat.total / total) * 100 : 0}%`}></span></div>
								<small>{total ? ((stat.total / total) * 100).toFixed(0) : 0}%</small>
							</div>
						{/each}
					</div>
				{:else}<p class="report-chart-empty">No document types in this period.</p>{/if}
			</article>

			<article class="report-card report-ranking-card">
				<header class="report-card-header"><div><h3>Top 5 Most Requested</h3><p>Most frequently requested documents</p></div></header>
				{#if topDocuments.length}
					<ol class="report-rank-list">
						{#each topDocuments as document, index}
							<li><span class="report-rank-number">{String(index + 1).padStart(2, '0')}</span><span class="report-rank-name" title={document.document_name}>{document.document_name}</span><strong>{document.total}</strong></li>
						{/each}
					</ol>
				{:else}<p class="report-chart-empty">No rankings available yet.</p>{/if}
			</article>
		</section>

		<section class="report-card report-recent-card">
			<header class="report-card-header"><div><h3>Recent Requests</h3><p>Latest requests in the selected period</p></div><span class="report-chart-total">{recentRequests.length} shown</span></header>
			{#if recentRequests.length}
				<div class="report-table-scroll">
					<table class="report-recent-table"><thead><tr><th>Student</th><th>Document</th><th>Status</th><th>Requested</th><th><span class="sr-only">Open request</span></th></tr></thead>
						<tbody>{#each recentRequests as row}<tr><td><span class="report-student-unavailable" title="Student name is not included in the current report data">Not provided</span><small>{row.request_id}</small></td><td>{row.document_name}</td><td><Badge value={row.status.toLowerCase()} size="sm" /></td><td>{formatDate(row.date_requested)}</td><td><a class="report-open-link" href={`/staff/requests/${row.request_id}`} aria-label={`Review request ${row.request_id}`}><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span>Review</span></a></td></tr>{/each}</tbody>
					</table>
				</div>
			{:else}<p class="report-chart-empty">No recent requests for this period.</p>{/if}
		</section>
	{/if}
</div>

<style>
	.report-layout {
		--report-border: #dfe8e2;
		--report-muted: #607168;
		--report-ink: #17251f;
		--report-green: #1f6b50;
		--report-surface: #fff;
		--report-shadow: 0 1px 2px rgb(19 49 37 / 0.04), 0 8px 24px rgb(19 49 37 / 0.045);
		color: var(--report-ink);
	}

	.report-page-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		margin: 0 0 1.4rem;
	}

	.report-eyebrow {
		margin: 0 0 0.25rem;
		color: #567366;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.report-page-header h2 {
		margin: 0;
		font-size: clamp(1.35rem, 2vw, 1.75rem);
		font-weight: 700;
		line-height: 1.2;
	}

	.report-subtitle,
	.report-card-header p {
		margin: 0.35rem 0 0;
		color: var(--report-muted);
		font-size: 0.8rem;
	}

	.report-heading-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.55rem;
	}

	.report-period-chip,
	.report-chart-total {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--report-border);
		border-radius: 999px;
		background: #f8fbf9;
		color: #385548;
		font-size: 0.7rem;
		font-weight: 650;
		padding: 0.38rem 0.7rem;
		white-space: nowrap;
	}

	.report-toolbar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.report-toolbar select,
	.report-toolbar input {
		min-height: 42px;
		border: 1px solid var(--report-border);
		border-radius: 0.65rem;
		background: #fff;
		color: var(--report-ink);
		font-size: 0.76rem;
		padding: 0.55rem 0.7rem;
	}

	.report-control-button {
		display: inline-flex;
		min-height: 42px;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: 1px solid var(--report-border);
		border-radius: 0.65rem;
		background: #fff;
		color: #344b40;
		font-size: 0.76rem;
		font-weight: 650;
		padding: 0.55rem 0.8rem;
		transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
	}

	.report-control-button:hover:not(:disabled) {
		transform: translateY(-1px);
		border-color: #9fbeaa;
		background: #f3f8f4;
	}

	.report-control-button:focus-visible,
	.report-toolbar select:focus-visible,
	.report-toolbar input:focus-visible,
	.report-open-link:focus-visible {
		outline: 3px solid rgb(43 128 96 / 0.28);
		outline-offset: 2px;
	}

	.report-control-button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.report-export {
		border-color: #1f6b50;
		background: #1f6b50;
		color: #fff;
	}

	.report-export:hover:not(:disabled) {
		border-color: #174f3e;
		background: #174f3e;
	}

	.report-print-meta { display: none; }

	.report-kpis {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.report-kpi {
		position: relative;
		display: flex;
		min-width: 0;
		min-height: 122px;
		align-items: flex-start;
		gap: 0.8rem;
		border: 1px solid var(--report-border);
		border-radius: 0.9rem;
		background: var(--report-surface);
		box-shadow: var(--report-shadow);
		padding: 1rem 1rem 0.9rem;
	}

	.report-kpi-icon {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 0.75rem;
		background: #e8f1eb;
		color: #216847;
	}

	.report-kpi-copy { min-width: 0; }
	.report-kpi-copy p { margin: 0; color: #596c61; font-size: 0.72rem; font-weight: 600; }
	.report-kpi-copy strong { display: block; margin-top: 0.12rem; color: var(--report-ink); font-size: 1.65rem; font-weight: 700; line-height: 1.15; font-variant-numeric: tabular-nums; }
	.report-kpi-copy span { display: block; margin-top: 0.35rem; color: #65766d; font-size: 0.66rem; }
	.report-kpi > small { position: absolute; right: 0.75rem; bottom: 0.72rem; display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.62rem; font-weight: 700; }
	.report-kpi > small.positive { color: #236746; }
	.report-kpi > small.negative { color: #a13c38; }
	.report-kpi-pending .report-kpi-icon { background: #f5ebd6; color: #80540e; }
	.report-kpi-approved .report-kpi-icon { background: #e0efe4; color: #28724d; }
	.report-kpi-rejected .report-kpi-icon { background: #f7e8e6; color: #a93e3b; }
	.report-kpi-correction .report-kpi-icon { background: #f5edd8; color: #806213; }
	.report-kpi-rate .report-kpi-icon { background: #e7eef1; color: #315f76; }

	.report-comparison-note { margin: 0.6rem 0 1.15rem; color: #75847c; font-size: 0.67rem; text-align: right; }

	.report-grid { display: grid; gap: 1rem; margin-bottom: 1rem; }
	.report-grid-primary { grid-template-columns: minmax(0, 2fr) minmax(290px, 1fr); }
	.report-grid-secondary { grid-template-columns: minmax(0, 1.55fr) minmax(270px, 1fr); }

	.report-card {
		min-width: 0;
		border: 1px solid var(--report-border);
		border-radius: 0.9rem;
		background: var(--report-surface);
		box-shadow: var(--report-shadow);
		padding: 1rem 1.1rem;
	}

	.report-card-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.8rem; }
	.report-card-header h3 { margin: 0; color: var(--report-ink); font-size: 0.91rem; font-weight: 700; }
	.report-chart-total { background: #f3f8f4; }

	.report-trend-plot { height: 205px; }
	.report-trend-plot svg { display: block; width: 100%; height: 100%; overflow: visible; }
	.chart-axis { stroke: #cfdcd3; stroke-width: 1; }
	.chart-gridline { stroke: #e6ede8; stroke-width: 1; stroke-dasharray: 4 6; }
	.chart-area { fill: rgb(43 128 96 / 0.11); }
	.chart-line { fill: none; stroke: #28724d; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
	.chart-point { fill: #fff; stroke: #28724d; stroke-width: 2; vector-effect: non-scaling-stroke; }
	.report-trend-labels { display: flex; justify-content: space-between; gap: 0.5rem; margin-top: 0.3rem; color: #687971; font-size: 0.64rem; }
	.report-chart-empty { margin: 0; border: 1px dashed var(--report-border); border-radius: 0.65rem; color: #66776e; font-size: 0.75rem; padding: 1.25rem; text-align: center; }

	.report-donut-layout { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 0.4rem 0; }
	.report-donut { display: grid; width: 150px; height: 150px; flex: 0 0 auto; place-items: center; border-radius: 50%; }
	.report-donut::before { width: 68%; height: 68%; border-radius: 50%; background: #fff; content: ''; grid-area: 1 / 1; }
	.report-donut > div { z-index: 1; display: flex; flex-direction: column; align-items: center; grid-area: 1 / 1; }
	.report-donut strong { color: var(--report-ink); font-size: 1.45rem; line-height: 1.2; }
	.report-donut span { color: #66776e; font-size: 0.65rem; }
	.report-status-legend { display: grid; min-width: 0; gap: 0.65rem; margin: 0; padding: 0; list-style: none; }
	.report-status-legend li { display: grid; grid-template-columns: 10px minmax(95px, 1fr) auto auto; align-items: center; gap: 0.45rem; color: #344b40; font-size: 0.67rem; }
	.report-legend-key { width: 9px; height: 9px; border-radius: 2px; background: var(--legend-color); }
	.report-legend-name { line-height: 1.3; }
	.report-status-legend strong { font-variant-numeric: tabular-nums; }
	.report-status-legend small { width: 2.4rem; color: #65766d; text-align: right; }

	.report-document-bars { display: grid; gap: 0.8rem; }
	.report-document-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(70px, 1.1fr) 2.4rem; align-items: center; gap: 0.75rem; }
	.report-document-label { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 0.6rem; color: #33483d; font-size: 0.72rem; }
	.report-document-label span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.report-document-label strong { flex: 0 0 auto; font-variant-numeric: tabular-nums; }
	.report-document-track { height: 9px; overflow: hidden; border-radius: 999px; background: #edf2ee; }
	.report-document-track span { display: block; height: 100%; border-radius: inherit; background: #2d7956; }
	.report-document-row > small { color: #65766d; font-size: 0.65rem; text-align: right; }
	.report-rank-list { display: grid; gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
	.report-rank-list li { display: grid; min-height: 45px; grid-template-columns: 2rem minmax(0, 1fr) auto; align-items: center; gap: 0.6rem; border-bottom: 1px solid #edf1ee; }
	.report-rank-list li:last-child { border-bottom: 0; }
	.report-rank-number { color: #78877f; font-size: 0.67rem; font-weight: 700; font-variant-numeric: tabular-nums; }
	.report-rank-name { overflow: hidden; color: #30473b; font-size: 0.72rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
	.report-rank-list strong { min-width: 2rem; border-radius: 999px; background: #edf5ef; color: #245f43; font-size: 0.67rem; padding: 0.2rem 0.5rem; text-align: center; }

	.report-recent-card { padding: 0; overflow: hidden; }
	.report-recent-card > .report-card-header { margin: 0; border-bottom: 1px solid var(--report-border); padding: 1rem 1.1rem; }
	.report-table-scroll { overflow-x: auto; }
	.report-recent-table { width: 100%; min-width: 680px; border-collapse: collapse; font-size: 0.74rem; }
	.report-recent-table th { position: sticky; top: 0; color: #5e7066; background: #f6f9f7; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.03em; padding: 0.72rem 1rem; text-align: left; text-transform: uppercase; }
	.report-recent-table td { border-top: 1px solid #edf1ee; color: #33483d; padding: 0.72rem 1rem; vertical-align: middle; }
	.report-recent-table tbody tr:hover { background: #f8fbf9; }
	.report-recent-table td:first-child { min-width: 145px; }
	.report-recent-table td:first-child small { display: block; margin-top: 0.14rem; color: #728078; font-family: ui-monospace, monospace; font-size: 0.63rem; }
	.report-student-unavailable { color: #65766d; font-size: 0.68rem; font-style: italic; }
	.report-open-link { display: inline-flex; min-height: 40px; align-items: center; gap: 0.4rem; color: #1f6b50; font-size: 0.68rem; font-weight: 700; text-decoration: none; }
	.report-open-link:hover { color: #174f3e; text-decoration: underline; }
	.report-empty-page { display: flex; min-height: 330px; flex-direction: column; align-items: center; justify-content: center; border: 1px solid var(--report-border); border-radius: 0.9rem; background: #fff; box-shadow: var(--report-shadow); padding: 1.5rem; }
	.report-empty-page :global(.ui-empty-state) { padding: 1.5rem 1rem 0.8rem; }
	.report-empty-page .report-control-button { margin-bottom: 1.3rem; }

	@media (max-width: 1100px) {
		.report-page-header { align-items: flex-start; flex-direction: column; }
		.report-heading-meta { width: 100%; align-items: flex-start; }
		.report-toolbar { justify-content: flex-start; }
		.report-grid-primary, .report-grid-secondary { grid-template-columns: minmax(0, 1fr); }
		.report-status-card .report-donut-layout { justify-content: flex-start; }
	}

	@media (max-width: 760px) {
		.report-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.report-toolbar { display: grid; width: 100%; grid-template-columns: 1fr 1fr; }
		.report-toolbar select { grid-column: 1 / -1; }
		.report-toolbar input { min-width: 0; width: 100%; }
		.report-control-button { min-height: 44px; }
	}

	@media (max-width: 480px) {
		.report-kpis { grid-template-columns: 1fr; }
		.report-kpi { min-height: 104px; }
		.report-page-header h2 { font-size: 1.35rem; }
		.report-donut-layout { align-items: flex-start; flex-direction: column; }
		.report-donut { width: 132px; height: 132px; align-self: center; }
		.report-status-legend { width: 100%; }
		.report-document-row { grid-template-columns: minmax(0, 1fr) 2.4rem; gap: 0.4rem 0.65rem; }
		.report-document-track { grid-column: 1 / 2; grid-row: 2; }
		.report-document-row > small { grid-column: 2; grid-row: 2; }
		.report-toolbar { grid-template-columns: 1fr; }
		.report-toolbar select { grid-column: auto; }
		.report-control-button { width: 100%; }
	}

	@media print {
		:global(body) { background: #fff !important; color: #111 !important; }
		:global(.portal-sidebar), :global(.portal-topbar), .report-toolbar, .report-period-chip, .report-comparison-note { display: none !important; }
		:global(.portal-main) { max-width: none !important; margin: 0 !important; padding: 0 !important; }
		.report-layout { color: #111; }
		.report-print-meta { display: block; margin-bottom: 1rem; border-bottom: 1px solid #888; padding-bottom: 0.5rem; }
		.report-print-meta p { margin: 0.2rem 0; color: #333; font-size: 9pt; }
		.report-print-title { font-size: 15pt !important; font-weight: 700; }
		.report-page-header { display: none; }
		.report-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.45rem; }
		.report-kpi, .report-card { break-inside: avoid; box-shadow: none; border-color: #aaa; }
		.report-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.55rem; }
		.report-grid-primary { grid-template-columns: 2fr 1fr; }
		.report-card { margin-bottom: 0.55rem; padding: 0.65rem; }
		.report-trend-plot { height: 150px; }
		.report-donut { width: 115px; height: 115px; }
		.report-recent-table { min-width: 0; font-size: 8pt; }
		.report-recent-table th, .report-recent-table td { padding: 0.35rem; }
		.report-open-link { color: #111; }
	}
</style>
