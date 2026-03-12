import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lookupSmiles } from '$lib/smiles';
import { formulaToSmiles, smilesToName } from '$lib/chat';

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const body: any = await request.json();
	const { input, mode } = body;
	if (!input) return json({ error: 'input required' }, { status: 400 });

	const trimmed = input.trim();

	// Reverse mode: SMILES → IUPAC name
	if (mode === 'to_name') {
		const apiKey = platform?.env?.OPENAI_API_KEY;
		if (!apiKey) return json({ error: 'API key not configured' }, { status: 500 });

		// Check cache for reverse lookups
		const cached = await db
			.prepare('SELECT smiles FROM smiles_cache WHERE smiles = ?')
			.bind(trimmed)
			.first<{ smiles: string }>();
		// Also check if we have a cached input→smiles mapping where smiles matches
		const reverseCache = await db
			.prepare('SELECT input FROM smiles_cache WHERE smiles = ? LIMIT 1')
			.bind(trimmed)
			.first<{ input: string }>();
		if (reverseCache) return json({ name: reverseCache.input, source: 'cache' });

		try {
			const name = await smilesToName(trimmed, apiKey);
			// Cache the reverse mapping too
			await db
				.prepare('INSERT OR REPLACE INTO smiles_cache (input, smiles) VALUES (?, ?)')
				.bind(name.toLowerCase(), trimmed)
				.run();
			return json({ name, source: 'ai' });
		} catch {
			return json({ error: 'Could not convert to name' }, { status: 422 });
		}
	}

	// Forward mode (default): name/formula → SMILES

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
