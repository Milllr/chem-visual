import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const body = await request.json();
	const {
		name, smiles, formula, molar_mass,
		reaction_id, actual_yield, theoretical_yield, yield_percent,
		nmr_data, mass_spec, mass_spec_type, mass_spec_notes,
		ir_data, ir_notes, crystal, crystal_notes, notes, metadata
	} = body;

	const yieldPct = yield_percent ?? (
		(theoretical_yield || 0) > 0
			? ((actual_yield || 0) / (theoretical_yield || 1)) * 100
			: 0
	);

	await db
		.prepare(
			`UPDATE compound SET
			 name = ?, smiles = ?, formula = ?, molar_mass = ?,
			 reaction_id = ?, actual_yield = ?, theoretical_yield = ?, yield_percent = ?,
			 nmr_data = ?, mass_spec = ?, mass_spec_type = ?, mass_spec_notes = ?,
			 ir_data = ?, ir_notes = ?, crystal = ?, crystal_notes = ?,
			 notes = ?, metadata = ?, updated = datetime('now')
			 WHERE id = ?`
		)
		.bind(
			name || '', smiles || '', formula || '', molar_mass || 0,
			reaction_id || null, actual_yield || 0, theoretical_yield || 0, yieldPct,
			typeof nmr_data === 'string' ? nmr_data : JSON.stringify(nmr_data || {}),
			mass_spec ? 1 : 0, mass_spec_type || '', mass_spec_notes || '',
			ir_data ? 1 : 0, ir_notes || '',
			crystal ? 1 : 0, crystal_notes || '',
			notes || '',
			typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {}),
			params.id
		)
		.run();

	const compound = await db.prepare('SELECT * FROM compound WHERE id = ?').bind(params.id).first();
	return json(compound);
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	await db.prepare('DELETE FROM compound WHERE id = ?').bind(params.id).run();
	return json({ success: true });
};
