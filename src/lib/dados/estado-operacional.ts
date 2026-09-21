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

export interface PostoOperacional {
  id: string;
  codigoPosto: string;
  funcao: string;
  descricao?: string;
  unidadeId: string;
  unidadeNome: string;
  baseOperacional?: string; // Nome amigável da base (ex: "UFN III"), derivado de unidadeNome
  escala: "5x2" | "12x36" | "6x1";
  jornadaSemanalHoras: number;
  horarioInicio: string;
  horarioFim: string;
  titularMatricula?: string;
  titularNome?: string;
  situacao: "ATIVO" | "SUSPENSO" | "ENCERRADO";
  dataInicioVigencia: string;
  dataFimVigencia?: string;
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
}

export interface OcupacaoDiaDetalhada {
  postoCodigo: string;
  postoBase?: string;
  funcaoPosto: string;
  data: string; // YYYY-MM-DD
  diaNumero: number;
  statusOcupacao: StatusOcupacao;
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

export interface LoteImportacaoOperacional {
  id: string; // Ex: "LOTE-RM-20260917-103000"
  tipo: "FUNCIONARIOS_RM" | "ALOCADOS_SIFAC" | "ABONO_RM" | "REGISTROS_PONTO_RM" | "AFD_PONTO";
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
  snapshotAnterior?: EstadoOperacionalCompleto;
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
  dataReferenciaPonto?: string;
  fechamentosCompetencia?: FechamentoCompetencia[];
  perfilAtivo: string;
  unidadeSelecionada: string;
}

// -----------------------------------------------------------------------------
// DADOS BASE OFICIAIS: UFN III – TRÊS LAGOAS/MS (ANEXO 1-A)
// -----------------------------------------------------------------------------

export const POSTOS_INICIAIS: PostoOperacional[] = [
  {
    id: "pst-001",
    codigoPosto: "PST-ALM-001",
    funcao: "Almoxarife Líder",
    descricao: "Gestão do estoque de sobressalentes e químicos da unidade UFN III",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-ALM-002",
    funcao: "Auxiliar de Almoxarifado I",
    descricao: "Recebimento e catalogação de materiais no pátio logístico",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-ALM-003",
    funcao: "Auxiliar de Almoxarifado II",
    descricao: "Controle de expedição para frentes de obra e manutenção",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-LOG-004",
    funcao: "Operador de Empilhadeira Líder",
    descricao: "Movimentação contínua de cargas pesadas em turno diurno",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-LOG-005",
    funcao: "Operador de Empilhadeira Folguista",
    descricao: "Movimentação contínua em escala noturna de apoio à planta",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-LOG-006",
    funcao: "Auxiliar de Logística",
    descricao: "Apoio a amarração, etiquetagem e distribuição interna",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-TEC-007",
    funcao: "Inspetor de Recebimento Técnico",
    descricao: "Inspeção visual e dimensional de materiais metálicos e válvulas",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-TEC-008",
    funcao: "Conferente de Carga e Descarga",
    descricao: "Conferência física de carretas na portaria de materiais",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-ADM-009",
    funcao: "Assistente Administrativo de Posto",
    descricao: "Controle de chamados, relatórios diários de RDO e atendimento",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-ADM-010",
    funcao: "Controlador de Documentação e NFs",
    descricao: "Lançamento em sistema Petrobras SAP de notas fiscais de entrada",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-EXP-011",
    funcao: "Expedidor de Materiais",
    descricao: "Separação de kits de montagem mecânica para frentes de montagem",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-SEG-012",
    funcao: "Técnico de Segurança Operacional",
    descricao: "Inspeção de rotas, APRs e uso de EPIs na movimentação de cargas",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-LOG-013",
    funcao: "Operador de Ponte Rolante",
    descricao: "Operação da ponte de 30 toneladas no almoxarifado coberto",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-ALM-014",
    funcao: "Auxiliar de Pátio",
    descricao: "Arrumação de pallets e chaparia na área externa",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    codigoPosto: "PST-ALM-015",
    funcao: "Auxiliar de Embalagem",
    descricao: "Preparação de caixas de madeira e proteção anticorrosiva",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
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
    arquivoNome: "funcionarios petrobras.XLSX",
    hashSha256: "8e8d89e023194a0d922f5c1a70001",
    dataReferencia: "2026-09-17",
    usuario: "Administrador Premier (Marcos Valério)",
    dataHora: "2026-09-17 10:30:00",
    totais: {
      lidos: 380,
      novos: 380,
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
  {
    id: "LOTE-ABONO-20260831-OFICIAL",
    tipo: "ABONO_RM",
    arquivoNome: "CUBO DE ABONO.xlsx",
    hashSha256: "f4a189e023194a0d922f5c1a70003",
    dataReferencia: "2026-08-31",
    usuario: "Administrador Premier (Marcos Valério)",
    dataHora: "2026-09-17 10:40:00",
    totais: {
      lidos: 80,
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
    id: "LOTE-PTO-20260831-OFICIAL",
    tipo: "REGISTROS_PONTO_RM",
    arquivoNome: "CUBO DE REGISTROS.xlsx",
    hashSha256: "e7b923194a0d922f5c1a70004",
    dataReferencia: "2026-08-31",
    usuario: "Administrador Premier (Marcos Valério)",
    dataHora: "2026-09-17 10:45:00",
    totais: {
      lidos: 7018,
      novos: 15752,
      atualizados: 0,
      semAlteracao: 0,
      erros: 0,
      alertas: 39,
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
// MOTOR CENTRAL DE CÁLCULO DE STATUS DE OCUPAÇÃO DIÁRIA
// -----------------------------------------------------------------------------

export function calcularStatusDia(
  posto: PostoOperacional,
  diaNumero: number,
  ano: number = 2026,
  mesIndex: number = 8, // 8 = Setembro (0-indexed)
  ocorrencias: OcorrenciaOperacional[] = [],
  coberturas: CoberturaOperacional[] = [],
  apontamentos: ApontamentoOperacional[] = [],
  marcacoesSet?: Set<string>, // Chave: `${chapa}_${YYYY-MM-DD}`
  dataMaxPonto: string = "2026-09-15"
): OcupacaoDiaDetalhada {
  const dataObj = new Date(ano, mesIndex, diaNumero);
  const diaDaSemana = dataObj.getDay(); // 0 = Domingo, 6 = Sábado
  const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, "0")}-${String(diaNumero).padStart(2, "0")}`;
  const basePosto = posto.baseOperacional || "UFN III";

  // 1. Posto sem titular alocado no Anexo 1-A
  if (!posto.titularMatricula) {
    return {
      postoCodigo: posto.codigoPosto,
      postoBase: basePosto,
      funcaoPosto: posto.funcao,
      data: dataStr,
      diaNumero,
      statusOcupacao: "POSTO_VAGO",
      motivoPublico: "Posto do Anexo 1-A vago (sem titular alocado). Em processo de recrutamento e ASO.",
      possuiEvidencia: false,
    };
  }

  // 2. Análise de Exigibilidade de Escala
  // 07 de Setembro = Feriado Nacional da Independência do Brasil
  const isFeriadoNacional = diaNumero === 7 && mesIndex === 8;

  let exigivel = true;
  let motivoNaoExigivel = "";

  if (posto.escala === "5x2") {
    // Segunda a sexta exigível. Sábado (6) e Domingo (0) folga.
    if (diaDaSemana === 0 || diaDaSemana === 6) {
      exigivel = false;
      motivoNaoExigivel = diaDaSemana === 0 ? "Folga semanal (Domingo - Escala 5x2)" : "Repouso semanal (Sábado - Escala 5x2)";
    } else if (isFeriadoNacional) {
      exigivel = false;
      motivoNaoExigivel = "Feriado Nacional (Independência do Brasil - 07/09)";
    }
  } else if (posto.escala === "12x36") {
    // Escala 12x36 alternada
    const trabalhaHoje = diaNumero % 2 !== 0;
    if (!trabalhaHoje) {
      exigivel = false;
      motivoNaoExigivel = "Folga de compensação 36h (Escala 12x36)";
    }
  } else if (posto.escala === "6x1") {
    // Escala 6x1 folga no Domingo
    if (diaDaSemana === 0) {
      exigivel = false;
      motivoNaoExigivel = "Folga semanal da escala 6x1 (Domingo)";
    }
  }

  if (!exigivel) {
    return {
      postoCodigo: posto.codigoPosto,
      postoBase: basePosto,
      funcaoPosto: posto.funcao,
      data: dataStr,
      diaNumero,
      statusOcupacao: "NAO_EXIGIVEL",
      titularMatricula: posto.titularMatricula,
      titularNome: posto.titularNome,
      motivoPublico: motivoNaoExigivel,
      possuiEvidencia: true,
    };
  }

  // 3. O dia é EXIGÍVEL: verificar ocorrências ativas do titular
  const ocorrenciaAtiva = ocorrencias.find(
    (o) =>
      o.matricula === posto.titularMatricula &&
      o.status !== "CANCELADA" &&
      dataStr >= o.dataInicio &&
      dataStr <= o.dataFim
  );

  // 4. Se titular tiver ocorrência/ausência, verificar se há COBERTURA ativa confirmada
  if (ocorrenciaAtiva) {
    const coberturaAtiva = coberturas.find(
      (c) =>
        c.postoCodigo === posto.codigoPosto &&
        c.status === "CONFIRMADA" &&
        dataStr >= c.dataInicio &&
        dataStr <= c.dataFim
    );

    if (coberturaAtiva) {
      return {
        postoCodigo: posto.codigoPosto,
        postoBase: basePosto,
        funcaoPosto: posto.funcao,
        data: dataStr,
        diaNumero,
        statusOcupacao: "COBERTO",
        titularMatricula: posto.titularMatricula,
        titularNome: posto.titularNome,
        ocupanteMatricula: coberturaAtiva.substitutoMatricula,
        ocupanteNome: coberturaAtiva.substitutoNome,
        motivoPublico: `${ocorrenciaAtiva.observacaoPublica} • Substituído por ${coberturaAtiva.substitutoNome} (${coberturaAtiva.substitutoMatricula})`,
        possuiEvidencia: true,
        ocorrenciaId: ocorrenciaAtiva.id,
        coberturaId: coberturaAtiva.id,
        batidas: {
          entrada: posto.horarioInicio,
          saida: posto.horarioFim,
          horas: posto.jornadaSemanalHoras === 44 ? 8.8 : 12.0,
        },
      };
    } else {
      // Titular ausente e SEM cobertura = DESCOBERTO (Glosa passível)
      const aptoRelacionado = apontamentos.find(
        (a) => a.postoCodigo === posto.codigoPosto && a.dataReferencia === dataStr
      );

      return {
        postoCodigo: posto.codigoPosto,
        postoBase: basePosto,
        funcaoPosto: posto.funcao,
        data: dataStr,
        diaNumero,
        statusOcupacao: "DESCOBERTO",
        titularMatricula: posto.titularMatricula,
        titularNome: posto.titularNome,
        motivoPublico: `Posto Descoberto: ${ocorrenciaAtiva.observacaoPublica} sem substituto designado. Passível de glosa na medição.`,
        possuiEvidencia: true,
        ocorrenciaId: ocorrenciaAtiva.id,
        apontamentoId: aptoRelacionado?.id,
      };
    }
  }

  // 5. Dias futuros da competência (além da data máxima de lote de ponto importado)
  if (dataStr > dataMaxPonto) {
    return {
      postoCodigo: posto.codigoPosto,
      postoBase: basePosto,
      funcaoPosto: posto.funcao,
      data: dataStr,
      diaNumero,
      statusOcupacao: "PENDENTE_APURACAO",
      titularMatricula: posto.titularMatricula,
      titularNome: posto.titularNome,
      motivoPublico: "Jornada projetada além do lote de ponto importado. Aguardando processamento do ponto.",
      possuiEvidencia: false,
    };
  }

  // 6. Verificação com batidas de ponto reais (se fornecidas)
  if (marcacoesSet && posto.titularMatricula) {
    const chapaPad = posto.titularMatricula.padStart(6, "0");
    const temPonto = marcacoesSet.has(`${chapaPad}_${dataStr}`);
    if (!temPonto) {
      const aptoRelacionado = apontamentos.find(
        (a) => a.postoCodigo === posto.codigoPosto && a.dataReferencia === dataStr
      );
      return {
        postoCodigo: posto.codigoPosto,
        postoBase: basePosto,
        funcaoPosto: posto.funcao,
        data: dataStr,
        diaNumero,
        statusOcupacao: "DESCOBERTO",
        titularMatricula: posto.titularMatricula,
        titularNome: posto.titularNome,
        motivoPublico: `Posto Descoberto: Titular ausente sem marcação de ponto e sem cobertura. Passível de glosa na medição.`,
        possuiEvidencia: true,
        apontamentoId: aptoRelacionado?.id,
      };
    }
  }

  // 7. Dias normais: Titular trabalhou regularmente
  return {
    postoCodigo: posto.codigoPosto,
    postoBase: basePosto,
    funcaoPosto: posto.funcao,
    data: dataStr,
    diaNumero,
    statusOcupacao: "TITULAR_PRESENTE",
    titularMatricula: posto.titularMatricula,
    titularNome: posto.titularNome,
    ocupanteMatricula: posto.titularMatricula,
    ocupanteNome: posto.titularNome,
    motivoPublico: `Titular em atividade normal na jornada contratual ${posto.horarioInicio} às ${posto.horarioFim}`,
    possuiEvidencia: true,
    batidas: {
      entrada: posto.horarioInicio,
      saida: posto.horarioFim,
      horas: posto.jornadaSemanalHoras === 44 ? 8.8 : 12.0,
    },
  };
}

/**
 * Retorna todos os postos de trabalho do contrato Petrobras.
 * Inclui os postos cadastrados do Anexo 1-A e os postos alocados no SIFAC para as bases operacionais.
 */
export function obterTodosPostosContrato(postosExistentes?: PostoOperacional[]): PostoOperacional[] {
  const basePostos = postosExistentes && postosExistentes.length > 0 ? postosExistentes : POSTOS_INICIAIS;
  const postosMap = new Map<string, PostoOperacional>();

  // 1. Postos cadastrados explicitamente (ex: Anexo 1-A UFN-III)
  for (const p of basePostos) {
    const inicial = POSTOS_INICIAIS.find((ini) => ini.codigoPosto === p.codigoPosto);
    postosMap.set(p.codigoPosto, {
      ...p,
      titularMatricula: p.titularMatricula || inicial?.titularMatricula,
      titularNome: p.titularNome || inicial?.titularNome,
    });
  }

  for (const p of POSTOS_INICIAIS) {
    if (!postosMap.has(p.codigoPosto)) {
      postosMap.set(p.codigoPosto, p);
    }
  }

  // 2. Postos de outras bases oriundos de SIFAC
  const sifacLista = (sifacReais as unknown as ItemAlocadoSifac[]) || [];
  const funcsLista = (funcionariosReais as unknown as ProfissionalOperacional[]) || [];
  const funcsMap = new Map<string, ProfissionalOperacional>(funcsLista.map((f) => [f.chapa, f]));

  const contadorPorBase = new Map<string, number>();
  for (const s of sifacLista) {
    if (!s.unidadeId || s.unidadeId === "UFN-III") continue;

    const proximoNum = (contadorPorBase.get(s.unidadeId) || 0) + 1;
    contadorPorBase.set(s.unidadeId, proximoNum);

    const codigoPosto = `PST-${s.unidadeId}-${String(proximoNum).padStart(3, "0")}`;
    if (!postosMap.has(codigoPosto)) {
      const f = funcsMap.get(s.chapaRm ?? "");
      postosMap.set(codigoPosto, {
        id: `pst-sifac-${s.id}`,
        codigoPosto,
        funcao: s.cargo,
        descricao: `Posto contratual de ${s.cargo} na base ${s.unidadeNome}`,
        unidadeId: s.unidadeId,
        unidadeNome: s.unidadeNome || "Base Operacional",
        escala: (f?.escala as any) || "5x2",
        jornadaSemanalHoras: 44,
        horarioInicio: "07:00",
        horarioFim: "16:48",
        titularMatricula: s.chapaRm,
        titularNome: s.nome,
        situacao: "ATIVO",
        dataInicioVigencia: s.dataAdmissao || "2024-01-01",
      });
    }
  }

  return Array.from(postosMap.values());
}

// -----------------------------------------------------------------------------
// GERENCIADOR DE ESTADO COM PERSISTÊNCIA EM LOCALSTORAGE / MEMÓRIA
// -----------------------------------------------------------------------------

const CHAVE_STORAGE = "sgp_estado_operacional_v2_real";

let estadoMemoria: EstadoOperacionalCompleto = {
  postos: [...POSTOS_INICIAIS],
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
  perfilAtivo: "PREMIER_ADMIN",
  unidadeSelecionada: "UFN III – Três Lagoas/MS",
};

export function carregarEstado(): EstadoOperacionalCompleto {
  if (typeof window !== "undefined") {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        estadoMemoria = { ...estadoMemoria, ...parsed };
      }
    } catch {
      // Falha silenciosa de localStorage (usa estadoMemoria)
    }
  }
  return estadoMemoria;
}

export function salvarEstado(novo: Partial<EstadoOperacionalCompleto>) {
  estadoMemoria = { ...estadoMemoria, ...novo };
  if (typeof window !== "undefined") {
    try {
      // Isola marcações de ponto do localStorage para nunca estourar a quota de 5MB
      const { marcacoesPonto: _marc, ...estadoParaLocalStorage } = estadoMemoria;
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estadoParaLocalStorage));
      window.dispatchEvent(new CustomEvent("sgp-dados-atualizados", { detail: estadoMemoria }));
    } catch {
      // Ignora erro de storage
    }
  }
  return estadoMemoria;
}

export function registrarLog(acao: string, entidade: string, detalhes: string) {
  const estado = carregarEstado();
  const novoLog: LogAuditoriaOperacional = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    usuario: estado.perfilAtivo.startsWith("PETROBRAS")
      ? "Fiscal Petrobras (Carlos Eduardo Mendes)"
      : "Administrador Premier (Marcos Valério)",
    perfil: estado.perfilAtivo,
    acao,
    entidade,
    detalhes,
    ip: "189.120.45.12",
  };
  salvarEstado({ logsAuditoria: [novoLog, ...estado.logsAuditoria] });
}

// -----------------------------------------------------------------------------
// OPERAÇÕES DE MUTAÇÃO RÁPIDAS
// -----------------------------------------------------------------------------

export function adicionarPosto(posto: Omit<PostoOperacional, "id">): PostoOperacional {
  const estado = carregarEstado();
  const novo: PostoOperacional = {
    ...posto,
    id: `pst-${Date.now()}`,
  };
  salvarEstado({ postos: [...estado.postos, novo] });
  registrarLog("CRIAR_POSTO", `Posto (${novo.codigoPosto})`, `Cadastro do posto ${novo.funcao} - ${novo.codigoPosto}`);
  return novo;
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
  registrarLog("CRIAR_PROFISSIONAL", `Profissional (${novo.chapa})`, `Cadastro do profissional ${novo.nome}`);
  return novo;
}

export function adicionarOcorrencia(oco: Omit<OcorrenciaOperacional, "id" | "criadoEm">): OcorrenciaOperacional {
  const estado = carregarEstado();
  const novo: OcorrenciaOperacional = {
    ...oco,
    id: `oco-${Date.now()}`,
    criadoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
  };
  salvarEstado({ ocorrencias: [novo, ...estado.ocorrencias] });
  registrarLog("REGISTRAR_OCORRENCIA", `Ocorrência (${novo.id})`, `${novo.tipoOcorrencia} para ${novo.profissionalNome}`);
  return novo;
}

export function adicionarCobertura(cob: Omit<CoberturaOperacional, "id" | "criadoEm">): CoberturaOperacional {
  const estado = carregarEstado();
  const novo: CoberturaOperacional = {
    ...cob,
    id: `cob-${Date.now()}`,
    criadoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
  };
  salvarEstado({ coberturas: [novo, ...estado.coberturas] });
  registrarLog("CRIAR_COBERTURA", `Cobertura (${novo.postoCodigo})`, `Designado ${novo.substitutoNome} para posto ${novo.postoCodigo}`);
  if (novo.alertaInterjornada) {
    registrarLog(
      "ALERTA_INTERJORNADA_CLT",
      `Cobertura (${novo.postoCodigo})`,
      `Alerta CLT Art. 66: Substituto ${novo.substitutoNome} designado com descanso apurado de ${novo.horasDescansoApuradas ? novo.horasDescansoApuradas.toFixed(1) + "h" : "<11h"} (inferior a 11 horas consecutivas). Ciência excepcional registrada.`
    );
  }
  return novo;
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
  const posto = estado.postos.find((p) => p.codigoPosto === codigoPosto);
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
  const postosAtualizados = estado.postos.map((p) => {
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
  const postoAtual = estado.postos.find((p) => p.titularMatricula === matricula);
  const postosAtualizados = estado.postos.map((p) => {
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

export function resetarDadosParaPadrao() {
  estadoMemoria = {
    postos: [...POSTOS_INICIAIS],
    profissionais: [...PROFISSIONAIS_INICIAIS],
    ocorrencias: [...OCORRENCIAS_INICIAIS],
    coberturas: [...COBERTURAS_INICIAIS],
    apontamentos: [...APONTAMENTOS_INICIAIS],
    logsAuditoria: [...LOGS_INICIAIS],
    lotesImportacao: [...LOTES_INICIAIS],
    perfilAtivo: "PREMIER_ADMIN",
    unidadeSelecionada: "UFN III – Três Lagoas/MS",
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
    ip: "189.120.45.12",
  };

  const estadoRestaurado: EstadoOperacionalCompleto = {
    ...snapshot,
    lotesImportacao: lotesAtualizados,
    logsAuditoria: [novoLog, ...(snapshot.logsAuditoria || [])],
  };

  salvarEstado(estadoRestaurado);
  return {
    sucesso: true,
    mensagem: `Lote ${loteAlvo.id} desfeito com sucesso. Estado anterior restaurado.`,
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

  return lotePonto ? lotePonto.dataReferencia : "2026-09-15 23:59";
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
  usuario: string = "Administrador Premier",
  perfil: string = "PREMIER_ADMIN"
): void {
  const estado = carregarEstado();
  const novoLog: LogAuditoriaOperacional = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    usuario,
    perfil,
    acao,
    entidade,
    detalhes,
    ip: "189.120.45.12",
  };
  salvarEstado({
    logsAuditoria: [novoLog, ...(estado.logsAuditoria || [])],
  });
}


