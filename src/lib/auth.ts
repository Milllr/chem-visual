const COOKIE_NAME = 'chem_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	const inputHash = await hashPassword(password);
	return inputHash === hash;
}

export async function createSession(secret: string): Promise<string> {
	const payload = {
		exp: Date.now() + COOKIE_MAX_AGE * 1000,
		iat: Date.now()
	};
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const payloadStr = btoa(JSON.stringify(payload));
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
	const sigHex = Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return `${payloadStr}.${sigHex}`;
}

export async function verifySession(token: string, secret: string): Promise<boolean> {
	try {
		const [payloadStr, sigHex] = token.split('.');
		if (!payloadStr || !sigHex) return false;

		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['verify']
		);

		const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
		const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payloadStr));
		if (!valid) return false;

		const payload = JSON.parse(atob(payloadStr));
		return payload.exp > Date.now();
	} catch {
		return false;
	}
}

export const COOKIE_OPTIONS = {
	name: COOKIE_NAME,
	maxAge: COOKIE_MAX_AGE,
	path: '/',
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const
};
