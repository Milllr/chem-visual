<script lang="ts">
	import type { Compound, Reaction, Reagent } from '$lib/db';
	import { NMR_NUCLEI } from '$lib/db';
	import MoleculeRenderer from './MoleculeRenderer.svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		compounds: Compound[];
		reactions: Reaction[];
		reagents: Reagent[];
		notebookId: string;
		oncompoundschange: (compounds: Compound[]) => void;
	}

	let { compounds, reactions, reagents, notebookId, oncompoundschange }: Props = $props();

	let expandedId = $state<string | null>(null);
	let showAddForm = $state(false);
	let addNucleusOpen = $state<string | null>(null); // compound id showing nucleus picker

	// New compound form
	let newName = $state('');
	let newFormula = $state('');
	let newMw = $state(0);
	let newSmiles = $state('');
	let newReactionId = $state('');

	function parseNmr(data: string): Record<string, { have: boolean; notes: string }> {
		try { return JSON.parse(data) || {}; } catch { return {}; }
	}

	function yieldBadge(pct: number): { text: string; cls: string } {
		if (pct === 0) return { text: '—', cls: 'text-muted/40' };
		if (pct >= 80) return { text: `${pct.toFixed(0)}%`, cls: 'text-green-700 bg-green-700/8' };
		if (pct >= 50) return { text: `${pct.toFixed(0)}%`, cls: 'text-amber-600 bg-amber-600/8' };
		return { text: `${pct.toFixed(0)}%`, cls: 'text-red-ink bg-red-ink/8' };
	}

	function nmrSummary(data: string): string[] {
		const parsed = parseNmr(data);
		return Object.entries(parsed)
			.filter(([, v]) => v.have)
			.map(([k]) => NMR_NUCLEI.find(n => n.id === k)?.label || k);
	}

	function getReactionName(id: string | null): string {
		if (!id) return '';
		const r = reactions.find(rx => rx.id === id);
		return r?.name || 'Untitled Reaction';
	}

	// Debounced update
	let updateTimer: ReturnType<typeof setTimeout> | null = null;
	async function saveCompound(compound: Compound) {
		if (updateTimer) clearTimeout(updateTimer);
		updateTimer = setTimeout(async () => {
			await fetch(`/api/compounds/${compound.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(compound)
			});
		}, 500);
		oncompoundschange(compounds.map(c => c.id === compound.id ? compound : c));
	}

	async function createCompound() {
		const defaultNmr = Object.fromEntries(
			['1H', '13C'].map(n => [n, { have: false, notes: '' }])
		);
		const res = await fetch('/api/compounds', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				notebook_id: notebookId,
				name: newName || 'Untitled Compound',
				formula: newFormula,
				molar_mass: newMw,
				smiles: newSmiles,
				reaction_id: newReactionId || null,
				nmr_data: JSON.stringify(defaultNmr)
			})
		});
		if (res.ok) {
			const compound: Compound = await res.json();
			oncompoundschange([...compounds, compound]);
			expandedId = compound.id;
			showAddForm = false;
			newName = ''; newFormula = ''; newMw = 0; newSmiles = ''; newReactionId = '';
		}
	}

	async function deleteCompound(id: string) {
		await fetch(`/api/compounds/${id}`, { method: 'DELETE' });
		oncompoundschange(compounds.filter(c => c.id !== id));
		expandedId = null;
	}

	function toggleNmr(compound: Compound, nucleusId: string) {
		const nmr = parseNmr(compound.nmr_data);
		if (nmr[nucleusId]) {
			nmr[nucleusId].have = !nmr[nucleusId].have;
		} else {
			nmr[nucleusId] = { have: true, notes: '' };
		}
		saveCompound({ ...compound, nmr_data: JSON.stringify(nmr) });
	}

	function updateNmrNotes(compound: Compound, nucleusId: string, notes: string) {
		const nmr = parseNmr(compound.nmr_data);
		if (!nmr[nucleusId]) nmr[nucleusId] = { have: false, notes: '' };
		nmr[nucleusId].notes = notes;
		saveCompound({ ...compound, nmr_data: JSON.stringify(nmr) });
	}

	function addNucleus(compound: Compound, nucleusId: string) {
		const nmr = parseNmr(compound.nmr_data);
		if (!nmr[nucleusId]) {
			nmr[nucleusId] = { have: false, notes: '' };
			saveCompound({ ...compound, nmr_data: JSON.stringify(nmr) });
		}
		addNucleusOpen = null;
	}

	function removeNucleus(compound: Compound, nucleusId: string) {
		const nmr = parseNmr(compound.nmr_data);
		delete nmr[nucleusId];
		saveCompound({ ...compound, nmr_data: JSON.stringify(nmr) });
	}

	function recalcYield(compound: Compound, actualYield: number, theoreticalYield: number) {
		const pct = theoreticalYield > 0 ? (actualYield / theoreticalYield) * 100 : 0;
		saveCompound({
			...compound,
			actual_yield: actualYield,
			theoretical_yield: theoreticalYield,
			yield_percent: Math.round(pct * 10) / 10
		});
	}
</script>

<div class="p-4 space-y-3">
	{#if compounds.length === 0 && !showAddForm}
		<div class="text-center py-12">
			<svg class="w-10 h-10 mx-auto text-muted/20 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M9 3h6l2 4H7l2-4z" /><path d="M7 7v10a3 3 0 003 3h4a3 3 0 003-3V7" />
				<path d="M10 11v4" /><path d="M14 11v4" /><path d="M10 15h4" />
			</svg>
			<p class="font-heading text-sm text-muted/60 mb-1">No compounds tracked</p>
			<p class="text-xs text-muted/40 mb-4">Register synthesized compounds to track characterization data</p>
		</div>
	{/if}

	<!-- Compound cards -->
	{#each compounds as compound (compound.id)}
		{@const nmrHave = nmrSummary(compound.nmr_data)}
		{@const yld = yieldBadge(compound.yield_percent)}
		<div
			class="rounded-xl border border-border bg-card/50 overflow-hidden"
			transition:fly={{ y: 10, duration: 200 }}
		>
			<!-- Summary row -->
			<button
				class="w-full text-left p-3 hover:bg-warm/20 transition-colors"
				onclick={() => expandedId = expandedId === compound.id ? null : compound.id}
			>
				<div class="flex items-start gap-3">
					{#if compound.smiles}
						<div class="w-10 h-10 rounded-lg bg-white border border-border/50 shrink-0 overflow-hidden">
							<MoleculeRenderer smiles={compound.smiles} width={40} height={40} />
						</div>
					{/if}
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<p class="text-sm font-medium text-ink truncate">{compound.name || 'Untitled'}</p>
							{#if compound.yield_percent > 0}
								<span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold {yld.cls}">{yld.text}</span>
							{/if}
						</div>
						<div class="flex items-center gap-2 mt-0.5 flex-wrap">
							{#if compound.formula}
								<span class="text-[10px] text-muted">{compound.formula}</span>
							{/if}
							{#if compound.reaction_id}
								<span class="text-[10px] text-muted/50">· {getReactionName(compound.reaction_id)}</span>
							{/if}
						</div>
						<!-- Characterization badges -->
						<div class="flex items-center gap-1 mt-1.5 flex-wrap">
							{#each nmrHave as nuc}
								<span class="px-1 py-0.5 rounded bg-blue-ink/8 text-[9px] font-mono text-blue-ink">{nuc}</span>
							{/each}
							{#if compound.mass_spec}
								<span class="px-1 py-0.5 rounded bg-accent/8 text-[9px] font-mono text-accent">MS</span>
							{/if}
							{#if compound.ir_data}
								<span class="px-1 py-0.5 rounded bg-accent/8 text-[9px] font-mono text-accent">IR</span>
							{/if}
							{#if compound.crystal}
								<span class="px-1 py-0.5 rounded bg-accent/8 text-[9px] font-mono text-accent">XRD</span>
							{/if}
						</div>
					</div>
					<svg
						class="w-4 h-4 text-muted shrink-0 mt-1 transition-transform"
						class:rotate-180={expandedId === compound.id}
						viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
					><path d="M4 6L8 10L12 6" /></svg>
				</div>
			</button>

			<!-- Expanded detail -->
			{#if expandedId === compound.id}
				<div class="border-t border-border/50 px-3 pb-3 space-y-4" transition:fly={{ y: -5, duration: 150 }}>

					<!-- Identity -->
					<div class="pt-3 space-y-2">
						<div class="grid grid-cols-2 gap-2">
							<div>
								<label class="text-[10px] text-muted block mb-0.5">Name</label>
								<input type="text" value={compound.name}
									class="w-full bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-muted"
									onchange={(e) => saveCompound({ ...compound, name: e.currentTarget.value })} />
							</div>
							<div>
								<label class="text-[10px] text-muted block mb-0.5">Formula</label>
								<input type="text" value={compound.formula}
									class="w-full bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-muted"
									onchange={(e) => saveCompound({ ...compound, formula: e.currentTarget.value })} />
							</div>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<div>
								<label class="text-[10px] text-muted block mb-0.5">MW (g/mol)</label>
								<input type="number" step="any" value={compound.molar_mass}
									class="w-full bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-muted"
									onchange={(e) => saveCompound({ ...compound, molar_mass: +e.currentTarget.value })} />
							</div>
							<div>
								<label class="text-[10px] text-muted block mb-0.5">Reaction</label>
								<select
									class="w-full bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
									value={compound.reaction_id || ''}
									onchange={(e) => saveCompound({ ...compound, reaction_id: e.currentTarget.value || null })}
								>
									<option value="">None</option>
									{#each reactions as rx}
										<option value={rx.id}>{rx.name || 'Untitled'}</option>
									{/each}
								</select>
							</div>
						</div>
						{#if compound.smiles}
							<div>
								<label class="text-[10px] text-muted block mb-0.5">SMILES</label>
								<p class="text-[10px] font-mono text-muted/80 bg-warm/30 rounded px-2 py-1 break-all">{compound.smiles}</p>
							</div>
						{/if}
					</div>

					<!-- Yield -->
					<div class="rounded-lg bg-warm/30 border border-border p-3">
						<p class="text-[10px] font-semibold text-muted uppercase tracking-wide mb-2">Yield</p>
						<div class="grid grid-cols-3 gap-2 items-end">
							<div>
								<label class="text-[10px] text-muted block mb-0.5">Actual (g)</label>
								<input type="number" step="any" value={compound.actual_yield}
									class="w-full bg-cream border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-muted"
									onchange={(e) => recalcYield(compound, +e.currentTarget.value, compound.theoretical_yield)} />
							</div>
							<div>
								<label class="text-[10px] text-muted block mb-0.5">Theoretical (g)</label>
								<input type="number" step="any" value={compound.theoretical_yield}
									class="w-full bg-cream border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-muted"
									onchange={(e) => recalcYield(compound, compound.actual_yield, +e.currentTarget.value)} />
							</div>
							<div class="text-center pb-1.5">
								{#if compound.yield_percent > 0}
									{@const y = yieldBadge(compound.yield_percent)}
									<p class="text-lg font-mono font-bold {y.cls}">{y.text}</p>
								{:else}
									<p class="text-lg font-mono font-bold text-muted/40">—</p>
								{/if}
							</div>
						</div>
					</div>

					<!-- NMR Characterization -->
					<div class="rounded-lg bg-warm/30 border border-border p-3">
						<div class="flex items-center justify-between mb-2">
							<p class="text-[10px] font-semibold text-muted uppercase tracking-wide">NMR Data</p>
							<div class="relative">
								<button
									class="text-[10px] text-accent hover:underline"
									onclick={() => addNucleusOpen = addNucleusOpen === compound.id ? null : compound.id}
								>+ Add Nucleus</button>
								{#if addNucleusOpen === compound.id}
									<div class="absolute right-0 top-5 z-10 bg-cream border border-border rounded-lg shadow-lg p-1.5 min-w-[140px]">
										{#each NMR_NUCLEI as nuc}
											{@const nmr = parseNmr(compound.nmr_data)}
											{#if !nmr[nuc.id]}
												<button
													class="w-full text-left px-2 py-1 text-xs hover:bg-warm/50 rounded"
													onclick={() => addNucleus(compound, nuc.id)}
												>
													<span class="font-mono">{nuc.label}</span>
													<span class="text-muted ml-1">{nuc.name}</span>
												</button>
											{/if}
										{/each}
									</div>
								{/if}
							</div>
						</div>

						{#if parseNmr(compound.nmr_data)}
						{@const nmr = parseNmr(compound.nmr_data)}
						{@const nucleiKeys = Object.keys(nmr)}
						{#if nucleiKeys.length === 0}
							<p class="text-[10px] text-muted/40 text-center py-2">No nuclei tracked. Click "+ Add Nucleus" to start.</p>
						{:else}
							<div class="space-y-2">
								{#each nucleiKeys as nid}
									{@const entry = nmr[nid]}
									{@const nucInfo = NMR_NUCLEI.find(n => n.id === nid)}
									<div class="flex items-center gap-2 group">
										<button
											class="w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors"
											class:bg-blue-ink={entry.have}
											class:border-blue-ink={entry.have}
											class:text-white={entry.have}
											class:border-border={!entry.have}
											onclick={() => toggleNmr(compound, nid)}
										>
											{#if entry.have}
												<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 8L7 12L13 4" /></svg>
											{/if}
										</button>
										<span class="text-xs font-mono font-medium text-ink w-10 shrink-0">{nucInfo?.label || nid}</span>
										<input
											type="text"
											placeholder="Notes (solvent, freq...)"
											value={entry.notes}
											class="flex-1 bg-cream/60 border border-border/50 rounded px-2 py-1 text-[10px] outline-none focus:border-muted placeholder:text-muted/30"
											onchange={(e) => updateNmrNotes(compound, nid, e.currentTarget.value)}
										/>
										<button
											class="opacity-0 group-hover:opacity-100 text-muted hover:text-red-ink transition-all"
											onclick={() => removeNucleus(compound, nid)}
										>
											<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4L4 12M4 4L12 12" /></svg>
										</button>
									</div>
								{/each}
							</div>
						{/if}
						{/if}
					</div>

					<!-- Other Characterization -->
					<div class="rounded-lg bg-warm/30 border border-border p-3 space-y-3">
						<p class="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Other Characterization</p>

						<!-- Mass Spec -->
						<div class="flex items-start gap-2">
							<button
								class="w-5 h-5 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors"
								class:bg-accent={compound.mass_spec}
								class:border-accent={compound.mass_spec}
								class:text-cream={compound.mass_spec}
								class:border-border={!compound.mass_spec}
								onclick={() => saveCompound({ ...compound, mass_spec: compound.mass_spec ? 0 : 1 })}
							>
								{#if compound.mass_spec}
									<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 8L7 12L13 4" /></svg>
								{/if}
							</button>
							<div class="flex-1 min-w-0">
								<p class="text-xs font-medium text-ink">Mass Spectrometry</p>
								<div class="flex gap-2 mt-1">
									<select
										class="bg-cream/60 border border-border/50 rounded px-2 py-0.5 text-[10px] outline-none"
										value={compound.mass_spec_type}
										onchange={(e) => saveCompound({ ...compound, mass_spec_type: e.currentTarget.value })}
									>
										<option value="">Type...</option>
										<option value="ESI">ESI</option>
										<option value="MALDI">MALDI</option>
										<option value="EI">EI</option>
										<option value="CI">CI</option>
										<option value="APCI">APCI</option>
										<option value="FAB">FAB</option>
										<option value="HRMS">HRMS</option>
									</select>
									<input type="text" placeholder="Notes..."
										value={compound.mass_spec_notes}
										class="flex-1 bg-cream/60 border border-border/50 rounded px-2 py-0.5 text-[10px] outline-none placeholder:text-muted/30"
										onchange={(e) => saveCompound({ ...compound, mass_spec_notes: e.currentTarget.value })} />
								</div>
							</div>
						</div>

						<!-- IR -->
						<div class="flex items-start gap-2">
							<button
								class="w-5 h-5 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors"
								class:bg-accent={compound.ir_data}
								class:border-accent={compound.ir_data}
								class:text-cream={compound.ir_data}
								class:border-border={!compound.ir_data}
								onclick={() => saveCompound({ ...compound, ir_data: compound.ir_data ? 0 : 1 })}
							>
								{#if compound.ir_data}
									<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 8L7 12L13 4" /></svg>
								{/if}
							</button>
							<div class="flex-1 min-w-0">
								<p class="text-xs font-medium text-ink">IR Spectroscopy</p>
								<input type="text" placeholder="Key peaks, method..."
									value={compound.ir_notes}
									class="w-full mt-1 bg-cream/60 border border-border/50 rounded px-2 py-0.5 text-[10px] outline-none placeholder:text-muted/30"
									onchange={(e) => saveCompound({ ...compound, ir_notes: e.currentTarget.value })} />
							</div>
						</div>

						<!-- Crystal Structure -->
						<div class="flex items-start gap-2">
							<button
								class="w-5 h-5 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors"
								class:bg-accent={compound.crystal}
								class:border-accent={compound.crystal}
								class:text-cream={compound.crystal}
								class:border-border={!compound.crystal}
								onclick={() => saveCompound({ ...compound, crystal: compound.crystal ? 0 : 1 })}
							>
								{#if compound.crystal}
									<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 8L7 12L13 4" /></svg>
								{/if}
							</button>
							<div class="flex-1 min-w-0">
								<p class="text-xs font-medium text-ink">Crystal Structure (XRD)</p>
								<input type="text" placeholder="Space group, system..."
									value={compound.crystal_notes}
									class="w-full mt-1 bg-cream/60 border border-border/50 rounded px-2 py-0.5 text-[10px] outline-none placeholder:text-muted/30"
									onchange={(e) => saveCompound({ ...compound, crystal_notes: e.currentTarget.value })} />
							</div>
						</div>
					</div>

					<!-- General notes -->
					<div>
						<label class="text-[10px] text-muted block mb-0.5">Notes</label>
						<textarea
							rows="2"
							value={compound.notes}
							placeholder="Observations, appearance, mp/bp..."
							class="w-full bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs outline-none resize-none focus:border-muted placeholder:text-muted/30"
							onchange={(e) => saveCompound({ ...compound, notes: e.currentTarget.value })}
						></textarea>
					</div>

					<!-- Actions -->
					<div class="flex justify-end">
						<button
							class="text-xs text-red-ink hover:bg-red-ink/10 px-3 py-1.5 rounded-lg transition-colors"
							onclick={() => deleteCompound(compound.id)}
						>
							Delete Compound
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/each}

	<!-- Add Compound -->
	{#if showAddForm}
		<div class="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2" transition:fly={{ y: 10, duration: 200 }}>
			<p class="text-xs font-medium text-ink">Register New Compound</p>
			<div class="grid grid-cols-2 gap-2">
				<input type="text" bind:value={newName} placeholder="Name"
					class="bg-cream border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-muted" />
				<input type="text" bind:value={newFormula} placeholder="Formula"
					class="bg-cream border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-muted" />
			</div>
			<div class="grid grid-cols-2 gap-2">
				<input type="number" step="any" bind:value={newMw} placeholder="MW (g/mol)"
					class="bg-cream border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-muted" />
				<select bind:value={newReactionId} class="bg-cream border border-border rounded-lg px-2 py-1.5 text-xs outline-none">
					<option value="">Link to reaction...</option>
					{#each reactions as rx}
						<option value={rx.id}>{rx.name || 'Untitled'}</option>
					{/each}
				</select>
			</div>
			<input type="text" bind:value={newSmiles} placeholder="SMILES (optional)"
				class="w-full bg-cream border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-muted" />
			<div class="flex gap-2">
				<button
					class="flex-1 text-xs py-2 rounded-lg bg-ink text-cream font-medium hover:bg-accent transition-colors"
					onclick={createCompound}
				>Register</button>
				<button
					class="px-4 text-xs py-2 rounded-lg border border-border text-muted hover:text-ink transition-colors"
					onclick={() => (showAddForm = false)}
				>Cancel</button>
			</div>
		</div>
	{:else}
		<button
			class="w-full text-sm py-3 rounded-xl border border-dashed border-border text-muted
				   hover:border-accent hover:text-accent transition-colors"
			onclick={() => (showAddForm = true)}
		>
			+ Register Compound
		</button>
	{/if}
</div>
