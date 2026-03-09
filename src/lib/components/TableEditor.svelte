<script lang="ts">
	import { fly } from 'svelte/transition';

	interface Props {
		onsave: (csvContent: string, metadata: Record<string, string>) => void;
		onclose: () => void;
		initialCsv?: string;
		initialMetadata?: Record<string, string>;
	}

	let { onsave, onclose, initialCsv, initialMetadata }: Props = $props();

	// Parse initial CSV or start with empty 4×3 grid
	let data = $state<string[][]>(
		initialCsv ? parseCsv(initialCsv) : makeEmptyGrid(4, 3)
	);
	let tableName = $state(initialMetadata?.filename || '');
	let selectedCell = $state<[number, number] | null>(null);
	let editingCell = $state<[number, number] | null>(null);
	let editValue = $state('');
	let editInput: HTMLInputElement | undefined = $state();
	let showMore = $state(false);
	let selectedCol = $state<number | null>(null);
	let selectedRow = $state<number | null>(null);

	// Derived
	let rows = $derived(data.length);
	let cols = $derived(data[0]?.length || 0);
	let hasSelection = $derived(selectedCell !== null);

	function makeEmptyGrid(r: number, c: number): string[][] {
		return Array.from({ length: r }, () => Array(c).fill(''));
	}

	function parseCsv(text: string): string[][] {
		const delimiter = text.includes('\t') ? '\t' : ',';
		const rows: string[][] = [];
		let current = '';
		let inQuotes = false;
		let cells: string[] = [];

		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			if (inQuotes) {
				if (char === '"' && text[i + 1] === '"') { current += '"'; i++; }
				else if (char === '"') { inQuotes = false; }
				else { current += char; }
			} else {
				if (char === '"') { inQuotes = true; }
				else if (char === delimiter) { cells.push(current); current = ''; }
				else if (char === '\n' || (char === '\r' && text[i + 1] === '\n')) {
					cells.push(current);
					if (cells.length > 0) rows.push(cells);
					cells = []; current = '';
					if (char === '\r') i++;
				} else { current += char; }
			}
		}
		cells.push(current);
		if (cells.length > 0) rows.push(cells);

		// Normalize column count
		const maxCols = Math.max(...rows.map(r => r.length));
		return rows.map(r => {
			while (r.length < maxCols) r.push('');
			return r;
		});
	}

	function toCsv(): string {
		return data.map(row =>
			row.map(cell => {
				if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
					return '"' + cell.replace(/"/g, '""') + '"';
				}
				return cell;
			}).join(',')
		).join('\n');
	}

	function selectCell(r: number, c: number) {
		if (editingCell && (editingCell[0] !== r || editingCell[1] !== c)) {
			commitEdit();
		}
		selectedCell = [r, c];
		selectedRow = r;
		selectedCol = c;
		showMore = false;
	}

	function startEdit(r: number, c: number) {
		selectCell(r, c);
		editingCell = [r, c];
		editValue = data[r][c];
		requestAnimationFrame(() => editInput?.focus());
	}

	function commitEdit() {
		if (editingCell) {
			const [r, c] = editingCell;
			data[r][c] = editValue;
			data = [...data];
			editingCell = null;
		}
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			commitEdit();
			// Move down
			if (selectedCell && selectedCell[0] < rows - 1) {
				selectCell(selectedCell[0] + 1, selectedCell[1]);
			}
		} else if (e.key === 'Tab') {
			e.preventDefault();
			commitEdit();
			if (selectedCell) {
				const nextCol = e.shiftKey ? selectedCell[1] - 1 : selectedCell[1] + 1;
				if (nextCol >= 0 && nextCol < cols) {
					selectCell(selectedCell[0], nextCol);
				} else if (!e.shiftKey && selectedCell[0] < rows - 1) {
					selectCell(selectedCell[0] + 1, 0);
				}
			}
		} else if (e.key === 'Escape') {
			editingCell = null;
		}
	}

	function handleCellKeydown(e: KeyboardEvent) {
		if (!selectedCell || editingCell) return;
		const [r, c] = selectedCell;

		if (e.key === 'ArrowDown' && r < rows - 1) { selectCell(r + 1, c); e.preventDefault(); }
		else if (e.key === 'ArrowUp' && r > 0) { selectCell(r - 1, c); e.preventDefault(); }
		else if (e.key === 'ArrowRight' && c < cols - 1) { selectCell(r, c + 1); e.preventDefault(); }
		else if (e.key === 'ArrowLeft' && c > 0) { selectCell(r, c - 1); e.preventDefault(); }
		else if (e.key === 'Enter') { startEdit(r, c); e.preventDefault(); }
		else if (e.key === 'Delete' || e.key === 'Backspace') {
			data[r][c] = '';
			data = [...data];
			e.preventDefault();
		} else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
			// Start typing into cell
			editValue = e.key;
			editingCell = [r, c];
			requestAnimationFrame(() => editInput?.focus());
			e.preventDefault();
		}
	}

	// Table operations
	function addRow() {
		const insertAt = selectedCell ? selectedCell[0] + 1 : data.length;
		const newRow = Array(cols).fill('');
		data.splice(insertAt, 0, newRow);
		data = [...data];
		selectCell(insertAt, selectedCell?.[1] ?? 0);
	}

	function addCol() {
		const insertAt = selectedCell ? selectedCell[1] + 1 : cols;
		for (const row of data) {
			row.splice(insertAt, 0, '');
		}
		data = [...data];
		selectCell(selectedCell?.[0] ?? 0, insertAt);
	}

	function deleteRow() {
		if (rows <= 1) return;
		const delAt = selectedCell ? selectedCell[0] : rows - 1;
		data.splice(delAt, 1);
		data = [...data];
		if (selectedCell) {
			const newR = Math.min(delAt, data.length - 1);
			selectCell(newR, selectedCell[1]);
		}
	}

	function deleteCol() {
		if (cols <= 1) return;
		const delAt = selectedCell ? selectedCell[1] : cols - 1;
		for (const row of data) {
			row.splice(delAt, 1);
		}
		data = [...data];
		if (selectedCell) {
			const newC = Math.min(delAt, data[0].length - 1);
			selectCell(selectedCell[0], newC);
		}
	}

	function sortColAsc() {
		if (selectedCol === null || rows <= 1) return;
		const c = selectedCol;
		const header = data[0];
		const body = data.slice(1);
		body.sort((a, b) => a[c].localeCompare(b[c], undefined, { numeric: true }));
		data = [header, ...body];
	}

	function sortColDesc() {
		if (selectedCol === null || rows <= 1) return;
		const c = selectedCol;
		const header = data[0];
		const body = data.slice(1);
		body.sort((a, b) => b[c].localeCompare(a[c], undefined, { numeric: true }));
		data = [header, ...body];
	}

	function clearCell() {
		if (!selectedCell) return;
		const [r, c] = selectedCell;
		data[r][c] = '';
		data = [...data];
	}

	function handleSave() {
		commitEdit();
		const meta: Record<string, string> = {};
		if (tableName.trim()) meta.filename = tableName.trim();
		onsave(toCsv(), meta);
	}

	function handleBackdrop(e: MouseEvent) {
		if (editingCell) commitEdit();
		if (showMore) showMore = false;
	}

	// Column letter helper
	function colLetter(idx: number): string {
		let s = '';
		let n = idx;
		while (n >= 0) {
			s = String.fromCharCode(65 + (n % 26)) + s;
			n = Math.floor(n / 26) - 1;
		}
		return s;
	}
</script>

<svelte:window onkeydown={handleCellKeydown} />

<div
	class="fixed inset-0 z-50 flex flex-col bg-cream"
	transition:fly={{ y: 40, duration: 250 }}
>
	<!-- Header -->
	<header class="shrink-0 bg-cream/95 backdrop-blur-sm border-b border-border safe-top z-20">
		<div class="flex items-center gap-2 px-3 py-2">
			<button
				class="w-8 h-8 flex items-center justify-center rounded-md
					   hover:bg-warm active:bg-warm transition-colors text-muted"
				onclick={onclose}
				aria-label="Close"
			>
				<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
					<path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
				</svg>
			</button>

			<input
				type="text"
				bind:value={tableName}
				placeholder="Table name..."
				class="flex-1 bg-transparent text-sm font-heading text-ink outline-none
					   placeholder:text-muted/40 min-w-0"
			/>

			<button
				class="px-4 py-1.5 rounded-lg bg-accent text-cream text-sm font-medium
					   active:scale-95 transition-transform"
				onclick={handleSave}
			>
				Save
			</button>
		</div>

		<!-- Formula/cell bar -->
		{#if editingCell}
			<div class="flex items-center gap-2 px-3 py-1.5 border-t border-border/50 bg-warm/20">
				<span class="text-[11px] font-mono text-muted w-8 text-center shrink-0">
					{colLetter(editingCell[1])}{editingCell[0] + 1}
				</span>
				<input
					bind:this={editInput}
					bind:value={editValue}
					class="flex-1 bg-transparent text-sm text-ink outline-none"
					onkeydown={handleEditKeydown}
					onblur={commitEdit}
				/>
			</div>
		{:else if selectedCell}
			<div class="flex items-center gap-2 px-3 py-1.5 border-t border-border/50 bg-warm/20">
				<span class="text-[11px] font-mono text-muted w-8 text-center shrink-0">
					{colLetter(selectedCell[1])}{selectedCell[0] + 1}
				</span>
				<span class="text-sm text-ink truncate">
					{data[selectedCell[0]]?.[selectedCell[1]] || ''}
				</span>
			</div>
		{/if}
	</header>

	<!-- Spreadsheet grid -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<main
		class="flex-1 overflow-auto relative"
		onclick={handleBackdrop}
	>
		<table class="border-collapse min-w-full">
			<!-- Column header row (A, B, C...) -->
			<thead class="sticky top-0 z-10">
				<tr>
					<th class="w-10 min-w-[40px] bg-warm/80 border-b border-r border-border text-[10px] text-muted font-normal sticky left-0 z-20"></th>
					{#each Array(cols) as _, c}
						<th
							class="min-w-[100px] px-2 py-1.5 bg-warm/80 border-b border-r border-border
								   text-[10px] font-medium text-muted text-center cursor-pointer
								   {selectedCol === c ? 'bg-accent/10 text-accent' : ''}"
							onclick={(e) => { e.stopPropagation(); selectedCol = c; }}
						>
							{colLetter(c)}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data as row, r}
					<tr>
						<!-- Row number -->
						<td
							class="bg-warm/40 border-b border-r border-border text-[10px] text-muted
								   text-center font-mono py-1 sticky left-0 z-[5] cursor-pointer
								   {selectedRow === r ? 'bg-accent/10 text-accent font-semibold' : ''}"
							onclick={(e) => { e.stopPropagation(); selectedRow = r; selectedCell = [r, 0]; }}
						>
							{r + 1}
						</td>
						{#each row as cell, c}
							{@const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c}
							{@const isEditing = editingCell?.[0] === r && editingCell?.[1] === c}
							{@const isHeader = r === 0}
							<td
								class="border-b border-r border-border px-2 py-1 text-sm cursor-cell
									   transition-colors relative
									   {isHeader ? 'font-semibold bg-warm/15' : 'bg-cream'}
									   {isSelected && !isEditing ? 'outline outline-2 outline-accent outline-offset-[-2px] bg-accent/5' : ''}
									   {isEditing ? 'p-0' : ''}"
								onclick={(e) => { e.stopPropagation(); selectCell(r, c); }}
								ondblclick={(e) => { e.stopPropagation(); startEdit(r, c); }}
							>
								{#if isEditing}
									<!-- Edit handled via header bar input -->
									<div class="px-2 py-1 text-sm text-accent/60 truncate min-h-[24px]">
										{editValue}
									</div>
								{:else}
									<div class="truncate min-h-[24px] flex items-center">
										{cell}
									</div>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</main>

	<!-- Bottom toolbar -->
	<div class="shrink-0 bg-cream/95 backdrop-blur-sm border-t border-border safe-bottom z-20">
		<div class="flex items-center justify-around max-w-lg mx-auto px-1 py-1.5 gap-0.5">
			<!-- Add Row -->
			<button
				class="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-md
					   active:bg-warm transition-colors min-w-[40px]"
				onclick={addRow}
				aria-label="Add row"
			>
				<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
					<rect x="2" y="4" width="16" height="12" rx="1.5" />
					<line x1="2" y1="10" x2="18" y2="10" />
					<line x1="10" y1="12" x2="10" y2="18" />
					<line x1="7" y1="15" x2="13" y2="15" />
				</svg>
				<span class="text-[9px] text-muted">+ Row</span>
			</button>

			<!-- Add Column -->
			<button
				class="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-md
					   active:bg-warm transition-colors min-w-[40px]"
				onclick={addCol}
				aria-label="Add column"
			>
				<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
					<rect x="3" y="2" width="14" height="16" rx="1.5" />
					<line x1="10" y1="2" x2="10" y2="18" />
					<line x1="12" y1="10" x2="18" y2="10" />
					<line x1="15" y1="7" x2="15" y2="13" />
				</svg>
				<span class="text-[9px] text-muted">+ Col</span>
			</button>

			<!-- Delete Row -->
			<button
				class="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-md
					   active:bg-warm transition-colors min-w-[40px]
					   {!hasSelection ? 'opacity-30 pointer-events-none' : ''}"
				onclick={deleteRow}
				aria-label="Delete row"
			>
				<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
					<rect x="2" y="4" width="16" height="12" rx="1.5" />
					<line x1="2" y1="10" x2="18" y2="10" />
					<line x1="7" y1="14" x2="13" y2="14" stroke="var(--red-ink)" />
				</svg>
				<span class="text-[9px] text-muted">− Row</span>
			</button>

			<!-- Delete Column -->
			<button
				class="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-md
					   active:bg-warm transition-colors min-w-[40px]
					   {!hasSelection ? 'opacity-30 pointer-events-none' : ''}"
				onclick={deleteCol}
				aria-label="Delete column"
			>
				<svg class="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
					<rect x="3" y="2" width="14" height="16" rx="1.5" />
					<line x1="10" y1="2" x2="10" y2="18" />
					<line x1="12" y1="10" x2="18" y2="10" stroke="var(--red-ink)" />
				</svg>
				<span class="text-[9px] text-muted">− Col</span>
			</button>

			<!-- Sort -->
			<div class="relative">
				<button
					class="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-md
						   transition-colors min-w-[40px]
						   {showMore ? 'bg-accent text-cream' : 'active:bg-warm'}
						   {selectedCol === null ? 'opacity-30 pointer-events-none' : ''}"
					onclick={() => (showMore = !showMore)}
					aria-label="More options"
				>
					<svg class="w-5 h-5" class:text-cream={showMore} class:text-muted={!showMore} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M6 13L10 17L14 13" />
						<path d="M6 7L10 3L14 7" />
					</svg>
					<span class="text-[9px]" class:text-muted={!showMore}>Sort</span>
				</button>

				{#if showMore}
					<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-xl shadow-lg p-1.5 min-w-[130px]">
						<button
							class="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-ink hover:bg-warm transition-colors"
							onclick={() => { sortColAsc(); showMore = false; }}
						>
							<svg class="w-4 h-4 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M8 2V14M5 5L8 2L11 5" /></svg>
							A → Z
						</button>
						<button
							class="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-ink hover:bg-warm transition-colors"
							onclick={() => { sortColDesc(); showMore = false; }}
						>
							<svg class="w-4 h-4 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M8 2V14M5 11L8 14L11 11" /></svg>
							Z → A
						</button>
						<div class="border-t border-border my-1"></div>
						<button
							class="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-ink hover:bg-warm transition-colors"
							onclick={() => { clearCell(); showMore = false; }}
						>
							<svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 4H14M5 4V2H11V4M6 7V12M10 7V12" /></svg>
							Clear Cell
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
