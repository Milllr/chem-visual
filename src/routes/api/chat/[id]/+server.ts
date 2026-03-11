import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Update a chat message's content
export const PUT: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const { content } = await request.json();
	if (!content) return json({ error: 'content required' }, { status: 400 });

	await db
		.prepare('UPDATE chat_message SET content = ? WHERE id = ?')
		.bind(content, params.id)
		.run();

	return json({ ok: true });
};

// Delete a chat message (optionally all messages after it too)
export const DELETE: RequestHandler = async ({ params, url, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const after = url.searchParams.get('after');

	if (after === 'true') {
		// Delete this message and everything after it (for resend)
		const msg = await db
			.prepare('SELECT notebook_id, created FROM chat_message WHERE id = ?')
			.bind(params.id)
			.first<{ notebook_id: string; created: string }>();

		if (msg) {
			await db
				.prepare('DELETE FROM chat_message WHERE notebook_id = ? AND created >= ?')
				.bind(msg.notebook_id, msg.created)
				.run();
		}
	} else {
		// Delete just this one message
		await db
			.prepare('DELETE FROM chat_message WHERE id = ?')
			.bind(params.id)
			.run();
	}

	return json({ ok: true });
};
