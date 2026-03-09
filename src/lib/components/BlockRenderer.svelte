<script lang="ts">
	import { tick } from 'svelte';
	import { marked } from 'marked';
	import type { Block } from '$lib/db';
	import MoleculeRenderer from './MoleculeRenderer.svelte';

	interface Props {
		block: Block;
		onupdate: (content: string) => void;
		ondelete: () => void;
	}

	let { block, onupdate, ondelete }: Props = $props();
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
</script>

<div
	class="group relative"
	onpointerdown={() => (showDelete = true)}
	onpointerup={() => setTimeout(() => (showDelete = false), 2000)}
>
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
				class="text-ink paper-lines px-1 whitespace-pre-wrap cursor-text"
				onclick={startEdit}
			>
				{block.content}
			</div>
		{/if}

	<!-- Image block -->
	{:else if block.type === 'image'}
		<div class="rounded-lg overflow-hidden border border-dashed border-border">
			<img
				src={block.image_url}
				alt="Lab photo"
				class="w-full h-auto max-h-[300px] object-cover"
				loading="lazy"
			/>
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
	{/if}
</div>
