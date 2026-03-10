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

	let targetMass = $state(1.0); // grams of product desired

	// Find the product reagent
	let product = $derived(reagents.find(r => r.id === step.product_reagent_id));
	let productMw = $derived(product?.molar_mass || 0);
	let productCoeff = $derived(step.product_stoich || 1);

	// Calculate moles of product
	let productMoles = $derived(productMw > 0 ? targetMass / productMw : 0);

	// Build reagent calculation rows
	let calcRows = $derived(
		(step.reagent_ids || []).map((rid, i) => {
			const r = reagents.find(rg => rg.id === rid);
			if (!r) return null;
			const coeff = (step.stoich_coefficients || [])[i] || 1;
			const role = (step.roles || [])[i] || 'reactant';
			const molesNeeded = productMw > 0 ? (coeff / productCoeff) * productMoles : 0;
			const massNeeded = molesNeeded * r.molar_mass;
			const volumeNeeded = r.density ? massNeeded / r.density : null;
			return { reagent: r, coeff, role, molesNeeded, massNeeded, volumeNeeded };
		}).filter(Boolean) as { reagent: Reagent; coeff: number; role: string; molesNeeded: number; massNeeded: number; volumeNeeded: number | null }[]
	);
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" onclick={onclose} onkeydown={() => {}}></div>

	<div
		class="fixed inset-x-3 top-[10dvh] z-50 mx-auto max-w-md bg-cream rounded-2xl
			   shadow-xl border border-border overflow-hidden"
		transition:fly={{ y: 20, duration: 200 }}
	>
		<div class="px-5 pt-5 pb-2">
			<div class="flex items-center justify-between mb-3">
				<h2 class="font-heading text-base text-ink">Stoichiometry Calculator</h2>
				<button class="text-muted hover:text-ink" onclick={onclose}>
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5L5 15M5 5L15 15" /></svg>
				</button>
			</div>

			<!-- Target product -->
			{#if product}
				<div class="rounded-lg bg-warm/30 border border-border p-3 mb-3">
					<p class="text-xs text-muted mb-1">Target Product</p>
					<p class="text-sm font-semibold text-ink">{product.name}</p>
					<p class="text-xs text-muted font-mono">{product.formula} · MW {product.molar_mass.toFixed(2)} g/mol</p>
				</div>
			{/if}

			<!-- Target mass input -->
			<div class="flex items-center gap-3 mb-4">
				<label class="text-sm text-ink shrink-0">Desired mass:</label>
				<input
					type="number"
					step="0.01"
					min="0"
					bind:value={targetMass}
					class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm
						   outline-none focus:border-muted transition-colors font-mono text-right"
				/>
				<span class="text-sm text-muted shrink-0">g</span>
			</div>

			{#if productMw > 0}
				<p class="text-xs text-muted mb-3">
					= {productMoles.toFixed(4)} mol ({(productMoles * 1000).toFixed(2)} mmol) of {product?.name || 'product'}
				</p>
			{/if}
		</div>

		<!-- Calculation results table -->
		<div class="overflow-x-auto border-t border-border">
			<table class="w-full text-xs">
				<thead>
					<tr class="bg-warm/40">
						<th class="px-3 py-2 text-left font-medium text-muted">Reagent</th>
						<th class="px-2 py-2 text-center font-medium text-muted">Coeff</th>
						<th class="px-2 py-2 text-right font-medium text-muted">Moles</th>
						<th class="px-2 py-2 text-right font-medium text-muted">Mass (g)</th>
						<th class="px-3 py-2 text-right font-medium text-muted">Vol (mL)</th>
					</tr>
				</thead>
				<tbody>
					{#each calcRows as row}
						<tr class="border-b border-border/50 hover:bg-warm/20">
							<td class="px-3 py-2">
								<p class="font-medium text-ink truncate max-w-[120px]">{row.reagent.name}</p>
								<p class="text-[10px] text-muted">{row.role} · MW {row.reagent.molar_mass.toFixed(2)}</p>
							</td>
							<td class="px-2 py-2 text-center font-mono text-ink">{row.coeff}</td>
							<td class="px-2 py-2 text-right font-mono text-ink">{row.molesNeeded.toFixed(4)}</td>
							<td class="px-2 py-2 text-right font-mono text-ink font-semibold">{row.massNeeded.toFixed(3)}</td>
							<td class="px-3 py-2 text-right font-mono text-ink">
								{row.volumeNeeded !== null ? row.volumeNeeded.toFixed(2) : '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="px-5 py-3 bg-warm/20 border-t border-border">
			<p class="text-[10px] text-muted">Volumes calculated from density where available. Adjust coefficients in the reaction flow editor.</p>
		</div>
	</div>
{/if}
