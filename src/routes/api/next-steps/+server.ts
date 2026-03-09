import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateId } from '$lib/db';

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const apiKey = platform?.env?.OPENAI_API_KEY;
	if (!apiKey) return json({ error: 'API key not configured' }, { status: 500 });

	// Get all tracked notebooks with goals and their last update time
	const { results: notebooks } = await db
		.prepare("SELECT id, title, description, goal, updated FROM notebook WHERE tracked = 1 ORDER BY updated DESC LIMIT 5")
		.all<{ id: string; title: string; description: string; goal: string; updated: string }>();

	if (!notebooks || notebooks.length === 0) {
		return json({ steps: [] });
	}

	// Check if we have cached steps and if they're still fresh
	const allSteps: { notebook_id: string; notebook_title: string; step: string }[] = [];
	let needsRegeneration = false;

	for (const nb of notebooks) {
		const cached = await db
			.prepare('SELECT steps, generated FROM next_steps WHERE notebook_id = ?')
			.bind(nb.id)
			.first<{ steps: string; generated: string }>();

		if (cached) {
			// Compare: regenerate if notebook updated after steps were generated
			const nbUpdated = new Date(nb.updated + 'Z').getTime();
			const stepsGenerated = new Date(cached.generated + 'Z').getTime();
			
			if (nbUpdated > stepsGenerated) {
				needsRegeneration = true;
				break;
			} else {
				// Use cached
				try {
					const parsed = JSON.parse(cached.steps);
					allSteps.push(...parsed);
				} catch {
					needsRegeneration = true;
					break;
				}
			}
		} else {
			needsRegeneration = true;
			break;
		}
	}

	if (!needsRegeneration && allSteps.length > 0) {
		return json({ steps: allSteps });
	}

	// Need to regenerate — get recent activity for each notebook
	const notebookSummaries: string[] = [];
	for (const nb of notebooks) {
		const { results: recentBlocks } = await db
			.prepare(
				`SELECT b.content FROM block b 
				 JOIN page p ON b.page_id = p.id 
				 WHERE p.notebook_id = ? AND b.type = 'text' AND b.content IS NOT NULL AND b.content != ''
				 ORDER BY b.created DESC LIMIT 3`
			)
			.bind(nb.id)
			.all<{ content: string }>();

		// Get previous next steps for context
		const { results: prevSteps } = await db
			.prepare('SELECT step, created FROM next_steps_history WHERE notebook_id = ? ORDER BY created DESC LIMIT 3')
			.bind(nb.id)
			.all<{ step: string; created: string }>();

		const recentText = (recentBlocks || []).map(b => b.content?.slice(0, 100)).join('; ');
		const prevStepText = (prevSteps || []).map(s => s.step).join('; ');
		
		notebookSummaries.push(
			`Notebook "${nb.title}" (id: ${nb.id})${nb.goal ? ` (Goal: ${nb.goal})` : ''}${nb.description ? ` — ${nb.description}` : ''}${recentText ? ` | Recent notes: ${recentText}` : ''}${prevStepText ? ` | Previous suggestions: ${prevStepText}` : ''}`
		);
	}

	const prompt = `You are a helpful lab assistant. Based on these active chemistry/materials science notebooks, suggest 1 specific next step per notebook. Be concise and actionable. Don't repeat previous suggestions — give new, progressive advice.

Notebooks:
${notebookSummaries.join('\n')}

Respond as a JSON array of objects: [{"notebook_id": "actual_id_from_above", "notebook_title": "...", "step": "short actionable next step"}]
Only return the JSON array, no other text.`;

	try {
		const res = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: 'gpt-5-mini',
				messages: [{ role: 'user', content: prompt }],
				max_completion_tokens: 500,
				temperature: 0.5
			})
		});

		if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
		const data = await res.json();
		const content = data.choices[0].message.content.trim();

		// Parse JSON from response (handle markdown code blocks)
		const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
		const steps = JSON.parse(jsonStr);

		// Store in cache and history
		for (const step of steps) {
			// Upsert cached step
			await db
				.prepare("INSERT OR REPLACE INTO next_steps (notebook_id, steps, generated) VALUES (?, ?, datetime('now'))")
				.bind(step.notebook_id, JSON.stringify([step]))
				.run();
			
			// Add to history
			await db
				.prepare("INSERT INTO next_steps_history (id, notebook_id, step) VALUES (?, ?, ?)")
				.bind(generateId(), step.notebook_id, step.step)
				.run();
		}

		return json({ steps });
	} catch (err) {
		console.error('Next steps error:', err);
		return json({ steps: [], error: String(err) });
	}
};
