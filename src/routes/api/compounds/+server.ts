import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateId } from '$lib/db';

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const notebookId = url.searchParams.get('notebook_id');
	if (!notebookId) return json({ error: 'notebook_id required' }, { status: 400 });

	const { results } = await db
		.prepare('SELECT * FROM compound WHERE notebook_id = ? ORDER BY sort_order ASC')
		.bind(notebookId)
		.all();

	return json(results || []);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const body = await request.json();
	const {
		notebook_id, name, smiles, formula, molar_mass,
		reaction_id, actual_yield, theoretical_yield,
		nmr_data, mass_spec, mass_spec_type, mass_spec_notes,
		ir_data, ir_notes, crystal, crystal_notes, notes, metadata
	} = body;

	if (!notebook_id) return json({ error: 'notebook_id required' }, { status: 400 });

	const id = generateId();
	const last = await db
		.prepare('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM compound WHERE notebook_id = ?')
		.bind(notebook_id)
		.first<{ max_order: number }>();

	const sortOrder = (last?.max_order ?? -1) + 1;
	const yieldPct = (theoretical_yield || 0) > 0
		? ((actual_yield || 0) / (theoretical_yield || 1)) * 100
		: 0;

	await db
		.prepare(
			`INSERT INTO compound (id, notebook_id, name, smiles, formula, molar_mass,
			 reaction_id, actual_yield, theoretical_yield, yield_percent,
			 nmr_data, mass_spec, mass_spec_type, mass_spec_notes,
			 ir_data, ir_notes, crystal, crystal_notes, notes, metadata, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id, notebook_id, name || 'Untitled Compound',
			smiles || '', formula || '', molar_mass || 0,
			reaction_id || null, actual_yield || 0, theoretical_yield || 0, yieldPct,
			typeof nmr_data === 'string' ? nmr_data : JSON.stringify(nmr_data || {}),
			mass_spec ? 1 : 0, mass_spec_type || '', mass_spec_notes || '',
			ir_data ? 1 : 0, ir_notes || '',
			crystal ? 1 : 0, crystal_notes || '',
			notes || '',
			typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {}),
			sortOrder
		)
		.run();

	const compound = await db.prepare('SELECT * FROM compound WHERE id = ?').bind(id).first();
	return json(compound, { status: 201 });
};
