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
	}

	let { reaction, reagents, compounds, onupdate, ondelete, onclose }: Props = $props();

	/* ── Parse steps with backward compatibility ───────────────────── */

	function parseSteps(raw: string | undefined | null): ReactionStep[] {
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed.map((s: any) => {
				if (Array.isArray(s.reactants)) {
					return {
						id: s.id || generateId(),
						reactants: s.reactants || [],
						products: s.products || [],
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
					stoich: coeffs[i] || 1
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
				stoich: s.product_stoich || 1
			});
		} else if (s.product_name) {
			products.push({
				source: 'custom',
				name: s.product_name, formula: s.product_formula || '',
				mw: s.product_mw || calcMW(s.product_formula || ''),
				smiles: s.product_smiles || '', stoich: s.product_stoich || 1
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
			smiles: r.smiles, density: r.density || undefined, stoich: 1
		});
	}

	function addCompoundAsSpecies(c: Compound) {
		addSpecies({
			source: 'compound', ref_id: c.id,
			name: c.name, formula: c.formula, mw: c.molar_mass,
			smiles: c.smiles, stoich: 1
		});
	}

	function addCustomSpecies() {
		if (!customName.trim()) return;
		const mw = calcMW(customFormula.trim());
		addSpecies({
			source: 'custom',
			name: customName.trim(), formula: customFormula.trim(),
			mw, smiles: '', stoich: 1
		});
	}

	function removeSpecies(target: 'reactant' | 'product', idx: number) {
		if (target === 'reactant') newReactants = newReactants.filter((_, i) => i !== idx);
		else newProducts = newProducts.filter((_, i) => i !== idx);
	}

	function updateStoich(target: 'reactant' | 'product', idx: number, val: number) {
		if (target === 'reactant') newReactants = newReactants.map((s, i) => i === idx ? { ...s, stoich: val } : s);
		else newProducts = newProducts.map((s, i) => i === idx ? { ...s, stoich: val } : s);
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

	function resolveSpecies(s: ChemSpecies): ChemSpecies {
		if (s.source === 'reagent' && s.ref_id) {
			const r = reagents.find(rg => rg.id === s.ref_id);
			if (r) return { ...s, name: r.name, formula: r.formula, mw: r.molar_mass, smiles: r.smiles, density: r.density || undefined };
		}
		if (s.source === 'compound' && s.ref_id) {
			const c = compounds.find(cp => cp.id === s.ref_id);
			if (c) return { ...s, name: c.name, formula: c.formula, mw: c.molar_mass, smiles: c.smiles };
		}
		return s;
	}

	function yieldBadgeClass(pct: number): string {
		if (pct >= 80) return 'text-green-700 bg-green-700/8';
		if (pct >= 50) return 'text-amber-600 bg-amber-600/8';
		if (pct > 0) return 'text-red-ink bg-red-ink/8';
		return 'text-muted/40';
	}

	function sourceBadge(source: string): { label: string; cls: string } {
		if (source === 'reagent') return { label: 'reagent', cls: 'text-blue-ink/60 bg-blue-ink/8' };
		if (source === 'compound') return { label: 'compound', cls: 'text-green-700/60 bg-green-700/8' };
		return { label: 'custom', cls: 'text-muted/50 bg-warm' };
	}
</script>

<!-- ── Species picker snippet (reusable for reactants + products) ──── -->
{#snippet speciesPicker()}
	<div class="rounded-lg border border-border bg-cream overflow-hidden" transition:fly={{ y: -5, duration: 150 }}>
		<div class="flex gap-0.5 p-1.5 bg-warm/30">
			{#each [
				{ id: 'reagent', label: 'Reagents', n: reagents.length },
				{ id: 'compound', label: 'Compounds', n: compounds.length },
				{ id: 'custom', label: 'Custom', n: null }
			] as t}
				<button
					class="flex-1 text-[10px] py-1 rounded font-medium transition-all
						{pickerSource === t.id ? 'bg-ink text-cream' : 'text-muted hover:bg-warm'}"
					onclick={() => (pickerSource = t.id as typeof pickerSource)}
				>{t.label}{t.n != null ? ` (${t.n})` : ''}</button>
			{/each}
		</div>

		<div class="p-2 max-h-48 overflow-y-auto">
			{#if pickerSource === 'reagent'}
				{#if reagents.length === 0}
					<p class="text-[10px] text-muted/40 text-center py-3">No reagents in library</p>
				{:else}
					<div class="space-y-0.5">
						{#each reagents as r}
							<button
								class="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-warm/50 transition-colors"
								onclick={() => addReagentAsSpecies(r)}
							>
								{#if r.smiles}
									<div class="w-8 h-8 rounded bg-white border border-border/50 shrink-0 overflow-hidden">
										<MoleculeRenderer smiles={r.smiles} width={32} height={32} />
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<p class="text-xs text-ink truncate">{r.name}</p>
									<p class="text-[10px] text-muted font-mono">{r.formula} · MW {r.molar_mass}</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{:else if pickerSource === 'compound'}
				{#if compounds.length === 0}
					<p class="text-[10px] text-muted/40 text-center py-3">No compounds registered</p>
				{:else}
					<div class="space-y-0.5">
						{#each compounds as c}
							<button
								class="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-warm/50 transition-colors"
								onclick={() => addCompoundAsSpecies(c)}
							>
								{#if c.smiles}
									<div class="w-8 h-8 rounded bg-white border border-border/50 shrink-0 overflow-hidden">
										<MoleculeRenderer smiles={c.smiles} width={32} height={32} />
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<p class="text-xs text-ink truncate">{c.name}</p>
									<p class="text-[10px] text-muted font-mono">{c.formula} · MW {c.molar_mass}</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="space-y-2 py-1">
					<input type="text" bind:value={customName} placeholder="Compound name"
						class="w-full bg-warm/50 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none" />
					<input type="text" bind:value={customFormula} placeholder="Formula (e.g. C6H12O6)"
						class="w-full bg-warm/50 border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none" />
					{#if customFormula && calcMW(customFormula) > 0}
						<p class="text-[10px] text-muted">MW: {calcMW(customFormula)} g/mol</p>
					{/if}
					<button
						class="w-full text-xs py-1.5 rounded-lg bg-ink text-cream disabled:opacity-40"
						onclick={addCustomSpecies} disabled={!customName.trim()}
					>Add</button>
				</div>
			{/if}
		</div>

		<div class="border-t border-border/50 p-1.5">
			<button class="w-full text-[10px] text-muted py-1 hover:text-ink" onclick={() => (pickerTarget = null)}>Cancel</button>
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
		<div class="flex items-center gap-2 px-3 py-2">
			<button
				class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-warm active:bg-warm transition-colors text-muted"
				onclick={onclose}
			>
				<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5L5 15M5 5L15 15" /></svg>
			</button>
			<input
				type="text"
				bind:value={reactionName}
				onblur={handleNameBlur}
				class="flex-1 bg-transparent text-sm font-heading text-ink outline-none placeholder:text-muted/40 min-w-0"
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
				<svg class="w-12 h-12 mx-auto text-muted/15 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 12h3l3-9 4 18 3-9h3" />
				</svg>
				<p class="font-heading text-sm text-muted/60 mb-1">No reaction steps</p>
				<p class="text-xs text-muted/40 mb-4">Build your synthesis scheme step by step</p>
			</div>
		{:else}
			<!-- ── Reaction scheme ──────────────────────────────────────── -->
			<div class="py-4 px-3 space-y-2">
				{#each steps as step, i}
					{@const rResolved = step.reactants.map(resolveSpecies)}
					{@const pResolved = step.products.map(resolveSpecies)}

					<div class="rounded-xl border border-border bg-card/50 overflow-hidden" transition:fly={{ y: 15, duration: 200 }}>
						<!-- Step header -->
						<div class="px-3 py-1.5 bg-warm/30 border-b border-border flex items-center justify-between">
							<span class="text-[10px] font-semibold text-muted uppercase tracking-wide">Step {i + 1}</span>
							<div class="flex items-center gap-0.5">
								<button
									class="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition-colors"
									onclick={() => (calcStep = { ...step, reactants: rResolved, products: pResolved })}
									title="Stoich Calculator"
								>
									<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M5 5H11M5 8H11M5 11H8" /></svg>
								</button>
								<button
									class="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-red-ink hover:bg-red-ink/10 transition-colors"
									onclick={() => deleteStep(i)}
								>
									<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4L12 12M12 4L4 12" /></svg>
								</button>
							</div>
						</div>

						<div class="px-3 py-3">
							<!-- ── Reactants row ──────────────────────────────── -->
							<div class="flex flex-wrap items-end gap-3 justify-center pb-2">
								{#each rResolved as species, j}
									<div class="flex flex-col items-center w-[72px]">
										{#if species.smiles}
											<div class="w-14 h-14 rounded-lg bg-white border border-border/50 overflow-hidden mb-1">
												<MoleculeRenderer smiles={species.smiles} width={56} height={56} />
											</div>
										{:else}
											<div class="w-14 h-14 rounded-lg bg-warm/30 border border-border/50 flex items-center justify-center mb-1">
												<svg class="w-6 h-6 text-muted/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v18M3 12h18" /></svg>
											</div>
										{/if}
										{#if species.stoich > 1}
											<span class="text-[10px] font-mono text-accent font-semibold">{species.stoich}×</span>
										{/if}
										<p class="text-[10px] font-medium text-ink text-center leading-tight truncate w-full">{species.name}</p>
										{#if species.formula}
											<p class="text-[9px] text-muted font-mono">{formatFormula(species.formula)}</p>
										{/if}
									</div>
									{#if j < rResolved.length - 1}
										<span class="text-base text-border font-light pb-8 select-none">+</span>
									{/if}
								{/each}
							</div>

							<!-- ── Reaction arrow with conditions ──────────────── -->
							<div class="py-1 px-1">
								<input
									type="text"
									value={step.conditions_above}
									placeholder="catalyst, reagent, base…"
									class="w-full text-center text-[10px] italic bg-transparent outline-none mb-1
										{step.conditions_above ? 'text-accent' : 'text-muted/20'}"
									onchange={(e) => updateStepField(i, 'conditions_above', e.currentTarget.value)}
								/>

								<div class="flex items-center gap-0 mx-2">
									<div class="flex-1 h-[2px] bg-ink/20 rounded-full"></div>
									<svg width="10" height="8" viewBox="0 0 10 8" class="text-ink/25 -ml-px shrink-0">
										<polygon points="0,0 10,4 0,8" fill="currentColor" />
									</svg>
								</div>

								<input
									type="text"
									value={step.conditions_below}
									placeholder="solvent, temp, time…"
									class="w-full text-center text-[10px] italic bg-transparent outline-none mt-1
										{step.conditions_below ? 'text-muted' : 'text-muted/20'}"
									onchange={(e) => updateStepField(i, 'conditions_below', e.currentTarget.value)}
								/>
							</div>

							<!-- ── Products row ──────────────────────────────── -->
							{#if pResolved.length > 0}
								<div class="flex flex-wrap items-end gap-3 justify-center pt-2">
									{#each pResolved as species, j}
										<div class="flex flex-col items-center w-[72px]">
											{#if species.smiles}
												<div class="w-14 h-14 rounded-lg bg-white border border-accent/20 overflow-hidden mb-1 ring-1 ring-accent/10">
													<MoleculeRenderer smiles={species.smiles} width={56} height={56} />
												</div>
											{:else}
												<div class="w-14 h-14 rounded-lg bg-accent/5 border border-accent/20 flex items-center justify-center mb-1">
													<svg class="w-6 h-6 text-accent/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
												</div>
											{/if}
											{#if species.stoich > 1}
												<span class="text-[10px] font-mono text-accent font-semibold">{species.stoich}×</span>
											{/if}
											<p class="text-[10px] font-semibold text-ink text-center leading-tight truncate w-full">{species.name}</p>
											{#if species.formula}
												<p class="text-[9px] text-muted font-mono">{formatFormula(species.formula)}</p>
											{/if}
										</div>
										{#if j < pResolved.length - 1}
											<span class="text-base text-border font-light pb-8 select-none">+</span>
										{/if}
									{/each}
								</div>
							{:else}
								<p class="text-center text-[10px] text-muted/30 pt-2 italic">No product defined</p>
							{/if}

							<!-- Notes -->
							<input
								type="text"
								value={step.notes}
								placeholder="Notes…"
								class="w-full text-[10px] bg-transparent outline-none mt-3 pt-2 border-t border-border/30
									{step.notes ? 'text-muted' : 'text-muted/20'}"
								onchange={(e) => updateStepField(i, 'notes', e.currentTarget.value)}
							/>
						</div>
					</div>

					<!-- Step connector -->
					{#if i < steps.length - 1}
						<div class="flex justify-center py-0.5">
							<svg width="2" height="16" class="text-border">
								<line x1="1" y1="0" x2="1" y2="16" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" />
							</svg>
						</div>
					{/if}
				{/each}
			</div>
		{/if}

		<!-- ── Yield tracking ────────────────────────────────────────── -->
		{#if steps.length > 0}
			<div class="px-3 pb-3">
				<div class="rounded-xl border border-border bg-card/50 p-3">
					<p class="text-[10px] font-semibold text-muted uppercase tracking-wide mb-2">Reaction Yield</p>
					<div class="grid grid-cols-3 gap-2 items-end">
						<div>
							<label class="text-[10px] text-muted block mb-0.5">Actual (g)</label>
							<input type="number" step="any" bind:value={actualYield}
								class="w-full bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-muted"
								onchange={persistYield} />
						</div>
						<div>
							<label class="text-[10px] text-muted block mb-0.5">Theoretical (g)</label>
							<input type="number" step="any" bind:value={theoreticalYield}
								class="w-full bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-muted"
								onchange={persistYield} />
						</div>
						<div class="text-center pb-1.5">
							{#if yieldPercent > 0}
								<p class="text-lg font-mono font-bold {yieldBadgeClass(yieldPercent)}">{yieldPercent.toFixed(1)}%</p>
							{:else}
								<p class="text-lg font-mono font-bold text-muted/40">—</p>
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
						<h3 class="text-sm font-medium text-ink">New Reaction Step</h3>
					</div>

					<div class="p-4 space-y-5">
						<!-- ── Reactants ──────────────────────────────────── -->
						<div>
							<p class="text-[10px] font-semibold text-muted uppercase tracking-wide mb-2">Reactants (left side)</p>

							{#if newReactants.length > 0}
								<div class="space-y-1.5 mb-2">
									{#each newReactants as species, idx}
										{@const badge = sourceBadge(species.source)}
										<div class="flex items-center gap-2 bg-warm/20 rounded-lg px-2.5 py-1.5">
											<input type="number" min="1" step="1" value={species.stoich}
												class="w-8 bg-transparent text-xs font-mono text-center outline-none border-b border-border"
												oninput={(e) => updateStoich('reactant', idx, +(e.currentTarget.value) || 1)} />
											<span class="text-[10px] text-muted">×</span>
											{#if species.smiles}
												<div class="w-6 h-6 rounded bg-white border border-border/50 shrink-0 overflow-hidden">
													<MoleculeRenderer smiles={species.smiles} width={24} height={24} />
												</div>
											{/if}
											<span class="text-xs text-ink truncate flex-1">{species.name}</span>
											<span class="text-[8px] px-1 py-0.5 rounded {badge.cls}">{badge.label}</span>
											<button class="text-muted hover:text-red-ink text-sm leading-none" onclick={() => removeSpecies('reactant', idx)}>×</button>
										</div>
									{/each}
								</div>
							{/if}

							{#if pickerTarget === 'reactant'}
								{@render speciesPicker()}
							{:else}
								<button
									class="w-full text-[10px] py-2 rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent transition-colors"
									onclick={() => { pickerTarget = 'reactant'; pickerSource = 'reagent'; }}
								>+ Add Reactant</button>
							{/if}
						</div>

						<!-- ── Conditions ─────────────────────────────────── -->
						<div>
							<p class="text-[10px] font-semibold text-muted uppercase tracking-wide mb-2">Conditions</p>
							<div class="space-y-2">
								<div>
									<label class="text-[9px] text-muted/60 block mb-0.5">Above arrow (catalyst, reagent, base)</label>
									<input type="text" bind:value={newCondAbove} placeholder="e.g. Pd(PPh₃)₄, K₂CO₃"
										class="w-full bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-xs outline-none placeholder:text-muted/25" />
								</div>
								<div>
									<label class="text-[9px] text-muted/60 block mb-0.5">Below arrow (solvent, temperature, time)</label>
									<input type="text" bind:value={newCondBelow} placeholder="e.g. THF, 80°C, 12h, N₂"
										class="w-full bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-xs outline-none placeholder:text-muted/25" />
								</div>
							</div>
						</div>

						<!-- ── Products ───────────────────────────────────── -->
						<div>
							<p class="text-[10px] font-semibold text-muted uppercase tracking-wide mb-2">Products (right side)</p>

							{#if newProducts.length > 0}
								<div class="space-y-1.5 mb-2">
									{#each newProducts as species, idx}
										{@const badge = sourceBadge(species.source)}
										<div class="flex items-center gap-2 bg-accent/5 rounded-lg px-2.5 py-1.5">
											<input type="number" min="1" step="1" value={species.stoich}
												class="w-8 bg-transparent text-xs font-mono text-center outline-none border-b border-border"
												oninput={(e) => updateStoich('product', idx, +(e.currentTarget.value) || 1)} />
											<span class="text-[10px] text-muted">×</span>
											{#if species.smiles}
												<div class="w-6 h-6 rounded bg-white border border-border/50 shrink-0 overflow-hidden">
													<MoleculeRenderer smiles={species.smiles} width={24} height={24} />
												</div>
											{/if}
											<span class="text-xs text-ink truncate flex-1">{species.name}</span>
											<span class="text-[8px] px-1 py-0.5 rounded {badge.cls}">{badge.label}</span>
											<button class="text-muted hover:text-red-ink text-sm leading-none" onclick={() => removeSpecies('product', idx)}>×</button>
										</div>
									{/each}
								</div>
							{/if}

							{#if pickerTarget === 'product'}
								{@render speciesPicker()}
							{:else}
								<button
									class="w-full text-[10px] py-2 rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent transition-colors"
									onclick={() => { pickerTarget = 'product'; pickerSource = 'reagent'; }}
								>+ Add Product</button>
							{/if}
						</div>

						<!-- ── Notes ──────────────────────────────────────── -->
						<div>
							<p class="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1.5">Notes</p>
							<input type="text" bind:value={newNotes} placeholder="Observations, workup, TLC…"
								class="w-full bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-xs outline-none placeholder:text-muted/25" />
						</div>
					</div>

					<!-- Action buttons -->
					<div class="flex gap-2 px-4 py-3 bg-warm/20 border-t border-border">
						<button
							class="flex-1 text-sm py-2 rounded-lg border border-border text-muted hover:bg-warm transition-colors"
							onclick={() => { showAddStep = false; resetForm(); }}
						>Cancel</button>
						<button
							class="flex-1 text-sm py-2 rounded-lg bg-ink text-cream active:scale-95 transition-transform disabled:opacity-40"
							onclick={saveStep}
							disabled={newReactants.length === 0}
						>Add Step</button>
					</div>
				</div>
			{:else}
				<button
					class="w-full text-sm py-2.5 rounded-lg border border-dashed border-border text-muted
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
