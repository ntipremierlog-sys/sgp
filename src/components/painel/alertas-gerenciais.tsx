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
  CheckCircle2,
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
  const { alertas } = useAlertasContratuais();
  const visiveis = filtrarAlertasVisiveis(alertas);

  if (visiveis.length === 0) {
    return (
      <section
        aria-label="Alertas contratuais"
        className="flex items-center gap-2 text-xs text-slate-500"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>Nenhum alerta contratual pendente.</span>
      </section>
    );
  }

  return (
    <section aria-label="Alertas contratuais" className="flex items-center gap-3 flex-wrap">
      <h2 className="text-xs font-medium text-slate-500 shrink-0">Alertas</h2>
      <ul className="flex flex-wrap gap-2" role="list">
        {visiveis.map((a) => {
          const estilo = ESTILO_COR[a.cor];
          return (
            <li key={a.tipo}>
              <Link
                id={`alerta-${a.tipo}`}
                href={a.href}
                title={`${estilo.rotulo} · ${a.descricao} (${a.referencia})`}
                className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${estilo.ponto}`} />
                <span className="font-semibold tabular-nums text-slate-900">{a.quantidade}</span>
                <span>{rotuloSemNumero(a)}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
