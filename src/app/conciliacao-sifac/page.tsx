"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Filter,
  Search,
  Download,
  ShieldCheck,
  Eye,
  EyeOff,
  UserCheck2,
  Building2,
  HelpCircle,
  ArrowUpDown,
  X,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import {
  carregarEstado,
  salvarEstado,
  salvarDivergenciasConciliacao,
  obterDivergenciasConciliacao,
  EstadoOperacionalCompleto,
} from "@/lib/dados/estado-operacional";
import {
  ItemAlocadoSifac,
  DivergenciaConciliacao,
  ResumoConciliacao,
  StatusDivergencia,
  TipoDivergencia,
  ROTULOS_TIPOS_DIVERGENCIA,
  executarConciliacaoRmSifac,
  atualizarStatusDivergencia,
  exportarConciliacaoXlsx,
} from "@/lib/dados/conciliacao-sifac";
import { UsuarioSessao } from "@/lib/auth/tipos";
import { can } from "@/lib/auth/permissoes";

export default function ConciliacaoSifacPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Competência selecionada (ex: "2026-08")
  const paramComp = searchParams.get("competencia") || "2026-08";
  const [competencia, setCompetencia] = useState<string>(paramComp);

  // Estado geral
  const [estado, setEstado] = useState<EstadoOperacionalCompleto>(carregarEstado);
  const [divergencias, setDivergencias] = useState<DivergenciaConciliacao[]>([]);
  const [resumo, setResumo] = useState<ResumoConciliacao | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroBase, setFiltroBase] = useState<string>("TODAS");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [termoBusca, setTermoBusca] = useState<string>("");

  // Modal de Tratamento de Divergência
  const [divergenciaEmTratamento, setDivergenciaEmTratamento] = useState<DivergenciaConciliacao | null>(null);
  const [novoStatusTratamento, setNovoStatusTratamento] = useState<StatusDivergencia>("JUSTIFICADA");
  const [justificativaTratamento, setJustificativaTratamento] = useState<string>("");
  const [salvandoTratamento, setSalvandoTratamento] = useState(false);
  const [feedbackAcao, setFeedbackAcao] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  // Proteção Salarial
  const [exibirSalariosAdmin, setExibirSalariosAdmin] = useState<boolean>(true);

  // 1. Carregar Sessão
  useEffect(() => {
    const carregarSessao = async () => {
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
      } finally {
        setCarregandoSessao(false);
      }
    };
    carregarSessao();
  }, []);

  // 2. Executar ou recuperar conciliação quando estado ou competência mudam
  useEffect(() => {
    const estadoAtual = carregarEstado();
    setEstado(estadoAtual);

    const alocadosSifac = (estadoAtual.alocadosSifac || []).filter((a) => {
      const comp = (a.dataCompetenciaCadastro || a.dataCompetencia || "").substring(0, 7);
      return comp === competencia || (!comp && competencia === "2026-08");
    });

    const divergenciasSalvas = obterDivergenciasConciliacao(competencia);

    const conc = executarConciliacaoRmSifac(
      competencia,
      estadoAtual.profissionais,
      alocadosSifac,
      estadoAtual.equivalenciasConciliacao,
      divergenciasSalvas || [],
      "2026-09-17",
      `${competencia}-10`
    );

    setDivergencias(conc.divergencias);
    setResumo(conc.resumo);
    salvarDivergenciasConciliacao(competencia, conc.divergencias);
  }, [competencia]);

  const ehAdmin = sessao ? sessao.perfil === "PREMIER_ADMIN" : true;
  const ehFiscal = sessao ? sessao.perfil.startsWith("PETROBRAS") : false;

  // Bloqueio de acesso para perfis não autorizados (Fiscal Petrobras / Outros)
  if (!carregandoSessao && (ehFiscal || !ehAdmin)) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-rose-200 rounded-2xl shadow-sm text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">Acesso Restrito ao Administrador Premier</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            A <strong>Conciliação SIFAC</strong> é um instrumento interno de governança e auditoria prévia da Premier Logistics para saneamento de divergências cadastrais. O perfil <strong>{sessao?.perfil || "Convidado"}</strong> não possui autorização para acessar este recurso.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/painel"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Retornar ao Painel Geral
          </Link>
        </div>
      </div>
    );
  }

  // Lista de bases do sistema para o dropdown de filtros
  const basesDisponiveis = useMemo(() => {
    const setBases = new Set<string>();
    divergencias.forEach((d) => {
      if (d.baseRmNome) setBases.add(d.baseRmNome);
    });
    return Array.from(setBases).sort();
  }, [divergencias]);

  // Filtragem da tabela
  const divergenciasFiltradas = useMemo(() => {
    return divergencias.filter((d) => {
      const matchTipo = filtroTipo === "TODOS" || d.tipo === filtroTipo;
      const matchBase = filtroBase === "TODAS" || d.baseRmNome === filtroBase;
      const matchStatus = filtroStatus === "TODOS" || d.status === filtroStatus;

      const termo = termoBusca.trim().toLowerCase();
      const matchBusca =
        !termo ||
        d.nome.toLowerCase().includes(termo) ||
        d.cpfLimpo.includes(termo) ||
        (d.matriculaRm && d.matriculaRm.toLowerCase().includes(termo)) ||
        (d.chapaRm && d.chapaRm.includes(termo));

      return matchTipo && matchBase && matchStatus && matchBusca;
    });
  }, [divergencias, filtroTipo, filtroBase, filtroStatus, termoBusca]);

  // Abertura do Modal de Tratamento
  const handleAbrirTratamento = (div: DivergenciaConciliacao) => {
    setDivergenciaEmTratamento(div);
    setNovoStatusTratamento(div.status === "ABERTA" ? "JUSTIFICADA" : div.status);
    setJustificativaTratamento(div.justificativaAtual || "");
    setFeedbackAcao(null);
  };

  // Salvar Tratamento
  const handleSalvarTratamento = () => {
    if (!divergenciaEmTratamento) return;
    if (!justificativaTratamento.trim()) {
      setFeedbackAcao({ tipo: "erro", texto: "Por favor, digite uma justificativa ou ação corretiva." });
      return;
    }

    setSalvandoTratamento(true);
    try {
      const usuarioLogado = sessao ? `${sessao.nome} (${sessao.perfil})` : "Administrador Premier";
      const { atualizadas, sucesso } = atualizarStatusDivergencia(
        divergencias,
        divergenciaEmTratamento.id,
        novoStatusTratamento,
        justificativaTratamento.trim(),
        usuarioLogado
      );

      if (sucesso) {
        setDivergencias(atualizadas);
        salvarDivergenciasConciliacao(competencia, atualizadas);

        // Recalcular totais de status no resumo
        if (resumo) {
          const novosTotaisStatus = { ...resumo.totaisPorStatus };
          novosTotaisStatus[divergenciaEmTratamento.status] = Math.max(
            0,
            novosTotaisStatus[divergenciaEmTratamento.status] - 1
          );
          novosTotaisStatus[novoStatusTratamento] = (novosTotaisStatus[novoStatusTratamento] || 0) + 1;
          setResumo({ ...resumo, totaisPorStatus: novosTotaisStatus });
        }

        setFeedbackAcao({ tipo: "sucesso", texto: "Status e justificativa atualizados com sucesso!" });
        setTimeout(() => {
          setDivergenciaEmTratamento(null);
          setFeedbackAcao(null);
        }, 1200);
      }
    } catch {
      setFeedbackAcao({ tipo: "erro", texto: "Erro ao atualizar justificativa." });
    } finally {
      setSalvandoTratamento(false);
    }
  };

  // Exportar XLSX
  const handleExportarXlsx = () => {
    if (!resumo) return;
    try {
      const bytes = exportarConciliacaoXlsx(
        competencia,
        resumo,
        divergenciasFiltradas,
        ehAdmin && exibirSalariosAdmin
      );
      const blob = new Blob([bytes as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SGP_Conciliacao_RM_SIFAC_${competencia}_Exportacao_${new Date().toISOString().substring(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Falha ao exportar conciliação XLSX.");
    }
  };

  // Cores de badges de status
  const badgeStatus = (status: StatusDivergencia, justificadaAnteriormente?: boolean) => {
    if (justificadaAnteriormente) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
          <CheckCircle2 className="w-3 h-3 text-purple-600" />
          Justificada Anteriormente
        </span>
      );
    }
    switch (status) {
      case "ABERTA":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Aberta
          </span>
        );
      case "JUSTIFICADA":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Justificada
          </span>
        );
      case "CORRIGIR_SIFAC":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <RotateCcw className="w-3 h-3 text-amber-600" />
            Corrigir no SIFAC
          </span>
        );
      case "CORRIGIR_RM":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Building2 className="w-3 h-3 text-blue-600" />
            Corrigir no RM
          </span>
        );
      case "RESOLVIDA":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <CheckCircle2 className="w-3 h-3 text-slate-600" />
            Resolvida
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ===================================================================== */}
      {/* CABEÇALHO EXECUTIVO & SELETORES */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
            <span className="font-semibold text-blue-600">Premier Logistics</span>
            <span>/</span>
            <span>Contrato Petrobras ICJ 5900.0129796.25.2</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Conciliação SIFAC</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <FileCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <span>Conciliação Cadastral RM × SIFAC</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Identificação e tratamento prévio de divergências entre a exportação do RM e a Lista de Alocados oficial da Petrobras.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Competência */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-xl shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Competência:</span>
            <select
              value={competencia}
              onChange={(e) => {
                setCompetencia(e.target.value);
                router.replace(`/conciliacao-sifac?competencia=${e.target.value}`);
              }}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="2026-08">Agosto / 2026 (Oficial SIFAC)</option>
              <option value="2026-09">Setembro / 2026</option>
              <option value="2026-10">Outubro / 2026</option>
            </select>
          </div>

          {/* Botão de Exportação XLSX */}
          <button
            onClick={handleExportarXlsx}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar XLSX para Controle de Postos</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4 CARDS DE RESUMO EXECUTIVO NO TOPO */}
      {/* ===================================================================== */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total SIFAC */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
              Total Alocados SIFAC
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{resumo.totalSifac}</span>
              <span className="text-[11px] text-slate-400">colaboradores</span>
            </div>
            <p className="text-[11px] text-slate-500 pt-0.5">
              Certificados no contrato 4600682336
            </p>
          </div>

          {/* Card 2: Total RM */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
              Total Cadastro RM
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{resumo.totalRmCompetencia}</span>
              <span className="text-[11px] text-slate-400">vigentes</span>
            </div>
            <p className="text-[11px] text-slate-500 pt-0.5">
              Exclui {resumo.admitidosAposCompetencia} admitidos pós-competência
            </p>
          </div>

          {/* Card 3: 100% Conciliados */}
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide block flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              100% Conciliados
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-900">{resumo.conciliadosSemDivergencia}</span>
              <span className="text-[11px] text-emerald-700">conformes</span>
            </div>
            <p className="text-[11px] text-emerald-700 pt-0.5">
              Cadastros sem divergência em nenhum critério
            </p>
          </div>

          {/* Card 4: Total Divergências */}
          <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide block flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Divergências Encontradas
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-900">{resumo.totalDivergencias}</span>
              <span className="text-[11px] text-rose-700">apontamentos</span>
            </div>
            <p className="text-[11px] text-rose-700 pt-0.5">
              {resumo.totaisPorStatus.ABERTA} abertas · {resumo.pendenciasCriticasAdmin} críticas no Admin
            </p>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* BARRA DE FILTROS E BUSCA */}
      {/* ===================================================================== */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Busca textual */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por colaborador, CPF ou matrícula..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Filtros em dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro por Tipo */}
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Todos os 12 tipos de divergência</option>
              {Object.entries(ROTULOS_TIPOS_DIVERGENCIA).map(([tipo, rotulo]) => (
                <option key={tipo} value={tipo}>
                  {rotulo}
                </option>
              ))}
            </select>

            {/* Filtro por Base */}
            <select
              value={filtroBase}
              onChange={(e) => setFiltroBase(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none cursor-pointer"
            >
              <option value="TODAS">Todas as Bases RM</option>
              {basesDisponiveis.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Filtro por Status */}
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ABERTA">Aberta</option>
              <option value="JUSTIFICADA">Justificada</option>
              <option value="CORRIGIR_SIFAC">Corrigir no SIFAC</option>
              <option value="CORRIGIR_RM">Corrigir no RM</option>
              <option value="RESOLVIDA">Resolvida</option>
            </select>

            {/* Alternar visibilidade de salário (apenas Admin) */}
            <button
              onClick={() => setExibirSalariosAdmin(!exibirSalariosAdmin)}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                exibirSalariosAdmin
                  ? "bg-purple-50 border-purple-200 text-purple-700"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              }`}
              title="Alternar sigilo salarial na visualização de conciliação"
            >
              {exibirSalariosAdmin ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Salários ({exibirSalariosAdmin ? "Visíveis" : "Ocultos"})</span>
            </button>
          </div>
        </div>

        {/* Linha de contadores rápidos por tipo */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500 border-t border-slate-100">
          <span className="font-semibold text-slate-700">Filtros rápidos:</span>
          <button
            onClick={() => setFiltroTipo("TODOS")}
            className={`px-2 py-0.5 rounded ${filtroTipo === "TODOS" ? "bg-slate-800 text-white font-bold" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
          >
            Todos ({divergencias.length})
          </button>
          <button
            onClick={() => setFiltroTipo("GENERO_DIVERGENTE")}
            className={`px-2 py-0.5 rounded ${filtroTipo === "GENERO_DIVERGENTE" ? "bg-purple-700 text-white font-bold" : "bg-purple-50 text-purple-800 hover:bg-purple-100"}`}
          >
            Gênero ({resumo?.totaisPorTipo.GENERO_DIVERGENTE || 0})
          </button>
          <button
            onClick={() => setFiltroTipo("DATA_NASCIMENTO_DIVERGENTE")}
            className={`px-2 py-0.5 rounded ${filtroTipo === "DATA_NASCIMENTO_DIVERGENTE" ? "bg-purple-700 text-white font-bold" : "bg-purple-50 text-purple-800 hover:bg-purple-100"}`}
          >
            Nascimento ({resumo?.totaisPorTipo.DATA_NASCIMENTO_DIVERGENTE || 0})
          </button>
          <button
            onClick={() => setFiltroTipo("SITUACAO_INCONSISTENTE_DEMITIDO")}
            className={`px-2 py-0.5 rounded ${filtroTipo === "SITUACAO_INCONSISTENTE_DEMITIDO" ? "bg-rose-700 text-white font-bold" : "bg-rose-50 text-rose-800 hover:bg-rose-100"}`}
          >
            Demitido vs Inativo ({resumo?.totaisPorTipo.SITUACAO_INCONSISTENTE_DEMITIDO || 0})
          </button>
          <button
            onClick={() => setFiltroTipo("NAO_INFORMADO_SIFAC")}
            className={`px-2 py-0.5 rounded ${filtroTipo === "NAO_INFORMADO_SIFAC" ? "bg-amber-700 text-white font-bold" : "bg-amber-50 text-amber-800 hover:bg-amber-100"}`}
          >
            Não no SIFAC ({resumo?.totaisPorTipo.NAO_INFORMADO_SIFAC || 0})
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TABELA DETALHADA DE DIVERGÊNCIAS */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4 min-w-[220px]">Colaborador</th>
                <th className="py-3 px-3 min-w-[140px]">Base (RM)</th>
                <th className="py-3 px-3 min-w-[220px]">Tipo de Divergência</th>
                <th className="py-3 px-3 min-w-[170px]">Valor no RM</th>
                <th className="py-3 px-3 min-w-[170px]">Valor no SIFAC</th>
                <th className="py-3 px-3 text-center min-w-[140px]">Status</th>
                <th className="py-3 px-3 text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {divergenciasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                      <p className="font-bold text-sm text-slate-800">
                        Nenhuma divergência encontrada com os filtros selecionados!
                      </p>
                      <p className="text-xs text-slate-400">
                        Todos os colaboradores atendem aos critérios de conciliação.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                divergenciasFiltradas.map((div) => (
                  <tr key={div.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Colaborador */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block truncate" title={div.nome}>
                        {div.nome}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono">{div.cpfMascarado}</span>
                        {div.chapaRm && <span>• Chapa {div.chapaRm}</span>}
                      </div>
                    </td>

                    {/* Base RM */}
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 block truncate" title={div.baseRmNome}>
                        {div.baseRmNome}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {div.baseRmId}
                      </span>
                    </td>

                    {/* Tipo de Divergência */}
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-900 block leading-tight">
                          {div.rotuloTipo}
                        </span>
                        {div.isVerificarDataReferencia && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                            Verificar – datas de referência diferentes
                          </span>
                        )}
                        {div.justificadaAnteriormente && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold border border-purple-200">
                            Justificada na competência anterior
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Valor RM */}
                    <td className="py-3 px-3 font-medium text-slate-700">
                      <span className="block truncate max-w-[200px]" title={div.valorRm}>
                        {div.valorRm}
                      </span>
                    </td>

                    {/* Valor SIFAC */}
                    <td className="py-3 px-3 font-medium text-slate-700">
                      <span className="block truncate max-w-[200px]" title={div.valorSifac}>
                        {div.tipo === "SALARIO_DIVERGENTE" && !exibirSalariosAdmin ? (
                          <span className="text-slate-400 italic">R$ •••••• (Oculto)</span>
                        ) : (
                          div.valorSifac
                        )}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      {badgeStatus(div.status, div.justificadaAnteriormente)}
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleAbrirTratamento(div)}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        Tratar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* DRAWER / MODAL DE TRATAMENTO DE DIVERGÊNCIA */}
      {/* ===================================================================== */}
      {divergenciaEmTratamento && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Topo do Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Tratamento de Divergência
                  </h3>
                  <span className="text-xs text-slate-500">
                    Competência {divergenciaEmTratamento.competencia}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDivergenciaEmTratamento(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-4 text-xs">
              {/* Informações do Colaborador */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">
                    {divergenciaEmTratamento.nome}
                  </span>
                  <span className="font-mono text-slate-500 font-semibold">
                    {divergenciaEmTratamento.cpfMascarado}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 text-[11px]">
                  <span>Base: <strong>{divergenciaEmTratamento.baseRmNome}</strong></span>
                  {divergenciaEmTratamento.chapaRm && <span>• Chapa: <strong>{divergenciaEmTratamento.chapaRm}</strong></span>}
                </div>
              </div>

              {/* Detalhes da Divergência */}
              <div className="space-y-2">
                <span className="font-bold text-slate-700 block">Tipo Identificado</span>
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                  <span className="font-bold text-amber-900 block">
                    {divergenciaEmTratamento.rotuloTipo}
                  </span>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-100 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Valor no RM:</span>
                      <strong className="text-slate-800">{divergenciaEmTratamento.valorRm}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Valor no SIFAC:</span>
                      <strong className="text-slate-800">{divergenciaEmTratamento.valorSifac}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seleção do Novo Status */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Status da Divergência</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["JUSTIFICADA", "CORRIGIR_SIFAC", "CORRIGIR_RM", "RESOLVIDA", "ABERTA"] as StatusDivergencia[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setNovoStatusTratamento(st)}
                      className={`py-2 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                        novoStatusTratamento === st
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {st === "JUSTIFICADA" && "Justificada"}
                      {st === "CORRIGIR_SIFAC" && "Corrigir no SIFAC"}
                      {st === "CORRIGIR_RM" && "Corrigir no RM"}
                      {st === "RESOLVIDA" && "Resolvida"}
                      {st === "ABERTA" && "Reabrir (Aberta)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campo de Justificativa */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Justificativa / Providência Adotada <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Descreva a razão da divergência ou a ação alinhada com o setor de controle de postos/RH..."
                  value={justificativaTratamento}
                  onChange={(e) => setJustificativaTratamento(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Feedback de Erro ou Sucesso */}
              {feedbackAcao && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                    feedbackAcao.tipo === "sucesso"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {feedbackAcao.tipo === "sucesso" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{feedbackAcao.texto}</span>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setDivergenciaEmTratamento(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarTratamento}
                disabled={salvandoTratamento}
                className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50"
              >
                {salvandoTratamento ? "Salvando..." : "Salvar Tratamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
