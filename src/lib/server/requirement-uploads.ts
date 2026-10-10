import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { JWT_SECRET } from '$env/static/private';
import { supabase } from './supabase';
import { validateUpload } from './upload-validation';
import { validateRequirementFileMetadata, REQUIREMENT_FILE_MAX_SIZE } from '$lib/requirement-files';

export type RequirementUploadContext = { requestId: string | null; documentIds: number[] };
export type RequirementUpload = { requirementName: string; name: string; type: string; size: number; path: string; userId: number; context: RequirementUploadContext; expiresAt: number };
export class RequirementUploadError extends Error {
	constructor(message: string, public status = 400) { super(message); }
}
const lifetime = 15 * 60 * 1000;
const contextKey = (context: RequirementUploadContext) => JSON.stringify({ requestId: context.requestId, documentIds: [...context.documentIds].sort((a, b) => a - b) });

export function requirementUploadToken(input: Omit<RequirementUpload, 'expiresAt'>): string {
	const payload = Buffer.from(JSON.stringify({ ...input, expiresAt: Date.now() + lifetime })).toString('base64url');
	return `${payload}.${createHmac('sha256', JWT_SECRET).update(`requirement-upload:${payload}`).digest('base64url')}`;
}

export function readRequirementUploads(raw: FormDataEntryValue | null, userId: number, context: RequirementUploadContext): Map<string, RequirementUpload> {
	const uploads = new Map<string, RequirementUpload>();
	if (raw === null) return uploads;
	try {
		if (typeof raw !== 'string') throw new Error();
		const entries = JSON.parse(raw);
		if (!Array.isArray(entries)) throw new Error();
		for (const entry of entries) {
			if (typeof entry?.uploadToken !== 'string' || entry.uploadToken.length > 8000) throw new Error();
			const parts = entry.uploadToken.split('.');
			if (parts.length !== 2) throw new Error();
			const expected = createHmac('sha256', JWT_SECRET).update(`requirement-upload:${parts[0]}`).digest();
			const supplied = Buffer.from(parts[1], 'base64url');
			if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error();
			const upload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as RequirementUpload;
			if (upload.userId !== userId || upload.requirementName !== entry.requirementName || !upload.requirementName || uploads.has(upload.requirementName) || typeof upload.expiresAt !== 'number' || upload.expiresAt <= Date.now() || contextKey(upload.context) !== contextKey(context) || typeof upload.path !== 'string' || !upload.path.startsWith(`${userId}/requirements/`) || validateRequirementFileMetadata(upload.name, upload.type, upload.size)) throw new Error();
			uploads.set(upload.requirementName, upload);
		}
		return uploads;
	} catch { throw new RequirementUploadError('Invalid or expired requirement upload. Please select the files and try again.'); }
}

export async function validatePreparedRequirementFile(upload: RequirementUpload): Promise<void> {
	const { data: blob, error } = await supabase.storage.from('requirements').download(upload.path);
	if (error || !blob) throw new RequirementUploadError(`${upload.requirementName}: the uploaded file could not be read. Please try again.`, 502);
	const invalid = validateRequirementFileMetadata(upload.name, blob.type, blob.size);
	if (invalid || blob.type !== upload.type || blob.size !== upload.size) throw new RequirementUploadError(`${upload.requirementName}: ${invalid ?? 'The uploaded file does not match the selected file.'}`, blob.size > REQUIREMENT_FILE_MAX_SIZE ? 413 : 400);
	const contentError = await validateUpload(new File([blob], upload.name, { type: blob.type }));
	if (contentError) throw new RequirementUploadError(`${upload.requirementName}: ${contentError.error}`, contentError.status);
}

export async function assertPreparedUploadsUnused(conn: PoolConnection, uploads: Iterable<RequirementUpload>): Promise<void> {
	const paths = [...uploads].map(upload => upload.path);
	if (!paths.length) return;
	const [rows] = await conn.execute(`SELECT file_path FROM request_requirements WHERE file_path IN (${paths.map(() => '?').join(',')}) FOR UPDATE`, paths);
	if ((rows as unknown[]).length) throw new RequirementUploadError('These files were already submitted. Please select the files and try again.', 409);
}
