<script lang="ts">
	import { goto } from '$app/navigation';
	import { fly, fade } from 'svelte/transition';

	interface Props {
		open: boolean;
		onclose: () => void;
		/** If set, we're inside a notebook — show "in this notebook" context */
		currentNotebookId?: string;
		currentNotebookTitle?: string;
	}

	let { open, onclose, currentNotebookId, currentNotebookTitle }: Props = $props();

	interface SearchResult {
		type: 'notebook' | 'page' | 'reagent' | 'reaction' | 'compound' | 'block' | 'tool';
		id: string;
		title: string;
		subtitle: string;
		notebook_id: string;
		notebook_title: string;
		notebook_emoji: string;
		page_id?: string;
		page_title?: string;
		extra?: Record<string, string>;
	}

	let query = $state('');
	let results = $state<SearchResult[]>([]);
	let loading = $state(false);
	let selectedIdx = $state(0);
	let debounceTimer: ReturnType<typeof setTimeout>;
	let inputEl: HTMLInputElement | undefined = $state();

	const categoryOrder: SearchResult['type'][] = ['notebook', 'page', 'reagent', 'reaction', 'compound', 'block', 'tool'];

	const categoryLabels: Record<string, string> = {
		notebook: 'Notebooks',
		page: 'Pages',
		reagent: 'Reagents',
		reaction: 'Reactions',
		compound: 'Compounds',
		block: 'Content',
		tool: 'Tools',
	};

	// Group results by type
	let grouped = $derived.by(() => {
		const groups: { type: string; label: string; items: SearchResult[] }[] = [];
		for (const cat of categoryOrder) {
			const items = results.filter(r => r.type === cat);
			if (items.length > 0) {
				groups.push({ type: cat, label: categoryLabels[cat], items });
			}
		}
		return groups;
	});

	// Flat list for keyboard nav
	let flatResults = $derived(grouped.flatMap(g => g.items));

	function handleInput() {
		clearTimeout(debounceTimer);
		const q = query.trim();
		if (!q) {
			results = [];
			selectedIdx = 0;
			return;
		}
		loading = true;
		debounceTimer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
				if (res.ok) {
					const data = await res.json();
					results = data.results || [];
				}
			} catch { /* ignore */ }
			loading = false;
			selectedIdx = 0;
		}, 180);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIdx = Math.min(selectedIdx + 1, flatResults.length - 1);
			scrollSelectedIntoView();
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIdx = Math.max(selectedIdx - 1, 0);
			scrollSelectedIntoView();
			return;
		}
		if (e.key === 'Enter' && flatResults.length > 0) {
			e.preventDefault();
			navigateTo(flatResults[selectedIdx]);
			return;
		}
	}

	function scrollSelectedIntoView() {
		requestAnimationFrame(() => {
			const el = document.querySelector(`[data-search-idx="${selectedIdx}"]`);
			if (el) el.scrollIntoView({ block: 'nearest' });
		});
	}

	function navigateTo(result: SearchResult) {
		onclose();
		query = '';
		results = [];

		switch (result.type) {
			case 'notebook':
				goto(`/notebook/${result.notebook_id}`);
				break;
			case 'page':
			case 'block':
				// Navigate to notebook — the page will load
				goto(`/notebook/${result.notebook_id}`);
				break;
			case 'reagent':
			case 'reaction':
			case 'compound':
				goto(`/notebook/${result.notebook_id}`);
				break;
			case 'tool':
				// If inside a notebook, tools are in the library
				// Otherwise navigate to first notebook or just stay
				if (currentNotebookId) {
					// User is already inside a notebook — we'll handle tool opening via event
					// For now just close
				}
				break;
		}
	}

	function highlightMatch(text: string, q: string): string {
		if (!q.trim() || !text) return escapeHtml(text);
		const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(${escaped})`, 'gi');
		return escapeHtml(text).replace(
			new RegExp(`(${escaped.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')})`, 'gi'),
			'<mark class="bg-accent/20 text-ink rounded px-0.5">$1</mark>'
		);
	}

	function escapeHtml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	// Auto-focus input when opened
	$effect(() => {
		if (open) {
			query = '';
			results = [];
			selectedIdx = 0;
			requestAnimationFrame(() => inputEl?.focus());
		}
	});
</script>

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] bg-ink/30 backdrop-blur-[3px]"
		transition:fade={{ duration: 150 }}
		onclick={onclose}
		onkeydown={() => {}}
	></div>

	<!-- Search panel -->
	<div
		class="fixed inset-x-0 top-0 z-[61] flex justify-center safe-top"
		transition:fly={{ y: -20, duration: 200 }}
	>
		<div class="w-full max-w-lg mx-3 mt-[8dvh] bg-cream rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[75dvh]">
			<!-- Search input -->
			<div class="flex items-center gap-3 px-4 py-3 border-b border-border">
				<svg class="w-5 h-5 text-muted shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
					<circle cx="9" cy="9" r="5.5" /><path d="M13 13L17 17" />
				</svg>
				<input
					bind:this={inputEl}
					bind:value={query}
					oninput={handleInput}
					onkeydown={handleKeydown}
					type="text"
					placeholder="Search everything…"
					class="flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted/40"
					autocomplete="off"
					autocorrect="off"
					spellcheck="false"
				/>
				{#if loading}
					<div class="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0"></div>
				{:else if query}
					<button
						class="text-muted hover:text-ink transition-colors"
						onclick={() => { query = ''; results = []; }}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4L12 12M12 4L4 12" /></svg>
					</button>
				{/if}
			</div>

			<!-- Results -->
			<div class="overflow-y-auto overscroll-contain">
				{#if grouped.length > 0}
					{#each grouped as group}
						<div class="px-3 pt-3 pb-1">
							<p class="text-[10px] font-semibold text-muted uppercase tracking-widest px-1">{group.label}</p>
						</div>
						{#each group.items as result}
							{@const idx = flatResults.indexOf(result)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								data-search-idx={idx}
								class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
									{idx === selectedIdx ? 'bg-accent/10' : 'hover:bg-warm/40'}"
								onclick={() => navigateTo(result)}
								onmouseenter={() => (selectedIdx = idx)}
								onkeydown={() => {}}
								role="option"
								aria-selected={idx === selectedIdx}
							>
								<!-- Icon -->
								<div class="w-5 h-5 shrink-0 text-muted">
									{#if result.type === 'notebook'}
										<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="14" height="16" rx="2" /><path d="M7 2v16" /><path d="M10 7h4M10 10h4" /></svg>
									{:else if result.type === 'page'}
										<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2h7l5 5v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M12 2v5h5" /><path d="M7 10h6M7 13h4" /></svg>
									{:else if result.type === 'reagent'}
										<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h4M8 2v5l-4 8a2 2 0 002 2h8a2 2 0 002-2l-4-8V2" /><path d="M6 12h8" /></svg>
									{:else if result.type === 'reaction'}
										<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 10h14M13 6l4 4-4 4" /></svg>
									{:else if result.type === 'compound'}
										<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="6" r="2.5" /><circle cx="5" cy="14" r="2.5" /><circle cx="15" cy="14" r="2.5" /><path d="M8.5 8l-2 4M11.5 8l2 4" /></svg>
									{:else if result.type === 'block'}
										<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M4 5h12M4 8h10M4 11h12M4 14h6" /></svg>
									{:else if result.type === 'tool'}
										<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5a3.5 3.5 0 00-4.95 0L8 5l7 7 1.5-1.5a3.5 3.5 0 000-4.95z" /><path d="M8 5L3 17l12-5-7-7z" /></svg>
									{/if}
								</div>

								<!-- Text -->
								<div class="flex-1 min-w-0">
									<p class="text-sm text-ink truncate">{@html highlightMatch(result.title, query)}</p>
									{#if result.subtitle}
										<p class="text-xs text-muted truncate mt-0.5">{@html highlightMatch(result.subtitle, query)}</p>
									{/if}
								</div>

								<!-- Notebook badge (for non-notebook results) -->
								{#if result.type !== 'notebook' && result.notebook_title}
									<span class="text-[10px] text-muted/60 bg-warm/40 px-1.5 py-0.5 rounded shrink-0 max-w-[100px] truncate">
										{result.notebook_title}
									</span>
								{/if}

								<!-- Arrow -->
								<svg class="w-3.5 h-3.5 text-muted/30 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 4L10 8L6 12" /></svg>
							</div>
						{/each}
					{/each}

					<!-- Footer hint -->
					<div class="px-4 py-2.5 border-t border-border/50 flex items-center justify-between">
						<div class="flex items-center gap-3 text-[10px] text-muted/60">
							<span class="flex items-center gap-1">
								<kbd class="inline-block bg-warm/60 border border-border/50 rounded px-1 py-0.5 text-[9px] font-mono">↑↓</kbd>
								navigate
							</span>
							<span class="flex items-center gap-1">
								<kbd class="inline-block bg-warm/60 border border-border/50 rounded px-1 py-0.5 text-[9px] font-mono">↵</kbd>
								open
							</span>
							<span class="flex items-center gap-1">
								<kbd class="inline-block bg-warm/60 border border-border/50 rounded px-1 py-0.5 text-[9px] font-mono">esc</kbd>
								close
							</span>
						</div>
						<span class="text-[10px] text-muted/40">{flatResults.length} result{flatResults.length !== 1 ? 's' : ''}</span>
					</div>

				{:else if query.trim() && !loading}
					<div class="text-center py-10">
						<p class="text-muted/40 text-sm mb-1">No results for "{query}"</p>
						<p class="text-muted/30 text-xs">Try a different search term</p>
					</div>
				{:else if !query.trim()}
					<div class="text-center py-10 px-6">
						<p class="text-muted/30 text-xs leading-relaxed">
							Search across notebooks, pages, reagents, reactions, compounds, notes, tables, and tools
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
