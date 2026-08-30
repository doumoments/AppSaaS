/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#090d16",
        surface: "#0f172a",
        surfaceCard: "#131f37",
        surfaceBorder: "#1e293b",
        cyberCyan: "#06b6d4",
        cyberEmerald: "#10b981",
        cyberRose: "#f43f5e",
        cyberAmber: "#f59e0b",
        cyberPurple: "#8b5cf6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
}
