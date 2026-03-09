<script lang="ts">
	import { browser } from '$app/environment';

	interface Props {
		smiles: string;
		width?: number;
		height?: number;
	}

	let { smiles, width = 280, height = 200 }: Props = $props();
	let canvasEl: HTMLCanvasElement;
	let error = $state('');
	let loaded = $state(false);

	$effect(() => {
		if (!browser || !canvasEl || !smiles) return;
		renderMolecule();
	});

	async function renderMolecule() {
		try {
			error = '';
			loaded = false;

			const SD = await import('smiles-drawer');
			const SmilesDrawer = SD.default || SD;

			// Clear canvas
			const ctx = canvasEl.getContext('2d');
			if (ctx) {
				ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
			}

			SmilesDrawer.parse(
				smiles,
				(tree: any) => {
					const drawer = new SmilesDrawer.Drawer({
						width: canvasEl.width,
						height: canvasEl.height,
						bondThickness: 1.0,
						bondLength: 15,
						shortBondLength: 0.85,
						bondSpacing: 2.6,
						fontSizeLarge: 6,
						fontSizeSmall: 4,
						padding: 20
					});
					drawer.draw(tree, canvasEl, 'light');
					loaded = true;
				},
				() => {
					error = 'Invalid structure';
				}
			);
		} catch {
			error = 'Failed to render';
		}
	}
</script>

<div class="relative inline-block">
	<canvas
		bind:this={canvasEl}
		{width}
		{height}
		class="pencil-effect rounded-lg max-w-full h-auto"
		style="background: transparent;"
	></canvas>

	{#if error}
		<div class="absolute inset-0 flex items-center justify-center">
			<span class="font-ui text-sm text-red-ink bg-cream/80 px-3 py-1 rounded">{error}</span>
		</div>
	{/if}

	{#if !loaded && !error}
		<div class="absolute inset-0 flex items-center justify-center">
			<span class="font-ui text-sm text-muted animate-pulse">Drawing...</span>
		</div>
	{/if}
</div>
