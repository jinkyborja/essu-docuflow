import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';
import { fetchDocumentRequirements, type RequirementItem } from '$lib/server/requirements';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/login');
	try {
		const p = verifyJwt<{ role: string }>(token, JWT_SECRET);
		if (p.role !== 'Student') redirect(302, '/staff/dashboard');
	} catch { redirect(302, '/login'); }

	const [rows] = await pool.execute(
		'SELECT document_id, name FROM documents ORDER BY name ASC'
	);

	const docs = rows as Array<{ document_id: number; name: string; requirements?: RequirementItem[] }>;
	const reqMap = await fetchDocumentRequirements(docs.map((d) => d.document_id));
	for (const d of docs) d.requirements = reqMap.get(d.document_id) ?? [];

	return { documents: docs };
};
