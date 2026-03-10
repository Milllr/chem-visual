<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import type { Notebook } from '$lib/db';
	import NotebookCard from '$lib/components/NotebookCard.svelte';
	import NewNotebookModal from '$lib/components/NewNotebookModal.svelte';
	import EditNotebookModal from '$lib/components/EditNotebookModal.svelte';
	import MethLogo from '$lib/components/MethLogo.svelte';
	import SpotlightSearch from '$lib/components/SpotlightSearch.svelte';

	let { data }: { data: PageData } = $props();
	let notebooks = $state<Notebook[]>(data.notebooks);
	let showNewModal = $state(false);
	let editingNotebook = $state<Notebook | null>(null);
	let nextSteps = $state<{ notebook_id: string; notebook_title: string; step: string }[]>([]);
	let loadingSteps = $state(false);
	let stepsError = $state('');
	let searchOpen = $state(false);

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

	<!-- Search bar (opens Spotlight) -->
	<div class="mb-5">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex items-center gap-3 w-full bg-warm/50 border border-border rounded-xl px-3 py-2.5 cursor-pointer
				   hover:border-muted/50 transition-colors"
			onclick={() => (searchOpen = true)}
			onkeydown={(e) => { if (e.key === 'Enter') searchOpen = true; }}
			role="button"
			tabindex="0"
		>
			<svg class="w-4 h-4 text-muted shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
				<circle cx="9" cy="9" r="5.5" /><path d="M13 13L17 17" />
			</svg>
			<span class="text-sm text-muted/40 flex-1">Search everything…</span>
			<kbd class="text-[10px] text-muted/40 bg-warm/60 border border-border/50 rounded px-1.5 py-0.5 font-mono hidden sm:inline">⌘K</kbd>
		</div>
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

<SpotlightSearch
	open={searchOpen}
	onclose={() => (searchOpen = false)}
/>

<svelte:window onkeydown={(e) => {
	if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
		e.preventDefault();
		searchOpen = !searchOpen;
	}
}} />
