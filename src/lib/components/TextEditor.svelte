<script lang="ts">
	interface Props {
		value: string;
		placeholder?: string;
		autofocus?: boolean;
		onsave: (value: string) => void;
	}

	let {
		value = '',
		placeholder = 'Write something...',
		autofocus = false,
		onsave
	}: Props = $props();

	let content = $state(value);
	let textareaEl: HTMLTextAreaElement;
	let saveTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		if (autofocus && textareaEl) {
			textareaEl.focus();
			// Move cursor to end
			textareaEl.selectionStart = textareaEl.selectionEnd = content.length;
		}
	});

	function handleInput(e: Event) {
		const target = e.currentTarget as HTMLTextAreaElement;
		content = target.value;

		// Auto-resize
		target.style.height = 'auto';
		target.style.height = target.scrollHeight + 'px';

		// Debounced save
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => onsave(content), 1500);
	}

	function handleBlur() {
		clearTimeout(saveTimer);
		onsave(content);
	}
</script>

<textarea
	bind:this={textareaEl}
	class="w-full bg-transparent text-sm text-ink
		   resize-none outline-none paper-lines min-h-[3rem] px-1 py-0.5 leading-relaxed"
	{placeholder}
	value={content}
	oninput={handleInput}
	onblur={handleBlur}
></textarea>
