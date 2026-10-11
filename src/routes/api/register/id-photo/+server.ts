import { randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { STUDENT_ID_PHOTO_MAX_SIZE, validateStudentIdPhotoMetadata } from '$lib/student-id-photo';
import { createSignupIdPhotoUploadToken, SIGNUP_PHOTO_UPLOAD_TTL, validateSignupPhotoIdentity } from '$lib/server/signup-id-photo';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid upload request.' }, { status: 400 });
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email;
	const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : body.studentId;
	const identityError = validateSignupPhotoIdentity(email, studentId);
	if (identityError) return json({ error: identityError }, { status: 400 });
	const photoError = validateStudentIdPhotoMetadata(body.name, body.contentType, body.size);
	if (photoError) return json({ error: photoError }, { status: typeof body.size === 'number' && body.size > STUDENT_ID_PHOTO_MAX_SIZE ? 413 : 400 });
	try {
		const [existing] = await pool.execute('SELECT user_id FROM users WHERE email = ? OR student_id = ?', [email, studentId]);
		if ((existing as unknown[]).length) return json({ error: 'This email or Student ID is already registered.' }, { status: 409 });
		const path = `signup/${randomUUID()}.${body.name.split('.').pop().toLowerCase()}`;
		const { data, error } = await supabase.storage.from('student-ids').createSignedUploadUrl(path, { upsert: false });
		if (error || !data?.signedUrl) throw error ?? new Error('Missing signed upload URL');
		return json({ uploadUrl: data.signedUrl, uploadToken: createSignupIdPhotoUploadToken(email, studentId, path, body.contentType, body.size), expiresIn: SIGNUP_PHOTO_UPLOAD_TTL }, { headers: { 'Cache-Control': 'private, no-store' } });
	} catch (error) {
		console.error('Could not prepare signup ID photo upload:', error);
		return json({ error: 'Could not start the ID photo upload. Please try again.' }, { status: 502 });
	}
};
