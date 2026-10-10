export const REQUIREMENT_FILE_MAX_SIZE = 10 * 1024 * 1024;
const mimeTypes: Record<string, string> = {
	jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf',
	webp: 'image/webp', heic: 'image/heic', heif: 'image/heif'
};

export function validateRequirementFileMetadata(name: unknown, type: unknown, size: unknown): string | null {
	if (typeof name !== 'string' || !name || typeof type !== 'string' || typeof size !== 'number' || !Number.isInteger(size) || size <= 0) return 'Choose a nonempty requirement file.';
	if (size > REQUIREMENT_FILE_MAX_SIZE) return 'Requirement files must be 10 MB or smaller.';
	const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
	return mimeTypes[extension] && type === mimeTypes[extension] ? null : 'Unsupported file extension or MIME type.';
}

export function requirementNeedsCorrection(status: string): boolean {
	return status.trim().toLowerCase().replace(/\s+/g, '_') === 'correction_requested';
}

export function canUpdateRequirementFiles(status: string): boolean {
	return status.trim().toLowerCase() === 'pending' || requirementNeedsCorrection(status);
}
