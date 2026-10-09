"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Cabecalho } from "@/components/layout/cabecalho";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { RodapeLgpd } from "@/components/layout/rodape-lgpd";
import { MonitorInatividade } from "@/components/layout/monitor-inatividade";

/** Rotas exibidas em tela cheia, sem cabeçalho/menu (fluxo de autenticação). */
const ROTAS_TELA_CHEIA = ["/login"];

export function CascaAplicacao({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const telaCheia = ROTAS_TELA_CHEIA.some((r) => pathname === r || pathname.startsWith(r + "/"));

  if (telaCheia) {
    return <div className="flex-1 overflow-y-auto">{children}</div>;
  }

  return (
    <>
      {/* Monitor de Inatividade da Sessão (30 min) */}
      <MonitorInatividade />

      {/* Barra Superior Corporativa */}
      <div className="print:hidden">
        <Cabecalho />
      </div>

      {/* Corpo Principal com Menu Lateral (240px) e Área de Trabalho (Padding 28px 32px) */}
      <div className="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
        <div className="print:hidden h-full flex flex-col shrink-0 max-[860px]:hidden">
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
    </>
  );
}
