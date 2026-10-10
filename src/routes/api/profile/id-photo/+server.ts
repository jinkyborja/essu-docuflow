import { randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { createStudentIdPhotoUploadToken, readStudentIdPhotoUploadToken, signStudentIdPhoto } from '$lib/server/student-id-photo';
import { STUDENT_ID_PHOTO_MAX_SIZE, STUDENT_ID_PHOTO_URL_TTL, validateStudentIdPhoto, validateStudentIdPhotoMetadata } from '$lib/student-id-photo';
import { validateUpload } from '$lib/server/upload-validation';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let actor: { userId: number; role: string };
	try { actor = await verifySession(token, JWT_SECRET); } catch { return json({ error: 'Unauthorized' }, { status: 401 }); }
	if (actor.role !== 'Student') return json({ error: 'Student access required' }, { status: 403 });
	const [rows] = await pool.execute("SELECT id_photo_path FROM users WHERE user_id = ? AND role = 'Student'", [actor.userId]);
	const path = (rows as Array<{ id_photo_path: string | null }>)[0]?.id_photo_path;
	if (!path) return json({ error: 'No ID photo uploaded' }, { status: 404 });
	const url = await signStudentIdPhoto(path);
	if (!url) return json({ error: 'Could not load the ID photo. Please try again.' }, { status: 502 });
	return json({ url, expiresIn: STUDENT_ID_PHOTO_URL_TTL }, { headers: { 'Cache-Control': 'private, no-store' } });
};

async function removePhoto(path: string): Promise<boolean> {
	try {
		const { error } = await supabase.storage.from('student-ids').remove([path]);
		if (error) throw error;
		return true;
	} catch (error) {
		console.error('Student ID photo cleanup failed:', error);
		return false;
	}
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let actor: { userId: number; role: string };
	try { actor = await verifySession(token, JWT_SECRET); } catch { return json({ error: 'Unauthorized' }, { status: 401 }); }
	if (actor.role !== 'Student') return json({ error: 'Student access required' }, { status: 403 });
	const body = await request.json().catch(() => null);
	if (!body || !['prepare', 'complete'].includes(body.action)) return json({ error: 'Invalid photo upload action.' }, { status: 400 });
	const upload = body.action === 'complete' ? readStudentIdPhotoUploadToken(body.uploadToken, actor.userId) : null;
	if (body.action === 'complete' && !upload) return json({ error: 'The upload expired or is invalid. Please upload the photo again.' }, { status: 400 });
	if (body.action === 'prepare') {
		const invalid = validateStudentIdPhotoMetadata(body.name, body.contentType, body.size);
		if (invalid) return json({ error: invalid }, { status: typeof body.size === 'number' && body.size > STUDENT_ID_PHOTO_MAX_SIZE ? 413 : 400 });
	}
	const [rows] = await pool.execute("SELECT id_status, id_photo_path FROM users WHERE user_id = ? AND role = 'Student'", [actor.userId]);
	const student = (rows as Array<{ id_status: string; id_photo_path: string | null }>)[0];
	if (!student) return json({ error: 'Student not found' }, { status: 404 });
	// Retrying a completed upload must not delete the current photo or reset a decision.
	if (upload && student.id_photo_path === upload.path) return json({ success: true, id_status: student.id_status, has_id_photo: true });
	if (!['pending', 'rejected'].includes(student.id_status)) {
		if (upload) await removePhoto(upload.path);
		return json({ error: 'Verified students do not need to upload an ID photo.' }, { status: 409 });
	}

	if (body.action === 'prepare') {
		const path = `${actor.userId}/${randomUUID()}.${body.name.split('.').pop().toLowerCase()}`;
		try {
			const { data, error } = await supabase.storage.from('student-ids').createSignedUploadUrl(path, { upsert: false });
			if (error || !data?.signedUrl) throw error ?? new Error('Missing signed upload URL');
			return json({ uploadUrl: data.signedUrl, uploadToken: createStudentIdPhotoUploadToken(actor.userId, path, body.contentType, body.size) }, { headers: { 'Cache-Control': 'private, no-store' } });
		} catch (error) {
			console.error('Could not prepare student ID photo upload:', error);
			return json({ error: 'Could not start the ID photo upload. Please try again.' }, { status: 502 });
		}
	}

	const path = upload!.path;
	let saved = false;
	let previousPath: string | null = null;
	let conn: Awaited<ReturnType<typeof pool.getConnection>> | null = null;
	let transactionOpen = false;
	let discardUpload = false;
	const uploadedAt = new Date();
	try {
		// File bytes go directly to Storage to support 5 MB on Vercel. Validate the
		// actual stored MIME, size and contents before accepting the upload.
		const { data: blob, error } = await supabase.storage.from('student-ids').download(path);
		if (error || !blob) {
			console.error('Could not read uploaded student ID photo:', error);
			return json({ error: 'The uploaded photo could not be read. Please upload it again.' }, { status: 502 });
		}
		const file = new File([blob], path.split('/').pop()!, { type: blob.type });
		const invalid = validateStudentIdPhoto(file);
		if (invalid) { discardUpload = true; return json({ error: invalid }, { status: file.size > STUDENT_ID_PHOTO_MAX_SIZE ? 413 : 400 }); }
		if (file.size !== upload!.size || file.type !== upload!.contentType) { discardUpload = true; return json({ error: 'The uploaded photo does not match the selected file.' }, { status: 400 }); }
		const invalidContent = await validateUpload(file);
		if (invalidContent) { discardUpload = true; return json({ error: invalidContent.error }, { status: invalidContent.status }); }

		conn = await pool.getConnection();
		await conn.beginTransaction();
		transactionOpen = true;
		const [lockedRows] = await conn.execute("SELECT id_status, id_photo_path FROM users WHERE user_id = ? AND role = 'Student' FOR UPDATE", [actor.userId]);
		const locked = (lockedRows as Array<{ id_status: string; id_photo_path: string | null }>)[0];
		if (locked?.id_photo_path === path) {
			await conn.rollback(); transactionOpen = false; saved = true;
			return json({ success: true, id_status: locked.id_status, has_id_photo: true });
		}
		if (!locked || !['pending', 'rejected'].includes(locked.id_status)) {
			await conn.rollback();
			transactionOpen = false;
			discardUpload = true;
			return json({ error: 'Your verification status changed. Refresh your profile before uploading.' }, { status: 409 });
		}
		previousPath = locked.id_photo_path;
		await conn.execute("UPDATE users SET id_photo_path = ?, id_photo_uploaded_at = ?, id_status = 'pending' WHERE user_id = ? AND role = 'Student'", [path, uploadedAt, actor.userId]);
		await conn.commit();
		transactionOpen = false;
		saved = true;
	} catch (error) {
		if (conn && transactionOpen) await conn.rollback();
		console.error('Could not save student ID photo:', error);
		return json({ error: 'Could not save the ID photo. Please try again.' }, { status: 500 });
	} finally {
		conn?.release();
		if (discardUpload && !saved) await removePhoto(path);
	}

	const removed = !previousPath || previousPath === path || await removePhoto(previousPath);
	return json({ success: true, id_status: 'pending', has_id_photo: true, id_photo_uploaded_at: uploadedAt.toISOString(), warning: removed ? null : 'Your new photo was saved, but the previous photo could not be removed. Please contact the Graduate School office.' });
};
