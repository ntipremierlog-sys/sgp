"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";

export interface AcaoItem {
  texto: string;
  link: string;
}

export interface AttentionItemProps {
  id: string;
  postoCodigo?: string;
  titulo: string;
  descricao: string;
  prazoTexto?: string;
  diasParaVencer?: number;
  acoes?: AcaoItem[];
  perfilUsuario?: string; // "PREMIER_GESTOR" | "PETROBRAS_FISCAL"
}

export function AttentionItem({
  postoCodigo,
  titulo,
  descricao,
  prazoTexto,
  diasParaVencer,
  acoes = [],
  perfilUsuario = "PREMIER_GESTOR",
}: AttentionItemProps) {
  const isFiscal = perfilUsuario === "PETROBRAS_FISCAL";

  // Prazo: laranja se > 1 dia, vermelho se <= 1 dia ou vencido
  const isUrgente = diasParaVencer !== undefined ? diasParaVencer <= 1 : false;

  // Filtrar ações internas na visão fiscal
  const acoesVisiveis = acoes.filter((a) => {
    if (isFiscal && a.texto.toLowerCase().includes("escalar")) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[12px] border border-[#E3E6EB] bg-white shadow-xs transition-colors hover:border-[#CBD5E1]">
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        {/* Ícone de alerta em quadrado vermelho claro (40px) */}
        <div className="w-10 h-10 rounded-lg bg-[#FDECEA] flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-[#B42318]" />
        </div>

        {/* Bloco Central */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Linha 1: Título descritivo + Selo mono do posto + Selo de prazo */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-[#1A2230] leading-tight">
              {titulo}
            </span>

            {postoCodigo && (
              <span className="px-2 py-0.5 rounded font-mono text-xs font-semibold bg-[#F1F3F5] text-[#1A2230] border border-[#E3E6EB]">
                {postoCodigo}
              </span>
            )}

            {prazoTexto && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isUrgente
                    ? "bg-[#FDECEA] text-[#B42318] border border-[#FECACA]"
                    : "bg-[#FEF4E6] text-[#B54708] border border-[#FED7AA]"
                }`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span>{prazoTexto}</span>
              </span>
            )}
          </div>

          {/* Linha 2: Descrição em texto corrido (13px, cor #3A4353) */}
          <p className="text-[13px] text-[#3A4353] leading-relaxed line-clamp-2">
            {descricao}
          </p>
        </div>
      </div>

      {/* Ações à direita (Botões com altura mínima de 44px para acessibilidade ergonômica) */}
      <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-center">
        {acoesVisiveis.map((acao, idx) => {
          const isSecundario = acao.texto.toLowerCase().includes("escalar");

          if (isSecundario) {
            return (
              <Link
                key={idx}
                href={acao.link}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold text-[#1A2230] bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-all shadow-xs"
              >
                <span>{acao.texto}</span>
              </Link>
            );
          }

          // Botão primário azul institucional
          return (
            <Link
              key={idx}
              href={acao.link}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#1F4FD1] hover:bg-[#163A9E] transition-all shadow-xs"
            >
              <span>{acao.texto}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
