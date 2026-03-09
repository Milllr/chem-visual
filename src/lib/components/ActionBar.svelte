<script lang="ts">
	interface Props {
		onaddtext: () => void;
		onaddimage: () => void;
		onaddmolecule: () => void;
		ondraw: () => void;
		ontoggleChat: () => void;
		chatOpen?: boolean;
	}

	let { onaddtext, onaddimage, onaddmolecule, ondraw, ontoggleChat, chatOpen = false }: Props = $props();
</script>

<div
	class="fixed bottom-0 left-0 right-0 z-40 bg-cream/90 backdrop-blur-sm border-t border-border safe-bottom"
>
	<div class="flex items-center justify-around max-w-md mx-auto px-2 py-1.5">
		<!-- Text -->
		<button
			class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md
				   active:bg-warm transition-colors min-w-[44px]"
			onclick={onaddtext}
		>
			<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 16 L16 4" /><path d="M14.5 5.5 L16 4 L14.5 2.5" /></svg>
			<span class="text-[10px] text-muted">Text</span>
		</button>

		<!-- Image -->
		<button
			class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md
				   active:bg-warm transition-colors min-w-[44px]"
			onclick={onaddimage}
		>
			<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="16" height="14" rx="2" /><circle cx="7" cy="8" r="1.5" /><path d="M2 14 L7 10 L11 13 L14 10 L18 14" /></svg>
			<span class="text-[10px] text-muted">Photo</span>
		</button>

		<!-- Molecule -->
		<button
			class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md
				   active:bg-warm transition-colors min-w-[44px]"
			onclick={onaddmolecule}
		>
			<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10,3 L16,6.5 L16,13.5 L10,17 L4,13.5 L4,6.5 Z" /><circle cx="10" cy="10" r="3.5" stroke-width="1" /></svg>
			<span class="text-[10px] text-muted">Molecule</span>
		</button>

		<!-- Draw -->
		<button
			class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md
				   active:bg-warm transition-colors min-w-[44px]"
			onclick={ondraw}
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
			onclick={ontoggleChat}
		>
			<svg class="w-5 h-5" class:text-cream={chatOpen} class:text-muted={!chatOpen} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4 h14 a1 1 0 011 1 v8 a1 1 0 01-1 1 h-4 l-3 3 v-3 H3 a1 1 0 01-1-1 V5 a1 1 0 011-1z" /></svg>
			<span class="text-[10px]" class:text-muted={!chatOpen}>Chat</span>
		</button>
	</div>
</div>
