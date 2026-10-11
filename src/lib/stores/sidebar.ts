import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Persist sidebar collapse state across navigation
let storedCollapsed = false;
if (browser) { try { storedCollapsed = localStorage.getItem('sidebar-collapsed') === 'true'; } catch { /* Storage may be unavailable in private browsing. */ } }

export const sidebarCollapsed = writable<boolean>(storedCollapsed);
export const sidebarMobileOpen = writable<boolean>(false);

sidebarCollapsed.subscribe((val) => {
	if (browser) { try { localStorage.setItem('sidebar-collapsed', String(val)); } catch { /* The navigation still works without persistence. */ } }
});
