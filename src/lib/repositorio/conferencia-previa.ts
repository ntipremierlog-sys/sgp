/**
 * SGP — Sistema de Gestão de Postos
 * Repositório: Conferência de Prévia Petrobras (Item 11.3 do Contrato)
 *
 * Regras estritas:
 * - Cada parecer ou alteração de parecer é uma NOVA linha imutável (nunca editar nem apagar).
 * - O parecer é POR REGISTRO E POR PRÉVIA: a chave é (registroId, tipoRegistro, competencia, previaNumero).
 *   O parecer da 1ª prévia não aparece nem vale para a 2ª.
 * - A competência e o número da prévia vêm do cadastro de prévias (obterPrevia); o registro precisa
 *   ter dias dentro da prévia em que o parecer é dado.
 * - Grava registrado_por com o login do usuário da sessão e registrado_em com timestamp atual.
 */

import prisma from "@/lib/prisma";
import { TipoRegistroConferencia, StatusConferenciaPosto } from "@prisma/client";
import { recortarNaPrevia, rotuloPreviaComDatas } from "@/lib/servicos/previas";
import { garantirPeriodoNaoCongelado } from "./validacoes";
import { obterPreviasDaCompetencia, obterPreviaServidor } from "./previas";

export interface FiltrosConferenciaPrevia {
  competencia?: string;
  previaNumero?: number;
  tipoRegistro?: TipoRegistroConferencia | string;
  registroIds?: string[];
}

export function chaveParecer(registroId: string, competencia: string | null | undefined, previaNumero: number) {
  return `${registroId}:${competencia || ""}:${previaNumero}`;
}

export async function obterPareceresVigentes(filtros?: FiltrosConferenciaPrevia) {
  const where: any = {};
  if (filtros?.competencia) where.competencia = filtros.competencia;
  if (filtros?.previaNumero) where.previaNumero = Number(filtros.previaNumero);
  if (filtros?.tipoRegistro) where.tipoRegistro = filtros.tipoRegistro as TipoRegistroConferencia;
  if (filtros?.registroIds && filtros.registroIds.length > 0) {
    where.registroId = { in: filtros.registroIds };
  }

  // Busca todos os pareceres ordenados pelos mais recentes primeiro
  const todos = await prisma.conferenciaPrevia.findMany({
    where,
    orderBy: { registradoEm: "desc" },
  });

  // Vigente = mais recente para (registroId + tipoRegistro + competencia + previaNumero)
  const mapaVigentes = new Map<string, typeof todos[0]>();
  for (const item of todos) {
    const chave = `${item.tipoRegistro}:${chaveParecer(item.registroId, item.competencia, item.previaNumero)}`;
    if (!mapaVigentes.has(chave)) {
      mapaVigentes.set(chave, item);
    }
  }

  return Array.from(mapaVigentes.values());
}

export async function obterHistoricoPareceres(
  registroId: string,
  tipoRegistro?: TipoRegistroConferencia | string,
  competencia?: string,
  previaNumero?: number
) {
  const where: any = { registroId };
  if (tipoRegistro) where.tipoRegistro = tipoRegistro as TipoRegistroConferencia;
  if (competencia) where.competencia = competencia;
  if (previaNumero) where.previaNumero = Number(previaNumero);

  return prisma.conferenciaPrevia.findMany({
    where,
    orderBy: { registradoEm: "desc" },
  });
}

export interface DadosRegistrarParecer {
  tipoRegistro: TipoRegistroConferencia | "COBERTURA" | "OCORRENCIA";
  registroId: string;
  /** Competência (AAAA-MM) da prévia em que o parecer é dado. */
  competencia?: string;
  /** Número da prévia (1, 2 ou 3) em que o parecer é dado. */
  previaNumero?: number;
  /** Alternativa: data dentro da prévia (usada só se competência/número não vierem). */
  dataReferenciaOuInicio?: string;
  status: StatusConferenciaPosto | "COBERTO" | "DESCOBERTO" | "PENDENTE";
  comentario?: string;
}

async function obterPeriodoDoRegistro(tipo: TipoRegistroConferencia, id: string) {
  if (tipo === TipoRegistroConferencia.COBERTURA) {
    const c = await prisma.cobertura.findFirst({ where: { id, deletedAt: null }, select: { dataInicio: true, dataFim: true } });
    return c ? { inicio: c.dataInicio.toISOString().slice(0, 10), fim: c.dataFim.toISOString().slice(0, 10) } : null;
  }
  const o = await prisma.ocorrencia.findFirst({ where: { id, deletedAt: null }, select: { dataInicio: true, dataFim: true } });
  return o ? { inicio: o.dataInicio.toISOString().slice(0, 10), fim: o.dataFim.toISOString().slice(0, 10) } : null;
}

export async function registrarParecerPrevia(dados: DadosRegistrarParecer, usuarioSessao: string) {
  const tipoRegistro = dados.tipoRegistro as TipoRegistroConferencia;
  const status = dados.status as StatusConferenciaPosto;

  // 1. Prévia em que o parecer é dado (cadastro do banco)
  let competencia = dados.competencia;
  let numero = dados.previaNumero ? Number(dados.previaNumero) : undefined;
  if ((!competencia || !numero) && dados.dataReferenciaOuInicio) {
    const p = await obterPreviaServidor(dados.dataReferenciaOuInicio);
    competencia = p.competencia;
    numero = p.numero;
  }
  if (!competencia || !numero || ![1, 2, 3].includes(numero)) {
    throw new Error("Informe a competência e o número da prévia (1, 2 ou 3) do parecer.");
  }
  const previa = (await obterPreviasDaCompetencia(competencia)).find((p) => p.numero === numero);
  if (!previa) throw new Error(`Prévia ${numero} da competência ${competencia} não encontrada.`);

  // 2. O registro precisa ter dias dentro da prévia
  const periodo = await obterPeriodoDoRegistro(tipoRegistro, dados.registroId);
  if (!periodo) throw new Error("Registro não encontrado ou excluído.");
  const recorte = recortarNaPrevia(periodo.inicio, periodo.fim, previa);
  if (!recorte) {
    throw new Error(`O registro não tem dias dentro da ${rotuloPreviaComDatas(previa)}; o parecer não pode ser dado nesta prévia.`);
  }

  // 3. Validação de período congelado (dias do registro dentro da prévia)
  garantirPeriodoNaoCongelado(recorte.inicio, recorte.fim, `registrar parecer na ${numero}ª prévia`);

  // 4. Sempre cria uma NOVA linha imutável (append-only)
  return prisma.conferenciaPrevia.create({
    data: {
      tipoRegistro,
      registroId: dados.registroId,
      competencia,
      previaNumero: numero,
      status,
      comentario: dados.comentario || null,
      registradoPor: usuarioSessao,
      registradoEm: new Date(),
    },
  });
}
