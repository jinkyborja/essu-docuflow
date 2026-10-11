import { createHmac, timingSafeEqual } from 'node:crypto';
import { JWT_SECRET } from '$env/static/private';
import { validateStudentIdPhotoMetadata } from '$lib/student-id-photo';

export const SIGNUP_PHOTO_UPLOAD_TTL = 10 * 60;
type SignupPhotoUpload = { email: string; studentId: string; path: string; contentType: string; size: number; expiresAt: number };

export function validateSignupPhotoIdentity(email: unknown, studentId: unknown): string | null {
	if (typeof email !== 'string' || email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
	if (typeof studentId !== 'string' || !/^\d{2}-\d{4}$/.test(studentId)) return 'Student ID must follow the format NN-NNNN.';
	return null;
}

// Signup has no authenticated user yet. Bind this upload to the email/student ID
// pair instead, with a separate signing purpose from authenticated photo uploads.
export function createSignupIdPhotoUploadToken(email: string, studentId: string, path: string, contentType: string, size: number): string {
	const payload = Buffer.from(JSON.stringify({ email, studentId, path, contentType, size, expiresAt: Date.now() + SIGNUP_PHOTO_UPLOAD_TTL * 1000 })).toString('base64url');
	const signature = createHmac('sha256', JWT_SECRET).update(`signup-id-photo:${payload}`).digest('base64url');
	return `${payload}.${signature}`;
}

export function readSignupIdPhotoUploadToken(value: unknown, email: string, studentId: string): SignupPhotoUpload | null {
	if (typeof value !== 'string' || value.length > 2000) return null;
	try {
		const parts = value.split('.');
		if (parts.length !== 2) return null;
		const expected = createHmac('sha256', JWT_SECRET).update(`signup-id-photo:${parts[0]}`).digest();
		const supplied = Buffer.from(parts[1], 'base64url');
		if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
		const upload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as SignupPhotoUpload;
		if (upload.email !== email || upload.studentId !== studentId || !Number.isFinite(upload.expiresAt) || upload.expiresAt <= Date.now() || typeof upload.path !== 'string' || !/^signup\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(upload.path)) return null;
		return validateStudentIdPhotoMetadata(upload.path, upload.contentType, upload.size) ? null : upload;
	} catch { return null; }
}
