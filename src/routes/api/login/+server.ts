import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { signJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { email, password, rememberMe } = await request.json();

	if (!email || !password) {
		return json({ error: 'Missing credentials' }, { status: 400 });
	}

	const [rows] = await pool.execute(
		'SELECT * FROM users WHERE email = ?',
		[email]
	);

	const users = rows as Record<string, unknown>[];
	if (users.length === 0) {
		return json({ error: 'Invalid email or password' }, { status: 401 });
	}

	const user = users[0];

	const passwordHash = createHash('sha256').update(password).digest('hex');
	if (user.password_hash !== passwordHash) {
		return json({ error: 'Invalid email or password' }, { status: 401 });
	}

	if (!user.verified) {
		return json({ error: 'Please verify your email before logging in.' }, { status: 403 });
	}

	const sessionDuration = rememberMe ? 86400 * 30 : 86400;
	const token = signJwt(
		{ userId: user.user_id, email: user.email, role: user.role },
		JWT_SECRET,
		sessionDuration
	);

	cookies.set('session', token, {
		httpOnly: true,
		secure: false,
		sameSite: 'lax',
		path: '/',
		maxAge: sessionDuration
	});

	const fullName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ');
	const initials = [user.first_name, user.last_name]
		.filter(Boolean)
		.map((n) => (n as string)[0])
		.join('')
		.toUpperCase();

	if (user.role === 'Student') {
		return json({
			role: 'student',
			profile: {
				id: (user.student_id as string) ?? String(user.user_id),
				name: fullName,
				program: (user.program as string) ?? '',
				year: (user.last_school_year as number) ?? 0,
				email: user.email,
				clearanceStatus: 'cleared',
				requestCount: 0
			}
		});
	}

	return json({
		role: 'staff',
		profile: {
			id: String(user.user_id),
			name: fullName,
			position: (user.position as string) ?? '',
			department: 'Registrar',
			email: user.email,
			avatarInitials: initials
		}
	});
};
