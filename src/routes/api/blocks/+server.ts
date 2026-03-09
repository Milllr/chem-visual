import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateId } from '$lib/db';

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const pageId = url.searchParams.get('page_id');
	if (!pageId) return json({ error: 'page_id required' }, { status: 400 });

	const { results } = await db
		.prepare('SELECT * FROM block WHERE page_id = ? ORDER BY sort_order ASC')
		.bind(pageId)
		.all();

	return json(results || []);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) return json({ error: 'DB unavailable' }, { status: 500 });

	const { page_id, type, content, image_url, metadata } = await request.json();
	if (!page_id || !type) return json({ error: 'page_id and type required' }, { status: 400 });

	// Get next sort order
	const last = await db
		.prepare('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM block WHERE page_id = ?')
		.bind(page_id)
		.first<{ max_order: number }>();

	const id = generateId();
	const sortOrder = (last?.max_order ?? -1) + 1;

	await db
		.prepare(
			'INSERT INTO block (id, page_id, type, content, image_url, metadata, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(
			id,
			page_id,
			type,
			content || null,
			image_url || null,
			metadata ? JSON.stringify(metadata) : null,
			sortOrder
		)
		.run();

	// Update parent page + notebook timestamps
	await db
		.prepare("UPDATE page SET updated = datetime('now') WHERE id = ?")
		.bind(page_id)
		.run();

	const page = await db.prepare('SELECT notebook_id FROM page WHERE id = ?').bind(page_id).first<{ notebook_id: string }>();
	if (page) {
		await db
			.prepare("UPDATE notebook SET updated = datetime('now') WHERE id = ?")
			.bind(page.notebook_id)
			.run();
	}

	const block = await db.prepare('SELECT * FROM block WHERE id = ?').bind(id).first();
	return json(block, { status: 201 });
};
