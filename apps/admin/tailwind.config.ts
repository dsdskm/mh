import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          50: "#f6ffe8",
          100: "#e7ffc0",
          200: "#d2ff87",
          300: "#b4f25f",
          400: "#8bd136",
          500: "#6bb31d",
          600: "#4d8a14",
          700: "#3b6b11",
        },
      },
    },
  },
  plugins: [],
};

export default config;
