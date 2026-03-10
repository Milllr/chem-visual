import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const updates = await request.json();
	const fields: string[] = [];
	const values: any[] = [];

	if ('name' in updates) { fields.push('name = ?'); values.push(updates.name); }
	if ('target_smiles' in updates) { fields.push('target_smiles = ?'); values.push(updates.target_smiles); }
	if ('target_name' in updates) { fields.push('target_name = ?'); values.push(updates.target_name); }
	if ('target_mass' in updates) { fields.push('target_mass = ?'); values.push(updates.target_mass); }
	if ('steps' in updates) { fields.push('steps = ?'); values.push(typeof updates.steps === 'string' ? updates.steps : JSON.stringify(updates.steps)); }
	if ('metadata' in updates) { fields.push('metadata = ?'); values.push(typeof updates.metadata === 'string' ? updates.metadata : JSON.stringify(updates.metadata)); }
	if ('actual_yield' in updates) { fields.push('actual_yield = ?'); values.push(updates.actual_yield || 0); }
	if ('theoretical_yield' in updates) { fields.push('theoretical_yield = ?'); values.push(updates.theoretical_yield || 0); }
	if ('yield_percent' in updates) { fields.push('yield_percent = ?'); values.push(updates.yield_percent || 0); }

	if (fields.length === 0) return json({ error: 'No fields to update' }, { status: 400 });

	fields.push("updated = datetime('now')");
	values.push(params.id);

	await db
		.prepare(`UPDATE reaction SET ${fields.join(', ')} WHERE id = ?`)
		.bind(...values)
		.run();

	const reaction = await db.prepare('SELECT * FROM reaction WHERE id = ?').bind(params.id).first();
	return json(reaction);
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	await db.prepare('DELETE FROM reaction WHERE id = ?').bind(params.id).run();
	return json({ success: true });
};
