import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

function getAdmin(cookies: { get: (k: string) => string | undefined }) {
	const token = cookies.get('session');
	if (!token) return null;
	try {
		const p = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
		return p.role === 'Admin' ? p : null;
	} catch {
		return null;
	}
}

export const PATCH: RequestHandler = async ({ request, cookies }) => {
	const admin = getAdmin(cookies);
	if (!admin) return json({ error: 'Unauthorized' }, { status: 401 });

	const { user_id, first_name, last_name, position, role } = await request.json();
	if (!user_id || !first_name || !last_name) return json({ error: 'Missing required fields.' }, { status: 400 });
	if (!['Staff', 'Admin'].includes(role)) return json({ error: 'Invalid role.' }, { status: 400 });

	await pool.execute(
		`UPDATE users SET first_name = ?, last_name = ?, position = ?, role = ? WHERE user_id = ? AND role IN ('Staff', 'Admin')`,
		[first_name, last_name, position ?? null, role, user_id]
	);

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const admin = getAdmin(cookies);
	if (!admin) return json({ error: 'Unauthorized' }, { status: 401 });

	const { user_id } = await request.json();
	if (!user_id) return json({ error: 'Missing user_id.' }, { status: 400 });
	if (user_id === admin.userId) return json({ error: 'You cannot delete your own account.' }, { status: 400 });

	await pool.execute(
		`DELETE FROM users WHERE user_id = ? AND role IN ('Staff', 'Admin')`,
		[user_id]
	);

	return json({ ok: true });
};
