import { validateRequirementFileMetadata } from '$lib/requirement-files';

export async function uploadRequirementFiles(files: Record<string, File | null>, context: { documentIds?: number[]; requestId?: string }): Promise<Array<{ requirementName: string; uploadToken: string }>> {
	const selected = Object.entries(files).filter((entry): entry is [string, File] => entry[1] instanceof File);
	if (!selected.length) return [];
	for (const [name, file] of selected) {
		const invalid = validateRequirementFileMetadata(file.name, file.type, file.size);
		if (invalid) throw new Error(`${name}: ${invalid}`);
	}
	const response = await fetch('/api/requests/upload-url', {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...context, files: selected.map(([requirementName, file]) => ({ requirementName, name: file.name, type: file.type, size: file.size })) })
	});
	const result = await response.json();
	if (!response.ok) throw new Error(result.error ?? 'Could not start the file upload.');
	const manifest: Array<{ requirementName: string; uploadToken: string }> = [];
	for (const upload of result.uploads) {
		const file = files[upload.requirementName];
		if (!file) throw new Error('A selected requirement file is missing.');
		const body = new FormData(); body.append('cacheControl', '0'); body.append('', file);
		const stored = await fetch(upload.signedUrl, { method: 'PUT', body });
		if (!stored.ok) throw new Error(`${upload.requirementName}: file upload failed. Please try again.`);
		manifest.push({ requirementName: upload.requirementName, uploadToken: upload.uploadToken });
	}
	return manifest;
}
