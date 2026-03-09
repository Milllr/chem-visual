<script lang="ts">
	import { NOTEBOOK_COLORS } from '$lib/db';

	interface Props {
		open: boolean;
		onclose: () => void;
		oncreate: (data: { title: string; description: string; color: string; emoji: string }) => void;
	}

	let { open, onclose, oncreate }: Props = $props();
	let title = $state('');
	let description = $state('');
	let color = $state(NOTEBOOK_COLORS[0]);
	let creating = $state(false);

	async function handleCreate() {
		if (!title.trim() || creating) return;
		creating = true;
		await oncreate({ title: title.trim(), description: description.trim(), color, emoji: '' });
		title = '';
		description = '';
		color = NOTEBOOK_COLORS[0];
		creating = false;
	}
</script>

{#if open}
	<!-- Backdrop -->
	<button class="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" onclick={onclose}></button>

	<!-- Modal -->
	<div
		class="fixed inset-x-4 top-[15dvh] z-50 mx-auto max-w-sm bg-cream rounded-lg
			   shadow-lg border border-dashed border-border overflow-hidden"
		style="animation: slideUp 0.2s ease-out"
	>
		<div class="px-5 pt-5 pb-4">
			<h2 class="font-heading text-lg mb-4">New Notebook</h2>

			<!-- Title -->
			<input
				type="text"
				class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2.5 text-sm
					   outline-none placeholder:text-muted/40 focus:border-muted transition-colors mb-2.5"
				placeholder="Notebook title..."
				bind:value={title}
				autofocus
			/>

			<!-- Description -->
			<input
				type="text"
				class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm
					   outline-none placeholder:text-muted/40 focus:border-muted transition-colors mb-4"
				placeholder="Short description (optional)"
				bind:value={description}
			/>

			<!-- Color picker -->
			<p class="text-xs text-muted mb-1.5">Color</p>
			<div class="flex flex-wrap gap-1.5 mb-5">
				{#each NOTEBOOK_COLORS as c}
					<button
						class="w-7 h-7 rounded-full transition-all border-2"
						class:border-ink={color === c}
						class:scale-110={color === c}
						class:border-transparent={color !== c}
						style="background-color: {c}"
						onclick={() => (color = c)}
					></button>
				{/each}
			</div>

			<!-- Actions -->
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
					onclick={handleCreate}
					disabled={!title.trim() || creating}
				>
					{creating ? 'Creating...' : 'Create'}
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
