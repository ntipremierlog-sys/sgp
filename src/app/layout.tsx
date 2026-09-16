import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Cabecalho } from "@/components/layout/cabecalho";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { RodapeLgpd } from "@/components/layout/rodape-lgpd";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SGP — Sistema de Gestão de Postos | Premier Logistics • Petrobras",
  description:
    "Sistema de Gestão, Fiscalização e Apuração de Postos de Serviço do Contrato Petrobras ICJ 5900.0129796.25.2",
};

export const preferredRegion = "gru1"; // Força execução na região de São Paulo na Vercel

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`h-full ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="h-full flex flex-col antialiased text-[#1A2230] bg-[#F4F5F7] font-sans">
        {/* Barra Superior Corporativa */}
        <Cabecalho />

        {/* Corpo Principal com Menu Lateral (240px) e Área de Trabalho (Padding 28px 32px) */}
        <div className="flex-1 flex overflow-hidden">
          <MenuLateral />
          <main className="flex-1 overflow-y-auto bg-[#F4F5F7] px-6 py-6 md:px-8 md:py-7">
            {children}
          </main>
        </div>

        {/* Rodapé Obrigatório de Finalidade LGPD */}
        <RodapeLgpd />
      </body>
    </html>
  );
}
