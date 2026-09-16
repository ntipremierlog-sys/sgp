"use client";

import React from "react";
import { StatusPostoDia } from "@/lib/servicos/calculo-ocupacao";

export interface OccupancyCellProps {
  status: StatusPostoDia;
  data?: string;
  postoCodigo?: string;
  motivo?: string;
  onClick?: () => void;
  size?: "sm" | "md"; // "sm" = 22px (legenda), "md" = 32px (grade)
  className?: string;
  interactive?: boolean;
}

export const ESTILOS_STATUS: Record<
  StatusPostoDia,
  {
    letra: string;
    rotulo: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    style?: React.CSSProperties;
  }
> = {
  PRESENTE: {
    letra: "P",
    rotulo: "Presente",
    bgClass: "bg-[#E7F6EE]",
    textClass: "text-[#0F7B4F]",
    borderClass: "border-transparent",
  },
  COBERTO: {
    letra: "C",
    rotulo: "Coberto",
    bgClass: "bg-[#E8EEFD]",
    textClass: "text-[#1F4FD1]",
    borderClass: "border-transparent",
  },
  DESCOBERTO: {
    letra: "D",
    rotulo: "Descoberto",
    bgClass: "bg-[#B42318]",
    textClass: "text-white",
    borderClass: "border-transparent",
  },
  VAGO: {
    letra: "V",
    rotulo: "Posto vago",
    bgClass: "bg-white",
    textClass: "text-[#B42318]",
    borderClass: "border-[1.5px] border-dashed border-[#B42318]",
  },
  SEM_DADO: {
    letra: "?",
    rotulo: "Sem dado",
    bgClass: "bg-[#FEF4E6]",
    textClass: "text-[#B54708]",
    borderClass: "border-transparent",
  },
  AGUARDANDO_TURNO: {
    letra: "A",
    rotulo: "Aguardando turno",
    bgClass: "bg-white",
    textClass: "text-[#5B6474]",
    borderClass: "border border-[#D0D5DD]",
  },
  SEM_ESCALA: {
    letra: "–",
    rotulo: "Sem escala",
    bgClass: "bg-[#F1F3F5]",
    textClass: "text-[#667085]",
    borderClass: "border-transparent",
  },
};

export function OccupancyCell({
  status,
  data,
  motivo,
  onClick,
  size = "md",
  className = "",
  interactive = true,
}: OccupancyCellProps) {
  const meta = ESTILOS_STATUS[status] || ESTILOS_STATUS.SEM_DADO;
  const isSm = size === "sm";

  const dataFormatada = data
    ? `${data.substring(8, 10)}/${data.substring(5, 7)}`
    : "";
  const ariaDesc = dataFormatada
    ? `${dataFormatada} – ${meta.rotulo}${motivo ? `: ${motivo}` : ""}`
    : meta.rotulo;

  const baseClasses = `flex items-center justify-center font-bold select-none transition-transform ${
    isSm
      ? "w-[22px] h-[22px] rounded-[5px] text-[11px]"
      : "w-[32px] h-[32px] rounded-[7px] text-xs shadow-xs"
  } ${meta.bgClass} ${meta.textClass} ${meta.borderClass} ${
    interactive ? "hover:scale-110 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]/40" : ""
  } ${className}`;

  if (!interactive || !onClick) {
    return (
      <span
        aria-label={ariaDesc}
        title={ariaDesc}
        className={baseClasses}
      >
        {meta.letra}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaDesc}
      title={ariaDesc}
      className={baseClasses}
    >
      {meta.letra}
    </button>
  );
}
