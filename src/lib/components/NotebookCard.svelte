<script lang="ts">
	import type { Notebook } from '$lib/db';

	interface Props {
		notebook: Notebook;
		onclick: () => void;
	}

	let { notebook, onclick }: Props = $props();

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

<button
	class="group relative w-full text-left rounded-lg overflow-hidden
		   transition-all duration-150 active:scale-[0.98]
		   border border-dashed border-border hover:border-muted/50 bg-cream"
	{onclick}
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
		<p class="text-[11px] text-muted/50">
			{timeAgo(notebook.updated)}
		</p>
	</div>
</button>
