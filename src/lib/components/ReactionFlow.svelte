<script lang="ts">
	import type { Reagent, Reaction, ReactionStep } from '$lib/db';
	import { generateId } from '$lib/db';
	import MoleculeRenderer from './MoleculeRenderer.svelte';
	import StoichCalculator from './StoichCalculator.svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		reaction: Reaction;
		reagents: Reagent[];
		onupdate: (reaction: Reaction) => void;
		ondelete: () => void;
		onclose: () => void;
	}

	let { reaction, reagents, onupdate, ondelete, onclose }: Props = $props();

	function parseSteps(raw: string | undefined | null): ReactionStep[] {
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			// Ensure each step has required arrays
			return parsed.map((s: any) => ({
				id: s.id || generateId(),
				reagent_ids: Array.isArray(s.reagent_ids) ? s.reagent_ids : [],
				stoich_coefficients: Array.isArray(s.stoich_coefficients) ? s.stoich_coefficients : [],
				roles: Array.isArray(s.roles) ? s.roles : [],
				product_reagent_id: s.product_reagent_id || undefined,
				product_stoich: s.product_stoich || 1,
				conditions: s.conditions || '',
				notes: s.notes || ''
			}));
		} catch { return []; }
	}

	let steps = $state<ReactionStep[]>(parseSteps(reaction.steps));
	let reactionName = $state(reaction.name || '');
	let showAddStep = $state(false);
	let calcStep = $state<ReactionStep | null>(null);

	// Re-sync when reaction prop changes
	$effect(() => {
		steps = parseSteps(reaction.steps);
		reactionName = reaction.name || '';
	});

	// New step form state
	let newReagentIds = $state<string[]>([]);
	let newCoeffs = $state<number[]>([]);
	let newRoles = $state<string[]>([]);
	let newProductId = $state('');
	let newProductCoeff = $state(1);
	let newConditions = $state('');
	let newNotes = $state('');

	function resetNewStep() {
		newReagentIds = [];
		newCoeffs = [];
		newRoles = [];
		newProductId = '';
		newProductCoeff = 1;
		newConditions = '';
		newNotes = '';
	}

	function addReagentToStep(id: string) {
		if (newReagentIds.includes(id)) return;
		newReagentIds = [...newReagentIds, id];
		newCoeffs = [...newCoeffs, 1];
		newRoles = [...newRoles, 'reactant'];
	}

	function removeReagentFromStep(idx: number) {
		newReagentIds = newReagentIds.filter((_, i) => i !== idx);
		newCoeffs = newCoeffs.filter((_, i) => i !== idx);
		newRoles = newRoles.filter((_, i) => i !== idx);
	}

	function saveStep() {
		if (newReagentIds.length === 0) return;
		const step: ReactionStep = {
			id: generateId(),
			reagent_ids: [...newReagentIds],
			stoich_coefficients: [...newCoeffs],
			roles: [...newRoles],
			product_reagent_id: newProductId || undefined,
			product_stoich: newProductCoeff,
			conditions: newConditions,
			notes: newNotes
		};
		steps = [...steps, step];
		showAddStep = false;
		resetNewStep();
		persistSteps();
	}

	function deleteStep(idx: number) {
		steps = steps.filter((_, i) => i !== idx);
		persistSteps();
	}

	function persistSteps() {
		const updated: Reaction = {
			...reaction,
			name: reactionName,
			steps: JSON.stringify(steps)
		};
		onupdate(updated);
	}

	function handleNameBlur() {
		if (reactionName !== reaction.name) {
			persistSteps();
		}
	}

	function getReagent(id: string): Reagent | undefined {
		return reagents.find(r => r.id === id);
	}
</script>

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
				placeholder="Reaction name..."
			/>
			<button
				class="px-3 py-1.5 rounded-lg text-sm text-red-ink hover:bg-red-ink/10 transition-colors"
				onclick={ondelete}
			>
				Delete
			</button>
		</div>
	</header>

	<!-- Flow content -->
	<main class="flex-1 overflow-auto">
		{#if steps.length === 0}
			<div class="text-center py-16 px-6">
				<svg class="w-10 h-10 mx-auto text-muted/20 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16" /><path d="M6 20V10l3-7h6l3 7v10" /><path d="M6 10h12" /><circle cx="12" cy="15" r="2" /></svg>
				<p class="font-heading text-sm text-muted/60 mb-1">No reaction steps yet</p>
				<p class="text-xs text-muted/40 mb-4">Add steps to build your reaction flow</p>
			</div>
		{:else}
			<!-- Horizontal flow -->
			<div class="overflow-x-auto py-6 px-4">
				<div class="flex items-start gap-0 min-w-max">
					{#each steps as step, i}
						<!-- Step card -->
						<div class="flex items-center gap-0">
							<div class="w-56 rounded-xl border border-border bg-card/50 overflow-hidden shrink-0" transition:fly={{ x: 20, duration: 200 }}>
								<!-- Step header -->
								<div class="px-3 py-2 bg-warm/30 border-b border-border flex items-center justify-between">
									<span class="text-[10px] font-medium text-muted">Step {i + 1}</span>
									<div class="flex items-center gap-1">
										<button
											class="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-accent hover:bg-warm transition-colors"
											onclick={() => (calcStep = step)}
											title="Calculate"
										>
											<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M5 5H11M5 8H11M5 11H8" /></svg>
										</button>
										<button
											class="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-red-ink hover:bg-red-ink/10 transition-colors"
											onclick={() => deleteStep(i)}
										>
											<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4L12 12M12 4L4 12" /></svg>
										</button>
									</div>
								</div>

								<!-- Reagents (inputs) -->
								<div class="px-3 py-2 space-y-1.5">
									{#each step.reagent_ids || [] as rid, j}
										{@const r = getReagent(rid)}
										{#if r}
											<div class="flex items-center gap-2">
												<span class="text-[10px] font-mono text-muted w-3 text-right">{(step.stoich_coefficients || [])[j] || 1}×</span>
												<div class="flex-1 min-w-0">
													<p class="text-xs font-medium text-ink truncate">{r.name}</p>
													<p class="text-[10px] text-muted">{r.formula} · {(step.roles || [])[j] || 'reactant'}</p>
												</div>
												{#if r.smiles}
													<div class="w-8 h-8 rounded bg-white border border-border/50 shrink-0 overflow-hidden">
														<MoleculeRenderer smiles={r.smiles} width={40} height={40} />
													</div>
												{/if}
											</div>
										{/if}
									{/each}
								</div>

								<!-- Conditions -->
								{#if step.conditions}
									<div class="px-3 py-1.5 bg-accent/5 border-t border-border/50">
										<p class="text-[10px] text-accent italic">{step.conditions}</p>
									</div>
								{/if}

								<!-- Product -->
								{#if step.product_reagent_id}
									{@const prod = getReagent(step.product_reagent_id)}
									{#if prod}
										<div class="px-3 py-2 bg-warm/20 border-t border-border">
											<p class="text-[10px] text-muted mb-0.5">→ Product</p>
											<div class="flex items-center gap-2">
												<span class="text-[10px] font-mono text-muted w-3 text-right">{step.product_stoich || 1}×</span>
												<p class="text-xs font-semibold text-ink truncate flex-1">{prod.name}</p>
												{#if prod.smiles}
													<div class="w-8 h-8 rounded bg-white border border-border/50 shrink-0 overflow-hidden">
														<MoleculeRenderer smiles={prod.smiles} width={40} height={40} />
													</div>
												{/if}
											</div>
										</div>
									{/if}
								{/if}

								{#if step.notes}
									<div class="px-3 py-1.5 border-t border-border/50">
										<p class="text-[10px] text-muted">{step.notes}</p>
									</div>
								{/if}
							</div>

							<!-- Arrow between steps -->
							{#if i < steps.length - 1}
								<div class="px-2 flex items-center">
									<svg width="24" height="16" viewBox="0 0 24 16" class="text-border">
										<path d="M0 8H20M16 3L22 8L16 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Add step button -->
		<div class="px-4 pb-6">
			{#if showAddStep}
				<div class="rounded-xl border border-border bg-card/50 overflow-hidden" transition:fly={{ y: 10, duration: 200 }}>
					<div class="px-4 py-3 bg-warm/30 border-b border-border">
						<h3 class="text-sm font-medium text-ink">Add Reaction Step</h3>
					</div>

					<div class="p-4 space-y-4">
						<!-- Select reagents -->
						<div>
							<label class="text-xs font-medium text-muted mb-1.5 block">Input Reagents</label>
							{#if newReagentIds.length > 0}
								<div class="space-y-1.5 mb-2">
									{#each newReagentIds as rid, i}
										{@const r = getReagent(rid)}
										{#if r}
											<div class="flex items-center gap-2 bg-warm/20 rounded-lg px-2.5 py-1.5">
												<input
													type="number"
													min="1"
													step="1"
													bind:value={newCoeffs[i]}
													class="w-10 bg-transparent text-xs font-mono text-center outline-none border-b border-border"
												/>
												<span class="text-xs text-ink truncate flex-1">{r.name}</span>
												<select
													bind:value={newRoles[i]}
													class="text-[10px] bg-transparent text-muted outline-none border-none"
												>
													<option value="reactant">reactant</option>
													<option value="catalyst">catalyst</option>
													<option value="solvent">solvent</option>
												</select>
												<button
													class="text-muted hover:text-red-ink"
													onclick={() => removeReagentFromStep(i)}
												>×</button>
											</div>
										{/if}
									{/each}
								</div>
							{/if}

							<!-- Reagent picker -->
							<div class="flex flex-wrap gap-1.5">
								{#each reagents as r}
									{#if !newReagentIds.includes(r.id)}
										<button
											class="text-[10px] px-2 py-1 rounded-lg border border-border bg-cream
												   hover:bg-warm transition-colors text-ink"
											onclick={() => addReagentToStep(r.id)}
										>
											+ {r.name}
										</button>
									{/if}
								{/each}
								{#if reagents.length === 0}
									<p class="text-xs text-muted/60 italic">Add reagents to your library first</p>
								{/if}
							</div>
						</div>

						<!-- Product -->
						<div>
							<label class="text-xs font-medium text-muted mb-1.5 block">Product</label>
							<div class="flex items-center gap-2">
								<input
									type="number"
									min="1"
									step="1"
									bind:value={newProductCoeff}
									class="w-10 bg-warm/50 border border-border rounded-lg text-xs font-mono text-center py-1.5 outline-none"
								/>
								<span class="text-xs text-muted">×</span>
								<select
									bind:value={newProductId}
									class="flex-1 bg-warm/50 border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none text-ink"
								>
									<option value="">Select product...</option>
									{#each reagents as r}
										<option value={r.id}>{r.name} ({r.formula})</option>
									{/each}
								</select>
							</div>
						</div>

						<!-- Conditions -->
						<div>
							<label class="text-xs font-medium text-muted mb-1.5 block">Conditions</label>
							<input
								type="text"
								bind:value={newConditions}
								placeholder="e.g. reflux, 80°C, 2h, N₂ atmosphere"
								class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted/40"
							/>
						</div>

						<!-- Notes -->
						<div>
							<label class="text-xs font-medium text-muted mb-1.5 block">Notes (optional)</label>
							<input
								type="text"
								bind:value={newNotes}
								placeholder="Additional notes..."
								class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted/40"
							/>
						</div>
					</div>

					<div class="flex gap-2 px-4 py-3 bg-warm/20 border-t border-border">
						<button
							class="flex-1 text-sm py-2 rounded-lg border border-border text-muted hover:bg-warm transition-colors"
							onclick={() => { showAddStep = false; resetNewStep(); }}
						>Cancel</button>
						<button
							class="flex-1 text-sm py-2 rounded-lg bg-accent text-cream active:scale-95 transition-transform
								   disabled:opacity-40"
							onclick={saveStep}
							disabled={newReagentIds.length === 0}
						>Add Step</button>
					</div>
				</div>
			{:else}
				<button
					class="w-full text-sm py-2.5 rounded-lg border border-dashed border-border text-muted
						   hover:border-accent hover:text-accent transition-colors"
					onclick={() => (showAddStep = true)}
				>
					+ Add Reaction Step
				</button>
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
		{reagents}
	/>
{/if}
