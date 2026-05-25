/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./js/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Plus Jakarta Sans", "Onest", "system-ui", "sans-serif"],
        display: ["Inter", "Syne", "Geologica", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      colors: {
        void: "#08080a",
        blood: { DEFAULT: "#e11d48", bright: "#fb7185", dim: "#be123c" },
      },
      borderRadius: {
        studio: "14px",
        "studio-lg": "20px",
      },
      maxWidth: { content: "100%" },
    },
  },
  plugins: [],
};
