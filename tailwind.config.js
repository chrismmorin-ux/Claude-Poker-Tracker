/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Font families consolidated from panelTokens.FONT 2026-05-05 SPR-038/WS-167.
      // `font-display` and `font-mono` Tailwind classes resolve to these stacks.
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
