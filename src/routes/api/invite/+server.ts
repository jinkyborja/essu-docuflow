import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifySession, signJwt } from '$lib/server/jwt';
import { sendEmail } from '$lib/server/email';
import { JWT_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let caller: { role: string };
	try {
		caller = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (caller.role !== 'Admin') {
		return json({ error: 'Only admins can send invitations' }, { status: 403 });
	}

	const { email, role } = await request.json();
	if (!email || !role) return json({ error: 'Email and role are required' }, { status: 400 });
	if (!['Staff', 'Admin'].includes(role)) return json({ error: 'Invalid role' }, { status: 400 });

	const inviteToken = signJwt({ email, role, purpose: 'staff-invite' }, JWT_SECRET, 7 * 24 * 3600);
	const acceptUrl = `${new URL(request.url).origin}/accept-invite?token=${inviteToken}`;

	await sendEmail({
		to: email,
		subject: `You're invited to join ESSU DocuFlow as ${role}`,
		html: `
			<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1f2937">
				<h2 style="margin:0 0 8px;font-size:20px;color:#111827">Staff Invitation</h2>
				<p style="margin:0 0 16px;color:#6b7280">You've been invited to join ESSU DocuFlow as a <strong>${role}</strong>.</p>
				<p style="margin:0 0 24px;color:#6b7280">
					Click the button below to set up your account. This invitation expires in <strong>7 days</strong>.
				</p>
				<a href="${acceptUrl}"
					style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
					Accept Invitation
				</a>
				<p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
					If you were not expecting this invitation, you can safely ignore this email.
				</p>
				<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
				<p style="margin:0;font-size:12px;color:#9ca3af">Eastern Samar State University · Graduate School</p>
			</div>
		`
	});

	return json({ success: true });
};
