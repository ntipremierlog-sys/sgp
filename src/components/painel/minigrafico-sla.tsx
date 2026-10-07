"use client";

import React, { useId } from "react";
import { PontoEvolucaoSla } from "@/lib/servicos/calculo-ocupacao";

interface MinigraficoSlaProps {
  serie: PontoEvolucaoSla[];
  metaSla?: number;
  slaRealizado?: number | null;
  projecaoSla?: number | null;
  altura?: number;
  largura?: number;
}

export function MinigraficoSla({
  serie,
  metaSla = 95.0,
  slaRealizado = null,
  projecaoSla = null,
  altura = 50,
  largura = 172,
}: MinigraficoSlaProps) {
  const gradientId = useId();

  // Pontos reais apurados até a data de corte (ex.: dia 1 ao 16)
  const pontosReais = serie.filter(
    (p) => !p.isFuturo && typeof p.slaAcumulado === "number" && !isNaN(p.slaAcumulado)
  );

  // Pontos projetados (incluindo o ponto de transição do dia de corte até o fim do mês)
  const pontosProjetados = serie.filter(
    (p) => typeof p.slaProjetado === "number" && !isNaN(p.slaProjetado)
  );

  if (pontosReais.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-[#98A2B3] italic border border-dashed border-[#E3E6EB] rounded-lg bg-white/60 p-2"
        style={{ height: `${altura + 24}px`, width: `${largura}px` }}
      >
        Aguardando evolução diária
      </div>
    );
  }

  const paddingLeft = 28; // Espaço para rótulos do eixo Y (100%, 50%, 0%)
  const paddingRight = 6;
  const paddingTop = 6;
  const paddingBottom = 6;

  // Largura interna do SVG dentro do container com p-2 (16px total)
  const larguraSvg = largura - 16;
  const plotWidth = larguraSvg - paddingLeft - paddingRight;
  const plotHeight = altura - paddingTop - paddingBottom;

  const totalDias = Math.max(...serie.map((p) => p.dia), 30);
  const diaCorte = pontosReais[pontosReais.length - 1]?.dia ?? 16;

  const getX = (dia: number) => {
    return paddingLeft + ((dia - 1) / (totalDias - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    return paddingTop + (1 - clamped / 100) * plotHeight;
  };

  // Coordenadas dos pontos reais (utiliza slaRealizado se informado, senão usa slaAcumulado)
  const coordsReais = pontosReais.map((p) => {
    const valor = slaRealizado !== null ? slaRealizado : (p.slaAcumulado as number);
    return {
      x: getX(p.dia),
      y: getY(valor),
      valor,
      dia: p.dia,
    };
  });

  const pathReais = coordsReais.reduce(
    (acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
    ""
  );

  // Área preenchida com gradiente suave sob a curva real
  const primeiroReal = coordsReais[0];
  const ultimoReal = coordsReais[coordsReais.length - 1];
  const y0 = getY(0);
  const pathAreaReais = `${pathReais} L ${ultimoReal.x.toFixed(1)} ${y0.toFixed(1)} L ${primeiroReal.x.toFixed(1)} ${y0.toFixed(1)} Z`;

  // Coordenadas dos pontos projetados conectando a partir do corte até o fim do mês
  const alvoProjecao = projecaoSla !== null ? projecaoSla : (slaRealizado !== null ? slaRealizado : ultimoReal.valor);
  const inicioProjecao = slaRealizado !== null ? slaRealizado : ultimoReal.valor;

  const coordsProjetadas = pontosProjetados.map((p) => {
    const t = totalDias > diaCorte ? (p.dia - diaCorte) / (totalDias - diaCorte) : 1;
    const valor = inicioProjecao + t * (alvoProjecao - inicioProjecao);
    return {
      x: getX(p.dia),
      y: getY(valor),
      valor,
      dia: p.dia,
    };
  });

  const pathProjecao = coordsProjetadas.reduce(
    (acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
    ""
  );

  // Escala fixa do eixo Y (0 a 100%)
  const y100 = getY(100);
  const yMeta = getY(metaSla);
  const y50 = getY(50);

  // Cor principal conforme o SLA Realizado
  const valorReferencia = slaRealizado !== null ? slaRealizado : ultimoReal.valor;
  const corLinha =
    valorReferencia >= metaSla
      ? "#0F7B4F"
      : valorReferencia >= 85.0
      ? "#D97706"
      : "#D92D20";

  return (
    <div
      className="rounded-lg border border-slate-200/90 bg-white/95 p-2 shadow-2xs select-none"
      style={{ width: `${largura}px` }}
      title={`Evolução do SLA no mês: Realizado até dia ${ultimoReal.dia} (${valorReferencia.toFixed(1).replace(".", ",")}%) · Projeção: ${projecaoSla !== null ? `${projecaoSla.toFixed(1).replace(".", ",")}%` : "—"} · Meta ${metaSla}%`}
    >
      {/* Micro-cabeçalho explicativo */}
      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        <span>Evolução SLA</span>
        <span className="text-amber-700">Meta {Math.round(metaSla)}%</span>
      </div>

      <div style={{ height: `${altura}px` }}>
        <svg
          viewBox={`0 0 ${larguraSvg} ${altura}`}
          className="w-full h-full overflow-visible"
          aria-label="Minigráfico de evolução do SLA de 0 a 100%"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={corLinha} stopOpacity="0.22" />
              <stop offset="100%" stopColor={corLinha} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Linhas de grade e referências horizontais */}
          {/* Base 0% */}
          <line
            x1={paddingLeft}
            y1={y0}
            x2={larguraSvg - paddingRight}
            y2={y0}
            stroke="#E2E8F0"
            strokeWidth="1"
          />
          {/* Linha média 50% */}
          <line
            x1={paddingLeft}
            y1={y50}
            x2={larguraSvg - paddingRight}
            y2={y50}
            stroke="#E2E8F0"
            strokeDasharray="2 2"
            strokeWidth="1"
          />
          {/* Eixo Y (vertical) */}
          <line
            x1={paddingLeft}
            y1={y100}
            x2={paddingLeft}
            y2={y0}
            stroke="#CBD5E1"
            strokeWidth="1"
          />

          {/* Rótulos do Eixo Y (100%, 50%, 0%) */}
          <text
            x={paddingLeft - 3}
            y={y100 + 3}
            textAnchor="end"
            fontSize="7"
            fill="#64748B"
            fontWeight="600"
          >
            100%
          </text>
          <text
            x={paddingLeft - 3}
            y={y50 + 2.5}
            textAnchor="end"
            fontSize="6.5"
            fill="#94A3B8"
          >
            50%
          </text>
          <text
            x={paddingLeft - 3}
            y={y0}
            textAnchor="end"
            fontSize="7"
            fill="#64748B"
            fontWeight="600"
          >
            0%
          </text>

          {/* Linha tracejada da META (95%) */}
          <line
            x1={paddingLeft}
            y1={yMeta}
            x2={larguraSvg - paddingRight}
            y2={yMeta}
            stroke="#D97706"
            strokeDasharray="3 2"
            strokeWidth="1"
            strokeOpacity="0.85"
          />
          <text
            x={larguraSvg - paddingRight}
            y={Math.max(yMeta - 2, 7)}
            textAnchor="end"
            fontSize="7"
            fill="#D97706"
            fontWeight="bold"
          >
            {Math.round(metaSla)}%
          </text>

          {/* Área sombreada sob a linha apurada real */}
          <path d={pathAreaReais} fill={`url(#${gradientId})`} />

          {/* Curva de projeção futura (tracejada até o fim do mês) */}
          {coordsProjetadas.length > 1 && (
            <path
              d={pathProjecao}
              fill="none"
              stroke={corLinha}
              strokeWidth="1.5"
              strokeDasharray="3 2"
              strokeOpacity="0.75"
            />
          )}

          {/* Curva de dados apurados reais (linha contínua) */}
          <path
            d={pathReais}
            fill="none"
            stroke={corLinha}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Ponto atual apurado no dia de corte */}
          <circle
            cx={ultimoReal.x.toFixed(1)}
            cy={ultimoReal.y.toFixed(1)}
            r="3"
            fill={corLinha}
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />

          {/* Ponto projetado de fechamento no fim do mês */}
          {coordsProjetadas.length > 0 && (
            <circle
              cx={coordsProjetadas[coordsProjetadas.length - 1].x.toFixed(1)}
              cy={coordsProjetadas[coordsProjetadas.length - 1].y.toFixed(1)}
              r="2.5"
              fill="#FFFFFF"
              stroke={corLinha}
              strokeWidth="1.5"
              strokeDasharray="1 1"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
