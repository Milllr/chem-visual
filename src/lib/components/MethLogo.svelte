<script lang="ts">
	interface Props {
		class?: string;
		size?: number;
	}

	let { class: className = '', size = 32 }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 120 58"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	width={size}
	height={size * 58 / 120}
	class={className}
	aria-label="Methamphetamine molecule"
>
	<!-- Benzene ring -->
	<path d="M28,14 L40,21 L40,35 L28,42 L16,35 L16,21 Z" />

	<!-- Double bonds (Kekulé structure) -->
	<line x1="27" y1="17.5" x2="37" y2="23" />
	<line x1="37" y1="33.5" x2="27" y2="39.5" />
	<line x1="18.5" y1="33" x2="18.5" y2="23" />

	<!-- Chain: ring → C₂ -->
	<line x1="40" y1="35" x2="53" y2="26" />
	<!-- C₂ → C₃ -->
	<line x1="53" y1="26" x2="66" y2="35" />

	<!-- Methyl branch down from C₃ -->
	<line x1="66" y1="35" x2="66" y2="48" />

	<!-- C₃ → N -->
	<line x1="66" y1="35" x2="74" y2="30" />

	<!-- N → terminal CH₃ -->
	<line x1="88" y1="30" x2="100" y2="39" />

	<!-- NH label -->
	<text
		x="76"
		y="33"
		font-size="9"
		fill="currentColor"
		stroke="none"
		font-family="'Lora', Georgia, serif"
		font-style="italic"
	>NH</text>
</svg>
