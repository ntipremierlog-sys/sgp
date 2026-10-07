"use client";

import React from "react";
import Link from "next/link";
import { Zap, ArrowRight, AlertOctagon, UserX, Clock, FileCheck } from "lucide-react";

interface AcaoImediataProps {
  descobertosTurno: number;
  postosVagos: number;
  decisoesVencidas: number;
  etapaPendenteTitulo: string | null;
  etapaPendenteLink: string | null;
  competencia: string;
}

interface AcaoItem {
  prioridade: number;
  titulo: string;
  descricao: string;
  labelBotao: string;
  href: string;
  isScroll?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
  cor: "vermelho" | "laranja" | "azul";
}

const COR_MAP = {
  vermelho: {
    fundo: "from-rose-600 to-rose-700",
    badge: "bg-rose-100 text-rose-800",
    botao: "bg-white/20 hover:bg-white/30 text-white border border-white/30",
  },
  laranja: {
    fundo: "from-orange-500 to-orange-600",
    badge: "bg-orange-100 text-orange-800",
    botao: "bg-white/20 hover:bg-white/30 text-white border border-white/30",
  },
  azul: {
    fundo: "from-[#1F4FD1] to-[#163CA8]",
    badge: "bg-blue-100 text-blue-800",
    botao: "bg-white/20 hover:bg-white/30 text-white border border-white/30",
  },
};

export function AcaoImediataRecomendada({
  descobertosTurno,
  postosVagos,
  decisoesVencidas,
  etapaPendenteTitulo,
  etapaPendenteLink,
  competencia,
}: AcaoImediataProps) {
  // Monta lista de ações ordenadas por prioridade
  const acoes: AcaoItem[] = [];

  if (descobertosTurno > 0) {
    acoes.push({
      prioridade: 1,
      titulo: `${descobertosTurno} ${descobertosTurno === 1 ? "posto descoberto" : "postos descobertos"} agora`,
      descricao: "Registre cobertura ou justificativa antes do fim do turno para não computar desconto no SLA de hoje.",
      labelBotao: "Registrar cobertura",
      href: `/presenca-diaria?situacao=DESCOBERTO&competencia=${competencia}`,
      Icon: AlertOctagon,
      cor: "vermelho",
    });
  }

  if (decisoesVencidas > 0) {
    acoes.push({
      prioridade: 2,
      titulo: `${decisoesVencidas} ${decisoesVencidas === 1 ? "decisão com prazo vencido" : "decisões com prazo vencido"}`,
      descricao: "Pendências vencidas ficam visíveis para a fiscalização Petrobras. Resolva para evitar notificação formal.",
      labelBotao: "Resolver agora",
      href: "#decisoes-pendentes",
      isScroll: true,
      Icon: Clock,
      cor: "vermelho",
    });
  }

  if (postosVagos > 0 && descobertosTurno === 0) {
    acoes.push({
      prioridade: 3,
      titulo: `${postosVagos} ${postosVagos === 1 ? "posto vago" : "postos vagos"} sem processo de substituição`,
      descricao: "Inicie processo de substituição ou remanejamento. Vacâncias prolongadas geram glosa acumulada.",
      labelBotao: "Gerenciar postos",
      href: `/postos?aba=VAGOS&competencia=${competencia}`,
      Icon: UserX,
      cor: "laranja",
    });
  }

  if (etapaPendenteTitulo && etapaPendenteLink && acoes.length === 0) {
    acoes.push({
      prioridade: 4,
      titulo: `Próxima etapa de fechamento pendente`,
      descricao: `Execute: "${etapaPendenteTitulo}" para avançar no processo de medição mensal da Petrobras.`,
      labelBotao: "Executar etapa",
      href: etapaPendenteLink,
      Icon: FileCheck,
      cor: "azul",
    });
  }

  // Se não há nenhuma ação urgente, não renderiza o componente
  if (acoes.length === 0) return null;

  const principal = acoes[0];
  const cfg = COR_MAP[principal.cor];

  return (
    <div
      className={`relative rounded-xl bg-gradient-to-r ${cfg.fundo} p-5 shadow-md overflow-hidden`}
      aria-label="Ação imediata recomendada"
    >
      {/* Padrão decorativo de fundo */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full border-2 border-white" />
        <div className="absolute -right-2 -bottom-4 w-28 h-28 rounded-full border-2 border-white" />
      </div>

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Ícone com pulsação */}
          <div className="shrink-0 relative mt-0.5">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-white animate-ping opacity-60" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/70">
                ⚡ Ação Imediata Recomendada
              </span>
            </div>
            <h3 className="text-base font-bold text-white leading-tight">
              {principal.titulo}
            </h3>
            <p className="text-sm text-white/80 mt-1 leading-relaxed max-w-xl">
              {principal.descricao}
            </p>

            {/* Ações secundárias (se houver) */}
            {acoes.length > 1 && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {acoes.slice(1).map((a, i) => (
                  <span key={i} className="text-xs font-semibold text-white/70">
                    +{" "}
                    {a.isScroll ? (
                      <a href={a.href} className="hover:text-white underline">
                        {a.titulo}
                      </a>
                    ) : (
                      <Link href={a.href} className="hover:text-white underline">
                        {a.titulo}
                      </Link>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CTA Principal */}
        <div className="shrink-0">
          {principal.isScroll ? (
            <a
              href={principal.href}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${cfg.botao} backdrop-blur-sm`}
            >
              <span>{principal.labelBotao}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          ) : (
            <Link
              href={principal.href}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${cfg.botao} backdrop-blur-sm`}
            >
              <span>{principal.labelBotao}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
