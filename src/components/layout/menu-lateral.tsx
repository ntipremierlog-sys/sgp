"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Briefcase,
  Users,
  AlertTriangle,
  UserCheck2,
  MessageSquare,
  FileSpreadsheet,
  UploadCloud,
  History,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { carregarEstado } from "@/lib/dados/estado-operacional";

interface MenuItem {
  rotulo: string;
  href: string;
  icone: React.ComponentType<{ className?: string }>;
  temBadge?: boolean;
}

interface GrupoMenu {
  titulo: string;
  itens: MenuItem[];
}

const gruposMenu: GrupoMenu[] = [
  {
    titulo: "OPERAÇÃO",
    itens: [
      { rotulo: "Painel geral", href: "/", icone: LayoutDashboard },
      { rotulo: "Mapa de ocupação", href: "/mapa-ocupacao", icone: CalendarCheck },
      { rotulo: "Postos do Anexo 1-A", href: "/postos", icone: Briefcase },
      { rotulo: "Profissionais", href: "/profissionais", icone: Users },
      { rotulo: "Ocorrências", href: "/ocorrencias", icone: AlertTriangle },
      { rotulo: "Coberturas", href: "/coberturas", icone: UserCheck2 },
    ],
  },
  {
    titulo: "FISCALIZAÇÃO",
    itens: [
      { rotulo: "Apontamentos Petrobras", href: "/apontamentos", icone: MessageSquare, temBadge: true },
      { rotulo: "Relatórios e medição", href: "/relatorios", icone: FileSpreadsheet },
      { rotulo: "Conformidade contratual", href: "/conformidade", icone: ShieldCheck },
      { rotulo: "Trilha de auditoria", href: "/auditoria", icone: History },
    ],
  },
  {
    titulo: "SISTEMA",
    itens: [
      { rotulo: "Importações de dados", href: "/importacoes", icone: UploadCloud },
      { rotulo: "Administração", href: "/admin", icone: Settings },
    ],
  },
];

export function MenuLateral() {
  const pathname = usePathname();
  const [totalPendencias, setTotalPendencias] = useState<number>(0);

  useEffect(() => {
    const atualizar = () => {
      const estado = carregarEstado();
      const abertos = estado.apontamentos.filter(
        (a) => a.status === "ABERTO" || a.status === "EM_TRATAMENTO"
      ).length;
      setTotalPendencias(abertos);
    };

    atualizar();
    window.addEventListener("sgp-dados-atualizados", atualizar);
    return () => window.removeEventListener("sgp-dados-atualizados", atualizar);
  }, []);

  return (
    <aside className="w-[240px] bg-[#0F1E36] text-[#C9D2E0] flex flex-col shrink-0 select-none border-r border-[#1E2E4A]">
      {/* Topo: Logo "P" + "Premier Logistics" + "SGP · Gestão de Postos" */}
      <div className="p-4 border-b border-[#1E2E4A] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#1F4FD1] text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
          P
        </div>
        <div className="leading-tight truncate">
          <span className="font-bold text-sm text-white tracking-wide block truncate">
            Premier Logistics
          </span>
          <span className="text-[11px] text-[#7F90AA] block truncate">
            SGP · Gestão de Postos
          </span>
        </div>
      </div>

      {/* Navegação agrupada por seções com títulos em caixa alta pequena */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {gruposMenu.map((grupo) => (
          <div key={grupo.titulo} className="space-y-1">
            <div className="px-2.5 text-[11px] font-bold text-[#7F90AA] tracking-wider uppercase">
              {grupo.titulo}
            </div>

            <div className="space-y-0.5 pt-1">
              {grupo.itens.map((item) => {
                const Icone = item.icone;
                const ativo = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      ativo
                        ? "bg-[#1F3A66] text-white font-semibold shadow-xs"
                        : "text-[#C9D2E0] hover:bg-[#162947] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icone
                        className={`w-4 h-4 shrink-0 ${
                          ativo ? "text-[#1F4FD1] bg-white rounded p-0.5" : "text-[#7F90AA]"
                        }`}
                      />
                      <span className="truncate">{item.rotulo}</span>
                    </div>

                    {/* Contador vermelho de pendências */}
                    {item.temBadge && totalPendencias > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#B42318] text-white tabular-nums shrink-0">
                        {totalPendencias}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé: Indicador verde "Ambiente seguro · LGPD" e versão v1.0 */}
      <div className="p-3.5 bg-[#0B1628] border-t border-[#1E2E4A] text-xs text-[#7F90AA] flex items-center justify-between">
        <Link
          href="/admin/ambiente"
          className="flex items-center gap-2 hover:text-white transition-colors"
          title="Ver infraestrutura e governança LGPD"
        >
          <span className="w-2 h-2 rounded-full bg-[#0F7B4F] shrink-0" />
          <span className="text-[11px] font-medium">Ambiente seguro · LGPD</span>
        </Link>
        <span className="text-[11px] font-mono text-[#7F90AA]/80">v1.0</span>
      </div>
    </aside>
  );
}
