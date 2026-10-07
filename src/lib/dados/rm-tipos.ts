/**
 * SGP — Sistema de Gestão de Postos
 * Modelo de Dados Oficial: Importação Periódica RM / TOTVS (Folha de Pagamento)
 *
 * Contrato Petrobras ICJ 5900.0129796.25.2
 *
 * REGRAS FUNDAMENTAIS:
 * 1. Todos os dados de funcionários, horários e seções derivam EXCLUSIVAMENTE
 *    dessa importação periódica do RM/TOTVS. Sem dados fictícios ou paralelos.
 * 2. Horários e Seções gravados EXATAMENTE como vêm do RM (intactos).
 * 3. Chave única do funcionário: Chapa (texto, 6 dígitos). CPF único (11 dígitos).
 * 4. Histórico com data de vigência para cada alteração de Seção, Horário, Função e Situação.
 * 5. Cargas recorrentes:
 *    - Chapa nova -> Inclusão.
 *    - Chapa existente -> Atualização com registro no histórico.
 *    - Chapa ausente na carga -> Marcação de 'constaUltimaCarga: false' + Alerta (sem exclusão).
 *    - Funcionários demitidos (Situação 'D') permanecem no histórico.
 * 6. Idade calculada dinamicamente a partir da Data de Nascimento (nunca fixa).
 */

export type { PerfilUsuario } from "../auth/tipos";

// =============================================================================
// 1. CABEÇALHOS DO ARQUIVO DE ORIGEM (.XLS / .XLSX / .CSV)
// =============================================================================

export const CABECALHOS_RM_OFICIAIS = [
  "Chapa",
  "Nome",
  "Nome Funcão",           // Erro de digitação original do RM preservado
  "Descrição do Horario",
  "CPF",
  "Salário Mensal",
  "Data de Admissão",
  "Data de Demissão",
  "Situação",
  "Descrição Seção",       // 1ª ocorrência (utilizada como base oficial)
  "Descrição da Situação",
  "Seção",
  "Salário Hora",
  "Idade",                 // Apenas lida para conferência; idade oficial é calculada da Dt. Nascimento
  "Sexo",
  "Horário",
  "Jornada",
  "Descrição Seção",       // 2ª ocorrência (validada contra a 1ª ocorrência)
  "Data de Nascimento",
] as const;

export type CabecalhoRmOficial = (typeof CABECALHOS_RM_OFICIAIS)[number];

// =============================================================================
// 2. TABELAS DE DOMÍNIO (HORÁRIOS, SEÇÕES, SITUAÇÕES, FUNÇÕES)
// =============================================================================

/**
 * Tabela de Horários do RM
 * Chave primária: codigo (texto, ex.: "1390", "1409", "1441", "1391")
 * IMPORTANTE: Códigos diferentes podem ter a mesma descrição (ex.: 1391 e 1441).
 * Descrição original mantida 100% intacta (preserva espaços no final e texto literal "\n").
 */
export interface HorarioRm {
  codigo: string;          // Chave única natural (ex.: "1390") - sempre texto
  descricao: string;       // Descrição original intacta do RM (ex.: "PETROBRAS - 08:00 AS 17:48 - SEG/SEX ")
  jornadaPadrao?: string;  // Ex.: "220:00"
  criadoEm: string;        // ISO DateTime da primeira identificação
  atualizadoEm: string;    // ISO DateTime da última atualização
}

/**
 * Tabela de Seções do RM
 * Chave primária: codigo (texto no formato 1.01.080.XXX)
 * Descrição original mantida sem alteração (ex.: "RNEST (Ipojuca - PE)")
 */
export interface SecaoRm {
  codigo: string;          // Chave única natural (ex.: "1.01.080.023") - sempre texto
  descricao: string;       // Descrição original sem alteração (ex.: "UFN-III (Três Lagoas - MS)")
  unidadeId?: string;      // Vínculo opcional com base operacional SGP
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Tabela de Situações do RM
 * Chave primária: codigo (ex.: "A", "D", "E", "F", "P", "V", "Z")
 */
export interface SituacaoRm {
  codigo: string;          // Chave única (ex.: "A", "D", "F", "Z")
  descricao: string;       // Ex.: "Ativo", "Demitido", "Férias", "Admissão prox.mês"
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Tabela de Funções do RM
 * Chave primária: nome (ex.: "ASSISTENTE DE LOGISTICA", "OPERADOR DE EMPILHADEIRA")
 */
export interface FuncaoRm {
  nome: string;            // A partir de "Nome Funcão"
  criadoEm: string;
  atualizadoEm: string;
}

// =============================================================================
// 3. TABELA DE FUNCIONÁRIOS (FOTOGRAFIA ATUAL DO RM)
// =============================================================================

export interface FuncionarioRm {
  // Chaves naturais e identificação
  chapa: string;           // Chave primária única: 6 dígitos texto (ex.: "046862")
  nome: string;            // Nome completo do colaborador
  cpf: string;             // 11 dígitos texto (zeros à esquerda preservados, único)
  
  // Vínculos com tabelas de domínio do RM
  funcaoNome: string;      // FK FuncaoRm (ex.: "ASSISTENTE DE LOGISTICA")
  horarioCodigo: string;   // FK HorarioRm (código numérico em texto, ex.: "1409")
  horarioDescricao: string;// Descrição original intacta do horário
  secaoCodigo: string;     // FK SecaoRm (ex.: "1.01.080.023")
  secaoDescricao: string;  // Descrição original da seção
  situacaoCodigo: string;  // FK SituacaoRm (ex.: "A", "D", "Z")
  situacaoDescricao: string;// Descrição da situação (ex.: "Ativo")

  // Valores financeiros (decimal com 2 casas decimais)
  salarioMensal: number;   // Salário Mensal em R$ (ex.: 3152.47)
  salarioHora: number;     // Salário Hora em R$ (ex.: 14.33)

  // Datas contratuais e demográficas (formato YYYY-MM-DD)
  dataAdmissao: string;    // Data de Admissão
  dataDemissao?: string | null; // Data de Demissão (nula para colaboradores ativos)
  dataNascimento: string;  // Data de Nascimento

  // Dados demográficos e de jornada
  sexo: "M" | "F";         // Sexo (M ou F)
  jornada: string;         // Jornada (ex.: "220:00")

  // Idade calculada dinamicamente (nunca fixa na base de dados)
  idadeCalculada: number;  // Anos completos calculados a partir da dataNascimento

  // Controle de snapshots e cargas recorrentes
  constaUltimaCarga: boolean; // false se já existia na base mas não veio no arquivo mais recente
  dataPrimeiraCarga: string;  // ISO DateTime da primeira inclusão
  dataUltimaCarga: string;    // ISO DateTime do último processamento
  loteUltimaCargaId: string;  // ID do lote da última carga
}

// =============================================================================
// 4. HISTÓRICO DE MUDANÇAS COM DATA DE VIGÊNCIA (MAPA DE OCUPAÇÃO)
// =============================================================================

export type TipoAlteracaoRm =
  | "CARGA_INICIAL"
  | "MUDANCA_SECAO"
  | "MUDANCA_HORARIO"
  | "MUDANCA_FUNCAO"
  | "MUDANCA_SITUACAO"
  | "MUDANCA_SALARIAL"
  | "DEMISSAO"
  | "REATIVACAO";

export interface HistoricoFuncionarioRm {
  id: string;              // UUID do evento histórico
  chapa: string;           // Chapa do funcionário
  loteCargaId: string;     // Lote de importação que originou a alteração
  dataVigencia: string;    // Data de vigência = data da carga (YYYY-MM-DD)
  tipoAlteracao: TipoAlteracaoRm;
  
  campoModificado: string; // "secaoCodigo", "horarioCodigo", "funcaoNome", "situacaoCodigo", etc.
  valorAnterior?: string | null;
  valorNovo: string;
  
  descricaoAnterior?: string | null; // Ex.: "REDUC (Duque de Caxias - RJ)"
  descricaoNova?: string | null;     // Ex.: "UFN-III (Três Lagoas - MS)"
  
  criadoEm: string;        // ISO Timestamp da gravação do histórico
}

// =============================================================================
// 5. REGISTRO DE CARGA / LOTE DE IMPORTAÇÃO (SNAPSHOT)
// =============================================================================

export interface LoteCargaRm {
  id: string;              // UUID do lote
  dataCarga: string;       // ISO Timestamp da execução da carga
  dataReferencia: string;  // Data de referência do mês/competência (YYYY-MM-DD)
  nomeArquivo: string;     // Nome original do arquivo (ex.: "FUNCIONÁRIOS PETROBRAS.XLS")
  formatoArquivo: "XLS" | "XLSX" | "CSV";
  hashSha256: string;      // Assinatura digital única do arquivo para evitar duplicidade
  
  // Métricas do processamento
  totalLinhasLidas: number;
  totalNovos: number;
  totalAtualizados: number;
  totalSemAlteracao: number;
  totalNaoConstam: number; // Quantidade de colaboradores anteriores ausentes neste arquivo
  totalErros: number;
  totalAlertas: number;
  novos?: number;
  atualizados?: number;
  
  // Indicadores de validação do arquivo
  divergenciaSecaoDetectada: boolean; // true se a 2ª coluna 'Descrição Seção' divergiu da 1ª
  chapasNaoConstantes: string[];      // Lista de chapas marcadas como ausentes nesta carga
  
  // Auditoria
  alertas: string[];
  erros: string[];
  usuarioProcesso?: string;
}

// =============================================================================
// 6. FUNÇÕES UTILITÁRIAS OFICIAIS DO MODELO DE DADOS
// =============================================================================

/**
 * Calcula a idade de forma dinâmica e precisa em anos completos
 * a partir da Data de Nascimento e de uma Data de Referência.
 * Não utiliza o número estático da planilha para evitar desatualização.
 */
export function calcularIdadeDinamica(
  dataNascimento: string | Date,
  dataReferencia: string | Date = new Date()
): number {
  const dNasc = typeof dataNascimento === "string" ? new Date(dataNascimento) : dataNascimento;
  const dRef = typeof dataReferencia === "string" ? new Date(dataReferencia) : dataReferencia;

  if (isNaN(dNasc.getTime()) || isNaN(dRef.getTime())) {
    return 0;
  }

  let anos = dRef.getFullYear() - dNasc.getFullYear();
  const mesAtual = dRef.getMonth();
  const mesNasc = dNasc.getMonth();

  if (mesAtual < mesNasc || (mesAtual === mesNasc && dRef.getDate() < dNasc.getDate())) {
    anos--;
  }

  return Math.max(0, anos);
}

export const calcularIdade = calcularIdadeDinamica;

/**
 * Normaliza Chapa para sempre ter 6 dígitos em formato texto com zeros à esquerda.
 * Ex.: 46862 -> "046862" | "123" -> "000123"
 */
export function normalizarChapa(chapa: string | number): string {
  const limpo = String(chapa ?? "").trim().replace(/\D/g, "");
  if (!limpo) return "";
  return limpo.padStart(6, "0");
}

/**
 * Normaliza CPF para exatamente 11 dígitos em formato texto com zeros à esquerda.
 * Ex.: "7391596582" -> "07391596582"
 */
export function normalizarCpf(cpf: string | number): string {
  const limpo = String(cpf ?? "").trim().replace(/\D/g, "");
  if (!limpo) return "";
  return limpo.padStart(11, "0");
}

/**
 * Validação rigorosa do CPF pelos dígitos verificadores (Módulo 11 da Receita Federal).
 */
export function validarCpfMatematico(cpf: string): boolean {
  const limpo = normalizarCpf(cpf);
  if (limpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(limpo)) return false; // Rejeita CPFs com todos os dígitos iguais

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(10), 10)) return false;

  return true;
}

/**
 * Formata descrição do horário apenas para apresentação em tela:
 * Remove espaços em branco do final e remove o caractere literal '\n',
 * mantendo o valor original do banco de dados intacto.
 */
export function formatarDescricaoHorarioParaTela(descricaoOriginal: string): string {
  if (!descricaoOriginal) return "";
  return descricaoOriginal
    .replace(/\\n/g, "") // remove literal \n se presente
    .replace(/\n/g, "")   // remove quebra de linha real
    .trimEnd();          // remove espaços em branco do final
}

/**
 * Formata Horário para exibição no padrão oficial exigido: 'código – descrição',
 * exatamente como vieram do RM.
 * Ex.: "1390 – PETROBRAS - 08:00 AS 17:48 - SEG/SEX"
 */
export function formatarHorarioExibicao(codigo?: string, descricao?: string): string {
  const cod = (codigo || "").trim();
  const desc = formatarDescricaoHorarioParaTela(descricao || "");
  if (!cod && !desc) return "–";
  if (!cod) return desc;
  if (!desc) return cod;
  if (desc.startsWith(cod + " –") || desc.startsWith(cod + " -")) return desc;
  return `${cod} – ${desc}`;
}

/**
 * Formata Seção para exibição no padrão oficial exigido: 'código – descrição',
 * exatamente como vieram do RM.
 * Ex.: "1.01.080.023 – UFN-III (Três Lagoas - MS)"
 */
export function formatarSecaoExibicao(codigo?: string, descricao?: string): string {
  const cod = (codigo || "").trim();
  const desc = (descricao || "").trim();
  if (!cod && !desc) return "–";
  if (!cod) return desc;
  if (!desc) return cod;
  if (desc.startsWith(cod + " –") || desc.startsWith(cod + " -")) return desc;
  return `${cod} – ${desc}`;
}

/**
 * Campo auxiliar SOMENTE PARA FILTRO, sem alterar a descrição original do RM:
 * "Tipo de escala", identificado a partir do texto do horário (SEG/SEX, 12X36, 4X4, 4X2).
 * Se não identificar, retorna "Não identificado".
 */
export type TipoEscalaFiltro = "SEG/SEX" | "12X36" | "4X4" | "4X2" | "Não identificado";

export const LISTA_TIPOS_ESCALA_FILTRO: TipoEscalaFiltro[] = [
  "SEG/SEX",
  "12X36",
  "4X4",
  "4X2",
  "Não identificado",
];

export function identificarTipoEscala(textoHorario?: string): TipoEscalaFiltro {
  if (!textoHorario) return "Não identificado";
  const upper = textoHorario.toUpperCase();
  const semEspacos = upper.replace(/\s+/g, "");

  if (semEspacos.includes("12X36")) return "12X36";
  if (
    semEspacos.includes("SEG/SEX") ||
    semEspacos.includes("SEGASEX") ||
    semEspacos.includes("SEG-SEX") ||
    semEspacos.includes("SEGUNDAASEXTA") ||
    (semEspacos.includes("SEG") && semEspacos.includes("SEX"))
  ) {
    return "SEG/SEX";
  }
  if (semEspacos.includes("4X4")) return "4X4";
  if (semEspacos.includes("4X2")) return "4X2";
  return "Não identificado";
}

// =============================================================================
// 7. REGRAS DE LGPD E CONTROLE DE VISUALIZAÇÃO POR PERFIL
// =============================================================================

/**
 * Verifica se o perfil do usuário possui permissão para visualizar salários.
 * Apenas Administração Premier (PREMIER_ADMIN) possui acesso a salários.
 * Gestor Premier e Fiscal Petrobras NUNCA veem salários.
 */
export function podeVisualizarSalario(perfil?: string | null): boolean {
  if (!perfil) return false;
  return perfil === "PREMIER_ADMIN";
}

/**
 * Verifica se o perfil é Fiscal Petrobras (ou auditor da Petrobras).
 */
export function ehPerfilFiscalPetrobras(perfil?: string | null): boolean {
  if (!perfil) return false;
  return ehPerfilFiscalPetrobrasExplicito(perfil);
}

/**
 * Perfis Premier (Administração / Gestor / RH / Supervisor) podem ver CPF completo,
 * data de nascimento completa e dados sensíveis operacionais. Qualquer outro perfil
 * — inclusive perfil ainda não carregado (null), pendente ou desconhecido — recebe
 * a visão restrita (fail-closed).
 */
export function podeVerDadosPessoaisCompletos(perfil?: string | null): boolean {
  if (!perfil) return false;
  return perfil.toUpperCase().startsWith("PREMIER_");
}

function ehPerfilFiscalPetrobrasExplicito(perfil: string): boolean {
  const p = perfil.toUpperCase();
  return (
    p === "PETROBRAS_FISCAL" ||
    p === "FISCAL_PETROBRAS" ||
    p.includes("FISCAL") ||
    p.startsWith("PETROBRAS_")
  );
}

/**
 * Formata o CPF de acordo com o perfil e diretrizes da LGPD:
 * - Fiscal Petrobras: CPF mascarado no formato exato "***.***.***-82" (últimos 2 dígitos visíveis).
 * - Administração Premier e Gestor Premier: CPF completo formatado "073.915.965-82".
 */
export function formatarCpfPorPerfil(cpf?: string | null, perfil?: string | null): string {
  if (!cpf) return "—";
  const limpo = normalizarCpf(cpf);
  if (!limpo || limpo.length !== 11) return cpf || "—";

  if (!podeVerDadosPessoaisCompletos(perfil)) {
    const ultimos2 = limpo.slice(9, 11);
    return `***.***.***-${ultimos2}`;
  }

  return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9, 11)}`;
}

/**
 * Formata a Data de Nascimento de acordo com o perfil e diretrizes da LGPD:
 * - Fiscal Petrobras: Não vê data de nascimento completa (mascarada com asteriscos).
 * - Administração Premier e Gestor Premier: Data completa no formato DD/MM/YYYY.
 */
export function formatarDataNascimentoPorPerfil(
  dataNascimento?: string | null,
  perfil?: string | null
): string {
  if (!dataNascimento) return "—";
  if (!podeVerDadosPessoaisCompletos(perfil)) {
    return "**/**/****";
  }

  // Se já for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    const [ano, mes, dia] = dataNascimento.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  return dataNascimento;
}

/**
 * Formata o Salário para exibição na tela conforme o perfil e diretrizes da LGPD:
 * - Administração Premier: Valor financeiro em R$ (ex.: "R$ 3.152,47").
 * - Gestor Premier e Fiscal Petrobras: Ocultado / "Restrito (LGPD)" sem possibilidade de alternância.
 */
export function formatarSalarioPorPerfil(
  valor: number | undefined | null,
  perfil?: string | null
): string {
  if (!podeVerDadosPessoaisCompletos(perfil)) {
    return "";
  }
  if (!podeVisualizarSalario(perfil)) {
    return "Restrito (LGPD)";
  }
  if (valor === undefined || valor === null || isNaN(valor)) {
    return "R$ 0,00";
  }
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

