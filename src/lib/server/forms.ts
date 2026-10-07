import type { PoolConnection } from 'mysql2/promise';

export interface FormFileInput { page_no: number; storage_path: string | null; public_url: string; }
export interface FormInput { title: string; category: string; code?: string; description: string; fields: string[]; download_name?: string; files: FormFileInput[]; }

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
		if (!file || typeof file !== 'object' || !Number.isInteger(file.page_no) || file.page_no < 1 || typeof file.public_url !== 'string' || !file.public_url.trim() || !(file.storage_path === null || typeof file.storage_path === 'string')) return 'Each file needs a page number and a valid URL.';
	}
	return null;
}

export async function insertFiles(conn: PoolConnection, id: number, files: FormFileInput[]) {
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		await conn.execute('INSERT INTO form_files (form_id, page_no, storage_path, public_url) VALUES (?, ?, ?, ?)', [id, i + 1, file.storage_path, file.public_url]);
	}
}
