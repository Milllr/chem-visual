import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateId } from '$lib/db';

export const GET: RequestHandler = async ({ platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const { results } = await db
		.prepare('SELECT * FROM notebook ORDER BY sort_order ASC, updated DESC')
		.all();

	return json(results || []);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const { title, description, color, emoji } = await request.json();
	const id = generateId();

	await db
		.prepare(
			'INSERT INTO notebook (id, title, description, color, emoji) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(id, title || 'Untitled', description || '', color || '#C4A882', emoji || '')
		.run();

	// Create first page automatically
	const pageId = generateId();
	await db
		.prepare('INSERT INTO page (id, notebook_id, title, sort_order) VALUES (?, ?, ?, 0)')
		.bind(pageId, id, 'Page 1')
		.run();

	const notebook = await db.prepare('SELECT * FROM notebook WHERE id = ?').bind(id).first();
	return json(notebook, { status: 201 });
};
