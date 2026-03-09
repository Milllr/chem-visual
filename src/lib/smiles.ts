/** Common formula/name → SMILES lookup to avoid API calls */
export const COMMON_MOLECULES: Record<string, string> = {
	// Simple alkanes
	CH4: 'C',
	C2H6: 'CC',
	C2H4: 'C=C',
	C2H2: 'C#C',
	C3H8: 'CCC',
	C3H6: 'CC=C',
	C4H10: 'CCCC',
	C5H12: 'CCCCC',
	C6H14: 'CCCCCC',
	C6H6: 'c1ccccc1',
	C7H8: 'Cc1ccccc1',
	C8H18: 'CCCCCCCC',
	C8H10: 'CCc1ccccc1',

	// Common compounds
	H2O: 'O',
	CO2: 'O=C=O',
	NH3: 'N',
	HCl: 'Cl',
	H2SO4: 'OS(=O)(=O)O',
	HNO3: 'O[N+](=O)[O-]',
	NaOH: '[Na+].[OH-]',
	CH3OH: 'CO',
	C2H5OH: 'CCO',
	CH3COOH: 'CC(=O)O',
	CH2O: 'C=O',
	NaCl: '[Na+].[Cl-]',

	// Common names
	methane: 'C',
	ethane: 'CC',
	ethylene: 'C=C',
	ethene: 'C=C',
	acetylene: 'C#C',
	ethyne: 'C#C',
	propane: 'CCC',
	propene: 'CC=C',
	butane: 'CCCC',
	pentane: 'CCCCC',
	hexane: 'CCCCCC',
	benzene: 'c1ccccc1',
	toluene: 'Cc1ccccc1',
	water: 'O',
	methanol: 'CO',
	ethanol: 'CCO',
	acetone: 'CC(=O)C',
	'acetic acid': 'CC(=O)O',
	aspirin: 'CC(=O)Oc1ccccc1C(=O)O',
	caffeine: 'Cn1c(=O)c2c(ncn2C)n(C)c1=O',
	glucose: 'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O',
	phenol: 'Oc1ccccc1',
	aniline: 'Nc1ccccc1',
	'formic acid': 'O=CO',
	formaldehyde: 'C=O',
	glycerol: 'OCC(O)CO',
	urea: 'NC(=O)N',
	'sulfuric acid': 'OS(=O)(=O)O',
	'nitric acid': 'O[N+](=O)[O-]',
	'hydrochloric acid': 'Cl',
	ammonia: 'N',
	'carbon dioxide': 'O=C=O',
	'carbon monoxide': '[C-]#[O+]',
	cyclohexane: 'C1CCCCC1',
	naphthalene: 'c1ccc2ccccc2c1',
	styrene: 'C=Cc1ccccc1',
	'acrylic acid': 'C=CC(=O)O',
	dmso: 'CS(=O)C',
	thf: 'C1CCOC1',
	dmf: 'CN(C)C=O',
	pyridine: 'c1ccncc1',
	'diethyl ether': 'CCOCC',
	chloroform: 'ClC(Cl)Cl',
	acetonitrile: 'CC#N'
};

/** Try to resolve input to SMILES without an API call */
export function lookupSmiles(input: string): string | null {
	const trimmed = input.trim();
	if (COMMON_MOLECULES[trimmed]) return COMMON_MOLECULES[trimmed];

	const lower = trimmed.toLowerCase();
	if (COMMON_MOLECULES[lower]) return COMMON_MOLECULES[lower];

	// If it looks like a SMILES string already (has special chars), return as-is
	if (/[=#\[\]@\\\/\(\)\.+\-]/.test(trimmed) && trimmed.length > 1) {
		return trimmed;
	}

	return null;
}
