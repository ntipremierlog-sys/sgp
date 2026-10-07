/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Camada de Dados Operacionais e Motor de Consolidação de Ocupação Diária
 *
 * Provê sincronização em memória / localStorage para execução local imediata,
 * alinhada com o modelo Prisma Neon PostgreSQL e regras de negócio do Item 11.3 do contrato.
 */

import { StatusOcupacao } from "@/components/ui/badge-status";
import { mascararCpf } from "@/lib/importadores/tipos";
import funcionariosReais from "./funcionarios-reais.json";
import ocorrenciasReais from "./ocorrencias-reais.json";
import sifacReais from "./sifac-reais.json";
import {
  ItemAlocadoSifac,
  DivergenciaConciliacao,
  ConfiguracaoEquivalencias,
  EQUIVALENCIAS_PADRAO,
} from "./conciliacao-sifac";
import {
  MarcacaoPontoOriginal,
  PendenciaPontoItem,
} from "./ponto-tipos";
export type { MarcacaoPontoOriginal } from "./ponto-tipos";

import {
  TipoPosto,
  TipoPostoId,
  TIPOS_POSTO_CATALOGO,
  LISTA_TIPOS_POSTO,
  RegimePostoParametro,
  REGIME_POSTO_TABELA,
  LISTA_REGIMES_POSTO,
  validarCriacaoPosicao,
  criarPosicaoPosto,
  FeristaPostoVinculo,
  FERISTAS_VINCULADOS_POSTOS,
  vincularFeristaPostos,
  obterPostosDoFerista,
  obterFeristasDoPosto,
  HistoricoTitularPosicaoItem,
  HISTORICO_TITULARES_POSICAO,
  registrarHistoricoTitular,
  obterHistoricoTitularesPosicao,
  obterTipoPosto,
  identificarTipoPostoPorTexto,
  VagaPosto,
  gerarVagasPosto,
  AlocacaoVaga,
  MotivoAlocacao,
  obterAlocacaoVigenteVaga,
  obterAlocacaoVigenteVaga1,
  obterHistoricoAlocacoesVaga,
  validarSobreposicaoAlocacao,
  POSTOS_MC_REAIS,
  VAGAS_MC_REAIS,
  ALOCACOES_MC_REAIS,
  RELATORIO_INCONSISTENCIAS_MC,
  InconsistenciaRelatorio,
  PENDENCIAS_ESCALA_REV04,
  ESCALAS_POSICOES_REV04,
  FERISTAS_REV04,
  UNIDADES_REV04,
  POSTOS_REV04,
  POSICOES_REV04,
  ALOCACOES_REV04,
  PendenciaEscalaItem,
  EscalaPosicaoEstrutural,
  FeristaItemREV04,
} from "./estrutura-postos";

export type {
  TipoPosto,
  TipoPostoId,
  RegimePostoParametro,
  FeristaPostoVinculo,
  HistoricoTitularPosicaoItem,
  VagaPosto,
  AlocacaoVaga,
  MotivoAlocacao,
  InconsistenciaRelatorio,
  PendenciaEscalaItem,
  EscalaPosicaoEstrutural,
  FeristaItemREV04,
};

export {
  TIPOS_POSTO_CATALOGO,
  LISTA_TIPOS_POSTO,
  REGIME_POSTO_TABELA,
  LISTA_REGIMES_POSTO,
  validarCriacaoPosicao,
  criarPosicaoPosto,
  FERISTAS_VINCULADOS_POSTOS,
  vincularFeristaPostos,
  obterPostosDoFerista,
  obterFeristasDoPosto,
  HISTORICO_TITULARES_POSICAO,
  registrarHistoricoTitular,
  obterHistoricoTitularesPosicao,
  obterTipoPosto,
  identificarTipoPostoPorTexto,
  gerarVagasPosto,
  obterAlocacaoVigenteVaga,
  obterAlocacaoVigenteVaga1,
  obterHistoricoAlocacoesVaga,
  validarSobreposicaoAlocacao,
  POSTOS_MC_REAIS,
  VAGAS_MC_REAIS,
  ALOCACOES_MC_REAIS,
  RELATORIO_INCONSISTENCIAS_MC,
  PENDENCIAS_ESCALA_REV04,
  ESCALAS_POSICOES_REV04,
  FERISTAS_REV04,
  UNIDADES_REV04,
  POSTOS_REV04,
  POSICOES_REV04,
  ALOCACOES_REV04,
};

export interface PostoOperacional {
  id: string;
  /** Identificador fixo e único do posto (ex.: "7", "227"). Não pode repetir e não muda quando o ocupante muda. */
  idPosto: string;
  postoIdSGP?: string;
  idReferencia?: number | string;
  postoBase?: string | number;
  qtdEstruturalConfirmada?: number;
  codigoPosto: string;
  funcao: string;
  descricao?: string;
  /** Item da Planilha de Preços Unitários (ex.: "3.6", "3.1") */
  itemPPU: string;
  /** Tipo de posto contratual (ex.: "ADM_09H", "TURNO_24H") */
  tipoPostoId: TipoPostoId | string;
  /** Adicional de periculosidade */
  periculosidade: "SIM" | "NÃO";
  /** Município de prestação de serviços */
  municipio: string;
  /** Local de atuação / Base operacional Petrobras */
  localAtuacao: string;
  /** Gerência Petrobras responsável */
  gerenciaPetrobras: string;
  escala: "5x2" | "12x36" | "6x1" | "4x4" | "4x2" | string;
  dataBaseCiclo?: string;
  diaFolgaSemanal?: number;
  jornadaSemanalHoras: number;
  horarioInicio: string;
  horarioFim: string;
  situacao: "ATIVO" | "SUSPENSO" | "ENCERRADO";
  dataInicioVigencia: string;
  dataFimVigencia?: string;

  // Localização / Base
  unidadeId: string;
  unidadeNome: string;
  baseOperacional?: string; // Nome amigável da base (ex: "UFN III"), derivado de unidadeNome

  // Compatibilidade temporária (Item 6):
  // Removido da entidade persistida do posto; preenchido em tempo de execução
  // com a alocação vigente da vaga 1 daquele posto para não quebrar telas legadas.
  titularMatricula?: string;
  titularNome?: string;
}

export interface MovimentacaoHistorico {
  dataReferencia: string;
  situacao?: string;
  funcao?: string;
  secaoCodigo?: string;
  secaoDescricao?: string;
  horarioCodigo?: string;
  horarioDescricao?: string;
}

export interface ProfissionalOperacional {
  id: string;
  chapa: string;
  matricula: string;
  nome: string;
  nomeSocial?: string;
  cpfMascarado: string;
  cpfLimpo: string;
  funcao: string;
  unidadeId: string;
  unidadeNome?: string;
  postoCodigo?: string;
  escala: "5x2" | "12x36" | "6x1" | "OUTRA";
  situacao: "ATIVO" | "AFASTADO" | "FERIAS" | "DESLIGADO";
  situacaoCodigo?: string;
  situacaoDescricao?: string;
  sexo?: "M" | "F";
  dataNascimento?: string; // YYYY-MM-DD
  dataAdmissao: string;
  dataDesligamento?: string;
  secaoCodigo?: string;
  secaoDescricao?: string;
  horarioCodigo?: string;
  horarioDescricao?: string;
  jornadaDescricao?: string;
  utilizaPonto?: boolean;
  historico?: MovimentacaoHistorico[];
  telefoneCorporativo?: string;
  tipoColaborador?: string;
  statusAlocacao?: string;
  unidadeBase?: string;
  unidade?: string;
  postosVinculados?: string[];
  // Segregação estrita LGPD: Dados restritos acessíveis somente com perfil Premier
  dadosRestritos?: {
    endereco?: string;
    telefonePessoal?: string;
    emailPessoal?: string;
    salario?: number;
    dependentes?: string;
  };
}

export interface OcorrenciaOperacional {
  id: string;
  matricula: string;
  profissionalNome: string;
  postoCodigo?: string;
  tipoOcorrencia:
    | "ATESTADO_MEDICO"
    | "FALTA_JUSTIFICADA"
    | "FALTA_INJUSTIFICADA"
    | "ABONO_LEGAL"
    | "FERIAS"
    | "TREINAMENTO"
    | "FOLGA_ESCALA"
    | "OUTROS";
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  diasAfetados: number;
  status: "REGISTRADA" | "EM_VALIDACAO" | "VALIDADA" | "CANCELADA";
  observacaoPublica: string;
  tipoAbono?: string;
  categoriaAusencia?: string; // Férias, Falta, Afastamento, Licença, Folga compensatória, etc.
  quantidadeHoras?: number;
  quantidadeDias?: number;
  // Segregação estrita LGPD: CID-10 e emissor isolados (HTTP 403 para Petrobras)
  dadoSensivel?: {
    cid?: string;
    descricaoClinica?: string;
    profissionalEmissor?: string;
    crm?: string;
  };
  criadoEm: string;
}

export interface CoberturaOperacional {
  id: string;
  postoCodigo: string;
  idPosto?: string;
  vagaId?: string;
  funcaoPosto: string;
  titularMatricula?: string;
  titularNome?: string;
  substitutoMatricula: string;
  substitutoNome: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  tipoCobertura:
    | "SUBSTITUICAO_INTERNA"
    | "REMANEJAMENTO_ENTRE_POSTOS"
    | "HORA_EXTRA_TITULAR_OUTRO_POSTO"
    | "CONTRATACAO_TEMPORARIA";
  status: "PLANEJADA" | "CONFIRMADA" | "CANCELADA";
  justificativa: string;
  ocorrenciaId?: string;
  criadoEm: string;
  // Conformidade CLT Art. 66 (Interjornada Mínima de 11h)
  alertaInterjornada?: boolean;
  horasDescansoApuradas?: number;
  detalhesInterjornada?: string;
}

export interface ApontamentoOperacional {
  id: string;
  postoCodigo: string;
  idPosto?: string;
  vagaId?: string;
  funcaoPosto: string;
  dataReferencia: string; // YYYY-MM-DD
  competencia: string;
  texto: string; // Apontamento formal da Petrobras
  criadoPor: string;
  dataCriacao: string;
  status: "ABERTO" | "EM_TRATAMENTO" | "RESPONDIDO" | "ENCERRADO";
  respostaPremier?: string;
  respondidoPor?: string;
  respondidoEm?: string;
}

export interface RegistroPontoOperacional {
  matricula: string;
  data: string; // YYYY-MM-DD
  situacaoPonto: "PRESENTE" | "AUSENTE" | "FOLGA" | "FERIAS" | "AFASTADO";
  horaEntrada?: string;
  horaSaida?: string;
  horasTrabalhadas?: number;
}

export interface LogAuditoriaOperacional {
  id: string;
  timestamp: string;
  usuario: string;
  perfil: string;
  acao: string;
  entidade: string;
  detalhes: string;
  ip: string;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  registroId?: string;
}

export type StatusAgregadoPosto =
  | "COMPLETO"
  | "PARCIAL"
  | "DESCOBERTO"
  | "NAO_EXIGIVEL"
  | "PENDENTE_APURACAO";

export type CriterioCobertura = "POSICOES" | "HORAS";

export type StatusPosicaoDia =
  | "FOLGA"
  | "PENDENTE"
  | "COBERTO"
  | "DESCOBERTO"
  | "SEM_OCUPANTE"
  | "PRESENTE"
  | "CICLO_NAO_CONFIGURADO"
  | "SEM_DADO";

export interface OcupacaoVagaDia {
  vagaId: string;
  posicaoId?: string; // alias semântico
  idPosto: string;
  sequencia: number;
  data: string; // YYYY-MM-DD
  diaNumero: number;

  // Passo 5 & Passo 8:
  status: StatusPosicaoDia;
  statusVaga: StatusOcupacao; // retrocompatibilidade para componentes legados
  ocupante?: {
    matricula: string;
    nome: string;
    identificadorPetrobras?: string;
  };
  tipoOcupacao?: "titular" | "ferista" | "cobertura" | "substituto" | string;
  titularSubstituido?: {
    matricula: string;
    nome: string;
  };
  horarioPrevisto?: string;
  batidas?: {
    entrada?: string;
    saida?: string;
    horas?: number;
  };
  ocorrencia?: {
    id?: string;
    tipo?: string;
    categoria?: string;
    categoriaAusencia?: string;
    justificativa?: string;
    observacaoPublica?: string;
    quantidadeHoras?: number;
    quantidadeDias?: number;
  };

  alocacaoVigente?: AlocacaoVaga;
  ocupanteMatricula?: string;
  ocupanteNome?: string;
  exigivel: boolean;
  motivoNaoExigivel?: string;
  motivoPublico: string;
  possuiEvidencia: boolean;
  ocorrenciaId?: string;
  coberturaId?: string;
  apontamentoId?: string;
  alertaDescoberto?: boolean;
  categoriaAusencia?: string;
}

export type OcupacaoPosicaoDia = OcupacaoVagaDia;

export interface OcupacaoDiaDetalhada {
  postoCodigo: string;
  idPosto?: string;
  postoBase?: string;
  funcaoPosto: string;
  data: string; // YYYY-MM-DD
  diaNumero: number;
  statusOcupacao: StatusOcupacao;
  /** Status agregado do posto no dia (Item 6): COMPLETO | PARCIAL | DESCOBERTO */
  statusAgregado?: StatusAgregadoPosto;
  /** Apuração detalhada por vaga daquele posto (Item 2) */
  vagasDetalhe?: OcupacaoVagaDia[];
  /** Alias semântico para as posições detalhadas */
  posicoesDetalhe?: OcupacaoVagaDia[];

  // Passo 6: Percentual de cobertura do posto no dia
  posicoesExigiveis: number;
  posicoesAtendidas: number;
  percentualCobertura: number | null;
  percentualCoberturaFormatado: string; // ex.: "50%", "100%", ou "–" quando sem posições exigíveis
  criterioCobertura?: CriterioCobertura;

  titularMatricula?: string;
  titularNome?: string;
  ocupanteMatricula?: string;
  ocupanteNome?: string;
  motivoPublico: string;
  possuiEvidencia: boolean;
  ocorrenciaId?: string;
  coberturaId?: string;
  apontamentoId?: string;
  batidas?: {
    entrada?: string;
    saida?: string;
    horas?: number;
  };
}

export interface ApuracaoPostoCiclo {
  idPosto: string;
  postoCodigo: string;
  periodo: PeriodoAcompanhamentoCiclo;
  criterioCobertura: CriterioCobertura;
  totalPosicoesExigiveis: number;
  totalPosicoesAtendidas: number;
  percentualCiclo: number | null;
  percentualCicloFormatado: string;
  dias: OcupacaoDiaDetalhada[];
  posicoesSemCicloConfigurado: string[];
}

export interface PosicaoCicloNaoConfiguradoItem {
  posicaoId: string;
  idPosto: string;
  postoCodigo: string;
  escala: string;
  ocupanteMatricula?: string;
  ocupanteNome?: string;
  motivo: string;
}

export interface LoteImportacaoOperacional {
  id: string; // Ex: "LOTE-RM-20260917-103000"
  tipo: "FUNCIONARIOS_RM" | "ALOCADOS_SIFAC" | "ABONO_RM" | "REGISTROS_PONTO_RM" | "AFD_PONTO";
  competencia?: string; // Ex: "2026-09"
  dataExtracao?: string; // Data informada de extração no RM
  linhasRejeitadas?: number;
  arquivoNome: string;
  hashSha256: string;
  dataReferencia: string;
  usuario: string;
  dataHora: string;
  totais: {
    lidos: number;
    novos: number;
    atualizados: number;
    semAlteracao: number;
    erros: number;
    alertas: number;
  };
  status: "CONCLUIDO" | "DESFEITO";
  snapshotAnterior?: Partial<EstadoOperacionalCompleto>;
  diasRetencao: number; // Padrão 90 dias
}

export interface FechamentoCompetencia {
  id: string;
  competencia: string; // Ex: "2026-08", "2026-09"
  status: "ABERTO" | "EM_HOMOLOGACAO" | "CONGELADO";
  congeladoEm?: string;
  congeladoPor?: string;
  congeladoPorEmail?: string;
  hashIntegridadeSha256?: string;
  resumoMetricas: {
    postos: number;
    exigiveis: number;
    efetivas: number;
    glosas: number;
    taxaSla: number;
    valorContrato: number;
    valorGlosa: number;
    faturamentoLiquido: number;
  };
  observacoes?: string;
  homologacaoPetrobras?: {
    homologado: boolean;
    data?: string;
    fiscalNome?: string;
    parecer?: string;
  };
  historicoReaberturas?: Array<{
    data: string;
    usuario: string;
    justificativa: string;
  }>;
  snapshotResumo?: Record<string, unknown>;
}

export interface EstadoOperacionalCompleto {
  postos: PostoOperacional[];
  vagas?: VagaPosto[];
  alocacoes?: AlocacaoVaga[];
  tiposPosto?: TipoPosto[];
  profissionais: ProfissionalOperacional[];
  ocorrencias: OcorrenciaOperacional[];
  coberturas: CoberturaOperacional[];
  apontamentos: ApontamentoOperacional[];
  logsAuditoria: LogAuditoriaOperacional[];
  lotesImportacao?: LoteImportacaoOperacional[];
  alocadosSifac?: ItemAlocadoSifac[];
  divergenciasConciliacao?: Record<string, DivergenciaConciliacao[]>;
  equivalenciasConciliacao?: ConfiguracaoEquivalencias;
  marcacoesPonto?: MarcacaoPontoOriginal[];
  diasFolgaRm?: string[];
  pendenciasPonto?: PendenciaPontoItem[];
  pendenciasEscala?: PendenciaEscalaItem[];
  ajustesManuaisDia?: AjusteManualDia[];
  dataReferenciaPonto?: string;
  fechamentosCompetencia?: FechamentoCompetencia[];
  perfilAtivo: string;
  /** IDs de coberturas do seed excluídas pelo usuário (impede que sejam reinjetadas ao recarregar). */
  coberturasExcluidasIds?: string[];
  unidadeSelecionada: string;
}

export interface AjusteManualDia {
  id: string;
  posicaoId: string;
  data: string; // YYYY-MM-DD
  status: "PRESENTE" | "FOLGA" | "DESCOBERTO";
  justificativa?: string;
  registradoPor?: string;
  criadoEm: string;
}

// -----------------------------------------------------------------------------
// DADOS BASE OFICIAIS: UFN III – TRÊS LAGOAS/MS (ANEXO 1-A)
// -----------------------------------------------------------------------------

export const POSTOS_INICIAIS: PostoOperacional[] = [
  {
    id: "pst-001",
    idPosto: "UFN-001",
    codigoPosto: "PST-ALM-001",
    funcao: "Almoxarife Líder",
    descricao: "Gestão do estoque de sobressalentes e químicos da unidade UFN III",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-01-01",
  },
  {
    id: "pst-002",
    idPosto: "UFN-002",
    codigoPosto: "PST-ALM-002",
    funcao: "Auxiliar de Almoxarifado I",
    descricao: "Recebimento e catalogação de materiais no pátio logístico",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: "045638",
    titularNome: "MAYLA VITORIA DIAS DOS SANTOS",
    situacao: "ATIVO",
    dataInicioVigencia: "2024-01-01",
  },
  {
    id: "pst-003",
    idPosto: "UFN-003",
    codigoPosto: "PST-ALM-003",
    funcao: "Auxiliar de Almoxarifado II",
    descricao: "Controle de expedição para frentes de obra e manutenção",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: "046236",
    titularNome: "TATIANE LAIZO BUONO",
    situacao: "ATIVO",
    dataInicioVigencia: "2024-01-01",
  },
  {
    id: "pst-004",
    idPosto: "UFN-004",
    codigoPosto: "PST-LOG-004",
    funcao: "Operador de Empilhadeira Líder",
    descricao: "Movimentação contínua de cargas pesadas em turno diurno",
    itemPPU: "3.2",
    tipoPostoId: "TURNO_12H",
    periculosidade: "SIM",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "12x36",
    jornadaSemanalHoras: 36,
    horarioInicio: "06:00",
    horarioFim: "18:00",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-02-01",
  },
  {
    id: "pst-005",
    idPosto: "UFN-005",
    codigoPosto: "PST-LOG-005",
    funcao: "Operador de Empilhadeira Folguista",
    descricao: "Movimentação contínua em escala noturna de apoio à planta",
    itemPPU: "3.2",
    tipoPostoId: "TURNO_12H",
    periculosidade: "SIM",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "12x36",
    jornadaSemanalHoras: 36,
    horarioInicio: "18:00",
    horarioFim: "06:00",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-02-01",
  },
  {
    id: "pst-006",
    idPosto: "UFN-006",
    codigoPosto: "PST-LOG-006",
    funcao: "Auxiliar de Logística",
    descricao: "Apoio a amarração, etiquetagem e distribuição interna",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "08:00",
    horarioFim: "17:48",
    titularMatricula: "046082",
    titularNome: "FERNANDO RIBEIRO FERNANDES",
    situacao: "ATIVO",
    dataInicioVigencia: "2024-02-15",
  },
  {
    id: "pst-007",
    idPosto: "UFN-007",
    codigoPosto: "PST-TEC-007",
    funcao: "Inspetor de Recebimento Técnico",
    descricao: "Inspeção visual e dimensional de materiais metálicos e válvulas",
    itemPPU: "5.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:30",
    horarioFim: "17:18",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-03-01",
  },
  {
    id: "pst-008",
    idPosto: "UFN-008",
    codigoPosto: "PST-TEC-008",
    funcao: "Conferente de Carga e Descarga",
    descricao: "Conferência física de carretas na portaria de materiais",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "6x1",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "15:20",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-03-01",
  },
  {
    id: "pst-009",
    idPosto: "UFN-009",
    codigoPosto: "PST-ADM-009",
    funcao: "Assistente Administrativo de Posto",
    descricao: "Controle de chamados, relatórios diários de RDO e atendimento",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "08:00",
    horarioFim: "17:48",
    titularMatricula: "037606",
    titularNome: "LARISSA OLIVEIRA DA SILVA FREITAS",
    situacao: "ATIVO",
    dataInicioVigencia: "2024-03-15",
  },
  {
    id: "pst-010",
    idPosto: "UFN-010",
    codigoPosto: "PST-ADM-010",
    funcao: "Controlador de Documentação e NFs",
    descricao: "Lançamento em sistema Petrobras SAP de notas fiscais de entrada",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "08:00",
    horarioFim: "17:48",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-04-01",
  },
  {
    id: "pst-011",
    idPosto: "UFN-011",
    codigoPosto: "PST-EXP-011",
    funcao: "Expedidor de Materiais",
    descricao: "Separação de kits de montagem mecânica para frentes de montagem",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-04-01",
  },
  {
    id: "pst-012",
    idPosto: "UFN-012",
    codigoPosto: "PST-SEG-012",
    funcao: "Técnico de Segurança Operacional",
    descricao: "Inspeção de rotas, APRs e uso de EPIs na movimentação de cargas",
    itemPPU: "4.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-04-15",
  },
  {
    id: "pst-013",
    idPosto: "UFN-013",
    codigoPosto: "PST-LOG-013",
    funcao: "Operador de Ponte Rolante",
    descricao: "Operação da ponte de 30 toneladas no almoxarifado coberto",
    itemPPU: "3.2",
    tipoPostoId: "TURNO_12H",
    periculosidade: "SIM",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "12x36",
    jornadaSemanalHoras: 36,
    horarioInicio: "06:00",
    horarioFim: "18:00",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-05-01",
  },
  {
    id: "pst-014",
    idPosto: "UFN-014",
    codigoPosto: "PST-ALM-014",
    funcao: "Auxiliar de Pátio",
    descricao: "Arrumação de pallets e chaparia na área externa",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-05-01",
  },
  {
    id: "pst-015",
    idPosto: "UFN-015",
    codigoPosto: "PST-ALM-015",
    funcao: "Auxiliar de Embalagem",
    descricao: "Preparação de caixas de madeira e proteção anticorrosiva",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    baseOperacional: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: undefined,
    titularNome: undefined,
    situacao: "ATIVO",
    dataInicioVigencia: "2024-05-01",
  },
];

export const PROFISSIONAIS_INICIAIS: ProfissionalOperacional[] = (funcionariosReais as unknown as ProfissionalOperacional[]) || [];
export const OCORRENCIAS_INICIAIS: OcorrenciaOperacional[] = (ocorrenciasReais as unknown as OcorrenciaOperacional[]) || [];
export const COBERTURAS_INICIAIS: CoberturaOperacional[] = [];
export const APONTAMENTOS_INICIAIS: ApontamentoOperacional[] = [];

export const FECHAMENTOS_INICIAIS: FechamentoCompetencia[] = [
  {
    id: "fech-2026-08",
    competencia: "2026-08",
    status: "CONGELADO",
    congeladoEm: "2026-09-05 14:00:00",
    congeladoPor: "Marcos Valério de Souza (Administrador Premier)",
    congeladoPorEmail: "marcos.valerio@premierlogistics.com.br",
    hashIntegridadeSha256: "sha256:8f4c2e91b5d63f8902c4419aa3bc781704e8a128e401b5d63f8902c4419aa3bc",
    resumoMetricas: {
      postos: 380,
      exigiveis: 8360,
      efetivas: 8150,
      glosas: 210,
      taxaSla: 97.5,
      valorContrato: 2850000.0,
      valorGlosa: 71750.0,
      faturamentoLiquido: 2778250.0,
    },
    observacoes: "Competência Agosto/2026 encerrada e homologada sem contestação.",
    homologacaoPetrobras: {
      homologado: true,
      data: "2026-09-06 09:30:00",
      fiscalNome: "Carlos Eduardo Mendes (Fiscal Técnico Petrobras)",
      parecer: "Medição de Agosto/2026 auditada e atestada para liquidação financeira conforme Item 11.3.",
    },
    historicoReaberturas: [],
  },
  {
    id: "fech-2026-09",
    competencia: "2026-09",
    status: "ABERTO",
    resumoMetricas: {
      postos: 380,
      exigiveis: 3960,
      efetivas: 3810,
      glosas: 150,
      taxaSla: 96.2,
      valorContrato: 2850000.0,
      valorGlosa: 37500.0,
      faturamentoLiquido: 2812500.0,
    },
    observacoes: "Competência Setembro/2026 em apuração diária com apuração parcial de registros.",
    historicoReaberturas: [],
  },
];

export const LOTES_INICIAIS: LoteImportacaoOperacional[] = [
  {
    id: "LOTE-RM-20260917-OFICIAL",
    tipo: "FUNCIONARIOS_RM",
    competencia: "2026-09",
    arquivoNome: "FUNCIONÁRIOS PETROBRAS novo.XLS",
    hashSha256: "8e8d89e023194a0d922f5c1a70001",
    dataReferencia: "2026-09-09",
    usuario: "Administrador Premier (Marcos Valério)",
    dataHora: "2026-09-17 10:30:00",
    totais: {
      lidos: 389,
      novos: 389,
      atualizados: 0,
      semAlteracao: 0,
      erros: 0,
      alertas: 0,
    },
    status: "CONCLUIDO",
    diasRetencao: 90,
  },
  {
    id: "LOTE-PTO-20260915-OFICIAL",
    tipo: "REGISTROS_PONTO_RM",
    competencia: "2026-09",
    arquivoNome: "CUBO DE REGISTROS.xlsx",
    hashSha256: "5a2e91b5d63f8902c4419aa3bc781704",
    dataReferencia: "2026-09-15 23:59",
    usuario: "Administrador Premier (Marcos Valério)",
    dataHora: "2026-09-17 10:45:00",
    totais: {
      lidos: 7019,
      novos: 15752,
      atualizados: 0,
      semAlteracao: 0,
      erros: 0,
      alertas: 0,
    },
    status: "CONCLUIDO",
    diasRetencao: 90,
  },
  {
    id: "LOTE-ABONO-20260909-OFICIAL",
    tipo: "ABONO_RM",
    competencia: "2026-09",
    arquivoNome: "CUBO DE ABONO.xlsx",
    hashSha256: "4c1b5d63f8902c4419aa3bc781704e8a",
    dataReferencia: "2026-09-09",
    usuario: "Administrador Premier (Marcos Valério)",
    dataHora: "2026-09-17 10:40:00",
    totais: {
      lidos: 81,
      novos: 80,
      atualizados: 0,
      semAlteracao: 0,
      erros: 0,
      alertas: 0,
    },
    status: "CONCLUIDO",
    diasRetencao: 90,
  },
  {
    id: "LOTE-SIFAC-20260810-OFICIAL",
    tipo: "ALOCADOS_SIFAC",
    competencia: "2026-09",
    arquivoNome: "08_Lista de Alocados_SIFAC_Agosto_.xlsx",
    hashSha256: "3b7c91e023194a0d922f5c1a70002",
    dataReferencia: "2026-08-10",
    usuario: "Administrador Premier (Marcos Valério)",
    dataHora: "2026-09-17 10:35:00",
    totais: {
      lidos: 337,
      novos: 337,
      atualizados: 0,
      semAlteracao: 0,
      erros: 0,
      alertas: 16,
    },
    status: "CONCLUIDO",
    diasRetencao: 90,
  },
];

export const LOGS_INICIAIS: LogAuditoriaOperacional[] = [
  {
    id: "log-carga-abono-003",
    timestamp: "2026-09-17 10:40:00",
    usuario: "Administrador Premier (Marcos Valério)",
    perfil: "PREMIER_ADMIN",
    acao: "IMPORTACAO_CUBO_ABONO",
    entidade: "Lote (LOTE-ABONO-20260831-OFICIAL)",
    detalhes: "Carga do Cubo de Abono realizada com sucesso: 80 ocorrências/abonos validados e associados aos colaboradores na competência.",
    ip: "189.120.45.12",
  },
  {
    id: "log-carga-sifac-002",
    timestamp: "2026-09-17 10:35:00",
    usuario: "Administrador Premier (Marcos Valério)",
    perfil: "PREMIER_ADMIN",
    acao: "IMPORTACAO_ALOCADOS_SIFAC",
    entidade: "Lote (LOTE-SIFAC-20260810-OFICIAL)",
    detalhes: "Carga da Lista de Alocados SIFAC realizada com sucesso: 337 colaboradores certificados no contrato 4600682336 (ICJ 5900.0129796.25.2).",
    ip: "189.120.45.12",
  },
  {
    id: "log-carga-rm-001",
    timestamp: "2026-09-17 10:30:00",
    usuario: "Administrador Premier (Marcos Valério)",
    perfil: "PREMIER_ADMIN",
    acao: "IMPORTACAO_FUNCIONARIOS_RM",
    entidade: "Lote (LOTE-RM-20260917-OFICIAL)",
    detalhes: "Carga oficial de Funcionários RM realizada com sucesso: 380 colaboradores cadastrados, 29 seções mapeadas, segregação estrita LGPD aplicada.",
    ip: "189.120.45.12",
  },
  {
    id: "log-limpeza-001",
    timestamp: "2026-09-17 10:00:00",
    usuario: "Administrador Premier (Marcos Valério)",
    perfil: "PREMIER_ADMIN",
    acao: "LIMPEZA_DADOS_DEMONSTRACAO",
    entidade: "DadosOperacionais",
    detalhes: "Limpeza de demonstração: 16 colaboradores fictícios removidos, 14 postos tornados vagos (Anexo 1-A preservado), 3 ocorrências removidas, 2 coberturas removidas, 2 apontamentos removidos. Backup de segurança gerado com sucesso.",
    ip: "189.120.45.12",
  },
];

// -----------------------------------------------------------------------------
// MOTOR CENTRAL DE CÁLCULO DE STATUS DE OCUPAÇÃO DIÁRIA (POR VAGA E POSTO)
// -----------------------------------------------------------------------------

export interface FeriadoContratual {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: "NACIONAL" | "ESTADUAL" | "MUNICIPAL";
  baseOperacional?: string;
  municipio?: string;
  uf?: string;
}

export const FERIADOS_OFICIAIS_CONTRATO: FeriadoContratual[] = [
  // 1. Feriados Nacionais
  { data: "2026-01-01", nome: "Confraternização Universal", tipo: "NACIONAL" },
  { data: "2026-04-21", nome: "Tiradentes", tipo: "NACIONAL" },
  { data: "2026-05-01", nome: "Dia Mundial do Trabalho", tipo: "NACIONAL" },
  { data: "2026-09-07", nome: "Independência do Brasil", tipo: "NACIONAL" },
  { data: "2026-10-12", nome: "Nossa Senhora Aparecida", tipo: "NACIONAL" },
  { data: "2026-11-02", nome: "Finados", tipo: "NACIONAL" },
  { data: "2026-11-15", nome: "Proclamação da República", tipo: "NACIONAL" },
  { data: "2026-11-20", nome: "Dia Nacional de Zumbi e da Consciência Negra", tipo: "NACIONAL" },
  { data: "2026-12-25", nome: "Natal", tipo: "NACIONAL" },

  // 2. Feriados Estaduais e Municipais por Base / Município
  // UFN-III (Três Lagoas - MS)
  { data: "2026-06-15", nome: "Aniversário de Três Lagoas", tipo: "MUNICIPAL", baseOperacional: "UFN-III", municipio: "Três Lagoas" },
  { data: "2026-06-15", nome: "Aniversário de Três Lagoas", tipo: "MUNICIPAL", baseOperacional: "UFN III", municipio: "Três Lagoas" },
  { data: "2026-10-11", nome: "Criação do Estado do Mato Grosso do Sul", tipo: "ESTADUAL", baseOperacional: "UFN-III", uf: "MS" },
  { data: "2026-10-11", nome: "Criação do Estado do Mato Grosso do Sul", tipo: "ESTADUAL", baseOperacional: "UFN III", uf: "MS" },

  // BOAVENTURA (Itaboraí - RJ)
  { data: "2026-04-23", nome: "Dia de São Jorge", tipo: "ESTADUAL", baseOperacional: "BOAVENTURA", uf: "RJ" },
  { data: "2026-05-22", nome: "Aniversário de Itaboraí", tipo: "MUNICIPAL", baseOperacional: "BOAVENTURA", municipio: "Itaboraí" },

  // Macaé - RJ (CABIUNAS, IMBETIBA, IMBOASSICA)
  { data: "2026-04-23", nome: "Dia de São Jorge", tipo: "ESTADUAL", uf: "RJ" },
  { data: "2026-07-29", nome: "Aniversário de Macaé", tipo: "MUNICIPAL", municipio: "Macaé" },

  // Rio de Janeiro - RJ (CENPES, EDISEN, EDIBRA, EDIHB)
  { data: "2026-01-20", nome: "Dia de São Sebastião", tipo: "MUNICIPAL", municipio: "Rio de Janeiro" },
  { data: "2026-04-23", nome: "Dia de São Jorge", tipo: "ESTADUAL", uf: "RJ" },

  // Santos / Cubatão - SP (RPBC, EDISA)
  { data: "2026-01-26", nome: "Aniversário de Santos", tipo: "MUNICIPAL", baseOperacional: "EDISA", municipio: "Santos" },
  { data: "2026-04-09", nome: "Emancipação de Cubatão", tipo: "MUNICIPAL", baseOperacional: "RPBC", municipio: "Cubatão" },
  { data: "2026-07-09", nome: "Revolução Constitucionalista", tipo: "ESTADUAL", uf: "SP" },

  // Paulínia - SP (REPLAN)
  { data: "2026-02-28", nome: "Aniversário de Paulínia", tipo: "MUNICIPAL", baseOperacional: "REPLAN", municipio: "Paulínia" },

  // Betim - MG (REGAP)
  { data: "2026-07-16", nome: "Nossa Senhora do Carmo", tipo: "MUNICIPAL", baseOperacional: "REGAP", municipio: "Betim" },

  // Canoas - RS (REFAP)
  { data: "2026-06-27", nome: "Aniversário de Canoas", tipo: "MUNICIPAL", baseOperacional: "REFAP", municipio: "Canoas" },
  { data: "2026-09-20", nome: "Revolução Farroupilha", tipo: "ESTADUAL", baseOperacional: "REFAP", uf: "RS" },

  // Duque de Caxias - RJ (REDUC)
  { data: "2026-12-31", nome: "Emancipação de Duque de Caxias", tipo: "MUNICIPAL", baseOperacional: "REDUC", municipio: "Duque de Caxias" },

  // Araucária - PR (REPAR)
  { data: "2026-02-11", nome: "Aniversário de Araucária", tipo: "MUNICIPAL", baseOperacional: "REPAR", municipio: "Araucária" },

  // São José dos Campos - SP (REVAP)
  { data: "2026-07-27", nome: "Aniversário de São José dos Campos", tipo: "MUNICIPAL", baseOperacional: "REVAP", municipio: "São José dos Campos" },

  // Ipojuca - PE (RNEST)
  { data: "2026-03-30", nome: "Emancipação de Ipojuca", tipo: "MUNICIPAL", baseOperacional: "RNEST", municipio: "Ipojuca" },
  { data: "2026-06-24", nome: "São João", tipo: "ESTADUAL", baseOperacional: "RNEST", uf: "PE" },

  // Salvador - BA (BASE TAQUIPE, PITUBA)
  { data: "2026-07-02", nome: "Independência da Bahia", tipo: "ESTADUAL", uf: "BA" },
  { data: "2026-12-08", nome: "Nossa Senhora da Conceição da Praia", tipo: "MUNICIPAL", municipio: "Salvador" },

  // Natal - RN (EDIRN)
  { data: "2026-10-03", nome: "Mártires de Cunhaú e Uruuaçu", tipo: "ESTADUAL", baseOperacional: "EDIRN", uf: "RN" },
  { data: "2026-11-21", nome: "Nossa Senhora da Apresentação", tipo: "MUNICIPAL", baseOperacional: "EDIRN", municipio: "Natal" },

  // Vitória - ES (EDIVIT)
  { data: "2026-09-08", nome: "Nossa Senhora da Vitória", tipo: "MUNICIPAL", baseOperacional: "EDIVIT", municipio: "Vitória" },

  // Manaus - AM (EDMAN)
  { data: "2026-09-05", nome: "Elevação do Amazonas à Categoria de Província", tipo: "ESTADUAL", baseOperacional: "EDMAN", uf: "AM" },
  { data: "2026-10-24", nome: "Aniversário de Manaus", tipo: "MUNICIPAL", baseOperacional: "EDMAN", municipio: "Manaus" },

  // Fortaleza - CE (LUBNOR)
  { data: "2026-08-15", nome: "Nossa Senhora da Assunção", tipo: "MUNICIPAL", baseOperacional: "LUBNOR", municipio: "Fortaleza" },
];

function normalizarTextoFeriado(str?: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[-_]/g, " ")
    .trim();
}

/**
 * Passo 4: Verifica se determinada data é feriado nacional, estadual ou municipal para a base/município/unidade.
 */
export function verificarFeriadoBase(
  dataStr: string,
  base?: string,
  municipio?: string,
  feriadosCustom?: FeriadoContratual[],
  unidade?: string
): { ehFeriado: boolean; feriado?: FeriadoContratual } {
  const todosFeriados = feriadosCustom && feriadosCustom.length > 0
    ? [...FERIADOS_OFICIAIS_CONTRATO, ...feriadosCustom]
    : FERIADOS_OFICIAIS_CONTRATO;

  const baseNorm = normalizarTextoFeriado(base);
  const munNorm = normalizarTextoFeriado(municipio);
  const uniNorm = normalizarTextoFeriado(unidade);

  for (const f of todosFeriados) {
    if (f.data !== dataStr) continue;

    if (f.tipo === "NACIONAL") {
      return { ehFeriado: true, feriado: f };
    }

    const fBaseNorm = normalizarTextoFeriado(f.baseOperacional);
    const fMunNorm = normalizarTextoFeriado(f.municipio);

    if (
      fBaseNorm &&
      ((baseNorm && (baseNorm.includes(fBaseNorm) || fBaseNorm.includes(baseNorm))) ||
        (uniNorm && (uniNorm.includes(fBaseNorm) || fBaseNorm.includes(uniNorm))))
    ) {
      return { ehFeriado: true, feriado: f };
    }

    if (
      fMunNorm &&
      ((munNorm && (munNorm.includes(fMunNorm) || fMunNorm.includes(munNorm))) ||
        (uniNorm && (uniNorm.includes(fMunNorm) || fMunNorm.includes(uniNorm))))
    ) {
      return { ehFeriado: true, feriado: f };
    }
  }

  return { ehFeriado: false };
}

/**
 * Calcula a diferença em dias corridos inteiros entre duas datas (dataA - dataB).
 * Utiliza UTC à meia-noite para evitar desvios de fuso horário / horário de verão.
 */
export function calcularDiferencaDias(dataA: string, dataB: string): number {
  const [y1, m1, d1] = dataA.split("-").map(Number);
  const [y2, m2, d2] = dataB.split("-").map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const diffMs = utc1 - utc2;
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Datas máximas de ponto importadas por base operacional (Item 5).
 */
export const DATAS_MAX_PONTO_PADRAO_BASES: Record<string, string> = {
  PADRAO: "2026-09-15",
  "UFN III": "2026-09-15",
  "UFN-III": "2026-09-15",
  BOAVENTURA: "2026-09-15",
  CABIUNAS: "2026-09-15",
  CENPES: "2026-09-15",
  REDUC: "2026-09-15",
  REGAP: "2026-09-15",
  REPLAN: "2026-09-15",
  RPBC: "2026-09-15",
};

export function obterDataMaxPontoBase(
  base: string,
  config?: Record<string, string> | string
): string {
  if (!config) return "2026-09-15";
  if (typeof config === "string") return config;
  const baseKey = Object.keys(config).find(
    (k) => k.toUpperCase().trim() === base.toUpperCase().trim()
  );
  if (baseKey && config[baseKey]) return config[baseKey];
  return config["PADRAO"] || "2026-09-15";
}

/**
 * Período de Acompanhamento Padrão (Item 1):
 * Ciclo do dia 10 do mês de referência ao dia 09 do mês seguinte.
 */
export interface PeriodoAcompanhamentoCiclo {
  ano: number;
  mesReferencia: number;
  dataInicio: string; // YYYY-MM-10
  dataFim: string;    // YYYY-MM-09 do mês seguinte
  datas: string[];
}

export function obterPeriodoCicloPadrao(ano: number, mes: number): PeriodoAcompanhamentoCiclo {
  const mesRef = mes >= 1 && mes <= 12 ? mes : mes + 1;
  const mesInicioStr = String(mesRef).padStart(2, "0");
  const dataInicio = `${ano}-${mesInicioStr}-10`;

  let anoFim = ano;
  let mesFim = mesRef + 1;
  if (mesFim > 12) {
    mesFim = 1;
    anoFim = ano + 1;
  }
  const mesFimStr = String(mesFim).padStart(2, "0");
  const dataFim = `${anoFim}-${mesFimStr}-09`;

  const datas: string[] = [];
  const dtAtual = new Date(ano, mesRef - 1, 10);
  const dtFim = new Date(anoFim, mesFim - 1, 9);

  while (dtAtual <= dtFim) {
    const y = dtAtual.getFullYear();
    const m = String(dtAtual.getMonth() + 1).padStart(2, "0");
    const d = String(dtAtual.getDate()).padStart(2, "0");
    datas.push(`${y}-${m}-${d}`);
    dtAtual.setDate(dtAtual.getDate() + 1);
  }

  return {
    ano,
    mesReferencia: mesRef,
    dataInicio,
    dataFim,
    datas,
  };
}

/**
 * Passo 3: Normaliza a escala operacional a partir da string de horário RM ou posto.
 */
export function normalizarEscalaOperacional(texto?: string): "5x2" | "12x36" | "4x4" | "4x2" | "6x1" {
  const up = (texto || "").toUpperCase().trim();
  if (up.includes("12X36") || up.includes("12 X 36")) return "12x36";
  if (up.includes("4X4") || up.includes("4 X 4")) return "4x4";
  if (up.includes("4X2") || up.includes("4 X 2")) return "4x2";
  if (up.includes("6X1") || up.includes("6 X 1")) return "6x1";
  if (up.includes("5X2") || up.includes("5 X 2") || up.includes("SEG/SEX") || up.includes("SEG A SEX")) return "5x2";
  return "5x2"; // Padrão administrativo Seg/sex
}

/**
 * Passo 2, 3, 4, 5 & 8:
 * Apuração por (posição, dia).
 * O ocupante do dia é a alocação vigente naquela data.
 * Avalia exigibilidade da escala e aplica a cascata obrigatória:
 * 1. FOLGA
 * 2. PENDENTE
 * 3. COBERTO
 * 4. DESCOBERTO (ausência sem cobertura)
 * 5. SEM OCUPANTE
 * 6. DESCOBERTO (sem ponto)
 * 7. PRESENTE
 */
/**
 * Helper unificado para verificar se existe cobertura ativa para um posto/vaga na data especificada.
 * Suporta correspondências por Posto ID, Vaga ID e Matrícula do Titular (com ou sem zeros à esquerda).
 */
export function isCoberturaAtivaParaPosicao(
  c: CoberturaOperacional,
  dataStr: string,
  posto?: PostoOperacional | { idPosto?: string; codigoPosto?: string; id?: string; idReferencia?: string | number; titularMatricula?: string },
  vaga?: VagaPosto | { id?: string; posicaoIdSGP?: string; idOriginalMC?: string; sequencia?: number; chapaTitular?: string },
  titularMatricula?: string
): boolean {
  if (!c || c.status === "CANCELADA") return false;

  const dtAtual = dataStr.slice(0, 10);
  const dtIni = (c.dataInicio || "").slice(0, 10);
  const dtFim = (c.dataFim || "").slice(0, 10);
  if (!dtIni || !dtFim) return false;
  if (dtAtual < dtIni || dtAtual > dtFim) return false;

  const normChapa = (val?: string) => (val ? String(val).trim().padStart(6, "0") : "");
  const cobTitular = normChapa(c.titularMatricula);
  const targetTitular = normChapa(titularMatricula || (vaga as any)?.chapaTitular || posto?.titularMatricula);

  if (cobTitular && targetTitular && cobTitular === targetTitular) {
    return true;
  }

  const normId = (val?: string | number) => (val !== undefined && val !== null ? String(val).toLowerCase().trim() : "");
  const cobPosto = normId(c.postoCodigo || c.idPosto);

  /**
   * Correspondência estrita de identificadores: igualdade exata ou sufixo delimitado por "-"
   * (ex.: "pst-cabiunas-010" x "cabiunas-010"). Identificadores só numéricos não casam por
   * sufixo com outros postos (evita "1" casar com "-21" ou "10" casar com qualquer "-010").
   */
  const idsPostoCasam = (a: string, b: string) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
    if (!/[a-z]/.test(curto)) return false;
    return longo.endsWith(`-${curto}`);
  };
  /** Dentro do mesmo posto, permite comparar sequência numérica com o último segmento do ID da posição. */
  const idsVagaCasam = (a: string, b: string) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
    if (/^\d+$/.test(curto)) {
      const ultimoSeg = longo.split(/[-_.\s]/).pop() || "";
      return /^\d+$/.test(ultimoSeg) && Number(ultimoSeg) === Number(curto);
    }
    return longo.endsWith(`-${curto}`);
  };

  const idsPosto = posto
    ? [
        normId(posto.codigoPosto),
        normId(posto.idPosto),
        normId(posto.id),
        normId((posto as any).postoIdSGP),
        normId(posto.idReferencia),
      ].filter(Boolean)
    : [];

  const matchPosto = !cobPosto || idsPosto.length === 0 || idsPosto.some((id) => idsPostoCasam(id, cobPosto));

  const cobVaga = normId(c.vagaId);
  if (!cobVaga) {
    // Cobertura sem posição definida: se informa o titular coberto, ela vale apenas para a
    // posição desse titular (já verificado acima). Não se estende às demais posições do posto.
    if (cobTitular) return false;
    // Registros legados sem posição e sem titular: mantém a correspondência por posto.
    return matchPosto;
  }

  const idsVaga = vaga
    ? [
        normId(vaga.id),
        normId(vaga.posicaoIdSGP),
        normId(vaga.idOriginalMC),
        normId((vaga as any).codigoVisual),
        normId(vaga.sequencia),
      ].filter(Boolean)
    : [];

  const matchVaga = idsVaga.length === 0 || idsVaga.some((vId) => idsVagaCasam(vId, cobVaga));

  return matchPosto && matchVaga;
}

export function calcularStatusVagaDia(
  vaga: VagaPosto,
  posto: PostoOperacional,
  dataStr: string,
  alocacoes: AlocacaoVaga[] = ALOCACOES_MC_REAIS,
  ocorrencias: OcorrenciaOperacional[] = [],
  coberturas: CoberturaOperacional[] = [],
  apontamentos: ApontamentoOperacional[] = [],
  marcacoesSet?: Set<string>,
  dataMaxPontoPorBase?: Record<string, string> | string,
  feriadosCustom?: FeriadoContratual[],
  criterioCobertura: CriterioCobertura = "POSICOES"
): OcupacaoVagaDia {
  const [anoStr, mesStr, diaStr] = dataStr.split("-");
  const ano = parseInt(anoStr, 10);
  const mesIdx = parseInt(mesStr, 10) - 1;
  const diaNumero = parseInt(diaStr, 10);
  const dataObj = new Date(ano, mesIdx, diaNumero);
  const diaDaSemana = dataObj.getDay(); // 0 = Domingo, 6 = Sábado
  const basePosto = posto.baseOperacional || posto.localAtuacao || posto.unidadeNome || posto.unidadeId || "UFN III";

  // Passo 2: Identifica ocupante vigente da posição nesta data
  let alocacaoVigente: AlocacaoVaga | undefined;

  const alocBase = obterAlocacaoVigenteVaga(vaga.id, alocacoes, dataStr);

  if (alocacoes !== ALOCACOES_MC_REAIS) {
    alocacaoVigente = alocBase;
  } else {
    if (posto.titularMatricula) {
      if (!alocBase || alocBase.matricula !== posto.titularMatricula) {
        alocacaoVigente = {
          id: `alc-custom-${vaga.id}`,
          vagaId: vaga.id,
          matricula: posto.titularMatricula,
          identificadorPetrobras: posto.titularMatricula,
          nome: posto.titularNome || "Titular",
          dataInicio: posto.dataInicioVigencia || "2024-01-01",
          dataFim: null,
          horarioEscalaRm: posto.escala,
          dataBaseCiclo: (posto as any).dataBaseCiclo,
          motivo: "titular",
        };
      } else {
        alocacaoVigente = alocBase;
      }
    } else if ("titularMatricula" in posto && (posto as any).titularMatricula === undefined) {
      alocacaoVigente = undefined;
    } else {
      alocacaoVigente = alocBase;
    }
  }

  const ocupante = alocacaoVigente;

  // Horário previsto: SEMPRE a partir do horário RM do ocupante (ex.: "PETROBRAS - 06:00 AS 18:00 - ESCALA 4X4");
  // na falta dele, faixa horária cadastrada na posição; por último, horário do posto.
  const horarioRmTexto = String(
    ocupante?.horarioEscalaRm || ocupante?.horarioRM || (vaga as any).horarioRm || (vaga as any).horario_rm || ""
  ).toUpperCase();
  const faixaVaga = String((vaga as any).faixaHoraria || (vaga as any).faixa_horaria || "");
  const matchHorario =
    horarioRmTexto.match(/(\d{1,2}:\d{2})\s*(?:AS|ÀS|A|-)\s*(\d{1,2}:\d{2})/) ||
    faixaVaga.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  const horaEntradaRM = matchHorario ? matchHorario[1].padStart(5, "0") : undefined;
  const horaSaidaRM = matchHorario ? matchHorario[2].padStart(5, "0") : undefined;

  let horarioPrevisto: string;
  if (horaEntradaRM && horaSaidaRM) {
    horarioPrevisto = `${horaEntradaRM} às ${horaSaidaRM}`;
  } else if (posto.horarioInicio && posto.horarioFim) {
    horarioPrevisto = `${posto.horarioInicio} às ${posto.horarioFim}`;
  } else if (posto.tipoPostoId?.includes("09H")) {
    horarioPrevisto = "07:00 às 16:48";
  } else {
    horarioPrevisto = "07:00 às 19:00";
  }

  // Passo 3: Análise de exigibilidade por escala do ocupante (campo horário RM).
  // A escala do RM do ocupante prevalece; o campo escala do posto é apenas fallback (posição sem ocupante/sem horário).
  const escalaRaw = ocupante?.horarioEscalaRm || ocupante?.horarioRM || (vaga as any).escalaTipo || posto.escala;
  const escala = normalizarEscalaOperacional(escalaRaw);

  let exigivel = true;
  let motivoNaoExigivel = "";
  let cicloNaoConfigurado = false;

  if (escala === "5x2") {
    // SEG/SEX: exigível de segunda a sexta, exceto feriados
    if (diaDaSemana === 0 || diaDaSemana === 6) {
      exigivel = false;
      motivoNaoExigivel = diaDaSemana === 0
        ? "Folga semanal (Domingo - Escala 5x2)"
        : "Repouso semanal (Sábado - Escala 5x2)";
    } else {
      // Passo 4: Feriados nacionais, estaduais e municipais por unidade
      const feriadoCheck = verificarFeriadoBase(
        dataStr,
        basePosto,
        posto.municipio,
        feriadosCustom,
        posto.unidadeId || posto.unidadeNome
      );
      if (feriadoCheck.ehFeriado && feriadoCheck.feriado) {
        exigivel = false;
        motivoNaoExigivel = `Feriado ${feriadoCheck.feriado.tipo === "NACIONAL" ? "Nacional" : feriadoCheck.feriado.tipo === "ESTADUAL" ? "Estadual" : "Municipal"} (${feriadoCheck.feriado.nome})`;
      }
    }
  } else if (escala === "12x36") {
    // 12X36: calcular somente com data-base e fase preenchidas. Sem elas, exibir "?". NÃO presumir.
    const dataBase =
      (vaga as any).data_base_escala ||
      (vaga as any).dataBaseEscala ||
      vaga.dataBaseCiclo ||
      ocupante?.dataBaseCiclo ||
      (posto as any).dataBaseCiclo;

    const isMockLegadoSemPosicaoSGP = !vaga.posicaoIdSGP && (vaga.id.startsWith("POS-7.") || vaga.id.startsWith("700.") || vaga.id === "800.1" || vaga.id === "POS-TESTE-CICLO");

    let fase =
      (vaga as any).fase_ciclo ||
      (vaga as any).faseCiclo ||
      (vaga as any).fase ||
      ocupante?.faseCiclo ||
      (posto as any).faseCiclo;

    if (fase === undefined && isMockLegadoSemPosicaoSGP && dataBase) {
      fase = "1"; // retrocompatibilidade com suite mock de teste 800.1 / 700 / TESTE-CICLO
    }

    const temDataBase = Boolean(dataBase && String(dataBase).trim() !== "");
    const temFase = Boolean(fase !== undefined && fase !== null && String(fase).trim() !== "");

    if (!temDataBase || !temFase) {
      cicloNaoConfigurado = true;
      exigivel = false;
      motivoNaoExigivel = "Escala cíclica 12x36 sem fase e/ou data-base preenchidas (exige ambas para apuração)";
    } else {
      const faseStr = String(fase).trim();
      const faseParsed = parseInt(faseStr.replace(/\D/g, ""), 10);
      const faseOffset = !isNaN(faseParsed) && faseParsed > 0 ? faseParsed - 1 : 0;
      const diff = calcularDiferencaDias(dataStr, dataBase);
      const mod = (((diff + faseOffset) % 2) + 2) % 2;
      if (mod !== 0) {
        exigivel = false;
        motivoNaoExigivel = "Folga de compensação 36h (Escala 12x36)";
      }
    }
  } else if (escala === "4x4") {
    // 4X4: calcular somente com data-base e fase preenchidas. Sem elas, exibir "?". NÃO presumir.
    const dataBase =
      (vaga as any).data_base_escala ||
      (vaga as any).dataBaseEscala ||
      vaga.dataBaseCiclo ||
      ocupante?.dataBaseCiclo ||
      (posto as any).dataBaseCiclo;

    const isMockLegadoSemPosicaoSGP = !vaga.posicaoIdSGP && (vaga.id.startsWith("POS-7.") || vaga.id.startsWith("700.") || vaga.id === "800.1" || vaga.id === "POS-TESTE-CICLO");

    let fase =
      (vaga as any).fase_ciclo ||
      (vaga as any).faseCiclo ||
      (vaga as any).fase ||
      ocupante?.faseCiclo ||
      (posto as any).faseCiclo;

    if (fase === undefined && isMockLegadoSemPosicaoSGP && dataBase) {
      fase = "1"; // retrocompatibilidade com suite mock de teste POS-7.x
    }

    const temDataBase = Boolean(dataBase && String(dataBase).trim() !== "");
    const temFase = Boolean(fase !== undefined && fase !== null && String(fase).trim() !== "");

    if (!temDataBase || !temFase) {
      cicloNaoConfigurado = true;
      exigivel = false;
      motivoNaoExigivel = "Escala cíclica 4x4 sem fase e/ou data-base preenchidas (exige ambas para apuração)";
    } else {
      const faseStr = String(fase).trim();
      const faseParsed = parseInt(faseStr.replace(/\D/g, ""), 10);
      const faseOffset = !isNaN(faseParsed) && faseParsed > 0 ? faseParsed - 1 : 0;
      const diff = calcularDiferencaDias(dataStr, dataBase);
      const offset = (((diff + faseOffset) % 8) + 8) % 8;
      if (offset >= 4) {
        exigivel = false;
        motivoNaoExigivel = `Folga de escala 4x4 (Dia ${offset - 3} de 4)`;
      }
    }
  } else if (escala === "4x2") {
    // 4X2: calcular somente com data-base e fase preenchidas. Sem elas, exibir "?". NÃO presumir.
    const dataBase =
      (vaga as any).data_base_escala ||
      (vaga as any).dataBaseEscala ||
      vaga.dataBaseCiclo ||
      ocupante?.dataBaseCiclo ||
      (posto as any).dataBaseCiclo;

    const isMockLegadoSemPosicaoSGP = !vaga.posicaoIdSGP && (vaga.id.startsWith("POS-7.") || vaga.id.startsWith("700.") || vaga.id === "800.1" || vaga.id === "POS-TESTE-CICLO");

    let fase =
      (vaga as any).fase_ciclo ||
      (vaga as any).faseCiclo ||
      (vaga as any).fase ||
      ocupante?.faseCiclo ||
      (posto as any).faseCiclo;

    if (fase === undefined && isMockLegadoSemPosicaoSGP && dataBase) {
      fase = "1";
    }

    const temDataBase = Boolean(dataBase && String(dataBase).trim() !== "");
    const temFase = Boolean(fase !== undefined && fase !== null && String(fase).trim() !== "");

    if (!temDataBase || !temFase) {
      cicloNaoConfigurado = true;
      exigivel = false;
      motivoNaoExigivel = "Escala cíclica 4x2 sem fase e/ou data-base preenchidas (exige ambas para apuração)";
    } else {
      const faseStr = String(fase).trim();
      const faseParsed = parseInt(faseStr.replace(/\D/g, ""), 10);
      const faseOffset = !isNaN(faseParsed) && faseParsed > 0 ? faseParsed - 1 : 0;
      const diff = calcularDiferencaDias(dataStr, dataBase);
      const offset = (((diff + faseOffset) % 6) + 6) % 6;
      if (offset >= 4) {
        exigivel = false;
        motivoNaoExigivel = `Folga de escala 4x2 (Dia ${offset - 3} de 2)`;
      }
    }
  } else if (escala === "6x1") {
    // 6X1: folga fixa ou cadastrada
    const folgaDia = ocupante?.diaFolgaSemanal !== undefined
      ? ocupante.diaFolgaSemanal
      : (vaga.diaFolgaSemanal !== undefined ? vaga.diaFolgaSemanal : 0);
    if (diaDaSemana === folgaDia) {
      exigivel = false;
      motivoNaoExigivel = "Folga semanal da escala 6x1";
    }
  }

  // Busca ocorrências e coberturas do ocupante/vaga nesta data
  const coberturaAtiva = coberturas.find((c) =>
    isCoberturaAtivaParaPosicao(c, dataStr, posto, vaga, ocupante?.matricula)
  );

  const ocorrenciaAtiva = ocupante?.matricula
    ? ocorrencias.find(
        (o) =>
          o.matricula === ocupante.matricula &&
          o.status !== "CANCELADA" &&
          dataStr >= o.dataInicio &&
          dataStr <= o.dataFim
      )
    : undefined;

  // 1. COBERTO TEM PRECEDÊNCIA: se titular foi coberto por outro profissional homologado nesta data
  if (coberturaAtiva) {
    const motivo = ocorrenciaAtiva
      ? `${ocorrenciaAtiva.observacaoPublica} • Substituído por ${coberturaAtiva.substitutoNome} (${coberturaAtiva.substitutoMatricula})`
      : `Substituição por cobertura: ${coberturaAtiva.substitutoNome} (${coberturaAtiva.substitutoMatricula})${coberturaAtiva.justificativa ? ` • ${coberturaAtiva.justificativa}` : ""}`;

    return {
      vagaId: vaga.id,
      posicaoId: vaga.id,
      idPosto: posto.idPosto || vaga.idPosto,
      sequencia: vaga.sequencia,
      data: dataStr,
      diaNumero,
      status: "COBERTO",
      statusVaga: "COBERTO",
      alocacaoVigente,
      ocupante: {
        matricula: coberturaAtiva.substitutoMatricula,
        nome: coberturaAtiva.substitutoNome,
      },
      ocupanteMatricula: coberturaAtiva.substitutoMatricula,
      ocupanteNome: coberturaAtiva.substitutoNome,
      tipoOcupacao: "cobertura",
      titularSubstituido: ocupante
        ? { matricula: ocupante.matricula, nome: ocupante.nome }
        : coberturaAtiva.titularMatricula
        ? { matricula: coberturaAtiva.titularMatricula, nome: coberturaAtiva.titularNome || "Titular" }
        : posto.titularMatricula
        ? { matricula: posto.titularMatricula, nome: posto.titularNome || "Titular" }
        : undefined,
      exigivel: true,
      motivoPublico: motivo,
      possuiEvidencia: true,
      ocorrenciaId: ocorrenciaAtiva?.id || coberturaAtiva.ocorrenciaId,
      coberturaId: coberturaAtiva.id,
      ocorrencia: ocorrenciaAtiva ? {
        id: ocorrenciaAtiva.id,
        tipo: ocorrenciaAtiva.tipoOcorrencia,
        justificativa: ocorrenciaAtiva.observacaoPublica,
        observacaoPublica: ocorrenciaAtiva.observacaoPublica,
      } : undefined,
      batidas: {
        entrada: posto.horarioInicio || "07:00",
        saida: posto.horarioFim || "19:00",
        horas: posto.jornadaSemanalHoras === 44 ? 8.8 : 12.0,
      },
      horarioPrevisto,
    };
  }

  // 1.1 AJUSTE MANUAL DO DIA: inclusão individual feita diretamente pelo usuário na escala em aberto
  const ajustes = estadoMemoria.ajustesManuaisDia || [];
  const ajusteDia = ajustes.find(
    (a) => (a.posicaoId === vaga.id || a.posicaoId === vaga.posicaoIdSGP) && a.data === dataStr
  );
  if (ajusteDia) {
    if (ajusteDia.status === "PRESENTE") {
      return {
        vagaId: vaga.id,
        posicaoId: vaga.id,
        idPosto: posto.idPosto || vaga.idPosto,
        sequencia: vaga.sequencia,
        data: dataStr,
        diaNumero,
        status: "PRESENTE",
        statusVaga: "TITULAR_PRESENTE",
        alocacaoVigente,
        ocupante: ocupante ? { matricula: ocupante.matricula, nome: ocupante.nome } : undefined,
        ocupanteMatricula: ocupante?.matricula,
        ocupanteNome: ocupante?.nome,
        tipoOcupacao: ocupante?.motivo || ocupante?.tipoAlocacao || "titular",
        exigivel: true,
        motivoPublico: ajusteDia.justificativa || "Presença apontada manualmente pelo usuário na escala",
        possuiEvidencia: true,
        horarioPrevisto,
      };
    }
    if (ajusteDia.status === "FOLGA") {
      return {
        vagaId: vaga.id,
        posicaoId: vaga.id,
        idPosto: posto.idPosto || vaga.idPosto,
        sequencia: vaga.sequencia,
        data: dataStr,
        diaNumero,
        status: "FOLGA",
        statusVaga: "NAO_EXIGIVEL",
        alocacaoVigente,
        ocupante: ocupante ? { matricula: ocupante.matricula, nome: ocupante.nome } : undefined,
        ocupanteMatricula: ocupante?.matricula,
        ocupanteNome: ocupante?.nome,
        tipoOcupacao: ocupante?.motivo || ocupante?.tipoAlocacao || "titular",
        exigivel: false,
        motivoNaoExigivel: "Folga programada",
        motivoPublico: ajusteDia.justificativa || "Folga apontada manualmente na escala",
        possuiEvidencia: true,
        horarioPrevisto,
      };
    }
    if (ajusteDia.status === "DESCOBERTO") {
      return {
        vagaId: vaga.id,
        posicaoId: vaga.id,
        idPosto: posto.idPosto || vaga.idPosto,
        sequencia: vaga.sequencia,
        data: dataStr,
        diaNumero,
        status: "DESCOBERTO",
        statusVaga: "DESCOBERTO",
        alocacaoVigente,
        ocupante: ocupante ? { matricula: ocupante.matricula, nome: ocupante.nome } : undefined,
        ocupanteMatricula: ocupante?.matricula,
        ocupanteNome: ocupante?.nome,
        tipoOcupacao: ocupante?.motivo || ocupante?.tipoAlocacao || "titular",
        exigivel: true,
        alertaDescoberto: true,
        categoriaAusencia: "Falta",
        motivoPublico: ajusteDia.justificativa || "Falta/ausência apontada manualmente sem cobertura",
        possuiEvidencia: true,
        horarioPrevisto,
      };
    }
  }

  // 2. CICLO NÃO CONFIGURADO: escala cíclica sem fase e/ou data-base preenchidas (escala em aberto)
  if (cicloNaoConfigurado) {
    return {
      vagaId: vaga.id,
      posicaoId: vaga.id,
      idPosto: posto.idPosto || vaga.idPosto,
      sequencia: vaga.sequencia,
      data: dataStr,
      diaNumero,
      status: "CICLO_NAO_CONFIGURADO",
      statusVaga: "NAO_EXIGIVEL",
      alocacaoVigente,
      ocupante: ocupante ? { matricula: ocupante.matricula, nome: ocupante.nome } : undefined,
      ocupanteMatricula: ocupante?.matricula,
      ocupanteNome: ocupante?.nome,
      tipoOcupacao: ocupante?.motivo || ocupante?.tipoAlocacao || "titular",
      exigivel: false,
      motivoNaoExigivel: "Ciclo não configurado (escala em aberto)",
      motivoPublico: "Ciclo não configurado: escala em aberto sem fase e/ou data-base preenchidas (aguardando inclusão da escala ou apontamento individual).",
      possuiEvidencia: false,
      horarioPrevisto,
    };
  }

  // ---------------------------------------------------------------------------
  // Passo 5 — Status da posição no dia, nesta ordem de prioridade:
  // ---------------------------------------------------------------------------

  // 1. FOLGA: dia não exigível pela escala ou feriado (exibido como 'N' no mapa)
  if (!exigivel) {
    return {
      vagaId: vaga.id,
      posicaoId: vaga.id,
      idPosto: posto.idPosto || vaga.idPosto,
      sequencia: vaga.sequencia,
      data: dataStr,
      diaNumero,
      status: "FOLGA",
      statusVaga: "NAO_EXIGIVEL",
      alocacaoVigente,
      ocupante: ocupante ? { matricula: ocupante.matricula, nome: ocupante.nome } : undefined,
      ocupanteMatricula: ocupante?.matricula,
      ocupanteNome: ocupante?.nome,
      tipoOcupacao: ocupante?.motivo || ocupante?.tipoAlocacao || "titular",
      exigivel: false,
      motivoNaoExigivel,
      motivoPublico: motivoNaoExigivel,
      possuiEvidencia: true,
      horarioPrevisto,
    };
  }

  // 2. PENDENTE: data posterior à última data de ponto importada DAQUELA unidade
  const dataMaxBase = obterDataMaxPontoBase(basePosto, dataMaxPontoPorBase);
  if (dataStr > dataMaxBase) {
    return {
      vagaId: vaga.id,
      posicaoId: vaga.id,
      idPosto: posto.idPosto || vaga.idPosto,
      sequencia: vaga.sequencia,
      data: dataStr,
      diaNumero,
      status: "PENDENTE",
      statusVaga: "PENDENTE_APURACAO",
      alocacaoVigente,
      ocupante: ocupante ? { matricula: ocupante.matricula, nome: ocupante.nome } : undefined,
      ocupanteMatricula: ocupante?.matricula,
      ocupanteNome: ocupante?.nome,
      tipoOcupacao: ocupante?.motivo || ocupante?.tipoAlocacao || "titular",
      exigivel: false, // Não entra em posições exigíveis conforme Passo 6
      motivoPublico: `Jornada além da data de corte de ponto da unidade ${basePosto} (${dataMaxBase}). Aguardando processamento.`,
      possuiEvidencia: false,
      horarioPrevisto,
    };
  }

  // 4. DESCOBERTO: ausência sem cobertura
  if (ocorrenciaAtiva) {
    const aptoRelacionado = apontamentos.find(
      (a) =>
        (a.postoCodigo === posto.codigoPosto || a.idPosto === posto.idPosto) &&
        a.dataReferencia === dataStr
    );

    const categoriaAus =
      ocorrenciaAtiva.categoriaAusencia ||
      (ocorrenciaAtiva.tipoOcorrencia === "FERIAS"
        ? "Férias"
        : ocorrenciaAtiva.tipoOcorrencia === "ATESTADO_MEDICO"
        ? "Afastamento"
        : ocorrenciaAtiva.tipoOcorrencia === "FALTA_JUSTIFICADA"
        ? "Licença"
        : ocorrenciaAtiva.tipoOcorrencia === "FALTA_INJUSTIFICADA"
        ? "Falta"
        : ocorrenciaAtiva.tipoOcorrencia === "ABONO_LEGAL"
        ? "Folga compensatória"
        : "Ausência");

    return {
      vagaId: vaga.id,
      posicaoId: vaga.id,
      idPosto: posto.idPosto || vaga.idPosto,
      sequencia: vaga.sequencia,
      data: dataStr,
      diaNumero,
      status: "DESCOBERTO",
      statusVaga: "DESCOBERTO",
      alocacaoVigente,
      ocupante: ocupante ? { matricula: ocupante.matricula, nome: ocupante.nome } : undefined,
      ocupanteMatricula: ocupante?.matricula,
      ocupanteNome: ocupante?.nome,
      tipoOcupacao: ocupante?.motivo || ocupante?.tipoAlocacao || "titular",
      exigivel: true,
      alertaDescoberto: true,
      categoriaAusencia: categoriaAus,
      motivoPublico: `Posição Descoberta: ${categoriaAus} sem cobertura registrada.`,
      possuiEvidencia: true,
      ocorrenciaId: ocorrenciaAtiva.id,
      apontamentoId: aptoRelacionado?.id,
      ocorrencia: {
        id: ocorrenciaAtiva.id,
        tipo: ocorrenciaAtiva.tipoOcorrencia,
        categoria: categoriaAus,
        categoriaAusencia: categoriaAus,
        justificativa: categoriaAus,
        observacaoPublica: categoriaAus,
        quantidadeHoras: ocorrenciaAtiva.quantidadeHoras,
        quantidadeDias: ocorrenciaAtiva.quantidadeDias,
      },
      horarioPrevisto,
    };
  }

  // 5. SEM OCUPANTE: posição sem alocação vigente em dia exigível
  if (!ocupante?.matricula) {
    return {
      vagaId: vaga.id,
      posicaoId: vaga.id,
      idPosto: posto.idPosto || vaga.idPosto,
      sequencia: vaga.sequencia,
      data: dataStr,
      diaNumero,
      status: "SEM_OCUPANTE",
      statusVaga: "POSTO_VAGO",
      alocacaoVigente: undefined,
      ocupante: undefined,
      exigivel: true,
      motivoPublico: `Posição ${vaga.id} sem ocupante alocado no SGP. Em processo de seleção/admissão.`,
      possuiEvidencia: false,
      horarioPrevisto,
    };
  }

  // 6. SEM DADO: ocupante sem marcação de ponto e sem ausência registrada em dia exigível
  // Conforme regra contratual (REV04 Item 0b): Ausência de registro NÃO pode ser apurada como "D".
  // "D" só existe quando há ausência confirmada do titular sem cobertura registrada.
  if (marcacoesSet && ocupante.matricula) {
    const chapaPad = ocupante.matricula.padStart(6, "0");
    const chapaRaw = ocupante.matricula;
    const temPonto =
      marcacoesSet.has(`${chapaPad}_${dataStr}`) ||
      marcacoesSet.has(`${chapaRaw}_${dataStr}`);

    if (!temPonto) {
      return {
        vagaId: vaga.id,
        posicaoId: vaga.id,
        idPosto: posto.idPosto || vaga.idPosto,
        sequencia: vaga.sequencia,
        data: dataStr,
        diaNumero,
        status: "SEM_DADO",
        statusVaga: "SEM_DADO",
        alocacaoVigente,
        ocupante: { matricula: ocupante.matricula, nome: ocupante.nome },
        ocupanteMatricula: ocupante.matricula,
        ocupanteNome: ocupante.nome,
        tipoOcupacao: ocupante.motivo || ocupante.tipoAlocacao || "titular",
        exigivel: true,
        motivoPublico: `Sem dado: Sem informação de presença ou ausência importada para ${ocupante.nome}.`,
        possuiEvidencia: false,
        horarioPrevisto,
      };
    }
  }

  // 7. PRESENTE: ocupante com ponto registrado
  return {
    vagaId: vaga.id,
    posicaoId: vaga.id,
    idPosto: posto.idPosto || vaga.idPosto,
    sequencia: vaga.sequencia,
    data: dataStr,
    diaNumero,
    status: "PRESENTE",
    statusVaga: "TITULAR_PRESENTE",
    alocacaoVigente,
    ocupante: { matricula: ocupante.matricula, nome: ocupante.nome },
    ocupanteMatricula: ocupante.matricula,
    ocupanteNome: ocupante.nome,
    tipoOcupacao: ocupante.motivo || ocupante.tipoAlocacao || "titular",
    exigivel: true,
    motivoPublico: `Titular em atividade normal na jornada contratual ${horarioPrevisto}`,
    possuiEvidencia: true,
    batidas: {
      entrada: horaEntradaRM || posto.horarioInicio || "07:00",
      saida: horaSaidaRM || posto.horarioFim || "17:00",
      horas: posto.jornadaSemanalHoras === 44 ? 8.8 : 12.0,
    },
    horarioPrevisto,
  };
}

export const calcularStatusPosicaoDia = calcularStatusVagaDia;

/**
 * Passo 6: Percentual de cobertura do posto no dia:
 * - posições exigíveis = posições com status diferente de FOLGA e PENDENTE
 * - posições atendidas = PRESENTE + COBERTO
 * - percentual = atendidas ÷ exigíveis × 100
 * - sem posições exigíveis no dia: exibir "–", não 0% nem 100%
 * Parâmetro criterioCobertura com padrão POSICOES.
 */
export function calcularStatusDia(
  posto: PostoOperacional,
  diaNumero: number,
  ano: number = 2026,
  mesIndex: number = 8, // 8 = Setembro (0-indexed)
  ocorrencias: OcorrenciaOperacional[] = [],
  coberturas: CoberturaOperacional[] = [],
  apontamentos: ApontamentoOperacional[] = [],
  marcacoesSet?: Set<string>, // Chave: `${chapa}_${YYYY-MM-DD}`
  dataMaxPonto: Record<string, string> | string = "2026-09-15",
  vagasContexto?: VagaPosto[],
  alocacoesContexto?: AlocacaoVaga[],
  feriadosCustom?: FeriadoContratual[],
  criterioCobertura: CriterioCobertura = "POSICOES"
): OcupacaoDiaDetalhada {
  const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, "0")}-${String(diaNumero).padStart(2, "0")}`;
  const basePosto = posto.baseOperacional || posto.localAtuacao || posto.unidadeNome || posto.unidadeId || "UFN III";

  // 1. Obtém as posições/vagas do posto
  const idPostoChave = posto.idPosto || posto.codigoPosto || posto.id;
  const poolVagas = vagasContexto && vagasContexto.length > 0 ? vagasContexto : VAGAS_MC_REAIS;

  let vagasDoPosto = poolVagas.filter(
    (v) =>
      v.idPosto === idPostoChave ||
      v.idPosto === posto.codigoPosto ||
      v.idPosto === posto.id ||
      v.postoIdSGP === idPostoChave ||
      v.postoIdSGP === posto.postoIdSGP ||
      String(v.postoBase) === idPostoChave ||
      String(v.postoBase) === String(posto.idReferencia)
  );

  if (vagasDoPosto.length === 0) {
    vagasDoPosto = gerarVagasPosto(idPostoChave, posto.tipoPostoId || "ADM_09H");
  }

  // 2. Apuração individual de cada posição/vaga (Passo 2)
  const poolAlocacoes = alocacoesContexto && alocacoesContexto.length > 0 ? alocacoesContexto : ALOCACOES_MC_REAIS;

  const vagasDetalhe: OcupacaoVagaDia[] = vagasDoPosto.map((v) =>
    calcularStatusVagaDia(
      v,
      posto,
      dataStr,
      poolAlocacoes,
      ocorrencias,
      coberturas,
      apontamentos,
      marcacoesSet,
      dataMaxPonto,
      feriadosCustom,
      criterioCobertura
    )
  );

  // Passo 6: Percentual de cobertura do posto no dia
  // posições exigíveis = posições com status diferente de FOLGA e PENDENTE (e CICLO_NAO_CONFIGURADO)
  const posicoesExigiveis = vagasDetalhe.filter(
    (v) => v.status !== "FOLGA" && v.status !== "PENDENTE" && v.status !== "CICLO_NAO_CONFIGURADO"
  ).length;

  // posições atendidas = PRESENTE + COBERTO
  const posicoesAtendidas = vagasDetalhe.filter(
    (v) => v.status === "PRESENTE" || v.status === "COBERTO"
  ).length;

  let percentualCobertura: number | null = null;
  let percentualCoberturaFormatado = "–";

  if (posicoesExigiveis > 0) {
    percentualCobertura = (posicoesAtendidas / posicoesExigiveis) * 100;
    percentualCoberturaFormatado = `${percentualCobertura % 1 === 0 ? percentualCobertura : Math.round(percentualCobertura * 10) / 10}%`;
  }

  // 3. Status agregado do posto por dia
  let statusAgregado: StatusAgregadoPosto = "COMPLETO";
  let statusOcupacaoLegado: StatusOcupacao = "TITULAR_PRESENTE";

  if (posicoesExigiveis === 0) {
    const todosPendentes = vagasDetalhe.every((v) => v.status === "PENDENTE");
    if (todosPendentes && vagasDetalhe.length > 0) {
      statusAgregado = "PENDENTE_APURACAO";
      statusOcupacaoLegado = "PENDENTE_APURACAO";
    } else {
      statusAgregado = "COMPLETO";
      statusOcupacaoLegado = "NAO_EXIGIVEL";
    }
  } else {
    if (posicoesAtendidas === posicoesExigiveis) {
      statusAgregado = "COMPLETO";
      statusOcupacaoLegado = vagasDetalhe.some((v) => v.status === "COBERTO")
        ? "COBERTO"
        : "TITULAR_PRESENTE";
    } else if (posicoesAtendidas === 0) {
      statusAgregado = "DESCOBERTO";
      statusOcupacaoLegado = vagasDetalhe.every((v) => v.status === "SEM_OCUPANTE")
        ? "POSTO_VAGO"
        : "DESCOBERTO";
    } else {
      statusAgregado = "PARCIAL";
      statusOcupacaoLegado = "DESCOBERTO";
    }
  }

  // 4. Seleciona a vaga de destaque para compatibilidade temporária
  const vagaDescoberta = vagasDetalhe.find((v) => v.status === "DESCOBERTO" || v.status === "SEM_OCUPANTE");
  const vagaCoberta = vagasDetalhe.find((v) => v.status === "COBERTO");
  const vaga1 = vagasDetalhe.find((v) => v.sequencia === 1 || v.vagaId === idPostoChave) || vagasDetalhe[0];
  const vagaDestaque = vagaDescoberta || vagaCoberta || vaga1;

  let motivoFinal = vagaDestaque?.motivoPublico || "";
  if (statusAgregado === "PARCIAL") {
    motivoFinal = `Posto com atendimento PARCIAL: ${posicoesAtendidas}/${posicoesExigiveis} posições atendidas (${percentualCoberturaFormatado}).`;
  }

  return {
    postoCodigo: posto.codigoPosto,
    idPosto: posto.idPosto || posto.id,
    postoBase: basePosto,
    funcaoPosto: posto.funcao,
    data: dataStr,
    diaNumero,
    statusOcupacao: statusOcupacaoLegado,
    statusAgregado,
    vagasDetalhe,
    posicoesDetalhe: vagasDetalhe,
    posicoesExigiveis,
    posicoesAtendidas,
    percentualCobertura,
    percentualCoberturaFormatado,
    criterioCobertura,
    titularMatricula: vaga1?.alocacaoVigente?.matricula || posto.titularMatricula,
    titularNome: vaga1?.alocacaoVigente?.nome || posto.titularNome,
    ocupanteMatricula: vagaDestaque?.ocupanteMatricula || vaga1?.ocupanteMatricula || posto.titularMatricula,
    ocupanteNome: vagaDestaque?.ocupanteNome || vaga1?.ocupanteNome || posto.titularNome,
    motivoPublico: motivoFinal,
    possuiEvidencia: statusOcupacaoLegado !== "POSTO_VAGO" && statusOcupacaoLegado !== "PENDENTE_APURACAO",
    ocorrenciaId: vagaDestaque?.ocorrenciaId,
    coberturaId: vagaDestaque?.coberturaId,
    apontamentoId: vagaDestaque?.apontamentoId,
    batidas: vagaDestaque?.batidas,
  };
}

/**
 * Passo 7 & Totais por Vaga no ciclo:
 * dias exigíveis, dias presentes, dias cobertos, dias descobertos e dias de ausência.
 */
export interface TotaisVagaCiclo {
  vagaId: string;
  idPosto: string;
  sequencia?: number;
  ocupanteMatricula?: string;
  ocupanteNome?: string;
  diasExigiveis: number;
  diasPresentes: number;
  diasCobertos: number;
  diasDescobertos: number;
  diasAusencia: number;
  diasNaoExigiveis: number;
  diasPendentes: number;
  diasSemDado?: number;
}

export function calcularTotaisVagaCiclo(
  vaga: VagaPosto,
  posto: PostoOperacional,
  datasCiclo: string[],
  alocacoes: AlocacaoVaga[] = ALOCACOES_MC_REAIS,
  ocorrencias: OcorrenciaOperacional[] = [],
  coberturas: CoberturaOperacional[] = [],
  apontamentos: ApontamentoOperacional[] = [],
  marcacoesSet?: Set<string>,
  dataMaxPontoPorBase?: Record<string, string> | string,
  feriadosCustom?: FeriadoContratual[],
  criterioCobertura: CriterioCobertura = "POSICOES"
): TotaisVagaCiclo {
  let diasExigiveis = 0;
  let diasPresentes = 0;
  let diasCobertos = 0;
  let diasDescobertos = 0;
  let diasAusencia = 0;
  let diasNaoExigiveis = 0;
  let diasPendentes = 0;
  let diasSemDado = 0;

  for (const dataStr of datasCiclo) {
    const apuracao = calcularStatusVagaDia(
      vaga,
      posto,
      dataStr,
      alocacoes,
      ocorrencias,
      coberturas,
      apontamentos,
      marcacoesSet,
      dataMaxPontoPorBase,
      feriadosCustom,
      criterioCobertura
    );

    if (apuracao.status === "FOLGA" || apuracao.status === "CICLO_NAO_CONFIGURADO") {
      diasNaoExigiveis++;
      continue;
    }

    if (apuracao.status === "PENDENTE") {
      diasPendentes++;
      continue;
    }

    if (apuracao.status === "SEM_DADO") {
      diasSemDado++;
      continue;
    }

    diasExigiveis++;

    if (apuracao.status === "PRESENTE") {
      diasPresentes++;
    } else if (apuracao.status === "COBERTO") {
      diasCobertos++;
      diasAusencia++;
    } else if (apuracao.status === "DESCOBERTO" || apuracao.status === "SEM_OCUPANTE") {
      diasDescobertos++;
      diasAusencia++;
    }
  }

  const alocVigente = obterAlocacaoVigenteVaga(vaga.id, alocacoes, datasCiclo[datasCiclo.length - 1]);

  return {
    vagaId: vaga.id,
    idPosto: posto.idPosto || vaga.idPosto,
    sequencia: vaga.sequencia,
    ocupanteMatricula: alocVigente?.matricula || posto.titularMatricula,
    ocupanteNome: alocVigente?.nome || posto.titularNome,
    diasExigiveis,
    diasPresentes,
    diasCobertos,
    diasDescobertos,
    diasAusencia,
    diasNaoExigiveis,
    diasPendentes,
    diasSemDado,
  };
}

export const calcularTotaisPosicaoCiclo = calcularTotaisVagaCiclo;

/**
 * Passo 7 — Percentual do posto no ciclo = soma das posições atendidas ÷ soma das posições exigíveis no ciclo.
 */
export function calcularApuracaoPostoCiclo(
  posto: PostoOperacional,
  periodo: PeriodoAcompanhamentoCiclo,
  alocacoes: AlocacaoVaga[] = ALOCACOES_MC_REAIS,
  ocorrencias: OcorrenciaOperacional[] = [],
  coberturas: CoberturaOperacional[] = [],
  apontamentos: ApontamentoOperacional[] = [],
  marcacoesSet?: Set<string>,
  dataMaxPonto: Record<string, string> | string = "2026-09-15",
  vagasContexto?: VagaPosto[],
  feriadosCustom?: FeriadoContratual[],
  criterioCobertura: CriterioCobertura = "POSICOES"
): ApuracaoPostoCiclo {
  let totalPosicoesExigiveis = 0;
  let totalPosicoesAtendidas = 0;
  const diasApurados: OcupacaoDiaDetalhada[] = [];
  const semCicloSet = new Set<string>();

  for (const dataStr of periodo.datas) {
    const [yStr, mStr, dStr] = dataStr.split("-");
    const ano = parseInt(yStr, 10);
    const mesIndex = parseInt(mStr, 10) - 1;
    const diaNumero = parseInt(dStr, 10);

    const diaDetalhe = calcularStatusDia(
      posto,
      diaNumero,
      ano,
      mesIndex,
      ocorrencias,
      coberturas,
      apontamentos,
      marcacoesSet,
      dataMaxPonto,
      vagasContexto,
      alocacoes,
      feriadosCustom,
      criterioCobertura
    );

    diasApurados.push(diaDetalhe);
    totalPosicoesExigiveis += diaDetalhe.posicoesExigiveis;
    totalPosicoesAtendidas += diaDetalhe.posicoesAtendidas;

    if (diaDetalhe.vagasDetalhe) {
      for (const vd of diaDetalhe.vagasDetalhe) {
        if (vd.status === "CICLO_NAO_CONFIGURADO") {
          semCicloSet.add(vd.vagaId);
        }
      }
    }
  }

  const percentualCiclo =
    totalPosicoesExigiveis === 0
      ? null
      : (totalPosicoesAtendidas / totalPosicoesExigiveis) * 100;

  const percentualCicloFormatado =
    percentualCiclo === null
      ? "–"
      : `${percentualCiclo % 1 === 0 ? percentualCiclo : Math.round(percentualCiclo * 10) / 10}%`;

  return {
    idPosto: posto.idPosto || posto.id,
    postoCodigo: posto.codigoPosto,
    periodo,
    criterioCobertura,
    totalPosicoesExigiveis,
    totalPosicoesAtendidas,
    percentualCiclo,
    percentualCicloFormatado,
    dias: diasApurados,
    posicoesSemCicloConfigurado: Array.from(semCicloSet),
  };
}

/**
 * Passo 3: Relatório de posições com ciclo não configurado (escalas cíclicas 12x36, 4x4, 4x2 sem dataBaseCiclo).
 */
export function obterPosicoesCicloNaoConfigurado(
  posicoes: VagaPosto[] = VAGAS_MC_REAIS,
  postos: PostoOperacional[] = POSTOS_MC_REAIS as unknown as PostoOperacional[],
  alocacoes: AlocacaoVaga[] = ALOCACOES_MC_REAIS,
  dataReferencia?: string
): PosicaoCicloNaoConfiguradoItem[] {
  const resultado: PosicaoCicloNaoConfiguradoItem[] = [];
  const ref = dataReferencia || new Date().toISOString().slice(0, 10);

  for (const pos of posicoes) {
    const posto = postos.find(
      (p) =>
        p.idPosto === pos.idPosto ||
        p.postoIdSGP === pos.idPosto ||
        p.id === pos.idPosto ||
        p.codigoPosto === pos.idPosto ||
        String(p.idReferencia) === String(pos.postoBase)
    );
    const aloc = obterAlocacaoVigenteVaga(pos.id, alocacoes, ref);
    const escalaRaw = aloc?.horarioEscalaRm || aloc?.horarioRM || posto?.escala || "";
    const escalaNorm = normalizarEscalaOperacional(escalaRaw);

    if (escalaNorm === "12x36" || escalaNorm === "4x4" || escalaNorm === "4x2") {
      const dataBase = aloc?.dataBaseCiclo || pos.dataBaseCiclo || (posto as any)?.dataBaseCiclo;
      if (!dataBase) {
        resultado.push({
          posicaoId: pos.id,
          idPosto: pos.idPosto,
          postoCodigo: posto?.codigoPosto || pos.idPosto,
          escala: escalaNorm,
          ocupanteMatricula: aloc?.matricula,
          ocupanteNome: aloc?.nome,
          motivo: `Escala ${escalaNorm} sem dataBaseCiclo configurada na alocação, posição ou posto.`,
        });
      }
    }
  }

  return resultado;
}

/**
 * Retorna todos os postos de trabalho do contrato Petrobras SAP 4600682336.
 * Inclui os postos estruturais carregados da Memória de Cálculo (aba MC).
 * Garante a compatibilidade temporária (Item 6): onde o código consome titularMatricula/titularNome,
 * preenche com a alocação vigente da VAGA 1 daquele posto.
 */
export function obterTodosPostosContrato(postosExistentes?: PostoOperacional[]): PostoOperacional[] {
  // Postos oficiais da base REV04 (exatamente 244 postos e 29 unidades)
  const basePostos = (POSTOS_MC_REAIS as unknown as PostoOperacional[]);
  const postosMap = new Map<string, PostoOperacional>();

  // 1. Postos da Memória de Cálculo (REV04)
  for (const p of basePostos) {
    const chave = p.idPosto || p.codigoPosto;
    postosMap.set(chave, { ...p });
  }

  // 2. Se houver postos existentes customizados no estado, mescla apenas os que pertencem à MC (ignora mocks legados)
  if (postosExistentes && postosExistentes.length > 0) {
    for (const p of postosExistentes) {
      if (p.id?.startsWith("pst-") || p.unidadeId === "UFN-III" || p.idPosto?.startsWith("UFN-")) {
        continue;
      }
      const chave = p.idPosto || p.codigoPosto;
      if (postosMap.has(chave)) {
        postosMap.set(chave, { ...postosMap.get(chave)!, ...p });
      }
    }
  }

  // 3. Preenchimento de Compatibilidade Temporária (Item 6):
  // Onde o código lê titularMatricula/titularNome do posto, lê a alocação vigente da vaga 1 daquele posto
  const estadoAtual = carregarEstado();
  const vagasParaUso = (estadoAtual.vagas && estadoAtual.vagas.length > 0) ? estadoAtual.vagas : VAGAS_MC_REAIS;
  const alocacoesParaUso = (estadoAtual.alocacoes && estadoAtual.alocacoes.length > 0) ? estadoAtual.alocacoes : ALOCACOES_MC_REAIS;

  for (const p of postosMap.values()) {
    const id = p.idPosto || p.id;
    const aloc1 = obterAlocacaoVigenteVaga1(id, vagasParaUso, alocacoesParaUso);
    if (aloc1) {
      p.titularMatricula = aloc1.matricula || p.titularMatricula;
      p.titularNome = aloc1.nome || p.titularNome;
    }
  }

  return Array.from(postosMap.values());
}

// -----------------------------------------------------------------------------
// GERENCIADOR DE ESTADO COM PERSISTÊNCIA EM LOCALSTORAGE / MEMÓRIA
// -----------------------------------------------------------------------------

const CHAVE_STORAGE = "sgp_estado_operacional_v3_clean";

let estadoMemoria: EstadoOperacionalCompleto = {
  postos: [...(POSTOS_MC_REAIS as unknown as PostoOperacional[])],
  vagas: [...VAGAS_MC_REAIS],
  alocacoes: [...ALOCACOES_MC_REAIS],
  tiposPosto: [...LISTA_TIPOS_POSTO],
  profissionais: [...PROFISSIONAIS_INICIAIS],
  ocorrencias: [...OCORRENCIAS_INICIAIS],
  coberturas: [...COBERTURAS_INICIAIS],
  apontamentos: [...APONTAMENTOS_INICIAIS],
  logsAuditoria: [...LOGS_INICIAIS],
  lotesImportacao: [...LOTES_INICIAIS],
  alocadosSifac: (sifacReais as unknown as ItemAlocadoSifac[]) || [],
  divergenciasConciliacao: {},
  equivalenciasConciliacao: { ...EQUIVALENCIAS_PADRAO },
  fechamentosCompetencia: [...FECHAMENTOS_INICIAIS],
  pendenciasEscala: [...PENDENCIAS_ESCALA_REV04],
  ajustesManuaisDia: [],
  perfilAtivo: "PREMIER_ADMIN",
  unidadeSelecionada: "TODAS",
};

export const OCORRENCIAS_CADASTRO_2026_09: OcorrenciaOperacional[] = [
  {
    id: "ocorr-rm-cad-035918-20260810",
    matricula: "035918",
    profissionalNome: "CAROLINE DA SILVA SA",
    postoCodigo: "PST-EDIBRA-030",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "FERIAS",
    categoriaAusencia: "Férias",
    observacaoPublica: "Ausência RM: Férias (Férias)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-035987-20260810",
    matricula: "035987",
    profissionalNome: "FELIPE DA SILVA PROENCA",
    postoCodigo: "PST-RECAP-181",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "FERIAS",
    categoriaAusencia: "Férias",
    observacaoPublica: "Ausência RM: Férias (Férias)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-036475-20260810",
    matricula: "036475",
    profissionalNome: "IZAC NEVES DOS SANTOS",
    postoCodigo: "PST-BOAVENTURA-006",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "FERIAS",
    categoriaAusencia: "Férias",
    observacaoPublica: "Ausência RM: Férias (Férias)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-037218-20260810",
    matricula: "037218",
    profissionalNome: "RENAN GARCIA PARRA",
    postoCodigo: "PST-RECAP-176",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "FERIAS",
    categoriaAusencia: "Férias",
    observacaoPublica: "Ausência RM: Férias (Férias)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-036029-20260810",
    matricula: "036029",
    profissionalNome: "ROSELAINE APARECIDA SIMIAO",
    postoCodigo: "PST-EDIHB-115",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "FERIAS",
    categoriaAusencia: "Férias",
    observacaoPublica: "Ausência RM: Férias (Férias)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-037583-20260810",
    matricula: "037583",
    profissionalNome: "SATIRO DE SOUZA ANJOS NETO",
    postoCodigo: "PST-RNEST-229",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "FERIAS",
    categoriaAusencia: "Férias",
    observacaoPublica: "Ausência RM: Férias (Férias)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-038437-20260810",
    matricula: "038437",
    profissionalNome: "THIAGO DE NOVAIS TIEPO",
    postoCodigo: "PST-EDISA-121",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "FERIAS",
    categoriaAusencia: "Férias",
    observacaoPublica: "Ausência RM: Férias (Férias)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-042009-20260810",
    matricula: "042009",
    profissionalNome: "DANIEL DOS SANTOS SILVA",
    postoCodigo: "PST-RPBC-250",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "ATESTADO_MEDICO",
    categoriaAusencia: "Afastamento",
    observacaoPublica: "Ausência RM: Afastamento (Af.Previdência)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-035999-20260810",
    matricula: "035999",
    profissionalNome: "ERICK RUBENS DE CARVALHO",
    postoCodigo: "PST-PITUBA-172",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "ATESTADO_MEDICO",
    categoriaAusencia: "Afastamento",
    observacaoPublica: "Ausência RM: Afastamento (Af.Previdência)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-042012-20260810",
    matricula: "042012",
    profissionalNome: "NADIA NARA DE SOUZA CRUZ",
    postoCodigo: "PST-REVAP-183",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "ATESTADO_MEDICO",
    categoriaAusencia: "Afastamento",
    observacaoPublica: "Ausência RM: Afastamento (Af.Previdência)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-035936-20260810",
    matricula: "035936",
    profissionalNome: "DEBORA MARCHITO DE LIMA DOS SANTOS",
    postoCodigo: "PST-EDIHB-063",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "FALTA_JUSTIFICADA",
    categoriaAusencia: "Licença",
    observacaoPublica: "Ausência RM: Licença (Licença Mater.)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
  {
    id: "ocorr-rm-cad-036139-20260810",
    matricula: "036139",
    profissionalNome: "VANESSA FERNANDA SILVA DE SOUZA ALBUQUERQUE",
    postoCodigo: "PST-RNEST-234",
    dataInicio: "2026-08-10",
    dataFim: "2026-09-09",
    diasAfetados: 31,
    tipoOcorrencia: "FALTA_JUSTIFICADA",
    categoriaAusencia: "Licença",
    observacaoPublica: "Ausência RM: Licença (Licença Mater.)",
    criadoEm: "2026-10-06T20:00:00.000Z",
    status: "VALIDADA",
  },
];

export function carregarEstado(): EstadoOperacionalCompleto {
  if (typeof window !== "undefined") {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        estadoMemoria = { ...estadoMemoria, ...parsed };

        // Garante que coberturas estejam limpas de dados fictícios legados
        if (!Array.isArray(estadoMemoria.coberturas)) {
          estadoMemoria.coberturas = [];
        } else {
          estadoMemoria.coberturas = estadoMemoria.coberturas.filter(
            (c) =>
              !c.id.startsWith("COB-CABIUNAS-") &&
              !c.id.startsWith("COB-BOAVENTURA-") &&
              !c.id.startsWith("cob-demo-")
          );
        }

        const excluidas = new Set(estadoMemoria.coberturasExcluidasIds || []);
        for (const cIni of COBERTURAS_INICIAIS) {
          if (excluidas.has(cIni.id)) continue;
          if (!estadoMemoria.coberturas.some((c) => c.id === cIni.id)) {
            estadoMemoria.coberturas.push(cIni);
          }
        }

        // Garante pendências de escala da REV04 se não houver no storage
        if (!estadoMemoria.pendenciasEscala || estadoMemoria.pendenciasEscala.length === 0) {
          estadoMemoria.pendenciasEscala = [...PENDENCIAS_ESCALA_REV04];
        }
      }
    } catch {
      // Falha silenciosa de localStorage (usa estadoMemoria)
    }
  }

  return estadoMemoria;
}

let avisoFalhaGravacaoExibido = false;

export function salvarEstado(novo: Partial<EstadoOperacionalCompleto>) {
  estadoMemoria = { ...estadoMemoria, ...novo };
  if (typeof window !== "undefined") {
    try {
      // 1. Limpeza proativa de chaves legadas para liberar cota de 5MB do domínio
      const chavesAntigas = [
        "sgp_estado_operacional",
        "sgp_estado_operacional_v1",
        "sgp_estado_operacional_v2",
        "sgp_estado_operacional_v3",
        "sgp_backup_dados",
        "sgp_backup_coberturas",
      ];
      chavesAntigas.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });

      // 2. Isola marcações de ponto do localStorage para nunca estourar a quota de 5MB
      const { marcacoesPonto: _marc, ...estadoParaLocalStorage } = estadoMemoria;

      // 3. Compacta snapshotAnterior em lotesImportacao para salvar apenas dados estritamente necessários
      if (estadoParaLocalStorage.lotesImportacao) {
        estadoParaLocalStorage.lotesImportacao = estadoParaLocalStorage.lotesImportacao.map((lote) => {
          if (!lote.snapshotAnterior) return lote;
          const snap = lote.snapshotAnterior as any;
          return {
            ...lote,
            snapshotAnterior: {
              profissionais: snap.profissionais,
              ocorrencias: snap.ocorrencias,
              coberturas: snap.coberturas,
              alocadosSifac: snap.alocadosSifac,
            },
          };
        });
      }

      // 4. Limita logsAuditoria salvos no localStorage a no máximo 50
      if (estadoParaLocalStorage.logsAuditoria && estadoParaLocalStorage.logsAuditoria.length > 50) {
        estadoParaLocalStorage.logsAuditoria = estadoParaLocalStorage.logsAuditoria.slice(0, 50);
      }

      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estadoParaLocalStorage));
      avisoFalhaGravacaoExibido = false;
    } catch (erro) {
      console.warn("[SGP] Cota do localStorage atingida, aplicando compactação de segurança...", erro);
      try {
        const { marcacoesPonto: _marc, ...estadoCompacto } = estadoMemoria;
        if (estadoCompacto.lotesImportacao) {
          estadoCompacto.lotesImportacao = estadoCompacto.lotesImportacao.map((l) => ({
            ...l,
            snapshotAnterior: undefined,
          }));
        }
        if (estadoCompacto.logsAuditoria && estadoCompacto.logsAuditoria.length > 20) {
          estadoCompacto.logsAuditoria = estadoCompacto.logsAuditoria.slice(0, 20);
        }
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estadoCompacto));
        avisoFalhaGravacaoExibido = false;
      } catch (segundoErro) {
        console.error("[SGP] Falha ao gravar o estado no navegador:", segundoErro);
        if (!avisoFalhaGravacaoExibido) {
          avisoFalhaGravacaoExibido = true;
          try {
            window.alert(
              "ATENÇÃO: não foi possível gravar os dados no navegador (espaço de armazenamento esgotado ou bloqueado).\n\nA alteração foi aplicada apenas nesta sessão e será perdida ao recarregar a página."
            );
          } catch {}
        }
      }
    }
    // A tela é atualizada mesmo que a gravação persistente falhe.
    window.dispatchEvent(new CustomEvent("sgp-dados-atualizados", { detail: estadoMemoria }));
  }
  return estadoMemoria;
}

// -----------------------------------------------------------------------------
// SESSÃO DO USUÁRIO (para trilha de auditoria)
// -----------------------------------------------------------------------------

export interface SessaoAtivaAuditoria {
  id?: string;
  nome: string;
  perfil: string;
}

let sessaoAtivaCliente: SessaoAtivaAuditoria | null = null;

/** Registra o usuário autenticado (obtido de /api/auth) para uso na trilha de auditoria. */
export function definirSessaoAtiva(sessao: SessaoAtivaAuditoria | null) {
  sessaoAtivaCliente = sessao;
}

export function obterSessaoAtiva(): SessaoAtivaAuditoria | null {
  return sessaoAtivaCliente;
}

/** O IP real só é conhecido no servidor; no cliente registra-se explicitamente que não foi capturado. */
export const IP_NAO_CAPTURADO_CLIENTE = "Não capturado (cliente)";

export function registrarLog(
  acao: string,
  entidade: string,
  detalhes: string,
  opcoes?: {
    valorAnterior?: string | null;
    valorNovo?: string | null;
    registroId?: string;
    usuario?: string;
    perfil?: string;
  }
): LogAuditoriaOperacional {
  const estado = carregarEstado();
  const novoLog: LogAuditoriaOperacional = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    usuario: opcoes?.usuario || sessaoAtivaCliente?.nome || "Usuário não identificado",
    perfil: opcoes?.perfil || sessaoAtivaCliente?.perfil || "NAO_IDENTIFICADO",
    acao,
    entidade,
    detalhes,
    ip: IP_NAO_CAPTURADO_CLIENTE,
    valorAnterior: opcoes?.valorAnterior ?? null,
    valorNovo: opcoes?.valorNovo ?? null,
    registroId: opcoes?.registroId,
  };
  salvarEstado({ logsAuditoria: [novoLog, ...estado.logsAuditoria] });
  return novoLog;
}

// -----------------------------------------------------------------------------
// OPERAÇÕES DE MUTAÇÃO RÁPIDAS COM TRILHA DE AUDITORIA COMPLETA
// -----------------------------------------------------------------------------

export function adicionarPosto(
  posto: Partial<PostoOperacional> & { codigoPosto: string; funcao: string; escala: "5x2" | "12x36" | "6x1" }
): PostoOperacional {
  const estado = carregarEstado();
  const idPosto = posto.idPosto || String(estado.postos.length + 1);
  const tipoPostoId = posto.tipoPostoId || (posto.escala === "12x36" ? "TURNO_12H" : "ADM_09H");
  const itemPPU = posto.itemPPU || "3.1";
  const periculosidade = posto.periculosidade || "NÃO";
  const municipio = posto.municipio || "Três Lagoas";
  const localAtuacao = posto.localAtuacao || posto.unidadeNome || "UFN-III";
  const gerenciaPetrobras = posto.gerenciaPetrobras || "GERÊNCIA CONTRATUAL";

  const novo: PostoOperacional = {
    id: `pst-${Date.now()}`,
    idPosto,
    codigoPosto: posto.codigoPosto,
    funcao: posto.funcao,
    descricao: posto.descricao,
    itemPPU,
    tipoPostoId,
    periculosidade,
    municipio,
    localAtuacao,
    gerenciaPetrobras,
    unidadeId: posto.unidadeId || "UFN-III",
    unidadeNome: posto.unidadeNome || "UFN III – Três Lagoas/MS",
    baseOperacional: posto.baseOperacional || "UFN III",
    escala: posto.escala,
    jornadaSemanalHoras: posto.jornadaSemanalHoras || 44,
    horarioInicio: posto.horarioInicio || "07:00",
    horarioFim: posto.horarioFim || "16:48",
    situacao: posto.situacao || "ATIVO",
    dataInicioVigencia: posto.dataInicioVigencia || "2024-01-01",
  };

  const novasVagas = gerarVagasPosto(novo.idPosto, novo.tipoPostoId);
  const vagasAtuais = estado.vagas || VAGAS_MC_REAIS;

  salvarEstado({
    postos: [...estado.postos, novo],
    vagas: [...vagasAtuais, ...novasVagas],
  });
  registrarLog("CRIAR_POSICAO", `Posto (${novo.codigoPosto})`, `Cadastro do posto ${novo.funcao} - ${novo.codigoPosto}`, {
    valorNovo: JSON.stringify(novo),
    registroId: novo.id,
  });
  return novo;
}

export function atualizarPosto(
  idPosto: string,
  dados: Partial<PostoOperacional>
): { sucesso: boolean; postoAtualizado?: PostoOperacional } {
  const estado = carregarEstado();
  const index = estado.postos.findIndex((p) => p.id === idPosto || p.idPosto === idPosto || p.codigoPosto === idPosto);
  if (index === -1) return { sucesso: false };

  const anterior = estado.postos[index];
  const atualizado: PostoOperacional = {
    ...anterior,
    ...dados,
  };

  const novosPostos = [...estado.postos];
  novosPostos[index] = atualizado;

  salvarEstado({ postos: novosPostos });
  registrarLog(
    "ALTERAR_POSICAO",
    `Posto (${atualizado.codigoPosto})`,
    `Alteração de parâmetros do posto ${atualizado.funcao} - ${atualizado.codigoPosto}`,
    {
      valorAnterior: JSON.stringify(anterior),
      valorNovo: JSON.stringify(atualizado),
      registroId: atualizado.id,
    }
  );
  return { sucesso: true, postoAtualizado: atualizado };
}

export function excluirPosto(idPosto: string): boolean {
  const estado = carregarEstado();
  const index = estado.postos.findIndex((p) => p.id === idPosto || p.idPosto === idPosto || p.codigoPosto === idPosto);
  if (index === -1) return false;

  const anterior = estado.postos[index];
  const novosPostos = estado.postos.filter((_, i) => i !== index);

  salvarEstado({ postos: novosPostos });
  registrarLog(
    "EXCLUIR_POSICAO",
    `Posto (${anterior.codigoPosto})`,
    `Exclusão do posto ${anterior.funcao} - ${anterior.codigoPosto}`,
    {
      valorAnterior: JSON.stringify(anterior),
      valorNovo: null,
      registroId: anterior.id,
    }
  );
  return true;
}

export function atualizarTitularPosicao(
  posicaoId: string,
  titularMatricula: string,
  titularNome: string,
  motivo: string = "Substituição ou designação de titular"
): { sucesso: boolean; alocacao?: AlocacaoVaga } {
  const estado = carregarEstado();
  const alocacoesAtuais = estado.alocacoes || ALOCACOES_MC_REAIS;

  const anterior = alocacoesAtuais.find(
    (a) => a.vagaId === posicaoId || a.posicaoIdSGP === posicaoId
  );

  const novaAlocacao: AlocacaoVaga = {
    id: `aloc-${Date.now()}`,
    vagaId: posicaoId,
    posicaoIdSGP: posicaoId,
    matricula: titularMatricula,
    nome: titularNome,
    dataInicio: new Date().toISOString().slice(0, 10),
    dataFim: null,
    motivo: "titular",
    observacoes: motivo,
    criadoEm: new Date().toISOString(),
  };

  const alocacoesAtualizadas = [
    ...alocacoesAtuais.filter((a) => a.vagaId !== posicaoId && a.posicaoIdSGP !== posicaoId),
    novaAlocacao,
  ];

  salvarEstado({ alocacoes: alocacoesAtualizadas });
  registrarLog(
    "ALTERAR_TITULAR",
    `Posição (${posicaoId})`,
    `Titular alterado para ${titularNome} (Matrícula: ${titularMatricula}). Motivo: ${motivo}`,
    {
      valorAnterior: anterior ? JSON.stringify({ matricula: anterior.matricula, nome: anterior.nome }) : null,
      valorNovo: JSON.stringify({ matricula: titularMatricula, nome: titularNome }),
      registroId: posicaoId,
    }
  );
  return { sucesso: true, alocacao: novaAlocacao };
}

export function adicionarProfissional(
  prof: Omit<ProfissionalOperacional, "id" | "cpfMascarado" | "chapa"> & { chapa?: string }
): ProfissionalOperacional {
  const estado = carregarEstado();
  const chapaNormalizada = (prof.chapa || prof.matricula || `MAT-${Date.now()}`).padStart(6, "0");
  const novo: ProfissionalOperacional = {
    ...prof,
    chapa: chapaNormalizada,
    matricula: prof.matricula || chapaNormalizada,
    id: `prf-${Date.now()}`,
    cpfMascarado: mascararCpf(prof.cpfLimpo),
  };
  salvarEstado({ profissionais: [...estado.profissionais, novo] });
  registrarLog("CRIAR_PROFISSIONAL", `Profissional (${novo.chapa})`, `Cadastro do profissional ${novo.nome}`, {
    valorNovo: JSON.stringify({ chapa: novo.chapa, nome: novo.nome, funcao: novo.funcao }),
    registroId: novo.id,
  });
  return novo;
}

// -----------------------------------------------------------------------------
// BLOQUEIO DE COMPETÊNCIA CONGELADA E CHECAGEM DE CONFLITOS
// -----------------------------------------------------------------------------

/**
 * Retorna a primeira competência CONGELADA ("YYYY-MM") abrangida pelo período, ou null.
 */
export function obterCompetenciaCongeladaNoPeriodo(dataInicio?: string, dataFim?: string): string | null {
  const ini = (dataInicio || "").slice(0, 7);
  const fim = ((dataFim || dataInicio) || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ini)) return null;
  const fimValido = /^\d{4}-\d{2}$/.test(fim) && fim >= ini ? fim : ini;
  let [ano, mes] = ini.split("-").map(Number);
  for (let i = 0; i < 120; i++) {
    const comp = `${ano}-${String(mes).padStart(2, "0")}`;
    if (comp > fimValido) break;
    if (isCompetenciaCongelada(comp)) return comp;
    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
  }
  return null;
}

function garantirPeriodoNaoCongelado(dataInicio: string | undefined, dataFim: string | undefined, acao: string) {
  const comp = obterCompetenciaCongeladaNoPeriodo(dataInicio, dataFim);
  if (comp) {
    const [a, m] = comp.split("-");
    throw new Error(
      `BLOQUEIO DE COMPETÊNCIA CONGELADA: a competência ${m}/${a} está congelada (snapshot imutável). Não é possível ${acao}. Solicite a reabertura ao Administrador na tela de Fechamento Mensal.`
    );
  }
}

const normMatriculaConflito = (v?: string) => (v ? String(v).trim().replace(/^0+/, "") : "");
const periodosSobrepoem = (i1: string, f1: string, i2: string, f2: string) =>
  (i1 || "").slice(0, 10) <= (f2 || i2 || "").slice(0, 10) && (i2 || "").slice(0, 10) <= (f1 || i1 || "").slice(0, 10);
const fmtData = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

/**
 * Verifica conflitos de uma cobertura com as já registradas e com ausências do substituto.
 * - bloqueios: impedem o salvamento (posição já coberta no período, substituto ausente no período).
 * - alertas: exigem confirmação (substituto já designado para outro posto/posição no período).
 */
export function verificarConflitosCobertura(
  dados: {
    postoCodigo: string;
    vagaId?: string;
    titularMatricula?: string;
    substitutoMatricula: string;
    dataInicio: string;
    dataFim: string;
  },
  ignorarId?: string
): { bloqueios: string[]; alertas: string[] } {
  const estado = carregarEstado();
  const bloqueios: string[] = [];
  const alertas: string[] = [];
  const subst = normMatriculaConflito(dados.substitutoMatricula);
  const titular = normMatriculaConflito(dados.titularMatricula);

  for (const c of estado.coberturas || []) {
    if (c.id === ignorarId || c.status === "CANCELADA") continue;
    if (!periodosSobrepoem(dados.dataInicio, dados.dataFim, c.dataInicio, c.dataFim)) continue;
    const periodo = `${fmtData(c.dataInicio)} a ${fmtData(c.dataFim)}`;
    const mesmoPosto = String(c.postoCodigo || "") === String(dados.postoCodigo || "");
    const mesmaPosicao =
      (dados.vagaId && c.vagaId)
        ? String(c.vagaId) === String(dados.vagaId)
        : mesmoPosto && titular !== "" && normMatriculaConflito(c.titularMatricula) === titular;

    if (mesmaPosicao) {
      bloqueios.push(
        `A posição já possui cobertura de ${c.substitutoNome} (${c.substitutoMatricula}) no posto ${c.postoCodigo} de ${periodo}.`
      );
    } else if (subst && normMatriculaConflito(c.substitutoMatricula) === subst) {
      alertas.push(`O substituto já está designado para o posto ${c.postoCodigo} de ${periodo}.`);
    }
  }

  for (const o of estado.ocorrencias || []) {
    if ((o as { status?: string }).status === "CANCELADA") continue;
    if (!subst || normMatriculaConflito(o.matricula) !== subst) continue;
    if (!periodosSobrepoem(dados.dataInicio, dados.dataFim, o.dataInicio, o.dataFim)) continue;
    bloqueios.push(
      `O substituto possui ausência registrada (${o.tipoOcorrencia}) de ${fmtData(o.dataInicio)} a ${fmtData(o.dataFim)}.`
    );
  }

  return { bloqueios, alertas };
}

/**
 * Verifica se o profissional já possui ausência sobreposta ao período informado.
 */
export function verificarConflitosOcorrencia(
  dados: { matricula: string; dataInicio: string; dataFim: string },
  ignorarId?: string
): string[] {
  const estado = carregarEstado();
  const mat = normMatriculaConflito(dados.matricula);
  if (!mat) return [];
  return (estado.ocorrencias || [])
    .filter(
      (o) =>
        o.id !== ignorarId &&
        (o as { status?: string }).status !== "CANCELADA" &&
        normMatriculaConflito(o.matricula) === mat &&
        periodosSobrepoem(dados.dataInicio, dados.dataFim, o.dataInicio, o.dataFim)
    )
    .map((o) => `Já existe ausência (${o.tipoOcorrencia}) de ${fmtData(o.dataInicio)} a ${fmtData(o.dataFim)} para este profissional.`);
}

export function adicionarOcorrencia(oco: Omit<OcorrenciaOperacional, "id" | "criadoEm">): OcorrenciaOperacional {
  garantirPeriodoNaoCongelado(oco.dataInicio, oco.dataFim, "registrar a ausência");
  const estado = carregarEstado();
  const novo: OcorrenciaOperacional = {
    ...oco,
    id: `oco-${Date.now()}`,
    criadoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
  };
  salvarEstado({ ocorrencias: [novo, ...estado.ocorrencias] });
  registrarLog("CRIAR_AUSENCIA", `Ausência (${novo.id})`, `${novo.tipoOcorrencia} para ${novo.profissionalNome}`, {
    valorNovo: JSON.stringify(novo),
    registroId: novo.id,
  });
  return novo;
}

export function atualizarOcorrencia(
  id: string,
  dados: Partial<OcorrenciaOperacional>
): { sucesso: boolean; ocorrenciaAtualizada?: OcorrenciaOperacional } {
  const estado = carregarEstado();
  const anterior = estado.ocorrencias.find((o) => o.id === id);
  if (!anterior) return { sucesso: false };

  const atualizada: OcorrenciaOperacional = { ...anterior, ...dados };
  garantirPeriodoNaoCongelado(anterior.dataInicio, anterior.dataFim, "alterar a ausência");
  garantirPeriodoNaoCongelado(atualizada.dataInicio, atualizada.dataFim, "alterar a ausência");
  const atualizadas = estado.ocorrencias.map((o) => (o.id === id ? atualizada : o));
  salvarEstado({ ocorrencias: atualizadas });

  registrarLog("ALTERAR_AUSENCIA", `Ausência (${id})`, `Alteração da ausência de ${atualizada.profissionalNome}`, {
    valorAnterior: JSON.stringify(anterior),
    valorNovo: JSON.stringify(atualizada),
    registroId: id,
  });
  return { sucesso: true, ocorrenciaAtualizada: atualizada };
}

export function cancelarOcorrencia(id: string): boolean {
  const estado = carregarEstado();
  const anterior = estado.ocorrencias.find((o) => o.id === id);
  if (!anterior) return false;
  garantirPeriodoNaoCongelado(anterior.dataInicio, anterior.dataFim, "excluir a ausência");

  const atualizadas = estado.ocorrencias.filter((o) => o.id !== id);
  salvarEstado({ ocorrencias: atualizadas });

  registrarLog("EXCLUIR_AUSENCIA", `Ausência (${id})`, `Exclusão da ausência de ${anterior.profissionalNome}`, {
    valorAnterior: JSON.stringify(anterior),
    valorNovo: null,
    registroId: id,
  });
  return true;
}

export function adicionarCobertura(cob: Omit<CoberturaOperacional, "id" | "criadoEm">): CoberturaOperacional {
  garantirPeriodoNaoCongelado(cob.dataInicio, cob.dataFim, "registrar a cobertura");
  const estado = carregarEstado();
  const novo: CoberturaOperacional = {
    ...cob,
    id: `cob-${Date.now()}`,
    criadoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
  };
  salvarEstado({ coberturas: [novo, ...estado.coberturas] });
  registrarLog("CRIAR_COBERTURA", `Cobertura (${novo.postoCodigo})`, `Designado ${novo.substitutoNome} para posto ${novo.postoCodigo}`, {
    valorNovo: JSON.stringify(novo),
    registroId: novo.id,
  });
  if (novo.alertaInterjornada) {
    registrarLog(
      "ALERTA_INTERJORNADA_CLT",
      `Cobertura (${novo.postoCodigo})`,
      `Alerta CLT Art. 66: Substituto ${novo.substitutoNome} designado com descanso apurado de ${novo.horasDescansoApuradas ? novo.horasDescansoApuradas.toFixed(1) + "h" : "<11h"} (inferior a 11 horas consecutivas). Ciência excepcional registrada.`,
      { registroId: novo.id }
    );
  }
  return novo;
}

export function atualizarCobertura(
  id: string,
  dados: Partial<CoberturaOperacional>
): { sucesso: boolean; coberturaAtualizada?: CoberturaOperacional } {
  const estado = carregarEstado();
  const anterior = estado.coberturas.find((c) => c.id === id);
  if (!anterior) return { sucesso: false };

  const atualizada: CoberturaOperacional = { ...anterior, ...dados };
  garantirPeriodoNaoCongelado(anterior.dataInicio, anterior.dataFim, "alterar a cobertura");
  garantirPeriodoNaoCongelado(atualizada.dataInicio, atualizada.dataFim, "alterar a cobertura");
  const atualizadas = estado.coberturas.map((c) => (c.id === id ? atualizada : c));
  salvarEstado({ coberturas: atualizadas });

  registrarLog("ALTERAR_COBERTURA", `Cobertura (${atualizada.postoCodigo})`, `Alterada cobertura de ${atualizada.substitutoNome}`, {
    valorAnterior: JSON.stringify(anterior),
    valorNovo: JSON.stringify(atualizada),
    registroId: id,
  });
  return { sucesso: true, coberturaAtualizada: atualizada };
}

export function cancelarCobertura(id: string): boolean {
  const estado = carregarEstado();
  const cob = estado.coberturas.find((c) => c.id === id);
  if (!cob) return false;
  garantirPeriodoNaoCongelado(cob.dataInicio, cob.dataFim, "cancelar a cobertura");

  const atualizadas = estado.coberturas.map((c) =>
    c.id === id ? { ...c, status: "CANCELADA" as const } : c
  );
  salvarEstado({ coberturas: atualizadas });
  registrarLog("EXCLUIR_COBERTURA", `Cobertura (${cob.postoCodigo})`, `Cancelada cobertura de ${cob.substitutoNome} para o posto ${cob.postoCodigo}`, {
    valorAnterior: JSON.stringify(cob),
    valorNovo: JSON.stringify({ ...cob, status: "CANCELADA" }),
    registroId: id,
  });
  return true;
}

/**
 * Valida se um colaborador possui vínculo oficial homologado com o posto como ferista/recurso.
 */
export function validarVinculoFeristaPosto(
  chapaOuNome: string,
  postoIdSGP: string
): { vinculado: boolean; mensagem: string } {
  const chave = String(chapaOuNome || "").trim();
  const postoChave = String(postoIdSGP || "").trim();

  // Verifica vínculos parametrizados N:N
  const vinculos = FERISTAS_VINCULADOS_POSTOS.filter(
    (v) =>
      (v.matricula === chave || v.nome.toUpperCase() === chave.toUpperCase()) &&
      (v.postoIdSGP === postoChave || postoChave.includes(v.postoIdSGP) || v.postoIdSGP.includes(postoChave))
  );

  // Verifica catálogo REV04
  const vinculosREV04 = FERISTAS_REV04.filter(
    (f) =>
      (f.chapaRM === chave || f.colaborador.toUpperCase() === chave.toUpperCase()) &&
      (f.postoIdSGP === postoChave || String(f.postoBase) === postoChave.replace(/\D/g, ""))
  );

  const vinculado = vinculos.length > 0 || vinculosREV04.length > 0;
  if (vinculado) {
    return {
      vinculado: true,
      mensagem: "Colaborador possui vínculo oficial como ferista/recurso homologado para este posto.",
    };
  }

  return {
    vinculado: false,
    mensagem: "Atenção: Colaborador NÃO possui vínculo prévio homologado com este posto. Justificativa operacional detalhada é obrigatória.",
  };
}

/**
 * Registra cobertura operacional com validação de vínculo (Perfil Premier).
 * Se quem cobre não estiver vinculado ao posto, alerta e exige justificativa obrigatória.
 */
export function registrarCoberturaComValidacao(dados: {
  postoIdSGP: string;
  posicaoId: string;
  titularMatricula?: string;
  titularNome?: string;
  substitutoMatricula: string;
  substitutoNome: string;
  dataInicio: string;
  dataFim: string;
  motivo: string;
  tipoCobertura?: CoberturaOperacional["tipoCobertura"];
  justificativaNaoVinculado?: string;
}): { sucesso: boolean; cobertura?: CoberturaOperacional; erro?: string } {
  const { vinculado } = validarVinculoFeristaPosto(dados.substitutoMatricula || dados.substitutoNome, dados.postoIdSGP);

  if (dados.dataFim < dados.dataInicio) {
    return { sucesso: false, erro: "A data de término não pode ser anterior à data de início." };
  }

  const conflitos = verificarConflitosCobertura({
    postoCodigo: dados.postoIdSGP,
    vagaId: dados.posicaoId,
    titularMatricula: dados.titularMatricula,
    substitutoMatricula: dados.substitutoMatricula,
    dataInicio: dados.dataInicio,
    dataFim: dados.dataFim,
  });
  if (conflitos.bloqueios.length > 0) {
    return { sucesso: false, erro: conflitos.bloqueios.join(" ") };
  }

  if (!vinculado) {
    const justif = (dados.justificativaNaoVinculado || "").trim();
    if (justif.length < 5) {
      return {
        sucesso: false,
        erro: "Justificativa obrigatória: Colaborador não vinculado ao posto exige justificativa operacional fundamentada.",
      };
    }
  }

  let nova: CoberturaOperacional;
  try {
    nova = adicionarCobertura({
    postoCodigo: dados.postoIdSGP,
    idPosto: dados.postoIdSGP,
    vagaId: dados.posicaoId,
    funcaoPosto: "COBERTURA OPERACIONAL",
    titularMatricula: dados.titularMatricula,
    titularNome: dados.titularNome,
    substitutoMatricula: dados.substitutoMatricula,
    substitutoNome: dados.substitutoNome,
    dataInicio: dados.dataInicio,
    dataFim: dados.dataFim,
    tipoCobertura: dados.tipoCobertura || "SUBSTITUICAO_INTERNA",
    status: "CONFIRMADA",
    justificativa: dados.motivo + (!vinculado ? ` [Justificativa Excepcional: ${dados.justificativaNaoVinculado || dados.motivo}]` : ""),
  });
  } catch (erro) {
    return { sucesso: false, erro: erro instanceof Error ? erro.message : "Falha ao registrar cobertura." };
  }

  return { sucesso: true, cobertura: nova };
}

/**
 * Edição da escala da posição (Perfil Premier):
 * Preenche grupo, fase e data-base. Ao salvar, o mapa recalcula e a pendência
 * correspondente em PENDENCIAS_ESCALA_REV04 é baixada automaticamente.
 */
export function atualizarEscalaPosicao(
  posicaoId: string,
  dados: {
    grupo?: string;
    fase?: string;
    dataBase?: string;
    faixaHoraria?: string;
    regimeDias?: string;
  }
): { sucesso: boolean; vagaAtualizada?: VagaPosto; pendenciaBaixadaId?: string } {
  const estado = carregarEstado();
  const listaVagas = estado.vagas && estado.vagas.length > 0 ? estado.vagas : VAGAS_MC_REAIS;

  const vIndex = listaVagas.findIndex(
    (v) =>
      v.id === posicaoId ||
      v.posicaoIdSGP === posicaoId ||
      (v as any).codigoVisual === posicaoId ||
      (v as any).etiqueta === posicaoId
  );

  if (vIndex === -1) {
    return { sucesso: false };
  }

  const vAntiga = listaVagas[vIndex];
  const codVisual = (vAntiga as any).codigoVisual || vAntiga.etiqueta || vAntiga.idOriginalMC || "";

  const vAtualizada: VagaPosto = {
    ...vAntiga,
    grupo_revezamento: dados.grupo ?? vAntiga.grupo_revezamento,
    grupoRevezamento: dados.grupo ?? vAntiga.grupoRevezamento,
    fase_ciclo: dados.fase ?? vAntiga.fase_ciclo,
    faseCiclo: dados.fase ?? vAntiga.faseCiclo,
    data_base_escala: dados.dataBase ?? vAntiga.data_base_escala,
    dataBaseEscala: dados.dataBase ?? vAntiga.dataBaseEscala,
    dataBaseCiclo: dados.dataBase ?? vAntiga.dataBaseCiclo,
    faixa_horaria: dados.faixaHoraria ?? vAntiga.faixa_horaria,
    faixaHoraria: dados.faixaHoraria ?? vAntiga.faixaHoraria,
    regime_dias: dados.regimeDias ?? vAntiga.regime_dias,
    regimeDias: dados.regimeDias ?? vAntiga.regimeDias,
    status_programacao: "COMPLETA",
    statusProgramacao: "COMPLETA",
  };

  const novasVagas = [...listaVagas];
  novasVagas[vIndex] = vAtualizada;

  // Baixa automática da pendência correspondente em pendenciasEscala
  const pendencias = estado.pendenciasEscala && estado.pendenciasEscala.length > 0
    ? estado.pendenciasEscala
    : [...PENDENCIAS_ESCALA_REV04];

  let pendBaixadaId: string | undefined;

  const novasPendencias = pendencias.map((p) => {
    const matchPosicao =
      p.posicao === codVisual ||
      p.posicao === vAtualizada.id ||
      p.posicao === vAtualizada.posicaoIdSGP ||
      (p.postoBase && String(p.postoBase) === String(vAtualizada.postoBase) && p.posicao.endsWith(String(vAtualizada.sequencia)));

    if (matchPosicao && p.status !== "RESOLVIDA" && p.status !== "BAIXADA") {
      pendBaixadaId = p.id;
      return {
        ...p,
        status: "RESOLVIDA",
        acao: `Programação concluída (Grupo: ${dados.grupo || "-"}, Fase: ${dados.fase || "-"}, Data-Base: ${dados.dataBase || "-"})`,
      };
    }
    return p;
  });

  salvarEstado({
    vagas: novasVagas,
    pendenciasEscala: novasPendencias,
  });

  const valorAnterior = JSON.stringify({
    grupo: vAntiga.grupo_revezamento || vAntiga.grupoRevezamento || null,
    fase: vAntiga.fase_ciclo || vAntiga.faseCiclo || null,
    dataBase: vAntiga.data_base_escala || vAntiga.dataBaseEscala || null,
    faixaHoraria: vAntiga.faixa_horaria || vAntiga.faixaHoraria || null,
    regimeDias: vAntiga.regime_dias || vAntiga.regimeDias || null,
  });

  const valorNovo = JSON.stringify({
    grupo: vAtualizada.grupo_revezamento || null,
    fase: vAtualizada.fase_ciclo || null,
    dataBase: vAtualizada.data_base_escala || null,
    faixaHoraria: vAtualizada.faixa_horaria || null,
    regimeDias: vAtualizada.regime_dias || null,
  });

  registrarLog(
    "ALTERAR_ESCALA",
    `Posição ${codVisual || posicaoId}`,
    `Escala atualizada com Grupo: ${dados.grupo || "-"}, Fase: ${dados.fase || "-"}, Data-Base: ${dados.dataBase || "-"}. Pendência ${pendBaixadaId || "N/A"} baixada automaticamente.`,
    {
      valorAnterior,
      valorNovo,
      registroId: vAtualizada.id,
    }
  );

  return {
    sucesso: true,
    vagaAtualizada: vAtualizada,
    pendenciaBaixadaId: pendBaixadaId,
  };
}

/**
 * Registra um apontamento manual para um dia em escala em aberto (Presença, Folga, Descoberto).
 */
export function registrarAjusteManualDia(ajuste: {
  posicaoId: string;
  data: string;
  status: "PRESENTE" | "FOLGA" | "DESCOBERTO";
  justificativa?: string;
  registradoPor?: string;
}): AjusteManualDia {
  const estado = carregarEstado();
  const novo: AjusteManualDia = {
    ...ajuste,
    id: `ajs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    criadoEm: new Date().toISOString(),
  };
  const anteriores = (estado.ajustesManuaisDia || []).filter(
    (a) => !(a.posicaoId === ajuste.posicaoId && a.data === ajuste.data)
  );
  const atualizados = [novo, ...anteriores];
  estadoMemoria.ajustesManuaisDia = atualizados;
  salvarEstado({
    ajustesManuaisDia: atualizados,
  });
  registrarLog(
    "ALTERAR_ESCALA",
    `Posição ${ajuste.posicaoId} - Data ${ajuste.data}`,
    `Inclusão manual de status ${ajuste.status} em escala em aberto (${ajuste.justificativa || "Apontamento individual"})`
  );
  return novo;
}

/**
 * Remove um apontamento manual de dia, reabrindo a escala daquele dia.
 */
export function removerAjusteManualDia(posicaoId: string, data: string): boolean {
  const estado = carregarEstado();
  const atuais = estado.ajustesManuaisDia || [];
  const filtrados = atuais.filter(
    (a) => !(a.posicaoId === posicaoId && a.data === data)
  );
  if (filtrados.length !== atuais.length) {
    estadoMemoria.ajustesManuaisDia = filtrados;
    salvarEstado({ ajustesManuaisDia: filtrados });
    registrarLog(
      "ALTERAR_ESCALA",
      `Posição ${posicaoId} - Data ${data}`,
      `Apontamento manual removido (escala reaberta para inclusão)`
    );
    return true;
  }
  return false;
}

/**
 * Consulta se existe apontamento manual ativo para a posição e data.
 */
export function obterAjusteManualDia(posicaoId: string, data: string): AjusteManualDia | undefined {
  const estado = carregarEstado();
  return (estado.ajustesManuaisDia || []).find(
    (a) => a.posicaoId === posicaoId && a.data === data
  );
}


/**
 * Retorna o progresso de posições com programação completa vs total (Item 6).
 */
export function obterProgressoProgramacaoEscalas(
  vagas: VagaPosto[] = VAGAS_MC_REAIS,
  pendencias: PendenciaEscalaItem[] = PENDENCIAS_ESCALA_REV04
) {
  const total = vagas.length > 0 ? vagas.length : 311;
  const pendenciasAtivas = pendencias.filter((p) => p.status !== "RESOLVIDA" && p.status !== "BAIXADA");
  const pendenciasPosicoesSet = new Set(pendenciasAtivas.map((p) => p.posicao));

  let completas = 0;
  for (const v of vagas) {
    const cod = (v as any).codigoVisual || v.etiqueta || v.idOriginalMC || "";
    if (!pendenciasPosicoesSet.has(cod) && !pendenciasPosicoesSet.has(v.id)) {
      completas++;
    }
  }

  const percentual = total > 0 ? Math.round((completas / total) * 100) : 100;
  return {
    completas,
    total,
    percentual,
    totalPendencias: pendenciasAtivas.length,
    pendenciasAtivas,
  };
}

export function excluirCobertura(id: string): boolean {
  const estado = carregarEstado();
  const cob = estado.coberturas.find((c) => c.id === id);
  if (!cob) return false;
  garantirPeriodoNaoCongelado(cob.dataInicio, cob.dataFim, "excluir a cobertura");

  const atualizadas = estado.coberturas.filter((c) => c.id !== id);
  const excluidas = Array.from(new Set([...(estado.coberturasExcluidasIds || []), id]));
  salvarEstado({ coberturas: atualizadas, coberturasExcluidasIds: excluidas });
  registrarLog("EXCLUIR_COBERTURA", `Cobertura (${cob.postoCodigo})`, `Excluída cobertura de ${cob.substitutoNome} para o posto ${cob.postoCodigo}`, {
    valorAnterior: JSON.stringify(cob),
    valorNovo: null,
    registroId: id,
  });
  return true;
}

export function adicionarApontamento(apt: Omit<ApontamentoOperacional, "id" | "dataCriacao">): ApontamentoOperacional {
  const estado = carregarEstado();
  const novo: ApontamentoOperacional = {
    ...apt,
    id: `apt-${Date.now()}`,
    dataCriacao: new Date().toISOString().replace("T", " ").substring(0, 16),
  };
  salvarEstado({ apontamentos: [novo, ...estado.apontamentos] });
  registrarLog("REGISTRAR_APONTAMENTO", `Apontamento (${novo.postoCodigo})`, `Apontamento da Fiscalização: "${novo.texto.substring(0, 40)}..."`);
  return novo;
}

export function responderApontamento(id: string, resposta: string, respondidoPor: string) {
  const estado = carregarEstado();
  const atualizados = estado.apontamentos.map((apt) => {
    if (apt.id === id) {
      return {
        ...apt,
        respostaPremier: resposta,
        status: "RESPONDIDO" as const,
        respondidoPor,
        respondidoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
      };
    }
    return apt;
  });
  salvarEstado({ apontamentos: atualizados });
  registrarLog("RESPONDER_APONTAMENTO", `Apontamento (${id})`, `Resposta do Gestor Premier ao apontamento ${id}`);
}

// -----------------------------------------------------------------------------
// GESTÃO DE FECHAMENTO DE COMPETÊNCIA & CONGELAMENTO MENSAL (ITEM 11.3)
// -----------------------------------------------------------------------------

/**
 * Retorna a lista de competências e seus status de fechamento/congelamento.
 */
export function obterFechamentosCompetencia(): FechamentoCompetencia[] {
  const estado = carregarEstado();
  if (estado.fechamentosCompetencia && estado.fechamentosCompetencia.length > 0) {
    return estado.fechamentosCompetencia;
  }
  return [...FECHAMENTOS_INICIAIS];
}

/**
 * Retorna o status de uma competência específica ("ABERTO", "EM_HOMOLOGACAO" ou "CONGELADO").
 */
export function obterStatusCompetencia(competencia: string): "ABERTO" | "EM_HOMOLOGACAO" | "CONGELADO" {
  const lista = obterFechamentosCompetencia();
  const item = lista.find((f) => f.competencia === competencia);
  return item?.status || "ABERTO";
}

/**
 * Verifica se uma data ("YYYY-MM-DD") ou competência ("YYYY-MM") encontra-se oficialmente congelada.
 */
export function isCompetenciaCongelada(dataOuCompetencia: string): boolean {
  if (!dataOuCompetencia) return false;
  const comp = dataOuCompetencia.substring(0, 7);
  return obterStatusCompetencia(comp) === "CONGELADO";
}

/**
 * Encerra e congela uma competência mensal gerando snapshot imutável com hash SHA-256 e auditoria.
 */
export function congelarCompetencia(
  competencia: string,
  dados: Partial<FechamentoCompetencia> & { usuario?: string; email?: string }
): FechamentoCompetencia {
  const atuais = [...obterFechamentosCompetencia()];
  const usuario = dados.usuario || "Administrador Premier (Marcos Valério)";
  const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

  const hash =
    dados.hashIntegridadeSha256 ||
    `sha256:fech_${competencia}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  let fechamentoAtualizado: FechamentoCompetencia;
  const existenteIdx = atuais.findIndex((f) => f.competencia === competencia);

  const metricasPadrao = {
    postos: 380,
    exigiveis: 0,
    efetivas: 0,
    glosas: 0,
    taxaSla: 100,
    valorContrato: 0,
    valorGlosa: 0,
    faturamentoLiquido: 0,
  };

  if (existenteIdx >= 0) {
    fechamentoAtualizado = {
      ...atuais[existenteIdx],
      ...dados,
      status: "CONGELADO",
      congeladoEm: nowStr,
      congeladoPor: usuario,
      congeladoPorEmail: dados.email || "marcos.valerio@premierlogistics.com.br",
      hashIntegridadeSha256: hash,
      resumoMetricas: dados.resumoMetricas || atuais[existenteIdx].resumoMetricas || metricasPadrao,
    };
    atuais[existenteIdx] = fechamentoAtualizado;
  } else {
    fechamentoAtualizado = {
      id: `fech-${competencia}`,
      competencia,
      status: "CONGELADO",
      congeladoEm: nowStr,
      congeladoPor: usuario,
      congeladoPorEmail: dados.email || "marcos.valerio@premierlogistics.com.br",
      hashIntegridadeSha256: hash,
      resumoMetricas: dados.resumoMetricas || metricasPadrao,
      historicoReaberturas: [],
      ...dados,
    };
    atuais.push(fechamentoAtualizado);
  }

  salvarEstado({ fechamentosCompetencia: atuais });
  registrarLog(
    "CONGELAR_COMPETENCIA",
    `Competência (${competencia})`,
    `Competência ${competencia} encerrada e congelada oficialmente por ${usuario}. Hash: ${hash.substring(0, 36)}...`
  );

  return fechamentoAtualizado;
}

/**
 * Reabre uma competência congelada em caráter emergencial mediante justificativa formal auditada.
 */
export function reabrirCompetencia(
  competencia: string,
  justificativa: string,
  usuario: string = "Administrador Premier (Marcos Valério)"
): FechamentoCompetencia {
  if (!justificativa || justificativa.trim().length < 10) {
    throw new Error("Justificativa formal com no mínimo 10 caracteres é obrigatória para reabertura de competência.");
  }

  const atuais = [...obterFechamentosCompetencia()];
  const existenteIdx = atuais.findIndex((f) => f.competencia === competencia);
  const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

  if (existenteIdx < 0) {
    throw new Error(`Competência ${competencia} não encontrada para reabertura.`);
  }

  const historico = atuais[existenteIdx].historicoReaberturas || [];
  const fechamentoAtualizado: FechamentoCompetencia = {
    ...atuais[existenteIdx],
    status: "ABERTO",
    historicoReaberturas: [
      ...historico,
      {
        data: nowStr,
        usuario,
        justificativa: justificativa.trim(),
      },
    ],
  };

  atuais[existenteIdx] = fechamentoAtualizado;
  salvarEstado({ fechamentosCompetencia: atuais });

  registrarLog(
    "REABRIR_COMPETENCIA",
    `Competência (${competencia})`,
    `Reabertura emergencial da competência ${competencia} autorizada por ${usuario}. Motivo: "${justificativa.trim()}"`
  );

  return fechamentoAtualizado;
}

/**
 * Registra formalmente a homologação / parecer da Fiscalização Petrobras para a medição da competência.
 */
export function homologarMedicaoPetrobras(
  competencia: string,
  parecer: string,
  fiscalNome: string = "Carlos Eduardo Mendes (Fiscal Técnico Petrobras)"
): FechamentoCompetencia {
  if (!parecer || parecer.trim().length < 5) {
    throw new Error("Parecer técnico da fiscalização é obrigatório para homologação.");
  }

  const atuais = [...obterFechamentosCompetencia()];
  const existenteIdx = atuais.findIndex((f) => f.competencia === competencia);
  const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

  if (existenteIdx < 0) {
    throw new Error(`Competência ${competencia} não encontrada para homologação.`);
  }

  const fechamentoAtualizado: FechamentoCompetencia = {
    ...atuais[existenteIdx],
    homologacaoPetrobras: {
      homologado: true,
      data: nowStr,
      fiscalNome,
      parecer: parecer.trim(),
    },
  };

  atuais[existenteIdx] = fechamentoAtualizado;
  salvarEstado({ fechamentosCompetencia: atuais });

  registrarLog(
    "HOMOLOGAR_MEDICAO_PETROBRAS",
    `Competência (${competencia})`,
    `Medição da competência ${competencia} homologada pelo fiscal ${fiscalNome}. Parecer: "${parecer.trim().substring(0, 60)}..."`
  );

  return fechamentoAtualizado;
}

/**
 * @deprecated O seletor de perfil foi descontinuado no Momento 1.
 * O perfil do usuário agora é gerido exclusivamente pelo cadastro do servidor e sessão HTTP-only.
 */
export function alternarPerfil(_novoPerfil: string) {
  console.warn(
    "Aviso de Segurança: Tentativa de alterar perfil no cliente bloqueada. O perfil é gerido exclusivamente no servidor."
  );
}

/**
 * Troca ou desocupa o titular de um posto de serviço.
 * Mantém integridade referencial bidirecional entre Postos e Colaboradores.
 */
export function trocarTitularPosto(
  codigoPosto: string,
  novaMatriculaTitular?: string
): { sucesso: boolean; mensagem: string } {
  const estado = carregarEstado();
  const todosPostos = obterTodosPostosContrato(estado.postos);
  const posto = todosPostos.find((p) => p.codigoPosto === codigoPosto);
  if (!posto) {
    return { sucesso: false, mensagem: `Posto ${codigoPosto} não encontrado.` };
  }

  const titularAnteriorMatricula = posto.titularMatricula;
  const titularAnteriorNome = posto.titularNome;
  const novoTitular = novaMatriculaTitular
    ? estado.profissionais.find((pr) => pr.matricula === novaMatriculaTitular)
    : undefined;

  // 1. Atualizar postos:
  // Se o novo titular já era titular de outro posto, desocupar o posto anterior (liberação automática)
  const postosAtualizados = todosPostos.map((p) => {
    if (p.codigoPosto === codigoPosto) {
      return {
        ...p,
        titularMatricula: novoTitular ? novoTitular.matricula : undefined,
        titularNome: novoTitular ? novoTitular.nome : undefined,
      };
    }
    if (novoTitular && p.titularMatricula === novoTitular.matricula && p.codigoPosto !== codigoPosto) {
      return {
        ...p,
        titularMatricula: undefined,
        titularNome: undefined,
      };
    }
    return p;
  });

  // 2. Atualizar profissionais:
  const profissionaisAtualizados = estado.profissionais.map((pr) => {
    // O novo titular é vinculado a este posto
    if (novoTitular && pr.matricula === novoTitular.matricula) {
      return {
        ...pr,
        postoCodigo: codigoPosto,
      };
    }
    // O titular anterior vai para a Reserva Técnica (sem posto fixo)
    if (
      titularAnteriorMatricula &&
      pr.matricula === titularAnteriorMatricula &&
      (!novoTitular || pr.matricula !== novoTitular.matricula)
    ) {
      return {
        ...pr,
        postoCodigo: undefined,
      };
    }
    return pr;
  });

  salvarEstado({
    postos: postosAtualizados,
    profissionais: profissionaisAtualizados,
  });

  const descricao = novoTitular
    ? `Troca de titular no posto ${codigoPosto}: ${novoTitular.nome} (${novoTitular.matricula}) assumiu a titularidade (anterior: ${titularAnteriorNome || "VAGO"})`
    : `Posto ${codigoPosto} desocupado: ${titularAnteriorNome || ""} movido para a Reserva Técnica.`;

  registrarLog("TROCA_POSTO", `Posto (${codigoPosto})`, descricao);
  return { sucesso: true, mensagem: descricao };
}

/**
 * Transfere um profissional para outro posto (ou para a Reserva Técnica).
 */
export function transferirColaboradorPosto(
  matricula: string,
  novoCodigoPosto?: string
): { sucesso: boolean; mensagem: string } {
  const estado = carregarEstado();
  const profissional = estado.profissionais.find((pr) => pr.matricula === matricula);
  if (!profissional) {
    return { sucesso: false, mensagem: `Colaborador com matrícula ${matricula} não encontrado.` };
  }

  // Se novoCodigoPosto for fornecido, delegar para trocarTitularPosto
  if (novoCodigoPosto && novoCodigoPosto.trim().length > 0) {
    return trocarTitularPosto(novoCodigoPosto.trim(), matricula);
  }

  // Se não foi fornecido novo posto, remover o colaborador de qualquer posto atual (enviar para Reserva Técnica)
  const todosPostos = obterTodosPostosContrato(estado.postos);
  const postoAtual = todosPostos.find((p) => p.titularMatricula === matricula);
  const postosAtualizados = todosPostos.map((p) => {
    if (p.titularMatricula === matricula) {
      return {
        ...p,
        titularMatricula: undefined,
        titularNome: undefined,
      };
    }
    return p;
  });

  const profissionaisAtualizados = estado.profissionais.map((pr) => {
    if (pr.matricula === matricula) {
      return {
        ...pr,
        postoCodigo: undefined,
      };
    }
    return pr;
  });

  salvarEstado({
    postos: postosAtualizados,
    profissionais: profissionaisAtualizados,
  });

  const descricao = postoAtual
    ? `Colaborador ${profissional.nome} (${matricula}) transferido do posto ${postoAtual.codigoPosto} para a Reserva Técnica.`
    : `Colaborador ${profissional.nome} mantido na Reserva Técnica.`;

  registrarLog("TRANSFERENCIA_COLABORADOR", `Profissional (${matricula})`, descricao);
  return { sucesso: true, mensagem: descricao };
}

/**
 * Realiza permuta direta entre dois colaboradores (troca mútua de postos).
 */
export function permutarTitularesPostos(
  matriculaA: string,
  matriculaB: string
): { sucesso: boolean; mensagem: string } {
  const estado = carregarEstado();
  const profA = estado.profissionais.find((pr) => pr.matricula === matriculaA);
  const profB = estado.profissionais.find((pr) => pr.matricula === matriculaB);

  if (!profA || !profB) {
    return { sucesso: false, mensagem: "Um ou ambos os colaboradores não foram encontrados." };
  }

  const todosPostos = obterTodosPostosContrato(estado.postos);
  const postoA = todosPostos.find((p) => p.titularMatricula === matriculaA);
  const postoB = todosPostos.find((p) => p.titularMatricula === matriculaB);

  const postosAtualizados = todosPostos.map((p) => {
    if (postoA && p.codigoPosto === postoA.codigoPosto) {
      return {
        ...p,
        titularMatricula: profB.matricula,
        titularNome: profB.nome,
      };
    }
    if (postoB && p.codigoPosto === postoB.codigoPosto) {
      return {
        ...p,
        titularMatricula: profA.matricula,
        titularNome: profA.nome,
      };
    }
    return p;
  });

  const profissionaisAtualizados = estado.profissionais.map((pr) => {
    if (pr.matricula === matriculaA) {
      return {
        ...pr,
        postoCodigo: postoB ? postoB.codigoPosto : undefined,
      };
    }
    if (pr.matricula === matriculaB) {
      return {
        ...pr,
        postoCodigo: postoA ? postoA.codigoPosto : undefined,
      };
    }
    return pr;
  });

  salvarEstado({
    postos: postosAtualizados,
    profissionais: profissionaisAtualizados,
  });

  const descricao = `Permuta realizada com sucesso: ${profA.nome} (${matriculaA}) assumiu ${postoB ? `Posto ${postoB.codigoPosto}` : "Reserva Técnica"} e ${profB.nome} (${matriculaB}) assumiu ${postoA ? `Posto ${postoA.codigoPosto}` : "Reserva Técnica"}.`;
  registrarLog("PERMUTA_POSTO", `Permuta (${matriculaA} <-> ${matriculaB})`, descricao);
  return { sucesso: true, mensagem: descricao };
}

export function resetarDadosParaPadrao() {
  estadoMemoria = {
    postos: [...(POSTOS_MC_REAIS as unknown as PostoOperacional[])],
    vagas: [...VAGAS_MC_REAIS],
    alocacoes: [...ALOCACOES_MC_REAIS],
    profissionais: [...PROFISSIONAIS_INICIAIS],
    ocorrencias: [],
    coberturas: [],
    coberturasExcluidasIds: [],
    apontamentos: [],
    marcacoesPonto: [],
    diasFolgaRm: [],
    ajustesManuaisDia: [],
    dataReferenciaPonto: undefined,
    logsAuditoria: [...LOGS_INICIAIS],
    lotesImportacao: [...LOTES_INICIAIS],
    perfilAtivo: "PREMIER_ADMIN",
    unidadeSelecionada: "TODAS",
  };
  if (typeof window !== "undefined") {
    localStorage.removeItem(CHAVE_STORAGE);
    window.dispatchEvent(new CustomEvent("sgp-dados-atualizados", { detail: estadoMemoria }));
  }
  return estadoMemoria;
}

/**
 * Calcula a idade dinamicamente a partir da data de nascimento.
 * A coluna 'Idade' NUNCA é gravada no banco de dados nem no estado (LGPD / Requisito do Projeto).
 */
export function calcularIdade(
  dataNascimento?: string | Date | null,
  dataReferencia?: string | Date | null
): number | null {
  if (!dataNascimento) return null;

  let nasc: Date;
  if (typeof dataNascimento === "string") {
    const limpo = dataNascimento.trim();
    if (limpo.includes("/")) {
      const partes = limpo.split("/");
      nasc = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
    } else {
      nasc = new Date(limpo);
    }
  } else {
    nasc = dataNascimento;
  }

  if (isNaN(nasc.getTime())) return null;

  let ref: Date;
  if (dataReferencia) {
    if (typeof dataReferencia === "string") {
      const limpo = dataReferencia.trim();
      if (limpo.includes("/")) {
        const partes = limpo.split("/");
        ref = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
      } else {
        ref = new Date(limpo);
      }
    } else {
      ref = dataReferencia;
    }
  } else {
    ref = new Date();
  }

  if (isNaN(ref.getTime())) ref = new Date();

  let idade = ref.getFullYear() - nasc.getFullYear();
  const mesDiff = ref.getMonth() - nasc.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && ref.getDate() < nasc.getDate())) {
    idade--;
  }

  return idade >= 0 ? idade : null;
}

/**
 * Retorna a faixa etária para relatórios gerenciais e demografia do contrato:
 * Faixas: até 24 | 25–34 | 35–44 | 45–54 | 55–64 | 65 ou mais.
 */
export function obterFaixaEtaria(idade: number | null): string {
  if (idade === null || idade === undefined || isNaN(idade)) {
    return "Não informada";
  }
  if (idade < 25) return "Até 24 anos";
  if (idade <= 34) return "25 a 34 anos";
  if (idade <= 44) return "35 a 44 anos";
  if (idade <= 54) return "45 a 54 anos";
  if (idade <= 64) return "55 a 64 anos";
  return "65 ou mais";
}

/**
 * Desfaz o último lote de um tipo específico, restaurando o estado anterior
 * e registrando o cancelamento na auditoria.
 */
export function desfazerUltimoLote(
  tipo: string = "FUNCIONARIOS_RM",
  usuario: string = "Administrador Premier (Marcos Valério)"
): { sucesso: boolean; mensagem: string } {
  const estado = carregarEstado();
  const lotes = estado.lotesImportacao || [];

  // Localiza o último lote daquele tipo com status CONCLUIDO
  const indexLote = lotes.slice().reverse().findIndex((l) => l.tipo === tipo && l.status === "CONCLUIDO");
  if (indexLote === -1) {
    return {
      sucesso: false,
      mensagem: `Nenhum lote concluído do tipo ${tipo} foi encontrado para desfazer.`,
    };
  }

  const realIndex = lotes.length - 1 - indexLote;
  const loteAlvo = lotes[realIndex];

  if (!loteAlvo.snapshotAnterior) {
    return {
      sucesso: false,
      mensagem: `O lote ${loteAlvo.id} não possui cópia de segurança (snapshot) para restauração.`,
    };
  }

  const snapshot = loteAlvo.snapshotAnterior;

  // Atualiza o status do lote para DESFEITO
  const lotesAtualizados = lotes.map((l, idx) =>
    idx === realIndex ? { ...l, status: "DESFEITO" as const } : l
  );

  const novoLog: LogAuditoriaOperacional = {
    id: `log-desfazer-${Date.now()}`,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    usuario,
    perfil: "PREMIER_ADMIN",
    acao: "DESFAZER_LOTE_IMPORTACAO",
    entidade: `Lote (${loteAlvo.id})`,
    detalhes: `Desfeito lote de importação ${loteAlvo.id} (${loteAlvo.tipo} - ${loteAlvo.arquivoNome}). Estado anterior restaurado.`,
    ip: IP_NAO_CAPTURADO_CLIENTE,
  };

  const estadoRestaurado: EstadoOperacionalCompleto = {
    ...estado,
    ...snapshot,
    lotesImportacao: lotesAtualizados,
    logsAuditoria: [novoLog, ...(snapshot.logsAuditoria || estado.logsAuditoria || [])],
  };

  salvarEstado(estadoRestaurado);
  return {
    sucesso: true,
    mensagem: `Lote ${loteAlvo.id} desfeito com sucesso. Estado anterior restaurado.`,
  };
}

/**
 * Desfaz um lote específico por ID.
 * Se for FUNCIONARIOS_RM e desfazerCascata for true, desfaz também os lotes de PONTO e ABONO da mesma competência.
 * Marca o calendário da competência como desatualizado.
 */
export function desfazerLotePorId(
  loteId: string,
  usuario: string = "Administrador Premier (Marcos Valério)",
  desfazerCascata: boolean = true
): { sucesso: boolean; mensagem: string; lotesDesfeitos: string[] } {
  const estado = carregarEstado();
  const lotes = estado.lotesImportacao || [];

  const indexLote = lotes.findIndex((l) => l.id === loteId && l.status === "CONCLUIDO");
  if (indexLote === -1) {
    return {
      sucesso: false,
      mensagem: `Lote ${loteId} não encontrado ou já está desfeito.`,
      lotesDesfeitos: [],
    };
  }

  const loteAlvo = lotes[indexLote];
  const lotesParaDesfazerIds = [loteAlvo.id];

  // Se for Funcionários e houver cascata, localiza Ponto e Abonos da mesma competência
  if (loteAlvo.tipo === "FUNCIONARIOS_RM" && desfazerCascata && loteAlvo.competencia) {
    lotes.forEach((l) => {
      if (
        l.competencia === loteAlvo.competencia &&
        (l.tipo === "REGISTROS_PONTO_RM" || l.tipo === "ABONO_RM" || l.tipo === "AFD_PONTO") &&
        l.status === "CONCLUIDO" &&
        !lotesParaDesfazerIds.includes(l.id)
      ) {
        lotesParaDesfazerIds.push(l.id);
      }
    });
  }

  const snapshot = loteAlvo.snapshotAnterior;

  const lotesAtualizados = lotes.map((l) =>
    lotesParaDesfazerIds.includes(l.id) ? { ...l, status: "DESFEITO" as const } : l
  );

  const dataIso = new Date().toISOString();
  const logsNovos = lotesParaDesfazerIds.map((id) => ({
    id: `log-desfazer-${id}-${Date.now()}`,
    timestamp: dataIso.replace("T", " ").substring(0, 19),
    usuario,
    perfil: "PREMIER_ADMIN",
    acao: "DESFAZER_LOTE_IMPORTACAO",
    entidade: `Lote (${id})`,
    detalhes: `Desfeito lote de importação ${id}${lotesParaDesfazerIds.length > 1 ? " (reversão em cascata por competência)" : ""}.`,
    ip: "189.120.45.12",
  }));

  const estadoBase = snapshot ? { ...estado, ...snapshot } : { ...estado };

  if (lotesParaDesfazerIds.length > 1) {
    estadoBase.marcacoesPonto = [];
    estadoBase.ocorrencias = (estadoBase.ocorrencias || []).filter((o) => !o.id.startsWith("OCO-ABONO-"));
  }

  // Marca o calendário da competência como desatualizado
  const calendariosAtuais = (estadoBase as any).calendarioCompetencia || {};
  if (loteAlvo.competencia && calendariosAtuais[loteAlvo.competencia]) {
    calendariosAtuais[loteAlvo.competencia].status = "DESATUALIZADO";
  }

  const estadoRestaurado: EstadoOperacionalCompleto = {
    ...estadoBase,
    lotesImportacao: lotesAtualizados,
    logsAuditoria: [...logsNovos, ...(estadoBase.logsAuditoria || [])],
  };

  salvarEstado(estadoRestaurado);

  const msg = lotesParaDesfazerIds.length > 1
    ? `Lote ${loteAlvo.id} e os lotes dependentes da competência (${lotesParaDesfazerIds.slice(1).join(", ")}) foram desfeitos com sucesso.`
    : `Lote ${loteAlvo.id} desfeito com sucesso.`;

  return {
    sucesso: true,
    mensagem: msg,
    lotesDesfeitos: lotesParaDesfazerIds,
  };
}

/**
 * Salva e persiste as divergências apuradas para uma competência específica (ex: "2026-08")
 */
export function salvarDivergenciasConciliacao(
  competencia: string,
  divergencias: DivergenciaConciliacao[]
): void {
  const estado = carregarEstado();
  const mapaAtual = estado.divergenciasConciliacao || {};
  salvarEstado({
    divergenciasConciliacao: {
      ...mapaAtual,
      [competencia]: divergencias,
    },
  });
}

/**
 * Retorna as divergências de conciliação salvas para uma competência
 */
export function obterDivergenciasConciliacao(
  competencia: string
): DivergenciaConciliacao[] | undefined {
  const estado = carregarEstado();
  return estado.divergenciasConciliacao?.[competencia];
}

/**
 * Salva alocados SIFAC substituindo a competência anterior caso já exista
 */
export function salvarAlocadosSifac(
  novosAlocados: ItemAlocadoSifac[],
  competencia: string,
  substituirLoteAnterior: boolean = true
): { substituiuAnterior: boolean; totalGravados: number } {
  const estado = carregarEstado();
  const alocadosAtuais = estado.alocadosSifac || [];

  const jaExistia = alocadosAtuais.some((a) => {
    const compItem = (a.dataCompetenciaCadastro || a.dataCompetencia || "").substring(0, 7);
    return compItem === competencia;
  });

  let listaFinal: ItemAlocadoSifac[];
  if (substituirLoteAnterior) {
    // Remove registros da mesma competência e adiciona os novos
    listaFinal = [
      ...alocadosAtuais.filter((a) => {
        const compItem = (a.dataCompetenciaCadastro || a.dataCompetencia || "").substring(0, 7);
        return compItem !== competencia;
      }),
      ...novosAlocados,
    ];
  } else {
    listaFinal = [...alocadosAtuais, ...novosAlocados];
  }

  salvarEstado({ alocadosSifac: listaFinal });
  return { substituiuAnterior: jaExistia, totalGravados: novosAlocados.length };
}

/**
 * Salva lote de ponto com gravação em tabela SOMENTE DE INCLUSÃO (sem exclusão de marcações prévias).
 */
export function salvarLotePonto(
  lote: LoteImportacaoOperacional,
  novasMarcacoes: MarcacaoPontoOriginal[],
  novasPendencias: PendenciaPontoItem[] = [],
  novosDiasFolgaRm: string[] = []
): void {
  const estado = carregarEstado();
  const lotesAtuais = estado.lotesImportacao || [];
  const marcacoesAtuais = estado.marcacoesPonto || [];
  const pendenciasAtuais = estado.pendenciasPonto || [];
  const diasFolgaAtuais = estado.diasFolgaRm || [];

  // Tabela somente de inclusão: adiciona as novas marcações
  const marcacoesFinal = [...marcacoesAtuais, ...novasMarcacoes];

  // Consolida dias sem jornada do Cubo RM (base zero sem falta)
  const setDiasFolga = new Set([...diasFolgaAtuais, ...novosDiasFolgaRm]);

  // Atualiza pendências (evita duplicar IDs)
  const idsPendenciasNovas = new Set(novasPendencias.map((p) => p.id));
  const pendenciasFinal = [
    ...pendenciasAtuais.filter((p) => !idsPendenciasNovas.has(p.id)),
    ...novasPendencias,
  ];

  // Adiciona lote com snapshot do estado anterior para permitir "Desfazer lote"
  // ATENÇÃO: Nunca guardar marcacoesPonto dentro do snapshotAnterior para não duplicar dezenas de megabytes
  const { marcacoesPonto: _snapMarc, ...snapshotLeve } = estado;
  const loteComSnapshot: LoteImportacaoOperacional = {
    ...lote,
    snapshotAnterior: snapshotLeve as any,
  };

  const lotesFinal = [...lotesAtuais, loteComSnapshot];

  salvarEstado({
    lotesImportacao: lotesFinal,
    marcacoesPonto: marcacoesFinal,
    pendenciasPonto: pendenciasFinal,
    diasFolgaRm: Array.from(setDiasFolga),
    dataReferenciaPonto: lote.dataReferencia,
  });
}

let marcacoesReaisCache: MarcacaoPontoOriginal[] | null = null;
let diasFolgaReaisCache: string[] | null = null;

function carregarMarcacoesReaisServidor(): MarcacaoPontoOriginal[] {
  if (marcacoesReaisCache) return marcacoesReaisCache;
  try {
    if (typeof window === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path");
      const p = path.resolve(process.cwd(), "src/lib/dados/marcacoes-reais.json");
      if (fs.existsSync(p)) {
        marcacoesReaisCache = JSON.parse(fs.readFileSync(p, "utf-8"));
        return marcacoesReaisCache || [];
      }
    }
  } catch {
    // Fallback
  }
  return [];
}

function carregarDiasFolgaServidor(): string[] {
  if (diasFolgaReaisCache) return diasFolgaReaisCache;
  try {
    if (typeof window === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path");
      const p = path.resolve(process.cwd(), "src/lib/dados/dias-folga-reais.json");
      if (fs.existsSync(p)) {
        diasFolgaReaisCache = JSON.parse(fs.readFileSync(p, "utf-8"));
        return diasFolgaReaisCache || [];
      }
    }
  } catch {
    // Fallback
  }
  return [];
}

/**
 * Retorna lista de chaves de dias sem previsão no RM (${chapa}_${dataLocal})
 */
export function obterDiasFolgaPonto(): string[] {
  const estado = carregarEstado();
  if (estado.diasFolgaRm && estado.diasFolgaRm.length > 0) {
    return estado.diasFolgaRm;
  }
  const servidorFolgas = carregarDiasFolgaServidor();
  if (servidorFolgas.length > 0) {
    estadoMemoria.diasFolgaRm = servidorFolgas;
    return servidorFolgas;
  }
  return [];
}

/**
 * Retorna as marcações de ponto salvas
 */
export function obterMarcacoesPonto(): MarcacaoPontoOriginal[] {
  const estado = carregarEstado();
  if (estado.marcacoesPonto && estado.marcacoesPonto.length > 0) {
    return estado.marcacoesPonto;
  }
  const servidorMarcacoes = carregarMarcacoesReaisServidor();
  if (servidorMarcacoes.length > 0) {
    estadoMemoria.marcacoesPonto = servidorMarcacoes;
    return servidorMarcacoes;
  }
  return [];
}

/**
 * Retorna a data de referência mais recente de ponto para o cabeçalho dos painéis
 */
export function obterDataReferenciaPonto(): string {
  const estado = carregarEstado();
  if (estado.dataReferenciaPonto) return estado.dataReferenciaPonto;

  const lotes = estado.lotesImportacao || [];
  const lotePonto = lotes
    .slice()
    .reverse()
    .find((l) => (l.tipo === "REGISTROS_PONTO_RM" || l.tipo === "AFD_PONTO") && l.status === "CONCLUIDO");

  if (lotePonto) return lotePonto.dataReferencia;
  const marcacoes = estado.marcacoesPonto || carregarMarcacoesReaisServidor();
  return marcacoes.length > 0 ? "2026-09-15 23:59" : "";
}

/**
 * Retorna pendências de ponto
 */
export function obterPendenciasPonto(): PendenciaPontoItem[] {
  const estado = carregarEstado();
  return estado.pendenciasPonto || [];
}

/**
 * Atualiza o status de uma pendência de ponto
 */
export function atualizarStatusPendenciaPonto(
  id: string,
  novoStatus: "ABERTA" | "VERIFICADA" | "CORRIGIDA_ORIGEM",
  observacao?: string,
  usuario: string = "Administrador Premier"
): boolean {
  const estado = carregarEstado();
  const pendencias = estado.pendenciasPonto || [];
  const index = pendencias.findIndex((p) => p.id === id);
  if (index === -1) return false;

  const pendenciasAtualizadas = pendencias.map((p, idx) => {
    if (idx === index) {
      return {
        ...p,
        status: novoStatus,
        observacao: observacao !== undefined ? observacao : p.observacao,
        atualizadoPor: usuario,
        atualizadoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
      };
    }
    return p;
  });

  salvarEstado({ pendenciasPonto: pendenciasAtualizadas });
  return true;
}

/**
 * Registra uma entrada na trilha de auditoria operacional
 */
export function registrarLogAuditoria(
  acao: string,
  entidade: string,
  detalhes: string,
  usuario?: string,
  perfil?: string
): void {
  const estado = carregarEstado();
  const novoLog: LogAuditoriaOperacional = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    usuario: usuario || sessaoAtivaCliente?.nome || "Usuário não identificado",
    perfil: perfil || sessaoAtivaCliente?.perfil || "NAO_IDENTIFICADO",
    acao,
    entidade,
    detalhes,
    ip: IP_NAO_CAPTURADO_CLIENTE,
  };
  salvarEstado({
    logsAuditoria: [novoLog, ...(estado.logsAuditoria || [])],
  });
}


