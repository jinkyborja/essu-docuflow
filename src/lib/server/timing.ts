function timingEnabled(): boolean {
	return process.env.DEBUG_TIMING === '1';
}

function logTiming(kind: 'query' | 'load', label: string, startedAt: number): void {
	console.log(`[timing] ${kind} ${label} ${(performance.now() - startedAt).toFixed(1)}ms`);
}

export async function timedQuery<T>(label: string, query: () => Promise<T>): Promise<T> {
	if (!timingEnabled()) return query();
	const startedAt = performance.now();
	try {
		return await query();
	} finally {
		logTiming('query', label, startedAt);
	}
}

export async function timedLoad<T>(label: string, load: () => Promise<T>): Promise<T> {
	if (!timingEnabled()) return load();
	const startedAt = performance.now();
	try {
		return await load();
	} finally {
		logTiming('load', label, startedAt);
	}
}
