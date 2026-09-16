import type { Metadata } from "next";
import "./globals.css";
import { Cabecalho } from "@/components/layout/cabecalho";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { RodapeLgpd } from "@/components/layout/rodape-lgpd";

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
    <html lang="pt-BR" className="h-full">
      <body className="h-full flex flex-col antialiased text-slate-900 bg-slate-100 font-sans">
        {/* Cabeçalho Fixo */}
        <Cabecalho />

        {/* Corpo Principal com Menu Lateral e Área de Trabalho */}
        <div className="flex-1 flex overflow-hidden">
          <MenuLateral />
          <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6">
            {children}
          </main>
        </div>

        {/* Rodapé Obrigatório de Finalidade LGPD */}
        <RodapeLgpd />
      </body>
    </html>
  );
}
