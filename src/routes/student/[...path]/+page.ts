import { error } from '@sveltejs/kit';

// See staff/[...path]/+page.ts — keeps the student sidebar visible on 404.
export function load() {
	error(404, 'Page not found');
}
