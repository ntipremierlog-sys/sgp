"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, MessageSquareWarning, HelpCircle, Clock, ArrowRight, MapPin } from "lucide-react";

export interface AcaoItem {
  texto: string;
  link: string;
  isSecundario?: boolean;
}

export type TipoAtencao = "Apontamento" | "Posto sem cobertura" | "Dado pendente";

export interface AttentionItemProps {
  id: string;
  tipo?: TipoAtencao | string;
  postoCodigo?: string;
  titulo: string;
  descricao: string;
  prazoTexto?: string;
  diasParaVencer?: number;
  acoes?: AcaoItem[];
  perfilUsuario?: string; // "PREMIER_GESTOR" | "PETROBRAS_FISCAL"
}

export function AttentionItem({
  tipo = "Apontamento",
  postoCodigo,
  titulo,
  descricao,
  prazoTexto,
  diasParaVencer,
  acoes = [],
  perfilUsuario = "PREMIER_GESTOR",
}: AttentionItemProps) {
  const isFiscal = perfilUsuario === "PETROBRAS_FISCAL";

  // Determinar se o prazo é urgente (<= 1 dia ou vencido)
  const isVencido = prazoTexto?.toLowerCase().includes("vencido");
  const isUrgente = isVencido || (diasParaVencer !== undefined ? diasParaVencer <= 1 : false);

  // Filtrar ações internas na visão fiscal da Petrobras
  const acoesVisiveis = acoes.filter((a) => {
    if (isFiscal) {
      const textoLower = a.texto.toLowerCase();
      if (textoLower.includes("escalar") || textoLower.includes("resolver")) {
        return false;
      }
    }
    return true;
  });

  // Estilos de ícone em quadrado de 40px
  const isDadoPendente = tipo === "Dado pendente" || tipo === "IMPORTACAO_INCOMPLETA" || tipo === "IMPORTACAO_ATRASADA";

  const renderIcone = () => {
    if (isDadoPendente) {
      return (
        <div className="w-10 h-10 rounded-lg bg-[#FEF4E6] flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 text-[#B54708]" />
        </div>
      );
    }
    if (tipo === "Apontamento") {
      return (
        <div className="w-10 h-10 rounded-lg bg-[#FDECEA] flex items-center justify-center shrink-0">
          <MessageSquareWarning className="w-5 h-5 text-[#B42318]" />
        </div>
      );
    }
    // Posto sem cobertura
    return (
      <div className="w-10 h-10 rounded-lg bg-[#FDECEA] flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5 text-[#B42318]" />
      </div>
    );
  };

  const renderTipoBadge = () => {
    let rotulo = tipo;
    if (tipo === "POSTO_PENDENCIA") rotulo = "Posto sem cobertura";
    if (tipo === "IMPORTACAO_INCOMPLETA" || tipo === "IMPORTACAO_ATRASADA") rotulo = "Dado pendente";

    if (isDadoPendente) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#FEF4E6] text-[#B54708] border border-[#FED7AA]">
          {rotulo}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#FDECEA] text-[#B42318] border border-[#FECACA]">
        {rotulo}
      </span>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[12px] border border-[#E3E6EB] bg-white shadow-xs transition-colors hover:border-[#CBD5E1]">
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        {/* Ícone por tipo em quadrado de 40px */}
        <div className="mt-0.5">{renderIcone()}</div>

        {/* Conteúdo Central */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Linha 1: Função do posto (Título) + Selo mono do posto + Selo de Tipo + Selo de Prazo */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-[#1A2230] leading-tight">
              {titulo}
            </span>

            {postoCodigo && (
              <span className="px-2 py-0.5 rounded font-mono text-xs font-semibold bg-[#F1F3F5] text-[#1A2230] border border-[#E3E6EB]">
                {postoCodigo}
              </span>
            )}

            {renderTipoBadge()}

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

          {/* Linha 2: Descrição curta */}
          <p className="text-[13px] text-[#3A4353] leading-relaxed line-clamp-2">
            {descricao}
          </p>
        </div>
      </div>

      {/* Ações à direita: Botão primário + link secundário 'Ver no mapa' */}
      <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-center">
        {acoesVisiveis.map((acao, idx) => {
          const isSecundario = acao.isSecundario || acao.texto.toLowerCase().includes("mapa");

          if (isSecundario) {
            return (
              <Link
                key={idx}
                href={acao.link}
                className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-lg text-xs font-semibold text-[#1F4FD1] hover:text-[#163A9E] hover:underline transition-all"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{acao.texto} →</span>
              </Link>
            );
          }

          // Botão primário com altura de 44px
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
