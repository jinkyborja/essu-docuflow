import { writable } from 'svelte/store';
export type ToastMessage = { id: number; message: string; kind: 'success' | 'error' };
export const toasts = writable<ToastMessage[]>([]);
let nextId = 0;
export function dismissToast(id: number) { toasts.update(messages => messages.filter(message => message.id !== id)); }
export function showToast(message: string, kind: ToastMessage['kind'] = 'success') {
	const id = ++nextId;
	toasts.update(messages => [...messages, { id, message, kind }]);
	setTimeout(() => dismissToast(id), 4000);
}
