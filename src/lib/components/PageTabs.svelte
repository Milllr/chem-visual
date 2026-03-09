<script lang="ts">
	import type { Page } from '$lib/db';

	interface Props {
		pages: Page[];
		currentPageId: string;
		onselect: (pageId: string) => void;
		onadd: () => void;
		ondelete: (pageId: string) => void;
	}

	let { pages, currentPageId, onselect, onadd, ondelete }: Props = $props();
	let longPressTimer: ReturnType<typeof setTimeout>;
	let longPressTarget = $state<string | null>(null);

	function handlePointerDown(pageId: string) {
		longPressTimer = setTimeout(() => {
			longPressTarget = pageId;
		}, 600);
	}

	function handlePointerUp() {
		clearTimeout(longPressTimer);
	}

	function confirmDelete(pageId: string) {
		longPressTarget = null;
		ondelete(pageId);
	}
</script>

<div class="flex items-center gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide">
	{#each pages as page (page.id)}
		<div class="relative shrink-0">
			<button
				class="px-3 py-1 rounded-md text-xs whitespace-nowrap
					   transition-all active:scale-95 border"
				class:bg-accent={currentPageId === page.id}
				class:text-cream={currentPageId === page.id}
				class:border-accent={currentPageId === page.id}
				class:bg-transparent={currentPageId !== page.id}
				class:border-border={currentPageId !== page.id}
				class:text-muted={currentPageId !== page.id}
				onclick={() => onselect(page.id)}
				onpointerdown={() => handlePointerDown(page.id)}
				onpointerup={handlePointerUp}
				onpointerleave={handlePointerUp}
			>
				{page.title}
			</button>

			<!-- Delete confirmation on long press -->
			{#if longPressTarget === page.id}
				<div class="absolute -top-9 left-1/2 -translate-x-1/2 z-20 flex gap-1">
					<button
						class="bg-red-ink text-cream text-[11px] px-2 py-0.5 rounded-md shadow-sm
							   whitespace-nowrap active:scale-95"
						onclick={() => confirmDelete(page.id)}
					>
						Delete
					</button>
					<button
						class="bg-warm text-ink text-[11px] px-1.5 py-0.5 rounded-md shadow-sm
							   active:scale-95"
						onclick={() => (longPressTarget = null)}
					>
						✕
					</button>
				</div>
			{/if}
		</div>
	{/each}

	<!-- Add page -->
	<button
		class="shrink-0 w-9 h-9 rounded-lg border border-dashed border-muted/40
			   flex items-center justify-center text-muted hover:border-accent
			   hover:text-accent transition-colors active:scale-95"
		onclick={onadd}
	>
		<span class="text-lg">+</span>
	</button>
</div>

<style>
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
