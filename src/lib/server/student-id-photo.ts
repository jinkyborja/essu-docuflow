import { createHmac, timingSafeEqual } from 'node:crypto';
import { JWT_SECRET } from '$env/static/private';
import { supabase } from './supabase';
import { STUDENT_ID_PHOTO_URL_TTL, validateStudentIdPhotoMetadata } from '$lib/student-id-photo';

type PhotoUpload = { userId: number; path: string; contentType: string; size: number; expiresAt: number };
const uploadLifetime = 10 * 60 * 1000;

// Bind upload completion to the owner, generated path and validated metadata.
// This is separate from session tokens and requires no persistent upload table.
export function createStudentIdPhotoUploadToken(userId: number, path: string, contentType: string, size: number): string {
	const payload = Buffer.from(JSON.stringify({ userId, path, contentType, size, expiresAt: Date.now() + uploadLifetime })).toString('base64url');
	const signature = createHmac('sha256', JWT_SECRET).update(`student-id-photo:${payload}`).digest('base64url');
	return `${payload}.${signature}`;
}

export function readStudentIdPhotoUploadToken(value: unknown, userId: number): PhotoUpload | null {
	if (typeof value !== 'string' || value.length > 2000) return null;
	try {
		const parts = value.split('.');
		if (parts.length !== 2) return null;
		const expected = createHmac('sha256', JWT_SECRET).update(`student-id-photo:${parts[0]}`).digest();
		const supplied = Buffer.from(parts[1], 'base64url');
		if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
		const upload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as PhotoUpload;
		if (upload.userId !== userId || typeof upload.expiresAt !== 'number' || upload.expiresAt <= Date.now() || typeof upload.path !== 'string' || !new RegExp(`^${userId}/[a-f0-9-]{36}\\.(jpg|jpeg|png|webp)$`).test(upload.path)) return null;
		return validateStudentIdPhotoMetadata(upload.path, upload.contentType, upload.size) ? null : upload;
	} catch { return null; }
}

export async function signStudentIdPhoto(path: string): Promise<string | null> {
	try {
		const { data, error } = await supabase.storage.from('student-ids').createSignedUrl(path, STUDENT_ID_PHOTO_URL_TTL);
		if (error || !data?.signedUrl) {
			console.error('Could not sign student ID photo:', error);
			return null;
		}
		return data.signedUrl;
	} catch (error) {
		console.error('Could not sign student ID photo:', error);
		return null;
	}
}
