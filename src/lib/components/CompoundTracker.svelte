<script lang="ts">
	import type { Compound, Reaction, Reagent } from '$lib/db';
	import { NMR_NUCLEI } from '$lib/db';
	import { calcMW, calcExactMass, calcAdducts, calcIHD, formatCharacterization, formatFormula, isSmiles } from '$lib/chem';
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
	let addNucleusOpen = $state<string | null>(null);
	let copiedId = $state<string | null>(null);
	let resolvingName = $state<string | null>(null);

	// New compound form — only name, formula, and optional reaction link
	let newName = $state('');
	let newFormula = $state('');
	let newReactionId = $state('');
	let creatingCompound = $state(false);

	// Auto-calculated MW from formula
	let newMwCalc = $derived(calcMW(newFormula));

	function parseNmr(data: string): Record<string, { have: boolean; notes: string; peaks?: string; solvent?: string; frequency?: string }> {
		try { return JSON.parse(data) || {}; } catch { return {}; }
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

	// Get yield from the linked reaction (not from compound anymore)
	function getLinkedYield(compound: Compound): number {
		if (!compound.reaction_id) return 0;
		const rx = reactions.find(r => r.id === compound.reaction_id);
		return rx?.yield_percent || 0;
	}

	function yieldBadge(pct: number): { text: string; cls: string } {
		if (pct === 0) return { text: '—', cls: 'text-muted/40' };
		if (pct >= 80) return { text: `${pct.toFixed(0)}%`, cls: 'text-green-700 bg-green-700/8' };
		if (pct >= 50) return { text: `${pct.toFixed(0)}%`, cls: 'text-amber-600 bg-amber-600/8' };
		return { text: `${pct.toFixed(0)}%`, cls: 'text-red-ink bg-red-ink/8' };
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

	function copyCharacterization(compound: Compound) {
		const text = formatCharacterization(compound);
		navigator.clipboard.writeText(text);
		copiedId = compound.id;
		setTimeout(() => (copiedId = null), 2000);
	}

	async function resolveNameFromSmiles(compound: Compound) {
		if (!compound.smiles || resolvingName) return;
		resolvingName = compound.id;
		try {
			const res = await fetch('/api/smiles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ input: compound.smiles, mode: 'to_name' })
			});
			if (res.ok) {
				const data = await res.json();
				if (data.name) {
					saveCompound({ ...compound, name: data.name });
				}
			}
		} catch { /* best effort */ }
		resolvingName = null;
	}

	function updateNmrField(compound: Compound, nucleusId: string, field: string, value: string) {
		const nmr = parseNmr(compound.nmr_data);
		if (!nmr[nucleusId]) nmr[nucleusId] = { have: false, notes: '' };
		(nmr[nucleusId] as any)[field] = value;
		saveCompound({ ...compound, nmr_data: JSON.stringify(nmr) });
	}

	async function createCompound() {
		if (creatingCompound) return;
		creatingCompound = true;

		let formula = newFormula.trim();
		let smiles = '';
		let mw = newMwCalc;

		// Check if formula field contains a SMILES string
		if (formula && isSmiles(formula)) {
			// User entered SMILES in formula field — swap it
			smiles = formula;
			formula = ''; // Will try to compute from SMILES below
			mw = 0;
			// Try to get formula from SMILES via API
			try {
				const res = await fetch('/api/smiles', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ input: smiles, mode: 'to_formula' })
				});
				if (res.ok) {
					const data = await res.json();
					if (data.formula) {
						formula = data.formula;
						mw = calcMW(formula);
					}
				}
			} catch { /* best-effort */ }
		} else if (newName.trim() && !smiles) {
			// Try to resolve SMILES from compound name (only if formula isn't SMILES)
			try {
				const res = await fetch('/api/smiles', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ input: newName.trim() })
				});
				if (res.ok) {
					const data = await res.json();
					// Only use if it looks like a valid SMILES (not just the name echoed back)
					if (data.smiles && isSmiles(data.smiles)) {
						smiles = data.smiles;
					}
				}
			} catch { /* SMILES resolution is best-effort */ }
		}

		const defaultNmr = Object.fromEntries(
			['1H', '13C'].map(n => [n, { have: false, notes: '' }])
		);
		const res = await fetch('/api/compounds', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				notebook_id: notebookId,
				name: newName || 'Untitled Compound',
				formula,
				molar_mass: mw,
				smiles,
				reaction_id: newReactionId || null,
				nmr_data: JSON.stringify(defaultNmr)
			})
		});
		if (res.ok) {
			const compound: Compound = await res.json();
			oncompoundschange([...compounds, compound]);
			expandedId = compound.id;
			showAddForm = false;
			newName = ''; newFormula = ''; newReactionId = '';
		}
		creatingCompound = false;
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
		{@const linkedYield = getLinkedYield(compound)}
		{@const yld = yieldBadge(linkedYield)}
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
							{#if linkedYield > 0}
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
							{#if compound.melting_point}
								<span class="px-1 py-0.5 rounded bg-accent/8 text-[9px] font-mono text-accent">mp</span>
							{/if}
							{#if compound.optical_rotation}
								<span class="px-1 py-0.5 rounded bg-accent/8 text-[9px] font-mono text-accent">[α]</span>
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
								<div class="flex gap-1">
									<input type="text" value={compound.name}
										class="flex-1 bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-muted"
										onchange={(e) => saveCompound({ ...compound, name: e.currentTarget.value })} />
									{#if compound.smiles && (!compound.name || compound.name === 'Untitled Compound')}
										<button
											class="px-1.5 rounded-lg border border-border text-[9px] text-accent hover:bg-accent/10 transition-colors shrink-0"
											class:opacity-50={resolvingName === compound.id}
											onclick={() => resolveNameFromSmiles(compound)}
											title="Get IUPAC name from SMILES"
										>{resolvingName === compound.id ? '…' : 'ID'}</button>
									{/if}
								</div>
							</div>
							<div>
								<label class="text-[10px] text-muted block mb-0.5">Formula</label>
								<input type="text" value={compound.formula}
									class="w-full bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-muted"
									onchange={(e) => {
										const newFormula = e.currentTarget.value;
										const mw = calcMW(newFormula);
										saveCompound({ ...compound, formula: newFormula, molar_mass: mw || compound.molar_mass });
									}} />
							</div>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<div>
								<label class="text-[10px] text-muted block mb-0.5">MW (g/mol)</label>
								<p class="text-xs font-mono text-ink bg-warm/30 rounded-lg px-2 py-1.5">{compound.molar_mass || '—'}</p>
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

						<!-- Melting point & Optical rotation -->
						<div class="grid grid-cols-2 gap-2">
							<div>
								<label class="text-[10px] text-muted block mb-0.5">Melting Point (°C)</label>
								<input type="text" value={compound.melting_point || ''}
									placeholder="e.g. 120-122"
									class="w-full bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none placeholder:text-muted/30"
									onchange={(e) => saveCompound({ ...compound, melting_point: e.currentTarget.value })} />
							</div>
							<div>
								<label class="text-[10px] text-muted block mb-0.5">[α]<sub>D</sub></label>
								<input type="text" value={compound.optical_rotation || ''}
									placeholder="e.g. +25.4 (c 1.0, CHCl₃)"
									class="w-full bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none placeholder:text-muted/30"
									onchange={(e) => saveCompound({ ...compound, optical_rotation: e.currentTarget.value })} />
							</div>
						</div>

						{#if compound.smiles}
							<div>
								<label class="text-[10px] text-muted block mb-0.5">SMILES</label>
								<p class="text-[10px] font-mono text-muted/80 bg-warm/30 rounded px-2 py-1 break-all">{compound.smiles}</p>
							</div>
						{/if}

						<!-- Exact Mass & Adducts -->
						{#if compound.formula}
							{@const exactMass = calcExactMass(compound.formula)}
							{@const ihd = calcIHD(compound.formula)}
							{@const adducts = calcAdducts(compound.formula)}
							{#if exactMass > 0}
								<div class="rounded-lg bg-blue-ink/5 border border-blue-ink/15 px-2.5 py-2">
									<div class="flex items-center justify-between">
										<span class="text-[10px] text-muted uppercase tracking-wide">Exact Mass</span>
										<span class="text-xs font-mono font-semibold text-ink">{exactMass.toFixed(4)} Da</span>
									</div>
									{#if ihd !== null}
										<p class="text-[10px] text-muted mt-0.5">IHD = {ihd}</p>
									{/if}
									<div class="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
										{#each adducts.slice(0, 4) as a}
											<div class="flex justify-between text-[10px]">
												<span class="text-muted">{a.label}</span>
												<span class="font-mono text-ink">{a.mz.toFixed(4)}</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/if}

						{#if compound.reaction_id}
							{@const rxYield = getLinkedYield(compound)}
							{#if rxYield > 0}
								{@const badge = yieldBadge(rxYield)}
								<div class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-warm/30">
									<span class="text-[10px] text-muted">Reaction yield:</span>
									<span class="text-xs font-mono font-semibold {badge.cls}">{badge.text}</span>
								</div>
							{/if}
						{/if}
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
							<div class="space-y-3">
								{#each nucleiKeys as nid}
									{@const entry = nmr[nid]}
									{@const nucInfo = NMR_NUCLEI.find(n => n.id === nid)}
									<div class="group">
										<div class="flex items-center gap-2 mb-1">
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
											<div class="flex gap-1 flex-1">
												<input type="text" placeholder="freq" value={entry.frequency || ''}
													class="w-14 bg-cream/60 border border-border/50 rounded px-1.5 py-0.5 text-[10px] font-mono outline-none placeholder:text-muted/30 text-center"
													onchange={(e) => updateNmrField(compound, nid, 'frequency', e.currentTarget.value)} />
												<select value={entry.solvent || ''}
													class="bg-cream/60 border border-border/50 rounded px-1 py-0.5 text-[10px] outline-none flex-1"
													onchange={(e) => updateNmrField(compound, nid, 'solvent', e.currentTarget.value)}>
													<option value="">Solvent…</option>
													<option value="CDCl₃">CDCl₃</option>
													<option value="DMSO-d₆">DMSO-d₆</option>
													<option value="D₂O">D₂O</option>
													<option value="CD₃OD">CD₃OD</option>
													<option value="C₆D₆">C₆D₆</option>
													<option value="CD₂Cl₂">CD₂Cl₂</option>
													<option value="Acetone-d₆">Acetone-d₆</option>
													<option value="THF-d₈">THF-d₈</option>
												</select>
											</div>
											<button
												class="opacity-0 group-hover:opacity-100 text-muted hover:text-red-ink transition-all"
												onclick={() => removeNucleus(compound, nid)}
											>
												<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4L4 12M4 4L12 12" /></svg>
											</button>
										</div>
										<!-- Peak data entry -->
										<div class="ml-7">
											<input
												type="text"
												placeholder="δ peaks (e.g. 7.26, 4.12, 3.80, 1.25)"
												value={entry.peaks || ''}
												class="w-full bg-cream/60 border border-border/50 rounded px-2 py-1 text-[10px] font-mono outline-none focus:border-muted placeholder:text-muted/30"
												onchange={(e) => updateNmrField(compound, nid, 'peaks', e.currentTarget.value)}
											/>
											{#if entry.notes || entry.have}
												<input
													type="text"
													placeholder="Assignment notes…"
													value={entry.notes || ''}
													class="w-full mt-1 bg-cream/60 border border-border/50 rounded px-2 py-0.5 text-[10px] outline-none focus:border-muted placeholder:text-muted/30"
													onchange={(e) => updateNmrNotes(compound, nid, e.currentTarget.value)}
												/>
											{/if}
										</div>
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
					<div class="flex items-center justify-between">
						<button
							class="text-[10px] px-3 py-1.5 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-colors flex items-center gap-1.5"
							onclick={() => copyCharacterization(compound)}
						>
							{#if copiedId === compound.id}
								<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8L7 12L13 4" /></svg>
								Copied!
							{:else}
								<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="8" height="10" rx="1.5"/><path d="M6 4V2.5A1.5 1.5 0 0 1 7.5 1h5A1.5 1.5 0 0 1 14 2.5v7a1.5 1.5 0 0 1-1.5 1.5H11" /></svg>
								Format for Paper
							{/if}
						</button>
						<button
							class="text-xs text-red-ink hover:bg-red-ink/10 px-3 py-1.5 rounded-lg transition-colors"
							onclick={() => deleteCompound(compound.id)}
						>
							Delete
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
				<input type="text" bind:value={newName} placeholder="Compound name"
					class="bg-cream border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-muted" />
				<input type="text" bind:value={newFormula} placeholder="Formula (e.g. C8H10N4O2)"
					class="bg-cream border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-muted" />
			</div>
			<div class="grid grid-cols-2 gap-2">
				{#if newFormula && newMwCalc > 0}
					<div class="flex items-center gap-1.5 px-2 py-1.5 bg-warm/30 rounded-lg">
						<span class="text-[10px] text-muted">MW:</span>
						<span class="text-xs font-mono text-ink">{newMwCalc} g/mol</span>
					</div>
				{:else}
					<div class="px-2 py-1.5 text-[10px] text-muted/40 italic">MW auto-calculated</div>
				{/if}
				<select bind:value={newReactionId} class="bg-cream border border-border rounded-lg px-2 py-1.5 text-xs outline-none">
					<option value="">Link to reaction...</option>
					{#each reactions as rx}
						<option value={rx.id}>{rx.name || 'Untitled'}</option>
					{/each}
				</select>
			</div>
			<div class="flex gap-2">
				<button
					class="flex-1 text-xs py-2 rounded-lg bg-ink text-cream font-medium hover:bg-accent transition-colors
						   disabled:opacity-40"
					onclick={createCompound}
					disabled={creatingCompound || !newName.trim()}
				>{creatingCompound ? 'Creating...' : 'Register'}</button>
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
