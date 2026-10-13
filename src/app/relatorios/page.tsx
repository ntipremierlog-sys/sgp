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
  Tag,
  Layers,
  Sparkles,
  X,
  ChevronDown,
  Check,
  Award,
  Clock,
  Layers2,
} from "lucide-react";
import { BASES_SGP_SISTEMA } from "@/lib/dados/secoes-horarios";
import { CATALOGO_ITEM_PPU } from "@/lib/dados/painel-calculo";
import {
  gerarRelatorioOcupacaoPorPosto,
  gerarRelatorioCoberturas,
  gerarRelatorioDescobertos,
  gerarRelatorioQuadroFeristas,
  exportarRelatorioParaXlsx,
  CONTRATO_NUMERO,
  CONTRATO_CLIENTE,
  CONTRATADA_EMPRESA,
  RelatorioOcupacaoResultado,
  ItemOcupacaoPosicaoRelatorio,
  ItemCoberturaRelatorio,
  ItemDescobertoRelatorio,
  ItemQuadroFeristaRelatorio,
} from "@/lib/servicos/relatorios-oficiais";
import { carregarEstado, obterTodosPostosContrato, obterItemPpuDoPosto, PostoOperacional } from "@/lib/dados/estado-operacional";
import { usePermissoes } from "@/lib/auth/use-permissoes";

type AbaRelatorio = "ocupacao" | "coberturas" | "descobertos" | "feristas";

function formatarDataBr(dataIso?: string): string {
  if (!dataIso) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataIso)) return dataIso;
  const partes = dataIso.split("-");
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
  }
  return dataIso;
}

function formatarCompetenciaCurta(comp: string): string {
  const [ano, mes] = comp.split("-").map(Number);
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const nomeMes = meses[(mes || 9) - 1] || "Setembro";
  return `${nomeMes}/${ano || 2026}`;
}

export default function RelatoriosOficiaisPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaRelatorio>("ocupacao");
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>("TODAS");
  const [postoFiltro, setPostoFiltro] = useState<string>("TODOS");
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("2026-09");
  const [filtroItemPpu, setFiltroItemPpu] = useState<string>("TODOS");
  const [busca, setBusca] = useState<string>("");
  const [dataEmissao, setDataEmissao] = useState<string>("");
  const [sessao, setSessao] = useState<any>(null);
  const [exportando, setExportando] = useState<boolean>(false);
  const { pode } = usePermissoes();
  const podeExportar = pode("EXPORTAR", "RELATORIOS");

  // Carrega postos disponíveis para o dropdown
  const [postosDisponiveis, setPostosDisponiveis] = useState<PostoOperacional[]>([]);

  // Paginação no servidor (25 registros por página) e drawer de detalhes da Ocupação
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [totalPaginas, setTotalPaginas] = useState<number>(1);
  const [totalRegistros, setTotalRegistros] = useState<number>(0);
  const [itensOcupacaoPaginados, setItensOcupacaoPaginados] = useState<ItemOcupacaoPosicaoRelatorio[]>([]);
  const [carregandoOcupacao, setCarregandoOcupacao] = useState<boolean>(false);
  const [postoDetalhe, setPostoDetalhe] = useState<ItemOcupacaoPosicaoRelatorio | null>(null);

  useEffect(() => {
    setDataEmissao(new Date().toLocaleString("pt-BR"));
    const estado = carregarEstado();
    setPostosDisponiveis(obterTodosPostosContrato(estado.postos));

    // Permite abrir uma aba específica via ?aba= (links vindos de /relatorios/coberturas)
    const abaUrl = new URLSearchParams(window.location.search).get("aba");
    if (abaUrl === "ocupacao" || abaUrl === "descobertos" || abaUrl === "feristas") {
      setAbaAtiva(abaUrl);
    }

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

  // Reset de página ao alterar qualquer filtro
  useEffect(() => {
    setPaginaAtual(1);
  }, [unidadeFiltro, postoFiltro, periodoFiltro, busca]);

  const aplicarPaginacaoLocal = useCallback(() => {
    if (!dadosOcupacao) return;
    let itens = dadosOcupacao.itens;
    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      itens = itens.filter(
        (it) =>
          it.unidadeNome.toLowerCase().includes(q) ||
          it.postoCodigo.toLowerCase().includes(q) ||
          it.postoFuncao.toLowerCase().includes(q) ||
          it.titularNome.toLowerCase().includes(q) ||
          it.titularMatricula.includes(q)
      );
    }
    const total = itens.length;
    const paginas = Math.max(1, Math.ceil(total / 25));
    const pagSegura = Math.min(paginaAtual, paginas);
    const paginadas = itens.slice((pagSegura - 1) * 25, pagSegura * 25);
    setItensOcupacaoPaginados(paginadas);
    setTotalPaginas(paginas);
    setTotalRegistros(total);
  }, [dadosOcupacao, busca, paginaAtual]);

  // Carregamento paginado no servidor (25 por página)
  const carregarOcupacaoServidor = useCallback(async () => {
    if (abaAtiva !== "ocupacao") return;
    setCarregandoOcupacao(true);
    try {
      const params = new URLSearchParams({
        imovel: unidadeFiltro,
        posto: postoFiltro,
        periodo: periodoFiltro,
        busca,
        page: String(paginaAtual),
        limite: "25",
      });
      const res = await fetch(`/api/relatorios/ocupacao?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.sucesso) {
          setItensOcupacaoPaginados(data.itens || []);
          setTotalPaginas(data.totalPaginas || 1);
          setTotalRegistros(data.totalRegistros || 0);
          return;
        }
      }
      aplicarPaginacaoLocal();
    } catch {
      aplicarPaginacaoLocal();
    } finally {
      setCarregandoOcupacao(false);
    }
  }, [abaAtiva, unidadeFiltro, postoFiltro, periodoFiltro, busca, paginaAtual, aplicarPaginacaoLocal]);

  useEffect(() => {
    if (abaAtiva === "ocupacao") {
      carregarOcupacaoServidor();
    }
  }, [carregarOcupacaoServidor, abaAtiva]);

  // Coberturas do posto selecionado no mês (para o painel lateral de detalhes)
  const coberturasDoPostoNoMes = useMemo(() => {
    if (!postoDetalhe) return [];
    const estado = carregarEstado();
    return (estado.coberturas || []).filter((c) => {
      const matchPosto =
        c.postoCodigo === postoDetalhe.postoCodigo ||
        c.idPosto === postoDetalhe.postoId ||
        c.idPosto === postoDetalhe.postoCodigo;
      const dentroDoMes =
        c.dataInicio?.startsWith(periodoFiltro) ||
        c.dataFim?.startsWith(periodoFiltro);
      return matchPosto && dentroDoMes;
    });
  }, [postoDetalhe, periodoFiltro]);

  const dadosCoberturas = useMemo(() => {
    if (abaAtiva !== "coberturas") return null;
    return gerarRelatorioCoberturas({
      unidadeId: unidadeFiltro,
      postoId: postoFiltro,
      periodo: periodoFiltro,
      usuarioEmissor: usuarioEmissorNome,
      perfilEmissor: perfilEmissorNome,
      itemPpu: filtroItemPpu,
    });
  }, [abaAtiva, unidadeFiltro, postoFiltro, periodoFiltro, usuarioEmissorNome, perfilEmissorNome, filtroItemPpu]);

  // Coberturas filtradas em tempo real por busca textual
  const itensCoberturaFiltrados = useMemo(() => {
    if (!dadosCoberturas) return [];
    if (!busca.trim()) return dadosCoberturas.itens;
    const b = busca.toLowerCase().trim();
    return dadosCoberturas.itens.filter((it) =>
      it.titularNome.toLowerCase().includes(b) ||
      it.substitutoNome.toLowerCase().includes(b) ||
      it.titularMatricula.toLowerCase().includes(b) ||
      it.substitutoMatricula.toLowerCase().includes(b) ||
      it.postoCodigo.toLowerCase().includes(b) ||
      it.itemPpu.toLowerCase().includes(b) ||
      it.itemPpuDescricao.toLowerCase().includes(b) ||
      it.unidadeNome.toLowerCase().includes(b) ||
      it.postoFuncao.toLowerCase().includes(b) ||
      it.motivoCategoria.toLowerCase().includes(b)
    );
  }, [dadosCoberturas, busca]);

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
        itemPpu: filtroItemPpu,
      });

      const blob = new Blob([buffer as any], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const unidadeSlug = unidadeFiltro === "TODAS" ? "Contrato_Geral" : unidadeFiltro.replace(/\s+/g, "_");
      const ppuSlug = abaAtiva === "coberturas" && filtroItemPpu !== "TODOS" ? `_PPU_${filtroItemPpu.replace(/\./g, "_")}` : "";
      link.href = url;
      link.download = `SGP_Relatorio_${abaAtiva}_${unidadeSlug}${ppuSlug}_${periodoFiltro}.xlsx`;
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
    <div className="space-y-5 max-w-7xl mx-auto print:max-w-none print:w-full print:m-0 print:p-0">
      {/* CABEÇALHO CONTRATUAL OFICIAL (Exclusivo para Impressão / PDF exportado) */}
      <div className="hidden print:block print:mb-5 border-b-2 border-slate-900 pb-4">
        {/* Topo: Logo Premier à esquerda + Título e Identificação Contratual */}
        <div className="flex items-center justify-between gap-6 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/marca/premier-logistics.png"
              alt="Premier Logistics"
              className="h-12 w-auto object-contain shrink-0"
            />
            <div className="h-10 w-px bg-slate-300" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1F4FD1] text-white tracking-wider">
                  SGP
                </span>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Sistema de Gestão de Postos
                </span>
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {abaAtiva === "ocupacao" && "Relatório de Ocupação por Posto"}
                {abaAtiva === "coberturas" && "Relatório de Coberturas e Substituições"}
                {abaAtiva === "descobertos" && "Relatório de Descobertos do Período"}
                {abaAtiva === "feristas" && "Relatório de Quadro de Feristas"}
              </h1>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-700 border border-slate-300 mb-1">
              Documento Oficial
            </span>
            <div className="text-xs font-semibold text-slate-800">
              Contrato Petrobras {CONTRATO_NUMERO}
            </div>
            <div className="text-[11px] text-slate-500">
              {CONTRATO_CLIENTE} • {CONTRATADA_EMPRESA}
            </div>
          </div>
        </div>

        {/* Metadados da Emissão em Grid de 4 Cards Elegantes */}
        <div className="grid grid-cols-4 gap-3 pt-3 text-xs">
          <div className="bg-slate-50 p-2 rounded border border-slate-200">
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Competência / Período</span>
            <span className="font-bold text-slate-900 font-mono text-xs">
              {periodoFiltro === "2026-09" ? "Setembro/2026 (01/09 a 30/09)" : periodoFiltro}
            </span>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Imóvel / Base</span>
            <span className="font-bold text-slate-900 text-xs truncate block">
              {unidadeFiltro === "TODAS" ? "Todos os Imóveis Contratuais" : unidadeFiltro}
            </span>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Data/Hora Emissão</span>
            <span className="font-mono text-slate-800 text-xs">{dataEmissao}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Usuário Emissor</span>
            <span className="font-semibold text-slate-900 text-xs truncate block">
              {usuarioEmissorNome} <span className="text-[10px] text-slate-500 font-normal">({perfilEmissorNome})</span>
            </span>
          </div>
        </div>
      </div>

      {/* 1. CABEÇALHO EM TELA (Limpo, sem caixa/card, sem sombra) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Ocupação por Posto
          </h1>
          <span className="text-sm font-medium text-slate-500">
            {formatarCompetenciaCurta(periodoFiltro)}
          </span>
        </div>

        {/* Botões PDF e Excel: pequenos, discretos, mesmo estilo */}
        {podeExportar && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleImprimirPdf}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition-colors cursor-pointer"
              title="Gera visualização pronta para impressão ou exportação em PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>PDF</span>
            </button>

            <button
              onClick={handleExportarXlsx}
              disabled={exportando}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Exporta dados detalhados para planilha Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>{exportando ? "Gerando..." : "Excel"}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. ABAS (Texto simples, sem ícones, sem cores diferentes, ativa indicada apenas por sublinhado) */}
      <div className="flex border-b border-slate-200 gap-6 print:hidden overflow-x-auto">
        <button
          onClick={() => setAbaAtiva("ocupacao")}
          className={`pb-2.5 text-xs transition-colors cursor-pointer whitespace-nowrap ${
            abaAtiva === "ocupacao"
              ? "text-slate-900 font-semibold border-b-2 border-slate-900 -mb-px"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Ocupação por Posto
        </button>

        <Link
          href="/relatorios/coberturas"
          className="pb-2.5 text-xs transition-colors cursor-pointer whitespace-nowrap text-slate-500 hover:text-slate-800"
        >
          Coberturas
        </Link>

        <button
          onClick={() => setAbaAtiva("descobertos")}
          className={`pb-2.5 text-xs transition-colors cursor-pointer whitespace-nowrap ${
            abaAtiva === "descobertos"
              ? "text-slate-900 font-semibold border-b-2 border-slate-900 -mb-px"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Descobertos do Período
        </button>

        <button
          onClick={() => setAbaAtiva("feristas")}
          className={`pb-2.5 text-xs transition-colors cursor-pointer whitespace-nowrap ${
            abaAtiva === "feristas"
              ? "text-slate-900 font-semibold border-b-2 border-slate-900 -mb-px"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Quadro de Feristas
        </button>

        
      </div>

      {/* 3. FILTROS (Uma única linha, sem caixa em volta: Mês, Imóvel, Posto e busca) */}
      <div className="flex flex-wrap items-center gap-3 text-xs print:hidden">
        {/* Mês */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-semibold text-slate-600">Mês:</span>
          <select
            value={periodoFiltro}
            onChange={(e) => setPeriodoFiltro(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none focus:ring-1 focus:ring-slate-400 font-mono"
          >
            <option value="2026-09">Setembro/2026</option>
            <option value="2026-08">Agosto/2026</option>
            <option value="2026-10">Outubro/2026</option>
          </select>
        </div>

        {/* Imóvel */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-semibold text-slate-600">Imóvel:</span>
          <select
            value={unidadeFiltro}
            onChange={(e) => setUnidadeFiltro(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="TODAS">Todos os Imóveis</option>
              <option value="BOAVENTURA">Complexo Boaventura (Itaboraí/RJ)</option>
              {BASES_SGP_SISTEMA.filter((b) => b.id !== "BOAVENTURA").map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
        </div>

        {/* Posto */}
        {(abaAtiva === "ocupacao" || abaAtiva === "coberturas" || abaAtiva === "descobertos") && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-semibold text-slate-600">Posto:</span>
            <select
              value={postoFiltro}
              onChange={(e) => setPostoFiltro(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none focus:ring-1 focus:ring-slate-400 max-w-[240px] truncate"
            >
              <option value="TODOS">Todos os Postos</option>
              {postosDropdown.map((p) => (
                <option key={p.id} value={p.idPosto}>
                  {p.codigoPosto} - {p.funcao}
                </option>
              ))}
            </select>
          </div>
        )}

          {/* Busca */}
        <div className="flex items-center gap-2 border border-slate-300 rounded px-2.5 py-1 bg-white min-w-[220px] max-w-sm flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Buscar titular, substituto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-slate-800 text-xs placeholder:text-slate-400"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Limpar filtros */}
        {(unidadeFiltro !== "TODAS" || postoFiltro !== "TODOS" || busca !== "") && (
          <button
            onClick={() => {
              setUnidadeFiltro("TODAS");
              setPostoFiltro("TODOS");
              setBusca("");
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer shrink-0"
            title="Restaurar todos os filtros para o padrão"
          >
            Limpar
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: OCUPAÇÃO POR POSTO                                                 */}
      {/* ========================================================================= */}
      {abaAtiva === "ocupacao" && dadosOcupacao && (
        <div className="space-y-4">
          {/* Cards de Indicadores (4 cards: % Ocupação | Dias descobertos | Dias cobertos | Posições) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">% Ocupação</span>
              <span className="text-xl font-bold text-slate-900">
                {dadosOcupacao.totais.percentualGeral.toFixed(1)}%
              </span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Dias descobertos</span>
              <span className={`text-xl font-bold ${dadosOcupacao.totais.totalDiasD > 0 ? "text-rose-600" : "text-slate-900"}`}>
                {dadosOcupacao.totais.totalDiasD}
              </span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Dias cobertos</span>
              <span className="text-xl font-bold text-slate-900">
                {dadosOcupacao.totais.totalDiasC}
              </span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Posições</span>
              <span className="text-xl font-bold text-slate-900">
                {dadosOcupacao.totais.totalPosicoes}
              </span>
            </div>
          </div>

          {/* Tabela Oficial de Ocupação por Posto */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-white">
                    <th className="py-2.5 px-3 text-left">Imóvel</th>
                    <th className="py-2.5 px-3 text-left">Posto</th>
                    <th className="py-2.5 px-3 text-left">Titular</th>
                    <th className="py-2.5 px-3 text-right">Exigível</th>
                    <th className="py-2.5 px-3 text-right">Atendido</th>
                    <th className="py-2.5 px-3 text-right">Descoberto</th>
                    <th className="py-2.5 px-3 text-right">% Ocupação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {itensOcupacaoPaginados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {carregandoOcupacao ? "Carregando registros..." : "Nenhum posto encontrado para os filtros selecionados."}
                      </td>
                    </tr>
                  ) : (
                    itensOcupacaoPaginados.map((it, idx) => (
                      <tr
                        key={`${it.posicaoId}-${idx}`}
                        onClick={() => setPostoDetalhe(it)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer bg-white"
                        title={`Clique para ver detalhes do posto
Presentes (P): ${it.diasP} | Cobertos (C): ${it.diasC} | Descobertos (D): ${it.diasD} | Folgas (N): ${it.diasN}`}
                      >
                        <td className="py-2.5 px-3 text-slate-900 whitespace-nowrap">
                          {it.unidadeNome}
                        </td>
                        <td className="py-2.5 px-3 text-slate-900 whitespace-nowrap">
                          <span
                            title={`Função: ${it.postoFuncao || "—"}
Posição: ${it.posicaoCodigoVisual || "—"}
Horário: ${it.horarioFormatado || "—"}
Seção: ${it.secaoFormatada || "—"}`}
                          >
                            {it.postoCodigo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-900 whitespace-nowrap">
                          <span title={`Chapa: ${it.titularMatricula || "—"}`}>
                            {it.titularNome}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-800 whitespace-nowrap">
                          {it.diasExigiveis}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-800 whitespace-nowrap">
                          {it.diasAtendidos}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {it.diasD > 0 ? (
                            <span className="text-rose-600 font-semibold">{it.diasD}</span>
                          ) : (
                            <span className="text-slate-400">–</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span className={it.percentualOcupacao < 100 ? "text-rose-600 font-semibold" : "text-slate-900"}>
                            {it.percentualOcupacao.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold text-slate-900 text-xs bg-white">
                    <td colSpan={3} className="py-2.5 px-3 text-left">
                      Total ({dadosOcupacao.totais.totalPosicoes} posições)
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {dadosOcupacao.totais.totalExigivel}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {dadosOcupacao.totais.totalAtendido}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {dadosOcupacao.totais.totalDiasD > 0 ? (
                        <span className="text-rose-600 font-semibold">{dadosOcupacao.totais.totalDiasD}</span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={dadosOcupacao.totais.percentualGeral < 100 ? "text-rose-600 font-semibold" : "text-slate-900"}>
                        {dadosOcupacao.totais.percentualGeral.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 8. PAGINAÇÃO NO RODAPÉ (25 LINHAS POR PÁGINA) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 bg-white text-xs text-slate-600 print:hidden">
              <div className="text-slate-500">
                {totalRegistros > 0 ? (
                  <>
                    Exibindo {(paginaAtual - 1) * 25 + 1} a {Math.min(paginaAtual * 25, totalRegistros)} de {totalRegistros} postos
                  </>
                ) : (
                  "Nenhum registro"
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  disabled={paginaAtual <= 1 || carregandoOcupacao}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-slate-700 text-xs font-medium transition-colors"
                >
                  Anterior
                </button>

                <span className="px-2.5 py-1 text-slate-700 text-xs font-medium">
                  {paginaAtual} de {totalPaginas}
                </span>

                <button
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaAtual >= totalPaginas || carregandoOcupacao}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-slate-700 text-xs font-medium transition-colors"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: COBERTURAS DO PERÍODO — FOCO ITEM DA PPU (FISCALIZAÇÃO PETROBRAS)  */}
      {/* ========================================================================= */}
      {abaAtiva === "coberturas" && dadosCoberturas && (
        <div className="space-y-5">
          {/* 1. KPIs Executivos do Mês de Coberturas */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4">
            {/* Card 1: Total Coberturas */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total Coberturas</span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                  <UserCheck2 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {dadosCoberturas.totais.totalCoberturas}
              </div>
              <div className="text-[11px] text-slate-500 pt-1 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{dadosCoberturas.totais.totalSubstitutos} substituto(s) mobilizado(s)</span>
              </div>
            </div>

            {/* Card 2: Total Diárias */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Diárias Atendidas</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <Calendar className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-800 font-mono tracking-tight">
                {dadosCoberturas.totais.totalDiarias} <span className="text-sm font-semibold text-emerald-600">dias</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 font-medium">
                Base de medição Petrobras no período
              </div>
            </div>

            {/* Card 3: Itens da PPU */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wide">Itens PPU Mobilizados</span>
                <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
                  <Briefcase className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-purple-900 font-mono tracking-tight">
                {dadosCoberturas.totais.totalItensPpu} <span className="text-sm font-semibold text-purple-600">/ 19</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 font-medium">
                Planilha de Preços Unitários Contratada
              </div>
            </div>

            {/* Card 4: Postos Cobertos */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Postos com Cobertura</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-amber-900 font-mono tracking-tight">
                {dadosCoberturas.totais.totalPostosCobertos} <span className="text-sm font-semibold text-amber-600">postos</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 font-medium">
                Continuidade operacional garantida
              </div>
            </div>
          </div>

          {/* 2. Painel Central: Consolidação por Item da PPU (Medição Petrobras) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-slate-300">
            <div className="px-5 py-3.5 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Consolidação por Item da PPU — Medição e Fiscalização Petrobras
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase tracking-wider">
                    {dadosCoberturas.resumoPpu.length} Itens com Atendimento
                  </span>
                </div>
                <p className="text-xs text-slate-500 pt-0.5 print:hidden">
                  Clique em qualquer Item da PPU abaixo para filtrar instantaneamente os registros da tabela correspondente.
                </p>
              </div>

              {filtroItemPpu !== "TODOS" && (
                <button
                  onClick={() => setFiltroItemPpu("TODOS")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer print:hidden"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remover filtro do Item {filtroItemPpu} (Ver todos)</span>
                </button>
              )}
            </div>

            {dadosCoberturas.resumoPpu.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Nenhum item da PPU encontrado para o filtro selecionado.
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {dadosCoberturas.resumoPpu.map((r) => {
                  const selecionado = filtroItemPpu === r.itemPpu;
                  return (
                    <div
                      key={r.itemPpu}
                      onClick={() => setFiltroItemPpu(selecionado ? "TODOS" : r.itemPpu)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                        selecionado
                          ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                          : "bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-black font-mono tracking-tight ${
                                selecionado
                                  ? "bg-blue-700 text-white"
                                  : "bg-slate-900 text-white group-hover:bg-blue-700 transition-colors"
                              }`}
                            >
                              {r.itemPpu === "Sem Item" ? "N/I" : `Item ${r.itemPpu}`}
                            </span>
                            {r.regime && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {r.regime}
                              </span>
                            )}
                          </div>

                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 print:hidden ${
                              selecionado
                                ? "bg-blue-600 text-white"
                                : "text-slate-400 group-hover:text-blue-700 bg-slate-100 group-hover:bg-blue-50 transition-colors"
                            }`}
                          >
                            {selecionado ? "Ativo ✓" : "Filtrar"}
                          </span>
                        </div>

                        <p
                          className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug pt-0.5"
                          title={r.itemPpuDescricao}
                        >
                          {r.itemPpuDescricao}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 mt-2.5 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-bold text-slate-900 font-mono">
                            {r.totalDiarias} <span className="text-xs font-normal text-slate-500">diária{r.totalDiarias === 1 ? "" : "s"}</span>
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {r.totalCoberturas} cobertura{r.totalCoberturas === 1 ? "" : "s"}
                          </span>
                        </div>

                        {/* Barra percentual proporcional ao volume de diárias */}
                        <div className="space-y-0.5">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                selecionado ? "bg-blue-600" : "bg-blue-500 group-hover:bg-blue-600"
                              }`}
                              style={{ width: `${Math.max(r.percentualDiarias, 4)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>{r.percentualDiarias}% do volume</span>
                            <span>{r.postos.length} posto{r.postos.length === 1 ? "" : "s"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Tabela Detalhada de Coberturas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-slate-300">
            <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-2">
                <FileCheck className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-800">
                  Detalhamento Operacional de Coberturas
                </span>
                <span className="text-xs text-slate-500">
                  (Exibindo {itensCoberturaFiltrados.length} de {dadosCoberturas.itens.length} registros)
                </span>
                {filtroItemPpu !== "TODOS" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                    Filtro PPU: Item {filtroItemPpu}
                    <button onClick={() => setFiltroItemPpu("TODOS")} className="hover:text-blue-900 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-500">
                {periodoFiltro === "2026-09" ? "Setembro/2026" : periodoFiltro === "2026-10" ? "Outubro/2026" : periodoFiltro}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-300 text-slate-800 font-bold">
                    <th className="py-3 px-3.5">Unidade / Base</th>
                    <th className="py-3 px-3">Posto Contratual</th>
                    <th className="py-3 px-3.5 bg-blue-50/60 text-blue-950 border-x border-blue-200/50">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-700" />
                        <span>Item da PPU (Medição)</span>
                      </div>
                    </th>
                    <th className="py-3 px-3">Titular Ausente</th>
                    <th className="py-3 px-3">Quem Cobriu (Substituto / Ferista)</th>
                    <th className="py-3 px-3 font-mono">Período (Início → Fim)</th>
                    <th className="py-3 px-2 text-center font-mono bg-slate-50 font-bold">Diárias</th>
                    <th className="py-3 px-3">Motivo (LGPD)</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 text-xs">
                  {itensCoberturaFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <div className="max-w-sm mx-auto space-y-2">
                          <AlertOctagon className="w-8 h-8 text-slate-400 mx-auto" />
                          <p className="font-semibold text-slate-800">Nenhuma cobertura localizada</p>
                          <p className="text-[11px] text-slate-500">
                            Não há registros com os filtros atuais (Unidade: {unidadeFiltro}, Posto: {postoFiltro}, PPU: {filtroItemPpu}{busca ? `, Busca: "${busca}"` : ""}).
                          </p>
                          <button
                            onClick={() => {
                              setUnidadeFiltro("TODAS");
                              setPostoFiltro("TODOS");
                              setFiltroItemPpu("TODOS");
                              setBusca("");
                            }}
                            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm cursor-pointer"
                          >
                            Limpar todos os filtros
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    itensCoberturaFiltrados.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                          {it.unidadeNome}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-slate-900 font-bold block">{it.postoCodigo}</span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[200px]" title={it.postoFuncao}>
                            {it.postoFuncao}
                          </span>
                        </td>
                        {/* COLUNA ITEM PPU EM EVIDÊNCIA */}
                        <td className="py-2.5 px-3.5 bg-blue-50/30 border-x border-blue-100">
                          {it.itemPpu && it.itemPpu !== "—" ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                Item {it.itemPpu}
                              </span>
                              <span
                                className="text-[11px] text-slate-600 font-medium block truncate max-w-[240px]"
                                title={it.itemPpuDescricao}
                              >
                                {it.itemPpuDescricao}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Sem item informado
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="space-y-0.5">
                            <span className="font-medium text-slate-800 block">{it.titularNome}</span>
                            {it.titularMatricula && it.titularMatricula !== "—" && (
                              <span className="font-mono text-[10px] text-slate-400 block">
                                Matrícula: {it.titularMatricula}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                              {it.substitutoNome}
                            </span>
                            {it.substitutoMatricula && it.substitutoMatricula !== "—" && (
                              <span className="font-mono text-[10px] text-slate-500 block">
                                Ferista / Chapa: {it.substitutoMatricula}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                          <span>{it.dataInicio}</span>
                          <span className="text-slate-400 mx-1">→</span>
                          <span>{it.dataFim}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-black text-slate-900 bg-slate-50/70 text-sm tabular-nums">
                          {it.totalDias}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              it.motivoCategoria === "Férias"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : it.motivoCategoria === "Licença"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : it.motivoCategoria === "Afastamento"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {it.motivoCategoria}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {it.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {itensCoberturaFiltrados.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900">
                      <td colSpan={2} className="py-3 px-3.5">
                        TOTAIS CONSOLIDADOS
                      </td>
                      <td className="py-3 px-3.5 bg-blue-50/80 font-mono text-blue-900 border-x border-blue-200">
                        {dadosCoberturas.totais.totalItensPpu} itens mobilizados
                      </td>
                      <td colSpan={3} className="py-3 px-3 text-slate-600">
                        {itensCoberturaFiltrados.length} coberturas registradas
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-black text-slate-900 text-sm bg-slate-200/60">
                        {itensCoberturaFiltrados.reduce((acc, it) => acc + it.totalDias, 0)}
                      </td>
                      <td colSpan={2} className="py-3 px-3 text-slate-500 font-normal">
                        Diárias auditadas para faturamento
                      </td>
                    </tr>
                  </tfoot>
                )}
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
                    <th className="py-2.5 px-3">Item PPU</th>
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
                    dadosDescobertos.itens.map((it, idx) => {
                      const numPpu = it.itemPpu && it.itemPpu !== "—" ? it.itemPpu : (obterItemPpuDoPosto(it.postoCodigo) || "—");
                      return (
                        <tr key={`${it.posicaoId}-${it.data}-${idx}`} className="hover:bg-rose-50/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-rose-800">{formatarDataBr(it.data)}</td>
                          <td className="py-2.5 px-2 text-center text-slate-500 font-medium">{it.diaSemana}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{it.unidadeNome}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800" title={`Posto: ${it.postoCodigo} (${it.postoFuncao})`}>
                            {numPpu !== "—" ? (numPpu.startsWith("Item") ? numPpu : `Item ${numPpu}`) : "—"}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {it.titularNome}
                            <span className="text-[10px] text-slate-500 font-mono block">Chapa: {it.titularMatricula}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">
                            {it.categoriaAusencia}
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
                      );
                    })
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RODAPÉ DE AUDITORIA E ASSINATURA TÉCNICA (Impresso e em tela) */}
      <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 text-[11px] text-slate-600 print:border-t-2 print:border-slate-800 print:bg-white print:p-2.5 print:mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/marca/premier-logistics.png"
              alt="Premier Logistics"
              className="h-8 w-auto object-contain shrink-0"
            />
            <div>
              <strong className="text-slate-900 font-semibold block">
                Premier Logistics Ltda. • Declaração de Conformidade Técnica SGP
              </strong>
              <span>
                Documento emitido automaticamente com base nas escalas homologadas e marcações biométricas. Validação Contrato Petrobras {CONTRATO_NUMERO}.
              </span>
            </div>
          </div>
          <div className="text-right shrink-0 print:text-left text-[10px] text-slate-500 font-mono">
            <div>Ambiente Oficial SGP • Neon SP</div>
            <div>Autenticidade Técnica SHA-256</div>
          </div>
        </div>
      </div>

      {/* Regras Globais de Impressão A4 Paisagem */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 10mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #ffffff !important;
          }
          table {
            page-break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
        }
      `}</style>
{/* 7. PAINEL LATERAL DE DETALHE COMPLETO DO POSTO */}
      {postoDetalhe && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end print:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs transition-opacity"
            onClick={() => setPostoDetalhe(null)}
          />

          {/* Painel lateral deslizante */}
          <div className="relative w-full max-w-md bg-white shadow-2xl z-50 flex flex-col h-full border-l border-slate-200">
            {/* Cabeçalho do Painel */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {postoDetalhe.postoCodigo}
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-[320px]">
                  {postoDetalhe.postoFuncao}
                </p>
              </div>
              <button
                onClick={() => setPostoDetalhe(null)}
                className="w-7 h-7 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                title="Fechar painel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Identificação */}
              <div className="space-y-2 border-b border-slate-100 pb-3">
                <span className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider block">
                  Identificação do Posto
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Imóvel:</span>
                    <span className="font-medium text-slate-900">{postoDetalhe.unidadeNome}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Posição:</span>
                    <span className="font-medium text-slate-900">{postoDetalhe.posicaoCodigoVisual}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">Titular:</span>
                    <span className="font-medium text-slate-900">{postoDetalhe.titularNome}</span>
                    <span className="text-slate-500 ml-1.5 font-mono text-[11px]">(Chapa: {postoDetalhe.titularMatricula})</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">Seção (RM):</span>
                    <span className="text-slate-800">{postoDetalhe.secaoFormatada || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">Horário (RM):</span>
                    <span className="text-slate-800">{postoDetalhe.horarioFormatado || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Apuração de Dias do Mês */}
              <div className="space-y-2 border-b border-slate-100 pb-3">
                <span className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider block">
                  Apuração de Dias ({periodoFiltro})
                </span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Presente (P)</span>
                    <span className="font-bold text-slate-900 text-sm">{postoDetalhe.diasP}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Coberto (C)</span>
                    <span className="font-bold text-slate-900 text-sm">{postoDetalhe.diasC}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Descoberto (D)</span>
                    <span className={`font-bold text-sm ${postoDetalhe.diasD > 0 ? "text-rose-600" : "text-slate-900"}`}>
                      {postoDetalhe.diasD}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Folga (N)</span>
                    <span className="font-bold text-slate-900 text-sm">{postoDetalhe.diasN}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 text-xs">
                  <span className="text-slate-600">
                    Exigível: <strong>{postoDetalhe.diasExigiveis}</strong> • Atendido: <strong>{postoDetalhe.diasAtendidos}</strong>
                  </span>
                  <span className={`font-bold ${postoDetalhe.percentualOcupacao < 100 ? "text-rose-600" : "text-slate-900"}`}>
                    {postoDetalhe.percentualOcupacao.toFixed(1)}% Ocupação
                  </span>
                </div>
              </div>

              {/* Coberturas do Posto no Mês */}
              <div className="space-y-2">
                <span className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider block">
                  Coberturas no Mês ({coberturasDoPostoNoMes.length})
                </span>
                {coberturasDoPostoNoMes.length === 0 ? (
                  <p className="text-slate-400 italic py-2">
                    Nenhuma cobertura registrada para este posto no período.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {coberturasDoPostoNoMes.map((c) => (
                      <div key={c.id} className="p-2.5 rounded border border-slate-200 bg-slate-50 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-900">
                            {c.substitutoNome}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Chapa: {c.substitutoMatricula}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 text-[11px]">
                          <span>{c.dataInicio} a {c.dataFim}</span>
                          <span className={`text-[10px] font-semibold ${
                            c.status === "CONFIRMADA"
                              ? "text-emerald-700"
                              : c.status === "CANCELADA"
                              ? "text-rose-700"
                              : "text-amber-700"
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        {c.justificativa && (
                          <p className="text-[11px] text-slate-500">
                            Motivo: {c.justificativa}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}