import { releaseWording } from '$lib/request-status';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { activityActionLabels, activityFilters } from '$lib/server/activity-log';

function csvCell(value: unknown): string {
	let text = value == null ? '' : String(value);
	if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
	return `"${text.replace(/"/g, '""')}"`;
}

function csvDate(value: unknown): string {
	const date = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(date.getTime())
		? ''
		: date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
}

export const GET: RequestHandler = async ({ cookies, url }) => {
	const token = cookies.get('session');
	if (!token) return new Response('Unauthorized', { status: 401 });
	try {
		const actor = await verifySession(token, JWT_SECRET);
		if (actor.role !== 'Admin') return new Response('Forbidden', { status: 403 });
	} catch {
		return new Response('Unauthorized', { status: 401 });
	}

	const filters = activityFilters(url.searchParams);
	const [rows] = await pool.execute(
		`SELECT created_at, actor_name, actor_role, action, entity_type, entity_id, summary, details
		 FROM activity_log
		 WHERE ${filters.where}
		 ORDER BY created_at DESC, id DESC
		 LIMIT 5000`,
		filters.args
	);
	const columns = ['Date and time', 'Who', 'Role', 'Action', 'Entity type', 'Entity ID', 'Summary', 'Details'];
	const lines = [columns.map(csvCell).join(',')];
	for (const row of rows as Array<Record<string, unknown>>) {
		let detailText = '';
		try {
			const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
			if (details && typeof details === 'object') {
				const value = details as { changedFields?: unknown; ids?: unknown };
				detailText = [
					Array.isArray(value.changedFields) ? `Changed fields: ${value.changedFields.join(', ')}` : '',
					Array.isArray(value.ids) ? `Related IDs: ${value.ids.join(', ')}` : ''
				].filter(Boolean).join('; ');
			}
		} catch (error) {
			console.error('Could not parse activity log details for CSV export:', error);
			detailText = 'Details unavailable';
		}
		lines.push([
			csvDate(row.created_at),
			row.actor_name,
			row.actor_role,
			activityActionLabels[String(row.action)] ?? row.action,
			row.entity_type,
			row.entity_id,
			releaseWording(String(row.summary)),
			detailText
		].map(csvCell).join(','));
	}
	return new Response(`\uFEFF${lines.join('\r\n')}`, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="activity-log.csv"',
			'Cache-Control': 'private, no-store'
		}
	});
};
