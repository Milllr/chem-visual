import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateExperimental } from '$lib/chat';

export const POST: RequestHandler = async ({ request, platform }) => {
	const apiKey = platform?.env?.OPENAI_API_KEY;
	if (!apiKey) return json({ error: 'API key not configured' }, { status: 500 });

	const body: any = await request.json();
	const { reaction, compounds } = body;

	if (!reaction) return json({ error: 'reaction data required' }, { status: 400 });

	try {
		const steps = typeof reaction.steps === 'string'
			? JSON.parse(reaction.steps || '[]')
			: reaction.steps || [];

		const text = await generateExperimental(
			{
				name: reaction.name || 'Untitled Reaction',
				steps,
				actual_yield: reaction.actual_yield || 0,
				theoretical_yield: reaction.theoretical_yield || 0,
				yield_percent: reaction.yield_percent || 0
			},
			compounds || [],
			apiKey
		);

		return json({ text });
	} catch (err) {
		console.error('Writeup generation error:', err);
		return json({ error: 'Failed to generate experimental' }, { status: 500 });
	}
};
