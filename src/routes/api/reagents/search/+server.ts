import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const q = url.searchParams.get('q')?.trim();
	if (!q || q.length < 2) return json({ results: [] });

	const pattern = `%${q}%`;

	const { results } = await db
		.prepare(`
			SELECT r.*, n.title as notebook_title, n.emoji as notebook_emoji, n.id as notebook_id
			FROM reagent r
			JOIN notebook n ON r.notebook_id = n.id
			WHERE r.name LIKE ?1 OR r.cas LIKE ?1 OR r.formula LIKE ?1
			ORDER BY r.name ASC
			LIMIT 20
		`)
		.bind(pattern)
		.all();

	// Group by notebook
	const grouped: Record<string, { notebook_id: string; notebook_title: string; notebook_emoji: string; reagents: any[] }> = {};
	for (const row of results || []) {
		const r = row as any;
		const nbId = r.notebook_id;
		if (!grouped[nbId]) {
			grouped[nbId] = {
				notebook_id: nbId,
				notebook_title: r.notebook_title,
				notebook_emoji: r.notebook_emoji,
				reagents: []
			};
		}
		grouped[nbId].reagents.push({
			id: r.id,
			cas: r.cas,
			name: r.name,
			formula: r.formula,
			molar_mass: r.molar_mass,
			smiles: r.smiles
		});
	}

	return json({ results: Object.values(grouped) });
};
