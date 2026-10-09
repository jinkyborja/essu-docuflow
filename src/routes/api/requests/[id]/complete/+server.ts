import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
export const POST: RequestHandler = async ({ cookies, request, params }) => {
	const token = cookies.get('session'); if (!token) return json({error:'Unauthorized'}, {status:401});
	let actor; try { actor = await verifySession(token, JWT_SECRET); } catch { return json({error:'Unauthorized'}, {status:401}); }
	if (!['Staff','Admin'].includes(actor.role)) return json({error:'Forbidden'}, {status:403});
	const body = await request.json().catch(() => null);
	if (body?.confirm !== true) return json({error:'Confirm that the student has received the document.'}, {status:400});
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		const [rows] = await conn.execute('SELECT status FROM requests WHERE request_id = ? FOR UPDATE', [params.id]);
		const row = (rows as Array<{status:string}>)[0];
		if (!row) { await conn.rollback(); return json({error:'Request not found'}, {status:404}); }
		if (row.status !== 'Approved') { await conn.rollback(); return json({error:'Only approved requests can be marked delivered.'}, {status:409}); }
		const [existing] = await conn.execute("SELECT history_id FROM request_status_history WHERE request_id = ? AND new_status = 'Completed'", [params.id]);
		if ((existing as unknown[]).length) { await conn.rollback(); return json({error:'Delivery has already been recorded.'}, {status:409}); }
		await conn.execute('INSERT INTO request_status_history (request_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)', [params.id,'Approved','Completed',actor.userId]);
		await conn.commit(); return json({success:true});
	} catch (e) { await conn.rollback(); console.error('Record delivery failed',e); return json({error:'Could not record delivery.'}, {status:500}); }
	finally { conn.release(); }
};
