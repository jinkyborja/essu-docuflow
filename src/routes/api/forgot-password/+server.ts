import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { signJwt } from '$lib/server/jwt';
import { sendEmail } from '$lib/server/email';
import { JWT_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
	const { email } = await request.json();
	if (!email) return json({ error: 'Email is required' }, { status: 400 });

	const [rows] = await pool.execute(
		'SELECT first_name, last_name, auth_version FROM users WHERE email = ?',
		[email]
	);
	const user = (rows as Record<string, unknown>[])[0];

	// Always return success to prevent email enumeration
	if (!user) return json({ success: true });

	const token = signJwt({ email, purpose: 'reset', authVersion: Number(user.auth_version) }, JWT_SECRET, 3600);
	const resetUrl = `${new URL(request.url).origin}/reset-password?token=${token}`;
	const fullName = `${user.first_name} ${user.last_name}`;

	await sendEmail({
		to: email,
		subject: 'Reset your ESSU DocuFlow password',
		html: `
			<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1f2937">
				<h2 style="margin:0 0 8px;font-size:20px;color:#111827">Password Reset Request</h2>
				<p style="margin:0 0 16px;color:#6b7280">Hi ${fullName},</p>
				<p style="margin:0 0 24px;color:#6b7280">
					We received a request to reset your ESSU DocuFlow password. Click the button below to set a new password.
					This link expires in <strong>1 hour</strong>.
				</p>
				<a href="${resetUrl}"
					style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
					Reset Password
				</a>
				<p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
					If you didn't request a password reset, you can safely ignore this email.
					Your password will not change.
				</p>
				<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
				<p style="margin:0;font-size:12px;color:#9ca3af">Eastern Samar State University · Graduate School</p>
			</div>
		`
	});

	return json({ success: true });
};
