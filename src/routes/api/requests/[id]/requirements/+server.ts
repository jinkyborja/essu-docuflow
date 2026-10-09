import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { fetchOneRequestRequirements, replaceRequestRequirements } from '$lib/server/requirements';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { validateUpload } from '$lib/server/upload-validation';

export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (payload.role !== 'Student') return json({ error: 'Forbidden' }, { status: 403 });

	// Verify request belongs to this student
	const [rows] = await pool.execute(
		'SELECT student_id, status FROM requests WHERE request_id = ?',
		[params.id]
	);
	const list = rows as { student_id: number; status: string }[];
	if (list.length === 0) return json({ error: 'Not found' }, { status: 404 });
	if (list[0].student_id !== payload.userId) return json({ error: 'Forbidden' }, { status: 403 });
	const initialStatus = list[0].status;
	if (!['Pending', 'Correction Requested'].includes(initialStatus)) {
		return json({ error: 'Files can only be updated while pending or when corrections are requested.' }, { status: 409 });
	}

	const formData = await request.formData();
	const reqs = await fetchOneRequestRequirements(params.id);
	const uploads = new Map<string, File>();
	for (const req of reqs) {
		if (req.in_person) continue;
		const file = formData.get(`file_${req.name}`);
		if (file instanceof File && file.size > 0) uploads.set(req.name, file);
	}
	if (uploads.size === 0) {
		return json({ error: 'Upload at least one requirement file before resubmitting.' }, { status: 400 });
	}
	if (initialStatus === 'Correction Requested' && reqs.some((req) => !req.in_person && req.needs_correction && !uploads.has(req.name))) {
		return json({ error: 'Upload corrected files for all flagged requirements before resubmitting.' }, { status: 400 });
	}

	const uploadErrors: string[] = [];
	const uploadedPaths: string[] = [];
	for (const [name, file] of uploads) {
		const invalid = await validateUpload(file);
		if (invalid) return json({ error: `${name}: ${invalid.error}` }, { status: invalid.status });
	}

	for (const req of reqs) {
		if (req.in_person) continue;
		const file = uploads.get(req.name);
		if (file) {
			const ext = file.name.split('.').pop();
			const safeName = req.name.toLowerCase().replace(/\s+/g, '-');
			const path = `${params.id}/${safeName}-${Date.now()}.${ext}`;
			const buffer = Buffer.from(await file.arrayBuffer());
			const { error } = await supabase.storage.from('requirements').upload(path, buffer, { contentType: file.type, upsert: true });
			if (error) {
				console.error(`Storage upload failed for "${req.name}":`, error);
				uploadErrors.push(`${req.name}: ${error.message}`);
			} else {
				uploadedPaths.push(path);
				req.file_path = path;
				req.file_name = file.name;
				req.submitted_at = new Date().toISOString();
				req.needs_correction = false;
			}
		}
	}

	// Don't reset the request to Pending if nothing actually uploaded.
	if (uploadErrors.length > 0) {
		if (uploadedPaths.length) await supabase.storage.from('requirements').remove(uploadedPaths);
		return json(
			{ error: `File upload failed — nothing was resubmitted. (${uploadErrors.join('; ')})` },
			{ status: 502 }
		);
	}

	// Reset to Pending after resubmission
	const conn = await pool.getConnection();
	let saved = false;
	try {
		await conn.beginTransaction();
		// Recheck under the write lock: staff may have decided the request during upload.
		const [currentRows] = await conn.execute(
			'SELECT student_id, status FROM requests WHERE request_id = ? FOR UPDATE',
			[params.id]
		);
		const current = (currentRows as Array<{ student_id: number; status: string }>)[0];
		if (!current) {
			await conn.rollback();
			return json({ error: 'Not found' }, { status: 404 });
		}
		if (current.student_id !== payload.userId) {
			await conn.rollback();
			return json({ error: 'Forbidden' }, { status: 403 });
		}
		if (current.status !== initialStatus || !['Pending', 'Correction Requested'].includes(current.status)) {
			await conn.rollback();
			return json({ error: 'The request changed while uploading. Refresh and try again.' }, { status: 409 });
		}
		await replaceRequestRequirements(conn, params.id, reqs);
		await conn.execute(
			'UPDATE requests SET status = ?, admin_message = NULL WHERE request_id = ?',
			['Pending', params.id]
		);
		await conn.execute('INSERT INTO request_status_history (request_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)', [params.id, initialStatus, 'Pending', payload.userId]);
		await conn.commit();
		saved = true;
	} catch (err) {
		await conn.rollback();
		console.error('Resubmit failed:', err);
		return json({ error: 'Could not save your resubmission. Please try again.' }, { status: 500 });
	} finally {
		conn.release();
		if (!saved && uploadedPaths.length) {
			try { await supabase.storage.from('requirements').remove(uploadedPaths); }
			catch (cleanupError) { console.error('Resubmission upload cleanup failed:', cleanupError); }
		}
	}

	return json({ success: true });
};
