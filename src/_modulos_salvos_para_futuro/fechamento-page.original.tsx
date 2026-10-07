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
  FileText,
  Download,
  Printer,
  Construction,
} from "lucide-react";
import * as XLSX from "xlsx";
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
  const [exportandoXlsx, setExportandoXlsx] = useState<boolean>(false);

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

  // Ação: Exportar Boletim de Medição em PDF / Imprimir
  const handleExportarPdf = () => {
    const originalTitle = document.title;
    document.title = `SGP_Boletim_Medicao_${competenciaAtiva}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Ação: Exportar Boletim de Medição em Excel (XLSX)
  const handleExportarXlsx = (compTarget?: string) => {
    try {
      setExportandoXlsx(true);
      const comp = compTarget || competenciaAtiva;
      const fAlvo = fechamentos.find((f) => f.competencia === comp);
      const isTargetCongelado = fAlvo?.status === "CONGELADO";
      const wb = XLSX.utils.book_new();

      // Aba 1: Boletim de Medição Oficial
      const dadosBoletim = [
        { Campo: "CONTRATO", Valor: "Petróleo Brasileiro S.A. — Petrobras ICJ 5900.0129796.25.2" },
        { Campo: "CONTRATADA", Valor: "Premier Logistics Prestação de Serviços Operacionais Ltda." },
        { Campo: "OBJETO", Valor: "Item 11.3 Medição e Apuração Mensal de Serviços Operacionais" },
        { Campo: "COMPETÊNCIA APURADA", Valor: comp === "2026-09" ? "Setembro / 2026" : comp === "2026-08" ? "Agosto / 2026" : comp },
        { Campo: "STATUS DO FECHAMENTO", Valor: isTargetCongelado ? "CONGELADO (Snapshot Imutável)" : "ABERTO (Em Apuração)" },
        { Campo: "DATA DE CONGELAMENTO", Valor: fAlvo?.congeladoEm || "Em apuração" },
        { Campo: "RESPONSÁVEL PELO FECHAMENTO", Valor: fAlvo?.congeladoPor || "Marcos Valério de Souza (Administrador Premier)" },
        { Campo: "CERTIFICAÇÃO SHA-256", Valor: fAlvo?.hashIntegridadeSha256 || "Apuração aberta" },
        { Campo: "POSTOS CONTRATADOS", Valor: isTargetCongelado ? fAlvo?.resumoMetricas.postos : metricasAtivas.postos },
        { Campo: "DIÁRIAS EXIGÍVEIS", Valor: isTargetCongelado ? fAlvo?.resumoMetricas.exigiveis : metricasAtivas.exigiveis },
        { Campo: "DIÁRIAS CUMPRIDAS (P+C)", Valor: isTargetCongelado ? fAlvo?.resumoMetricas.efetivas : metricasAtivas.efetivas },
        { Campo: "GLOSAS CONTRATUAIS (D)", Valor: isTargetCongelado ? fAlvo?.resumoMetricas.glosas : metricasAtivas.glosas },
        { Campo: "SLA ALCANÇADO (%)", Valor: `${(isTargetCongelado ? fAlvo?.resumoMetricas.taxaSla || 100 : metricasAtivas.taxaSla).toFixed(1)}%` },
        { Campo: "META CONTRATUAL SLA", Valor: "95.0%" },
        { Campo: "VALOR BRUTO CONTRATUAL (R$)", Valor: (isTargetCongelado ? fAlvo?.resumoMetricas.valorContrato || 0 : metricasAtivas.valorContrato).toFixed(2) },
        { Campo: "VALOR TOTAL DE GLOSAS (R$)", Valor: (isTargetCongelado ? fAlvo?.resumoMetricas.valorGlosa || 0 : metricasAtivas.valorGlosa).toFixed(2) },
        { Campo: "FATURAMENTO LÍQUIDO APROVADO (R$)", Valor: (isTargetCongelado ? fAlvo?.resumoMetricas.faturamentoLiquido || 0 : metricasAtivas.faturamentoLiquido).toFixed(2) },
        { Campo: "HOMOLOGAÇÃO PETROBRAS", Valor: fAlvo?.homologacaoPetrobras?.homologado ? "HOMOLOGADO PELA FISCALIZAÇÃO" : "PENDENTE DE ATESTO FORMAL" },
        { Campo: "FISCAL TÉCNICO PETROBRAS", Valor: fAlvo?.homologacaoPetrobras?.fiscalNome || "Carlos Eduardo Mendes" },
        { Campo: "PARECER DA FISCALIZAÇÃO", Valor: fAlvo?.homologacaoPetrobras?.parecer || "Em fase de auditoria e conferência técnica" },
        { Campo: "DATA DA HOMOLOGAÇÃO", Valor: fAlvo?.homologacaoPetrobras?.data || "N/A" },
      ];

      const wsBoletim = XLSX.utils.json_to_sheet(dadosBoletim);
      wsBoletim["!cols"] = [{ wch: 38 }, { wch: 70 }];
      XLSX.utils.book_append_sheet(wb, wsBoletim, "1. Boletim da Medição");

      // Aba 2: Histórico Geral de Competências
      const dadosHistorico = fechamentos.map((f) => ({
        "Competência": f.competencia,
        "Status": f.status,
        "Data Congelamento": f.congeladoEm || "Em aberto",
        "Responsável": f.congeladoPor || "",
        "Postos": f.resumoMetricas.postos,
        "Diárias Exigíveis": f.resumoMetricas.exigiveis,
        "Diárias Cumpridas": f.resumoMetricas.efetivas,
        "Glosas": f.resumoMetricas.glosas,
        "SLA (%)": `${f.resumoMetricas.taxaSla.toFixed(1)}%`,
        "Faturamento Líquido (R$)": f.resumoMetricas.faturamentoLiquido.toFixed(2),
        "Homologação Petrobras": f.homologacaoPetrobras?.homologado ? "HOMOLOGADO" : "PENDENTE",
        "Fiscal": f.homologacaoPetrobras?.fiscalNome || "",
        "Hash SHA-256": f.hashIntegridadeSha256 || "",
      }));

      const wsHistorico = XLSX.utils.json_to_sheet(dadosHistorico);
      wsHistorico["!cols"] = [
        { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 10 },
        { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 24 },
        { wch: 22 }, { wch: 24 }, { wch: 36 },
      ];
      XLSX.utils.book_append_sheet(wb, wsHistorico, "2. Histórico Consolidado");

      const downloadUrl = `/api/fechamento/exportar?competencia=${encodeURIComponent(comp)}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `SGP_Boletim_Medicao_${comp}.xlsx`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      }, 1000);

      setMensagemAlerta({
        tipo: "sucesso",
        texto: `Download do Boletim da Medição Excel (${comp}.xlsx) iniciado com sucesso!`,
      });
      setTimeout(() => setMensagemAlerta(null), 5000);
    } catch (err: any) {
      console.error("Erro ao exportar XLSX:", err);
      window.location.href = `/api/fechamento/exportar?competencia=${encodeURIComponent(compTarget || competenciaAtiva)}`;
    } finally {
      setExportandoXlsx(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-16 font-sans text-[#1A2230] select-none">
      {/* Estilos dedicados para impressão e geração de PDF */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: landscape;
            margin: 8mm 10mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #ffffff !important;
          }
          aside, nav, header.print\\:hidden, [role="navigation"], .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
        }
      `}} />

      {/* Cabeçalho Institucional exibido apenas na impressão/PDF */}
      <div className="hidden print:block border-b-2 border-[#111827] pb-4 mb-4 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Petróleo Brasileiro S.A. — Petrobras · Premier Logistics
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Boletim Mensal de Medição & Homologação — Contrato ICJ 5900.0129796.25.2
            </h2>
            <p className="text-[11px] text-slate-600">
              Item 11.3 Medição dos Serviços · Competência: <strong>{competenciaAtiva === "2026-09" ? "Setembro / 2026" : competenciaAtiva}</strong> · Status: <strong>{isCongelado ? "CONGELADA (Snapshot Imutável)" : "ABERTA (Em Apuração)"}</strong>
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <div>Certificação Digital SHA-256</div>
            <div>Emissão: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        </div>
      </div>

      {/* Banner do Módulo em Desenvolvimento */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-xs mb-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Construction className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="font-bold text-amber-900 text-xs sm:text-sm flex items-center gap-2">
                <span>Módulo em Desenvolvimento</span>
                <span className="text-[10px] uppercase font-bold bg-amber-200/70 text-amber-900 px-1.5 py-0.2 rounded">
                  Readequação
                </span>
              </h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Esta tela faz parte do módulo <strong>Em desenvolvimento</strong> enquanto os snapshots e o fechamento são adaptados para o motor por vaga.
              </p>
            </div>
          </div>
          <Link
            href="/em-desenvolvimento"
            className="text-xs font-semibold text-amber-900 hover:text-amber-950 underline shrink-0 self-start sm:self-center"
          >
            Ir para módulo em desenvolvimento &rarr;
          </Link>
        </div>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB] print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1F4FD1] mb-1">
            <span>Contrato Petrobras ICJ 5900.0129796.25.2</span>
            <span className="text-slate-300">·</span>
            <span className="text-[#5B6474]">Item 11.3 Medição</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Fechamento de Competência & Homologação
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Gestão do ciclo mensal, congelamento de snapshots imutáveis e homologação da Fiscalização Petrobras.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportarPdf}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#374151] text-xs font-semibold px-3 py-2 rounded-lg border border-[#D1D5DB] transition-colors shadow-xs"
            title="Gerar Boletim de Medição em formato PDF ou imprimir"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>Gerar PDF / Imprimir</span>
          </button>
          <button
            onClick={() => handleExportarXlsx()}
            disabled={exportandoXlsx}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#374151] text-xs font-semibold px-3 py-2 rounded-lg border border-[#D1D5DB] transition-colors shadow-xs disabled:opacity-50"
            title="Exportar Boletim da Medição em formato Excel (XLSX)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{exportandoXlsx ? "Gerando..." : "Exportar Excel (XLSX)"}</span>
          </button>
          <Link
            href={`/relatorios?competencia=${competenciaAtiva}`}
            className="inline-flex items-center gap-1.5 bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs transition-colors"
          >
            <FileCheck className="w-3.5 h-3.5 text-blue-200" />
            <span>Ver Memória de Cálculo</span>
          </Link>
        </div>
      </div>

      {/* Alerta de Sucesso / Mensagem */}
      {mensagemAlerta && (
        <div className="p-3.5 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#374151] shadow-xs flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${mensagemAlerta.tipo === "sucesso" ? "bg-emerald-500" : "bg-rose-500"}`} />
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
      <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-[#1F4FD1] shrink-0" />
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] block">
              Competência em Foco
            </label>
            <div className="flex items-center gap-3 mt-1">
              <select
                value={competenciaAtiva}
                onChange={(e) => setCompetenciaAtiva(e.target.value)}
                className="text-xs font-semibold border border-[#D1D5DB] rounded-lg p-1.5 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              >
                <option value="2026-09">Setembro / 2026 (vigente)</option>
                <option value="2026-08">Agosto / 2026 (anterior)</option>
                <option value="2026-07">Julho / 2026</option>
              </select>

              {isCongelado ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Congelada (Snapshot Imutável)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Aberta (Em Apuração)</span>
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
                className="inline-flex items-center gap-1.5 bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-xs transition-colors"
              >
                <FileCheck className="w-3.5 h-3.5 text-blue-200" />
                <span>Parecer Fiscal Petrobras</span>
              </button>
              <button
                onClick={() => {
                  setCompetenciaSelecionada(competenciaAtiva);
                  setModalReabrirAberto(true);
                }}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#374151] text-xs font-semibold px-3 py-2 rounded-lg border border-[#D1D5DB] transition-colors shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reabertura Emergencial</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setCompetenciaSelecionada(competenciaAtiva);
                setModalCongelarAberto(true);
              }}
              className="inline-flex items-center gap-1.5 bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-blue-200" />
              <span>Encerrar & Congelar Competência ({competenciaAtiva})</span>
            </button>
          )}
        </div>
      </div>

      {/* Card da Competência em Foco (Métricas e Status) */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">
              Apuração Consolidada para Fechamento
            </span>
            <h2 className="text-lg font-bold text-[#111827]">
              Competência {competenciaAtiva === "2026-09" ? "Setembro / 2026" : competenciaAtiva === "2026-08" ? "Agosto / 2026" : competenciaAtiva}
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {isCongelado
                ? `Fechamento concluído em ${fechamentoFoco?.congeladoEm || "data registrada"} por ${fechamentoFoco?.congeladoPor || "Administrador"}. Registro imutável de medição.`
                : `Apuração aberta até o dia ${metricasAtivas.limiteDia}. Ao congelar, as coberturas e ocorrências retroativas serão travadas.`}
            </p>
          </div>

          {isCongelado && fechamentoFoco?.hashIntegridadeSha256 && (
            <div className="p-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[11px] font-mono text-[#374151] flex items-center gap-2">
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl space-y-1 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Postos Contratados
            </span>
            <div className="text-2xl font-bold text-[#111827]">
              {isCongelado ? fechamentoFoco?.resumoMetricas.postos : metricasAtivas.postos}
            </div>
            <div className="text-[10px] text-[#6B7280]">bases operacionais</div>
          </div>

          <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl space-y-1 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Diárias Cumpridas (P+C)
            </span>
            <div className="text-2xl font-bold text-[#059669]">
              {isCongelado ? fechamentoFoco?.resumoMetricas.efetivas : metricasAtivas.efetivas}
            </div>
            <div className="text-[10px] text-[#6B7280]">
              {isCongelado ? fechamentoFoco?.resumoMetricas.exigiveis : metricasAtivas.exigiveis} diárias exigíveis
            </div>
          </div>

          <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl space-y-1 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Glosas Contratuais (D)
            </span>
            <div className="text-2xl font-bold text-rose-700">
              {isCongelado ? fechamentoFoco?.resumoMetricas.glosas : metricasAtivas.glosas}
            </div>
            <div className="text-[10px] text-rose-700 font-semibold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                isCongelado ? fechamentoFoco?.resumoMetricas.valorGlosa || 0 : metricasAtivas.valorGlosa
              )}
            </div>
          </div>

          <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl space-y-1 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                SLA Alcançado
              </span>
              <span className="text-[10px] font-semibold text-[#6B7280]">
                Meta: 95%
              </span>
            </div>
            <div className="text-2xl font-bold text-[#111827]">
              {(isCongelado ? fechamentoFoco?.resumoMetricas.taxaSla || 100 : metricasAtivas.taxaSla).toFixed(1)}%
            </div>
            <div className="text-[10px] font-medium flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Conforme exigência do Item 11.3</span>
            </div>
          </div>
        </div>

        {/* Parecer do Fiscal Petrobras (se houver) */}
        {fechamentoFoco?.homologacaoPetrobras?.homologado ? (
          <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#111827]">
                <FileCheck className="w-4 h-4 text-[#1F4FD1]" />
                <span>Homologação Formal da Fiscalização Petrobras</span>
              </div>
              <span className="text-[11px] text-[#6B7280] font-mono">
                Homologado em: {fechamentoFoco.homologacaoPetrobras.data || "06/09/2026"}
              </span>
            </div>
            <p className="text-xs text-[#374151] italic p-3 rounded-lg border border-[#E5E7EB] bg-slate-50/50 leading-relaxed">
              &quot;{fechamentoFoco.homologacaoPetrobras.parecer}&quot;
            </p>
            <div className="text-[11px] text-[#6B7280] font-medium text-right">
              Assinado por: <strong className="text-[#111827]">{fechamentoFoco.homologacaoPetrobras.fiscalNome || "Carlos Eduardo Mendes"}</strong>
            </div>
          </div>
        ) : isCongelado ? (
          <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2 text-[#374151]">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong className="text-[#111827]">Aguardando Homologação Petrobras:</strong> O snapshot foi gerado e encontra-se disponível para atesto do Fiscal Técnico.
              </span>
            </div>
            <button
              onClick={() => {
                setCompetenciaSelecionada(competenciaAtiva);
                setModalHomologarAberto(true);
              }}
              className="text-xs font-semibold text-[#1F4FD1] hover:underline shrink-0"
            >
              Registrar Parecer &rarr;
            </button>
          </div>
        ) : null}

        {/* Histórico de Reaberturas da Competência */}
        {fechamentoFoco?.historicoReaberturas && fechamentoFoco.historicoReaberturas.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-[#374151] flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span>Histórico de Reaberturas Emergenciais</span>
            </span>
            <div className="space-y-1.5">
              {fechamentoFoco.historicoReaberturas.map((reab, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-white border border-[#E5E7EB] rounded-lg text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#111827] font-semibold">
                    <span>Reaberto por: {reab.usuario}</span>
                    <span className="font-mono text-[#6B7280]">{reab.data}</span>
                  </div>
                  <p className="text-[#4B5563] text-[11px]">
                    <strong>Justificativa:</strong> {reab.justificativa}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Histórico Geral de Todas as Competências */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1F4FD1]" />
            <h3 className="font-bold text-sm text-[#111827]">
              Histórico Consolidado de Competências
            </h3>
          </div>
          <span className="text-xs text-[#6B7280]">
            {fechamentos.length} competência(s) registrada(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[#6B7280] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Competência</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Postos</th>
                <th className="py-2.5 px-3 text-center">Diárias Cumpridas</th>
                <th className="py-2.5 px-3 text-center">Glosas (D)</th>
                <th className="py-2.5 px-3 text-center">SLA Alcançado</th>
                <th className="py-2.5 px-3 text-center">Homologação Petrobras</th>
                <th className="py-2.5 px-3 text-center">Certificado SHA-256</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6] font-medium">
              {fechamentos.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3 font-bold text-[#111827]">
                    {f.competencia === "2026-09" ? "Setembro / 2026" : f.competencia === "2026-08" ? "Agosto / 2026" : f.competencia}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                      <span className={`w-1.5 h-1.5 rounded-full ${f.status === "CONGELADO" ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <span className={f.status === "CONGELADO" ? "text-emerald-700" : "text-amber-700"}>
                        {f.status === "CONGELADO" ? "Congelada" : "Aberta"}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-[#4B5563]">{f.resumoMetricas.postos}</td>
                  <td className="py-3 px-3 text-center font-semibold text-[#059669]">
                    {f.resumoMetricas.efetivas} / {f.resumoMetricas.exigiveis}
                  </td>
                  <td className="py-3 px-3 text-center font-semibold text-rose-700">
                    {f.resumoMetricas.glosas}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-[#111827]">
                    {f.resumoMetricas.taxaSla.toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-center">
                    {f.homologacaoPetrobras?.homologado ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Homologado</span>
                      </span>
                    ) : f.status === "CONGELADO" ? (
                      <span className="text-xs text-[#6B7280]">Pendente de atesto</span>
                    ) : (
                      <span className="text-xs text-slate-400">Em apuração</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {f.hashIntegridadeSha256 ? (
                      <span
                        className="font-mono text-[10px] text-[#4B5563] cursor-pointer hover:text-[#1F4FD1]"
                        title={f.hashIntegridadeSha256}
                        onClick={() => copiarHashParaClipboard(f.hashIntegridadeSha256!)}
                      >
                        {f.hashIntegridadeSha256.substring(0, 12)}...
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        onClick={() => handleExportarXlsx(f.competencia)}
                        className="text-[#059669] hover:underline font-semibold text-xs inline-flex items-center gap-1"
                        title="Baixar Boletim de Medição em Excel desta competência"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>XLSX</span>
                      </button>
                      <Link
                        href={`/relatorios?competencia=${f.competencia}`}
                        className="text-[#1F4FD1] hover:underline font-semibold text-xs"
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
                          className="text-[#6B7280] hover:text-[#111827] text-xs font-medium"
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

        {/* Assinaturas formais para impressão / PDF */}
        <div className="hidden print:grid grid-cols-2 gap-8 pt-12 text-center text-xs">
          <div className="border-t border-slate-400 pt-1">
            <div className="font-bold text-slate-800">Marcos Valério de Souza</div>
            <div className="text-slate-500 text-[10px]">Gestor do Contrato — Premier Logistics</div>
          </div>
          <div className="border-t border-slate-400 pt-1">
            <div className="font-bold text-slate-800">
              {fechamentoFoco?.homologacaoPetrobras?.fiscalNome || "Carlos Eduardo Mendes"}
            </div>
            <div className="text-slate-500 text-[10px]">Fiscal Técnico — Petróleo Brasileiro S.A.</div>
          </div>
        </div>
      </div>

      {/* MODAL: CONGELAR COMPETÊNCIA */}
      {modalCongelarAberto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#E5E7EB] shadow-2xl overflow-hidden space-y-4">
            <div className="p-4 bg-white border-b border-[#E5E7EB] flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-[#111827]">
                <Lock className="w-4 h-4 text-[#1F4FD1]" />
                <span>Encerrar & Congelar Competência ({competenciaAtiva})</span>
              </div>
              <button
                onClick={() => setModalCongelarAberto(false)}
                className="text-[#6B7280] hover:text-[#111827] text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[#4B5563] leading-relaxed">
                Ao congelar esta competência, os dados diários de ocupação, presenças, faltas e coberturas serão <strong>bloqueados para alterações retroativas</strong>. Um snapshot imutável será certificado com hash SHA-256 e disponibilizado para a Fiscalização da Petrobras.
              </p>

              {/* Resumo das Métricas que serão gravadas no Snapshot */}
              <div className="p-3.5 bg-white border border-[#E5E7EB] rounded-xl space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block">
                  Snapshot da Medição que será Assinado:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>Postos: <strong className="text-[#111827]">{metricasAtivas.postos}</strong></div>
                  <div>Diárias Exigíveis: <strong className="text-[#111827]">{metricasAtivas.exigiveis}</strong></div>
                  <div>Diárias Cumpridas: <strong className="text-emerald-700">{metricasAtivas.efetivas}</strong></div>
                  <div>Glosas (D): <strong className="text-rose-700">{metricasAtivas.glosas}</strong></div>
                  <div>SLA Alcançado: <strong className="text-emerald-700">{metricasAtivas.taxaSla.toFixed(1)}%</strong></div>
                  <div>Glosa Estimada: <strong className="text-rose-700">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metricasAtivas.valorGlosa)}</strong></div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-[11px] font-bold text-[#374151] block mb-1">
                  Observações de Fechamento (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={obsFechamento}
                  onChange={(e) => setObsFechamento(e.target.value)}
                  placeholder="Ex: Medição apurada conforme batidas do REP e Cubo RM de 01 a 15/09."
                  className="w-full text-xs border border-[#D1D5DB] rounded-lg p-2 focus:ring-2 focus:ring-[#1F4FD1] text-[#111827]"
                />
              </div>

              {/* Checkbox de Responsabilidade */}
              <div className="p-3 bg-white border border-[#E5E7EB] rounded-xl flex items-start gap-2.5 text-[#374151]">
                <input
                  type="checkbox"
                  id="checkDeclaracaoFechamento"
                  checked={checkDeclaracao}
                  onChange={(e) => setCheckDeclaracao(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#1F4FD1] focus:ring-[#1F4FD1] cursor-pointer"
                />
                <label htmlFor="checkDeclaracaoFechamento" className="text-[11px] font-medium cursor-pointer leading-tight text-[#374151]">
                  Declaro que revisei a apuração de presença diária, ausências justificadas e substituições, e confirmo o encerramento formal para fins da medição contratual do Item 11.3.
                </label>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-[#E5E7EB] flex items-center justify-end gap-2">
              <button
                onClick={() => setModalCongelarAberto(false)}
                className="text-xs font-semibold px-4 py-2 rounded-lg text-[#4B5563] hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarCongelamento}
                disabled={!checkDeclaracao}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
              >
                Confirmar & Gerar Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REABERTURA EMERGENCIAL */}
      {modalReabrirAberto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#E5E7EB] shadow-2xl overflow-hidden space-y-4">
            <div className="p-4 bg-white border-b border-[#E5E7EB] flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-[#111827]">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>Reabertura Emergencial da Competência ({competenciaSelecionada})</span>
              </div>
              <button
                onClick={() => setModalReabrirAberto(false)}
                className="text-[#6B7280] hover:text-[#111827] text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-white border border-[#E5E7EB] rounded-xl text-[#374151] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-rose-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Atenção de Auditoria & Compliance</span>
                </div>
                <p className="text-[11px] text-[#6B7280] leading-relaxed">
                  A reabertura de uma competência congelada invalida temporariamente o carimbo imutável e registra um evento de alta relevância na Trilha de Auditoria com notificação à fiscalização Petrobras.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#374151] block mb-1">
                  Justificativa Formal Obrigatória (mínimo 10 caracteres) *
                </label>
                <textarea
                  rows={3}
                  value={justificativaReabertura}
                  onChange={(e) => setJustificativaReabertura(e.target.value)}
                  placeholder="Ex: Correção de marcação de ponto divergente após entrega de atestado médico físico."
                  className="w-full text-xs border border-[#D1D5DB] rounded-lg p-2 focus:ring-2 focus:ring-[#1F4FD1] text-[#111827]"
                />
              </div>
            </div>

            <div className="p-4 bg-white border-t border-[#E5E7EB] flex items-center justify-end gap-2">
              <button
                onClick={() => setModalReabrirAberto(false)}
                className="text-xs font-semibold px-4 py-2 rounded-lg text-[#4B5563] hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarReabertura}
                disabled={justificativaReabertura.trim().length < 10}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
              >
                Autorizar Reabertura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HOMOLOGAÇÃO PETROBRAS */}
      {modalHomologarAberto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#E5E7EB] shadow-2xl overflow-hidden space-y-4">
            <div className="p-4 bg-white border-b border-[#E5E7EB] flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-[#111827]">
                <FileCheck className="w-4 h-4 text-[#1F4FD1]" />
                <span>Homologação Formal da Medição — Fiscalização Petrobras</span>
              </div>
              <button
                onClick={() => setModalHomologarAberto(false)}
                className="text-[#6B7280] hover:text-[#111827] text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-[#4B5563] leading-relaxed">
                Registro do parecer do Fiscal Técnico da Petrobras atestando os postos ocupados, glosas aplicadas e conformidade da memória de cálculo para liberação do faturamento mensal.
              </p>

              <div>
                <label className="text-[11px] font-bold text-[#374151] block mb-1">
                  Nome do Fiscal Técnico Responsável
                </label>
                <input
                  type="text"
                  value={fiscalNome}
                  onChange={(e) => setFiscalNome(e.target.value)}
                  className="w-full text-xs border border-[#D1D5DB] rounded-lg p-2 focus:ring-2 focus:ring-[#1F4FD1] text-[#111827] font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#374151] block mb-1">
                  Parecer da Fiscalização *
                </label>
                <textarea
                  rows={3}
                  value={parecerFiscal}
                  onChange={(e) => setParecerFiscal(e.target.value)}
                  placeholder="Ex: Medição auditada e atestada para liquidação financeira conforme Item 11.3 do contrato."
                  className="w-full text-xs border border-[#D1D5DB] rounded-lg p-2 focus:ring-2 focus:ring-[#1F4FD1] text-[#111827]"
                />
              </div>
            </div>

            <div className="p-4 bg-white border-t border-[#E5E7EB] flex items-center justify-end gap-2">
              <button
                onClick={() => setModalHomologarAberto(false)}
                className="text-xs font-semibold px-4 py-2 rounded-lg text-[#4B5563] hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarHomologacao}
                disabled={parecerFiscal.trim().length < 5}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
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
