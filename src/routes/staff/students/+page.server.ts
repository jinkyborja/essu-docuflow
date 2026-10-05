import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';

export const load: PageServerLoad = async ({ parent }) => {
	const { role } = await parent();

	if (role !== 'Admin') {
		return { allowed: false, students: [] };
	}

	const [rows] = await pool.execute(
		`SELECT user_id, first_name, middle_name, last_name, suffix, email,
		        student_id, program, student_type, last_school_year, verified, date_registered
		 FROM users
		 WHERE role = 'Student'
		 ORDER BY last_name ASC`
	);

	return { allowed: true, students: rows };
};
