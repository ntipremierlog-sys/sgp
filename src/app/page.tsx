"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle,
  Filter,
  ArrowRight,
  Calendar,
  Layers,
  Shield,
  Eye,
} from "lucide-react";
import { carregarEstado, EstadoOperacionalCompleto } from "@/lib/dados/estado-operacional";
import {
  obterOcupacaoConsolidada,
} from "@/lib/servicos/adaptador-painel";
import {
  ResultadoOcupacaoConsolidado,
  StatusPostoDia,
  METADADOS_STATUS,
  DetalhePostoDia,
} from "@/lib/servicos/calculo-ocupacao";

export default function PainelGeralPage() {
  const [estado, setEstado] = useState<EstadoOperacionalCompleto>(carregarEstado);
  const [filtroBase, setFiltroBase] = useState<string>("UFN-III"); // "TODAS" ou ID de base
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState<string>("2026-09");
  const [filtroSoDesvio, setFiltroSoDesvio] = useState<boolean>(true);
  const [perfilAtivo, setPerfilAtivo] = useState<string>("PREMIER_GESTOR");
  const [celulaInspecionada, setCelulaInspecionada] = useState<DetalhePostoDia | null>(null);
  const [tooltipFormula, setTooltipFormula] = useState<string | null>(null);

  useEffect(() => {
    const carregar = () => {
      setEstado(carregarEstado());
    };
    carregar();

    const handleAtualizacao = () => carregar();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // Motor centralizado único: calcula toda a matriz, grade e indicadores
  const dadosPainel: ResultadoOcupacaoConsolidado = useMemo(() => {
    return obterOcupacaoConsolidada(estado, {
      baseId: filtroBase,
      competencia: competenciaSelecionada,
      dataHoje: "2026-09-16",
      horaHoje: "08:00",
      perfilUsuario: perfilAtivo,
    });
  }, [estado, filtroBase, competenciaSelecionada, perfilAtivo]);

  // Linhas da grade filtradas por "Só com desvio"
  const linhasGrade = useMemo(() => {
    const todas = dadosPainel.gradeSemanal.linhas;
    if (!filtroSoDesvio) return todas;
    return todas.filter((linha) => linha.temDesvio);
  }, [dadosPainel.gradeSemanal.linhas, filtroSoDesvio]);

  // Lista de bases disponíveis para o filtro
  const listaBases = [
    { id: "TODAS", nome: "Todas as bases contratuais" },
    { id: "UFN-III", nome: "UFN III – Três Lagoas/MS (Base principal)" },
    { id: "MACAE", nome: "Base Macaé / Parque de Tubos" },
    { id: "SANTOS", nome: "Terminal Portuário Santos/SP" },
    { id: "PAULINIA", nome: "Refinaria Paulínia (Replan/SP)" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ------------------------------------------------------------------- */}
      {/* 1. BARRA DE CONTEXTO E CABEÇALHO */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            {/* Breadcrumb oficial */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="font-semibold text-slate-800 font-mono">
                Contrato Petrobras 5900.0129796.25.2
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-premier-800 font-medium">{dadosPainel.filtroAplicado.baseNome}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600">Setembro de 2026</span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Painel geral de gestão
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de alocação de postos, presença da força de trabalho e conformidade com o Item 11.3.
            </p>
          </div>

          {/* Frescor dos dados e simulação de perfil */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {/* Selo de Frescor */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                dadosPainel.frescor.rhidAtrasado
                  ? "bg-amber-50 text-amber-900 border-amber-300"
                  : "bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              <Clock
                className={`w-3.5 h-3.5 ${
                  dadosPainel.frescor.rhidAtrasado ? "text-amber-600" : "text-slate-400"
                }`}
              />
              <div>
                <span>Ponto RHID até </span>
                <span className="font-semibold">{dadosPainel.frescor.pontoRhidAte}</span>
                <span className="text-slate-400"> · </span>
                <span>RM até </span>
                <span className="font-semibold">{dadosPainel.frescor.rmAte}</span>
              </div>
            </div>

            {/* Alternador de Perfil para Demonstração de LGPD */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 px-2 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>Perfil:</span>
              </span>
              <button
                type="button"
                onClick={() => setPerfilAtivo("PREMIER_GESTOR")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  perfilAtivo === "PREMIER_GESTOR"
                    ? "bg-white text-slate-900 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Gestor Premier
              </button>
              <button
                type="button"
                onClick={() => setPerfilAtivo("PETROBRAS_FISCAL")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  perfilAtivo === "PETROBRAS_FISCAL"
                    ? "bg-white text-emerald-900 shadow-sm font-semibold border border-emerald-300"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Fiscal Petrobras (LGPD)
              </button>
            </div>
          </div>
        </div>

        {/* Filtros de Base e Competência */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="filtro-base" className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Base operacional:</span>
              </label>
              <select
                id="filtro-base"
                value={filtroBase}
                onChange={(e) => setFiltroBase(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-premier-600 shadow-sm"
              >
                {listaBases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filtro-competencia" className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Competência:</span>
              </label>
              <select
                id="filtro-competencia"
                value={competenciaSelecionada}
                onChange={(e) => setCompetenciaSelecionada(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-premier-600 shadow-sm"
              >
                <option value="2026-09">Setembro / 2026 (Atual)</option>
                <option value="2026-08">Agosto / 2026</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/relatorios"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>Memória de cálculo</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. FAIXA DE AÇÃO IMEDIATA (TOP 5 POR URGÊNCIA) */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Faixa de ação imediata
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            {dadosPainel.faixaAcao.length > 0
              ? `${dadosPainel.faixaAcao.length} item(ns) prioritário(s)`
              : "Nenhuma ação pendente"}
          </span>
        </div>

        {dadosPainel.faixaAcao.length === 0 ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Sem pendências ou prazos críticos no momento. Todos os apontamentos estão respondidos.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {dadosPainel.faixaAcao.map((item) => {
              const isPerigo = item.urgencia === "PERIGO";
              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border text-xs transition-colors ${
                    isPerigo
                      ? "bg-rose-50/60 border-rose-200 text-rose-950"
                      : "bg-amber-50/50 border-amber-200 text-amber-950"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {isPerigo ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-semibold">
                        {item.posto && (
                          <span className="px-1.5 py-0.2 rounded bg-white font-mono text-[11px] border border-slate-200 text-slate-800">
                            {item.posto}
                          </span>
                        )}
                        <span className="text-slate-700">{item.base}</span>
                        {item.prazoTexto && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPerigo
                                ? "bg-rose-200 text-rose-900"
                                : "bg-amber-200 text-amber-900"
                            }`}
                          >
                            {item.prazoTexto}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 mt-0.5 text-xs line-clamp-1">{item.descricao}</p>
                    </div>
                  </div>

                  <Link
                    href={item.acaoLink}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md font-semibold text-xs shrink-0 self-start sm:self-center transition-all ${
                      isPerigo
                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                        : "bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                    }`}
                  >
                    <span>{item.acaoTexto}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. QUATRO INDICADORES EM GRID EQUIVALENTE */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Indicador 1: Cobertura Agora */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Cobertura agora
              </span>
              <button
                type="button"
                onClick={() =>
                  setTooltipFormula(
                    tooltipFormula === "cobertura" ? null : "cobertura"
                  )
                }
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Ver fórmula"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>

            {tooltipFormula === "cobertura" && (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 mt-1.5">
                <strong>Fórmula:</strong> (Titulares presentes + substitutos) ÷ postos com escala prevista no turno hoje × 100.
              </div>
            )}

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">
                {dadosPainel.coberturaAgora.percentual.toFixed(1)}%
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  dadosPainel.coberturaAgora.isAlertaDescoberto
                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                {dadosPainel.coberturaAgora.statusSelo}
              </span>
            </div>

            {/* Barra de composição */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-2"
                style={{
                  width: `${
                    dadosPainel.coberturaAgora.postosComEscalaHoje > 0
                      ? (dadosPainel.coberturaAgora.presentes /
                          dadosPainel.coberturaAgora.postosComEscalaHoje) *
                        100
                      : 0
                  }%`,
                }}
                title={`${dadosPainel.coberturaAgora.presentes} titular(es)`}
              />
              <div
                className="bg-blue-500 h-2"
                style={{
                  width: `${
                    dadosPainel.coberturaAgora.postosComEscalaHoje > 0
                      ? (dadosPainel.coberturaAgora.substitutos /
                          dadosPainel.coberturaAgora.postosComEscalaHoje) *
                        100
                      : 0
                  }%`,
                }}
                title={`${dadosPainel.coberturaAgora.substitutos} substituto(s)`}
              />
              <div
                className="bg-rose-600 h-2"
                style={{
                  width: `${
                    dadosPainel.coberturaAgora.postosComEscalaHoje > 0
                      ? (dadosPainel.coberturaAgora.descobertos /
                          dadosPainel.coberturaAgora.postosComEscalaHoje) *
                        100
                      : 0
                  }%`,
                }}
                title={`${dadosPainel.coberturaAgora.descobertos} descoberto(s)`}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-600 mt-3 font-medium">
            {dadosPainel.coberturaAgora.textoApoio}
          </p>
        </div>

        {/* Indicador 2: SLA da Competência */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                SLA da competência
              </span>
              <button
                type="button"
                onClick={() =>
                  setTooltipFormula(tooltipFormula === "sla" ? null : "sla")
                }
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Ver fórmula"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>

            {tooltipFormula === "sla" && (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 mt-1.5">
                {dadosPainel.slaCompetencia.formulaExplicativa}
              </div>
            )}

            <div className="mt-3 flex items-baseline gap-2">
              {dadosPainel.slaCompetencia.valor !== null ? (
                <>
                  <span className="text-3xl font-bold text-slate-900 tabular-nums">
                    {dadosPainel.slaCompetencia.valor.toFixed(1)}%
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Meta ≥ {dadosPainel.slaCompetencia.meta}%
                  </span>
                </>
              ) : (
                <Link
                  href="/admin"
                  className="text-sm font-bold text-premier-800 underline flex items-center gap-1"
                >
                  <span>Parametrizar</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {dadosPainel.slaCompetencia.valor !== null && (
              <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, dadosPainel.slaCompetencia.valor)}%`,
                  }}
                />
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 mt-3 flex items-center justify-between">
            <span>
              {dadosPainel.slaCompetencia.totalAtendidos} atendidos de{" "}
              {dadosPainel.slaCompetencia.totalAvaliados} avaliados
            </span>
            {dadosPainel.slaCompetencia.variacaoPp && (
              <span className="text-emerald-700 font-semibold">
                +{dadosPainel.slaCompetencia.variacaoPp} p.p.
              </span>
            )}
          </p>
        </div>

        {/* Indicador 3: Postos-dia Descobertos */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Postos-dia descobertos
              </span>
              <button
                type="button"
                onClick={() =>
                  setTooltipFormula(
                    tooltipFormula === "descobertos" ? null : "descobertos"
                  )
                }
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Ver fórmula"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>

            {tooltipFormula === "descobertos" && (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 mt-1.5">
                {dadosPainel.descobertosCompetencia.formulaExplicativa}
              </div>
            )}

            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold tabular-nums ${
                  dadosPainel.descobertosCompetencia.totalDescobertos > 0
                    ? "text-rose-600"
                    : "text-slate-900"
                }`}
              >
                {dadosPainel.descobertosCompetencia.totalDescobertos}
              </span>
              <span className="text-xs text-slate-500">no mês acumulado</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-3">
            {dadosPainel.descobertosCompetencia.textoApoio}
          </p>
        </div>

        {/* Indicador 4: Glosa Estimada (R$) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Glosa estimada
              </span>
              <button
                type="button"
                onClick={() =>
                  setTooltipFormula(tooltipFormula === "glosa" ? null : "glosa")
                }
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Ver fórmula"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>

            {tooltipFormula === "glosa" && (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 mt-1.5">
                {dadosPainel.glosaEstimada.formulaExplicativa}
              </div>
            )}

            <div className="mt-3">
              {dadosPainel.glosaEstimada.status === "OMITIDO_LGPD" ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Acesso restrito à gestão contratual Premier</span>
                </div>
              ) : dadosPainel.glosaEstimada.status === "PARAMETRIZAR" ? (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-800 underline"
                >
                  <span>Parametrizar</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-semibold text-slate-500">R$</span>
                  <span className="text-3xl font-bold text-slate-900 tabular-nums">
                    {dadosPainel.glosaEstimada.valorTotal !== null
                      ? dadosPainel.glosaEstimada.valorTotal.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })
                      : "0,00"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-3">
            {dadosPainel.glosaEstimada.textoApoio}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 4. COMPARATIVO POR BASE (QUANDO "TODAS AS BASES") */}
      {/* ------------------------------------------------------------------- */}
      {filtroBase === "TODAS" && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-premier-800" />
              <span>Comparativo de bases operacionais</span>
            </h2>
            <span className="text-xs text-slate-400">Ordenado por criticidade</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Base operacional</th>
                  <th className="py-2.5 px-3 text-center">Postos</th>
                  <th className="py-2.5 px-3 text-center">Descobertos hoje</th>
                  <th className="py-2.5 px-3 text-center">Descobertos no mês</th>
                  <th className="py-2.5 px-3 text-center">SLA do mês</th>
                  <th className="py-2.5 px-3 text-center">Pendências</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {dadosPainel.comparativoBases.map((base) => (
                  <tr
                    key={base.baseId}
                    onClick={() => setFiltroBase(base.baseId)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {base.baseNome}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums">
                      {base.postosTotal}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          base.descobertosHoje > 0
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {base.descobertosHoje}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums font-semibold">
                      {base.descobertosMes}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums font-semibold">
                      {base.slaPercentual !== null ? `${base.slaPercentual}%` : "—"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          base.pendenciasCount > 0
                            ? "bg-amber-100 text-amber-900"
                            : "text-slate-400"
                        }`}
                      >
                        {base.pendenciasCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-premier-800 font-semibold text-[11px] hover:underline">
                        Filtrar base →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 5. GRADE DOS ÚLTIMOS 7 DIAS */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Grade de ocupação recente (últimos 7 dias)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {linhasGrade.length} de {dadosPainel.gradeSemanal.totalPostos} postos
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Identificação de conformidade por célula diária. Letra e cor para acessibilidade visual completa.
            </p>
          </div>

          {/* Controles da grade */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filtroSoDesvio}
                onChange={(e) => setFiltroSoDesvio(e.target.checked)}
                className="w-4 h-4 text-premier-700 rounded border-slate-300 focus:ring-premier-600"
              />
              <span>Só com desvio ({dadosPainel.gradeSemanal.totalPostosComDesvio})</span>
            </label>

            <Link
              href="/mapa-ocupacao"
              className="inline-flex items-center gap-1 text-xs font-semibold text-premier-800 hover:text-premier-900 underline"
            >
              <span>Abrir mapa do mês (30 dias)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Tabela de grade */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 min-w-[100px]">Posto</th>
                <th className="py-2.5 px-3 min-w-[140px]">Função contratual</th>
                <th className="py-2.5 px-3 min-w-[130px]">Titular do posto</th>
                {dadosPainel.gradeSemanal.dias.map((d) => (
                  <th
                    key={d.data}
                    className={`py-2 px-1 text-center min-w-[48px] ${
                      d.isHoje
                        ? "bg-blue-50 font-bold text-premier-900"
                        : d.fds
                        ? "bg-slate-100 text-slate-400 font-normal"
                        : ""
                    }`}
                  >
                    <div>{d.rotulo}</div>
                  </th>
                ))}
                <th className="py-2.5 px-3 text-center min-w-[70px]">Desvios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhasGrade.length === 0 ? (
                <tr>
                  <td
                    colSpan={4 + dadosPainel.gradeSemanal.dias.length}
                    className="text-center py-6 text-slate-400 text-xs"
                  >
                    Nenhum posto encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                linhasGrade.map((linha) => (
                  <tr key={linha.postoId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">
                      {linha.codigoPosto}
                    </td>
                    <td className="py-2 px-3 text-slate-700 truncate max-w-[160px]">
                      {linha.funcao}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {linha.titularNome ? (
                        <span>{linha.titularNome}</span>
                      ) : (
                        <span className="text-rose-600 font-semibold">Posto vago</span>
                      )}
                    </td>
                    {dadosPainel.gradeSemanal.dias.map((d) => {
                      const celula = linha.celulas[d.data];
                      if (!celula) return <td key={d.data} className="text-center">—</td>;

                      const meta = METADADOS_STATUS[celula.status];
                      return (
                        <td key={d.data} className="py-1 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => setCelulaInspecionada(celula)}
                            title={`${celula.rotulo} (${celula.data}): ${celula.motivo}`}
                            className={`w-7 h-7 mx-auto rounded flex items-center justify-center font-bold text-xs border transition-transform hover:scale-110 shadow-xs ${meta.corFundo} ${meta.corTexto} ${meta.corBorda}`}
                          >
                            {meta.letra}
                          </button>
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded font-bold text-[11px] ${
                          linha.totalDesvios > 0
                            ? "bg-rose-100 text-rose-800"
                            : "text-slate-400"
                        }`}
                      >
                        {linha.totalDesvios}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal / Drawer de Detalhe da Célula Inspecionada */}
        {celulaInspecionada && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2 relative">
            <button
              type="button"
              onClick={() => setCelulaInspecionada(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
            <div className="font-bold text-slate-800 flex items-center gap-2">
              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300">
                {celulaInspecionada.codigoPosto}
              </span>
              <span>{celulaInspecionada.funcao}</span>
              <span className="text-slate-400">·</span>
              <span>Data: {celulaInspecionada.data}</span>
            </div>
            <div className="text-slate-700">
              <strong>Situação apurada:</strong> {celulaInspecionada.rotulo} ({celulaInspecionada.letra})
            </div>
            {celulaInspecionada.ocupanteNome && (
              <div className="text-slate-700">
                <strong>Profissional atuante:</strong> {celulaInspecionada.ocupanteNome}
              </div>
            )}
            {celulaInspecionada.horarioPonto && (
              <div className="text-slate-700">
                <strong>Marcações do ponto:</strong> {celulaInspecionada.horarioPonto}
              </div>
            )}
            <div className="text-slate-600 bg-white p-2.5 rounded border border-slate-200">
              <strong>Motivo e auditoria:</strong> {celulaInspecionada.motivo}
            </div>
          </div>
        )}

        {/* Legenda fixa dos 6 status padronizados (Parte 2) */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-slate-500">Legenda contratual de ocupação:</span>
          <div className="flex flex-wrap items-center gap-3">
            {(Object.keys(METADADOS_STATUS) as StatusPostoDia[]).map((st) => {
              const item = METADADOS_STATUS[st];
              return (
                <div key={st} className="flex items-center gap-1.5">
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[11px] border ${item.corFundo} ${item.corTexto} ${item.corBorda}`}
                  >
                    {item.letra}
                  </span>
                  <span className="text-slate-600">{item.rotulo}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 6. RÉGUA DE FISCALIZAÇÃO (ITEM 11.3) */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Régua de fiscalização contratual (Item 11.3 do contrato)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Auditoria contínua</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              1. Titulares
            </span>
            <span className="font-semibold text-slate-800">
              {dadosPainel.reguaFiscalizacao.r1Titulares}
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              2. Frequência
            </span>
            <span className="font-semibold text-slate-800">
              {dadosPainel.reguaFiscalizacao.r2Frequencia}
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              3. Substitutos
            </span>
            <span className="font-semibold text-slate-800">
              {dadosPainel.reguaFiscalizacao.r3Substitutos}
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              4. Descoberturas
            </span>
            <span className="font-semibold text-slate-800">
              {dadosPainel.reguaFiscalizacao.r4Descoberturas}
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              5. Medição
            </span>
            <span className="font-semibold text-slate-800">
              {dadosPainel.reguaFiscalizacao.r5Medicao}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
