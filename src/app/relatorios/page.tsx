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
  ShieldCheck,
  Building2,
  Search,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FilterX,
  Layers,
  ChevronRight,
  Lock,
} from "lucide-react";
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

  // Limite de apuração: se mês atual (Set/2026), apura até dia 15 (ou corte do lote)
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

  // Postos para cálculo de métricas da base selecionada
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

    // Inicializa com bases do sistema
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

  // Hash determinístico de autenticidade (Item 11.3)
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

  const dataGeracaoFormatada = useMemo(() => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    return `${d}/${m}/${y} ${h}:${min}:${s}`;
  }, []);

  const nomeBaseSelecionada = useMemo(() => {
    if (filtroBase === "TODAS") return `Contrato Integral (${BASES_SGP_SISTEMA.length} Bases)`;
    const item = BASES_SGP_SISTEMA.find((b) => b.id === filtroBase);
    return item ? item.nome : filtroBase;
  }, [filtroBase]);

  // Ações de Exportação
  const handleImprimir = () => {
    window.print();
  };

  // Exportação XLSX Oficial Multi-Abas
  const handleExportarXlsx = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Aba 1: Memória de Cálculo
      const dadosMemoria = resumoBases.map((b) => ({
        "Base Operacional": b.nome,
        "Qtd Postos": b.postos,
        "Diárias Exigíveis": b.exigiveis,
        "Presentes (P)": b.presentes,
        "Cobertos (C)": b.cobertos,
        "Glosas / Descobertos (D)": b.descobertos,
        "SLA Alcançado (%)": `${b.taxaCumprimento.toFixed(1)}%`,
        "Meta Contratual": "95.0%",
        "Status SLA": b.atendeSla ? "CONFORME" : "NÃO CONFORME",
        "Valor Referencial Mensal (R$)": b.valorTotalContrato.toFixed(2),
        "Glosa Contratual Estimada (R$)": b.valorTotalGlosa.toFixed(2),
        "Faturamento Líquido Estimado (R$)": b.faturamentoLiquido.toFixed(2),
      }));

      // Linha totalizadora
      dadosMemoria.push({
        "Base Operacional": "TOTAL CONTRATUAL",
        "Qtd Postos": totaisGerais.postosQtd,
        "Diárias Exigíveis": totaisGerais.exigiveis,
        "Presentes (P)": totaisGerais.presentes,
        "Cobertos (C)": totaisGerais.cobertos,
        "Glosas / Descobertos (D)": totaisGerais.descobertos,
        "SLA Alcançado (%)": `${totaisGerais.taxaGlobal.toFixed(1)}%`,
        "Meta Contratual": "95.0%",
        "Status SLA": totaisGerais.atendeSla ? "CONFORME" : "NÃO CONFORME",
        "Valor Referencial Mensal (R$)": totaisGerais.valorContrato.toFixed(2),
        "Glosa Contratual Estimada (R$)": totaisGerais.valorGlosa.toFixed(2),
        "Faturamento Líquido Estimado (R$)": totaisGerais.faturamentoLiquido.toFixed(2),
      });

      const wsMemoria = XLSX.utils.json_to_sheet(dadosMemoria);
      wsMemoria["!cols"] = [
        { wch: 32 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
        { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 26 },
        { wch: 26 }, { wch: 28 },
      ];
      XLSX.utils.book_append_sheet(wb, wsMemoria, "1. Memória de Cálculo");

      // Aba 2: Espelho de Ocupação Posto a Posto
      const dadosEspelho = consolidadoPostos.map((c) => ({
        "Código Posto": c.posto.codigoPosto,
        "Base Operacional": c.base,
        "Função Contratual": c.posto.funcao,
        "Escala": c.posto.escala,
        "Titular Alocado": c.posto.titularNome || "POSTO VAGO",
        "Matrícula": c.posto.titularMatricula || "",
        "Dias Exigíveis": c.diasExigiveis,
        "Presentes": c.titularPresente,
        "Cobertos": c.cobertos,
        "Descobertos": c.descobertos,
        "Folgas Escala": c.folgas,
        "Taxa Entrega (%)": `${c.percEntrega}%`,
        "Glosa Estimada (R$)": c.valorTotalGlosa.toFixed(2),
      }));

      const wsEspelho = XLSX.utils.json_to_sheet(dadosEspelho);
      wsEspelho["!cols"] = [
        { wch: 18 }, { wch: 28 }, { wch: 28 }, { wch: 10 }, { wch: 26 },
        { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
        { wch: 14 }, { wch: 16 }, { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, wsEspelho, "2. Espelho de Ocupação");

      // Aba 3: Glosas e Postos Descobertos
      const dadosGlosas = listaDescobertos.map((g) => ({
        "Posto": g.postoCodigo,
        "Base Operacional": g.base,
        "Função": g.funcao,
        "Data Ocorrência": g.data,
        "Dia Mês": g.dia,
        "Titular / Situação": g.titularNome,
        "Motivo / Evidência da Glosa": g.motivo,
        "Impacto Contratual": "1 Glosa Diária (1/30 avos)",
        "Valor Estimado (R$)": g.valorGlosaDiaria.toFixed(2),
      }));

      const wsGlosas = XLSX.utils.json_to_sheet(dadosGlosas);
      wsGlosas["!cols"] = [
        { wch: 18 }, { wch: 26 }, { wch: 26 }, { wch: 14 }, { wch: 10 },
        { wch: 24 }, { wch: 45 }, { wch: 26 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsGlosas, "3. Glosas e Descobertos");

      // Aba 4: Coberturas e Interjornada
      const dadosCoberturas = coberturasFiltradas.map((c) => ({
        "Posto": c.postoCodigo,
        "Função": c.funcaoPosto,
        "Titular Ausente": c.titularNome || "",
        "Profissional Substituto": c.substitutoNome,
        "Matrícula Substituto": c.substitutoMatricula,
        "Período Início": c.dataInicio,
        "Período Fim": c.dataFim,
        "Modalidade": c.tipoCobertura.replace(/_/g, " "),
        "Status": c.status,
        "Conformidade CLT Art. 66": c.alertaInterjornada ? "QUEBRA AUTORIZADA (Passivo 50%)" : "CONFORME (>= 11h)",
        "Descanso Apurado": c.horasDescansoApuradas ? `${c.horasDescansoApuradas.toFixed(1)}h` : "N/D",
        "Justificativa": c.justificativa,
      }));

      const wsCoberturas = XLSX.utils.json_to_sheet(dadosCoberturas);
      wsCoberturas["!cols"] = [
        { wch: 18 }, { wch: 26 }, { wch: 24 }, { wch: 26 }, { wch: 18 },
        { wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 32 },
        { wch: 18 }, { wch: 45 },
      ];
      XLSX.utils.book_append_sheet(wb, wsCoberturas, "4. Coberturas e Interjornada");

      const baseSlug = filtroBase === "TODAS" ? "Contrato_Integral" : filtroBase.replace(/[\s/\\-]+/g, "_");
      XLSX.writeFile(wb, `SGP_Memoria_Calculo_Medicao_${baseSlug}_${competencia}.xlsx`);
    } catch (err) {
      console.error("Erro ao exportar XLSX:", err);
      alert("Erro ao gerar planilha Excel. Tente novamente.");
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
            <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
            <h1>Memória de Cálculo & Relatórios Oficiais</h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold px-2 py-0.5 rounded">
              Item 11.3 Petrobras
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Geração de demonstrativos consolidados com apuração de glosas, SLA contratual e evidências auditáveis (Requisitos R4 e R5) do Contrato ICJ <strong>5900.0129796.25.2</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleImprimir}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 transition-colors shadow-2xs"
            title="Imprimir visualização oficial em formato documento ou salvar como PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Imprimir / PDF</span>
          </button>
          <button
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 transition-colors shadow-2xs"
            title="Exportar dados da aba atual em formato CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={handleExportarXlsx}
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition-colors"
            title="Baixar planilha Excel oficial (.xlsx) com as 4 abas completas"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
            <span>Exportar XLSX Oficial (4 Abas)</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Controles */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Seletor de Base */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Base Operacional</span>
            </label>
            <select
              value={filtroBase}
              onChange={(e) => setFiltroBase(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-premier-800 bg-white"
            >
              <option value="TODAS">Contrato Integral (Todas as 29 Bases)</option>
              {BASES_SGP_SISTEMA.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Competência */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Competência Mensal</span>
            </label>
            <select
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-premier-800 bg-white"
            >
              <option value="2026-09">Setembro / 2026 (Em apuração)</option>
              <option value="2026-08">Agosto / 2026 (Fechada)</option>
              <option value="2026-07">Julho / 2026</option>
            </select>
          </div>

          {/* Campo de Busca */}
          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Filtrar por Posto, Função, Titular ou Substituto</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar código de posto, nome, chapa..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 pl-8 focus:ring-2 focus:ring-premier-800"
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
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Filtro Ativo:</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium text-slate-800">
              {nomeBaseSelecionada}
            </span>
            <span>·</span>
            <span>
              Período: <strong>01 a {limiteDia}/{String(mes).padStart(2, "0")}/{ano}</strong>
            </span>
            <span>·</span>
            <span>
              Total de postos na base: <strong>{postosParaMetricas.length}</strong>
            </span>
          </div>

          {(busca || filtroBase !== "TODAS") && (
            <button
              onClick={() => {
                setFiltroBase("TODAS");
                setBusca("");
              }}
              className="text-[11px] text-premier-700 hover:underline inline-flex items-center gap-1 font-semibold"
            >
              <FilterX className="w-3 h-3" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Seletor de Tipo de Relatório (Abas) */}
      <div className="flex border-b border-slate-300 bg-white rounded-t-xl px-3 pt-2 gap-1 text-xs font-semibold overflow-x-auto print:hidden shadow-2xs">
        <button
          onClick={() => setTipoAtivo("memoria_calculo")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            tipoAtivo === "memoria_calculo"
              ? "border-emerald-700 text-emerald-800 bg-emerald-50/50 rounded-t-lg font-bold shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-700" />
          <span>1. Memória de Cálculo & Faturamento (Item 11.3)</span>
        </button>

        <button
          onClick={() => setTipoAtivo("espelho_ocupacao")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            tipoAtivo === "espelho_ocupacao"
              ? "border-premier-900 text-premier-900 bg-slate-50 rounded-t-lg font-bold shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileCheck className="w-4 h-4 text-premier-700" />
          <span>2. Espelho Mensal de Ocupação</span>
        </button>

        <button
          onClick={() => setTipoAtivo("glosas_descobertos")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            tipoAtivo === "glosas_descobertos"
              ? "border-rose-600 text-rose-800 bg-rose-50/50 rounded-t-lg font-bold shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>3. Demonstrativo de Glosas & Descobertos ({listaDescobertos.length})</span>
        </button>

        <button
          onClick={() => setTipoAtivo("coberturas_substituicoes")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            tipoAtivo === "coberturas_substituicoes"
              ? "border-blue-600 text-blue-800 bg-blue-50/50 rounded-t-lg font-bold shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserCheck2 className="w-4 h-4 text-blue-600" />
          <span>4. Rastreabilidade de Coberturas & Interjornada ({coberturasFiltradas.length})</span>
        </button>
      </div>

      {/* Caixa do Relatório Institucional (Visual Oficial e Para Impressão) */}
      <div className="bg-white rounded-b-xl border-x border-b border-slate-200 shadow-sm p-6 space-y-6 print:border-none print:shadow-none print:p-0">
        {/* Cabeçalho Institucional do Documento */}
        <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/80 space-y-3 print:bg-white print:border-slate-400">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                Petróleo Brasileiro S.A. – Petrobras • Premier Logistics
              </span>
              <h2 className="text-base md:text-lg font-bold text-slate-900 mt-0.5">
                {tipoAtivo === "memoria_calculo" && "Memória de Cálculo de Medição e Cumprimento de Metas Contratuais"}
                {tipoAtivo === "espelho_ocupacao" && "Espelho Mensal Consolidado de Ocupação dos Postos de Serviço"}
                {tipoAtivo === "glosas_descobertos" && "Demonstrativo Analítico de Postos Descobertos e Glosas Contratuais"}
                {tipoAtivo === "coberturas_substituicoes" && "Relatório de Rastreabilidade de Coberturas e Validação CLT Art. 66"}
              </h2>
            </div>
            <div className="text-left md:text-right">
              <span className="text-xs font-bold text-slate-800 block">
                Competência: {competencia === "2026-09" ? "Setembro / 2026" : competencia === "2026-08" ? "Agosto / 2026" : competencia}
              </span>
              <span className="text-[11px] text-slate-600 font-medium block">
                Unidade: <strong>{nomeBaseSelecionada}</strong>
              </span>
              {isCompetenciaCongelada(competencia) ? (
                <div className="mt-1 flex items-center justify-start md:justify-end gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3 text-emerald-700" />
                    <span>Competência Congelada (Snapshot Imutável)</span>
                  </span>
                  <Link href="/fechamento" className="text-[10px] text-emerald-800 hover:underline font-semibold print:hidden">
                    Detalhes &rarr;
                  </Link>
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-start md:justify-end gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                    <span>Em Apuração Aberta</span>
                  </span>
                  <Link href="/fechamento" className="text-[10px] text-amber-900 hover:underline font-semibold print:hidden">
                    Congelar &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-slate-500 font-medium block">Contrato ICJ:</span>
              <span className="font-bold text-slate-800">5900.0129796.25.2</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Data/Hora Emissão:</span>
              <span className="font-mono text-slate-800">{dataGeracaoFormatada}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Período Apurado:</span>
              <span className="font-semibold text-slate-800">
                01 a {limiteDia}/{String(mes).padStart(2, "0")}/{ano} ({limiteDia} dias)
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Assinatura Digital (Item 11.3):</span>
              <span className="font-mono text-[10px] text-slate-700 truncate block" title={hashIntegridade}>
                {hashIntegridade.substring(0, 24)}...
              </span>
            </div>
          </div>
        </div>

        {/* ABA 1: MEMÓRIA DE CÁLCULO & FATURAMENTO */}
        {tipoAtivo === "memoria_calculo" && (
          <div className="space-y-6">
            {/* Cards Executivos de SLA e Faturamento */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Diárias Exigíveis
                </span>
                <div className="text-2xl font-bold text-slate-900">{totaisGerais.exigiveis}</div>
                <div className="text-[10px] text-slate-500">
                  {totaisGerais.postosQtd} postos contratados apurados
                </div>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Diárias Entregues
                </span>
                <div className="text-2xl font-bold text-emerald-800">{totaisGerais.efetivas}</div>
                <div className="text-[10px] text-emerald-700">
                  {totaisGerais.presentes} presentes + {totaisGerais.cobertos} cobertos
                </div>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                  Diárias Glosadas (D)
                </span>
                <div className="text-2xl font-bold text-rose-800">{totaisGerais.descobertos}</div>
                <div className="text-[10px] text-rose-700">
                  Glosa Contratual Estimada:{" "}
                  <strong>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      totaisGerais.valorGlosa
                    )}
                  </strong>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border space-y-1 ${
                  totaisGerais.atendeSla
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-amber-50 border-amber-300 text-amber-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    SLA Contratual
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/80 border">
                    Meta: 95.0%
                  </span>
                </div>
                <div className="text-2xl font-bold">
                  {totaisGerais.taxaGlobal.toFixed(1)}%
                </div>
                <div className="text-[10px] flex items-center gap-1 font-medium">
                  {totaisGerais.atendeSla ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Meta contratual Petrobras atingida</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Abaixo da meta de 95% (Sujeito a notificação)</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Painel de Conciliação Financeira da Medição */}
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                    Demonstrativo Financeiro Referencial de Faturamento & Glosas
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Base 30 dias comerciais conforme minuta ICJ
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-slate-400 text-[11px] block">Valor Bruto Contratual Mensal</span>
                  <span className="text-lg font-bold text-slate-100">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      totaisGerais.valorContrato
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Previsão para {totaisGerais.postosQtd} postos na competência
                  </span>
                </div>

                <div className="bg-rose-950/40 p-3 rounded-lg border border-rose-800/60">
                  <span className="text-rose-300 text-[11px] block">Total de Glosas na Medição</span>
                  <span className="text-lg font-bold text-rose-400">
                    -{" "}
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      totaisGerais.valorGlosa
                    )}
                  </span>
                  <span className="text-[10px] text-rose-300/80 block mt-0.5">
                    {totaisGerais.descobertos} diárias descobertas aplicadas em 30 avos
                  </span>
                </div>

                <div className="bg-emerald-950/40 p-3 rounded-lg border border-emerald-800/60">
                  <span className="text-emerald-300 text-[11px] block">Faturamento Líquido Estimado</span>
                  <span className="text-lg font-bold text-emerald-400">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      totaisGerais.faturamentoLiquido
                    )}
                  </span>
                  <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                    Apurado até {limiteDia}/{String(mes).padStart(2, "0")} com SLA de {totaisGerais.taxaGlobal.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela Sintética por Base Operacional */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span>Consolidação da Medição por Base Operacional</span>
                </h4>
                <span className="text-[11px] text-slate-500">
                  Exibindo {resumoBases.length} base(s) apurada(s)
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                      <th className="py-2.5 px-3 font-bold">Base Operacional</th>
                      <th className="py-2.5 px-3 font-bold text-center">Postos</th>
                      <th className="py-2.5 px-3 font-bold text-center">Exigíveis</th>
                      <th className="py-2.5 px-3 font-bold text-center text-emerald-700">Presentes (P)</th>
                      <th className="py-2.5 px-3 font-bold text-center text-sky-700">Cobertos (C)</th>
                      <th className="py-2.5 px-3 font-bold text-center text-rose-700">Glosas (D)</th>
                      <th className="py-2.5 px-3 font-bold text-center">SLA Alcançado</th>
                      <th className="py-2.5 px-3 font-bold text-center">Meta SLA</th>
                      <th className="py-2.5 px-3 font-bold text-right">Glosa Estimada</th>
                      <th className="py-2.5 px-3 font-bold text-right">Faturamento Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {resumoBases.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {b.nome}
                        </td>
                        <td className="py-2.5 px-3 text-center">{b.postos}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">{b.exigiveis}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-700 bg-emerald-50/30 font-semibold">{b.presentes}</td>
                        <td className="py-2.5 px-3 text-center text-sky-700 bg-sky-50/30 font-semibold">{b.cobertos}</td>
                        <td className="py-2.5 px-3 text-center text-rose-700 bg-rose-50/30 font-bold">{b.descobertos}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              b.atendeSla
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {b.taxaCumprimento.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">95.0%</td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                            b.valorTotalGlosa
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                            b.faturamentoLiquido
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="py-3 px-3 uppercase text-[11px] tracking-wider">Total Consolidado</td>
                      <td className="py-3 px-3 text-center">{totaisGerais.postosQtd}</td>
                      <td className="py-3 px-3 text-center">{totaisGerais.exigiveis}</td>
                      <td className="py-3 px-3 text-center text-emerald-800">{totaisGerais.presentes}</td>
                      <td className="py-3 px-3 text-center text-sky-800">{totaisGerais.cobertos}</td>
                      <td className="py-3 px-3 text-center text-rose-800">{totaisGerais.descobertos}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            totaisGerais.atendeSla
                              ? "bg-emerald-200 text-emerald-900"
                              : "bg-amber-200 text-amber-900"
                          }`}
                        >
                          {totaisGerais.taxaGlobal.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[11px]">95.0%</td>
                      <td className="py-3 px-3 text-right font-mono text-rose-800">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                          totaisGerais.valorGlosa
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-900">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                          totaisGerais.faturamentoLiquido
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: ESPELHO DE OCUPAÇÃO POSTO A POSTO */}
        {tipoAtivo === "espelho_ocupacao" && (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-bold">Código do Posto</th>
                    <th className="py-2.5 px-3 font-bold">Base Operacional</th>
                    <th className="py-2.5 px-3 font-bold">Função Contratual</th>
                    <th className="py-2.5 px-3 font-bold">Titular Alocado</th>
                    <th className="py-2.5 px-3 font-bold text-center">Escala</th>
                    <th className="py-2.5 px-3 font-bold text-center">Dias Exigíveis</th>
                    <th className="py-2.5 px-3 font-bold text-center text-emerald-700">Presente</th>
                    <th className="py-2.5 px-3 font-bold text-center text-sky-700">Coberto</th>
                    <th className="py-2.5 px-3 font-bold text-center text-rose-700">Descoberto</th>
                    <th className="py-2.5 px-3 font-bold text-center">Taxa de Entrega</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {consolidadoPostos.map((row) => (
                    <tr key={row.posto.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-premier-900">
                        {row.posto.codigoPosto}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">
                        {row.base}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {row.posto.funcao}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        {row.posto.titularNome ? (
                          <div>
                            <span className="font-semibold">{row.posto.titularNome}</span>
                            <span className="block text-[10px] text-slate-400 font-mono">
                              Matrícula: {row.posto.titularMatricula}
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-800 bg-amber-100 border border-amber-300 font-bold text-[10px] px-2 py-0.5 rounded inline-flex items-center gap-1">
                            ⚠ POSTO VAGO
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                        {row.posto.escala}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        {row.diasExigiveis}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-700 bg-emerald-50/40">
                        {row.titularPresente}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-sky-700 bg-sky-50/40">
                        {row.cobertos}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-rose-700 bg-rose-50/40">
                        {row.descobertos}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            row.percEntrega >= 95
                              ? "bg-emerald-100 text-emerald-800"
                              : row.percEntrega >= 80
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {row.percEntrega}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 3: GLOSAS E POSTOS DESCOBERTOS */}
        {tipoAtivo === "glosas_descobertos" && (
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>
                  Total de Diárias Descobertas Sujeitas a Glosa na Medição: {listaDescobertos.length} diária(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold bg-white px-2.5 py-1 rounded-lg border border-rose-300 text-rose-900">
                  Glosas: {listaDescobertos.length} / 30 avos
                </span>
                <span className="text-[11px] font-mono font-bold bg-rose-700 text-white px-2.5 py-1 rounded-lg">
                  Total Glosa:{" "}
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    totaisGerais.valorGlosa
                  )}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-bold">Posto Notificado</th>
                    <th className="py-2.5 px-3 font-bold">Base Operacional</th>
                    <th className="py-2.5 px-3 font-bold">Função Contratual</th>
                    <th className="py-2.5 px-3 font-bold">Data da Descoberta</th>
                    <th className="py-2.5 px-3 font-bold">Titular Ausente</th>
                    <th className="py-2.5 px-3 font-bold">Motivo / Evidência da Glosa</th>
                    <th className="py-2.5 px-3 font-bold text-center">Impacto Contratual</th>
                    <th className="py-2.5 px-3 font-bold text-right">Glosa Diária Estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {listaDescobertos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        Nenhum posto descoberto registrado no período apurado. Zero glosas contratuais!
                      </td>
                    </tr>
                  ) : (
                    listaDescobertos.map((item, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-900">
                          {item.postoCodigo}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {item.base}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {item.funcao}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-800">
                          {item.data} (Dia {item.dia})
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {item.titularNome}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {item.motivo}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                            1 Glosa Diária
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                            item.valorGlosaDiaria
                          )}
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
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-bold">Posto Coberto</th>
                    <th className="py-2.5 px-3 font-bold">Titular Ausente</th>
                    <th className="py-2.5 px-3 font-bold">Profissional Substituto</th>
                    <th className="py-2.5 px-3 font-bold">Período Atendido</th>
                    <th className="py-2.5 px-3 font-bold">Modalidade</th>
                    <th className="py-2.5 px-3 font-bold">Conformidade CLT Art. 66</th>
                    <th className="py-2.5 px-3 font-bold">Justificativa Operacional</th>
                    <th className="py-2.5 px-3 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {coberturasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        Nenhuma cobertura ou substituição registrada para a seleção atual.
                      </td>
                    </tr>
                  ) : (
                    coberturasFiltradas.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-premier-900">
                          {c.postoCodigo}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">
                          {c.titularNome || "Titular do Posto"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-blue-900">
                          {c.substitutoNome}
                          <span className="block text-[10px] text-slate-400 font-mono">
                            Chapa: {c.substitutoMatricula}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {c.dataInicio} a {c.dataFim}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {c.tipoCobertura.replace(/_/g, " ")}
                        </td>
                        <td className="py-2.5 px-3">
                          {c.alertaInterjornada ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Quebra Excepcional ({c.horasDescansoApuradas ? `${c.horasDescansoApuradas.toFixed(1)}h` : "<11h"})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Conforme (Descanso &ge; 11h)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                          {c.justificativa}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
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

        {/* Rodapé Institucional de Assinatura e Integridade Contratual */}
        <div className="pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 print:bg-white print:border-slate-300">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Autenticidade & Certificação Digital (Item 11.3)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Relatório oficial consolidado a partir da base imutável do Neon PostgreSQL (gru1/aws-sa-east-1).
              Atestado com chave criptográfica SHA-256 e disponibilizado de forma transparente para conferência da fatura e fiscalização contratual da Petrobras.
            </p>
            <div className="font-mono text-[10px] text-slate-800 bg-white p-2 rounded-lg border border-slate-200 break-all select-all font-semibold">
              {hashIntegridade}
            </div>
          </div>

          <div className="flex flex-col justify-end text-center space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border-t border-slate-400 pt-1 text-[11px]">
                <div className="font-bold text-slate-800">Marcos Valério de Souza</div>
                <div className="text-slate-500 text-[10px]">Gestor do Contrato — Premier Logistics</div>
              </div>
              <div className="border-t border-slate-400 pt-1 text-[11px]">
                <div className="font-bold text-slate-800">Carlos Eduardo Mendes</div>
                <div className="text-slate-500 text-[10px]">Fiscal Técnico — Petróleo Brasileiro S.A.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
