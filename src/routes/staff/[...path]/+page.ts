import { error } from '@sveltejs/kit';

// Catch-all so unknown /staff/* URLs still render inside the staff layout
// (sidebar + topbar) via staff/+error.svelte. Without a matching route,
// SvelteKit runs no layout and falls back to the bare root error page.
// Concrete routes take precedence over this rest parameter.
export function load() {
	error(404, 'Page not found');
}
