<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import type { Notebook } from '$lib/db';
	import NotebookCard from '$lib/components/NotebookCard.svelte';
	import NewNotebookModal from '$lib/components/NewNotebookModal.svelte';
	import EditNotebookModal from '$lib/components/EditNotebookModal.svelte';
	import MethLogo from '$lib/components/MethLogo.svelte';

	let { data }: { data: PageData } = $props();
	let notebooks = $state<Notebook[]>(data.notebooks);
	let showNewModal = $state(false);
	let editingNotebook = $state<Notebook | null>(null);
	let nextSteps = $state<{ notebook_id: string; notebook_title: string; step: string }[]>([]);
	let loadingSteps = $state(false);
	let stepsError = $state('');

	// Reagent search state
	let reagentQuery = $state('');
	let reagentResults = $state<{ notebook_id: string; notebook_title: string; notebook_emoji: string; reagents: { id: string; name: string; cas: string; formula: string }[] }[]>([]);
	let reagentSearching = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout>;

	function handleReagentSearch() {
		clearTimeout(searchTimeout);
		if (!reagentQuery.trim()) { reagentResults = []; return; }
		searchTimeout = setTimeout(async () => {
			reagentSearching = true;
			try {
				const res = await fetch(`/api/reagents/search?q=${encodeURIComponent(reagentQuery.trim())}`);
				if (res.ok) {
					const data = await res.json();
					reagentResults = data.groups || [];
				}
			} catch { /* ignore */ }
			reagentSearching = false;
		}, 300);
	}

	function getGreeting(): string {
		const hour = new Date().getHours();
		if (hour < 5) return 'Burning the midnight oil';
		if (hour < 12) return 'Good morning';
		if (hour < 17) return 'Good afternoon';
		if (hour < 21) return 'Good evening';
		return 'Late night lab work';
	}

	let greeting = $state(getGreeting());

	onMount(async () => {
		// Load next steps (stored or fresh)
		const tracked = notebooks.filter(n => n.tracked !== 0);
		if (tracked.length > 0) {
			loadingSteps = true;
			try {
				const res = await fetch('/api/next-steps', { method: 'POST' });
				if (res.ok) {
					const result = await res.json();
					nextSteps = result.steps || [];
					if (result.error) stepsError = result.error;
				} else {
					stepsError = `API returned ${res.status}`;
				}
			} catch (e) {
				stepsError = String(e);
			}
			loadingSteps = false;
		}
	});

	async function createNotebook(info: {
		title: string;
		description: string;
		color: string;
		emoji: string;
		goal: string;
		tracked: number;
	}) {
		const res = await fetch('/api/notebooks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(info)
		});
		if (res.ok) {
			const nb: Notebook = await res.json();
			notebooks = [nb, ...notebooks];
			showNewModal = false;
			goto(`/notebook/${nb.id}`);
		}
	}

	async function saveNotebookEdit(updates: Partial<Notebook>) {
		if (!editingNotebook) return;
		const res = await fetch(`/api/notebooks/${editingNotebook.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
		if (res.ok) {
			const updated: Notebook = await res.json();
			notebooks = notebooks.map(n => n.id === updated.id ? updated : n);
			editingNotebook = null;
		}
	}

	async function deleteNotebook(id: string) {
		const res = await fetch(`/api/notebooks/${id}`, { method: 'DELETE' });
		if (res.ok) {
			notebooks = notebooks.filter((n) => n.id !== id);
		}
	}

	function openNotebook(id: string) {
		goto(`/notebook/${id}`);
	}
</script>

<svelte:head>
	<title>Chem Journal</title>
</svelte:head>

<div class="max-w-xl mx-auto px-5 pt-8 pb-8 safe-top">
	<!-- Header with greeting -->
	<header class="mb-6">
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-3">
				<span class="text-accent"><MethLogo size={40} /></span>
				<div>
					<h1 class="font-heading text-xl text-ink">Chem Journal</h1>
					<p class="text-xs text-muted mt-0.5">{greeting}</p>
				</div>
			</div>
			<button
				class="w-8 h-8 rounded-md border border-dashed border-border flex items-center justify-center
					   text-sm text-muted hover:border-accent hover:text-accent
					   active:scale-95 transition-all"
				onclick={() => (showNewModal = true)}
				aria-label="New notebook"
			>
				+
			</button>
		</div>
	</header>

	<!-- Reagent search -->
	<div class="mb-5">
		<div class="relative">
			<input
				type="text"
				bind:value={reagentQuery}
				oninput={handleReagentSearch}
				placeholder="Search reagents across notebooks..."
				class="w-full bg-warm/50 border border-border rounded-xl px-3 py-2.5 pl-9 text-sm
					   outline-none placeholder:text-muted/40 focus:border-accent transition-colors"
			/>
			<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
				<circle cx="9" cy="9" r="5.5" /><path d="M13 13L17 17" />
			</svg>
			{#if reagentSearching}
				<div class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
			{/if}
		</div>

		{#if reagentResults.length > 0}
			<div class="mt-2 space-y-2">
				{#each reagentResults as group}
					<div class="rounded-lg border border-border bg-card/50 overflow-hidden">
						<button
							class="w-full flex items-center gap-2 px-3 py-2 bg-warm/20 hover:bg-warm/40 transition-colors text-left"
							onclick={() => openNotebook(group.notebook_id)}
						>
							<span class="text-sm">{group.notebook_emoji}</span>
							<span class="text-xs font-medium text-ink">{group.notebook_title}</span>
						</button>
						{#each group.reagents as r}
							<div class="flex items-center gap-3 px-3 py-1.5 border-t border-border/50">
								<span class="text-xs text-ink flex-1 truncate">{r.name}</span>
								<span class="text-[10px] font-mono text-muted">{r.cas}</span>
								<span class="text-[10px] text-muted">{r.formula}</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{:else if reagentQuery.trim() && !reagentSearching}
			<p class="text-xs text-muted/60 mt-2 text-center">No reagents found</p>
		{/if}
	</div>

	<!-- Next steps section (for tracked notebooks) -->
	{#if loadingSteps}
		<div class="mb-6 rounded-lg border border-dashed border-border p-4 bg-warm/20">
			<p class="text-xs text-muted animate-pulse">Loading suggested next steps...</p>
		</div>
	{:else if stepsError}
		<div class="mb-6 rounded-lg border border-dashed border-red-ink/30 p-3 bg-red-ink/5">
			<p class="text-xs text-red-ink">Next steps error: {stepsError}</p>
		</div>
	{:else if nextSteps.length > 0}
		<div class="mb-6">
			<h2 class="font-heading text-sm text-muted mb-2">Next Steps</h2>
			<div class="space-y-2">
				{#each nextSteps as ns}
					<button
						class="w-full text-left rounded-lg border border-dashed border-border p-3
							   bg-warm/20 hover:bg-warm/40 active:bg-warm transition-colors"
						onclick={() => {
							const nb = notebooks.find(n => n.title === ns.notebook_title || n.id === ns.notebook_id);
							if (nb) openNotebook(nb.id);
						}}
					>
						<p class="text-xs text-muted mb-0.5">{ns.notebook_title}</p>
						<p class="text-sm text-ink">{ns.step}</p>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Notebooks grid -->
	{#if notebooks.length > 0}
		<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
			{#each notebooks as nb (nb.id)}
				<NotebookCard
					notebook={nb}
					onclick={() => openNotebook(nb.id)}
					ondelete={() => deleteNotebook(nb.id)}
					onedit={() => (editingNotebook = nb)}
				/>
			{/each}
		</div>
	{:else}
		<!-- Empty state -->
		<div class="text-center py-20">
			<p class="text-2xl mb-4 text-muted/30 font-heading">—</p>
			<p class="font-heading text-lg text-muted/60 mb-1">No notebooks yet</p>
			<p class="text-xs text-muted/40 mb-6">
				Create your first lab notebook to get started
			</p>
			<button
				class="text-sm px-5 py-2 rounded-lg border border-dashed border-border
					   text-muted hover:border-accent hover:text-accent transition-colors"
				onclick={() => (showNewModal = true)}
			>
				+ New Notebook
			</button>
		</div>
	{/if}
</div>

<!-- New notebook modal -->
<NewNotebookModal
	open={showNewModal}
	onclose={() => (showNewModal = false)}
	oncreate={createNotebook}
/>

<!-- Edit notebook modal (from home screen) -->
{#if editingNotebook}
	<EditNotebookModal
		open={true}
		notebook={editingNotebook}
		onclose={() => (editingNotebook = null)}
		onsave={saveNotebookEdit}
	/>
{/if}
