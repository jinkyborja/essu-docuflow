import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/student/dashboard');

	try {
		const payload = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
		if (payload.role === 'Student') redirect(302, '/student/dashboard');
		redirect(302, '/staff/dashboard');
	} catch {
		redirect(302, '/student/dashboard');
	}
};
