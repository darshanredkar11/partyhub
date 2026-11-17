import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171522",
        plum: "#6d4aff",
        coral: "#ff786f",
        card: "#fffdfa",
        primary: "#6848d8",
        "primary-foreground": "#211d2b",
        muted: "#f1edf5",
        "muted-foreground": "#777181",
        accent: "#eee8ff",
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