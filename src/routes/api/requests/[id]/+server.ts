import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { supabase } from '$lib/server/supabase';
import { fetchOneRequestRequirements } from '$lib/server/requirements';
import { verifyJwt } from '$lib/server/jwt';
import { MAIL_FROM } from '$lib/server/email';
import { JWT_SECRET, RESEND_API } from '$env/static/private';
import { Resend } from 'resend';

const resend = new Resend(RESEND_API);

export const GET: RequestHandler = async ({ params, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let payload: { userId: number; role: string };
	try {
		payload = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const [rows] = await pool.execute(
		`SELECT r.*, d.name AS document_name,
		        u.first_name, u.middle_name, u.last_name, u.student_id AS student_code,
		        u.program, u.student_type, u.email AS student_email
		 FROM requests r
		 JOIN documents d ON r.document_id = d.document_id
		 JOIN users u ON r.student_id = u.user_id
		 WHERE r.request_id = ?`,
		[params.id]
	);
	const list = rows as Record<string, unknown>[];
	if (list.length === 0) return json({ error: 'Not found' }, { status: 404 });

	const req = list[0];

	const requirements = await fetchOneRequestRequirements(params.id);

	// Get status history
	const [histRows] = await pool.execute(
		`SELECT h.old_status, h.new_status, h.changed_at,
		        u.first_name, u.last_name
		 FROM request_status_history h
		 LEFT JOIN users u ON h.changed_by = u.user_id
		 WHERE h.request_id = ?
		 ORDER BY h.changed_at ASC`,
		[params.id]
	);

	return json({ ...req, requirements, history: histRows });
};

export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Get current request
	const [rows] = await pool.execute(
		`SELECT r.*, u.email AS student_email,
		        CONCAT(u.first_name, ' ', u.last_name) AS student_name,
		        d.name AS document_name
		 FROM requests r
		 JOIN users u ON r.student_id = u.user_id
		 JOIN documents d ON r.document_id = d.document_id
		 WHERE r.request_id = ?`,
		[params.id]
	);
	const list = rows as Record<string, unknown>[];
	if (list.length === 0) return json({ error: 'Not found' }, { status: 404 });
	const currentReq = list[0];
	const oldStatus = currentReq.status as string;

	const contentType = request.headers.get('content-type') ?? '';
	let action: string, adminMessage: string | null, flaggedRequirements: string[] | null;
	let approvedFile: File | null = null;

	if (contentType.includes('multipart/form-data')) {
		const formData = await request.formData();
		action = formData.get('action') as string;
		adminMessage = formData.get('admin_message') as string || null;
		const flagged = formData.get('flagged_requirements') as string;
		flaggedRequirements = flagged ? JSON.parse(flagged) : null;
		approvedFile = formData.get('approved_file') as File | null;
	} else {
		const body = await request.json();
		action = body.action;
		adminMessage = body.admin_message ?? null;
		flaggedRequirements = body.flagged_requirements ?? null;
	}

	let newStatus: string;
	let approvedFilePath: string | null = null;
	let approvedFileName: string | null = null;

	if (action === 'approve') {
		newStatus = 'Approved';
		if (approvedFile && approvedFile.size > 0) {
			const ext = approvedFile.name.split('.').pop();
			const path = `${params.id}/approved-${Date.now()}.${ext}`;
			const buffer = Buffer.from(await approvedFile.arrayBuffer());
			const { error } = await supabase.storage.from('requirements').upload(path, buffer, {
				contentType: approvedFile.type
			});
			if (error) {
				// Approving without the file would email the student a dead link.
				console.error('Approved document upload failed:', error);
				return json(
					{ error: `Document upload failed — request not approved. (${error.message})` },
					{ status: 502 }
				);
			}
			approvedFilePath = path;
			approvedFileName = approvedFile.name;
		}
	} else if (action === 'reject') {
		newStatus = 'Rejected';
	} else if (action === 'correction') {
		newStatus = 'Correction Requested';
		// Flag specific requirements. One statement, no read-modify-write of a blob.
		if (flaggedRequirements) {
			await pool.execute(
				`UPDATE request_requirements rr
				 JOIN requirements rq ON rq.requirement_id = rr.requirement_id
				 SET rr.needs_correction = (rq.name IN (${flaggedRequirements.map(() => '?').join(',') || 'NULL'}))
				 WHERE rr.request_id = ?`,
				[...flaggedRequirements, params.id]
			);
		}
	} else {
		return json({ error: 'Invalid action' }, { status: 400 });
	}

	// Update request
	await pool.execute(
		`UPDATE requests SET status = ?, admin_message = ?,
		 approved_file_path = COALESCE(?, approved_file_path),
		 approved_file_name = COALESCE(?, approved_file_name)
		 WHERE request_id = ?`,
		[newStatus, adminMessage, approvedFilePath, approvedFileName, params.id]
	);

	// Record history
	await pool.execute(
		'INSERT INTO request_status_history (request_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)',
		[params.id, oldStatus, newStatus, payload.userId]
	);

	// Send email
	const studentEmail = currentReq.student_email as string;
	const studentName = currentReq.student_name as string;
	const documentName = currentReq.document_name as string;

	let emailSubject = '';
	let emailHtml = '';

	if (action === 'approve') {
		// A file is optional — the student must still be told the request was approved.
		let downloadUrl = '';
		const filePath = approvedFilePath ?? (currentReq.approved_file_path as string | null);
		if (filePath) {
			const { data: signedData } = await supabase.storage
				.from('requirements')
				.createSignedUrl(filePath, 604800); // 7 days
			downloadUrl = signedData?.signedUrl ?? '';
		}
		emailSubject = `Your request for ${documentName} has been approved`;
		emailHtml = `
			<p>Dear ${studentName},</p>
			<p>Your document request (<strong>${params.id}</strong>) for <strong>${documentName}</strong> has been <strong style="color:green">approved</strong>.</p>
			${adminMessage ? `<p>Note from staff: ${adminMessage}</p>` : ''}
			${downloadUrl
					? `<p>Your document is ready. You can view or download it below.</p>
			     <p><a href="${downloadUrl}" style="background:#2d6a4f;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:10px">View/Download Your Document</a></p>
			     <p style="color:#888;font-size:12px">This download link expires in 7 days.</p>`
					: `<p>Please log in to ESSU DocuFlow to view the details of your request.</p>`}
			<p>ESSU DocuFlow — Graduate School</p>`;
	} else if (action === 'reject') {
		emailSubject = `Your request for ${documentName} was rejected`;
		emailHtml = `
			<p>Dear ${studentName},</p>
			<p>Your document request (<strong>${params.id}</strong>) for <strong>${documentName}</strong> has been <strong style="color:red">rejected</strong>.</p>
			${adminMessage ? `<p>Reason: ${adminMessage}</p>` : ''}
			<p>If you have questions, please contact the Graduate School.</p>
			<p>ESSU DocuFlow — Graduate School</p>`;
	} else if (action === 'correction') {
		emailSubject = `Corrections needed for your request ${params.id}`;
		emailHtml = `
			<p>Dear ${studentName},</p>
			<p>Your document request (<strong>${params.id}</strong>) for <strong>${documentName}</strong> requires corrections.</p>
			${adminMessage ? `<p>Message from staff: ${adminMessage}</p>` : ''}
			${flaggedRequirements?.length ? `<p>Please re-submit the following requirements: <strong>${flaggedRequirements.join(', ')}</strong></p>` : ''}
			<p>Please log in to ESSU DocuFlow to re-upload the required documents.</p>
			<p>ESSU DocuFlow — Graduate School</p>`;
	}

	let emailWarning: string | null = null;
	if (emailSubject) {
		const { error: mailError } = await resend.emails.send({
			from: MAIL_FROM,
			to: studentEmail,
			subject: emailSubject,
			html: emailHtml
		});
		if (mailError) {
			// The status change already succeeded — surface the mail failure instead of
			// silently pretending the student was notified.
			console.error('Status email failed:', mailError);
			emailWarning = `Status updated, but the notification email to ${studentEmail} failed: ${mailError.message}`;
		}
	}

	return json({ success: true, new_status: newStatus, email_warning: emailWarning });
};
