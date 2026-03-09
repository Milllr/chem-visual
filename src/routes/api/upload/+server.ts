import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateId } from '$lib/db';

export const POST: RequestHandler = async ({ request, platform }) => {
	const bucket = platform?.env?.BUCKET;
	if (!bucket) return json({ error: 'Storage unavailable' }, { status: 500 });

	const formData = await request.formData();
	const file = formData.get('file') as File;
	if (!file) return json({ error: 'No file provided' }, { status: 400 });

	const ext = file.name.split('.').pop() || 'webp';
	const key = `uploads/${generateId()}.${ext}`;

	await bucket.put(key, await file.arrayBuffer(), {
		httpMetadata: {
			contentType: file.type || 'image/webp'
		}
	});

	return json({ url: `/api/images/${key}` }, { status: 201 });
};
