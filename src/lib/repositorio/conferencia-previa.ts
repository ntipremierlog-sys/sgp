/**
 * SGP — Sistema de Gestão de Postos
 * Repositório: Conferência de Prévia Petrobras (Item 11.3 do Contrato)
 *
 * Regras estritas:
 * - Cada parecer ou alteração de parecer é uma NOVA linha imutável (nunca editar nem apagar).
 * - O parecer vigente é sempre o registro mais recente para (registroId, tipoRegistro, previaNumero).
 * - A competência é calculada a partir da data inicial usando obterCicloCompetenciaAtual / competenciaDaData.
 * - Grava registrado_por com o login do usuário da sessão e registrado_em com timestamp atual.
 */

import prisma from "@/lib/prisma";
import { TipoRegistroConferencia, StatusConferenciaPosto } from "@prisma/client";
import { competenciaDaData, obterCicloCompetenciaAtual } from "@/lib/servicos/periodo-competencia";
import { garantirPeriodoNaoCongelado } from "./validacoes";

export interface FiltrosConferenciaPrevia {
  competencia?: string;
  tipoRegistro?: TipoRegistroConferencia | string;
  registroIds?: string[];
}

export async function obterPareceresVigentes(filtros?: FiltrosConferenciaPrevia) {
  const where: any = {};
  if (filtros?.competencia) where.competencia = filtros.competencia;
  if (filtros?.tipoRegistro) where.tipoRegistro = filtros.tipoRegistro as TipoRegistroConferencia;
  if (filtros?.registroIds && filtros.registroIds.length > 0) {
    where.registroId = { in: filtros.registroIds };
  }

  // Busca todos os pareceres ordenados pelos mais recentes primeiro
  const todos = await prisma.conferenciaPrevia.findMany({
    where,
    orderBy: { registradoEm: "desc" },
  });

  // Agrupa e seleciona apenas o mais recente para cada (registroId + tipoRegistro + previaNumero)
  const mapaVigentes = new Map<string, typeof todos[0]>();
  for (const item of todos) {
    const chave = `${item.registroId}:${item.tipoRegistro}:${item.previaNumero}`;
    if (!mapaVigentes.has(chave)) {
      mapaVigentes.set(chave, item);
    }
  }

  return Array.from(mapaVigentes.values());
}

export async function obterHistoricoPareceres(registroId: string, tipoRegistro?: TipoRegistroConferencia | string) {
  const where: any = { registroId };
  if (tipoRegistro) where.tipoRegistro = tipoRegistro as TipoRegistroConferencia;

  return prisma.conferenciaPrevia.findMany({
    where,
    orderBy: { registradoEm: "desc" },
  });
}

export interface DadosRegistrarParecer {
  tipoRegistro: TipoRegistroConferencia | "COBERTURA" | "OCORRENCIA";
  registroId: string;
  dataReferenciaOuInicio: string;
  previaNumero: number;
  status: StatusConferenciaPosto | "COBERTO" | "DESCOBERTO" | "PENDENTE";
  comentario?: string;
  competencia?: string;
}

export async function registrarParecerPrevia(
  dados: DadosRegistrarParecer,
  usuarioSessao: string
) {
  // 1. Determinar competência oficial
  let competencia = dados.competencia;
  if (!competencia && dados.dataReferenciaOuInicio) {
    try {
      const dt = new Date(dados.dataReferenciaOuInicio + "T00:00:00.000Z");
      competencia = obterCicloCompetenciaAtual(dt).competencia;
    } catch {
      competencia = competenciaDaData(dados.dataReferenciaOuInicio);
    }
  }

  // 2. Validação de período congelado
  if (dados.dataReferenciaOuInicio) {
    garantirPeriodoNaoCongelado(
      dados.dataReferenciaOuInicio,
      dados.dataReferenciaOuInicio,
      `registrar parecer na Prévia ${dados.previaNumero}`
    );
  }

  // 3. Normalização de enums
  const tipoRegistro = dados.tipoRegistro as TipoRegistroConferencia;
  const status = dados.status as StatusConferenciaPosto;

  // 4. Sempre cria uma NOVA linha imutável (append-only)
  return prisma.conferenciaPrevia.create({
    data: {
      tipoRegistro,
      registroId: dados.registroId,
      competencia: competencia || null,
      previaNumero: Number(dados.previaNumero),
      status,
      comentario: dados.comentario || null,
      registradoPor: usuarioSessao,
      registradoEm: new Date(),
    },
  });
}
