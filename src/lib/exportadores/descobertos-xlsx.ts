/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Exportador Oficial de Descobertos do Período para Excel (.xlsx)
 */

import * as XLSX from "xlsx";

export interface ItemDescobertoExportacao {
  unidade: string;
  posicaoId: string;
  codigoVisual?: string;
  codigoPosto: string;
  funcao: string;
  data: string;
  diaSemana: string;
  titularNome: string;
  titularChapa: string;
  categoriaAusencia: string;
  horario: string;
  feristasSugeridos: string;
  status: string;
}

export function gerarPlanilhaDescobertosXlsx(
  descobertos: ItemDescobertoExportacao[],
  periodoRotulo: string = "Período Apurado"
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo Executivo
  const resumo = [
    { Indicador: "Relatório", Valor: "Posições Descobertas do Período (SGP)" },
    { Indicador: "Contrato", Valor: "Petrobras ICJ 5900.0129796.25.2 · Premier Logistics" },
    { Indicador: "Período / Competência", Valor: periodoRotulo },
    { Indicador: "Total de Diárias Descobertas", Valor: descobertos.length },
    {
      Indicador: "Posições Únicas Afetadas",
      Valor: new Set(descobertos.map((d) => d.posicaoId)).size,
    },
    {
      Indicador: "Unidades com Descobertos",
      Valor: new Set(descobertos.map((d) => d.unidade)).size,
    },
    { Indicador: "Data de Emissão", Valor: new Date().toLocaleDateString("pt-BR") },
    { Indicador: "Conformidade LGPD", Valor: "Classificação Restrita a Categorias (Sem Dados Médicos/CID)" },
  ];

  const wsResumo = XLSX.utils.json_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Executivo");

  // Aba 2: Lista Analítica de Descobertos
  const linhasTabela = descobertos.map((item, idx) => ({
    "Item": idx + 1,
    "Unidade / Base": item.unidade,
    "ID Posição SGP": item.posicaoId,
    "Código Visual": item.codigoVisual || item.posicaoId,
    "Código Posto": item.codigoPosto,
    "Função": item.funcao,
    "Data": item.data,
    "Dia": item.diaSemana,
    "Titular": item.titularNome,
    "Chapa RM": item.titularChapa,
    "Categoria Ausência (RM)": item.categoriaAusencia,
    "Horário Previsto": item.horario,
    "Feristas Sugeridos (Disponíveis)": item.feristasSugeridos || "Nenhum no dia",
    "Status": "DESCOBERTO (D)",
  }));

  const wsDescobertos = XLSX.utils.json_to_sheet(
    linhasTabela.length > 0
      ? linhasTabela
      : [{ "Mensagem": "Nenhuma posição descoberta encontrada para os filtros selecionados." }]
  );
  XLSX.utils.book_append_sheet(wb, wsDescobertos, "Descobertos Analítico");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(out);
}
