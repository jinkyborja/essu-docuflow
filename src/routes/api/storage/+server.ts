import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!['Student', 'Staff', 'Admin'].includes(payload.role)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const bucket = url.searchParams.get('bucket');
	const path = url.searchParams.get('path');
	if (!bucket || !path) return json({ error: 'Missing params' }, { status: 400 });
	if (!['requirements', 'templates'].includes(bucket)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	if (bucket === 'requirements') {
		const [rows] = await pool.execute(
			`SELECT r.student_id, r.status, 'requirement' AS file_kind
			 FROM request_requirements rr JOIN requests r ON r.request_id = rr.request_id
			 WHERE BINARY rr.file_path = BINARY ?
			 UNION ALL
			 SELECT r.student_id, r.status, 'final' AS file_kind
			 FROM requests r WHERE BINARY r.approved_file_path = BINARY ?`,
			[path, path]
		);
		const files = rows as Array<{ student_id: number; status: string; file_kind: string }>;
		const isOffice = ['Staff', 'Admin'].includes(payload.role);
		const allowed = files.some((file) => isOffice || (
			file.student_id === payload.userId &&
			(file.file_kind === 'requirement' || file.status === 'Approved')
		));
		if (!allowed) return json({ error: 'Forbidden' }, { status: 403 });
	} else {
		// Templates are shared, but only catalogued files may be signed.
		const [rows] = await pool.execute(
			'SELECT document_id FROM documents WHERE BINARY template_path = BINARY ? LIMIT 1',
			[path]
		);
		if ((rows as unknown[]).length === 0) return json({ error: 'Forbidden' }, { status: 403 });
	}

	const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
	if (error) return json({ error: error.message }, { status: 500 });

	return json({ url: data.signedUrl });
};
