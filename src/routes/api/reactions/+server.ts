import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateId } from '$lib/db';

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const notebookId = url.searchParams.get('notebook_id');
	if (!notebookId) return json({ error: 'notebook_id required' }, { status: 400 });

	const { results } = await db
		.prepare('SELECT * FROM reaction WHERE notebook_id = ? ORDER BY sort_order ASC')
		.bind(notebookId)
		.all();

	return json(results || []);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const { notebook_id, name, target_smiles, target_name, target_mass, steps, metadata } = await request.json();
	if (!notebook_id) return json({ error: 'notebook_id required' }, { status: 400 });

	const id = generateId();
	const last = await db
		.prepare('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM reaction WHERE notebook_id = ?')
		.bind(notebook_id)
		.first<{ max_order: number }>();

	const sortOrder = (last?.max_order ?? -1) + 1;
	const stepsStr = typeof steps === 'string' ? steps : JSON.stringify(steps || []);
	const metaStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {});

	await db
		.prepare(
			'INSERT INTO reaction (id, notebook_id, name, target_smiles, target_name, target_mass, steps, metadata, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(
			id, notebook_id,
			name || 'Untitled Reaction',
			target_smiles || '', target_name || '', target_mass || 0,
			stepsStr, metaStr,
			sortOrder
		)
		.run();

	const reaction = await db.prepare('SELECT * FROM reaction WHERE id = ?').bind(id).first();
	return json(reaction, { status: 201 });
};
