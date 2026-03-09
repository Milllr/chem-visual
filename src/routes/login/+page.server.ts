import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { verifyPassword, createSession, COOKIE_OPTIONS } from '$lib/auth';

export const actions: Actions = {
	default: async ({ request, platform, cookies }) => {
		const data = await request.formData();
		const password = data.get('password') as string;

		if (!password) return fail(400, { error: 'Password required' });

		const storedHash = platform?.env?.AUTH_PASSWORD_HASH;
		const secret = platform?.env?.AUTH_SECRET || 'dev-secret-change-me';

		// Dev mode: accept any password if no hash configured
		if (!storedHash) {
			const token = await createSession(secret);
			cookies.set(COOKIE_OPTIONS.name, token, {
				path: COOKIE_OPTIONS.path,
				maxAge: COOKIE_OPTIONS.maxAge,
				httpOnly: COOKIE_OPTIONS.httpOnly,
				secure: false, // allow http in dev
				sameSite: COOKIE_OPTIONS.sameSite
			});
			throw redirect(303, '/');
		}

		const valid = await verifyPassword(password, storedHash);
		if (!valid) return fail(401, { error: 'Wrong password' });

		const token = await createSession(secret);
		cookies.set(COOKIE_OPTIONS.name, token, {
			path: COOKIE_OPTIONS.path,
			maxAge: COOKIE_OPTIONS.maxAge,
			httpOnly: COOKIE_OPTIONS.httpOnly,
			secure: COOKIE_OPTIONS.secure,
			sameSite: COOKIE_OPTIONS.sameSite
		});

		throw redirect(303, '/');
	}
};
