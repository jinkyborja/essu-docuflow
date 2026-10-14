import { fail } from '@sveltejs/kit';
import { JWT_SECRET } from '$env/static/private';
import type { Actions, PageServerLoad } from './$types';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { formatName } from '$lib/formatting';
import { logActivity } from '$lib/server/activity-log';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';

type StaffAccountRow = RowDataPacket & {
	user_id: number;
	first_name: string;
	middle_name: string | null;
	last_name: string;
	role: string;
};

type ReferenceColumnRow = RowDataPacket & {
	TABLE_NAME: string;
	COLUMN_NAME: string;
};

function quoteIdentifier(identifier: string): string {
	return `\`${identifier.replace(/`/g, '``')}\``;
}

async function hasUserReferences(conn: PoolConnection, userId: number): Promise<boolean> {
	const references = new Map<string, Set<string>>();
	const addReference = (tableName: string, columnName: string) => {
		const columns = references.get(tableName) ?? new Set<string>();
		columns.add(columnName);
		references.set(tableName, columns);
	};

	const [foreignKeyRows] = await conn.execute(
		`SELECT TABLE_NAME, COLUMN_NAME
		 FROM information_schema.KEY_COLUMN_USAGE
		 WHERE TABLE_SCHEMA = DATABASE()
		   AND REFERENCED_TABLE_SCHEMA = DATABASE()
		   AND REFERENCED_TABLE_NAME = 'users'
		   AND REFERENCED_COLUMN_NAME = 'user_id'`
	);
	for (const reference of foreignKeyRows as ReferenceColumnRow[]) {
		addReference(reference.TABLE_NAME, reference.COLUMN_NAME);
	}

	const [columnRows] = await conn.execute(
		`SELECT TABLE_NAME, COLUMN_NAME
		 FROM information_schema.COLUMNS
		 WHERE TABLE_SCHEMA = DATABASE()`
	);
	for (const reference of columnRows as ReferenceColumnRow[]) {
		const tableName = reference.TABLE_NAME.toLowerCase();
		const columnName = reference.COLUMN_NAME.toLowerCase();
		const isUserReference = columnName === 'user_id'
			|| columnName.endsWith('_user_id')
			|| columnName.endsWith('_by')
			|| columnName === 'staff_id'
			|| columnName === 'admin_id'
			|| columnName.endsWith('_staff_id')
			|| columnName.endsWith('_admin_id')
			|| columnName.endsWith('_actor_id');
		if (isUserReference && !(tableName === 'users' && columnName === 'user_id')) {
			addReference(reference.TABLE_NAME, reference.COLUMN_NAME);
		}
	}

	for (const [tableName, columnNames] of references) {
		for (const columnName of columnNames) {
			const [rows] = await conn.execute(
				`SELECT 1
				 FROM ${quoteIdentifier(tableName)}
				 WHERE ${quoteIdentifier(columnName)} = ?
				 LIMIT 1`,
				[userId]
			);
			if ((rows as RowDataPacket[]).length > 0) return true;
		}
	}

	return false;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { role, userId } = await parent();

	if (role !== 'Admin') {
		return { allowed: false, staff: [] };
	}

	const [rows] = await pool.execute(
		`SELECT user_id, first_name, middle_name, last_name, email, role, position, date_registered
		 FROM users
		 WHERE role IN ('Staff', 'Admin')
		 ORDER BY role ASC, last_name ASC`
	);

	return { allowed: true, staff: rows, currentUserId: userId };
};

export const actions = {
	delete: async ({ request, cookies }) => {
		const token = cookies.get('session');
		if (!token) return fail(401, { deleteError: 'Sign in as an administrator to delete staff.' });

		let actor: Awaited<ReturnType<typeof verifySession>>;
		try {
			actor = await verifySession(token, JWT_SECRET);
		} catch {
			return fail(401, { deleteError: 'Your session is invalid or expired. Sign in again.' });
		}
		const { role, userId } = actor;
		if (role !== 'Admin') return fail(403, { deleteError: 'Administrator access is required.' });

		const formData = await request.formData();
		const rawUserId = formData.get('user_id');
		if (typeof rawUserId !== 'string' || !/^\d+$/.test(rawUserId)) {
			return fail(400, { deleteError: 'Invalid staff member.' });
		}

		const targetUserId = Number(rawUserId);
		if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
			return fail(400, { deleteError: 'Invalid staff member.' });
		}
		if (targetUserId === userId) {
			return fail(400, { deleteError: 'You cannot delete your own account.' });
		}

		let conn: PoolConnection | undefined;
		let transactionOpen = false;
		try {
			conn = await pool.getConnection();
			await conn.beginTransaction();
			transactionOpen = true;

			const [staffRows] = await conn.execute(
				`SELECT user_id, first_name, middle_name, last_name, role
				 FROM users
				 WHERE user_id = ?
				 FOR UPDATE`,
				[targetUserId]
			);
			const staff = (staffRows as StaffAccountRow[])[0];
			if (!staff) {
				await conn.rollback();
				transactionOpen = false;
				return fail(404, { deleteError: 'Staff member not found.' });
			}
			if (staff.role !== 'Staff') {
				await conn.rollback();
				transactionOpen = false;
				return fail(409, { deleteError: 'Only staff accounts can be deleted.' });
			}

			if (await hasUserReferences(conn, targetUserId)) {
				await conn.rollback();
				transactionOpen = false;
				return fail(409, {
					deleteError: 'This staff member has activity in the system and cannot be deleted. Their history must stay intact.'
				});
			}

			const fullName = formatName(staff.first_name, staff.middle_name, staff.last_name);
			const [deleteResult] = await conn.execute<ResultSetHeader>(
				`DELETE FROM users WHERE user_id = ? AND role = 'Staff'`,
				[targetUserId]
			);
			if (deleteResult.affectedRows !== 1) {
				await conn.rollback();
				transactionOpen = false;
				return fail(409, { deleteError: 'The staff account changed and could not be deleted.' });
			}

			await logActivity(conn, {
				actor: { userId, role },
				action: 'staff_deleted',
				entityType: 'user',
				entityId: targetUserId,
				summary: `Deleted staff account: ${fullName}`
			});
			await conn.commit();
			transactionOpen = false;
			return { deletedUserId: targetUserId };
		} catch (error) {
			if (conn && transactionOpen) {
				try {
					await conn.rollback();
				} catch (rollbackError) {
					console.error('Could not roll back staff deletion:', rollbackError);
				}
			}
			console.error('Staff deletion failed:', error);
			return fail(500, { deleteError: 'Could not delete staff member. Please try again.' });
		} finally {
			conn?.release();
		}
	}
} satisfies Actions;
