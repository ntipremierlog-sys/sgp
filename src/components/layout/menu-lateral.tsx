"use client";

import React from "react";
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

interface MenuItem {
  rotulo: string;
  href: string;
  icone: React.ComponentType<{ className?: string }>;
  destaque?: boolean;
}

const menuItems: MenuItem[] = [
  { rotulo: "Painel Geral", href: "/", icone: LayoutDashboard },
  { rotulo: "Mapa de Ocupação", href: "/mapa-ocupacao", icone: CalendarCheck, destaque: true },
  { rotulo: "Postos do Anexo 1-A", href: "/postos", icone: Briefcase },
  { rotulo: "Profissionais", href: "/profissionais", icone: Users },
  { rotulo: "Ocorrências", href: "/ocorrencias", icone: AlertTriangle },
  { rotulo: "Coberturas", href: "/coberturas", icone: UserCheck2 },
  { rotulo: "Apontamentos Petrobras", href: "/apontamentos", icone: MessageSquare },
  { rotulo: "Relatórios & MC", href: "/relatorios", icone: FileSpreadsheet },
  { rotulo: "Importações de Dados", href: "/importacoes", icone: UploadCloud },
  { rotulo: "Trilha de Auditoria", href: "/auditoria", icone: History },
  { rotulo: "Conformidade Contratual", href: "/conformidade", icone: ShieldCheck },
  { rotulo: "Administração", href: "/admin", icone: Settings },
];

export function MenuLateral() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col shrink-0 select-none">
      <div className="p-3 text-[11px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800 flex items-center justify-between">
        <span>Navegação Operacional</span>
        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">v1.0</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1 text-sm">
        {menuItems.map((item) => {
          const Icone = item.icone;
          const ativo = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                ativo
                  ? "bg-premier-700 text-white shadow-sm border border-premier-600"
                  : item.destaque
                  ? "bg-blue-950/40 text-blue-300 border border-blue-900/60 hover:bg-blue-900/40 hover:text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icone
                className={`w-4 h-4 shrink-0 ${
                  ativo
                    ? "text-white"
                    : item.destaque
                    ? "text-blue-400"
                    : "text-slate-400"
                }`}
              />
              <span className="truncate">{item.rotulo}</span>
              {item.destaque && (
                <span className="ml-auto text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Central
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Box de Segurança e Conectividade */}
      <div className="p-3 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span>Banco:</span>
          <span className="text-emerald-400 font-mono">Neon (sa-east-1)</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Hospedagem:</span>
          <span className="text-slate-300 font-mono">Vercel Pro (gru1)</span>
        </div>
        <div className="flex items-center justify-between">
          <span>LGPD:</span>
          <span className="text-emerald-400">Ativo (São Paulo)</span>
        </div>
      </div>
    </aside>
  );
}
