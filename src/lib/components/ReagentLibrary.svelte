<script lang="ts">
	import type { Reagent, Reaction, CasCandidate } from '$lib/db';
	import { generateId } from '$lib/db';
	import MoleculeRenderer from './MoleculeRenderer.svelte';
	import CasSearch from './CasSearch.svelte';
	import ReactionFlow from './ReactionFlow.svelte';
	import LabTools from './LabTools.svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		open: boolean;
		onclose: () => void;
		notebookId: string;
		reagents: Reagent[];
		reactions: Reaction[];
		onreagentschange: (reagents: Reagent[]) => void;
		onreactionschange: (reactions: Reaction[]) => void;
		oninsertblock: (type: string, content: string, metadata: Record<string, any>) => void;
	}

	let { open, onclose, notebookId, reagents, reactions, onreagentschange, onreactionschange, oninsertblock }: Props = $props();

	let tab = $state<'reagents' | 'reactions' | 'tools'>('reagents');
	let casSearchOpen = $state(false);
	let selectedReaction = $state<Reaction | null>(null);
	let expandedReagent = $state<string | null>(null);

	// Handle adding a reagent from CAS search
	async function handleAddReagent(candidate: CasCandidate) {
		try {
			const res = await fetch('/api/reagents', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					notebook_id: notebookId,
					cas: candidate.cas,
					name: candidate.name,
					formula: candidate.formula,
					molar_mass: candidate.molar_mass,
					smiles: candidate.smiles,
					density: candidate.density,
					description: candidate.description,
					hazards: JSON.stringify(candidate.hazards),
					metadata: JSON.stringify({
						iupac_name: candidate.iupac_name,
						synonyms: candidate.synonyms,
						source: candidate.source,
						confidence: candidate.confidence,
						cid: candidate.cid
					})
				})
			});
			if (res.ok) {
				const reagent: Reagent = await res.json();
				onreagentschange([...reagents, reagent]);
				casSearchOpen = false;
			}
		} catch (err) {
			console.error('Add reagent error:', err);
		}
	}

	// Delete reagent
	async function deleteReagent(id: string) {
		await fetch(`/api/reagents/${id}`, { method: 'DELETE' });
		onreagentschange(reagents.filter(r => r.id !== id));
	}

	// Create new reaction
	async function createReaction() {
		const res = await fetch('/api/reactions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				notebook_id: notebookId,
				name: 'New Reaction',
				steps: '[]'
			})
		});
		if (res.ok) {
			const reaction: Reaction = await res.json();
			onreactionschange([...reactions, reaction]);
			selectedReaction = reaction;
		}
	}

	// Update reaction
	async function updateReaction(reaction: Reaction) {
		await fetch(`/api/reactions/${reaction.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: reaction.name,
				steps: reaction.steps,
				target_smiles: reaction.target_smiles,
				target_name: reaction.target_name,
				target_mass: reaction.target_mass
			})
		});
		onreactionschange(reactions.map(r => r.id === reaction.id ? reaction : r));
	}

	// Delete reaction
	async function deleteReaction(id: string) {
		await fetch(`/api/reactions/${id}`, { method: 'DELETE' });
		onreactionschange(reactions.filter(r => r.id !== id));
		selectedReaction = null;
	}

	// Parse hazards JSON safely
	function parseHazards(h: string): { code: string; statement: string; pictogram: string }[] {
		try { return JSON.parse(h) || []; } catch { return []; }
	}

	// GHS pictogram label (no emoji)
	function ghsLabel(code: string): string {
		const map: Record<string, string> = {
			'GHS01': 'EXPL', 'GHS02': 'FLAM', 'GHS03': 'OXID', 'GHS04': 'GAS',
			'GHS05': 'CORR', 'GHS06': 'TOXIC', 'GHS07': 'IRRIT', 'GHS08': 'HLTH', 'GHS09': 'ENV'
		};
		return map[code] || code;
	}
</script>

{#if open}
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
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 10H5M5 10L9 6M5 10L9 14" /></svg>
				</button>
				<h2 class="flex-1 font-heading text-base text-ink">Reagent Library</h2>
			</div>

			<!-- Tabs -->
			<div class="flex border-b border-border px-3">
				<button
					class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
					class:border-accent={tab === 'reagents'}
					class:text-ink={tab === 'reagents'}
					class:border-transparent={tab !== 'reagents'}
					class:text-muted={tab !== 'reagents'}
					onclick={() => (tab = 'reagents')}
				>
					Reagents ({reagents.length})
				</button>
				<button
					class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
					class:border-accent={tab === 'reactions'}
					class:text-ink={tab === 'reactions'}
					class:border-transparent={tab !== 'reactions'}
					class:text-muted={tab !== 'reactions'}
					onclick={() => (tab = 'reactions')}
				>
					Reactions ({reactions.length})
				</button>
				<button
					class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
					class:border-accent={tab === 'tools'}
					class:text-ink={tab === 'tools'}
					class:border-transparent={tab !== 'tools'}
					class:text-muted={tab !== 'tools'}
					onclick={() => (tab = 'tools')}
				>
					Tools
				</button>
			</div>
		</header>

		<!-- Content -->
		<main class="flex-1 overflow-y-auto pb-24">
			{#if tab === 'reagents'}
				<!-- Reagents list -->
				<div class="p-4 space-y-3">
					{#if reagents.length === 0}
						<div class="text-center py-12">
						<svg class="w-10 h-10 mx-auto text-muted/20 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l2 4H7l2-4z" /><path d="M7 7v10a3 3 0 003 3h4a3 3 0 003-3V7" /><path d="M10 12h4" /></svg>
							<p class="font-heading text-sm text-muted/60 mb-1">No reagents yet</p>
							<p class="text-xs text-muted/40 mb-4">Search by CAS number to add compounds</p>
						</div>
					{/if}

					{#each reagents as reagent (reagent.id)}
						{@const hazards = parseHazards(reagent.hazards)}
						<div
							class="rounded-xl border border-border bg-card/50 overflow-hidden"
							transition:fly={{ y: 10, duration: 200 }}
						>
							<!-- Card header (always visible) -->
							<button
								class="w-full flex items-start gap-3 p-3 text-left hover:bg-warm/20 transition-colors"
								onclick={() => expandedReagent = expandedReagent === reagent.id ? null : reagent.id}
							>
								{#if reagent.smiles}
									<div class="w-14 h-14 rounded-lg bg-white border border-border/50 shrink-0 overflow-hidden">
										<MoleculeRenderer smiles={reagent.smiles} width={56} height={56} />
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-ink truncate">{reagent.name}</p>
									<p class="text-xs text-muted font-mono">{reagent.cas}</p>
									<div class="flex items-center gap-2 mt-0.5">
										<span class="text-xs text-muted">{reagent.formula}</span>
										<span class="text-[10px] text-muted/60">MW {reagent.molar_mass}</span>
										{#if reagent.density}
											<span class="text-[10px] text-muted/60">d={reagent.density}</span>
										{/if}
									</div>
								</div>
								<svg
									class="w-4 h-4 text-muted shrink-0 mt-1 transition-transform"
									class:rotate-180={expandedReagent === reagent.id}
									viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
								><path d="M4 6L8 10L12 6" /></svg>
							</button>

							<!-- Expanded details -->
							{#if expandedReagent === reagent.id}
								<div class="px-3 pb-3 border-t border-border/50 pt-2 space-y-2" transition:fly={{ y: -5, duration: 150 }}>
									{#if reagent.description}
										<p class="text-xs text-muted leading-relaxed">{reagent.description}</p>
									{/if}

									<!-- Hazards -->
									{#if hazards.length > 0}
										<div>
											<p class="text-[10px] font-medium text-muted mb-1">GHS Hazards</p>
											<div class="flex flex-wrap gap-1">
												{#each hazards as h}
											<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-ink/8 text-[10px] text-red-ink font-mono">
													{ghsLabel(h.pictogram)} · {h.code}
													</span>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Properties -->
									<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
										<div><span class="text-muted">Formula:</span> <span class="text-ink">{reagent.formula}</span></div>
										<div><span class="text-muted">MW:</span> <span class="text-ink">{reagent.molar_mass} g/mol</span></div>
										{#if reagent.density}
											<div><span class="text-muted">Density:</span> <span class="text-ink">{reagent.density} g/mL</span></div>
										{/if}
									</div>

									<div class="flex items-center gap-2 pt-1">
										{#if reagent.smiles}
											<button
												class="text-xs text-accent hover:bg-accent/10 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
												onclick={() => {
													oninsertblock('molecule', reagent.smiles, {
														formula: reagent.name,
														smiles: reagent.smiles,
														cas: reagent.cas,
														molar_mass: reagent.molar_mass
													});
													onclose();
												}}
											>
												<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3V13M3 8H13" /></svg>
												Insert to page
											</button>
										{/if}
										<button
											class="text-xs text-red-ink hover:bg-red-ink/10 px-2 py-1 rounded-lg transition-colors"
											onclick={() => deleteReagent(reagent.id)}
										>
											Remove
										</button>
									</div>
								</div>
							{/if}
						</div>
					{/each}

					<!-- Add reagent button -->
					<button
						class="w-full text-sm py-3 rounded-xl border border-dashed border-border text-muted
							   hover:border-accent hover:text-accent transition-colors"
						onclick={() => (casSearchOpen = true)}
					>
						+ Search by CAS Number
					</button>
				</div>

			{:else if tab === 'reactions'}
				<!-- Reactions list -->
				<div class="p-4 space-y-3">
					{#if reactions.length === 0}
						<div class="text-center py-12">
						<svg class="w-10 h-10 mx-auto text-muted/20 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16" /><path d="M6 20V10l3-7h6l3 7v10" /><path d="M6 10h12" /><circle cx="12" cy="15" r="2" /></svg>
							<p class="font-heading text-sm text-muted/60 mb-1">No reactions yet</p>
							<p class="text-xs text-muted/40 mb-4">Create a reaction to plan your synthesis</p>
						</div>
					{/if}

					{#each reactions as reaction (reaction.id)}
						{@const stepCount = (() => { try { return JSON.parse(reaction.steps || '[]').length; } catch { return 0; } })()}
						<button
							class="w-full text-left rounded-xl border border-border bg-card/50 p-3
								   hover:bg-warm/20 transition-colors"
							onclick={() => (selectedReaction = reaction)}
							transition:fly={{ y: 10, duration: 200 }}
						>
							<p class="text-sm font-medium text-ink">{reaction.name || 'Untitled Reaction'}</p>
							<p class="text-xs text-muted mt-0.5">{stepCount} step{stepCount !== 1 ? 's' : ''}</p>
						</button>
					{/each}

					<!-- Add reaction button -->
					<button
						class="w-full text-sm py-3 rounded-xl border border-dashed border-border text-muted
							   hover:border-accent hover:text-accent transition-colors"
						onclick={createReaction}
					>
						+ New Reaction
					</button>
				</div>

			{:else if tab === 'tools'}
				<LabTools />
			{/if}
		</main>
	</div>
{/if}

<!-- CAS Search modal -->
<CasSearch
	open={casSearchOpen}
	onclose={() => (casSearchOpen = false)}
	onadd={handleAddReagent}
/>

<!-- Reaction flow editor -->
{#if selectedReaction}
	{@const reactionId = selectedReaction.id}
	<ReactionFlow
		reaction={selectedReaction}
		{reagents}
		onupdate={(r) => { updateReaction(r); selectedReaction = r; }}
		ondelete={() => { selectedReaction = null; deleteReaction(reactionId); }}
		onclose={() => (selectedReaction = null)}
	/>
{/if}
