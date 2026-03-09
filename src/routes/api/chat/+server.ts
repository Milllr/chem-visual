import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateId } from '$lib/db';
import { buildMessages, callOpenAI, callPerplexity } from '$lib/chat';

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const { notebook_id, message, model, imageDataUrls } = await request.json();
	if (!notebook_id || !message) {
		return json({ error: 'notebook_id and message required' }, { status: 400 });
	}

	// Get notebook title and goal
	const notebook = await db
		.prepare('SELECT title, goal FROM notebook WHERE id = ?')
		.bind(notebook_id)
		.first<{ title: string; goal: string }>();
	if (!notebook) return json({ error: 'Notebook not found' }, { status: 404 });

	// Get page summaries for context
	const { results: pages } = await db
		.prepare(
			`SELECT p.title, 
				(SELECT GROUP_CONCAT(b.content, ' ') FROM block b WHERE b.page_id = p.id AND b.type = 'text' LIMIT 3) as text_preview
			 FROM page p WHERE p.notebook_id = ? ORDER BY p.sort_order`
		)
		.bind(notebook_id)
		.all<{ title: string; text_preview: string | null }>();

	const pageSummaries = (pages || []).map(
		(p) => `- ${p.title}${p.text_preview ? ': ' + p.text_preview.slice(0, 150) : ''}`
	);

	// Load chat history
	const { results: history } = await db
		.prepare(
			"SELECT role, content FROM chat_message WHERE notebook_id = ? AND role != 'system' ORDER BY created ASC LIMIT 40"
		)
		.bind(notebook_id)
		.all<{ role: string; content: string }>();

	// Build messages and call AI
	const messages = buildMessages(notebook.title, pageSummaries, history || [], message, notebook.goal);

	// Save user message
	const userMsgId = generateId();
	await db
		.prepare(
			'INSERT INTO chat_message (id, notebook_id, role, content, model) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(userMsgId, notebook_id, 'user', message, model || 'openai')
		.run();

	let responseContent: string;
	const selectedModel = model || 'openai';

	try {
		if (selectedModel === 'perplexity') {
			const apiKey = platform?.env?.PERPLEXITY_API_KEY;
			if (!apiKey) throw new Error('Perplexity API key not configured');
			responseContent = await callPerplexity(messages, apiKey);
		} else {
			const apiKey = platform?.env?.OPENAI_API_KEY;
			if (!apiKey) throw new Error('OpenAI API key not configured');
			const images: string[] = Array.isArray(imageDataUrls) ? imageDataUrls : [];
			responseContent = await callOpenAI(messages, apiKey, images);
		}
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'AI call failed';
		return json({ error: errorMsg }, { status: 502 });
	}

	// Save assistant message
	const assistantMsgId = generateId();
	await db
		.prepare(
			'INSERT INTO chat_message (id, notebook_id, role, content, model) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(assistantMsgId, notebook_id, 'assistant', responseContent, selectedModel)
		.run();

	return json({
		id: assistantMsgId,
		role: 'assistant',
		content: responseContent,
		model: selectedModel
	});
};
