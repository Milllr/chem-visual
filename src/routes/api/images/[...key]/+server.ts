import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const bucket = platform?.env?.BUCKET;
	if (!bucket) return new Response('Storage unavailable', { status: 500 });

	const key = params.key;
	const object = await bucket.get(key);
	if (!object) return new Response('Not found', { status: 404 });

	return new Response(object.body as ReadableStream, {
		headers: {
			'Content-Type': object.httpMetadata?.contentType || 'image/webp',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
