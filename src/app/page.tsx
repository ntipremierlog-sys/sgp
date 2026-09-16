"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  X,
} from "lucide-react";
import { carregarEstado, EstadoOperacionalCompleto } from "@/lib/dados/estado-operacional";
import { obterOcupacaoConsolidada } from "@/lib/servicos/adaptador-painel";
import {
  ResultadoOcupacaoConsolidado,
  StatusPostoDia,
  DetalhePostoDia,
} from "@/lib/servicos/calculo-ocupacao";
import { KpiCard } from "@/components/painel/kpi-card";
import { AttentionItem } from "@/components/painel/attention-item";
import { OccupancyCell, ESTILOS_STATUS } from "@/components/painel/occupancy-cell";
import { SegmentedControl } from "@/components/painel/segmented-control";

export default function PainelGeralPage() {
  const [estado, setEstado] = useState<EstadoOperacionalCompleto>(carregarEstado);
  const [filtroBase, setFiltroBase] = useState<string>("UFN-III");
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState<string>("2026-09");
  const [filtroSoDesvio, setFiltroSoDesvio] = useState<boolean>(true);
  const [perfilAtivo, setPerfilAtivo] = useState<string>("PREMIER_GESTOR");
  const [celulaInspecionada, setCelulaInspecionada] = useState<DetalhePostoDia | null>(null);

  useEffect(() => {
    const carregar = () => {
      const e = carregarEstado();
      setEstado(e);
      if (e.perfilAtivo) {
        setPerfilAtivo(e.perfilAtivo);
      }
    };
    carregar();

    const handleAtualizacao = () => carregar();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // Motor centralizado de cálculo
  const dadosPainel: ResultadoOcupacaoConsolidado = useMemo(() => {
    return obterOcupacaoConsolidada(estado, {
      baseId: filtroBase,
      competencia: competenciaSelecionada,
      dataHoje: "2026-09-16",
      horaHoje: "08:00",
      perfilUsuario: perfilAtivo,
    });
  }, [estado, filtroBase, competenciaSelecionada, perfilAtivo]);

  // Linhas da grade filtradas
  const linhasGrade = useMemo(() => {
    const todas = dadosPainel.gradeSemanal.linhas;
    if (!filtroSoDesvio) return todas;
    return todas.filter((linha) => linha.temDesvio);
  }, [dadosPainel.gradeSemanal.linhas, filtroSoDesvio]);

  const listaBases = [
    { id: "TODAS", nome: "Todas as bases contratuais" },
    { id: "UFN-III", nome: "UFN III – Três Lagoas/MS (Base principal)" },
    { id: "MACAE", nome: "Base Macaé / Parque de Tubos" },
    { id: "SANTOS", nome: "Terminal Portuário Santos/SP" },
    { id: "PAULINIA", nome: "Refinaria Paulínia (Replan/SP)" },
  ];

  const rolarParaGrade = () => {
    const el = document.getElementById("grade-semanal");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Cálculo de subtítulo de cobertura agora
  const totalEmTurno = dadosPainel.coberturaAgora.postosComEscalaHoje;
  const cobertosHoje = dadosPainel.coberturaAgora.presentes + dadosPainel.coberturaAgora.substitutos;
  const inativosHoje =
    dadosPainel.coberturaAgora.postosSemEscalaHoje + dadosPainel.coberturaAgora.aguardandoTurno;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* =================================================================== */}
      {/* 1. CABEÇALHO DA PÁGINA COM SELETORES E ATUALIZAÇÃO EM LINHA       */}
      {/* =================================================================== */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        {/* Esquerda: Contexto, Título 28px bold e Ponto Verde de Atualização */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#5B6474] tracking-wide">
            <span>{dadosPainel.filtroAplicado.baseNome}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span>Setembro de 2026</span>
          </div>

          <h1 className="text-[28px] font-bold text-[#1A2230] tracking-tight leading-none">
            Painel geral
          </h1>

          <div className="flex items-center gap-2 text-xs font-medium text-[#5B6474] pt-1">
            <span className="w-2 h-2 rounded-full bg-[#0F7B4F] shrink-0" />
            <span>
              Dados atualizados: Ponto RHID em{" "}
              <strong className="text-[#1A2230] font-semibold">
                {dadosPainel.frescor.pontoRhidAte}
              </strong>{" "}
              · RM em{" "}
              <strong className="text-[#1A2230] font-semibold">
                {dadosPainel.frescor.rmAte}
              </strong>
            </span>
          </div>
        </div>

        {/* Direita: Seletores de Base, Competência e Botão Memória de Cálculo */}
        <div className="flex flex-wrap items-end gap-3 shrink-0">
          <div>
            <label
              htmlFor="filtro-base"
              className="block text-xs font-semibold text-[#5B6474] mb-1.5"
            >
              Base operacional
            </label>
            <div className="relative">
              <select
                id="filtro-base"
                value={filtroBase}
                onChange={(e) => setFiltroBase(e.target.value)}
                className="h-10 text-xs bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 font-medium text-[#1A2230] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1] shadow-xs cursor-pointer min-w-[210px]"
              >
                {listaBases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="filtro-competencia"
              className="block text-xs font-semibold text-[#5B6474] mb-1.5"
            >
              Competência
            </label>
            <select
              id="filtro-competencia"
              value={competenciaSelecionada}
              onChange={(e) => setCompetenciaSelecionada(e.target.value)}
              className="h-10 text-xs bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 font-medium text-[#1A2230] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1] shadow-xs cursor-pointer"
            >
              <option value="2026-09">Setembro / 2026 (Atual)</option>
              <option value="2026-08">Agosto / 2026</option>
            </select>
          </div>

          <Link
            href="/relatorios"
            className="h-10 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg text-xs font-semibold text-[#1A2230] bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-all shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#5B6474]" />
            <span>Memória de cálculo</span>
          </Link>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. QUATRO INDICADORES PRINCIPAIS (GRID DE 4 COLUNAS IGUAIS)         */}
      {/* =================================================================== */}
      <section aria-label="Indicadores principais de desempenho" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Cobertura Agora */}
        <KpiCard
          rotulo="Cobertura agora"
          badge={
            dadosPainel.coberturaAgora.vagos > 0
              ? {
                  texto: `${dadosPainel.coberturaAgora.vagos} ${
                    dadosPainel.coberturaAgora.vagos === 1 ? "posto vago" : "postos vagos"
                  }`,
                  variante: "perigo",
                }
              : dadosPainel.coberturaAgora.descobertos > 0
              ? {
                  texto: `${dadosPainel.coberturaAgora.descobertos} ${
                    dadosPainel.coberturaAgora.descobertos === 1 ? "descoberto" : "descobertos"
                  }`,
                  variante: "perigo",
                }
              : undefined
          }
          valorPrincipal={dadosPainel.coberturaAgora.percentualFormatado}
          barraProgresso={{
            percentual: dadosPainel.coberturaAgora.percentual,
            corBarra: "bg-[#0F7B4F]",
            corFundo: "bg-[#FDECEA]",
          }}
          linhaContexto={`${cobertosHoje} de ${totalEmTurno} postos em turno cobertos · ${inativosHoje} sem escala hoje`}
        />

        {/* Card 2: SLA da Competência */}
        <KpiCard
          rotulo="SLA da competência"
          badge={
            dadosPainel.slaCompetencia.valor !== null
              ? dadosPainel.slaCompetencia.valor >= dadosPainel.slaCompetencia.meta
                ? { texto: "Dentro da meta", variante: "sucesso" }
                : { texto: "Abaixo da meta", variante: "perigo" }
              : undefined
          }
          valorPrincipal={dadosPainel.slaCompetencia.valorFormatado}
          complementoValor={
            dadosPainel.slaCompetencia.variacaoPpFormatada ? (
              <span
                className={`font-semibold ${
                  dadosPainel.slaCompetencia.corSla === "verde"
                    ? "text-[#0F7B4F]"
                    : "text-[#B42318]"
                }`}
              >
                {dadosPainel.slaCompetencia.variacaoPpFormatada}
              </span>
            ) : null
          }
          barraProgresso={{
            percentual: dadosPainel.slaCompetencia.valor ?? 0,
            corBarra:
              dadosPainel.slaCompetencia.corSla === "verde"
                ? "bg-[#0F7B4F]"
                : "bg-[#B42318]",
            corFundo: "bg-[#F1F3F5]",
          }}
          linhaContexto={`Meta ≥ ${dadosPainel.slaCompetencia.metaFormatada} · ${dadosPainel.slaCompetencia.totalAtendidos} de ${dadosPainel.slaCompetencia.totalAvaliados} atendidos`}
        />

        {/* Card 3: Postos-dia Descobertos */}
        <KpiCard
          rotulo="Postos-dia descobertos"
          valorPrincipal={dadosPainel.descobertosCompetencia.totalDescobertos}
          valorDestaqueCor={
            dadosPainel.descobertosCompetencia.totalDescobertos > 0 ? "perigo" : "padrao"
          }
          complementoValor={
            <span className="text-xs text-[#5B6474]">
              de {dadosPainel.descobertosCompetencia.totalPrevistos} previstos
            </span>
          }
          linhaContexto="no mês acumulado"
          linkAcao={{
            texto: "Ver dias descobertos →",
            href: "#grade-semanal",
            isScroll: true,
            onClick: rolarParaGrade,
          }}
        />

        {/* Card 4: Glosa Estimada */}
        {perfilAtivo === "PETROBRAS_FISCAL" ? (
          <KpiCard
            rotulo="Glosa estimada"
            badge={{ texto: "Restrito LGPD", variante: "neutro" }}
            valorPrincipal="R$ —"
            linhaContexto="Omitido para o perfil de fiscalização Petrobras"
          />
        ) : dadosPainel.glosaEstimada.status === "PARAMETRIZAR" ? (
          <KpiCard
            rotulo="Glosa estimada"
            naoConfigurado={{
              badgeTexto: "Não configurada",
              linkTexto: "Cadastrar parâmetro de glosa →",
              linkHref: "/admin",
            }}
            valorPrincipal="R$ —"
            linhaContexto="Parâmetro não cadastrado"
          />
        ) : (
          <KpiCard
            rotulo="Glosa estimada"
            badge={{ texto: "Calculado", variante: "sucesso" }}
            valorPrincipal={`R$ ${dadosPainel.glosaEstimada.valorTotalFormatado}`}
            linhaContexto="Pela memória de cálculo contratual"
          />
        )}
      </section>

      {/* =================================================================== */}
      {/* 3. SEÇÃO "PRECISA DA SUA ATENÇÃO"                                  */}
      {/* =================================================================== */}
      <section aria-labelledby="titulo-atencao" className="bg-white p-5 rounded-[12px] border border-[#E3E6EB] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 id="titulo-atencao" className="text-base font-bold text-[#1A2230] tracking-tight">
              Precisa da sua atenção
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FDECEA] text-[#B42318] border border-[#FECACA] tabular-nums">
              {dadosPainel.faixaAcao.length}
            </span>
          </div>
          <span className="text-xs text-[#5B6474]">
            {dadosPainel.faixaAcao.length > 0
              ? `${dadosPainel.faixaAcao.length} item(ns) prioritário(s)`
              : "Tudo regular"}
          </span>
        </div>

        {dadosPainel.faixaAcao.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-[#E7F6EE]/60 border border-[#A7F3D0] text-xs font-medium text-[#0F7B4F]">
            <CheckCircle2 className="w-5 h-5 text-[#0F7B4F] shrink-0" />
            <span>Nenhuma pendência no momento. Todos os apontamentos e turnos estão em conformidade.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {dadosPainel.faixaAcao.map((item) => (
              <AttentionItem
                key={item.id}
                id={item.id}
                postoCodigo={item.posto}
                titulo={item.posto ? `Apontamento Petrobras · ${item.posto}` : "Notificação operacional"}
                descricao={item.descricao}
                prazoTexto={item.prazoTexto}
                diasParaVencer={item.prazoTexto?.includes("hoje") || item.prazoTexto?.includes("1 dia") ? 1 : 2}
                acoes={item.acoes}
                perfilUsuario={perfilAtivo}
              />
            ))}
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* 4. COMPARATIVO POR BASE (QUANDO SELECIONADO "TODAS AS BASES")       */}
      {/* =================================================================== */}
      {filtroBase === "TODAS" && (
        <section aria-labelledby="titulo-comparativo" className="bg-white p-5 rounded-[12px] border border-[#E3E6EB] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="titulo-comparativo" className="text-sm font-bold text-[#1A2230] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1F4FD1]" />
              <span>Comparativo de bases operacionais</span>
            </h2>
            <span className="text-xs text-[#5B6474]">Ordenado por criticidade</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1A2230]">
              <thead className="bg-[#F8FAFC] text-[#5B6474] font-semibold border-y border-[#E3E6EB]">
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
              <tbody className="divide-y divide-[#E3E6EB] font-medium">
                {dadosPainel.comparativoBases.map((base) => (
                  <tr
                    key={base.baseId}
                    onClick={() => setFiltroBase(base.baseId)}
                    className="hover:bg-[#F4F5F7] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-semibold text-[#1A2230]">
                      {base.baseNome}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums">
                      {base.postosTotal}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          base.descobertosHoje > 0
                            ? "bg-[#FDECEA] text-[#B42318]"
                            : "bg-[#E7F6EE] text-[#0F7B4F]"
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
                            ? "bg-[#FEF4E6] text-[#B54708]"
                            : "text-[#667085]"
                        }`}
                      >
                        {base.pendenciasCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-[#1F4FD1] font-semibold text-[11px] hover:underline">
                        Filtrar base →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* 5. GRADE "OCUPAÇÃO DOS ÚLTIMOS 7 DIAS"                              */}
      {/* =================================================================== */}
      <section
        id="grade-semanal"
        aria-labelledby="titulo-grade"
        className="bg-white p-5 rounded-[12px] border border-[#E3E6EB] shadow-xs space-y-4"
      >
        {/* Cabeçalho do Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="titulo-grade" className="text-base font-bold text-[#1A2230] tracking-tight">
              Ocupação dos últimos 7 dias
            </h2>
            <p className="text-xs text-[#5B6474] mt-0.5">
              10 a 16 de setembro · situação de cada posto por dia
            </p>
          </div>

          <div className="flex items-center gap-3">
            <SegmentedControl
              size="sm"
              value={filtroSoDesvio ? "desvios" : "todos"}
              onChange={(v) => setFiltroSoDesvio(v === "desvios")}
              options={[
                {
                  value: "desvios",
                  label: "Com desvio",
                  count: dadosPainel.gradeSemanal.totalPostosComDesvio,
                },
                {
                  value: "todos",
                  label: "Todos os postos",
                  count: dadosPainel.gradeSemanal.totalPostos,
                },
              ]}
              ariaLabel="Filtrar postos com desvio ou todos"
            />

            <Link
              href="/mapa-ocupacao"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4FD1] hover:text-[#163A9E] hover:underline"
            >
              <span>Mapa do mês completo →</span>
            </Link>
          </div>
        </div>

        {/* Faixa Cinza com a Legenda (Miniaturas de 22px) */}
        <div className="p-3 bg-[#F8FAFC] border border-[#E3E6EB] rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-[#5B6474]">Legenda contratual:</span>
          <div className="flex flex-wrap items-center gap-3.5">
            {(Object.keys(ESTILOS_STATUS) as StatusPostoDia[]).map((st) => {
              const meta = ESTILOS_STATUS[st];
              return (
                <div key={st} className="flex items-center gap-1.5">
                  <OccupancyCell status={st} size="sm" interactive={false} />
                  <span className="text-[#3A4353] font-medium">{meta.rotulo}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabela de Grade dos 7 Dias */}
        <div className="overflow-x-auto border border-[#E3E6EB] rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#5B6474] font-semibold border-b border-[#E3E6EB]">
              <tr>
                <th className="py-3 px-3.5 min-w-[160px]">Posto e função</th>
                <th className="py-3 px-3.5 min-w-[140px]">Titular</th>
                {dadosPainel.gradeSemanal.dias.map((d) => (
                  <th
                    key={d.data}
                    className={`py-2 px-1 text-center min-w-[48px] ${
                      d.isHoje
                        ? "bg-[#F3F6FE] text-[#1F4FD1] font-bold border-x border-[#BFDBFE]"
                        : "text-[#5B6474] font-medium"
                    }`}
                  >
                    <div>{d.isHoje ? `Hoje · ${d.rotulo}` : d.rotulo}</div>
                  </th>
                ))}
                <th className="py-3 px-3.5 text-right min-w-[80px]">Desvios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E6EB]/80">
              {linhasGrade.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + dadosPainel.gradeSemanal.dias.length}
                    className="text-center py-8 text-[#5B6474] text-xs"
                  >
                    Nenhum posto com desvio encontrado nos últimos 7 dias.
                  </td>
                </tr>
              ) : (
                linhasGrade.map((linha) => (
                  <tr key={linha.postoId} className="hover:bg-[#F8FAFC] transition-colors">
                    {/* Posto e Função */}
                    <td className="py-2.5 px-3.5">
                      <span className="font-mono font-bold text-xs text-[#1A2230] block">
                        {linha.codigoPosto}
                      </span>
                      <span className="text-xs text-[#5B6474] truncate max-w-[170px] block">
                        {linha.funcao}
                      </span>
                    </td>

                    {/* Titular */}
                    <td className="py-2.5 px-3.5">
                      {linha.titularNome && !linha.titularNome.includes("Reserva") ? (
                        <span className="font-medium text-[#1A2230]">{linha.titularNome}</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF4E6] text-[#B54708] border border-[#FED7AA]">
                          Reserva técnica
                        </span>
                      )}
                    </td>

                    {/* 7 Dias */}
                    {dadosPainel.gradeSemanal.dias.map((d) => {
                      const celula = linha.celulas[d.data];
                      if (!celula) {
                        return (
                          <td
                            key={d.data}
                            className={`py-1.5 px-1 text-center ${
                              d.isHoje ? "bg-[#F3F6FE] border-x border-[#BFDBFE]/60" : ""
                            }`}
                          >
                            <span className="text-[#667085]">—</span>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={d.data}
                          className={`py-1.5 px-1 text-center ${
                            d.isHoje ? "bg-[#F3F6FE] border-x border-[#BFDBFE]/60" : ""
                          }`}
                        >
                          <div className="flex justify-center">
                            <OccupancyCell
                              status={celula.status}
                              data={celula.data}
                              postoCodigo={celula.codigoPosto}
                              motivo={celula.motivo}
                              onClick={() => setCelulaInspecionada(celula)}
                            />
                          </div>
                        </td>
                      );
                    })}

                    {/* Desvios */}
                    <td className="py-2.5 px-3.5 text-right">
                      {linha.totalDesvios > 0 ? (
                        <span className="font-bold text-xs text-[#B42318] tabular-nums">
                          {linha.totalDesvios} {linha.totalDesvios === 1 ? "dia" : "dias"}
                        </span>
                      ) : (
                        <span className="text-xs text-[#667085] tabular-nums">0</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé do Card da Tabela */}
        <div className="pt-2 flex flex-wrap items-center justify-between text-xs text-[#5B6474]">
          <span>
            Mostrando <strong>{linhasGrade.length}</strong> de{" "}
            <strong>{dadosPainel.gradeSemanal.totalPostos}</strong> postos
            {filtroSoDesvio && (
              <span className="text-slate-400 ml-1">
                (os demais estão sem desvio no período)
              </span>
            )}
          </span>
        </div>

        {/* Gaveta / Painel de Detalhe da Célula Inspecionada */}
        {celulaInspecionada && (
          <aside
            aria-labelledby="titulo-inspecao"
            className="p-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs space-y-2 relative animate-in fade-in duration-200"
          >
            <button
              type="button"
              onClick={() => setCelulaInspecionada(null)}
              className="absolute top-3 right-3 text-[#5B6474] hover:text-[#1A2230] p-1 rounded-md hover:bg-[#E3E6EB]"
              aria-label="Fechar detalhe da célula"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="font-bold text-[#1A2230] flex items-center gap-2">
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-[#E3E6EB]">
                {celulaInspecionada.codigoPosto}
              </span>
              <span id="titulo-inspecao">{celulaInspecionada.funcao}</span>
              <span className="text-[#CBD5E1]">·</span>
              <span>Data: {celulaInspecionada.data}</span>
            </div>

            <div className="text-[#3A4353]">
              <strong>Situação apurada:</strong> {celulaInspecionada.rotulo} (
              {celulaInspecionada.letra})
            </div>

            {celulaInspecionada.ocupanteNome && (
              <div className="text-[#3A4353]">
                <strong>Profissional atuante:</strong> {celulaInspecionada.ocupanteNome}
              </div>
            )}

            {celulaInspecionada.horarioPonto && (
              <div className="text-[#3A4353]">
                <strong>Marcações do ponto:</strong> {celulaInspecionada.horarioPonto}
              </div>
            )}

            <div className="text-[#3A4353] bg-white p-3 rounded border border-[#E3E6EB]">
              <strong>Motivo e auditoria:</strong> {celulaInspecionada.motivo}
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
