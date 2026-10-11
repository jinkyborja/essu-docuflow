export function formatName(first: unknown, middle: unknown, last: unknown): string {
	const clean = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
	const middleName = clean(middle);
	return [clean(first), middleName ? `${Array.from(middleName)[0].toUpperCase()}.` : '', clean(last)]
		.filter(Boolean).join(' ');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	return count === 1 ? singular : plural;
}
