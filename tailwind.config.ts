import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        premier: {
          50: "#f0f4f9",
          100: "#dbe4f1",
          200: "#b9cce4",
          300: "#8caed1",
          400: "#5c8bb9",
          500: "#3d6fa0",
          600: "#2b5683",
          700: "#1f4266",
          800: "#173450",
          900: "#0f2042", // Azul-marinho institucional Premier
          950: "#09142b",
        },
        petrobras: {
          green: "#008542",
          yellow: "#FFCC00",
        },
        status: {
          titular: {
            bg: "#ECFDF5",
            text: "#065F46",
            border: "#A7F3D0",
            dot: "#10B981", // Verde: Titular presente
          },
          coberto: {
            bg: "#EFF6FF",
            text: "#1E40AF",
            border: "#BFDBFE",
            dot: "#3B82F6", // Azul: Coberto por substituto
          },
          descoberto: {
            bg: "#FEF2F2",
            text: "#991B1B",
            border: "#FECACA",
            dot: "#EF4444", // Vermelho: Titular ausente sem cobertura
          },
          naoExigivel: {
            bg: "#F8FAFC",
            text: "#475569",
            border: "#E2E8F0",
            dot: "#94A3B8", // Cinza: Folga/feriado/fora de escala
          },
          postoVago: {
            bg: "#FFF7ED",
            text: "#9A3412",
            border: "#FED7AA",
            dot: "#F97316", // Laranja: Posto sem titular
          },
          pendente: {
            bg: "#FEFCE8",
            text: "#854D0E",
            border: "#FEF08A",
            dot: "#EAB308", // Amarelo: Pendente de apuração
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
