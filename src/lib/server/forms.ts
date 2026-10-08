import type { PoolConnection } from 'mysql2/promise';

export interface FormFileInput { page_no: number; storage_path: string | null; public_url: string; name: string; type: string; size?: number; }
export interface FormInput { title: string; category: string; code?: string; description: string; fields: string[]; download_name?: string; files: FormFileInput[]; }

export const formFileMime: Record<string, string> = {
	jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel'
};
export const maxFormFileSize = 10 * 1024 * 1024;

export function fileExtension(name: string) { return name.split('.').pop()?.toLowerCase() ?? ''; }
export function isPreviewFile(name: string) { return ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(fileExtension(name)); }
export function originalFileName(path: string | null, fallback = 'form-file') {
	if (!path) return fallback;
	const match = path.match(/--([A-Za-z0-9_-]+)$/);
	if (match) { try { const metadata = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')); if (typeof metadata.name === 'string') return metadata.name; return Buffer.from(match[1], 'base64url').toString('utf8'); } catch { /* use safe stored component */ } }
	return path.split('/').pop()?.replace(/^\d+-/, '') ?? fallback;
}
export function originalFileSize(path: string | null): number | undefined {
	if (!path) return undefined;
	const match = path.match(/--([A-Za-z0-9_-]+)$/);
	if (!match) return undefined;
	try { const metadata = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')); return Number.isFinite(metadata.size) ? Number(metadata.size) : undefined; } catch { return undefined; }
}

export function slugName(title: string) {
	const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	return `ESSU-${slug || 'form'}`;
}

export function validate(body: Record<string, unknown>): string | null {
	if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) return 'Title is required and must be at most 200 characters.';
	if (typeof body.category !== 'string' || !body.category.trim()) return 'Category is required.';
	if (body.code != null && typeof body.code !== 'string') return 'Code must be text.';
	if (typeof body.description !== 'string' || body.description.length > 4000) return 'Description must be at most 4000 characters.';
	if (!Array.isArray(body.fields) || body.fields.length > 30 || body.fields.some((v) => typeof v !== 'string' || v.length > 80)) return 'Fields must be an array of up to 30 strings, each at most 80 characters.';
	if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > 5) return 'Add between 1 and 5 files.';
	for (const file of body.files) {
		if (!file || typeof file !== 'object' || !Number.isInteger(file.page_no) || file.page_no < 0 || typeof file.public_url !== 'string' || !file.public_url.trim() || !(file.storage_path === null || typeof file.storage_path === 'string') || typeof file.name !== 'string' || !file.name.trim()) return 'Each file needs a name, page order and a valid URL.';
		const ext = fileExtension(file.name);
		if (!formFileMime[ext] || file.type !== formFileMime[ext] || (file.size != null && (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxFormFileSize))) return `Unsupported file ${file.name}. Use JPG, PNG, WebP, PDF, DOCX, DOC, XLSX or XLS up to 10 MB.`;
	}
	return null;
}

export async function insertFiles(conn: PoolConnection, id: number, files: FormFileInput[]) {
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		await conn.execute('INSERT INTO form_files (form_id, page_no, storage_path, public_url) VALUES (?, ?, ?, ?)', [id, i + 1, file.storage_path, file.public_url]);
	}
}
