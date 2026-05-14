/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#eaf1f6",
        ink: "#1a3557",
        panel: "#fdfefe",
        accent: {
          50: "#e8f1f8",
          100: "#d4e6f4",
          500: "#0070b8",
          600: "#005a94",
          700: "#004674"
        },
        brass: "#4a90b8",
        border: "#b7c6d1",
        muted: "#52697d"
      },
      boxShadow: {
        paper: "0 12px 28px rgba(15, 33, 56, 0.12)"
      },
      fontFamily: {
        sans: ["Segoe UI", "Inter", "Roboto", "Helvetica Neue", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};
