<script lang="ts">
	import type { Reagent, Reaction, ReactionStep, ChemSpecies, Compound } from '$lib/db';
	import { generateId } from '$lib/db';
	import { calcMW, formatFormula } from '$lib/chem';
	import MoleculeRenderer from './MoleculeRenderer.svelte';
	import StoichCalculator from './StoichCalculator.svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		reaction: Reaction;
		reagents: Reagent[];
		compounds: Compound[];
		onupdate: (reaction: Reaction) => void;
		ondelete: () => void;
		onclose: () => void;
		oninsertblock?: (type: string, content: string, metadata: Record<string, any>) => void;
	}

	let { reaction, reagents, compounds, onupdate, ondelete, onclose, oninsertblock }: Props = $props();

	/* ── Parse steps with backward compatibility ───────────────────── */

	function parseSteps(raw: string | undefined | null): ReactionStep[] {
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed.map((s: any) => {
				if (Array.isArray(s.reactants)) {
					// Ensure amount/unit fields exist on each species
					const patchSpecies = (sp: any): ChemSpecies => ({
						...sp,
						amount: sp.amount ?? sp.stoich ?? 1,
						unit: sp.unit ?? 'mol'
					});
					return {
						id: s.id || generateId(),
						reactants: (s.reactants || []).map(patchSpecies),
						products: (s.products || []).map(patchSpecies),
						conditions_above: s.conditions_above || '',
						conditions_below: s.conditions_below || '',
						notes: s.notes || ''
					};
				}
				return migrateOldStep(s);
			});
		} catch { return []; }
	}

	function migrateOldStep(s: any): ReactionStep {
		const reactants: ChemSpecies[] = [];
		const condParts: string[] = [];
		const ids: string[] = Array.isArray(s.reagent_ids) ? s.reagent_ids : [];
		const coeffs: number[] = Array.isArray(s.stoich_coefficients) ? s.stoich_coefficients : [];
		const roles: string[] = Array.isArray(s.roles) ? s.roles : [];

		for (let i = 0; i < ids.length; i++) {
			const r = reagents.find(rg => rg.id === ids[i]);
			const role = roles[i] || 'reactant';
			if (role === 'catalyst' || role === 'solvent') {
				condParts.push(r?.name || ids[i]);
				continue;
			}
			if (r) {
				reactants.push({
					source: 'reagent', ref_id: r.id,
					name: r.name, formula: r.formula, mw: r.molar_mass,
					smiles: r.smiles, density: r.density || undefined,
					stoich: coeffs[i] || 1, amount: coeffs[i] || 1, unit: 'mol'
				});
			}
		}

		const products: ChemSpecies[] = [];
		if (s.product_reagent_id) {
			const p = reagents.find(rg => rg.id === s.product_reagent_id);
			if (p) products.push({
				source: 'reagent', ref_id: p.id,
				name: p.name, formula: p.formula, mw: p.molar_mass,
				smiles: p.smiles, density: p.density || undefined,
				stoich: s.product_stoich || 1, amount: s.product_stoich || 1, unit: 'mol'
			});
		} else if (s.product_name) {
			products.push({
				source: 'custom',
				name: s.product_name, formula: s.product_formula || '',
				mw: s.product_mw || calcMW(s.product_formula || ''),
				smiles: s.product_smiles || '', stoich: s.product_stoich || 1,
				amount: s.product_stoich || 1, unit: 'mol'
			});
		}

		return {
			id: s.id || generateId(), reactants, products,
			conditions_above: condParts.join(', '),
			conditions_below: s.conditions || '',
			notes: s.notes || ''
		};
	}

	/* ── Reactive state ────────────────────────────────────────────── */

	let steps = $state<ReactionStep[]>(parseSteps(reaction.steps));
	let reactionName = $state(reaction.name || '');
	let showAddStep = $state(false);
	let calcStep = $state<ReactionStep | null>(null);

	let actualYield = $state(reaction.actual_yield || 0);
	let theoreticalYield = $state(reaction.theoretical_yield || 0);
	let yieldPercent = $derived(
		theoreticalYield > 0 ? Math.round((actualYield / theoreticalYield) * 1000) / 10 : 0
	);

	$effect(() => {
		steps = parseSteps(reaction.steps);
		reactionName = reaction.name || '';
		actualYield = reaction.actual_yield || 0;
		theoreticalYield = reaction.theoretical_yield || 0;
	});

	/* ── New step form state ───────────────────────────────────────── */

	let newReactants = $state<ChemSpecies[]>([]);
	let newProducts = $state<ChemSpecies[]>([]);
	let newCondAbove = $state('');
	let newCondBelow = $state('');
	let newNotes = $state('');

	let pickerTarget = $state<'reactant' | 'product' | null>(null);
	let pickerSource = $state<'reagent' | 'compound' | 'custom'>('reagent');
	let customName = $state('');
	let customFormula = $state('');

	function resetForm() {
		newReactants = []; newProducts = [];
		newCondAbove = ''; newCondBelow = ''; newNotes = '';
		pickerTarget = null; customName = ''; customFormula = '';
	}

	/* ── Unit conversion ───────────────────────────────────────────── */

	function convertAmount(sp: ChemSpecies, newUnit: 'mol' | 'g' | 'mL'): number {
		const { amount, unit, mw, density } = sp;
		if (amount === 0 || unit === newUnit) return amount;
		// Convert to grams first
		let grams: number;
		switch (unit) {
			case 'g': grams = amount; break;
			case 'mol': grams = amount * (mw || 0); break;
			case 'mL': grams = density ? amount * density : amount; break;
		}
		// Convert from grams to target
		switch (newUnit) {
			case 'g': return grams;
			case 'mol': return mw > 0 ? grams / mw : 0;
			case 'mL': return density ? grams / density : 0;
		}
	}

	function fmtAmount(n: number): string {
		if (n === 0) return '0';
		if (Math.abs(n) >= 1000) return n.toFixed(1);
		if (Math.abs(n) >= 100) return n.toFixed(2);
		if (Math.abs(n) >= 1) return n.toFixed(3);
		if (Math.abs(n) >= 0.001) return n.toFixed(4);
		return n.toExponential(2);
	}

	/* ── Species manipulation ──────────────────────────────────────── */

	function addSpecies(species: ChemSpecies) {
		if (pickerTarget === 'reactant') newReactants = [...newReactants, species];
		else if (pickerTarget === 'product') newProducts = [...newProducts, species];
		pickerTarget = null;
		customName = ''; customFormula = '';
	}

	function addReagentAsSpecies(r: Reagent) {
		addSpecies({
			source: 'reagent', ref_id: r.id,
			name: r.name, formula: r.formula, mw: r.molar_mass,
			smiles: r.smiles, density: r.density || undefined,
			stoich: 1, amount: 1, unit: 'mol'
		});
	}

	function addCompoundAsSpecies(c: Compound) {
		addSpecies({
			source: 'compound', ref_id: c.id,
			name: c.name, formula: c.formula, mw: c.molar_mass,
			smiles: c.smiles, stoich: 1, amount: 1, unit: 'mol'
		});
	}

	function addCustomSpecies() {
		if (!customName.trim()) return;
		const mw = calcMW(customFormula.trim());
		addSpecies({
			source: 'custom',
			name: customName.trim(), formula: customFormula.trim(),
			mw, smiles: '', stoich: 1, amount: 1, unit: 'mol'
		});
	}

	function removeNewSpecies(target: 'reactant' | 'product', idx: number) {
		if (target === 'reactant') newReactants = newReactants.filter((_, i) => i !== idx);
		else newProducts = newProducts.filter((_, i) => i !== idx);
	}

	function updateNewAmount(target: 'reactant' | 'product', idx: number, val: number) {
		if (target === 'reactant') newReactants = newReactants.map((s, i) => i === idx ? { ...s, amount: val } : s);
		else newProducts = newProducts.map((s, i) => i === idx ? { ...s, amount: val } : s);
	}

	function cycleNewUnit(target: 'reactant' | 'product', idx: number) {
		const list = target === 'reactant' ? newReactants : newProducts;
		const sp = list[idx];
		const units: ('mol' | 'g' | 'mL')[] = sp.density ? ['mol', 'g', 'mL'] : ['mol', 'g'];
		const curIdx = units.indexOf(sp.unit);
		const newUnit = units[(curIdx + 1) % units.length];
		const newAmt = parseFloat(convertAmount(sp, newUnit).toPrecision(4));
		const updated = list.map((s, i) => i === idx ? { ...s, unit: newUnit, amount: newAmt } : s);
		if (target === 'reactant') newReactants = updated;
		else newProducts = updated;
	}

	/* ── Existing step species editing ─────────────────────────────── */

	function updateStepSpeciesAmount(stepIdx: number, side: 'reactants' | 'products', speciesIdx: number, amount: number) {
		steps = steps.map((s, i) => {
			if (i !== stepIdx) return s;
			const list = [...s[side]];
			list[speciesIdx] = { ...list[speciesIdx], amount };
			return { ...s, [side]: list };
		});
		persistSteps();
	}

	function cycleStepUnit(stepIdx: number, side: 'reactants' | 'products', speciesIdx: number) {
		steps = steps.map((s, i) => {
			if (i !== stepIdx) return s;
			const list = [...s[side]];
			const sp = list[speciesIdx];
			const units: ('mol' | 'g' | 'mL')[] = sp.density ? ['mol', 'g', 'mL'] : ['mol', 'g'];
			const curIdx = units.indexOf(sp.unit);
			const newUnit = units[(curIdx + 1) % units.length];
			const newAmt = parseFloat(convertAmount(sp, newUnit).toPrecision(4));
			list[speciesIdx] = { ...sp, unit: newUnit, amount: newAmt };
			return { ...s, [side]: list };
		});
		persistSteps();
	}

	/* ── Step CRUD ─────────────────────────────────────────────────── */

	function saveStep() {
		if (newReactants.length === 0) return;
		steps = [...steps, {
			id: generateId(),
			reactants: [...newReactants],
			products: [...newProducts],
			conditions_above: newCondAbove,
			conditions_below: newCondBelow,
			notes: newNotes
		}];
		showAddStep = false;
		resetForm();
		persistSteps();
	}

	function deleteStep(idx: number) {
		steps = steps.filter((_, i) => i !== idx);
		persistSteps();
	}

	function updateStepField(idx: number, field: 'conditions_above' | 'conditions_below' | 'notes', value: string) {
		steps = steps.map((s, i) => i === idx ? { ...s, [field]: value } : s);
		persistSteps();
	}

	/* ── Persistence ───────────────────────────────────────────────── */

	function persistSteps() {
		onupdate({ ...reaction, name: reactionName, steps: JSON.stringify(steps) });
	}

	function persistYield() {
		onupdate({
			...reaction, name: reactionName, steps: JSON.stringify(steps),
			actual_yield: actualYield, theoretical_yield: theoreticalYield, yield_percent: yieldPercent
		});
	}

	function handleNameBlur() {
		if (reactionName !== reaction.name) persistSteps();
	}

	/* ── Helpers ────────────────────────────────────────────────────── */

	/** Detect if a string looks like SMILES rather than a molecular formula */
	function looksLikeSmiles(s: string): boolean {
		if (!s || s.length < 2) return false;
		// Obvious non-SMILES: contains spaces (likely an error message or name)
		if (s.includes(' ')) return false;
		// SMILES-specific characters that never appear in molecular formulas
		if (/[=#@\\\/(\)\[\]]/.test(s)) return true;
		// Strip known element symbols (2-letter lowercase patterns in formulas)
		// If after stripping all valid formula tokens there are remaining lowercase letters, it's SMILES
		const stripped = s.replace(/[A-Z][a-z]?|\d+|[\+\-\.·]/g, '');
		return stripped.length > 0 && /[a-z]/.test(stripped);
	}

	function resolveSpecies(s: ChemSpecies): ChemSpecies {
		let result = { ...s };

		// 1. Try primary lookup by source + ref_id
		if (s.source === 'reagent' && s.ref_id) {
			const r = reagents.find(rg => rg.id === s.ref_id);
			if (r) {
				result = { ...result, name: r.name, formula: r.formula, mw: r.molar_mass, density: r.density || undefined };
				if (r.smiles) result.smiles = r.smiles;
			}
		} else if (s.source === 'compound' && s.ref_id) {
			const c = compounds.find(cp => cp.id === s.ref_id);
			if (c) {
				result = { ...result, name: c.name, mw: c.molar_mass };
				if (c.smiles) result.smiles = c.smiles;
				// Compound might have SMILES in formula field — use real formula if available, else leave blank
				if (c.formula && !looksLikeSmiles(c.formula)) {
					result.formula = c.formula;
				} else {
					result.formula = '';
					// If the "formula" is actually SMILES, use it as smiles
					if (c.formula && looksLikeSmiles(c.formula) && !result.smiles) {
						result.smiles = c.formula;
					}
				}
			}
		}

		// 2. If we still don't have SMILES, try name-based match against reagents then compounds
		if (!result.smiles && result.name) {
			const nameLC = result.name.toLowerCase();
			const byReagent = reagents.find(rg => rg.name.toLowerCase() === nameLC);
			if (byReagent?.smiles) {
				result.smiles = byReagent.smiles;
				if (!result.formula && byReagent.formula) result.formula = byReagent.formula;
				if (!result.mw && byReagent.molar_mass) result.mw = byReagent.molar_mass;
			} else {
				const byCompound = compounds.find(cp => cp.name.toLowerCase() === nameLC);
				if (byCompound) {
					if (byCompound.smiles) result.smiles = byCompound.smiles;
					if (!result.formula && byCompound.formula && !looksLikeSmiles(byCompound.formula)) result.formula = byCompound.formula;
					if (!result.mw && byCompound.molar_mass) result.mw = byCompound.molar_mass;
				}
			}
		}

		// 3. If formula looks like SMILES, move it to smiles and clear formula
		if (result.formula && looksLikeSmiles(result.formula)) {
			if (!result.smiles) result.smiles = result.formula;
			result.formula = '';
		}

		return result;
	}

	function yieldColor(pct: number): string {
		if (pct >= 80) return 'text-green-700 bg-green-700/8';
		if (pct >= 50) return 'text-amber-600 bg-amber-600/8';
		if (pct > 0) return 'text-red-ink bg-red-ink/8';
		return 'text-muted/40';
	}

	function srcBadge(source: string): { label: string; cls: string } {
		if (source === 'reagent') return { label: 'reagent', cls: 'text-blue-ink/70 bg-blue-ink/8' };
		if (source === 'compound') return { label: 'compound', cls: 'text-green-700/70 bg-green-700/8' };
		return { label: 'custom', cls: 'text-muted/60 bg-warm' };
	}

	const unitLabel: Record<string, string> = { mol: 'mol', g: 'g', mL: 'mL' };
</script>

<!-- ── Species picker snippet ─────────────────────────────────────── -->
{#snippet speciesPicker()}
	<div class="rounded-lg border border-border bg-cream overflow-hidden" transition:fly={{ y: -5, duration: 150 }}>
		<div class="flex gap-0.5 p-2 bg-warm/30">
			{#each [
				{ id: 'reagent', label: 'Reagents', n: reagents.length },
				{ id: 'compound', label: 'Compounds', n: compounds.length },
				{ id: 'custom', label: 'Custom', n: null }
			] as t}
				<button
					class="flex-1 text-xs py-1.5 rounded font-medium transition-all
						{pickerSource === t.id ? 'bg-ink text-cream' : 'text-muted hover:bg-warm'}"
					onclick={() => (pickerSource = t.id as typeof pickerSource)}
				>{t.label}{t.n != null ? ` (${t.n})` : ''}</button>
			{/each}
		</div>

		<div class="p-2.5 max-h-52 overflow-y-auto">
			{#if pickerSource === 'reagent'}
				{#if reagents.length === 0}
					<p class="text-sm text-muted/40 text-center py-4">No reagents in library</p>
				{:else}
					<div class="space-y-1">
						{#each reagents as r}
							<button
								class="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-warm/50 transition-colors"
								onclick={() => addReagentAsSpecies(r)}
							>
								{#if r.smiles}
									<div class="w-10 h-10 rounded bg-white border border-border/50 shrink-0 overflow-hidden">
										<MoleculeRenderer smiles={r.smiles} width={40} height={40} />
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<p class="text-sm text-ink truncate">{r.name}</p>
									<p class="text-xs text-muted font-mono">{r.formula} · MW {r.molar_mass}</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{:else if pickerSource === 'compound'}
				{#if compounds.length === 0}
					<p class="text-sm text-muted/40 text-center py-4">No compounds registered</p>
				{:else}
					<div class="space-y-1">
						{#each compounds as c}
							<button
								class="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-warm/50 transition-colors"
								onclick={() => addCompoundAsSpecies(c)}
							>
								{#if c.smiles}
									<div class="w-10 h-10 rounded bg-white border border-border/50 shrink-0 overflow-hidden">
										<MoleculeRenderer smiles={c.smiles} width={40} height={40} />
									</div>							{:else}
								<div class="w-10 h-10 rounded bg-warm/40 border border-border/50 shrink-0 flex items-center justify-center">
									<span class="text-[9px] font-mono text-muted/60 leading-tight text-center px-0.5">{@html formatFormula(c.formula || '?')}</span>
								</div>								{/if}
								<div class="flex-1 min-w-0">
									<p class="text-sm text-ink truncate">{c.name}</p>
									<p class="text-xs text-muted font-mono">{c.formula} · MW {c.molar_mass}</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="space-y-2.5 py-1">
					<input type="text" bind:value={customName} placeholder="Compound name"
						class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm outline-none" />
					<input type="text" bind:value={customFormula} placeholder="Formula (e.g. C6H12O6)"
						class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none" />
					{#if customFormula && calcMW(customFormula) > 0}
						<p class="text-xs text-muted">MW: {calcMW(customFormula)} g/mol</p>
					{/if}
					<button
						class="w-full text-sm py-2 rounded-lg bg-ink text-cream disabled:opacity-40"
						onclick={addCustomSpecies} disabled={!customName.trim()}
					>Add</button>
				</div>
			{/if}
		</div>

		<div class="border-t border-border/50 p-2">
			<button class="w-full text-xs text-muted py-1.5 hover:text-ink" onclick={() => (pickerTarget = null)}>Cancel</button>
		</div>
	</div>
{/snippet}

<!-- ── Species card snippet for equation display ──────────────────── -->
{#snippet speciesCard(sp: ChemSpecies, stepIdx: number, side: 'reactants' | 'products', spIdx: number)}
	{@const resolved = resolveSpecies(sp)}
	<div class="flex flex-col items-center w-[100px] shrink-0 overflow-hidden">
		{#if resolved.smiles}
			<div class="w-16 h-16 rounded-lg bg-white border overflow-hidden mb-1
				{side === 'products' ? 'border-accent/30 ring-1 ring-accent/10' : 'border-border/50'}">
				<MoleculeRenderer smiles={resolved.smiles} width={64} height={64} />
			</div>
		{:else}
			<div class="w-16 h-16 rounded-lg border flex items-center justify-center mb-1
				{side === 'products' ? 'bg-accent/5 border-accent/20' : 'bg-warm/30 border-border/50'}">
				{#if resolved.formula}
					<span class="text-xs font-mono text-muted/50 px-1 text-center leading-tight">{formatFormula(resolved.formula)}</span>
				{:else}
					<span class="text-lg text-muted/20">?</span>
				{/if}
			</div>
		{/if}
		<p class="text-sm font-medium text-ink text-center leading-tight truncate w-full">{resolved.name}</p>
		{#if resolved.formula}
			<p class="text-xs text-muted font-mono truncate w-full text-center">{formatFormula(resolved.formula)}</p>
		{/if}
		<!-- Amount + unit -->
		<div class="flex items-center gap-0.5 mt-1">
			<input
				type="number"
				step="any"
				value={sp.amount}
				class="w-20 text-center text-sm font-mono bg-warm/40 border border-border rounded-l-md px-1 py-0.5 outline-none focus:border-muted"
				onchange={(e) => updateStepSpeciesAmount(stepIdx, side, spIdx, parseFloat(e.currentTarget.value) || 0)}
			/>
			<button
				class="text-xs font-semibold px-1.5 py-0.5 rounded-r-md bg-warm border border-l-0 border-border text-accent hover:bg-accent/10 transition-colors"
				onclick={() => cycleStepUnit(stepIdx, side, spIdx)}
				title="Tap to change unit"
			>{unitLabel[sp.unit]}</button>
		</div>
	</div>
{/snippet}

<!-- ══════════════════════════════════════════════════════════════════ -->

<div
	class="fixed inset-0 z-50 flex flex-col bg-cream"
	transition:fly={{ y: 40, duration: 250 }}
>
	<!-- Header -->
	<header class="shrink-0 bg-cream/95 backdrop-blur-sm border-b border-border safe-top z-20">
		<div class="flex items-center gap-2 px-4 py-3">
			<button
				class="w-9 h-9 flex items-center justify-center rounded-md hover:bg-warm active:bg-warm transition-colors text-muted"
				onclick={onclose}
			>
				<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5L5 15M5 5L15 15" /></svg>
			</button>
			<input
				type="text"
				bind:value={reactionName}
				onblur={handleNameBlur}
				class="flex-1 bg-transparent text-base font-heading text-ink outline-none placeholder:text-muted/40 min-w-0"
				placeholder="Reaction name…"
			/>
			<button
				class="px-3 py-1.5 rounded-lg text-sm text-red-ink hover:bg-red-ink/10 transition-colors"
				onclick={ondelete}
			>Delete</button>
		</div>
	</header>

	<!-- ── Main content ─────────────────────────────────────────────── -->
	<main class="flex-1 overflow-auto">
		{#if steps.length === 0}
			<div class="text-center py-16 px-6">
				<svg class="w-14 h-14 mx-auto text-muted/15 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 12h3l3-9 4 18 3-9h3" />
				</svg>
				<p class="font-heading text-base text-muted/60 mb-1">No reaction steps</p>
				<p class="text-sm text-muted/40 mb-4">Build your synthesis scheme step by step</p>
			</div>
		{:else}
			<!-- ── Reaction scheme ──────────────────────────────────────── -->
			<div class="py-4 px-3 space-y-3">
				{#each steps as step, i}
					{@const rResolved = step.reactants.map(resolveSpecies)}
					{@const pResolved = step.products.map(resolveSpecies)}

					<div class="rounded-xl border border-border bg-card/50 overflow-hidden" transition:fly={{ y: 15, duration: 200 }}>
						<!-- Step header -->
						<div class="px-4 py-2 bg-warm/30 border-b border-border flex items-center justify-between">
							<span class="text-xs font-semibold text-muted uppercase tracking-wide">Step {i + 1}</span>
							<div class="flex items-center gap-1">
								<button
									class="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition-colors"
									onclick={() => (calcStep = { ...step, reactants: rResolved, products: pResolved })}
									title="Stoich Calculator"
								>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M5 5H11M5 8H11M5 11H8" /></svg>
								</button>
								{#if oninsertblock}
									<button
										class="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-blue-ink hover:bg-blue-ink/10 transition-colors"
										onclick={() => {
											const resolved = { ...step, reactants: rResolved, products: pResolved };
											const label = rResolved.map(s => s.name || s.formula).join(' + ') + ' \u2192 ' + pResolved.map(s => s.name || s.formula).join(' + ');
											oninsertblock('reaction_step', JSON.stringify(resolved), {
												reaction_name: reaction.name,
												step_label: label,
												step_index: i
											});
											onclose();
										}}
										title="Add step to page"
									>
										<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10" /></svg>
									</button>
								{/if}
								<button
									class="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-red-ink hover:bg-red-ink/10 transition-colors"
									onclick={() => deleteStep(i)}
								>
									<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4L12 12M12 4L4 12" /></svg>
								</button>
							</div>
						</div>

						<!-- ── Horizontal equation ────────────────────────── -->
						<div class="overflow-x-auto">
							<div class="flex items-center gap-4 px-4 py-4 min-w-max">
								<!-- Reactants -->
								{#each step.reactants as sp, j}
									{@render speciesCard(sp, i, 'reactants', j)}
									{#if j < step.reactants.length - 1}
										<span class="text-xl text-border font-light select-none px-1">+</span>
									{/if}
								{/each}

								<!-- Arrow with conditions -->
								<div class="flex flex-col items-center px-4 min-w-[120px]">
									<input
										type="text"
										value={step.conditions_above}
										placeholder="catalyst, base…"
										class="w-full text-center text-xs italic bg-transparent outline-none mb-1
											{step.conditions_above ? 'text-accent' : 'text-muted/25'}"
										onchange={(e) => updateStepField(i, 'conditions_above', e.currentTarget.value)}
									/>
									<div class="flex items-center w-full">
										<div class="flex-1 h-[2px] bg-ink/25 rounded-full"></div>
										<svg width="12" height="10" viewBox="0 0 12 10" class="text-ink/30 -ml-px shrink-0">
											<polygon points="0,0 12,5 0,10" fill="currentColor" />
										</svg>
									</div>
									<input
										type="text"
										value={step.conditions_below}
										placeholder="solvent, temp…"
										class="w-full text-center text-xs italic bg-transparent outline-none mt-1
											{step.conditions_below ? 'text-muted' : 'text-muted/25'}"
										onchange={(e) => updateStepField(i, 'conditions_below', e.currentTarget.value)}
									/>
								</div>

								<!-- Products -->
								{#if pResolved.length > 0}
									{#each step.products as sp, j}
										{@render speciesCard(sp, i, 'products', j)}
										{#if j < step.products.length - 1}
											<span class="text-xl text-border font-light select-none px-1">+</span>
										{/if}
									{/each}
								{:else}
									<div class="flex flex-col items-center min-w-[88px] opacity-30">
										<div class="w-16 h-16 rounded-lg bg-warm/30 border border-dashed border-border flex items-center justify-center mb-1">
											<span class="text-sm text-muted">?</span>
										</div>
										<p class="text-xs text-muted italic">product</p>
									</div>
								{/if}
							</div>
						</div>

						<!-- Notes -->
						<div class="px-4 pb-3">
							<input
								type="text"
								value={step.notes}
								placeholder="Notes…"
								class="w-full text-sm bg-transparent outline-none pt-2 border-t border-border/30
									{step.notes ? 'text-muted' : 'text-muted/25'}"
								onchange={(e) => updateStepField(i, 'notes', e.currentTarget.value)}
							/>
						</div>
					</div>

					<!-- Step connector -->
					{#if i < steps.length - 1}
						<div class="flex justify-center py-0.5">
							<svg width="2" height="20" class="text-border">
								<line x1="1" y1="0" x2="1" y2="20" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" />
							</svg>
						</div>
					{/if}
				{/each}
			</div>
		{/if}

		<!-- ── Yield tracking ────────────────────────────────────────── -->
		{#if steps.length > 0}
			<div class="px-3 pb-3">
				<div class="rounded-xl border border-border bg-card/50 p-4">
					<p class="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Reaction Yield</p>
					<div class="grid grid-cols-3 gap-3 items-end">
						<div>
							<label class="text-xs text-muted block mb-1">Actual (g)</label>
							<input type="number" step="any" bind:value={actualYield}
								class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-muted"
								onchange={persistYield} />
						</div>
						<div>
							<label class="text-xs text-muted block mb-1">Theoretical (g)</label>
							<input type="number" step="any" bind:value={theoreticalYield}
								class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-muted"
								onchange={persistYield} />
						</div>
						<div class="text-center pb-2">
							{#if yieldPercent > 0}
								<p class="text-xl font-mono font-bold {yieldColor(yieldPercent)}">{yieldPercent.toFixed(1)}%</p>
							{:else}
								<p class="text-xl font-mono font-bold text-muted/40">—</p>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- ── Add step form ─────────────────────────────────────────── -->
		<div class="px-3 pb-6">
			{#if showAddStep}
				<div class="rounded-xl border border-border bg-card/50 overflow-hidden" transition:fly={{ y: 10, duration: 200 }}>
					<div class="px-4 py-3 bg-warm/30 border-b border-border">
						<h3 class="text-base font-medium text-ink">New Reaction Step</h3>
					</div>

					<div class="p-4 space-y-5">
						<!-- ── Reactants ──────────────────────────────────── -->
						<div>
							<p class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Reactants (left side)</p>

							{#if newReactants.length > 0}
								<div class="space-y-2 mb-3">
									{#each newReactants as species, idx}
										{@const badge = srcBadge(species.source)}
										<div class="flex items-center gap-2 bg-warm/20 rounded-lg px-3 py-2">
											{#if species.smiles}
												<div class="w-8 h-8 rounded bg-white border border-border/50 shrink-0 overflow-hidden">
													<MoleculeRenderer smiles={species.smiles} width={32} height={32} />
												</div>
											{/if}
											<span class="text-sm text-ink truncate flex-1">{species.name}</span>
											<input type="number" step="any" value={species.amount}
												class="w-20 bg-warm/50 border border-border rounded-l-md px-2 py-1 text-sm font-mono text-center outline-none"
												oninput={(e) => updateNewAmount('reactant', idx, parseFloat(e.currentTarget.value) || 0)} />
											<button
												class="text-xs font-semibold px-2 py-1 rounded-r-md bg-warm border border-l-0 border-border text-accent hover:bg-accent/10"
												onclick={() => cycleNewUnit('reactant', idx)}
											>{unitLabel[species.unit]}</button>
											<span class="text-[10px] px-1.5 py-0.5 rounded {badge.cls}">{badge.label}</span>
											<button class="text-muted hover:text-red-ink text-base leading-none ml-1" onclick={() => removeNewSpecies('reactant', idx)}>×</button>
										</div>
									{/each}
								</div>
							{/if}

							{#if pickerTarget === 'reactant'}
								{@render speciesPicker()}
							{:else}
								<button
									class="w-full text-sm py-2.5 rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent transition-colors"
									onclick={() => { pickerTarget = 'reactant'; pickerSource = 'reagent'; }}
								>+ Add Reactant</button>
							{/if}
						</div>

						<!-- ── Conditions ─────────────────────────────────── -->
						<div>
							<p class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Conditions</p>
							<div class="space-y-2">
								<div>
									<label class="text-xs text-muted/60 block mb-1">Above arrow (catalyst, reagent, base)</label>
									<input type="text" bind:value={newCondAbove} placeholder="e.g. Pd(PPh₃)₄, K₂CO₃"
										class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted/25" />
								</div>
								<div>
									<label class="text-xs text-muted/60 block mb-1">Below arrow (solvent, temperature, time)</label>
									<input type="text" bind:value={newCondBelow} placeholder="e.g. THF, 80°C, 12h, N₂"
										class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted/25" />
								</div>
							</div>
						</div>

						<!-- ── Products ───────────────────────────────────── -->
						<div>
							<p class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Products (right side)</p>

							{#if newProducts.length > 0}
								<div class="space-y-2 mb-3">
									{#each newProducts as species, idx}
										{@const badge = srcBadge(species.source)}
										<div class="flex items-center gap-2 bg-accent/5 rounded-lg px-3 py-2">
											{#if species.smiles}
												<div class="w-8 h-8 rounded bg-white border border-border/50 shrink-0 overflow-hidden">
													<MoleculeRenderer smiles={species.smiles} width={32} height={32} />
												</div>
											{/if}
											<span class="text-sm text-ink truncate flex-1">{species.name}</span>
											<input type="number" step="any" value={species.amount}
												class="w-20 bg-warm/50 border border-border rounded-l-md px-2 py-1 text-sm font-mono text-center outline-none"
												oninput={(e) => updateNewAmount('product', idx, parseFloat(e.currentTarget.value) || 0)} />
											<button
												class="text-xs font-semibold px-2 py-1 rounded-r-md bg-warm border border-l-0 border-border text-accent hover:bg-accent/10"
												onclick={() => cycleNewUnit('product', idx)}
											>{unitLabel[species.unit]}</button>
											<span class="text-[10px] px-1.5 py-0.5 rounded {badge.cls}">{badge.label}</span>
											<button class="text-muted hover:text-red-ink text-base leading-none ml-1" onclick={() => removeNewSpecies('product', idx)}>×</button>
										</div>
									{/each}
								</div>
							{/if}

							{#if pickerTarget === 'product'}
								{@render speciesPicker()}
							{:else}
								<button
									class="w-full text-sm py-2.5 rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent transition-colors"
									onclick={() => { pickerTarget = 'product'; pickerSource = 'reagent'; }}
								>+ Add Product</button>
							{/if}
						</div>

						<!-- ── Notes ──────────────────────────────────────── -->
						<div>
							<p class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Notes</p>
							<input type="text" bind:value={newNotes} placeholder="Observations, workup, TLC…"
								class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted/25" />
						</div>
					</div>

					<!-- Action buttons -->
					<div class="flex gap-2 px-4 py-3 bg-warm/20 border-t border-border">
						<button
							class="flex-1 text-sm py-2.5 rounded-lg border border-border text-muted hover:bg-warm transition-colors"
							onclick={() => { showAddStep = false; resetForm(); }}
						>Cancel</button>
						<button
							class="flex-1 text-sm py-2.5 rounded-lg bg-ink text-cream active:scale-95 transition-transform disabled:opacity-40"
							onclick={saveStep}
							disabled={newReactants.length === 0}
						>Add Step</button>
					</div>
				</div>
			{:else}
				<button
					class="w-full text-sm py-3 rounded-lg border border-dashed border-border text-muted
						   hover:border-accent hover:text-accent transition-colors"
					onclick={() => (showAddStep = true)}
				>+ Add Reaction Step</button>
			{/if}
		</div>
	</main>
</div>

<!-- Stoichiometry calculator -->
{#if calcStep}
	<StoichCalculator
		open={true}
		onclose={() => (calcStep = null)}
		step={calcStep}
	/>
{/if}
