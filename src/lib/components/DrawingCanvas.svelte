<script lang="ts">
	import { onMount } from 'svelte';

	interface Stroke {
		points: [number, number][];
		color: string;
		width: number;
	}

	interface CanvasImage {
		dataUrl: string;
		x: number;
		y: number;
		width: number;
		height: number;
	}

	interface Props {
		onsave: (imageBlob: Blob) => void;
		onclose: () => void;
		initialImageUrl?: string;
	}

	let { onsave, onclose, initialImageUrl }: Props = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let allStrokes = $state<Stroke[]>([]);
	let allImages = $state<CanvasImage[]>([]);
	let currentStroke = $state<Stroke | null>(null);
	let isDrawing = $state(false);
	let undoStack = $state<{ strokes: Stroke[]; images: CanvasImage[] }[]>([]);
	let redoStack = $state<{ strokes: Stroke[]; images: CanvasImage[] }[]>([]);

	// Tools
	type Tool = 'pen' | 'eraser' | 'highlighter' | 'arrow' | 'line' | 'move';
	let tool = $state<Tool>('pen');
	let penColor = $state('#1a1a1a');
	let penWidth = $state(2);
	let imageInput: HTMLInputElement;

	// Image dragging state
	let draggingImage = $state<number | null>(null);
	let dragOffset = $state<[number, number]>([0, 0]);

	const colors = [
		'#1a1a1a', '#b54848', '#4a6d8c', '#3a7a3a', '#8B6914',
		'#7a4a8c', '#e8832a', '#2aa5a5', '#888888', '#ffffff'
	];
	const widths = [1, 2, 4, 8, 16];

	let loadedImgs = new Map<string, HTMLImageElement>();

	onMount(() => {
		resizeCanvas();
		window.addEventListener('resize', resizeCanvas);
		// Load initial image for re-editing
		if (initialImageUrl) {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				if (!canvas) return;
				const rect = canvas.getBoundingClientRect();
				let w = img.width, h = img.height;
				const maxW = rect.width * 0.9, maxH = rect.height * 0.8;
				if (w > maxW) { h *= maxW / w; w = maxW; }
				if (h > maxH) { w *= maxH / h; h = maxH; }
				// Convert to data URL for consistent handling
				const tmpCanvas = document.createElement('canvas');
				tmpCanvas.width = img.width;
				tmpCanvas.height = img.height;
				const tmpCtx = tmpCanvas.getContext('2d')!;
				tmpCtx.drawImage(img, 0, 0);
				const dataUrl = tmpCanvas.toDataURL('image/png');
				loadedImgs.set(dataUrl, img);
				allImages = [{ dataUrl, x: (rect.width - w) / 2, y: (rect.height - h) / 2, width: w, height: h }];
				redraw();
			};
			img.src = initialImageUrl;
		}
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

	function pushUndo() {
		undoStack = [...undoStack, { strokes: [...allStrokes], images: allImages.map(i => ({...i})) }];
		redoStack = [];
	}

	function redraw() {
		if (!ctx || !canvas) return;
		const rect = canvas.getBoundingClientRect();
		ctx.clearRect(0, 0, rect.width, rect.height);

		// Draw images behind strokes
		for (const img of allImages) {
			const loaded = loadedImgs.get(img.dataUrl);
			if (loaded) {
				ctx.drawImage(loaded, img.x, img.y, img.width, img.height);
			} else {
				const newImg = new Image();
				newImg.onload = () => { loadedImgs.set(img.dataUrl, newImg); redraw(); };
				newImg.src = img.dataUrl;
			}
		}

		for (const stroke of allStrokes) drawStroke(stroke);
		if (currentStroke) drawStroke(currentStroke);
	}

	function drawStroke(stroke: Stroke) {
		if (!ctx || stroke.points.length < 2) return;
		ctx.beginPath();
		ctx.lineWidth = stroke.width;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		// Arrow / line tools encode color as prefix
		if (stroke.color.startsWith('arrow:') || stroke.color.startsWith('line:')) {
			ctx.globalCompositeOperation = 'source-over';
			ctx.strokeStyle = stroke.color.split(':')[1];
			const first = stroke.points[0];
			const last = stroke.points[stroke.points.length - 1];
			ctx.moveTo(first[0], first[1]);
			ctx.lineTo(last[0], last[1]);
			ctx.stroke();
			if (stroke.color.startsWith('arrow:')) {
				const angle = Math.atan2(last[1] - first[1], last[0] - first[0]);
				const hl = Math.min(15, stroke.width * 4);
				ctx.beginPath();
				ctx.moveTo(last[0], last[1]);
				ctx.lineTo(last[0] - hl * Math.cos(angle - Math.PI / 6), last[1] - hl * Math.sin(angle - Math.PI / 6));
				ctx.moveTo(last[0], last[1]);
				ctx.lineTo(last[0] - hl * Math.cos(angle + Math.PI / 6), last[1] - hl * Math.sin(angle + Math.PI / 6));
				ctx.stroke();
			}
			return;
		}

		if (stroke.color === 'eraser') {
			ctx.globalCompositeOperation = 'destination-out';
			ctx.strokeStyle = 'rgba(0,0,0,1)';
		} else if (stroke.color.startsWith('hl:')) {
			ctx.globalCompositeOperation = 'source-over';
			ctx.strokeStyle = stroke.color.slice(3);
			ctx.globalAlpha = 0.25;
		} else {
			ctx.globalCompositeOperation = 'source-over';
			ctx.strokeStyle = stroke.color;
		}

		const [first, ...rest] = stroke.points;
		ctx.moveTo(first[0], first[1]);
		for (const [x, y] of rest) ctx.lineTo(x, y);
		ctx.stroke();
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
	}

	function getPos(e: PointerEvent): [number, number] {
		const rect = canvas.getBoundingClientRect();
		return [e.clientX - rect.left, e.clientY - rect.top];
	}

	// Find which image is under a point (topmost first)
	function findImageAt(pos: [number, number]): number | null {
		for (let i = allImages.length - 1; i >= 0; i--) {
			const img = allImages[i];
			if (pos[0] >= img.x && pos[0] <= img.x + img.width &&
				pos[1] >= img.y && pos[1] <= img.y + img.height) {
				return i;
			}
		}
		return null;
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		canvas.setPointerCapture(e.pointerId);
		const pos = getPos(e);

		// Move tool: drag images
		if (tool === 'move') {
			const imgIdx = findImageAt(pos);
			if (imgIdx !== null) {
				pushUndo();
				draggingImage = imgIdx;
				dragOffset = [pos[0] - allImages[imgIdx].x, pos[1] - allImages[imgIdx].y];
			}
			return;
		}

		isDrawing = true;
		pushUndo();
		let strokeColor = penColor;
		let strokeWidth = penWidth;
		if (tool === 'eraser') { strokeColor = 'eraser'; strokeWidth = penWidth * 4; }
		else if (tool === 'highlighter') { strokeColor = `hl:${penColor}`; strokeWidth = penWidth * 6; }
		else if (tool === 'arrow') { strokeColor = `arrow:${penColor}`; }
		else if (tool === 'line') { strokeColor = `line:${penColor}`; }
		currentStroke = { points: [pos], color: strokeColor, width: strokeWidth };
	}

	function handlePointerMove(e: PointerEvent) {
		const pos = getPos(e);

		// Handle image dragging
		if (tool === 'move' && draggingImage !== null) {
			const newImages = [...allImages];
			newImages[draggingImage] = {
				...newImages[draggingImage],
				x: pos[0] - dragOffset[0],
				y: pos[1] - dragOffset[1]
			};
			allImages = newImages;
			redraw();
			return;
		}

		if (!isDrawing || !currentStroke) return;
		currentStroke.points = [...currentStroke.points, pos];
		redraw();
	}

	function handlePointerUp() {
		if (tool === 'move' && draggingImage !== null) {
			draggingImage = null;
			return;
		}
		if (!isDrawing || !currentStroke) return;
		isDrawing = false;
		if (currentStroke.points.length >= 2) {
			allStrokes = [...allStrokes, currentStroke];
		} else {
			undoStack = undoStack.slice(0, -1);
		}
		currentStroke = null;
		redraw();
	}

	function undo() {
		if (undoStack.length === 0) return;
		const last = undoStack[undoStack.length - 1];
		redoStack = [...redoStack, { strokes: [...allStrokes], images: allImages.map(i => ({...i})) }];
		allStrokes = last.strokes;
		allImages = last.images;
		undoStack = undoStack.slice(0, -1);
		redraw();
	}

	function redo() {
		if (redoStack.length === 0) return;
		const next = redoStack[redoStack.length - 1];
		undoStack = [...undoStack, { strokes: [...allStrokes], images: allImages.map(i => ({...i})) }];
		allStrokes = next.strokes;
		allImages = next.images;
		redoStack = redoStack.slice(0, -1);
		redraw();
	}

	function clearAll() {
		if (allStrokes.length === 0 && allImages.length === 0) return;
		pushUndo();
		allStrokes = [];
		allImages = [];
		redraw();
	}

	// Export canvas to PNG blob and pass to parent
	async function save() {
		if (allStrokes.length === 0 && allImages.length === 0) {
			onclose();
			return;
		}

		// Find bounding box of all content
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		for (const stroke of allStrokes) {
			for (const [x, y] of stroke.points) {
				const pad = stroke.width / 2 + 2;
				minX = Math.min(minX, x - pad);
				minY = Math.min(minY, y - pad);
				maxX = Math.max(maxX, x + pad);
				maxY = Math.max(maxY, y + pad);
			}
		}

		for (const img of allImages) {
			minX = Math.min(minX, img.x);
			minY = Math.min(minY, img.y);
			maxX = Math.max(maxX, img.x + img.width);
			maxY = Math.max(maxY, img.y + img.height);
		}

		// Add small padding
		minX = Math.max(0, minX - 8);
		minY = Math.max(0, minY - 8);
		maxX += 8;
		maxY += 8;

		const w = maxX - minX;
		const h = maxY - minY;

		// Create export canvas at the bounding box size
		const exportCanvas = document.createElement('canvas');
		const dpr = window.devicePixelRatio || 1;
		exportCanvas.width = w * dpr;
		exportCanvas.height = h * dpr;
		const exportCtx = exportCanvas.getContext('2d')!;
		exportCtx.scale(dpr, dpr);
		exportCtx.translate(-minX, -minY);

		// Re-draw everything onto export canvas
		for (const img of allImages) {
			const loaded = loadedImgs.get(img.dataUrl);
			if (loaded) exportCtx.drawImage(loaded, img.x, img.y, img.width, img.height);
		}

		for (const stroke of allStrokes) {
			if (stroke.points.length < 2) continue;
			exportCtx.beginPath();
			exportCtx.lineWidth = stroke.width;
			exportCtx.lineCap = 'round';
			exportCtx.lineJoin = 'round';

			if (stroke.color.startsWith('arrow:') || stroke.color.startsWith('line:')) {
				exportCtx.globalCompositeOperation = 'source-over';
				exportCtx.strokeStyle = stroke.color.split(':')[1];
				const first = stroke.points[0], last = stroke.points[stroke.points.length - 1];
				exportCtx.moveTo(first[0], first[1]);
				exportCtx.lineTo(last[0], last[1]);
				exportCtx.stroke();
				if (stroke.color.startsWith('arrow:')) {
					const angle = Math.atan2(last[1] - first[1], last[0] - first[0]);
					const hl = Math.min(15, stroke.width * 4);
					exportCtx.beginPath();
					exportCtx.moveTo(last[0], last[1]);
					exportCtx.lineTo(last[0] - hl * Math.cos(angle - Math.PI / 6), last[1] - hl * Math.sin(angle - Math.PI / 6));
					exportCtx.moveTo(last[0], last[1]);
					exportCtx.lineTo(last[0] - hl * Math.cos(angle + Math.PI / 6), last[1] - hl * Math.sin(angle + Math.PI / 6));
					exportCtx.stroke();
				}
				continue;
			}

			if (stroke.color === 'eraser') {
				exportCtx.globalCompositeOperation = 'destination-out';
				exportCtx.strokeStyle = 'rgba(0,0,0,1)';
			} else if (stroke.color.startsWith('hl:')) {
				exportCtx.globalCompositeOperation = 'source-over';
				exportCtx.strokeStyle = stroke.color.slice(3);
				exportCtx.globalAlpha = 0.25;
			} else {
				exportCtx.globalCompositeOperation = 'source-over';
				exportCtx.strokeStyle = stroke.color;
			}

			const [first, ...rest] = stroke.points;
			exportCtx.moveTo(first[0], first[1]);
			for (const [x, y] of rest) exportCtx.lineTo(x, y);
			exportCtx.stroke();
			exportCtx.globalCompositeOperation = 'source-over';
			exportCtx.globalAlpha = 1;
		}

		// Convert to blob
		exportCanvas.toBlob((blob) => {
			if (blob) onsave(blob);
		}, 'image/png');
	}

	function handleClose() {
		const hasContent = allStrokes.length > 0 || allImages.length > 0;
		if (hasContent && !confirm('Discard drawing?')) return;
		onclose();
	}

	// Paste images onto canvas
	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (!file) continue;
				const reader = new FileReader();
				reader.onload = (ev) => addImageToCanvas(ev.target?.result as string);
				reader.readAsDataURL(file);
			}
		}
	}

	function addImageToCanvas(dataUrl: string) {
		const img = new Image();
		img.onload = () => {
			pushUndo();
			const rect = canvas.getBoundingClientRect();
			let w = img.width, h = img.height;
			const maxW = rect.width * 0.6, maxH = rect.height * 0.5;
			if (w > maxW) { h *= maxW / w; w = maxW; }
			if (h > maxH) { w *= maxH / h; h = maxH; }
			allImages = [...allImages, { dataUrl, x: (rect.width - w) / 2, y: (rect.height - h) / 2, width: w, height: h }];
			loadedImgs.set(dataUrl, img);
			redraw();
		};
		img.src = dataUrl;
	}

	function handleImageInsert(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => addImageToCanvas(ev.target?.result as string);
		reader.readAsDataURL(file);
		(e.currentTarget as HTMLInputElement).value = '';
	}
</script>

<svelte:window onpaste={handlePaste} />

<input bind:this={imageInput} type="file" accept="image/*" class="hidden" onchange={handleImageInsert} />

<div class="fixed inset-0 z-50 bg-cream flex flex-col">
	<!-- Toolbar -->
	<div class="shrink-0 bg-cream border-b border-border px-3 py-2 safe-top">
		<div class="flex items-center justify-between max-w-2xl mx-auto">
			<button class="text-sm text-muted hover:text-ink transition-colors px-2 py-1" onclick={handleClose}>
				✕ Cancel
			</button>

			<div class="flex items-center gap-1.5">
				<!-- Undo -->
				<button
					class="w-8 h-8 rounded-md flex items-center justify-center hover:bg-warm active:bg-warm transition-colors text-muted disabled:opacity-30"
					onclick={undo} disabled={undoStack.length === 0} aria-label="Undo"
				>
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4 8 L8 4 M4 8 L8 12" /><path d="M4 8 H13 A4 4 0 010 16 H10" />
					</svg>
				</button>
				<!-- Redo -->
				<button
					class="w-8 h-8 rounded-md flex items-center justify-center hover:bg-warm active:bg-warm transition-colors text-muted disabled:opacity-30"
					onclick={redo} disabled={redoStack.length === 0} aria-label="Redo"
				>
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M16 8 L12 4 M16 8 L12 12" /><path d="M16 8 H7 A4 4 0 000 16 H10" />
					</svg>
				</button>
				<!-- Insert image -->
				<button
					class="w-8 h-8 rounded-md flex items-center justify-center hover:bg-warm active:bg-warm transition-colors text-muted"
					onclick={() => imageInput?.click()} aria-label="Insert image"
				>
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="16" height="14" rx="2" /><circle cx="7" cy="8" r="1.5" /><path d="M2 14 L7 10 L11 13 L14 10 L18 14" /></svg>
				</button>
				<!-- Clear -->
				<button
					class="w-8 h-8 rounded-md flex items-center justify-center hover:bg-warm active:bg-warm transition-colors text-muted disabled:opacity-30"
					onclick={clearAll} disabled={allStrokes.length === 0 && allImages.length === 0} aria-label="Clear all"
				>
					<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
						<path d="M4 6 H16 M8 6 V4 H12 V6 M6 6 V16 H14 V6" /><path d="M9 9 V13 M11 9 V13" />
					</svg>
				</button>
			</div>

			<button
				class="text-sm bg-accent text-cream px-4 py-1.5 rounded-md hover:bg-accent-dark active:bg-accent-dark transition-colors disabled:opacity-40"
				onclick={save}
				disabled={allStrokes.length === 0 && allImages.length === 0}
			>
				{initialImageUrl ? 'Save' : 'Insert'}
			</button>
		</div>
	</div>

	<!-- Tools row -->
	<div class="shrink-0 bg-warm/30 border-b border-border px-3 py-2">
		<div class="flex items-center justify-center gap-2 max-w-lg mx-auto flex-wrap">
			<!-- Tool buttons -->
			<div class="flex rounded-md border border-border overflow-hidden">
				{#each [['pen', 'Pen'], ['highlighter', 'Hi-lite'], ['eraser', 'Eraser'], ['arrow', '→'], ['line', 'Line'], ['move', '✋']] as [t, label]}
					<button
						class="px-2.5 py-1 text-[11px] transition-colors {tool === t ? 'bg-accent text-cream' : 'text-muted hover:bg-warm'}"
						onclick={() => (tool = t as Tool)}
					>{label}</button>
				{/each}
			</div>

			<!-- Colors -->
			{#if tool !== 'eraser' && tool !== 'move'}
				<div class="flex gap-1">
					{#each colors as c}
						<button
							class="w-5 h-5 rounded-full border-2 transition-all {penColor === c ? 'border-ink scale-110' : 'border-transparent'}"
							style="background-color: {c}; {c === '#ffffff' ? 'box-shadow: inset 0 0 0 1px #ccc' : ''}"
							onclick={() => (penColor = c)}
						></button>
					{/each}
				</div>
			{/if}

			<!-- Widths -->
			{#if tool !== 'move'}
				<div class="flex gap-1 items-center">
					{#each widths as w}
						<button
							class="rounded-full transition-all flex items-center justify-center {penWidth === w ? 'bg-ink' : 'bg-border'}"
							style="width: {Math.max(w * 2.5, 12)}px; height: {Math.max(w * 2.5, 12)}px"
							onclick={() => (penWidth = w)}
						>
							<span class="rounded-full {penWidth === w ? 'bg-cream' : 'bg-muted'}" style="width: {Math.max(w, 2)}px; height: {Math.max(w, 2)}px"></span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Canvas -->
	<div class="flex-1 overflow-hidden relative">
		<canvas
			bind:this={canvas}
			class="absolute inset-0 w-full h-full touch-none {tool === 'move' ? 'cursor-grab' : 'cursor-crosshair'}"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
		></canvas>
	</div>
</div>
