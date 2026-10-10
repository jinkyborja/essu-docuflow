import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { validateSchoolYear } from '$lib/school-year';

export const GET: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (payload.role === 'Student') return json({ error: 'Forbidden' }, { status: 403 });

	const [rows] = await pool.execute(
		`SELECT user_id, first_name, middle_name, last_name, suffix, email,
		        student_id, program, student_type, last_school_year, verified, id_status, id_verified_at, id_reject_reason, date_of_birth, date_registered
		 FROM users
		 WHERE role = 'Student'
		 ORDER BY last_name ASC`
	);

	return json(rows);
};

export const PATCH: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!['Staff', 'Admin'].includes(payload.role)) return json({ error: 'Forbidden' }, { status: 403 });

	const body = await request.json();
	const {
		user_id, first_name, middle_name, last_name, suffix,
		email, student_id, program, student_type, last_school_year, verified
	} = body;
	const validTypes = ['Enrolled', 'Former', 'Alumni'];
	if (student_type != null && !validTypes.includes(student_type)) {
		return json({ error: 'Invalid student type' }, { status: 400 });
	}
	const yearError = validateSchoolYear(last_school_year, student_type);
	if (yearError) return json({ error: yearError }, { status: 400 });

	await pool.execute(
		`UPDATE users
		 SET first_name = ?, middle_name = ?, last_name = ?, suffix = ?,
		     email = ?, student_id = ?, program = ?, student_type = ?,
		     last_school_year = ?, verified = ?
		 WHERE user_id = ? AND role = 'Student'`,
		[first_name, middle_name ?? null, last_name, suffix ?? null,
		 email, student_id ?? null, program ?? null, student_type ?? null,
		 last_school_year ?? null, verified ? 1 : 0, user_id]
	);

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// The UI only offers this to admins; enforce it here too.
	if (payload.role !== 'Admin') return json({ error: 'Admin access required' }, { status: 403 });

	const { user_id } = await request.json();
	if (!user_id) return json({ error: 'Missing user_id' }, { status: 400 });

	// Confirm the target is actually a student before touching anything.
	const [targetRows] = await pool.execute(
		`SELECT user_id FROM users WHERE user_id = ? AND role = 'Student'`,
		[user_id]
	);
	if ((targetRows as unknown[]).length === 0) {
		return json({ error: 'Student not found' }, { status: 404 });
	}

	// requests.student_id and request_status_history.request_id both have foreign
	// keys, so a bare DELETE on users fails for any student who ever made a
	// request. Remove the dependent rows first, inside a transaction.
	const conn = await pool.getConnection();
	let filePaths: string[] = [];
	let deletedRequests = 0;
	try {
		await conn.beginTransaction();
		// Lock the account while collecting and deleting its requests.
		const [lockedRows] = await conn.execute("SELECT user_id FROM users WHERE user_id = ? AND role = 'Student' FOR UPDATE", [user_id]);
		if ((lockedRows as unknown[]).length === 0) {
			await conn.rollback();
			return json({ error: 'Student not found' }, { status: 404 });
		}
		const [reqRows] = await conn.execute(
			'SELECT request_id, approved_file_path FROM requests WHERE student_id = ?',
			[user_id]
		);
		const requests = reqRows as Record<string, unknown>[];

		// Collect the student's uploaded files so storage doesn't keep orphans.
		const requestIds = requests.map((r) => r.request_id as string);
		// Use the checked-out connection: a pool query here waits forever when
		// the pool has only one connection.
		if (requestIds.length > 0) {
			const marks = requestIds.map(() => '?').join(',');
			const [fileRows] = await conn.execute(
				`SELECT file_path FROM request_requirements WHERE request_id IN (${marks}) AND file_path IS NOT NULL`, requestIds
			);
			filePaths = (fileRows as Array<{ file_path: string }>).map(row => row.file_path);
		}
		for (const r of requests) {
			if (r.approved_file_path) filePaths.push(r.approved_file_path as string);
		}

		if (requests.length > 0) {
			const ids = requests.map((r) => r.request_id as string);
			const marks = ids.map(() => '?').join(',');
			await conn.execute(
				`DELETE FROM request_status_history WHERE request_id IN (${marks})`,
				ids
			);
			// Status changes made by this user on any request (not just their own).
			await conn.execute('DELETE FROM request_status_history WHERE changed_by = ?', [user_id]);
			await conn.execute(`DELETE FROM requests WHERE student_id = ?`, [user_id]);
		} else {
			await conn.execute('DELETE FROM request_status_history WHERE changed_by = ?', [user_id]);
		}
		await conn.execute(`DELETE FROM users WHERE user_id = ? AND role = 'Student'`, [user_id]);
		await conn.commit();
		deletedRequests = requests.length;
	} catch (err) {
		await conn.rollback();
		console.error('Student delete failed:', err);
		return json({ error: 'Could not delete student. Please try again.' }, { status: 500 });
	} finally {
		conn.release();
	}
	// Do not hold the only DB connection during an external storage request.
	// Cleanup failure must not turn an already committed deletion into an error.
	if (filePaths.length > 0) {
		try {
			const { error: storageError } = await supabase.storage.from('requirements').remove([...new Set(filePaths)]);
			if (storageError) console.error('Storage cleanup failed after student delete:', storageError);
		} catch (err) {
			console.error('Storage cleanup failed after student delete:', err);
		}
	}
	return json({ success: true, deleted_requests: deletedRequests });
};
