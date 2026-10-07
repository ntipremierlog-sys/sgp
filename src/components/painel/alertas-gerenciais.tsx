"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Users,
  CheckCircle2,
  TrendingDown,
  CalendarClock,
  RefreshCw,
} from "lucide-react";

export interface ItemAlertaSintetico {
  id: string;
  tipo: "CRITICO" | "ALTO_RISCO" | "ATENCAO" | "INFO";
  titulo: string;
  descricao: string;
  labelBotao: string;
  linkHref: string;
  isScroll?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}

interface AlertasGerenciaisProps {
  slaAtual: number | null;
  metaSla: number;
  projecaoSla: number | null;
  postosVagos: number;
  basesComVagos: number;
  decisoesVencidas: number;
  descobertosTurno: number;
  frescorAtrasado: boolean;
  tempoFrescor: string;
  competencia: string;
  onAbrirPrazo?: () => void;
  temPrazoCadastrado?: boolean;
}

const CONFIG_TIPO = {
  CRITICO: {
    borda: "border-rose-300",
    fundo: "bg-rose-50",
    iconeCor: "text-rose-600",
    tituloCor: "text-rose-800",
    descricaoCor: "text-rose-700",
    botaoClasse: "bg-rose-600 hover:bg-rose-700 text-white",
    indicador: "bg-rose-500",
  },
  ALTO_RISCO: {
    borda: "border-orange-300",
    fundo: "bg-orange-50",
    iconeCor: "text-orange-600",
    tituloCor: "text-orange-900",
    descricaoCor: "text-orange-700",
    botaoClasse: "bg-orange-600 hover:bg-orange-700 text-white",
    indicador: "bg-orange-500",
  },
  ATENCAO: {
    borda: "border-amber-300",
    fundo: "bg-amber-50",
    iconeCor: "text-amber-600",
    tituloCor: "text-amber-900",
    descricaoCor: "text-amber-700",
    botaoClasse: "bg-amber-600 hover:bg-amber-700 text-white",
    indicador: "bg-amber-500",
  },
  INFO: {
    borda: "border-blue-200",
    fundo: "bg-blue-50",
    iconeCor: "text-blue-600",
    tituloCor: "text-blue-900",
    descricaoCor: "text-blue-700",
    botaoClasse: "bg-blue-600 hover:bg-blue-700 text-white",
    indicador: "bg-blue-500",
  },
};

export function AlertasGerenciais({
  slaAtual,
  metaSla,
  projecaoSla,
  postosVagos,
  basesComVagos,
  decisoesVencidas,
  descobertosTurno,
  frescorAtrasado,
  tempoFrescor,
  competencia,
}: AlertasGerenciaisProps) {
  const alertas: ItemAlertaSintetico[] = [];

  // 1. SLA abaixo da meta
  if (slaAtual !== null && slaAtual < metaSla) {
    const isCritico = slaAtual < 85.0;
    const desvio = (metaSla - slaAtual).toFixed(1).replace(".", ",");
    alertas.push({
      id: "alerta-sla",
      tipo: isCritico ? "CRITICO" : "ALTO_RISCO",
      titulo: isCritico
        ? `SLA Crítico: ${slaAtual.toFixed(1).replace(".", ",")}% — ${desvio} p.p. abaixo da meta`
        : `SLA Abaixo da Meta: ${slaAtual.toFixed(1).replace(".", ",")}%`,
      descricao: projecaoSla !== null
        ? `Meta contratual: ${Math.round(metaSla)}%. Projeção de fechamento: ${projecaoSla.toFixed(1).replace(".", ",")}%. Intervenção imediata necessária para reduzir glosa.`
        : `Meta contratual: ${Math.round(metaSla)}%. Revise os registros de presença e ocorrências para corrigir a tendência.`,
      labelBotao: "Ver evolução do SLA",
      linkHref: "#grafico-evolucao-sla",
      isScroll: true,
      Icon: TrendingDown,
    });
  }

  // 2. Postos homologados vagos
  if (postosVagos > 0) {
    alertas.push({
      id: "alerta-vagos",
      tipo: "ALTO_RISCO",
      titulo: `${postosVagos} ${postosVagos === 1 ? "Posto Vago" : "Postos Vagos"} sem Titular`,
      descricao: `${basesComVagos > 1 ? `Em ${basesComVagos} bases contratuais. ` : ""}Postos sem alocação impactam diretamente no SLA e geram glosa proporcional ao período sem cobertura.`,
      labelBotao: "Ver postos vagos",
      linkHref: `/postos?aba=VAGOS&competencia=${competencia}`,
      Icon: Users,
    });
  }

  // 3. Decisões operacionais vencidas
  if (decisoesVencidas > 0) {
    alertas.push({
      id: "alerta-vencidas",
      tipo: "CRITICO",
      titulo: `${decisoesVencidas} ${decisoesVencidas === 1 ? "Decisão Vencida" : "Decisões Vencidas"} sem Resposta`,
      descricao: `Prazo para justificativa ou cobertura já expirou. Pendências vencidas são passíveis de notificação formal pela fiscalização Petrobras.`,
      labelBotao: "Resolver pendências",
      linkHref: "#decisoes-pendentes",
      isScroll: true,
      Icon: CalendarClock,
    });
  }

  // 4. Postos descobertos hoje
  if (descobertosTurno > 0) {
    alertas.push({
      id: "alerta-descobertos",
      tipo: "ATENCAO",
      titulo: `${descobertosTurno} ${descobertosTurno === 1 ? "Posto Descoberto" : "Postos Descobertos"} no Turno Atual`,
      descricao: `Postos sem titular nem substituto registrado agora. Acione cobertura imediata ou registre ocorrência para não impactar o SLA de hoje.`,
      labelBotao: "Ver presenças",
      linkHref: `/presenca-diaria?situacao=DESCOBERTO&competencia=${competencia}`,
      Icon: AlertOctagon,
    });
  }

  // 5. Carga de ponto defasada
  if (frescorAtrasado) {
    alertas.push({
      id: "alerta-frescor",
      tipo: "INFO",
      titulo: `Dados Desatualizados (${tempoFrescor})`,
      descricao: `A última importação foi há mais de 24 horas. Os indicadores do painel podem não refletir a situação real. Importe os arquivos de ponto para atualizar.`,
      labelBotao: "Importar agora",
      linkHref: "/importacoes",
      Icon: RefreshCw,
    });
  }

  // Estado de conformidade total
  if (alertas.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Contrato em Conformidade Plena</p>
            <p className="text-xs text-emerald-700">SLA acima da meta, quadro de postos regular e sem pendências vencidas. Operação estável.</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-full shrink-0">
          Tudo em ordem ✓
        </span>
      </div>
    );
  }

  // Alertas expandidos em grid
  return (
    <section aria-label="Alertas e riscos gerenciais" className="w-full space-y-2">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-rose-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-[#1A2230]">
          Atenção Gerencial — {alertas.length} {alertas.length === 1 ? "item requer sua ação" : "itens requerem sua ação"}
        </span>
      </div>

      <div className={`grid gap-3 ${alertas.length === 1 ? "grid-cols-1" : alertas.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {alertas.map((item) => {
          const cfg = CONFIG_TIPO[item.tipo];
          return (
            <div
              key={item.id}
              className={`relative rounded-xl border ${cfg.borda} ${cfg.fundo} p-4 flex flex-col gap-3 shadow-sm overflow-hidden`}
            >
              {/* Barra lateral de severidade */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.indicador} rounded-l-xl`} />

              <div className="flex items-start gap-3 pl-2">
                <div className={`mt-0.5 shrink-0 ${cfg.iconeCor}`}>
                  <item.Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold leading-tight ${cfg.tituloCor}`}>
                    {item.titulo}
                  </p>
                  <p className={`text-xs mt-1 leading-relaxed ${cfg.descricaoCor}`}>
                    {item.descricao}
                  </p>
                </div>
              </div>

              <div className="pl-2">
                {item.isScroll ? (
                  <a
                    href={item.linkHref}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${cfg.botaoClasse}`}
                  >
                    <span>{item.labelBotao}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <Link
                    href={item.linkHref}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${cfg.botaoClasse}`}
                  >
                    <span>{item.labelBotao}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
