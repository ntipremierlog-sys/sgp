/**
 * SGP — Sistema de Gestão de Postos
 * Repositório: Estrutura Contratual (Imóveis, Unidades, Postos, Posições e Feristas)
 */

import prisma from "@/lib/prisma";

export async function obterImoveis() {
  return prisma.imovel.findMany({
    orderBy: { nome: "asc" },
    include: {
      _count: {
        select: { postos: true },
      },
    },
  });
}

export async function obterUnidades() {
  return prisma.unidade.findMany({
    orderBy: { nome: "asc" },
  });
}

export async function obterRegimesPosto() {
  return prisma.regimePosto.findMany({
    orderBy: { codigo: "asc" },
  });
}

export interface FiltrosPostos {
  imovelId?: string;
  imovelNome?: string;
  unidadeId?: string;
  situacao?: "ATIVO" | "SUSPENSO" | "ENCERRADO";
}

export async function obterPostos(filtros?: FiltrosPostos) {
  const where: any = {};
  if (filtros?.situacao) where.situacao = filtros.situacao;
  if (filtros?.imovelId) where.imovelId = filtros.imovelId;
  if (filtros?.unidadeId) where.unidadeId = filtros.unidadeId;
  if (filtros?.imovelNome) {
    where.imovel = { nome: filtros.imovelNome };
  }

  return prisma.posto.findMany({
    where,
    include: {
      imovel: true,
      unidade: true,
      itemPpu: true,
      regimePosto: true,
      posicoes: {
        orderBy: { sufixo: "asc" },
      },
      feristas: true,
    },
    orderBy: { codigoPosto: "asc" },
  });
}

export interface FiltrosPosicoes {
  postoId?: string;
  postoIdSgp?: string;
  imovelNome?: string;
}

export async function obterPosicoes(filtros?: FiltrosPosicoes) {
  const where: any = {};
  if (filtros?.postoId) where.postoId = filtros.postoId;
  if (filtros?.postoIdSgp) where.posto = { postoIdSgp: filtros.postoIdSgp };
  if (filtros?.imovelNome) {
    where.posto = {
      ...where.posto,
      imovel: { nome: filtros.imovelNome },
    };
  }

  return prisma.posicaoPosto.findMany({
    where,
    include: {
      posto: {
        include: {
          imovel: true,
          unidade: true,
          itemPpu: true,
        },
      },
    },
    orderBy: { posicaoIdSgp: "asc" },
  });
}

export async function obterFeristas(filtros?: { postoId?: string; postoIdSgp?: string }) {
  const where: any = { ativo: true };
  if (filtros?.postoId) where.postoId = filtros.postoId;
  if (filtros?.postoIdSgp) where.posto = { postoIdSgp: filtros.postoIdSgp };

  return prisma.feristaPosto.findMany({
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
    orderBy: { chapa: "asc" },
  });
}

export interface DadosAtualizacaoEscalaPosicao {
  dataBaseEscala?: string | Date | null;
  grupoRevezamento?: string | null;
  faseCiclo?: string | null;
  fonteEscala?: string | null;
  statusProgramacao?: string | null;
}

export async function atualizarEscalaPosicao(
  posicaoIdSgp: string,
  dados: DadosAtualizacaoEscalaPosicao,
  _usuarioSessao?: string
) {
  let dataBase: Date | null = null;
  if (dados.dataBaseEscala) {
    dataBase = typeof dados.dataBaseEscala === "string" ? new Date(dados.dataBaseEscala) : dados.dataBaseEscala;
  }

  return prisma.posicaoPosto.update({
    where: { posicaoIdSgp },
    data: {
      dataBaseEscala: dataBase,
      grupoRevezamento: dados.grupoRevezamento !== undefined ? dados.grupoRevezamento : undefined,
      faseCiclo: dados.faseCiclo !== undefined ? dados.faseCiclo : undefined,
      fonteEscala: dados.fonteEscala !== undefined ? dados.fonteEscala : undefined,
      statusProgramacao: dados.statusProgramacao !== undefined ? dados.statusProgramacao : undefined,
    },
  });
}
