<script lang="ts">
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

	function handleInput(e: Event) {
		const target = e.currentTarget as HTMLTextAreaElement;
		editContent = target.value;

		// Auto-resize
		target.style.height = 'auto';
		target.style.height = target.scrollHeight + 'px';

		// Debounced save
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => onupdate(editContent), 1500);
	}

	function handleBlur() {
		clearTimeout(saveTimer);
		if (editContent !== block.content) {
			onupdate(editContent);
		}
		if (block.type === 'text' && !editContent.trim()) {
			// Delete empty text blocks
			ondelete();
		}
		editing = false;
	}

	function startEdit() {
		if (block.type === 'text') {
			editing = true;
			editContent = block.content || '';
		}
	}

	function getMetadata(): Record<string, string> {
		try {
			return block.metadata ? JSON.parse(block.metadata) : {};
		} catch {
			return {};
		}
	}
</script>

<div
	class="group relative"
	role="button"
	tabindex="0"
	onclick={startEdit}
	onkeydown={(e) => e.key === 'Enter' && startEdit()}
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
		{#if editing}
			<textarea
				class="w-full bg-transparent text-sm text-ink
					   resize-none outline-none paper-lines min-h-[2rem] px-1 leading-relaxed"
				value={editContent}
				oninput={handleInput}
				onblur={handleBlur}
				placeholder="Write something..."
				autofocus
			></textarea>
		{:else}
			<div class="text-sm text-ink paper-lines px-1 min-h-[2rem] whitespace-pre-wrap leading-relaxed">
				{block.content || ''}
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
			<div class="text-sm text-ink whitespace-pre-wrap leading-relaxed">
				{block.content}
			</div>
		</div>
	{/if}
</div>
