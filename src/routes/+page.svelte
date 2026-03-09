<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { Notebook } from '$lib/db';
	import NotebookCard from '$lib/components/NotebookCard.svelte';
	import NewNotebookModal from '$lib/components/NewNotebookModal.svelte';
	import MethLogo from '$lib/components/MethLogo.svelte';

	let { data }: { data: PageData } = $props();
	let notebooks = $state<Notebook[]>(data.notebooks);
	let showNewModal = $state(false);

	async function createNotebook(info: {
		title: string;
		description: string;
		color: string;
		emoji: string;
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

	function openNotebook(id: string) {
		goto(`/notebook/${id}`);
	}
</script>

<svelte:head>
	<title>Chem Journal</title>
</svelte:head>

<div class="max-w-xl mx-auto px-5 pt-8 pb-8 safe-top">
	<!-- Header -->
	<header class="flex items-center justify-between mb-8">
		<div>
			<h1 class="font-heading text-xl text-ink flex items-center gap-3">
				<span class="text-accent"><MethLogo size={40} /></span>
				<span>Chem Journal</span>
			</h1>
			<p class="text-xs text-muted mt-0.5">Lab notebooks</p>
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
	</header>

	<!-- Notebooks grid -->
	{#if notebooks.length > 0}
		<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
			{#each notebooks as notebook (notebook.id)}
				<NotebookCard {notebook} onclick={() => openNotebook(notebook.id)} />
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
