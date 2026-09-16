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
  { rotulo: "Painel geral", href: "/", icone: LayoutDashboard },
  { rotulo: "Mapa de ocupação", href: "/mapa-ocupacao", icone: CalendarCheck },
  { rotulo: "Postos do anexo 1-A", href: "/postos", icone: Briefcase },
  { rotulo: "Profissionais", href: "/profissionais", icone: Users },
  { rotulo: "Ocorrências", href: "/ocorrencias", icone: AlertTriangle },
  { rotulo: "Coberturas", href: "/coberturas", icone: UserCheck2 },
  { rotulo: "Apontamentos Petrobras", href: "/apontamentos", icone: MessageSquare },
  { rotulo: "Relatórios e medição", href: "/relatorios", icone: FileSpreadsheet },
  { rotulo: "Importações de dados", href: "/importacoes", icone: UploadCloud },
  { rotulo: "Trilha de auditoria", href: "/auditoria", icone: History },
  { rotulo: "Conformidade contratual", href: "/conformidade", icone: ShieldCheck },
  { rotulo: "Administração", href: "/admin", icone: Settings },
];

export function MenuLateral() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col shrink-0 select-none">
      <div className="p-3 text-[11px] font-semibold text-slate-400 tracking-wider border-b border-slate-800 flex items-center justify-between">
        <span>Navegação operacional</span>
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
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icone
                className={`w-4 h-4 shrink-0 ${
                  ativo ? "text-white" : "text-slate-400"
                }`}
              />
              <span className="truncate">{item.rotulo}</span>
            </Link>
          );
        })}
      </nav>

      {/* Acesso ao Ambiente e Governança LGPD */}
      <div className="p-3 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-400">
        <Link
          href="/admin/ambiente"
          className="flex items-center justify-between hover:text-white transition-colors group"
        >
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Ambiente e LGPD</span>
          </span>
          <span className="text-[10px] text-slate-400 group-hover:text-slate-200">Ver detalhes →</span>
        </Link>
      </div>
    </aside>
  );
}
