/**
 * Gerador oficial de planilhas Excel (XLSX) para a Memória de Cálculo e Medição
 * Contrato Petrobras ICJ 5900.0129796.25.2 — Item 11.3
 * 
 * Gera pasta de trabalho com 4 abas estruturadas:
 * 1. Memória de Cálculo por Base
 * 2. Espelho de Ocupação Posto a Posto
 * 3. Glosas e Descobertos
 * 4. Coberturas e Interjornada
 */

import * as XLSX from "xlsx";
import { BASES_SGP_SISTEMA } from "../dados/secoes-horarios";
import {
  carregarEstado,
  calcularStatusDia,
  obterTodosPostosContrato,
  obterMarcacoesPonto,
  obterDataReferenciaPonto,
  PostoOperacional,
} from "../dados/estado-operacional";

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

export function gerarPlanilhaMedicaoXlsx(competencia: string = "2026-09", filtroBase: string = "TODAS"): Buffer {
  const estado = carregarEstado();
  const todosPostos = obterTodosPostosContrato(estado.postos);
  const ocorrencias = estado.ocorrencias || [];
  const coberturas = estado.coberturas || [];
  const apontamentos = estado.apontamentos || [];
  const marcacoes = obterMarcacoesPonto() || [];
  const dataRefLote = obterDataReferenciaPonto() || "2026-09-15";

  // Set O(1) de marcações
  const marcacoesSet = new Set<string>();
  marcacoes.forEach((m: any) => {
    const matRaw = m.matricula || m.chapa || "";
    if (!matRaw) return;
    const chapa = String(matRaw).padStart(6, "0");
    const dataStr = m.dataLocal || m.dataHoraUtc || m.dataHora || m.data || "";
    if (typeof dataStr === "string" && dataStr.length >= 10) {
      marcacoesSet.add(`${chapa}_${dataStr.slice(0, 10)}`);
    }
  });

  const parts = competencia.split("-").map(Number);
  const ano = parts[0] || 2026;
  const mes = parts[1] || 9;
  const mesIdx = mes - 1;
  const totalDiasNoMes = new Date(ano, mes, 0).getDate();
  const limiteDia = ano === 2026 && mes === 9 ? Math.min(15, totalDiasNoMes) : totalDiasNoMes;
  const diasApurados = Array.from({ length: limiteDia }, (_, i) => i + 1);

  const verificaMatchBase = (p: PostoOperacional, baseFiltro: string) => {
    if (baseFiltro === "TODAS") return true;
    const uId = p.unidadeId || "UFN-III";
    if (uId === baseFiltro) return true;
    if (p.unidadeNome && p.unidadeNome.toLowerCase().includes(baseFiltro.toLowerCase())) return true;
    if (p.baseOperacional && p.baseOperacional.toLowerCase().includes(baseFiltro.toLowerCase())) return true;
    return false;
  };

  const postosFiltrados = todosPostos.filter((p) => verificaMatchBase(p, filtroBase));

  // Mapa de Bases para Memória de Cálculo
  const mapaBases = new Map<
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
    mapaBases.set(b.id, {
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

  todosPostos.forEach((p) => {
    const bId = p.unidadeId || "UFN-III";
    if (!mapaBases.has(bId)) {
      mapaBases.set(bId, {
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

    const item = mapaBases.get(bId)!;
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
        dataRefLote
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

  const resumoBases = Array.from(mapaBases.values())
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

  let totPostos = 0;
  let totExigiveis = 0;
  let totPresentes = 0;
  let totCobertos = 0;
  let totDescobertos = 0;
  let totValorContrato = 0;
  let totValorGlosa = 0;

  resumoBases.forEach((b) => {
    totPostos += b.postos;
    totExigiveis += b.exigiveis;
    totPresentes += b.presentes;
    totCobertos += b.cobertos;
    totDescobertos += b.descobertos;
    totValorContrato += b.valorTotalContrato;
    totValorGlosa += b.valorTotalGlosa;
  });

  const totEfetivas = totPresentes + totCobertos;
  const totTaxaGlobal = totExigiveis > 0 ? (totEfetivas / totExigiveis) * 100 : 100;
  const totFaturamentoLiquido = Math.max(0, totValorContrato - totValorGlosa);

  const wb = XLSX.utils.book_new();

  // ABA 1: MEMÓRIA DE CÁLCULO
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

  dadosMemoria.push({
    "Base Operacional": "TOTAL CONTRATUAL",
    "Qtd Postos": totPostos,
    "Diárias Exigíveis": totExigiveis,
    "Presentes (P)": totPresentes,
    "Cobertos (C)": totCobertos,
    "Glosas / Descobertos (D)": totDescobertos,
    "SLA Alcançado (%)": `${totTaxaGlobal.toFixed(1)}%`,
    "Meta Contratual": "95.0%",
    "Status SLA": totTaxaGlobal >= 95.0 ? "CONFORME" : "NÃO CONFORME",
    "Valor Referencial Mensal (R$)": totValorContrato.toFixed(2),
    "Glosa Contratual Estimada (R$)": totValorGlosa.toFixed(2),
    "Faturamento Líquido Estimado (R$)": totFaturamentoLiquido.toFixed(2),
  });

  const wsMemoria = XLSX.utils.json_to_sheet(dadosMemoria);
  wsMemoria["!cols"] = [
    { wch: 32 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 26 },
    { wch: 26 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMemoria, "1. Memória de Cálculo");

  // ABA 2: ESPELHO DE OCUPAÇÃO POSTO A POSTO
  const dadosEspelho = postosFiltrados.map((p) => {
    let diasExig = 0;
    let titPres = 0;
    let cob = 0;
    let desc = 0;
    let folg = 0;

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
        dataRefLote
      );
      if (detalhe.statusOcupacao === "TITULAR_PRESENTE") {
        diasExig++;
        titPres++;
      } else if (detalhe.statusOcupacao === "COBERTO") {
        diasExig++;
        cob++;
      } else if (detalhe.statusOcupacao === "DESCOBERTO") {
        diasExig++;
        desc++;
      } else if (detalhe.statusOcupacao === "NAO_EXIGIVEL") {
        folg++;
      }
    }

    const efetivos = titPres + cob;
    const perc = diasExig > 0 ? Math.round((efetivos / diasExig) * 100) : 100;
    const valMensal = obterValorReferencialMensal(p.funcao);
    const glosaTotal = desc * (valMensal / 30);

    return {
      "Código Posto": p.codigoPosto,
      "Base Operacional": p.unidadeNome || p.unidadeId || "UFN III",
      "Função Contratual": p.funcao,
      "Escala": p.escala,
      "Titular Alocado": p.titularNome || "POSTO VAGO",
      "Matrícula": p.titularMatricula || "",
      "Dias Exigíveis": diasExig,
      "Presentes": titPres,
      "Cobertos": cob,
      "Descobertos": desc,
      "Folgas Escala": folg,
      "Taxa Entrega (%)": `${perc}%`,
      "Glosa Estimada (R$)": glosaTotal.toFixed(2),
    };
  });

  const wsEspelho = XLSX.utils.json_to_sheet(dadosEspelho);
  wsEspelho["!cols"] = [
    { wch: 18 }, { wch: 28 }, { wch: 28 }, { wch: 10 }, { wch: 26 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsEspelho, "2. Espelho de Ocupação");

  // ABA 3: GLOSAS E DESCOBERTOS
  const listaDescobertos: any[] = [];
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
        dataRefLote
      );
      if (det.statusOcupacao === "DESCOBERTO") {
        listaDescobertos.push({
          "Posto": p.codigoPosto,
          "Base Operacional": base,
          "Função": p.funcao,
          "Data Ocorrência": det.data,
          "Dia Mês": d,
          "Titular / Situação": det.titularNome || (p.titularMatricula ? p.titularNome || "Titular" : "POSTO VAGO"),
          "Motivo / Evidência da Glosa": det.motivoPublico,
          "Impacto Contratual": "1 Glosa Diária (1/30 avos)",
          "Valor Estimado (R$)": valorGlosa.toFixed(2),
        });
      }
    }
  });

  if (listaDescobertos.length === 0) {
    listaDescobertos.push({
      "Posto": "NENHUMA GLOSA",
      "Base Operacional": "CONTRATO INTEGRAL",
      "Função": "—",
      "Data Ocorrência": "—",
      "Dia Mês": "—",
      "Titular / Situação": "—",
      "Motivo / Evidência da Glosa": "Nenhuma glosa aplicada no período (100% de cumprimento das escalas exigíveis).",
      "Impacto Contratual": "R$ 0,00",
      "Valor Estimado (R$)": "0.00",
    });
  }

  const wsGlosas = XLSX.utils.json_to_sheet(listaDescobertos);
  wsGlosas["!cols"] = [
    { wch: 18 }, { wch: 26 }, { wch: 26 }, { wch: 14 }, { wch: 10 },
    { wch: 24 }, { wch: 45 }, { wch: 26 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsGlosas, "3. Glosas e Descobertos");

  // ABA 4: COBERTURAS E INTERJORNADA
  const coberturasFiltradas = coberturas.filter((c) => {
    const p = todosPostos.find((post) => post.codigoPosto === c.postoCodigo);
    return !p || verificaMatchBase(p, filtroBase);
  });

  const dadosCoberturas = coberturasFiltradas.length > 0
    ? coberturasFiltradas.map((c) => ({
        "Posto": c.postoCodigo,
        "Função": c.funcaoPosto,
        "Titular Ausente": c.titularNome || "",
        "Profissional Substituto": c.substitutoNome,
        "Matrícula Substituto": c.substitutoMatricula,
        "Período Início": c.dataInicio,
        "Período Fim": c.dataFim,
        "Modalidade": (c.tipoCobertura || "SUBSTITUICAO").replace(/_/g, " "),
        "Status": c.status,
        "Conformidade CLT Art. 66": c.alertaInterjornada ? "QUEBRA AUTORIZADA" : "CONFORME",
        "Descanso Apurado": c.horasDescansoApuradas ? `${c.horasDescansoApuradas.toFixed(1)}h` : "N/D",
        "Justificativa": c.justificativa || "",
      }))
    : [
        {
          "Posto": "NENHUMA COBERTURA",
          "Função": "—",
          "Titular Ausente": "—",
          "Profissional Substituto": "—",
          "Matrícula Substituto": "—",
          "Período Início": "—",
          "Período Fim": "—",
          "Modalidade": "—",
          "Status": "REGULAR",
          "Conformidade CLT Art. 66": "CONFORME",
          "Descanso Apurado": "—",
          "Justificativa": "Sem ocorrências de substituição registradas no período.",
        },
      ];

  const wsCoberturas = XLSX.utils.json_to_sheet(dadosCoberturas);
  wsCoberturas["!cols"] = [
    { wch: 18 }, { wch: 26 }, { wch: 24 }, { wch: 26 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 32 },
    { wch: 18 }, { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCoberturas, "4. Coberturas e Interjornada");

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
