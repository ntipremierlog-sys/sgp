/**
 * SGP — Sistema de Gestão de Postos (Contrato Petrobras SAP 4600682336)
 * Camada de Modelo de Dados Estrutural Oficial: UNIDADE → POSTO → POSIÇÃO → COLABORADOR
 * Fonte oficial: Base_Estruturada_SGP_Petrobras_REV02.xlsx
 *
 * Não implementa nada de faturamento ou medição de valores.
 */

import postosRev02Json from "./postos-rev02.json";
import posicoesRev02Json from "./posicoes-rev02.json";
import posicoesExcedentesRev02Json from "./posicoes-excedentes-rev02.json";
import alocacoesRev02Json from "./alocacoes-rev02.json";
import pendentesRmRev02Json from "./pendentes-rm-rev02.json";
import validacoesRev02Json from "./validacoes-rev02.json";
import registroCargaRev02Json from "./registro-carga-rev02.json";
import relatorioInconsistenciasJson from "./relatorio-inconsistencias-mc.json";
import postosRev04Json from "./postos-rev04.json";
import posicoesRev04Json from "./posicoes-rev04.json";
import alocacoesRev04Json from "./alocacoes-rev04.json";
import unidadesRev04Json from "./unidades-rev04.json";
import postosMcReaisJson from "./postos-mc-reais.json";
import vagasMcReaisJson from "./vagas-mc-reais.json";
import alocacoesMcReaisJson from "./alocacoes-mc-reais.json";
import feristasRev04Json from "./feristas-rev04.json";
import escalasRev04Json from "./escalas-rev04.json";
import pendenciasEscalaRev04Json from "./pendencias-escala-rev04.json";
import relatorioImportacaoRev04Json from "./relatorio-importacao-rev04.json";

// =============================================================================
// PASSO 1 — REGRAS ESTRUTURAIS (aba 06_REGRAS_ESTRUTURA)
// =============================================================================

export type TipoPostoId =
  | "ADM_09H"
  | "ADM_12H"
  | "ADM_16H"
  | "TURNO_12H"
  | "TURNO_16H"
  | "TURNO_24H";

export type StatusPremissaEstrutural = "fechada" | "a confirmar";

export interface TipoPosto {
  /** Identificador único do tipo de posto */
  id: TipoPostoId;
  /** Nome contratual do tipo de posto */
  nome: string;
  /** Número de vagas/posições oficiais por posto */
  vagas: number;
  /** Quantidade de posições estruturais conforme regra do Passo 1 */
  posicoesPorPosto: number;
  /** Status da premissa da regra (fechada / a confirmar) */
  statusPremissa: StatusPremissaEstrutural;
  /** Regra oficial de cadastro (ex.: "1 posto = 1 posição") */
  regraCadastro: string;
  /** Observações operacionais da premissa */
  observacao: string;
  /** Descrição detalhada do regime */
  descricao: string;
  /** Escala padrão associada */
  escalaPadrao: "5x2" | "12x36" | "6x1" | "4x4" | "4x2";
  /** Carga horária padrão */
  jornadaHoras: number;
  /** Exceções mapeadas por postoId ou unidade (ex.: Cabiúnas = 4 posições) */
  excecoesPorPosto?: Record<string, number>;
}

// =============================================================================
// PASSO 1 — REGRA ESTRUTURAL PARAMETRIZADA: TABELA "REGIME_POSTO"
// Regra: Adm/09h = 1 | Adm/12h = 2 | Turno/12h = 2 | Adm/16h = 2 | Turno/16h = 3 | Turno/24h = 4
// Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.
// =============================================================================

export interface RegimePostoParametro {
  codigo: TipoPostoId | string;
  nome: string;
  quantidadePosicoes: number;
  regraCadastro: string;
  observacao: string;
  escalaPadrao: string;
  jornadaHoras: number;
  statusPremissa: "fechada";
}

export const REGIME_POSTO_TABELA: Record<string, RegimePostoParametro> = {
  ADM_09H: {
    codigo: "ADM_09H",
    nome: "Adm/09h",
    quantidadePosicoes: 1,
    regraCadastro: "1 posto = 1 posição",
    observacao: "Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    escalaPadrao: "5x2",
    jornadaHoras: 44,
    statusPremissa: "fechada",
  },
  ADM_12H: {
    codigo: "ADM_12H",
    nome: "Adm/12h",
    quantidadePosicoes: 2,
    regraCadastro: "1 posto = 2 posições",
    observacao: "Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    escalaPadrao: "5x2",
    jornadaHoras: 40,
    statusPremissa: "fechada",
  },
  TURNO_12H: {
    codigo: "TURNO_12H",
    nome: "Turno/12h",
    quantidadePosicoes: 2,
    regraCadastro: "1 posto = 2 posições",
    observacao: "Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    escalaPadrao: "12x36",
    jornadaHoras: 36,
    statusPremissa: "fechada",
  },
  ADM_16H: {
    codigo: "ADM_16H",
    nome: "Adm/16h",
    quantidadePosicoes: 2,
    regraCadastro: "1 posto = 2 posições",
    observacao: "Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    escalaPadrao: "5x2",
    jornadaHoras: 40,
    statusPremissa: "fechada",
  },
  TURNO_16H: {
    codigo: "TURNO_16H",
    nome: "Turno/16h",
    quantidadePosicoes: 3,
    regraCadastro: "1 posto = 3 posições",
    observacao: "Regra estrutural: 3 posições por posto. Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    escalaPadrao: "4x2",
    jornadaHoras: 40,
    statusPremissa: "fechada",
  },
  TURNO_24H: {
    codigo: "TURNO_24H",
    nome: "Turno/24h",
    quantidadePosicoes: 4,
    regraCadastro: "1 posto = 4 posições",
    observacao: "Regra estrutural: 4 posições por posto. Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    escalaPadrao: "12x36",
    jornadaHoras: 36,
    statusPremissa: "fechada",
  },
};

export const LISTA_REGIMES_POSTO: RegimePostoParametro[] = Object.values(REGIME_POSTO_TABELA);

/**
 * Catálogo TipoPosto oficial alinhado com a tabela regime_posto (Passo 1):
 * - Adm/09h: 1 posição
 * - Adm/12h: 2 posições
 * - Turno/12h: 2 posições
 * - Adm/16h: 2 posições
 * - Turno/16h: 3 posições (regra estrutural fixada)
 * - Turno/24h: 4 posições
 */
export const TIPOS_POSTO_CATALOGO: Record<TipoPostoId, TipoPosto> = {
  ADM_09H: {
    id: "ADM_09H",
    nome: "Adm/09h",
    vagas: 1,
    posicoesPorPosto: 1,
    statusPremissa: "fechada",
    regraCadastro: "1 posto = 1 posição",
    observacao: "Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    descricao: "Administrativo 09 horas diárias — 1 posição por posto",
    escalaPadrao: "5x2",
    jornadaHoras: 44,
  },
  ADM_12H: {
    id: "ADM_12H",
    nome: "Adm/12h",
    vagas: 2,
    posicoesPorPosto: 2,
    statusPremissa: "fechada",
    regraCadastro: "1 posto = 2 posições",
    observacao: "Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    descricao: "Administrativo 12 horas diárias — 2 posições por posto",
    escalaPadrao: "5x2",
    jornadaHoras: 40,
  },
  TURNO_12H: {
    id: "TURNO_12H",
    nome: "Turno/12h",
    vagas: 2,
    posicoesPorPosto: 2,
    statusPremissa: "fechada",
    regraCadastro: "1 posto = 2 posições",
    observacao: "Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    descricao: "Turno contínuo 12 horas — 2 posições por posto",
    escalaPadrao: "12x36",
    jornadaHoras: 36,
  },
  ADM_16H: {
    id: "ADM_16H",
    nome: "Adm/16h",
    vagas: 2,
    posicoesPorPosto: 2,
    statusPremissa: "fechada",
    regraCadastro: "1 posto = 2 posições",
    observacao: "Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    descricao: "Administrativo 16 horas diárias — 2 posições por posto",
    escalaPadrao: "5x2",
    jornadaHoras: 40,
  },
  TURNO_16H: {
    id: "TURNO_16H",
    nome: "Turno/16h",
    vagas: 3,
    posicoesPorPosto: 3,
    statusPremissa: "fechada",
    regraCadastro: "1 posto = 3 posições",
    observacao: "Regra estrutural: 3 posições por posto. Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    descricao: "Turno 16 horas — 3 posições por posto",
    escalaPadrao: "4x2",
    jornadaHoras: 40,
  },
  TURNO_24H: {
    id: "TURNO_24H",
    nome: "Turno/24h",
    vagas: 4,
    posicoesPorPosto: 4,
    statusPremissa: "fechada",
    regraCadastro: "1 posto = 4 posições",
    observacao: "Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.",
    descricao: "Turno ininterrupto 24 horas — 4 posições por posto",
    escalaPadrao: "12x36",
    jornadaHoras: 36,
  },
};

export const LISTA_TIPOS_POSTO: TipoPosto[] = Object.values(TIPOS_POSTO_CATALOGO);

/**
 * Retorna a quantidade de posições estruturais esperadas para um posto, pelo seu regime (Passo 1)
 */
export function obterQtdPosicoesEsperadas(
  tipoIdOuNome: string,
  _postoIdSGP?: string,
  _unidade?: string
): number {
  const busca = String(tipoIdOuNome || "").trim().toUpperCase();
  if (REGIME_POSTO_TABELA[busca]) {
    return REGIME_POSTO_TABELA[busca].quantidadePosicoes;
  }
  const tipo = obterTipoPosto(tipoIdOuNome);
  return tipo ? tipo.posicoesPorPosto : 1;
}

/**
 * Passo 1 — Valida a criação de posição estrutural no posto.
 * O sistema deve bloquear a criação de posição acima da quantidade estrutural, com mensagem clara.
 */
export function validarCriacaoPosicao(
  posto: { tipoPostoId: string; postoIdSGP?: string; idReferencia?: any; funcao?: string },
  posicoesAtuais: number | Array<{ sufixo?: number; posicaoIdSGP?: string; codigoVisual?: string }>
): { permitido: boolean; limiteMaximo: number; mensagem?: string } {
  const tipo = obterTipoPosto(posto.tipoPostoId);
  const limiteMaximo = tipo ? tipo.posicoesPorPosto : 1;
  const qtdAtual = typeof posicoesAtuais === "number" ? posicoesAtuais : posicoesAtuais.length;

  if (qtdAtual >= limiteMaximo) {
    const nomeRegime = tipo?.nome || posto.tipoPostoId;
    const proximaPosicao = qtdAtual + 1;
    const refPosto = posto.postoIdSGP || (posto.idReferencia ? `Posto ${posto.idReferencia}` : "Posto");
    return {
      permitido: false,
      limiteMaximo,
      mensagem: `Bloqueio estrutural: Não é permitido criar a ${proximaPosicao}ª posição no posto '${refPosto}': o regime ${nomeRegime} permite no máximo ${limiteMaximo} posições estruturais. Ferista, substituto, férias, afastamento ou troca de pessoa NUNCA criam posição.`,
    };
  }

  return { permitido: true, limiteMaximo };
}

/**
 * Passo 1 — Cria uma nova posição estrutural garantindo conformidade com a regra do regime.
 * Lança erro explícito se atingido o limite estrutural (ex.: 4ª posição em Turno/16h).
 */
export function criarPosicaoPosto(
  posto: { tipoPostoId: string; postoIdSGP: string; idReferencia?: any },
  posicoesExistentes: PosicaoEstrutural[],
  dadosNovaPosicao?: Partial<PosicaoEstrutural>
): PosicaoEstrutural {
  const posicoesDoPosto = posicoesExistentes.filter((p) => p.postoIdSGP === posto.postoIdSGP);
  const validacao = validarCriacaoPosicao(posto, posicoesDoPosto);

  if (!validacao.permitido) {
    throw new Error(validacao.mensagem);
  }

  const novoSufixo = posicoesDoPosto.length + 1;
  const ref = posto.idReferencia || posto.postoIdSGP;
  const posicaoIdSGP = `${posto.postoIdSGP}-${String(novoSufixo).padStart(2, "0")}`;

  return {
    posicaoIdSGP,
    postoIdSGP: posto.postoIdSGP,
    postoBase: ref,
    codigoVisual: `${ref}.${novoSufixo}`,
    idOriginalMC: `${ref}.${novoSufixo}`,
    sufixo: novoSufixo,
    conflitoCadastro: "OK",
    tratamentoSGP: "POSIÇÃO ESTRUTURAL",
    observacoes: "Criada conforme limite do regime estrutural.",
    statusValidacao: "VALIDADA",
    ehEstrutural: true,
    ...dadosNovaPosicao,
  };
}

export function obterTipoPosto(idOuNome?: string): TipoPosto | undefined {
  if (!idOuNome) return undefined;
  const busca = idOuNome.trim().toUpperCase();

  if (TIPOS_POSTO_CATALOGO[busca as TipoPostoId]) {
    return TIPOS_POSTO_CATALOGO[busca as TipoPostoId];
  }

  return LISTA_TIPOS_POSTO.find(
    (tp) => tp.nome.toUpperCase() === busca || tp.id.toUpperCase() === busca
  );
}

export function identificarTipoPostoPorTexto(descricao?: string, divisorFormula?: number): TipoPosto {
  const d = String(descricao || "").trim();
  if (d.includes("Turno/24h")) return TIPOS_POSTO_CATALOGO.TURNO_24H;
  if (d.includes("Turno/16h")) return TIPOS_POSTO_CATALOGO.TURNO_16H;
  if (d.includes("Turno/12h")) return TIPOS_POSTO_CATALOGO.TURNO_12H;
  if (d.includes("Adm/16h")) return TIPOS_POSTO_CATALOGO.ADM_16H;
  if (d.includes("Adm/12h")) return TIPOS_POSTO_CATALOGO.ADM_12H;
  if (d.includes("Adm/09h")) return TIPOS_POSTO_CATALOGO.ADM_09H;

  if (divisorFormula === 4) return TIPOS_POSTO_CATALOGO.TURNO_24H;
  if (divisorFormula === 3) return TIPOS_POSTO_CATALOGO.TURNO_16H;
  if (divisorFormula === 2) return TIPOS_POSTO_CATALOGO.TURNO_12H;
  return TIPOS_POSTO_CATALOGO.ADM_09H;
}

// =============================================================================
// PASSO 2 — POSTOS (aba 02_POSTOS)
// =============================================================================

export interface PostoEstrutural {
  /** Chave técnica fixa e imutável (ex.: "PST-BOAVENTURA-007") */
  postoIdSGP: string;
  /** Código visual usado pela equipe (Posto_Base, ex.: 7), SEM ser chave */
  idReferencia: number | string;
  /** Unidade operacional (ex.: "BOAVENTURA", "UFN-III") */
  unidade: string;
  /** Item da Planilha de Preços Unitários (apenas identificação, sem valor, ex.: "3.6") */
  itemPPU: string;
  /** Descrição do Posto de Serviço contratual */
  postoDeServico: string;
  /** Nomenclatura sugerida de identificação */
  nomenclaturaSugerida: string;
  /** Município */
  municipio: string;
  /** Gerência Petrobras */
  gerencia: string;
  /** Adicional de periculosidade (SIM / NÃO) */
  periculosidade: "SIM" | "NÃO";
  /** Tipo de posto ID */
  tipoPostoId: TipoPostoId | string;
  /** Tipo de posto nome legível */
  tipoPostoNome: string;
  /** Quantidade estrutural esperada pela regra */
  qtdEstruturalPremissa: number;
  /** Quantidade de posições/IDs observados na MC */
  qtdPosicoesIDObservadas: number;
  /** Quantidade de alocações na MC */
  qtdAlocacoesMC: number;
  /** Status da estrutura do posto (ex.: "COERENTE COM A REGRA", "REVISAR MAPEAMENTO") */
  statusEstrutura: string;
  /** Observações estruturais */
  observacaoEstrutura: string;
}

// =============================================================================
// PASSO 3 — POSIÇÕES (aba 03_POSICOES)
// =============================================================================

export interface PosicaoEstrutural {
  /** Chave técnica fixa e imutável (ex.: "POS-BOAVENTURA-007-01") — nunca multiplicada por troca de pessoa */
  posicaoIdSGP: string;
  /** Chave técnica do Posto pai (ex.: "PST-BOAVENTURA-007") */
  postoIdSGP: string;
  /** Código numérico base do posto para fins visuais */
  postoBase?: number | string;
  /** Código visual usado pela equipe (ex.: "7.1") */
  codigoVisual: string;
  /** Passo 3: ID original da MC (numeração do Luiz, ex.: "7.1") — rastreabilidade, NUNCA chave */
  idOriginalMC?: string;
  /** Sufixo numérico ordinal da posição (1, 2, 3, 4) */
  sufixo: number;
  /** Conflito no cadastro ("OK" ou "REVISAR") */
  conflitoCadastro: string;
  /** Motivo do conflito se houver */
  motivoConflito?: string;
  /** Tratamento definido pelo SGP */
  tratamentoSGP: string;
  /** Observações de revisão estrutural */
  observacoes: string;
  /** Status de validação ("VALIDADA" ou "A VALIDAR") */
  statusValidacao: "VALIDADA" | "A VALIDAR";
  /** Indica se é posição estrutural autorizada pela regra do posto */
  ehEstrutural: boolean;

  // ===========================================================================
  // Passo 4 — Escala da posição: conferir se existem; criar os que faltarem:
  // horario_rm, escala_tipo, faixa_horaria, regime_dias, grupo_revezamento,
  // data_base_escala, fase_ciclo, fonte_escala, status_programacao.
  // Grupo, fase e data-base NUNCA são preenchidos por inferência. Vazio permanece vazio.
  // ===========================================================================
  horario_rm?: string;
  horarioRm?: string;
  escala_tipo?: string;
  escalaTipo?: string;
  faixa_horaria?: string;
  faixaHoraria?: string;
  regime_dias?: string;
  regimeDias?: string;
  /** Grupo de revezamento — NUNCA inferido. Vazio permanece vazio. */
  grupo_revezamento?: string;
  grupoRevezamento?: string;
  /** Data-base da escala — NUNCA inferido. Vazio permanece vazio. */
  data_base_escala?: string;
  dataBaseEscala?: string;
  /** Fase do ciclo — NUNCA inferido. Vazio permanece vazio. */
  fase_ciclo?: string;
  faseCiclo?: string;
  fonte_escala?: string;
  fonteEscala?: string;
  status_programacao?: string;
  statusProgramacao?: string;

  // Titular da posição (03_POSICOES)
  titularReferencia?: string;
  chapaTitular?: string;
  statusRMTitular?: string;
  posicaoSemTitularMC?: string;
}

export interface FeristaItemREV04 {
  feristaIdSGP: string;
  unidade: string;
  postoBase?: number | string;
  postoIdSGP: string;
  idLuizOriginal?: string;
  idReferenciaPosto?: string | number;
  tipoPosto?: string;
  funcao?: string;
  modalidadeContratual?: string;
  colaborador: string;
  chapaRM?: string;
  statusRM?: string;
  funcaoRM?: string;
  horarioRM?: string;
  postoDeServico?: string;
  papel: string;
  comentarioMC?: string;
}

export interface EscalaPosicaoEstrutural {
  escalaIdSGP: string;
  posicaoIdSGP: string;
  postoIdSGP: string;
  unidade: string;
  postoBase?: number | string;
  codigoPosicaoEstrutural: string;
  titularReferencia?: string;
  chapaTitular?: string;
  horarioRMInformado?: string;
  escalaTipoInformada?: string;
  faixaHorariaInformada?: string;
  regimeDiasInformado?: string;
  fonteEscala?: string;
  statusProgramacaoDiaria?: string;
  observacaoEscala?: string;
}

export interface PendenciaEscalaItem {
  id: string;
  prioridade: string;
  unidade: string;
  postoBase?: number | string;
  posicao: string;
  titular: string;
  horarioRM: string;
  escalaInformada: string;
  dadoFaltante: string;
  acao: string;
  status: string;
  tipo?: string;
  descricao?: string;
}

export interface LinhaRejeitadaImportacao {
  aba?: string;
  linhaExcel: number;
  conteudo: any;
  motivo: string;
}

export interface ValidacaoAutomaticaItem {
  tipo: string;
  posicaoIdSGP?: string;
  postoIdSGP?: string;
  titular?: string;
  horario?: string;
  colaborador?: string;
  chapa?: string;
  postoDeServico?: string;
  mensagem: string;
}

export interface RelatorioImportacaoREV04 {
  dataGeracao: string;
  planilhaFonte: string;
  totais: {
    totalPostos: number;
    totalPosicoes: number;
    totalFeristas: number;
    totalEscalas: number;
    totalPendenciasEscala: number;
    totalPendentesRM: number;
    totalValidacoesPlanilha: number;
    totalLinhasRejeitadasPosicoes: number;
  };
  linhasRejeitadas: LinhaRejeitadaImportacao[];
  validacoesAutomaticas: {
    titularSegSexEmTurno: ValidacaoAutomaticaItem[];
    posicaoSemTitular: ValidacaoAutomaticaItem[];
    posto9hUnicaPessoaFerista: ValidacaoAutomaticaItem[];
    postoSemRegimeIdentificavel: ValidacaoAutomaticaItem[];
    colaboradorMcNaoLocalizadoRM: ValidacaoAutomaticaItem[];
  };
}

// Compatibilidade de interface para VagaPosto
export interface VagaPosto {
  id: string;
  idPosto: string;
  postoIdSGP?: string;
  posicaoIdSGP?: string;
  postoBase?: number | string;
  sequencia: number;
  dataBaseCiclo?: string;
  diaFolgaSemanal?: number;
  criadaEm?: string;
  etiqueta?: string;
  /** Passo 3: ID original da MC (numeração do Luiz) — apenas rastreabilidade */
  idOriginalMC?: string;
  codigoVisual?: string;
  codigoPosicaoEstrutural?: string;
  ehVaga?: boolean;
  posicaoSemTitularMC?: string;
  titularReferencia?: string;
  chapaTitular?: string;
  statusValidacao?: string;
  conflitoCadastro?: string;
  status?: string;

  // Passo 4: Escala da posição
  regime?: string;
  tipoEscala?: string;
  horario?: string;
  horario_rm?: string;
  horarioRm?: string;
  escala_tipo?: string;
  escalaTipo?: string;
  faixa_horaria?: string;
  faixaHoraria?: string;
  regime_dias?: string;
  regimeDias?: string;
  /** Grupo de revezamento — NUNCA inferido. Vazio permanece vazio. */
  grupo_revezamento?: string;
  grupoRevezamento?: string;
  /** Data-base da escala — NUNCA inferido. Vazio permanece vazio. */
  data_base_escala?: string;
  dataBaseEscala?: string;
  /** Fase do ciclo — NUNCA inferido. Vazio permanece vazio. */
  fase_ciclo?: string;
  faseCiclo?: string;
  fonte_escala?: string;
  fonteEscala?: string;
  status_programacao?: string;
  statusProgramacao?: string;
}

// =============================================================================
// PASSO 2 — FERISTA (VÍNCULO N:N COM POSTOS, SEM POSIÇÃO PERMANENTE)
// =============================================================================

export interface FeristaPostoVinculo {
  id: string;
  matricula: string;
  nome: string;
  unidadeId: string;
  postoIdSGP: string;
  ativo: boolean;
  dataInicio: string;
  dataFim?: string | null;
  observacoes?: string;
}

/**
 * Passo 2: Registro de feristas vinculados à unidade e a um ou mais postos (vínculo N:N),
 * SEM posicao_id_sgp permanente.
 */
export const FERISTAS_VINCULADOS_POSTOS: FeristaPostoVinculo[] = [
  ...(feristasRev04Json as any[]).map((f) => ({
    id: f.feristaIdSGP,
    matricula: f.chapaRM || f.feristaIdSGP,
    nome: f.colaborador,
    unidadeId: f.unidade,
    postoIdSGP: f.postoIdSGP,
    ativo: true,
    dataInicio: "2026-08-10",
    observacoes: f.comentarioMC || `Ferista vinculado ao posto ${f.postoIdSGP}`,
  })),
  // Registro histórico preservado para rastreabilidade de cadastro
  {
    id: "FER-HIST-036606",
    matricula: "036606",
    nome: "WALLACE SOUSA DA SILVA",
    unidadeId: "BOAVENTURA",
    postoIdSGP: "PST-BOAVENTURA-008",
    ativo: true,
    dataInicio: "2025-05-08",
    observacoes: "Ferista vinculado a Boaventura. Atua por cobertura de ausências no posto 8.",
  },
];

/**
 * Retorna os feristas consolidados (mesmo colaborador com múltiplos postos = 1 ferista com N vínculos)
 */
export function obterFeristasConsolidados() {
  const feristasAgrupados = new Map<
    string,
    {
      colaborador: string;
      chapaRM: string;
      unidade: string;
      postosIdsSGP: string[];
      vinculos: FeristaItemREV04[];
    }
  >();
  for (const f of (feristasRev04Json as FeristaItemREV04[])) {
    const chave = f.chapaRM || f.colaborador;
    if (!feristasAgrupados.has(chave)) {
      feristasAgrupados.set(chave, {
        colaborador: f.colaborador,
        chapaRM: f.chapaRM || "",
        unidade: f.unidade,
        postosIdsSGP: [],
        vinculos: [],
      });
    }
    const item = feristasAgrupados.get(chave)!;
    item.postosIdsSGP.push(f.postoIdSGP);
    item.vinculos.push(f);
  }
  return Array.from(feristasAgrupados.values());
}

/**
 * Passo 2: Vincula um colaborador como ferista a um ou mais postos (vínculo N:N)
 */
export function vincularFeristaPostos(
  matricula: string,
  nome: string,
  unidadeId: string,
  postosIdsSGP: string[],
  dataInicio: string = new Date().toISOString().slice(0, 10)
): FeristaPostoVinculo[] {
  const novosVinculos: FeristaPostoVinculo[] = [];
  for (const postoIdSGP of postosIdsSGP) {
    const vinculoExistente = FERISTAS_VINCULADOS_POSTOS.find(
      (v) => v.matricula === matricula && v.postoIdSGP === postoIdSGP && v.ativo
    );
    if (!vinculoExistente) {
      const vinculo: FeristaPostoVinculo = {
        id: `FER-${matricula}-${postoIdSGP}`,
        matricula,
        nome,
        unidadeId,
        postoIdSGP,
        ativo: true,
        dataInicio,
      };
      FERISTAS_VINCULADOS_POSTOS.push(vinculo);
      novosVinculos.push(vinculo);
    }
  }
  return novosVinculos;
}

/**
 * Passo 2: Retorna os postos vinculados a um ferista (vínculo N:N)
 */
export function obterPostosDoFerista(matricula: string): string[] {
  return FERISTAS_VINCULADOS_POSTOS
    .filter((v) => v.matricula === matricula && v.ativo)
    .map((v) => v.postoIdSGP);
}

/**
 * Passo 2: Retorna os feristas vinculados a um determinado posto
 */
export function obterFeristasDoPosto(postoIdSGP: string): FeristaPostoVinculo[] {
  return FERISTAS_VINCULADOS_POSTOS.filter((v) => v.postoIdSGP === postoIdSGP && v.ativo);
}

// =============================================================================
// PASSO 3 — HISTÓRICO DE TITULAR POR POSIÇÃO (INÍCIO/FIM SEM SOBRESCREVER)
// =============================================================================

export interface HistoricoTitularPosicaoItem {
  id: string;
  posicaoIdSGP: string;
  matricula: string;
  nome: string;
  dataInicio: string;
  dataFim?: string | null;
  motivo?: string;
  observacoes?: string;
}

export const HISTORICO_TITULARES_POSICAO: HistoricoTitularPosicaoItem[] = [];

/**
 * Registra novo titular na posição preservando integralmente o histórico anterior
 */
export function registrarHistoricoTitular(
  posicaoIdSGP: string,
  matricula: string,
  nome: string,
  dataInicio: string,
  dataFim?: string | null,
  motivo?: string,
  observacoes?: string
): HistoricoTitularPosicaoItem {
  const item: HistoricoTitularPosicaoItem = {
    id: `HIST-${posicaoIdSGP}-${matricula}-${dataInicio}`,
    posicaoIdSGP,
    matricula,
    nome,
    dataInicio,
    dataFim,
    motivo,
    observacoes,
  };
  HISTORICO_TITULARES_POSICAO.push(item);
  return item;
}

/**
 * Retorna o histórico de titulares da posição ordenado por data de início
 */
export function obterHistoricoTitularesPosicao(posicaoIdSGP: string): HistoricoTitularPosicaoItem[] {
  return HISTORICO_TITULARES_POSICAO
    .filter((h) => h.posicaoIdSGP === posicaoIdSGP)
    .sort((a, b) => (a.dataInicio > b.dataInicio ? -1 : 1));
}

export function gerarVagasPosto(
  idPosto: string,
  tipoPostoOuId: TipoPosto | TipoPostoId | string
): VagaPosto[] {
  let tipo: TipoPosto | undefined;
  if (typeof tipoPostoOuId === "object" && tipoPostoOuId !== null) {
    tipo = tipoPostoOuId;
  } else {
    tipo = obterTipoPosto(tipoPostoOuId);
  }

  const vagasQtd = tipo ? tipo.vagas : 1;

  if (vagasQtd === 1) {
    return [
      {
        id: idPosto,
        idPosto,
        sequencia: 1,
      },
    ];
  }

  const vagas: VagaPosto[] = [];
  for (let s = 1; s <= vagasQtd; s++) {
    vagas.push({
      id: `${idPosto}.${s}`,
      idPosto,
      sequencia: s,
    });
  }
  return vagas;
}

// =============================================================================
// PASSO 4 — ALOCAÇÕES (aba 01_MAPA_CADASTRO)
// =============================================================================

export type TipoAlocacaoREV02 =
  | "TITULAR/REGULAR"
  | "FERISTA"
  | "SUBSTITUTO"
  | "COBERTURA EVENTUAL"
  | "HISTÓRICO";

export interface AlocacaoEstrutural {
  /** Chave técnica fixa e imutável (ex.: "ALOC-0012") */
  alocacaoIdSGP: string;
  /** Posição à qual o colaborador está vinculado (ex.: "POS-BOAVENTURA-007-01") */
  posicaoIdSGP: string;
  /** Posição original informada na planilha (para fins de conciliação) */
  posicaoOriginalPlanilha?: string;
  /** Chave do Posto */
  postoIdSGP: string;
  /** Matrícula / Chapa RM (6 dígitos normalizados) */
  chapaRM: string;
  /** Identificador Petrobras (coluna Identificador_MC) */
  identificadorPetrobras: string;
  /** Nome completo do colaborador */
  nome: string;
  /** Situação no RM (ex.: "Ativo", "Férias", "Afastado") */
  statusRM: string;
  /** Função registrada no RM */
  funcao: string;
  /** Horário / Escala vindo do RM */
  horarioRM: string;
  /** Unidade de lotação no RM */
  unidadeRM?: string;
  /** Confere unidade entre RM e MC */
  unidadeConfere?: string;
  /** Tipo de alocação (TITULAR/REGULAR, FERISTA, SUBSTITUTO, etc.) */
  tipoAlocacao: TipoAlocacaoREV02 | string;
  /** Inclusão sugerida no SGP */
  incluirNoSGP?: string;
  /** Disponibilidade de dias na MC */
  disponibilidadeDiasMC?: number;
  /** Dias de ausência apontados na MC */
  diasAusenciaMC?: number;
  /** Comentários da MC */
  comentarioMC?: string;
  /** Data de início da vigência da alocação */
  dataInicio: string;
  /** Data de término da vigência da alocação (nulo = alocação vigente) */
  dataFim: string | null;
  /** Status do mapeamento da posição */
  statusMapeamento?: string;
  /** Observações de revisão estrutural */
  observacaoRevisao?: string;
  /** Status de validação do cadastro ("OK" ou "A VALIDAR") */
  statusValidacao: "OK" | "A VALIDAR";
}

// Compatibilidade de interface para AlocacaoVaga
export type MotivoAlocacao = "titular" | "ferista" | "substituicao" | "sucessao";

export interface AlocacaoVaga {
  id: string;
  vagaId: string;
  posicaoIdSGP?: string;
  postoIdSGP?: string;
  matricula: string;
  identificadorPetrobras?: string;
  nome: string;
  dataInicio: string;
  dataFim?: string | null;
  horarioEscalaRm?: string;
  horarioRM?: string;
  tipoAlocacao?: string;
  dataBaseCiclo?: string;
  faseCiclo?: string;
  diaFolgaSemanal?: number;
  motivo: MotivoAlocacao;
  observacoes?: string;
  criadoEm?: string;
}

export function obterAlocacaoVigenteVaga(
  vagaId: string,
  alocacoes: AlocacaoVaga[],
  dataReferencia: string = new Date().toISOString().slice(0, 10)
): AlocacaoVaga | undefined {
  return alocacoes.find((a) => {
    if (a.vagaId !== vagaId && (a as any).posicaoIdSGP !== vagaId) return false;
    const inicioOk = !a.dataInicio || a.dataInicio <= dataReferencia;
    const fimOk = !a.dataFim || a.dataFim >= dataReferencia;
    return inicioOk && fimOk;
  });
}

export function obterHistoricoAlocacoesVaga(
  vagaId: string,
  alocacoes: AlocacaoVaga[]
): AlocacaoVaga[] {
  return alocacoes
    .filter((a) => a.vagaId === vagaId || (a as any).posicaoIdSGP === vagaId)
    .sort((a, b) => (a.dataInicio > b.dataInicio ? -1 : 1));
}

export function obterAlocacaoVigenteVaga1(
  idPosto: string,
  vagas: VagaPosto[],
  alocacoes: AlocacaoVaga[],
  dataReferencia?: string
): AlocacaoVaga | undefined {
  const vaga1 = vagas.find(
    (v) =>
      (v.idPosto === idPosto ||
        v.postoIdSGP === idPosto ||
        String(v.postoBase) === idPosto ||
        v.etiqueta === idPosto ||
        v.etiqueta === `${idPosto}.1`) &&
      (v.sequencia === 1 || v.id === idPosto)
  );

  if (vaga1) {
    const aloc = obterAlocacaoVigenteVaga(vaga1.id, alocacoes, dataReferencia);
    if (aloc) return aloc;
  }

  const alocDireta1 = obterAlocacaoVigenteVaga(idPosto, alocacoes, dataReferencia);
  if (alocDireta1) return alocDireta1;

  const alocDireta2 = obterAlocacaoVigenteVaga(`${idPosto}.1`, alocacoes, dataReferencia);
  if (alocDireta2) return alocDireta2;

  const vagasDoPostoIds = new Set(
    vagas
      .filter(
        (v) =>
          v.idPosto === idPosto ||
          v.postoIdSGP === idPosto ||
          String(v.postoBase) === idPosto ||
          v.etiqueta === idPosto ||
          v.etiqueta === `${idPosto}.1`
      )
      .map((v) => v.id)
  );
  vagasDoPostoIds.add(idPosto);
  vagasDoPostoIds.add(`${idPosto}.1`);

  return alocacoes.find((a) => {
    if (!vagasDoPostoIds.has(a.vagaId)) return false;
    const ref = dataReferencia || new Date().toISOString().slice(0, 10);
    const inicioOk = !a.dataInicio || a.dataInicio <= ref;
    const fimOk = !a.dataFim || a.dataFim >= ref;
    return inicioOk && fimOk;
  });
}

export function validarSobreposicaoAlocacao(
  vagaId: string,
  dataInicio: string,
  dataFim: string | null | undefined,
  alocacoesExistentes: AlocacaoVaga[],
  ignorarAlocacaoId?: string
): { valido: boolean; conflito?: AlocacaoVaga } {
  const fimNova = dataFim || "9999-12-31";

  for (const aloc of alocacoesExistentes) {
    if (aloc.id === ignorarAlocacaoId) continue;
    if (aloc.vagaId !== vagaId) continue;

    const inicioExistente = aloc.dataInicio;
    const fimExistente = aloc.dataFim || "9999-12-31";

    const sobrepoe = dataInicio <= fimExistente && fimNova >= inicioExistente;
    if (sobrepoe) {
      return { valido: false, conflito: aloc };
    }
  }

  return { valido: true };
}

// =============================================================================
// PASSO 5 — PENDÊNCIAS (04_PENDENTES_RM e 05_VALIDACOES)
// =============================================================================

export interface ColaboradorPendenteRM {
  chapa: string;
  nome: string;
  statusRM: string;
  dataAdmissao: string | number;
  unidadeRM: string;
  funcaoRM: string;
  horarioRM: string;
  motivo: string;
  alocarNoSGP: string;
}

export interface PendenciaValidacao {
  id: string;
  prioridade: "CRÍTICA" | "ALTA" | "MÉDIA" | string;
  tipo: string;
  unidade: string;
  referencia: string;
  colaboradores: string;
  achado: string;
  acaoRecomendada: string;
  responsavel: string;
  status: string;
}

// =============================================================================
// PASSO 6 — REGISTRO DE CARGA E AUDITORIA
// =============================================================================

export interface RegistroCargaPlanilha {
  arquivo: string;
  dataImportacao: string;
  usuario: string;
  versao: string;
  totalPostos: number;
  totalPosicoesEstruturais: number;
  totalPosicoesExcedentesPlanilha: number;
  totalAlocacoes: number;
  totalPendentesRM: number;
  totalValidacoes: number;
  totalConflitosAValidar: number;
  totalFeristas?: number;
  totalEscalas?: number;
  totalPendenciasEscala?: number;
  resumoPorTipoPosto?: Array<{
    tipoId: string;
    nome: string;
    posicoesPorPosto: number;
    statusPremissa: string;
    totalPostos: number;
    totalPosicoes: number;
  }>;
}

export interface InconsistenciaRelatorio {
  dataGeracao: string;
  resumo: {
    totalLinhasMC: number;
    totalPostos: number;
    totalVagas: number;
    totalAlocacoes: number;
    totalIdsDuplicados: number;
    totalPostosComExcessoPessoas: number;
    totalColaboradoresSemRM: number;
  };
  idsDuplicados: Array<{
    id: string;
    totalOcorrencias: number;
    linhas: Array<{
      linhaExcel: number;
      colaborador: string;
      identificadorPetrobras: string;
      postoServico: string;
      comentario?: string;
    }>;
  }>;
  excessoPessoasPorPosto: Array<{
    idPosto: string;
    tipoPosto: string;
    vagasEsperadas: number;
    totalOcupantesNaMC: number;
    excesso: number;
    ocupantes: Array<{
      linhaExcel: number;
      idNaMC: string;
      colaborador: string;
      identificadorPetrobras: string;
      comentario?: string;
    }>;
  }>;
  colaboradoresSemRm: Array<{
    linhaExcel: number;
    idNaMC: string;
    idPosto: string;
    colaborador: string;
    identificadorPetrobras: string;
  }>;
}

// =============================================================================
// DADOS OFICIAIS IMPORTADOS DA BASE ESTRUTURADA (REV04 / REV02)
// =============================================================================

export const POSTOS_REV02 = postosRev02Json as unknown as PostoEstrutural[];
export const POSICOES_REV02 = posicoesRev02Json as unknown as PosicaoEstrutural[];
export const POSICOES_EXCEDENTES_REV02 = posicoesExcedentesRev02Json as unknown as PosicaoEstrutural[];
export const ALOCACOES_REV02 = alocacoesRev02Json as unknown as AlocacaoEstrutural[];
export const PENDENTES_RM_REV02 = pendentesRmRev02Json as unknown as ColaboradorPendenteRM[];
export const VALIDACOES_REV02 = validacoesRev02Json as unknown as PendenciaValidacao[];
export const REGISTRO_CARGA_REV02 = registroCargaRev02Json as unknown as RegistroCargaPlanilha;

// REV04 Oficiais
export const FERISTAS_REV04 = feristasRev04Json as FeristaItemREV04[];
export const ESCALAS_REV04 = escalasRev04Json as EscalaPosicaoEstrutural[];
export const PENDENCIAS_ESCALA_REV04 = pendenciasEscalaRev04Json as PendenciaEscalaItem[];
export const RELATORIO_IMPORTACAO_REV04 = relatorioImportacaoRev04Json as RelatorioImportacaoREV04;
export const UNIDADES_REV04 = unidadesRev04Json as Array<{ id: string; nome: string; codigo: string; totalAlocacoes: number }>;
export const POSTOS_REV04 = postosRev04Json as unknown as PostoEstrutural[];
export const POSICOES_REV04 = posicoesRev04Json as unknown as PosicaoEstrutural[];
export const ALOCACOES_REV04 = alocacoesRev04Json as unknown as AlocacaoEstrutural[];

// Retrocompatibilidade total com camadas anteriores mapeando REV04 oficial
export const POSTOS_MC_REAIS = postosMcReaisJson as any[];
export const VINCULOS_FERISTAS_POSTOS = FERISTAS_REV04;
export const VAGAS_MC_REAIS: VagaPosto[] = vagasMcReaisJson as unknown as VagaPosto[];
export const ALOCACOES_MC_REAIS: AlocacaoVaga[] = alocacoesMcReaisJson as unknown as AlocacaoVaga[];
export const RELATORIO_INCONSISTENCIAS_MC = relatorioInconsistenciasJson as InconsistenciaRelatorio;
export const ESCALAS_POSICOES_REV04 = ESCALAS_REV04;

// Re-export das funções de cálculo contratuais e modelos oficiais do Painel
export * from "./painel-calculo";


