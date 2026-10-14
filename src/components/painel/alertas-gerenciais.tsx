"use client";

/**
 * Alertas contratuais do Painel — substitui a antiga faixa "Atenção Gerencial".
 * Chips curtos e clicáveis: cada um mostra a quantidade e abre a lista filtrada
 * correspondente em /alertas?tipo=<slug>. Só aparecem alertas com quantidade > 0.
 *
 * Cores: vermelho = prazo vencido · âmbar = a vencer / pendência de cadastro · roxo = informativo.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarX2,
  UserRoundX,
  Truck,
  UserPlus,
  CalendarClock,
  ClipboardCheck,
  UsersRound,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Bell,
} from "lucide-react";
import {
  AlertaContratual,
  CorAlerta,
  TipoAlertaContratual,
  calcularAlertasContratuais,
  filtrarAlertasVisiveis,
} from "@/lib/servicos/alertas-contratuais";
import { carregarEstado, FERIADOS_OFICIAIS_CONTRATO } from "@/lib/dados/estado-operacional";

// =============================================================================
// HOOK — calcula os alertas a partir do estado operacional (cliente)
// =============================================================================

export function useAlertasContratuais(): { alertas: AlertaContratual[]; carregado: boolean } {
  const [versao, setVersao] = useState(0);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    setCarregado(true);
    const handler = () => setVersao((v) => v + 1);
    window.addEventListener("sgp-dados-atualizados", handler);
    return () => window.removeEventListener("sgp-dados-atualizados", handler);
  }, []);

  const alertas = useMemo(() => {
    if (!carregado) return calcularAlertasContratuais();
    const estado = carregarEstado();
    return calcularAlertasContratuais({
      ausencias: estado.ocorrencias as any[],
      pessoasAAlocar: estado.pessoasAAlocar || [],
      pendenciasEscala: estado.pendenciasEscala as any[] | undefined,
      feriados: FERIADOS_OFICIAIS_CONTRATO.filter((f) => f.tipo === "NACIONAL").map((f) => f.data),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado, versao]);

  return { alertas, carregado };
}

// =============================================================================
// ESTILO
// =============================================================================

export const ICONE_ALERTA: Record<TipoAlertaContratual, React.ComponentType<{ className?: string }>> = {
  "ferias-sem-consulta": CalendarX2,
  "substituicao-vencendo": UserRoundX,
  mobilizacao: Truck,
  "admissoes-a-alocar": UserPlus,
  "escala-sem-fase": CalendarClock,
  "validacoes-mc-rm": ClipboardCheck,
  "preposto-acima-limite": UsersRound,
};

export const ESTILO_COR: Record<
  CorAlerta,
  { chip: string; numero: string; icone: string; ponto: string; rotulo: string }
> = {
  VERMELHO: {
    chip: "bg-rose-50 border-rose-200 hover:border-rose-400 hover:bg-rose-100/70 focus-visible:ring-rose-400",
    numero: "bg-rose-600 text-white",
    icone: "text-rose-600",
    ponto: "bg-rose-500",
    rotulo: "Prazo vencido",
  },
  AMBAR: {
    chip: "bg-amber-50 border-amber-200 hover:border-amber-400 hover:bg-amber-100/70 focus-visible:ring-amber-400",
    numero: "bg-amber-500 text-white",
    icone: "text-amber-600",
    ponto: "bg-amber-500",
    rotulo: "A vencer / pendência",
  },
  ROXO: {
    chip: "bg-violet-50 border-violet-200 hover:border-violet-400 hover:bg-violet-100/70 focus-visible:ring-violet-400",
    numero: "bg-violet-600 text-white",
    icone: "text-violet-600",
    ponto: "bg-violet-500",
    rotulo: "Informativo",
  },
};

/** Rótulo do chip sem o número inicial (o número vai no badge). */
export function rotuloSemNumero(a: AlertaContratual): string {
  return a.rotulo.replace(/^\d+\s+/, "");
}

// =============================================================================
// COMPONENTE
// =============================================================================

export function AlertasGerenciais() {
  const [aberto, setAberto] = useState(false);
  const { alertas } = useAlertasContratuais();
  const visiveis = filtrarAlertasVisiveis(alertas);
  const totalAlertas = visiveis.reduce((acc, a) => acc + a.quantidade, 0);

  return (
    <div className="relative">
      <button
        type="button"
        id="btn-alertas-suspensas"
        onClick={() => setAberto((prev) => !prev)}
        className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
        aria-expanded={aberto}
        title={visiveis.length > 0 ? `${totalAlertas} alertas pendentes` : "Nenhum alerta pendente"}
      >
        <Bell className="w-3.5 h-3.5 text-slate-500" />
        <span>Alertas</span>
        {totalAlertas > 0 ? (
          <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {totalAlertas}
          </span>
        ) : (
          <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-100 text-slate-500">
            0
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>

      {aberto && (
        <>
          {/* Backdrop para fechar ao clicar fora */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setAberto(false)}
          />

          {/* Menu suspenso de alertas */}
          <div className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-40 text-xs">
            <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-800">Alertas Contratuais</span>
              <span className="text-[11px] text-slate-400">
                {visiveis.length} {visiveis.length === 1 ? "categoria" : "categorias"}
              </span>
            </div>

            {visiveis.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Nenhum alerta contratual pendente.</span>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {visiveis.map((a) => {
                  const estilo = ESTILO_COR[a.cor];
                  return (
                    <Link
                      key={a.tipo}
                      id={`alerta-${a.tipo}`}
                      href={a.href}
                      onClick={() => setAberto(false)}
                      className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors group"
                      title={`${estilo.rotulo} · ${a.descricao} (${a.referencia})`}
                    >
                      <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${estilo.ponto}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-900">
                            {a.quantidade} {rotuloSemNumero(a)}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-600 transition-all shrink-0" />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {a.descricao}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="px-3.5 pt-2 pb-1 border-t border-slate-100 flex justify-end">
              <Link
                href="/alertas"
                onClick={() => setAberto(false)}
                className="text-[11px] text-slate-600 hover:text-slate-900 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Ver central completa de alertas</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
