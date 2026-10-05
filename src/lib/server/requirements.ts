// Data access for requirements, which used to live as JSON blobs in
// `documents.requirements` and `requests.requirements`.
//
// The shape returned here deliberately matches the old blob shape, so pages and
// API responses keep the same contract while the storage underneath is now
// properly relational (requirements / document_requirements / request_requirements).

import type { PoolConnection } from 'mysql2/promise';
import pool from './db';

export type RequirementItem = {
	name: string;
	description: string;
	in_person: boolean;
	file_path: string | null;
	file_name: string | null;
	submitted_at: string | null;
	needs_correction: boolean;
};

/** DATETIME -> the ISO-8601 string the client has always received. */
function toIso(value: unknown): string | null {
	if (!value) return null;
	const d = value instanceof Date ? value : new Date(String(value));
	return isNaN(d.getTime()) ? null : d.toISOString();
}

function rowToItem(r: Record<string, unknown>): RequirementItem {
	return {
		name: r.name as string,
		description: (r.description as string) ?? '',
		in_person: Boolean(r.in_person),
		file_path: (r.file_path as string) ?? null,
		file_name: (r.file_name as string) ?? null,
		submitted_at: toIso(r.submitted_at),
		needs_correction: Boolean(r.needs_correction)
	};
}

/** Requirements a document asks for, keyed by document_id. One query, no N+1. */
export async function fetchDocumentRequirements(
	documentIds: number[]
): Promise<Map<number, RequirementItem[]>> {
	const map = new Map<number, RequirementItem[]>();
	if (documentIds.length === 0) return map;
	const marks = documentIds.map(() => '?').join(',');
	const [rows] = await pool.execute(
		`SELECT dr.document_id, rq.name, rq.description, dr.in_person,
		        NULL AS file_path, NULL AS file_name, NULL AS submitted_at, FALSE AS needs_correction
		 FROM document_requirements dr
		 JOIN requirements rq ON rq.requirement_id = dr.requirement_id
		 WHERE dr.document_id IN (${marks})
		 ORDER BY dr.document_id, dr.sort_order`,
		documentIds
	);
	for (const r of rows as Record<string, unknown>[]) {
		const id = r.document_id as number;
		if (!map.has(id)) map.set(id, []);
		map.get(id)!.push(rowToItem(r));
	}
	return map;
}

/** What a student submitted per requirement, keyed by request_id. */
export async function fetchRequestRequirements(
	requestIds: string[]
): Promise<Map<string, RequirementItem[]>> {
	const map = new Map<string, RequirementItem[]>();
	if (requestIds.length === 0) return map;
	const marks = requestIds.map(() => '?').join(',');
	const [rows] = await pool.execute(
		`SELECT rr.request_id, rq.name, rq.description, rr.in_person,
		        rr.file_path, rr.file_name, rr.submitted_at, rr.needs_correction
		 FROM request_requirements rr
		 JOIN requirements rq ON rq.requirement_id = rr.requirement_id
		 WHERE rr.request_id IN (${marks})
		 ORDER BY rr.request_id, rr.sort_order`,
		requestIds
	);
	for (const r of rows as Record<string, unknown>[]) {
		const id = r.request_id as string;
		if (!map.has(id)) map.set(id, []);
		map.get(id)!.push(rowToItem(r));
	}
	return map;
}

/** Convenience wrapper for the single-record case. */
export async function fetchOneRequestRequirements(requestId: string): Promise<RequirementItem[]> {
	return (await fetchRequestRequirements([requestId])).get(requestId) ?? [];
}

/**
 * Make sure every named requirement exists in the master table and return a
 * name -> requirement_id map. Staff can type new requirement names when creating
 * a document, so the master list grows on demand.
 */
export async function ensureRequirementIds(
	conn: PoolConnection,
	items: { name: string; description?: string }[]
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (items.length === 0) return map;

	for (const item of items) {
		await conn.execute(
			`INSERT INTO requirements (name, description) VALUES (?, ?)
			 ON DUPLICATE KEY UPDATE description = COALESCE(NULLIF(VALUES(description), ''), description)`,
			[item.name, item.description ?? null]
		);
	}

	const names = items.map((i) => i.name);
	const marks = names.map(() => '?').join(',');
	const [rows] = await conn.execute(
		`SELECT requirement_id, name FROM requirements WHERE name IN (${marks})`,
		names
	);
	for (const r of rows as Record<string, unknown>[]) {
		map.set(r.name as string, r.requirement_id as number);
	}
	return map;
}

/** Replace a document's requirement list wholesale. */
export async function replaceDocumentRequirements(
	conn: PoolConnection,
	documentId: number,
	items: { name: string; description?: string; in_person?: boolean }[]
): Promise<void> {
	const ids = await ensureRequirementIds(conn, items);
	await conn.execute('DELETE FROM document_requirements WHERE document_id = ?', [documentId]);
	for (const [i, item] of items.entries()) {
		const rid = ids.get(item.name);
		if (!rid) continue;
		await conn.execute(
			`INSERT INTO document_requirements (document_id, requirement_id, in_person, sort_order)
			 VALUES (?, ?, ?, ?)`,
			[documentId, rid, item.in_person ? 1 : 0, i]
		);
	}
}

/** Replace a request's submitted-requirement rows wholesale. */
export async function replaceRequestRequirements(
	conn: PoolConnection,
	requestId: string,
	items: RequirementItem[]
): Promise<void> {
	const ids = await ensureRequirementIds(conn, items);
	await conn.execute('DELETE FROM request_requirements WHERE request_id = ?', [requestId]);
	for (const [i, item] of items.entries()) {
		const rid = ids.get(item.name);
		if (!rid) continue;
		await conn.execute(
			`INSERT INTO request_requirements
			   (request_id, requirement_id, in_person, file_path, file_name, submitted_at, needs_correction, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				requestId,
				rid,
				item.in_person ? 1 : 0,
				item.file_path ?? null,
				item.file_name ?? null,
				item.submitted_at ? new Date(item.submitted_at) : null,
				item.needs_correction ? 1 : 0,
				i
			]
		);
	}
}

/** Every stored file path for a set of requests — used for storage cleanup. */
export async function fetchRequestFilePaths(requestIds: string[]): Promise<string[]> {
	if (requestIds.length === 0) return [];
	const marks = requestIds.map(() => '?').join(',');
	const [rows] = await pool.execute(
		`SELECT file_path FROM request_requirements
		 WHERE request_id IN (${marks}) AND file_path IS NOT NULL`,
		requestIds
	);
	return (rows as Record<string, unknown>[]).map((r) => r.file_path as string);
}
