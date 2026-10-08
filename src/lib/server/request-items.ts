import pool from './db';

export type RequestDocument = { document_id: number; name: string };

export async function fetchRequestItems(requestIds: string[]): Promise<Map<string, RequestDocument[]>> {
	const items = new Map<string, RequestDocument[]>();
	if (!requestIds.length) return items;
	const marks = requestIds.map(() => '?').join(',');
	const [rows] = await pool.execute(
		`SELECT ri.request_id, d.document_id, d.name
		 FROM request_items ri JOIN documents d ON d.document_id = ri.document_id
		 WHERE ri.request_id IN (${marks}) ORDER BY ri.item_id`, requestIds
	);
	for (const row of rows as Array<{ request_id: string; document_id: number; name: string }>) {
		const list = items.get(row.request_id) ?? [];
		list.push({ document_id: row.document_id, name: row.name });
		items.set(row.request_id, list);
	}
	return items;
}

export function documentNameSummary(items: RequestDocument[]): string {
	if (!items.length) return 'Document request';
	return items.length > 1 ? `${items[0].name} +${items.length - 1} more` : items[0].name;
}
