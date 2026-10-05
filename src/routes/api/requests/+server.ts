import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { replaceRequestRequirements, fetchRequestFilePaths } from '$lib/server/requirements';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (payload.role === 'Student') {
		const [rows] = await pool.execute(
			`SELECT r.request_id, r.document_id, d.name AS document_name, r.purpose,
			        r.status, r.admin_message, r.approved_file_path, r.approved_file_name,
			        CAST(COALESCE((
			          SELECT JSON_ARRAYAGG(JSON_OBJECT(
			            'name', rq.name,
			            'description', rq.description,
			            'in_person', rr.in_person,
			            'file_path', rr.file_path,
			            'file_name', rr.file_name,
			            'submitted_at', rr.submitted_at,
			            'needs_correction', rr.needs_correction
			          ))
			          FROM request_requirements rr
			          JOIN requirements rq ON rq.requirement_id = rr.requirement_id
			          WHERE rr.request_id = r.request_id
			        ), JSON_ARRAY()) AS CHAR) AS requirements,
			        r.date_requested
			 FROM requests r
			 JOIN documents d ON r.document_id = d.document_id
			 WHERE r.student_id = ?
			 ORDER BY r.date_requested DESC`,
			[payload.userId]
		);
		return json(rows);
	}

	// Staff/Admin: all requests
	const [rows] = await pool.execute(
		`SELECT r.request_id, r.document_id, d.name AS document_name,
		        u.first_name, u.middle_name, u.last_name, u.student_id AS student_code,
		        u.program, r.purpose, r.status, r.date_requested
		 FROM requests r
		 JOIN documents d ON r.document_id = d.document_id
		 JOIN users u ON r.student_id = u.user_id
		 ORDER BY r.date_requested DESC`
	);
	return json(rows);
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (payload.role !== 'Student') return json({ error: 'Forbidden' }, { status: 403 });

	const formData = await request.formData();
	const documentId = formData.get('document_id') as string;
	const purpose = formData.get('purpose') as string;
	const requirementsJson = formData.get('requirements') as string;

	if (!documentId || !purpose || !requirementsJson) {
		return json({ error: 'Missing fields' }, { status: 400 });
	}

	// Generate request ID
	const year = new Date().getFullYear();
	const [countRows] = await pool.execute(
		'SELECT COUNT(*) AS cnt FROM requests WHERE request_id LIKE ?',
		[`REQ-${year}-%`]
	);
	const count = ((countRows as { cnt: number }[])[0].cnt ?? 0) + 1;
	const requestId = `REQ-${year}-${String(count).padStart(3, '0')}`;

	// Parse requirements and upload files
	let reqs: Array<{
		name: string; description: string; in_person: boolean;
		file_path: string | null; file_name: string | null;
		submitted_at: string | null; needs_correction: boolean;
	}> = JSON.parse(requirementsJson);

	// Upload every attached requirement file. A storage failure must NOT be
	// swallowed — otherwise the request is created with null file_path/submitted_at
	// and both the student and staff see "Not yet submitted" with no explanation.
	const uploadErrors: string[] = [];

	for (const req of reqs) {
		if (req.in_person) continue;
		const file = formData.get(`file_${req.name}`) as File | null;
		if (file && file.size > 0) {
			const ext = file.name.split('.').pop();
			const safeName = req.name.toLowerCase().replace(/\s+/g, '-');
			const path = `${requestId}/${safeName}-${Date.now()}.${ext}`;
			const buffer = Buffer.from(await file.arrayBuffer());
			const { error } = await supabase.storage.from('requirements').upload(path, buffer, {
				contentType: file.type
			});
			if (error) {
				console.error(`Storage upload failed for "${req.name}":`, error);
				uploadErrors.push(`${req.name}: ${error.message}`);
			} else {
				req.file_path = path;
				req.file_name = file.name;
				req.submitted_at = new Date().toISOString();
			}
		}
	}

	// Bail out rather than persist a request whose files are missing — the student
	// has no way to re-upload while the request is untouched by staff.
	if (uploadErrors.length > 0) {
		return json(
			{
				error: `File upload failed — your request was not submitted. Please try again or contact the Graduate School. (${uploadErrors.join('; ')})`
			},
			{ status: 502 }
		);
	}

	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		// purpose_id is the normalized value; the text column stays in sync until it is dropped.
		await conn.execute(
			`INSERT INTO requests (request_id, student_id, document_id, purpose, purpose_id)
			 VALUES (?, ?, ?, ?, (SELECT purpose_id FROM purposes WHERE label = ?))`,
			[requestId, payload.userId, documentId, purpose, purpose]
		);
		await replaceRequestRequirements(conn, requestId, reqs);
		await conn.commit();
		return json({ success: true, request_id: requestId });
	} catch (err) {
		await conn.rollback();
		console.error('Create request failed:', err);
		return json({ error: 'Could not submit your request. Please try again.' }, { status: 500 });
	} finally {
		conn.release();
	}
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (payload.role === 'Student') return json({ error: 'Forbidden' }, { status: 403 });

	const { request_id } = await request.json();

	// Clean up uploaded files from Supabase
	const [rows] = await pool.execute(
		'SELECT approved_file_path FROM requests WHERE request_id = ?',
		[request_id]
	);
	const req = (rows as Record<string, unknown>[])[0];
	if (req) {
		const filePaths: string[] = await fetchRequestFilePaths([request_id]);
		if (req.approved_file_path) filePaths.push(req.approved_file_path as string);
		if (filePaths.length > 0) {
			await supabase.storage.from('requirements').remove(filePaths);
		}
	}

	// request_requirements cascades on delete; history has no FK cascade.
	await pool.execute('DELETE FROM request_status_history WHERE request_id = ?', [request_id]);
	await pool.execute('DELETE FROM requests WHERE request_id = ?', [request_id]);

	return json({ success: true });
};
