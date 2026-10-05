import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';

export const load: PageServerLoad = async ({ parent }) => {
	const { role, userId } = await parent();

	if (role !== 'Admin') {
		return { allowed: false, staff: [] };
	}

	const [rows] = await pool.execute(
		`SELECT user_id, first_name, last_name, email, role, position, date_registered
		 FROM users
		 WHERE role IN ('Staff', 'Admin')
		 ORDER BY role ASC, last_name ASC`
	);

	return { allowed: true, staff: rows, currentUserId: userId };
};
