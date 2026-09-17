"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { FileSpreadsheet, CheckCircle2, ArrowLeft } from "lucide-react";
import { carregarEstado, EstadoOperacionalCompleto } from "@/lib/dados/estado-operacional";
import { obterOcupacaoConsolidada } from "@/lib/servicos/adaptador-painel";
import { ResultadoOcupacaoConsolidado } from "@/lib/servicos/calculo-ocupacao";
import {
  consolidarDecisoesPorPosto,
  DecisaoConsolidadaPosto,
} from "@/lib/servicos/decisoes-consolidadas";
import { EvolucaoCompetenciaCard } from "@/components/painel/evolucao-competencia-card";
import { FechamentoMedicaoCard } from "@/components/painel/fechamento-medicao-card";
import { DrawerDecisao } from "@/components/painel/drawer-decisao";
import { UsuarioSessao } from "@/lib/auth/tipos";
import { usuarioTemAcessoBase } from "@/lib/auth/permissoes";

export default function PainelBasePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const baseIdParam = (params?.baseId as string) || "UFN-III";
  const competenciaParam = searchParams.get("competencia") || "2026-09";

  const [estado, setEstado] = useState<EstadoOperacionalCompleto>(carregarEstado);
  const [filtroBase, setFiltroBase] = useState<string>(baseIdParam);
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState<string>(competenciaParam);
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [mostrarTodasDecisoes, setMostrarTodasDecisoes] = useState<boolean>(false);

  // Estado do Drawer de Resolução
  const [decisaoSelecionada, setDecisaoSelecionada] = useState<DecisaoConsolidadaPosto | null>(null);
  const [drawerAberto, setDrawerAberto] = useState<boolean>(false);

  useEffect(() => {
    const carregar = async () => {
      const e = carregarEstado();
      setEstado(e);
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.autenticado && data.usuario) {
            setSessao(data.usuario);
          }
        }
      } catch {
        // fallback
      }
    };
    carregar();

    const handleAtualizacao = () => carregar();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    window.addEventListener("sgp-sessao-alterada", handleAtualizacao);
    return () => {
      window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
      window.removeEventListener("sgp-sessao-alterada", handleAtualizacao);
    };
  }, []);

  useEffect(() => {
    if (baseIdParam) {
      setFiltroBase(baseIdParam);
    }
  }, [baseIdParam]);

  useEffect(() => {
    if (competenciaParam) {
      setCompetenciaSelecionada(competenciaParam);
    }
  }, [competenciaParam]);

  const perfilAtivo = sessao?.perfil || "PREMIER_GESTOR";
  const ehFiscal = perfilAtivo.startsWith("PETROBRAS");

  // Bases autorizadas para o atalho de seleção
  const todasBasesCatalogo = [
    { id: "UFN-III", nome: "UFN III – Três Lagoas/MS (Base principal)" },
    { id: "MACAE", nome: "Base Macaé / Parque de Tubos" },
    { id: "SANTOS", nome: "Terminal Portuário Santos/SP" },
    { id: "PAULINIA", nome: "Refinaria Paulínia (Replan/SP)" },
  ];

  const basesDisponiveis = useMemo(() => {
    if (!sessao) return todasBasesCatalogo;
    return todasBasesCatalogo.filter((b) => usuarioTemAcessoBase(sessao, b.id));
  }, [sessao]);

  // Motor centralizado de cálculo consolidado para a base
  const dadosPainel: ResultadoOcupacaoConsolidado = useMemo(() => {
    return obterOcupacaoConsolidada(estado, {
      baseId: filtroBase,
      competencia: competenciaSelecionada,
      dataHoje: "2026-09-16",
      horaHoje: "08:00",
      perfilUsuario: perfilAtivo,
    });
  }, [estado, filtroBase, competenciaSelecionada, perfilAtivo]);

  // Decisões pendentes da base (Consolidadas por posto)
  const decisoesBase = useMemo(() => {
    const todas = consolidarDecisoesPorPosto(dadosPainel, estado, perfilAtivo, sessao);
    return todas.filter((d) => d.baseId === filtroBase);
  }, [dadosPainel, estado, perfilAtivo, sessao, filtroBase]);

  const decisoesExibidas = mostrarTodasDecisoes
    ? decisoesBase
    : decisoesBase.slice(0, 5);

  const handleMudarBase = (novaBase: string) => {
    setFiltroBase(novaBase);
    router.push(`/painel/base/${novaBase}?competencia=${competenciaSelecionada}`);
  };

  const handleMudarCompetencia = (novaComp: string) => {
    setCompetenciaSelecionada(novaComp);
    router.push(`/painel/base/${filtroBase}?competencia=${novaComp}`);
  };

  const handleAbrirDrawer = (decisao: DecisaoConsolidadaPosto) => {
    setDecisaoSelecionada(decisao);
    setDrawerAberto(true);
  };

  // Variáveis de apoio do card Cobertura agora
  const totalEmTurno = dadosPainel.coberturaAgora.postosComEscalaHoje;
  const cobertosHoje = dadosPainel.coberturaAgora.presentes + dadosPainel.coberturaAgora.substitutos;
  const inativosHoje =
    dadosPainel.coberturaAgora.postosSemEscalaHoje + dadosPainel.coberturaAgora.aguardandoTurno;

  return (
    <div className="space-y-6 w-full max-w-[1440px] pb-16 select-none">
      {/* =================================================================== */}
      {/* 1. CABEÇALHO DA VISÃO DA BASE COM BREADCRUMB E ATALHO DE BASES      */}
      {/* =================================================================== */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E3E6EB] pb-4">
        {/* Esquerda: Breadcrumb, Título da Base e Atualização em Linha */}
        <div className="space-y-1">
          {/* Breadcrumb "Painel geral › [Nome da base]" */}
          <div className="flex items-center gap-2 text-xs font-semibold text-[#5B6474]">
            <Link
              href={`/painel?competencia=${competenciaSelecionada}`}
              className="hover:text-[#1F4FD1] transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Painel geral</span>
            </Link>
            <span className="text-slate-300">›</span>
            <span className="text-[#1A2230] font-bold">
              {dadosPainel.filtroAplicado.baseNome}
            </span>
          </div>

          <h1 className="text-2xl sm:text-[28px] font-bold text-[#1A2230] tracking-tight leading-none pt-0.5">
            {dadosPainel.filtroAplicado.baseNome}
          </h1>

          {/* Texto discreto "Dados atualizados em dd/mm às hh:mm" */}
          <div className="text-[13px] text-[#5B6474] font-normal pt-0.5">
            Dados atualizados em 16/09 às 08:30
          </div>
        </div>

        {/* Direita: Seletor de Base (Atalho), Competência e Botão Memória de Cálculo */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div>
            <label htmlFor="select-base-atalho" className="sr-only">
              Base operacional
            </label>
            <select
              id="select-base-atalho"
              value={filtroBase}
              onChange={(e) => handleMudarBase(e.target.value)}
              className="h-9 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
            >
              {basesDisponiveis.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="select-comp-base" className="sr-only">
              Competência
            </label>
            <select
              id="select-comp-base"
              value={competenciaSelecionada}
              onChange={(e) => handleMudarCompetencia(e.target.value)}
              className="h-9 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
            >
              <option value="2026-09">Setembro/2026 (vigente)</option>
              <option value="2026-08">Agosto/2026</option>
              <option value="2026-07">Julho/2026</option>
            </select>
          </div>

          <Link
            href={`/relatorios?competencia=${competenciaSelecionada}&baseId=${filtroBase}`}
            className="h-9 px-3.5 inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-[#1A2230] text-xs font-semibold shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#1F4FD1]" />
            <span>Memória de cálculo</span>
          </Link>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. INDICADORES DA BASE – EXATAMENTE 3 CARDS (SEM GLOSA, SEM SELOS)  */}
      {/* =================================================================== */}
      <section aria-label="Indicadores da base" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Cobertura agora */}
        <div className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs flex flex-col justify-between h-full min-h-[160px]">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6474] block">
              Cobertura agora
            </span>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1A2230] tabular-nums">
                {dadosPainel.coberturaAgora.percentualFormatado || "—"}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1F3F5] text-xs text-[#5B6474]">
            {cobertosHoje} de {totalEmTurno} postos em turno cobertos · {inativosHoje} sem escala hoje
          </div>
        </div>

        {/* Card 2: SLA da competência */}
        <div className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs flex flex-col justify-between h-full min-h-[160px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6474]">
                SLA da competência
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <span
                className={`text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${
                  dadosPainel.slaCompetencia.valor !== null &&
                  dadosPainel.slaCompetencia.valor < dadosPainel.slaCompetencia.meta
                    ? "text-[#D92D20]"
                    : "text-[#1A2230]"
                }`}
              >
                {dadosPainel.slaCompetencia.valorFormatado || "—"}
              </span>

              {dadosPainel.slaCompetencia.variacaoPpFormatada && (
                <span className="text-xs font-medium text-[#5B6474]">
                  ({dadosPainel.slaCompetencia.variacaoPpFormatada})
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1F3F5] text-xs text-[#5B6474]">
            meta 95% · {dadosPainel.slaCompetencia.totalAtendidos} de {dadosPainel.slaCompetencia.totalAvaliados} atendidos
          </div>
        </div>

        {/* Card 3: Postos-dia descobertos */}
        <div className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs flex flex-col justify-between h-full min-h-[160px]">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6474] block">
              Postos-dia descobertos
            </span>

            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <span
                className={`text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${
                  dadosPainel.descobertosCompetencia.totalDescobertos > 0
                    ? "text-[#D92D20]"
                    : "text-[#94A3B8]"
                }`}
              >
                {dadosPainel.descobertosCompetencia.totalDescobertos > 0
                  ? `${dadosPainel.descobertosCompetencia.totalDescobertos} dias`
                  : "—"}
              </span>

              <span className="text-xs text-[#5B6474]">
                de {dadosPainel.descobertosCompetencia.totalPrevistos} previstos
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1F3F5] flex items-center justify-between text-xs text-[#5B6474]">
            <span>Apuração acumulada</span>
            <Link
              href={`/mapa-ocupacao?baseId=${filtroBase}&competencia=${competenciaSelecionada}&filtro=DESCOBERTO`}
              className="inline-flex items-center text-xs font-semibold text-[#1F4FD1] hover:text-[#163A9E] hover:underline"
            >
              <span>Ver no mapa →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. DECISÕES PENDENTES DA BASE (CONSOLIDAÇÃO POR POSTO)              */}
      {/* =================================================================== */}
      <section aria-label="Decisões pendentes da base" className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-[#1A2230] uppercase tracking-wider">
              Decisões pendentes da base ({decisoesBase.length})
            </h2>
            <span className="text-xs text-[#5B6474]">
              Itens consolidados exigindo ação ou resposta
            </span>
          </div>

          {decisoesBase.length > 5 && (
            <button
              onClick={() => setMostrarTodasDecisoes(!mostrarTodasDecisoes)}
              className="text-xs font-semibold text-[#1F4FD1] hover:underline"
            >
              {mostrarTodasDecisoes ? "Mostrar menos" : `Ver todas as ${decisoesBase.length} decisões →`}
            </button>
          )}
        </div>

        {/* Estado Vazio: Check verde + Nenhuma decisão pendente */}
        {decisoesBase.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#5B6474] flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-[#0F7B4F]" />
            <span className="font-semibold text-sm text-[#1A2230]">
              Nenhuma decisão pendente nesta base
            </span>
            <p className="text-[11px] text-[#5B6474]">
              Todos os postos e apontamentos desta base estão em conformidade nesta competência.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E3E6EB]">
            {decisoesExibidas.map((item) => (
              <div
                key={item.codigoPosto}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F9FAFB] p-2 rounded-lg transition-colors"
              >
                {/* Informações do Posto e Resumo em 1 Frase */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-[#1A2230]">
                      {item.funcao}
                    </span>
                    <span className="text-slate-300">·</span>
                    {/* Código do posto em texto simples mono cinza (nunca como selo) */}
                    <span className="font-mono text-[#5B6474] text-[11px]">
                      {item.codigoPosto}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[#5B6474] font-medium">
                      {item.titularNome}
                    </span>
                  </div>

                  {/* Resumo em uma frase sem texto cortado */}
                  <p className="text-xs text-[#475467] leading-relaxed break-words">
                    {item.resumoFrase}
                  </p>
                </div>

                {/* Direita: Selo Único de Prazo + Botão Primário Único */}
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                      item.seloCor === "vermelho"
                        ? "bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]"
                        : "bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89]"
                    }`}
                  >
                    {item.seloTexto}
                  </span>

                  <button
                    onClick={() => handleAbrirDrawer(item)}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold shadow-xs transition-all"
                  >
                    {ehFiscal ? "Ver detalhes" : "Resolver"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* 4. LINHA DE 2 CARDS: EVOLUÇÃO (2/3) + FECHAMENTO (1/3)              */}
      {/* =================================================================== */}
      <section aria-label="Evolução e fechamento da competência" className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <EvolucaoCompetenciaCard
            dados={dadosPainel.evolucaoCompetencia}
            metaSla={dadosPainel.slaCompetencia.meta}
          />
        </div>

        <div className="xl:col-span-1">
          <FechamentoMedicaoCard
            dados={dadosPainel.fechamentoMedicao}
            perfilUsuario={perfilAtivo}
          />
        </div>
      </section>

      {/* =================================================================== */}
      {/* 5. DRAWER LATERAL DE RESOLUÇÃO OU LEITURA FISCAL                   */}
      {/* =================================================================== */}
      <DrawerDecisao
        decisao={decisaoSelecionada}
        aberto={drawerAberto}
        onFechar={() => setDrawerAberto(false)}
        ehFiscal={ehFiscal}
        competencia={competenciaSelecionada}
      />
    </div>
  );
}
