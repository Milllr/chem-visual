import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { verifySession, COOKIE_OPTIONS } from '$lib/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Allow public routes
	if (pathname === '/login' || pathname.startsWith('/login')) {
		return resolve(event);
	}

	// Static assets & manifest
	if (pathname.startsWith('/.') || pathname === '/manifest.json' || pathname === '/favicon.ico') {
		return resolve(event);
	}

	// Check authentication
	const token = event.cookies.get(COOKIE_OPTIONS.name);
	const secret = event.platform?.env?.AUTH_SECRET || 'dev-secret-change-me';

	if (token && (await verifySession(token, secret))) {
		event.locals.authenticated = true;
	} else {
		event.locals.authenticated = false;

		// API routes return 401
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Pages redirect to login
		throw redirect(303, '/login');
	}

	return resolve(event);
};
