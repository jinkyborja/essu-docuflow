export function formatFileSize(bytes: number) {
	return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export async function downloadStudentFile(url: string, name: string) {
	const response = await fetch(url);
	if (!response.ok) throw new Error('Could not download ' + name + '. Please try again.');
	const objectUrl = URL.createObjectURL(await response.blob());
	const link = document.createElement('a'); link.href = objectUrl; link.download = name; link.click();
	setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
export async function studentFileUrl(path: string) {
	const response = await fetch('/api/storage?bucket=requirements&path=' + encodeURIComponent(path));
	const result = await response.json();
	if (!response.ok || !result.url) throw new Error(result.error ?? 'Could not open this file. Please try again.');
	return result.url as string;
}
