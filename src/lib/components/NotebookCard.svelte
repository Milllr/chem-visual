<script lang="ts">
	import type { Notebook } from '$lib/db';

	interface Props {
		notebook: Notebook;
		onclick: () => void;
		ondelete?: () => void;
		onedit?: () => void;
	}

	let { notebook, onclick, ondelete, onedit }: Props = $props();
	let confirming = $state(false);

	function timeAgo(dateStr: string): string {
		const now = Date.now();
		const then = new Date(dateStr + 'Z').getTime();
		const diff = now - then;
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		if (days < 30) return `${days}d ago`;
		return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
	}
</script>

<div class="group relative">
	<button
		class="w-full text-left rounded-lg overflow-hidden
			   transition-all duration-150 active:scale-[0.98]
			   border border-dashed border-border hover:border-muted/50 bg-cream"
		onclick={() => { if (!confirming) onclick(); }}
	>
		<div class="p-3.5 pb-3">
			<!-- Color dot -->
			<div class="flex items-center gap-2 mb-2">
				<span
					class="w-2.5 h-2.5 rounded-full shrink-0"
					style="background-color: {notebook.color}"
				></span>
			</div>

			<!-- Title -->
			<h3 class="font-heading text-base text-ink leading-tight mb-0.5 line-clamp-2">
				{notebook.title}
			</h3>

			<!-- Description -->
			{#if notebook.description}
				<p class="text-xs text-muted leading-snug line-clamp-2 mb-1.5">
					{notebook.description}
				</p>
			{/if}

			<!-- Updated -->
			<div class="flex items-center gap-1.5">
				<p class="text-[11px] text-muted/50">
					{timeAgo(notebook.updated)}
				</p>
				{#if notebook.tracked === 0}
					<span class="text-[9px] text-muted/40 bg-warm rounded px-1 py-0.5">untracked</span>
				{/if}
			</div>
		</div>
	</button>

	<!-- Delete button -->
	{#if ondelete}
		{#if confirming}
			<div class="absolute inset-0 bg-cream/95 rounded-lg flex flex-col items-center justify-center gap-2 z-10">
				<p class="font-ui text-xs text-ink">Delete this notebook?</p>
				<div class="flex gap-2">
					<button
						class="px-3 py-1 text-[11px] rounded-md bg-red-ink text-cream hover:bg-red-ink/80 transition-colors"
						onclick={() => { ondelete(); confirming = false; }}
					>
						Delete
					</button>
					<button
						class="px-3 py-1 text-[11px] rounded-md border border-border text-muted hover:text-ink transition-colors"
						onclick={() => (confirming = false)}
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<!-- Edit button -->
			{#if onedit}
				<button
					class="absolute top-2 right-9 w-6 h-6 rounded-md flex items-center justify-center
						   text-muted/0 group-hover:text-muted/50 hover:!text-accent hover:bg-warm
						   transition-all z-10"
					onclick={(e) => { e.stopPropagation(); onedit(); }}
					aria-label="Edit notebook"
				>
					<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 1l2.5 2.5L4 10.5H1.5V8z" /></svg>
				</button>
			{/if}
			<button
				class="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center
					   text-muted/0 group-hover:text-muted/50 hover:!text-red-ink hover:bg-warm
					   transition-all z-10"
				onclick={(e) => { e.stopPropagation(); confirming = true; }}
				aria-label="Delete notebook"
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4h9M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3.5 4l.5 8h6l.5-8" /></svg>
			</button>
		{/if}
	{/if}
</div>
