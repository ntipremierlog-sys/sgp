"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, ArrowRight, ExternalLink, Calendar } from "lucide-react";
import { FechamentoMedicaoDados } from "@/lib/servicos/calculo-ocupacao";

interface FechamentoMedicaoCardProps {
  dados: FechamentoMedicaoDados;
  perfilUsuario?: string;
  className?: string;
}

export function FechamentoMedicaoCard({
  dados,
  perfilUsuario = "PREMIER_GESTOR",
  className = "",
}: FechamentoMedicaoCardProps) {
  const isFiscal = perfilUsuario === "PETROBRAS_FISCAL";

  const { prazoFechamento, etapas, totalConcluidas, totalEtapas } = dados;
  const percentualProgresso = Math.round((totalConcluidas / totalEtapas) * 100);

  return (
    <div
      className={`bg-white p-5 rounded-[12px] border border-[#E3E6EB] shadow-xs flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Cabeçalho do Card com Prazo de Fechamento */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#F1F3F5]">
          <div>
            <h2 className="text-base font-bold text-[#1A2230] tracking-tight">
              Fechamento da medição
            </h2>
            <p className="text-xs text-[#5B6474] mt-0.5">
              Etapas contratuais para liberação da fatura
            </p>
          </div>

          <div className="shrink-0 text-right">
            {prazoFechamento ? (
              <div className="flex items-center gap-1 text-xs font-semibold text-[#1A2230] bg-[#F8FAFC] px-2.5 py-1 rounded-md border border-[#E3E6EB]">
                <Calendar className="w-3.5 h-3.5 text-[#5B6474]" />
                <span>Prazo {prazoFechamento}</span>
              </div>
            ) : isFiscal ? (
              <span className="text-xs font-medium text-[#5B6474] bg-[#F1F3F5] px-2.5 py-1 rounded-md">
                Prazo não cadastrado
              </span>
            ) : (
              <Link
                href="/admin"
                className="inline-flex items-center text-xs font-semibold text-[#1F4FD1] hover:text-[#163A9E] hover:underline"
              >
                <span>Prazo não cadastrado →</span>
              </Link>
            )}
          </div>
        </div>

        {/* Barra de Progresso N de 5 Etapas */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1A2230]">
              {totalConcluidas} de {totalEtapas} etapas concluídas
            </span>
            <span className="font-mono font-bold text-[#5B6474] tabular-nums">
              {percentualProgresso}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-[#F1F3F5] overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                percentualProgresso === 100 ? "bg-[#0F7B4F]" : "bg-[#1F4FD1]"
              }`}
              style={{ width: `${percentualProgresso}%` }}
            />
          </div>
        </div>

        {/* Checklist com as 5 Etapas */}
        <div className="mt-4 space-y-2">
          {etapas.map((etapa) => {
            const isConcluido = etapa.status === "CONCLUIDO";

            return (
              <div
                key={etapa.id}
                className="group flex items-start gap-2.5 p-2.5 rounded-lg border border-[#F1F3F5] hover:border-[#CBD5E1] bg-[#FAFBFC] hover:bg-white transition-all"
              >
                {/* Ícone de status */}
                <div className="mt-0.5 shrink-0">
                  {isConcluido ? (
                    <CheckCircle2 className="w-4 h-4 text-[#0F7B4F]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#B54708]" />
                  )}
                </div>

                {/* Textos da etapa */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-[#1A2230] leading-tight">
                      {etapa.ordem}. {etapa.titulo}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span
                      className={`text-[11px] font-medium ${
                        isConcluido ? "text-[#0F7B4F]" : "text-[#B54708]"
                      }`}
                    >
                      {etapa.detalhe}
                    </span>

                    {/* Ação ou Link direcionado */}
                    {!isFiscal ? (
                      etapa.acaoTexto && !isConcluido ? (
                        <Link
                          href={etapa.link}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#1F4FD1] hover:bg-[#163A9E] px-2 py-0.5 rounded shadow-xs transition-colors"
                        >
                          <span>{etapa.acaoTexto}</span>
                        </Link>
                      ) : (
                        <Link
                          href={etapa.link}
                          className="inline-flex items-center text-[11px] font-semibold text-[#1F4FD1] group-hover:underline"
                        >
                          <span>Ver →</span>
                        </Link>
                      )
                    ) : (
                      <span className="text-[11px] font-medium text-[#5B6474]">
                        {isConcluido ? "Em conformidade" : "Pendente"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rodapé Informativo */}
      <div className="mt-4 pt-3 border-t border-[#F1F3F5] flex items-center justify-between text-[11px] text-[#5B6474]">
        <span>Contrato ICJ 5900.0129796.25.2</span>
        <span>Competência 09/2026</span>
      </div>
    </div>
  );
}
