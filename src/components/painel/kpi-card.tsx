"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

export interface KpiCardProps {
  rotulo: string;
  badge?: {
    texto: string;
    variante: "sucesso" | "alerta" | "perigo" | "neutro";
  };
  valorPrincipal: string | React.ReactNode;
  valorDestaqueCor?: "padrao" | "perigo" | "sucesso" | "muted";
  complementoValor?: React.ReactNode;
  barraProgresso?: {
    percentual: number;
    corBarra?: string; // ex.: bg-[#0F7B4F]
    corFundo?: string; // ex.: bg-[#FDECEA] ou bg-[#F1F3F5]
  };
  linhaContexto: string | React.ReactNode;
  linkAcao?: {
    texto: string;
    href: string;
    isScroll?: boolean;
    isExternal?: boolean;
    onClick?: () => void;
  };
  // Estado especial não configurado (ex.: glosa estimada sem parâmetro)
  naoConfigurado?: {
    badgeTexto: string;
    linkTexto: string;
    linkHref: string;
  };
  className?: string;
}

export function KpiCard({
  rotulo,
  badge,
  valorPrincipal,
  valorDestaqueCor = "padrao",
  complementoValor,
  barraProgresso,
  linhaContexto,
  linkAcao,
  naoConfigurado,
  className = "",
}: KpiCardProps) {
  // Estado especial de parâmetro não configurado
  if (naoConfigurado) {
    return (
      <div
        className={`bg-[#FAFBFC] p-5 rounded-[12px] border border-dashed border-[#CBD5E1] shadow-xs flex flex-col justify-between h-full min-h-[178px] ${className}`}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-medium text-[#5B6474]">{rotulo}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEF4E6] text-[#B54708] border border-[#FED7AA]">
              {naoConfigurado.badgeTexto}
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[36px] font-bold tracking-tight text-[#94A3B8] tabular-nums leading-none">
              R$ —
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-[#E3E6EB]/50">
          <Link
            href={naoConfigurado.linkHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F4FD1] hover:text-[#163A9E] hover:underline"
          >
            <span>{naoConfigurado.linkTexto}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const getCorTextoValor = () => {
    switch (valorDestaqueCor) {
      case "perigo":
        return "text-[#B42318]";
      case "sucesso":
        return "text-[#0F7B4F]";
      case "muted":
        return "text-[#5B6474]";
      default:
        return "text-[#1A2230]";
    }
  };

  const getBadgeClasses = (variante: "sucesso" | "alerta" | "perigo" | "neutro") => {
    switch (variante) {
      case "sucesso":
        return "bg-[#E7F6EE] text-[#0F7B4F] border border-[#A7F3D0]";
      case "alerta":
        return "bg-[#FEF4E6] text-[#B54708] border border-[#FED7AA]";
      case "perigo":
        return "bg-[#FDECEA] text-[#B42318] border border-[#FECACA]";
      default:
        return "bg-[#F1F3F5] text-[#5B6474] border border-[#E3E6EB]";
    }
  };

  return (
    <div
      className={`bg-white p-5 rounded-[12px] border border-[#E3E6EB] shadow-xs flex flex-col justify-between h-full min-h-[178px] ${className}`}
    >
      <div>
        {/* Linha 1: Rótulo (14px) + Badge de Status */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-medium text-[#5B6474]">{rotulo}</span>
          {badge && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${getBadgeClasses(
                badge.variante
              )}`}
            >
              {badge.texto}
            </span>
          )}
        </div>

        {/* Linha 2: Número Grande (36px bold) + Complemento */}
        <div className="mt-3 flex items-baseline gap-2 flex-wrap">
          <span
            className={`text-[36px] font-bold tracking-tight leading-none tabular-nums ${getCorTextoValor()}`}
          >
            {valorPrincipal}
          </span>
          {complementoValor && (
            <div className="text-xs font-medium text-[#5B6474] flex items-center gap-1.5">
              {complementoValor}
            </div>
          )}
        </div>

        {/* Linha 3: Barra de Progresso de 6px */}
        {barraProgresso && (
          <div
            className={`w-full h-1.5 rounded-full mt-3 overflow-hidden ${
              barraProgresso.corFundo || "bg-[#F1F3F5]"
            }`}
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                barraProgresso.corBarra || "bg-[#0F7B4F]"
              }`}
              style={{
                width: `${Math.max(0, Math.min(100, barraProgresso.percentual))}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Linha 4: Linha de Contexto (13px) ou Link de Ação */}
      <div className="mt-3.5 pt-2.5 border-t border-[#F1F3F5] flex items-center justify-between text-[13px] text-[#5B6474]">
        <div className="leading-snug truncate">{linhaContexto}</div>
        {linkAcao && (
          <div className="shrink-0 ml-2">
            {linkAcao.isScroll ? (
              <button
                type="button"
                onClick={linkAcao.onClick}
                className="inline-flex items-center gap-1 font-semibold text-xs text-[#1F4FD1] hover:text-[#163A9E] hover:underline cursor-pointer"
              >
                <span>{linkAcao.texto}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Link
                href={linkAcao.href}
                className="inline-flex items-center gap-1 font-semibold text-xs text-[#1F4FD1] hover:text-[#163A9E] hover:underline"
              >
                <span>{linkAcao.texto}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
