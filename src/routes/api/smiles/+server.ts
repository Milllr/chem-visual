import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lookupSmiles } from '$lib/smiles';
import { formulaToSmiles } from '$lib/chat';

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const { input } = await request.json();
	if (!input) return json({ error: 'input required' }, { status: 400 });

	const trimmed = input.trim();

	// 1. Check local lookup table
	const local = lookupSmiles(trimmed);
	if (local) return json({ smiles: local, source: 'local' });

	// 2. Check D1 cache
	const cached = await db
		.prepare('SELECT smiles FROM smiles_cache WHERE input = ?')
		.bind(trimmed.toLowerCase())
		.first<{ smiles: string }>();
	if (cached) return json({ smiles: cached.smiles, source: 'cache' });

	// 3. Call OpenAI to convert
	const apiKey = platform?.env?.OPENAI_API_KEY;
	if (!apiKey) return json({ error: 'API key not configured' }, { status: 500 });

	try {
		const smiles = await formulaToSmiles(trimmed, apiKey);

		// Cache result
		await db
			.prepare('INSERT OR REPLACE INTO smiles_cache (input, smiles) VALUES (?, ?)')
			.bind(trimmed.toLowerCase(), smiles)
			.run();

		return json({ smiles, source: 'ai' });
	} catch {
		return json({ error: 'Could not convert to SMILES' }, { status: 422 });
	}
};
