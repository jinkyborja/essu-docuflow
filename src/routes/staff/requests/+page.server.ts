import { formatName } from '$lib/formatting';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {attachRequestJourney} from '$lib/server/request-journey';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { fetchRequestItems, documentNameSummary } from '$lib/server/request-items';
import { timedLoad, timedQuery } from '$lib/server/timing';

export const load: PageServerLoad = ({ cookies, url }) => timedLoad('staff/requests', async () => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/login');
	let role = '';
	try {
		const p = (await verifySession(token, JWT_SECRET));
		if (p.role === 'Student') redirect(302, '/student/dashboard');
		role = p.role;
	} catch { redirect(302, '/login'); }

	const [rows] = await timedQuery('staff/requests:list', () => pool.execute(
		`SELECT r.request_id,
		        u.first_name, u.middle_name, u.last_name,
		        u.student_id AS student_code, u.program,
		        r.status, r.purpose, r.date_requested,
		        r.decided_by, r.decided_at,
		        TRIM(CONCAT_WS(' ', decider.first_name, decider.middle_name, decider.last_name, decider.suffix)) AS live_decider_name,
		        decider.role AS live_decider_role,
		        decision_log.id AS decision_log_id,
		        decision_log.actor_user_id AS logged_decider_id,
		        decision_log.actor_name AS logged_decider_name,
		        decision_log.actor_role AS logged_decider_role,
		        decision_log.action AS decision_action
		 FROM requests r
		 JOIN users u ON r.student_id = u.user_id
		 LEFT JOIN users decider ON decider.user_id = r.decided_by
		 LEFT JOIN activity_log decision_log ON decision_log.id = (
		   SELECT al.id
		   FROM activity_log al
		   WHERE al.entity_type = 'request'
		     AND al.entity_id = r.request_id
		     AND al.action IN ('request.approved', 'request.rejected', 'request.correction_requested')
		     AND r.decided_at IS NOT NULL
		     AND ABS(TIMESTAMPDIFF(SECOND, al.created_at, r.decided_at)) <= 30
		     AND JSON_CONTAINS(al.details, JSON_QUOTE('decided_by'), '$.changedFields')
		     AND JSON_CONTAINS(al.details, JSON_QUOTE('decided_at'), '$.changedFields')
		   ORDER BY al.created_at DESC, al.id DESC
		   LIMIT 1
		 )
		 ORDER BY r.date_requested DESC`
	));

	const requests = rows as Array<Record<string, unknown>>;
	for (const row of requests) {
		const recorded = !!row.decided_at && !!row.decision_log_id;
		row.decision_recorded = recorded;
		row.decision_actor_id = row.decided_by ?? row.logged_decider_id ?? '';
		row.decision_actor_name = recorded
			? String(row.live_decider_name || row.logged_decider_name || '').trim() || 'Former staff'
			: '';
		row.decision_actor_role = recorded
			? String(row.live_decider_role || row.logged_decider_role || 'Staff')
			: '';
		row.decision_actor_key = recorded
			? String(row.decided_by ?? row.logged_decider_id ?? `former:${row.decision_actor_name}:${row.decision_actor_role}`)
			: '';
	}
	const itemMap = await fetchRequestItems(requests.map((r) => r.request_id as string));
	for (const row of requests) { row.student_name = formatName(row.first_name, row.middle_name, row.last_name); row.items = itemMap.get(row.request_id as string) ?? []; row.document_name = documentNameSummary(row.items as Array<{document_id:number;name:string}>); }
	await attachRequestJourney(requests);
	return {
		requests,
		isAdmin: role === 'Admin',
		initialStatus: url.searchParams.get('status') ?? '',
		deliveryWaiting: url.searchParams.get('delivery') === 'waiting',
		initialDecider: role === 'Admin' && /^\d+$/.test(url.searchParams.get('decided_by') ?? '') ? url.searchParams.get('decided_by')! : ''
	});
};
