import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const updates = await request.json();
	const fields: string[] = [];
	const values: unknown[] = [];

	for (const [key, value] of Object.entries(updates)) {
		if (['title', 'sort_order'].includes(key)) {
			fields.push(`${key} = ?`);
			values.push(value);
		}
	}

	if (fields.length === 0) return json({ error: 'No valid fields' }, { status: 400 });

	fields.push("updated = datetime('now')");
	values.push(params.id);

	await db
		.prepare(`UPDATE page SET ${fields.join(', ')} WHERE id = ?`)
		.bind(...values)
		.run();

	const page = await db.prepare('SELECT * FROM page WHERE id = ?').bind(params.id).first();
	return json(page);
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	await db.prepare('DELETE FROM page WHERE id = ?').bind(params.id).run();
	return json({ ok: true });
};
