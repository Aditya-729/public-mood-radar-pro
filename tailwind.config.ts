import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      keyframes: {
        glowPulse: {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.02)" },
        },
        shimmerSweep: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        softBlurReveal: {
          "0%": { opacity: "0", filter: "blur(12px)", transform: "translateY(10px)" },
          "100%": { opacity: "1", filter: "blur(0px)", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        slowSpin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        glow: "glowPulse 4s ease-in-out infinite",
        shimmer: "shimmerSweep 1.6s linear infinite",
        blurReveal: "softBlurReveal 0.8s ease-out both",
        float: "float 6s ease-in-out infinite",
        slowSpin: "slowSpin 14s linear infinite",
      },
      boxShadow: {
        glow: "0 0 40px rgba(59, 130, 246, 0.35)",
        neon: "0 0 30px rgba(56, 189, 248, 0.25)",
      },
      backgroundImage: {
        hero: "radial-gradient(circle at top, rgba(56,189,248,0.28), transparent 55%), linear-gradient(120deg, rgba(37,99,235,0.4), rgba(168,85,247,0.35), rgba(15,118,110,0.4))",
        noise:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
