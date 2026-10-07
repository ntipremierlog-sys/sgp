"use client";

import React, { useState, useMemo } from "react";
import { TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { EvolucaoCompetenciaDados, PontoEvolucaoSla } from "@/lib/servicos/calculo-ocupacao";

interface EvolucaoCompetenciaCardProps {
  dados: EvolucaoCompetenciaDados;
  metaSla?: number;
  className?: string;
}

export function EvolucaoCompetenciaCard({
  dados,
  metaSla = 95.0,
  className = "",
}: EvolucaoCompetenciaCardProps) {
  const [pontoHover, setPontoHover] = useState<PontoEvolucaoSla | null>(null);

  const { serie, projecaoFechamento, statusProjecao, mensagemProjecao } = dados;

  // Encontrar valores mínimos e máximos para dimensionamento dinâmico da escala Y
  const { escalaMin, escalaMax, ticksY } = useMemo(() => {
    const valoresReais = serie
      .map((p) => p.slaAcumulado)
      .filter((v): v is number => v !== null && !isNaN(v));

    const valoresProjetados = serie
      .map((p) => p.slaProjetado)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

    const todos = [...valoresReais, ...valoresProjetados, metaSla];
    const minVal = Math.min(...todos);
    const maxVal = Math.max(...todos);

    // Adiciona margem de 2% para não colar no topo/fundo e não começar em zero
    const minCalculado = Math.max(70, Math.floor((minVal - 2) / 2) * 2);
    const maxCalculado = Math.min(100, Math.ceil((maxVal + 2) / 2) * 2);

    const ticks: number[] = [];
    const passo = (maxCalculado - minCalculado) <= 10 ? 2 : 5;
    for (let t = minCalculado; t <= maxCalculado; t += passo) {
      ticks.push(t);
    }

    return {
      escalaMin: minCalculado,
      escalaMax: maxCalculado,
      ticksY: ticks,
    };
  }, [serie, metaSla]);

  // Dimensões do SVG
  const width = 760;
  const height = 240;
  const paddingLeft = 46;
  const paddingRight = 40;
  const paddingTop = 20;
  const paddingBottom = 34;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const totalDias = serie.length;

  const getX = (dia: number) => {
    if (totalDias <= 1) return paddingLeft;
    return paddingLeft + ((dia - 1) / (totalDias - 1)) * chartWidth;
  };

  const getY = (valor: number) => {
    const clamped = Math.max(escalaMin, Math.min(escalaMax, valor));
    const range = escalaMax - escalaMin || 1;
    return paddingTop + chartHeight - ((clamped - escalaMin) / range) * chartHeight;
  };

  // Linha sólida azul (SLA acumulado até hoje)
  const pontosReais = serie.filter((p) => p.slaAcumulado !== null);
  const pathReal = useMemo(() => {
    if (pontosReais.length === 0) return "";
    return pontosReais
      .map((p, idx) => {
        const x = getX(p.dia);
        const y = getY(p.slaAcumulado!);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [pontosReais, escalaMin, escalaMax]);

  // Linha pontilhada cinza (Projeção até o fim do mês)
  const pontosProjetados = serie.filter((p) => p.slaProjetado !== null);
  const pathProjetado = useMemo(() => {
    if (pontosProjetados.length === 0) return "";
    return pontosProjetados
      .map((p, idx) => {
        const x = getX(p.dia);
        const y = getY(p.slaProjetado!);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [pontosProjetados, escalaMin, escalaMax]);

  // Posição Y da meta (95%)
  const yMeta = getY(metaSla);

  // Formatação de data
  const formatarDataBr = (dataIso?: string) => {
    if (!dataIso) return "";
    const partes = dataIso.split("-");
    if (partes.length < 3) return dataIso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const ultimoPontoReal = pontosReais[pontosReais.length - 1];
  const valorReferencia = ultimoPontoReal?.slaAcumulado ?? projecaoFechamento ?? 95;
  const corLinha =
    valorReferencia >= metaSla
      ? "#0F7B4F"
      : valorReferencia >= 85.0
      ? "#D97706"
      : "#D92D20";

  const pathAreaReal = useMemo(() => {
    if (pontosReais.length < 2) return "";
    const pPrimeiro = pontosReais[0];
    const pUltimo = pontosReais[pontosReais.length - 1];
    const yBase = paddingTop + chartHeight;
    const xInicio = getX(pPrimeiro.dia);
    const xFim = getX(pUltimo.dia);
    return `${pathReal} L ${xFim.toFixed(1)} ${yBase.toFixed(1)} L ${xInicio.toFixed(1)} ${yBase.toFixed(1)} Z`;
  }, [pathReal, pontosReais, chartHeight, paddingTop]);

  return (
    <div
      id="grafico-evolucao-sla"
      className={`bg-white p-5 rounded-[12px] border border-[#E3E6EB] shadow-xs flex flex-col justify-between scroll-mt-6 ${className}`}
    >
      {/* Cabeçalho do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F1F3F5]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#1A2230] tracking-tight">
              Evolução da competência
            </h2>
            <span className="text-xs text-[#5B6474]">· SLA Acumulado</span>
          </div>
          <p className="text-xs text-[#5B6474] mt-0.5">
            Acompanhamento diário da meta contratual de {metaSla}% e projeção de fechamento
          </p>
        </div>

        {/* Bloco de Projeção de Fechamento */}
        <div className="flex items-center gap-2.5 shrink-0 px-3 py-1.5 rounded-lg border border-[#E3E6EB] bg-white">
          <span className="text-xs font-semibold text-[#5B6474]">
            Projeção de fechamento:
          </span>
          {projecaoFechamento !== null ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums text-[#1A2230]">
                {projecaoFechamento.toFixed(1).replace(".", ",")}%
              </span>
              {projecaoFechamento < metaSla && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B54708]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Abaixo da meta</span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs font-medium text-[#5B6474]">
              {mensagemProjecao || "Projeção disponível a partir do 3º dia"}
            </span>
          )}
        </div>
      </div>

      {/* Gráfico SVG */}
      <div className="relative mt-3 w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[260px] overflow-visible"
        >
          <defs>
            <linearGradient id="areaGradientSlaCard" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={corLinha} stopOpacity="0.22" />
              <stop offset="100%" stopColor={corLinha} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Área sombreada com gradiente suave sob a curva apurada */}
          {pathAreaReal && <path d={pathAreaReal} fill="url(#areaGradientSlaCard)" />}

          {/* Linhas de Grade Horizontais (Eixo Y) */}
          {ticksY.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#F1F3F5"
                  strokeWidth={1}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#94A3B8"
                  fontFamily="var(--font-ibm-sans), sans-serif"
                  fontWeight="500"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Linha Tracejada Vermelha da Meta (95%) */}
          <line
            x1={paddingLeft}
            y1={yMeta}
            x2={width - paddingRight}
            y2={yMeta}
            stroke="#D97706"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text
            x={width - paddingRight + 6}
            y={yMeta + 3}
            fontSize={10}
            fill="#D97706"
            fontWeight="bold"
            fontFamily="var(--font-ibm-sans), sans-serif"
          >
            Meta {metaSla}%
          </text>

          {/* Linha Pontilhada Cinza de Projeção */}
          {pathProjetado && (
            <path
              d={pathProjetado}
              fill="none"
              stroke="#94A3B8"
              strokeWidth={2}
              strokeDasharray="3 3"
            />
          )}

          {/* Linha Sólida Realizada com cor conforme SLA */}
          {pathReal && (
            <path
              d={pathReal}
              fill="none"
              stroke={corLinha}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Pontos Reais e Ponto do Dia Atual */}
          {pontosReais.map((p) => {
            const x = getX(p.dia);
            const y = getY(p.slaAcumulado!);
            const isHoje = p.dia === ultimoPontoReal?.dia;

            return (
              <g key={p.dia}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHoje ? 4.5 : 2.5}
                  fill={isHoje ? corLinha : "#FFFFFF"}
                  stroke={corLinha}
                  strokeWidth={isHoje ? 2 : 1.5}
                />
              </g>
            );
          })}

          {/* Eixo X: Dias do Mês */}
          {serie.map((p) => {
            // Exibir a cada 2 ou 3 dias para não encavalar, além do dia 1 e último dia
            const deveExibir =
              p.dia === 1 ||
              p.dia === totalDias ||
              p.dia === ultimoPontoReal?.dia ||
              p.dia % 3 === 0;

            if (!deveExibir) return null;

            const x = getX(p.dia);
            const isHoje = p.dia === ultimoPontoReal?.dia;

            return (
              <text
                key={`label-dia-${p.dia}`}
                x={x}
                y={height - 10}
                textAnchor="middle"
                fontSize={10}
                fill={isHoje ? "#1F4FD1" : "#5B6474"}
                fontWeight={isHoje ? "bold" : "500"}
                fontFamily="var(--font-ibm-mono), monospace"
              >
                {p.dia < 10 ? `0${p.dia}` : p.dia}
              </text>
            );
          })}

          {/* Áreas Transparentes Interativas para Tooltip */}
          {serie.map((p) => {
            const x = getX(p.dia);
            const colWidth = chartWidth / totalDias;

            return (
              <rect
                key={`trigger-${p.dia}`}
                x={x - colWidth / 2}
                y={paddingTop}
                width={colWidth}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setPontoHover(p)}
                onMouseLeave={() => setPontoHover(null)}
              />
            );
          })}

          {/* Linha Vertical Indicadora no Hover */}
          {pontoHover && (
            <g>
              <line
                x1={getX(pontoHover.dia)}
                y1={paddingTop}
                x2={getX(pontoHover.dia)}
                y2={height - paddingBottom}
                stroke="#1F4FD1"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(pontoHover.dia)}
                cy={getY(pontoHover.slaAcumulado ?? pontoHover.slaProjetado ?? metaSla)}
                r={5}
                fill="#1F4FD1"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {/* Tooltip Flutuante */}
        {pontoHover && (
          <div
            className="absolute pointer-events-none z-20 bg-[#1A2230] text-white text-xs p-3 rounded-lg shadow-lg space-y-1.5 transition-all duration-100"
            style={{
              left: `${Math.min(
                Math.max(10, (getX(pontoHover.dia) / width) * 100 - 15),
                70
              )}%`,
              top: `${Math.max(10, (getY(pontoHover.slaAcumulado ?? pontoHover.slaProjetado ?? metaSla) / height) * 100 - 30)}%`,
            }}
          >
            <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1 flex items-center justify-between gap-4">
              <span>{formatarDataBr(pontoHover.data)}</span>
              <span className="font-mono text-[11px] text-slate-400">
                Dia {pontoHover.dia}
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">
                  {pontoHover.isFuturo ? "SLA Projetado:" : "SLA Acumulado:"}
                </span>
                <span
                  className={`font-bold tabular-nums ${
                    (pontoHover.slaAcumulado ?? pontoHover.slaProjetado ?? 0) >= metaSla
                      ? "text-[#4ADE80]"
                      : "text-[#F87171]"
                  }`}
                >
                  {(pontoHover.slaAcumulado ?? pontoHover.slaProjetado)?.toFixed(1).replace(".", ",")}%
                </span>
              </div>

              {!pontoHover.isFuturo && (
                <>
                  <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                    <span className="text-slate-400">No dia:</span>
                    <span>
                      {pontoHover.atendidosDia} / {pontoHover.avaliadosDia} atendidos
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                    <span className="text-slate-400">No mês acumulado:</span>
                    <span>
                      {pontoHover.atendidosAcumulado} / {pontoHover.avaliadosAcumulado} atendidos
                    </span>
                  </div>
                </>
              )}

              {pontoHover.isFuturo && (
                <div className="text-[11px] text-slate-400 italic pt-0.5">
                  Projeção linear baseada na média dos últimos 7 dias.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legenda do Gráfico */}
      <div className="mt-3 pt-2.5 border-t border-[#F1F3F5] flex flex-wrap items-center justify-between text-xs text-[#5B6474] gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-[#1F4FD1] rounded-full" />
            <span className="font-medium text-[#1A2230]">SLA acumulado realizado</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 border-b-2 border-dashed border-[#94A3B8]" />
            <span>Projeção de fechamento</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 border-b-2 border-dashed border-[#B42318]" />
            <span className="text-[#B42318] font-semibold">Meta contratual (95%)</span>
          </div>
        </div>

        <div className="text-[11px] text-[#5B6474]">
          Hoje:{" "}
          <strong className="text-[#1A2230] font-semibold">
            {ultimoPontoReal?.slaAcumulado?.toFixed(1).replace(".", ",")}%
          </strong>
        </div>
      </div>
    </div>
  );
}
