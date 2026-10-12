import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { logActivity } from '$lib/server/activity-log';

async function getAdmin(cookies: { get: (k: string) => string | undefined }) {
	const token = cookies.get('session');
	if (!token) return null;
	try {
		const p = (await verifySession(token, JWT_SECRET));
		return p.role === 'Admin' ? p : null;
	} catch {
		return null;
	}
}

export const PATCH: RequestHandler = async ({ request, cookies }) => {
	const admin = await getAdmin(cookies);
	if (!admin) return json({ error: 'Unauthorized' }, { status: 401 });

	const { user_id, first_name, last_name, position, role } = await request.json();
	if (!user_id || !first_name || !last_name) return json({ error: 'Missing required fields.' }, { status: 400 });
	if (!['Staff', 'Admin'].includes(role)) return json({ error: 'Invalid role.' }, { status: 400 });

	await pool.execute(
		`UPDATE users SET first_name = ?, last_name = ?, position = ?, auth_version = auth_version + 1, role = ? WHERE user_id = ? AND role IN ('Staff', 'Admin')`,
		[first_name, last_name, position ?? null, role, user_id]
	);
	try {
		const conn = await pool.getConnection();
		try { await logActivity(conn, { actor: admin, action: 'staff.edited', entityType: 'staff', entityId: user_id, summary: `Updated staff account #${user_id}`, details: { changedFields: ['first_name', 'last_name', 'position', 'role'] } }); }
		finally { conn.release(); }
	} catch (error) { console.error('Could not write staff edit activity:', error); }

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const admin = await getAdmin(cookies);
	if (!admin) return json({ error: 'Unauthorized' }, { status: 401 });

	const { user_id } = await request.json();
	if (!user_id) return json({ error: 'Missing user_id.' }, { status: 400 });
	if (user_id === admin.userId) return json({ error: 'You cannot delete your own account.' }, { status: 400 });

	await pool.execute(
		`DELETE FROM users WHERE user_id = ? AND role IN ('Staff', 'Admin')`,
		[user_id]
	);
	try {
		const conn = await pool.getConnection();
		try { await logActivity(conn, { actor: admin, action: 'staff.removed', entityType: 'staff', entityId: user_id, summary: `Removed staff account #${user_id}`, details: { changedFields: ['staff account'] } }); }
		finally { conn.release(); }
	} catch (error) { console.error('Could not write staff removal activity:', error); }

	return json({ ok: true });
};
