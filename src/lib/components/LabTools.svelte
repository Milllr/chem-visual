<script lang="ts">
	let activeCalc = $state<string>('dilution');

	// --- Dilution Calculator (C₁V₁ = C₂V₂) ---
	let c1 = $state(0); let v1 = $state(0);
	let c2 = $state(0); let v2 = $state(0);
	let dilSolve = $state<'v2' | 'c2' | 'v1' | 'c1'>('v2');

	let dilResult = $derived(() => {
		switch (dilSolve) {
			case 'v2': return c1 && v1 && c2 ? (c1 * v1) / c2 : 0;
			case 'c2': return c1 && v1 && v2 ? (c1 * v1) / v2 : 0;
			case 'v1': return c2 && v2 && c1 ? (c2 * v2) / c1 : 0;
			case 'c1': return c2 && v2 && v1 ? (c2 * v2) / v1 : 0;
		}
	});

	// --- Molarity Calculator ---
	let molMass = $state(0); // g
	let molMw = $state(0); // g/mol
	let molVol = $state(0); // L
	let molSolve = $state<'M' | 'mass' | 'vol'>('M');

	let molResult = $derived(() => {
		switch (molSolve) {
			case 'M': return molMw && molVol ? (molMass / molMw) / molVol : 0;
			case 'mass': {
				// Solve for mass: need M, MW, vol
				const M = molMass; // reuse field as M input for this mode
				return molMw && molVol ? M * molMw * molVol : 0;
			}
			case 'vol': return molMw && molMass ? molMass / (molMw * molVol) : 0;
		}
	});

	// --- Percent Yield ---
	let actualYield = $state(0);
	let theoreticalYield = $state(0);
	let percentYield = $derived(theoreticalYield > 0 ? (actualYield / theoreticalYield) * 100 : 0);

	// --- Unit Conversions ---
	let convValue = $state(0);
	let convType = $state<'temp' | 'mass' | 'vol' | 'pressure'>('temp');
	let convFrom = $state('');
	let convTo = $state('');

	const convUnits: Record<string, string[]> = {
		temp: ['°C', '°F', 'K'],
		mass: ['g', 'mg', 'kg', 'μg', 'oz', 'lb'],
		vol: ['mL', 'L', 'μL', 'gal', 'fl oz'],
		pressure: ['atm', 'Pa', 'kPa', 'bar', 'mmHg', 'psi']
	};

	$effect(() => {
		const units = convUnits[convType];
		if (units) {
			convFrom = units[0];
			convTo = units[1] || units[0];
		}
	});

	function convert(val: number, from: string, to: string): number {
		if (from === to) return val;
		// Temperature
		if (from === '°C' && to === '°F') return val * 9/5 + 32;
		if (from === '°F' && to === '°C') return (val - 32) * 5/9;
		if (from === '°C' && to === 'K') return val + 273.15;
		if (from === 'K' && to === '°C') return val - 273.15;
		if (from === '°F' && to === 'K') return (val - 32) * 5/9 + 273.15;
		if (from === 'K' && to === '°F') return (val - 273.15) * 9/5 + 32;

		// Mass (normalize to grams)
		const toG: Record<string, number> = { g: 1, mg: 0.001, kg: 1000, 'μg': 1e-6, oz: 28.3495, lb: 453.592 };
		if (toG[from] != null && toG[to] != null) return val * toG[from] / toG[to];

		// Volume (normalize to mL)
		const toML: Record<string, number> = { mL: 1, L: 1000, 'μL': 0.001, gal: 3785.41, 'fl oz': 29.5735 };
		if (toML[from] != null && toML[to] != null) return val * toML[from] / toML[to];

		// Pressure (normalize to atm)
		const toAtm: Record<string, number> = { atm: 1, Pa: 1/101325, kPa: 1/101.325, bar: 1/1.01325, mmHg: 1/760, psi: 1/14.696 };
		if (toAtm[from] != null && toAtm[to] != null) return val * toAtm[from] / toAtm[to];

		return val;
	}

	let convResult = $derived(convert(convValue, convFrom, convTo));

	// --- Limiting Reagent ---
	let lrReagents = $state<{ name: string; mw: number; mass: number; coeff: number }[]>([
		{ name: '', mw: 0, mass: 0, coeff: 1 },
		{ name: '', mw: 0, mass: 0, coeff: 1 }
	]);

	let limitingResult = $derived(() => {
		const valid = lrReagents.filter(r => r.mw > 0 && r.mass > 0 && r.coeff > 0);
		if (valid.length < 2) return null;
		const ratios = valid.map(r => ({
			...r,
			moles: r.mass / r.mw,
			molesPerCoeff: (r.mass / r.mw) / r.coeff
		}));
		const minRatio = Math.min(...ratios.map(r => r.molesPerCoeff));
		const limiting = ratios.find(r => r.molesPerCoeff === minRatio);
		const excess = ratios.filter(r => r !== limiting).map(r => ({
			...r,
			excessMoles: r.moles - (minRatio * r.coeff),
			excessMass: (r.moles - (minRatio * r.coeff)) * r.mw
		}));
		return { limiting, excess, ratios };
	});

	function addLrReagent() {
		lrReagents = [...lrReagents, { name: '', mw: 0, mass: 0, coeff: 1 }];
	}

	function removeLrReagent(idx: number) {
		if (lrReagents.length <= 2) return;
		lrReagents = lrReagents.filter((_, i) => i !== idx);
	}

	// --- Ideal Gas Law (PV = nRT) ---
	let igP = $state(1); // atm
	let igV = $state(0); // L
	let igN = $state(0); // mol
	let igT = $state(298.15); // K
	let igSolve = $state<'P' | 'V' | 'n' | 'T'>('V');
	const R = 0.08206; // L·atm/(mol·K)

	let igResult = $derived(() => {
		switch (igSolve) {
			case 'P': return igN && igT && igV ? (igN * R * igT) / igV : 0;
			case 'V': return igN && igT && igP ? (igN * R * igT) / igP : 0;
			case 'n': return igP && igV && igT ? (igP * igV) / (R * igT) : 0;
			case 'T': return igP && igV && igN ? (igP * igV) / (igN * R) : 0;
		}
	});

	const calcs = [
		{ id: 'dilution', label: 'Dilution' },
		{ id: 'molarity', label: 'Molarity' },
		{ id: 'yield', label: '% Yield' },
		{ id: 'convert', label: 'Units' },
		{ id: 'equiv', label: 'Equiv' },
		{ id: 'gas', label: 'Gas Law' }
	];

	function fmtNum(n: number): string {
		if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(3);
		if (Math.abs(n) >= 1e6) return n.toExponential(3);
		return n.toFixed(4).replace(/\.?0+$/, '') || '0';
	}
</script>

<div class="p-4 space-y-4">
	<!-- Calculator selector -->
	<div class="flex flex-wrap gap-1.5">
		{#each calcs as c}
			<button
				class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
				class:bg-accent={activeCalc === c.id}
				class:text-cream={activeCalc === c.id}
				class:border-accent={activeCalc === c.id}
				class:bg-cream={activeCalc !== c.id}
				class:text-muted={activeCalc !== c.id}
				class:border-border={activeCalc !== c.id}
				onclick={() => (activeCalc = c.id)}
			>
				{c.label}
			</button>
		{/each}
	</div>

	<!-- Calculator panels -->
	<div class="rounded-xl border border-border bg-card/50 overflow-hidden">

		{#if activeCalc === 'dilution'}
			<!-- C1V1 = C2V2 -->
			<div class="px-4 py-3 bg-warm/30 border-b border-border">
				<h3 class="text-sm font-medium text-ink">Dilution Calculator</h3>
				<p class="text-[10px] text-muted mt-0.5">C₁V₁ = C₂V₂</p>
			</div>
			<div class="p-4 space-y-3">
				<div class="flex items-center gap-2">
					<span class="text-xs text-muted w-8">Solve:</span>
					<select bind:value={dilSolve} class="flex-1 bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs outline-none">
						<option value="v2">V₂ (final volume)</option>
						<option value="c2">C₂ (final concentration)</option>
						<option value="v1">V₁ (initial volume)</option>
						<option value="c1">C₁ (initial concentration)</option>
					</select>
				</div>

				{#if dilSolve !== 'c1'}
					<div class="flex items-center gap-2">
						<label class="text-xs text-muted w-8">C₁</label>
						<input type="number" step="any" bind:value={c1} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
						<span class="text-[10px] text-muted w-6">M</span>
					</div>
				{/if}
				{#if dilSolve !== 'v1'}
					<div class="flex items-center gap-2">
						<label class="text-xs text-muted w-8">V₁</label>
						<input type="number" step="any" bind:value={v1} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
						<span class="text-[10px] text-muted w-6">mL</span>
					</div>
				{/if}
				{#if dilSolve !== 'c2'}
					<div class="flex items-center gap-2">
						<label class="text-xs text-muted w-8">C₂</label>
						<input type="number" step="any" bind:value={c2} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
						<span class="text-[10px] text-muted w-6">M</span>
					</div>
				{/if}
				{#if dilSolve !== 'v2'}
					<div class="flex items-center gap-2">
						<label class="text-xs text-muted w-8">V₂</label>
						<input type="number" step="any" bind:value={v2} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
						<span class="text-[10px] text-muted w-6">mL</span>
					</div>
				{/if}

				<div class="rounded-lg bg-accent/5 border border-accent/20 px-3 py-2">
					<p class="text-xs text-muted">Result</p>
					<p class="text-lg font-mono font-semibold text-ink">
						{fmtNum(dilResult())}
						<span class="text-xs text-muted font-normal">
							{dilSolve === 'v2' || dilSolve === 'v1' ? 'mL' : 'M'}
						</span>
					</p>
				</div>
			</div>

		{:else if activeCalc === 'molarity'}
			<!-- Molarity -->
			<div class="px-4 py-3 bg-warm/30 border-b border-border">
				<h3 class="text-sm font-medium text-ink">Molarity Calculator</h3>
				<p class="text-[10px] text-muted mt-0.5">M = (mass / MW) / volume</p>
			</div>
			<div class="p-4 space-y-3">
				<div class="flex items-center gap-2">
					<label class="text-xs text-muted w-12">Mass</label>
					<input type="number" step="any" bind:value={molMass} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
					<span class="text-[10px] text-muted w-10">g</span>
				</div>
				<div class="flex items-center gap-2">
					<label class="text-xs text-muted w-12">MW</label>
					<input type="number" step="any" bind:value={molMw} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
					<span class="text-[10px] text-muted w-10">g/mol</span>
				</div>
				<div class="flex items-center gap-2">
					<label class="text-xs text-muted w-12">Volume</label>
					<input type="number" step="any" bind:value={molVol} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
					<span class="text-[10px] text-muted w-10">L</span>
				</div>

				<div class="rounded-lg bg-accent/5 border border-accent/20 px-3 py-2">
					<p class="text-xs text-muted">Molarity</p>
					<p class="text-lg font-mono font-semibold text-ink">
						{molMw > 0 && molVol > 0 ? fmtNum((molMass / molMw) / molVol) : '—'}
						<span class="text-xs text-muted font-normal">M</span>
					</p>
					{#if molMw > 0 && molVol > 0}
						<p class="text-[10px] text-muted mt-0.5">= {fmtNum(molMass / molMw)} mol in {molVol} L</p>
					{/if}
				</div>
			</div>

		{:else if activeCalc === 'yield'}
			<!-- Percent Yield -->
			<div class="px-4 py-3 bg-warm/30 border-b border-border">
				<h3 class="text-sm font-medium text-ink">Percent Yield</h3>
				<p class="text-[10px] text-muted mt-0.5">% = (actual / theoretical) × 100</p>
			</div>
			<div class="p-4 space-y-3">
				<div class="flex items-center gap-2">
					<label class="text-xs text-muted w-20">Actual</label>
					<input type="number" step="any" bind:value={actualYield} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
					<span class="text-[10px] text-muted w-4">g</span>
				</div>
				<div class="flex items-center gap-2">
					<label class="text-xs text-muted w-20">Theoretical</label>
					<input type="number" step="any" bind:value={theoreticalYield} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
					<span class="text-[10px] text-muted w-4">g</span>
				</div>

				<div class="rounded-lg bg-accent/5 border border-accent/20 px-3 py-2">
					<p class="text-xs text-muted">Yield</p>
					<p class="text-lg font-mono font-semibold text-ink">
						{fmtNum(percentYield)}
						<span class="text-xs text-muted font-normal">%</span>
					</p>
					{#if percentYield > 100}
						<p class="text-[10px] text-red-ink mt-0.5">Yield exceeds theoretical — check measurements</p>
					{:else if percentYield > 0 && percentYield <= 30}
						<p class="text-[10px] text-muted mt-0.5">Low yield — consider optimizing conditions</p>
					{:else if percentYield > 90}
						<p class="text-[10px] text-muted mt-0.5">Excellent yield</p>
					{/if}
				</div>
			</div>

		{:else if activeCalc === 'convert'}
			<!-- Unit Conversions -->
			<div class="px-4 py-3 bg-warm/30 border-b border-border">
				<h3 class="text-sm font-medium text-ink">Unit Converter</h3>
			</div>
			<div class="p-4 space-y-3">
				<div class="flex gap-1.5">
					{#each [{ id: 'temp', l: 'Temp' }, { id: 'mass', l: 'Mass' }, { id: 'vol', l: 'Vol' }, { id: 'pressure', l: 'Press' }] as t}
						<button
							class="flex-1 text-[10px] py-1 rounded-lg border transition-colors"
							class:bg-accent={convType === t.id}
							class:text-cream={convType === t.id}
							class:border-accent={convType === t.id}
							class:border-border={convType !== t.id}
							class:text-muted={convType !== t.id}
							onclick={() => (convType = t.id as any)}
						>{t.l}</button>
					{/each}
				</div>

				<div class="flex items-center gap-2">
					<input type="number" step="any" bind:value={convValue} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
					<select bind:value={convFrom} class="w-16 bg-warm/50 border border-border rounded-lg px-1 py-1.5 text-xs outline-none">
						{#each convUnits[convType] || [] as u}
							<option value={u}>{u}</option>
						{/each}
					</select>
				</div>

				<div class="flex justify-center">
					<svg class="w-4 h-4 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3V13M5 10L8 13L11 10" /></svg>
				</div>

				<div class="flex items-center gap-2">
					<div class="flex-1 bg-accent/5 border border-accent/20 rounded-lg px-3 py-1.5 text-sm font-mono font-semibold text-ink">
						{fmtNum(convResult)}
					</div>
					<select bind:value={convTo} class="w-16 bg-warm/50 border border-border rounded-lg px-1 py-1.5 text-xs outline-none">
						{#each convUnits[convType] || [] as u}
							<option value={u}>{u}</option>
						{/each}
					</select>
				</div>
			</div>

		{:else if activeCalc === 'equiv'}
			<!-- Equivalence Calculator -->
			<div class="px-4 py-3 bg-warm/30 border-b border-border">
				<h3 class="text-sm font-medium text-ink">Equivalence Calculator</h3>
				<p class="text-[10px] text-muted mt-0.5">Calculate molar equivalents relative to the limiting reagent</p>
			</div>
			<div class="p-4 space-y-3">
				{#each lrReagents as r, i}
					<div class="rounded-lg bg-warm/20 p-2.5 space-y-1.5">
						<div class="flex items-center gap-2">
							<input type="text" bind:value={r.name} placeholder="Reagent name" class="flex-1 bg-transparent border-b border-border text-xs outline-none placeholder:text-muted/40 pb-0.5" />
							{#if lrReagents.length > 2}
								<button class="text-muted hover:text-red-ink text-xs" onclick={() => removeLrReagent(i)}>x</button>
							{/if}
						</div>
						<div class="grid grid-cols-3 gap-2">
							<div>
								<label class="text-[10px] text-muted">MW (g/mol)</label>
								<input type="number" step="any" bind:value={r.mw} class="w-full bg-warm/50 border border-border rounded px-2 py-1 text-xs font-mono outline-none" />
							</div>
							<div>
								<label class="text-[10px] text-muted">Mass (g)</label>
								<input type="number" step="any" bind:value={r.mass} class="w-full bg-warm/50 border border-border rounded px-2 py-1 text-xs font-mono outline-none" />
							</div>
							<div>
								<label class="text-[10px] text-muted">Coeff</label>
								<input type="number" step="1" min="1" bind:value={r.coeff} class="w-full bg-warm/50 border border-border rounded px-2 py-1 text-xs font-mono outline-none" />
							</div>
						</div>
					</div>
				{/each}

				<button
					class="w-full text-xs py-1.5 rounded-lg border border-dashed border-border text-muted hover:text-accent hover:border-accent transition-colors"
					onclick={addLrReagent}
				>+ Add Reagent</button>

				{#if limitingResult()}
					{@const lr = limitingResult()}
					<div class="rounded-lg bg-accent/5 border border-accent/20 px-3 py-2 space-y-2">
						{#if lr.limiting}
							<div>
								<p class="text-[10px] font-semibold text-muted uppercase tracking-wide">Limiting Reagent</p>
								<p class="text-sm font-semibold text-ink">{lr.limiting.name || 'Reagent'}</p>
								<p class="text-[10px] text-muted">{fmtNum(lr.limiting.moles)} mol · 1.00 equiv (reference)</p>
							</div>
						{/if}
						{#if lr.excess.length > 0}
							<div class="border-t border-border/30 pt-2 space-y-1.5">
								<p class="text-[10px] font-semibold text-muted uppercase tracking-wide">Equivalents</p>
								{#each lr.ratios as r}
									{#if r !== lr.limiting}
										{@const equiv = lr.limiting ? r.moles / lr.limiting.moles : 0}
										<div class="flex items-center justify-between text-xs">
											<span class="text-ink">{r.name || 'Reagent'}</span>
											<div class="text-right">
												<span class="font-mono font-semibold text-ink">{fmtNum(equiv)} equiv</span>
												<span class="text-[10px] text-muted ml-1">({fmtNum(r.moles)} mol)</span>
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
						{#each lr.excess as ex}
							<p class="text-[10px] text-muted">
								{ex.name || 'Reagent'}: {fmtNum(ex.excessMoles)} mol excess ({fmtNum(ex.excessMass)} g extra)
							</p>
						{/each}
					</div>
				{/if}
			</div>

		{:else if activeCalc === 'gas'}
			<!-- Ideal Gas Law -->
			<div class="px-4 py-3 bg-warm/30 border-b border-border">
				<h3 class="text-sm font-medium text-ink">Ideal Gas Law</h3>
				<p class="text-[10px] text-muted mt-0.5">PV = nRT (R = 0.08206 L·atm/mol·K)</p>
			</div>
			<div class="p-4 space-y-3">
				<div class="flex items-center gap-2">
					<span class="text-xs text-muted w-12">Solve:</span>
					<select bind:value={igSolve} class="flex-1 bg-warm/50 border border-border rounded-lg px-2 py-1.5 text-xs outline-none">
						<option value="V">V (volume)</option>
						<option value="P">P (pressure)</option>
						<option value="n">n (moles)</option>
						<option value="T">T (temperature)</option>
					</select>
				</div>

				{#if igSolve !== 'P'}
					<div class="flex items-center gap-2">
						<label class="text-xs text-muted w-12">P</label>
						<input type="number" step="any" bind:value={igP} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
						<span class="text-[10px] text-muted w-10">atm</span>
					</div>
				{/if}
				{#if igSolve !== 'V'}
					<div class="flex items-center gap-2">
						<label class="text-xs text-muted w-12">V</label>
						<input type="number" step="any" bind:value={igV} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
						<span class="text-[10px] text-muted w-10">L</span>
					</div>
				{/if}
				{#if igSolve !== 'n'}
					<div class="flex items-center gap-2">
						<label class="text-xs text-muted w-12">n</label>
						<input type="number" step="any" bind:value={igN} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
						<span class="text-[10px] text-muted w-10">mol</span>
					</div>
				{/if}
				{#if igSolve !== 'T'}
					<div class="flex items-center gap-2">
						<label class="text-xs text-muted w-12">T</label>
						<input type="number" step="any" bind:value={igT} class="flex-1 bg-warm/50 border border-border rounded-lg px-3 py-1.5 text-sm font-mono outline-none" />
						<span class="text-[10px] text-muted w-10">K</span>
					</div>
				{/if}

				<div class="rounded-lg bg-accent/5 border border-accent/20 px-3 py-2">
					<p class="text-xs text-muted">Result</p>
					<p class="text-lg font-mono font-semibold text-ink">
						{fmtNum(igResult())}
						<span class="text-xs text-muted font-normal">
							{igSolve === 'P' ? 'atm' : igSolve === 'V' ? 'L' : igSolve === 'n' ? 'mol' : 'K'}
						</span>
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
