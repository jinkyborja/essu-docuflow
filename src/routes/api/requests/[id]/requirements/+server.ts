import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { fetchOneRequestRequirements, replaceRequestRequirements } from '$lib/server/requirements';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (payload.role !== 'Student') return json({ error: 'Forbidden' }, { status: 403 });

	// Verify request belongs to this student
	const [rows] = await pool.execute(
		'SELECT student_id FROM requests WHERE request_id = ?',
		[params.id]
	);
	const list = rows as { student_id: number }[];
	if (list.length === 0) return json({ error: 'Not found' }, { status: 404 });
	if (list[0].student_id !== payload.userId) return json({ error: 'Forbidden' }, { status: 403 });

	const formData = await request.formData();
	const reqs = await fetchOneRequestRequirements(params.id);

	const uploadErrors: string[] = [];

	for (const req of reqs) {
		if (req.in_person) continue;
		const file = formData.get(`file_${req.name}`) as File | null;
		if (file && file.size > 0) {
			const ext = file.name.split('.').pop();
			const safeName = req.name.toLowerCase().replace(/\s+/g, '-');
			const path = `${params.id}/${safeName}-${Date.now()}.${ext}`;
			const buffer = Buffer.from(await file.arrayBuffer());
			const { error } = await supabase.storage.from('requirements').upload(path, buffer, { contentType: file.type, upsert: true });
			if (error) {
				console.error(`Storage upload failed for "${req.name}":`, error);
				uploadErrors.push(`${req.name}: ${error.message}`);
			} else {
				req.file_path = path;
				req.file_name = file.name;
				req.submitted_at = new Date().toISOString();
				req.needs_correction = false;
			}
		}
	}

	// Don't reset the request to Pending if nothing actually uploaded.
	if (uploadErrors.length > 0) {
		return json(
			{ error: `File upload failed — nothing was resubmitted. (${uploadErrors.join('; ')})` },
			{ status: 502 }
		);
	}

	// Reset to Pending after resubmission
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		await replaceRequestRequirements(conn, params.id, reqs);
		await conn.execute(
			'UPDATE requests SET status = ?, admin_message = NULL WHERE request_id = ?',
			['Pending', params.id]
		);
		await conn.commit();
	} catch (err) {
		await conn.rollback();
		console.error('Resubmit failed:', err);
		return json({ error: 'Could not save your resubmission. Please try again.' }, { status: 500 });
	} finally {
		conn.release();
	}

	return json({ success: true });
};
