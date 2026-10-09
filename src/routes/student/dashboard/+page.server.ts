import { attachRequestJourney } from '$lib/server/request-journey';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';
import { fetchRequestItems, documentNameSummary } from '$lib/server/request-items';

export const load: PageServerLoad = async ({ parent }) => {
	const { userId } = await parent();

	const [requests] = await pool.execute(
		`SELECT r.request_id, r.status, r.date_requested, r.approved_file_path
		 FROM requests r
		 WHERE r.student_id = ? AND r.status != 'Rejected'
		 ORDER BY r.date_requested DESC`,
		[userId]
	);

	const reqRows = requests as Array<Record<string, unknown>>;
	const itemMap = await fetchRequestItems(reqRows.map((r) => r.request_id as string));
	for (const row of reqRows) { row.items = itemMap.get(row.request_id as string) ?? []; row.document_name = documentNameSummary(row.items as Array<{document_id:number;name:string}>); }

	await attachRequestJourney(reqRows);
	const [recentHistory] = await pool.execute(
		`SELECT h.history_id, h.request_id, h.new_status, h.changed_at, GROUP_CONCAT(DISTINCT d.name ORDER BY d.name SEPARATOR ' + ') AS document_name
			 FROM request_status_history h
			 LEFT JOIN requests r ON h.request_id = r.request_id
			 LEFT JOIN request_items ri ON ri.request_id = r.request_id
			 LEFT JOIN documents d ON ri.document_id = d.document_id
		 WHERE r.student_id = ? OR (h.request_id IS NULL AND h.notification_user_id = ?)
		 GROUP BY h.history_id, h.request_id, h.new_status, h.changed_at
			 ORDER BY h.changed_at DESC
			 LIMIT 4`,
		[userId, userId]
	);
	const historyRows = recentHistory as Array<Record<string, unknown>>;

	return {
		requests: requests as Record<string, unknown>[],
		recentHistory: historyRows
	};
};
