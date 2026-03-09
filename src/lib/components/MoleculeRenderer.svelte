<script lang="ts">
	import { browser } from '$app/environment';

	interface Props {
		smiles: string;
		width?: number;
		height?: number;
	}

	let { smiles, width = 280, height = 200 }: Props = $props();
	let containerEl: HTMLDivElement;
	let error = $state('');
	let loaded = $state(false);

	$effect(() => {
		if (!browser || !containerEl || !smiles) return;
		// Wait for layout to be ready
		requestAnimationFrame(() => {
			if (containerEl) renderMolecule();
		});
	});

	async function renderMolecule() {
		try {
			error = '';
			loaded = false;

			const SD = await import('smiles-drawer');
			const mod: any = SD.default || SD;

			const Parser = mod.Parser || SD.Parser;
			// Use SvgDrawer directly — the Drawer class has a parameter mismatch bug
			// that passes infoOnly where SvgDrawer expects weights, causing svgWrapper
			// to never be created and determineDimensions to fail on null.
			const SvgDrawerClass = mod.SvgDrawer || SD.SvgDrawer;

			if (!Parser?.parse || !SvgDrawerClass) {
				error = 'Renderer not available';
				return;
			}

			// Step 1: Parse SMILES
			let tree: any;
			try {
				tree = Parser.parse(smiles);
			} catch {
				error = 'Invalid structure';
				return;
			}

			// Step 2: Draw to SVG via SvgDrawer (bypasses buggy Drawer.draw())
			try {
				const svgDrawer = new SvgDrawerClass({
					width,
					height,
					bondThickness: 1.0,
					bondLength: 15,
					shortBondLength: 0.85,
					bondSpacing: 2.6,
					fontSizeLarge: 6,
					fontSizeSmall: 4,
					padding: 20
				});
				const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
				svgEl.setAttributeNS(null, 'width', String(width));
				svgEl.setAttributeNS(null, 'height', String(height));
				svgDrawer.draw(tree, svgEl, 'light');
				containerEl.innerHTML = '';
				containerEl.appendChild(svgEl);
				loaded = true;
			} catch (e) {
				console.error('Molecule draw error:', e);
				error = 'Render failed';
			}
		} catch (e) {
			console.error('Molecule import error:', e);
			error = 'Failed to render';
		}
	}
</script>

<div class="relative inline-block">
	<div
		bind:this={containerEl}
		class="rounded-lg max-w-full"
		style="width: {width}px; height: {height}px; background: transparent;"
	></div>

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
