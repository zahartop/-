/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./js/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Onest", "system-ui", "sans-serif"],
        display: ["Geologica", "Onest", "system-ui", "sans-serif"],
      },
      colors: {
        void: "#030303",
        blood: { DEFAULT: "#e11d48", bright: "#ff2d55", dim: "#9f1239" },
      },
      maxWidth: { content: "76rem" },
    },
  },
  plugins: [],
};
