import { writable } from 'svelte/store';
export const browser = true;
export const page = writable({ url: new URL(location.href), state: {} });
export function replaceState(url, state) { history.replaceState(state, '', url); }
export async function goto() { throw new Error('Unexpected navigation in action menu fixture'); }
export async function invalidateAll() {}
