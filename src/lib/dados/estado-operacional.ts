/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Camada de Dados Operacionais e Motor de Consolidação de Ocupação Diária
 *
 * Provê sincronização em memória / localStorage para execução local imediata,
 * alinhada com o modelo Prisma Neon PostgreSQL e regras de negócio do Item 11.3 do contrato.
 */

import { StatusOcupacao } from "@/components/ui/badge-status";
import { mascararCpf } from "@/lib/importadores/tipos";

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

export interface ProfissionalOperacional {
  id: string;
  matricula: string;
  nome: string;
  cpfMascarado: string;
  cpfLimpo: string;
  funcao: string;
  unidadeId: string;
  postoCodigo?: string;
  escala: "5x2" | "12x36" | "6x1";
  situacao: "ATIVO" | "AFASTADO" | "FERIAS" | "DESLIGADO";
  dataAdmissao: string;
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

// -----------------------------------------------------------------------------
// DADOS BASE OFICIAIS: UFN III – TRÊS LAGOAS/MS (ANEXO 1-A)
// -----------------------------------------------------------------------------

const POSTOS_INICIAIS: PostoOperacional[] = [
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
    titularMatricula: "PRM-00101",
    titularNome: "Carlos Eduardo Silva",
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
    titularMatricula: "PRM-00102",
    titularNome: "Mariana Souza Lima",
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
    titularMatricula: "PRM-00103",
    titularNome: "Roberto Alves Ferreira",
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
    titularMatricula: "PRM-00104",
    titularNome: "José Pereira Santos",
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
    titularMatricula: "PRM-00105",
    titularNome: "Fernando Henrique Dias",
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
    titularMatricula: "PRM-00106",
    titularNome: "Juliana Martins Rocha",
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
    titularMatricula: "PRM-00107",
    titularNome: "André Luiz Costa",
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
    titularMatricula: "PRM-00108",
    titularNome: "Paulo Ricardo Gomes",
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
    titularMatricula: "PRM-00109",
    titularNome: "Patrícia Helena Neves",
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
    titularMatricula: "PRM-00110",
    titularNome: "Lucas Gabriel Ribeiro",
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
    titularMatricula: "PRM-00111",
    titularNome: "Marcelo Tavares Pinto",
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
    titularMatricula: "PRM-00112",
    titularNome: "Marcos Vinícius Moura",
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
    titularMatricula: undefined, // Posto VAGO intencional para auditoria
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
    titularMatricula: "PRM-00114",
    titularNome: "Thiago Barbosa",
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
    titularMatricula: "PRM-00113",
    titularNome: "Beatriz Santos Cruz",
    situacao: "ATIVO",
    dataInicioVigencia: "2024-05-01",
  },
];

const PROFISSIONAIS_INICIAIS: ProfissionalOperacional[] = [
  {
    id: "prf-101",
    matricula: "PRM-00101",
    nome: "Carlos Eduardo Silva",
    cpfLimpo: "12345678901",
    cpfMascarado: mascararCpf("12345678901"),
    funcao: "Almoxarife Líder",
    unidadeId: "UFN-III",
    postoCodigo: "PST-ALM-001",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-01-02",
    telefoneCorporativo: "(67) 99881-1001",
    dadosRestritos: {
      salario: 4850.0,
      endereco: "Av. Ranulpho Marques Leal, 1420, Três Lagoas/MS",
      telefonePessoal: "(67) 98112-4433",
      emailPessoal: "carlos.silva.log@gmail.com",
    },
  },
  {
    id: "prf-102",
    matricula: "PRM-00102",
    nome: "Mariana Souza Lima",
    cpfLimpo: "23456789012",
    cpfMascarado: mascararCpf("23456789012"),
    funcao: "Auxiliar de Almoxarifado I",
    unidadeId: "UFN-III",
    postoCodigo: "PST-ALM-002",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-01-05",
    telefoneCorporativo: "(67) 99881-1002",
    dadosRestritos: {
      salario: 2650.0,
      endereco: "Rua Capitão Olinto Mancini, 890, Três Lagoas/MS",
      telefonePessoal: "(67) 98455-1122",
    },
  },
  {
    id: "prf-103",
    matricula: "PRM-00103",
    nome: "Roberto Alves Ferreira",
    cpfLimpo: "34567890123",
    cpfMascarado: mascararCpf("34567890123"),
    funcao: "Auxiliar de Almoxarifado II",
    unidadeId: "UFN-III",
    postoCodigo: "PST-ALM-003",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-01-15",
    telefoneCorporativo: "(67) 99881-1003",
    dadosRestritos: {
      salario: 2650.0,
      endereco: "Rua Bruno Garcia, 340, Três Lagoas/MS",
    },
  },
  {
    id: "prf-104",
    matricula: "PRM-00104",
    nome: "José Pereira Santos",
    cpfLimpo: "45678901234",
    cpfMascarado: mascararCpf("45678901234"),
    funcao: "Operador de Empilhadeira Líder",
    unidadeId: "UFN-III",
    postoCodigo: "PST-LOG-004",
    escala: "12x36",
    situacao: "ATIVO",
    dataAdmissao: "2024-02-01",
    telefoneCorporativo: "(67) 99881-1004",
    dadosRestritos: {
      salario: 3450.0,
    },
  },
  {
    id: "prf-105",
    matricula: "PRM-00105",
    nome: "Fernando Henrique Dias",
    cpfLimpo: "56789012345",
    cpfMascarado: mascararCpf("56789012345"),
    funcao: "Operador de Empilhadeira Folguista",
    unidadeId: "UFN-III",
    postoCodigo: "PST-LOG-005",
    escala: "12x36",
    situacao: "ATIVO",
    dataAdmissao: "2024-02-01",
    telefoneCorporativo: "(67) 99881-1005",
    dadosRestritos: {
      salario: 3450.0,
    },
  },
  {
    id: "prf-106",
    matricula: "PRM-00106",
    nome: "Juliana Martins Rocha",
    cpfLimpo: "67890123456",
    cpfMascarado: mascararCpf("67890123456"),
    funcao: "Auxiliar de Logística",
    unidadeId: "UFN-III",
    postoCodigo: "PST-LOG-006",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-02-15",
    telefoneCorporativo: "(67) 99881-1006",
    dadosRestritos: {
      salario: 2450.0,
    },
  },
  {
    id: "prf-107",
    matricula: "PRM-00107",
    nome: "André Luiz Costa",
    cpfLimpo: "78901234567",
    cpfMascarado: mascararCpf("78901234567"),
    funcao: "Inspetor de Recebimento Técnico",
    unidadeId: "UFN-III",
    postoCodigo: "PST-TEC-007",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-03-01",
    telefoneCorporativo: "(67) 99881-1007",
    dadosRestritos: {
      salario: 4200.0,
    },
  },
  {
    id: "prf-108",
    matricula: "PRM-00108",
    nome: "Paulo Ricardo Gomes",
    cpfLimpo: "89012345678",
    cpfMascarado: mascararCpf("89012345678"),
    funcao: "Conferente de Carga e Descarga",
    unidadeId: "UFN-III",
    postoCodigo: "PST-TEC-008",
    escala: "6x1",
    situacao: "ATIVO",
    dataAdmissao: "2024-03-01",
    telefoneCorporativo: "(67) 99881-1008",
    dadosRestritos: {
      salario: 2900.0,
    },
  },
  {
    id: "prf-109",
    matricula: "PRM-00109",
    nome: "Patrícia Helena Neves",
    cpfLimpo: "90123456789",
    cpfMascarado: mascararCpf("90123456789"),
    funcao: "Assistente Administrativo de Posto",
    unidadeId: "UFN-III",
    postoCodigo: "PST-ADM-009",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-03-15",
    telefoneCorporativo: "(67) 99881-1009",
    dadosRestritos: {
      salario: 3100.0,
    },
  },
  {
    id: "prf-110",
    matricula: "PRM-00110",
    nome: "Lucas Gabriel Ribeiro",
    cpfLimpo: "01234567890",
    cpfMascarado: mascararCpf("01234567890"),
    funcao: "Controlador de Documentação e NFs",
    unidadeId: "UFN-III",
    postoCodigo: "PST-ADM-010",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-04-01",
    telefoneCorporativo: "(67) 99881-1010",
    dadosRestritos: {
      salario: 3100.0,
    },
  },
  {
    id: "prf-111",
    matricula: "PRM-00111",
    nome: "Marcelo Tavares Pinto",
    cpfLimpo: "11223344556",
    cpfMascarado: mascararCpf("11223344556"),
    funcao: "Expedidor de Materiais",
    unidadeId: "UFN-III",
    postoCodigo: "PST-EXP-011",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-04-01",
    telefoneCorporativo: "(67) 99881-1011",
    dadosRestritos: {
      salario: 2650.0,
    },
  },
  {
    id: "prf-112",
    matricula: "PRM-00112",
    nome: "Marcos Vinícius Moura",
    cpfLimpo: "22334455667",
    cpfMascarado: mascararCpf("22334455667"),
    funcao: "Técnico de Segurança Operacional",
    unidadeId: "UFN-III",
    postoCodigo: "PST-SEG-012",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-04-15",
    telefoneCorporativo: "(67) 99881-1012",
    dadosRestritos: {
      salario: 4100.0,
    },
  },
  {
    id: "prf-113",
    matricula: "PRM-00113",
    nome: "Beatriz Santos Cruz",
    cpfLimpo: "33445566778",
    cpfMascarado: mascararCpf("33445566778"),
    funcao: "Auxiliar de Embalagem",
    unidadeId: "UFN-III",
    postoCodigo: "PST-ALM-015",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-05-01",
    telefoneCorporativo: "(67) 99881-1013",
    dadosRestritos: {
      salario: 2450.0,
    },
  },
  {
    id: "prf-114",
    matricula: "PRM-00114",
    nome: "Thiago Barbosa",
    cpfLimpo: "44556677889",
    cpfMascarado: mascararCpf("44556677889"),
    funcao: "Auxiliar de Pátio",
    unidadeId: "UFN-III",
    postoCodigo: "PST-ALM-014",
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-05-01",
    telefoneCorporativo: "(67) 99881-1014",
    dadosRestritos: {
      salario: 2500.0,
    },
  },
  {
    id: "prf-115",
    matricula: "PRM-00115",
    nome: "Diego Camargo Silveira",
    cpfLimpo: "55667788990",
    cpfMascarado: mascararCpf("55667788990"),
    funcao: "Substituto Operacional / Folguista",
    unidadeId: "UFN-III",
    postoCodigo: undefined, // Reserva Técnica / Substituto dedicado
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-06-01",
    telefoneCorporativo: "(67) 99881-1015",
    dadosRestritos: {
      salario: 2700.0,
    },
  },
  {
    id: "prf-116",
    matricula: "PRM-00116",
    nome: "Aline Mendes Castro",
    cpfLimpo: "66778899001",
    cpfMascarado: mascararCpf("66778899001"),
    funcao: "Assistente de Apoio e Reserva",
    unidadeId: "UFN-III",
    postoCodigo: undefined,
    escala: "5x2",
    situacao: "ATIVO",
    dataAdmissao: "2024-06-15",
    telefoneCorporativo: "(67) 99881-1016",
    dadosRestritos: {
      salario: 2900.0,
    },
  },
];

const OCORRENCIAS_INICIAIS: OcorrenciaOperacional[] = [
  {
    id: "oco-001",
    matricula: "PRM-00114",
    profissionalNome: "Thiago Barbosa",
    postoCodigo: "PST-ALM-014",
    tipoOcorrencia: "ATESTADO_MEDICO",
    dataInicio: "2026-09-03",
    dataFim: "2026-09-05",
    diasAfetados: 3,
    status: "VALIDADA",
    observacaoPublica: "Ausência justificada — atestado médico homologado pelo SESMT",
    dadoSensivel: {
      cid: "M54.5",
      descricaoClinica: "Lumbago com ciática aguda, repouso médico de 3 dias",
      profissionalEmissor: "Dr. Roberto Mendes",
      crm: "12345/MS",
    },
    criadoEm: "2026-09-03 08:30",
  },
  {
    id: "oco-002",
    matricula: "PRM-00113",
    profissionalNome: "Beatriz Santos Cruz",
    postoCodigo: "PST-ALM-015",
    tipoOcorrencia: "FALTA_INJUSTIFICADA",
    dataInicio: "2026-09-08",
    dataFim: "2026-09-08",
    diasAfetados: 1,
    status: "VALIDADA",
    observacaoPublica: "Ausência não justificada — não houve aviso tempestivo nem substituto imediato",
    criadoEm: "2026-09-08 09:15",
  },
  {
    id: "oco-003",
    matricula: "PRM-00102",
    profissionalNome: "Mariana Souza Lima",
    postoCodigo: "PST-ALM-002",
    tipoOcorrencia: "TREINAMENTO",
    dataInicio: "2026-09-11",
    dataFim: "2026-09-11",
    diasAfetados: 1,
    status: "VALIDADA",
    observacaoPublica: "Treinamento obrigatório de Segurança NR-11 na base administrativa",
    criadoEm: "2026-09-10 14:00",
  },
];

const COBERTURAS_INICIAIS: CoberturaOperacional[] = [
  {
    id: "cob-001",
    postoCodigo: "PST-ALM-014",
    funcaoPosto: "Auxiliar de Pátio",
    titularMatricula: "PRM-00114",
    titularNome: "Thiago Barbosa",
    substitutoMatricula: "PRM-00115",
    substitutoNome: "Diego Camargo Silveira",
    dataInicio: "2026-09-03",
    dataFim: "2026-09-05",
    tipoCobertura: "SUBSTITUICAO_INTERNA",
    status: "CONFIRMADA",
    justificativa: "Cobertura contratual integral do posto de Auxiliar de Pátio durante afastamento médico do titular",
    ocorrenciaId: "oco-001",
    criadoEm: "2026-09-03 08:45",
  },
  {
    id: "cob-002",
    postoCodigo: "PST-ALM-002",
    funcaoPosto: "Auxiliar de Almoxarifado I",
    titularMatricula: "PRM-00102",
    titularNome: "Mariana Souza Lima",
    substitutoMatricula: "PRM-00116",
    substitutoNome: "Aline Mendes Castro",
    dataInicio: "2026-09-11",
    dataFim: "2026-09-11",
    tipoCobertura: "SUBSTITUICAO_INTERNA",
    status: "CONFIRMADA",
    justificativa: "Substituição para cobertura de posto durante participação em Treinamento NR-11",
    ocorrenciaId: "oco-003",
    criadoEm: "2026-09-10 14:30",
  },
];

const APONTAMENTOS_INICIAIS: ApontamentoOperacional[] = [
  {
    id: "apt-001",
    postoCodigo: "PST-ALM-015",
    funcaoPosto: "Auxiliar de Embalagem",
    dataReferencia: "2026-09-08",
    competencia: "Setembro / 2026",
    texto: "Posto desocupado no turno matutino sem presença do titular (Beatriz Santos Cruz) e sem substituto alocado na escala.",
    criadoPor: "Fiscal Petrobras (Carlos Eduardo Mendes)",
    dataCriacao: "2026-09-08 11:20",
    status: "RESPONDIDO",
    respostaPremier: "Identificada falta injustificada da colaboradora. Notificação disciplinar aplicada e glosa de 1 diária contratual reconhecida para a Memória de Cálculo.",
    respondidoPor: "Gestor Premier (Marcos Valério)",
    respondidoEm: "2026-09-08 16:40",
  },
  {
    id: "apt-002",
    postoCodigo: "PST-LOG-013",
    funcaoPosto: "Operador de Ponte Rolante",
    dataReferencia: "2026-09-01",
    competencia: "Setembro / 2026",
    texto: "Solicitamos previsão de alocação de titular efetivo para o posto de Operador de Ponte Rolante (atualmente vago no Anexo 1-A).",
    criadoPor: "Fiscal Petrobras (Carlos Eduardo Mendes)",
    dataCriacao: "2026-09-02 09:15",
    status: "EM_TRATAMENTO",
    respostaPremier: "Candidato em processo de integração e exames admissionais ASO. Previsão de início em 22/09/2026.",
    respondidoPor: "RH Premier (Fabiana Ribeiro)",
    respondidoEm: "2026-09-03 10:00",
  },
];

const LOGS_INICIAIS: LogAuditoriaOperacional[] = [
  {
    id: "log-001",
    timestamp: "2026-09-08 16:40:12",
    usuario: "Gestor Premier (Marcos Valério)",
    perfil: "PREMIER_GESTOR_CONTRATO",
    acao: "RESPONDER_APONTAMENTO",
    entidade: "Apontamento (apt-001)",
    detalhes: "Resposta e reconhecimento de glosa de 1 diária no posto PST-ALM-015",
    ip: "189.120.45.12",
  },
  {
    id: "log-002",
    timestamp: "2026-09-08 11:20:05",
    usuario: "Fiscal Petrobras (Carlos Eduardo Mendes)",
    perfil: "PETROBRAS_FISCAL",
    acao: "REGISTRAR_APONTAMENTO",
    entidade: "Apontamento (apt-001)",
    detalhes: "Abertura de apontamento por posto desocupado em 08/09/2026",
    ip: "200.180.30.5",
  },
  {
    id: "log-003",
    timestamp: "2026-09-03 08:45:22",
    usuario: "Supervisor Premier (Renato Silva)",
    perfil: "PREMIER_SUPERVISOR",
    acao: "CRIAR_COBERTURA",
    entidade: "Cobertura (cob-001)",
    detalhes: "Designação de Diego Camargo Silveira para cobrir PST-ALM-014",
    ip: "189.120.45.12",
  },
  {
    id: "log-004",
    timestamp: "2026-09-03 08:30:10",
    usuario: "RH Premier (Fabiana Ribeiro)",
    perfil: "PREMIER_RH",
    acao: "REGISTRAR_OCORRENCIA",
    entidade: "Ocorrencia (oco-001)",
    detalhes: "Atestado médico homologado com segregação de CID em tabela restrita",
    ip: "189.120.45.12",
  },
  {
    id: "log-005",
    timestamp: "2026-09-01 07:00:00",
    usuario: "Sistema (Motor Consolidação)",
    perfil: "SISTEMA",
    acao: "INICIALIZAR_COMPETENCIA",
    entidade: "OcupacaoPostoDia",
    detalhes: "Abertura da competência Setembro/2026 para 15 postos da UFN III",
    ip: "127.0.0.1",
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

const CHAVE_STORAGE = "sgp_estado_operacional_v1";

export interface EstadoOperacionalCompleto {
  postos: PostoOperacional[];
  profissionais: ProfissionalOperacional[];
  ocorrencias: OcorrenciaOperacional[];
  coberturas: CoberturaOperacional[];
  apontamentos: ApontamentoOperacional[];
  logsAuditoria: LogAuditoriaOperacional[];
  perfilAtivo: string;
  unidadeSelecionada: string;
}

let estadoMemoria: EstadoOperacionalCompleto = {
  postos: [...POSTOS_INICIAIS],
  profissionais: [...PROFISSIONAIS_INICIAIS],
  ocorrencias: [...OCORRENCIAS_INICIAIS],
  coberturas: [...COBERTURAS_INICIAIS],
  apontamentos: [...APONTAMENTOS_INICIAIS],
  logsAuditoria: [...LOGS_INICIAIS],
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

export function adicionarProfissional(prof: Omit<ProfissionalOperacional, "id" | "cpfMascarado">): ProfissionalOperacional {
  const estado = carregarEstado();
  const novo: ProfissionalOperacional = {
    ...prof,
    id: `prf-${Date.now()}`,
    cpfMascarado: mascararCpf(prof.cpfLimpo),
  };
  salvarEstado({ profissionais: [...estado.profissionais, novo] });
  registrarLog("CRIAR_PROFISSIONAL", `Profissional (${novo.matricula})`, `Cadastro do profissional ${novo.nome}`);
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

export function alternarPerfil(novoPerfil: string) {
  salvarEstado({ perfilAtivo: novoPerfil });
  registrarLog("ALTERAR_PERFIL", "Sessão", `Perfil alterado para ${novoPerfil}`);
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
    perfilAtivo: "PREMIER_ADMIN",
    unidadeSelecionada: "UFN III – Três Lagoas/MS",
  };
  if (typeof window !== "undefined") {
    localStorage.removeItem(CHAVE_STORAGE);
    window.dispatchEvent(new CustomEvent("sgp-dados-atualizados", { detail: estadoMemoria }));
  }
  return estadoMemoria;
}
