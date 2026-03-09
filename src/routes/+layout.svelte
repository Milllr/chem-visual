<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<!-- Global SVG filter for pencil texture on molecules -->
<svg width="0" height="0" class="absolute">
	<defs>
		<filter id="pencil-texture">
			<feTurbulence
				type="fractalNoise"
				baseFrequency="0.04"
				numOctaves="5"
				result="noise"
			/>
			<feDisplacementMap
				in="SourceGraphic"
				in2="noise"
				scale="1"
				xChannelSelector="R"
				yChannelSelector="G"
			/>
		</filter>
	</defs>
</svg>

<div class="min-h-[100dvh] bg-cream">
	{@render children()}
</div>
