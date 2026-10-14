import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { supabase } from '$lib/server/supabase';
import { originalFileName, slugName } from '$lib/server/forms';
import { bundledFormPdf, isPdfName } from '$lib/form-pdf';

export const GET: RequestHandler = async ({ cookies, params, fetch, url }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	try { await verifySession(token, JWT_SECRET); }
	catch { return json({ error: 'Unauthorized' }, { status: 401 }); }
	const id = Number(params.id);
	if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'Invalid form ID.' }, { status: 400 });
	const [rows] = await pool.execute('SELECT f.title, ff.storage_path, ff.public_url FROM forms f LEFT JOIN form_files ff ON ff.form_id = f.form_id WHERE f.form_id = ? ORDER BY ff.page_no, ff.file_id', [id]);
	const files = rows as Array<{ title: string; storage_path: string | null; public_url: string | null }>;
	if (!files.length) return json({ error: 'Form not found.' }, { status: 404 });
	const pdf = files.find(file => isPdfName(originalFileName(file.storage_path, file.public_url?.split('/').pop() ?? '')));
	const equivalent = files.find(file => !file.storage_path && bundledFormPdf(file.public_url ?? ''));
	if (!pdf && !equivalent) return json({ error: 'A PDF version is not available yet. Please contact the Graduate School office.' }, { status: 409 });
	try {
		let bytes: ArrayBuffer;
		if (pdf?.storage_path) {
			const { data, error } = await supabase.storage.from(env.SUPABASE_FORMS_BUCKET || 'forms').download(pdf.storage_path);
			if (error || !data) throw new Error('Could not load the PDF.');
			bytes = await data.arrayBuffer();
		} else {
			const path = pdf?.public_url ?? bundledFormPdf(equivalent!.public_url!)!;
			if (!path.startsWith('/forms/') || path.includes('..') || path.includes('\\')) throw new Error('Invalid form location.');
			const response = await fetch(path);
			if (!response.ok) throw new Error('The PDF version is not available yet. Please contact the Graduate School office.');
			bytes = await response.arrayBuffer();
		}
		if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('This file is not a valid PDF. Please contact the Graduate School office.');
		return new Response(bytes, { headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `${url.searchParams.get('preview') === '1' ? 'inline' : 'attachment'}; filename="${slugName(files[0].title)}.pdf"`,
			'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'
		} });
	} catch (problem) {
		console.error('Form PDF download failed:', problem);
		return json({ error: problem instanceof Error ? problem.message : 'Could not download the PDF. Please try again.' }, { status: 502 });
	}
};
