import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Persist sidebar collapse state across navigation
const storedCollapsed = browser ? localStorage.getItem('sidebar-collapsed') === 'true' : false;

export const sidebarCollapsed = writable<boolean>(storedCollapsed);
export const sidebarMobileOpen = writable<boolean>(false);

sidebarCollapsed.subscribe((val) => {
	if (browser) localStorage.setItem('sidebar-collapsed', String(val));
});
