import type { Config } from "tailwindcss";

const config: Config = {
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
      backgroundImage: {
        hero: "radial-gradient(circle at 10% 20%, rgba(56,189,248,0.25), transparent 50%), radial-gradient(circle at 80% 10%, rgba(168,85,247,0.2), transparent 55%), radial-gradient(circle at 50% 80%, rgba(34,197,94,0.18), transparent 55%)",
      },
      boxShadow: {
        neon: "0 32px 120px rgba(56, 189, 248, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
