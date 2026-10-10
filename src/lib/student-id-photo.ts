export const STUDENT_ID_PHOTO_MAX_SIZE = 5 * 1024 * 1024;
export const STUDENT_ID_PHOTO_URL_TTL = 60;

const imageTypes: Record<string, string> = {
	jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'
};

export function validateStudentIdPhoto(value: unknown): string | null {
	if (!(value instanceof File) || value.size === 0) return 'Choose a nonempty school ID photo.';
	return validateStudentIdPhotoMetadata(value.name, value.type, value.size);
}

export function validateStudentIdPhotoMetadata(name: unknown, type: unknown, size: unknown): string | null {
	if (typeof name !== 'string' || typeof type !== 'string' || typeof size !== 'number' || !Number.isInteger(size) || size <= 0) return 'Choose a nonempty school ID photo.';
	if (size > STUDENT_ID_PHOTO_MAX_SIZE) return 'The ID photo must be 5 MB or smaller.';
	const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
	if (!imageTypes[extension] || type !== imageTypes[extension]) {
		return 'Choose a JPG, PNG or WebP photo with a matching file extension and MIME type.';
	}
	return null;
}
