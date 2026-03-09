const SYSTEM_PROMPT = `You are a chemistry lab assistant embedded in a personal lab notebook. Your expertise:
- Organic chemistry: reactions, mechanisms, synthesis, nomenclature, spectroscopy
- Inorganic chemistry: coordination, crystal field theory, main group
- Analytical chemistry: spectroscopy (NMR, IR, MS), chromatography, titrations
- Physical chemistry: thermodynamics, kinetics, equilibria, quantum
- Materials science: metals, alloys, ceramics, polymers, composites
- Metallurgy: phase diagrams, heat treatment, corrosion, mechanical properties
- Common alloys: steels (carbon, stainless, tool), aluminum (2xxx-7xxx series), titanium (Ti-6Al-4V etc), copper alloys (brass, bronze), nickel superalloys (Inconel, Hastelloy), magnesium, zinc alloys
- Lab safety, techniques, and procedures

Rules:
1. Be EXTREMELY concise. Max 3-5 short bullet points.
2. Use chemical notation: formulas, equations, SMILES in backticks.
3. For molecules, include key data as compact list (MW, mp, bp, density).
4. Never pad with unnecessary context or qualifiers.
5. Show calculation setup and answer, not every intermediate step.
6. Think: lab notebook margin notes, not textbook passages.
7. When referencing structures, include SMILES: e.g. ethanol \`CCO\``;

export function buildMessages(
	notebookTitle: string,
	pageSummaries: string[],
	chatHistory: { role: string; content: string }[],
	userMessage: string
) {
	const context =
		pageSummaries.length > 0
			? `\n\nNotebook "${notebookTitle}" pages:\n${pageSummaries.join('\n')}`
			: `\n\nNotebook: "${notebookTitle}"`;

	return [
		{ role: 'system' as const, content: SYSTEM_PROMPT + context },
		...chatHistory.slice(-40),
		{ role: 'user' as const, content: userMessage }
	];
}

export async function callOpenAI(
	messages: { role: string; content: string }[],
	apiKey: string
): Promise<string> {
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: 'gpt-4o',
			messages,
			max_tokens: 500,
			temperature: 0.3
		})
	});
	if (!res.ok) throw new Error(`OpenAI: ${await res.text()}`);
	const data = await res.json();
	return data.choices[0].message.content;
}

export async function callPerplexity(
	messages: { role: string; content: string }[],
	apiKey: string
): Promise<string> {
	const res = await fetch('https://api.perplexity.ai/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: 'sonar',
			messages,
			max_tokens: 500
		})
	});
	if (!res.ok) throw new Error(`Perplexity: ${await res.text()}`);
	const data = await res.json();
	return data.choices[0].message.content;
}

export async function formulaToSmiles(formula: string, apiKey: string): Promise<string> {
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content:
						"Convert the molecular formula or chemical name to a valid SMILES string. Return ONLY the SMILES string. If ambiguous, use the most common isomer. If it's already SMILES, return as-is."
				},
				{ role: 'user', content: formula }
			],
			max_tokens: 100,
			temperature: 0
		})
	});
	if (!res.ok) throw new Error('SMILES conversion failed');
	const data = await res.json();
	return data.choices[0].message.content.trim();
}
