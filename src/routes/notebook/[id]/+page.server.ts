import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Notebook, Page, Block, ChatMessage } from '$lib/db';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database unavailable');

	// Load notebook
	const notebook = await db
		.prepare('SELECT * FROM notebook WHERE id = ?')
		.bind(params.id)
		.first<Notebook>();

	if (!notebook) throw error(404, 'Notebook not found');

	// Load pages
	const { results: pages } = await db
		.prepare('SELECT * FROM page WHERE notebook_id = ? ORDER BY sort_order ASC')
		.bind(params.id)
		.all<Page>();

	const pageList = pages || [];

	// Load blocks for first page
	let blocks: Block[] = [];
	const firstPageId = pageList[0]?.id;
	if (firstPageId) {
		const { results } = await db
			.prepare('SELECT * FROM block WHERE page_id = ? ORDER BY sort_order ASC')
			.bind(firstPageId)
			.all<Block>();
		blocks = results || [];
	}

	// Load chat messages
	const { results: chatMessages } = await db
		.prepare(
			'SELECT * FROM chat_message WHERE notebook_id = ? ORDER BY created ASC LIMIT 100'
		)
		.bind(params.id)
		.all<ChatMessage>();

	return {
		notebook,
		pages: pageList,
		blocks,
		currentPageId: firstPageId || '',
		chatMessages: chatMessages || []
	};
};
