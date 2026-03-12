<script lang="ts">
	import { browser } from '$app/environment';

	interface Props {
		smiles: string;
		width?: number;
		height?: number;
		clickable?: boolean;
	}

	let { smiles, width = 280, height = 200, clickable = true }: Props = $props();
	let containerEl: HTMLDivElement;
	let previewEl: HTMLDivElement;
	let error = $state('');
	let loaded = $state(false);
	let previewOpen = $state(false);
	let previewLoaded = $state(false);

	function openPreview(e: MouseEvent) {
		e.stopPropagation();
		if (!loaded || error || !clickable) return;
		previewOpen = true;
		previewLoaded = false;
		// Render at larger size after DOM updates
		setTimeout(() => {
			if (previewEl && smiles) renderPreview(smiles);
		}, 30);
	}

	function closePreview(e: MouseEvent) {
		e.stopPropagation();
		previewOpen = false;
	}

	async function renderPreview(smi: string) {
		try {
			const SD = await import('smiles-drawer');
			const mod: any = SD.default || SD;
			const Parser = mod.Parser || SD.Parser;
			const SvgDrawerClass = mod.SvgDrawer || SD.SvgDrawer;
			if (!Parser?.parse || !SvgDrawerClass) return;

			let tree: any;
			try { tree = Parser.parse(smi); } catch { return; }

			const svgDrawer = new SvgDrawerClass({
				width: 320,
				height: 280,
				bondThickness: 1.2,
				bondLength: 18,
				shortBondLength: 0.85,
				bondSpacing: 3.2,
				fontSizeLarge: 8,
				fontSizeSmall: 5,
				padding: 24,
				compactDrawing: false
			});

			const svgEl = svgDrawer.draw(tree, 'svg', 'light');
			svgEl.removeAttribute('width');
			svgEl.removeAttribute('height');
			svgEl.style.width = '100%';
			svgEl.style.height = '100%';
			svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

			previewEl.innerHTML = '';
			previewEl.appendChild(svgEl);
			previewLoaded = true;
		} catch (e) {
			console.error('Preview render error:', e);
		}
	}

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

			// Reject obvious non-SMILES (error messages, names, etc.)
			if (smi.length > 500 || (smi.includes(' ') && smi.length > 20)) {
				error = 'No structure';
				return;
			}

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

<div class="relative overflow-hidden">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={containerEl}
		class="rounded-lg w-full flex items-center justify-center {clickable && loaded && !error ? 'cursor-zoom-in' : ''}"
		style="height: {height}px; background: transparent;"
		onclick={openPreview}
	></div>

	{#if error}
		<div class="absolute inset-0 flex items-center justify-center">
			{#if width <= 60 || height <= 60}
				<span class="text-red-ink/50 text-xs" title={error}>⚠</span>
			{:else}
				<span class="font-ui text-sm text-red-ink bg-cream/80 px-3 py-1 rounded">{error}</span>
			{/if}
		</div>
	{/if}

	{#if !loaded && !error}
		<div class="absolute inset-0 flex items-center justify-center">
			{#if width <= 60 || height <= 60}
				<span class="text-muted/40 text-xs animate-pulse">…</span>
			{:else}
				<span class="font-ui text-sm text-muted animate-pulse">Drawing...</span>
			{/if}
		</div>
	{/if}
</div>

{#if previewOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
		onclick={closePreview}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-white rounded-2xl shadow-2xl p-6 max-w-[360px] w-[90vw] relative"
			onclick={(e) => e.stopPropagation()}
		>
			<button
				class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-warm hover:bg-border transition-colors text-muted"
				onclick={closePreview}
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
					<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
			<div bind:this={previewEl} class="w-full flex items-center justify-center" style="height: 280px;"></div>
			{#if !previewLoaded}
				<div class="absolute inset-0 flex items-center justify-center">
					<span class="font-ui text-sm text-muted animate-pulse">Rendering…</span>
				</div>
			{/if}
			<p class="text-xs text-muted font-mono text-center mt-2 break-all select-all">{smiles}</p>
		</div>
	</div>
{/if}
