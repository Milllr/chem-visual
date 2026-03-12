/**
 * Chemistry utilities — molecular formula parsing, MW calculation,
 * exact mass / HRMS, degree of unsaturation, solvent reference, column calc
 */

/** Standard atomic masses (IUPAC 2021 recommended values) — average masses */
const ATOMIC_MASSES: Record<string, number> = {
	H: 1.008, He: 4.003, Li: 6.941, Be: 9.012, B: 10.81, C: 12.011,
	N: 14.007, O: 15.999, F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305,
	Al: 26.982, Si: 28.086, P: 30.974, S: 32.065, Cl: 35.453, Ar: 39.948,
	K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996,
	Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38,
	Ga: 69.723, Ge: 72.63, As: 74.922, Se: 78.96, Br: 79.904, Kr: 83.798,
	Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224, Nb: 92.906, Mo: 95.96,
	Tc: 98.0, Ru: 101.07, Rh: 102.906, Pd: 106.42, Ag: 107.868, Cd: 112.411,
	In: 114.818, Sn: 118.710, Sb: 121.760, Te: 127.60, I: 126.904, Xe: 131.293,
	Cs: 132.905, Ba: 137.327, La: 138.905, Ce: 140.116, Pr: 140.908,
	Nd: 144.242, Pm: 145.0, Sm: 150.36, Eu: 151.964, Gd: 157.25,
	Tb: 158.925, Dy: 162.500, Ho: 164.930, Er: 167.259, Tm: 168.934,
	Yb: 173.054, Lu: 174.967, Hf: 178.49, Ta: 180.948, W: 183.84,
	Re: 186.207, Os: 190.23, Ir: 192.217, Pt: 195.084, Au: 196.967,
	Hg: 200.59, Tl: 204.383, Pb: 207.2, Bi: 208.980, Po: 209.0, At: 210.0,
	Rn: 222.0, Fr: 223.0, Ra: 226.0, Ac: 227.0, Th: 232.038, Pa: 231.036,
	U: 238.029, Np: 237.0, Pu: 244.0, Am: 243.0, Cm: 247.0
};

/** Monoisotopic masses — mass of the most abundant isotope of each element (NIST values) */
const MONOISOTOPIC_MASSES: Record<string, number> = {
	H: 1.0078250319, He: 4.0026032541, Li: 7.0160034366, Be: 9.0121830650,
	B: 11.0093053600, C: 12.0000000000, N: 14.0030740052, O: 15.9949146221,
	F: 18.9984031627, Ne: 19.9924401762, Na: 22.9897692820, Mg: 23.9850417000,
	Al: 26.9815385300, Si: 27.9769265350, P: 30.9737619980, S: 31.9720711744,
	Cl: 34.9688527100, Ar: 39.9623831237, K: 38.9637064864, Ca: 39.9625909810,
	Sc: 44.9559100500, Ti: 47.9479463000, V: 50.9439595000, Cr: 51.9405075000,
	Mn: 54.9380451000, Fe: 55.9349375000, Co: 58.9331950000, Ni: 57.9353429000,
	Cu: 62.9295975000, Zn: 63.9291422000, Ga: 68.9255735000, Ge: 73.9211778000,
	As: 74.9215965000, Se: 79.9165218000, Br: 78.9183376000, Kr: 83.9114977282,
	Rb: 84.9117897379, Sr: 87.9056125000, Y: 88.9058403000, Zr: 89.9047044000,
	Nb: 92.9063781000, Mo: 97.9054078000, Ru: 101.9043493000, Rh: 102.9055040000,
	Pd: 105.9034804000, Ag: 106.9050916000, Cd: 113.9033585000, In: 114.9038780000,
	Sn: 119.9022016000, Sb: 120.9038157000, Te: 129.9062244000, I: 126.9044719000,
	Xe: 131.9041535000, Cs: 132.9054519610, Ba: 137.9052470000, La: 138.9063533000,
	Ce: 139.9054387000, Pr: 140.9076528000, Nd: 141.9077233000, Sm: 151.9197324000,
	Eu: 152.9212303000, Gd: 157.9241039000, Tb: 158.9253468000, Dy: 163.9291748000,
	Ho: 164.9303221000, Er: 165.9302931000, Tm: 168.9342133000, Yb: 173.9388621000,
	Lu: 174.9407718000, Hf: 179.9465500000, Ta: 180.9479958000, W: 183.9509312000,
	Re: 186.9557531000, Os: 191.9614807000, Ir: 192.9629264000, Pt: 194.9647911000,
	Au: 196.9665688000, Hg: 201.9706430000, Tl: 204.9744275000, Pb: 207.9766521000,
	Bi: 208.9803987000, Th: 232.0380553000, Pa: 231.0358840000, U: 238.0507882000
};

/** Common mass spec adduct ions with their mass offsets and charge */
export const MS_ADDUCTS = [
	{ label: '[M+H]⁺', delta: 1.0072764522, charge: '+', mode: 'pos' },
	{ label: '[M+Na]⁺', delta: 22.9892207, charge: '+', mode: 'pos' },
	{ label: '[M+K]⁺', delta: 38.9631585, charge: '+', mode: 'pos' },
	{ label: '[M+NH₄]⁺', delta: 18.0343811, charge: '+', mode: 'pos' },
	{ label: '[M+2H]²⁺', delta: 1.0072764522, charge: '2+', mode: 'pos', z: 2 },
	{ label: '[M−H]⁻', delta: -1.0072764522, charge: '−', mode: 'neg' },
	{ label: '[M+Cl]⁻', delta: 34.9694013, charge: '−', mode: 'neg' },
	{ label: '[M+HCOO]⁻', delta: 44.9976542, charge: '−', mode: 'neg' },
	{ label: '[M+CH₃COO]⁻', delta: 59.0133042, charge: '−', mode: 'neg' },
] as const;

/**
 * Calculate monoisotopic exact mass from a molecular formula.
 * Returns mass in Da rounded to 4 decimal places, or 0 if unparseable.
 */
export function calcExactMass(formula: string): number {
	if (!formula || !formula.trim()) return 0;
	try {
		const elements = parseFormula(formula.trim());
		let mass = 0;
		for (const [el, count] of Object.entries(elements)) {
			const m = MONOISOTOPIC_MASSES[el];
			if (!m) return 0;
			mass += m * count;
		}
		return Math.round(mass * 10000) / 10000;
	} catch {
		return 0;
	}
}

/**
 * Calculate all common MS adduct m/z values for a given formula.
 */
export function calcAdducts(formula: string): { label: string; mz: number; mode: string }[] {
	const exactMass = calcExactMass(formula);
	if (!exactMass) return [];
	return MS_ADDUCTS.map(a => ({
		label: a.label,
		mz: Math.round(((exactMass + a.delta) / (a.z || 1)) * 10000) / 10000,
		mode: a.mode
	}));
}

/**
 * Calculate Index of Hydrogen Deficiency (IHD) / Degree of Unsaturation.
 * Formula: IHD = (2C + 2 + N - H - X) / 2
 * where X = F + Cl + Br + I (halogens)
 */
export function calcIHD(formula: string): number | null {
	if (!formula) return null;
	try {
		const el = parseFormula(formula.trim());
		const C = el['C'] || 0;
		const H = el['H'] || 0;
		const N = el['N'] || 0;
		const halogens = (el['F'] || 0) + (el['Cl'] || 0) + (el['Br'] || 0) + (el['I'] || 0);
		const ihd = (2 * C + 2 + N - H - halogens) / 2;
		return ihd;
	} catch {
		return null;
	}
}

/**
 * Nitrogen rule check: if odd number of nitrogen atoms → odd nominal mass (and vice versa).
 * Returns { passes: boolean, message: string }
 */
export function nitrogenRuleCheck(formula: string): { passes: boolean; message: string } {
	if (!formula) return { passes: true, message: '' };
	try {
		const el = parseFormula(formula.trim());
		const N = el['N'] || 0;
		// Calculate nominal mass (sum of most abundant isotope mass numbers)
		const nominalMassMap: Record<string, number> = {
			H: 1, C: 12, N: 14, O: 16, F: 19, Si: 28, P: 31, S: 32, Cl: 35, Br: 79, I: 127
		};
		let nomMass = 0;
		for (const [e, count] of Object.entries(el)) {
			nomMass += (nominalMassMap[e] || Math.round(ATOMIC_MASSES[e] || 0)) * count;
		}
		const oddN = N % 2 !== 0;
		const oddMass = nomMass % 2 !== 0;
		const passes = oddN === oddMass;
		return {
			passes,
			message: passes
				? `Consistent: ${N} N atom${N !== 1 ? 's' : ''}, nominal mass ${nomMass} (${oddMass ? 'odd' : 'even'})`
				: `Warning: ${N} N atom${N !== 1 ? 's' : ''} (${oddN ? 'odd' : 'even'}) but nominal mass ${nomMass} (${oddMass ? 'odd' : 'even'})`
		};
	} catch {
		return { passes: true, message: '' };
	}
}

/** Solvent reference data for common lab solvents */
export interface SolventData {
	name: string;
	formula: string;
	bp: number;         // °C
	density: number;    // g/mL
	polarity: number;   // polarity index (Snyder)
	miscibleWater: boolean;
	rotavapPressure: number; // mbar at 40°C bath
	dryingAgent: string;
	wasteCategory: 'halogenated' | 'non-halogenated' | 'aqueous';
}

export const SOLVENT_TABLE: SolventData[] = [
	{ name: 'Pentane', formula: 'C5H12', bp: 36, density: 0.626, polarity: 0.0, miscibleWater: false, rotavapPressure: 800, dryingAgent: 'Na/benzophenone, CaH₂', wasteCategory: 'non-halogenated' },
	{ name: 'Hexane', formula: 'C6H14', bp: 69, density: 0.659, polarity: 0.1, miscibleWater: false, rotavapPressure: 340, dryingAgent: 'Na/benzophenone, CaH₂', wasteCategory: 'non-halogenated' },
	{ name: 'Heptane', formula: 'C7H16', bp: 98, density: 0.684, polarity: 0.1, miscibleWater: false, rotavapPressure: 135, dryingAgent: 'Na/benzophenone', wasteCategory: 'non-halogenated' },
	{ name: 'Cyclohexane', formula: 'C6H12', bp: 81, density: 0.779, polarity: 0.2, miscibleWater: false, rotavapPressure: 240, dryingAgent: 'Na/benzophenone', wasteCategory: 'non-halogenated' },
	{ name: 'Petroleum Ether', formula: '—', bp: 40, density: 0.640, polarity: 0.1, miscibleWater: false, rotavapPressure: 600, dryingAgent: 'CaH₂', wasteCategory: 'non-halogenated' },
	{ name: 'Diethyl Ether', formula: 'C4H10O', bp: 35, density: 0.713, polarity: 2.8, miscibleWater: false, rotavapPressure: 800, dryingAgent: 'Na/benzophenone', wasteCategory: 'non-halogenated' },
	{ name: 'Dichloromethane', formula: 'CH2Cl2', bp: 40, density: 1.325, polarity: 3.1, miscibleWater: false, rotavapPressure: 760, dryingAgent: 'CaH₂', wasteCategory: 'halogenated' },
	{ name: 'Chloroform', formula: 'CHCl3', bp: 61, density: 1.489, polarity: 4.1, miscibleWater: false, rotavapPressure: 400, dryingAgent: 'K₂CO₃, MgSO₄', wasteCategory: 'halogenated' },
	{ name: 'Carbon Tetrachloride', formula: 'CCl4', bp: 77, density: 1.587, polarity: 1.6, miscibleWater: false, rotavapPressure: 260, dryingAgent: 'P₂O₅', wasteCategory: 'halogenated' },
	{ name: 'Ethyl Acetate', formula: 'C4H8O2', bp: 77, density: 0.902, polarity: 4.4, miscibleWater: false, rotavapPressure: 240, dryingAgent: 'MgSO₄, Na₂SO₄', wasteCategory: 'non-halogenated' },
	{ name: 'THF', formula: 'C4H8O', bp: 66, density: 0.889, polarity: 4.0, miscibleWater: true, rotavapPressure: 360, dryingAgent: 'Na/benzophenone', wasteCategory: 'non-halogenated' },
	{ name: 'Acetone', formula: 'C3H6O', bp: 56, density: 0.791, polarity: 5.1, miscibleWater: true, rotavapPressure: 550, dryingAgent: 'CaSO₄, 3Å sieves', wasteCategory: 'non-halogenated' },
	{ name: 'Acetonitrile', formula: 'CH3CN', bp: 82, density: 0.786, polarity: 5.8, miscibleWater: true, rotavapPressure: 230, dryingAgent: 'CaH₂, P₂O₅', wasteCategory: 'non-halogenated' },
	{ name: 'DMF', formula: 'C3H7NO', bp: 153, density: 0.944, polarity: 6.4, miscibleWater: true, rotavapPressure: 15, dryingAgent: '4Å sieves', wasteCategory: 'non-halogenated' },
	{ name: 'DMSO', formula: 'C2H6OS', bp: 189, density: 1.100, polarity: 7.2, miscibleWater: true, rotavapPressure: 3, dryingAgent: '4Å sieves, CaH₂', wasteCategory: 'non-halogenated' },
	{ name: 'Methanol', formula: 'CH4O', bp: 65, density: 0.791, polarity: 5.1, miscibleWater: true, rotavapPressure: 340, dryingAgent: 'Mg/I₂, 3Å sieves', wasteCategory: 'non-halogenated' },
	{ name: 'Ethanol', formula: 'C2H6O', bp: 78, density: 0.789, polarity: 5.2, miscibleWater: true, rotavapPressure: 175, dryingAgent: 'Mg/I₂, 3Å sieves', wasteCategory: 'non-halogenated' },
	{ name: 'Isopropanol', formula: 'C3H8O', bp: 83, density: 0.786, polarity: 3.9, miscibleWater: true, rotavapPressure: 150, dryingAgent: 'CaO, 3Å sieves', wasteCategory: 'non-halogenated' },
	{ name: 'Toluene', formula: 'C7H8', bp: 111, density: 0.867, polarity: 2.4, miscibleWater: false, rotavapPressure: 85, dryingAgent: 'Na/benzophenone', wasteCategory: 'non-halogenated' },
	{ name: 'Xylenes', formula: 'C8H10', bp: 140, density: 0.860, polarity: 2.5, miscibleWater: false, rotavapPressure: 30, dryingAgent: 'Na', wasteCategory: 'non-halogenated' },
	{ name: '1,4-Dioxane', formula: 'C4H8O2', bp: 101, density: 1.033, polarity: 4.8, miscibleWater: true, rotavapPressure: 110, dryingAgent: 'Na/benzophenone', wasteCategory: 'non-halogenated' },
	{ name: 'Water', formula: 'H2O', bp: 100, density: 1.000, polarity: 10.2, miscibleWater: true, rotavapPressure: 72, dryingAgent: '—', wasteCategory: 'aqueous' },
	{ name: 'Pyridine', formula: 'C5H5N', bp: 115, density: 0.982, polarity: 5.3, miscibleWater: true, rotavapPressure: 60, dryingAgent: 'KOH, BaO', wasteCategory: 'non-halogenated' },
	{ name: 'Triethylamine', formula: 'C6H15N', bp: 89, density: 0.726, polarity: 1.8, miscibleWater: false, rotavapPressure: 170, dryingAgent: 'CaH₂, KOH', wasteCategory: 'non-halogenated' },
	{ name: 'Acetic Acid', formula: 'C2H4O2', bp: 118, density: 1.049, polarity: 6.0, miscibleWater: true, rotavapPressure: 50, dryingAgent: '—', wasteCategory: 'non-halogenated' },
	{ name: '2-MeTHF', formula: 'C5H10O', bp: 80, density: 0.855, polarity: 3.5, miscibleWater: false, rotavapPressure: 250, dryingAgent: 'Na/benzophenone', wasteCategory: 'non-halogenated' },
	{ name: 'MTBE', formula: 'C5H12O', bp: 55, density: 0.740, polarity: 2.5, miscibleWater: false, rotavapPressure: 560, dryingAgent: 'Na, CaH₂', wasteCategory: 'non-halogenated' },
	{ name: 'DME', formula: 'C4H10O2', bp: 85, density: 0.867, polarity: 3.5, miscibleWater: true, rotavapPressure: 200, dryingAgent: 'Na/benzophenone', wasteCategory: 'non-halogenated' },
	{ name: 'NMP', formula: 'C5H9NO', bp: 202, density: 1.028, polarity: 6.7, miscibleWater: true, rotavapPressure: 2, dryingAgent: '4Å sieves', wasteCategory: 'non-halogenated' },
	{ name: '1,2-DCE', formula: 'C2H4Cl2', bp: 83, density: 1.253, polarity: 3.5, miscibleWater: false, rotavapPressure: 220, dryingAgent: 'CaH₂', wasteCategory: 'halogenated' },
];

/** Named reaction templates: pre-fill conditions for common reaction types */
export interface ReactionTemplate {
	name: string;
	conditions_above: string;
	conditions_below: string;
	description: string;
}

export const REACTION_TEMPLATES: ReactionTemplate[] = [
	{ name: 'Suzuki Coupling', conditions_above: 'Pd(PPh₃)₄, K₂CO₃', conditions_below: 'Dioxane/H₂O, 80°C, 12h, N₂', description: 'Pd-catalyzed C–C coupling of boronic acid with aryl halide' },
	{ name: 'Buchwald–Hartwig', conditions_above: 'Pd₂(dba)₃, XPhos, NaOtBu', conditions_below: 'Toluene, 100°C, 16h, N₂', description: 'Pd-catalyzed C–N coupling' },
	{ name: 'Sonogashira', conditions_above: 'PdCl₂(PPh₃)₂, CuI, Et₃N', conditions_below: 'THF, rt, 12h, N₂', description: 'Pd/Cu-catalyzed C(sp)–C(sp²) coupling' },
	{ name: 'Heck Reaction', conditions_above: 'Pd(OAc)₂, PPh₃, Et₃N', conditions_below: 'DMF, 120°C, 24h, N₂', description: 'Pd-catalyzed aryl-olefin coupling' },
	{ name: 'Negishi Coupling', conditions_above: 'Pd(PPh₃)₄', conditions_below: 'THF, −78°C → rt, N₂', description: 'Pd-catalyzed coupling with organozinc reagent' },
	{ name: 'Amide Coupling', conditions_above: 'HATU, DIPEA', conditions_below: 'DMF, rt, 2h', description: 'Peptide/amide bond formation' },
	{ name: 'Swern Oxidation', conditions_above: '(COCl)₂, DMSO, Et₃N', conditions_below: 'DCM, −78°C → rt', description: 'Alcohol → aldehyde/ketone oxidation' },
	{ name: 'Dess–Martin', conditions_above: 'DMP', conditions_below: 'DCM, rt, 1h', description: 'Periodinane oxidation of alcohols' },
	{ name: 'Grignard Addition', conditions_above: 'RMgBr', conditions_below: 'THF, 0°C → rt, N₂', description: 'Organomagnesium addition to carbonyl' },
	{ name: 'Wittig Reaction', conditions_above: 'Ph₃P=CHR, n-BuLi', conditions_below: 'THF, −78°C → rt', description: 'Carbonyl olefination' },
	{ name: 'Mitsunobu', conditions_above: 'DIAD, PPh₃', conditions_below: 'THF, 0°C → rt, 4h', description: 'Alcohol inversion/substitution' },
	{ name: 'Hydrogenation', conditions_above: 'H₂ (1 atm), Pd/C (10%)', conditions_below: 'MeOH, rt, 12h', description: 'Catalytic hydrogenation' },
	{ name: 'Boc Protection', conditions_above: 'Boc₂O, Et₃N', conditions_below: 'DCM, rt, 4h', description: 'N-Boc protection of amine' },
	{ name: 'Boc Deprotection', conditions_above: 'TFA', conditions_below: 'DCM, rt, 1h', description: 'N-Boc removal' },
	{ name: 'TBS Protection', conditions_above: 'TBSCl, imidazole', conditions_below: 'DMF, rt, 12h', description: 'O-TBS protection of alcohol' },
	{ name: 'Olefin Metathesis', conditions_above: 'Grubbs II (5 mol%)', conditions_below: 'DCM, 40°C, 4h, N₂', description: 'Ring-closing or cross metathesis' },
	{ name: 'Stille Coupling', conditions_above: 'Pd(PPh₃)₄, CuI', conditions_below: 'DMF, 80°C, 12h, N₂', description: 'Pd-catalyzed coupling with organotin' },
	{ name: 'Aldol Reaction', conditions_above: 'LDA', conditions_below: 'THF, −78°C, 1h', description: 'Enolate addition to aldehyde' },
];

/**
 * Parse a molecular formula into element counts.
 * Handles parentheses, e.g. Ca(OH)2 → {Ca:1, O:2, H:2}
 * Handles hydrates, e.g. CuSO4·5H2O
 */
export function parseFormula(formula: string): Record<string, number> {
	// Handle hydrate notation: split on · or . and parse each part
	const parts = formula.split(/[·•.]/);
	const total: Record<string, number> = {};

	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		// Check for leading coefficient like "5H2O"
		let coeffStr = '';
		let start = 0;
		while (start < trimmed.length && /\d/.test(trimmed[start])) {
			coeffStr += trimmed[start];
			start++;
		}
		// Only treat as coefficient if followed by an uppercase letter
		const coeff = (coeffStr && start < trimmed.length && /[A-Z]/.test(trimmed[start]))
			? parseInt(coeffStr) : 1;
		const subFormula = coeff > 1 ? trimmed.slice(start) : trimmed;

		const counts = parseFormulaUnit(subFormula);
		for (const [el, cnt] of Object.entries(counts)) {
			total[el] = (total[el] || 0) + cnt * coeff;
		}
	}

	return total;
}

function parseFormulaUnit(formula: string): Record<string, number> {
	let i = 0;

	function parse(): Record<string, number> {
		const counts: Record<string, number> = {};
		while (i < formula.length) {
			if (formula[i] === '(' || formula[i] === '[') {
				i++;
				const inner = parse();
				let num = '';
				while (i < formula.length && /\d/.test(formula[i])) {
					num += formula[i++];
				}
				const mult = num ? parseInt(num) : 1;
				for (const [el, cnt] of Object.entries(inner)) {
					counts[el] = (counts[el] || 0) + cnt * mult;
				}
			} else if (formula[i] === ')' || formula[i] === ']') {
				i++;
				return counts;
			} else if (/[A-Z]/.test(formula[i])) {
				let el = formula[i++];
				while (i < formula.length && /[a-z]/.test(formula[i])) {
					el += formula[i++];
				}
				let num = '';
				while (i < formula.length && /\d/.test(formula[i])) {
					num += formula[i++];
				}
				counts[el] = (counts[el] || 0) + (num ? parseInt(num) : 1);
			} else {
				// Skip unknown chars (spaces, charges like +/-, etc.)
				i++;
			}
		}
		return counts;
	}

	return parse();
}

/**
 * Calculate molar mass from a molecular formula string.
 * Returns g/mol rounded to 2 decimal places, or 0 if unparseable.
 */
export function calcMW(formula: string): number {
	if (!formula || !formula.trim()) return 0;
	try {
		const elements = parseFormula(formula.trim());
		let mw = 0;
		for (const [el, count] of Object.entries(elements)) {
			const mass = ATOMIC_MASSES[el];
			if (!mass) return 0; // unknown element → bail
			mw += mass * count;
		}
		return Math.round(mw * 100) / 100;
	} catch {
		return 0;
	}
}

/**
 * Format a molecular formula with proper subscripts (HTML).
 * e.g. "C6H12O6" → "C₆H₁₂O₆"
 */
export function formatFormula(formula: string): string {
	const subscripts: Record<string, string> = {
		'0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
		'5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
	};
	return formula.replace(/(\d+)/g, (match) =>
		match.split('').map(d => subscripts[d] || d).join('')
	);
}

/**
 * Column chromatography calculator.
 * Rule of thumb: 30-100× silica by mass, column diameter from crude mass.
 */
export function calcColumn(crudeMass: number, ratio: number = 50): {
	silicaMass: number;
	diameter: number;
	deadVolume: number;
	fractionSize: number;
	totalSolvent: number;
	columnHeight: number;
} {
	const silicaMass = crudeMass * ratio;
	// Silica bulk density ~ 0.5 g/mL
	const silicaVolume = silicaMass / 0.5;
	// Pick standard diameter (ID in cm) based on silica volume
	const diameters = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 10.0];
	// Target column height 15-20 cm
	let bestDiam = 2.0;
	for (const d of diameters) {
		const area = Math.PI * (d / 2) ** 2;
		const height = silicaVolume / area;
		if (height >= 10 && height <= 25) { bestDiam = d; break; }
		if (height < 10) { bestDiam = d; break; }
	}
	const area = Math.PI * (bestDiam / 2) ** 2;
	const columnHeight = silicaVolume / area;
	// Dead volume ≈ column volume × 0.7 (void fraction)
	const deadVolume = silicaVolume * 0.7;
	// Fraction size ≈ 1/3 to 1/2 dead volume
	const fractionSize = Math.round(deadVolume * 0.4);
	// Total solvent ≈ 5-8 column volumes
	const totalSolvent = silicaVolume * 6;
	return {
		silicaMass: Math.round(silicaMass * 10) / 10,
		diameter: bestDiam,
		deadVolume: Math.round(deadVolume),
		fractionSize: Math.max(1, fractionSize),
		totalSolvent: Math.round(totalSolvent),
		columnHeight: Math.round(columnHeight * 10) / 10
	};
}

/**
 * Format a publication-ready characterization string from compound data.
 */
export function formatCharacterization(compound: {
	name: string;
	formula: string;
	molar_mass: number;
	nmr_data: string;
	mass_spec: number;
	mass_spec_type: string;
	mass_spec_notes: string;
	ir_data: number;
	ir_notes: string;
	melting_point?: string;
	optical_rotation?: string;
}): string {
	const parts: string[] = [];
	parts.push(`**${compound.name}**`);

	// Formula / MW
	if (compound.formula) {
		const fmtF = formatFormula(compound.formula);
		parts.push(compound.molar_mass
			? `${fmtF} (MW ${compound.molar_mass.toFixed(2)})`
			: fmtF);
	}

	// Melting point
	if (compound.melting_point) {
		parts.push(`mp ${compound.melting_point} °C`);
	}

	// Optical rotation
	if (compound.optical_rotation) {
		parts.push(`[α]D ${compound.optical_rotation}`);
	}

	// NMR data
	try {
		const nmr = typeof compound.nmr_data === 'string'
			? JSON.parse(compound.nmr_data || '{}')
			: (compound.nmr_data || {});
		const nucleiOrder = ['1H', '13C', '19F', '31P', '11B', '15N', '29Si', '7Li'];
		const nucleiLabels: Record<string, string> = {
			'1H': '¹H NMR', '13C': '¹³C NMR', '19F': '¹⁹F NMR', '31P': '³¹P NMR',
			'11B': '¹¹B NMR', '15N': '¹⁵N NMR', '29Si': '²⁹Si NMR', '7Li': '⁷Li NMR'
		};
		// Also check any nuclei keys present in the data that aren't in our order list
		const allKeys = new Set([...nucleiOrder, ...Object.keys(nmr)]);
		for (const nid of allKeys) {
			const entry = nmr[nid];
			if (!entry || !entry.have) continue;
			const label = nucleiLabels[nid] || nid;
			if (entry.peaks) {
				const solvent = entry.solvent || 'CDCl₃';
				const freq = entry.frequency || '400';
				parts.push(`${label} (${freq} MHz, ${solvent}) δ ${entry.peaks}`);
			} else if (entry.notes) {
				parts.push(`${label}: ${entry.notes}`);
			} else {
				parts.push(`${label}: acquired`);
			}
		}
	} catch { /* ignore */ }

	// IR
	if (compound.ir_data) {
		parts.push(compound.ir_notes
			? `IR (neat) ν̃ ${compound.ir_notes} cm⁻¹`
			: 'IR: acquired');
	}

	// Mass spec
	if (compound.mass_spec) {
		const exactMass = calcExactMass(compound.formula);
		if (compound.mass_spec_type === 'HRMS' && exactMass > 0) {
			const mH = Math.round((exactMass + 1.0072764522) * 10000) / 10000;
			parts.push(`HRMS (ESI) m/z: [M+H]⁺ calcd for ${formatFormula(compound.formula)} ${mH}, found ${compound.mass_spec_notes || '—'}`);
		} else if (compound.mass_spec_type) {
			parts.push(`MS (${compound.mass_spec_type}): ${compound.mass_spec_notes || '—'}`);
		} else {
			parts.push(`MS: ${compound.mass_spec_notes || 'acquired'}`);
		}
	}

	return parts.join('; ');
}

/** TLC stain options */
export const TLC_STAINS = [
	'UV 254nm', 'UV 365nm', 'KMnO₄', 'Vanillin', 'Ninhydrin',
	'PMA', 'Anisaldehyde', 'CAM', 'I₂', 'DNP', 'Dragendorff', 'FeCl₃'
] as const;
