import type { PageServerLoad } from './$types';
import type { Notebook } from '$lib/db';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform?.env?.DB;
	if (!db) return { notebooks: [] };

	const { results } = await db
		.prepare('SELECT * FROM notebook ORDER BY updated DESC')
		.all<Notebook>();

	return { notebooks: results || [] };
};
