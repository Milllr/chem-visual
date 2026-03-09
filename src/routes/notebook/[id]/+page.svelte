<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { Block, ChatMessage, Page, Notebook } from '$lib/db';
	import { generateId } from '$lib/db';
	import { compressImage } from '$lib/image';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import BlockRenderer from '$lib/components/BlockRenderer.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import DrawingCanvas from '$lib/components/DrawingCanvas.svelte';
	import EditNotebookModal from '$lib/components/EditNotebookModal.svelte';
	import MoleculeInput from '$lib/components/MoleculeInput.svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import { fly } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	// State — initialized from server data, then managed client-side
	let notebook = $state<Notebook>(data.notebook);
	let pages = $state<Page[]>([]);
	let blocks = $state<Block[]>([]);
	let currentPageId = $state('');
	let chatMessages = $state<ChatMessage[]>([]);
	let editModalOpen = $state(false);

	// Sync from server data on load
	$effect(() => {
		notebook = data.notebook;
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
	async function sendChat(message: string, model: string, _attachmentNames?: string[], imageDataUrls?: string[]) {
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
					model,
					imageDataUrls: imageDataUrls || []
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

	// Edit notebook
	async function saveNotebookEdit(updates: Partial<Notebook>) {
		const res = await fetch(`/api/notebooks/${data.notebook.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
		if (res.ok) {
			const updated = await res.json();
			notebook = updated;
			editModalOpen = false;
		}
	}

	// Drawing
	let drawingMode = $state(false);
	let savedDrawings = $derived.by(() => {
		const page = pages.find(p => p.id === currentPageId);
		if (!page?.drawings) return { strokes: [], images: [] };
		try {
			const parsed = JSON.parse(page.drawings);
			// Support old format (array of strokes) and new format ({ strokes, images })
			if (Array.isArray(parsed)) return { strokes: parsed, images: [] };
			return { strokes: parsed.strokes || [], images: parsed.images || [] };
		} catch { return { strokes: [], images: [] }; }
	});

	async function saveDrawing(strokes: any[], images: any[]) {
		drawingMode = false;
		const drawingsJson = JSON.stringify({ strokes, images });
		
		// Update server
		await fetch(`/api/pages/${currentPageId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ drawings: drawingsJson })
		});
		
		// Update local state
		pages = pages.map(p => 
			p.id === currentPageId ? { ...p, drawings: drawingsJson } : p
		);
	}

	// Block reordering
	let draggedBlockId = $state<string | null>(null);

	async function moveBlock(blockId: string, direction: 'up' | 'down') {
		const idx = blocks.findIndex(b => b.id === blockId);
		if (idx < 0) return;
		const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
		if (swapIdx < 0 || swapIdx >= blocks.length) return;

		// Swap in local state
		const newBlocks = [...blocks];
		[newBlocks[idx], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[idx]];
		blocks = newBlocks;

		// Persist new sort orders
		await Promise.all([
			fetch(`/api/blocks/${newBlocks[idx].id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sort_order: idx })
			}),
			fetch(`/api/blocks/${newBlocks[swapIdx].id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sort_order: swapIdx })
			})
		]);
	}

	function handleBlockDragStart(e: DragEvent, blockId: string) {
		draggedBlockId = blockId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', blockId);
		}
	}

	function handleBlockDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	async function handleBlockDrop(e: DragEvent, targetBlockId: string) {
		e.preventDefault();
		if (!draggedBlockId || draggedBlockId === targetBlockId) return;

		const fromIdx = blocks.findIndex(b => b.id === draggedBlockId);
		const toIdx = blocks.findIndex(b => b.id === targetBlockId);
		if (fromIdx < 0 || toIdx < 0) return;

		// Reorder
		const newBlocks = [...blocks];
		const [moved] = newBlocks.splice(fromIdx, 1);
		newBlocks.splice(toIdx, 0, moved);
		blocks = newBlocks;
		draggedBlockId = null;

		// Persist all sort orders
		await Promise.all(
			newBlocks.map((b, i) =>
				fetch(`/api/blocks/${b.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sort_order: i })
				})
			)
		);
	}

	// Paste handling (images → image block, text → text block)
	async function handlePaste(e: ClipboardEvent) {
		// Don't intercept paste when focused on a text input
		const active = document.activeElement;
		if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || (active as HTMLElement).isContentEditable)) return;

		const items = e.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (!file) continue;
				try {
					const compressed = await compressImage(file);
					const formData = new FormData();
					formData.append('file', compressed, `paste-${Date.now()}.webp`);
					const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
					if (!uploadRes.ok) continue;
					const { url } = await uploadRes.json();
					const res = await fetch('/api/blocks', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ page_id: currentPageId, type: 'image', image_url: url })
					});
					if (res.ok) {
						const block: Block = await res.json();
						blocks = [...blocks, block];
					}
				} catch (err) {
					console.error('Paste image error:', err);
				}
				return;
			}
		}

		// Text paste → new text block
		const text = e.clipboardData?.getData('text/plain');
		if (text && text.trim()) {
			e.preventDefault();
			const res = await fetch('/api/blocks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ page_id: currentPageId, type: 'text', content: text.trim() })
			});
			if (res.ok) {
				const block: Block = await res.json();
				blocks = [...blocks, block];
			}
		}
	}
</script>

<svelte:head>
	<title>{notebook.title} — Chem Journal</title>
</svelte:head>

<svelte:window onpaste={handlePaste} />

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
					<span class="mr-1">{notebook.emoji}</span>
					{notebook.title}
				</h1>
			</div>

			<!-- Edit notebook button -->
			<button
				class="w-8 h-8 flex items-center justify-center rounded-md
					   hover:bg-warm active:bg-warm transition-colors text-muted"
				onclick={() => (editModalOpen = true)}
				aria-label="Edit notebook"
			>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M11 1.5l3.5 3.5L5 14.5H1.5V11z" />
					<path d="M9.5 3L13 6.5" />
				</svg>
			</button>
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
	<main class="flex-1 overflow-y-auto pb-24 relative">
		{#key pageKey}
			<div class="page-enter max-w-2xl mx-auto px-4 py-4 space-y-3 relative">
				{#if blocks.length === 0}
					<div class="text-center py-16">
						<p class="font-sketch text-base text-muted/40">Empty page</p>
						<p class="text-xs text-muted/30 mt-1">
							Use the toolbar below to add content
						</p>
					</div>
				{/if}

				{#each blocks as block, i (block.id)}
					<div id="block-{block.id}" in:fly={{ y: 12, duration: 200 }}>
						<BlockRenderer
							{block}
							onupdate={(content) => updateBlock(block.id, content)}
							ondelete={() => deleteBlock(block.id)}
							onmoveup={() => moveBlock(block.id, 'up')}
							onmovedown={() => moveBlock(block.id, 'down')}
							isFirst={i === 0}
							isLast={i === blocks.length - 1}
							ondragstart={(e) => handleBlockDragStart(e, block.id)}
							ondragover={handleBlockDragOver}
							ondrop={(e) => handleBlockDrop(e, block.id)}
						/>
					</div>
				{/each}

				<!-- Drawing overlay (shows saved drawings — click to edit) -->
				{#if (savedDrawings.strokes.length > 0 || savedDrawings.images.length > 0) && !drawingMode}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="absolute inset-0 cursor-pointer group/drawing"
						onclick={() => (drawingMode = true)}
					>
						<div class="absolute top-2 right-2 opacity-0 group-hover/drawing:opacity-100 transition-opacity
									bg-warm/80 backdrop-blur-sm text-[11px] text-muted px-2 py-1 rounded-md border border-border/50">
							✏️ Edit drawing
						</div>
						<svg class="w-full h-full" preserveAspectRatio="none">
							{#each savedDrawings.strokes as stroke}
								{#if stroke.points.length >= 2}
									<path
										d={stroke.points.map((p: [number, number], i: number) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ')}
										stroke={stroke.color === 'eraser' ? 'transparent' : stroke.color}
										stroke-width={stroke.width}
										fill="none"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								{/if}
							{/each}
						</svg>
					</div>
				{/if}
			</div>
		{/key}
	</main>

	<!-- Action bar -->
	<ActionBar
		onaddtext={addTextBlock}
		onaddimage={addImageBlock}
		onaddmolecule={() => (moleculeInputOpen = true)}
		ondraw={() => (drawingMode = true)}
		ontoggleChat={() => (chatOpen = !chatOpen)}
		{chatOpen}
	/>
</div>

<!-- Drawing canvas -->
{#if drawingMode}
	<DrawingCanvas
		strokes={savedDrawings.strokes}
		images={savedDrawings.images}
		onsave={saveDrawing}
		onclose={() => (drawingMode = false)}
	/>
{/if}

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

<!-- Edit notebook modal -->
<EditNotebookModal
	open={editModalOpen}
	{notebook}
	onclose={() => (editModalOpen = false)}
	onsave={saveNotebookEdit}
/>
