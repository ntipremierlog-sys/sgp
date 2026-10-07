import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  carregarEstado,
  obterFechamentosCompetencia,
  obterTodosPostosContrato,
  obterMarcacoesPonto,
  obterDataReferenciaPonto,
  calcularStatusDia,
} from "@/lib/dados/estado-operacional";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const competencia = searchParams.get("competencia") || "2026-09";

    const estado = carregarEstado();
    const fechamentos = obterFechamentosCompetencia();
    const postos = obterTodosPostosContrato(estado.postos);
    const ocorrencias = estado.ocorrencias || [];
    const coberturas = estado.coberturas || [];
    const apontamentos = estado.apontamentos || [];
    const marcacoes = obterMarcacoesPonto() || [];
    const dataRefLote = obterDataReferenciaPonto() || "2026-09-15";

    const fAlvo = fechamentos.find((f) => f.competencia === competencia);
    const isTargetCongelado = fAlvo?.status === "CONGELADO";

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
          dataRefLote
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

    const wb = XLSX.utils.book_new();

    // Aba 1: Boletim de Medição Oficial
    const dadosBoletim = [
      { Campo: "CONTRATO", Valor: "Petróleo Brasileiro S.A. — Petrobras ICJ 5900.0129796.25.2" },
      { Campo: "CONTRATADA", Valor: "Premier Logistics Prestação de Serviços Operacionais Ltda." },
      { Campo: "OBJETO", Valor: "Item 11.3 Medição e Apuração Mensal de Serviços Operacionais" },
      { Campo: "COMPETÊNCIA APURADA", Valor: competencia === "2026-09" ? "Setembro / 2026" : competencia === "2026-08" ? "Agosto / 2026" : competencia },
      { Campo: "STATUS DO FECHAMENTO", Valor: isTargetCongelado ? "CONGELADO (Snapshot Imutável)" : "ABERTO (Em Apuração)" },
      { Campo: "DATA DE CONGELAMENTO", Valor: fAlvo?.congeladoEm || "Em apuração" },
      { Campo: "RESPONSÁVEL PELO FECHAMENTO", Valor: fAlvo?.congeladoPor || "Marcos Valério de Souza (Administrador Premier)" },
      { Campo: "CERTIFICAÇÃO SHA-256", Valor: fAlvo?.hashIntegridadeSha256 || "Apuração aberta" },
      { Campo: "POSTOS CONTRATADOS", Valor: isTargetCongelado ? fAlvo?.resumoMetricas.postos : postos.length },
      { Campo: "DIÁRIAS EXIGÍVEIS", Valor: isTargetCongelado ? fAlvo?.resumoMetricas.exigiveis : exigiveis },
      { Campo: "DIÁRIAS CUMPRIDAS (P+C)", Valor: isTargetCongelado ? fAlvo?.resumoMetricas.efetivas : efetivas },
      { Campo: "GLOSAS CONTRATUAIS (D)", Valor: isTargetCongelado ? fAlvo?.resumoMetricas.glosas : descobertos },
      { Campo: "SLA ALCANÇADO (%)", Valor: `${(isTargetCongelado ? fAlvo?.resumoMetricas.taxaSla || 100 : taxaSla).toFixed(1)}%` },
      { Campo: "META CONTRATUAL SLA", Valor: "95.0%" },
      { Campo: "VALOR BRUTO CONTRATUAL (R$)", Valor: (isTargetCongelado ? fAlvo?.resumoMetricas.valorContrato || 0 : valorTotalContrato).toFixed(2) },
      { Campo: "VALOR TOTAL DE GLOSAS (R$)", Valor: (isTargetCongelado ? fAlvo?.resumoMetricas.valorGlosa || 0 : valorTotalGlosa).toFixed(2) },
      { Campo: "FATURAMENTO LÍQUIDO APROVADO (R$)", Valor: (isTargetCongelado ? fAlvo?.resumoMetricas.faturamentoLiquido || 0 : faturamentoLiquido).toFixed(2) },
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

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="SGP_Boletim_Medicao_${competencia}.xlsx"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err: any) {
    console.error("Erro na API de fechamento XLSX:", err);
    return NextResponse.json(
      { sucesso: false, erro: err?.message || "Falha ao gerar boletim Excel" },
      { status: 500 }
    );
  }
}
