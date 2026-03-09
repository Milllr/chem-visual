import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateId } from '$lib/db';

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const notebookId = url.searchParams.get('notebook_id');
	if (!notebookId) return json({ error: 'notebook_id required' }, { status: 400 });

	const { results } = await db
		.prepare('SELECT * FROM page WHERE notebook_id = ? ORDER BY sort_order ASC')
		.bind(notebookId)
		.all();

	return json(results || []);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const { notebook_id, title } = await request.json();
	if (!notebook_id) return json({ error: 'notebook_id required' }, { status: 400 });

	// Get next sort order
	const last = await db
		.prepare(
			'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM page WHERE notebook_id = ?'
		)
		.bind(notebook_id)
		.first<{ max_order: number }>();

	const id = generateId();
	const sortOrder = (last?.max_order ?? -1) + 1;

	await db
		.prepare('INSERT INTO page (id, notebook_id, title, sort_order) VALUES (?, ?, ?, ?)')
		.bind(id, notebook_id, title || `Page ${sortOrder + 1}`, sortOrder)
		.run();

	// Update notebook timestamp
	await db
		.prepare("UPDATE notebook SET updated = datetime('now') WHERE id = ?")
		.bind(notebook_id)
		.run();

	const page = await db.prepare('SELECT * FROM page WHERE id = ?').bind(id).first();
	return json(page, { status: 201 });
};
