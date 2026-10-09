import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { fetchDocumentRequirements, replaceDocumentRequirements, type RequirementSettings } from '$lib/server/requirements';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { validateUpload } from '$lib/server/upload-validation';

export const GET: RequestHandler = async () => {
	const [rows] = await pool.execute(
		'SELECT document_id, name, template_path, template_name, upload_date FROM documents ORDER BY upload_date DESC'
	);
	const docs = rows as Record<string, unknown>[];
	const reqMap = await fetchDocumentRequirements(docs.map((d) => d.document_id as number));
	for (const d of docs) d.requirements = reqMap.get(d.document_id as number) ?? [];
	return json(docs);
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
	if (payload.role === 'Student') return json({ error: 'Forbidden' }, { status: 403 });

	const formData = await request.formData();
	const name = formData.get('name') as string;
	const requirementsJson = formData.get('requirements') as string;
	const templateFile = formData.get('template') as File | null;

	if (!name || !requirementsJson) return json({ error: 'Missing fields' }, { status: 400 });
	if (templateFile !== null) {
		const invalid = await validateUpload(templateFile, true);
		if (invalid) return json({ error: invalid.error }, { status: invalid.status });
	}

	let templatePath: string | null = null;
	let templateName: string | null = null;

	if (templateFile && templateFile.size > 0) {
		const ext = templateFile.name.split('.').pop();
		const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
		const buffer = Buffer.from(await templateFile.arrayBuffer());
		const { error } = await supabase.storage.from('templates').upload(path, buffer, {
			contentType: templateFile.type
		});
		if (error) return json({ error: `Upload failed: ${error.message}` }, { status: 500 });
		templatePath = path;
		templateName = templateFile.name;
	}

	let parsedReqs: Array<{ name: string; description?: string; in_person?: boolean } & RequirementSettings>;
	try {
		parsedReqs = JSON.parse(requirementsJson);
		if (!Array.isArray(parsedReqs) || parsedReqs.some(item => !item || typeof item.name !== 'string' || !item.name.trim() ||
			(item.form_id != null && (!Number.isInteger(item.form_id) || item.form_id <= 0)) ||
			(item.needs_signature != null && typeof item.needs_signature !== 'boolean') ||
			(item.signature_note != null && (typeof item.signature_note !== 'string' || item.signature_note.length > 200)))) {
			return json({ error: 'Invalid requirement form or signature settings' }, { status: 400 });
		}
	} catch {
		return json({ error: 'Invalid requirements payload' }, { status: 400 });
	}

	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		const [result] = await conn.execute(
			'INSERT INTO documents (name, template_path, template_name, uploaded_by) VALUES (?, ?, ?, ?)',
			[name, templatePath, templateName, payload.userId]
		);
		const documentId = (result as { insertId: number }).insertId;
		await replaceDocumentRequirements(conn, documentId, parsedReqs);
		await conn.commit();
		return json({ success: true, document_id: documentId });
	} catch (err) {
		await conn.rollback();
		console.error('Create document failed:', err);
		return json({ error: 'Could not create the document.' }, { status: 500 });
	} finally {
		conn.release();
	}
};

export const PATCH: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (payload.role === 'Student') return json({ error: 'Forbidden' }, { status: 403 });

	const formData = await request.formData();
	const documentId = formData.get('document_id') as string;
	const name = formData.get('name') as string;
	const requirementsJson = formData.get('requirements') as string;
	const templateFile = formData.get('template') as File | null;
	const removeTemplate = formData.get('remove_template') === 'true';

	if (!documentId || !name || !requirementsJson) return json({ error: 'Missing fields' }, { status: 400 });
	if (templateFile !== null) {
		const invalid = await validateUpload(templateFile, true);
		if (invalid) return json({ error: invalid.error }, { status: invalid.status });
	}

	// Fetch current template path
	const [rows] = await pool.execute('SELECT template_path FROM documents WHERE document_id = ?', [documentId]);
	const docs = rows as { template_path: string | null }[];
	if (docs.length === 0) return json({ error: 'Not found' }, { status: 404 });
	let templatePath = docs[0].template_path;
	let templateName: string | null = null;

	// Fetch current template name
	const [nameRows] = await pool.execute('SELECT template_name FROM documents WHERE document_id = ?', [documentId]);
	templateName = ((nameRows as { template_name: string | null }[])[0])?.template_name ?? null;

	if (removeTemplate && templatePath) {
		await supabase.storage.from('templates').remove([templatePath]);
		templatePath = null;
		templateName = null;
	}

	if (templateFile && templateFile.size > 0) {
		if (templatePath) await supabase.storage.from('templates').remove([templatePath]);
		const ext = templateFile.name.split('.').pop();
		const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
		const buffer = Buffer.from(await templateFile.arrayBuffer());
		const { error } = await supabase.storage.from('templates').upload(path, buffer, { contentType: templateFile.type });
		if (!error) { templatePath = path; templateName = templateFile.name; }
	}

	let parsedReqs: Array<{ name: string; description?: string; in_person?: boolean } & RequirementSettings>;
	try {
		parsedReqs = JSON.parse(requirementsJson);
		if (!Array.isArray(parsedReqs) || parsedReqs.some(item => !item || typeof item.name !== 'string' || !item.name.trim() ||
			(item.form_id != null && (!Number.isInteger(item.form_id) || item.form_id <= 0)) ||
			(item.needs_signature != null && typeof item.needs_signature !== 'boolean') ||
			(item.signature_note != null && (typeof item.signature_note !== 'string' || item.signature_note.length > 200)))) {
			return json({ error: 'Invalid requirement form or signature settings' }, { status: 400 });
		}
	} catch {
		return json({ error: 'Invalid requirements payload' }, { status: 400 });
	}

	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		await conn.execute(
			'UPDATE documents SET name = ?, template_path = ?, template_name = ? WHERE document_id = ?',
			[name, templatePath, templateName, documentId]
		);
		await replaceDocumentRequirements(conn, Number(documentId), parsedReqs);
		await conn.commit();
		return json({ success: true });
	} catch (err) {
		await conn.rollback();
		console.error('Update document failed:', err);
		return json({ error: 'Could not update the document.' }, { status: 500 });
	} finally {
		conn.release();
	}
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	try {
		const p = (await verifySession(token, JWT_SECRET));
		if (p.role === 'Student') return json({ error: 'Forbidden' }, { status: 403 });
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { document_id } = await request.json();
	const [rows] = await pool.execute('SELECT template_path FROM documents WHERE document_id = ?', [document_id]);
	const docs = rows as { template_path: string | null }[];
	if (docs.length === 0) return json({ error: 'Not found' }, { status: 404 });

	if (docs[0].template_path) {
		await supabase.storage.from('templates').remove([docs[0].template_path]);
	}

	await pool.execute('DELETE FROM documents WHERE document_id = ?', [document_id]);
	return json({ success: true });
};
