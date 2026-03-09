<script lang="ts">
	import { NOTEBOOK_COLORS } from '$lib/db';
	import type { Notebook } from '$lib/db';

	interface Props {
		open: boolean;
		notebook: Notebook;
		onclose: () => void;
		onsave: (data: Partial<Notebook>) => void;
	}

	let { open, notebook, onclose, onsave }: Props = $props();
	let title = $state('');
	let description = $state('');
	let color = $state('');
	let goal = $state('');
	let tracked = $state(true);
	let saving = $state(false);

	// Sync form fields when modal opens or notebook changes
	$effect(() => {
		if (open && notebook) {
			title = notebook.title;
			description = notebook.description || '';
			color = notebook.color;
			goal = notebook.goal || '';
			tracked = notebook.tracked !== 0;
		}
	});

	async function handleSave() {
		if (!title.trim() || saving) return;
		saving = true;
		await onsave({
			title: title.trim(),
			description: description.trim(),
			color,
			goal: goal.trim(),
			tracked: tracked ? 1 : 0
		});
		saving = false;
	}
</script>

{#if open}
	<!-- Backdrop -->
	<button class="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" onclick={onclose}></button>

	<!-- Modal -->
	<div
		class="fixed inset-x-4 top-[8dvh] z-50 mx-auto max-w-sm bg-cream rounded-lg
			   shadow-lg border border-dashed border-border overflow-hidden max-h-[84dvh] overflow-y-auto"
		style="animation: slideUp 0.2s ease-out"
	>
		<div class="px-5 pt-5 pb-4">
			<h2 class="font-heading text-lg mb-4">Edit Notebook</h2>

			<!-- Title -->
			<label class="text-xs text-muted mb-1 block">Title</label>
			<input
				type="text"
				class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2.5 text-sm
					   outline-none placeholder:text-muted/40 focus:border-muted transition-colors mb-3"
				placeholder="Notebook title..."
				bind:value={title}
			/>

			<!-- Description -->
			<label class="text-xs text-muted mb-1 block">Description</label>
			<input
				type="text"
				class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm
					   outline-none placeholder:text-muted/40 focus:border-muted transition-colors mb-3"
				placeholder="Short description (optional)"
				bind:value={description}
			/>

			<!-- Goal -->
			<label class="text-xs text-muted mb-1 block">Project Goal</label>
			<textarea
				class="w-full bg-warm/50 border border-border rounded-lg px-3 py-2 text-sm
					   outline-none placeholder:text-muted/40 focus:border-muted transition-colors mb-3
					   resize-none"
				placeholder="What are you trying to achieve? (helps AI give better advice)"
				bind:value={goal}
				rows="3"
			></textarea>

			<!-- Color picker -->
			<label class="text-xs text-muted mb-1.5 block">Color</label>
			<div class="flex flex-wrap gap-1.5 mb-4">
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

			<!-- Tracked toggle -->
			<div class="flex items-center justify-between mb-5 px-1">
				<div>
					<p class="text-sm text-ink">Track progress</p>
					<p class="text-[11px] text-muted">Show next steps on home screen</p>
				</div>
				<button
					class="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
					class:bg-accent={tracked}
					class:bg-border={!tracked}
					onclick={() => (tracked = !tracked)}
					type="button"
				>
					<span
						class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
						style="transform: translateX({tracked ? '20px' : '0px'})"
					></span>
				</button>
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
					onclick={handleSave}
					disabled={!title.trim() || saving}
				>
					{saving ? 'Saving...' : 'Save'}
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
