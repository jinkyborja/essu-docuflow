import type { PoolConnection } from 'mysql2/promise';

export type ActivityActor = { userId: number; role: string };
export type ActivityDetails = { ids?: Array<string | number>; changedFields?: string[] };
export type ActivityInput = {
	actor: ActivityActor;
	action: string;
	entityType: string;
	entityId: string | number | null;
	summary: string;
	details?: ActivityDetails;
};

export const activityActionLabels: Record<string, string> = {
	'student.registered': 'Student registered',
	'student.id.verified': 'Student ID verified',
	'student.id.rejected': 'Student ID rejected',
	'student.id.revoked': 'Student ID verification revoked',
	'student.id.review_requested': 'Student ID review requested',
	'student.edited': 'Student details edited',
	'student.deleted': 'Student deleted',
	'masterlist.imported': 'Masterlist imported',
	'masterlist.entry.deleted': 'Masterlist entry deleted',
	'masterlist.cleared': 'Masterlist cleared',
	'request.submitted': 'Request submitted',
	'request.approved': 'Request approved',
	'request.rejected': 'Request rejected',
	'request.correction_requested': 'Correction requested',
	'request.files_replaced': 'Request files replaced',
	'request.ready_for_pickup': 'Request ready for pickup',
	'request.released': 'Request released',
	'request.deleted': 'Request deleted',
	'document.created': 'Document created',
	'document.edited': 'Document edited',
	'document.deleted': 'Document deleted',
	'form.created': 'Form created',
	'form.edited': 'Form edited',
	'form.deleted': 'Form deleted',
	'staff.invited': 'Staff invited',
	'staff.edited': 'Staff account edited',
	'staff.removed': 'Staff account removed',
	'account.email.changed': 'Email changed',
	'account.email.verified': 'Email verified',
	'account.password.changed': 'Password changed',
	'account.personal.edited': 'Personal details edited',
	'account.academic.edited': 'Academic details edited',
	'account.professional.edited': 'Professional details edited',
	'student.id_photo.replaced': 'Student ID photo updated',
	'staff.invite.accepted': 'Staff invitation accepted',
	'notifications.read': 'Notifications marked as read'
};

export async function logActivity(conn: PoolConnection, input: ActivityInput): Promise<void> {
	const [actorRows] = await conn.execute(
		`SELECT TRIM(CONCAT_WS(' ', first_name, middle_name, last_name, suffix)) AS actor_name, role AS actor_role
		 FROM users WHERE user_id = ?`,
		[input.actor.userId]
	);
	const actor = (actorRows as Array<{ actor_name: string; actor_role: string }>)[0];
	if (!actor) throw new Error(`Activity actor ${input.actor.userId} no longer exists`);

	const details: ActivityDetails = {};
	if (input.details?.ids?.length) details.ids = input.details.ids.map(String);
	if (input.details?.changedFields?.length) details.changedFields = [...new Set(input.details.changedFields)];
	await conn.execute(
		`INSERT INTO activity_log
		 (actor_user_id, actor_name, actor_role, action, entity_type, entity_id, summary, details)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			input.actor.userId,
			actor.actor_name,
			actor.actor_role,
			input.action,
			input.entityType,
			input.entityId === null ? null : String(input.entityId),
			input.summary,
			JSON.stringify(details)
		]
	);
}

export function activityDateKey(date = new Date()): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
	}).formatToParts(date);
	const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
	return `${part('year')}-${part('month')}-${part('day')}`;
}

function shiftDateKey(value: string, offset: number): string {
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day + offset));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function activityDateBoundary(value: string): string {
	return `${value} 00:00:00`;
}

export function activityFilters(params: URLSearchParams) {
	const today = activityDateKey();
	const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') ?? '')
		? params.get('from')!
		: shiftDateKey(today, -6);
	const to = /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') ?? '')
		? params.get('to')!
		: today;
	const person = /^\d+$/.test(params.get('person') ?? '') ? params.get('person')! : '';
	const role = ['Admin', 'Staff', 'Student'].includes(params.get('role') ?? '') ? params.get('role')! : '';
	const action = params.get('action') && activityActionLabels[params.get('action')!] ? params.get('action')! : '';
	const search = (params.get('search') ?? '').trim().slice(0, 200);
	const clauses = [
		"created_at >= CONVERT_TZ(?, '+08:00', @@session.time_zone)",
		"created_at < CONVERT_TZ(?, '+08:00', @@session.time_zone)"
	];
	const args: Array<string | number> = [
		activityDateBoundary(from),
		activityDateBoundary(shiftDateKey(to, 1))
	];
	if (from > to) {
		clauses.splice(0, 2, '1 = 0');
		args.splice(0, 2);
	}
	if (person) { clauses.push('actor_user_id = ?'); args.push(Number(person)); }
	if (role) { clauses.push('actor_role = ?'); args.push(role); }
	if (action) { clauses.push('action = ?'); args.push(action); }
	if (search) {
		const pattern = `%${search}%`;
		clauses.push('(actor_name LIKE ? OR action LIKE ? OR entity_type LIKE ? OR entity_id LIKE ? OR summary LIKE ? OR CAST(details AS CHAR) LIKE ?)');
		args.push(pattern, pattern, pattern, pattern, pattern, pattern);
	}
	return { from, to, person, role, action, search, where: clauses.join(' AND '), args };
}
