import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { CascaAplicacao } from "@/components/layout/casca-aplicacao";

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
  icons: {
    icon: "/icon.png",
  },
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
        {/* Cabeçalho, menu lateral, monitor de inatividade e rodapé LGPD (ocultos nas telas de login) */}
        <CascaAplicacao>{children}</CascaAplicacao>
      </body>
    </html>
  );
}
