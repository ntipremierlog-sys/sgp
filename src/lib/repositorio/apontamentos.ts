/**
 * SGP — Sistema de Gestão de Postos
 * Repositório: Apontamentos Formais da Fiscalização Petrobras e Tratativa Premier
 */

import prisma from "@/lib/prisma";
import { StatusApontamento } from "@prisma/client";
import { garantirPeriodoNaoCongelado } from "./validacoes";

export interface FiltrosApontamentos {
  postoId?: string;
  postoCodigo?: string;
  postoIdSgp?: string;
  imovelId?: string;
  imovelNome?: string;
  periodoInicio?: string;
  periodoFim?: string;
  status?: StatusApontamento | string;
}

export async function obterApontamentos(filtros?: FiltrosApontamentos) {
  const where: any = {};

  if (filtros?.postoId) where.postoId = filtros.postoId;
  if (filtros?.postoCodigo) where.posto = { ...where.posto, codigoPosto: filtros.postoCodigo };
  if (filtros?.postoIdSgp) where.posto = { ...where.posto, postoIdSgp: filtros.postoIdSgp };
  if (filtros?.imovelId) where.posto = { ...where.posto, imovelId: filtros.imovelId };
  if (filtros?.imovelNome) {
    where.posto = {
      ...where.posto,
      imovel: { nome: filtros.imovelNome },
    };
  }
  if (filtros?.status) where.status = filtros.status as StatusApontamento;

  if (filtros?.periodoInicio && filtros?.periodoFim) {
    const dtIni = new Date(filtros.periodoInicio + "T00:00:00.000Z");
    const dtFim = new Date(filtros.periodoFim + "T23:59:59.999Z");
    where.AND = [
      { periodoInicio: { lte: dtFim } },
      { periodoFim: { gte: dtIni } },
    ];
  } else if (filtros?.periodoInicio) {
    where.periodoFim = { gte: new Date(filtros.periodoInicio + "T00:00:00.000Z") };
  } else if (filtros?.periodoFim) {
    where.periodoInicio = { lte: new Date(filtros.periodoFim + "T23:59:59.999Z") };
  }

  return prisma.apontamento.findMany({
    where,
    include: {
      posto: {
        include: {
          imovel: true,
          unidade: true,
        },
      },
      ocupacaoPostoDia: true,
    },
    orderBy: { criadoEm: "desc" },
  });
}

export interface DadosCriarApontamento {
  id?: string;
  postoId?: string;
  postoCodigo?: string;
  postoIdSgp?: string;
  ocupacaoPostoDiaId?: string;
  periodoInicio: string;
  periodoFim: string;
  texto: string;
  status?: StatusApontamento | string;
  respostaPremier?: string;
}

export async function criarApontamento(dados: DadosCriarApontamento, usuarioSessao: string) {
  garantirPeriodoNaoCongelado(dados.periodoInicio, dados.periodoFim, "criar apontamento");

  let postoId = dados.postoId;
  if (!postoId && (dados.postoCodigo || dados.postoIdSgp)) {
    const p = await prisma.posto.findFirst({
      where: {
        OR: [
          ...(dados.postoCodigo ? [{ codigoPosto: dados.postoCodigo }] : []),
          ...(dados.postoIdSgp ? [{ postoIdSgp: dados.postoIdSgp }] : []),
        ],
      },
    });
    if (p) postoId = p.id;
  }

  const status = (dados.status as StatusApontamento) || StatusApontamento.ABERTO;

  return prisma.apontamento.create({
    data: {
      ...(dados.id ? { id: dados.id } : {}),
      postoId: postoId || null,
      ocupacaoPostoDiaId: dados.ocupacaoPostoDiaId || null,
      periodoInicio: new Date(dados.periodoInicio + "T00:00:00.000Z"),
      periodoFim: new Date(dados.periodoFim + "T23:59:59.000Z"),
      texto: dados.texto,
      criadoPor: usuarioSessao,
      status,
      respostaPremier: dados.respostaPremier || null,
    },
    include: {
      posto: true,
    },
  });
}

export interface DadosAtualizarApontamento {
  texto?: string;
  status?: StatusApontamento | string;
  respostaPremier?: string;
  respondidoPor?: string;
  respondidoEm?: string | Date;
}

export async function atualizarApontamento(
  id: string,
  dados: DadosAtualizarApontamento,
  usuarioSessao: string
) {
  const existente = await prisma.apontamento.findUnique({ where: { id } });
  if (!existente) throw new Error(`Apontamento ${id} não encontrado.`);

  const dataIniStr = existente.periodoInicio.toISOString().slice(0, 10);
  const dataFimStr = existente.periodoFim.toISOString().slice(0, 10);
  garantirPeriodoNaoCongelado(dataIniStr, dataFimStr, "alterar apontamento");

  const status = dados.status ? (dados.status as StatusApontamento) : undefined;
  const isRespondendo = Boolean(dados.respostaPremier && !existente.respostaPremier);

  return prisma.apontamento.update({
    where: { id },
    data: {
      texto: dados.texto !== undefined ? dados.texto : undefined,
      status: status !== undefined ? status : undefined,
      respostaPremier: dados.respostaPremier !== undefined ? dados.respostaPremier : undefined,
      respondidoPor: isRespondendo ? usuarioSessao : (dados.respondidoPor !== undefined ? dados.respondidoPor : undefined),
      respondidoEm: isRespondendo ? new Date() : (dados.respondidoEm ? new Date(dados.respondidoEm) : undefined),
      atualizadoPor: usuarioSessao,
    },
    include: {
      posto: true,
    },
  });
}
