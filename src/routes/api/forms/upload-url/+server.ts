import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { env } from '$env/dynamic/private';

const allowed: Record<string, string> = {
	jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel'
};
const maxSize = 10 * 1024 * 1024;
const bucket = env.SUPABASE_FORMS_BUCKET || 'forms';
function safeName(name: string) { return name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100) || 'file'; }
export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session'); if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	try { if (!['Staff', 'Admin'].includes(verifyJwt<{ role: string }>(token, JWT_SECRET).role)) return json({ error: 'Forbidden' }, { status: 403 }); }
	catch { return json({ error: 'Unauthorized' }, { status: 401 }); }
	let body: { files?: { name: string; type: string; size: number }[] };
	try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body.' }, { status: 400 }); }
	if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > 5) return json({ error: 'Select between 1 and 5 files.' }, { status: 400 });
	for (const file of body.files) {
		const ext = file.name?.split('.').pop()?.toLowerCase();
		if (!ext || !allowed[ext] || file.type !== allowed[ext] || !Number.isFinite(file.size) || file.size <= 0 || file.size > maxSize) return json({ error: `Invalid file: ${file.name || 'unknown'}. Use JPG, PNG, WebP, PDF, DOCX, DOC, XLSX or XLS up to 10 MB.` }, { status: 400 });
	}
	const batch = crypto.randomUUID(); const uploads = [];
	for (let i = 0; i < body.files.length; i++) {
		const file = body.files[i]; const originalName = Buffer.from(JSON.stringify({ name: file.name, size: file.size }), 'utf8').toString('base64url'); const path = `forms/${batch}/${i + 1}-${safeName(file.name)}--${originalName}`;
		const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
		if (error) return json({ error: `Could not create an upload URL: ${error.message}` }, { status: 500 });
		uploads.push({ path, token: data.token, signedUrl: data.signedUrl, publicUrl: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl, name: file.name, type: file.type });
	}
	return json({ uploads });
};
