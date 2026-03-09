<script lang="ts">
	import type { ChatMessage } from '$lib/db';

	interface Props {
		open: boolean;
		messages: ChatMessage[];
		sending?: boolean;
		onclose: () => void;
		onsend: (message: string, model: string) => void;
		onpin: (content: string) => void;
	}

	let { open, messages, sending = false, onclose, onsend, onpin }: Props = $props();
	let input = $state('');
	let model = $state<'openai' | 'perplexity'>('openai');
	let messagesContainer: HTMLDivElement;

	$effect(() => {
		if (messages.length && messagesContainer) {
			requestAnimationFrame(() => {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			});
		}
	});

	function handleSend() {
		const msg = input.trim();
		if (!msg || sending) return;
		input = '';
		onsend(msg, model);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}
</script>

{#if open}
	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-50 bg-ink/20 backdrop-blur-[2px] lg:hidden"
		onclick={onclose}
		aria-label="Close chat"
	></button>

	<!-- Panel -->
	<div
		class="fixed bottom-0 left-0 right-0 z-50 bg-cream border-t border-border
			   rounded-t-2xl shadow-xl max-h-[80dvh] flex flex-col
			   lg:static lg:rounded-none lg:shadow-none lg:border-l lg:border-t-0
			   lg:w-[360px] lg:max-h-full lg:h-full"
		style="animation: slideUp 0.25s ease-out"
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
			<h3 class="font-heading text-base">Chat</h3>
			<div class="flex items-center gap-2">
				<!-- Model toggle -->
				<div class="text-[11px] flex bg-warm rounded-md p-0.5 gap-0.5">
					<button
						class="px-2 py-1 rounded-md transition-colors"
						class:bg-accent={model === 'openai'}
						class:text-cream={model === 'openai'}
						onclick={() => (model = 'openai')}
					>
						GPT
					</button>
					<button
						class="px-2 py-1 rounded-md transition-colors"
						class:bg-blue-ink={model === 'perplexity'}
						class:text-cream={model === 'perplexity'}
						onclick={() => (model = 'perplexity')}
					>
						Pplx
					</button>
				</div>
				<button
					class="w-7 h-7 flex items-center justify-center rounded-md hover:bg-warm text-muted text-xs"
					onclick={onclose}
				>
					✕
				</button>
			</div>
		</div>

		<!-- Messages -->
		<div class="flex-1 overflow-y-auto px-4 py-3 space-y-3" bind:this={messagesContainer}>
			{#if messages.length === 0}
				<div class="text-center text-muted py-10">
					<svg class="w-8 h-8 mx-auto mb-2 text-muted/40" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10,3 L16,6.5 L16,13.5 L10,17 L4,13.5 L4,6.5 Z" /><circle cx="10" cy="10" r="3.5" stroke-width="1" /></svg>
					<p class="text-xs">Ask anything about chemistry,</p>
					<p class="text-xs">metals, alloys, reactions...</p>
				</div>
			{/if}

			{#each messages as msg}
				{#if msg.role !== 'system'}
					<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[85%] rounded-2xl px-3.5 py-2.5 {msg.role === 'user'
								? 'bg-accent text-white rounded-br-md'
								: 'bg-warm rounded-bl-md'}"
						>
							<p class="font-body text-base whitespace-pre-wrap leading-relaxed">
								{msg.content}
							</p>
							{#if msg.role === 'assistant'}
								<button
									class="font-ui text-xs text-muted hover:text-accent-dark mt-1.5 flex items-center gap-1"
									onclick={() => onpin(msg.content)}
								>
									<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M7 1L11 5M3 5L7 1L11 5L7 9M3 5L1 11L7 9" /></svg>
									Pin to page
								</button>
							{/if}
						</div>
					</div>
				{/if}
			{/each}

			{#if sending}
				<div class="flex justify-start">
					<div class="bg-warm rounded-2xl rounded-bl-md px-4 py-3">
						<div class="flex gap-1.5">
							<span class="w-2 h-2 rounded-full bg-muted animate-bounce"></span>
							<span
								class="w-2 h-2 rounded-full bg-muted animate-bounce"
								style="animation-delay: 0.1s"
							></span>
							<span
								class="w-2 h-2 rounded-full bg-muted animate-bounce"
								style="animation-delay: 0.2s"
							></span>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Input -->
		<div class="px-3 pb-3 pt-2 border-t border-border shrink-0 safe-bottom">
			<div class="flex items-end gap-2">
				<textarea
					class="flex-1 bg-warm/60 border border-border rounded-lg px-3 py-2 text-sm
						   resize-none outline-none placeholder:text-muted/40
						   focus:border-muted transition-colors
						   min-h-[38px] max-h-[100px]"
					placeholder="Ask about chemistry..."
					rows="1"
					bind:value={input}
					onkeydown={handleKeydown}
					oninput={(e) => {
						const el = e.currentTarget;
						el.style.height = 'auto';
						el.style.height = Math.min(el.scrollHeight, 100) + 'px';
					}}
				></textarea>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-md
						   bg-accent text-cream shrink-0 active:scale-95 transition-transform
						   disabled:opacity-30 text-sm"
					onclick={handleSend}
					disabled={!input.trim() || sending}
				>
					↑
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
</style>
