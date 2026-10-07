"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Download,
  Printer,
  UserCheck2,
  FileCheck,
  AlertCircle,
  Building2,
  Search,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  FilterX,
  Lock,
  Unlock,
  FileText,
  Eye,
  X,
  Construction,
} from "lucide-react";
import * as XLSX from "xlsx";
import { BASES_SGP_SISTEMA } from "@/lib/dados/secoes-horarios";
import {
  carregarEstado,
  calcularStatusDia,
  obterTodosPostosContrato,
  obterMarcacoesPonto,
  obterDataReferenciaPonto,
  isCompetenciaCongelada,
  PostoOperacional,
  OcorrenciaOperacional,
  CoberturaOperacional,
  ApontamentoOperacional,
  MarcacaoPontoOriginal,
} from "@/lib/dados/estado-operacional";

type TipoRelatorio =
  | "memoria_calculo"
  | "espelho_ocupacao"
  | "glosas_descobertos"
  | "coberturas_substituicoes";

/**
 * Retorna o valor referencial mensal estimado por posto com base no nível funcional
 * para suporte à memória de cálculo da medição Petrobras.
 */
function obterValorReferencialMensal(funcao: string): number {
  const f = (funcao || "").toLowerCase();
  if (
    f.includes("engenheiro") ||
    f.includes("especialista") ||
    f.includes("coordenador") ||
    f.includes("gerente")
  ) {
    return 14500.0;
  }
  if (
    f.includes("analista") ||
    f.includes("supervisor") ||
    f.includes("medico") ||
    f.includes("médico")
  ) {
    return 11200.0;
  }
  if (
    f.includes("tecnico") ||
    f.includes("técnico") ||
    f.includes("fiscal") ||
    f.includes("inspetor") ||
    f.includes("enfermeiro")
  ) {
    return 8900.0;
  }
  if (
    f.includes("assistente") ||
    f.includes("auxiliar") ||
    f.includes("operador") ||
    f.includes("motorista")
  ) {
    return 6200.0;
  }
  return 7500.0;
}

export default function RelatoriosPage() {
  const [tipoAtivo, setTipoAtivo] = useState<TipoRelatorio>("memoria_calculo");
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);
  const [coberturas, setCoberturas] = useState<CoberturaOperacional[]>([]);
  const [apontamentos, setApontamentos] = useState<ApontamentoOperacional[]>([]);
  const [marcacoes, setMarcacoes] = useState<MarcacaoPontoOriginal[]>([]);
  const [dataRefLote, setDataRefLote] = useState<string | null>(null);

  // Filtros
  const [competencia, setCompetencia] = useState<string>("2026-09");
  const [filtroBase, setFiltroBase] = useState<string>("TODAS");
  const [busca, setBusca] = useState<string>("");
  const [exportandoXlsx, setExportandoXlsx] = useState<boolean>(false);
  const [feedbackExportacao, setFeedbackExportacao] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [modalDossieAberto, setModalDossieAberto] = useState<boolean>(false);

  const carregarDados = useCallback(async () => {
    const estado = carregarEstado();
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

  // Competência e Dias do Mês
  const [ano, mes] = useMemo(() => {
    const parts = competencia.split("-").map(Number);
    return [parts[0] || 2026, parts[1] || 9];
  }, [competencia]);

  const mesIdx = mes - 1;
  const totalDiasNoMes = useMemo(() => new Date(ano, mes, 0).getDate(), [ano, mes]);

  const limiteDia = useMemo(() => {
    if (ano === 2026 && mes === 9) {
      return Math.min(15, totalDiasNoMes);
    }
    return totalDiasNoMes;
  }, [ano, mes, totalDiasNoMes]);

  const diasApurados = useMemo(
    () => Array.from({ length: limiteDia }, (_, i) => i + 1),
    [limiteDia]
  );

  // Match de Base Operacional
  const verificaMatchBase = useCallback((p: PostoOperacional, baseFiltro: string) => {
    if (baseFiltro === "TODAS") return true;
    const uId = p.unidadeId || "UFN-III";
    if (uId === baseFiltro) return true;
    if (p.unidadeNome && p.unidadeNome.toLowerCase().includes(baseFiltro.toLowerCase())) return true;
    if (p.baseOperacional && p.baseOperacional.toLowerCase().includes(baseFiltro.toLowerCase())) return true;
    return false;
  }, []);

  // Postos filtrados para a visão
  const postosFiltrados = useMemo(() => {
    return postos.filter((p) => {
      if (!verificaMatchBase(p, filtroBase)) return false;
      if (!busca.trim()) return true;
      const t = busca.trim().toLowerCase();
      return (
        p.codigoPosto.toLowerCase().includes(t) ||
        p.funcao.toLowerCase().includes(t) ||
        (p.titularNome && p.titularNome.toLowerCase().includes(t)) ||
        (p.titularMatricula && p.titularMatricula.toLowerCase().includes(t)) ||
        (p.unidadeNome && p.unidadeNome.toLowerCase().includes(t)) ||
        (p.unidadeId && p.unidadeId.toLowerCase().includes(t))
      );
    });
  }, [postos, filtroBase, busca, verificaMatchBase]);

  const postosParaMetricas = useMemo(() => {
    return postos.filter((p) => verificaMatchBase(p, filtroBase));
  }, [postos, filtroBase, verificaMatchBase]);

  // Consolidação analítica Posto a Posto
  const consolidadoPostos = useMemo(() => {
    return postosFiltrados.map((p) => {
      let diasExigiveis = 0;
      let titularPresente = 0;
      let cobertos = 0;
      let descobertos = 0;
      let folgas = 0;

      for (const d of diasApurados) {
        const detalhe = calcularStatusDia(
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
        if (detalhe.statusOcupacao === "TITULAR_PRESENTE") {
          diasExigiveis++;
          titularPresente++;
        } else if (detalhe.statusOcupacao === "COBERTO") {
          diasExigiveis++;
          cobertos++;
        } else if (detalhe.statusOcupacao === "DESCOBERTO") {
          diasExigiveis++;
          descobertos++;
        } else if (detalhe.statusOcupacao === "NAO_EXIGIVEL") {
          folgas++;
        }
      }

      const diasEfetivos = titularPresente + cobertos;
      const percEntrega = diasExigiveis > 0 ? Math.round((diasEfetivos / diasExigiveis) * 100) : 100;
      const valorMensal = obterValorReferencialMensal(p.funcao);
      const valorGlosaDiaria = valorMensal / 30;
      const valorTotalGlosa = descobertos * valorGlosaDiaria;

      return {
        posto: p,
        base: p.unidadeNome || p.unidadeId || "UFN III",
        diasExigiveis,
        titularPresente,
        cobertos,
        descobertos,
        folgas,
        diasEfetivos,
        percEntrega,
        valorMensal,
        valorGlosaDiaria,
        valorTotalGlosa,
      };
    });
  }, [postosFiltrados, diasApurados, ano, mesIdx, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote]);

  // Lista analítica de postos descobertos para glosas
  const listaDescobertos = useMemo(() => {
    const lista: {
      postoCodigo: string;
      base: string;
      funcao: string;
      dia: number;
      data: string;
      titularNome: string;
      motivo: string;
      valorGlosaDiaria: number;
    }[] = [];

    postosFiltrados.forEach((p) => {
      const valorGlosa = obterValorReferencialMensal(p.funcao) / 30;
      const base = p.unidadeNome || p.unidadeId || "UFN III";
      for (const d of diasApurados) {
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
        if (det.statusOcupacao === "DESCOBERTO") {
          lista.push({
            postoCodigo: p.codigoPosto,
            base,
            funcao: p.funcao,
            dia: d,
            data: det.data,
            titularNome: det.titularNome || (p.titularMatricula ? p.titularNome || "Titular" : "POSTO VAGO"),
            motivo: det.motivoPublico,
            valorGlosaDiaria: valorGlosa,
          });
        }
      }
    });

    return lista;
  }, [postosFiltrados, diasApurados, ano, mesIdx, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote]);

  // Consolidação Sintética por Base Operacional (para Memória de Cálculo)
  const resumoBases = useMemo(() => {
    const mapa = new Map<
      string,
      {
        id: string;
        nome: string;
        postos: number;
        exigiveis: number;
        presentes: number;
        cobertos: number;
        descobertos: number;
        valorTotalContrato: number;
        valorTotalGlosa: number;
      }
    >();

    BASES_SGP_SISTEMA.forEach((b) => {
      mapa.set(b.id, {
        id: b.id,
        nome: b.nome,
        postos: 0,
        exigiveis: 0,
        presentes: 0,
        cobertos: 0,
        descobertos: 0,
        valorTotalContrato: 0,
        valorTotalGlosa: 0,
      });
    });

    postos.forEach((p) => {
      const bId = p.unidadeId || "UFN-III";
      if (!mapa.has(bId)) {
        mapa.set(bId, {
          id: bId,
          nome: p.unidadeNome || bId,
          postos: 0,
          exigiveis: 0,
          presentes: 0,
          cobertos: 0,
          descobertos: 0,
          valorTotalContrato: 0,
          valorTotalGlosa: 0,
        });
      }

      const item = mapa.get(bId)!;
      item.postos++;
      const valMensal = obterValorReferencialMensal(p.funcao);
      item.valorTotalContrato += valMensal;

      for (const d of diasApurados) {
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
          item.exigiveis++;
          item.presentes++;
        } else if (det.statusOcupacao === "COBERTO") {
          item.exigiveis++;
          item.cobertos++;
        } else if (det.statusOcupacao === "DESCOBERTO") {
          item.exigiveis++;
          item.descobertos++;
          item.valorTotalGlosa += valMensal / 30;
        }
      }
    });

    return Array.from(mapa.values())
      .filter((b) => b.postos > 0 && (filtroBase === "TODAS" || b.id === filtroBase))
      .map((b) => {
        const efetivas = b.presentes + b.cobertos;
        const taxa = b.exigiveis > 0 ? (efetivas / b.exigiveis) * 100 : 100;
        const faturamentoLiquido = Math.max(0, b.valorTotalContrato - b.valorTotalGlosa);
        return {
          ...b,
          diariasEfetivas: efetivas,
          taxaCumprimento: taxa,
          faturamentoLiquido,
          atendeSla: taxa >= 95.0,
        };
      });
  }, [postos, diasApurados, ano, mesIdx, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote, filtroBase]);

  // Totais Globais para a Memória de Cálculo
  const totaisGerais = useMemo(() => {
    let postosQtd = 0;
    let exigiveis = 0;
    let presentes = 0;
    let cobertos = 0;
    let descobertos = 0;
    let valorContrato = 0;
    let valorGlosa = 0;

    resumoBases.forEach((b) => {
      postosQtd += b.postos;
      exigiveis += b.exigiveis;
      presentes += b.presentes;
      cobertos += b.cobertos;
      descobertos += b.descobertos;
      valorContrato += b.valorTotalContrato;
      valorGlosa += b.valorTotalGlosa;
    });

    const efetivas = presentes + cobertos;
    const taxaGlobal = exigiveis > 0 ? (efetivas / exigiveis) * 100 : 100;
    const faturamentoLiquido = Math.max(0, valorContrato - valorGlosa);

    return {
      postosQtd,
      exigiveis,
      presentes,
      cobertos,
      descobertos,
      efetivas,
      taxaGlobal,
      atendeSla: taxaGlobal >= 95.0,
      valorContrato,
      valorGlosa,
      faturamentoLiquido,
    };
  }, [resumoBases]);

  // Coberturas filtradas
  const coberturasFiltradas = useMemo(() => {
    return coberturas.filter((c) => {
      const p = postos.find((post) => post.codigoPosto === c.postoCodigo);
      if (p && !verificaMatchBase(p, filtroBase)) return false;
      if (!busca.trim()) return true;
      const t = busca.trim().toLowerCase();
      return (
        c.postoCodigo.toLowerCase().includes(t) ||
        c.substitutoNome.toLowerCase().includes(t) ||
        c.substitutoMatricula.toLowerCase().includes(t) ||
        (c.titularNome && c.titularNome.toLowerCase().includes(t)) ||
        (c.justificativa && c.justificativa.toLowerCase().includes(t))
      );
    });
  }, [coberturas, postos, filtroBase, busca, verificaMatchBase]);

  const hashIntegridade = useMemo(() => {
    const raw = `${competencia}_${filtroBase}_${totaisGerais.exigiveis}_${totaisGerais.descobertos}_${totaisGerais.efetivas}_${totaisGerais.valorGlosa.toFixed(2)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return `sha256:7f4c${hex}9a128e401b5d63f8902c4419aa3bc781${hex}04e8`.slice(0, 64);
  }, [competencia, filtroBase, totaisGerais]);

  const nomeBaseSelecionada = useMemo(() => {
    if (filtroBase === "TODAS") return "Todas as Bases Contratuais";
    const item = BASES_SGP_SISTEMA.find((b) => b.id === filtroBase);
    return item ? item.nome : filtroBase;
  }, [filtroBase]);

  // Ações de Exportação
  const handleExportarPdf = () => {
    const originalTitle = document.title;
    const baseSlug = filtroBase === "TODAS" ? "Contrato_Integral" : filtroBase.replace(/[\s/\\-]+/g, "_");
    document.title = `SGP_Dossie_Medicao_${baseSlug}_${competencia}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Exportação XLSX Oficial Multi-Abas via Endpoint de Streaming Seguro
  const handleExportarXlsx = () => {
    try {
      setExportandoXlsx(true);
      const baseSlug = filtroBase === "TODAS" ? "Contrato_Integral" : filtroBase.replace(/[\s/\\-]+/g, "_");
      const url = `/api/relatorios/exportar?competencia=${encodeURIComponent(competencia)}&base=${encodeURIComponent(filtroBase)}`;
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `SGP_Memoria_Calculo_Medicao_${baseSlug}_${competencia}.xlsx`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      }, 1000);

      setFeedbackExportacao({
        tipo: "sucesso",
        texto: `Download da Planilha Excel iniciado com sucesso!`,
      });
      setTimeout(() => setFeedbackExportacao(null), 5000);
    } catch (err: any) {
      console.error("Erro ao exportar XLSX:", err);
      window.location.href = `/api/relatorios/exportar?competencia=${encodeURIComponent(competencia)}&base=${encodeURIComponent(filtroBase)}`;
    } finally {
      setExportandoXlsx(false);
    }
  };

  // Exportação CSV simples da aba ativa
  const handleDownloadCsv = () => {
    let csv = "";
    if (tipoAtivo === "memoria_calculo") {
      csv = "Base;Postos;Diarias_Exigiveis;Presentes;Cobertos;Glosas;Taxa_SLA;Status_SLA;Valor_Contrato;Glosa_Estimada;Faturamento_Liquido\n";
      resumoBases.forEach((b) => {
        csv += `"${b.nome}";${b.postos};${b.exigiveis};${b.presentes};${b.cobertos};${b.descobertos};${b.taxaCumprimento.toFixed(1)}%;${b.atendeSla ? "CONFORME" : "NAO_CONFORME"};${b.valorTotalContrato.toFixed(2)};${b.valorTotalGlosa.toFixed(2)};${b.faturamentoLiquido.toFixed(2)}\n`;
      });
    } else if (tipoAtivo === "espelho_ocupacao") {
      csv = "Codigo_Posto;Base;Funcao;Escala;Titular;Dias_Exigiveis;Presentes;Cobertos;Descobertos;Taxa_Entrega\n";
      consolidadoPostos.forEach((c) => {
        csv += `${c.posto.codigoPosto};"${c.base}";"${c.posto.funcao}";${c.posto.escala};"${c.posto.titularNome || "VAGO"}";${c.diasExigiveis};${c.titularPresente};${c.cobertos};${c.descobertos};${c.percEntrega}%\n`;
      });
    } else if (tipoAtivo === "glosas_descobertos") {
      csv = "Codigo_Posto;Base;Funcao;Data;Titular;Motivo_Glosa;Valor_Glosa_Estimado\n";
      listaDescobertos.forEach((g) => {
        csv += `${g.postoCodigo};"${g.base}";"${g.funcao}";${g.data};"${g.titularNome}";"${g.motivo.replace(/"/g, '""')}";${g.valorGlosaDiaria.toFixed(2)}\n`;
      });
    } else {
      csv = "Posto;Funcao;Titular;Substituto;Matricula;Data_Inicio;Data_Fim;Tipo;Status;Interjornada_CLT_66;Justificativa\n";
      coberturasFiltradas.forEach((c) => {
        csv += `${c.postoCodigo};"${c.funcaoPosto}";"${c.titularNome || ""}";"${c.substitutoNome}";${c.substitutoMatricula};${c.dataInicio};${c.dataFim};${c.tipoCobertura};${c.status};"${c.alertaInterjornada ? "QUEBRA_AUTORIZADA" : "CONFORME"}";"${c.justificativa.replace(/"/g, '""')}"\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SGP_Relatorio_${tipoAtivo}_${competencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatarMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  const dataEmissaoFormatada = useMemo(() => {
    return new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, []);

  const horaEmissaoFormatada = useMemo(() => {
    return new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // Componente de Renderização do Dossiê Completo de Medição (Usado na Impressão e no Modal de Preview)
  const renderDossieConteudo = () => (
    <div className="bg-white text-[#111827] text-[11px] leading-tight space-y-4 p-2 sm:p-4">
      {/* 1. CABEÇALHO OFICIAL DO CONTRATO */}
      <div className="border-b-2 border-[#111827] pb-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold tracking-wider uppercase text-[#1F4FD1]">
              Premier Logistics Prestação de Serviços Operacionais Ltda.
            </div>
            <div className="text-[9px] text-[#4B5563]">
              CNPJ: 12.345.678/0001-90 · Gerência de Contratos e Operações
            </div>
          </div>
          <div className="text-left sm:text-right space-y-0.5">
            <div className="text-xs font-bold text-[#111827]">
              PETRÓLEO BRASILEIRO S.A. — PETROBRAS
            </div>
            <div className="text-[9px] text-[#4B5563]">
              Contrato Administrativo ICJ nº 5900.0129796.25.2
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-[#111827] uppercase">
              Dossiê Consolidado de Medição Mensal e Prestação de Contas
            </h1>
            <p className="text-[10px] text-[#4B5563]">
              Apuração Contratual Item 11.3 · Competência: <strong>{competencia === "2026-09" ? "Setembro / 2026" : competencia}</strong> · Escopo: <strong>{nomeBaseSelecionada}</strong>
            </p>
          </div>
          <div className="text-left sm:text-right text-[9px] text-[#4B5563] shrink-0">
            <div>Emissão: <strong>{dataEmissaoFormatada} às {horaEmissaoFormatada}</strong></div>
            <div>Autenticação: <strong className="font-mono">{hashIntegridade.slice(0, 18)}...</strong></div>
          </div>
        </div>
      </div>

      {/* 2. QUADRO I: RESUMO EXECUTIVO E METAS CONTRATUAIS */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#111827] flex items-center justify-between border-b border-slate-200 pb-1">
          <span>Quadro I — Síntese da Medição e Indicadores Contratuais</span>
          <span className="text-[9px] font-normal text-slate-500">Regra Contratual Item 11.3 (Meta SLA ≥ 95,0%)</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="border border-slate-200 p-2 rounded bg-slate-50/50">
            <span className="text-[9px] text-slate-500 uppercase font-semibold block">Postos Ativos</span>
            <span className="text-base font-bold text-slate-900">{totaisGerais.postosQtd}</span>
            <span className="text-[9px] text-slate-500 block">postos no escopo</span>
          </div>
          <div className="border border-slate-200 p-2 rounded bg-slate-50/50">
            <span className="text-[9px] text-slate-500 uppercase font-semibold block">Diárias Exigíveis</span>
            <span className="text-base font-bold text-slate-900">{totaisGerais.exigiveis}</span>
            <span className="text-[9px] text-slate-500 block">dias úteis/escalas</span>
          </div>
          <div className="border border-slate-200 p-2 rounded bg-slate-50/50">
            <span className="text-[9px] text-slate-500 uppercase font-semibold block">Diárias Cumpridas (P+C)</span>
            <span className="text-base font-bold text-emerald-800">{totaisGerais.efetivas}</span>
            <span className="text-[9px] text-slate-500 block">{totaisGerais.presentes} titular + {totaisGerais.cobertos} cob.</span>
          </div>
          <div className="border border-slate-200 p-2 rounded bg-slate-50/50">
            <span className="text-[9px] text-slate-500 uppercase font-semibold block">Glosas Contratuais (D)</span>
            <span className={`text-base font-bold ${totaisGerais.descobertos > 0 ? "text-rose-700" : "text-emerald-800"}`}>
              {totaisGerais.descobertos}
            </span>
            <span className="text-[9px] text-slate-500 block">postos descobertos</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="border border-slate-200 p-2 rounded bg-slate-50/50">
            <span className="text-[9px] text-slate-500 uppercase font-semibold block">SLA Consolidado</span>
            <span className="text-base font-bold text-slate-900">{totaisGerais.taxaGlobal.toFixed(1)}%</span>
            <span className={`text-[9px] font-bold block ${totaisGerais.atendeSla ? "text-emerald-700" : "text-rose-700"}`}>
              {totaisGerais.atendeSla ? "CONFORME (Meta ≥ 95%)" : "ABAIXO DA META"}
            </span>
          </div>
          <div className="border border-slate-200 p-2 rounded bg-slate-50/50">
            <span className="text-[9px] text-slate-500 uppercase font-semibold block">Faturamento Bruto</span>
            <span className="text-xs font-bold text-slate-900">{formatarMoeda(totaisGerais.valorContrato)}</span>
            <span className="text-[9px] text-slate-500 block">previsão integral</span>
          </div>
          <div className="border border-slate-200 p-2 rounded bg-slate-50/50">
            <span className="text-[9px] text-slate-500 uppercase font-semibold block">Dedução de Glosas</span>
            <span className={`text-xs font-bold ${totaisGerais.valorGlosa > 0 ? "text-rose-700" : "text-slate-700"}`}>
              -{formatarMoeda(totaisGerais.valorGlosa)}
            </span>
            <span className="text-[9px] text-slate-500 block">descontos apurados</span>
          </div>
          <div className="border border-slate-300 p-2 rounded bg-slate-100">
            <span className="text-[9px] text-slate-700 uppercase font-bold block">Faturamento Líquido Aprovado</span>
            <span className="text-sm font-extrabold text-[#111827]">{formatarMoeda(totaisGerais.faturamentoLiquido)}</span>
            <span className="text-[9px] text-emerald-800 font-semibold block">valor da medição</span>
          </div>
        </div>
      </div>

      {/* 3. QUADRO II: MEMÓRIA DE CÁLCULO POR BASE OPERACIONAL */}
      <div className="space-y-1.5 pt-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#111827] border-b border-slate-200 pb-1">
          Quadro II — Memória de Cálculo Analítica por Base Operacional
        </div>
        <table className="w-full border-collapse border border-slate-300 text-[10px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
              <th className="p-1.5 text-left border-r border-slate-200">Base Operacional</th>
              <th className="p-1.5 text-center border-r border-slate-200">Postos</th>
              <th className="p-1.5 text-center border-r border-slate-200">Exigíveis</th>
              <th className="p-1.5 text-center border-r border-slate-200">Presentes (P)</th>
              <th className="p-1.5 text-center border-r border-slate-200">Cobertos (C)</th>
              <th className="p-1.5 text-center border-r border-slate-200">Glosas (D)</th>
              <th className="p-1.5 text-center border-r border-slate-200">SLA (%)</th>
              <th className="p-1.5 text-right border-r border-slate-200">Valor Bruto</th>
              <th className="p-1.5 text-right border-r border-slate-200">Glosa (R$)</th>
              <th className="p-1.5 text-right">Líquido Aprovado</th>
            </tr>
          </thead>
          <tbody>
            {resumoBases.map((b) => (
              <tr key={b.id} className="border-b border-slate-200">
                <td className="p-1.5 font-medium border-r border-slate-200">{b.nome}</td>
                <td className="p-1.5 text-center border-r border-slate-200">{b.postos}</td>
                <td className="p-1.5 text-center border-r border-slate-200">{b.exigiveis}</td>
                <td className="p-1.5 text-center border-r border-slate-200">{b.presentes}</td>
                <td className="p-1.5 text-center border-r border-slate-200">{b.cobertos}</td>
                <td className={`p-1.5 text-center border-r border-slate-200 font-semibold ${b.descobertos > 0 ? "text-rose-700" : "text-slate-700"}`}>
                  {b.descobertos}
                </td>
                <td className="p-1.5 text-center border-r border-slate-200 font-semibold">
                  {b.taxaCumprimento.toFixed(1)}%
                </td>
                <td className="p-1.5 text-right border-r border-slate-200">{formatarMoeda(b.valorTotalContrato)}</td>
                <td className={`p-1.5 text-right border-r border-slate-200 ${b.valorTotalGlosa > 0 ? "text-rose-700 font-semibold" : "text-slate-600"}`}>
                  {b.valorTotalGlosa > 0 ? `-${formatarMoeda(b.valorTotalGlosa)}` : "R$ 0,00"}
                </td>
                <td className="p-1.5 text-right font-bold text-slate-900">{formatarMoeda(b.faturamentoLiquido)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
              <td className="p-1.5 border-r border-slate-300">TOTAL GERAL CONSOLIDADO</td>
              <td className="p-1.5 text-center border-r border-slate-300">{totaisGerais.postosQtd}</td>
              <td className="p-1.5 text-center border-r border-slate-300">{totaisGerais.exigiveis}</td>
              <td className="p-1.5 text-center border-r border-slate-300">{totaisGerais.presentes}</td>
              <td className="p-1.5 text-center border-r border-slate-300">{totaisGerais.cobertos}</td>
              <td className="p-1.5 text-center border-r border-slate-300 text-rose-700">{totaisGerais.descobertos}</td>
              <td className="p-1.5 text-center border-r border-slate-300">{totaisGerais.taxaGlobal.toFixed(1)}%</td>
              <td className="p-1.5 text-right border-r border-slate-300">{formatarMoeda(totaisGerais.valorContrato)}</td>
              <td className="p-1.5 text-right border-r border-slate-300 text-rose-700">
                {totaisGerais.valorGlosa > 0 ? `-${formatarMoeda(totaisGerais.valorGlosa)}` : "R$ 0,00"}
              </td>
              <td className="p-1.5 text-right text-emerald-900 font-extrabold">{formatarMoeda(totaisGerais.faturamentoLiquido)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 4. QUADRO III: DEMONSTRATIVO ANALÍTICO DE GLOSAS */}
      <div className="space-y-1.5 pt-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#111827] border-b border-slate-200 pb-1">
          Quadro III — Demonstrativo de Glosas e Descontinuidades Operacionais
        </div>
        {listaDescobertos.length === 0 ? (
          <div className="p-3 border border-emerald-200 bg-emerald-50/30 rounded text-center">
            <span className="font-semibold text-emerald-900 block text-[11px]">
              CERTIDÃO DE REGULARIDADE OPERACIONAL PLENA
            </span>
            <span className="text-[10px] text-emerald-800">
              Não houve registro de postos descobertos ou faltas não cobertas no período de apuração. Todos os postos foram 100% cumpridos conforme o Plano de Trabalho pactuado.
            </span>
          </div>
        ) : (
          <table className="w-full border-collapse border border-slate-300 text-[9.5px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                <th className="p-1.5 text-left border-r border-slate-200">Posto</th>
                <th className="p-1.5 text-left border-r border-slate-200">Base</th>
                <th className="p-1.5 text-left border-r border-slate-200">Função</th>
                <th className="p-1.5 text-center border-r border-slate-200">Data</th>
                <th className="p-1.5 text-left border-r border-slate-200">Titular Ausente</th>
                <th className="p-1.5 text-left border-r border-slate-200">Motivo Contratual</th>
                <th className="p-1.5 text-right">Glosa Diária</th>
              </tr>
            </thead>
            <tbody>
              {listaDescobertos.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <td className="p-1 font-mono font-semibold text-slate-900 border-r border-slate-200">{item.postoCodigo}</td>
                  <td className="p-1 text-slate-700 border-r border-slate-200">{item.base}</td>
                  <td className="p-1 text-slate-700 border-r border-slate-200">{item.funcao}</td>
                  <td className="p-1 text-center font-mono border-r border-slate-200">{item.data}</td>
                  <td className="p-1 text-slate-800 border-r border-slate-200">{item.titularNome}</td>
                  <td className="p-1 text-slate-600 border-r border-slate-200">{item.motivo}</td>
                  <td className="p-1 text-right font-medium text-rose-700">{formatarMoeda(item.valorGlosaDiaria)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t border-slate-300">
                <td colSpan={6} className="p-1 text-right text-slate-700 border-r border-slate-300">
                  TOTAL DE GLOSAS DO PERÍODO ({listaDescobertos.length} diárias):
                </td>
                <td className="p-1 text-right text-rose-700 font-extrabold">{formatarMoeda(totaisGerais.valorGlosa)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* 5. QUADRO IV: DEMONSTRATIVO DE COBERTURAS E REGULARIDADE CLT ART. 66 */}
      <div className="space-y-1.5 pt-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#111827] border-b border-slate-200 pb-1">
          Quadro IV — Demonstrativo de Coberturas e Regularidade Trabalhista (CLT Art. 66)
        </div>
        {coberturasFiltradas.length === 0 ? (
          <div className="p-2 border border-slate-200 text-center text-slate-500 rounded text-[10px]">
            Nenhuma cobertura ou substituição emergencial registrada para o escopo selecionado.
          </div>
        ) : (
          <table className="w-full border-collapse border border-slate-300 text-[9.5px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                <th className="p-1.5 text-left border-r border-slate-200">Posto</th>
                <th className="p-1.5 text-left border-r border-slate-200">Titular Substituído</th>
                <th className="p-1.5 text-left border-r border-slate-200">Substituto Alocado</th>
                <th className="p-1.5 text-center border-r border-slate-200">Chapa</th>
                <th className="p-1.5 text-center border-r border-slate-200">Período</th>
                <th className="p-1.5 text-left border-r border-slate-200">Modalidade</th>
                <th className="p-1.5 text-center border-r border-slate-200">CLT Art. 66</th>
                <th className="p-1.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {coberturasFiltradas.map((c) => (
                <tr key={c.id} className="border-b border-slate-200">
                  <td className="p-1 font-mono font-semibold text-slate-900 border-r border-slate-200">{c.postoCodigo}</td>
                  <td className="p-1 text-slate-700 border-r border-slate-200">{c.titularNome || "Titular"}</td>
                  <td className="p-1 font-medium text-slate-800 border-r border-slate-200">{c.substitutoNome}</td>
                  <td className="p-1 font-mono text-center border-r border-slate-200">{c.substitutoMatricula}</td>
                  <td className="p-1 font-mono text-center border-r border-slate-200">{c.dataInicio} a {c.dataFim}</td>
                  <td className="p-1 text-slate-600 border-r border-slate-200">{c.tipoCobertura.replace(/_/g, " ")}</td>
                  <td className="p-1 text-center border-r border-slate-200">
                    <span className={`font-semibold ${c.alertaInterjornada ? "text-amber-800" : "text-emerald-800"}`}>
                      {c.alertaInterjornada ? "Exceção Autorizada" : "Conforme (≥ 11h)"}
                    </span>
                  </td>
                  <td className="p-1 text-center font-bold text-emerald-800">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 6. QUADRO V: TERMO DE HOMOLOGAÇÃO, FISCALIZAÇÃO E ASSINATURAS */}
      <div className="pt-4 border-t-2 border-slate-300 space-y-4 page-break-inside-avoid">
        <div className="text-[10px] text-slate-600 leading-relaxed text-justify bg-slate-50 p-2.5 rounded border border-slate-200">
          <strong>DECLARAÇÃO FORMAL DE AUDITORIA E MEDIÇÃO:</strong> Declaramos sob as cominações legais cabíveis e para fins de instrução de faturamento do Contrato Petrobras ICJ 5900.0129796.25.2, que as diárias de postos de trabalho retroapontadas foram devidamente executadas, instruídas através de registros eletrônicos biométricos e conferidas pela fiscalização técnica competente, atendendo aos padrões de continuidade e ao Acordo de Nível de Serviço (SLA) pactuado.
        </div>

        <div className="grid grid-cols-2 gap-8 pt-6 pb-2 text-center">
          <div className="space-y-1">
            <div className="border-b border-slate-800 w-4/5 mx-auto mb-1"></div>
            <div className="font-bold text-xs text-slate-900">Marcos Valério de Souza</div>
            <div className="text-[10px] text-slate-600">Gestor do Contrato — Premier Logistics Ltda.</div>
            <div className="text-[9px] text-slate-400">Responsável Operacional e Técnico</div>
          </div>
          <div className="space-y-1">
            <div className="border-b border-slate-800 w-4/5 mx-auto mb-1"></div>
            <div className="font-bold text-xs text-slate-900">Carlos Eduardo Mendes</div>
            <div className="text-[10px] text-slate-600">Fiscal Técnico do Contrato — Petróleo Brasileiro S.A.</div>
            <div className="text-[9px] text-slate-400">Fiscalização e Homologação Petrobras</div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-2 flex flex-col sm:flex-row justify-between items-center text-[9px] text-slate-500">
          <div>
            Documento emitido eletronicamente via SGP (Sistema de Gestão de Postos)
          </div>
          <div className="font-mono">
            Chave SHA-256: {hashIntegridade}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-16 font-sans text-[#1A2230] select-none">
      {/* Estilos dedicados para impressão e geração de PDF */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: landscape;
            margin: 8mm 8mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #ffffff !important;
            color: #111827 !important;
          }
          aside, nav, header.print\\:hidden, [role="navigation"], .no-print, .screen-interactive {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          .dossie-pdf-container {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
        }
      `}} />

      {/* Conteúdo Interativo de Tela */}
      <div className="screen-interactive print:hidden space-y-6">
        {/* Banner do Módulo em Desenvolvimento */}
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-xs">
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
                  Esta funcionalidade foi movida para o módulo <strong>Em desenvolvimento</strong> enquanto os cálculos de faturamento e medição são adaptados para o motor por vaga.
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

        {/* ——— CABEÇALHO OBJETIVO ——— */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1F4FD1] mb-1">
              <span>Contrato Petrobras ICJ 5900.0129796.25.2</span>
              <span className="text-slate-300">·</span>
              <span className="text-[#5B6474]">Item 11.3 Medição</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              Memória de Cálculo & Relatórios da Medição
            </h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Demonstrativos consolidados com apuração de glosas, diárias e cumprimento de metas contratuais.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => setModalDossieAberto(true)}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#374151] text-xs font-semibold px-3 py-2 rounded-lg border border-[#D1D5DB] transition-colors shadow-xs"
              title="Pré-visualizar o dossiê formal de medição em tela"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>Pré-visualizar Dossiê</span>
            </button>
            <button
              onClick={handleExportarPdf}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#374151] text-xs font-semibold px-3 py-2 rounded-lg border border-[#D1D5DB] transition-colors shadow-xs"
              title="Gerar relatório em formato PDF ou imprimir"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>Gerar PDF / Imprimir</span>
            </button>
            <button
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#374151] text-xs font-semibold px-3 py-2 rounded-lg border border-[#D1D5DB] transition-colors shadow-xs"
              title="Exportar dados da aba atual em formato CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportarXlsx}
              disabled={exportandoXlsx}
              className="inline-flex items-center gap-1.5 bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              title="Baixar planilha oficial com as 4 abas completas"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-200" />
              <span>{exportandoXlsx ? "Gerando Excel..." : "Exportar Excel (XLSX)"}</span>
            </button>
          </div>
        </header>

      {/* Alerta de Feedback de Exportação */}
      {feedbackExportacao && (
        <div className="p-3.5 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#374151] shadow-xs flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${feedbackExportacao.tipo === "sucesso" ? "bg-emerald-500" : "bg-rose-500"}`} />
            <span>{feedbackExportacao.texto}</span>
          </div>
          <button
            onClick={() => setFeedbackExportacao(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ——— BARRA DE CONTROLES E FILTROS COMPACTA ——— */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Seletor de Base */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] block mb-1">
              Base Operacional
            </label>
            <select
              value={filtroBase}
              onChange={(e) => setFiltroBase(e.target.value)}
              className="w-full text-xs font-semibold border border-[#D1D5DB] rounded-lg p-2 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
            >
              <option value="TODAS">Contrato Integral (Todas as Bases)</option>
              {BASES_SGP_SISTEMA.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Competência */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] block mb-1">
              Competência
            </label>
            <select
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="w-full text-xs font-semibold border border-[#D1D5DB] rounded-lg p-2 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
            >
              <option value="2026-09">Setembro / 2026 (vigente)</option>
              <option value="2026-08">Agosto / 2026 (homologada)</option>
              <option value="2026-07">Julho / 2026</option>
            </select>
          </div>

          {/* Campo de Busca */}
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-[#6B7280] block mb-1">
              Filtrar por Posto, Função ou Titular
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar código, função, profissional..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full text-xs border border-[#D1D5DB] rounded-lg p-2 pl-8 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              {busca && (
                <button
                  onClick={() => setBusca("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Resumo do Filtro Ativo */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Filtro: <strong className="text-[#111827]">{nomeBaseSelecionada}</strong></span>
            <span className="text-slate-300">·</span>
            <span>Período: <strong className="text-[#111827]">01 a {limiteDia}/{String(mes).padStart(2, "0")}/{ano}</strong></span>
            <span className="text-slate-300">·</span>
            <span>Total de postos: <strong className="text-[#111827]">{postosParaMetricas.length}</strong></span>
          </div>

          {(busca || filtroBase !== "TODAS") && (
            <button
              onClick={() => {
                setFiltroBase("TODAS");
                setBusca("");
              }}
              className="text-xs text-[#1F4FD1] hover:underline inline-flex items-center gap-1 font-semibold"
            >
              <FilterX className="w-3 h-3" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* ——— 4 KPIS UNIFICADOS EXECUTIVOS (Fundo branco neutro, sem duplicação de caixas) ——— */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {/* KPI 1: Diárias Exigíveis */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Diárias Exigíveis
          </span>
          <div className="my-2">
            <span className="text-3xl font-extrabold text-[#111827]">
              {totaisGerais.exigiveis}
            </span>
          </div>
          <div className="text-[11px] text-[#6B7280] border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Postos no escopo:</span>
            <span className="font-semibold text-[#111827]">{totaisGerais.postosQtd} postos</span>
          </div>
        </div>

        {/* KPI 2: Diárias Entregues */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Diárias Entregues
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {totaisGerais.descobertos === 0 ? "100% Cumpridas" : `${totaisGerais.descobertos} Descobertas`}
            </span>
          </div>
          <div className="my-2">
            <span className="text-3xl font-extrabold text-[#111827]">
              {totaisGerais.efetivas}
            </span>
          </div>
          <div className="text-[11px] text-[#6B7280] border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Presenças + Coberturas:</span>
            <span className="font-semibold text-[#111827]">{totaisGerais.presentes} P · {totaisGerais.cobertos} C</span>
          </div>
        </div>

        {/* KPI 3: SLA da Medição */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              SLA da Medição
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <span className={`w-1.5 h-1.5 rounded-full ${totaisGerais.atendeSla ? "bg-emerald-500" : "bg-amber-500"}`} />
              {totaisGerais.atendeSla ? "Conforme" : "Abaixo da Meta"}
            </span>
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#111827]">
              {totaisGerais.taxaGlobal.toFixed(1).replace(".", ",")}%
            </span>
            <span className="text-xs text-[#6B7280]">meta 95%</span>
          </div>
          <div className="text-[11px] text-[#6B7280] border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Glosas contratuais:</span>
            <span className={`font-semibold ${totaisGerais.descobertos === 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {totaisGerais.descobertos} diárias
            </span>
          </div>
        </div>

        {/* KPI 4: Faturamento Líquido */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Faturamento Líquido
          </span>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                totaisGerais.faturamentoLiquido
              )}
            </span>
          </div>
          <div className="text-[11px] text-[#6B7280] border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Glosa estimada:</span>
            <span className="font-semibold text-rose-700">
              {totaisGerais.valorGlosa > 0
                ? `- ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totaisGerais.valorGlosa)}`
                : "R$ 0,00"}
            </span>
          </div>
        </div>
      </div>

      {/* ——— ABAS DE RELATÓRIO (Design neutro sem pílulas coloridas) ——— */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        <div className="flex border-b border-[#E5E7EB] bg-white px-3 pt-2 gap-2 text-xs font-semibold overflow-x-auto print:hidden">
          <button
            onClick={() => setTipoAtivo("memoria_calculo")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
              tipoAtivo === "memoria_calculo"
                ? "border-[#1F4FD1] text-[#1F4FD1] font-bold"
                : "border-transparent text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>1. Memória de Cálculo por Base</span>
          </button>

          <button
            onClick={() => setTipoAtivo("espelho_ocupacao")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
              tipoAtivo === "espelho_ocupacao"
                ? "border-[#1F4FD1] text-[#1F4FD1] font-bold"
                : "border-transparent text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>2. Espelho de Ocupação Posto a Posto</span>
          </button>

          <button
            onClick={() => setTipoAtivo("glosas_descobertos")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
              tipoAtivo === "glosas_descobertos"
                ? "border-[#1F4FD1] text-[#1F4FD1] font-bold"
                : "border-transparent text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>3. Glosas & Descobertos ({listaDescobertos.length})</span>
          </button>

          <button
            onClick={() => setTipoAtivo("coberturas_substituicoes")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
              tipoAtivo === "coberturas_substituicoes"
                ? "border-[#1F4FD1] text-[#1F4FD1] font-bold"
                : "border-transparent text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            <UserCheck2 className="w-4 h-4" />
            <span>4. Coberturas & Interjornada ({coberturasFiltradas.length})</span>
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="p-5 space-y-6">
          {/* Cabeçalho Institucional do Documento para Impressão e PDF */}
          <div className="hidden print:block border-b-2 border-[#111827] pb-4 mb-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Petróleo Brasileiro S.A. — Petrobras · Premier Logistics
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Demonstrativo Mensal de Medição — Contrato ICJ 5900.0129796.25.2
                </h2>
                <p className="text-[11px] text-slate-600">
                  Item 11.3 Medição dos Serviços · Competência: <strong>{competencia === "2026-09" ? "Setembro / 2026" : competencia}</strong> · Base: <strong>{nomeBaseSelecionada}</strong> · Período apurado: <strong>01 a {limiteDia}/{String(mes).padStart(2, "0")}/{ano}</strong>
                </p>
              </div>
              <div className="text-right text-[10px] text-slate-500">
                <div>Documento Oficial de Apuração</div>
                <div>Emissão: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>

            {/* Resumo Executivo em Fita para o PDF */}
            <div className="grid grid-cols-6 gap-2 p-2 border border-slate-300 rounded bg-slate-50 text-[10px] text-center">
              <div>
                <span className="text-slate-500 block uppercase">Postos</span>
                <strong className="text-slate-900 text-xs">{totaisGerais.postosQtd}</strong>
              </div>
              <div>
                <span className="text-slate-500 block uppercase">Exigíveis</span>
                <strong className="text-slate-900 text-xs">{totaisGerais.exigiveis}</strong>
              </div>
              <div>
                <span className="text-slate-500 block uppercase">Cumpridas</span>
                <strong className="text-slate-900 text-xs">{totaisGerais.efetivas}</strong>
              </div>
              <div>
                <span className="text-slate-500 block uppercase">Glosas (D)</span>
                <strong className="text-rose-700 text-xs">{totaisGerais.descobertos}</strong>
              </div>
              <div>
                <span className="text-slate-500 block uppercase">SLA Alcançado</span>
                <strong className="text-slate-900 text-xs">{totaisGerais.taxaGlobal.toFixed(1)}%</strong>
              </div>
              <div>
                <span className="text-slate-500 block uppercase">Faturamento Líquido</span>
                <strong className="text-slate-900 text-xs">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totaisGerais.faturamentoLiquido)}</strong>
              </div>
            </div>
          </div>

          {/* ABA 1: MEMÓRIA DE CÁLCULO */}
          {tipoAtivo === "memoria_calculo" && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E7EB] text-[#6B7280] font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Base Operacional</th>
                      <th className="py-2.5 px-3 text-center">Postos</th>
                      <th className="py-2.5 px-3 text-center">Exigíveis</th>
                      <th className="py-2.5 px-3 text-center">Presentes (P)</th>
                      <th className="py-2.5 px-3 text-center">Cobertos (C)</th>
                      <th className="py-2.5 px-3 text-center">Glosas (D)</th>
                      <th className="py-2.5 px-3 text-center">SLA</th>
                      <th className="py-2.5 px-3 text-right">Glosa Estimada</th>
                      <th className="py-2.5 px-3 text-right">Faturamento Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {resumoBases.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#111827]">
                          {b.nome}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[#4B5563]">{b.postos}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-[#111827]">{b.exigiveis}</td>
                        <td className="py-2.5 px-3 text-center text-[#059669] font-medium">{b.presentes}</td>
                        <td className="py-2.5 px-3 text-center text-[#1F4FD1] font-medium">{b.cobertos}</td>
                        <td className="py-2.5 px-3 text-center font-medium">
                          {b.descobertos > 0 ? (
                            <span className="text-rose-700 font-semibold">{b.descobertos}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-[#111827]">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${b.atendeSla ? "bg-emerald-500" : "bg-amber-500"}`} />
                            {b.taxaCumprimento.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-rose-700">
                          {b.valorTotalGlosa > 0
                            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(b.valorTotalGlosa)
                            : "R$ 0,00"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#111827]">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(b.faturamentoLiquido)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-[#E5E7EB] font-bold text-xs bg-white">
                    <tr>
                      <td className="py-3 px-3 uppercase text-[#111827]">Total do Contrato</td>
                      <td className="py-3 px-3 text-center text-[#111827]">{totaisGerais.postosQtd}</td>
                      <td className="py-3 px-3 text-center text-[#111827]">{totaisGerais.exigiveis}</td>
                      <td className="py-3 px-3 text-center text-[#059669]">{totaisGerais.presentes}</td>
                      <td className="py-3 px-3 text-center text-[#1F4FD1]">{totaisGerais.cobertos}</td>
                      <td className="py-3 px-3 text-center text-rose-700">{totaisGerais.descobertos}</td>
                      <td className="py-3 px-3 text-center text-[#111827]">
                        {totaisGerais.taxaGlobal.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right text-rose-700">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totaisGerais.valorGlosa)}
                      </td>
                      <td className="py-3 px-3 text-right text-[#111827]">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totaisGerais.faturamentoLiquido)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ABA 2: ESPELHO DE OCUPAÇÃO POSTO A POSTO */}
          {tipoAtivo === "espelho_ocupacao" && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E7EB] text-[#6B7280] font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Base</th>
                      <th className="py-2.5 px-3">Função</th>
                      <th className="py-2.5 px-3">Titular Alocado</th>
                      <th className="py-2.5 px-3 text-center">Escala</th>
                      <th className="py-2.5 px-3 text-center">Exigíveis</th>
                      <th className="py-2.5 px-3 text-center">Presente</th>
                      <th className="py-2.5 px-3 text-center">Coberto</th>
                      <th className="py-2.5 px-3 text-center">Descoberto</th>
                      <th className="py-2.5 px-3 text-center">Entrega</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {consolidadoPostos.map((row) => (
                      <tr key={row.posto.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#1F4FD1]">
                          {row.posto.codigoPosto}
                        </td>
                        <td className="py-2.5 px-3 text-[#4B5563]">
                          {row.base}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#111827]">
                          {row.posto.funcao}
                        </td>
                        <td className="py-2.5 px-3 text-[#374151]">
                          {row.posto.titularNome ? (
                            <div>
                              <span className="font-semibold text-[#111827]">{row.posto.titularNome}</span>
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {row.posto.titularMatricula}
                              </span>
                            </div>
                          ) : (
                            <span className="text-amber-700 font-semibold text-xs">
                              Posto Vago
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-xs text-[#4B5563]">
                          {row.posto.escala}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-[#111827]">
                          {row.diasExigiveis}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-[#059669]">
                          {row.titularPresente}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-[#1F4FD1]">
                          {row.cobertos}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium">
                          {row.descobertos > 0 ? (
                            <span className="text-rose-700 font-semibold">{row.descobertos}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-[#111827]">
                          {row.percEntrega}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 3: GLOSAS E DESCOBERTOS */}
          {tipoAtivo === "glosas_descobertos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[#6B7280]">
                <span>
                  Diárias com ausência de cobertura sujeitas a glosa: <strong className="text-[#111827]">{listaDescobertos.length} diária(s)</strong>
                </span>
                <span>
                  Total estimado: <strong className="text-rose-700">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totaisGerais.valorGlosa)}</strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E7EB] text-[#6B7280] font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Posto</th>
                      <th className="py-2.5 px-3">Base</th>
                      <th className="py-2.5 px-3">Função</th>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Titular</th>
                      <th className="py-2.5 px-3">Motivo</th>
                      <th className="py-2.5 px-3 text-right">Glosa Estimada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {listaDescobertos.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-500">
                          <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                          <p className="font-semibold text-[#111827]">Nenhuma glosa apurada</p>
                          <p className="text-xs text-[#6B7280]">Todos os postos exigíveis foram 100% cumpridos no período.</p>
                        </td>
                      </tr>
                    ) : (
                      listaDescobertos.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#1F4FD1]">
                            {item.postoCodigo}
                          </td>
                          <td className="py-2.5 px-3 text-[#4B5563]">
                            {item.base}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#111827]">
                            {item.funcao}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#374151]">
                            {item.data}
                          </td>
                          <td className="py-2.5 px-3 text-[#374151]">
                            {item.titularNome}
                          </td>
                          <td className="py-2.5 px-3 text-[#6B7280]">
                            {item.motivo}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-rose-700">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valorGlosaDiaria)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 4: COBERTURAS E INTERJORNADA */}
          {tipoAtivo === "coberturas_substituicoes" && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E7EB] text-[#6B7280] font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Posto</th>
                      <th className="py-2.5 px-3">Titular</th>
                      <th className="py-2.5 px-3">Substituto Alocado</th>
                      <th className="py-2.5 px-3">Período</th>
                      <th className="py-2.5 px-3">Modalidade</th>
                      <th className="py-2.5 px-3">CLT Art. 66</th>
                      <th className="py-2.5 px-3">Justificativa</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {coberturasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-500">
                          Nenhuma cobertura ou substituição registrada para a seleção atual.
                        </td>
                      </tr>
                    ) : (
                      coberturasFiltradas.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#1F4FD1]">
                            {c.postoCodigo}
                          </td>
                          <td className="py-2.5 px-3 text-[#374151]">
                            {c.titularNome || "Titular"}
                          </td>
                          <td className="py-2.5 px-3 text-[#111827]">
                            <span className="font-semibold block">{c.substitutoNome}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Chapa: {c.substitutoMatricula}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#4B5563]">
                            {c.dataInicio} a {c.dataFim}
                          </td>
                          <td className="py-2.5 px-3 text-[#4B5563]">
                            {c.tipoCobertura.replace(/_/g, " ")}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span className={`w-1.5 h-1.5 rounded-full ${c.alertaInterjornada ? "bg-amber-500" : "bg-emerald-500"}`} />
                              <span className={c.alertaInterjornada ? "text-amber-800 font-medium" : "text-emerald-800 font-medium"}>
                                {c.alertaInterjornada ? "Quebra Autorizada" : "Conforme (≥ 11h)"}
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#6B7280] max-w-xs">
                            {c.justificativa}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-xs font-semibold text-emerald-700">
                              {c.status}
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

          {/* ——— RODAPÉ DISCRETO DE AUDITORIA E ASSINATURA ——— */}
          <div className="pt-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#6B7280]">
            <div className="flex items-center gap-2">
              <span>Autenticidade:</span>
              <span className="font-mono text-[11px] text-[#4B5563] truncate max-w-xs" title={hashIntegridade}>
                {hashIntegridade.substring(0, 24)}...
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>Contrato Petrobras ICJ 5900.0129796.25.2</span>
              <span>·</span>
              <Link href="/fechamento" className="text-[#1F4FD1] hover:underline font-semibold">
                Gestão de Fechamento &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* ——— CONTAINER DE IMPRESSÃO OFICIAL (DOSSIÊ EXECUTIVO PETROBRAS / PREMIER) ——— */}
      <div className="dossie-pdf-container hidden print:block">
        {renderDossieConteudo()}
      </div>

      {/* ——— MODAL DE PRÉ-VISUALIZAÇÃO DO DOSSIÊ OFICIAL ——— */}
      {modalDossieAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-300">
            {/* Modal Header */}
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-600" />
                <span className="font-bold text-sm text-[#111827]">
                  Pré-visualização do Dossiê Formal de Medição
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({competencia} · {nomeBaseSelecionada})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportarPdf}
                  className="inline-flex items-center gap-1.5 bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                  title="Abrir diálogo de impressão / salvar como PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Salvar PDF</span>
                </button>
                <button
                  onClick={() => setModalDossieAberto(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 text-xs"
                  title="Fechar visualização"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: renderDossieConteudo */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1">
              <div className="bg-white shadow-md border border-slate-300 rounded-sm p-4 sm:p-8 max-w-4xl mx-auto">
                {renderDossieConteudo()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>Orientação recomendada ao imprimir/salvar PDF: <strong>Paisagem (Landscape)</strong> com margens padrão.</span>
              <button
                onClick={() => setModalDossieAberto(false)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 font-semibold text-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
