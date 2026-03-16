/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          primary: "#B08A1F",
          light: "#C9A836",
          dark: "#8A6B12",
        },
        cream: "#F9F5EB",
        heart: "#EF4444",
        "dark-text": "#111827",
        "gray-text": "#6B7280",
        "light-gray": "#9CA3AF",
        divider: "#F3F4F6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["Times New Roman", "Times", "serif"],
      },
      maxWidth: {
        mobile: "390px",
      },
    },
  },
  plugins: [],
};
