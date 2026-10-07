"use client";

/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Tela de Presença Diária — Design Minimalista, Tipografia Unificada e Sem Excesso de Destaques
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  carregarEstado,
  obterMarcacoesPonto,
  obterDataReferenciaPonto,
  obterDiasFolgaPonto,
  registrarLogAuditoria,
  obterTodosPostosContrato,
  PostoOperacional,
} from "@/lib/dados/estado-operacional";
import { apurarPresencaEPostos } from "@/lib/servicos/apuracao-presenca";
import { carregarHorariosInterpretados, carregarCiclosColaboradores } from "@/lib/servicos/interpretador-horarios";
import { BASES_SGP_SISTEMA } from "@/lib/dados/secoes-horarios";
import { ApuracaoPresencaDiaria, SituacaoPresencaDiaria } from "@/lib/dados/ponto-tipos";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

/**
 * Unificação de estilos de texto: formata strings em Title Case,
 * mantendo preposições minúsculas e siglas contratuais em maiúsculo.
 */
function formatarTexto(str?: string): string {
  if (!str) return "—";
  const trim = str.trim();
  // Siglas curtas conhecidas ou códigos de posto
  if (/^[A-Z0-9-]{1,7}$/.test(trim)) return trim;
  const textoLimpo = trim.replace(/_/g, " ");
  const preposicoes = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "com", "na", "no"]);
  return textoLimpo
    .toLowerCase()
    .split(/\s+/)
    .map((palavra, idx) => {
      if (idx > 0 && preposicoes.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}

function formatarNome(nome?: string): string {
  if (!nome) return "—";
  return formatarTexto(nome);
}

function formatarBase(baseId?: string, baseNome?: string): { principal: string; detalhe?: string } {
  const mapaBases: Record<string, { principal: string; detalhe: string }> = {
    "UFN-III": { principal: "UFN-III", detalhe: "Três Lagoas / MS" },
    "REDUC": { principal: "REDUC", detalhe: "Duque de Caxias / RJ" },
    "RNEST": { principal: "RNEST", detalhe: "Abreu e Lima / PE" },
    "FAROL_SAO_TOME": { principal: "Farol de São Tomé", detalhe: "Campos dos Goytacazes / RJ" },
    "RIO_DE_JANEIRO": { principal: "Rio de Janeiro", detalhe: "Sede / EDIHB" },
    "SANTOS": { principal: "Santos", detalhe: "Terminal Santos / SP" },
    "CABO_FRIO": { principal: "Cabo Frio", detalhe: "Aeroporto Cabo Frio" },
    "MACAE": { principal: "Macaé", detalhe: "Base Macaé / RJ" },
    "MANAUS": { principal: "Manaus", detalhe: "Base Manaus / AM" },
    "ITAJAI": { principal: "Itajaí", detalhe: "Base Itajaí / SC" },
  };

  const chave = (baseId || "").toUpperCase();
  if (mapaBases[chave]) {
    return mapaBases[chave];
  }

  const principal = formatarTexto(baseId);
  const detalhe = baseNome && baseNome !== baseId ? formatarTexto(baseNome) : undefined;
  return { principal, detalhe };
}

export default function PresencaDiariaPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);

  // Inicia por padrão na data do último lote de ponto importado para exibir dados reais de imediato
  const [dataSelecionada, setDataSelecionada] = useState("2026-09-15");

  // Filtros essenciais
  const [baseFiltro, setBaseFiltro] = useState("TODAS");
  const [buscaTexto, setBuscaTexto] = useState("");
  const [abaPresenca, setAbaPresenca] = useState<"TODOS" | "PRESENTES" | "FALTAS" | "AUSENCIAS" | "VAGOS">("TODOS");

  const [apuracoesCompletas, setApuracoesCompletas] = useState<ApuracaoPresencaDiaria[]>([]);
  const [listaPostos, setListaPostos] = useState<PostoOperacional[]>([]);
  const [dataRefLote, setDataRefLote] = useState("2026-09-15 23:59");

  useEffect(() => {
    let ativo = true;

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sit = params.get("situacao")?.toUpperCase() || params.get("aba")?.toUpperCase();
      if (sit === "DESCOBERTO" || sit === "DESCOBERTOS" || sit === "FALTAS") {
        setAbaPresenca("FALTAS");
      }
    }

    async function carregarDadosPresenca() {
      const estado = carregarEstado();

      if (estado.perfilAtivo === "PETROBRAS_FISCAL") {
        router.replace("/painel");
        return;
      }

      registrarLogAuditoria(
        "ACESSO_TELA_PRESENCA_DIARIA",
        "PresencaDiaria",
        "Consulta às marcações diárias e apuração de frequência dos colaboradores.",
        estado.perfilAtivo || "PREMIER_ADMIN"
      );

      const todosPostos = obterTodosPostosContrato(estado.postos);
      if (ativo) {
        setListaPostos(todosPostos);
      }

      let marcacoes = obterMarcacoesPonto();
      let diasFolga = obterDiasFolgaPonto();
      let dataRef = obterDataReferenciaPonto();

      if (!marcacoes || marcacoes.length === 0) {
        try {
          const res = await fetch("/api/ponto");
          if (res.ok) {
            const data = await res.json();
            if (data.sucesso && Array.isArray(data.marcacoes) && data.marcacoes.length > 0) {
              marcacoes = data.marcacoes;
              diasFolga = data.diasFolgaRm || diasFolga;
              dataRef = data.dataReferencia || dataRef;
            }
          }
        } catch (err) {
          console.warn("Aviso: Falha ao carregar ponto via /api/ponto:", err);
        }
      }

      if (!ativo) return;

      if (dataRef) {
        setDataRefLote(dataRef);
        setDataSelecionada(dataRef.slice(0, 10));
      }

      const horarios = carregarHorariosInterpretados();
      const ciclos = carregarCiclosColaboradores();

      const resultado = apurarPresencaEPostos(
        estado.profissionais,
        marcacoes,
        estado.ocorrencias,
        estado.coberturas,
        estado.postos,
        {
          dataInicio: "2026-08-25",
          dataFim: "2026-09-30",
          dataReferenciaUltimoLote: dataRef,
          diasSemJornadaRm: diasFolga,
        },
        horarios,
        ciclos
      );

      if (!ativo) return;
      setApuracoesCompletas(resultado.apuracoesPorColaboradorDia);
      setCarregando(false);
    }

    carregarDadosPresenca();

    const handleAtualizacao = () => carregarDadosPresenca();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => {
      ativo = false;
      window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
    };
  }, [router]);

  // Postos 100% vagos
  const postosVagos = useMemo(() => {
    return listaPostos.filter((p) => !p.titularMatricula || !p.titularMatricula.trim());
  }, [listaPostos]);

  const postosVagosFiltrados = useMemo(() => {
    return postosVagos.filter((p) => {
      if (baseFiltro !== "TODAS") {
        const uId = p.unidadeId || "UFN-III";
        if (uId !== baseFiltro && !p.unidadeNome?.toLowerCase().includes(baseFiltro.toLowerCase())) {
          return false;
        }
      }
      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase();
        const matchCodigo = p.codigoPosto.toLowerCase().includes(termo);
        const matchFuncao = p.funcao.toLowerCase().includes(termo);
        const matchBase = (p.unidadeNome || p.unidadeId || "").toLowerCase().includes(termo);
        if (!matchCodigo && !matchFuncao && !matchBase) return false;
      }
      return true;
    });
  }, [postosVagos, baseFiltro, buscaTexto]);

  // Apurações do dia
  const apuracoesDoDia = useMemo(() => {
    return apuracoesCompletas.filter((ap) => {
      if (ap.data !== dataSelecionada) return false;
      if (baseFiltro !== "TODAS" && ap.baseId !== baseFiltro) return false;

      if (abaPresenca === "PRESENTES" && ap.situacao !== "PRESENTE") return false;
      if (abaPresenca === "FALTAS" && ap.situacao !== "FALTA") return false;
      if (
        abaPresenca === "AUSENCIAS" &&
        ap.situacao !== "AUSENCIA_JUSTIFICADA" &&
        ap.situacao !== "FERIAS_AFASTADO_LICENCA"
      )
        return false;

      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase();
        const nomeMatch = ap.nomeColaborador.toLowerCase().includes(termo);
        const chapaMatch = ap.chapa.includes(termo);
        const postoMatch = (ap.postoCodigo || "").toLowerCase().includes(termo);
        const funcaoMatch = (ap.funcao || "").toLowerCase().includes(termo);
        if (!nomeMatch && !chapaMatch && !postoMatch && !funcaoMatch) return false;
      }
      return true;
    });
  }, [apuracoesCompletas, dataSelecionada, baseFiltro, abaPresenca, buscaTexto]);

  // Contadores simples
  const totaisDia = useMemo(() => {
    const doDia = apuracoesCompletas.filter((ap) => ap.data === dataSelecionada);
    return {
      total: doDia.length,
      presentes: doDia.filter((a) => a.situacao === "PRESENTE").length,
      faltas: doDia.filter((a) => a.situacao === "FALTA").length,
      ausencias: doDia.filter(
        (a) => a.situacao === "AUSENCIA_JUSTIFICADA" || a.situacao === "FERIAS_AFASTADO_LICENCA"
      ).length,
    };
  }, [apuracoesCompletas, dataSelecionada]);

  // Taxa de presença calculada do dia
  const taxaPresenca = useMemo(() => {
    if (totaisDia.total === 0) return 0;
    return Math.round((totaisDia.presentes / totaisDia.total) * 100);
  }, [totaisDia]);

  // Navegação de data
  const navegarData = useCallback((direcao: -1 | 1) => {
    setDataSelecionada((prev) => {
      const d = new Date(prev + "T12:00:00");
      d.setDate(d.getDate() + direcao);
      return d.toISOString().slice(0, 10);
    });
  }, []);

  // Exportação Excel
  const handleExportarPresencaXlsx = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      if (abaPresenca === "VAGOS") {
        const linhasVagos = postosVagosFiltrados.map((p) => ({
          "Código Posto": p.codigoPosto,
          "Função": formatarTexto(p.funcao),
          "Base": formatarBase(p.unidadeId, p.unidadeNome).principal,
          "Escala": p.escala,
          "Horário": `${p.horarioInicio} às ${p.horarioFim}`,
          "Situação": "100% Vago",
        }));
        const ws = XLSX.utils.json_to_sheet(linhasVagos);
        XLSX.utils.book_append_sheet(wb, ws, "Postos_Vagos");
        XLSX.writeFile(wb, `Postos_Vagos_${dataSelecionada}.xlsx`);
        return;
      }

      const linhas = apuracoesDoDia.map((item) => ({
        "Data": item.data,
        "Chapa": item.chapa,
        "Colaborador": formatarNome(item.nomeColaborador),
        "CPF": item.cpfMascarado,
        "Base": formatarBase(item.baseId, item.baseNome).principal,
        "Posto": item.postoCodigo || "Sem posto",
        "Função": formatarTexto(item.funcao),
        "Jornada": item.jornadaPrevista ? `${item.jornadaPrevista.horaInicio} às ${item.jornadaPrevista.horaFim}` : "—",
        "Marcações": item.marcacoesDoDia.map((m) => m.horaLocal).join(" - ") || "—",
        "Situação": formatarSituacaoTexto(item.situacao),
        "Observações": item.abonoVinculado?.observacaoPublica || item.observacaoGestao?.texto || "",
      }));

      const ws = XLSX.utils.json_to_sheet(linhas);
      XLSX.utils.book_append_sheet(wb, ws, `Presenca_${dataSelecionada}`);
      XLSX.writeFile(wb, `Presenca_${dataSelecionada}.xlsx`);
    } catch {
      // Fallback CSV
      let csv = "Data;Chapa;Colaborador;Base;Posto;Situacao\n";
      apuracoesDoDia.forEach((item) => {
        csv += `"${item.data}";"${item.chapa}";"${formatarNome(item.nomeColaborador)}";"${item.baseNome}";"${item.postoCodigo || "Sem posto"}";"${formatarSituacaoTexto(item.situacao)}"\n`;
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Presenca_${dataSelecionada}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  function formatarSituacaoTexto(sit: SituacaoPresencaDiaria): string {
    switch (sit) {
      case "PRESENTE":
        return "Presente";
      case "FALTA":
        return "Falta";
      case "AUSENCIA_JUSTIFICADA":
        return "Abono";
      case "FERIAS_AFASTADO_LICENCA":
        return "Férias / Afastado";
      case "FOLGA_ESCALA":
        return "Folga";
      case "MARCACAO_INCOMPLETA":
        return "Marcação incompleta";
      case "ESCALA_NAO_CONFIRMADA":
        return "Escala não confirmada";
      case "DESLIGADO":
        return "Desligado";
      case "SEM_DADO":
        return "Aguardando lote";
      default:
        return formatarTexto(sit);
    }
  }

  function renderSituacaoTexto(sit: SituacaoPresencaDiaria) {
    switch (sit) {
      case "PRESENTE":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            Presente
          </span>
        );
      case "FALTA":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            Falta
          </span>
        );
      case "AUSENCIA_JUSTIFICADA":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            Abono
          </span>
        );
      case "FERIAS_AFASTADO_LICENCA":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            Férias / Afastado
          </span>
        );
      case "FOLGA_ESCALA":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            Folga
          </span>
        );
      case "MARCACAO_INCOMPLETA":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Marcação incompleta
          </span>
        );
      case "ESCALA_NAO_CONFIRMADA":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Escala não confirmada
          </span>
        );
      case "DESLIGADO":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
            Desligado
          </span>
        );
      case "SEM_DADO":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
            Aguardando lote
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            {formatarTexto(sit)}
          </span>
        );
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-10 max-w-full mx-auto">
      {/* 1. Cabeçalho Limpo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Presença Diária</h1>
          <p className="text-xs text-slate-500">Apuração de colaboradores e postos contratuais</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de retorno rápido para Data do Lote */}
          <button
            onClick={() => {
              const loteDate = dataRefLote ? dataRefLote.slice(0, 10) : new Date().toISOString().slice(0, 10);
              setDataSelecionada(loteDate);
            }}
            className="h-8 px-2.5 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-[#344054] text-xs font-medium shadow-2xs transition-colors cursor-pointer"
            title="Ir para a data do lote apurado"
          >
            Data do Lote
          </button>

          {/* Navegador de Data */}
          <div className="flex items-center bg-white border border-[#D0D5DD] rounded-lg shadow-2xs h-8">
            <button
              onClick={() => navegarData(-1)}
              className="px-2 h-full hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer"
              title="Dia anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="px-2 py-1 text-xs font-medium text-slate-700 bg-transparent border-none outline-none cursor-pointer"
            />
            <button
              onClick={() => navegarData(1)}
              className="px-2 h-full hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer"
              title="Próximo dia"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleExportarPresencaXlsx}
            className="h-8 px-3 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] hover:border-[#1F4FD1] text-[#344054] hover:text-[#1F4FD1] text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Filtros Unificada (Segmented Control Executivo) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 py-1">
        {/* Abas com Segmented Control Moderno e Limpo */}
        <div className="flex items-center gap-1 bg-[#F4F5F8] p-1 rounded-lg border border-[#E3E6EB]">
          <button
            onClick={() => setAbaPresenca("TODOS")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
              abaPresenca === "TODOS"
                ? "bg-white text-[#1A2230] shadow-2xs font-semibold"
                : "text-[#5B6474] hover:text-[#1A2230] hover:bg-white/50"
            }`}
          >
            <span>Todos</span>
            <span className={`ml-1.5 text-xs font-mono ${abaPresenca === "TODOS" ? "text-[#1A2230] font-bold" : "text-[#858D9D]"}`}>
              ({totaisDia.total})
            </span>
          </button>

          <button
            onClick={() => setAbaPresenca("PRESENTES")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
              abaPresenca === "PRESENTES"
                ? "bg-white text-[#1A2230] shadow-2xs font-semibold"
                : "text-[#5B6474] hover:text-[#1A2230] hover:bg-white/50"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
            <span>Presentes</span>
            <span className={`ml-1 text-xs font-mono ${abaPresenca === "PRESENTES" ? "text-emerald-700 font-bold" : "text-[#858D9D]"}`}>
              ({totaisDia.presentes})
            </span>
          </button>

          <button
            onClick={() => setAbaPresenca("FALTAS")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
              abaPresenca === "FALTAS"
                ? "bg-white text-[#1A2230] shadow-2xs font-semibold"
                : "text-[#5B6474] hover:text-[#1A2230] hover:bg-white/50"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0" />
            <span>Faltas</span>
            <span className={`ml-1 text-xs font-mono ${abaPresenca === "FALTAS" ? "text-rose-700 font-bold" : "text-[#858D9D]"}`}>
              ({totaisDia.faltas})
            </span>
          </button>

          <button
            onClick={() => setAbaPresenca("AUSENCIAS")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
              abaPresenca === "AUSENCIAS"
                ? "bg-white text-[#1A2230] shadow-2xs font-semibold"
                : "text-[#5B6474] hover:text-[#1A2230] hover:bg-white/50"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5 shrink-0" />
            <span>Ausências</span>
            <span className={`ml-1 text-xs font-mono ${abaPresenca === "AUSENCIAS" ? "text-indigo-700 font-bold" : "text-[#858D9D]"}`}>
              ({totaisDia.ausencias})
            </span>
          </button>

          <button
            onClick={() => setAbaPresenca("VAGOS")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
              abaPresenca === "VAGOS"
                ? "bg-white text-[#1A2230] shadow-2xs font-semibold"
                : "text-[#5B6474] hover:text-[#1A2230] hover:bg-white/50"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
            <span>100% Vagos</span>
            <span className={`ml-1 text-xs font-mono ${abaPresenca === "VAGOS" ? "text-amber-700 font-bold" : "text-[#858D9D]"}`}>
              ({postosVagos.length})
            </span>
          </button>
        </div>

        {/* Busca e Base em Linha Direta */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
          <div className="flex items-center gap-1.5 border border-[#D0D5DD] rounded-lg px-2.5 py-1.5 bg-white focus-within:border-[#1F4FD1] text-xs w-full sm:w-60 shadow-2xs">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar colaborador ou posto..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-400 text-xs"
            />
            {buscaTexto && (
              <button onClick={() => setBuscaTexto("")} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={baseFiltro}
            onChange={(e) => setBaseFiltro(e.target.value)}
            className="border border-[#D0D5DD] rounded-lg px-2.5 py-1.5 bg-white text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer shadow-2xs"
          >
            <option value="TODAS">Todas as Bases</option>
            {BASES_SGP_SISTEMA.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mini-Resumo Executivo */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 bg-[#F8F9FC] border border-[#E3E6EB] rounded-lg text-xs">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[#344054]">
          <div className="flex items-center gap-1.5">
            <span className="text-[#667085]">Taxa de Presença:</span>
            <span className="font-semibold text-[#1A2230] font-mono">{taxaPresenca}%</span>
          </div>
          <span className="hidden sm:inline text-[#D0D5DD]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-[#1A2230] font-mono">{totaisDia.presentes}</span>
            <span className="text-[#667085]">presentes</span>
          </div>
          <span className="hidden sm:inline text-[#D0D5DD]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="font-semibold text-[#1A2230] font-mono">{totaisDia.faltas}</span>
            <span className="text-[#667085]">faltas</span>
          </div>
          <span className="hidden sm:inline text-[#D0D5DD]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="font-semibold text-[#1A2230] font-mono">{postosVagos.length}</span>
            <span className="text-[#667085]">postos vagos</span>
          </div>
        </div>

        <div className="text-[11px] text-[#667085]">
          Lote apurado: <span className="font-mono text-[#344054] font-medium">{dataRefLote}</span>
        </div>
      </div>

      {/* 3. Tabela Limpa, com Tipografia Unificada */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
              <tr>
                <th className="px-4 py-2.5">Colaborador</th>
                <th className="px-3 py-2.5">Posto</th>
                <th className="px-3 py-2.5">Base</th>
                <th className="px-3 py-2.5">Jornada</th>
                <th className="px-3 py-2.5">Marcações</th>
                <th className="px-3 py-2.5">Situação</th>
                <th className="px-3 py-2.5">Observação</th>
                <th className="px-3 py-2.5 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Visão de Postos 100% Vagos */}
              {abaPresenca === "VAGOS" ? (
                postosVagosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhum posto vago encontrado.
                    </td>
                  </tr>
                ) : (
                  postosVagosFiltrados.map((p) => {
                    const baseInfo = formatarBase(p.unidadeId, p.unidadeNome);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="text-slate-400 italic">Sem titular alocado</span>
                        </td>
                        {/* Posto */}
                        <td className="px-3 py-2.5">
                          <div className="font-mono text-slate-800 text-[11px] font-medium">
                            {p.codigoPosto}
                          </div>
                          <div className="text-slate-500 text-[11px] truncate max-w-[180px]" title={p.funcao}>
                            {formatarTexto(p.funcao)}
                          </div>
                        </td>
                        {/* Base */}
                        <td className="px-3 py-2.5">
                          <div className="text-slate-800 font-medium text-xs">
                            {baseInfo.principal}
                          </div>
                          {baseInfo.detalhe && (
                            <div className="text-slate-400 text-[10px] truncate max-w-[140px]" title={p.unidadeNome}>
                              {baseInfo.detalhe}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">
                          {p.horarioInicio} - {p.horarioFim}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400">—</td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-medium text-amber-800">
                            100% Vago
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 text-[11px]">Posto sem titular</td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => router.push("/coberturas")}
                            className="h-7 px-2.5 rounded-md border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] hover:border-[#1F4FD1] text-[#344054] hover:text-[#1F4FD1] text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <span>Cobrir</span>
                            <ArrowRight className="w-3 h-3 text-[#667085]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                /* Visão Normal de Apuração */
                apuracoesDoDia.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhum registro encontrado para esta data.
                    </td>
                  </tr>
                ) : (
                  apuracoesDoDia.map((item) => {
                    const baseInfo = formatarBase(item.baseId, item.baseNome);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Colaborador */}
                        <td className="px-4 py-2.5">
                          <div className="text-slate-900 font-medium text-xs">
                            {formatarNome(item.nomeColaborador)}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Matrícula: {item.chapa}
                          </div>
                        </td>

                        {/* Posto — Sem destaque pesado quando não alocado */}
                        <td className="px-3 py-2.5">
                          {item.postoCodigo ? (
                            <>
                              <div className="font-mono text-slate-800 text-[11px] font-medium">
                                {item.postoCodigo}
                              </div>
                              <div className="text-slate-500 text-[11px] truncate max-w-[180px]" title={item.funcao || ""}>
                                {formatarTexto(item.funcao)}
                              </div>
                            </>
                          ) : (
                            <div className="text-slate-400 text-xs italic">Sem posto vinculado</div>
                          )}
                        </td>

                        {/* Base — Nomes limpos e sem underscores */}
                        <td className="px-3 py-2.5">
                          <div className="text-slate-800 font-medium text-xs">
                            {baseInfo.principal}
                          </div>
                          {baseInfo.detalhe && (
                            <div className="text-slate-400 text-[10px] truncate max-w-[140px]" title={item.baseNome}>
                              {baseInfo.detalhe}
                            </div>
                          )}
                        </td>

                        {/* Jornada */}
                        <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">
                          {item.jornadaPrevista ? (
                            <>
                              <div>{item.jornadaPrevista.horaInicio} - {item.jornadaPrevista.horaFim}</div>
                              <div className="text-[10px] text-slate-400 font-sans">{item.jornadaPrevista.tipoEscala}</div>
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Marcações com Detecção de Batida Ímpar */}
                        <td className="px-3 py-2.5 font-mono text-slate-700">
                          {item.marcacoesDoDia.length === 0 ? (
                            <span className="text-slate-400 font-sans text-xs">—</span>
                          ) : (
                            <div>
                              <div>{item.marcacoesDoDia.map((m) => m.horaLocal).join("  •  ")}</div>
                              {item.marcacoesDoDia.length % 2 !== 0 && (
                                <div className="text-[10px] text-amber-700 font-sans flex items-center gap-1 mt-0.5">
                                  <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span>Batida ímpar (falta saída)</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Situação — Tipografia unificada em Title Case */}
                        <td className="px-3 py-2.5">
                          {renderSituacaoTexto(item.situacao)}
                          {item.indicadores.entradaAposHorario && (
                            <div className="text-[10px] text-amber-600 mt-0.5">Entrada c/ atraso</div>
                          )}
                        </td>

                        {/* Observação */}
                        <td className="px-3 py-2.5 text-slate-500 text-[11px] max-w-[180px] truncate" title={item.abonoVinculado?.observacaoPublica || item.observacaoGestao?.texto || ""}>
                          {item.abonoVinculado?.observacaoPublica?.replace(/^Abono\/Ocorrência:\s*/i, "") || item.observacaoGestao?.texto || "—"}
                        </td>

                        {/* Ação */}
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => router.push(`/profissionais/${item.colaboradorId}/espelho-ponto`)}
                            className="h-7 px-2.5 rounded-md border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] hover:border-[#1F4FD1] text-[#344054] hover:text-[#1F4FD1] text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Visualizar espelho de ponto"
                          >
                            <FileText className="w-3 h-3 text-[#667085]" />
                            <span>Espelho</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé Compacto */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-between">
          <span>
            {abaPresenca === "VAGOS"
              ? `${postosVagosFiltrados.length} postos vagos`
              : `${apuracoesDoDia.length} colaboradores exibidos`}
          </span>
          <span>Data de referência: {dataSelecionada.split("-").reverse().join("/")}</span>
        </div>
      </div>
    </div>
  );
}
