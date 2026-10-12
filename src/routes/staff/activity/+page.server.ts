import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';
import { activityActionLabels, activityFilters } from '$lib/server/activity-log';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { role } = await parent();
	if (role !== 'Admin') error(403, 'Admin access required');

	const filters = activityFilters(url.searchParams);
	const [countRows] = await pool.execute(
		`SELECT COUNT(*) AS total FROM activity_log WHERE ${filters.where}`,
		filters.args
	);
	const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);
	const requestedPage = Number(url.searchParams.get('page') ?? 1);
	const page = Number.isSafeInteger(requestedPage) && Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1;
	const pageSize = 25;
	const pages = Math.max(1, Math.ceil(total / pageSize));
	const currentPage = Math.min(page, pages);
	const calculatedOffset = (currentPage - 1) * pageSize;
	const offset = Number.isSafeInteger(calculatedOffset) && Number.isInteger(calculatedOffset) && calculatedOffset >= 0
		? calculatedOffset
		: 0;
	const [rows] = await pool.execute(
		`SELECT a.id, a.created_at, a.actor_user_id, a.actor_name, a.actor_role, a.action,
		        a.entity_type, a.entity_id, a.summary, a.details,
		        CASE
		          WHEN a.entity_type = 'request' THEN EXISTS(SELECT 1 FROM requests r WHERE r.request_id = a.entity_id)
		          WHEN a.entity_type = 'student' THEN EXISTS(SELECT 1 FROM users u WHERE u.user_id = a.entity_id AND u.role = 'Student')
		          ELSE FALSE
		        END AS entity_exists
		 FROM activity_log a
		 WHERE ${filters.where}
		 ORDER BY a.created_at DESC, a.id DESC
		 LIMIT ${pageSize} OFFSET ${offset}`,
		filters.args
	);
	const [peopleRows] = await pool.execute(
		'SELECT DISTINCT actor_user_id, actor_name, actor_role FROM activity_log ORDER BY actor_name, actor_user_id'
	);

	return {
		rows,
		total,
		page: currentPage,
		pages,
		pageSize,
		filters: {
			from: filters.from,
			to: filters.to,
			person: filters.person,
			role: filters.role,
			action: filters.action,
			search: filters.search
		},
		people: peopleRows,
		actionLabels: activityActionLabels
	};
};
