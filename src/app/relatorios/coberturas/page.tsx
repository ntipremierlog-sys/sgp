"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  Building2,
  Users,
  Layers,
  Tag,
  X,
  FileSpreadsheet,
  ChevronRight,
  Printer,
  FileText,
  ShieldCheck,
  UserCheck2,
} from "lucide-react";
import { usePermissoes } from "@/lib/auth/use-permissoes";
import { useSessaoUsuario } from "@/lib/auth/use-sessao-usuario";
import {
  ResultadoRelatorioCoberturas,
  consultarDadosRelatorioCoberturas,
} from "@/lib/dados/relatorio-coberturas-dados";
import { CATALOGO_ITEM_PPU } from "@/lib/dados/painel-calculo";
import { CoberturaLinha } from "@/app/coberturas/page";

function formatarNumero(n?: number): string {
  if (n === undefined || n === null || isNaN(n)) return "0";
  return n.toLocaleString("pt-BR");
}

function formatarPercentual(n?: number): string {
  if (n === undefined || n === null || isNaN(n)) return "0%";
  const formatado = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${formatado}%`;
}

function formatarDataIsoParaBr(dataIso?: string): string {
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
  const nomeMes = meses[(mes || 9) - 1] || "Mês";
  return `${nomeMes}/${ano || 2026}`;
}

function formatarCompetenciaTexto(comp: string): string {
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
  const nomeMes = meses[(mes || 9) - 1] || "Mês";
  return `${nomeMes} de ${ano || 2026}`;
}

function obterCorPontoStatus(status: string): string {
  switch (status) {
    case "CONFIRMADA":
      return "bg-emerald-500";
    case "PLANEJADA":
      return "bg-amber-500";
    case "CANCELADA":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

export default function PaginaRelatorioCoberturas() {
  const { pode } = usePermissoes();
  const podeExportar = pode("EXPORTAR", "COBERTURAS") || pode("EXPORTAR", "RELATORIOS");
  const { sessao: usuario } = useSessaoUsuario();

  // 2. Perfis de Acesso:
  // - Perfil Premier (Administração): vê e exporta tudo.
  // - Perfil Fiscal Petrobras: vê e exporta, mas motivo aparece apenas por categoria e sem dados pessoais além de nome e matrícula.
  // - O usuário não escolhe o modo de visualização; ele é definido pelo perfil.
  const ehFiscalPetrobras =
    usuario?.perfil === "PETROBRAS_FISCAL" || usuario?.perfil === "PETROBRAS_GESTOR";
  const ehPremier = usuario?.perfil?.startsWith("PREMIER_") || !ehFiscalPetrobras;

  // 1. Filtros no Topo
  const [competencia, setCompetencia] = useState("2026-09");
  const [imovelFiltro, setImovelFiltro] = useState("TODOS");
  const [itemPpuFiltro, setItemPpuFiltro] = useState("TODOS");
  const [motivoFiltro, setMotivoFiltro] = useState("TODOS");

  // Dados do Relatório
  const [dadosRelatorio, setDadosRelatorio] = useState<ResultadoRelatorioCoberturas | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [exportandoXlsx, setExportandoXlsx] = useState(false);

  // Aba secundária abaixo da tabela principal ("Por Imóvel" ou "Por Substituto/Ferista")
  const [abaSecundaria, setAbaSecundaria] = useState<"IMOVEL" | "FERISTA">("IMOVEL");

  // 5. Estado do Drilldown / Detalhamento ao Clicar (reaproveita a tabela da etapa 2)
  const [drilldownFiltro, setDrilldownFiltro] = useState<{
    tipo: "PPU" | "IMOVEL";
    valor: string;
    rotulo: string;
  } | null>(null);
  const [itensDetalhados, setItensDetalhados] = useState<CoberturaLinha[]>([]);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);

  // Carrega os dados agregados via endpoint /api/relatorios/coberturas (revisão de desempenho: agregação roda no banco/camada de dados)
  const carregarRelatorio = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        competencia,
        imovel: imovelFiltro,
        itemPpu: itemPpuFiltro,
        motivo: motivoFiltro,
      });

      const res = await fetch(`/api/relatorios/coberturas?${params.toString()}`, {
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        if (json.sucesso) {
          setDadosRelatorio(json);
          return;
        }
      }

      // Fallback direto via camada de dados caso execução offline
      const local = await consultarDadosRelatorioCoberturas({
        competencia,
        imovel: imovelFiltro,
        itemPpu: itemPpuFiltro,
        motivo: motivoFiltro,
      });
      setDadosRelatorio(local);
    } catch (err) {
      console.warn("Erro ao buscar /api/relatorios/coberturas. Aplicando fallback local:", err);
      const local = await consultarDadosRelatorioCoberturas({
        competencia,
        imovel: imovelFiltro,
        itemPpu: itemPpuFiltro,
        motivo: motivoFiltro,
      });
      setDadosRelatorio(local);
    } finally {
      setCarregando(false);
    }
  }, [competencia, imovelFiltro, itemPpuFiltro, motivoFiltro]);

  useEffect(() => {
    carregarRelatorio();
    setDrilldownFiltro(null);
    setItensDetalhados([]);
  }, [carregarRelatorio]);

  // Carrega itens da lista detalhada da Etapa 2 quando o usuário clica num Item PPU ou Imóvel
  const carregarDetalhes = useCallback(
    async (tipo: "PPU" | "IMOVEL", valor: string, rotulo: string) => {
      setDrilldownFiltro({ tipo, valor, rotulo });
      setCarregandoDetalhes(true);
      try {
        const params = new URLSearchParams({
          competencia,
          itemPpu: tipo === "PPU" ? valor : itemPpuFiltro,
          imovel: tipo === "IMOVEL" ? valor : imovelFiltro,
          motivo: motivoFiltro,
          page: "1",
        });

        const res = await fetch(`/api/coberturas?${params.toString()}`, {
          cache: "no-store",
        });

        if (res.ok) {
          const dados = await res.json();
          if (dados.sucesso) {
            setItensDetalhados(dados.coberturas || []);
            setTimeout(() => {
              document.getElementById("secao-detalhamento")?.scrollIntoView({ behavior: "smooth" });
            }, 50);
            return;
          }
        }
      } catch (err) {
        console.error("Falha ao buscar detalhamento:", err);
      } finally {
        setCarregandoDetalhes(false);
      }
    },
    [competencia, imovelFiltro, itemPpuFiltro, motivoFiltro]
  );

  // Lista de Imóveis disponíveis extraídos dos dados
  const imoveisDisponiveis = useMemo(() => {
    if (!dadosRelatorio?.resumoImovel) return [];
    return dadosRelatorio.resumoImovel.map((i) => i.imovel).sort();
  }, [dadosRelatorio]);

  const temFiltroAtivo =
    imovelFiltro !== "TODOS" || itemPpuFiltro !== "TODOS" || motivoFiltro !== "TODOS";

  const handleLimparFiltros = () => {
    setImovelFiltro("TODOS");
    setItemPpuFiltro("TODOS");
    setMotivoFiltro("TODOS");
  };

  // 1. Exportação PDF: Formato A4 paisagem, cabeçalho com SGP, competência, filtros e data/hora de emissão
  const handleExportarPdf = () => {
    window.print();
  };

  // 1. Exportação Excel: 4 abas (Item PPU, Imóvel, Substituto, Detalhado)
  const handleExportarExcel = async () => {
    if (!dadosRelatorio) return;
    setExportandoXlsx(true);

    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const rotuloComp = formatarCompetenciaTexto(competencia);
      const dataHoraAtual = new Date().toLocaleString("pt-BR");
      const emissorNome = usuario?.nome || "Operador SGP";
      const emissorPerfil = usuario?.perfil || "PREMIER_ADMIN";
      const filtrosStr = `Imóvel: ${imovelFiltro === "TODOS" ? "Todos os Imóveis" : imovelFiltro} | Item PPU: ${itemPpuFiltro === "TODOS" ? "Todos os Itens PPU" : `Item ${itemPpuFiltro}`} | Motivo: ${motivoFiltro === "TODOS" ? "Todos os Motivos" : motivoFiltro}`;

      const cabecalhoOficial = [
        ["PREMIER LOGISTICS LTDA. — SISTEMA DE GESTÃO DE POSTOS (SGP)"],
        ["CONTRATO PETROBRAS:", "ICJ 5900.0129796.25.2", "", "CLIENTE:", "Petróleo Brasileiro S.A. – Petrobras"],
        ["CONTRATADA:", "Premier Logistics Ltda.", "", "SEGURANÇA:", "Emissão Oficial / LGPD Ativa"],
        ["RELATÓRIO:", "CONSOLIDAÇÃO EXECUTIVA E MEDIÇÃO DE COBERTURAS"],
        ["COMPETÊNCIA:", `${rotuloComp} (${competencia})`, "", "DATA/HORA EMISSÃO:", dataHoraAtual],
        ["EMISSOR:", `${emissorNome} (${emissorPerfil})`, "", "PERFIL DE ACESSO:", ehFiscalPetrobras ? "Fiscal Petrobras (LGPD Ativa)" : "Premier Logistics (Acesso Total)"],
        ["FILTROS APLICADOS:", filtrosStr],
        [],
      ];

      // ABA 1: Item_PPU
      const linhasPpu: any[] = [
        ...cabecalhoOficial,
        ["VISÃO:", "1. COBERTURAS POR ITEM DA PPU (BASE DE MEDIÇÃO PETROBRAS)"],
        [],
        [
          "ITEM PPU",
          "DESCRIÇÃO DO ITEM DA PPU",
          "Nº COBERTURAS",
          "DIÁRIAS COBERTAS",
          "DIÁRIAS DESCOBERTAS",
          "% COBERTURA",
        ],
      ];

      dadosRelatorio.resumoItemPpu.forEach((p) => {
        linhasPpu.push([
          `Item ${p.item}`,
          p.descricao,
          p.numeroCoberturas,
          p.diariasCobertas,
          p.diariasDescobertas,
          `${p.percentualCobertura.toFixed(1)}%`,
        ]);
      });

      linhasPpu.push([]);
      linhasPpu.push([
        "TOTAIS CONSOLIDADOS",
        `${dadosRelatorio.resumoItemPpu.length} Itens da PPU`,
        dadosRelatorio.indicadores?.ausenciasCobertas ?? 0,
        dadosRelatorio.indicadores?.totalDiariasCobertas ?? 0,
        dadosRelatorio.indicadores?.totalDiariasDescobertas ?? 0,
        `${(dadosRelatorio.indicadores?.percentualCobertura ?? 0).toFixed(1)}%`,
      ]);

      const wsPpu = XLSX.utils.aoa_to_sheet(linhasPpu);
      wsPpu["!cols"] = [
        { wch: 14 },
        { wch: 48 },
        { wch: 16 },
        { wch: 18 },
        { wch: 20 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsPpu, "Item_PPU");

      // ABA 2: Imovel
      const linhasImovel: any[] = [
        ...cabecalhoOficial,
        ["VISÃO:", "2. COBERTURAS POR IMÓVEL / BASE OPERACIONAL"],
        [],
        [
          "IMÓVEL / BASE",
          "Nº COBERTURAS",
          "DIÁRIAS COBERTAS",
          "DIÁRIAS DESCOBERTAS",
          "% COBERTURA",
        ],
      ];

      dadosRelatorio.resumoImovel.forEach((im) => {
        linhasImovel.push([
          im.imovel,
          im.numeroCoberturas,
          im.diariasCobertas,
          im.diariasDescobertas,
          `${im.percentualCobertura.toFixed(1)}%`,
        ]);
      });

      linhasImovel.push([]);
      linhasImovel.push([
        "TOTAIS CONSOLIDADOS",
        dadosRelatorio.indicadores?.ausenciasCobertas ?? 0,
        dadosRelatorio.indicadores?.totalDiariasCobertas ?? 0,
        dadosRelatorio.indicadores?.totalDiariasDescobertas ?? 0,
        `${(dadosRelatorio.indicadores?.percentualCobertura ?? 0).toFixed(1)}%`,
      ]);

      const wsImovel = XLSX.utils.aoa_to_sheet(linhasImovel);
      wsImovel["!cols"] = [
        { wch: 26 },
        { wch: 16 },
        { wch: 18 },
        { wch: 20 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsImovel, "Imovel");

      // ABA 3: Substituto
      const linhasSubstituto: any[] = [
        ...cabecalhoOficial,
        ["VISÃO:", "3. RANKING DE FERISTAS E SUBSTITUTOS"],
        [],
        ["SUBSTITUTO / FERISTA", "COBERTURAS REALIZADAS", "DIÁRIAS COBERTAS NO PERÍODO"],
      ];

      dadosRelatorio.rankingFeristas.forEach((f) => {
        linhasSubstituto.push([f.nome, f.numeroCoberturas, f.diarias]);
      });

      linhasSubstituto.push([]);
      linhasSubstituto.push([
        "TOTAIS CONSOLIDADOS",
        dadosRelatorio.rankingFeristas.reduce((acc, f) => acc + f.numeroCoberturas, 0),
        dadosRelatorio.rankingFeristas.reduce((acc, f) => acc + f.diarias, 0),
      ]);

      const wsSubstituto = XLSX.utils.aoa_to_sheet(linhasSubstituto);
      wsSubstituto["!cols"] = [{ wch: 36 }, { wch: 24 }, { wch: 28 }];
      XLSX.utils.book_append_sheet(wb, wsSubstituto, "Substituto");

      // ABA 4: Detalhado
      const paramsDet = new URLSearchParams({
        competencia,
        imovel: imovelFiltro,
        itemPpu: itemPpuFiltro,
        motivo: motivoFiltro,
        semPaginacao: "true",
      });

      const resDet = await fetch(`/api/coberturas?${paramsDet.toString()}`, {
        cache: "no-store",
      });
      let listaDetalhada: CoberturaLinha[] = [];
      if (resDet.ok) {
        const jsonDet = await resDet.json();
        if (jsonDet.sucesso && Array.isArray(jsonDet.coberturas)) {
          listaDetalhada = jsonDet.coberturas;
        }
      }

      const linhasDetalhado: any[] = [
        ...cabecalhoOficial,
        ["VISÃO:", "4. DETALHAMENTO DE REGISTROS OPERACIONAIS"],
        [],
      ];

      if (ehFiscalPetrobras) {
        // PERFIL FISCAL PETROBRAS: Motivo apenas por categoria e SEM dados pessoais além de nome e matrícula
        linhasDetalhado.push([
          "IMÓVEL",
          "POSTO",
          "ITEM PPU",
          "DESCRIÇÃO DO ITEM",
          "TITULAR AUSENTE (NOME)",
          "TITULAR (MATRÍCULA)",
          "COBERTURA (SUBSTITUTO)",
          "SUBSTITUTO (MATRÍCULA/CHAPA)",
          "PERÍODO INÍCIO",
          "PERÍODO FIM",
          "DIÁRIAS NO MÊS",
          "MOTIVO (CATEGORIA LGPD)",
          "STATUS",
        ]);

        listaDetalhada.forEach((cob) => {
          linhasDetalhado.push([
            cob.imovel,
            cob.postoCodigo,
            `Item ${cob.itemPpu}`,
            cob.itemPpuDescricao,
            cob.titularNome,
            cob.titularMatricula,
            cob.substitutoNome,
            cob.substitutoMatricula,
            formatarDataIsoParaBr(cob.dataInicio),
            formatarDataIsoParaBr(cob.dataFim),
            cob.diarias,
            cob.motivoCategoria,
            cob.status,
          ]);
        });
      } else {
        // PERFIL PREMIER (ADMINISTRAÇÃO): Vê e exporta tudo
        linhasDetalhado.push([
          "IMÓVEL",
          "POSTO",
          "FUNÇÃO OPERACIONAL",
          "ITEM PPU",
          "DESCRIÇÃO DO ITEM",
          "TITULAR AUSENTE (NOME)",
          "TITULAR (MATRÍCULA)",
          "COBERTURA (SUBSTITUTO)",
          "SUBSTITUTO (MATRÍCULA/CHAPA)",
          "PERÍODO INÍCIO",
          "PERÍODO FIM",
          "DIÁRIAS NO MÊS",
          "MOTIVO (CATEGORIA LGPD)",
          "TIPO DE COBERTURA",
          "STATUS",
        ]);

        listaDetalhada.forEach((cob) => {
          linhasDetalhado.push([
            cob.imovel,
            cob.postoCodigo,
            cob.postoFuncao,
            `Item ${cob.itemPpu}`,
            cob.itemPpuDescricao,
            cob.titularNome,
            cob.titularMatricula,
            cob.substitutoNome,
            cob.substitutoMatricula,
            formatarDataIsoParaBr(cob.dataInicio),
            formatarDataIsoParaBr(cob.dataFim),
            cob.diarias,
            cob.motivoCategoria,
            cob.tipoCobertura || "SUBSTITUICAO_INTERNA",
            cob.status,
          ]);
        });
      }

      linhasDetalhado.push([]);
      linhasDetalhado.push([
        "TOTAIS CONSOLIDADOS",
        "",
        "",
        "",
        `${listaDetalhada.length} Coberturas`,
        "",
        "",
        "",
        "",
        "",
        listaDetalhada.reduce((acc, c) => acc + (c.diarias || 0), 0),
        "",
        "",
      ]);

      const wsDetalhado = XLSX.utils.aoa_to_sheet(linhasDetalhado);
      wsDetalhado["!cols"] = [
        { wch: 18 },
        { wch: 18 },
        { wch: 28 },
        { wch: 12 },
        { wch: 38 },
        { wch: 28 },
        { wch: 16 },
        { wch: 28 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 22 },
        { wch: 22 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsDetalhado, "Detalhado");

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `SGP_Relatorio_Coberturas_${competencia}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Falha ao exportar planilha Excel:", e);
      alert("Falha ao exportar relatório Excel.");
    } finally {
      setExportandoXlsx(false);
    }
  };

  const ind = dadosRelatorio?.indicadores;

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto px-2 sm:px-4 py-2">
      {/* CABEÇALHO LIMPO E BREADCRUMB (TELA WEB) */}
      <div className="no-print space-y-1">
        {/* Breadcrumb e link Gestão Operacional */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Link href="/relatorios" className="hover:text-slate-600 transition-colors">
              Relatórios
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="font-medium text-slate-600">Coberturas</span>
          </div>
          <Link
            href="/coberturas"
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            Gestão operacional →
          </Link>
        </div>

        {/* Linha única: Título + Competência à esquerda | Botões PDF e Excel à direita */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Coberturas
            </h1>
            <span className="text-slate-400 font-normal">·</span>
            <span className="text-sm font-normal text-slate-500">
              {formatarCompetenciaCurta(competencia)}
            </span>
          </div>

          {podeExportar && (
            <div className="flex items-center gap-2">
              {/* Botão Exportar PDF */}
              <button
                onClick={handleExportarPdf}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition-colors cursor-pointer"
                title="Exportar Relatório Consolidado em formato A4 Paisagem (PDF)"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>PDF</span>
              </button>

              {/* Botão Exportar Excel */}
              <button
                onClick={handleExportarExcel}
                disabled={exportandoXlsx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                title="Baixar planilha Excel (.xlsx) com 4 abas: Item_PPU, Imovel, Substituto e Detalhado"
              >
                {exportandoXlsx ? (
                  <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>{exportandoXlsx ? "Gerando..." : "Excel"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SELETOR DE ABAS / RELATÓRIOS DO MÓDULO (Oculto na impressão) */}
      <div className="no-print flex border-b border-slate-200 gap-6 overflow-x-auto">
        <Link
          href="/relatorios"
          className="pb-2 text-xs transition-colors cursor-pointer whitespace-nowrap text-slate-500 hover:text-slate-800"
        >
          Ocupação por Posto
        </Link>

        <span
          className="pb-2 text-xs font-semibold text-slate-900 border-b-2 border-slate-900 -mb-px whitespace-nowrap"
        >
          Coberturas
        </span>

        <Link
          href="/relatorios?aba=descobertos"
          className="pb-2 text-xs transition-colors cursor-pointer whitespace-nowrap text-slate-500 hover:text-slate-800"
        >
          Descobertos do Período
        </Link>

        <Link
          href="/relatorios?aba=feristas"
          className="pb-2 text-xs transition-colors cursor-pointer whitespace-nowrap text-slate-500 hover:text-slate-800"
        >
          Quadro de Feristas
        </Link>

      </div>

      {/* 3. FILTROS EM UMA ÚNICA LINHA, COMPACTOS */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
        <div className="flex flex-nowrap items-center gap-2.5 overflow-x-auto text-xs">
          {/* Competência (mês/ano) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Mês:</span>
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
            />
          </div>

          {/* Imóvel */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Imóvel:</span>
            <select
              value={imovelFiltro}
              onChange={(e) => setImovelFiltro(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs max-w-[160px]"
            >
              <option value="TODOS">Todos os Imóveis</option>
              {imoveisDisponiveis.map((im) => (
                <option key={im} value={im}>{im}</option>
              ))}
            </select>
          </div>

          {/* Item PPU */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Item PPU:</span>
            <select
              value={itemPpuFiltro}
              onChange={(e) => setItemPpuFiltro(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs max-w-[160px]"
            >
              <option value="TODOS">Todos os Itens PPU</option>
              {CATALOGO_ITEM_PPU.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  Item {p.codigo} – {p.descricao.slice(0, 20)}...
                </option>
              ))}
            </select>
          </div>

          {/* Motivo */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Motivo:</span>
            <select
              value={motivoFiltro}
              onChange={(e) => setMotivoFiltro(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
            >
              <option value="TODOS">Todos os Motivos</option>
              <option value="Férias">Férias</option>
              <option value="Licença">Licença</option>
              <option value="Afastamento">Afastamento</option>
              <option value="Falta">Falta</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          {/* Limpar Filtros */}
          {temFiltroAtivo && (
            <button
              onClick={handleLimparFiltros}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Limpar filtros</span>
            </button>
          )}

          {carregando && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
              <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              <span>Atualizando dados...</span>
            </div>
          )}
        </div>
      </div>

      {/* 1. CARDS DE INDICADORES: FUNDO BRANCO, BORDA FINA, NÚMERO GRANDE E RÓTULO PEQUENO EM CINZA */}
      {/* Apenas o número de "Ausências sem cobertura" fica em vermelho quando for maior que zero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: % de Cobertura */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              % de Cobertura
            </span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatarPercentual(ind?.percentualCobertura)}
            </span>
            <span className="text-xs text-slate-500">
              {formatarNumero(ind?.ausenciasCobertas)} de {formatarNumero(ind?.totalAusencias)} ausências
            </span>
          </div>
        </div>

        {/* Card 2: Ausências sem Cobertura (Apenas o número fica em vermelho quando for > 0) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Ausências sem Cobertura
            </span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span
              className={`text-2xl font-bold tracking-tight ${
                (ind?.ausenciasSemCobertura || 0) > 0 ? "text-rose-600" : "text-slate-900"
              }`}
            >
              {formatarNumero(ind?.ausenciasSemCobertura)}
            </span>
            <span className="text-xs text-slate-500">
              {formatarNumero(ind?.totalDiariasDescobertas)} diárias descobertas
            </span>
          </div>
        </div>

        {/* Card 3: Diárias Cobertas */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Diárias Cobertas
            </span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatarNumero(ind?.totalDiariasCobertas)}
            </span>
            <span className="text-xs text-slate-500">
              diárias faturáveis
            </span>
          </div>
        </div>

        {/* Card 4: Total de Ausências */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total de Ausências
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatarNumero(ind?.totalAusencias)}
            </span>
            <span className="text-xs text-slate-500">
              {formatarNumero(ind?.totalDiariasAusencia)} diárias de ausência
            </span>
          </div>
        </div>
      </div>

      {/* 2. TABELA PRINCIPAL "COBERTURAS POR ITEM DA PPU" (VISÃO CENTRAL DO RELATÓRIO) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold text-slate-800">
              Coberturas por Item da PPU (Visão Central do Relatório)
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Base contratual de medição Petrobras. Clique em qualquer linha para abrir a lista detalhada filtrada.
            </p>
          </div>
          <span className="text-[11px] text-slate-400">
            {dadosRelatorio?.resumoItemPpu.length || 0} itens mapeados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse bg-white">
            <thead className="bg-white border-b border-slate-200">
              <tr className="text-slate-400 font-medium text-[11px]">
                <th className="py-1.5 px-3 w-[12%]">Item da PPU</th>
                <th className="py-1.5 px-3 w-[36%]">Descrição Contratual</th>
                <th className="py-1.5 px-3 text-right w-[12%]">Nº Coberturas</th>
                <th className="py-1.5 px-3 text-right w-[13%]">Diárias Cobertas</th>
                <th className="py-1.5 px-3 text-right w-[13%]">Diárias Descobertas</th>
                <th className="py-1.5 px-4 text-right w-[14%]">% Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {dadosRelatorio?.resumoItemPpu.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhum item da PPU registrado no período.
                  </td>
                </tr>
              ) : (
                dadosRelatorio?.resumoItemPpu.map((r) => {
                  const ehSelecionado =
                    drilldownFiltro?.tipo === "PPU" && drilldownFiltro?.valor === r.item;
                  return (
                    <tr
                      key={r.item}
                      onClick={() => carregarDetalhes("PPU", r.item, `Item ${r.item} – ${r.descricao}`)}
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer group bg-white ${
                        ehSelecionado ? "bg-slate-50 font-medium" : ""
                      }`}
                      title="Clique para abrir a lista detalhada de coberturas deste item"
                    >
                      {/* Item da PPU (texto simples sem badge) */}
                      <td className="py-1.5 px-3 whitespace-nowrap text-slate-800 font-medium">
                        Item {r.item}
                      </td>

                      {/* Descrição Contratual */}
                      <td className="py-1.5 px-3 text-slate-700 truncate max-w-md" title={r.descricao}>
                        {r.descricao}
                      </td>

                      {/* Nº Coberturas */}
                      <td className="py-1.5 px-3 text-right text-slate-700">
                        {formatarNumero(r.numeroCoberturas)}
                      </td>

                      {/* Diárias Cobertas */}
                      <td className="py-1.5 px-3 text-right text-slate-700">
                        {formatarNumero(r.diariasCobertas)}
                      </td>

                      {/* Diárias Descobertas */}
                      <td className="py-1.5 px-3 text-right text-slate-700">
                        {formatarNumero(r.diariasDescobertas)}
                      </td>

                      {/* % Cobertura com barra fina e discreta em cor neutra */}
                      <td className="py-1.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full bg-slate-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, r.percentualCobertura))}%` }}
                            />
                          </div>
                          <span className="font-medium text-slate-700 w-11 text-right">
                            {formatarPercentual(r.percentualCobertura)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. ABAS ABAIXO: "POR IMÓVEL" E "POR SUBSTITUTO/FERISTA" */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Seletor de Abas */}
        <div className="border-b border-slate-200 bg-white flex items-center justify-between px-3 pt-2">
          <div className="flex gap-2">
            <button
              onClick={() => setAbaSecundaria("IMOVEL")}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 ${
                abaSecundaria === "IMOVEL"
                  ? "border-slate-800 text-slate-900 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Por Imóvel / Base</span>
              <span className="text-[11px] text-slate-400 ml-1">
                ({dadosRelatorio?.resumoImovel.length || 0})
              </span>
            </button>

            <button
              onClick={() => setAbaSecundaria("FERISTA")}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 ${
                abaSecundaria === "FERISTA"
                  ? "border-slate-800 text-slate-900 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Por Substituto / Ferista</span>
              <span className="text-[11px] text-slate-400 ml-1">
                ({dadosRelatorio?.rankingFeristas.length || 0})
              </span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Clique em qualquer linha do imóvel para filtrar o detalhamento
          </span>
        </div>

        {/* Conteúdo Aba 1: Por Imóvel */}
        {abaSecundaria === "IMOVEL" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse bg-white">
              <thead className="bg-white border-b border-slate-200">
                <tr className="text-slate-400 font-medium text-[11px]">
                  <th className="py-1.5 px-3 w-[36%]">Imóvel / Base</th>
                  <th className="py-1.5 px-3 text-right w-[16%]">Nº Coberturas</th>
                  <th className="py-1.5 px-3 text-right w-[16%]">Diárias Cobertas</th>
                  <th className="py-1.5 px-3 text-right w-[16%]">Diárias Descobertas</th>
                  <th className="py-1.5 px-4 text-right w-[16%]">% Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {dadosRelatorio?.resumoImovel.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhum imóvel com ocorrências no período.
                    </td>
                  </tr>
                ) : (
                  dadosRelatorio?.resumoImovel.map((im) => {
                    const ehSelecionado =
                      drilldownFiltro?.tipo === "IMOVEL" && drilldownFiltro?.valor === im.imovel;
                    return (
                      <tr
                        key={im.imovel}
                        onClick={() => carregarDetalhes("IMOVEL", im.imovel, `Imóvel: ${im.imovel}`)}
                        className={`hover:bg-slate-50/70 transition-colors cursor-pointer group bg-white ${
                          ehSelecionado ? "bg-slate-50 font-medium" : ""
                        }`}
                        title="Clique para abrir a lista detalhada de coberturas deste imóvel"
                      >
                        <td className="py-1.5 px-3 text-slate-800 font-medium">
                          {im.imovel}
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-700">
                          {formatarNumero(im.numeroCoberturas)}
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-700">
                          {formatarNumero(im.diariasCobertas)}
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-700">
                          {formatarNumero(im.diariasDescobertas)}
                        </td>
                        <td className="py-1.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden shrink-0">
                              <div
                                className="h-full bg-slate-500 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, im.percentualCobertura))}%` }}
                              />
                            </div>
                            <span className="font-medium text-slate-700 w-11 text-right">
                              {formatarPercentual(im.percentualCobertura)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Conteúdo Aba 2: Por Substituto/Ferista */}
        {abaSecundaria === "FERISTA" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse bg-white">
              <thead className="bg-white border-b border-slate-200">
                <tr className="text-slate-400 font-medium text-[11px]">
                  <th className="py-1.5 px-3 w-[10%] text-center">Posição</th>
                  <th className="py-1.5 px-3 w-[50%]">Nome do Substituto / Ferista</th>
                  <th className="py-1.5 px-3 text-right w-[20%]">Nº de Coberturas</th>
                  <th className="py-1.5 px-4 text-right w-[20%]">Total de Diárias Cobertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {dadosRelatorio?.rankingFeristas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Nenhum ferista/substituto registrou coberturas no período.
                    </td>
                  </tr>
                ) : (
                  dadosRelatorio?.rankingFeristas.map((f, idx) => (
                    <tr key={f.nome} className="hover:bg-slate-50/70 transition-colors bg-white">
                      <td className="py-1.5 px-3 text-center text-slate-400 font-medium">
                        #{idx + 1}
                      </td>
                      <td className="py-1.5 px-3 text-slate-800 font-medium">
                        {f.nome}
                      </td>
                      <td className="py-1.5 px-3 text-right text-slate-700">
                        {formatarNumero(f.numeroCoberturas)}
                      </td>
                      <td className="py-1.5 px-4 text-right text-slate-700">
                        {formatarNumero(f.diarias)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. LISTA DETALHADA JÁ FILTRADA AO CLICAR EM ITEM PPU OU IMÓVEL (PADRÃO VISUAL LIMPO) */}
      {drilldownFiltro && (
        <div id="secao-detalhamento" className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Banner do Filtro Ativo */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">
                Detalhamento: {drilldownFiltro.rotulo}
              </span>
              <span className="text-slate-400">
                ({itensDetalhados.length} {itensDetalhados.length === 1 ? "cobertura" : "coberturas"})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/coberturas?competencia=${competencia}&${drilldownFiltro.tipo === "PPU" ? `itemPpu=${drilldownFiltro.valor}` : `imovel=${drilldownFiltro.valor}`}`}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
                title="Abrir na tela de gestão operacional"
              >
                <span>Abrir na Gestão</span>
                <ChevronRight className="w-3 h-3" />
              </Link>

              <button
                onClick={() => setDrilldownFiltro(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                title="Fechar detalhamento"
              >
                <X className="w-3.5 h-3.5" />
                <span>Fechar</span>
              </button>
            </div>
          </div>

          {/* Tabela de 9 colunas no padrão limpo */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-fixed bg-white">
              <thead className="bg-white border-b border-slate-200">
                <tr className="text-slate-400 font-medium text-[11px]">
                  <th className="py-1.5 px-3 w-[11%]">Imóvel</th>
                  <th className="py-1.5 px-2.5 w-[13%]">Posto</th>
                  <th className="py-1.5 px-2.5 w-[8%]">Item PPU</th>
                  <th className="py-1.5 px-3 w-[20%]">Titular ausente</th>
                  <th className="py-1.5 px-3 w-[20%]">Cobertura</th>
                  <th className="py-1.5 px-2.5 w-[11%]">Período</th>
                  <th className="py-1.5 px-2 text-center w-[5%]">Diárias</th>
                  <th className="py-1.5 px-2.5 w-[10%]">Motivo</th>
                  <th className="py-1.5 px-2.5 w-[12%]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {carregandoDetalhes ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando detalhamento...</span>
                      </div>
                    </td>
                  </tr>
                ) : itensDetalhados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Nenhuma cobertura encontrada para o filtro selecionado.
                    </td>
                  </tr>
                ) : (
                  itensDetalhados.map((cob) => (
                    <tr key={cob.id} className="hover:bg-slate-50/70 transition-colors bg-white">
                      {/* 1. Imóvel */}
                      <td className="py-1.5 px-3 truncate text-slate-700" title={`Imóvel / Base: ${cob.imovel}`}>
                        {cob.imovel}
                      </td>

                      {/* 2. Posto (só o código; descrição em tooltip) */}
                      <td
                        className="py-1.5 px-2.5 text-slate-800 font-medium truncate"
                        title={`Posto Contratual: ${cob.postoCodigo}\nDescrição / Função: ${cob.postoFuncao}`}
                      >
                        {cob.postoCodigo}
                      </td>

                      {/* 3. Item PPU (texto simples, sem caixa) */}
                      <td
                        className="py-1.5 px-2.5 text-slate-700 whitespace-nowrap"
                        title={cob.itemPpuDescricao ? `Item ${cob.itemPpu} - ${cob.itemPpuDescricao}` : `Item ${cob.itemPpu}`}
                      >
                        {cob.itemPpu}
                      </td>

                      {/* 4. Titular ausente (nome; matrícula em tooltip) */}
                      <td
                        className="py-1.5 px-3 text-slate-800 truncate"
                        title={cob.titularMatricula && cob.titularMatricula !== "—" ? `Matrícula: ${cob.titularMatricula}` : "Sem matrícula registrada"}
                      >
                        {cob.titularNome}
                      </td>

                      {/* 5. Cobertura (nome; chapa em tooltip) */}
                      <td
                        className="py-1.5 px-3 text-slate-800 truncate"
                        title={cob.substitutoMatricula && cob.substitutoMatricula !== "—" ? `Chapa / Matrícula: ${cob.substitutoMatricula}` : "Sem chapa registrada"}
                      >
                        {cob.substitutoNome}
                      </td>

                      {/* 6. Período (formato dd/mm – dd/mm) */}
                      <td
                        className="py-1.5 px-2.5 text-slate-700 whitespace-nowrap"
                        title={`Vigência: ${cob.dataInicio} até ${cob.dataFim}`}
                      >
                        {cob.periodoFormatado}
                      </td>

                      {/* 7. Diárias */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap text-slate-700">
                        {cob.diarias}
                      </td>

                      {/* 8. Motivo (texto simples, sem caixa) */}
                      <td
                        className="py-1.5 px-2.5 text-slate-700 whitespace-nowrap"
                        title={
                          ehFiscalPetrobras
                            ? `Categoria Oficial (LGPD): ${cob.motivoCategoria}`
                            : `Categoria: ${cob.motivoCategoria}${cob.tipoCobertura ? ` • Tipo: ${cob.tipoCobertura}` : ""}`
                        }
                      >
                        {cob.motivoCategoria}
                      </td>

                      {/* 9. Status (apenas um ponto pequeno colorido ● antes do texto) */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1.5 text-slate-700"
                          title={`Status: ${cob.status}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${obterCorPontoStatus(cob.status)}`} />
                          <span>{cob.status === "CONFIRMADA" ? "Confirmada" : cob.status === "PLANEJADA" ? "Planejada" : "Cancelada"}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. CONTAINER DE IMPRESSÃO A4 PAISAGEM (EXPORTAÇÃO PDF / IMPRESSÃO)        */}
      {/* Cabeçalho com SGP, competência, filtros, emissão + Cards + PPU + Imóvel  */}
      {/* ========================================================================= */}
      <div className="print-relatorio-a4 p-4 text-slate-900 bg-white">
        {/* Cabeçalho Contratual Oficial com Logo Premier */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 gap-4">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/marca/premier-logistics.png"
                alt="Premier Logistics"
                className="h-12 w-auto object-contain shrink-0"
              />
              <div className="h-10 w-px bg-slate-300" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1F4FD1] text-white tracking-wider">
                    SGP
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Sistema de Gestão de Postos • Petrobras
                  </span>
                </div>
                <h1 className="text-xl font-black text-slate-950 mt-0.5">
                  Relatório Consolidado de Coberturas
                </h1>
                <div className="text-[11px] text-slate-600">
                  Contrato ICJ 5900.0129796.25.2 • Premier Logistics Ltda. / Petróleo Brasileiro S.A.
                </div>
              </div>
            </div>

            <div className="text-right text-xs shrink-0">
              <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-700 border border-slate-300 mb-1">
                Documento Oficial
              </span>
              <div className="font-bold text-slate-900">
                Competência: {formatarCompetenciaTexto(competencia)} ({competencia})
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                Emissão: {new Date().toLocaleString("pt-BR")}
              </div>
              <div className="text-[11px] text-slate-500">
                Emissor: {usuario?.nome || "Operador SGP"} ({usuario?.perfil || "PREMIER_ADMIN"})
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <div>
              <span className="font-bold text-slate-700">Filtros aplicados: </span>
              <span>
                Imóvel: {imovelFiltro === "TODOS" ? "Todos os Imóveis" : imovelFiltro} | Item PPU:{" "}
                {itemPpuFiltro === "TODOS" ? "Todos os Itens PPU" : `Item ${itemPpuFiltro}`} | Motivo:{" "}
                {motivoFiltro === "TODOS" ? "Todos os Motivos" : motivoFiltro}
              </span>
            </div>
            <div className="font-semibold text-slate-700">
              Modo: {ehFiscalPetrobras ? "Fiscal Petrobras (LGPD restrito a nome e matrícula)" : "Premier (Administração Total)"}
            </div>
          </div>
        </div>

        {/* 4 Cards de Indicadores do Período */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="border border-slate-300 rounded-lg p-3 bg-slate-50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              % de Cobertura
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
              {formatarPercentual(ind?.percentualCobertura)}
            </div>
            <div className="text-[10px] text-emerald-800 font-semibold mt-0.5">
              {formatarNumero(ind?.ausenciasCobertas)} de {formatarNumero(ind?.totalAusencias)} ausências
            </div>
          </div>

          <div
            className={`border rounded-lg p-3 ${
              (ind?.ausenciasSemCobertura || 0) > 0 ? "border-rose-300 bg-rose-50" : "border-slate-300 bg-slate-50"
            }`}
          >
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                (ind?.ausenciasSemCobertura || 0) > 0 ? "text-rose-800" : "text-slate-600"
              }`}
            >
              Ausências sem Cobertura
            </div>
            <div
              className={`text-xl font-bold font-mono mt-0.5 ${
                (ind?.ausenciasSemCobertura || 0) > 0 ? "text-rose-700" : "text-slate-900"
              }`}
            >
              {formatarNumero(ind?.ausenciasSemCobertura)}
            </div>
            <div
              className={`text-[10px] font-semibold mt-0.5 ${
                (ind?.ausenciasSemCobertura || 0) > 0 ? "text-rose-700" : "text-slate-500"
              }`}
            >
              {formatarNumero(ind?.totalDiariasDescobertas)} diárias descobertas
            </div>
          </div>

          <div className="border border-slate-300 rounded-lg p-3 bg-slate-50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Diárias Cobertas
            </div>
            <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
              {formatarNumero(ind?.totalDiariasCobertas)}
            </div>
            <div className="text-[10px] text-slate-600 font-medium mt-0.5">
              diárias faturáveis
            </div>
          </div>

          <div className="border border-slate-300 rounded-lg p-3 bg-slate-50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Total de Ausências
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
              {formatarNumero(ind?.totalAusencias)}
            </div>
            <div className="text-[10px] text-slate-600 font-medium mt-0.5">
              {formatarNumero(ind?.totalDiariasAusencia)} diárias registradas
            </div>
          </div>
        </div>

        {/* Tabela 1: Coberturas por Item da PPU (Central) */}
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5 flex items-center justify-between">
            <span>1. Coberturas por Item da PPU (Base de Medição Petrobras)</span>
            <span className="text-[10px] font-normal text-slate-500 font-mono">
              {dadosRelatorio?.resumoItemPpu.length || 0} itens
            </span>
          </div>
          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px]">
                <th className="py-1.5 px-2 border-r border-slate-300 w-24">Item PPU</th>
                <th className="py-1.5 px-2 border-r border-slate-300">Descrição do Item da PPU</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-right w-24">Coberturas</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-right w-28">Diárias Cobertas</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-right w-32">Diárias Descobertas</th>
                <th className="py-1.5 px-2 text-right w-24">% Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dadosRelatorio?.resumoItemPpu.map((r) => (
                <tr key={r.item} className="even:bg-slate-50/50">
                  <td className="py-1.5 px-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                    Item {r.item}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-200 text-slate-800">
                    {r.descricao}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-semibold">
                    {formatarNumero(r.numeroCoberturas)}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-800">
                    {formatarNumero(r.diariasCobertas)}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-bold text-rose-700">
                    {formatarNumero(r.diariasDescobertas)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                    {formatarPercentual(r.percentualCobertura)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                <td colSpan={2} className="py-1.5 px-2 border-r border-slate-300 uppercase tracking-wider text-[10px]">
                  Total Consolidado
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono">
                  {formatarNumero(ind?.ausenciasCobertas)}
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-emerald-800">
                  {formatarNumero(ind?.totalDiariasCobertas)}
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-rose-700">
                  {formatarNumero(ind?.totalDiariasDescobertas)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-slate-900">
                  {formatarPercentual(ind?.percentualCobertura)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabela 2: Coberturas por Imóvel */}
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5 flex items-center justify-between">
            <span>2. Coberturas por Imóvel / Base Operacional</span>
            <span className="text-[10px] font-normal text-slate-500 font-mono">
              {dadosRelatorio?.resumoImovel.length || 0} imóveis
            </span>
          </div>
          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px]">
                <th className="py-1.5 px-2 border-r border-slate-300">Imóvel / Base</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-right w-24">Coberturas</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-right w-28">Diárias Cobertas</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-right w-32">Diárias Descobertas</th>
                <th className="py-1.5 px-2 text-right w-24">% Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dadosRelatorio?.resumoImovel.map((im) => (
                <tr key={im.imovel} className="even:bg-slate-50/50">
                  <td className="py-1.5 px-2 border-r border-slate-200 font-semibold text-slate-900">
                    {im.imovel}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-semibold">
                    {formatarNumero(im.numeroCoberturas)}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-800">
                    {formatarNumero(im.diariasCobertas)}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-bold text-rose-700">
                    {formatarNumero(im.diariasDescobertas)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                    {formatarPercentual(im.percentualCobertura)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                <td className="py-1.5 px-2 border-r border-slate-300 uppercase tracking-wider text-[10px]">
                  Total Consolidado
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono">
                  {formatarNumero(ind?.ausenciasCobertas)}
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-emerald-800">
                  {formatarNumero(ind?.totalDiariasCobertas)}
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-rose-700">
                  {formatarNumero(ind?.totalDiariasDescobertas)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-slate-900">
                  {formatarPercentual(ind?.percentualCobertura)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rodapé Contratual de Auditoria */}
        <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/marca/premier-logistics.png"
              alt="Premier Logistics"
              className="h-7 w-auto object-contain inline-block"
            />
            <span>Premier Logistics Ltda. • Documento emitido eletronicamente pelo SGP. Validação Contrato Petrobras ICJ 5900.0129796.25.2.</span>
          </div>
          <div>
            Autenticidade Técnica SHA-256 • Neon SP
          </div>
        </div>
      </div>

      {/* ESTILOS DE IMPRESSÃO A4 PAISAGEM */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #ffffff !important;
          }
          header,
          nav,
          aside,
          footer,
          .no-print {
            display: none !important;
          }
          .print-relatorio-a4 {
            display: block !important;
            width: 100% !important;
          }
        }
        @media screen {
          .print-relatorio-a4 {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
