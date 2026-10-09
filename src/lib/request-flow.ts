export type JourneyEvent = { new_status: string; changed_at: string; changed_by_name?: string | null };
export function formatDate(value: unknown): string {
	if (!value) return 'Not recorded'; const date = new Date(String(value));
	return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Manila'});
}
export function nextStep(status: string, completed = false, hasFile = false): string {
	if (completed) return 'Delivery recorded by the Graduate School office. Keep your request number for reference.';
	if (status === 'Correction Requested') return 'Action needed: read the office message, replace the flagged files, and resubmit for review.';
	if (status === 'Rejected') return 'Read the reason below. Contact the Graduate School office with your request number before submitting another request.';
	if (status === 'Approved') return hasFile ? 'Your document is ready. Download it below and read any instructions from the office.' : 'The request is approved. Contact the Graduate School office with your request number for release instructions.';
	return 'Waiting for office review. You can replace requirement files while this request is pending. Check here for updates.';
}
