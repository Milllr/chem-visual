<script lang="ts">
	import type { ChatMessage } from '$lib/db';
	import { marked } from 'marked';

	marked.setOptions({ breaks: true, gfm: true });

	interface Props {
		open: boolean;
		messages: ChatMessage[];
		sending?: boolean;
		onclose: () => void;
		onsend: (message: string, model: string, attachmentNames?: string[], imageDataUrls?: string[]) => void;
		onpin: (content: string) => void;
		ondelete: (id: string) => void;
		onresend: (id: string, newContent: string, model: string) => void;
		onaddcontext?: (text: string, filename: string) => void;
	}

	let { open, messages, sending = false, onclose, onsend, onpin, ondelete, onresend, onaddcontext }: Props = $props();
	let input = $state('');
	let model = $state<'openai' | 'perplexity'>('openai');
	let contextFiles = $state<{ name: string; text: string; isImage?: boolean }[]>([]);
	let contextFileInput: HTMLInputElement;
	let messagesContainer: HTMLDivElement;

	// Edit state
	let editingId = $state<string | null>(null);
	let editText = $state('');
	let copiedId = $state<string | null>(null);

	function startEdit(msg: ChatMessage) {
		const dc = getDisplayContent(msg.content);
		editingId = msg.id;
		editText = dc.text;
	}

	function cancelEdit() {
		editingId = null;
		editText = '';
	}

	function saveEdit(id: string) {
		const trimmed = editText.trim();
		if (!trimmed) return;
		editingId = null;
		editText = '';
		onresend(id, trimmed, model);
	}

	function handleResend(msg: ChatMessage) {
		const dc = getDisplayContent(msg.content);
		onresend(msg.id, dc.text, model);
	}

	function copyText(id: string, content: string) {
		navigator.clipboard.writeText(content);
		copiedId = id;
		setTimeout(() => { if (copiedId === id) copiedId = null; }, 1500);
	}

	/** Compress image to max 512px and JPEG 0.6 quality for vision API */
	async function compressImageForChat(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				const maxDim = 512;
				let w = img.width;
				let h = img.height;
				if (w > maxDim || h > maxDim) {
					const scale = maxDim / Math.max(w, h);
					w = Math.round(w * scale);
					h = Math.round(h * scale);
				}
				const canvas = document.createElement('canvas');
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext('2d')!;
				ctx.drawImage(img, 0, 0, w, h);
				resolve(canvas.toDataURL('image/jpeg', 0.6));
				URL.revokeObjectURL(img.src);
			};
			img.onerror = reject;
			img.src = URL.createObjectURL(file);
		});
	}

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

		// Build the full message with file context for the API,
		// but only show a clean version in the chat UI
		let fullMessage = msg;
		let attachmentNames: string[] = [];
		let imageDataUrls: string[] = [];

		if (contextFiles.length > 0) {
			const textFiles = contextFiles.filter((f) => !f.isImage);
			const imageFiles = contextFiles.filter((f) => f.isImage);

			// Prepend text file contents (hidden from display)
			if (textFiles.length > 0) {
				const ctx = textFiles
					.map((f) => `[Attached: ${f.name}]\n${f.text}`)
					.join('\n\n');
				fullMessage = `${ctx}\n\n---\n\n${msg}`;
			}

			// Collect image data URLs separately (NOT in the text)
			if (imageFiles.length > 0) {
				imageDataUrls = imageFiles.map((f) => f.text);
				// Add image filenames to message for context (not the data)
				const imgNames = imageFiles.map((f) => f.name).join(', ');
				fullMessage = `${fullMessage}\n\n[Attached images: ${imgNames}]`;
			}

			attachmentNames = contextFiles.map((f) => f.name);
			contextFiles = [];
		}

		input = '';
		// Send full message to API with images as separate data
		(onsend as any)(fullMessage, model, attachmentNames, imageDataUrls);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	async function handleContextFile(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const files = el.files;
		if (!files) return;

		for (const file of files) {
			try {
				if (file.type.startsWith('image/')) {
					// Compress image: resize to max 512px, JPEG quality 0.6
					const dataUrl = await compressImageForChat(file);
					contextFiles = [...contextFiles, { name: file.name, text: dataUrl, isImage: true }];
				} else {
					let text: string;
					if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
						const { extractPdfText } = await import('$lib/pdf');
						text = await extractPdfText(file);
					} else {
						text = await file.text();
					}
					contextFiles = [...contextFiles, { name: file.name, text: text.slice(0, 15000) }];
				}
			} catch {
				// Skip files that can't be read
			}
		}
		el.value = '';
	}

	function removeContextFile(index: number) {
		contextFiles = contextFiles.filter((_, i) => i !== index);
	}

	/** Extract clean display text and attachment info from a user message */
	function getDisplayContent(content: string): { text: string; attachments: { name: string; isImage: boolean }[] } {
		const attachments: { name: string; isImage: boolean }[] = [];
		let text = content;

		// Extract [Attached: filename] blocks and their content
		text = text.replace(/\[Attached: ([^\]]+)\]\n[\s\S]*?(?=\n\n---\n\n|\[Attached: |\[Attached images: |$)/g, (_, name) => {
			attachments.push({ name, isImage: false });
			return '';
		});

		// Extract [Attached images: name1, name2] references
		text = text.replace(/\[Attached images: ([^\]]+)\]/g, (_, names) => {
			for (const name of names.split(',').map((n: string) => n.trim())) {
				attachments.push({ name, isImage: true });
			}
			return '';
		});

		// Clean up separator
		text = text.replace(/^[\s]*---[\s]*/g, '').trim();

		return { text, attachments };
	}

	function getQuestionForAnswer(msg: ChatMessage): string | null {
		// Find the user message that preceded this assistant message
		const idx = messages.indexOf(msg);
		for (let i = idx - 1; i >= 0; i--) {
			if (messages[i].role === 'user') {
				return messages[i].content;
			}
		}
		return null;
	}

	function renderMarkdown(text: string): string {
		return marked.parse(text, { async: false }) as string;
	}
</script>

{#if open}
	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]"
		onclick={onclose}
		aria-label="Close chat"
	></button>

	<!-- Panel -->
	<div
		class="fixed inset-0 z-50 bg-cream flex flex-col"
		style="animation: slideUp 0.2s ease-out"
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
					<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'} group/msg items-end gap-1">
						<!-- Action icons: LEFT side for user messages -->
						{#if msg.role === 'user' && editingId !== msg.id}
							<div class="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity shrink-0 pb-1">
								<button class="w-6 h-6 flex items-center justify-center rounded-md text-muted/30 hover:text-red-ink hover:bg-red-ink/5 transition-colors" title="Delete"
									onclick={() => ondelete(msg.id)}>
									<svg class="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a1 1 0 01-1 1H4a1 1 0 01-1-1V4" /></svg>
								</button>
								<button class="w-6 h-6 flex items-center justify-center rounded-md text-muted/30 hover:text-accent hover:bg-warm transition-colors" title="Copy"
									onclick={() => copyText(msg.id, getDisplayContent(msg.content).text)}>
									{#if copiedId === msg.id}
										<svg class="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5l3 3 5-6" /></svg>
									{:else}
										<svg class="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="8" height="8" rx="1" /><path d="M9 5V2a1 1 0 00-1-1H2a1 1 0 00-1 1v6a1 1 0 001 1h3" /></svg>
									{/if}
								</button>
								<button class="w-6 h-6 flex items-center justify-center rounded-md text-muted/30 hover:text-accent hover:bg-warm transition-colors" title="Resend"
									onclick={() => handleResend(msg)}>
									<svg class="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 7a6 6 0 0111.2-3M13 2v3h-3" /><path d="M13 7A6 6 0 011.8 10M1 12V9h3" /></svg>
								</button>
								<button class="w-6 h-6 flex items-center justify-center rounded-md text-muted/30 hover:text-accent hover:bg-warm transition-colors" title="Edit & Resend"
									onclick={() => startEdit(msg)}>
									<svg class="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2l2 2-7 7H3v-2l7-7z" /></svg>
								</button>
							</div>
						{/if}

						<!-- Message bubble -->
						<div
							class="max-w-[75%] rounded-2xl px-3.5 py-2.5 {msg.role === 'user'
								? 'bg-accent text-white rounded-br-md'
								: 'bg-warm rounded-bl-md'}"
						>
							{#if msg.role === 'user'}
								{#if editingId === msg.id}
									<div class="space-y-2">
										<textarea
											class="w-full bg-white/20 rounded-lg px-2.5 py-2 text-sm text-white placeholder:text-white/40 outline-none resize-none min-h-[60px]"
											bind:value={editText}
											onkeydown={(e) => {
												if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg.id); }
												if (e.key === 'Escape') cancelEdit();
											}}
										></textarea>
										<div class="flex gap-1.5 justify-end">
											<button class="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70" onclick={cancelEdit}>Cancel</button>
											<button class="text-[11px] px-2 py-1 rounded bg-white/25 hover:bg-white/35 text-white font-medium" onclick={() => saveEdit(msg.id)}>Save & Resend</button>
										</div>
									</div>
								{:else}
									{@const displayContent = getDisplayContent(msg.content)}
									{#if displayContent.attachments.length > 0}
										<div class="flex flex-wrap gap-1 mb-1.5">
											{#each displayContent.attachments as att}
												<span class="inline-flex items-center gap-1 bg-white/15 rounded px-1.5 py-0.5 text-[10px]">
													{#if att.isImage}
														<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="10" height="10" rx="1" /><circle cx="4" cy="4" r="1" /><path d="M1 8l3-3 2 2 2-2 3 3" /></svg>
													{:else}
														<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1H3a1 1 0 00-1 1v8a1 1 0 001 1h6a1 1 0 001-1V4L7 1z" /><path d="M7 1v3h3" /></svg>
													{/if}
													{att.name}
												</span>
											{/each}
										</div>
									{/if}
									<p class="font-body text-sm whitespace-pre-wrap leading-relaxed">
										{displayContent.text}
									</p>
								{/if}
							{:else}
								<div class="prose-chat font-body text-sm leading-relaxed">
									{@html renderMarkdown(msg.content)}
								</div>
							{/if}
						</div>

						<!-- Action icons: RIGHT side for assistant messages -->
						{#if msg.role === 'assistant' && editingId !== msg.id}
							<div class="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity shrink-0 pb-1">
								<button class="w-6 h-6 flex items-center justify-center rounded-md text-muted/30 hover:text-accent hover:bg-warm transition-colors" title="Add to journal"
									onclick={() => {
										const question = getQuestionForAnswer(msg);
										const journalContent = question ? `Q: ${question}\n\n${msg.content}` : msg.content;
										onpin(journalContent);
										onclose();
									}}>
									<svg class="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="3" x2="7" y2="11" /><line x1="3" y1="7" x2="11" y2="7" /></svg>
								</button>
								<button class="w-6 h-6 flex items-center justify-center rounded-md text-muted/30 hover:text-accent hover:bg-warm transition-colors" title="Copy"
									onclick={() => copyText(msg.id, msg.content)}>
									{#if copiedId === msg.id}
										<svg class="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5l3 3 5-6" /></svg>
									{:else}
										<svg class="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="8" height="8" rx="1" /><path d="M9 5V2a1 1 0 00-1-1H2a1 1 0 00-1 1v6a1 1 0 001 1h3" /></svg>
									{/if}
								</button>
								<button class="w-6 h-6 flex items-center justify-center rounded-md text-muted/30 hover:text-red-ink hover:bg-red-ink/5 transition-colors" title="Delete"
									onclick={() => ondelete(msg.id)}>
									<svg class="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a1 1 0 01-1 1H4a1 1 0 01-1-1V4" /></svg>
								</button>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>

		<!-- Sending indicator -->
		<div class="px-4 pb-1">
			{#if sending}
				<div class="flex justify-start py-2">
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
			<!-- Attached context files -->
			{#if contextFiles.length > 0}
				<div class="flex flex-wrap gap-1.5 mb-2">
					{#each contextFiles as file, i}
						<span class="inline-flex items-center gap-1 bg-warm rounded-md px-2 py-1 text-[11px] text-muted">
							{#if file.isImage}
								<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="10" height="10" rx="1" /><circle cx="4" cy="4" r="1" /><path d="M1 8l3-3 2 2 2-2 3 3" /></svg>
							{:else}
								<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1H3a1 1 0 00-1 1v8a1 1 0 001 1h6a1 1 0 001-1V4L7 1z" /><path d="M7 1v3h3" /></svg>
							{/if}
							{file.name}
							<button class="hover:text-ink" onclick={() => removeContextFile(i)}>✕</button>
						</span>
					{/each}
				</div>
			{/if}

			<input
				bind:this={contextFileInput}
				type="file"
				accept=".txt,.csv,.tsv,.json,.md,.pdf,.log,.dat,.xml,image/*"
				multiple
				class="hidden"
				onchange={handleContextFile}
			/>

			<div class="flex items-end gap-2">
				<button
					class="w-8 h-8 flex items-center justify-center rounded-md
						   text-muted hover:bg-warm shrink-0 active:scale-95 transition-all"
					onclick={() => contextFileInput?.click()}
					title="Attach file for context"
				>
					<svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8.5l-5.5 5.5a3.5 3.5 0 01-5-5L9 3.5a2.5 2.5 0 013.5 3.5l-5.5 5a1.5 1.5 0 01-2-2L10.5 4.5" /></svg>
				</button>
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
