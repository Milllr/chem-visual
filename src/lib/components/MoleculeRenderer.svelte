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
		// Track smiles and dimensions as dependencies
		const _s = smiles;
		const _w = width;
		const _h = height;
		if (!browser || !containerEl || !_s) return;
		// Small delay to ensure DOM is ready
		const timer = setTimeout(() => renderMolecule(_s, _w, _h), 10);
		return () => clearTimeout(timer);
	});

	async function renderMolecule(smi: string, w: number, h: number) {
		try {
			error = '';
			loaded = false;

			const SD = await import('smiles-drawer');
			const mod: any = SD.default || SD;

			const Parser = mod.Parser || SD.Parser;
			const SvgDrawerClass = mod.SvgDrawer || SD.SvgDrawer;

			if (!Parser?.parse || !SvgDrawerClass) {
				error = 'Renderer not available';
				return;
			}

			// Step 1: Parse SMILES
			let tree: any;
			try {
				tree = Parser.parse(smi);
			} catch {
				error = 'Invalid structure';
				return;
			}

			// Scale drawing options for small sizes
			const isSmall = w <= 60 || h <= 60;
			const isMedium = w <= 140 || h <= 140;

			// Step 2: Draw to SVG via SvgDrawer
			try {
				const svgDrawer = new SvgDrawerClass({
					width: w,
					height: h,
					bondThickness: isSmall ? 0.6 : 1.0,
					bondLength: isSmall ? 8 : isMedium ? 12 : 15,
					shortBondLength: 0.85,
					bondSpacing: isSmall ? 1.5 : 2.6,
					fontSizeLarge: isSmall ? 3 : isMedium ? 5 : 6,
					fontSizeSmall: isSmall ? 2 : isMedium ? 3 : 4,
					padding: isSmall ? 2 : isMedium ? 8 : 20,
					compactDrawing: true
				});

				// Pass null so SvgDrawer creates its own SVG with correct viewBox
				const svgEl = svgDrawer.draw(tree, 'svg', 'light');

				// Make SVG responsive: fill container, preserve aspect ratio
				svgEl.removeAttribute('width');
				svgEl.removeAttribute('height');
				svgEl.style.width = '100%';
				svgEl.style.height = '100%';
				svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

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

<div class="relative">
	<div
		bind:this={containerEl}
		class="rounded-lg w-full flex items-center justify-center"
		style="height: {height}px; background: transparent;"
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
