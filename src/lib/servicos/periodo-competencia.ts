/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Fonte ÚNICA da regra de período da competência.
 *
 * Convenção oficial (igual à Memória de Cálculo):
 *   Competência "AAAA-MM" = dia 10 do mês ANTERIOR até dia 09 do mês MM.
 *   Ex.: competência 2026-09 → 10/08/2026 a 09/09/2026.
 *
 * Este módulo é puro (sem dependências) para poder ser importado tanto pela camada
 * de dados (estado-operacional) quanto pelos serviços e páginas sem ciclos de import.
 */

export interface PeriodoCompetencia {
  /** Competência no formato AAAA-MM (mês de FIM do ciclo). */
  competencia: string;
  dataInicio: string;
  dataFim: string;
  textoFormatado: string;
  datas: string[];
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Converte (ano, mês de INÍCIO do ciclo) na competência oficial (mês de FIM). */
export function competenciaDoInicioCiclo(anoInicio: number, mesInicio: number): string {
  let ano = anoInicio;
  let mes = mesInicio + 1;
  if (mes > 12) {
    mes = 1;
    ano += 1;
  }
  return `${ano}-${pad2(mes)}`;
}

/** Retorna a competência oficial à qual uma data (AAAA-MM-DD) pertence. */
export function competenciaDaData(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  if (d >= 10) return competenciaDoInicioCiclo(a, m);
  return `${a}-${pad2(m)}`;
}

/** Calcula o período oficial da competência (dia 10 do mês anterior ao dia 09 do mês de referência). */
export function calcularPeriodoCompetencia(competencia: string): PeriodoCompetencia {
  const [anoStr, mesStr] = competencia.split("-");
  const ano = parseInt(anoStr, 10) || 2026;
  const mes = parseInt(mesStr, 10) || 9;

  let anoAnt = ano;
  let mesAnt = mes - 1;
  if (mesAnt === 0) {
    mesAnt = 12;
    anoAnt = ano - 1;
  }

  const dataInicio = `${anoAnt}-${pad2(mesAnt)}-10`;
  const dataFim = `${ano}-${pad2(mes)}-09`;
  const textoFormatado = `10/${pad2(mesAnt)}/${anoAnt} a 09/${pad2(mes)}/${ano}`;

  const datas: string[] = [];
  const dtAtual = new Date(anoAnt, mesAnt - 1, 10);
  const dtFim = new Date(ano, mes - 1, 9);
  while (dtAtual <= dtFim) {
    datas.push(`${dtAtual.getFullYear()}-${pad2(dtAtual.getMonth() + 1)}-${pad2(dtAtual.getDate())}`);
    dtAtual.setDate(dtAtual.getDate() + 1);
  }

  return { competencia: `${ano}-${pad2(mes)}`, dataInicio, dataFim, textoFormatado, datas };
}
