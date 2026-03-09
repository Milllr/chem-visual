<script lang="ts">
	import { onMount } from 'svelte';

	interface Stroke {
		points: [number, number][];
		color: string;
		width: number;
	}

	interface Props {
		strokes?: Stroke[];
		onsave: (strokes: Stroke[]) => void;
		onclose: () => void;
	}

	let { strokes: initialStrokes = [], onsave, onclose }: Props = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let allStrokes = $state<Stroke[]>([...initialStrokes]);
	let currentStroke = $state<Stroke | null>(null);
	let isDrawing = $state(false);

	// Tools
	let tool = $state<'pen' | 'eraser'>('pen');
	let penColor = $state('#1a1a1a');
	let penWidth = $state(2);
	const colors = ['#1a1a1a', '#b54848', '#4a6d8c', '#3a7a3a', '#8B6914', '#7a4a8c'];
	const widths = [1, 2, 4, 8];

	onMount(() => {
		resizeCanvas();
		window.addEventListener('resize', resizeCanvas);
		return () => window.removeEventListener('resize', resizeCanvas);
	});

	function resizeCanvas() {
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx = canvas.getContext('2d');
		if (ctx) {
			ctx.scale(dpr, dpr);
			redraw();
		}
	}

	function redraw() {
		if (!ctx || !canvas) return;
		const rect = canvas.getBoundingClientRect();
		ctx.clearRect(0, 0, rect.width, rect.height);

		for (const stroke of allStrokes) {
			drawStroke(stroke);
		}
		if (currentStroke) {
			drawStroke(currentStroke);
		}
	}

	function drawStroke(stroke: Stroke) {
		if (!ctx || stroke.points.length < 2) return;
		ctx.beginPath();
		ctx.strokeStyle = stroke.color;
		ctx.lineWidth = stroke.width;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		if (stroke.color === 'eraser') {
			ctx.globalCompositeOperation = 'destination-out';
			ctx.strokeStyle = 'rgba(0,0,0,1)';
		} else {
			ctx.globalCompositeOperation = 'source-over';
		}

		const [first, ...rest] = stroke.points;
		ctx.moveTo(first[0], first[1]);
		for (const [x, y] of rest) {
			ctx.lineTo(x, y);
		}
		ctx.stroke();
		ctx.globalCompositeOperation = 'source-over';
	}

	function getPos(e: PointerEvent): [number, number] {
		const rect = canvas.getBoundingClientRect();
		return [e.clientX - rect.left, e.clientY - rect.top];
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		isDrawing = true;
		canvas.setPointerCapture(e.pointerId);
		const pos = getPos(e);
		currentStroke = {
			points: [pos],
			color: tool === 'eraser' ? 'eraser' : penColor,
			width: tool === 'eraser' ? penWidth * 4 : penWidth
		};
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDrawing || !currentStroke) return;
		const pos = getPos(e);
		currentStroke.points = [...currentStroke.points, pos];
		redraw();
	}

	function handlePointerUp() {
		if (!isDrawing || !currentStroke) return;
		isDrawing = false;
		if (currentStroke.points.length >= 2) {
			allStrokes = [...allStrokes, currentStroke];
		}
		currentStroke = null;
		redraw();
	}

	function undo() {
		if (allStrokes.length === 0) return;
		allStrokes = allStrokes.slice(0, -1);
		redraw();
	}

	function clearAll() {
		allStrokes = [];
		redraw();
	}

	function save() {
		onsave(allStrokes);
	}

	function handleClose() {
		if (allStrokes.length > 0 && allStrokes.length !== initialStrokes.length) {
			if (!confirm('Discard unsaved drawing changes?')) return;
		}
		onclose();
	}
</script>

<div class="fixed inset-0 z-50 bg-cream flex flex-col">
	<!-- Toolbar -->
	<div class="shrink-0 bg-cream border-b border-border px-3 py-2 safe-top">
		<div class="flex items-center justify-between max-w-2xl mx-auto">
			<!-- Close -->
			<button
				class="text-sm text-muted hover:text-ink transition-colors px-2 py-1"
				onclick={handleClose}
			>
				✕ Cancel
			</button>

			<div class="flex items-center gap-2">
				<!-- Undo -->
				<button
					class="w-8 h-8 rounded-md flex items-center justify-center
						   hover:bg-warm active:bg-warm transition-colors text-muted
						   disabled:opacity-30"
					onclick={undo}
					disabled={allStrokes.length === 0}
					aria-label="Undo"
				>
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4 8 L8 4 M4 8 L8 12" />
						<path d="M4 8 H13 A4 4 0 010 16 H10" />
					</svg>
				</button>

				<!-- Clear -->
				<button
					class="w-8 h-8 rounded-md flex items-center justify-center
						   hover:bg-warm active:bg-warm transition-colors text-muted
						   disabled:opacity-30"
					onclick={clearAll}
					disabled={allStrokes.length === 0}
					aria-label="Clear all"
				>
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
						<path d="M4 6 H16 M8 6 V4 H12 V6 M6 6 V16 H14 V6" />
						<path d="M9 9 V13 M11 9 V13" />
					</svg>
				</button>
			</div>

			<!-- Save -->
			<button
				class="text-sm bg-accent text-cream px-4 py-1.5 rounded-md
					   hover:bg-accent-dark active:bg-accent-dark transition-colors"
				onclick={save}
			>
				Done
			</button>
		</div>
	</div>

	<!-- Tools -->
	<div class="shrink-0 bg-warm/30 border-b border-border px-3 py-2">
		<div class="flex items-center justify-center gap-3 max-w-md mx-auto">
			<!-- Pen/Eraser toggle -->
			<div class="flex rounded-md border border-border overflow-hidden">
				<button
					class="px-3 py-1 text-xs transition-colors"
					class:bg-accent={tool === 'pen'}
					class:text-cream={tool === 'pen'}
					class:text-muted={tool !== 'pen'}
					onclick={() => (tool = 'pen')}
				>
					Pen
				</button>
				<button
					class="px-3 py-1 text-xs transition-colors"
					class:bg-accent={tool === 'eraser'}
					class:text-cream={tool === 'eraser'}
					class:text-muted={tool !== 'eraser'}
					onclick={() => (tool = 'eraser')}
				>
					Eraser
				</button>
			</div>

			<!-- Colors -->
			{#if tool === 'pen'}
				<div class="flex gap-1">
					{#each colors as c}
						<button
							class="w-6 h-6 rounded-full border-2 transition-all"
							class:border-ink={penColor === c}
							class:scale-110={penColor === c}
							class:border-transparent={penColor !== c}
							style="background-color: {c}"
							onclick={() => (penColor = c)}
						></button>
					{/each}
				</div>
			{/if}

			<!-- Width -->
			<div class="flex gap-1 items-center">
				{#each widths as w}
					<button
						class="rounded-full transition-all flex items-center justify-center {penWidth === w ? 'bg-ink' : 'bg-border'}"
						style="width: {Math.max(w * 3, 12)}px; height: {Math.max(w * 3, 12)}px"
						onclick={() => (penWidth = w)}
					>
						<span
							class="rounded-full {penWidth === w ? 'bg-cream' : 'bg-muted'}"
							style="width: {Math.max(w, 2)}px; height: {Math.max(w, 2)}px"
						></span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Canvas -->
	<div class="flex-1 overflow-hidden relative">
		<canvas
			bind:this={canvas}
			class="absolute inset-0 w-full h-full cursor-crosshair touch-none"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
		></canvas>
	</div>
</div>
