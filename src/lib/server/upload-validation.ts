// Check metadata before reading even a small prefix of an uploaded file.
export const maxUploadSize = 10 * 1024 * 1024;
const types: Record<string, string> = {
	pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
	webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
	doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

export async function validateUpload(value: unknown, office = false): Promise<{ error: string; status: number } | null> {
	if (!(value instanceof File) || value.size === 0) return { error: 'A nonempty file is required.', status: 400 };
	if (value.size > maxUploadSize) return { error: 'Files must be 10 MiB or smaller.', status: 413 };
	const ext = value.name.split('.').pop()?.toLowerCase() ?? '';
	if (!types[ext] || (!office && ['doc', 'docx'].includes(ext)) || value.type !== types[ext]) {
		return { error: 'Unsupported file extension or MIME type.', status: 400 };
	}
	const prefix = Buffer.from(await value.slice(0, 32).arrayBuffer());
	const hex = prefix.toString('hex');
	const text = prefix.toString('ascii');
	const valid = ext === 'pdf' ? text.startsWith('%PDF-')
		: ['jpg', 'jpeg'].includes(ext) ? hex.startsWith('ffd8ff')
		: ext === 'png' ? hex.startsWith('89504e470d0a1a0a')
		: ext === 'webp' ? text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP'
		: ['heic', 'heif'].includes(ext) ? text.slice(4, 8) === 'ftyp' && /heic|heix|hevc|hevx|mif1|msf1/.test(text.slice(8))
		: ext === 'doc' ? hex.startsWith('d0cf11e0a1b11ae1')
		: hex.startsWith('504b0304');
	return valid ? null : { error: 'File content does not match its declared type.', status: 400 };
}
