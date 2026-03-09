import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateId } from '$lib/db';

interface TrackedNotebook {
	id: string;
	title: string;
	description: string;
	goal: string;
	updated: string;
}

async function generateStepForNotebook(
	nb: TrackedNotebook,
	db: D1Database,
	apiKey: string
): Promise<{ notebook_id: string; notebook_title: string; step: string }> {
	// Get recent activity
	const { results: recentBlocks } = await db
		.prepare(
			`SELECT b.content FROM block b 
			 JOIN page p ON b.page_id = p.id 
			 WHERE p.notebook_id = ? AND b.type = 'text' AND b.content IS NOT NULL AND b.content != ''
			 ORDER BY b.created DESC LIMIT 3`
		)
		.bind(nb.id)
		.all<{ content: string }>();

	// Get previous suggestions to avoid repeats
	const { results: prevSteps } = await db
		.prepare('SELECT step FROM next_steps_history WHERE notebook_id = ? ORDER BY created DESC LIMIT 3')
		.bind(nb.id)
		.all<{ step: string }>();

	const recentText = (recentBlocks || []).map(b => b.content?.slice(0, 100)).join('; ');
	const prevStepText = (prevSteps || []).map(s => s.step).join('; ');

	const prompt = `You are a helpful lab assistant for a 4th-year chemistry undergraduate. Based on this notebook, suggest 1 specific, actionable next step. Be concise. Don't repeat previous suggestions.

Notebook: "${nb.title}"${nb.goal ? ` (Goal: ${nb.goal})` : ''}${nb.description ? ` — ${nb.description}` : ''}${recentText ? `\nRecent notes: ${recentText}` : ''}${prevStepText ? `\nPrevious suggestions (don't repeat): ${prevStepText}` : ''}

Respond with ONLY a JSON object: {"step": "your short actionable next step"}`;

	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: 'gpt-5-mini',
			messages: [
				{ role: 'developer', content: 'Respond only with the JSON object requested. No other text.' },
				{ role: 'user', content: prompt }
			],
			max_completion_tokens: 4096
		})
	});

	if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
	const data = await res.json();
	const content = data.choices?.[0]?.message?.content;
	if (!content) throw new Error('Empty response from model');

	const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
	const parsed = JSON.parse(jsonStr);

	const step = {
		notebook_id: nb.id,
		notebook_title: nb.title,
		step: parsed.step || parsed.next_step || String(parsed)
	};

	// Cache and save to history
	await db
		.prepare("INSERT OR REPLACE INTO next_steps (notebook_id, steps, generated) VALUES (?, ?, datetime('now'))")
		.bind(nb.id, JSON.stringify([step]))
		.run();
	await db
		.prepare('INSERT INTO next_steps_history (id, notebook_id, step) VALUES (?, ?, ?)')
		.bind(generateId(), nb.id, step.step)
		.run();

	return step;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const apiKey = platform?.env?.OPENAI_API_KEY;
	if (!apiKey) return json({ error: 'API key not configured' }, { status: 500 });

	const { results: notebooks } = await db
		.prepare("SELECT id, title, description, goal, updated FROM notebook WHERE tracked = 1 ORDER BY updated DESC LIMIT 5")
		.all<TrackedNotebook>();

	if (!notebooks || notebooks.length === 0) {
		return json({ steps: [] });
	}

	const allSteps: { notebook_id: string; notebook_title: string; step: string }[] = [];

	try {
		for (const nb of notebooks) {
			const cached = await db
				.prepare('SELECT steps, generated FROM next_steps WHERE notebook_id = ?')
				.bind(nb.id)
				.first<{ steps: string; generated: string }>();

			if (cached) {
				const nbUpdated = new Date(nb.updated + 'Z').getTime();
				const stepsGenerated = new Date(cached.generated + 'Z').getTime();

				if (nbUpdated <= stepsGenerated) {
					// Still fresh — use cached
					try {
						const parsed = JSON.parse(cached.steps);
						allSteps.push(...parsed);
						continue;
					} catch {
						// Bad cache, regenerate
					}
				}
			}

			// Stale or missing — regenerate only this notebook
			const step = await generateStepForNotebook(nb, db, apiKey);
			allSteps.push(step);
		}

		return json({ steps: allSteps });
	} catch (err) {
		console.error('Next steps error:', err);
		// Return whatever we have so far plus error
		return json({ steps: allSteps, error: String(err) });
	}
};
