import type { PageServerLoad } from './$types';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';

	if (!token) return { valid: false, email: '', role: '', token: '' };

	try {
		const payload = verifyJwt<{ email: string; role: string; purpose: string }>(token, JWT_SECRET);
		if (payload.purpose !== 'staff-invite') return { valid: false, email: '', role: '', token: '' };
		return { valid: true, email: payload.email, role: payload.role, token };
	} catch {
		return { valid: false, email: '', role: '', token: '' };
	}
};
