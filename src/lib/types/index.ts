// Shared UI types.
//
// Server loads and API routes return raw DB rows (typed as Record<string, unknown>),
// so this file only holds types the presentational components actually need. It
// deliberately mirrors the live schema in database/db.sql — if you change an ENUM
// there, change it here.

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Mirrors the `requests.status` ENUM in database/db.sql. */
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Correction Requested';

/**
 * Lowercased form of RequestStatus. Pages call `.toLowerCase()` before passing a
 * status to <Badge>, which keys its colour map on these.
 */
export type RequestStatusKey = 'pending' | 'approved' | 'rejected' | 'correction requested';

/** Mirrors the `users.role` ENUM in database/db.sql. */
export type UserRole = 'Student' | 'Staff' | 'Admin';

/** Mirrors the `users.student_type` ENUM in database/db.sql. */
export type StudentType = 'Enrolled' | 'Supplemental' | 'Former' | 'Alumni';

/** Notification categories derived in the notifications pages. */
export type NotificationType = 'request' | 'task' | 'system';

// ─── Component models ─────────────────────────────────────────────────────────

export interface TimelineEvent {
	date: string;
	title: string;
	description?: string;
	status: 'completed' | 'current' | 'pending';
}
