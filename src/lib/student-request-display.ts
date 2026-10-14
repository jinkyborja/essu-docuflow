import type { JourneyEvent } from './request-flow';
import { requestStatusKey, statusLabel } from '$lib/request-status';

export type DocumentDefinition = { document_id: number; name: string; requirements?: Array<{ name: string }> };
export function documentRequirementGroups<T extends { name: string }>(items: Array<{ document_id: number; name: string }>, requirements: T[], catalog: DocumentDefinition[], fallbackName: string) {
	const normalized = (name: string) => name.trim().toLowerCase();
	const assigned = new Set<string>();
	const groups = items.map(item => {
		const definition = catalog.find(doc => doc.document_id === item.document_id);
		const names = new Set(definition?.requirements?.map(req => normalized(req.name)) ?? []);
		const matched = requirements.filter(req => names.has(normalized(req.name)));
		matched.forEach(req => assigned.add(req.name));
		return { name: item.name, requirements: matched };
	});
	if (!groups.length || groups.length === 1) return [{ name: groups[0]?.name ?? fallbackName, requirements }];
	const unassigned = requirements.filter(req => !assigned.has(req.name));
	if (unassigned.length) groups.push({ name: 'Other request requirements', requirements: unassigned });
	return groups;
}

export type TimelineStep = { label: string; state: 'done' | 'current' | 'upcoming'; date?: string; actor?: string | null };
export function requestTimeline(status: string, dateRequested: string, history: JourneyEvent[] = [], hasFile = false, completed = false): TimelineStep[] {
	const ordered = [...history].sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at));
	const events = ordered.filter((event, index) => !(index === 0 && event.new_status === 'Pending' && Math.abs(Date.parse(event.changed_at) - Date.parse(dateRequested)) < 2000));
	const delivered = completed || requestStatusKey(status) === 'released' || events.some(event => requestStatusKey(event.new_status) === 'released');
	const label = (value: string) => value === 'Pending' ? 'Office review' : value === 'Correction Requested' ? 'Needs correction' : statusLabel(value);
	const steps: TimelineStep[] = [{ label: 'Submitted', state: 'done', date: dateRequested }];
	const last = events.at(-1);
	const past = !delivered && last?.new_status === status ? events.slice(0, -1) : events;
	for (const event of past) steps.push({ label: label(event.new_status), state: 'done', date: event.changed_at, actor: event.changed_by_name });
	if (delivered) {
		if (!events.some(event => event.new_status === 'Completed')) steps.push({ label: 'Released', state: 'done' });
		return steps;
	}
	steps.push({ label: status === 'Approved' && hasFile ? 'Ready for Release' : label(status), state: 'current', date: last?.new_status === status ? last.changed_at : undefined, actor: last?.new_status === status ? last.changed_by_name : undefined });
	if (status === 'Correction Requested') steps.push({ label: 'Office review', state: 'upcoming' });
	if (status === 'Pending' || status === 'Correction Requested') steps.push({ label: 'Ready for Release', state: 'upcoming' });
	if (!['rejected', 'cancelled'].includes(requestStatusKey(status) ?? '')) steps.push({ label: 'Released', state: 'upcoming' });
	return steps;
}
