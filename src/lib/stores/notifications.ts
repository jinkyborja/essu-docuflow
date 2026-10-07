import { invalidateAll } from '$app/navigation';
import { writable } from 'svelte/store';

export const unreadCount = writable(0);
// Keep the existing store name working for callers while layouts migrate.
export const notifUnreadCount = unreadCount;

export type ReadGroup = { type: 'student-history' | 'history' | 'request'; ids: Array<string | number> };

let channel: BroadcastChannel | undefined;
let interval: ReturnType<typeof setInterval> | undefined;
let inFlight = false;
let listenersInstalled = false;

function publishCount(count: number) {
	const normalized = Math.max(0, count);
	unreadCount.set(normalized);
	channel?.postMessage({ unreadCount: normalized });
}

function onVisibilityChange() {
	if (document.visibilityState === 'visible') void refresh();
}

function onFocus() {
	if (document.visibilityState === 'visible') void refresh();
}

/** Re-run authenticated SvelteKit loads, which provide the current count and list data. */
export async function refresh() {
	if (typeof document === 'undefined' || document.visibilityState !== 'visible' || inFlight) return;
	inFlight = true;
	try {
		await invalidateAll();
	} finally {
		inFlight = false;
	}
}

/** Start one polling/listener lifecycle for an authenticated portal layout. */
export function startNotifications(initialCount = 0) {
	if (typeof window === 'undefined') return () => {};
	publishCount(initialCount);
	if (!listenersInstalled) {
		listenersInstalled = true;
		if ('BroadcastChannel' in window) {
			channel = new BroadcastChannel('notifications');
			channel.onmessage = (event: MessageEvent<{ unreadCount?: number }>) => {
				if (typeof event.data?.unreadCount === 'number') unreadCount.set(Math.max(0, event.data.unreadCount));
			};
		}
		document.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('focus', onFocus);
		void refresh();
		interval = setInterval(() => {
			if (document.visibilityState === 'visible') void refresh();
		}, 15_000);
	}
	return stopNotifications;
}

export function stopNotifications() {
	if (interval) clearInterval(interval);
	interval = undefined;
	if (listenersInstalled && typeof window !== 'undefined') {
		document.removeEventListener('visibilitychange', onVisibilityChange);
		window.removeEventListener('focus', onFocus);
		channel?.close();
		channel = undefined;
		listenersInstalled = false;
	}
}

async function postRead(group: ReadGroup) {
	if (!group.ids.length) return;
	const response = await fetch('/api/notifications/read', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(group)
	});
	if (!response.ok) throw new Error('Could not mark notifications as read.');
}

export async function markAllRead(groups: ReadGroup[]) {
	let previousCount = 0;
	const unsubscribe = unreadCount.subscribe((value) => (previousCount = value));
	unsubscribe();
	publishCount(0);
	try {
		for (const group of groups) await postRead(group);
		await refresh();
	} catch (error) {
		publishCount(previousCount);
		throw error;
	}
}

export async function markOneRead(group: ReadGroup) {
	let previousCount = 0;
	const unsubscribe = unreadCount.subscribe((value) => (previousCount = value));
	unsubscribe();
	publishCount(Math.max(0, previousCount - group.ids.length));
	try {
		await postRead(group);
		await refresh();
	} catch (error) {
		publishCount(previousCount);
		throw error;
	}
}
