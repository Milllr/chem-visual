<script lang="ts">
	interface Props {
		class?: string;
		size?: number;
	}

	let { class: className = '', size = 32 }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 140 58"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	width={size}
	height={size * 58 / 140}
	class={className}
	aria-label="Methamphetamine molecule"
>
	<!-- Benzene ring -->
	<polygon points="28,13 40.5,20 40.5,34 28,41 15.5,34 15.5,20" />

	<!-- Kekulé double bonds -->
	<line x1="27" y1="16.5" x2="37.5" y2="22.5" />
	<line x1="37.5" y1="31.5" x2="27" y2="37.5" />
	<line x1="18" y1="32" x2="18" y2="22" />

	<!-- Ring → CH₂ -->
	<line x1="40.5" y1="34" x2="54" y2="25" />
	<!-- CH₂ → C* (stereocenter) -->
	<line x1="54" y1="25" x2="67.5" y2="34" />

	<!-- CH₃ branch down from C* -->
	<line x1="67.5" y1="34" x2="67.5" y2="50" />

	<!-- C* → N -->
	<line x1="67.5" y1="34" x2="78" y2="28" />

	<!-- N → terminal CH₃ -->
	<line x1="92" y1="28" x2="105" y2="37" />

	<!-- N—H bond (up) -->
	<line x1="85" y1="21" x2="85" y2="10" />

	<!-- Atom labels -->
	<text
		x="85"
		y="31"
		font-size="11"
		text-anchor="middle"
		font-family="Arial, Helvetica, sans-serif"
		font-weight="bold"
		fill="currentColor"
		stroke="none"
	>N</text>
	<text
		x="85"
		y="9"
		font-size="9"
		text-anchor="middle"
		font-family="Arial, Helvetica, sans-serif"
		font-weight="bold"
		fill="currentColor"
		stroke="none"
	>H</text>
</svg>
