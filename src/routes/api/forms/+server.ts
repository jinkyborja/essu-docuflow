import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { slugName, validate, insertFiles, type FormInput } from '$lib/server/forms';

function session(cookies: { get: (key: string) => string | undefined }) {
	const token = cookies.get('session');
	if (!token) return null;
	try { return verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET); } catch { return null; }
}

export const GET: RequestHandler = async ({ cookies }) => {
	const user = session(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!['Student', 'Staff', 'Admin'].includes(user.role)) return json({ error: 'Forbidden' }, { status: 403 });
	const [rows] = await pool.execute(
		`SELECT f.form_id, f.title, f.category, f.code, f.description, f.fields, f.download_name, f.created_at, f.updated_at,
			ff.file_id, ff.page_no, ff.storage_path, ff.public_url
		 FROM forms f LEFT JOIN form_files ff ON ff.form_id = f.form_id
		 ORDER BY f.category, f.title, ff.page_no`
	);
	const forms = new Map<number, Record<string, unknown>>();
	for (const row of rows as Record<string, unknown>[]) {
		const id = Number(row.form_id);
		if (!forms.has(id)) {
			let fields: unknown = row.fields;
			if (typeof fields === 'string') { try { fields = JSON.parse(fields); } catch { fields = []; } }
			forms.set(id, { form_id: id, title: row.title, category: row.category, code: row.code,
				description: row.description, fields, download_name: row.download_name,
				created_at: row.created_at, updated_at: row.updated_at, files: [] });
		}
		if (row.file_id != null) (forms.get(id)!.files as unknown[]).push({
			file_id: row.file_id, page_no: row.page_no, storage_path: row.storage_path, public_url: row.public_url
		});
	}
	return json([...forms.values()]);
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = session(cookies);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!['Staff', 'Admin'].includes(user.role)) return json({ error: 'Forbidden' }, { status: 403 });
	let body: Record<string, unknown>;
	try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body.' }, { status: 400 }); }
	const validation = validate(body);
	if (validation) return json({ error: validation }, { status: 400 });
	const { title, category, code, description, fields, download_name, files } = body as unknown as FormInput;
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		const [result] = await conn.execute(
			'INSERT INTO forms (title, category, code, description, fields, download_name, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[title.trim(), category.trim(), code?.trim() || null, description, JSON.stringify(fields), download_name?.trim() || slugName(title), user.userId]
		);
		const id = (result as { insertId: number }).insertId;
		await insertFiles(conn, id, files);
		await conn.commit();
		return json({ form_id: id }, { status: 201 });
	} catch (error) {
		await conn.rollback(); console.error('Create form failed:', error);
		return json({ error: 'Could not create the form.' }, { status: 500 });
	} finally { conn.release(); }
};
