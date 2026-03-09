<script lang="ts">
	import { tick } from 'svelte';
	import { marked } from 'marked';
	import type { Block } from '$lib/db';
	import MoleculeRenderer from './MoleculeRenderer.svelte';

	interface Props {
		block: Block;
		onupdate: (content: string) => void;
		ondelete: () => void;
		onmoveup?: () => void;
		onmovedown?: () => void;
		isFirst?: boolean;
		isLast?: boolean;
		ondragstart?: (e: DragEvent) => void;
		ondragover?: (e: DragEvent) => void;
		ondrop?: (e: DragEvent) => void;
		oneditdrawing?: () => void;
	}

	let { block, onupdate, ondelete, onmoveup, onmovedown, isFirst = false, isLast = false, ondragstart, ondragover, ondrop, oneditdrawing }: Props = $props();
	let editing = $state(false);
	let editContent = $state(block.content || '');
	let showDelete = $state(false);
	let saveTimer: ReturnType<typeof setTimeout>;
	let textareaEl: HTMLTextAreaElement | undefined = $state();

	// Configure marked for safe inline rendering
	marked.setOptions({ breaks: true, gfm: true });

	// Keep editContent in sync if block changes externally
	$effect(() => {
		if (!editing) {
			editContent = block.content || '';
		}
	});

	// Auto-resize textarea whenever editContent changes or we enter edit mode
	function autoResize() {
		if (textareaEl) {
			textareaEl.style.height = 'auto';
			textareaEl.style.height = textareaEl.scrollHeight + 'px';
		}
	}

	$effect(() => {
		if (editing && textareaEl) {
			textareaEl.focus();
			autoResize();
		}
	});

	function handleInput() {
		editing = true;
		autoResize();

		// Debounced save
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => onupdate(editContent), 1500);
	}

	function handleBlur() {
		clearTimeout(saveTimer);
		// Trim trailing whitespace/newlines
		const trimmed = editContent.replace(/\s+$/, '');
		if (trimmed !== editContent) {
			editContent = trimmed;
		}
		// Always save current content
		if (editContent !== block.content) {
			onupdate(editContent);
		}
		// Only delete if user has intentionally cleared a block that had content
		if (block.type === 'text' && !editContent.trim() && block.content && block.content.trim()) {
			ondelete();
		}
		editing = false;
	}

	async function startEdit() {
		if (block.type === 'text') {
			editContent = block.content || '';
			editing = true;
			await tick();
			autoResize();
		}
	}

	function getMetadata(): Record<string, string> {
		try {
			return block.metadata ? JSON.parse(block.metadata) : {};
		} catch {
			return {};
		}
	}

	function renderMarkdown(text: string): string {
		return marked.parse(text, { async: false }) as string;
	}

	function parseCsv(text: string): string[][] {
		const delimiter = text.includes('\t') ? '\t' : ',';
		const rows: string[][] = [];
		let current = '';
		let inQuotes = false;
		let cells: string[] = [];

		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			if (inQuotes) {
				if (char === '"' && text[i + 1] === '"') {
					current += '"';
					i++;
				} else if (char === '"') {
					inQuotes = false;
				} else {
					current += char;
				}
			} else {
				if (char === '"') {
					inQuotes = true;
				} else if (char === delimiter) {
					cells.push(current);
					current = '';
				} else if (char === '\n' || (char === '\r' && text[i + 1] === '\n')) {
					cells.push(current);
					if (cells.some(c => c.trim())) rows.push(cells);
					cells = [];
					current = '';
					if (char === '\r') i++;
				} else {
					current += char;
				}
			}
		}
		cells.push(current);
		if (cells.some(c => c.trim())) rows.push(cells);

		return rows;
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / 1048576).toFixed(1) + ' MB';
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="group relative flex items-start gap-0 rounded-md border border-transparent
		   hover:border-border/40 transition-colors"
	draggable="true"
	ondragstart={ondragstart}
	ondragover={ondragover}
	ondrop={ondrop}
	onpointerdown={() => (showDelete = true)}
	onpointerup={() => setTimeout(() => (showDelete = false), 2000)}
>
	<!-- Drag handle + reorder buttons (visible on hover) -->
	<div class="shrink-0 w-6 flex flex-col items-center pt-1 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
		{#if onmoveup && !isFirst}
			<button
				class="w-5 h-4 flex items-center justify-center text-muted hover:text-ink"
				onclick={(e) => { e.stopPropagation(); onmoveup?.(); }}
				aria-label="Move up"
			>
				<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 5L5 1L9 5" /></svg>
			</button>
		{/if}
		<!-- Grip dots -->
		<div class="flex flex-col gap-[2px] py-0.5">
			<div class="flex gap-[2px]"><span class="w-[3px] h-[3px] rounded-full bg-current"></span><span class="w-[3px] h-[3px] rounded-full bg-current"></span></div>
			<div class="flex gap-[2px]"><span class="w-[3px] h-[3px] rounded-full bg-current"></span><span class="w-[3px] h-[3px] rounded-full bg-current"></span></div>
			<div class="flex gap-[2px]"><span class="w-[3px] h-[3px] rounded-full bg-current"></span><span class="w-[3px] h-[3px] rounded-full bg-current"></span></div>
		</div>
		{#if onmovedown && !isLast}
			<button
				class="w-5 h-4 flex items-center justify-center text-muted hover:text-ink"
				onclick={(e) => { e.stopPropagation(); onmovedown?.(); }}
				aria-label="Move down"
			>
				<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1L5 5L9 1" /></svg>
			</button>
		{/if}
	</div>

	<!-- Block content -->
	<div class="flex-1 min-w-0 relative">
		<!-- Delete button (visible on hover/touch) -->
		{#if showDelete}
			<button
				class="absolute -right-2 -top-2 w-7 h-7 bg-red-ink text-white rounded-full
					   text-xs flex items-center justify-center z-10 shadow-sm
					   active:scale-90 transition-transform"
				onclick={(e) => { e.stopPropagation(); ondelete(); }}
			>
				✕
			</button>
		{/if}

	<!-- Text block -->
	{#if block.type === 'text'}
		{#if editing || !block.content?.trim()}
			<textarea
				bind:this={textareaEl}
				bind:value={editContent}
				class="w-full bg-transparent text-ink
					   resize-none outline-none paper-lines px-1"
				oninput={handleInput}
				onblur={handleBlur}
				placeholder="Write something..."
				rows={editContent.trim() ? 1 : 5}
			></textarea>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="prose-chat text-sm text-ink px-1 cursor-text"
				onclick={(e) => { if (!(e.target as HTMLElement).closest('a')) startEdit(); }}
			>
				{@html renderMarkdown(block.content || '')}
			</div>
		{/if}

	<!-- Image block -->
	{:else if block.type === 'image'}
		{@const isDrawing = getMetadata().source === 'drawing'}
		<div class="rounded-lg overflow-hidden border border-dashed border-border {isDrawing ? 'bg-white' : ''} relative">
			<img
				src={block.image_url}
				alt={isDrawing ? 'Drawing' : 'Lab photo'}
				class="w-full h-auto {isDrawing ? 'object-contain' : 'max-h-[300px] object-cover'}"
				loading="lazy"
			/>
			{#if isDrawing && oneditdrawing}
				<button
					class="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-cream/90 border border-border
						   text-[11px] text-muted hover:text-ink hover:bg-cream transition-colors
						   opacity-0 group-hover:opacity-100 active:scale-95"
					onclick={(e) => { e.stopPropagation(); oneditdrawing?.(); }}
				>
					Edit Drawing
				</button>
			{/if}
			{#if block.content}
				<p class="text-xs text-muted px-2 py-1.5 bg-warm/30 italic">
					{block.content}
				</p>
			{/if}
		</div>

	<!-- Molecule block -->
	{:else if block.type === 'molecule'}
		<div class="rounded-lg border border-dashed border-border p-3 text-center bg-cream">
			<MoleculeRenderer smiles={block.content || ''} />
			<p class="text-[11px] text-muted mt-1.5 font-sketch">
				{getMetadata().formula || block.content}
			</p>
		</div>

	<!-- Chat response block -->
	{:else if block.type === 'chat_response'}
		<div class="rounded-lg border border-dashed border-border px-3.5 py-2.5 bg-warm/30">
			<div class="flex items-center gap-1.5 mb-1.5">
				<svg class="w-3 h-3 text-muted" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="2.5" /></svg>
				<span class="text-[11px] text-muted">AI Response</span>
			</div>
			{#if block.content?.startsWith('Q: ')}
				{@const parts = block.content.split('\n\n')}
				{@const question = parts[0].replace(/^Q: /, '')}
				{@const answer = parts.slice(1).join('\n\n')}
				<p class="text-[11px] text-muted italic mb-1.5 pb-1.5 border-b border-border/30">{question}</p>
				<div class="prose-chat text-sm text-ink leading-relaxed">
					{@html renderMarkdown(answer)}
				</div>
			{:else}
				<div class="prose-chat text-sm text-ink leading-relaxed">
					{@html renderMarkdown(block.content || '')}
				</div>
			{/if}
		</div>

	<!-- Document block -->
	{:else if block.type === 'document'}
		{@const meta = getMetadata()}
		<a
			href={block.image_url}
			target="_blank"
			rel="noopener"
			class="flex items-center gap-3 rounded-lg border border-dashed border-border p-3
				   bg-warm/20 hover:bg-warm/40 transition-colors no-underline group/doc"
		>
			<div class="w-10 h-12 rounded bg-cream border border-border flex items-center justify-center shrink-0">
				<svg width="20" height="24" viewBox="0 0 20 24" fill="none" class="text-muted">
					<path d="M2 2C2 0.9 2.9 0 4 0H13L20 7V22C20 23.1 19.1 24 18 24H4C2.9 24 2 23.1 2 22V2Z" fill="currentColor" opacity="0.1" stroke="currentColor" stroke-width="1.2" />
					<path d="M13 0L20 7H15C13.9 7 13 6.1 13 5V0Z" fill="currentColor" opacity="0.15" />
					<line x1="5" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1" opacity="0.4" />
					<line x1="5" y1="15" x2="13" y2="15" stroke="currentColor" stroke-width="1" opacity="0.4" />
					<line x1="5" y1="18" x2="11" y2="18" stroke="currentColor" stroke-width="1" opacity="0.4" />
				</svg>
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium text-ink truncate">{block.content || 'Document'}</p>
				<p class="text-[11px] text-muted">
					{meta.fileType || 'DOC'}{meta.fileSize ? ' · ' + formatFileSize(Number(meta.fileSize)) : ''} · Click to view
				</p>
			</div>
			<svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="text-muted group-hover/doc:text-ink transition-colors shrink-0">
				<path d="M6 3H3V13H13V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
				<path d="M9 2H14V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
				<path d="M14 2L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</a>

	<!-- Data table block -->
	{:else if block.type === 'data'}
		{@const meta = getMetadata()}
		{@const rows = parseCsv(block.content || '')}
		<div class="rounded-lg border border-dashed border-border overflow-hidden">
			{#if meta.filename}
				<div class="px-3 py-1.5 bg-warm/30 border-b border-border flex items-center gap-2">
					<svg width="12" height="12" viewBox="0 0 16 16" fill="none" class="text-muted shrink-0">
						<rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.3" />
						<line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1" />
						<line x1="6" y1="5" x2="6" y2="15" stroke="currentColor" stroke-width="1" />
						<line x1="11" y1="5" x2="11" y2="15" stroke="currentColor" stroke-width="1" />
						<line x1="1" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1" />
						<line x1="1" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="1" />
					</svg>
					<span class="text-xs font-medium text-muted truncate">{meta.filename}</span>
				</div>
			{/if}
			<div class="overflow-x-auto max-h-[400px] overflow-y-auto">
				<table class="w-full text-xs border-collapse">
					{#if rows.length > 0}
						<thead class="sticky top-0 z-10">
							<tr class="bg-warm/60">
								<th class="px-2 py-1.5 border-b border-r border-border text-muted font-normal text-center w-8 bg-warm/60">#</th>
								{#each rows[0] as cell}
									<th class="px-2.5 py-1.5 border-b border-r border-border text-left font-semibold text-ink whitespace-nowrap bg-warm/60">{cell}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each rows.slice(1) as row, i}
								<tr class="hover:bg-warm/20 {i % 2 === 1 ? 'bg-warm/10' : ''}">
									<td class="px-2 py-1 border-b border-r border-border text-muted text-center font-mono text-[10px] bg-warm/5">{i + 1}</td>
									{#each row as cell}
										<td class="px-2.5 py-1 border-b border-r border-border text-ink whitespace-nowrap">{cell}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					{/if}
				</table>
			</div>
			{#if rows.length > 1}
				<div class="px-3 py-1 bg-warm/20 border-t border-border">
					<span class="text-[10px] text-muted">{rows.length - 1} rows × {rows[0]?.length || 0} columns</span>
				</div>
			{/if}
		</div>
	{/if}
	</div>
</div>
