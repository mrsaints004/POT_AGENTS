import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        kite: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7cc8fc",
          400: "#36adf8",
          500: "#0c93e9",
          600: "#0074c7",
          700: "#015ca1",
          800: "#064f85",
          900: "#0b426e",
          950: "#072a49",
        },
      },
    },
  },
  plugins: [],
};

export default config;
