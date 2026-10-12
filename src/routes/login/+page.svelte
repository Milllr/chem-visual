<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import MethLogo from '$lib/components/MethLogo.svelte';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Login — Chem Journal</title>
</svelte:head>

<div class="min-h-[100dvh] flex items-center justify-center px-6">
	<div class="w-full max-w-xs">
		<!-- Header -->
		<div class="text-center mb-10">
			<div class="flex justify-center mb-4 text-accent">
				<MethLogo size={64} />
			</div>
			<h1 class="font-heading text-2xl text-ink">Chem Journal</h1>
			<p class="font-ui text-sm text-muted mt-1">Personal lab notebook</p>
		</div>

		<!-- Login form -->
		<form
			method="POST"
			class="space-y-3"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
				};
			}}
		>
			<!-- Hidden username for accessibility -->
			<input type="text" name="username" value="chemist" autocomplete="username" class="hidden" aria-hidden="true" tabindex="-1" />
			<div>
				<input
					type="password"
					name="password"
					class="w-full bg-warm/60 rounded-lg px-4 py-3 text-sm text-center
						   outline-none placeholder:text-muted/40 border border-border
						   focus:border-accent transition-colors"
					placeholder="Enter password"
					autocomplete="current-password"
					autofocus
				/>
			</div>

			{#if form?.error}
				<p class="text-xs text-red-ink text-center">{form.error}</p>
			{/if}

			<button
				type="submit"
				class="w-full text-sm py-2.5 rounded-lg bg-accent text-cream
					   hover:bg-accent-dark active:bg-accent-dark transition-colors disabled:opacity-50"
				disabled={loading}
			>
				{loading ? 'Entering...' : 'Enter Lab'}
			</button>
		</form>

		<!-- Footer -->
		<p class="text-center text-xs text-muted/40 mt-10">
			majogendron.com
		</p>
		<!-- credit: links mllr.ca through its tracked link /r/chem -->
		<p class="text-center text-[10px] text-muted/40 mt-1">
			by <a href="https://mllr.ca/r/chem" class="hover:text-muted transition-colors">Miller Downey</a>
		</p>
	</div>
</div>
