import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { requireMasterlistAdmin, parseCsv, headers, validateRow } from '$lib/server/masterlist';
export const POST: RequestHandler = async ({ cookies, request }) => {
	const actor = await requireMasterlistAdmin(cookies);
	const data = await request.formData().catch(() => null);
	const file = data?.get('file');
	if (!(file instanceof File) || !file.size) return json({ error: 'Choose a CSV file' }, { status: 400 });
	if (file.size > 2 * 1024 * 1024) return json({ error: 'CSV must be at most 2 MB' }, { status: 413 });
	let rows: string[][];
	try { rows = parseCsv(new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())); } catch { return json({ error: 'Invalid UTF-8 CSV or malformed quoting' }, { status: 400 }); }
	const columns = rows.shift()?.map(v => v.trim().toLowerCase()) ?? [];
	if (headers.some(key => !columns.includes(key)) || new Set(columns).size !== columns.length || columns.some(key => ![...headers, 'school_year'].includes(key))) return json({ error: 'Required headers: ' + headers.join(', ') + '. Optional: school_year.' }, { status: 400 });
	const summary = { added: 0, updated: 0, skipped: 0, reasons: [] as Array<{ row: number; reason: string }> };
	const valid: Array<Record<string, string>> = [];
	rows.forEach((values, i) => {
		const reason = values.every(v => !v.trim()) ? 'Empty row' : validateRow(values, columns);
		if (reason) { summary.skipped++; summary.reasons.push({ row: i + 2, reason }); }
		else valid.push(Object.fromEntries(columns.map((key, n) => [key, values[n].trim()])));
	});
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		for (const row of valid) {
			const [existing] = await conn.execute('SELECT id FROM enrollment_masterlist WHERE student_id = ? FOR UPDATE', [row.student_id]);
			await conn.execute(
				'INSERT INTO enrollment_masterlist (student_id, last_name, first_name, middle_name, program, campus, status, school_year, imported_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_name = VALUES(last_name), first_name = VALUES(first_name), middle_name = VALUES(middle_name), program = VALUES(program), campus = VALUES(campus), status = VALUES(status), school_year = VALUES(school_year), imported_by = VALUES(imported_by), imported_at = CURRENT_TIMESTAMP',
				[row.student_id, row.last_name, row.first_name, row.middle_name || null, row.program, row.campus || 'Guiuan', row.status || null, row.school_year || null, actor.userId]
			);
			if ((existing as unknown[]).length) summary.updated++; else summary.added++;
		}
		await conn.commit(); return json(summary);
	} catch (e) { await conn.rollback(); console.error('Masterlist import failed', e); return json({ error: 'Import failed; no rows were saved.' }, { status: 500 }); }
	finally { conn.release(); }
};
