"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Building2,
  AlertTriangle,
  Users,
  ChevronRight,
  ArrowRight,
  Construction,
} from "lucide-react";
import { carregarEstado, EstadoOperacionalCompleto } from "@/lib/dados/estado-operacional";
import { obterOcupacaoConsolidada } from "@/lib/servicos/adaptador-painel";
import { ResultadoOcupacaoConsolidado } from "@/lib/servicos/calculo-ocupacao";
import {
  consolidarDecisoesPorPosto,
  calcularSemaforoBases,
  DecisaoConsolidadaPosto,
} from "@/lib/servicos/decisoes-consolidadas";
import { DrawerDecisao } from "@/components/painel/drawer-decisao";
import { UsuarioSessao } from "@/lib/auth/tipos";

function VisaoContratoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const competenciaParam = searchParams.get("competencia") || "2026-09";
  const [competencia, setCompetencia] = useState<string>(competenciaParam);
  const [estado, setEstado] = useState<EstadoOperacionalCompleto>(carregarEstado);
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [montado, setMontado] = useState<boolean>(false);
  const [decisaoSelecionada, setDecisaoSelecionada] = useState<DecisaoConsolidadaPosto | null>(null);
  const [drawerAberto, setDrawerAberto] = useState<boolean>(false);

  useEffect(() => {
    setMontado(true);
    const carregar = async () => {
      const e = carregarEstado();
      setEstado(e);
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.autenticado && data.usuario) setSessao(data.usuario);
        }
      } catch {
        /* fallback */
      }
    };
    carregar();
    const handler = () => carregar();
    window.addEventListener("sgp-dados-atualizados", handler);
    window.addEventListener("sgp-sessao-alterada", handler);
    return () => {
      window.removeEventListener("sgp-dados-atualizados", handler);
      window.removeEventListener("sgp-sessao-alterada", handler);
    };
  }, []);

  useEffect(() => {
    if (competenciaParam) setCompetencia(competenciaParam);
  }, [competenciaParam]);

  const handleMudarCompetencia = (novaComp: string) => {
    setCompetencia(novaComp);
    router.replace(`/painel?competencia=${novaComp}`);
  };

  const perfilAtivo = sessao?.perfil || "PREMIER_GESTOR";
  const ehFiscal = perfilAtivo.startsWith("PETROBRAS");

  const dadosPainel: ResultadoOcupacaoConsolidado = useMemo(
    () =>
      obterOcupacaoConsolidada(estado, {
        baseId: "TODAS",
        competencia,
        dataHoje: "2026-09-16",
        horaHoje: "08:00",
        perfilUsuario: perfilAtivo,
      }),
    [estado, competencia, perfilAtivo]
  );

  const decisoesConsolidadas = useMemo(
    () => consolidarDecisoesPorPosto(dadosPainel, estado, perfilAtivo, sessao),
    [dadosPainel, estado, perfilAtivo, sessao]
  );

  const basesContrato = useMemo(
    () =>
      calcularSemaforoBases(
        dadosPainel.comparativoBases,
        decisoesConsolidadas,
        dadosPainel.slaCompetencia.meta,
        sessao
      ),
    [dadosPainel.comparativoBases, decisoesConsolidadas, dadosPainel.slaCompetencia.meta, sessao]
  );

  // Totais e métricas consolidadas
  const slaAtual = dadosPainel.slaCompetencia.valor;
  const metaSla = dadosPainel.slaCompetencia.meta;
  const projecaoSla = dadosPainel.evolucaoCompetencia.projecaoFechamento;
  const totalPostosContrato = basesContrato.reduce((acc, b) => acc + b.postosTotal, 0);
  const totalPostosVagos = basesContrato.reduce((acc, b) => acc + b.postosVagosCount, 0);
  const totalPostosAtivos = Math.max(0, totalPostosContrato - totalPostosVagos);
  const descobertosHoje = dadosPainel.coberturaAgora.descobertos;
  const prazoFechamento = dadosPainel.fechamentoMedicao.prazoFechamento;
  const etapasConcluidas = dadosPainel.fechamentoMedicao.totalConcluidas;

  // Separação inteligente das decisões: Itens prioritários vs Vagas a preencher
  const acoesCriticas = useMemo(() => {
    return decisoesConsolidadas.filter(
      (d) =>
        d.statusPosto === "COM_APONTAMENTO" ||
        d.statusPosto === "DESCOBERTO" ||
        d.categoria === "VENCIDO" ||
        (d.diasParaVencer !== undefined && d.diasParaVencer <= 0)
    );
  }, [decisoesConsolidadas]);

  const vagasEmProcesso = useMemo(() => {
    return decisoesConsolidadas.filter(
      (d) =>
        d.statusPosto === "VAGO" &&
        d.categoria !== "VENCIDO" &&
        (d.diasParaVencer === undefined || d.diasParaVencer > 0)
    );
  }, [decisoesConsolidadas]);

  const totalVencidas = acoesCriticas.filter((d) => (d.diasParaVencer ?? 1) <= 0).length;

  // Status do SLA
  const statusSla =
    slaAtual === null
      ? "sem-dado"
      : slaAtual >= metaSla
      ? "conforme"
      : slaAtual >= 85
      ? "atencao"
      : "critico";

  // Mês formatado
  const [anoComp, mesComp] = competencia.split("-");
  const meses: Record<string, string> = {
    "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
    "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
  };
  const mesAno = `${meses[mesComp] || ""}/${anoComp}`;

  // Dias para o fechamento
  const diasParaFechamento = useMemo(() => {
    if (!prazoFechamento) return 5;
    const hoje = new Date(2026, 8, 16);
    const m = prazoFechamento.match(/(\d{1,2})\/(\d{1,2})/);
    if (m) {
      const prazo = new Date(Number(anoComp), Number(m[2]) - 1, Number(m[1]));
      return Math.ceil((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    }
    return 5;
  }, [prazoFechamento, anoComp]);

  // Formatação amigável de prazo
  const formatarPrazoDecisao = (dias?: number) => {
    if (dias === undefined || dias === null) return "Prazo regular";
    if (dias < 0) return `Vencida há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`;
    if (dias === 0) return "Vence hoje";
    if (dias === 1) return "Vence amanhã";
    return `Vence em ${dias} dias`;
  };

  if (!montado) {
    return (
      <div className="space-y-6 w-full max-w-[1440px] pb-16 animate-pulse">
        <div className="h-14 bg-white border border-[#E5E7EB] rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-white border border-[#E5E7EB] rounded-xl" />
          <div className="h-28 bg-white border border-[#E5E7EB] rounded-xl" />
          <div className="h-28 bg-white border border-[#E5E7EB] rounded-xl" />
          <div className="h-28 bg-white border border-[#E5E7EB] rounded-xl" />
        </div>
        <div className="h-64 bg-white border border-[#E5E7EB] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-[1440px] pb-16 select-none font-sans text-[#1A2230]">
      {/* ——— CABEÇALHO EXECUTIVO LIMPO ——— */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1F4FD1] mb-1">
            <span>Contrato Petrobras ICJ 5900.0129796.25.2</span>
            <span className="text-[#9CA3AF]">·</span>
            <span className="text-[#5B6474]">Premier Logistics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Painel Executivo — {mesAno}
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Visão consolidada para monitoramento e tomada de decisão gerencial
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <select
            id="select-competencia"
            value={competencia}
            onChange={(e) => handleMudarCompetencia(e.target.value)}
            className="h-9 px-3 text-xs font-semibold rounded-lg border border-[#D1D5DB] bg-white text-[#111827] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
          >
            <option value="2026-09">Set/2026 (vigente)</option>
            <option value="2026-08">Ago/2026 (encerrada)</option>
            <option value="2026-07">Jul/2026 (encerrada)</option>
          </select>
          <Link
            href="/em-desenvolvimento"
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white text-[#374151] text-xs font-semibold shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Construction className="w-3.5 h-3.5 text-amber-600" />
            <span>Em desenvolvimento</span>
          </Link>
        </div>
      </header>

      {/* ——— BARRA DE STATUS SINTÉTICA (Fundo neutro branco, sem caixas coloridas) ——— */}
      {totalVencidas > 0 || descobertosHoje > 0 ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#374151] shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>
              <strong className="text-[#111827]">Atenção Gerencial:</strong>{" "}
              {totalVencidas > 0 && (
                <span>
                  {totalVencidas} {totalVencidas === 1 ? "decisão com prazo expirado" : "decisões com prazo expirado"}.{" "}
                </span>
              )}
              {descobertosHoje > 0 && (
                <span>{descobertosHoje} posto descoberto no turno atual. </span>
              )}
              {totalPostosVagos > 0 && (
                <span className="text-[#4B5563]">
                  {totalPostosVagos} vagas em processo seletivo na UFN-III.
                </span>
              )}
            </span>
          </div>
          <a
            href="#decisoes-secao"
            className="shrink-0 font-semibold text-[#1F4FD1] hover:underline flex items-center gap-1 text-xs"
          >
            Ver ações <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#374151] shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>
            <strong className="text-[#111827]">Operação Conforme:</strong> SLA acima da meta contratual e sem descoberturas no turno.
          </span>
        </div>
      )}

      {/* ——— 4 KPIS EXECUTIVOS (Fundo branco neutro, sem caixas destacadas) ——— */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: SLA Geral */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              SLA do Contrato
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <span className={`w-1.5 h-1.5 rounded-full ${
                statusSla === "conforme" ? "bg-emerald-500" : statusSla === "atencao" ? "bg-amber-500" : "bg-rose-500"
              }`} />
              {statusSla === "conforme" ? "Conforme" : statusSla === "atencao" ? "Atenção" : "Crítico"}
            </span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#111827]">
                {slaAtual !== null ? `${slaAtual.toFixed(1).replace(".", ",")}%` : "—"}
              </span>
              <span className="text-xs text-[#6B7280]">meta {Math.round(metaSla)}%</span>
            </div>
          </div>
          <div className="text-[11px] text-[#6B7280] border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Projeção fechamento:</span>
            <span className="font-semibold text-[#111827]">
              {projecaoSla !== null ? `${projecaoSla.toFixed(1).replace(".", ",")}%` : `${slaAtual?.toFixed(1) || "100"}%`}
            </span>
          </div>
        </div>

        {/* KPI 2: Quadro de Postos */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Quadro de Postos
            </span>
            <span className="text-xs font-medium text-[#6B7280]">
              {totalPostosContrato} contratados
            </span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#111827]">
                {totalPostosAtivos}
              </span>
              <span className="text-xs text-[#059669] font-medium">ativos e regulares</span>
            </div>
          </div>
          <div className="text-[11px] text-[#6B7280] border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Vagas em processo:</span>
            <span className="font-medium text-[#4B5563]">{totalPostosVagos} na UFN-III</span>
          </div>
        </div>

        {/* KPI 3: Conformidade de Turno */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Turno Atual
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              descobertosHoje === 0 ? "text-emerald-700" : "text-rose-700"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${descobertosHoje === 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
              {descobertosHoje === 0 ? "100% Coberto" : `${descobertosHoje} Descoberto`}
            </span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#111827]">
                {dadosPainel.coberturaAgora.presentes + dadosPainel.coberturaAgora.substitutos}
              </span>
              <span className="text-xs text-[#6B7280]">profissionais em posto</span>
            </div>
          </div>
          <div className="text-[11px] text-[#6B7280] border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Descobertos hoje:</span>
            <span className={`font-medium ${descobertosHoje === 0 ? "text-[#059669]" : "text-rose-700"}`}>
              {descobertosHoje} postos
            </span>
          </div>
        </div>

        {/* KPI 4: Fechamento da Medição */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Fechamento Mensal
            </span>
            <span className="text-xs font-semibold text-[#1F4FD1]">
              {etapasConcluidas}/5 Etapas
            </span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#111827]">
                {diasParaFechamento}
              </span>
              <span className="text-xs text-[#6B7280]">dias para entrega</span>
            </div>
          </div>
          <div className="text-[11px] text-[#6B7280] border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Status da medição:</span>
            <span className="font-medium text-[#111827]">Ponto & RM integrados</span>
          </div>
        </div>
      </div>

      {/* ——— TABELA DE BASES CONTRATUAIS (Fundo neutro branco, sem destaques de fundo) ——— */}
      <section className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#1F4FD1]" />
            <h2 className="text-sm font-bold text-[#111827]">
              Situação Operacional por Base Contratual
            </h2>
          </div>
          <span className="text-xs text-[#6B7280]">
            {basesContrato.length} bases monitoradas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E5E7EB] text-[#6B7280] font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Base Operacional</th>
                <th className="py-2.5 px-4 text-center">Postos Contratados</th>
                <th className="py-2.5 px-4 text-center">Postos Ocupados</th>
                <th className="py-2.5 px-4 text-center">Vagas em Aberto</th>
                <th className="py-2.5 px-4 text-center">SLA Apurado</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {basesContrato.map((b) => {
                const ocupados = Math.max(0, b.postosTotal - b.postosVagosCount);
                const slaVal = b.slaPercentual ?? 100;

                return (
                  <tr
                    key={b.baseId}
                    onClick={() => router.push(`/painel/base/${b.baseId}?competencia=${competencia}`)}
                    className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="font-bold text-sm text-[#111827] block">
                        {b.baseNome}
                      </span>
                      <span className="text-[11px] text-[#6B7280]">
                        {b.baseId === "UFN-III" ? "Três Lagoas/MS" : b.baseId === "MACAE" ? "Macaé/RJ" : b.baseId === "SANTOS" ? "Santos/SP" : "Paulínia/SP"}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center font-semibold text-[#111827]">
                      {b.postosTotal}
                    </td>

                    <td className="py-3 px-4 text-center font-semibold text-[#059669]">
                      {ocupados}
                    </td>

                    <td className="py-3 px-4 text-center font-medium">
                      {b.postosVagosCount > 0 ? (
                        <span className="text-amber-700 font-semibold">
                          {b.postosVagosCount} vagas
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-bold text-sm text-[#111827]">
                      {b.slaPercentual !== null ? `${slaVal.toFixed(1).replace(".", ",")}%` : "—"}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#374151]">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            b.postosVagosCount === 0 ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        {b.postosVagosCount === 0 ? "Conforme" : "Em Alocação"}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4FD1] hover:underline">
                        Detalhes <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ——— CENTRAL DE DECISÕES E AÇÕES PRIORITÁRIAS (Fundo neutro branco) ——— */}
      <section id="decisoes-secao" className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#1F4FD1]" />
            <h2 className="text-sm font-bold text-[#111827]">
              Ações Gerenciais e Regularizações
            </h2>
          </div>
          <span className="text-xs text-[#6B7280]">
            {acoesCriticas.length + (vagasEmProcesso.length > 0 ? 1 : 0)} pendências de gestão
          </span>
        </div>

        <div className="space-y-3">
          {/* Card 1: Ação crítica individual (ex: PST-ALM-001) - Fundo branco neutro */}
          {acoesCriticas.map((item) => (
            <div
              key={item.codigoPosto}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-[#E5E7EB] bg-white hover:border-slate-300 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-[#111827]">{item.funcao}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-[11px] text-[#4B5563]">{item.codigoPosto}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[#4B5563]">{item.baseNome}</span>
                  {item.percentualCumprimentoFormatado && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-[#6B7280] text-[11px]">
                        Presença: <span className="font-mono text-[#374151] font-medium">{item.percentualCumprimentoFormatado}</span>
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-[#4B5563]">
                  {item.resumoFrase || "Regularização de titularidade requerida pelo gestor do contrato."}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-semibold text-rose-700 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {formatarPrazoDecisao(item.diasParaVencer)}
                </span>
                <button
                  onClick={() => {
                    setDecisaoSelecionada(item);
                    setDrawerAberto(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  {ehFiscal ? "Ver Detalhes" : "Resolver"}
                </button>
              </div>
            </div>
          ))}

          {/* Card 2: Agrupamento consolidado das demais vagas da UFN-III - Fundo branco neutro */}
          {vagasEmProcesso.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-[#E5E7EB] bg-white hover:border-slate-300 transition-colors">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 text-xs">
                  <Users className="w-4 h-4 text-[#1F4FD1] shrink-0" />
                  <span className="font-bold text-[#111827]">
                    Quadro a Preencher — UFN III ({vagasEmProcesso.length} postos)
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[#4B5563]">Três Lagoas/MS</span>
                </div>
                <p className="text-xs text-[#6B7280]">
                  Postos operacionais em processo seletivo / admissão no RM. Não geram glosa no modelo atual.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-medium text-[#6B7280]">
                  Em mobilização
                </span>
                <Link
                  href={`/postos?aba=VAGOS&competencia=${competencia}`}
                  className="px-3.5 py-1.5 rounded-lg border border-[#D1D5DB] bg-white hover:bg-slate-50 text-[#111827] text-xs font-semibold shadow-xs transition-colors"
                >
                  Gerenciar Postos
                </Link>
              </div>
            </div>
          )}

          {acoesCriticas.length === 0 && vagasEmProcesso.length === 0 && (
            <div className="py-8 text-center flex flex-col items-center gap-2 text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <p className="text-sm font-bold text-[#111827]">Tudo em dia!</p>
              <p className="text-xs text-[#6B7280]">Nenhuma pendência ou decisão necessária no momento.</p>
            </div>
          )}
        </div>
      </section>

      {/* ——— DRAWER DE DECISÃO LATERAL ——— */}
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

export default function VisaoContratoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Carregando painel...</div>}>
      <VisaoContratoContent />
    </Suspense>
  );
}
