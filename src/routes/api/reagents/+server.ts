import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateId } from '$lib/db';

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const notebookId = url.searchParams.get('notebook_id');
	if (!notebookId) return json({ error: 'notebook_id required' }, { status: 400 });

	const { results } = await db
		.prepare('SELECT * FROM reagent WHERE notebook_id = ? ORDER BY sort_order ASC')
		.bind(notebookId)
		.all();

	return json(results || []);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const { notebook_id, cas, name, formula, molar_mass, smiles, density, description, hazards, metadata } = await request.json();
	if (!notebook_id || !cas || !name) {
		return json({ error: 'notebook_id, cas, and name required' }, { status: 400 });
	}

	// Check if this CAS already exists in the notebook
	const existing = await db
		.prepare('SELECT id FROM reagent WHERE notebook_id = ? AND cas = ? AND name = ?')
		.bind(notebook_id, cas, name)
		.first();

	if (existing) {
		return json({ error: 'This reagent is already in your library' }, { status: 409 });
	}

	const id = generateId();
	const last = await db
		.prepare('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM reagent WHERE notebook_id = ?')
		.bind(notebook_id)
		.first<{ max_order: number }>();

	const sortOrder = (last?.max_order ?? -1) + 1;

	await db
		.prepare(
			'INSERT INTO reagent (id, notebook_id, cas, name, formula, molar_mass, smiles, density, description, hazards, metadata, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(
			id, notebook_id, cas, name,
			formula || '', molar_mass || 0, smiles || '', density ?? null,
			description || '', JSON.stringify(hazards || []), JSON.stringify(metadata || {}),
			sortOrder
		)
		.run();

	const reagent = await db.prepare('SELECT * FROM reagent WHERE id = ?').bind(id).first();
	return json(reagent, { status: 201 });
};
