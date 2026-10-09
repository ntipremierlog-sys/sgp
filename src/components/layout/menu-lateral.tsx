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
  AlertCircle,
  UserCheck2,
  MessageSquare,
  UploadCloud,
  History,
  ShieldCheck,
  Settings,
  FileCheck,
  FileSpreadsheet,
  Clock,
  Construction,
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
  rotasAdicionais?: string[];
}

interface GrupoMenu {
  titulo: string;
  itens: MenuItem[];
}

const gruposMenuConfig: GrupoMenu[] = [
  {
    titulo: "OPERAÇÃO",
    itens: [
      { rotulo: "Painel", href: "/painel", icone: LayoutDashboard, recurso: "PAINEL", rotasAdicionais: ["/alertas"] },
      { rotulo: "Mapa de cobertura", href: "/mapa-ocupacao", icone: CalendarCheck, recurso: "MAPA_OCUPACAO", rotasAdicionais: ["/descobertos", "/presenca-diaria"] },
      { rotulo: "Coberturas e ocorrências", href: "/coberturas", icone: UserCheck2, recurso: "COBERTURAS", rotasAdicionais: ["/ocorrencias"] },
      { rotulo: "Profissionais", href: "/profissionais", icone: Users, recurso: "PROFISSIONAIS" },
      { rotulo: "Postos (Anexo 1-A)", href: "/postos", icone: Briefcase, recurso: "POSTOS" },
    ],
  },
  {
    titulo: "FISCALIZAÇÃO",
    itens: [
      { rotulo: "Relatórios", href: "/relatorios", icone: FileSpreadsheet, recurso: "RELATORIOS" },
      { rotulo: "Apontamentos Petrobras", href: "/apontamentos", icone: MessageSquare, temBadge: true, recurso: "APONTAMENTOS" },
      { rotulo: "Conformidade", href: "/conformidade", icone: ShieldCheck, recurso: "CONFORMIDADE" },
    ],
  },
  {
    titulo: "SISTEMA",
    itens: [
      { rotulo: "Importações", href: "/importacoes", icone: UploadCloud, recurso: "IMPORTACOES" },
      { rotulo: "Conciliação SIFAC", href: "/conciliacao-sifac", icone: FileCheck, recurso: "CONCILIACAO_SIFAC" },
      { rotulo: "Auditoria", href: "/auditoria", icone: History, recurso: "AUDITORIA" },
      { rotulo: "Administração", href: "/admin", icone: Settings, recurso: "ADMINISTRACAO", alertaPonto: true, rotasAdicionais: ["/admin/importar-funcionarios"] },
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
    <aside className="w-[240px] h-full bg-[#0F1E36] text-[#C9D2E0] flex flex-col shrink-0 select-none border-r border-[#1E2E4A]">
      {/* Topo: marca oficial Premier Logistics (versão para fundo escuro) + "SGP · Gestão de Postos" */}
      <Link
        href="/painel"
        className="px-4 pt-4 pb-3 border-b border-[#1E2E4A] flex flex-col items-center gap-1.5 shrink-0 hover:bg-[#13233F] transition-colors"
        title="Premier Logistics · SGP"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marca/premier-logistics-claro.png"
          alt="Premier Logistics"
          width={150}
          height={80}
          className="w-[150px] h-auto select-none"
          draggable={false}
        />
        <span className="text-[10px] text-[#7F90AA] tracking-[0.18em] uppercase">
          SGP · Gestão de Postos
        </span>
      </Link>

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
                  const ativo =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/") ||
                    Boolean(item.rotasAdicionais?.some((r) => pathname === r || pathname.startsWith(r + "/")));
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
      <div className="p-3.5 bg-[#0B1628] border-t border-[#1E2E4A] text-xs text-[#7F90AA] flex items-center justify-between shrink-0">
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
