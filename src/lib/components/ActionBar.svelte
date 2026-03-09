<script lang="ts">
	interface Props {
		onaddtext: () => void;
		onuploadimage: () => void;
		onuploaddocument: () => void;
		onuploaddata: () => void;
		onscannotes: () => void;
		onaddmolecule: () => void;
		onaddtable: () => void;
		ondraw: () => void;
		ontoggleChat: () => void;
		chatOpen?: boolean;
	}

	let { onaddtext, onuploadimage, onuploaddocument, onuploaddata, onscannotes, onaddmolecule, onaddtable, ondraw, ontoggleChat, chatOpen = false }: Props = $props();
	let showUploadMenu = $state(false);
</script>

<div
	class="fixed bottom-0 left-0 right-0 z-40 bg-cream/90 backdrop-blur-sm border-t border-border safe-bottom"
>
	<div class="flex items-center justify-around max-w-md mx-auto px-2 py-1.5">
		<!-- Text -->
		<button
			class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md
				   active:bg-warm transition-colors min-w-[44px]"
			onclick={() => { showUploadMenu = false; onaddtext(); }}
		>
			<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 16 L16 4" /><path d="M14.5 5.5 L16 4 L14.5 2.5" /></svg>
			<span class="text-[10px] text-muted">Text</span>
		</button>

		<!-- Upload (with submenu) -->
		<div class="relative">
			<button
				class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md transition-colors min-w-[44px]"
				class:bg-accent={showUploadMenu}
				class:text-cream={showUploadMenu}
				class:active:bg-warm={!showUploadMenu}
				onclick={() => (showUploadMenu = !showUploadMenu)}
			>
				<svg class="w-5 h-5" class:text-cream={showUploadMenu} class:text-muted={!showUploadMenu} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M10 14 V3 M6 7 L10 3 L14 7" /><path d="M3 13 V16 A1 1 0 004 17 H16 A1 1 0 0017 16 V13" />
				</svg>
				<span class="text-[10px]" class:text-muted={!showUploadMenu}>Upload</span>
			</button>

			{#if showUploadMenu}
				<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-xl shadow-lg p-1.5 min-w-[140px]">
					<button
						class="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-ink hover:bg-warm transition-colors"
						onclick={() => { showUploadMenu = false; onuploadimage(); }}
					>
						<svg class="w-4 h-4 text-muted shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="16" height="14" rx="2" /><circle cx="7" cy="8" r="1.5" /><path d="M2 14 L7 10 L11 13 L14 10 L18 14" /></svg>
						Image
					</button>
					<button
						class="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-ink hover:bg-warm transition-colors"
						onclick={() => { showUploadMenu = false; onuploaddocument(); }}
					>
						<svg class="w-4 h-4 text-muted shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2 H12 L16 6 V18 H5 Z" /><path d="M12 2 V6 H16" /><path d="M7 10 H13 M7 13 H11" /></svg>
						Document
					</button>
					<button
						class="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-ink hover:bg-warm transition-colors"
						onclick={() => { showUploadMenu = false; onuploaddata(); }}
					>
						<svg class="w-4 h-4 text-muted shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3 V17 H17" /><path d="M6 14 L9 9 L12 11 L16 5" /></svg>
						Data
					</button>
					<div class="border-t border-border my-1"></div>
					<button
						class="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-accent font-medium hover:bg-warm transition-colors"
						onclick={() => { showUploadMenu = false; onscannotes(); }}
					>
						<svg class="w-4 h-4 text-accent shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5 V2 H5 M15 2 H18 V5 M18 15 V18 H15 M5 18 H2 V15" /><path d="M5 8 H15 M5 11 H12 M5 14 H9" /></svg>
						Scan Notes
					</button>
				</div>
			{/if}
		</div>

		<!-- Molecule -->
		<button
			class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md
				   active:bg-warm transition-colors min-w-[44px]"
			onclick={() => { showUploadMenu = false; onaddmolecule(); }}
		>
			<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10,3 L16,6.5 L16,13.5 L10,17 L4,13.5 L4,6.5 Z" /><circle cx="10" cy="10" r="3.5" stroke-width="1" /></svg>
			<span class="text-[10px] text-muted">Molecule</span>
		</button>

		<!-- Table -->
		<button
			class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md
				   active:bg-warm transition-colors min-w-[44px]"
			onclick={() => { showUploadMenu = false; onaddtable(); }}
		>
			<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<rect x="2" y="3" width="16" height="14" rx="2" />
				<line x1="2" y1="7" x2="18" y2="7" />
				<line x1="7.5" y1="7" x2="7.5" y2="17" />
				<line x1="12.5" y1="7" x2="12.5" y2="17" />
			</svg>
			<span class="text-[10px] text-muted">Table</span>
		</button>

		<!-- Draw -->
		<button
			class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md
				   active:bg-warm transition-colors min-w-[44px]"
			onclick={() => { showUploadMenu = false; ondraw(); }}
		>
			<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 17 C5 13 7 9 9 8 C11 7 12 9 11 11 C10 13 8 15 10 15 C12 15 14 12 16 8" />
				<circle cx="16" cy="8" r="1" fill="currentColor" />
			</svg>
			<span class="text-[10px] text-muted">Draw</span>
		</button>

		<!-- Chat -->
		<button
			class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md
				   transition-colors min-w-[44px]"
			class:bg-accent={chatOpen}
			class:text-cream={chatOpen}
			class:active:bg-warm={!chatOpen}
			onclick={() => { showUploadMenu = false; ontoggleChat(); }}
		>
			<svg class="w-5 h-5" class:text-cream={chatOpen} class:text-muted={!chatOpen} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4 h14 a1 1 0 011 1 v8 a1 1 0 01-1 1 h-4 l-3 3 v-3 H3 a1 1 0 01-1-1 V5 a1 1 0 011-1z" /></svg>
			<span class="text-[10px]" class:text-muted={!chatOpen}>Chat</span>
		</button>
	</div>
</div>
