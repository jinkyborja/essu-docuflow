export type ActivityDetailsInput = {
	action: string;
	summary: string;
	entityId: string | number | null;
	metadata: unknown;
};

export type ActivityDetailSection = {
	label: string;
	values: string[];
};

const changedFieldLabels: Record<string, string> = {
	verified: 'Email verification status',
	email: 'Email',
	id_status: 'Student ID status',
	id_verified_at: 'ID verification date',
	id_reject_reason: 'ID rejection reason',
	id_verification_note: 'ID review note',
	id_photo_path: 'Student ID photo',
	id_photo_uploaded_at: 'Student ID photo upload date',
	id_photo: 'Student ID photo',
	'student account': 'Student account',
	requests: 'Requests',
	'request history': 'Request history',
	first_name: 'First name',
	middle_name: 'Middle name',
	last_name: 'Last name',
	suffix: 'Name suffix',
	date_of_birth: 'Date of birth',
	student_id: 'Student ID',
	program: 'Program',
	student_type: 'Student type',
	last_school_year: 'Last school year',
	campus: 'Campus',
	position: 'Position',
	role: 'Role',
	staff: 'Staff account',
	invitation: 'Invitation',
	requirements: 'Requirements',
	status: 'Status',
	document: 'Document',
	name: 'Name',
	template: 'Template',
	form: 'Form',
	'form fields': 'Form fields',
	files: 'Files',
	'masterlist entry': 'Masterlist entry',
	'masterlist entries': 'Masterlist entries',
	request: 'Request',
	'request items': 'Request items',
	admin_message: 'Office message',
	decided_by: 'Decision maker',
	decided_at: 'Decision time',
	approved_file: 'Approved file',
	flagged_requirements: 'Flagged requirements',
	'pickup availability': 'Pickup availability',
	archived_at: 'Archive date',
	archived_by: 'Archived by'
};

const componentActions = new Set([
	'student.registered', 'student.deleted', 'masterlist.imported', 'masterlist.entry.deleted',
	'masterlist.cleared', 'request.submitted', 'request.deleted', 'document.created',
	'document.deleted', 'form.created', 'form.deleted', 'staff.invited',
	'staff.invite.accepted', 'staff.removed'
]);

const redundantFieldsByAction: Record<string, ReadonlySet<string>> = {
	'account.email.changed': new Set(['email']),
	'account.email.verified': new Set(['verified']),
	'account.password.changed': new Set(['password']),
	'request.submitted': new Set(['request']),
	'request.approved': new Set(['status']),
	'request.rejected': new Set(['status']),
	'request.correction_requested': new Set(['status']),
	'request.ready_for_pickup': new Set(['status']),
	'request.released': new Set(['status']),
	'request.cancelled': new Set(['status']),
	'staff.invited': new Set(['role'])
};

const sensitiveFields = new Set([
	'password', 'password_hash', 'token', 'session', 'auth_version'
]);

function parseMetadata(value: unknown): Record<string, unknown> | null {
	let parsed = value;
	if (typeof parsed === 'string') {
		try { parsed = JSON.parse(parsed); }
		catch { return null; }
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
	return parsed as Record<string, unknown>;
}

function relatedIds(value: unknown, summary: string, entityId: string | number | null): string[] {
	if (!Array.isArray(value)) return [];
	const summaryLower = summary.toLowerCase();
	const excludedEntityId = entityId == null ? '' : String(entityId);
	const summaryContainsId = (id: string) => new RegExp(`(^|\\D)${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\D)`, 'i').test(summaryLower);
	return [...new Set(value
		.filter((item): item is string | number => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)))
		.map(String)
		.filter(id => /^(?:0|[1-9]\d{0,14})$/.test(id) && id !== excludedEntityId && !summaryContainsId(id)))];
}

export function formatActivityDetails(input: ActivityDetailsInput): ActivityDetailSection[] {
	const metadata = parseMetadata(input.metadata);
	if (!metadata) return [];

	const sections: ActivityDetailSection[] = [];
	const changedFields = Array.isArray(metadata.changedFields)
		? [...new Set(metadata.changedFields.filter((field): field is string => typeof field === 'string'))]
			.filter(field => Object.hasOwn(changedFieldLabels, field) && !sensitiveFields.has(field))
			.filter(field => !redundantFieldsByAction[input.action]?.has(field))
			.map(field => changedFieldLabels[field])
		: [];
	if (changedFields.length) {
		sections.push({
			label: componentActions.has(input.action) ? 'Affected components' : 'Affected fields',
			values: changedFields
		});
	}

	const ids = relatedIds(metadata.ids, input.summary, input.entityId);
	if (ids.length) {
		sections.push({
			label: input.action === 'request.submitted' ? 'Related document IDs' : 'Related IDs',
			values: ids
		});
	}

	return sections;
}
