/**
 * SGP — Sistema de Gestão de Postos
 * Repositório: Prévias da Competência (tabela previa_competencia)
 *
 * - As prévias são geradas pela regra única de src/lib/servicos/previas.ts.
 * - Geração idempotente: só cria o que falta; nunca sobrescreve ajuste manual.
 * - Ajuste manual: só pela Administração, motivo obrigatório, sem sobreposição e sem dias descobertos.
 */

import prisma from "@/lib/prisma";
import {
  calcularPreviasPadrao,
  cicloDaCompetencia,
  competenciaDaDataPrevia,
  competenciasPadraoCadastro,
  obterPrevia,
  validarPreviasCompetencia,
  type NumeroPrevia,
  type Previa,
} from "@/lib/servicos/previas";
import { garantirPeriodoNaoCongelado } from "./validacoes";

const dataBanco = (iso: string) => new Date(iso + "T00:00:00.000Z");
const isoBanco = (d: Date) => d.toISOString().slice(0, 10);

function mapearPrevia(row: {
  competencia: string;
  numero: number;
  dataInicio: Date;
  dataFim: Date;
  ajustadaManual: boolean;
  motivoAjuste: string | null;
}): Previa {
  return {
    competencia: row.competencia,
    numero: row.numero as NumeroPrevia,
    dataInicio: isoBanco(row.dataInicio),
    dataFim: isoBanco(row.dataFim),
    ajustadaManual: row.ajustadaManual,
    motivoAjuste: row.motivoAjuste,
  };
}

/** Cria (se faltarem) as prévias das competências informadas, pela regra padrão. */
export async function garantirPreviasCompetencias(competencias: string[], usuario = "sistema"): Promise<number> {
  const unicas = Array.from(new Set(competencias));
  if (unicas.length === 0) return 0;
  const dados = unicas.flatMap((c) =>
    calcularPreviasPadrao(c).map((p) => ({
      competencia: p.competencia,
      numero: p.numero,
      dataInicio: dataBanco(p.dataInicio),
      dataFim: dataBanco(p.dataFim),
      ajustadaManual: false,
      criadoPor: usuario,
      atualizadoPor: usuario,
    }))
  );
  const r = await prisma.previaCompetencia.createMany({ data: dados, skipDuplicates: true });
  return r.count;
}

/** Prévias cadastradas das competências (gera as que faltarem). */
export async function listarPreviasCompetencias(competencias: string[]): Promise<Previa[]> {
  const unicas = Array.from(new Set(competencias));
  if (unicas.length === 0) return [];
  let linhas = await prisma.previaCompetencia.findMany({
    where: { competencia: { in: unicas } },
    orderBy: [{ competencia: "asc" }, { numero: "asc" }],
  });
  const completas = new Set(
    unicas.filter((c) => linhas.filter((l) => l.competencia === c).length === 3)
  );
  const faltantes = unicas.filter((c) => !completas.has(c));
  if (faltantes.length > 0) {
    await garantirPreviasCompetencias(faltantes);
    linhas = await prisma.previaCompetencia.findMany({
      where: { competencia: { in: unicas } },
      orderBy: [{ competencia: "asc" }, { numero: "asc" }],
    });
  }
  return linhas.map(mapearPrevia);
}

export async function obterPreviasDaCompetencia(competencia: string): Promise<Previa[]> {
  return listarPreviasCompetencias([competencia]);
}

/** obterPrevia(data) no servidor, usando o cadastro do banco. */
export async function obterPreviaServidor(data: string): Promise<Previa> {
  const comp = competenciaDaDataPrevia(data);
  const cadastradas = await listarPreviasCompetencias([comp]);
  return obterPrevia(data, cadastradas);
}

/** Lista padrão do cadastro: competência atual, 2 anteriores e 12 seguintes. */
export async function listarPreviasPadrao(dataReferencia?: string): Promise<Previa[]> {
  return listarPreviasCompetencias(competenciasPadraoCadastro(dataReferencia));
}

export class AjustePreviaInvalidoError extends Error {
  public readonly statusCode = 422;
  public readonly erros: string[];
  constructor(erros: string[]) {
    super(erros.join(" "));
    this.name = "AjustePreviaInvalidoError";
    this.erros = erros;
  }
}

/**
 * Ajuste manual das datas das prévias de uma competência.
 * Bloqueia: motivo vazio, sobreposição, dias sem prévia, competência congelada.
 */
export async function ajustarPreviasCompetencia(
  competencia: string,
  previas: Array<{ numero: number; dataInicio: string; dataFim: string }>,
  motivo: string,
  usuario: string
): Promise<Previa[]> {
  const motivoLimpo = (motivo || "").trim();
  const erros: string[] = [];
  if (motivoLimpo.length < 5) erros.push("O motivo do ajuste é obrigatório (mínimo de 5 caracteres).");
  erros.push(...validarPreviasCompetencia(competencia, previas));
  if (erros.length) throw new AjustePreviaInvalidoError(erros);

  const ciclo = cicloDaCompetencia(competencia);
  garantirPeriodoNaoCongelado(ciclo.inicio, ciclo.fim, "ajustar as datas das prévias");

  await garantirPreviasCompetencias([competencia], usuario);
  const padrao = calcularPreviasPadrao(competencia);

  await prisma.$transaction(
    previas.map((p) => {
      const pad = padrao.find((x) => x.numero === p.numero)!;
      const igualPadrao = pad.dataInicio === p.dataInicio && pad.dataFim === p.dataFim;
      return prisma.previaCompetencia.update({
        where: { uq_previa_competencia_numero: { competencia, numero: p.numero } },
        data: {
          dataInicio: dataBanco(p.dataInicio),
          dataFim: dataBanco(p.dataFim),
          ajustadaManual: !igualPadrao,
          motivoAjuste: motivoLimpo,
          atualizadoPor: usuario,
        },
      });
    })
  );

  return obterPreviasDaCompetencia(competencia);
}
