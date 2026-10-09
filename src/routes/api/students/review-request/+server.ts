import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
export const POST: RequestHandler = async ({cookies,request}) => {
	const token=cookies.get('session'); if(!token) return json({error:'Unauthorized'},{status:401});
	let actor; try { actor=await verifySession(token,JWT_SECRET); } catch { return json({error:'Unauthorized'},{status:401}); }
	if(actor.role!=='Student') return json({error:'Student access required'},{status:403});
	const body=await request.json().catch(()=>null);
	const note=typeof body?.note==='string'?body.note.trim():'';
	if(!note || note.length>275) return json({error:'Explain what should be checked again (maximum 275 characters).'},{status:400});
	const conn=await pool.getConnection();
	try {
		await conn.beginTransaction();
		const [rows]=await conn.execute('SELECT id_status, student_id FROM users WHERE user_id = ? FOR UPDATE',[actor.userId]);
		const student=(rows as Array<{id_status:string;student_id:string}>)[0];
		if(student?.id_status!=='rejected') { await conn.rollback();return json({error:'Another review can be requested after ID verification is rejected.'},{status:409}); }
		const [recent]=await conn.execute("SELECT history_id FROM request_status_history WHERE changed_by = ? AND request_id IS NULL AND new_status = 'Student ID review requested' AND changed_at > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)",[actor.userId]);
		if((recent as unknown[]).length) {await conn.rollback();return json({error:'You already requested another review today. Please allow the office time to respond.'},{status:429});}
		const [admins]=await conn.execute("SELECT user_id FROM users WHERE role = 'Admin'");
		if(!(admins as unknown[]).length) {await conn.rollback();return json({error:'Please contact the Graduate School office directly.'},{status:503});}
		await conn.execute('UPDATE users SET id_verification_note = ? WHERE user_id = ?', ['Student review request: ' + note, actor.userId]);
		for(const admin of admins as Array<{user_id:number}>) await conn.execute('INSERT INTO request_status_history (request_id, new_status, changed_by, notification_user_id, is_read, student_read) VALUES (NULL, ?, ?, ?, FALSE, TRUE)', ['Student ID review requested',actor.userId,admin.user_id]);
		await conn.commit();return json({success:true});
	} catch(e) {await conn.rollback();console.error('Request ID review failed',e);return json({error:'Could not send your review request.'},{status:500});} finally {conn.release();}
};
