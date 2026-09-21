"use client";

/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Tela de Presença Diária por Colaborador e Posto
 *
 * Exclusivo para perfis Premier (Admin, Gestor, RH).
 * Fiscal Petrobras tem visualização estritamente segregada via Mapa de Ocupação.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  carregarEstado,
  obterMarcacoesPonto,
  obterDataReferenciaPonto,
  obterDiasFolgaPonto,
  registrarLogAuditoria,
} from "@/lib/dados/estado-operacional";
import { apurarPresencaEPostos } from "@/lib/servicos/apuracao-presenca";
import { carregarHorariosInterpretados, carregarCiclosColaboradores } from "@/lib/servicos/interpretador-horarios";
import { BASES_SGP_SISTEMA } from "@/lib/dados/secoes-horarios";
import { ApuracaoPresencaDiaria, SituacaoPresencaDiaria } from "@/lib/dados/ponto-tipos";
import {
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  CalendarOff,
  Plane,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Search,
  X,
  Download,
  FilterX,
  Calendar,
} from "lucide-react";

export default function PresencaDiariaPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [perfilAtivo, setPerfilAtivo] = useState("PREMIER_ADMIN");

  // Data padrão dinâmica = hoje
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
  });

  // Filtros
  const [baseFiltro, setBaseFiltro] = useState("TODAS");
  const [situacaoFiltro, setSituacaoFiltro] = useState("TODAS");
  const [filtroSemPosto, setFiltroSemPosto] = useState(false);
  const [buscaTexto, setBuscaTexto] = useState("");

  const [apuracoesCompletas, setApuracoesCompletas] = useState<ApuracaoPresencaDiaria[]>([]);
  const [dataRefLote, setDataRefLote] = useState("2026-09-15 23:59");

  useEffect(() => {
    let ativo = true;

    async function carregarDadosPresenca() {
      const estado = carregarEstado();
      setPerfilAtivo(estado.perfilAtivo || "PREMIER_ADMIN");

      // Segregação estrita LGPD e RBAC: Fiscal Petrobras não acessa marcações individuais
      if (estado.perfilAtivo === "PETROBRAS_FISCAL") {
        router.replace("/painel");
        return;
      }

      // Registra acesso na auditoria
      registrarLogAuditoria(
        "ACESSO_TELA_PRESENCA_DIARIA",
        "PresencaDiaria",
        "Consulta às marcações diárias e apuração de frequência dos colaboradores.",
        estado.perfilAtivo || "PREMIER_ADMIN"
      );

      let marcacoes = obterMarcacoesPonto();
      let diasFolga = obterDiasFolgaPonto();
      let dataRef = obterDataReferenciaPonto();

      // Se as marcações não estiverem em memória no cliente, busca da API /api/ponto
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

      setDataRefLote(dataRef);

      const horarios = carregarHorariosInterpretados();
      const ciclos = carregarCiclosColaboradores();

      // Executa a apuração cobrindo desde o final de agosto até o fim de setembro de 2026
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

    const handleAtualizacao = () => {
      carregarDadosPresenca();
    };
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => {
      ativo = false;
      window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
    };
  }, [router]);

  // Data de referência do lote no formato YYYY-MM-DD
  const dataRefLoteIso = useMemo(() => {
    return dataRefLote.slice(0, 10);
  }, [dataRefLote]);

  // Filtra as apurações para o dia e filtros ativos
  const apuracoesDoDia = useMemo(() => {
    return apuracoesCompletas.filter((ap) => {
      if (ap.data !== dataSelecionada) return false;
      if (baseFiltro !== "TODAS" && ap.baseId !== baseFiltro) return false;
      if (situacaoFiltro !== "TODAS" && ap.situacao !== situacaoFiltro) return false;
      if (filtroSemPosto && ap.postoCodigo) return false;
      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase();
        const nomeMatch = ap.nomeColaborador.toLowerCase().includes(termo);
        const chapaMatch = ap.chapa.includes(termo);
        const postoMatch = (ap.postoCodigo || "").toLowerCase().includes(termo);
        if (!nomeMatch && !chapaMatch && !postoMatch) return false;
      }
      return true;
    });
  }, [apuracoesCompletas, dataSelecionada, baseFiltro, situacaoFiltro, filtroSemPosto, buscaTexto]);

  // Contadores do dia selecionado (baseados em todos os colaboradores naquele dia)
  const totaisDia = useMemo(() => {
    const doDia = apuracoesCompletas.filter((ap) => ap.data === dataSelecionada);
    return {
      total: doDia.length,
      presentes: doDia.filter((a) => a.situacao === "PRESENTE").length,
      justificadas: doDia.filter((a) => a.situacao === "AUSENCIA_JUSTIFICADA").length,
      faltas: doDia.filter((a) => a.situacao === "FALTA").length,
      incompletas: doDia.filter((a) => a.situacao === "MARCACAO_INCOMPLETA").length,
      folgas: doDia.filter((a) => a.situacao === "FOLGA_ESCALA").length,
      feriasAfastados: doDia.filter((a) => a.situacao === "FERIAS_AFASTADO_LICENCA").length,
      semDado: doDia.filter((a) => a.situacao === "SEM_DADO").length,
      semPosto: doDia.filter((a) => !a.postoCodigo).length,
    };
  }, [apuracoesCompletas, dataSelecionada]);

  // Navegação de data
  const navegarData = useCallback((direcao: -1 | 1) => {
    setDataSelecionada((prev) => {
      const d = new Date(prev + "T12:00:00");
      d.setDate(d.getDate() + direcao);
      return d.toISOString().slice(0, 10);
    });
  }, []);

  const irParaHoje = useCallback(() => {
    const h = new Date();
    setDataSelecionada(`${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`);
  }, []);

  const irParaOntem = useCallback(() => {
    const h = new Date();
    h.setDate(h.getDate() - 1);
    setDataSelecionada(`${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`);
  }, []);

  const irParaUltimoLote = useCallback(() => {
    if (dataRefLoteIso) {
      setDataSelecionada(dataRefLoteIso);
    }
  }, [dataRefLoteIso]);

  const hojeStr = useMemo(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
  }, []);

  const isHoje = dataSelecionada === hojeStr;
  const isPosteriorLote = dataSelecionada > dataRefLoteIso;

  // Verifica se algum filtro está ativo
  const filtrosAtivos = useMemo(
    () => baseFiltro !== "TODAS" || situacaoFiltro !== "TODAS" || filtroSemPosto || buscaTexto.trim() !== "",
    [baseFiltro, situacaoFiltro, filtroSemPosto, buscaTexto]
  );

  const limparFiltros = () => {
    setBaseFiltro("TODAS");
    setSituacaoFiltro("TODAS");
    setFiltroSemPosto(false);
    setBuscaTexto("");
  };

  // Exportação para XLSX real com fallback CSV
  const handleExportarPresencaXlsx = async () => {
    try {
      const XLSX = await import("xlsx");
      const linhas = apuracoesDoDia.map((item) => ({
        "Data": item.data,
        "Chapa": item.chapa,
        "Nome do Colaborador": item.nomeColaborador,
        "CPF": item.cpfMascarado,
        "Base Operacional": item.baseNome,
        "Código Posto": item.postoCodigo || "SEM POSTO VINCULADO",
        "Jornada Prevista": item.jornadaPrevista
          ? `${item.jornadaPrevista.horaInicio} às ${item.jornadaPrevista.horaFim} (${item.jornadaPrevista.tipoEscala})`
          : "Sem jornada prevista",
        "Marcações Locais": item.marcacoesDoDia.map((m) => m.horaLocal).join("  |  ") || "Sem marcações",
        "Situação Apurada": item.situacao,
        "Indicadores": [
          item.indicadores.entradaAposHorario ? "Entrada após horário" : "",
          item.indicadores.saidaAntesHorario ? "Saída antes horário" : "",
          item.indicadores.abonoParcial ? "Abono parcial" : "",
        ].filter(Boolean).join(", ") || "Normal",
        "Observação / Justificativa": item.abonoVinculado?.observacaoPublica || item.observacaoGestao?.texto || "",
      }));

      const ws = XLSX.utils.json_to_sheet(linhas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Presenca_${dataSelecionada}`);
      ws["!cols"] = [
        { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 16 }, { wch: 22 },
        { wch: 22 }, { wch: 25 }, { wch: 28 }, { wch: 24 }, { wch: 24 }, { wch: 45 },
      ];
      XLSX.writeFile(wb, `Presenca_Diaria_${dataSelecionada}.xlsx`);
    } catch {
      // Fallback CSV
      let csv = "Data;Chapa;Nome;CPF;Base;Posto;Jornada;Marcacoes;Situacao;Indicadores;Observacoes\n";
      apuracoesDoDia.forEach((item) => {
        csv += `"${item.data}";"${item.chapa}";"${item.nomeColaborador}";"${item.cpfMascarado}";"${item.baseNome}";"${item.postoCodigo || "SEM POSTO"}";"${item.jornadaPrevista ? `${item.jornadaPrevista.horaInicio}-${item.jornadaPrevista.horaFim}` : ""}";"${item.marcacoesDoDia.map((m) => m.horaLocal).join(" ")}";"${item.situacao}";"";""\n`;
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Presenca_Diaria_${dataSelecionada}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  function getBadgeSituacao(sit: SituacaoPresencaDiaria) {
    switch (sit) {
      case "PRESENTE":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle className="w-3 h-3" /> Presente
          </span>
        );
      case "AUSENCIA_JUSTIFICADA":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
            <CalendarOff className="w-3 h-3" /> Aus. Justificada
          </span>
        );
      case "FALTA":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" /> Falta
          </span>
        );
      case "MARCACAO_INCOMPLETA":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Marc. Incompleta
          </span>
        );
      case "FOLGA_ESCALA":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" /> Folga da Escala
          </span>
        );
      case "FERIAS_AFASTADO_LICENCA":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <Plane className="w-3 h-3" /> Férias / Afastado
          </span>
        );
      case "ESCALA_NAO_CONFIRMADA":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Escala não conf.
          </span>
        );
      case "SEM_DADO":
        return <span className="text-xs font-medium text-slate-400">Aguardando Lote</span>;
      case "DESLIGADO":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" /> Desligado
          </span>
        );
      default:
        return <span className="text-xs font-medium text-slate-700">{sit}</span>;
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-full mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold tracking-tight text-premier-900">Presença Diária dos Colaboradores</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
              Momento 4
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Apuração diária de presença, turnos e evidências de cumprimento para gestão de cobertura contratual Petrobras.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md">
            <span className="text-slate-500">Ponto importado até:</span>
            <div className="font-semibold text-slate-800 font-mono">{dataRefLote}</div>
          </div>

          <button
            onClick={handleExportarPresencaXlsx}
            className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-3 py-2 rounded shadow transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Lista (XLSX)</span>
          </button>
        </div>
      </div>

      {/* Alerta de Lote quando a data for posterior ao último lote importado */}
      {isPosteriorLote && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Você está visualizando a data <strong>{dataSelecionada}</strong>. As marcações reais de ponto do sistema RM foram importadas até <strong>{dataRefLote}</strong>.
            </span>
          </div>
          <button
            onClick={irParaUltimoLote}
            className="underline font-semibold hover:text-amber-950 shrink-0 ml-2"
          >
            Ver último dia importado ({dataRefLoteIso})
          </button>
        </div>
      )}

      {/* Cards de Resumo do Dia — clicáveis como filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Presentes */}
        <button
          onClick={() => setSituacaoFiltro(situacaoFiltro === "PRESENTE" ? "TODAS" : "PRESENTE")}
          className={`p-3 rounded-lg border shadow-xs text-left w-full transition-all cursor-pointer ${
            situacaoFiltro === "PRESENTE"
              ? "border-emerald-400 ring-2 ring-emerald-200 bg-emerald-50"
              : "bg-white border-slate-200 hover:border-emerald-200"
          }`}
          title="Clique para filtrar apenas colaboradores Presentes"
        >
          <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-500" /> Presentes
          </span>
          <div className="text-2xl font-bold text-emerald-600 mt-1 tabular-nums">{totaisDia.presentes}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Entrada e saída ok</div>
        </button>

        {/* Ausência Justificada */}
        <button
          onClick={() => setSituacaoFiltro(situacaoFiltro === "AUSENCIA_JUSTIFICADA" ? "TODAS" : "AUSENCIA_JUSTIFICADA")}
          className={`p-3 rounded-lg border shadow-xs text-left w-full transition-all cursor-pointer ${
            situacaoFiltro === "AUSENCIA_JUSTIFICADA"
              ? "border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50"
              : "bg-white border-slate-200 hover:border-indigo-200"
          }`}
          title="Clique para filtrar ausências justificadas"
        >
          <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
            <CalendarOff className="w-3 h-3 text-indigo-500" /> Aus. Justif.
          </span>
          <div className="text-2xl font-bold text-indigo-600 mt-1 tabular-nums">{totaisDia.justificadas}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Abono formal</div>
        </button>

        {/* Faltas */}
        <button
          onClick={() => setSituacaoFiltro(situacaoFiltro === "FALTA" ? "TODAS" : "FALTA")}
          className={`p-3 rounded-lg border shadow-xs text-left w-full transition-all cursor-pointer ${
            situacaoFiltro === "FALTA"
              ? "border-rose-400 ring-2 ring-rose-200 bg-rose-50"
              : "bg-white border-slate-200 hover:border-rose-200"
          }`}
          title="Clique para filtrar faltas sem abono"
        >
          <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-500" /> Faltas
          </span>
          <div className="text-2xl font-bold text-rose-600 mt-1 tabular-nums">{totaisDia.faltas}</div>
          <div className="text-[10px] text-rose-600 font-semibold mt-0.5">Sem justificativa</div>
        </button>

        {/* Marcações Incompletas */}
        <button
          onClick={() => setSituacaoFiltro(situacaoFiltro === "MARCACAO_INCOMPLETA" ? "TODAS" : "MARCACAO_INCOMPLETA")}
          className={`p-3 rounded-lg border shadow-xs text-left w-full transition-all cursor-pointer ${
            situacaoFiltro === "MARCACAO_INCOMPLETA"
              ? "border-amber-400 ring-2 ring-amber-200 bg-amber-50"
              : "bg-white border-slate-200 hover:border-amber-200"
          }`}
          title="Clique para filtrar marcações incompletas"
        >
          <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Incompletas
          </span>
          <div className="text-2xl font-bold text-amber-600 mt-1 tabular-nums">{totaisDia.incompletas}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Apenas 1 batida</div>
        </button>

        {/* Folgas de Escala */}
        <button
          onClick={() => setSituacaoFiltro(situacaoFiltro === "FOLGA_ESCALA" ? "TODAS" : "FOLGA_ESCALA")}
          className={`p-3 rounded-lg border shadow-xs text-left w-full transition-all cursor-pointer ${
            situacaoFiltro === "FOLGA_ESCALA"
              ? "border-slate-400 ring-2 ring-slate-200 bg-slate-50"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
          title="Clique para filtrar folgas de escala"
        >
          <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" /> Folgas
          </span>
          <div className="text-2xl font-bold text-slate-700 mt-1 tabular-nums">{totaisDia.folgas}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Escala prevista</div>
        </button>

        {/* Férias / Afastados */}
        <button
          onClick={() => setSituacaoFiltro(situacaoFiltro === "FERIAS_AFASTADO_LICENCA" ? "TODAS" : "FERIAS_AFASTADO_LICENCA")}
          className={`p-3 rounded-lg border shadow-xs text-left w-full transition-all cursor-pointer ${
            situacaoFiltro === "FERIAS_AFASTADO_LICENCA"
              ? "border-blue-400 ring-2 ring-blue-200 bg-blue-50"
              : "bg-white border-slate-200 hover:border-blue-200"
          }`}
          title="Clique para filtrar férias e afastamentos"
        >
          <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
            <Plane className="w-3 h-3 text-blue-500" /> Férias/Afast.
          </span>
          <div className="text-2xl font-bold text-blue-600 mt-1 tabular-nums">{totaisDia.feriasAfastados}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Licença formal</div>
        </button>

        {/* Sem Posto Vinculado — novo filtro de auditoria RH */}
        <button
          onClick={() => setFiltroSemPosto(!filtroSemPosto)}
          className={`p-3 rounded-lg border shadow-xs text-left w-full transition-all cursor-pointer ${
            filtroSemPosto
              ? "border-amber-500 ring-2 ring-amber-300 bg-amber-50"
              : "bg-white border-slate-200 hover:border-amber-300"
          }`}
          title="Clique para filtrar colaboradores que não possuem posto contratual vinculado"
        >
          <span className="text-[11px] font-semibold text-amber-800 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Sem Posto
          </span>
          <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{totaisDia.semPosto}</div>
          <div className="text-[10px] text-amber-700 font-medium mt-0.5">Requer vínculo RH</div>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Seletor e Navegação de Data */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Data de Referência
            </label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navegarData(-1)}
                className="h-9 w-9 flex items-center justify-center border border-slate-300 rounded-md hover:bg-slate-100 transition-colors text-slate-600 cursor-pointer"
                title="Dia anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="flex-1 h-9 px-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-premier-600 focus:outline-none text-slate-800 font-semibold"
              />
              <button
                onClick={() => navegarData(1)}
                className="h-9 w-9 flex items-center justify-center border border-slate-300 rounded-md hover:bg-slate-100 transition-colors text-slate-600 cursor-pointer"
                title="Próximo dia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Atalhos Rápidos de Data */}
            <div className="flex items-center gap-1.5 mt-2 text-[11px]">
              <button
                onClick={irParaOntem}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-medium transition-colors cursor-pointer"
              >
                Ontem
              </button>
              <button
                onClick={irParaHoje}
                className={`px-2 py-0.5 rounded border font-medium transition-colors cursor-pointer ${
                  isHoje ? "bg-blue-600 text-white border-blue-700" : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200"
                }`}
              >
                Hoje
              </button>
              <button
                onClick={irParaUltimoLote}
                className={`px-2 py-0.5 rounded border font-medium transition-colors cursor-pointer ${
                  dataSelecionada === dataRefLoteIso ? "bg-emerald-700 text-white border-emerald-800" : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                }`}
                title={`Pular para ${dataRefLoteIso} (último lote de ponto importado)`}
              >
                Último Lote ({dataRefLoteIso.slice(5).replace("-", "/")})
              </button>
            </div>
          </div>

          {/* Filtro de Base Operacional */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Base Operacional
            </label>
            <select
              value={baseFiltro}
              onChange={(e) => setBaseFiltro(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-premier-600 focus:outline-none text-slate-800 font-medium"
            >
              <option value="TODAS">Todas as Bases ({BASES_SGP_SISTEMA.length})</option>
              {BASES_SGP_SISTEMA.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome} ({b.fusoHorario.replace("America/", "")})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Situação */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Situação da Presença
            </label>
            <select
              value={situacaoFiltro}
              onChange={(e) => setSituacaoFiltro(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-premier-600 focus:outline-none text-slate-800 font-medium"
            >
              <option value="TODAS">Todas as Situações</option>
              <option value="PRESENTE">Presente</option>
              <option value="AUSENCIA_JUSTIFICADA">Ausência Justificada (Abono)</option>
              <option value="FALTA">Falta</option>
              <option value="MARCACAO_INCOMPLETA">Marcação Incompleta</option>
              <option value="FOLGA_ESCALA">Folga da Escala</option>
              <option value="FERIAS_AFASTADO_LICENCA">Férias / Afastado</option>
              <option value="ESCALA_NAO_CONFIRMADA">Escala não confirmada</option>
              <option value="SEM_DADO">Aguardando Lote</option>
            </select>
          </div>

          {/* Campo de Busca */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Buscar Colaborador / Posto
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Nome, chapa ou posto..."
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                className="w-full h-9 pl-8 pr-8 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-premier-600 focus:outline-none text-slate-800"
              />
              {buscaTexto && (
                <button
                  onClick={() => setBuscaTexto("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Linha inferior de Ações e Limpar Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filtroSemPosto}
                onChange={(e) => setFiltroSemPosto(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-premier-900 focus:ring-premier-600"
              />
              <span className="font-medium">Exibir apenas sem posto vinculado ({totaisDia.semPosto})</span>
            </label>
          </div>

          {filtrosAtivos && (
            <button
              onClick={limparFiltros}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 px-2.5 py-1 rounded transition-colors cursor-pointer"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Presença Diária — Design Consistente Premier/Slate */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Colaboradores Apurados em {dataSelecionada.split("-").reverse().join("/")} ({apuracoesDoDia.length} registros)
            </h2>
            <span className="text-xs text-slate-500">
              Marcações exibidas no horário local oficial da respectiva base operacional
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-600 text-xs uppercase border-b border-slate-200 font-bold">
              <tr>
                <th className="px-4 py-3">Chapa / Colaborador</th>
                <th className="px-4 py-3">Base / Posto</th>
                <th className="px-4 py-3">Jornada Prevista</th>
                <th className="px-4 py-3">Marcações do Dia (Horário Local)</th>
                <th className="px-4 py-3">Situação Apurada</th>
                <th className="px-4 py-3">Indicadores</th>
                <th className="px-4 py-3">Observações / Abono</th>
                <th className="px-4 py-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {apuracoesDoDia.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    Nenhum colaborador encontrado com os filtros selecionados para esta data.
                    {filtrosAtivos && (
                      <button onClick={limparFiltros} className="ml-2 text-premier-700 underline text-xs font-medium hover:text-premier-900 cursor-pointer">
                        Limpar filtros ativos
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                apuracoesDoDia.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div className="text-slate-900 font-semibold">{item.nomeColaborador}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        Chapa: {item.chapa} | CPF: {item.cpfMascarado}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-slate-800">{item.baseNome}</div>
                      <div className="text-xs text-slate-500">
                        {item.postoCodigo ? (
                          <span className="font-mono font-bold text-premier-900">{item.postoCodigo}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded mt-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Sem Posto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {item.jornadaPrevista ? (
                        <div>
                          <span className="font-mono font-semibold text-slate-800">
                            {item.jornadaPrevista.horaInicio} às {item.jornadaPrevista.horaFim}
                          </span>
                          <div className="text-slate-500 text-[11px]">
                            Escala: {item.jornadaPrevista.tipoEscala}
                            {item.jornadaPrevista.atravessaMeiaNoite && " (Noturna)"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Sem jornada</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.marcacoesDoDia.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {item.marcacoesDoDia.map((m, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono border ${
                                idx % 2 === 0
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : "bg-rose-50 text-rose-800 border-rose-300"
                              }`}
                              title={`${idx % 2 === 0 ? "Entrada" : "Saída"} • Horário Local: ${m.horaLocal} • UTC: ${m.horaUtc}`}
                            >
                              {idx % 2 === 0 ? "→" : "←"} {m.horaLocal}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getBadgeSituacao(item.situacao)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        {item.indicadores.entradaAposHorario && (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block w-fit">
                            Entrada após horário
                          </span>
                        )}
                        {item.indicadores.saidaAntesHorario && (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block w-fit">
                            Saída antes horário
                          </span>
                        )}
                        {item.indicadores.abonoParcial && (
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 inline-block w-fit">
                            Abono parcial
                          </span>
                        )}
                        {!item.indicadores.entradaAposHorario &&
                          !item.indicadores.saidaAntesHorario &&
                          !item.indicadores.abonoParcial && (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-600 max-w-[260px] leading-snug">
                      {item.abonoVinculado ? (
                        <span title={item.abonoVinculado.observacaoPublica} className="line-clamp-2">
                          {item.abonoVinculado.observacaoPublica.replace(/^Abono\/Ocorrência:\s*/i, "")}
                        </span>
                      ) : item.observacaoGestao ? (
                        <span title={item.observacaoGestao.texto} className="line-clamp-2">
                          {item.observacaoGestao.texto}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => router.push(`/profissionais/${item.colaboradorId}/espelho-ponto`)}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-semibold bg-[#1F4FD1] hover:bg-[#163A9E] text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        Espelho
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé com Contador de Registros */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Exibindo{" "}
            <strong className="text-slate-700">{apuracoesDoDia.length}</strong>{" "}
            de{" "}
            <strong className="text-slate-700">{totaisDia.total}</strong>{" "}
            colaboradores apurados em {dataSelecionada.split("-").reverse().join("/")}
            {filtrosAtivos && (
              <span className="ml-1 text-premier-700 font-medium">(filtros ativos)</span>
            )}
          </span>
          <span className="text-[11px]">
            {totaisDia.semPosto > 0 ? (
              <span className="text-amber-800 font-medium">
                ⚠ {totaisDia.semPosto} colaboradores sem posto vinculado
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">
                ✓ Todos os colaboradores com posto vinculado
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
