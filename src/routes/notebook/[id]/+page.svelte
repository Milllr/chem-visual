<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { Block, ChatMessage, Page } from '$lib/db';
	import { generateId } from '$lib/db';
	import { compressImage } from '$lib/image';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import BlockRenderer from '$lib/components/BlockRenderer.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import MoleculeInput from '$lib/components/MoleculeInput.svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import { fly } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	// State — initialized from server data, then managed client-side
	let pages = $state<Page[]>([]);
	let blocks = $state<Block[]>([]);
	let currentPageId = $state('');
	let chatMessages = $state<ChatMessage[]>([]);

	// Sync from server data on load
	$effect(() => {
		pages = data.pages;
		blocks = data.blocks;
		currentPageId = data.currentPageId;
		chatMessages = data.chatMessages;
	});
	let chatOpen = $state(false);
	let moleculeInputOpen = $state(false);
	let moleculeLoading = $state(false);
	let chatSending = $state(false);
	let fileInput: HTMLInputElement;
	let pageKey = $state(0); // for flip animation

	// Page switching
	async function selectPage(pageId: string) {
		if (pageId === currentPageId) return;
		currentPageId = pageId;
		pageKey++;

		const res = await fetch(`/api/blocks?page_id=${pageId}`);
		if (res.ok) {
			blocks = await res.json();
		}
	}

	// Add page
	async function addPage() {
		const res = await fetch('/api/pages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				notebook_id: data.notebook.id,
				title: `Page ${pages.length + 1}`
			})
		});
		if (res.ok) {
			const page: Page = await res.json();
			pages = [...pages, page];
			await selectPage(page.id);
		}
	}

	// Delete page
	async function deletePage(pageId: string) {
		if (pages.length <= 1) return; // Keep at least one page
		await fetch(`/api/pages/${pageId}`, { method: 'DELETE' });
		pages = pages.filter((p) => p.id !== pageId);
		if (currentPageId === pageId) {
			await selectPage(pages[0].id);
		}
	}

	// Add text block
	async function addTextBlock() {
		const res = await fetch('/api/blocks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				page_id: currentPageId,
				type: 'text',
				content: ''
			})
		});
		if (res.ok) {
			const block: Block = await res.json();
			blocks = [...blocks, block];
			// Scroll to new block after render
			requestAnimationFrame(() => {
				const el = document.getElementById(`block-${block.id}`);
				el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			});
		}
	}

	// Add image block
	async function addImageBlock() {
		fileInput?.click();
	}

	async function handleFileUpload(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			// Compress
			const compressed = await compressImage(file);

			// Upload
			const formData = new FormData();
			formData.append('file', compressed, `photo-${Date.now()}.webp`);
			const uploadRes = await fetch('/api/upload', {
				method: 'POST',
				body: formData
			});

			if (!uploadRes.ok) throw new Error('Upload failed');
			const { url } = await uploadRes.json();

			// Create block
			const res = await fetch('/api/blocks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					page_id: currentPageId,
					type: 'image',
					image_url: url
				})
			});
			if (res.ok) {
				const block: Block = await res.json();
				blocks = [...blocks, block];
			}
		} catch (err) {
			console.error('Image upload error:', err);
		}

		input.value = '';
	}

	// Add molecule block
	async function handleMoleculeSubmit(input: string) {
		moleculeLoading = true;
		try {
			const res = await fetch('/api/smiles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ input })
			});

			if (!res.ok) throw new Error('Could not resolve molecule');
			const { smiles } = await res.json();

			// Create block
			const blockRes = await fetch('/api/blocks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					page_id: currentPageId,
					type: 'molecule',
					content: smiles,
					metadata: { formula: input, smiles }
				})
			});

			if (blockRes.ok) {
				const block: Block = await blockRes.json();
				blocks = [...blocks, block];
				moleculeInputOpen = false;
			}
		} catch (err) {
			console.error('Molecule error:', err);
		}
		moleculeLoading = false;
	}

	// Update block content
	async function updateBlock(blockId: string, content: string) {
		await fetch(`/api/blocks/${blockId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content })
		});
		blocks = blocks.map((b) => (b.id === blockId ? { ...b, content } : b));
	}

	// Delete block
	async function deleteBlock(blockId: string) {
		await fetch(`/api/blocks/${blockId}`, { method: 'DELETE' });
		blocks = blocks.filter((b) => b.id !== blockId);
	}

	// Chat
	async function sendChat(message: string, model: string) {
		chatSending = true;

		// Optimistic user message
		const userMsg: ChatMessage = {
			id: generateId(),
			notebook_id: data.notebook.id,
			role: 'user',
			content: message,
			model,
			created: new Date().toISOString()
		};
		chatMessages = [...chatMessages, userMsg];

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					notebook_id: data.notebook.id,
					message,
					model
				})
			});

			if (res.ok) {
				const assistantMsg = await res.json();
				chatMessages = [
					...chatMessages,
					{
						...assistantMsg,
						notebook_id: data.notebook.id,
						created: new Date().toISOString()
					}
				];
			} else {
				const err = await res.json();
				chatMessages = [
					...chatMessages,
					{
						id: generateId(),
						notebook_id: data.notebook.id,
						role: 'assistant',
						content: `Error: ${err.error || 'Something went wrong'}`,
						model: null,
						created: new Date().toISOString()
					}
				];
			}
		} catch {
			chatMessages = [
				...chatMessages,
				{
					id: generateId(),
					notebook_id: data.notebook.id,
					role: 'assistant',
					content: 'Error: Could not reach the server',
					model: null,
					created: new Date().toISOString()
				}
			];
		}
		chatSending = false;
	}

	// Pin chat response to current page
	async function pinToPage(content: string) {
		const res = await fetch('/api/blocks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				page_id: currentPageId,
				type: 'chat_response',
				content
			})
		});
		if (res.ok) {
			const block: Block = await res.json();
			blocks = [...blocks, block];
		}
	}
</script>

<svelte:head>
	<title>{data.notebook.title} — Chem Journal</title>
</svelte:head>

<!-- Hidden file input for camera/gallery -->
<input
	bind:this={fileInput}
	type="file"
	accept="image/*"
	capture="environment"
	class="hidden"
	onchange={handleFileUpload}
/>

<div class="flex flex-col h-[100dvh] bg-cream">
	<!-- Top bar -->
	<header class="shrink-0 bg-cream/95 backdrop-blur-sm border-b border-border safe-top z-30">
		<div class="flex items-center gap-2.5 px-3 py-2">
			<button
				class="w-8 h-8 flex items-center justify-center rounded-md
					   hover:bg-warm active:bg-warm transition-colors text-muted"
				onclick={() => goto('/')}
				aria-label="Back"
			>
				<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
					<path
						d="M12 4L6 10L12 16"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>

			<div class="flex-1 min-w-0">
				<h1 class="font-heading text-base text-ink truncate">
					<span class="mr-1">{data.notebook.emoji}</span>
					{data.notebook.title}
				</h1>
			</div>
		</div>

		<!-- Page tabs -->
		<PageTabs
			{pages}
			{currentPageId}
			onselect={selectPage}
			onadd={addPage}
			ondelete={deletePage}
		/>
	</header>

	<!-- Page content -->
	<main class="flex-1 overflow-y-auto pb-24">
		{#key pageKey}
			<div class="page-enter max-w-2xl mx-auto px-4 py-4 space-y-3">
				{#if blocks.length === 0}
					<div class="text-center py-16">
						<p class="font-sketch text-base text-muted/40">Empty page</p>
						<p class="text-xs text-muted/30 mt-1">
							Use the toolbar below to add content
						</p>
					</div>
				{/if}

				{#each blocks as block (block.id)}
					<div id="block-{block.id}" in:fly={{ y: 12, duration: 200 }}>
						<BlockRenderer
							{block}
							onupdate={(content) => updateBlock(block.id, content)}
							ondelete={() => deleteBlock(block.id)}
						/>
					</div>
				{/each}
			</div>
		{/key}
	</main>

	<!-- Action bar -->
	<ActionBar
		onaddtext={addTextBlock}
		onaddimage={addImageBlock}
		onaddmolecule={() => (moleculeInputOpen = true)}
		ontoggleChat={() => (chatOpen = !chatOpen)}
		{chatOpen}
	/>
</div>

<!-- Molecule input modal -->
<MoleculeInput
	open={moleculeInputOpen}
	onclose={() => (moleculeInputOpen = false)}
	onsubmit={handleMoleculeSubmit}
	loading={moleculeLoading}
/>

<!-- Chat panel -->
<ChatPanel
	open={chatOpen}
	messages={chatMessages}
	sending={chatSending}
	onclose={() => (chatOpen = false)}
	onsend={sendChat}
	onpin={pinToPage}
/>
