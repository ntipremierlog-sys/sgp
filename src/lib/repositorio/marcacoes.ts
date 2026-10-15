/**
 * SGP — Sistema de Gestão de Postos
 * Repositório: Marcações de Ponto Eletrônico (REP)
 *
 * Regras estritas:
 * - As 38.901 marcações NUNCA são enviadas inteiras para o navegador.
 * - A API deve devolver apenas as marcações do período e das unidades solicitadas.
 * - Utiliza os índices idx_marcacao_chapa_data e idx_marcacao_data_local no PostgreSQL.
 */

import prisma from "@/lib/prisma";

export interface FiltrosMarcacoesPonto {
  dataInicio: string; // "YYYY-MM-DD"
  dataFim: string;   // "YYYY-MM-DD"
  chapas?: string[];
  chapa?: string;
  unidadeNome?: string;
  limite?: number;
}

export async function obterMarcacoesPonto(filtros: FiltrosMarcacoesPonto) {
  const where: any = {
    dataLocal: {
      gte: filtros.dataInicio,
      lte: filtros.dataFim,
    },
  };

  if (filtros.chapa) {
    where.chapa = filtros.chapa;
  } else if (filtros.chapas && filtros.chapas.length > 0) {
    where.chapa = { in: filtros.chapas };
  }

  if (filtros.unidadeNome) {
    where.equipamentoOrigem = { contains: filtros.unidadeNome, mode: "insensitive" };
  }

  return prisma.marcacaoPonto.findMany({
    where,
    orderBy: [
      { dataLocal: "asc" },
      { horaLocal: "asc" },
    ],
    take: filtros.limite || 10000,
  });
}
