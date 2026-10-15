/**
 * SGP — Sistema de Gestão de Postos
 * Camada de Validações Contratuais e Governança no Servidor
 */

import { obterCompetenciaCongeladaNoPeriodo } from "@/lib/dados/estado-operacional";

export class PeriodoCongeladoError extends Error {
  public readonly codigo = "PERIODO_CONGELADO";
  public readonly statusCode = 422;
  public readonly competencia: string;

  constructor(competencia: string, acao: string) {
    const [a, m] = competencia.split("-");
    super(
      `BLOQUEIO DE COMPETÊNCIA CONGELADA: a competência ${m}/${a} está congelada (snapshot imutável). Não é possível ${acao}. Solicite a reabertura ao Administrador na tela de Fechamento Mensal.`
    );
    this.name = "PeriodoCongeladoError";
    this.competencia = competencia;
  }
}

/**
 * Garante que a data ou período informado não pertence a uma competência congelada (fechada).
 * Se pertencer, lança exceção com código 422 / bloqueio formal.
 */
export function garantirPeriodoNaoCongelado(
  dataInicio?: string,
  dataFim?: string,
  acao: string = "realizar esta operação"
): void {
  const comp = obterCompetenciaCongeladaNoPeriodo(dataInicio, dataFim);
  if (comp) {
    throw new PeriodoCongeladoError(comp, acao);
  }
}
