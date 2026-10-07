import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Cabecalho } from "@/components/layout/cabecalho";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { RodapeLgpd } from "@/components/layout/rodape-lgpd";
import { MonitorInatividade } from "@/components/layout/monitor-inatividade";

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
      <body className="h-full flex flex-col antialiased text-[#1A2230] bg-[#F4F5F7] font-sans print:h-auto print:bg-white print:block">
        {/* Monitor de Inatividade da Sessão (30 min) */}
        <MonitorInatividade />

        {/* Barra Superior Corporativa */}
        <div className="print:hidden">
          <Cabecalho />
        </div>

        {/* Corpo Principal com Menu Lateral (240px) e Área de Trabalho (Padding 28px 32px) */}
        <div className="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
          <div className="print:hidden h-full flex flex-col shrink-0">
            <MenuLateral />
          </div>
          <main className="flex-1 overflow-y-auto bg-[#F4F5F7] p-6 md:p-8 print:p-0 print:m-0 print:bg-white print:overflow-visible print:h-auto">
            {children}
          </main>
        </div>

        {/* Rodapé Obrigatório de Finalidade LGPD */}
        <div className="print:hidden">
          <RodapeLgpd />
        </div>
      </body>
    </html>
  );
}
