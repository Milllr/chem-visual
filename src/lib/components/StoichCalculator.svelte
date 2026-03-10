<script lang="ts">
	import type { Reagent, ReactionStep } from '$lib/db';
	import { fly } from 'svelte/transition';

	interface Props {
		open: boolean;
		onclose: () => void;
		step: ReactionStep;
		reagents: Reagent[];
	}

	let { open, onclose, step, reagents }: Props = $props();

	// Reference reagent = the one everything is relative to (1.0 equiv)
	let refIdx = $state(0);
	let refMass = $state(1.0); // grams of reference reagent

	// Per-row equiv overrides (index → custom equiv value)
	let equivEdits = $state<Record<number, number>>({});
	// Per-row back-calc: mass → equiv mode (index → mass input)
	let massEdits = $state<Record<number, number | null>>({});

	let reagentIds = $derived(step.reagent_ids || []);
	let coeffs = $derived(step.stoich_coefficients || []);
	let roles = $derived(step.roles || []);

	let refReagent = $derived(reagents.find(r => r.id === reagentIds[refIdx]));
	let refMw = $derived(refReagent?.molar_mass || 0);
	let refCoeff = $derived(coeffs[refIdx] || 1);
	let refMoles = $derived(refMw > 0 ? refMass / refMw : 0);

	let product = $derived(reagents.find(r => r.id === step.product_reagent_id));
	let productMw = $derived(product?.molar_mass || 0);
	let productCoeff = $derived(step.product_stoich || 1);
	let theoMoles = $derived(refMoles > 0 && refCoeff > 0 ? (productCoeff / refCoeff) * refMoles : 0);
	let theoMass = $derived(theoMoles * productMw);

	// Build equivalence rows
	let calcRows = $derived(
		reagentIds.map((rid, i) => {
			const r = reagents.find(rg => rg.id === rid);
			if (!r) return null;
			const coeff = coeffs[i] || 1;
			const role = roles[i] || 'reactant';
			const stoichEquiv = refCoeff > 0 ? coeff / refCoeff : 1;
			const isRef = i === refIdx;

			let equiv: number;
			let mass: number;
			let backCalc = false;

			if (isRef) {
				equiv = 1.0;
				mass = refMass;
			} else if (massEdits[i] != null) {
				// Back-calculation: mass → equiv
				mass = massEdits[i]!;
				equiv = refMoles > 0 && r.molar_mass > 0 ? (mass / r.molar_mass) / refMoles : 0;
				backCalc = true;
			} else {
				// Forward: equiv → mass
				equiv = equivEdits[i] ?? stoichEquiv;
				mass = equiv * refMoles * r.molar_mass;
			}

			const moles = r.molar_mass > 0 ? mass / r.molar_mass : 0;
			const volume = r.density ? mass / r.density : null;

			return { reagent: r, idx: i, coeff, role, stoichEquiv, equiv, moles, mass, volume, isRef, backCalc };
		}).filter(Boolean) as {
			reagent: Reagent; idx: number; coeff: number; role: string;
			stoichEquiv: number; equiv: number; moles: number; mass: number;
			volume: number | null; isRef: boolean; backCalc: boolean;
		}[]
	);

	function fmtN(n: number, dp = 4): string {
		if (n === 0) return '0';
		if (Math.abs(n) < 0.0001) return n.toExponential(2);
		if (Math.abs(n) >= 1e6) return n.toExponential(2);
		return n.toFixed(dp).replace(/\.?0+$/, '');
	}

	function handleEquivInput(idx: number, val: string) {
		const n = parseFloat(val);
		if (!isNaN(n) && n >= 0) {
			equivEdits = { ...equivEdits, [idx]: n };
			// Clear any mass back-calc for this row
			const { [idx]: _, ...rest } = massEdits;
			massEdits = rest;
		}
	}

	function handleMassInput(idx: number, val: string) {
		const n = parseFloat(val);
		if (!isNaN(n) && n >= 0) {
			massEdits = { ...massEdits, [idx]: n };
		}
	}

	function clearBackCalc(idx: number) {
		const { [idx]: _, ...rest } = massEdits;
		massEdits = rest;
	}

	function resetEquiv(idx: number) {
		const { [idx]: _e, ...eRest } = equivEdits;
		equivEdits = eRest;
		const { [idx]: _m, ...mRest } = massEdits;
		massEdits = mRest;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" onclick={onclose} onkeydown={() => {}}></div>

	<div
		class="fixed inset-x-3 top-[8dvh] bottom-[8dvh] z-50 mx-auto max-w-md bg-cream rounded-2xl
			   shadow-xl border border-border overflow-hidden flex flex-col"
		transition:fly={{ y: 20, duration: 200 }}
	>
		<!-- Header -->
		<div class="px-4 pt-4 pb-3 shrink-0">
			<div class="flex items-center justify-between mb-1">
				<h2 class="font-heading text-base text-ink">Equivalence Calculator</h2>
				<button class="text-muted hover:text-ink" onclick={onclose}>
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5L5 15M5 5L15 15" /></svg>
				</button>
			</div>
			<p class="text-[10px] text-muted">Calculate masses from molar equivalents relative to a reference reagent</p>
		</div>

		<!-- Reference reagent picker -->
		<div class="px-4 pb-3 shrink-0 border-b border-border">
			<div class="rounded-lg bg-warm/40 border border-border p-3 space-y-2">
				<div class="flex items-center gap-2">
					<span class="text-[10px] font-semibold text-muted uppercase tracking-wide shrink-0">Reference (1.0 equiv)</span>
				</div>
				<select
					class="w-full bg-cream border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
					value={refIdx}
					onchange={(e) => { refIdx = +e.currentTarget.value; equivEdits = {}; massEdits = {}; }}
				>
					{#each reagentIds as rid, i}
						{@const r = reagents.find(rg => rg.id === rid)}
						{#if r}
							<option value={i}>{r.name} ({(roles[i] || 'reactant')})</option>
						{/if}
					{/each}
				</select>
				<div class="flex items-center gap-2">
					<label class="text-xs text-ink shrink-0">Mass:</label>
					<input
						type="number" step="any" min="0" bind:value={refMass}
						class="flex-1 bg-cream border border-border rounded-lg px-3 py-1.5 text-sm font-mono text-right outline-none focus:border-muted"
					/>
					<span class="text-xs text-muted shrink-0">g</span>
				</div>
				{#if refMoles > 0}
					<p class="text-[10px] text-muted">= {fmtN(refMoles)} mol ({fmtN(refMoles * 1000, 2)} mmol)</p>
				{/if}
			</div>
		</div>

		<!-- Reagent rows -->
		<div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
			{#each calcRows as row}
				{#if !row.isRef}
					<div class="rounded-lg border border-border bg-card/50 p-2.5 space-y-1.5">
						<div class="flex items-center justify-between">
							<div class="min-w-0">
								<p class="text-xs font-medium text-ink truncate">{row.reagent.name}</p>
								<p class="text-[10px] text-muted">{row.role} · MW {row.reagent.molar_mass.toFixed(2)}</p>
							</div>
							{#if equivEdits[row.idx] != null || massEdits[row.idx] != null}
								<button class="text-[10px] text-accent hover:underline shrink-0" onclick={() => resetEquiv(row.idx)}>reset</button>
							{/if}
						</div>
						<div class="grid grid-cols-2 gap-2">
							<!-- Equiv input (forward) -->
							<div>
								<label class="text-[10px] text-muted block mb-0.5">Equiv</label>
								<input
									type="number" step="any" min="0"
									value={row.backCalc ? row.equiv.toFixed(3) : (equivEdits[row.idx] ?? row.stoichEquiv)}
								class="w-full bg-warm/50 border rounded-lg px-2 py-1 text-xs font-mono outline-none transition-colors
									{!row.backCalc ? 'border-blue-ink/40' : 'border-border'}
									{!row.backCalc && equivEdits[row.idx] != null ? 'bg-blue-ink/5' : ''}"
									oninput={(e) => handleEquivInput(row.idx, e.currentTarget.value)}
								/>
								{#if row.stoichEquiv !== 1}
									<p class="text-[9px] text-muted/50 mt-0.5">stoich: {fmtN(row.stoichEquiv, 2)}</p>
								{/if}
							</div>
							<!-- Mass input (back-calc) -->
							<div>
								<label class="text-[10px] text-muted block mb-0.5">
									Mass (g)
									{#if row.backCalc}
										<span class="text-accent ml-1">← back-calc</span>
									{/if}
								</label>
								<input
									type="number" step="any" min="0"
									value={row.backCalc ? massEdits[row.idx] : row.mass.toFixed(4)}
								class="w-full bg-warm/50 border rounded-lg px-2 py-1 text-xs font-mono outline-none font-semibold transition-colors
									{row.backCalc ? 'border-accent/40 bg-accent/5' : 'border-border'}"
									oninput={(e) => handleMassInput(row.idx, e.currentTarget.value)}
								/>
							</div>
						</div>
						<!-- Derived values -->
						<div class="flex items-center gap-3 text-[10px] text-muted">
							<span>{fmtN(row.moles)} mol</span>
							<span>{fmtN(row.moles * 1000, 2)} mmol</span>
							{#if row.volume !== null}
								<span>{fmtN(row.volume, 3)} mL</span>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Theoretical yield footer -->
		<div class="px-4 py-3 bg-warm/30 border-t border-border shrink-0">
			{#if product && productMw > 0}
				<div class="flex items-center justify-between">
					<div>
						<p class="text-[10px] font-semibold text-muted uppercase tracking-wide">Theoretical Yield</p>
						<p class="text-xs text-muted">{product.name} · MW {productMw.toFixed(2)}</p>
					</div>
					<div class="text-right">
						<p class="text-base font-mono font-bold text-ink">{fmtN(theoMass, 3)} g</p>
						<p class="text-[10px] text-muted">{fmtN(theoMoles)} mol</p>
					</div>
				</div>
			{:else}
				<p class="text-[10px] text-muted">Set a product in the reaction step to see theoretical yield.</p>
			{/if}
		</div>
	</div>
{/if}
