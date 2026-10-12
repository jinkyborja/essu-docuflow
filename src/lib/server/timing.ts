function timingEnabled(): boolean {
	return process.env.DEBUG_TIMING === '1';
}

function logTiming(kind: 'query' | 'load', label: string, startedAt: number): void {
	console.log(`[timing] ${kind} ${label} ${(performance.now() - startedAt).toFixed(1)}ms`);
}

export async function timedQuery<T>(label: string, fn: () => Promise<T>): Promise<T> {
	if (!timingEnabled()) return fn();
	const startedAt = performance.now();
	try {
		return await fn();
	} finally {
		logTiming('query', label, startedAt);
	}
}

export async function timedLoad<T>(label: string, fn: () => Promise<T>): Promise<T> {
	if (!timingEnabled()) return fn();
	const startedAt = performance.now();
	try {
		return await fn();
	} finally {
		logTiming('load', label, startedAt);
	}
}
