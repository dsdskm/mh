import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        corn: {
          50: "#fffdf5",
          100: "#fff8d9",
          200: "#ffe89a",
          300: "#ffd55a",
          400: "#ffbd2e",
          500: "#f2a800",
          600: "#ca8800",
          700: "#9f6800",
        },
      },
    },
  },
  plugins: [],
};

export default config;
