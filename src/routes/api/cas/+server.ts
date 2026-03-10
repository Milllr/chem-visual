import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { CasCandidate, GhsHazard } from '$lib/db';

const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const PUBCHEM_VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';

// 200ms delay between PubChem calls (5 req/s rate limit)
function delay(ms: number) {
	return new Promise(r => setTimeout(r, ms));
}

async function fetchJson(url: string): Promise<any> {
	const res = await fetch(url, { headers: { Accept: 'application/json' } });
	if (!res.ok) return null;
	return res.json();
}

// Fetch compound properties from PubChem by CID
async function getProperties(cid: number): Promise<Partial<CasCandidate> | null> {
	const url = `${PUBCHEM_BASE}/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IsomericSMILES,IUPACName,Title/JSON`;
	const data = await fetchJson(url);
	if (!data?.PropertyTable?.Properties?.[0]) return null;
	const p = data.PropertyTable.Properties[0];
	return {
		cid,
		formula: p.MolecularFormula || '',
		molar_mass: parseFloat(p.MolecularWeight) || 0,
		smiles: p.IsomericSMILES || '',
		iupac_name: p.IUPACName || '',
		name: p.Title || p.IUPACName || ''
	};
}

// Fetch synonyms for a CID (to find CAS numbers among them)
async function getSynonyms(cid: number): Promise<string[]> {
	await delay(200);
	const url = `${PUBCHEM_BASE}/compound/cid/${cid}/synonyms/JSON`;
	const data = await fetchJson(url);
	return data?.InformationList?.Information?.[0]?.Synonym || [];
}

// Fetch GHS hazard classification
async function getGhsHazards(cid: number): Promise<GhsHazard[]> {
	await delay(200);
	const url = `${PUBCHEM_VIEW}/data/compound/${cid}/JSON?heading=GHS+Classification`;
	const data = await fetchJson(url);
	if (!data?.Record?.Section) return [];

	const hazards: GhsHazard[] = [];
	const pictograms = new Set<string>();

	try {
		const sections = data.Record.Section;
		for (const sec of sections) {
			for (const sub of sec.Section || []) {
				for (const info of sub.Section || []) {
					const heading = info.Heading || '';
					if (heading === 'Pictogram(s)') {
						for (const inf of info.Information || []) {
							for (const markup of inf.Value?.StringWithMarkup || []) {
								for (const m of markup.Markup || []) {
									if (m.Extra) pictograms.add(m.Extra);
								}
							}
						}
					}
					if (heading === 'GHS Hazard Statements') {
						for (const inf of info.Information || []) {
							for (const markup of inf.Value?.StringWithMarkup || []) {
								const text = markup.String || '';
								// Parse "H200: Statement text" format
								const match = text.match(/^(H\d+[A-Za-z]?)\s*[:\-]\s*(.+)/);
								if (match) {
									hazards.push({
										code: match[1],
										statement: match[2].trim(),
										pictogram: ''
									});
								}
							}
						}
					}
				}
			}
		}
	} catch { /* GHS parsing is best-effort */ }

	// Map H-codes to standard GHS pictograms
	const pictogramArr = Array.from(pictograms);
	for (const h of hazards) {
		h.pictogram = pictogramArr[0] || mapHCodeToPictogram(h.code);
	}

	return hazards;
}

function mapHCodeToPictogram(code: string): string {
	const num = parseInt(code.replace(/^H/, ''));
	if (num >= 200 && num <= 204) return 'GHS01'; // exploding bomb
	if (num >= 220 && num <= 261) return 'GHS02'; // flame
	if (num >= 270 && num <= 272) return 'GHS03'; // flame over circle
	if (num >= 280 && num <= 284) return 'GHS04'; // gas cylinder
	if (num >= 290 && num <= 318) return 'GHS05'; // corrosion
	if (num >= 300 && num <= 312) return 'GHS06'; // skull
	if (num >= 315 && num <= 373) return 'GHS07'; // exclamation
	if (num >= 334 && num <= 372) return 'GHS08'; // health hazard
	if (num >= 400 && num <= 420) return 'GHS09'; // environment
	return 'GHS07';
}

// Fetch density from PubChem experimental properties
async function getDensity(cid: number): Promise<number | null> {
	await delay(200);
	const url = `${PUBCHEM_VIEW}/data/compound/${cid}/JSON?heading=Density`;
	const data = await fetchJson(url);
	if (!data?.Record?.Section) return null;

	try {
		for (const sec of data.Record.Section) {
			for (const sub of sec.Section || []) {
				for (const info of sub.Section || []) {
					for (const inf of info.Information || []) {
						const str = inf.Value?.StringWithMarkup?.[0]?.String || '';
						const match = str.match(/([\d.]+)\s*g\/?[cm³ml]/i);
						if (match) return parseFloat(match[1]);
					}
				}
			}
		}
	} catch { /* best-effort */ }
	return null;
}

// Fetch short description
async function getDescription(cid: number): Promise<string> {
	await delay(200);
	const url = `${PUBCHEM_BASE}/compound/cid/${cid}/description/JSON`;
	const data = await fetchJson(url);
	if (!data?.InformationList?.Information) return '';
	for (const info of data.InformationList.Information) {
		if (info.Description && info.Description.length > 10) {
			// Truncate to first 300 chars
			return info.Description.slice(0, 300) + (info.Description.length > 300 ? '...' : '');
		}
	}
	return '';
}

// GPT-4o fallback for PubChem misses
async function aiLookup(cas: string, apiKey: string): Promise<CasCandidate[]> {
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: 'gpt-4o',
			max_tokens: 2048,
			temperature: 0.1,
			messages: [
				{
					role: 'system',
					content: `You are a chemistry database assistant. Given a CAS registry number, return compound information as a JSON array. Even if the compound is novel or uncommon, provide your best knowledge. Include a "confidence" field: "high" if you are sure this CAS maps to a real compound, "medium" if likely, "low" if uncertain.

Return ONLY a JSON array (no markdown, no explanation) with objects having these fields:
- name (string, common name)
- iupac_name (string)
- formula (string, molecular formula)
- molar_mass (number, g/mol)
- smiles (string, canonical SMILES)
- density (number or null, g/cm³)
- description (string, 1-2 sentence description)
- synonyms (string array, other names)
- hazards (array of {code, statement, pictogram} for GHS H-codes, or empty array if unknown)
- confidence (string: "high", "medium", or "low")`
				},
				{ role: 'user', content: `CAS Number: ${cas}` }
			]
		})
	});

	if (!res.ok) return [];

	const data = await res.json();
	const text = data.choices?.[0]?.message?.content?.trim() || '[]';

	try {
		// Strip markdown code fences if present
		const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
		const arr = JSON.parse(cleaned);
		return (Array.isArray(arr) ? arr : [arr]).map((item: any) => ({
			cid: 0,
			cas,
			name: item.name || 'Unknown',
			iupac_name: item.iupac_name || '',
			formula: item.formula || '',
			molar_mass: item.molar_mass || 0,
			smiles: item.smiles || '',
			density: item.density || null,
			description: item.description || '',
			synonyms: item.synonyms || [],
			hazards: (item.hazards || []).map((h: any) => ({
				code: h.code || '',
				statement: h.statement || '',
				pictogram: h.pictogram || mapHCodeToPictogram(h.code || '')
			})),
			source: 'ai' as const,
			confidence: item.confidence || 'medium'
		}));
	} catch {
		return [];
	}
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const { cas } = await request.json();
	if (!cas || typeof cas !== 'string') {
		return json({ error: 'CAS number required' }, { status: 400 });
	}

	// Normalize CAS (strip spaces, validate rough format)
	const normalized = cas.trim().replace(/\s+/g, '');
	if (!/^\d{2,7}-\d{2}-\d$/.test(normalized)) {
		return json({ error: 'Invalid CAS format. Expected format: XXXXXXX-XX-X' }, { status: 400 });
	}

	// 1. Check reagent_cache
	const cached = await db
		.prepare('SELECT data FROM reagent_cache WHERE cas = ?')
		.bind(normalized)
		.first<{ data: string }>();

	if (cached) {
		return json({ candidates: JSON.parse(cached.data), source: 'cache' });
	}

	// 2. Try PubChem
	let candidates: CasCandidate[] = [];

	try {
		// Search by CAS name (PubChem treats CAS as a synonym)
		const searchUrl = `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(normalized)}/cids/JSON`;
		const searchData = await fetchJson(searchUrl);
		const cids: number[] = searchData?.IdentifierList?.CID || [];

		if (cids.length > 0) {
			// Limit to first 5 CIDs
			const limitedCids = cids.slice(0, 5);

			for (const cid of limitedCids) {
				await delay(200);
				const props = await getProperties(cid);
				if (!props) continue;

				const synonyms = await getSynonyms(cid);
				const hazards = await getGhsHazards(cid);
				const density = await getDensity(cid);
				const description = await getDescription(cid);

				candidates.push({
					cid,
					cas: normalized,
					name: props.name || '',
					iupac_name: props.iupac_name || '',
					formula: props.formula || '',
					molar_mass: props.molar_mass || 0,
					smiles: props.smiles || '',
					density,
					description,
					synonyms: synonyms.slice(0, 10),
					hazards,
					source: 'pubchem'
				});
			}
		}
	} catch (e) {
		console.error('PubChem lookup error:', e);
	}

	// 3. If PubChem returned nothing, fall back to GPT-4o
	if (candidates.length === 0) {
		const apiKey = platform?.env?.OPENAI_API_KEY;
		if (apiKey) {
			candidates = await aiLookup(normalized, apiKey);
		}
	}

	// 4. Cache results (even empty to avoid repeated lookups)
	if (candidates.length > 0) {
		try {
			await db
				.prepare('INSERT OR REPLACE INTO reagent_cache (cas, data) VALUES (?, ?)')
				.bind(normalized, JSON.stringify(candidates))
				.run();
		} catch { /* cache is best-effort */ }
	}

	return json({ candidates, source: candidates[0]?.source || 'none' });
};
