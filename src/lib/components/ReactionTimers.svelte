<script lang="ts">
	import { fly } from 'svelte/transition';

	interface TimerItem {
		id: string;
		label: string;
		duration: number;    // total seconds
		remaining: number;   // seconds left
		running: boolean;
		startedAt?: number;  // timestamp
	}

	interface Props {
		timers: TimerItem[];
		onremove: (id: string) => void;
		ontoggle: (id: string) => void;
	}

	let { timers, onremove, ontoggle }: Props = $props();

	let now = $state(Date.now());

	// Tick every second
	$effect(() => {
		if (timers.some(t => t.running)) {
			const interval = setInterval(() => {
				now = Date.now();
				// Check for completed timers
				for (const t of timers) {
					if (t.running && t.remaining <= 0) {
						notifyDone(t);
					}
				}
			}, 1000);
			return () => clearInterval(interval);
		}
	});

	function notifyDone(timer: TimerItem) {
		if ('Notification' in window && Notification.permission === 'granted') {
			new Notification('Timer Complete', {
				body: `${timer.label} is done!`,
				icon: '/manifest.json'
			});
		}
	}

	function formatTime(seconds: number): string {
		if (seconds <= 0) return '0:00';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function getRemaining(t: TimerItem): number {
		if (!t.running || !t.startedAt) return t.remaining;
		const elapsed = (now - t.startedAt) / 1000;
		return Math.max(0, t.remaining - elapsed);
	}

	function progressPct(t: TimerItem): number {
		if (t.duration === 0) return 0;
		return ((t.duration - getRemaining(t)) / t.duration) * 100;
	}

	// Request notification permission on mount
	$effect(() => {
		if ('Notification' in window && Notification.permission === 'default') {
			Notification.requestPermission();
		}
	});
</script>

{#if timers.length > 0}
	<div class="fixed bottom-20 right-3 z-50 flex flex-col gap-2 max-w-[200px]" transition:fly={{ y: 20, duration: 200 }}>
		{#each timers as timer (timer.id)}
			{@const rem = getRemaining(timer)}
			{@const pct = progressPct(timer)}
			{@const done = rem <= 0 && timer.running}
			<div
				class="rounded-xl border bg-card/95 backdrop-blur-sm shadow-lg overflow-hidden"
				class:border-accent={done}
				class:border-border={!done}
				class:animate-pulse={done}
				transition:fly={{ x: 30, duration: 200 }}
			>
				<!-- Progress bar background -->
				<div class="relative px-3 py-2">
					<div class="absolute inset-0 bg-accent/8 origin-left transition-transform duration-1000"
						style="transform: scaleX({pct / 100})"></div>
					<div class="relative flex items-center gap-2">
						<!-- Play/Pause -->
						<button
							class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors
								{timer.running ? 'bg-accent/15 text-accent' : 'bg-warm text-muted hover:text-ink'}"
							onclick={() => ontoggle(timer.id)}
						>
							{#if timer.running}
								<svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="3" height="8" rx="0.5" /><rect x="7" y="2" width="3" height="8" rx="0.5" /></svg>
							{:else}
								<svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><polygon points="3,1 11,6 3,11" /></svg>
							{/if}
						</button>
						<div class="flex-1 min-w-0">
							<p class="text-[10px] text-muted truncate leading-tight">{timer.label}</p>
							<p class="text-sm font-mono font-semibold {done ? 'text-accent' : 'text-ink'}">{done ? 'Done!' : formatTime(rem)}</p>
						</div>
						<!-- Dismiss -->
						<button
							class="w-5 h-5 rounded flex items-center justify-center text-muted/40 hover:text-red-ink transition-colors shrink-0"
							onclick={() => onremove(timer.id)}
						>
							<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3L9 9M9 3L3 9" /></svg>
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
