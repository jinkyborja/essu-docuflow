export function formatName(first: unknown, middle: unknown, last: unknown): string {
	const clean = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
	return [clean(first), clean(middle), clean(last)]
		.filter(Boolean).join(' ');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	return count === 1 ? singular : plural;
}
