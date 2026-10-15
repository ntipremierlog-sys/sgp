/**
 * SGP — Sistema de Gestão de Postos
 * Repositório: Coberturas Operacionais
 * 
 * Regras estritas:
 * - Exclusão é SEMPRE lógica (soft delete via deleted_at), nunca apagando a linha.
 * - Grava criado_por e atualizado_por a partir da sessão.
 * - Bloqueia operações em competências congeladas.
 */

import prisma from "@/lib/prisma";
import { garantirPeriodoNaoCongelado } from "./validacoes";
import { TipoCobertura, StatusCobertura } from "@prisma/client";

export interface FiltrosCoberturas {
  imovelId?: string;
  imovelNome?: string;
  postoCodigo?: string;
  postoIdSgp?: string;
  periodoInicio?: string;
  periodoFim?: string;
}

export async function obterCoberturas(filtros?: FiltrosCoberturas) {
  const where: any = {
    deletedAt: null,
  };

  if (filtros?.imovelId) where.posto = { ...where.posto, imovelId: filtros.imovelId };
  if (filtros?.imovelNome) {
    where.posto = {
      ...where.posto,
      imovel: { nome: filtros.imovelNome },
    };
  }
  if (filtros?.postoCodigo) where.posto = { ...where.posto, codigoPosto: filtros.postoCodigo };
  if (filtros?.postoIdSgp) where.posto = { ...where.posto, postoIdSgp: filtros.postoIdSgp };

  if (filtros?.periodoInicio && filtros?.periodoFim) {
    const dtIni = new Date(filtros.periodoInicio + "T00:00:00.000Z");
    const dtFim = new Date(filtros.periodoFim + "T23:59:59.999Z");
    where.AND = [
      { dataInicio: { lte: dtFim } },
      { dataFim: { gte: dtIni } },
    ];
  } else if (filtros?.periodoInicio) {
    where.dataFim = { gte: new Date(filtros.periodoInicio + "T00:00:00.000Z") };
  } else if (filtros?.periodoFim) {
    where.dataInicio = { lte: new Date(filtros.periodoFim + "T23:59:59.999Z") };
  }

  return prisma.cobertura.findMany({
    where,
    include: {
      posto: {
        include: {
          imovel: true,
          unidade: true,
          itemPpu: true,
        },
      },
      posicao: true,
      profissionalSubstituto: true,
      itemPpu: true,
      ocorrencia: {
        include: {
          profissional: true,
        },
      },
    },
    orderBy: { dataInicio: "desc" },
  });
}

export async function obterCoberturaPorId(id: string) {
  return prisma.cobertura.findFirst({
    where: { id, deletedAt: null },
    include: {
      posto: {
        include: {
          imovel: true,
          unidade: true,
          itemPpu: true,
        },
      },
      posicao: true,
      profissionalSubstituto: true,
      itemPpu: true,
      ocorrencia: {
        include: {
          profissional: true,
        },
      },
    },
  });
}

export interface DadosCriarCobertura {
  id?: string;
  postoId?: string;
  postoCodigo?: string;
  postoIdSgp?: string;
  posicaoId?: string;
  posicaoIdSgp?: string;
  ocorrenciaId?: string;
  profissionalSubstitutoId?: string;
  substitutoMatricula?: string;
  dataInicio: string;
  dataFim: string;
  tipoCobertura?: TipoCobertura | string;
  status?: StatusCobertura | string;
  justificativa?: string;
  documentoReferencia?: string;
  itemPpuCodigo?: string;
}

export async function criarCobertura(dados: DadosCriarCobertura, usuarioSessao: string) {
  garantirPeriodoNaoCongelado(dados.dataInicio, dados.dataFim, "criar cobertura");

  // Resolver Posto
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
    if (!p) throw new Error(`Posto não encontrado: ${dados.postoCodigo || dados.postoIdSgp}`);
    postoId = p.id;
  }
  if (!postoId) throw new Error("Identificação do posto é obrigatória.");

  // Resolver Substituto
  let profSubstitutoId = dados.profissionalSubstitutoId;
  if (!profSubstitutoId && dados.substitutoMatricula) {
    const prof = await prisma.profissional.findUnique({
      where: { matricula: dados.substitutoMatricula },
    });
    if (!prof) throw new Error(`Profissional substituto com matrícula ${dados.substitutoMatricula} não encontrado.`);
    profSubstitutoId = prof.id;
  }
  if (!profSubstitutoId) throw new Error("Profissional substituto é obrigatório.");

  // Resolver Posição (opcional)
  let posicaoId = dados.posicaoId;
  if (!posicaoId && dados.posicaoIdSgp) {
    const pos = await prisma.posicaoPosto.findUnique({
      where: { posicaoIdSgp: dados.posicaoIdSgp },
    });
    if (pos) posicaoId = pos.id;
  }

  // Normalizar enums
  const tipoCobertura = (dados.tipoCobertura as TipoCobertura) || TipoCobertura.SUBSTITUICAO_INTERNA;
  const status = (dados.status as StatusCobertura) || StatusCobertura.CONFIRMADA;

  return prisma.cobertura.create({
    data: {
      ...(dados.id ? { id: dados.id } : {}),
      postoId,
      posicaoId: posicaoId || null,
      ocorrenciaId: dados.ocorrenciaId || null,
      profissionalSubstitutoId: profSubstitutoId,
      dataInicio: new Date(dados.dataInicio + "T00:00:00.000Z"),
      dataFim: new Date(dados.dataFim + "T23:59:59.000Z"),
      tipoCobertura,
      status,
      justificativa: dados.justificativa || null,
      documentoReferencia: dados.documentoReferencia || null,
      itemPpuCodigo: dados.itemPpuCodigo || null,
      criadoPor: usuarioSessao,
      atualizadoPor: usuarioSessao,
    },
    include: {
      posto: true,
      profissionalSubstituto: true,
    },
  });
}

export interface DadosAtualizarCobertura {
  dataInicio?: string;
  dataFim?: string;
  posicaoId?: string;
  posicaoIdSgp?: string;
  profissionalSubstitutoId?: string;
  substitutoMatricula?: string;
  tipoCobertura?: TipoCobertura | string;
  status?: StatusCobertura | string;
  justificativa?: string;
  documentoReferencia?: string;
  itemPpuCodigo?: string;
}

export async function atualizarCobertura(id: string, dados: DadosAtualizarCobertura, usuarioSessao: string) {
  const existente = await prisma.cobertura.findUnique({ where: { id } });
  if (!existente || existente.deletedAt) {
    throw new Error(`Cobertura ${id} não encontrada ou já excluída.`);
  }

  const dataIniStr = dados.dataInicio || existente.dataInicio.toISOString().slice(0, 10);
  const dataFimStr = dados.dataFim || existente.dataFim.toISOString().slice(0, 10);
  garantirPeriodoNaoCongelado(dataIniStr, dataFimStr, "alterar cobertura");

  let profSubstitutoId = dados.profissionalSubstitutoId;
  if (!profSubstitutoId && dados.substitutoMatricula) {
    const prof = await prisma.profissional.findUnique({
      where: { matricula: dados.substitutoMatricula },
    });
    if (prof) profSubstitutoId = prof.id;
  }

  let posicaoId = dados.posicaoId;
  if (!posicaoId && dados.posicaoIdSgp) {
    const pos = await prisma.posicaoPosto.findUnique({
      where: { posicaoIdSgp: dados.posicaoIdSgp },
    });
    if (pos) posicaoId = pos.id;
  }

  return prisma.cobertura.update({
    where: { id },
    data: {
      dataInicio: dados.dataInicio ? new Date(dados.dataInicio + "T00:00:00.000Z") : undefined,
      dataFim: dados.dataFim ? new Date(dados.dataFim + "T23:59:59.000Z") : undefined,
      posicaoId: posicaoId !== undefined ? posicaoId : undefined,
      profissionalSubstitutoId: profSubstitutoId !== undefined ? profSubstitutoId : undefined,
      tipoCobertura: dados.tipoCobertura ? (dados.tipoCobertura as TipoCobertura) : undefined,
      status: dados.status ? (dados.status as StatusCobertura) : undefined,
      justificativa: dados.justificativa !== undefined ? dados.justificativa : undefined,
      documentoReferencia: dados.documentoReferencia !== undefined ? dados.documentoReferencia : undefined,
      itemPpuCodigo: dados.itemPpuCodigo !== undefined ? dados.itemPpuCodigo : undefined,
      atualizadoEm: new Date(),
      atualizadoPor: usuarioSessao,
    },
    include: {
      posto: true,
      profissionalSubstituto: true,
    },
  });
}

export async function excluirCobertura(id: string, usuarioSessao: string) {
  const existente = await prisma.cobertura.findUnique({ where: { id } });
  if (!existente || existente.deletedAt) {
    throw new Error(`Cobertura ${id} não encontrada ou já excluída.`);
  }

  const dataIniStr = existente.dataInicio.toISOString().slice(0, 10);
  const dataFimStr = existente.dataFim.toISOString().slice(0, 10);
  garantirPeriodoNaoCongelado(dataIniStr, dataFimStr, "excluir cobertura");

  // Exclusão LÓGICA estrita (nunca apagar a linha)
  return prisma.cobertura.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      atualizadoEm: new Date(),
      atualizadoPor: usuarioSessao,
    },
  });
}
