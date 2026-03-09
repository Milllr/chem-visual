/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				cream: '#F5F5EC',
				card: '#EDEADF',
				warm: '#E8E4D9',
				ink: '#1A1A1A',
				muted: '#7A756B',
				accent: {
					DEFAULT: '#4A4540',
					dark: '#2C2925',
					light: '#8A8378'
				},
				'red-ink': '#B54848',
				'blue-ink': '#4A6D8C',
				'green-ink': '#5A7A4C',
				border: '#D5D0C6'
			},
			fontFamily: {
				body: ['Lora', 'Georgia', 'Times New Roman', 'serif'],
				heading: ['Lora', 'Georgia', 'serif'],
				ui: ['Lora', 'Georgia', 'serif'],
				sketch: ['Virgil', 'cursive']
			},
			fontSize: {
				journal: ['0.95rem', { lineHeight: '1.7' }],
				'journal-lg': ['1.1rem', { lineHeight: '1.7' }]
			}
		}
	},
	plugins: [require('@tailwindcss/typography')]
};
