import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const notebook = await db
		.prepare('SELECT * FROM notebook WHERE id = ?')
		.bind(params.id)
		.first();

	if (!notebook) return json({ error: 'Not found' }, { status: 404 });
	return json(notebook);
};

export const PUT: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const updates = await request.json();
	const fields: string[] = [];
	const values: unknown[] = [];

	for (const [key, value] of Object.entries(updates)) {
		if (['title', 'description', 'color', 'emoji', 'sort_order'].includes(key)) {
			fields.push(`${key} = ?`);
			values.push(value);
		}
	}

	if (fields.length === 0) return json({ error: 'No valid fields' }, { status: 400 });

	fields.push("updated = datetime('now')");
	values.push(params.id);

	await db
		.prepare(`UPDATE notebook SET ${fields.join(', ')} WHERE id = ?`)
		.bind(...values)
		.run();

	const notebook = await db
		.prepare('SELECT * FROM notebook WHERE id = ?')
		.bind(params.id)
		.first();

	return json(notebook);
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	await db.prepare('DELETE FROM notebook WHERE id = ?').bind(params.id).run();
	return json({ ok: true });
};
