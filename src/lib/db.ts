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

export interface Reagent {
	id: string;
	notebook_id: string;
	cas: string;
	name: string;
	formula: string;
	molar_mass: number;
	smiles: string;
	density: number | null;
	description: string;
	hazards: string; // JSON array of GHS codes
	metadata: string; // JSON object with extra data
	sort_order: number;
	created: string;
}

export interface ReagentCacheEntry {
	cas: string;
	data: string; // JSON array of CasCandidate[]
	created: string;
}

export interface CasCandidate {
	cid: number;
	cas: string;
	name: string;
	iupac_name: string;
	formula: string;
	molar_mass: number;
	smiles: string;
	density: number | null;
	description: string;
	synonyms: string[];
	hazards: GhsHazard[];
	source: 'pubchem' | 'ai';
	confidence?: string;
}

export interface GhsHazard {
	code: string;
	statement: string;
	pictogram: string; // GHS pictogram identifier e.g. 'GHS02' (flame)
}

export interface Reaction {
	id: string;
	notebook_id: string;
	name: string;
	target_smiles: string;
	target_name: string;
	target_mass: number;
	steps: string; // JSON array of ReactionStep[]
	metadata: string;
	sort_order: number;
	created: string;
	updated: string;
}

export interface ReactionStep {
	id: string;
	reagent_ids: string[];
	stoich_coefficients: number[];
	roles: string[]; // 'reactant' | 'catalyst' | 'solvent' | 'product'
	product_reagent_id?: string;
	product_stoich?: number;
	conditions: string; // e.g. "reflux, 2h, 80°C"
	notes: string;
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
