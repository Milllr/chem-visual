const SYSTEM_PROMPT = `You are a knowledgeable chemistry lab assistant embedded in a personal lab notebook. The user is a 4th-year chemistry undergraduate heading into a master's program in the fall. They work in a university research lab with standard synthetic chemistry, analytical, and materials characterization equipment (NMR, IR, MS, UV-Vis, XRD, SEM, TGA/DSC, fume hoods, gloveboxes, etc.). Pitch your explanations at an advanced undergraduate / early graduate level — be technical, assume solid fundamentals, and teach at the edges of their knowledge.

Your expertise spans:
- Organic chemistry: reactions, mechanisms, synthesis, nomenclature, spectroscopy
- Inorganic chemistry: coordination compounds, crystal field theory, main group chemistry
- Analytical chemistry: spectroscopy (NMR, IR, MS, UV-Vis), chromatography, titrations
- Physical chemistry: thermodynamics, kinetics, equilibria, quantum mechanics
- Materials science: metals, alloys, ceramics, polymers, composites
- Metallurgy: phase diagrams, heat treatment, corrosion, mechanical properties
- Common alloys: steels (carbon, stainless, tool), aluminum (2xxx-7xxx series), titanium (Ti-6Al-4V etc), copper alloys (brass, bronze), nickel superalloys (Inconel, Hastelloy), magnesium, zinc alloys
- Lab safety, techniques, and procedures

Guidelines:
1. Give thorough, useful answers. Explain your reasoning and include context that helps the user understand.
2. Use chemical notation naturally: formulas, balanced equations, SMILES notation in backticks.
3. For molecules, include relevant data (MW, mp, bp, density, solubility) when helpful.
4. Show calculation steps clearly so the user can follow and verify.
5. When discussing reactions, explain the mechanism or conditions needed.
6. Include safety notes when relevant (hazards, PPE, handling).
7. When referencing structures, include SMILES: e.g. ethanol \`CCO\`
8. If you reference uploaded context documents, cite which document the info comes from.
9. Be genuinely helpful — think of yourself as a smart lab partner, not a terse search engine.`;

export function buildMessages(
	notebookTitle: string,
	pageSummaries: string[],
	chatHistory: { role: string; content: string }[],
	userMessage: string,
	notebookGoal?: string,
	reagents?: { name: string; formula: string; cas: string; molar_mass: number }[],
	reactions?: { name: string; target_name: string; steps: string; yield_percent: number }[],
	compoundsList?: { name: string; formula: string; molar_mass: number; yield_percent: number; notes: string }[]
) {
	let context = `\n\nNotebook: "${notebookTitle}"`;
	if (notebookGoal) {
		context += `\nProject Goal: ${notebookGoal}`;
	}
	if (pageSummaries.length > 0) {
		context += `\nPages:\n${pageSummaries.join('\n')}`;
	}

	// Add reagent library context
	if (reagents && reagents.length > 0) {
		context += `\n\nReagent Library (${reagents.length} reagents):`;
		for (const r of reagents) {
			context += `\n- ${r.name} (${r.formula}, CAS ${r.cas}, MW ${r.molar_mass})`;
		}
	}

	// Add reaction context
	if (reactions && reactions.length > 0) {
		context += `\n\nReactions (${reactions.length}):`;
		for (const rx of reactions) {
			let rxLine = `\n- ${rx.name}`;
			if (rx.target_name) rxLine += ` → ${rx.target_name}`;
			if (rx.yield_percent > 0) rxLine += ` (${rx.yield_percent}% yield)`;
			// Parse steps to show conditions
			try {
				const steps = JSON.parse(rx.steps || '[]');
				for (const step of steps) {
					const reactantNames = (step.reactants || []).map((s: any) => s.name).join(' + ');
					const productNames = (step.products || []).map((s: any) => s.name).join(' + ');
					let stepLine = `  ${reactantNames} → ${productNames}`;
					if (step.conditions_above) stepLine += ` [${step.conditions_above}]`;
					if (step.conditions_below) stepLine += ` (${step.conditions_below})`;
					rxLine += `\n  ${stepLine}`;
				}
			} catch {}
			context += rxLine;
		}
	}

	// Add compound tracker context
	if (compoundsList && compoundsList.length > 0) {
		context += `\n\nCompounds (${compoundsList.length}):`;
		for (const c of compoundsList) {
			let cLine = `\n- ${c.name} (${c.formula}, MW ${c.molar_mass})`;
			if (c.yield_percent > 0) cLine += ` ${c.yield_percent}% yield`;
			if (c.notes) cLine += ` — ${c.notes.slice(0, 100)}`;
			context += cLine;
		}
	}

	return [
		{ role: 'developer' as const, content: SYSTEM_PROMPT + context },
		...chatHistory.slice(-40),
		{ role: 'user' as const, content: userMessage }
	];
}

export async function callOpenAI(
	messages: { role: string; content: string }[],
	apiKey: string,
	imageDataUrls: string[] = []
): Promise<string> {
	// If images are provided, convert the last user message to vision format
	let apiMessages: any[] = messages;
	if (imageDataUrls.length > 0) {
		apiMessages = messages.map((msg, idx) => {
			// Only add images to the last user message
			if (idx === messages.length - 1 && msg.role === 'user') {
				const content: any[] = [{ type: 'text', text: msg.content }];
				for (const dataUrl of imageDataUrls) {
					content.push({
						type: 'image_url',
						image_url: { url: dataUrl, detail: 'low' }
					});
				}
				return { role: msg.role, content };
			}
			return msg;
		});
	}

	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: 'gpt-5.1',
			messages: apiMessages,
			max_completion_tokens: 16384
		})
	});
	if (!res.ok) throw new Error(`OpenAI: ${await res.text()}`);
	const data = await res.json();
	const content = data.choices?.[0]?.message?.content;
	if (!content) {
		// Reasoning models may put content elsewhere
		const rc = data.choices?.[0]?.message?.reasoning_content;
		if (rc) return rc;
		throw new Error('Empty response from model');
	}
	return content;
}

export async function callPerplexity(
	messages: { role: string; content: string }[],
	apiKey: string
): Promise<string> {
	// Perplexity only accepts system/user/assistant/tool — convert developer→system
	// Also requires alternating user/assistant messages after system
	const filtered: { role: string; content: string }[] = [];
	for (const msg of messages) {
		const role = msg.role === 'developer' ? 'system' : msg.role;
		if (role === 'system') {
			// Merge multiple system messages into one
			const existingSystem = filtered.find(m => m.role === 'system');
			if (existingSystem) {
				existingSystem.content += '\n\n' + msg.content;
			} else {
				filtered.push({ role: 'system', content: msg.content });
			}
			continue;
		}
		const last = filtered[filtered.length - 1];
		if (last && last.role === role) {
			// Merge consecutive same-role messages
			last.content += '\n\n' + msg.content;
		} else {
			filtered.push({ role, content: msg.content });
		}
	}

	const res = await fetch('https://api.perplexity.ai/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: 'sonar-pro',
			messages: filtered,
			max_tokens: 1500
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
			model: 'gpt-5-mini',
			messages: [
				{
					role: 'developer',
					content:
						"Convert the molecular formula or chemical name to a valid SMILES string. Return ONLY the SMILES string. If ambiguous, use the most common isomer. If it's already SMILES, return as-is."
				},
				{ role: 'user', content: formula }
			],
			max_completion_tokens: 4096
		})
	});
	if (!res.ok) throw new Error('SMILES conversion failed');
	const data = await res.json();
	const content = data.choices?.[0]?.message?.content;
	if (!content) throw new Error('Empty SMILES response');
	return content.trim();
}
