import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const apiKey = platform?.env?.OPENAI_API_KEY;
	if (!apiKey) return json({ error: 'API key not configured' }, { status: 500 });

	// Get all tracked notebooks with goals
	const { results: notebooks } = await db
		.prepare("SELECT id, title, description, goal FROM notebook WHERE tracked = 1 ORDER BY updated DESC LIMIT 5")
		.all<{ id: string; title: string; description: string; goal: string }>();

	if (!notebooks || notebooks.length === 0) {
		return json({ steps: [] });
	}

	// Get recent activity for each notebook
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

		const recentText = (recentBlocks || []).map(b => b.content?.slice(0, 100)).join('; ');
		notebookSummaries.push(
			`Notebook "${nb.title}"${nb.goal ? ` (Goal: ${nb.goal})` : ''}${nb.description ? ` — ${nb.description}` : ''}${recentText ? ` | Recent notes: ${recentText}` : ''}`
		);
	}

	const prompt = `You are a helpful lab assistant. Based on these active chemistry/materials science notebooks, suggest 1 specific next step per notebook. Be concise and actionable.

Notebooks:
${notebookSummaries.join('\n')}

Respond as a JSON array of objects: [{"notebook_id": "...", "notebook_title": "...", "step": "short actionable next step"}]
Only return the JSON array, no other text.`;

	try {
		const res = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: 'gpt-4o-mini',
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 500,
				temperature: 0.5
			})
		});

		if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
		const data = await res.json();
		const content = data.choices[0].message.content.trim();

		// Parse JSON from response (handle markdown code blocks)
		const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
		const steps = JSON.parse(jsonStr);

		return json({ steps });
	} catch (err) {
		console.error('Next steps error:', err);
		return json({ steps: [] });
	}
};
