"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
} from "lucide-react";
import { carregarEstado, EstadoOperacionalCompleto } from "@/lib/dados/estado-operacional";
import { obterOcupacaoConsolidada } from "@/lib/servicos/adaptador-painel";
import { ResultadoOcupacaoConsolidado } from "@/lib/servicos/calculo-ocupacao";
import {
  consolidarDecisoesPorPosto,
  calcularSemaforoBases,
  DecisaoConsolidadaPosto,
  BaseContratoStatus,
} from "@/lib/servicos/decisoes-consolidadas";
import { MinigraficoSla } from "@/components/painel/minigrafico-sla";
import { DrawerDecisao } from "@/components/painel/drawer-decisao";
import { UsuarioSessao } from "@/lib/auth/tipos";
import { obterParametrosContrato } from "@/lib/auth/parametros";

export default function VisaoContratoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const competenciaParam = searchParams.get("competencia") || "2026-09";
  const [competencia, setCompetencia] = useState<string>(competenciaParam);
  const [estado, setEstado] = useState<EstadoOperacionalCompleto>(carregarEstado);
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
    if (competenciaParam) {
      setCompetencia(competenciaParam);
    }
  }, [competenciaParam]);

  const handleMudarCompetencia = (novaComp: string) => {
    setCompetencia(novaComp);
    router.replace(`/painel?competencia=${novaComp}`);
  };

  const perfilAtivo = sessao?.perfil || "PREMIER_GESTOR";
  const ehFiscal = perfilAtivo.startsWith("PETROBRAS");

  // Motor centralizado de cálculo consolidado em TODAS as bases permitidas
  const dadosPainel: ResultadoOcupacaoConsolidado = useMemo(() => {
    return obterOcupacaoConsolidada(estado, {
      baseId: "TODAS",
      competencia,
      dataHoje: "2026-09-16",
      horaHoje: "08:00",
      perfilUsuario: perfilAtivo,
    });
  }, [estado, competencia, perfilAtivo]);

  // Decisões Consolidadas por Posto (Bloco 3)
  const decisoesConsolidadas = useMemo(() => {
    return consolidarDecisoesPorPosto(dadosPainel, estado, perfilAtivo, sessao);
  }, [dadosPainel, estado, perfilAtivo, sessao]);

  // Semáforo e Ordenação das Bases do Contrato (Bloco 2)
  const basesContrato = useMemo(() => {
    return calcularSemaforoBases(
      dadosPainel.comparativoBases,
      decisoesConsolidadas,
      dadosPainel.slaCompetencia.meta,
      sessao
    );
  }, [dadosPainel.comparativoBases, decisoesConsolidadas, dadosPainel.slaCompetencia.meta, sessao]);

  // Cálculos Consolidados dos 3 Cards
  const slaAtual = dadosPainel.slaCompetencia.valor;
  const metaSla = dadosPainel.slaCompetencia.meta;
  const projecaoSla = dadosPainel.evolucaoCompetencia.projecaoFechamento;
  const projecaoAbaixoDaMeta = projecaoSla !== null && projecaoSla < metaSla;

  // Total de postos vagos/descobertos somados das bases que o usuário vê
  const totalPostosVagos = useMemo(() => {
    return basesContrato.reduce((acc, b) => acc + b.postosVagosCount, 0);
  }, [basesContrato]);

  const basesComPostosVagos = useMemo(() => {
    return basesContrato.filter((b) => b.postosVagosCount > 0).length;
  }, [basesContrato]);

  // Decisão mais próxima para o rodapé do card 3
  const proximaDecisao = decisoesConsolidadas[0];
  const totalDecisoes = decisoesConsolidadas.length;

  const handleAbrirDrawer = (decisao: DecisaoConsolidadaPosto) => {
    setDecisaoSelecionada(decisao);
    setDrawerAberto(true);
  };

  // Nome formatado do mês/ano
  const [anoComp, mesComp] = competencia.split("-");
  const nomesMeses: Record<string, string> = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Março",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro",
  };
  const mesAnoFormatado = `${nomesMeses[mesComp] || "Mês"} de ${anoComp}`;

  // Lista fatiada de decisões (máximo 5 ou todas se expandido)
  const decisoesExibidas = mostrarTodasDecisoes
    ? decisoesConsolidadas
    : decisoesConsolidadas.slice(0, 5);

  return (
    <div className="space-y-6 w-full max-w-[1440px] pb-16 select-none">
      {/* =================================================================== */}
      {/* 1. CABEÇALHO EXECUTIVO DA VISÃO DO CONTRATO                         */}
      {/* =================================================================== */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E3E6EB] pb-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#5B6474] tracking-wide">
            Contrato Petrobras · {mesAnoFormatado}
          </div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-[#1A2230] tracking-tight leading-none">
            Painel geral
          </h1>
          {/* Texto discreto (13px, cinza): "Dados atualizados em dd/mm às hh:mm" */}
          <div className="text-[13px] text-[#5B6474] font-normal pt-0.5">
            Dados atualizados em 16/09 às 08:30
          </div>
        </div>

        {/* Controles à Direita: Seletor de Competência e Botão Memória de Cálculo */}
        <div className="flex items-center gap-3 shrink-0">
          <div>
            <label htmlFor="select-competencia" className="sr-only">
              Competência
            </label>
            <select
              id="select-competencia"
              value={competencia}
              onChange={(e) => handleMudarCompetencia(e.target.value)}
              className="h-9 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
            >
              <option value="2026-09">Setembro/2026 (vigente)</option>
              <option value="2026-08">Agosto/2026</option>
              <option value="2026-07">Julho/2026</option>
            </select>
          </div>

          <Link
            href={`/relatorios?competencia=${competencia}`}
            className="h-9 px-3.5 inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-[#1A2230] text-xs font-semibold shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#1F4FD1]" />
            <span>Memória de cálculo</span>
          </Link>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. BLOCO 1: INDICADORES (EXATAMENTE 3 CARDS CONSOLIDADOS)           */}
      {/* =================================================================== */}
      <section aria-label="Indicadores consolidados do contrato" className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card a: SLA do Contrato */}
          <div className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6474]">
                SLA do contrato
              </span>
              <span className="text-xs font-semibold text-[#5B6474]">
                meta 95%
              </span>
            </div>

            <div className="flex items-end justify-between gap-4">
              <div className="text-3xl sm:text-4xl font-bold text-[#1A2230] tracking-tight">
                {slaAtual !== null ? `${slaAtual.toFixed(1).replace(".", ",")}%` : "—"}
              </div>

              {/* Minigráfico de linha (~40px) com SLA acumulado dia a dia sem eixos */}
              <div className="w-[140px] shrink-0">
                <MinigraficoSla
                  serie={dadosPainel.evolucaoCompetencia.serie}
                  metaSla={metaSla}
                  altura={40}
                />
              </div>
            </div>

            {/* Rodapé: "Projeção de fechamento: XX,X%" SOMENTE se abaixo da meta, em vermelho */}
            <div className="min-h-[18px] text-xs font-semibold">
              {projecaoAbaixoDaMeta ? (
                <span className="text-[#D92D20]">
                  Projeção de fechamento: {projecaoSla?.toFixed(1).replace(".", ",")}%
                </span>
              ) : (
                <span className="text-[#5B6474] font-normal text-[11px]">
                  Consolidado das bases autorizadas
                </span>
              )}
            </div>
          </div>

          {/* Card b: Postos Vagos */}
          <div className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6474]">
                Postos vagos / descobertos
              </span>
              <span className="text-[11px] text-[#5B6474]">Turno agora</span>
            </div>

            <div>
              <div
                className={`text-3xl sm:text-4xl font-bold tracking-tight ${
                  totalPostosVagos > 0 ? "text-[#D92D20]" : "text-[#94A3B8]"
                }`}
              >
                {totalPostosVagos > 0 ? totalPostosVagos : "—"}
              </div>
            </div>

            {/* Rodapé: "em N base(s)" ou "Nenhum posto vago" */}
            <div className="text-xs font-medium">
              {totalPostosVagos > 0 ? (
                <span className="text-[#D92D20] font-semibold">
                  em {basesComPostosVagos} {basesComPostosVagos === 1 ? "base" : "bases"}
                </span>
              ) : (
                <span className="text-[#0F7B4F] font-semibold">
                  Nenhum posto vago
                </span>
              )}
            </div>
          </div>

          {/* Card c: Decisões Pendentes */}
          <div className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6474]">
                Decisões pendentes
              </span>
              <span className="text-[11px] text-[#5B6474]">Consolidadas por posto</span>
            </div>

            <div>
              <div
                className={`text-3xl sm:text-4xl font-bold tracking-tight ${
                  totalDecisoes > 0 ? "text-[#1A2230]" : "text-[#94A3B8]"
                }`}
              >
                {totalDecisoes > 0 ? totalDecisoes : "—"}
              </div>
            </div>

            {/* Rodapé: prazo mais próximo; vermelho se <= 1 dia ou vencida */}
            <div className="text-xs font-medium">
              {proximaDecisao ? (
                <span
                  className={
                    (proximaDecisao.diasParaVencer ?? 99) <= 1
                      ? "text-[#D92D20] font-semibold"
                      : "text-[#B54708] font-semibold"
                  }
                >
                  {(proximaDecisao.diasParaVencer ?? 99) <= 0
                    ? `1 pendência vencida (${proximaDecisao.dataLimiteFormatada})`
                    : (proximaDecisao.diasParaVencer ?? 99) === 1
                    ? `próxima vence hoje (${proximaDecisao.dataLimiteFormatada})`
                    : `próxima vence em ${proximaDecisao.diasParaVencer} dias (${proximaDecisao.dataLimiteFormatada})`}
                </span>
              ) : (
                <span className="text-[#0F7B4F] font-semibold">
                  Nenhuma pendência crítica
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Linha de texto simples abaixo dos cards (não é card): Fechamento da medição */}
        <div className="text-xs text-[#5B6474] flex items-center gap-2 pt-0.5 px-1 font-medium">
          <Clock className="w-3.5 h-3.5 text-[#5B6474] shrink-0" />
          <span>
            Fechamento da medição:{" "}
            <strong className="text-[#1A2230] font-semibold">
              {dadosPainel.fechamentoMedicao.totalConcluidas} de 5 etapas concluídas
            </strong>{" "}
            ·{" "}
            {dadosPainel.fechamentoMedicao.prazoFechamento
              ? `prazo ${dadosPainel.fechamentoMedicao.prazoFechamento}`
              : "prazo não cadastrado"}
          </span>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. BLOCO 2: TABELA "BASES DO CONTRATO"                              */}
      {/* =================================================================== */}
      <section aria-label="Bases do contrato" className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#1A2230] uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#1F4FD1]" />
              <span>Bases do Contrato</span>
            </h2>
            <p className="text-xs text-[#5B6474] mt-0.5">
              Situação operacional e conformidade consolidada por unidade contratual.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F9FC] border-b border-[#E3E6EB] text-[#5B6474] font-semibold">
                <th className="py-3 px-3 text-center w-16">Situação</th>
                <th className="py-3 px-4">Base</th>
                <th className="py-3 px-4 text-center">SLA da competência</th>
                <th className="py-3 px-4 text-center">Postos vagos</th>
                <th className="py-3 px-4 text-center">Pendências</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E6EB]">
              {basesContrato.map((b) => {
                const corPonto =
                  b.situacaoCor === "vermelho"
                    ? "bg-[#D92D20]"
                    : b.situacaoCor === "laranja"
                    ? "bg-[#F79009]"
                    : "bg-[#0F7B4F]";

                return (
                  <tr
                    key={b.baseId}
                    onClick={() => router.push(`/painel/base/${b.baseId}?competencia=${competencia}`)}
                    className="hover:bg-[#F9FAFB] cursor-pointer transition-colors group"
                  >
                    {/* Situação (Ponto Colorido) */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex justify-center" title={b.motivoSituacao}>
                        <span className={`w-3 h-3 rounded-full ${corPonto} ring-4 ring-transparent group-hover:ring-slate-100 transition-all`} />
                      </div>
                    </td>

                    {/* Nome da Base */}
                    <td className="py-3.5 px-4 font-bold text-[#1A2230]">
                      <span className="group-hover:text-[#1F4FD1] transition-colors">
                        {b.baseNome}
                      </span>
                      <span className="text-[11px] text-[#5B6474] font-normal block">
                        {b.postosTotal} postos homologados
                      </span>
                    </td>

                    {/* SLA da Competência */}
                    <td className="py-3.5 px-4 text-center font-semibold">
                      {b.slaPercentual !== null ? (
                        <span
                          className={
                            b.slaPercentual < metaSla
                              ? "text-[#D92D20] font-bold"
                              : "text-[#1A2230]"
                          }
                        >
                          {b.slaPercentualFormatado}
                        </span>
                      ) : (
                        <span className="text-[#98A2B3] font-mono">—</span>
                      )}
                    </td>

                    {/* Postos Vagos */}
                    <td className="py-3.5 px-4 text-center">
                      {b.postosVagosCount > 0 ? (
                        <span className="font-bold text-[#D92D20]">
                          {b.postosVagosCount}
                        </span>
                      ) : (
                        <span className="text-[#98A2B3] font-mono">—</span>
                      )}
                    </td>

                    {/* Pendências */}
                    <td className="py-3.5 px-4 text-center">
                      {b.pendenciasCount > 0 ? (
                        <span className="font-bold text-[#B54708]">
                          {b.pendenciasCount}
                        </span>
                      ) : (
                        <span className="text-[#98A2B3] font-mono">—</span>
                      )}
                    </td>

                    {/* Ação: Abrir */}
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/painel/base/${b.baseId}?competencia=${competencia}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 font-semibold text-xs text-[#1F4FD1] hover:text-[#163CA8] group-hover:underline"
                      >
                        <span>Abrir →</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 4. BLOCO 3: LISTA "DECISÕES PENDENTES" (CONSOLIDAÇÃO POR POSTO)     */}
      {/* =================================================================== */}
      <section aria-label="Decisões pendentes do contrato" className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-[#1A2230] uppercase tracking-wider">
              Decisões pendentes ({decisoesConsolidadas.length})
            </h2>
            <span className="text-xs text-[#5B6474]">
              Itens consolidados por posto exigindo ação ou resposta
            </span>
          </div>

          {decisoesConsolidadas.length > 5 && (
            <button
              onClick={() => setMostrarTodasDecisoes(!mostrarTodasDecisoes)}
              className="text-xs font-semibold text-[#1F4FD1] hover:underline"
            >
              {mostrarTodasDecisoes ? "Mostrar menos" : `Ver todas as ${decisoesConsolidadas.length} decisões →`}
            </button>
          )}
        </div>

        {/* Estado Vazio: Check verde + "Nenhuma decisão pendente" */}
        {decisoesConsolidadas.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#5B6474] flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-[#0F7B4F]" />
            <span className="font-semibold text-sm text-[#1A2230]">
              Nenhuma decisão pendente
            </span>
            <p className="text-[11px] text-[#5B6474]">
              Todos os postos e apontamentos estão homologados e em conformidade nesta competência.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E3E6EB]">
            {decisoesExibidas.map((item) => (
              <div
                key={item.codigoPosto}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F9FAFB] p-2 rounded-lg transition-colors"
              >
                {/* Linha 1 e Linha 2 do Item */}
                <div className="space-y-1 min-w-0 flex-1">
                  {/* Linha 1: Função (negrito) · código (mono cinza) · nome da base */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-[#1A2230]">
                      {item.funcao}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-[#5B6474] text-[11px]">
                      {item.codigoPosto}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[#5B6474] font-medium">
                      {item.baseNome}
                    </span>
                  </div>

                  {/* Linha 2: Resumo em uma frase combinando as situações */}
                  <p className="text-xs text-[#475467] leading-relaxed">
                    {item.resumoFrase}
                  </p>
                </div>

                {/* Direita: Selo Único + Botão Primário Único */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* UM único selo, apenas de prazo/urgência */}
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                      item.seloCor === "vermelho"
                        ? "bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]"
                        : "bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89]"
                    }`}
                  >
                    {item.seloTexto}
                  </span>

                  {/* UM único botão primário: "Resolver" para Gestor ou "Ver detalhes" para Fiscal */}
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
      {/* 5. PAINEL LATERAL (DRAWER) DE RESOLUÇÃO                             */}
      {/* =================================================================== */}
      <DrawerDecisao
        decisao={decisaoSelecionada}
        aberto={drawerAberto}
        onFechar={() => setDrawerAberto(false)}
        ehFiscal={ehFiscal}
        competencia={competencia}
      />
    </div>
  );
}
