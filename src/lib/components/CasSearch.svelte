<script lang="ts">
	import type { CasCandidate } from '$lib/db';
	import MoleculeRenderer from './MoleculeRenderer.svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		open: boolean;
		onclose: () => void;
		onadd: (candidate: CasCandidate) => void;
	}

	let { open, onclose, onadd }: Props = $props();
	let cas = $state('');
	let loading = $state(false);
	let error = $state('');
	let candidates = $state<CasCandidate[]>([]);
	let searched = $state(false);

	async function handleSearch() {
		const trimmed = cas.trim();
		if (!trimmed) return;
		loading = true;
		error = '';
		candidates = [];
		searched = false;

		try {
			const res = await fetch('/api/cas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cas: trimmed })
			});

			if (!res.ok) {
				const err = await res.json();
				error = err.error || 'Lookup failed';
			} else {
				const data = await res.json();
				candidates = data.candidates || [];
				if (candidates.length === 0) {
					error = 'No compounds found for this CAS number';
				}
			}
		} catch {
			error = 'Network error';
		}

		loading = false;
		searched = true;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
		if (e.key === 'Escape') onclose();
	}

	function handleAdd(c: CasCandidate) {
		onadd(c);
		// Reset for next search
		cas = '';
		candidates = [];
		searched = false;
	}

	function ghsPictogramLabel(code: string): string {
		const map: Record<string, string> = {
			GHS01: 'EXPL', GHS02: 'FLAM', GHS03: 'OXID', GHS04: 'GAS',
			GHS05: 'CORR', GHS06: 'TOXIC', GHS07: 'IRRIT', GHS08: 'HLTH', GHS09: 'ENV'
		};
		return map[code] || code;
	}

	function ghsPictogramName(code: string): string {
		const map: Record<string, string> = {
			GHS01: 'Explosive', GHS02: 'Flammable', GHS03: 'Oxidizer', GHS04: 'Compressed Gas',
			GHS05: 'Corrosive', GHS06: 'Toxic', GHS07: 'Irritant', GHS08: 'Health Hazard', GHS09: 'Environmental'
		};
		return map[code] || code;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" onclick={onclose} onkeydown={() => {}}></div>

	<div
		class="fixed inset-x-3 top-[8dvh] bottom-[8dvh] z-50 mx-auto max-w-lg bg-cream rounded-2xl
			   shadow-xl border border-border overflow-hidden flex flex-col"
		transition:fly={{ y: 30, duration: 200 }}
	>
		<!-- Header -->
		<div class="px-5 pt-5 pb-3 shrink-0">
			<div class="flex items-center justify-between mb-1">
				<h2 class="font-heading text-lg text-ink">Search by CAS Number</h2>
				<button class="text-muted hover:text-ink transition-colors" onclick={onclose}>
					<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5L5 15M5 5L15 15" /></svg>
				</button>
			</div>
			<p class="text-xs text-muted">Enter a 9-digit CAS registry number (e.g. 64-17-5 for ethanol)</p>

			<!-- Search bar -->
			<div class="flex gap-2 mt-3">
				<input
					type="text"
					class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-2.5 text-sm
						   outline-none placeholder:text-muted/40 focus:border-muted transition-colors
						   font-mono tracking-wider"
					placeholder="XXXXXXX-XX-X"
					bind:value={cas}
					onkeydown={handleKeydown}
					autofocus
				/>
				<button
					class="px-4 py-2 rounded-lg bg-accent text-cream text-sm font-medium
						   active:scale-95 transition-transform disabled:opacity-40"
					onclick={handleSearch}
					disabled={!cas.trim() || loading}
				>
					{loading ? '...' : 'Search'}
				</button>
			</div>
		</div>

		<!-- Results -->
		<div class="flex-1 overflow-y-auto px-5 pb-5">
			{#if loading}
				<div class="text-center py-12">
					<div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
					<p class="text-sm text-muted">Searching PubChem...</p>
					<p class="text-xs text-muted/60 mt-1">This may take a few seconds</p>
				</div>
			{:else if error}
				<div class="text-center py-8">
					<p class="text-sm text-red-ink">{error}</p>
				</div>
			{:else if candidates.length > 0}
				<div class="space-y-3">
					{#if candidates.length > 1}
						<p class="text-xs text-muted">{candidates.length} compounds found — select one to add:</p>
					{/if}

					{#each candidates as c, i}
						<div class="rounded-xl border border-border bg-card/50 overflow-hidden" transition:fly={{ y: 10, delay: i * 50, duration: 200 }}>
							<!-- Structure + info -->
							<div class="p-3">
								<div class="flex gap-3">
									<!-- Molecule preview -->
									{#if c.smiles}
										<div class="w-24 h-20 shrink-0 rounded-lg bg-white border border-border/50 overflow-hidden">
											<MoleculeRenderer smiles={c.smiles} width={120} height={100} />
										</div>
									{/if}

									<div class="flex-1 min-w-0">
										<h3 class="text-sm font-semibold text-ink truncate">{c.name}</h3>
										<p class="text-xs text-muted font-mono mt-0.5">CAS {c.cas}</p>
										<div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
											{#if c.formula}
												<span class="text-xs text-muted"><b>Formula:</b> {c.formula}</span>
											{/if}
											{#if c.molar_mass}
												<span class="text-xs text-muted"><b>MW:</b> {c.molar_mass.toFixed(2)} g/mol</span>
											{/if}
											{#if c.density}
												<span class="text-xs text-muted"><b>ρ:</b> {c.density} g/cm³</span>
											{/if}
										</div>
									</div>
								</div>

								{#if c.description}
									<p class="text-xs text-muted mt-2 leading-relaxed">{c.description}</p>
								{/if}

								{#if c.iupac_name && c.iupac_name !== c.name}
									<p class="text-[10px] text-muted/60 mt-1 italic truncate">IUPAC: {c.iupac_name}</p>
								{/if}

								<!-- GHS Hazards -->
								{#if c.hazards && c.hazards.length > 0}
									{@const uniquePictograms = [...new Set(c.hazards.map(h => h.pictogram).filter(Boolean))]}
									<div class="mt-2 flex flex-wrap gap-1.5">
										{#each uniquePictograms as pic}
											<span
												class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-ink/10
													   text-[10px] text-red-ink border border-red-ink/20"
												title={ghsPictogramName(pic)}
											>
												{ghsPictogramLabel(pic)} {ghsPictogramName(pic)}
											</span>
										{/each}
									</div>
								{/if}

								<!-- AI confidence badge -->
								{#if c.source === 'ai'}
									<div class="mt-2 flex items-center gap-1.5">
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-ink/10
												 text-[10px] text-blue-ink border border-blue-ink/20 font-mono">
										AI-estimated
											{#if c.confidence}
												· {c.confidence} confidence
											{/if}
										</span>
									</div>
								{/if}
							</div>

							<!-- Add button -->
							<button
								class="w-full px-3 py-2 bg-warm/30 border-t border-border text-sm text-accent
									   font-medium hover:bg-warm transition-colors active:scale-[0.99]
									   flex items-center justify-center gap-2"
								onclick={() => handleAdd(c)}
							>
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3V13M3 8H13" /></svg>
								Add to Library
							</button>
						</div>
					{/each}
				</div>
			{:else if searched}
				<div class="text-center py-8">
					<p class="text-sm text-muted">No results</p>
				</div>
			{:else}
				<div class="text-center py-8 space-y-2">
					<svg class="w-8 h-8 mx-auto text-muted/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M16 16L21 21" /></svg>
					<p class="text-xs text-muted/40">Search a CAS number to find compound details</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
