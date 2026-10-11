import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// The component gallery is a local development tool, never a public production page.
export const load: PageLoad = () => {
	if (!import.meta.env.DEV) error(404, 'Page not found');
	return {};
};
