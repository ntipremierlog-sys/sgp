"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  X,
  Clock,
  MessageSquare,
  Building2,
  FilterX,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { BadgeStatus, StatusOcupacao } from "@/components/ui/badge-status";
import { BASES_SGP_SISTEMA } from "@/lib/dados/secoes-horarios";
import {
  carregarEstado,
  calcularStatusDia,
  obterTodosPostosContrato,
  obterMarcacoesPonto,
  obterDataReferenciaPonto,
  PostoOperacional,
  OcorrenciaOperacional,
  CoberturaOperacional,
  ApontamentoOperacional,
  OcupacaoDiaDetalhada,
  MarcacaoPontoOriginal,
} from "@/lib/dados/estado-operacional";

export default function MapaOcupacaoPage() {
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);
  const [coberturas, setCoberturas] = useState<CoberturaOperacional[]>([]);
  const [apontamentos, setApontamentos] = useState<ApontamentoOperacional[]>([]);
  const [marcacoes, setMarcacoes] = useState<MarcacaoPontoOriginal[]>([]);
  const [dataRefLote, setDataRefLote] = useState<string | null>(null);

  // Filtros
  const [competencia, setCompetencia] = useState<string>("2026-09");
  const [filtroBase, setFiltroBase] = useState<string>("TODAS");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [filtroEscala, setFiltroEscala] = useState<string>("TODAS");

  // Drawer / Inspeção de Célula
  const [detalheCelula, setDetalheCelula] = useState<OcupacaoDiaDetalhada | null>(null);

  // Ref para scroll do dia de hoje
  const tabelaRef = useRef<HTMLDivElement>(null);
  const diaHojeRef = useRef<HTMLTableCellElement | null>(null);

  const carregarDados = async () => {
    const estado = carregarEstado();
    // Carrega todos os postos de trabalho do contrato (Anexo 1-A + Bases SIFAC)
    const todosPostos = obterTodosPostosContrato(estado.postos);
    setPostos(todosPostos);
    setOcorrencias(estado.ocorrencias);
    setCoberturas(estado.coberturas);
    setApontamentos(estado.apontamentos);

    let pts = obterMarcacoesPonto();
    let dataRef = obterDataReferenciaPonto();

    if (!pts || pts.length === 0) {
      try {
        const res = await fetch("/api/ponto");
        if (res.ok) {
          const data = await res.json();
          if (data.sucesso && Array.isArray(data.marcacoes) && data.marcacoes.length > 0) {
            pts = data.marcacoes;
            dataRef = data.dataReferencia || dataRef;
          }
        }
      } catch (err) {
        console.warn("Aviso: Falha ao carregar ponto via /api/ponto:", err);
      }
    }

    setMarcacoes(pts || []);
    setDataRefLote(dataRef || null);
  };

  useEffect(() => {
    carregarDados();
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // Scroll automático para o dia de hoje quando a competência corresponde ao mês atual
  useEffect(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    if (competencia === mesAtual && diaHojeRef.current) {
      setTimeout(() => {
        diaHojeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }, 300);
    }
  }, [competencia, postos]);

  // Set de Marcações O(1) para cruzamento em tempo real
  const marcacoesSet = useMemo(() => {
    const set = new Set<string>();
    marcacoes.forEach((m: any) => {
      const matRaw = m.matricula || m.chapa || "";
      if (!matRaw) return;
      const chapa = String(matRaw).padStart(6, "0");
      const dataStr = m.dataLocal || m.dataHoraUtc || m.dataHora || m.data || "";
      if (typeof dataStr === "string" && dataStr.length >= 10) {
        const d = dataStr.slice(0, 10);
        set.add(`${chapa}_${d}`);
      }
    });
    return set;
  }, [marcacoes]);

  // Competência e Dias do Mês Selecionado
  const [ano, mes] = useMemo(() => {
    const parts = competencia.split("-").map(Number);
    return [parts[0] || 2026, parts[1] || 9];
  }, [competencia]);

  const mesIdx = mes - 1;
  const totalDiasNoMes = useMemo(() => new Date(ano, mes, 0).getDate(), [ano, mes]);
  const diasDoMes = useMemo(
    () => Array.from({ length: totalDiasNoMes }, (_, i) => i + 1),
    [totalDiasNoMes]
  );

  // Dia de hoje para destacar coluna
  const hojeStr = useMemo(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
  }, []);

  const getDiaStr = useCallback(
    (dia: number) => `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
    [ano, mes]
  );

  const isHoje = (dia: number) => getDiaStr(dia) === hojeStr;

  const getNomeDiaSemana = (dia: number) => {
    const data = new Date(ano, mesIdx, dia);
    const nomes = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    return nomes[data.getDay()];
  };

  const isFimDeSemana = (dia: number) => {
    const data = new Date(ano, mesIdx, dia);
    const day = data.getDay();
    return day === 0 || day === 6;
  };

  const isFeriado = (dia: number) => {
    if (ano === 2026 && mes === 9 && dia === 7) return true; // 07/09 Independência
    return false;
  };

  // Verifica se algum filtro está ativo
  const filtrosAtivos = useMemo(
    () => busca.trim() !== "" || filtroBase !== "TODAS" || filtroStatus !== "TODOS" || filtroEscala !== "TODAS",
    [busca, filtroBase, filtroStatus, filtroEscala]
  );

  const limparFiltros = () => {
    setBusca("");
    setFiltroBase("TODAS");
    setFiltroStatus("TODOS");
    setFiltroEscala("TODAS");
  };

  const verificaMatchBase = (p: PostoOperacional, baseFiltroValor: string) => {
    if (baseFiltroValor === "TODAS") return true;
    const uId = p.unidadeId || "UFN-III";
    if (uId === baseFiltroValor) return true;
    if (p.unidadeNome && p.unidadeNome.toLowerCase().includes(baseFiltroValor.toLowerCase())) return true;
    if (p.baseOperacional && p.baseOperacional.toLowerCase().includes(baseFiltroValor.toLowerCase())) return true;
    return false;
  };

  // Filtragem dos postos
  const postosFiltrados = useMemo(() => {
    return postos.filter((p) => {
      if (!verificaMatchBase(p, filtroBase)) return false;

      const termoBusca = busca.trim().toLowerCase();
      const matchTexto =
        !termoBusca ||
        p.codigoPosto.toLowerCase().includes(termoBusca) ||
        p.funcao.toLowerCase().includes(termoBusca) ||
        (p.titularNome && p.titularNome.toLowerCase().includes(termoBusca)) ||
        (p.titularMatricula && p.titularMatricula.toLowerCase().includes(termoBusca)) ||
        (p.unidadeNome && p.unidadeNome.toLowerCase().includes(termoBusca)) ||
        (p.unidadeId && p.unidadeId.toLowerCase().includes(termoBusca));

      const matchEscala = filtroEscala === "TODAS" || p.escala === filtroEscala;

      if (!matchTexto || !matchEscala) return false;

      // Filtro por status (verifica se algum dia do mês tem o status selecionado)
      if (filtroStatus !== "TODOS") {
        let temStatus = false;
        for (const d of diasDoMes) {
          const ocup = calcularStatusDia(
            p,
            d,
            ano,
            mesIdx,
            ocorrencias,
            coberturas,
            apontamentos,
            marcacoesSet,
            dataRefLote || "2026-09-15"
          );
          if (ocup.statusOcupacao === filtroStatus) {
            temStatus = true;
            break;
          }
        }
        return temStatus;
      }

      return true;
    });
  }, [
    postos,
    filtroBase,
    busca,
    filtroEscala,
    filtroStatus,
    diasDoMes,
    ano,
    mesIdx,
    ocorrencias,
    coberturas,
    apontamentos,
    marcacoesSet,
    dataRefLote,
  ]);

  // Estatísticas do Mapa para a Base e Competência selecionadas
  const postosParaMetricas = useMemo(() => {
    return postos.filter((p) => verificaMatchBase(p, filtroBase));
  }, [postos, filtroBase]);

  const { totalPresentes, totalCobertos, totalDescobertos, taxaCumprimento } = useMemo(() => {
    let pres = 0;
    let cob = 0;
    let desc = 0;

    // Se Setembro 2026, apuração é até dia 15 (ou data do lote); se mês anterior, apura todo o mês
    const limiteDia =
      ano === 2026 && mes === 9
        ? Math.min(15, totalDiasNoMes)
        : totalDiasNoMes;

    postosParaMetricas.forEach((p) => {
      for (let d = 1; d <= limiteDia; d++) {
        const oc = calcularStatusDia(
          p,
          d,
          ano,
          mesIdx,
          ocorrencias,
          coberturas,
          apontamentos,
          marcacoesSet,
          dataRefLote || "2026-09-15"
        );
        if (oc.statusOcupacao === "TITULAR_PRESENTE") pres++;
        else if (oc.statusOcupacao === "COBERTO") cob++;
        else if (oc.statusOcupacao === "DESCOBERTO") desc++;
      }
    });

    const diariasEfetivas = pres + cob;
    const totalExigiveis = diariasEfetivas + desc;
    const taxa =
      totalExigiveis > 0
        ? Math.round((diariasEfetivas / totalExigiveis) * 100)
        : 0;

    return {
      totalPresentes: pres,
      totalCobertos: cob,
      totalDescobertos: desc,
      taxaCumprimento: taxa,
    };
  }, [
    postosParaMetricas,
    ano,
    mes,
    mesIdx,
    totalDiasNoMes,
    ocorrencias,
    coberturas,
    apontamentos,
    marcacoesSet,
    dataRefLote,
  ]);

  // Nome amigável da base selecionada
  const nomeBaseSelecionada = useMemo(() => {
    if (filtroBase === "TODAS") return `Contrato Integral (${BASES_SGP_SISTEMA.length} Bases)`;
    const item = BASES_SGP_SISTEMA.find((b) => b.id === filtroBase);
    return item ? item.nome : filtroBase;
  }, [filtroBase]);

  // Função para obter ícone e classe da célula compacta
  const getCelulaEstilo = (status: StatusOcupacao) => {
    switch (status) {
      case "TITULAR_PRESENTE":
        return {
          sigla: "P",
          bg: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 shadow-2xs font-bold",
          dot: "bg-emerald-500",
        };
      case "COBERTO":
        return {
          sigla: "C",
          bg: "bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-300 shadow-2xs font-bold",
          dot: "bg-sky-500",
        };
      case "DESCOBERTO":
        return {
          sigla: "D",
          bg: "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 shadow-2xs font-bold",
          dot: "bg-rose-500",
        };
      case "NAO_EXIGIVEL":
        return {
          sigla: "—",
          bg: "bg-slate-50/50 hover:bg-slate-100 text-slate-400 border-slate-200/60 font-normal",
          dot: "bg-slate-300",
        };
      case "POSTO_VAGO":
        return {
          sigla: "V",
          bg: "bg-amber-50/70 hover:bg-amber-100 text-amber-700 border-amber-200 shadow-2xs font-semibold",
          dot: "bg-amber-500",
        };
      case "PENDENTE_APURACAO":
        return {
          sigla: "?",
          bg: "bg-slate-50/40 hover:bg-slate-100 text-slate-400 border-slate-200 border-dashed font-normal",
          dot: "bg-slate-400",
        };
      default:
        return {
          sigla: "-",
          bg: "bg-slate-50 text-slate-400 border-slate-200",
          dot: "bg-slate-400",
        };
    }
  };

  // Exportação XLSX real via biblioteca xlsx (já presente no package.json)
  const handleExportarXlsx = async () => {
    try {
      const XLSX = await import("xlsx");
      const linhas: Record<string, string | number>[] = [];
      postosFiltrados.forEach((p) => {
        const base = p.unidadeNome || p.unidadeId || "UFN III";
        diasDoMes.forEach((d) => {
          const det = calcularStatusDia(
            p, d, ano, mesIdx, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote || "2026-09-15"
          );
          linhas.push({
            "Código Posto": p.codigoPosto,
            "Base Operacional": base,
            "Função Contratual": p.funcao,
            "Escala": p.escala,
            "Titular": p.titularNome || "VAGO",
            "Matrícula": p.titularMatricula || "",
            "Dia": d,
            "Data": det.data,
            "Status Ocupação": det.statusOcupacao,
            "Ocupante / Substituto": det.ocupanteNome || "",
            "Justificativa Auditável": det.motivoPublico,
          });
        });
      });
      const ws = XLSX.utils.json_to_sheet(linhas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mapa de Ocupação");
      ws["!cols"] = [
        { wch: 16 }, { wch: 24 }, { wch: 30 }, { wch: 8 },
        { wch: 28 }, { wch: 12 }, { wch: 5 }, { wch: 12 },
        { wch: 22 }, { wch: 28 }, { wch: 50 },
      ];
      const baseSlug = filtroBase === "TODAS" ? "Todas_Bases" : filtroBase.replace(/[\s/\\-]+/g, "_");
      XLSX.writeFile(wb, `Mapa_Ocupacao_${baseSlug}_${competencia}.xlsx`);
    } catch {
      // Fallback CSV
      let csv = "Codigo_Posto;Base;Funcao;Escala;Titular;Matricula;Dia;Data;Status;Ocupante;Justificativa\n";
      postosFiltrados.forEach((p) => {
        const base = p.unidadeNome || p.unidadeId || "UFN III";
        diasDoMes.forEach((d) => {
          const det = calcularStatusDia(
            p, d, ano, mesIdx, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote || "2026-09-15"
          );
          csv += `${p.codigoPosto};"${base}";"${p.funcao}";${p.escala};"${p.titularNome || "VAGO"}";"${p.titularMatricula || ""}";${d};${det.data};${det.statusOcupacao};"${det.ocupanteNome || ""}";"${det.motivoPublico.replace(/"/g, '""')}"\n`;
        });
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseSlug = filtroBase === "TODAS" ? "Todas_Bases" : filtroBase.replace(/[\s/\\-]+/g, "_");
      a.download = `Mapa_Ocupacao_${baseSlug}_${competencia}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6 max-w-full mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
            <CalendarCheck className="w-6 h-6 text-blue-600" />
            <h1>Mapa de Ocupação Diária do Posto</h1>
            <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 font-semibold px-2 py-0.5 rounded">
              Recurso Central Contratual
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Grade analítica: Postos (linhas) × Dias da Competência (colunas). Status auditável dia a dia para subsidiar a Memória de Cálculo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportarXlsx}
            className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-3 py-2 rounded shadow transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Grade (XLSX)</span>
          </button>
        </div>
      </div>

      {/* Cartões de Métricas — clicáveis como filtros rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total de Postos */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Postos no Mapa</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">{postosParaMetricas.length}</div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5" title={nomeBaseSelecionada}>
            {nomeBaseSelecionada}
          </div>
        </div>

        {/* Titular Presente — filtrável */}
        <button
          onClick={() => setFiltroStatus(filtroStatus === "TITULAR_PRESENTE" ? "TODOS" : "TITULAR_PRESENTE")}
          className={`bg-white p-3.5 rounded-lg border shadow-xs text-left w-full transition-all cursor-pointer ${
            filtroStatus === "TITULAR_PRESENTE"
              ? "border-emerald-400 ring-2 ring-emerald-200 bg-emerald-50/50"
              : "border-slate-200 hover:border-emerald-200"
          }`}
          title="Clique para filtrar postos com Titular Presente"
        >
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Titular Presente</span>
            {filtroStatus === "TITULAR_PRESENTE" && <ChevronRight className="w-3 h-3 ml-auto text-emerald-600" />}
          </div>
          <div className="mt-1.5 text-2xl font-bold text-emerald-700 tabular-nums">{totalPresentes}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {ano === 2026 && mes === 9 ? "Diárias regulares (01 a 15/09)" : `Diárias regulares (${String(mes).padStart(2, "0")}/${ano})`}
          </div>
        </button>

        {/* Cobertos — filtrável */}
        <button
          onClick={() => setFiltroStatus(filtroStatus === "COBERTO" ? "TODOS" : "COBERTO")}
          className={`bg-white p-3.5 rounded-lg border shadow-xs text-left w-full transition-all cursor-pointer ${
            filtroStatus === "COBERTO"
              ? "border-sky-400 ring-2 ring-sky-200 bg-sky-50/50"
              : "border-slate-200 hover:border-sky-200"
          }`}
          title="Clique para filtrar postos Cobertos"
        >
          <div className="text-[11px] font-semibold text-sky-700 uppercase tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
            <span>Postos Cobertos</span>
            {filtroStatus === "COBERTO" && <ChevronRight className="w-3 h-3 ml-auto text-sky-600" />}
          </div>
          <div className="mt-1.5 text-2xl font-bold text-sky-700 tabular-nums">{totalCobertos}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Substitutos confirmados</div>
        </button>

        {/* Descobertos — filtrável */}
        <button
          onClick={() => setFiltroStatus(filtroStatus === "DESCOBERTO" ? "TODOS" : "DESCOBERTO")}
          className={`bg-white p-3.5 rounded-lg border shadow-xs text-left w-full transition-all cursor-pointer ${
            filtroStatus === "DESCOBERTO"
              ? "border-rose-400 ring-2 ring-rose-200 bg-rose-50/50"
              : "border-slate-200 hover:border-rose-200"
          }`}
          title="Clique para filtrar postos Descobertos (Glosas)"
        >
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            <span>Descobertos (Glosas)</span>
            {filtroStatus === "DESCOBERTO" && <ChevronRight className="w-3 h-3 ml-auto text-rose-600" />}
          </div>
          <div className="mt-1.5 text-2xl font-bold text-rose-700 tabular-nums">{totalDescobertos}</div>
          <div className="text-[10px] text-rose-600 font-semibold mt-0.5">Gera desconto na medição</div>
        </button>

        {/* Taxa de Ocupação com barra de progresso */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs hover:border-premier-200 transition-colors">
          <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-premier-800 inline-block" />
            <span>Taxa de Ocupação</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold text-premier-900 tabular-nums">{taxaCumprimento}%</div>
          <div className="mt-1.5 w-full bg-slate-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                taxaCumprimento >= 90 ? "bg-emerald-500" : taxaCumprimento >= 75 ? "bg-amber-500" : "bg-rose-500"
              }`}
              style={{ width: `${taxaCumprimento}%` }}
            />
          </div>
        </div>
      </div>

      {/* Barra de Filtros Persistentes */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por posto, função, titular ou matrícula..."
            className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-400"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro de Base Operacional */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="font-semibold text-slate-600">Base:</span>
            <select
              value={filtroBase}
              onChange={(e) => setFiltroBase(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-semibold outline-none focus:ring-1 focus:ring-premier-600 max-w-[220px]"
            >
              <option value="TODAS">Todas as Bases ({BASES_SGP_SISTEMA.length})</option>
              {BASES_SGP_SISTEMA.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Competência */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Competência:</span>
            <select
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-semibold outline-none focus:ring-1 focus:ring-premier-600"
            >
              <option value="2026-09">Setembro / 2026 (Competência Vigente)</option>
              <option value="2026-08">Agosto / 2026</option>
              <option value="2026-07">Julho / 2026</option>
            </select>
          </div>

          {/* Filtro de Status */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Status:</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none focus:ring-1 focus:ring-premier-600"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="DESCOBERTO">Descobertos (Crítico / Glosa)</option>
              <option value="COBERTO">Cobertos por Substituto</option>
              <option value="TITULAR_PRESENTE">Titular Presente</option>
              <option value="POSTO_VAGO">Posto Vago</option>
              <option value="PENDENTE_APURACAO">Pendente Apuração</option>
            </select>
          </div>

          {/* Filtro de Escala */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Escala:</span>
            <select
              value={filtroEscala}
              onChange={(e) => setFiltroEscala(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none focus:ring-1 focus:ring-premier-600"
            >
              <option value="TODAS">Todas</option>
              <option value="5x2">5x2</option>
              <option value="12x36">12x36</option>
              <option value="6x1">6x1</option>
            </select>
          </div>

          {/* Botão Limpar Filtros — só aparece quando há filtros ativos */}
          {filtrosAtivos && (
            <button
              onClick={limparFiltros}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 px-2.5 py-1.5 rounded transition-colors"
              title="Limpar todos os filtros ativos"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Legenda do Mapa */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-3.5 bg-premier-900 rounded-full inline-block"></span>
            Legenda:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
          {/* Titular Presente */}
          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 px-2 py-1 rounded border border-slate-200/80 transition-colors">
            <span className="w-5 h-5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold flex items-center justify-center text-[10px] font-mono shadow-2xs">
              P
            </span>
            <span className="text-[11px] font-medium text-slate-700">Titular Presente</span>
          </div>

          {/* Coberto */}
          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 px-2 py-1 rounded border border-slate-200/80 transition-colors">
            <span className="w-5 h-5 rounded bg-sky-50 text-sky-700 border border-sky-300 font-bold flex items-center justify-center text-[10px] font-mono shadow-2xs">
              C
            </span>
            <span className="text-[11px] font-medium text-slate-700">Coberto</span>
          </div>

          {/* Descoberto */}
          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 px-2 py-1 rounded border border-slate-200/80 transition-colors">
            <span className="w-5 h-5 rounded bg-rose-50 text-rose-700 border border-rose-300 font-bold flex items-center justify-center text-[10px] font-mono shadow-2xs">
              D
            </span>
            <span className="text-[11px] font-medium text-slate-700">Descoberto <span className="text-rose-600 font-semibold">(Glosa)</span></span>
          </div>

          {/* Não Exigível */}
          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 px-2 py-1 rounded border border-slate-200/80 transition-colors">
            <span className="w-5 h-5 rounded bg-slate-50/60 text-slate-400 border border-slate-200 font-medium flex items-center justify-center text-[10px] font-mono">
              —
            </span>
            <span className="text-[11px] font-medium text-slate-600">Não Exigível <span className="text-slate-400">(Folga)</span></span>
          </div>

          {/* Posto Vago */}
          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 px-2 py-1 rounded border border-slate-200/80 transition-colors">
            <span className="w-5 h-5 rounded bg-amber-50/70 text-amber-700 border border-amber-200 font-bold flex items-center justify-center text-[10px] font-mono shadow-2xs">
              V
            </span>
            <span className="text-[11px] font-medium text-slate-700">Posto Vago</span>
          </div>

          {/* Pendente */}
          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 px-2 py-1 rounded border border-slate-200/80 transition-colors">
            <span className="w-5 h-5 rounded bg-slate-50/40 text-slate-400 border border-dashed border-slate-300 font-medium flex items-center justify-center text-[10px] font-mono">
              ?
            </span>
            <span className="text-[11px] font-medium text-slate-600">Aguardando Apuração</span>
          </div>

          {/* Feriado — novo */}
          <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            <span className="w-5 h-5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center justify-center text-[9px]">
              📅
            </span>
            <span className="text-[11px] font-medium text-amber-800">Feriado Nacional</span>
          </div>

          {/* Hoje */}
          <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded border border-blue-300">
            <span className="w-5 h-5 rounded bg-blue-600 text-white border border-blue-700 font-bold flex items-center justify-center text-[9px]">
              ★
            </span>
            <span className="text-[11px] font-medium text-blue-800">Hoje</span>
          </div>
        </div>
      </div>

      {/* Grade Central do Mapa de Ocupação */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto" ref={tabelaRef}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {/* Linha 1: Dias da Semana */}
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 text-[10px] font-bold">
                <th className="py-1 px-3 sticky left-0 z-20 bg-slate-100 min-w-[200px] border-r border-slate-300">
                  POSTO / FUNÇÃO CONTRATUAL
                </th>
                <th className="py-1 px-2 sticky left-[200px] z-20 bg-slate-100 min-w-[160px] border-r border-slate-300">
                  TITULAR OFICIAL
                </th>
                <th className="py-1 px-1.5 text-center min-w-[45px] border-r border-slate-300">
                  ESC
                </th>
                {diasDoMes.map((dia) => {
                  const fds = isFimDeSemana(dia);
                  const feriado = isFeriado(dia);
                  const hoje = isHoje(dia);
                  return (
                    <th
                      key={`sem-${dia}`}
                      ref={hoje ? (el) => { diaHojeRef.current = el; } : undefined}
                      className={`py-1.5 text-center min-w-[32px] w-8 border-r border-slate-200 text-[10px] ${
                        hoje
                          ? "bg-blue-600 text-white font-bold"
                          : feriado
                          ? "bg-amber-50 text-amber-900 font-bold border-b border-amber-200"
                          : fds
                          ? "bg-slate-100/70 text-slate-500 font-medium"
                          : "text-slate-500 font-semibold"
                      }`}
                    >
                      {getNomeDiaSemana(dia)}
                    </th>
                  );
                })}
              </tr>

              {/* Linha 2: Números dos Dias */}
              <tr className="bg-slate-50 border-b border-slate-300 text-slate-800 text-xs font-bold">
                <th className="py-2 px-3 sticky left-0 z-20 bg-slate-50 border-r border-slate-300">
                  Código do Posto
                </th>
                <th className="py-2 px-2 sticky left-[200px] z-20 bg-slate-50 border-r border-slate-300">
                  Matrícula e Nome
                </th>
                <th className="py-2 px-1.5 text-center border-r border-slate-300">
                  Jorn.
                </th>
                {diasDoMes.map((dia) => {
                  const fds = isFimDeSemana(dia);
                  const feriado = isFeriado(dia);
                  const hoje = isHoje(dia);
                  return (
                    <th
                      key={`num-${dia}`}
                      className={`py-2 text-center border-r border-slate-200 font-mono text-[11px] ${
                        hoje
                          ? "bg-blue-600 text-white font-bold"
                          : feriado
                          ? "bg-amber-100/70 text-amber-950 font-bold"
                          : fds
                          ? "bg-slate-100/70 text-slate-700 font-semibold"
                          : "text-slate-900"
                      }`}
                      title={
                        hoje
                          ? "Hoje"
                          : feriado
                          ? "07/09: Feriado Nacional - Independência"
                          : undefined
                      }
                    >
                      {String(dia).padStart(2, "0")}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {postosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={totalDiasNoMes + 3} className="py-12 text-center text-slate-500">
                    Nenhum posto atende aos critérios do filtro selecionado.
                    {filtrosAtivos && (
                      <button onClick={limparFiltros} className="ml-2 text-premier-700 underline text-xs hover:text-premier-900">
                        Limpar filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                postosFiltrados.map((posto) => {
                  const isVago = !posto.titularMatricula;
                  return (
                  <tr key={posto.id} className={`hover:bg-blue-50/30 transition-colors ${isVago ? "bg-amber-50/20" : ""}`}>
                    {/* Coluna Fixa 1: Posto */}
                    <td className={`py-2 px-3 sticky left-0 z-10 border-r border-slate-300 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${isVago ? "bg-amber-50/40" : "bg-white"}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-premier-900 text-[11px]">{posto.codigoPosto}</span>
                        {filtroBase === "TODAS" && (
                          <span className="text-[9px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            {posto.unidadeId || "UFN-III"}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-slate-700 truncate max-w-[180px]" title={posto.funcao}>
                        {posto.funcao}
                      </div>
                    </td>

                    {/* Coluna Fixa 2: Titular */}
                    <td className={`py-2 px-2 sticky left-[200px] z-10 border-r border-slate-300 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${isVago ? "bg-amber-50/40" : "bg-white"}`}>
                      {posto.titularMatricula ? (
                        <div>
                          <div className="font-semibold text-slate-900 truncate max-w-[140px]" title={posto.titularNome}>
                            {posto.titularNome}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">{posto.titularMatricula}</div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                          ⚠ POSTO VAGO
                        </span>
                      )}
                    </td>

                    {/* Coluna Escala */}
                    <td className="py-2 px-1 text-center font-mono text-[10px] font-bold text-slate-600 border-r border-slate-300">
                      {posto.escala}
                    </td>

                    {/* Colunas dos Dias */}
                    {diasDoMes.map((dia) => {
                      const detalhe = calcularStatusDia(
                        posto,
                        dia,
                        ano,
                        mesIdx,
                        ocorrencias,
                        coberturas,
                        apontamentos,
                        marcacoesSet,
                        dataRefLote || "2026-09-15"
                      );
                      const estilo = getCelulaEstilo(detalhe.statusOcupacao);
                      const fds = isFimDeSemana(dia);

                      const hoje = isHoje(dia);
                      return (
                        <td
                          key={dia}
                          onClick={() => setDetalheCelula(detalhe)}
                          className={`p-0.5 text-center border-r border-slate-200 cursor-pointer select-none transition-transform hover:scale-105 ${
                            hoje ? "bg-blue-50/60" : fds && detalhe.statusOcupacao === "NAO_EXIGIVEL" ? "bg-slate-100/50" : ""
                          }`}
                          title={`Dia ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")} - ${posto.codigoPosto} (${posto.funcao})\nBase: ${posto.unidadeNome || posto.unidadeId || "UFN III"}\nStatus: ${detalhe.statusOcupacao}\n${detalhe.motivoPublico}\nClique para ver evidências`}
                        >
                          <div
                            className={`w-7 h-7 mx-auto rounded flex items-center justify-center font-mono text-[11px] font-bold border transition-colors ${estilo.bg} ${hoje ? "ring-1 ring-blue-400" : ""}`}
                          >
                            {estilo.sigla}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé com contador de registros */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Exibindo{" "}
            <strong className="text-slate-700">{postosFiltrados.length}</strong>{" "}
            de{" "}
            <strong className="text-slate-700">{postosParaMetricas.length}</strong>{" "}
            postos
            {filtrosAtivos && (
              <span className="ml-1 text-premier-700 font-medium">(filtros ativos)</span>
            )}
          </span>
          <span className="text-[11px]">
            {filtroBase === "TODAS"
              ? `${BASES_SGP_SISTEMA.length} bases · ${totalDiasNoMes} dias · competência ${competencia}`
              : `${nomeBaseSelecionada} · ${totalDiasNoMes} dias · competência ${competencia}`}
          </span>
        </div>
      </div>

      {/* Drawer Lateral / Modal de Inspeção da Célula */}
      {detalheCelula && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-slideLeft overflow-y-auto">
            {/* Topo do Drawer */}
            <div>
              <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-blue-400" />
                    <h3 className="font-bold text-sm">Inspeção de Ocupação Diária</h3>
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Data: <strong>{detalheCelula.data}</strong> ({String(detalheCelula.diaNumero).padStart(2, "0")}/{String(mes).padStart(2, "0")}/{ano})
                  </div>
                </div>
                <button
                  onClick={() => setDetalheCelula(null)}
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Corpo do Drawer */}
              <div className="p-5 space-y-4 text-xs">
                {/* Status Oficial em Destaque */}
                <div className="p-3 rounded-lg border flex items-center justify-between bg-slate-50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Status Contratual Apurado
                    </span>
                    <div className="mt-1">
                      <BadgeStatus status={detalheCelula.statusOcupacao} tamanho="lg" />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-500 block">Integridade</span>
                    <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Auditado
                    </span>
                  </div>
                </div>

                {/* Dados do Posto */}
                <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Posto Operacional</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.5 rounded">
                        {detalheCelula.postoBase || "UFN III"}
                      </span>
                      <span className="font-mono font-bold text-premier-900 text-xs">
                        {detalheCelula.postoCodigo}
                      </span>
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900 text-sm">{detalheCelula.funcaoPosto}</div>
                </div>

                {/* Titular Oficial */}
                <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Titular Contratual</span>
                  {detalheCelula.titularNome ? (
                    <div>
                      <div className="font-bold text-slate-900">{detalheCelula.titularNome}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Matrícula: {detalheCelula.titularMatricula}
                      </div>
                    </div>
                  ) : (
                    <div className="text-orange-700 font-bold">Posto Vago (Sem titular alocado)</div>
                  )}
                </div>

                {/* Se Coberto: Substituto */}
                {detalheCelula.statusOcupacao === "COBERTO" && (
                  <div className="p-3 rounded bg-blue-50/70 border border-blue-200 space-y-1">
                    <span className="text-blue-800 font-bold uppercase text-[10px] flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Profissional Substituto em Campo</span>
                    </span>
                    <div className="font-bold text-blue-950 text-sm">{detalheCelula.ocupanteNome}</div>
                    <div className="text-[11px] font-mono text-blue-700">
                      Matrícula: {detalheCelula.ocupanteMatricula}
                    </div>
                  </div>
                )}

                {/* Se Descoberto: Alerta Crítico */}
                {detalheCelula.statusOcupacao === "DESCOBERTO" && (
                  <div className="p-3.5 rounded bg-rose-50 border border-rose-300 space-y-2 text-rose-900">
                    <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Inconformidade Contratual — Glosa Passível</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      O titular não compareceu ao posto e não houve cobertura tempestiva por profissional substituto da Premier.
                      Esta ausência fundamenta glosa de 1 diária contratual na Memória de Cálculo da Petrobras.
                    </p>
                    <div className="pt-2 border-t border-rose-200 flex items-center justify-between">
                      <span className="text-[10px] font-semibold">Impacto Financeiro:</span>
                      <span className="font-mono font-bold text-rose-800 text-xs">
                        Glosa de 1/30 avos do valor mensal do posto
                      </span>
                    </div>
                  </div>
                )}

                {/* Evidência Auditável / Motivo Público */}
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">
                    Evidência Pública & Justificativa (Auditável Petrobras)
                  </span>
                  <p className="mt-1 p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed text-[11px]">
                    {detalheCelula.motivoPublico}
                  </p>
                </div>

                {/* Registros de Ponto Apurados */}
                {detalheCelula.batidas && (
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Registro Eletrônico de Ponto (REP)</span>
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-[9px] text-slate-400 uppercase">Entrada</span>
                        <div className="font-mono font-bold text-slate-800">{detalheCelula.batidas.entrada}</div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-[9px] text-slate-400 uppercase">Saída</span>
                        <div className="font-mono font-bold text-slate-800">{detalheCelula.batidas.saida}</div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-[9px] text-slate-400 uppercase">Horas</span>
                        <div className="font-mono font-bold text-emerald-700">{detalheCelula.batidas.horas}h</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé de Ações do Drawer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 space-y-2">
              {detalheCelula.statusOcupacao === "DESCOBERTO" && (
                <div className="space-y-1.5">
                  <Link
                    href="/apontamentos"
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 rounded text-xs transition-colors shadow"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Abrir Apontamento da Fiscalização</span>
                  </Link>
                  <Link
                    href="/coberturas"
                    className="w-full inline-flex items-center justify-center gap-2 bg-premier-900 hover:bg-premier-800 text-white font-semibold py-2 rounded text-xs transition-colors shadow"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Designar Cobertura Retroativa</span>
                  </Link>
                </div>
              )}

              <button
                onClick={() => setDetalheCelula(null)}
                className="w-full py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 text-xs transition-colors"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
