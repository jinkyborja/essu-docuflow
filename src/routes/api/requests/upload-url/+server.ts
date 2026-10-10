import { randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { fetchOneRequestRequirements } from '$lib/server/requirements';
import { canUpdateRequirementFiles, validateRequirementFileMetadata, REQUIREMENT_FILE_MAX_SIZE } from '$lib/requirement-files';
import { requirementUploadToken, type RequirementUploadContext } from '$lib/server/requirement-uploads';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let actor: { userId: number; role: string };
	try { actor = await verifySession(token, JWT_SECRET); } catch { return json({ error: 'Unauthorized' }, { status: 401 }); }
	if (actor.role !== 'Student') return json({ error: 'Forbidden' }, { status: 403 });
	const body = await request.json().catch(() => null);
	if (!body || !Array.isArray(body.files) || !body.files.length) return json({ error: 'Select at least one requirement file.' }, { status: 400 });
	let requirements: Array<{ name: string; in_person: boolean | number }>;
	let context: RequirementUploadContext;
	if (body.requestId != null) {
		if (typeof body.requestId !== 'string' || !body.requestId.trim()) return json({ error: 'Request ID must be text.' }, { status: 400 });
		const [rows] = await pool.execute('SELECT student_id, status FROM requests WHERE request_id = ?', [body.requestId]);
		const existing = (rows as Array<{ student_id: number; status: string }>)[0];
		if (!existing) return json({ error: 'Request not found' }, { status: 404 });
		if (existing.student_id !== actor.userId) return json({ error: 'Forbidden' }, { status: 403 });
		if (!canUpdateRequirementFiles(existing.status)) return json({ error: 'Files can only be updated while pending or when corrections are requested.' }, { status: 409 });
		requirements = await fetchOneRequestRequirements(body.requestId);
		context = { requestId: body.requestId, documentIds: [] };
	} else {
		const ids = body.documentIds;
		if (!Array.isArray(ids) || ids.length < 1 || ids.length > 5 || ids.some(id => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) return json({ error: 'Select between 1 and 5 different documents.' }, { status: 400 });
		const [studentRows] = await pool.execute("SELECT id_status FROM users WHERE user_id = ? AND role = 'Student'", [actor.userId]);
		if ((studentRows as Array<{ id_status: string }>)[0]?.id_status !== 'verified') return json({ error: 'Your student ID must be verified before you can request documents.' }, { status: 403 });
		const marks = ids.map(() => '?').join(',');
		const [docRows] = await pool.execute(`SELECT document_id FROM documents WHERE document_id IN (${marks})`, ids);
		if ((docRows as unknown[]).length !== ids.length) return json({ error: 'A selected document is unavailable.' }, { status: 400 });
		const [rows] = await pool.execute(`SELECT rq.name, MAX(dr.in_person) AS in_person FROM document_requirements dr JOIN requirements rq ON rq.requirement_id = dr.requirement_id WHERE dr.document_id IN (${marks}) GROUP BY rq.requirement_id, rq.name`, ids);
		requirements = rows as Array<{ name: string; in_person: boolean | number }>;
		context = { requestId: null, documentIds: ids };
	}
	const names = new Set<string>();
	for (const file of body.files) {
		if (!file || typeof file.requirementName !== 'string' || names.has(file.requirementName) || !requirements.some(req => req.name === file.requirementName && !req.in_person)) return json({ error: 'Select one file per upload requirement.' }, { status: 400 });
		names.add(file.requirementName);
		const invalid = validateRequirementFileMetadata(file.name, file.type, file.size);
		if (invalid) return json({ error: `${file.requirementName}: ${invalid}` }, { status: typeof file.size === 'number' && file.size > REQUIREMENT_FILE_MAX_SIZE ? 413 : 400 });
	}
	const uploads = [];
	try {
		for (const file of body.files) {
			const path = `${actor.userId}/requirements/${randomUUID()}.${file.name.split('.').pop().toLowerCase()}`;
			const { data, error } = await supabase.storage.from('requirements').createSignedUploadUrl(path, { upsert: false });
			if (error || !data?.signedUrl) throw error ?? new Error('No signed upload URL');
			uploads.push({ requirementName: file.requirementName, signedUrl: data.signedUrl, uploadToken: requirementUploadToken({ ...file, path, userId: actor.userId, context }) });
		}
		return json({ uploads }, { headers: { 'Cache-Control': 'private, no-store' } });
	} catch (error) {
		console.error('Could not prepare requirement uploads:', error);
		return json({ error: 'Could not start the file upload. Please try again.' }, { status: 502 });
	}
};
