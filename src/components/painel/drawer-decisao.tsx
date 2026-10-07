"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  X,
  User,
  Calendar,
  AlertTriangle,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { DecisaoConsolidadaPosto } from "@/lib/servicos/decisoes-consolidadas";

interface DrawerDecisaoProps {
  decisao: DecisaoConsolidadaPosto | null;
  aberto: boolean;
  onFechar: () => void;
  ehFiscal?: boolean;
  competencia: string;
}

export function DrawerDecisao({
  decisao,
  aberto,
  onFechar,
  ehFiscal = false,
  competencia,
}: DrawerDecisaoProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aberto) {
        onFechar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aberto, onFechar]);

  if (!aberto || !decisao) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop com blur suave */}
      <div
        onClick={onFechar}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Painel Lateral que desliza da direita (100% em mobile, max-w-md em desktop) */}
      <div className="absolute inset-y-0 right-0 max-w-full flex sm:pl-10">
        <aside className="w-screen max-w-full sm:max-w-md bg-white border-l border-[#E3E6EB] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250">
          {/* Topo do Drawer */}
          <div className="p-6 border-b border-[#E3E6EB] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5B6474]">
                {decisao.baseNome}
              </span>

              <button
                onClick={onFechar}
                className="p-1 rounded-lg text-[#5B6474] hover:text-[#1A2230] hover:bg-[#F2F4F7] transition-colors"
                title="Fechar painel (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1A2230] leading-snug">
                {decisao.funcao}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs text-[#5B6474]">
                  {decisao.codigoPosto}
                </span>
                <span className="text-slate-300">·</span>
                <span
                  className={`text-xs font-semibold inline-flex items-center gap-1.5 ${
                    decisao.seloCor === "vermelho"
                      ? "text-[#B42318]"
                      : "text-[#B54708]"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${decisao.seloCor === "vermelho" ? "bg-[#B42318]" : "bg-[#B54708]"}`} />
                  <span>{decisao.seloTexto}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Corpo do Drawer (conteúdo rolável) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Bloco 1: Raio-X da Situação do Posto */}
            <div className="bg-white rounded-xl border border-[#E3E6EB] p-4 space-y-3 text-xs">
              <h3 className="font-bold text-[#1A2230] flex items-center gap-1.5 text-xs">
                <Clock className="w-3.5 h-3.5 text-[#1F4FD1]" />
                <span>Situação Atual do Posto</span>
              </h3>

              <div className="space-y-2 text-[#475467]">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-[#667085]">Titular homologado:</span>
                  <span className="font-semibold text-[#1A2230] text-right">
                    {decisao.titularNome}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-[#667085]">Status no turno:</span>
                  <span className="font-semibold text-[#B42318]">
                    {decisao.statusPosto === "VAGO"
                      ? "Posto vago (sem titular)"
                      : "Descoberto no turno de hoje"}
                  </span>
                </div>

                {decisao.desdeQuandoVago && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-[#667085]">Desocupado desde:</span>
                    <span className="font-medium text-[#344054]">
                      {decisao.desdeQuandoVago}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-[#667085]">Cobertura alocada:</span>
                  <span className="font-medium text-[#344054]">
                    {decisao.coberturaAtual || "Nenhuma cobertura ativa"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-[#667085]">Cumprimento de presença:</span>
                  <span className="font-mono font-medium text-[#1A2230] text-right">
                    {decisao.percentualCumprimentoFormatado || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Bloco 2: Pendências Agrupadas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#1A2230] uppercase tracking-wider">
                  Pendências Agrupadas ({decisao.pendencias.length})
                </h3>
                {ehFiscal && (
                  <span className="text-[11px] font-semibold text-[#0F7B4F] bg-white px-2 py-0.5 rounded border border-emerald-300">
                    Visualização de Fiscalização
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {decisao.pendencias.map((pend) => (
                  <div
                    key={pend.id}
                    className="p-3.5 rounded-xl border border-[#E3E6EB] bg-white shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-[#1A2230] block">
                          {pend.titulo}
                        </span>
                        <p className="text-[11px] text-[#5B6474] leading-relaxed">
                          {pend.descricao}
                        </p>
                      </div>

                      {pend.prazoTexto && (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-white text-amber-800 border border-amber-300 whitespace-nowrap">
                          {pend.prazoTexto}
                        </span>
                      )}
                    </div>

                    {/* Ação individual da pendência (Oculta para Fiscal Petrobras) */}
                    {!ehFiscal && (
                      <div className="pt-2 border-t border-slate-100 flex justify-end">
                        <Link
                          href={pend.linkAcao}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold shadow-xs transition-all"
                        >
                          <span>{pend.acaoTexto} →</span>
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rodapé Fixo do Drawer */}
          <div className="p-4 bg-[#F8F9FC] border-t border-[#E3E6EB] flex flex-col gap-2.5">
            <Link
              href={`/mapa-ocupacao?posto=${decisao.codigoPosto}&competencia=${competencia}`}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#1A2230] text-xs font-semibold border border-[#D0D5DD] shadow-xs transition-all"
            >
              <Calendar className="w-4 h-4 text-[#1F4FD1]" />
              <span>Ver no mapa de cobertura →</span>
            </Link>

            <button
              onClick={onFechar}
              className="w-full text-center text-xs text-[#5B6474] hover:text-[#1A2230] py-1 font-medium"
            >
              Fechar
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
