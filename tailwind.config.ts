import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#0A84FF",
          darkBlue: "#0066CC",
          bg: "#F7F8FA",
          surface: "#FFFFFF",
          text: "#0B0B0C",
          secondary: "#6E6E73",
          border: "#E5E5EA",
          success: "#34C759",
          warning: "#FF9500",
        },
      },
    },
  },
  plugins: [],
};
export default config;
