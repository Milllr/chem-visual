import { nanoid } from 'nanoid';

export function generateId(): string {
	return nanoid(12);
}

export interface Notebook {
	id: string;
	title: string;
	description: string;
	color: string;
	emoji: string;
	goal: string;
	tracked: number;
	sort_order: number;
	created: string;
	updated: string;
}

export interface Page {
	id: string;
	notebook_id: string;
	title: string;
	drawings: string;
	sort_order: number;
	created: string;
	updated: string;
}

export interface Block {
	id: string;
	page_id: string;
	type: 'text' | 'image' | 'molecule' | 'chat_response' | 'document' | 'data';
	content: string | null;
	image_url: string | null;
	metadata: string | null;
	sort_order: number;
	created: string;
}

export interface ChatMessage {
	id: string;
	notebook_id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	model: string | null;
	created: string;
}

export const NOTEBOOK_COLORS = [
	'#C4A882', // kraft
	'#8BA88C', // sage
	'#A88B8B', // rose dust
	'#8B9FA8', // slate blue
	'#A89B8B', // taupe
	'#B8A0C4', // lavender
	'#C4B88A', // olive
	'#8BAAA8' // teal
];

export const NOTEBOOK_EMOJIS = [
	'',
	'',
	'',
	'',
	'',
	'',
	'',
	'',
	'',
	'',
	'',
	'',
	'',
	''
];
