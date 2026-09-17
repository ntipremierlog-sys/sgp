"use client";

import React from "react";
import { PontoEvolucaoSla } from "@/lib/servicos/calculo-ocupacao";

interface MinigraficoSlaProps {
  serie: PontoEvolucaoSla[];
  metaSla?: number;
  altura?: number;
}

export function MinigraficoSla({
  serie,
  metaSla = 95.0,
  altura = 40,
}: MinigraficoSlaProps) {
  // Filtra apenas pontos apurados até a data atual que possuem SLA válido
  const pontosValidos = serie.filter(
    (p) => !p.isFuturo && p.slaAcumulado !== null && !isNaN(p.slaAcumulado)
  );

  if (pontosValidos.length < 2) {
    return (
      <div className="h-[40px] flex items-center justify-center text-[10px] text-[#98A2B3] italic">
        Aguardando evolução diária
      </div>
    );
  }

  const valores = pontosValidos.map((p) => p.slaAcumulado as number);
  const minVal = Math.min(...valores, metaSla - 1.0);
  const maxVal = Math.max(...valores, metaSla + 1.0);
  const range = maxVal - minVal || 1;

  const larguraSvg = 180;
  const paddingY = 4;
  const alturaUtil = altura - paddingY * 2;

  // Converte cada valor em coordenadas X, Y
  const pontosSvg = pontosValidos.map((p, index) => {
    const x = (index / (pontosValidos.length - 1)) * (larguraSvg - 8) + 4;
    const yVal = p.slaAcumulado as number;
    const y = alturaUtil - ((yVal - minVal) / range) * alturaUtil + paddingY;
    return { x, y, valor: yVal, dia: p.dia };
  });

  const pathD = pontosSvg.reduce(
    (acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
    ""
  );

  // Linha da meta de 95%
  const yMeta = alturaUtil - ((metaSla - minVal) / range) * alturaUtil + paddingY;

  const ultimoPonto = pontosSvg[pontosSvg.length - 1];
  const corLinha = (ultimoPonto.valor >= metaSla) ? "#1F4FD1" : "#D92D20";

  return (
    <div className="relative w-full overflow-hidden" style={{ height: `${altura}px` }}>
      <svg
        viewBox={`0 0 ${larguraSvg} ${altura}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Linha de referência da meta (pontilhada sutil) */}
        <line
          x1="0"
          y1={yMeta.toFixed(1)}
          x2={larguraSvg}
          y2={yMeta.toFixed(1)}
          stroke="#D0D5DD"
          strokeDasharray="3 3"
          strokeWidth="1"
        />

        {/* Linha de evolução diária do SLA acumulado */}
        <path
          d={pathD}
          fill="none"
          stroke={corLinha}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Ponto final em destaque */}
        <circle
          cx={ultimoPonto.x.toFixed(1)}
          cy={ultimoPonto.y.toFixed(1)}
          r="3"
          fill={corLinha}
        />
      </svg>
    </div>
  );
}
