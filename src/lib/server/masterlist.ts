import { error } from '@sveltejs/kit';
import { verifySession } from './jwt';
import { JWT_SECRET } from '$env/static/private';

export async function requireMasterlistAdmin(cookies: { get(name: string): string | undefined }) {
	const token = cookies.get('session');
	if (!token) error(401, 'Unauthorized');
	let actor;
	try { actor = await verifySession(token, JWT_SECRET); } catch { error(401, 'Unauthorized'); }
	if (actor.role !== 'Admin') error(403, 'Admin access required');
	return actor;
}

export type MasterlistRow = { id: number; student_id: string; last_name: string; first_name: string; middle_name: string | null; program: string; campus: string | null; status: string | null; school_year: string | null };
export type Comparison = 'match' | 'mismatch' | 'missing';
export type MasterlistMatch = { found: boolean; name: Comparison; program: Comparison; campus: Comparison; values: MasterlistRow | null };
export function normalize(value: unknown): string {
	return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();
}
export function compare(student: Record<string, unknown>, row: MasterlistRow | null): MasterlistMatch {
	const field = (a: unknown, b: unknown): Comparison => !normalize(a) || !normalize(b) ? 'missing' : normalize(a) === normalize(b) ? 'match' : 'mismatch';
	const name = !row || !normalize(student.first_name) || !normalize(student.last_name) ? 'missing' :
		['first_name', 'middle_name', 'last_name'].every(key => normalize(student[key]) === normalize(row[key as keyof MasterlistRow])) ? 'match' : 'mismatch';
	return { found: !!row, name, program: field(student.program, row?.program), campus: field(student.campus, row?.campus), values: row };
}

// RFC-style quoted fields, escaped quotes, CRLF and embedded newlines; filenames are unused.
export function parseCsv(text: string): string[][] {
	text = text.replace(/^\uFEFF/, '');
	const rows: string[][] = []; let row: string[] = [], value = '', quoted = false, closed = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
			else value += c;
		} else if (c === '"') { if (value || closed) throw new Error('Unexpected quote in CSV'); quoted = true; }
		else if (c === ',' || c === '\n' || c === '\r') {
			row.push(value); value = ''; closed = false;
			if (c !== ',') { rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
		} else { if (closed) throw new Error('Unexpected text after quoted field'); value += c; }
	}
	if (quoted) throw new Error('Unclosed quoted field');
	if (value || row.length || closed) { row.push(value); rows.push(row); }
	return rows;
}
export const headers = ['student_id', 'last_name', 'first_name', 'middle_name', 'program', 'campus', 'status'];
export function validateRow(values: string[], columns: string[]): string | null {
	if (values.length !== columns.length) return 'Column count differs from headers';
	const row = Object.fromEntries(columns.map((key, i) => [key, values[i].trim()]));
	const limits: Record<string, number> = { student_id: 20, last_name: 50, first_name: 50, middle_name: 50, program: 200, campus: 50, status: 30, school_year: 20 };
	for (const key of ['student_id', 'last_name', 'first_name', 'program']) if (!row[key]) return key + ' is required';
	for (const [key, value] of Object.entries(row)) {
		if (value.length > limits[key]) return key + ' exceeds ' + limits[key] + ' characters';
		if (/[\x00-\x1F\x7F]/.test(value)) return key + ' contains control characters';
	}
	return null;
}
