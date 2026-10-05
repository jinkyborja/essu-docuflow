import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	try {
		verifyJwt(token, JWT_SECRET);
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const bucket = url.searchParams.get('bucket');
	const path = url.searchParams.get('path');
	if (!bucket || !path) return json({ error: 'Missing params' }, { status: 400 });

	const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
	if (error) return json({ error: error.message }, { status: 500 });

	return json({ url: data.signedUrl });
};
