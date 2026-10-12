import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';
import { timedLoad, timedQuery } from '$lib/server/timing';

export const load: PageServerLoad = ({ parent }) => timedLoad('staff/students', async () => {
	const { role } = await parent();

	if (!['Admin', 'Staff'].includes(role)) {
		return { allowed: false, students: [] };
	}

	const [rows] = await timedQuery('staff/students:list', () => pool.execute(
		`SELECT user_id, first_name, middle_name, last_name, suffix, email,
	        student_id, program, campus, student_type, last_school_year, verified, id_status, id_verified_at, id_reject_reason,
	        date_of_birth, date_registered
		 FROM users
		 WHERE role = 'Student'
		 ORDER BY last_name ASC`
	));

	return { allowed: true, role, students: rows };
});
