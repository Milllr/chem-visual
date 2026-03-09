<script lang="ts">
	interface Props {
		open: boolean;
		onclose: () => void;
		onsubmit: (input: string) => void;
		loading?: boolean;
	}

	let { open, onclose, onsubmit, loading = false }: Props = $props();
	let input = $state('');

	function handleSubmit() {
		if (!input.trim() || loading) return;
		onsubmit(input.trim());
		input = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
		}
		if (e.key === 'Escape') {
			onclose();
		}
	}
</script>

{#if open}
	<button class="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" onclick={onclose}></button>

	<div
		class="fixed inset-x-4 top-[20dvh] z-50 mx-auto max-w-sm bg-cream rounded-lg
			   shadow-lg border border-dashed border-border overflow-hidden"
		style="animation: slideUp 0.2s ease-out"
	>
		<div class="px-5 pt-5 pb-4">
			<h2 class="font-heading text-lg mb-1">Draw Molecule</h2>
			<p class="text-xs text-muted mb-4">
				Enter a formula (C3H8), name (propane), or SMILES (CCC)
			</p>

			<input
				type="text"
				class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2.5 text-sm
					   outline-none placeholder:text-muted/40 focus:border-muted transition-colors mb-4"
				placeholder="e.g. benzene, C6H6, c1ccccc1"
				bind:value={input}
				onkeydown={handleKeydown}
				autofocus
			/>

			<div class="flex gap-2">
				<button
					class="flex-1 text-sm py-2 rounded-lg border border-border
						   text-muted hover:bg-warm active:bg-warm transition-colors"
					onclick={onclose}
				>
					Cancel
				</button>
				<button
					class="flex-1 text-sm py-2 rounded-lg bg-accent text-cream
						   hover:bg-accent-dark active:bg-accent-dark transition-colors disabled:opacity-40"
					onclick={handleSubmit}
					disabled={!input.trim() || loading}
				>
					{loading ? 'Resolving...' : 'Insert'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
