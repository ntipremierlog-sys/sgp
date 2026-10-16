/**
 * SGP — Sistema de Gestão de Postos
 * Fonte ÚNICA da regra de PRÉVIAS (períodos de conferência dentro da competência).
 *
 * Convenção de competência (não alterar): a competência tem o nome do mês em que
 * o ciclo TERMINA (ciclo 10/09 a 09/10 = competência 2026-10). O ciclo é obtido
 * exclusivamente por obterCicloCompetenciaAtual (periodo-competencia.ts).
 *
 * Regra padrão (igual para todos os imóveis):
 *  - 1ª prévia: dia 10 ao dia 19 do mês em que o ciclo começa;
 *  - 2ª prévia: dia 20 ao dia 29 desse mesmo mês (ou último dia do mês, se menor);
 *  - 3ª prévia: do dia seguinte ao fim da 2ª até o dia 09 do mês seguinte (fim do ciclo).
 *
 * As datas oficiais ficam na tabela previa_competencia (podem ser ajustadas
 * manualmente pela Administração). As funções abaixo recebem a lista cadastrada
 * e só usam a regra padrão quando a competência ainda não está cadastrada.
 *
 * Módulo puro (sem banco), usado no servidor e nas telas.
 */

import { obterCicloCompetenciaAtual } from "./periodo-competencia";

export type NumeroPrevia = 1 | 2 | 3;

export interface Previa {
  competencia: string; // AAAA-MM (mês de término do ciclo)
  numero: NumeroPrevia;
  dataInicio: string; // AAAA-MM-DD
  dataFim: string; // AAAA-MM-DD
  ajustadaManual?: boolean;
  motivoAjuste?: string | null;
}

/** Parte de um registro (cobertura/ocorrência) que cai dentro de uma prévia. */
export interface RecortePrevia {
  inicio: string;
  fim: string;
  dias: number;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return [a, m, d];
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function somarDias(iso: string, n: number): string {
  const [a, m, d] = partes(iso);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function diasEntre(inicio: string, fim: string): number {
  const [a1, m1, d1] = partes(inicio);
  const [a2, m2, d2] = partes(fim);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000) + 1;
}

/** Data de hoje no fuso de Brasília (AAAA-MM-DD), independente do fuso do servidor. */
export function hojeBrasil(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Competência (AAAA-MM) que contém a data, pela regra oficial do ciclo. */
export function competenciaDaDataPrevia(data: string): string {
  const [a, m, d] = partes(data);
  return obterCicloCompetenciaAtual(new Date(a, m - 1, d)).competencia;
}

/** Ciclo (início/fim) de uma competência, calculado por obterCicloCompetenciaAtual. */
export function cicloDaCompetencia(competencia: string): { inicio: string; fim: string; competencia: string } {
  const [a, m] = competencia.split("-").map(Number);
  let anoIni = a;
  let mesIni = m - 1;
  if (mesIni === 0) {
    mesIni = 12;
    anoIni -= 1;
  }
  const ciclo = obterCicloCompetenciaAtual(new Date(anoIni, mesIni - 1, 10));
  if (ciclo.competencia !== competencia) {
    throw new Error(`Competência inválida: ${competencia}`);
  }
  return ciclo;
}

/** Desloca uma competência AAAA-MM em N meses. */
export function deslocarCompetencia(competencia: string, delta: number): string {
  const [a, m] = competencia.split("-").map(Number);
  const total = a * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`;
}

/** Prévias pela regra padrão (sem ajuste manual). */
export function calcularPreviasPadrao(competencia: string): Previa[] {
  const ciclo = cicloDaCompetencia(competencia);
  const [ai, mi] = partes(ciclo.inicio);
  const fimSegunda = Math.min(29, ultimoDiaDoMes(ai, mi));
  const base = `${ai}-${pad2(mi)}`;
  const p1: Previa = { competencia, numero: 1, dataInicio: ciclo.inicio, dataFim: `${base}-19` };
  const p2: Previa = { competencia, numero: 2, dataInicio: `${base}-20`, dataFim: `${base}-${pad2(fimSegunda)}` };
  const p3: Previa = { competencia, numero: 3, dataInicio: somarDias(p2.dataFim, 1), dataFim: ciclo.fim };
  return [p1, p2, p3];
}

/** Prévias de uma competência: as cadastradas (se completas) ou a regra padrão. */
export function previasDaCompetencia(competencia: string, cadastradas?: Previa[]): Previa[] {
  const lista = (cadastradas || [])
    .filter((p) => p.competencia === competencia)
    .sort((a, b) => a.numero - b.numero);
  if (lista.length === 3) return lista;
  return calcularPreviasPadrao(competencia);
}

/**
 * FUNÇÃO ÚNICA: retorna a prévia (competência, número, início e fim) que contém a data.
 * `cadastradas` = prévias vindas do banco (tabela previa_competencia).
 */
export function obterPrevia(data: string, cadastradas?: Previa[]): Previa {
  const dia = data.slice(0, 10);
  const competencia = competenciaDaDataPrevia(dia);
  const lista = previasDaCompetencia(competencia, cadastradas);
  const achada = lista.find((p) => p.dataInicio <= dia && dia <= p.dataFim);
  if (achada) return achada;
  // Segurança: cadastro inconsistente → regra padrão
  const padrao = calcularPreviasPadrao(competencia).find((p) => p.dataInicio <= dia && dia <= p.dataFim);
  if (!padrao) throw new Error(`Não foi possível determinar a prévia da data ${dia}.`);
  return padrao;
}

/** Recorte do período [inicio, fim] dentro da prévia (null se não houver interseção). */
export function recortarNaPrevia(inicio: string, fim: string | null | undefined, previa: Previa): RecortePrevia | null {
  const ini = inicio.slice(0, 10);
  const f = (fim || inicio).slice(0, 10);
  const rIni = ini > previa.dataInicio ? ini : previa.dataInicio;
  const rFim = f < previa.dataFim ? f : previa.dataFim;
  if (rIni > rFim) return null;
  return { inicio: rIni, fim: rFim, dias: diasEntre(rIni, rFim) };
}

/** Todas as prévias que um período atravessa, com os dias de cada uma. */
export function previasDoPeriodo(
  inicio: string,
  fim: string | null | undefined,
  cadastradas?: Previa[]
): Array<{ previa: Previa; recorte: RecortePrevia }> {
  const ini = inicio.slice(0, 10);
  const f = (fim || inicio).slice(0, 10);
  const resultado: Array<{ previa: Previa; recorte: RecortePrevia }> = [];
  let comp = competenciaDaDataPrevia(ini);
  const compFim = competenciaDaDataPrevia(f);
  let guarda = 0;
  while (comp <= compFim && guarda < 240) {
    for (const p of previasDaCompetencia(comp, cadastradas)) {
      const r = recortarNaPrevia(ini, f, p);
      if (r) resultado.push({ previa: p, recorte: r });
    }
    comp = deslocarCompetencia(comp, 1);
    guarda++;
  }
  return resultado;
}

/**
 * Valida as prévias de uma competência: exatamente 3 (números 1, 2 e 3), em ordem,
 * sem sobreposição e sem dias descobertos, cobrindo todo o ciclo da competência.
 * Retorna a lista de erros (vazia = válido).
 */
export function validarPreviasCompetencia(
  competencia: string,
  previas: Array<{ numero: number; dataInicio: string; dataFim: string }>
): string[] {
  const erros: string[] = [];
  let ciclo: { inicio: string; fim: string };
  try {
    ciclo = cicloDaCompetencia(competencia);
  } catch {
    return [`Competência inválida: ${competencia}.`];
  }
  const ord = [...previas].sort((a, b) => a.numero - b.numero);
  if (ord.length !== 3 || ord.map((p) => p.numero).join(",") !== "1,2,3") {
    return ["Informe exatamente as prévias 1, 2 e 3."];
  }
  const reData = /^\d{4}-\d{2}-\d{2}$/;
  for (const p of ord) {
    if (!reData.test(p.dataInicio) || !reData.test(p.dataFim)) {
      erros.push(`${p.numero}ª prévia: datas inválidas.`);
    } else if (p.dataInicio > p.dataFim) {
      erros.push(`${p.numero}ª prévia: a data de início é posterior à data de fim.`);
    }
  }
  if (erros.length) return erros;

  if (ord[0].dataInicio !== ciclo.inicio) {
    erros.push(`A 1ª prévia deve começar em ${formatarDataBr(ciclo.inicio)} (início da competência); os dias anteriores ficariam sem prévia.`);
  }
  if (ord[2].dataFim !== ciclo.fim) {
    erros.push(`A 3ª prévia deve terminar em ${formatarDataBr(ciclo.fim)} (fim da competência); dias ficariam sem prévia ou fora da competência.`);
  }
  for (let i = 0; i < 2; i++) {
    const atual = ord[i];
    const prox = ord[i + 1];
    if (prox.dataInicio <= atual.dataFim) {
      erros.push(`A ${atual.numero}ª e a ${prox.numero}ª prévia se sobrepõem (${formatarDataBr(prox.dataInicio)} ≤ ${formatarDataBr(atual.dataFim)}).`);
    } else if (prox.dataInicio !== somarDias(atual.dataFim, 1)) {
      erros.push(
        `Há dias sem prévia entre a ${atual.numero}ª e a ${prox.numero}ª prévia (${formatarDataBr(somarDias(atual.dataFim, 1))} a ${formatarDataBr(somarDias(prox.dataInicio, -1))}).`
      );
    }
  }
  return erros;
}

export function formatarDataBr(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function formatarDdMm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

/** Ex.: "2ª prévia — 20/09 a 29/09" */
export function rotuloPreviaComDatas(p: Pick<Previa, "numero" | "dataInicio" | "dataFim">): string {
  return `${p.numero}ª prévia — ${formatarDdMm(p.dataInicio)} a ${formatarDdMm(p.dataFim)}`;
}

/** Ex.: "Competência 10/2026 (10/09 a 09/10)" */
export function rotuloCompetencia(competencia: string): string {
  const ciclo = cicloDaCompetencia(competencia);
  const [a, m] = competencia.split("-");
  return `Competência ${m}/${a} (${formatarDdMm(ciclo.inicio)} a ${formatarDdMm(ciclo.fim)})`;
}

/** Competências padrão do cadastro: atual, 2 anteriores e 12 seguintes. */
export function competenciasPadraoCadastro(dataReferencia: string = hojeBrasil()): string[] {
  const atual = competenciaDaDataPrevia(dataReferencia);
  const lista: string[] = [];
  for (let d = -2; d <= 12; d++) lista.push(deslocarCompetencia(atual, d));
  return lista;
}
