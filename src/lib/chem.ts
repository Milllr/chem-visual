/**
 * Chemistry utilities — molecular formula parsing, MW calculation
 */

/** Standard atomic masses (IUPAC 2021 recommended values) */
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
