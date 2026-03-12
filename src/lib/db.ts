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
	type: 'text' | 'image' | 'molecule' | 'chat_response' | 'document' | 'data' | 'reaction_step' | 'tlc';
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
	actual_yield: number;
	theoretical_yield: number;
	yield_percent: number;
	metadata: string;
	sort_order: number;
	created: string;
	updated: string;
}

export interface ChemSpecies {
	source: 'reagent' | 'compound' | 'custom';
	ref_id?: string;     // ID in reagent or compound table
	name: string;
	formula: string;
	mw: number;          // g/mol
	smiles: string;
	density?: number;    // g/mL (from reagent library)
	stoich: number;      // stoichiometric coefficient
	amount: number;      // practical quantity (user-entered)
	unit: 'mol' | 'mmol' | 'g' | 'mg' | 'mL' | 'µL';  // unit for amount
}

export interface ReactionStep {
	id: string;
	reactants: ChemSpecies[];     // left side of arrow
	products: ChemSpecies[];      // right side of arrow
	conditions_above: string;     // catalyst, reagent, base (shown above arrow)
	conditions_below: string;     // solvent, temperature, time (shown below arrow)
	notes: string;
}

export interface Compound {
	id: string;
	notebook_id: string;
	name: string;
	smiles: string;
	formula: string;
	molar_mass: number;
	reaction_id: string | null;
	actual_yield: number;
	theoretical_yield: number;
	yield_percent: number;
	nmr_data: string;
	mass_spec: number;
	mass_spec_type: string;
	mass_spec_notes: string;
	ir_data: number;
	ir_notes: string;
	crystal: number;
	crystal_notes: string;
	melting_point: string;
	optical_rotation: string;
	notes: string;
	metadata: string;
	sort_order: number;
	created: string;
	updated: string;
}

export interface Timer {
	id: string;
	notebook_id: string;
	label: string;
	duration_seconds: number;
	started_at: string;
	page_id: string | null;
	created: string;
}

export interface TlcSpot {
	rf: number;
	label: string;
	appearance: string;
}

export interface TlcData {
	solvent_system: string;
	stain: string;
	spots: TlcSpot[];
	notes: string;
}

export const NMR_NUCLEI = [
	{ id: '1H', label: '¹H', name: 'Proton' },
	{ id: '13C', label: '¹³C', name: 'Carbon-13' },
	{ id: '19F', label: '¹⁹F', name: 'Fluorine-19' },
	{ id: '31P', label: '³¹P', name: 'Phosphorus-31' },
	{ id: '11B', label: '¹¹B', name: 'Boron-11' },
	{ id: '15N', label: '¹⁵N', name: 'Nitrogen-15' },
	{ id: '29Si', label: '²⁹Si', name: 'Silicon-29' },
	{ id: '7Li', label: '⁷Li', name: 'Lithium-7' },
	{ id: 'DEPT', label: 'DEPT', name: 'DEPT-135' },
	{ id: 'COSY', label: 'COSY', name: '¹H-¹H COSY' },
	{ id: 'HSQC', label: 'HSQC', name: '¹H-¹³C HSQC' },
	{ id: 'HMBC', label: 'HMBC', name: '¹H-¹³C HMBC' },
	{ id: 'NOESY', label: 'NOESY', name: 'NOESY' },
];

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
