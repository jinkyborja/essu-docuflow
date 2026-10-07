import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { validate, insertFiles, type FormInput } from '$lib/server/forms';
import { env } from '$env/dynamic/private';

function session(cookies: { get: (key: string) => string | undefined }) {
	const token = cookies.get('session'); if (!token) return null;
	try { return verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET); } catch { return null; }
}
const bucket = env.SUPABASE_FORMS_BUCKET || 'forms';

export const PUT: RequestHandler = async ({ request, cookies, params }) => {
	const user = session(cookies); if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!['Staff', 'Admin'].includes(user.role)) return json({ error: 'Forbidden' }, { status: 403 });
	let body: Record<string, unknown>; try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body.' }, { status: 400 }); }
	const problem = validate(body); if (problem) return json({ error: problem }, { status: 400 });
	const id = Number(params.id); if (!Number.isInteger(id) || id < 1) return json({ error: 'Invalid form ID.' }, { status: 400 });
	const input = body as unknown as FormInput;
	const [oldRows] = await pool.execute('SELECT storage_path FROM form_files WHERE form_id = ?', [id]);
	const [found] = await pool.execute('SELECT form_id FROM forms WHERE form_id = ?', [id]);
	if (!(found as unknown[]).length) return json({ error: 'Form not found.' }, { status: 404 });
	const oldPaths = (oldRows as { storage_path: string | null }[]).map((f) => f.storage_path).filter((p): p is string => !!p);
	const keep = new Set(input.files.map((f) => f.storage_path).filter((p): p is string => !!p));
	if (input.files.some((f) => f.storage_path && !oldPaths.includes(f.storage_path) && !/^forms\/[a-f0-9-]{36}\/\d+-[\w.-]+$/i.test(f.storage_path))) return json({ error: 'Invalid storage path.' }, { status: 400 });
	const remove = oldPaths.filter((p) => !keep.has(p));
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		await conn.execute('UPDATE forms SET title = ?, category = ?, code = ?, description = ?, fields = ?, download_name = ? WHERE form_id = ?',
			[input.title.trim(), input.category.trim(), input.code?.trim() || null, input.description, JSON.stringify(input.fields), input.download_name?.trim() || `ESSU-${input.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, id]);
		await conn.execute('DELETE FROM form_files WHERE form_id = ?', [id]);
		await insertFiles(conn, id, input.files);
		await conn.commit();
		if (remove.length) { const { error } = await supabase.storage.from(bucket).remove(remove); if (error) console.error('Could not remove replaced form files:', error.message); }
		return json({ ok: true });
	} catch (error) { await conn.rollback(); console.error('Update form failed:', error); return json({ error: 'Could not update the form.' }, { status: 500 }); }
	finally { conn.release(); }
};

export const DELETE: RequestHandler = async ({ cookies, params }) => {
	const user = session(cookies); if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!['Staff', 'Admin'].includes(user.role)) return json({ error: 'Forbidden' }, { status: 403 });
	const id = Number(params.id); if (!Number.isInteger(id) || id < 1) return json({ error: 'Invalid form ID.' }, { status: 400 });
	const [rows] = await pool.execute('SELECT storage_path FROM form_files WHERE form_id = ?', [id]);
	const [found] = await pool.execute('SELECT form_id FROM forms WHERE form_id = ?', [id]);
	if (!(found as unknown[]).length) return json({ error: 'Form not found.' }, { status: 404 });
	const paths = (rows as { storage_path: string | null }[]).map((f) => f.storage_path).filter((p): p is string => !!p);
	if (paths.length) { const { error } = await supabase.storage.from(bucket).remove(paths); if (error) { console.error('Could not remove deleted form files:', error.message); return json({ error: 'Could not remove the form files.' }, { status: 500 }); } }
	await pool.execute('DELETE FROM forms WHERE form_id = ?', [id]);
	return json({ ok: true });
};
