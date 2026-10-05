import { createHmac } from 'node:crypto';

function base64urlEncode(str: string): string {
	return Buffer.from(str).toString('base64url');
}

function base64urlDecode(str: string): string {
	return Buffer.from(str, 'base64url').toString('utf8');
}

export function signJwt(payload: Record<string, unknown>, secret: string, expiresInSeconds: number): string {
	const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const iat = Math.floor(Date.now() / 1000);
	const claims = base64urlEncode(JSON.stringify({ ...payload, iat, exp: iat + expiresInSeconds }));
	const signature = createHmac('sha256', secret)
		.update(`${header}.${claims}`)
		.digest('base64url');
	return `${header}.${claims}.${signature}`;
}

export function verifyJwt<T extends Record<string, unknown>>(token: string, secret: string): T {
	const parts = token.split('.');
	if (parts.length !== 3) throw new Error('Invalid token');

	const [header, claims, signature] = parts;
	const expected = createHmac('sha256', secret)
		.update(`${header}.${claims}`)
		.digest('base64url');

	if (signature !== expected) throw new Error('Invalid signature');

	const payload = JSON.parse(base64urlDecode(claims)) as T & { exp: number };
	if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');

	return payload as T;
}
