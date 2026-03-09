import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const updates = await request.json();
	const fields: string[] = [];
	const values: unknown[] = [];

	for (const [key, value] of Object.entries(updates)) {
		if (['content', 'image_url', 'sort_order'].includes(key)) {
			fields.push(`${key} = ?`);
			values.push(value);
		}
		if (key === 'metadata') {
			fields.push('metadata = ?');
			values.push(typeof value === 'string' ? value : JSON.stringify(value));
		}
	}

	if (fields.length === 0) return json({ error: 'No valid fields' }, { status: 400 });

	values.push(params.id);
	await db
		.prepare(`UPDATE block SET ${fields.join(', ')} WHERE id = ?`)
		.bind(...values)
		.run();

	const block = await db.prepare('SELECT * FROM block WHERE id = ?').bind(params.id).first();
	return json(block);
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	await db.prepare('DELETE FROM block WHERE id = ?').bind(params.id).run();
	return json({ ok: true });
};
