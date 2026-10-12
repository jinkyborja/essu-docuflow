import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = false;

// Universal load protects both direct requests and client-side navigation.
export const load: PageLoad = () => {
	if (!import.meta.env.DEV) error(404, 'Not found');
	return {};
};
