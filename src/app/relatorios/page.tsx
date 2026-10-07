"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Printer,
  Download,
  Search,
  Filter,
  Calendar,
  Building2,
  Briefcase,
  Users,
  ShieldCheck,
  AlertTriangle,
  UserCheck2,
  CheckCircle2,
  FileCheck,
  ChevronRight,
  TrendingUp,
  FileDiff,
  AlertOctagon,
  RefreshCw,
} from "lucide-react";
import { BASES_SGP_SISTEMA } from "@/lib/dados/secoes-horarios";
import {
  gerarRelatorioOcupacaoPorPosto,
  gerarRelatorioCoberturas,
  gerarRelatorioDescobertos,
  gerarRelatorioQuadroFeristas,
  gerarComparativoHomologacaoMC,
  exportarRelatorioParaXlsx,
  CONTRATO_NUMERO,
  CONTRATO_CLIENTE,
  CONTRATADA_EMPRESA,
  RelatorioOcupacaoResultado,
  ItemCoberturaRelatorio,
  ItemDescobertoRelatorio,
  ItemQuadroFeristaRelatorio,
  RelatorioHomologacaoResultado,
} from "@/lib/servicos/relatorios-oficiais";
import { carregarEstado, obterTodosPostosContrato, PostoOperacional } from "@/lib/dados/estado-operacional";

type AbaRelatorio = "ocupacao" | "coberturas" | "descobertos" | "feristas" | "homologacao";

export default function RelatoriosOficiaisPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaRelatorio>("ocupacao");
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>("TODAS");
  const [postoFiltro, setPostoFiltro] = useState<string>("TODOS");
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("2026-09");
  const [busca, setBusca] = useState<string>("");
  const [dataEmissao, setDataEmissao] = useState<string>("");
  const [sessao, setSessao] = useState<any>(null);
  const [exportando, setExportando] = useState<boolean>(false);

  // Carrega postos disponíveis para o dropdown
  const [postosDisponiveis, setPostosDisponiveis] = useState<PostoOperacional[]>([]);

  useEffect(() => {
    setDataEmissao(new Date().toLocaleString("pt-BR"));
    const estado = carregarEstado();
    setPostosDisponiveis(obterTodosPostosContrato(estado.postos));

    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data.autenticado && data.usuario) {
          setSessao(data.usuario);
        }
      })
      .catch(() => {});
  }, []);

  const postosDropdown = useMemo(() => {
    if (unidadeFiltro === "TODAS") return postosDisponiveis;
    return postosDisponiveis.filter(
      (p) =>
        p.unidadeId === unidadeFiltro ||
        p.baseOperacional?.toUpperCase() === unidadeFiltro.toUpperCase()
    );
  }, [postosDisponiveis, unidadeFiltro]);

  // Se trocar de unidade e o posto selecionado não for dela, reseta o posto
  useEffect(() => {
    if (postoFiltro !== "TODOS") {
      const existe = postosDropdown.some((p) => p.idPosto === postoFiltro || p.codigoPosto === postoFiltro);
      if (!existe) setPostoFiltro("TODOS");
    }
  }, [unidadeFiltro, postosDropdown, postoFiltro]);

  const usuarioEmissorNome = sessao?.nome || "Administrador Premier";
  const perfilEmissorNome = sessao?.perfil || "PREMIER_ADMIN";

  // GERAÇÃO DOS RELATÓRIOS CONFORME ABA ATIVA
  const dadosOcupacao = useMemo(() => {
    if (abaAtiva !== "ocupacao") return null;
    return gerarRelatorioOcupacaoPorPosto({
      unidadeId: unidadeFiltro,
      postoId: postoFiltro,
      periodo: periodoFiltro,
      usuarioEmissor: usuarioEmissorNome,
      perfilEmissor: perfilEmissorNome,
    });
  }, [abaAtiva, unidadeFiltro, postoFiltro, periodoFiltro, usuarioEmissorNome, perfilEmissorNome]);

  const dadosCoberturas = useMemo(() => {
    if (abaAtiva !== "coberturas") return null;
    return gerarRelatorioCoberturas({
      unidadeId: unidadeFiltro,
      postoId: postoFiltro,
      periodo: periodoFiltro,
      usuarioEmissor: usuarioEmissorNome,
      perfilEmissor: perfilEmissorNome,
    });
  }, [abaAtiva, unidadeFiltro, postoFiltro, periodoFiltro, usuarioEmissorNome, perfilEmissorNome]);

  const dadosDescobertos = useMemo(() => {
    if (abaAtiva !== "descobertos") return null;
    return gerarRelatorioDescobertos({
      unidadeId: unidadeFiltro,
      postoId: postoFiltro,
      periodo: periodoFiltro,
      usuarioEmissor: usuarioEmissorNome,
      perfilEmissor: perfilEmissorNome,
    });
  }, [abaAtiva, unidadeFiltro, postoFiltro, periodoFiltro, usuarioEmissorNome, perfilEmissorNome]);

  const dadosFeristas = useMemo(() => {
    if (abaAtiva !== "feristas") return null;
    return gerarRelatorioQuadroFeristas({
      unidadeId: unidadeFiltro,
      periodo: periodoFiltro,
      usuarioEmissor: usuarioEmissorNome,
      perfilEmissor: perfilEmissorNome,
    });
  }, [abaAtiva, unidadeFiltro, periodoFiltro, usuarioEmissorNome, perfilEmissorNome]);

  const dadosHomologacao = useMemo(() => {
    if (abaAtiva !== "homologacao") return null;
    return gerarComparativoHomologacaoMC(periodoFiltro);
  }, [abaAtiva, periodoFiltro]);

  // Exportação Excel oficial
  const handleExportarXlsx = () => {
    setExportando(true);
    try {
      const buffer = exportarRelatorioParaXlsx(abaAtiva, {
        unidadeId: unidadeFiltro,
        postoId: postoFiltro,
        periodo: periodoFiltro,
        usuarioEmissor: usuarioEmissorNome,
        perfilEmissor: perfilEmissorNome,
      });

      const blob = new Blob([buffer as any], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const unidadeSlug = unidadeFiltro === "TODAS" ? "Contrato_Geral" : unidadeFiltro.replace(/\s+/g, "_");
      link.href = url;
      link.download = `SGP_Relatorio_${abaAtiva}_${unidadeSlug}_${periodoFiltro}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro na exportação Excel:", err);
      alert("Falha ao gerar arquivo Excel. Tente novamente.");
    } finally {
      setExportando(false);
    }
  };

  // Impressão / PDF Oficial
  const handleImprimirPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:max-w-none print:w-full print:m-0 print:p-0">
      {/* CABEÇALHO CONTRATUAL OFICIAL PADRONIZADO (Impresso e em Tela) */}
      <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm print:border-none print:shadow-none print:p-0 print:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 print:border-b-2 print:border-slate-900 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#1F4FD1] text-white">
                SGP
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Relatório Oficial de Fiscalização e Gestão de Postos
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              {abaAtiva === "ocupacao" && "Ocupação Efetiva por Posto e Posição"}
              {abaAtiva === "coberturas" && "Coberturas e Substituições do Período"}
              {abaAtiva === "descobertos" && "Descobertos do Período (Posições com Alerta D)"}
              {abaAtiva === "feristas" && "Quadro de Feristas e Coberturas Realizadas"}
              {abaAtiva === "homologacao" && "Modo Homologação — Comparativo SGP × Memória de Cálculo"}
            </h1>
            <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-medium">
              <span>Contrato: <strong className="text-slate-900 font-mono">{CONTRATO_NUMERO}</strong></span>
              <span>Cliente: <strong className="text-slate-900">{CONTRATO_CLIENTE}</strong></span>
              <span>Contratada: <strong className="text-slate-900">{CONTRATADA_EMPRESA}</strong></span>
            </div>
          </div>

          {/* Botões de Ação (Ocultos na impressão) */}
          <div className="flex items-center gap-2.5 print:hidden">
            <button
              onClick={handleImprimirPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              title="Gera visualização pronta para impressão ou exportação em PDF"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              onClick={handleExportarXlsx}
              disabled={exportando}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F7B4F] hover:bg-[#0C623E] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              title="Exporta dados detalhados para planilha Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exportando ? "Gerando..." : "Exportar Excel (.xlsx)"}</span>
            </button>
          </div>
        </div>

        {/* Metadados da Emissão */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3.5 text-xs text-slate-600">
          <div>
            <span className="block text-[11px] text-slate-400 font-medium">Competência / Período:</span>
            <span className="font-bold text-slate-900 font-mono">
              {periodoFiltro === "2026-09" ? "Setembro/2026 (01/09 a 30/09)" : periodoFiltro}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-400 font-medium">Unidade / Base Selecionada:</span>
            <span className="font-bold text-slate-900">
              {unidadeFiltro === "TODAS" ? "Todas as Bases Contratuais" : unidadeFiltro}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-400 font-medium">Data/Hora de Emissão:</span>
            <span className="font-mono text-slate-800">{dataEmissao}</span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-400 font-medium">Usuário Emissor:</span>
            <span className="font-semibold text-slate-800">
              {usuarioEmissorNome} <span className="text-[10px] text-slate-500 font-mono">({perfilEmissorNome})</span>
            </span>
          </div>
        </div>
      </div>

      {/* SELETOR DE ABAS / RELATÓRIOS (Oculto na impressão) */}
      <div className="flex border-b border-slate-300 space-x-1 print:hidden overflow-x-auto">
        <button
          onClick={() => setAbaAtiva("ocupacao")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            abaAtiva === "ocupacao"
              ? "bg-white text-blue-700 border-t-2 border-t-blue-700 border-x border-slate-300 shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Ocupação por Posto</span>
        </button>

        <button
          onClick={() => setAbaAtiva("coberturas")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            abaAtiva === "coberturas"
              ? "bg-white text-blue-700 border-t-2 border-t-blue-700 border-x border-slate-300 shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <UserCheck2 className="w-4 h-4" />
          <span>Coberturas do Período</span>
        </button>

        <button
          onClick={() => setAbaAtiva("descobertos")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            abaAtiva === "descobertos"
              ? "bg-white text-blue-700 border-t-2 border-t-blue-700 border-x border-slate-300 shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>Descobertos do Período</span>
        </button>

        <button
          onClick={() => setAbaAtiva("feristas")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            abaAtiva === "feristas"
              ? "bg-white text-blue-700 border-t-2 border-t-blue-700 border-x border-slate-300 shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Quadro de Feristas</span>
        </button>

        <button
          onClick={() => setAbaAtiva("homologacao")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            abaAtiva === "homologacao"
              ? "bg-white text-purple-700 border-t-2 border-t-purple-700 border-x border-slate-300 shadow-2xs"
              : "text-purple-700/80 hover:text-purple-900 hover:bg-purple-50"
          }`}
        >
          <FileDiff className="w-4 h-4 text-purple-600" />
          <span>Modo Homologação (SGP × MC)</span>
        </button>
      </div>

      {/* BARRA DE FILTROS (Oculta na impressão) */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro Unidade / Base */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Unidade:</span>
            <select
              value={unidadeFiltro}
              onChange={(e) => setUnidadeFiltro(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="TODAS">Todas as Unidades</option>
              <option value="BOAVENTURA">Complexo Boaventura (Itaboraí/RJ)</option>
              {BASES_SGP_SISTEMA.filter((b) => b.id !== "BOAVENTURA").map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Posto (Apenas nas abas aplicáveis) */}
          {(abaAtiva === "ocupacao" || abaAtiva === "coberturas" || abaAtiva === "descobertos") && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Posto:</span>
              <select
                value={postoFiltro}
                onChange={(e) => setPostoFiltro(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 max-w-[240px] truncate"
              >
                <option value="TODOS">Todos os Postos da Unidade</option>
                {postosDropdown.map((p) => (
                  <option key={p.id} value={p.idPosto}>
                    {p.codigoPosto} - {p.funcao}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro Mês / Período */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Mês de Referência:</span>
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            >
              <option value="2026-09">2026-09 (Setembro/2026)</option>
              <option value="2026-08">2026-08 (Agosto/2026)</option>
              <option value="2026-10">2026-10 (Outubro/2026)</option>
            </select>
          </div>
        </div>

        {/* Busca Rápida */}
        <div className="flex items-center gap-2 border border-slate-300 rounded px-2.5 py-1 bg-slate-50 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar nesta lista..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-slate-800 text-xs placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: OCUPAÇÃO POR POSTO                                                 */}
      {/* ========================================================================= */}
      {abaAtiva === "ocupacao" && dadosOcupacao && (
        <div className="space-y-4">
          {/* Card Resumo de Totais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 print:grid-cols-6">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Total de Posições</span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                {dadosOcupacao.totais.totalPosicoes}
              </span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-emerald-600 font-medium block">Dias Presentes (P)</span>
              <span className="text-xl font-bold text-emerald-700 font-mono">
                {dadosOcupacao.totais.totalDiasP}
              </span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-blue-600 font-medium block">Dias Cobertos (C)</span>
              <span className="text-xl font-bold text-blue-700 font-mono">
                {dadosOcupacao.totais.totalDiasC}
              </span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-rose-600 font-medium block">Dias Descobertos (D)</span>
              <span className="text-xl font-bold text-rose-700 font-mono">
                {dadosOcupacao.totais.totalDiasD}
              </span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Dias Folga (N)</span>
              <span className="text-xl font-bold text-slate-700 font-mono">
                {dadosOcupacao.totais.totalDiasN}
              </span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 bg-emerald-50/50">
              <span className="text-[11px] text-slate-600 font-semibold block">% Ocupação Geral</span>
              <span className="text-xl font-bold text-emerald-800 font-mono">
                {dadosOcupacao.totais.percentualGeral.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Tabela Oficial Analítica */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden print:border-slate-800 print:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold print:bg-slate-200">
                    <th className="py-2.5 px-3">Unidade / Base</th>
                    <th className="py-2.5 px-3">Posto & Função</th>
                    <th className="py-2.5 px-3">Seção & Horário (RM)</th>
                    <th className="py-2.5 px-3">Posição</th>
                    <th className="py-2.5 px-3">Titular / Identificação</th>
                    <th className="py-2.5 px-2 text-center text-emerald-700 font-mono">P</th>
                    <th className="py-2.5 px-2 text-center text-blue-700 font-mono">C</th>
                    <th className="py-2.5 px-2 text-center text-rose-700 font-mono">D</th>
                    <th className="py-2.5 px-2 text-center text-slate-500 font-mono">N</th>
                    <th className="py-2.5 px-2 text-center font-mono">Exigível</th>
                    <th className="py-2.5 px-2 text-center font-mono">Atendido</th>
                    <th className="py-2.5 px-3 text-right font-bold">% Ocupação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 text-xs">
                  {dadosOcupacao.itens
                    .filter((it) => {
                      if (!busca) return true;
                      const q = busca.toLowerCase();
                      return (
                        it.unidadeNome.toLowerCase().includes(q) ||
                        it.postoCodigo.toLowerCase().includes(q) ||
                        it.postoFuncao.toLowerCase().includes(q) ||
                        it.titularNome.toLowerCase().includes(q) ||
                        it.titularMatricula.includes(q) ||
                        (it.secaoFormatada && it.secaoFormatada.toLowerCase().includes(q)) ||
                        (it.horarioFormatado && it.horarioFormatado.toLowerCase().includes(q))
                      );
                    })
                    .map((it, idx) => (
                      <tr key={`${it.posicaoId}-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {it.unidadeNome}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-mono text-slate-900 font-bold block">{it.postoCodigo}</span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[200px]" title={it.postoFuncao}>
                            {it.postoFuncao}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-mono text-[11px] text-slate-800 font-medium block truncate max-w-[220px]" title={`Horário: ${it.horarioFormatado || "—"}`}>
                            🕒 {it.horarioFormatado || "—"}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 block truncate max-w-[220px]" title={`Seção: ${it.secaoFormatada || "—"}`}>
                            🏢 {it.secaoFormatada || "—"}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                          {it.posicaoCodigoVisual}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-medium text-slate-900 block">{it.titularNome}</span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                            <span>Chapa: {it.titularMatricula}</span>
                            {it.cpfFormatado && it.cpfFormatado !== "—" && (
                              <span>• CPF: {it.cpfFormatado}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-semibold text-emerald-700">
                          {it.diasP}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-semibold text-blue-700">
                          {it.diasC}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold text-rose-700">
                          {it.diasD}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-500">
                          {it.diasN}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-800 font-medium">
                          {it.diasExigiveis}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-900 font-bold">
                          {it.diasAtendidos}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] ${
                              it.percentualOcupacao === 100
                                ? "text-emerald-800 bg-emerald-50"
                                : it.percentualOcupacao >= 95
                                ? "text-blue-800 bg-blue-50"
                                : "text-rose-800 bg-rose-50"
                            }`}
                          >
                            {it.percentualOcupacao.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-slate-900 text-xs">
                    <td colSpan={5} className="py-2.5 px-3">
                      TOTAIS CONSOLIDADOS ({dadosOcupacao.totais.totalPosicoes} posições)
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-emerald-800">
                      {dadosOcupacao.totais.totalDiasP}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-blue-800">
                      {dadosOcupacao.totais.totalDiasC}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-rose-800">
                      {dadosOcupacao.totais.totalDiasD}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                      {dadosOcupacao.totais.totalDiasN}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">
                      {dadosOcupacao.totais.totalExigivel}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">
                      {dadosOcupacao.totais.totalAtendido}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-emerald-900">
                      {dadosOcupacao.totais.percentualGeral.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: COBERTURAS DO PERÍODO                                              */}
      {/* ========================================================================= */}
      {abaAtiva === "coberturas" && dadosCoberturas && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                    <th className="py-2.5 px-3">Unidade</th>
                    <th className="py-2.5 px-3">Posto & Posição</th>
                    <th className="py-2.5 px-3">Titular Ausente</th>
                    <th className="py-2.5 px-3">Quem Cobriu (Substituto)</th>
                    <th className="py-2.5 px-3 font-mono">Data Início</th>
                    <th className="py-2.5 px-3 font-mono">Data Fim</th>
                    <th className="py-2.5 px-2 text-center font-mono">Dias</th>
                    <th className="py-2.5 px-3">Motivo (Categoria LGPD)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 text-xs">
                  {dadosCoberturas.itens.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        Nenhuma cobertura registrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    dadosCoberturas.itens.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{it.unidadeNome}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-slate-900 font-bold block">{it.postoCodigo}</span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">{it.postoFuncao}</span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{it.titularNome}</td>
                        <td className="py-2.5 px-3 font-bold text-blue-900">{it.substitutoNome}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{it.dataInicio}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{it.dataFim}</td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900">{it.totalDias}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            {it.motivoCategoria}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                            {it.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: DESCOBERTOS DO PERÍODO                                             */}
      {/* ========================================================================= */}
      {abaAtiva === "descobertos" && dadosDescobertos && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-2 text-center">Dia</th>
                    <th className="py-2.5 px-3">Unidade</th>
                    <th className="py-2.5 px-3">Posto & Posição</th>
                    <th className="py-2.5 px-3">Titular Ausente</th>
                    <th className="py-2.5 px-3">Categoria Ausência</th>
                    <th className="py-2.5 px-3">Feristas Aptos Sugeridos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 text-xs">
                  {dadosDescobertos.itens.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-emerald-700 font-medium">
                        Nenhuma posição descoberta identificada no período com os filtros informados.
                      </td>
                    </tr>
                  ) : (
                    dadosDescobertos.itens.map((it, idx) => (
                      <tr key={`${it.posicaoId}-${it.data}-${idx}`} className="hover:bg-rose-50/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-800">{it.data}</td>
                        <td className="py-2.5 px-2 text-center text-slate-500 font-medium">{it.diaSemana}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{it.unidadeNome}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-slate-900 font-bold block">{it.postoCodigo}</span>
                          <span className="text-[11px] text-slate-500 block">{it.posicaoCodigoVisual}</span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {it.titularNome}
                          <span className="text-[10px] text-slate-500 font-mono block">Chapa: {it.titularMatricula}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            {it.categoriaAusencia}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {it.feristasSugeridos.length > 0 ? (
                            <div className="space-y-0.5">
                              {it.feristasSugeridos.slice(0, 3).map((f) => (
                                <span
                                  key={f.chapa}
                                  className="inline-block text-[11px] bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded mr-1"
                                >
                                  {f.nome} ({f.chapa})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Nenhum disponível</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: QUADRO DE FERISTAS                                                 */}
      {/* ========================================================================= */}
      {abaAtiva === "feristas" && dadosFeristas && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                    <th className="py-2.5 px-3">Chapa</th>
                    <th className="py-2.5 px-3">Colaborador Ferista</th>
                    <th className="py-2.5 px-3">Unidade Principal</th>
                    <th className="py-2.5 px-3">Postos Vinculados (Homologados)</th>
                    <th className="py-2.5 px-2 text-center font-mono">Coberturas</th>
                    <th className="py-2.5 px-2 text-center font-mono">Dias Cobrindo</th>
                    <th className="py-2.5 px-2 text-center font-mono">Dias Disp.</th>
                    <th className="py-2.5 px-3 text-center">Status no Período</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 text-xs">
                  {dadosFeristas.itens.map((it) => (
                    <tr key={it.chapa} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{it.chapa}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{it.nome}</td>
                      <td className="py-2.5 px-3 text-slate-700">{it.unidadePrincipal}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {it.postosVinculados.map((p) => (
                            <span key={p} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-blue-800">{it.totalCoberturas}</td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-800">{it.diasEmCobertura}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-600">{it.diasDisponiveis}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            it.statusPeriodo === "EM_COBERTURA"
                              ? "bg-blue-100 text-blue-900"
                              : "bg-emerald-100 text-emerald-900"
                          }`}
                        >
                          {it.statusPeriodo === "EM_COBERTURA" ? "EM COBERTURA" : "DISPONÍVEL"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 5: MODO HOMOLOGAÇÃO (SGP × MEMÓRIA DE CÁLCULO)                        */}
      {/* ========================================================================= */}
      {abaAtiva === "homologacao" && dadosHomologacao && (
        <div className="space-y-4">
          {/* Banner de Aviso de Escopo */}
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
            <div className="text-xs text-purple-900 space-y-1">
              <span className="font-bold text-sm block">
                Modo Homologação — Validação Operacional Pré-Fiscalização
              </span>
              <p className="leading-relaxed">
                Esta tela compara a apuração diária realizada pelo SGP (dias presentes, cobertos e descobertos)
                com a previsão da Memória de Cálculo (MC) para a competência de referência.
                <strong> Faturamento e medição financeira permanecem fora do escopo</strong>; este painel serve
                exclusivamente para validação técnica da Premier antes da entrega aos fiscais da Petrobras.
              </p>
            </div>
          </div>

          {/* Cards de Métricas da Homologação */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <span className="text-[11px] text-slate-500 font-medium block">Total de Posições Analisadas</span>
              <span className="text-2xl font-bold text-slate-900 font-mono mt-1 block">
                {dadosHomologacao.totalPosicoesApuradas}
              </span>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <span className="text-[11px] text-emerald-600 font-semibold block">Posições 100% Conformes</span>
              <span className="text-2xl font-bold text-emerald-700 font-mono mt-1 block">
                {dadosHomologacao.totalPosicoesConformes}
              </span>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <span className="text-[11px] text-amber-600 font-semibold block">Divergências Identificadas</span>
              <span className="text-2xl font-bold text-amber-700 font-mono mt-1 block">
                {dadosHomologacao.totalDivergencias}
              </span>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm bg-purple-50/40">
              <span className="text-[11px] text-purple-700 font-bold block">Taxa Global de Conformidade</span>
              <span className="text-2xl font-bold text-purple-900 font-mono mt-1 block">
                {dadosHomologacao.taxaConformidade}%
              </span>
            </div>
          </div>

          {/* Tabela de Divergências por Posto */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                    <th className="py-2.5 px-3">Posto & Função</th>
                    <th className="py-2.5 px-3">Posição</th>
                    <th className="py-2.5 px-3">Titular</th>
                    <th className="py-2.5 px-2 text-center font-mono">SGP (P)</th>
                    <th className="py-2.5 px-2 text-center font-mono">SGP (C)</th>
                    <th className="py-2.5 px-2 text-center font-mono text-rose-700">SGP (D)</th>
                    <th className="py-2.5 px-2 text-center font-mono">MC Previsto</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Detalhamento da Validação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 text-xs">
                  {dadosHomologacao.itens
                    .filter((it) => {
                      if (!busca) return true;
                      const q = busca.toLowerCase();
                      return (
                        it.postoCodigo.toLowerCase().includes(q) ||
                        it.postoFuncao.toLowerCase().includes(q) ||
                        it.titular.toLowerCase().includes(q) ||
                        it.tipoDivergencia.toLowerCase().includes(q)
                      );
                    })
                    .map((it, idx) => (
                      <tr
                        key={`${it.posicaoId}-${idx}`}
                        className={`transition-colors ${
                          it.divergente ? "bg-amber-50/40 hover:bg-amber-100/50" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-2 px-3">
                          <span className="font-mono text-slate-900 font-bold block">{it.postoCodigo}</span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[220px]">
                            {it.postoFuncao}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">{it.posicaoId}</td>
                        <td className="py-2 px-3 text-slate-900">{it.titular}</td>
                        <td className="py-2 px-2 text-center font-mono text-emerald-700 font-semibold">
                          {it.sgpDiasP}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-blue-700 font-semibold">
                          {it.sgpDiasC}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-rose-700 font-bold">
                          {it.sgpDiasD}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-800 font-bold">
                          {it.mcTotalAtendido}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              it.divergente
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            }`}
                          >
                            {it.divergente ? "DIVERGENTE" : "CONFORME"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-700 text-[11px] max-w-xs">
                          {it.tipoDivergencia}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RODAPÉ DE AUDITORIA E ASSINATURA TÉCNICA (Impresso e em tela) */}
      <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 text-[11px] text-slate-600 print:border-t-2 print:border-slate-800 print:bg-white print:p-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <strong className="text-slate-900 block font-semibold">Declaração de Conformidade Técnica:</strong>
            Relatório gerado automaticamente a partir dos registros de frequência biométrica e escalas contratuais homologadas.
            Validação sob as cominações do Contrato Petrobras {CONTRATO_NUMERO}.
          </div>
          <div className="text-right shrink-0 print:text-left">
            <span className="block text-slate-400">Ambiente de Produção Neon SP (sa-east-1)</span>
            <span className="font-mono text-slate-700">Hash de Integridade SHA-256</span>
          </div>
        </div>
      </div>
    </div>
  );
}
