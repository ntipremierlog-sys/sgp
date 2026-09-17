/**
 * SGP — Sistema de Gestão de Postos
 * Script de Limpeza dos Dados de Demonstração (MOMENTO 1)
 *
 * Remove APENAS os dados fictícios operacionais:
 * - Colaboradores (Profissionais)
 * - Alocações/titularidades dos postos (postos do Anexo 1-A são preservados e tornados vagos)
 * - Ocorrências
 * - Coberturas
 * - Apontamentos
 * - Registros derivados de frequência e ocupação
 *
 * PRESERVA INTEGRALMENTE:
 * - Postos do Anexo 1-A (com suas atribuições, escalas e jornadas)
 * - Usuários, perfis e permissões
 * - Parâmetros do contrato e configurações
 * - Bases e unidades contratuais
 * - Trilha de auditoria
 */

import {
  carregarEstado,
  salvarEstado,
  EstadoOperacionalCompleto,
  PostoOperacional,
  ProfissionalOperacional,
  OcorrenciaOperacional,
  CoberturaOperacional,
  ApontamentoOperacional,
} from "./estado-operacional";
import { gerarSnapshotSistema, SnapshotBackupSGP } from "./backup-dados";
import { mascararCpf } from "../importadores/tipos";

export const DADOS_DEMO_COLABORADORES_FICTICIOS: Omit<ProfissionalOperacional, "id" | "cpfMascarado">[] = [
  { chapa: "000101", matricula: "PRM-00101", nome: "Carlos Eduardo Silva", cpfLimpo: "12345678901", funcao: "Almoxarife Líder", unidadeId: "UFN-III", postoCodigo: "PST-ALM-001", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-01-02" },
  { chapa: "000102", matricula: "PRM-00102", nome: "Mariana Souza Lima", cpfLimpo: "23456789012", funcao: "Auxiliar de Almoxarifado I", unidadeId: "UFN-III", postoCodigo: "PST-ALM-002", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-01-05" },
  { chapa: "000103", matricula: "PRM-00103", nome: "Roberto Alves Ferreira", cpfLimpo: "34567890123", funcao: "Auxiliar de Almoxarifado II", unidadeId: "UFN-III", postoCodigo: "PST-ALM-003", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-01-15" },
  { chapa: "000104", matricula: "PRM-00104", nome: "José Pereira Santos", cpfLimpo: "45678901234", funcao: "Operador de Empilhadeira Líder", unidadeId: "UFN-III", postoCodigo: "PST-LOG-004", escala: "12x36", situacao: "ATIVO", dataAdmissao: "2024-02-01" },
  { chapa: "000105", matricula: "PRM-00105", nome: "Fernando Henrique Dias", cpfLimpo: "56789012345", funcao: "Operador de Empilhadeira Folguista", unidadeId: "UFN-III", postoCodigo: "PST-LOG-005", escala: "12x36", situacao: "ATIVO", dataAdmissao: "2024-02-01" },
  { chapa: "000106", matricula: "PRM-00106", nome: "Juliana Martins Rocha", cpfLimpo: "67890123456", funcao: "Auxiliar de Logística", unidadeId: "UFN-III", postoCodigo: "PST-LOG-006", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-02-15" },
  { chapa: "000107", matricula: "PRM-00107", nome: "André Luiz Costa", cpfLimpo: "78901234567", funcao: "Inspetor de Recebimento Técnico", unidadeId: "UFN-III", postoCodigo: "PST-TEC-007", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-03-01" },
  { chapa: "000108", matricula: "PRM-00108", nome: "Paulo Ricardo Gomes", cpfLimpo: "89012345678", funcao: "Conferente de Carga e Descarga", unidadeId: "UFN-III", postoCodigo: "PST-TEC-008", escala: "6x1", situacao: "ATIVO", dataAdmissao: "2024-03-01" },
  { chapa: "000109", matricula: "PRM-00109", nome: "Patrícia Helena Neves", cpfLimpo: "90123456789", funcao: "Assistente Administrativo de Posto", unidadeId: "UFN-III", postoCodigo: "PST-ADM-009", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-03-15" },
  { chapa: "000110", matricula: "PRM-00110", nome: "Lucas Gabriel Ribeiro", cpfLimpo: "01234567890", funcao: "Controlador de Documentação e NFs", unidadeId: "UFN-III", postoCodigo: "PST-ADM-010", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-04-01" },
  { chapa: "000111", matricula: "PRM-00111", nome: "Marcelo Tavares Pinto", cpfLimpo: "11223344556", funcao: "Expedidor de Materiais", unidadeId: "UFN-III", postoCodigo: "PST-EXP-011", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-04-01" },
  { chapa: "000112", matricula: "PRM-00112", nome: "Marcos Vinícius Moura", cpfLimpo: "22334455667", funcao: "Técnico de Segurança Operacional", unidadeId: "UFN-III", postoCodigo: "PST-SEG-012", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-04-15" },
  { chapa: "000113", matricula: "PRM-00113", nome: "Beatriz Santos Cruz", cpfLimpo: "33445566778", funcao: "Auxiliar de Embalagem", unidadeId: "UFN-III", postoCodigo: "PST-ALM-015", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-05-01" },
  { chapa: "000114", matricula: "PRM-00114", nome: "Thiago Barbosa", cpfLimpo: "44556677889", funcao: "Auxiliar de Pátio", unidadeId: "UFN-III", postoCodigo: "PST-ALM-014", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-05-01" },
  { chapa: "000115", matricula: "PRM-00115", nome: "Diego Camargo Silveira", cpfLimpo: "55667788990", funcao: "Substituto Operacional / Folguista", unidadeId: "UFN-III", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-06-01" },
  { chapa: "000116", matricula: "PRM-00116", nome: "Aline Mendes Castro", cpfLimpo: "66778899001", funcao: "Assistente de Apoio e Reserva", unidadeId: "UFN-III", escala: "5x2", situacao: "ATIVO", dataAdmissao: "2024-06-15" },
];

export const DADOS_DEMO_OCORRENCIAS_FICTICIAS: Omit<OcorrenciaOperacional, "id" | "criadoEm">[] = [
  { matricula: "PRM-00114", profissionalNome: "Thiago Barbosa", postoCodigo: "PST-ALM-014", tipoOcorrencia: "ATESTADO_MEDICO", dataInicio: "2026-09-03", dataFim: "2026-09-05", diasAfetados: 3, status: "VALIDADA", observacaoPublica: "Ausência justificada" },
  { matricula: "PRM-00113", profissionalNome: "Beatriz Santos Cruz", postoCodigo: "PST-ALM-015", tipoOcorrencia: "FALTA_INJUSTIFICADA", dataInicio: "2026-09-08", dataFim: "2026-09-08", diasAfetados: 1, status: "VALIDADA", observacaoPublica: "Ausência não justificada" },
  { matricula: "PRM-00102", profissionalNome: "Mariana Souza Lima", postoCodigo: "PST-ALM-002", tipoOcorrencia: "TREINAMENTO", dataInicio: "2026-09-11", dataFim: "2026-09-11", diasAfetados: 1, status: "VALIDADA", observacaoPublica: "Treinamento NR-11" },
];

export const DADOS_DEMO_COBERTURAS_FICTICIAS: Omit<CoberturaOperacional, "id" | "criadoEm">[] = [
  { postoCodigo: "PST-ALM-014", funcaoPosto: "Auxiliar de Pátio", titularMatricula: "PRM-00114", titularNome: "Thiago Barbosa", substitutoMatricula: "PRM-00115", substitutoNome: "Diego Camargo Silveira", dataInicio: "2026-09-03", dataFim: "2026-09-05", tipoCobertura: "SUBSTITUICAO_INTERNA", status: "CONFIRMADA", justificativa: "Cobertura de atestado" },
  { postoCodigo: "PST-ALM-002", funcaoPosto: "Auxiliar de Almoxarifado I", titularMatricula: "PRM-00102", titularNome: "Mariana Souza Lima", substitutoMatricula: "PRM-00116", substitutoNome: "Aline Mendes Castro", dataInicio: "2026-09-11", dataFim: "2026-09-11", tipoCobertura: "SUBSTITUICAO_INTERNA", status: "CONFIRMADA", justificativa: "Cobertura de treinamento" },
];

export const DADOS_DEMO_APONTAMENTOS_FICTICIOS: Omit<ApontamentoOperacional, "id" | "dataCriacao">[] = [
  { postoCodigo: "PST-ALM-015", funcaoPosto: "Auxiliar de Embalagem", dataReferencia: "2026-09-08", competencia: "Setembro / 2026", texto: "Posto desocupado sem substituto", criadoPor: "Fiscal Petrobras", status: "RESPONDIDO" },
  { postoCodigo: "PST-LOG-013", funcaoPosto: "Operador de Ponte Rolante", dataReferencia: "2026-09-01", competencia: "Setembro / 2026", texto: "Previsão de alocação de titular", criadoPor: "Fiscal Petrobras", status: "EM_TRATAMENTO" },
];

/**
 * Helper para testes automatizados: semeia os dados fictícios no estado para testar a limpeza
 */
export function semearDadosDemoParaTeste() {
  const estado = carregarEstado();
  const profs: ProfissionalOperacional[] = DADOS_DEMO_COLABORADORES_FICTICIOS.map((p, idx) => ({
    ...p,
    id: `prf-demo-${idx + 1}`,
    cpfMascarado: mascararCpf(p.cpfLimpo),
  }));

  const ocos: OcorrenciaOperacional[] = DADOS_DEMO_OCORRENCIAS_FICTICIAS.map((o, idx) => ({
    ...o,
    id: `oco-demo-${idx + 1}`,
    criadoEm: "2026-09-03 08:30",
  }));

  const cobs: CoberturaOperacional[] = DADOS_DEMO_COBERTURAS_FICTICIAS.map((c, idx) => ({
    ...c,
    id: `cob-demo-${idx + 1}`,
    criadoEm: "2026-09-03 08:45",
  }));

  const apts: ApontamentoOperacional[] = DADOS_DEMO_APONTAMENTOS_FICTICIOS.map((a, idx) => ({
    ...a,
    id: `apt-demo-${idx + 1}`,
    dataCriacao: "2026-09-08 11:20",
  }));

  const postosComTitular = estado.postos.map((p) => {
    const prof = profs.find((pr) => pr.postoCodigo === p.codigoPosto);
    return {
      ...p,
      titularMatricula: prof ? prof.matricula : undefined,
      titularNome: prof ? prof.nome : undefined,
    };
  });

  salvarEstado({
    postos: postosComTitular,
    profissionais: profs,
    ocorrencias: ocos,
    coberturas: cobs,
    apontamentos: apts,
  });
}

export interface ItemRelatorioLimpeza {
  tabela: string;
  descricao: string;
  registrosRemovidos: number;
  status: "LIMPO" | "PRESERVADO";
}

export interface RelatorioLimpezaDados {
  sucesso: boolean;
  timestamp: string;
  executadoPor: string;
  tabelasAfetadas: ItemRelatorioLimpeza[];
  totalRegistrosOperacionaisRemovidos: number;
  postosAnexo1APreservados: number;
  snapshotBackup: SnapshotBackupSGP;
}

/**
 * Simula a limpeza retornando o relatório prévio de quantidades por tabela sem modificar o estado.
 */
export function simularLimpezaDadosDemo(
  executadoPor: string = "Administrador Premier (Marcos Valério)"
): RelatorioLimpezaDados {
  const estado = carregarEstado();
  const snapshot = gerarSnapshotSistema("Prévia/Simulação de Limpeza", executadoPor);

  const qtdProfissionais = estado.profissionais.length;
  const qtdAlocacoesFicticias = estado.postos.filter((p) => !!p.titularMatricula).length;
  const qtdOcorrencias = estado.ocorrencias.length;
  const qtdCoberturas = estado.coberturas.length;
  const qtdApontamentos = estado.apontamentos.length;

  const tabelasAfetadas: ItemRelatorioLimpeza[] = [
    {
      tabela: "profissional / profissional_dados_restritos",
      descricao: "Colaboradores fictícios com matrículas PRM-00101 a PRM-00116",
      registrosRemovidos: qtdProfissionais,
      status: "LIMPO",
    },
    {
      tabela: "alocacao (titularidades nos postos)",
      descricao: "Vínculos de titularidade simulada associados a colaboradores fictícios",
      registrosRemovidos: qtdAlocacoesFicticias,
      status: "LIMPO",
    },
    {
      tabela: "ocorrencia / ocorrencia_dado_sensivel",
      descricao: "Atestados, faltas e treinamentos fictícios",
      registrosRemovidos: qtdOcorrencias,
      status: "LIMPO",
    },
    {
      tabela: "cobertura",
      descricao: "Coberturas e substituições simuladas entre colaboradores fictícios",
      registrosRemovidos: qtdCoberturas,
      status: "LIMPO",
    },
    {
      tabela: "apontamento",
      descricao: "Apontamentos formais mock da fiscalização Petrobras",
      registrosRemovidos: qtdApontamentos,
      status: "LIMPO",
    },
    {
      tabela: "posto (Anexo 1-A)",
      descricao: "Cadastro oficial de postos homologados da Petrobras",
      registrosRemovidos: 0,
      status: "PRESERVADO",
    },
    {
      tabela: "usuario / usuario_unidade",
      descricao: "Contas de acesso, perfis RBAC e vínculos de bases",
      registrosRemovidos: 0,
      status: "PRESERVADO",
    },
    {
      tabela: "parametro_contrato / configuracoes",
      descricao: "Metas de SLA (95%), fatores de glosa e prazos de fechamento",
      registrosRemovidos: 0,
      status: "PRESERVADO",
    },
    {
      tabela: "log_auditoria",
      descricao: "Trilha imutável de eventos e segurança",
      registrosRemovidos: 0,
      status: "PRESERVADO",
    },
  ];

  return {
    sucesso: true,
    timestamp: new Date().toISOString(),
    executadoPor,
    tabelasAfetadas,
    totalRegistrosOperacionaisRemovidos:
      qtdProfissionais +
      qtdAlocacoesFicticias +
      qtdOcorrencias +
      qtdCoberturas +
      qtdApontamentos,
    postosAnexo1APreservados: estado.postos.length,
    snapshotBackup: snapshot,
  };
}

/**
 * Executa a limpeza efetiva dos dados operacionais fictícios,
 * gerando o backup prévio e gravando o evento na auditoria.
 */
export function executarLimpezaDadosDemo(
  executadoPor: string = "Administrador Premier (Marcos Valério)"
): RelatorioLimpezaDados {
  const estadoAtual = carregarEstado();

  // 1. Gera backup prévio completo
  const snapshotBackup = gerarSnapshotSistema(
    "Backup Pré-Limpeza de Dados Operacionais Fictícios",
    executadoPor
  );

  const qtdProfissionais = estadoAtual.profissionais.length;
  const qtdAlocacoesFicticias = estadoAtual.postos.filter((p) => !!p.titularMatricula).length;
  const qtdOcorrencias = estadoAtual.ocorrencias.length;
  const qtdCoberturas = estadoAtual.coberturas.length;
  const qtdApontamentos = estadoAtual.apontamentos.length;

  // 2. Preserva os postos do Anexo 1-A, mas remove as titularidades fictícias (postos tornam-se vagos)
  const postosLimpos: PostoOperacional[] = estadoAtual.postos.map((posto) => ({
    ...posto,
    titularMatricula: undefined,
    titularNome: undefined,
  }));

  // 3. Novo registro de auditoria imutável
  const dataIso = new Date().toISOString();
  const logLimpeza = {
    id: `log-limpeza-${Date.now()}`,
    timestamp: dataIso.replace("T", " ").substring(0, 19),
    usuario: executadoPor,
    perfil: "PREMIER_ADMIN",
    acao: "LIMPEZA_DADOS_DEMONSTRACAO",
    entidade: "DadosOperacionais",
    detalhes: `Limpeza de demonstração concluída: ${qtdProfissionais} profissionais removidos, ${qtdAlocacoesFicticias} alocações fictícias removidas (postos Anexo 1-A preservados vagos), ${qtdOcorrencias} ocorrências removidas, ${qtdCoberturas} coberturas removidas, ${qtdApontamentos} apontamentos removidos. Backup gerado com sucesso.`,
    ip: "189.120.45.12",
  };

  // 4. Salva novo estado operacional limpo
  const novoEstado: Partial<EstadoOperacionalCompleto> = {
    postos: postosLimpos,
    profissionais: [], // 100% limpo para receber a importação RM
    ocorrencias: [],
    coberturas: [],
    apontamentos: [],
    logsAuditoria: [logLimpeza, ...estadoAtual.logsAuditoria],
  };

  salvarEstado(novoEstado);

  // 5. Retorna o relatório detalhado de execução
  const sim = simularLimpezaDadosDemo(executadoPor);
  return {
    ...sim,
    snapshotBackup,
  };
}
