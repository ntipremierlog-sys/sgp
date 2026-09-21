"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Lock,
  Unlock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  Clock,
  UserCheck,
  Building2,
  FileCheck,
  Copy,
  Check,
  ArrowRight,
  RotateCcw,
  MessageSquare,
  HelpCircle,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  carregarEstado,
  obterFechamentosCompetencia,
  obterStatusCompetencia,
  isCompetenciaCongelada,
  congelarCompetencia,
  reabrirCompetencia,
  homologarMedicaoPetrobras,
  obterTodosPostosContrato,
  obterMarcacoesPonto,
  obterDataReferenciaPonto,
  calcularStatusDia,
  FechamentoCompetencia,
  PostoOperacional,
  OcorrenciaOperacional,
  CoberturaOperacional,
  ApontamentoOperacional,
  MarcacaoPontoOriginal,
} from "@/lib/dados/estado-operacional";

export default function FechamentoPage() {
  const [fechamentos, setFechamentos] = useState<FechamentoCompetencia[]>([]);
  const [competenciaAtiva, setCompetenciaAtiva] = useState<string>("2026-09");
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);
  const [coberturas, setCoberturas] = useState<CoberturaOperacional[]>([]);
  const [apontamentos, setApontamentos] = useState<ApontamentoOperacional[]>([]);
  const [marcacoes, setMarcacoes] = useState<MarcacaoPontoOriginal[]>([]);
  const [dataRefLote, setDataRefLote] = useState<string | null>(null);
  const [perfilAtivo, setPerfilAtivo] = useState<string>("PREMIER_ADMIN");

  // Modais
  const [modalCongelarAberto, setModalCongelarAberto] = useState(false);
  const [modalReabrirAberto, setModalReabrirAberto] = useState(false);
  const [modalHomologarAberto, setModalHomologarAberto] = useState(false);
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState<string>("2026-09");

  // Formulários
  const [obsFechamento, setObsFechamento] = useState("");
  const [checkDeclaracao, setCheckDeclaracao] = useState(false);
  const [justificativaReabertura, setJustificativaReabertura] = useState("");
  const [parecerFiscal, setParecerFiscal] = useState("");
  const [fiscalNome, setFiscalNome] = useState("Carlos Eduardo Mendes (Fiscal Técnico Petrobras)");
  const [copiadoHash, setCopiadoHash] = useState<string | null>(null);
  const [mensagemAlerta, setMensagemAlerta] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  const carregarDados = useCallback(async () => {
    const estado = carregarEstado();
    setFechamentos(obterFechamentosCompetencia());
    setPostos(obterTodosPostosContrato(estado.postos));
    setOcorrencias(estado.ocorrencias);
    setCoberturas(estado.coberturas);
    setApontamentos(estado.apontamentos);
    setPerfilAtivo(estado.perfilAtivo || "PREMIER_ADMIN");

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
  }, []);

  useEffect(() => {
    carregarDados();
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, [carregarDados]);

  // Set de Marcações O(1)
  const marcacoesSet = useMemo(() => {
    const set = new Set<string>();
    marcacoes.forEach((m: any) => {
      const matRaw = m.matricula || m.chapa || "";
      if (!matRaw) return;
      const chapa = String(matRaw).padStart(6, "0");
      const dataStr = m.dataLocal || m.dataHoraUtc || m.dataHora || m.data || "";
      if (typeof dataStr === "string" && dataStr.length >= 10) {
        set.add(`${chapa}_${dataStr.slice(0, 10)}`);
      }
    });
    return set;
  }, [marcacoes]);

  // Métricas apuradas em tempo real da competência ativa
  const metricasAtivas = useMemo(() => {
    const [ano, mes] = competenciaAtiva.split("-").map(Number);
    const mesIdx = mes - 1;
    const totalDiasNoMes = new Date(ano, mes, 0).getDate();
    const limiteDia = ano === 2026 && mes === 9 ? Math.min(15, totalDiasNoMes) : totalDiasNoMes;

    let exigiveis = 0;
    let presentes = 0;
    let cobertos = 0;
    let descobertos = 0;
    let valorTotalContrato = 0;
    let valorTotalGlosa = 0;

    postos.forEach((p) => {
      const valMensal = 7500.0;
      valorTotalContrato += valMensal;

      for (let d = 1; d <= limiteDia; d++) {
        const det = calcularStatusDia(
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
        if (det.statusOcupacao === "TITULAR_PRESENTE") {
          exigiveis++;
          presentes++;
        } else if (det.statusOcupacao === "COBERTO") {
          exigiveis++;
          cobertos++;
        } else if (det.statusOcupacao === "DESCOBERTO") {
          exigiveis++;
          descobertos++;
          valorTotalGlosa += valMensal / 30;
        }
      }
    });

    const efetivas = presentes + cobertos;
    const taxaSla = exigiveis > 0 ? (efetivas / exigiveis) * 100 : 100;
    const faturamentoLiquido = Math.max(0, valorTotalContrato - valorTotalGlosa);

    return {
      postos: postos.length,
      exigiveis,
      presentes,
      cobertos,
      efetivas,
      glosas: descobertos,
      taxaSla,
      valorContrato: valorTotalContrato,
      valorGlosa: valorTotalGlosa,
      faturamentoLiquido,
      atendeSla: taxaSla >= 95.0,
      limiteDia,
    };
  }, [competenciaAtiva, postos, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote]);

  // Fechamento da competência atualmente em foco
  const fechamentoFoco = useMemo(() => {
    return fechamentos.find((f) => f.competencia === competenciaAtiva);
  }, [fechamentos, competenciaAtiva]);

  const statusFoco = fechamentoFoco?.status || "ABERTO";
  const isCongelado = statusFoco === "CONGELADO";

  // Copiar hash
  const copiarHashParaClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiadoHash(hash);
    setTimeout(() => setCopiadoHash(null), 2500);
  };

  // Ação: Confirmar Congelamento
  const handleConfirmarCongelamento = () => {
    if (!checkDeclaracao) {
      alert("É necessário marcar a declaração de responsabilidade e conferência antes de congelar.");
      return;
    }

    try {
      congelarCompetencia(competenciaAtiva, {
        usuario: "Marcos Valério de Souza (Administrador Premier)",
        email: "marcos.valerio@premierlogistics.com.br",
        resumoMetricas: {
          postos: metricasAtivas.postos,
          exigiveis: metricasAtivas.exigiveis,
          efetivas: metricasAtivas.efetivas,
          glosas: metricasAtivas.glosas,
          taxaSla: metricasAtivas.taxaSla,
          valorContrato: metricasAtivas.valorContrato,
          valorGlosa: metricasAtivas.valorGlosa,
          faturamentoLiquido: metricasAtivas.faturamentoLiquido,
        },
        observacoes: obsFechamento.trim() || "Competência encerrada e snapshot imutável gerado.",
      });

      setModalCongelarAberto(false);
      setCheckDeclaracao(false);
      setObsFechamento("");
      setMensagemAlerta({
        tipo: "sucesso",
        texto: `Competência ${competenciaAtiva} congelada com sucesso! Snapshot imutável gerado com assinatura digital SHA-256.`,
      });
      carregarDados();
    } catch (err: any) {
      alert(`Erro ao congelar competência: ${err?.message || err}`);
    }
  };

  // Ação: Confirmar Reabertura
  const handleConfirmarReabertura = () => {
    if (!justificativaReabertura || justificativaReabertura.trim().length < 10) {
      alert("A justificativa formal deve conter no mínimo 10 caracteres.");
      return;
    }

    try {
      reabrirCompetencia(
        competenciaSelecionada,
        justificativaReabertura,
        "Marcos Valério de Souza (Administrador Premier)"
      );

      setModalReabrirAberto(false);
      setJustificativaReabertura("");
      setMensagemAlerta({
        tipo: "sucesso",
        texto: `Competência ${competenciaSelecionada} reaberta em caráter emergencial. Trilha de auditoria registrada.`,
      });
      carregarDados();
    } catch (err: any) {
      alert(`Erro ao reabrir competência: ${err?.message || err}`);
    }
  };

  // Ação: Confirmar Homologação Petrobras
  const handleConfirmarHomologacao = () => {
    if (!parecerFiscal || parecerFiscal.trim().length < 5) {
      alert("O parecer técnico da fiscalização é obrigatório.");
      return;
    }

    try {
      homologarMedicaoPetrobras(competenciaSelecionada, parecerFiscal, fiscalNome);
      setModalHomologarAberto(false);
      setParecerFiscal("");
      setMensagemAlerta({
        tipo: "sucesso",
        texto: `Medição da competência ${competenciaSelecionada} homologada com sucesso pela Fiscalização Petrobras!`,
      });
      carregarDados();
    } catch (err: any) {
      alert(`Erro ao homologar medição: ${err?.message || err}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
            <Lock className="w-6 h-6 text-slate-700" />
            <h1>Fechamento de Competência & Congelamento Mensal</h1>
            <span className="text-xs bg-slate-100 text-slate-800 border border-slate-300 font-semibold px-2 py-0.5 rounded">
              Item 11.3 Petrobras
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Gestão do ciclo de vida das competências mensais, congelamento de snapshots imutáveis com assinatura SHA-256 e homologação da Fiscalização Petrobras no Contrato ICJ <strong>5900.0129796.25.2</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/relatorios?competencia=${competenciaAtiva}`}
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>Ver Memória de Cálculo Oficial</span>
          </Link>
        </div>
      </div>

      {/* Alerta de Sucesso / Mensagem */}
      {mensagemAlerta && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 animate-fadeIn ${
            mensagemAlerta.tipo === "sucesso"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {mensagemAlerta.tipo === "sucesso" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{mensagemAlerta.texto}</span>
          </div>
          <button
            onClick={() => setMensagemAlerta(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Seletor de Competência em Destaque */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-premier-800 shrink-0" />
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Competência em Foco
            </label>
            <div className="flex items-center gap-2 mt-0.5">
              <select
                value={competenciaAtiva}
                onChange={(e) => setCompetenciaAtiva(e.target.value)}
                className="text-sm font-bold border border-slate-300 rounded-lg p-1.5 focus:ring-2 focus:ring-premier-800 bg-white text-slate-900"
              >
                <option value="2026-09">Setembro / 2026 (Competência Atual)</option>
                <option value="2026-08">Agosto / 2026 (Competência Anterior)</option>
                <option value="2026-07">Julho / 2026</option>
              </select>

              {isCongelado ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-full">
                  <Lock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>CONGELADA (Snapshot Imutável)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full">
                  <Unlock className="w-3.5 h-3.5 text-amber-700" />
                  <span>ABERTA (Em Apuração Diária)</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCongelado ? (
            <>
              <button
                onClick={() => {
                  setCompetenciaSelecionada(competenciaAtiva);
                  setModalHomologarAberto(true);
                }}
                className="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-2xs transition-colors"
              >
                <FileCheck className="w-3.5 h-3.5 text-blue-200" />
                <span>Parecer Fiscal Petrobras</span>
              </button>
              <button
                onClick={() => {
                  setCompetenciaSelecionada(competenciaAtiva);
                  setModalReabrirAberto(true);
                }}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 transition-colors shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                <span>Reabertura Emergencial</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setCompetenciaSelecionada(competenciaAtiva);
                setModalCongelarAberto(true);
              }}
              className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-950 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>Encerrar & Congelar Competência ({competenciaAtiva})</span>
            </button>
          )}
        </div>
      </div>

      {/* Card da Competência em Foco (Métricas e Status) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Apuração Consolidada para Fechamento
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Competência {competenciaAtiva === "2026-09" ? "Setembro / 2026" : competenciaAtiva === "2026-08" ? "Agosto / 2026" : competenciaAtiva}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isCongelado
                ? `Fechamento concluído em ${fechamentoFoco?.congeladoEm || "data registrada"} por ${fechamentoFoco?.congeladoPor || "Administrador"}. Registro imutável de medição.`
                : `Apuração aberta até o dia ${metricasAtivas.limiteDia}. Ao congelar, as coberturas e ocorrências retroativas serão travadas.`}
            </p>
          </div>

          {isCongelado && fechamentoFoco?.hashIntegridadeSha256 && (
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate max-w-xs md:max-w-sm" title={fechamentoFoco.hashIntegridadeSha256}>
                {fechamentoFoco.hashIntegridadeSha256}
              </span>
              <button
                onClick={() => copiarHashParaClipboard(fechamentoFoco.hashIntegridadeSha256!)}
                className="text-slate-400 hover:text-slate-700 shrink-0"
                title="Copiar Hash SHA-256"
              >
                {copiadoHash === fechamentoFoco.hashIntegridadeSha256 ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Grade de KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Postos Contratados
            </span>
            <div className="text-2xl font-bold text-slate-900">
              {isCongelado ? fechamentoFoco?.resumoMetricas.postos : metricasAtivas.postos}
            </div>
            <div className="text-[10px] text-slate-500">29 bases operacionais</div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Diárias Cumpridas (P+C)
            </span>
            <div className="text-2xl font-bold text-emerald-800">
              {isCongelado ? fechamentoFoco?.resumoMetricas.efetivas : metricasAtivas.efetivas}
            </div>
            <div className="text-[10px] text-emerald-700">
              {isCongelado ? fechamentoFoco?.resumoMetricas.exigiveis : metricasAtivas.exigiveis} diárias exigíveis
            </div>
          </div>

          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
              Glosas Contratuais (D)
            </span>
            <div className="text-2xl font-bold text-rose-800">
              {isCongelado ? fechamentoFoco?.resumoMetricas.glosas : metricasAtivas.glosas}
            </div>
            <div className="text-[10px] text-rose-700 font-semibold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                isCongelado ? fechamentoFoco?.resumoMetricas.valorGlosa || 0 : metricasAtivas.valorGlosa
              )}
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border space-y-1 ${
              (isCongelado ? fechamentoFoco?.resumoMetricas.taxaSla || 100 : metricasAtivas.taxaSla) >= 95
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : "bg-amber-50 border-amber-300 text-amber-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                SLA Alcançado
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/80 border">
                Meta: 95%
              </span>
            </div>
            <div className="text-2xl font-bold">
              {(isCongelado ? fechamentoFoco?.resumoMetricas.taxaSla || 100 : metricasAtivas.taxaSla).toFixed(1)}%
            </div>
            <div className="text-[10px] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Conforme exigência do Item 11.3</span>
            </div>
          </div>
        </div>

        {/* Parecer do Fiscal Petrobras (se houver) */}
        {fechamentoFoco?.homologacaoPetrobras?.homologado ? (
          <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                <FileCheck className="w-4 h-4 text-blue-700" />
                <span>Homologação Formal da Fiscalização Petrobras</span>
              </div>
              <span className="text-[11px] text-blue-700 font-mono">
                Homologado em: {fechamentoFoco.homologacaoPetrobras.data || "06/09/2026"}
              </span>
            </div>
            <p className="text-xs text-blue-900 italic bg-white p-3 rounded-lg border border-blue-200 leading-relaxed">
              &quot;{fechamentoFoco.homologacaoPetrobras.parecer}&quot;
            </p>
            <div className="text-[11px] text-blue-800 font-medium text-right">
              Assinado por: <strong>{fechamentoFoco.homologacaoPetrobras.fiscalNome || "Carlos Eduardo Mendes"}</strong>
            </div>
          </div>
        ) : isCongelado ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Aguardando Homologação Petrobras:</strong> O snapshot foi gerado e encontra-se disponível para atesto do Fiscal Técnico.
              </span>
            </div>
            <button
              onClick={() => {
                setCompetenciaSelecionada(competenciaAtiva);
                setModalHomologarAberto(true);
              }}
              className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
            >
              Registrar Parecer Agora &rarr;
            </button>
          </div>
        ) : null}

        {/* Histórico de Reaberturas da Competência */}
        {fechamentoFoco?.historicoReaberturas && fechamentoFoco.historicoReaberturas.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span>Histórico de Reaberturas Emergenciais</span>
            </span>
            <div className="space-y-1.5">
              {fechamentoFoco.historicoReaberturas.map((reab, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-amber-900 font-semibold">
                    <span>Reaberto por: {reab.usuario}</span>
                    <span className="font-mono">{reab.data}</span>
                  </div>
                  <p className="text-slate-700 text-[11px]">
                    <strong>Justificativa:</strong> {reab.justificativa}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Histórico Geral de Todas as Competências */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-800">
              Histórico Consolidado de Competências
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {fechamentos.length} competência(s) registrada(s) no sistema
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                <th className="py-2.5 px-3 font-bold">Competência</th>
                <th className="py-2.5 px-3 font-bold text-center">Status</th>
                <th className="py-2.5 px-3 font-bold text-center">Postos</th>
                <th className="py-2.5 px-3 font-bold text-center">Diárias Cumpridas</th>
                <th className="py-2.5 px-3 font-bold text-center">Glosas (D)</th>
                <th className="py-2.5 px-3 font-bold text-center">SLA Alcançado</th>
                <th className="py-2.5 px-3 font-bold text-center">Homologação Petrobras</th>
                <th className="py-2.5 px-3 font-bold text-center">Certificado SHA-256</th>
                <th className="py-2.5 px-3 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {fechamentos.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {f.competencia === "2026-09" ? "Setembro / 2026" : f.competencia === "2026-08" ? "Agosto / 2026" : f.competencia}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {f.status === "CONGELADO" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Lock className="w-3 h-3 text-emerald-700" />
                        <span>CONGELADO</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        <Unlock className="w-3 h-3 text-amber-700" />
                        <span>ABERTO</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">{f.resumoMetricas.postos}</td>
                  <td className="py-3 px-3 text-center font-semibold text-emerald-800">
                    {f.resumoMetricas.efetivas} / {f.resumoMetricas.exigiveis}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-rose-700">
                    {f.resumoMetricas.glosas}
                  </td>
                  <td className="py-3 px-3 text-center font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] ${
                        f.resumoMetricas.taxaSla >= 95
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {f.resumoMetricas.taxaSla.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {f.homologacaoPetrobras?.homologado ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        <CheckCircle2 className="w-3 h-3 text-blue-600" />
                        <span>Homologado</span>
                      </span>
                    ) : f.status === "CONGELADO" ? (
                      <span className="text-[10px] text-slate-500 italic">Pendente de atesto</span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Em apuração</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {f.hashIntegridadeSha256 ? (
                      <span
                        className="font-mono text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded cursor-pointer hover:bg-slate-200"
                        title={f.hashIntegridadeSha256}
                        onClick={() => copiarHashParaClipboard(f.hashIntegridadeSha256!)}
                      >
                        {f.hashIntegridadeSha256.substring(0, 12)}...
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link
                        href={`/relatorios?competencia=${f.competencia}`}
                        className="text-emerald-700 hover:text-emerald-900 font-bold text-[11px] p-1 rounded hover:bg-emerald-50"
                        title="Abrir relatório analítico"
                      >
                        Ver Medição
                      </Link>
                      {f.status === "CONGELADO" && (
                        <button
                          onClick={() => {
                            setCompetenciaSelecionada(f.competencia);
                            setModalReabrirAberto(true);
                          }}
                          className="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-slate-100 text-[11px]"
                          title="Reabrir emergencialmente"
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CONGELAR COMPETÊNCIA */}
      {modalCongelarAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden space-y-4">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Lock className="w-5 h-5 text-amber-400" />
                <span>Encerrar & Congelar Competência ({competenciaAtiva})</span>
              </div>
              <button
                onClick={() => setModalCongelarAberto(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Ao congelar esta competência, os dados diários de ocupação, presenças, faltas e coberturas serão <strong>bloqueados para alterações retroativas</strong>. Um snapshot imutável será certificado com hash SHA-256 e disponibilizado para a Fiscalização da Petrobras.
              </p>

              {/* Resumo das Métricas que serão gravadas no Snapshot */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Snapshot da Medição que será Assinado:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>Postos: <strong>{metricasAtivas.postos}</strong></div>
                  <div>Diárias Exigíveis: <strong>{metricasAtivas.exigiveis}</strong></div>
                  <div>Diárias Cumpridas: <strong className="text-emerald-700">{metricasAtivas.efetivas}</strong></div>
                  <div>Glosas (D): <strong className="text-rose-700">{metricasAtivas.glosas}</strong></div>
                  <div>SLA Alcançado: <strong className="text-emerald-700">{metricasAtivas.taxaSla.toFixed(1)}%</strong></div>
                  <div>Glosa Estimada: <strong className="text-rose-700">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metricasAtivas.valorGlosa)}</strong></div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Observações de Fechamento (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={obsFechamento}
                  onChange={(e) => setObsFechamento(e.target.value)}
                  placeholder="Ex: Medição apurada conforme batidas do REP e Cubo RM de 01 a 15/09."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-premier-800"
                />
              </div>

              {/* Checkbox de Responsabilidade */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-950">
                <input
                  type="checkbox"
                  id="checkDeclaracaoFechamento"
                  checked={checkDeclaracao}
                  onChange={(e) => setCheckDeclaracao(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-premier-800 cursor-pointer"
                />
                <label htmlFor="checkDeclaracaoFechamento" className="text-[11px] font-semibold cursor-pointer leading-tight">
                  Declaro que revisei a apuração de presença diária, ausências justificadas e substituições, e confirmo o encerramento formal para fins da medição contratual do Item 11.3.
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setModalCongelarAberto(false)}
                className="text-xs font-semibold px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarCongelamento}
                disabled={!checkDeclaracao}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-premier-900 hover:bg-premier-950 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                Confirmar & Gerar Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REABERTURA EMERGENCIAL */}
      {modalReabrirAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden space-y-4">
            <div className="p-4 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <RotateCcw className="w-5 h-5" />
                <span>Reabertura Emergencial da Competência ({competenciaSelecionada})</span>
              </div>
              <button
                onClick={() => setModalReabrirAberto(false)}
                className="text-amber-100 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 space-y-1">
                <strong className="block font-bold">Atenção de Auditoria & Compliance:</strong>
                <p className="text-[11px] leading-relaxed">
                  A reabertura de uma competência congelada invalida temporariamente o carimbo imutável e registra um evento de alta relevância na Trilha de Auditoria com notificação à fiscalização Petrobras.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Justificativa Formal Obrigatória (mínimo 10 caracteres) *
                </label>
                <textarea
                  rows={3}
                  value={justificativaReabertura}
                  onChange={(e) => setJustificativaReabertura(e.target.value)}
                  placeholder="Ex: Correção de marcação de ponto divergente após entrega de atestado médico físico."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setModalReabrirAberto(false)}
                className="text-xs font-semibold px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarReabertura}
                disabled={justificativaReabertura.trim().length < 10}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                Autorizar Reabertura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HOMOLOGAÇÃO PETROBRAS */}
      {modalHomologarAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden space-y-4">
            <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <FileCheck className="w-5 h-5 text-blue-300" />
                <span>Homologação Formal da Medição — Fiscalização Petrobras</span>
              </div>
              <button
                onClick={() => setModalHomologarAberto(false)}
                className="text-slate-300 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Registro do parecer do Fiscal Técnico da Petrobras atestando os postos ocupados, glosas aplicadas e conformidade da memória de cálculo para liberação do faturamento mensal.
              </p>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nome do Fiscal Técnico Responsável
                </label>
                <input
                  type="text"
                  value={fiscalNome}
                  onChange={(e) => setFiscalNome(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-700 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Parecer da Fiscalização *
                </label>
                <textarea
                  rows={3}
                  value={parecerFiscal}
                  onChange={(e) => setParecerFiscal(e.target.value)}
                  placeholder="Ex: Medição auditada e atestada para liquidação financeira conforme Item 11.3 do contrato."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setModalHomologarAberto(false)}
                className="text-xs font-semibold px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarHomologacao}
                disabled={parecerFiscal.trim().length < 5}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                Registrar Parecer & Homologar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
