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

export interface PostoOperacional {
  id: string;
  codigoPosto: string;
  funcao: string;
  descricao?: string;
  unidadeId: string;
  unidadeNome: string;
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
  tipo: "FUNCIONARIOS_RM" | "ALOCADOS_SIFAC" | "ABONO_RM";
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
    titularMatricula: undefined,
    titularNome: undefined,
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
    titularMatricula: undefined,
    titularNome: undefined,
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
    titularMatricula: undefined,
    titularNome: undefined,
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
    titularMatricula: undefined,
    titularNome: undefined,
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
  apontamentos: ApontamentoOperacional[] = []
): OcupacaoDiaDetalhada {
  const dataObj = new Date(ano, mesIndex, diaNumero);
  const diaDaSemana = dataObj.getDay(); // 0 = Domingo, 6 = Sábado
  const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, "0")}-${String(diaNumero).padStart(2, "0")}`;

  // 1. Posto sem titular alocado no Anexo 1-A
  if (!posto.titularMatricula) {
    return {
      postoCodigo: posto.codigoPosto,
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

  // 5. Dias futuros da competência (ex: após o dia 16/09/2026 em diante)
  if (diaNumero > 16) {
    return {
      postoCodigo: posto.codigoPosto,
      funcaoPosto: posto.funcao,
      data: dataStr,
      diaNumero,
      statusOcupacao: "PENDENTE_APURACAO",
      titularMatricula: posto.titularMatricula,
      titularNome: posto.titularNome,
      motivoPublico: "Jornada futura projetada na escala do mês. Aguardando processamento do ponto.",
      possuiEvidencia: false,
    };
  }

  // 6. Dias passados normais: Titular trabalhou regularmente
  return {
    postoCodigo: posto.codigoPosto,
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
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estadoMemoria));
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

