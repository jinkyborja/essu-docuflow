import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import type { PoolConnection } from 'mysql2/promise';

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

export interface FormFileInput { page_no: number; storage_path: string | null; public_url: string; }
export interface FormInput { title: string; category: string; code?: string; description: string; fields: string[]; download_name?: string; files: FormFileInput[]; }
export function slugName(title: string) {
	const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	return `ESSU-${slug || 'form'}`;
}
export function validate(body: Record<string, unknown>): string | null {
	if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) return 'Title is required and must be at most 200 characters.';
	if (typeof body.category !== 'string' || !body.category.trim()) return 'Category is required.';
	if (body.code != null && typeof body.code !== 'string') return 'Code must be text.';
	if (typeof body.description !== 'string' || body.description.length > 4000) return 'Description must be at most 4000 characters.';
	if (!Array.isArray(body.fields) || body.fields.length > 30 || body.fields.some((v) => typeof v !== 'string' || v.length > 80)) return 'Fields must be an array of up to 30 strings, each at most 80 characters.';
	if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > 5) return 'Add between 1 and 5 files.';
	for (const file of body.files) {
		if (!file || typeof file !== 'object' || !Number.isInteger(file.page_no) || file.page_no < 1 || typeof file.public_url !== 'string' || !file.public_url.trim() || !(file.storage_path === null || typeof file.storage_path === 'string')) return 'Each file needs a page number and a valid URL.';
	}
	return null;
}
export async function insertFiles(conn: PoolConnection, id: number, files: FormFileInput[]) {
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		await conn.execute('INSERT INTO form_files (form_id, page_no, storage_path, public_url) VALUES (?, ?, ?, ?)', [id, i + 1, file.storage_path, file.public_url]);
	}
}
