import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171522",
        plum: "#6d4aff",
        coral: "#ff786f",
        cream: "#fffaf4",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(32, 24, 60, 0.09)",
      },
    },
  },
  plugins: [],
};
export default config;