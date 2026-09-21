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
  FileCheck,
  Clock,
  Lock,
} from "lucide-react";
import { carregarEstado } from "@/lib/dados/estado-operacional";
import { can } from "@/lib/auth/permissoes";
import { UsuarioSessao, Recurso } from "@/lib/auth/tipos";
import { temConfiguracaoPendente, obterParametrosContrato } from "@/lib/auth/parametros";

interface MenuItem {
  rotulo: string;
  href: string;
  icone: React.ComponentType<{ className?: string }>;
  temBadge?: boolean;
  recurso?: Recurso;
  alertaPonto?: boolean;
}

interface GrupoMenu {
  titulo: string;
  itens: MenuItem[];
}

const gruposMenuConfig: GrupoMenu[] = [
  {
    titulo: "OPERAÇÃO",
    itens: [
      { rotulo: "Painel geral", href: "/painel", icone: LayoutDashboard, recurso: "PAINEL" },
      { rotulo: "Mapa de ocupação", href: "/mapa-ocupacao", icone: CalendarCheck, recurso: "MAPA_OCUPACAO" },
      { rotulo: "Presença diária", href: "/presenca-diaria", icone: Clock, recurso: "PROFISSIONAIS" },
      { rotulo: "Postos do Anexo 1-A", href: "/postos", icone: Briefcase, recurso: "POSTOS" },
      { rotulo: "Profissionais", href: "/profissionais", icone: Users, recurso: "PROFISSIONAIS" },
      { rotulo: "Ocorrências", href: "/ocorrencias", icone: AlertTriangle, recurso: "OCORRENCIAS" },
      { rotulo: "Coberturas", href: "/coberturas", icone: UserCheck2, recurso: "COBERTURAS" },
    ],
  },
  {
    titulo: "FISCALIZAÇÃO",
    itens: [
      { rotulo: "Apontamentos Petrobras", href: "/apontamentos", icone: MessageSquare, temBadge: true, recurso: "APONTAMENTOS" },
      { rotulo: "Relatórios e medição", href: "/relatorios", icone: FileSpreadsheet, recurso: "RELATORIOS" },
      { rotulo: "Fechamento mensal", href: "/fechamento", icone: Lock, recurso: "ADMINISTRACAO" },
      { rotulo: "Conformidade contratual", href: "/conformidade", icone: ShieldCheck, recurso: "CONFORMIDADE" },
      { rotulo: "Trilha de auditoria", href: "/auditoria", icone: History, recurso: "AUDITORIA" },
    ],
  },
  {
    titulo: "SISTEMA",
    itens: [
      { rotulo: "Importações de dados", href: "/importacoes", icone: UploadCloud, recurso: "IMPORTACOES" },
      { rotulo: "Conciliação SIFAC", href: "/conciliacao-sifac", icone: FileCheck, recurso: "CONCILIACAO_SIFAC" },
      { rotulo: "Pendências de ponto", href: "/admin/pendencias-ponto", icone: AlertTriangle, recurso: "ADMINISTRACAO" },
      { rotulo: "Modelos de ponto", href: "/admin/modelos-ponto", icone: Settings, recurso: "ADMINISTRACAO" },
      { rotulo: "Administração", href: "/admin", icone: Settings, recurso: "ADMINISTRACAO", alertaPonto: true },
    ],
  },
];


export function MenuLateral() {
  const pathname = usePathname();
  const [totalPendencias, setTotalPendencias] = useState<number>(0);
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [temPendenciaAdmin, setTemPendenciaAdmin] = useState<boolean>(false);

  useEffect(() => {
    const atualizar = async () => {
      // 1. Apontamentos
      const estado = carregarEstado();
      const abertos = estado.apontamentos.filter(
        (a) => a.status === "ABERTO" || a.status === "EM_TRATAMENTO"
      ).length;
      setTotalPendencias(abertos);

      // 2. Parâmetros pendentes
      const params = obterParametrosContrato();
      setTemPendenciaAdmin(temConfiguracaoPendente(params));

      // 3. Sessão atual
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.autenticado && data.usuario) {
            setSessao(data.usuario);
            return;
          }
        }
      } catch {
        // fallback
      }
    };

    atualizar();
    window.addEventListener("sgp-dados-atualizados", atualizar);
    window.addEventListener("sgp-sessao-alterada", atualizar);
    window.addEventListener("sgp-parametros-atualizados", atualizar);
    return () => {
      window.removeEventListener("sgp-dados-atualizados", atualizar);
      window.removeEventListener("sgp-sessao-alterada", atualizar);
      window.removeEventListener("sgp-parametros-atualizados", atualizar);
    };
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
        {gruposMenuConfig.map((grupo) => {
          // Filtra itens que o usuário autenticado tem permissão de ver
          const itensVisiveis = grupo.itens.filter((item) => {
            if (!item.recurso) return true;
            // Se ainda não carregou a sessão, assume permissão básica (admin no dev)
            if (!sessao) return item.recurso !== "ADMINISTRACAO";
            return can(sessao, "LER", item.recurso);
          });

          if (itensVisiveis.length === 0) return null;

          return (
            <div key={grupo.titulo} className="space-y-1">
              <div className="px-2.5 text-[11px] font-bold text-[#7F90AA] tracking-wider uppercase">
                {grupo.titulo}
              </div>

              <div className="space-y-0.5 pt-1">
                {itensVisiveis.map((item) => {
                  const Icone = item.icone;
                  const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
                  const mostrarPontoAlerta = item.alertaPonto && temPendenciaAdmin;

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
                        <div className="relative">
                          <Icone
                            className={`w-4 h-4 shrink-0 ${
                              ativo ? "text-[#1F4FD1] bg-white rounded p-0.5" : "text-[#7F90AA]"
                            }`}
                          />
                          {/* Ponto discreto indicador de configurações pendentes */}
                          {mostrarPontoAlerta && (
                            <span
                              className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#F79009] ring-2 ring-[#0F1E36]"
                              title="Configurações contratuais pendentes de preenchimento"
                            />
                          )}
                        </div>
                        <span className="truncate">{item.rotulo}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Ponto discreto indicador na lateral */}
                        {mostrarPontoAlerta && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-[#F79009]"
                            title="Parâmetro pendente"
                          />
                        )}

                        {/* Contador vermelho de pendências */}
                        {item.temBadge && totalPendencias > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#B42318] text-white tabular-nums">
                            {totalPendencias}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Rodapé: Indicador verde "Ambiente seguro · LGPD" e versão v1.0 */}
      <div className="p-3.5 bg-[#0B1628] border-t border-[#1E2E4A] text-xs text-[#7F90AA] flex items-center justify-between">
        <Link
          href="/admin/ambiente"
          className="flex items-center gap-2 hover:text-white transition-colors"
          title="Ver infraestrutura e governança LGPD"
        >
          <span className="w-2 h-2 rounded-full bg-[#12B76A] shrink-0" />
          <span className="text-[11px] font-medium truncate">Ambiente seguro · LGPD</span>
        </Link>
        <span className="text-[10px] text-[#4E5D78] font-mono">v1.0</span>
      </div>
    </aside>
  );
}
