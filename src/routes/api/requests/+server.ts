import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { replaceRequestRequirements, fetchRequestFilePaths, fetchRequestRequirements } from '$lib/server/requirements';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { fetchRequestItems, documentNameSummary } from '$lib/server/request-items';
import { validateUpload } from '$lib/server/upload-validation';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (payload.role === 'Student') {
		const [rows] = await pool.execute(
			`SELECT r.request_id, r.document_id, r.purpose,
			        r.status, r.admin_message, r.approved_file_path, r.approved_file_name,
		        r.date_requested
			 FROM requests r
			 WHERE r.student_id = ?
			 ORDER BY r.date_requested DESC`,
			[payload.userId]
		);
		const result = rows as Array<Record<string, unknown>>;
		const items = await fetchRequestItems(result.map((r) => r.request_id as string));
		const requirements = await fetchRequestRequirements(result.map((r) => r.request_id as string));
		for (const row of result) {
			const docs = items.get(row.request_id as string) ?? [];
			row.items = docs;
			row.documentName = documentNameSummary(docs);
			row.document_name = row.documentName;
			row.requirements = requirements.get(row.request_id as string) ?? [];
		}
		return json(result);
	}

	// Staff/Admin: all requests
	const [rows] = await pool.execute(
		`SELECT r.request_id,
		        u.first_name, u.middle_name, u.last_name, u.student_id AS student_code,
		        u.program, r.purpose, r.status, r.date_requested
		 FROM requests r
		 JOIN users u ON r.student_id = u.user_id
		 ORDER BY r.date_requested DESC`
	);
	const result = rows as Array<Record<string, unknown>>;
	const items = await fetchRequestItems(result.map((r) => r.request_id as string));
	for (const row of result) { const docs = items.get(row.request_id as string) ?? []; row.items = docs; row.documentName = documentNameSummary(docs); row.document_name = row.documentName; }
	return json(result);
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (payload.role !== 'Student') return json({ error: 'Forbidden' }, { status: 403 });
	let stage = 'student_verification';
	let conn: Awaited<ReturnType<typeof pool.getConnection>> | null = null;
	let transactionOpen = false;
	let lockName: string | null = null;
	const uploadedPaths: string[] = [];
	let submitted = false;
	try {
	const [studentRows] = await pool.execute('SELECT id_status FROM users WHERE user_id = ? AND role = \'Student\'', [payload.userId]);
	if ((studentRows as Array<{ id_status: string }>)[0]?.id_status !== 'verified') {
		return json({ error: 'Your student ID must be verified before you can request documents.', code: 'ID_NOT_VERIFIED', message: 'Your student ID must be verified before you can request documents.' }, { status: 403 });
	}

	const formData = await request.formData();
	const rawIds = formData.get('documentIds') as string | null;
	const legacyId = formData.get('document_id') as string | null;
	const purpose = formData.get('purpose') as string;
	const requirementsJson = formData.get('requirements') as string;

	let documentIds: number[];
	try { documentIds = rawIds ? JSON.parse(rawIds) : legacyId ? [Number(legacyId)] : []; } catch { documentIds = []; }
	if (!Array.isArray(documentIds) || documentIds.length < 1 || documentIds.length > 5 || documentIds.some((id) => !Number.isInteger(id) || id < 1) || new Set(documentIds).size !== documentIds.length) {
		return json({ error: 'Select between 1 and 5 different documents.', code: 'INVALID_DOCUMENTS', message: 'Select between 1 and 5 different documents.' }, { status: 400 });
	}
	if (!purpose || !requirementsJson) {
		return json({ error: 'Missing fields', code: 'MISSING_FIELDS', message: 'Purpose and requirements are required.' }, { status: 400 });
	}
	const idMarks = documentIds.map(() => '?').join(',');
	stage = 'validate_documents';
	const [activeDocs] = await pool.execute(`SELECT document_id FROM documents WHERE document_id IN (${idMarks})`, documentIds);
	if ((activeDocs as Array<{document_id:number}>).length !== documentIds.length) return json({ error: 'One or more selected documents are unavailable.', code: 'DOCUMENT_UNAVAILABLE', message: 'One or more selected documents are unavailable.' }, { status: 400 });
	stage = 'load_requirements';
	const [requirementRows] = await pool.execute(
		`SELECT rq.name, rq.description, MAX(dr.in_person) AS in_person, MIN(dr.sort_order) AS sort_order
		 FROM document_requirements dr JOIN requirements rq ON rq.requirement_id = dr.requirement_id
		 WHERE dr.document_id IN (${idMarks}) GROUP BY rq.requirement_id, rq.name, rq.description ORDER BY sort_order, rq.name`, documentIds
	);

	// Reserve a unique upload folder; allocate the human-readable request ID inside
	// the insert transaction under a MySQL named lock to avoid concurrent duplicates.
	const uploadBatch = crypto.randomUUID();

	// Parse requirements and upload files
	let reqs: Array<{
		name: string; description: string; in_person: boolean;
		file_path: string | null; file_name: string | null;
		submitted_at: string | null; needs_correction: boolean;
	}> = (requirementRows as Array<Record<string, unknown>>).map((row) => ({ name: row.name as string, description: row.description as string, in_person: Boolean(row.in_person), file_path: null, file_name: null, submitted_at: null, needs_correction: false }));
	// Validate the entire catalog-derived batch before uploading any file.
	for (const req of reqs) {
		if (req.in_person) continue;
		const invalid = await validateUpload(formData.get(`file_${req.name}`));
		if (invalid) return json({ error: `${req.name}: ${invalid.error}` }, { status: invalid.status });
	}

	// Upload every attached requirement file. A storage failure must NOT be
	// swallowed — otherwise the request is created with null file_path/submitted_at
	// and both the student and staff see "Not yet submitted" with no explanation.
	const uploadErrors: string[] = [];

	stage = 'upload_requirement_files';
	for (const req of reqs) {
		if (req.in_person) continue;
		const file = formData.get(`file_${req.name}`) as File | null;
		if (file && file.size > 0) {
			const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
			const safeName = req.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'requirement';
			const path = `${uploadBatch}/${safeName}-${Date.now()}.${ext}`;
			const buffer = Buffer.from(await file.arrayBuffer());
			const { error } = await supabase.storage.from('requirements').upload(path, buffer, {
				contentType: file.type
			});
			if (error) {
				console.error(`Storage upload failed for "${req.name}":`, error);
				uploadErrors.push(`${req.name}: ${error.message}`);
			} else {
				uploadedPaths.push(path);
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
				error: 'File upload failed — your request was not submitted. Please try again or contact the Graduate School.',
				code: 'REQUIREMENT_UPLOAD_FAILED',
				message: `A requirement file could not be uploaded: ${uploadErrors.join('; ')}`
			},
			{ status: 502 }
		);
	}

	stage = 'acquire_transaction_connection';
	conn = await pool.getConnection();
	const year = new Date().getFullYear();
	lockName = `docuflow_req_id_${year}`;
	stage = 'request_id_lock';
	const [lockRows] = await conn.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
	if ((lockRows as Array<{ acquired: number | null }>)[0]?.acquired !== 1) {
		return json({ error: 'Could not submit your request. Please try again.', code: 'REQUEST_ID_LOCK_TIMEOUT', message: 'The request service is busy. Please try again.' }, { status: 503 });
	}
	await conn.beginTransaction();
	transactionOpen = true;
	stage = 'generate_request_id';
	const prefix = `REQ-${year}-`;
	const [sequenceRows] = await conn.execute(
		'SELECT COALESCE(MAX(CAST(SUBSTRING(request_id, ?) AS UNSIGNED)), 0) AS seq FROM requests WHERE request_id LIKE ?',
		[prefix.length + 1, `${prefix}%`]
	);
	const seq = Number((sequenceRows as Array<{ seq: number | string }>)[0]?.seq ?? 0) + 1;
	const requestId = `${prefix}${String(seq).padStart(3, '0')}`;
		stage = 'insert_request';
		// purpose_id is the normalized value; the text column stays in sync until it is dropped.
		await conn.execute(
			`INSERT INTO requests (request_id, student_id, document_id, purpose, purpose_id)
			 VALUES (?, ?, NULL, ?, (SELECT purpose_id FROM purposes WHERE label = ?))`,
			[requestId, payload.userId, purpose, purpose]
		);
		stage = 'insert_request_items';
		for (const documentId of documentIds) await conn.execute('INSERT INTO request_items (request_id, document_id) VALUES (?, ?)', [requestId, documentId]);
		stage = 'replace_request_requirements';
		await replaceRequestRequirements(conn, requestId, reqs);
		stage = 'commit';
		await conn.commit();
		transactionOpen = false;
		submitted = true;
		return json({ success: true, request_id: requestId });
	} catch (err) {
		if (conn && transactionOpen) {
			try { await conn.rollback(); } catch (rollbackError) { console.error('[requests POST] rollback failed', rollbackError); }
			transactionOpen = false;
		}
		console.error('[requests POST]', err, 'stage:', stage);
		const dbErr = err as { code?: string; errno?: number };
		let code = 'REQUEST_SUBMIT_FAILED';
		let message = 'Could not submit your request because the database rejected a write. Please retry; if it continues, contact the Graduate School.';
		if (stage === 'insert_request' && (dbErr.code === 'ER_BAD_NULL_ERROR' || dbErr.errno === 1048)) {
			code = 'LEGACY_DOCUMENT_ID_NOT_NULL';
			message = 'Database schema requires requests.document_id to allow NULL for multi-document requests.';
		} else if (stage === 'insert_request_items' && ['ER_TRUNCATED_WRONG_VALUE', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_NO_REFERENCED_ROW_2', 'ER_NO_REFERENCED_ROW'].includes(dbErr.code ?? '')) {
			code = 'REQUEST_ITEMS_SCHEMA_MISMATCH';
			message = 'Database schema mismatch: request_items.request_id must match requests.request_id in type, length, character set, and collation.';
		} else if (dbErr.code === 'ER_DUP_ENTRY') {
			code = 'DUPLICATE_REQUEST_ID';
			message = 'A duplicate request identifier was detected. Please retry; no request was submitted.';
		}
		return json({ error: 'Could not submit your request. Please try again.', code, message, stage }, { status: 500 });
	} finally {
		if (!submitted && uploadedPaths.length) {
			try { await supabase.storage.from('requirements').remove(uploadedPaths); }
			catch (cleanupError) { console.error('Request upload cleanup failed:', cleanupError); }
		}
		if (conn) {
			if (lockName) {
				try { await conn.execute('SELECT RELEASE_LOCK(?)', [lockName]); } catch (releaseError) { console.error('[requests POST] lock release failed', releaseError); }
			}
			conn.release();
		}
	}
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
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
