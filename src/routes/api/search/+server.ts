import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SearchResult {
	type: 'notebook' | 'page' | 'reagent' | 'reaction' | 'compound' | 'block' | 'tool';
	id: string;
	title: string;
	subtitle: string;
	notebook_id: string;
	notebook_title: string;
	notebook_emoji: string;
	page_id?: string;
	page_title?: string;
	extra?: Record<string, string>;
}

// Static tool definitions for client-side matching
const TOOLS: { id: string; title: string; keywords: string[] }[] = [
	{ id: 'dilution', title: 'Dilution Calculator', keywords: ['dilution', 'c1v1', 'c2v2', 'concentrate', 'dilute'] },
	{ id: 'molarity', title: 'Molarity Calculator', keywords: ['molarity', 'molar', 'concentration', 'moles', 'volume', 'liters'] },
	{ id: 'yield', title: '% Yield Calculator', keywords: ['yield', 'percent', 'actual', 'theoretical', 'efficiency'] },
	{ id: 'convert', title: 'Unit Converter', keywords: ['convert', 'units', 'gram', 'mole', 'liter', 'ml', 'kg', 'mg', 'mmol'] },
	{ id: 'equiv', title: 'Equivalents Calculator', keywords: ['equiv', 'equivalents', 'stoich', 'limiting', 'reagent', 'ratio'] },
	{ id: 'gas', title: 'Ideal Gas Law', keywords: ['gas', 'ideal', 'pv=nrt', 'pressure', 'atm', 'volume', 'temperature', 'kelvin'] },
];

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const q = url.searchParams.get('q')?.trim();
	if (!q || q.length < 1) return json({ results: [] });

	const pattern = `%${q}%`;
	const results: SearchResult[] = [];

	// Run all queries in parallel
	const [notebooks, pages, reagents, reactions, compounds, blocks] = await Promise.all([
		// 1. Notebooks (title, description, goal)
		db.prepare(`
			SELECT id, title, description, emoji, goal
			FROM notebook
			WHERE title LIKE ?1 OR description LIKE ?1 OR goal LIKE ?1
			ORDER BY updated DESC LIMIT 8
		`).bind(pattern).all(),

		// 2. Pages (title)
		db.prepare(`
			SELECT p.id, p.title, p.notebook_id, n.title as notebook_title, n.emoji as notebook_emoji
			FROM page p JOIN notebook n ON p.notebook_id = n.id
			WHERE p.title LIKE ?1
			ORDER BY p.updated DESC LIMIT 10
		`).bind(pattern).all(),

		// 3. Reagents (name, cas, formula, description)
		db.prepare(`
			SELECT r.id, r.name, r.cas, r.formula, r.molar_mass, r.smiles,
			       r.notebook_id, n.title as notebook_title, n.emoji as notebook_emoji
			FROM reagent r JOIN notebook n ON r.notebook_id = n.id
			WHERE r.name LIKE ?1 OR r.cas LIKE ?1 OR r.formula LIKE ?1 OR r.description LIKE ?1
			ORDER BY r.name ASC LIMIT 10
		`).bind(pattern).all(),

		// 4. Reactions (name, target_name)
		db.prepare(`
			SELECT r.id, r.name, r.target_name, r.target_smiles, r.yield_percent,
			       r.notebook_id, n.title as notebook_title, n.emoji as notebook_emoji
			FROM reaction r JOIN notebook n ON r.notebook_id = n.id
			WHERE r.name LIKE ?1 OR r.target_name LIKE ?1
			ORDER BY r.updated DESC LIMIT 10
		`).bind(pattern).all(),

		// 5. Compounds (name, formula, notes)
		db.prepare(`
			SELECT c.id, c.name, c.formula, c.molar_mass, c.smiles, c.notes,
			       c.notebook_id, n.title as notebook_title, n.emoji as notebook_emoji
			FROM compound c JOIN notebook n ON c.notebook_id = n.id
			WHERE c.name LIKE ?1 OR c.formula LIKE ?1 OR c.notes LIKE ?1
			ORDER BY c.updated DESC LIMIT 10
		`).bind(pattern).all(),

		// 6. Blocks (text content, data content)
		db.prepare(`
			SELECT b.id, b.type, b.content, b.page_id,
			       p.title as page_title, p.notebook_id,
			       n.title as notebook_title, n.emoji as notebook_emoji
			FROM block b
			JOIN page p ON b.page_id = p.id
			JOIN notebook n ON p.notebook_id = n.id
			WHERE (b.type IN ('text', 'data', 'chat_response')) AND b.content LIKE ?1
			ORDER BY b.created DESC LIMIT 10
		`).bind(pattern).all(),
	]);

	// Map notebooks
	for (const r of (notebooks.results || []) as any[]) {
		results.push({
			type: 'notebook',
			id: r.id,
			title: r.title,
			subtitle: r.description || r.goal || '',
			notebook_id: r.id,
			notebook_title: r.title,
			notebook_emoji: r.emoji || '🧪',
		});
	}

	// Map pages
	for (const r of (pages.results || []) as any[]) {
		results.push({
			type: 'page',
			id: r.id,
			title: r.title,
			subtitle: r.notebook_title,
			notebook_id: r.notebook_id,
			notebook_title: r.notebook_title,
			notebook_emoji: r.notebook_emoji || '🧪',
			page_id: r.id,
			page_title: r.title,
		});
	}

	// Map reagents
	for (const r of (reagents.results || []) as any[]) {
		results.push({
			type: 'reagent',
			id: r.id,
			title: r.name,
			subtitle: `${r.cas} · ${r.formula} · MW ${r.molar_mass}`,
			notebook_id: r.notebook_id,
			notebook_title: r.notebook_title,
			notebook_emoji: r.notebook_emoji || '🧪',
			extra: { cas: r.cas, formula: r.formula, smiles: r.smiles },
		});
	}

	// Map reactions
	for (const r of (reactions.results || []) as any[]) {
		const yieldStr = r.yield_percent ? ` · ${r.yield_percent}% yield` : '';
		results.push({
			type: 'reaction',
			id: r.id,
			title: r.name,
			subtitle: (r.target_name || 'No target') + yieldStr,
			notebook_id: r.notebook_id,
			notebook_title: r.notebook_title,
			notebook_emoji: r.notebook_emoji || '🧪',
		});
	}

	// Map compounds
	for (const r of (compounds.results || []) as any[]) {
		results.push({
			type: 'compound',
			id: r.id,
			title: r.name || r.formula || 'Unnamed',
			subtitle: `${r.formula || ''} · MW ${r.molar_mass || '?'}`,
			notebook_id: r.notebook_id,
			notebook_title: r.notebook_title,
			notebook_emoji: r.notebook_emoji || '🧪',
		});
	}

	// Map blocks (content matches)
	for (const r of (blocks.results || []) as any[]) {
		const snippet = (r.content || '').substring(0, 120).replace(/\n/g, ' ').trim();
		const typeLabel = r.type === 'text' ? 'Note' : r.type === 'data' ? 'Table' : 'Chat';
		results.push({
			type: 'block',
			id: r.id,
			title: `${typeLabel} in ${r.page_title || 'Untitled'}`,
			subtitle: snippet,
			notebook_id: r.notebook_id,
			notebook_title: r.notebook_title,
			notebook_emoji: r.notebook_emoji || '🧪',
			page_id: r.page_id,
			page_title: r.page_title,
		});
	}

	// Match tools (client-side, no DB)
	const ql = q.toLowerCase();
	for (const tool of TOOLS) {
		if (tool.title.toLowerCase().includes(ql) || tool.keywords.some(k => k.includes(ql))) {
			results.push({
				type: 'tool',
				id: tool.id,
				title: tool.title,
				subtitle: 'Lab Tool',
				notebook_id: '',
				notebook_title: '',
				notebook_emoji: '🔧',
			});
		}
	}

	return json({ results });
};
