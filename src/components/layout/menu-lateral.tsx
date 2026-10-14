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
  UploadCloud,
  History,
  ShieldCheck,
  Settings,
  FileCheck,
  FileSpreadsheet,
} from "lucide-react";
import { carregarEstado } from "@/lib/dados/estado-operacional";
import { can } from "@/lib/auth/permissoes";
import { EVENTO_PERMISSOES_ATUALIZADAS } from "@/lib/auth/use-permissoes";
import { UsuarioSessao, Recurso } from "@/lib/auth/tipos";
import { temConfiguracaoPendente, obterParametrosContrato } from "@/lib/auth/parametros";

interface SubMenuItem {
  rotulo: string;
  href: string;
}

interface MenuItem {
  rotulo: string;
  href: string;
  icone: React.ComponentType<{ className?: string }>;
  temBadge?: boolean;
  recurso?: Recurso;
  alertaPonto?: boolean;
  rotasAdicionais?: string[];
  subitens?: SubMenuItem[];
}

interface GrupoMenu {
  titulo: string;
  itens: MenuItem[];
}

const gruposMenuConfig: GrupoMenu[] = [
  {
    titulo: "OPERAÇÃO",
    itens: [
      { rotulo: "Painel Executivo", href: "/painel", icone: LayoutDashboard, recurso: "PAINEL", rotasAdicionais: ["/alertas"] },
      { rotulo: "Mapa de Cobertura", href: "/mapa-ocupacao", icone: CalendarCheck, recurso: "MAPA_OCUPACAO", rotasAdicionais: ["/descobertos", "/presenca-diaria"] },
      { rotulo: "Coberturas e Ocorrências", href: "/coberturas", icone: UserCheck2, recurso: "COBERTURAS", rotasAdicionais: ["/ocorrencias"] },
      { rotulo: "Profissionais", href: "/profissionais", icone: Users, recurso: "PROFISSIONAIS" },
      { rotulo: "Postos de Trabalho", href: "/postos", icone: Briefcase, recurso: "POSTOS" },
    ],
  },
  {
    titulo: "FISCALIZAÇÃO",
    itens: [
      {
        rotulo: "Relatórios",
        href: "/relatorios",
        icone: FileSpreadsheet,
        recurso: "RELATORIOS",
        rotasAdicionais: ["/relatorios/coberturas"],
        subitens: [
          { rotulo: "Ocupação por Posto", href: "/relatorios" },
          { rotulo: "Coberturas (PPU)", href: "/relatorios/coberturas" },
        ],
      },
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

      // 3. Sessão
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.autenticado && data.usuario) {
            setSessao(data.usuario);
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
    window.addEventListener(EVENTO_PERMISSOES_ATUALIZADAS, atualizar);

    return () => {
      window.removeEventListener("sgp-dados-atualizados", atualizar);
      window.removeEventListener("sgp-sessao-alterada", atualizar);
      window.removeEventListener("sgp-parametros-atualizados", atualizar);
      window.removeEventListener(EVENTO_PERMISSOES_ATUALIZADAS, atualizar);
    };
  }, []);

  return (
    <aside className="w-[240px] h-full bg-[#0F1E36] text-[#C9D2E0] flex flex-col shrink-0 select-none border-r border-[#1E2E4A]/80 shadow-sm">
      {/* Topo: Marca Oficial Premier Logistics com contraste refinado */}
      <Link
        href="/painel"
        className="px-5 py-4 border-b border-[#1E2E4A]/80 flex flex-col items-center gap-1.5 shrink-0 hover:bg-[#13233F] transition-colors group"
        title="Premier Logistics — SGP"
      >
        <img
          src="/marca/premier-logistics-claro.png"
          alt="Premier Logistics"
          width={140}
          height={60}
          className="w-[140px] h-auto select-none transition-transform group-hover:scale-[1.02]"
          draggable={false}
        />
        <span className="text-[10px] text-[#8EA0BD] font-medium tracking-[0.16em] uppercase">
          SGP • Gestão de Postos
        </span>
      </Link>

      {/* Navegação agrupada com espaçamento harmonioso */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-700">
        {gruposMenuConfig.map((grupo) => {
          // Filtra itens que o usuário autenticado tem permissão de ver
          const itensVisiveis = grupo.itens.filter((item) => {
            if (!item.recurso) return true;
            if (!sessao) return false;
            return can(sessao, "LER", item.recurso);
          });

          if (itensVisiveis.length === 0) return null;

          return (
            <div key={grupo.titulo} className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-bold text-[#6D80A0] tracking-wider uppercase">
                {grupo.titulo}
              </div>

              <div className="space-y-0.5">
                {itensVisiveis.map((item) => {
                  const Icone = item.icone;
                  const ativo =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/") ||
                    Boolean(item.rotasAdicionais?.some((r) => pathname === r || pathname.startsWith(r + "/")));
                  const mostrarPontoAlerta = item.alertaPonto && temPendenciaAdmin;
                  const temSubitens = Boolean(item.subitens && item.subitens.length > 0);
                  const subitensAbertos = Boolean(
                    item.subitens && (
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/") ||
                      item.subitens.some((s) => pathname === s.href || pathname.startsWith(s.href + "/"))
                    )
                  );

                  return (
                    <div key={item.href} className="space-y-0.5">
                      <Link
                        href={item.href}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                          ativo
                            ? "bg-[#1F4FD1] text-white font-semibold shadow-md shadow-blue-950/40"
                            : "text-[#C9D2E0] hover:bg-[#162947] hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <Icone
                              className={`w-4 h-4 transition-colors ${
                                ativo ? "text-white" : "text-[#7F90AA] group-hover:text-white"
                              }`}
                            />
                            {/* Ponto indicador de configurações pendentes */}
                            {mostrarPontoAlerta && (
                              <span
                                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#F79009] ring-2 ring-[#0F1E36]"
                                title="Configurações pendentes de preenchimento"
                              />
                            )}
                          </div>
                          <span className="truncate">{item.rotulo}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Ponto indicador na lateral */}
                          {mostrarPontoAlerta && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[#F79009]"
                              title="Parâmetro pendente"
                            />
                          )}

                          {/* Contador de pendências */}
                          {item.temBadge && totalPendencias > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white tabular-nums shadow-xs">
                              {totalPendencias}
                            </span>
                          )}
                        </div>
                      </Link>

                      {/* Sub-itens indentados para relatórios */}
                      {temSubitens && subitensAbertos && (
                        <div className="ml-5 pl-2.5 border-l border-[#1E2E4A] space-y-0.5 pt-1 pb-1">
                          {item.subitens!.map((sub) => {
                            const subAtivo =
                              pathname === sub.href ||
                              (sub.href !== "/relatorios" && pathname.startsWith(sub.href)) ||
                              (sub.href === "/relatorios" && pathname === "/relatorios");

                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                  subAtivo
                                    ? "text-white font-semibold bg-[#162947]"
                                    : "text-[#7F90AA] hover:text-[#C9D2E0] hover:bg-[#13233F]"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    subAtivo ? "bg-blue-400" : "bg-[#4E5D78]"
                                  }`}
                                />
                                <span className="truncate">{sub.rotulo}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Rodapé: Indicador discreto de governança e versão */}
      <div className="p-3.5 bg-[#0B1628] border-t border-[#1E2E4A]/80 text-xs text-[#7F90AA] flex items-center justify-between shrink-0">
        <Link
          href="/admin/ambiente"
          className="flex items-center gap-2 hover:text-white transition-colors"
          title="Ver infraestrutura e governança LGPD"
        >
          <span className="w-2 h-2 rounded-full bg-[#12B76A] shrink-0" />
          <span className="text-[11px] font-medium truncate">Ambiente seguro • LGPD</span>
        </Link>
        <span className="text-[10px] text-[#4E5D78] font-mono">v1.0</span>
      </div>
    </aside>
  );
}
