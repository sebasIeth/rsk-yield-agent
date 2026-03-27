/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        rsk: {
          green: "#22C55E",
          dark: "#09090B",
          card: "#18181B",
          border: "#3F3F46",
        },
      },
    },
  },
  plugins: [],
};
