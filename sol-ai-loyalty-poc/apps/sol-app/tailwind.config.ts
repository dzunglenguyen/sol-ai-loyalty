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
        "sol-blue": "#0046BE",
        "sol-navy": "#00397F",
        "sol-orange": "#FF6B00",
        "sol-gold": "#CF9C51",
        "sol-green": "#00B14F",
        "sol-surface": "#F5F7FA",
        "sol-text": "#1A1A1A",
        "sol-secondary": "#666666",
      },
      fontFamily: {
        sans: ["Tahoma", "Inter", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        btn: "24px",
        pill: "50px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.08)",
        "card-elevated": "2px 3px 8px 1px rgb(140,140,140)",
        overlay: "0px 4px 27px -10px rgba(0,0,0,0.75)",
        "btn-hover": "0px 2px 8px rgba(0,0,0,0.12)",
      },
      spacing: {
        "4.5": "18px",
        "11": "44px",
        "14": "56px",
        "15": "60px",
      },
      maxWidth: {
        mobile: "390px",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.15s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
