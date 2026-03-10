<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { Block, ChatMessage, Page, Notebook, Reagent, Reaction } from '$lib/db';
	import { generateId } from '$lib/db';
	import { compressImage } from '$lib/image';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import BlockRenderer from '$lib/components/BlockRenderer.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import DrawingCanvas from '$lib/components/DrawingCanvas.svelte';
	import EditNotebookModal from '$lib/components/EditNotebookModal.svelte';
	import MoleculeInput from '$lib/components/MoleculeInput.svelte';
	import PageTabs from '$lib/components/PageTabs.svelte';
	import TableEditor from '$lib/components/TableEditor.svelte';
	import ReagentLibrary from '$lib/components/ReagentLibrary.svelte';
	import { fly } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	// State — initialized from server data, then managed client-side
	let notebook = $state<Notebook>(data.notebook);
	let pages = $state<Page[]>([]);
	let blocks = $state<Block[]>([]);
	let currentPageId = $state('');
	let chatMessages = $state<ChatMessage[]>([]);
	let reagents = $state<Reagent[]>([]);
	let reactions = $state<Reaction[]>([]);
	let editModalOpen = $state(false);
	let libraryOpen = $state(false);

	// Sync from server data on load
	$effect(() => {
		notebook = data.notebook;
		pages = data.pages;
		blocks = data.blocks;
		currentPageId = data.currentPageId;
		chatMessages = data.chatMessages;
		reagents = data.reagents;
		reactions = data.reactions;
	});
	let chatOpen = $state(false);
	let moleculeInputOpen = $state(false);
	let moleculeLoading = $state(false);
	let chatSending = $state(false);
	let fileInput: HTMLInputElement;
	let docInput: HTMLInputElement;
	let dataInput: HTMLInputElement;
	let scanInput: HTMLInputElement;
	let pageKey = $state(0); // for flip animation

	// Scan/digitize state
	let scanning = $state(false);
	let scanPreview = $state<string | null>(null);
	let scanProgress = $state('');
	let scanStepCount = $state(0);
	let scanStepTotal = $state(0);

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
	let editingDrawingBlock = $state<Block | null>(null);

	// Table editor
	let tableMode = $state(false);
	let editingTableBlock = $state<Block | null>(null);

	async function saveDrawing(imageBlob: Blob) {
		const editBlock = editingDrawingBlock;
		drawingMode = false;
		editingDrawingBlock = null;

		try {
			// Upload the drawing image to R2
			const formData = new FormData();
			formData.append('file', imageBlob, `drawing-${Date.now()}.png`);
			const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
			if (!uploadRes.ok) throw new Error('Upload failed');
			const { url } = await uploadRes.json();

			if (editBlock) {
				// Update existing drawing block
				const res = await fetch(`/api/blocks/${editBlock.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ image_url: url })
				});
				if (res.ok) {
					const updated: Block = await res.json();
					blocks = blocks.map(b => b.id === updated.id ? updated : b);
				}
			} else {
				// Create new image block
				const res = await fetch('/api/blocks', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						page_id: currentPageId,
						type: 'image',
						image_url: url,
						metadata: { source: 'drawing' }
					})
				});
				if (res.ok) {
					const block: Block = await res.json();
					blocks = [...blocks, block];
				}
			}
		} catch (err) {
			console.error('Drawing save error:', err);
		}
	}

	function startEditDrawing(block: Block) {
		editingDrawingBlock = block;
		drawingMode = true;
	}

	// Table
	function startEditTable(block: Block) {
		editingTableBlock = block;
		tableMode = true;
	}

	async function saveTable(csvContent: string, metadata: Record<string, string>) {
		const editBlock = editingTableBlock;
		tableMode = false;
		editingTableBlock = null;

		try {
			if (editBlock) {
				// Update existing data block
				const res = await fetch(`/api/blocks/${editBlock.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ content: csvContent, metadata: JSON.stringify(metadata) })
				});
				if (res.ok) {
					const updated: Block = await res.json();
					blocks = blocks.map(b => b.id === updated.id ? updated : b);
				}
			} else {
				// Create new data block
				const res = await fetch('/api/blocks', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						page_id: currentPageId,
						type: 'data',
						content: csvContent,
						metadata
					})
				});
				if (res.ok) {
					const block: Block = await res.json();
					blocks = [...blocks, block];
				}
			}
		} catch (err) {
			console.error('Table save error:', err);
		}
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

	// Document upload handler
	async function handleDocUpload(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const formData = new FormData();
			formData.append('file', file, file.name);
			const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
			if (!uploadRes.ok) throw new Error('Upload failed');
			const { url } = await uploadRes.json();
			const ext = file.name.split('.').pop()?.toUpperCase() || 'DOC';
			const res = await fetch('/api/blocks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					page_id: currentPageId,
					type: 'document',
					content: file.name,
					image_url: url,
					metadata: { fileType: ext, fileSize: file.size }
				})
			});
			if (res.ok) {
				const block: Block = await res.json();
				blocks = [...blocks, block];
			}
		} catch (err) {
			console.error('Document upload error:', err);
		}
		input.value = '';
	}

	// Data upload handler (CSV etc)
	async function handleDataUpload(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const res = await fetch('/api/blocks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					page_id: currentPageId,
					type: 'data',
					content: text,
					metadata: { filename: file.name }
				})
			});
			if (res.ok) {
				const block: Block = await res.json();
				blocks = [...blocks, block];
			}
		} catch (err) {
			console.error('Data upload error:', err);
		}
		input.value = '';
	}

	// Scan Notes — digitize handwritten notes via GPT-4o vision
	async function handleScanUpload(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = '';

		scanning = true;
		scanProgress = 'Reading image...';
		scanStepCount = 0;
		scanStepTotal = 0;

		try {
			// Read file as data URL for vision API
			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});

			scanPreview = dataUrl;
			scanProgress = 'Analyzing notes with AI...';

			// Call digitize API
			const res = await fetch('/api/digitize', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ imageDataUrl: dataUrl })
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || 'Digitization failed');
			}

			const { blocks: digitizedBlocks } = await res.json();

			if (!digitizedBlocks || digitizedBlocks.length === 0) {
				throw new Error('No content detected in image');
			}

			scanStepTotal = digitizedBlocks.length;
			scanProgress = `Creating ${digitizedBlocks.length} blocks...`;

			// Load the original image for cropping
			const img = new Image();
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = reject;
				img.src = dataUrl;
			});

			// Create blocks in order
			for (const db of digitizedBlocks) {
				scanStepCount++;
				scanProgress = `Adding block ${scanStepCount} of ${scanStepTotal}...`;

				if (db.type === 'image' && db.crop) {
					// Crop the region from the original image
					const cropCanvas = document.createElement('canvas');
					const cx = (db.crop.x / 100) * img.width;
					const cy = (db.crop.y / 100) * img.height;
					const cw = (db.crop.w / 100) * img.width;
					const ch = (db.crop.h / 100) * img.height;
					cropCanvas.width = cw;
					cropCanvas.height = ch;
					const cropCtx = cropCanvas.getContext('2d')!;
					cropCtx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);

					// Convert to blob and upload
					const blob = await new Promise<Blob>((resolve) => {
						cropCanvas.toBlob((b) => resolve(b!), 'image/png');
					});
					const formData = new FormData();
					formData.append('file', blob, `scan-crop-${Date.now()}-${scanStepCount}.png`);
					const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
					if (!uploadRes.ok) continue;
					const { url } = await uploadRes.json();

					const blockRes = await fetch('/api/blocks', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							page_id: currentPageId,
							type: 'image',
							image_url: url,
							metadata: { source: 'scan', description: db.description }
						})
					});
					if (blockRes.ok) {
						const block: Block = await blockRes.json();
						blocks = [...blocks, block];
					}
				} else {
					// Text or equation block
					const content = db.content || '';
					if (!content.trim()) continue;
					const blockRes = await fetch('/api/blocks', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							page_id: currentPageId,
							type: 'text',
							content
						})
					});
					if (blockRes.ok) {
						const block: Block = await blockRes.json();
						blocks = [...blocks, block];
					}
				}
			}

			scanProgress = `Done! Added ${scanStepTotal} blocks.`;
			await new Promise(r => setTimeout(r, 1000));
		} catch (err) {
			console.error('Scan error:', err);
			scanProgress = `Error: ${err instanceof Error ? err.message : 'Scan failed'}`;
			await new Promise(r => setTimeout(r, 2000));
		}

		scanning = false;
		scanPreview = null;
		scanProgress = '';
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

<!-- Hidden file inputs -->
<input
	bind:this={fileInput}
	type="file"
	accept="image/*"
	capture="environment"
	class="hidden"
	onchange={handleFileUpload}
/>
<input
	bind:this={docInput}
	type="file"
	accept=".pdf,.doc,.docx,.txt,.md"
	class="hidden"
	onchange={handleDocUpload}
/>
<input
	bind:this={dataInput}
	type="file"
	accept=".csv,.tsv,.json,.xlsx,.xls"
	class="hidden"
	onchange={handleDataUpload}
/>
<input
	bind:this={scanInput}
	type="file"
	accept="image/*"
	capture="environment"
	class="hidden"
	onchange={handleScanUpload}
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
							ondrop={(e) => handleBlockDrop(e, block.id)}						oneditdrawing={() => startEditDrawing(block)}						onedittable={() => startEditTable(block)}						/>
					</div>
				{/each}
			</div>
		{/key}
	</main>

	<!-- Action bar -->
	<ActionBar
		onaddtext={addTextBlock}
		onuploadimage={addImageBlock}
		onuploaddocument={() => docInput?.click()}
		onuploaddata={() => dataInput?.click()}
		onscannotes={() => scanInput?.click()}
		onaddmolecule={() => (moleculeInputOpen = true)}
		onaddtable={() => (tableMode = true)}
		ondraw={() => (drawingMode = true)}
		ontoggleChat={() => (chatOpen = !chatOpen)}
		onopenlibrary={() => (libraryOpen = !libraryOpen)}
		{chatOpen}
		{libraryOpen}
	/>
</div>

<!-- Drawing canvas -->
{#if drawingMode}
	<DrawingCanvas
		onsave={saveDrawing}
		onclose={() => { drawingMode = false; editingDrawingBlock = null; }}
		initialImageUrl={editingDrawingBlock?.image_url || undefined}
	/>
{/if}

<!-- Table editor -->
{#if tableMode}
	<TableEditor
		onsave={saveTable}
		onclose={() => { tableMode = false; editingTableBlock = null; }}
		initialCsv={editingTableBlock?.content || undefined}
		initialMetadata={editingTableBlock?.metadata ? JSON.parse(editingTableBlock.metadata) : undefined}
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

<!-- Reagent library -->
<ReagentLibrary
	open={libraryOpen}
	onclose={() => (libraryOpen = false)}
	notebookId={data.notebook.id}
	{reagents}
	{reactions}
	onreagentschange={(r) => (reagents = r)}
	onreactionschange={(r) => (reactions = r)}
	oninsertblock={async (type, content, metadata) => {
		const res = await fetch('/api/blocks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				page_id: currentPageId,
				type,
				content,
				metadata
			})
		});
		if (res.ok) {
			const block = await res.json();
			blocks = [...blocks, block];
		}
	}}
/>

<!-- Scanning overlay -->
{#if scanning}
	<div class="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center" transition:fly={{ y: 20, duration: 200 }}>
		<div class="bg-card rounded-2xl shadow-xl max-w-sm w-full mx-6 p-6 text-center">
			{#if scanPreview}
				<div class="mb-4 rounded-lg overflow-hidden border border-border">
					<img src={scanPreview} alt="Scanning..." class="w-full max-h-48 object-contain bg-warm/30" />
				</div>
			{/if}
			<div class="flex items-center justify-center gap-3 mb-3">
				<div class="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
				<p class="text-sm font-medium text-ink">Scanning Notes</p>
			</div>
			<p class="text-xs text-muted">{scanProgress}</p>
			{#if scanStepTotal > 0}
				<div class="mt-3 bg-warm rounded-full h-1.5 overflow-hidden">
					<div class="h-full bg-accent rounded-full transition-all duration-300" style="width: {(scanStepCount / scanStepTotal) * 100}%"></div>
				</div>
			{/if}
		</div>
	</div>
{/if}
