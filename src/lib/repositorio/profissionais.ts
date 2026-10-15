/**
 * SGP — Sistema de Gestão de Postos
 * Repositório: Profissionais e Alocações
 */

import prisma from "@/lib/prisma";

export interface FiltrosProfissionais {
  unidadeId?: string;
  matricula?: string;
  situacao?: "ATIVO" | "AFASTADO" | "FERIAS" | "DESLIGADO";
}

export async function obterProfissionais(filtros?: FiltrosProfissionais) {
  const where: any = {};
  if (filtros?.unidadeId) where.unidadeId = filtros.unidadeId;
  if (filtros?.matricula) where.matricula = filtros.matricula;
  if (filtros?.situacao) where.situacao = filtros.situacao;

  return prisma.profissional.findMany({
    where,
    include: {
      unidade: true,
    },
    orderBy: { nome: "asc" },
  });
}

export async function obterProfissionalPorMatricula(matricula: string) {
  return prisma.profissional.findUnique({
    where: { matricula },
    include: {
      unidade: true,
    },
  });
}

export interface FiltrosAlocacoes {
  postoId?: string;
  postoIdSgp?: string;
  profissionalId?: string;
  matricula?: string;
}

export async function obterAlocacoes(filtros?: FiltrosAlocacoes) {
  const where: any = { deletedAt: null };
  if (filtros?.postoId) where.postoId = filtros.postoId;
  if (filtros?.postoIdSgp) where.posto = { postoIdSgp: filtros.postoIdSgp };
  if (filtros?.profissionalId) where.profissionalId = filtros.profissionalId;
  if (filtros?.matricula) where.profissional = { matricula: filtros.matricula };

  return prisma.alocacao.findMany({
    where,
    include: {
      posto: {
        include: {
          imovel: true,
          unidade: true,
        },
      },
      profissional: true,
    },
    orderBy: { dataInicio: "asc" },
  });
}
