"use client";

import React from "react";
import Link from "next/link";
import { Building2, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BaseContratoStatus } from "@/lib/servicos/decisoes-consolidadas";

interface GraficoComparativoBasesProps {
  bases: BaseContratoStatus[];
  metaSla?: number;
  competencia: string;
}

export function GraficoComparativoBases({
  bases,
  metaSla = 95.0,
  competencia,
}: GraficoComparativoBasesProps) {
  // Ordena bases pelo SLA (menor primeiro para destacar atenção imediata)
  const basesOrdenadas = [...bases].sort((a, b) => {
    const valA = a.slaPercentual ?? 0;
    const valB = b.slaPercentual ?? 0;
    return valA - valB;
  });

  return (
    <div className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between border-b border-[#F1F3F5] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#1F4FD1]" />
            <h3 className="text-sm font-bold text-[#1A2230] uppercase tracking-wider">
              SLA por Base Contratual
            </h3>
          </div>
          <p className="text-xs text-[#5B6474] mt-0.5">
            Comparativo de cumprimento da meta de {Math.round(metaSla)}% entre as unidades operacionais
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#5B6474]">
          <span className="inline-block w-3 h-0.5 bg-amber-500 border border-amber-600 border-dashed" />
          <span>Meta {Math.round(metaSla)}%</span>
        </div>
      </div>

      <div className="space-y-4">
        {basesOrdenadas.map((base) => {
          const valor = base.slaPercentual ?? 0;
          const atingiuMeta = valor >= metaSla;
          const isCritico = valor < 85.0;

          const corBarra = atingiuMeta
            ? "bg-[#0F7B4F]"
            : isCritico
            ? "bg-[#D92D20]"
            : "bg-[#D97706]";

          const corTexto = atingiuMeta
            ? "text-[#0F7B4F]"
            : isCritico
            ? "text-[#D92D20]"
            : "text-[#B54708]";

          return (
            <div key={base.baseId} className="group space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <Link
                  href={`/painel/base/${base.baseId}?competencia=${competencia}`}
                  className="font-bold text-[#1A2230] group-hover:text-[#1F4FD1] transition-colors flex items-center gap-1.5"
                >
                  <span>{base.baseNome}</span>
                  <span className="text-[11px] text-[#64748B] font-normal">
                    ({base.postosTotal} postos)
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#94A3B8] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Link>

                <div className="flex items-center gap-2.5">
                  {base.postosVagosCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#D92D20]">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#D92D20]" />
                      <span>{base.postosVagosCount} {base.postosVagosCount === 1 ? "vago" : "vagos"}</span>
                    </span>
                  )}

                  <span className={`font-mono text-xs font-bold ${corTexto}`}>
                    {base.slaPercentualFormatado}
                  </span>
                </div>
              </div>

              {/* Barra de Progresso com Marcador de Meta em 95% */}
              <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${corBarra}`}
                  style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
                />
                {/* Linha vertical de referência da meta (95%) */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-600 z-10"
                  style={{ left: `${metaSla}%` }}
                  title={`Meta: ${metaSla}%`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>0%</span>
                <span className="text-amber-700 font-semibold">Meta 95%</span>
                <span>100%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-[#F1F3F5] flex items-center justify-between text-xs text-[#5B6474]">
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>&ge; 95% Conforme</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>85-94% Atenção</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>&lt; 85% Crítico</span>
          </span>
        </div>
      </div>
    </div>
  );
}
