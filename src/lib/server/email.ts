import { BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } from '$env/static/private';

type SendEmailOptions = {
	to: string;
	subject: string;
	html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
	const response = await fetch('https://api.brevo.com/v3/smtp/email', {
		method: 'POST',
		headers: {
			'api-key': BREVO_API_KEY,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
			to: [{ email: to }],
			subject,
			htmlContent: html
		})
	});

	if (!response.ok) {
		const responseText = await response.text();
		throw new Error(responseText || `Brevo request failed with status ${response.status}.`);
	}
}
