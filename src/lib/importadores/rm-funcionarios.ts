/**
 * SGP — Sistema de Gestão de Postos
 * Módulo de Importação de Funcionários (RM / TOTVS) — MOMENTO 1
 *
 * Implementa o pipeline obrigatório:
 * 1. Upload XLSX / XLS (até 10 MB) com Data de Referência
 * 2. Identificação automática pelos cabeçalhos
 * 3. Pré-visualização / Simulação (sem gravar) com totais e tabela de erros/alertas
 * 4. Confirmação atômica por lote (tudo ou nada) com hash SHA-256 e snapshot para rollback
 *
 * CONFORMIDADE LGPD & REGRAS:
 * - Minimização de dados: lê SOMENTE colunas permitidas.
 * - Idade NUNCA é gravada (calculada dinamicamente).
 * - Validação de CPF (11 dígitos, zero à esquerda, módulo 11).
 * - Normalização de Chapa para 6 dígitos.
 * - Mapeamento de seções RM → bases SGP e catálogo de horários.
 */

import * as XLSX from "xlsx";
import {
  carregarEstado,
  salvarEstado,
  EstadoOperacionalCompleto,
  ProfissionalOperacional,
  MovimentacaoHistorico,
  LoteImportacaoOperacional,
  OcorrenciaOperacional,
  LogAuditoriaOperacional,
  ALOCACOES_MC_REAIS,
  calcularIdade,
} from "../dados/estado-operacional";
import {
  obterPeriodoCompetencia,
  marcarCalendarioDesatualizado,
} from "../servicos/calendario-competencia";
import {
  obterBasePorCodigoSecao,
  registrarSecaoImportada,
  registrarHorarioRm,
} from "../dados/secoes-horarios";
import { mascararCpf } from "./tipos";

export interface ItemInconsistencia {
  linha: number;
  tipo: "ERRO" | "ALERTA";
  coluna?: string;
  chapa?: string;
  nome?: string;
  mensagem: string;
}

export interface LinhaFuncionarioRmProcessada {
  linha: number;
  validaParaGravacao: boolean; // se tem erro impeditivo, false
  statusAcao: "NOVO" | "ATUALIZADO" | "SEM_ALTERACAO" | "ERRO";
  inconsistencias: ItemInconsistencia[];
  dados: {
    chapa: string;
    matricula: string;
    nome: string;
    nomeSocial?: string;
    cpfLimpo: string;
    cpfMascarado: string;
    sexo?: "M" | "F";
    dataNascimento?: string; // YYYY-MM-DD
    situacao: "ATIVO" | "AFASTADO" | "FERIAS" | "DESLIGADO";
    situacaoCodigo: string;
    situacaoDescricao: string;
    dataAdmissao: string;
    dataDesligamento?: string;
    secaoCodigo: string;
    secaoDescricao: string;
    unidadeId: string;
    unidadeNome: string;
    funcao: string;
    horarioCodigo?: string;
    horarioDescricao?: string;
    jornadaDescricao?: string;
    utilizaPonto?: boolean;
    escala: "5x2" | "12x36" | "6x1" | "OUTRA";
  };
}

export type TipoArquivoRm = "FUNCIONARIOS_RM" | "ALOCADOS_SIFAC" | "ABONO_RM" | "REGISTROS_PONTO_RM" | "DESCONHECIDO";

export interface ResultadoIdentificacaoRm {
  reconhecido: boolean;
  tipo: TipoArquivoRm;
  colunasEncontradas: string[];
  colunasObrigatoriasFaltando: string[];
}

export interface TotaisSimulacaoRm {
  lidos: number;
  novos: number;
  atualizados: number;
  semAlteracao: number;
  erros: number;
  alertas: number;
}

export interface ItemLinhaRejeitada {
  linha: number;
  aba?: string;
  chapa?: string;
  nome?: string;
  coluna?: string;
  motivo: string;
}

export interface AfastamentoFeriasValido {
  chapa: string;
  tipoOriginal: string;
  tipoMapeado: "Férias" | "Afastamento" | "Licença";
  dataInicio: string;
  dataFim?: string;
  dataRetornoPrevisto?: string;
}

export interface ResultadoSimulacaoRm {
  tipo: "FUNCIONARIOS_RM";
  arquivoNome: string;
  hashSha256: string;
  dataReferencia: string;
  competencia?: string;
  dataExtracao?: string;
  arquivoDuplicado: boolean;
  loteAnteriorId?: string;
  loteAnteriorData?: string;
  totais: TotaisSimulacaoRm;
  linhas: LinhaFuncionarioRmProcessada[];
  inconsistencias: ItemInconsistencia[];
  alertasColaboradoresNaoConstantes: string[];
  linhasRejeitadasLista?: ItemLinhaRejeitada[];
  afastamentosValidos?: AfastamentoFeriasValido[];
}

// Colunas obrigatórias para identificação do tipo Funcionários RM (Aba CADASTRO)
export const COLUNAS_OBRIGATORIAS_CADASTRO_RM = [
  "chapa",
  "nome",
  "secao",
  "descricao secao",
  "nome funcao",
  "horario",
  "situacao",
  "data de admissao",
];

// Colunas obrigatórias legado para compatibilidade de testes
export const COLUNAS_OBRIGATORIAS_RM = [
  "chapa",
  "cpf",
  "secao",
  "descricao secao",
  "nome funcao",
  "situacao",
];

// Colunas obrigatórias da Aba AFASTAMENTOS_FERIAS
export const COLUNAS_OBRIGATORIAS_AFASTAMENTOS = [
  "chapa",
  "tipo",
  "data_inicio",
];

// Colunas permitidas (todas as outras são sumariamente descartadas na leitura)
export const COLUNAS_PERMITIDAS_RM = [
  "nome",
  "nome social",
  "chapa",
  "cpf",
  "sexo",
  "data de nascimento",
  "situacao",
  "descricao da situacao",
  "data de admissao",
  "data de demissao",
  "secao",
  "descricao secao",
  "nome funcao",
  "horario",
  "descricao do horario",
  "jornada",
  "utiliza ponto",
];

/**
 * Normaliza o cabeçalho removendo acentos, pontuação e espaços extras para matching seguro
 */
export function normalizarCabecalho(cabecalho: string): string {
  if (!cabecalho) return "";
  return cabecalho
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\w\s]/g, "") // remove símbolos como ç/pontos
    .replace(/\s+/g, " "); // colapsa múltiplos espaços
}

/**
 * Validação do algoritmo módulo 11 da Receita Federal para CPF
 */
export function validarCpf(cpfLimpo: string): boolean {
  if (!cpfLimpo || cpfLimpo.length !== 11) return false;
  // Rejeita sequências repetidas como 11111111111
  if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpfLimpo.charAt(i), 10) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  const dv1 = resto === 10 || resto === 11 ? 0 : resto;
  if (dv1 !== parseInt(cpfLimpo.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpfLimpo.charAt(i), 10) * (11 - i);
  }
  resto = 11 - (soma % 11);
  const dv2 = resto === 10 || resto === 11 ? 0 : resto;
  return dv2 === parseInt(cpfLimpo.charAt(10), 10);
}

/**
 * Converte datas do Excel (número serial) ou strings brasileiras dd/mm/aaaa para YYYY-MM-DD
 */
export function normalizarDataRm(valor: unknown): { iso: string | null; bruto: string } {
  if (valor === undefined || valor === null || valor === "") {
    return { iso: null, bruto: "" };
  }

  // Se a biblioteca XLSX já parseou como objeto Date
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const ano = valor.getUTCFullYear();
    const mes = String(valor.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(valor.getUTCDate()).padStart(2, "0");
    const iso = `${ano}-${mes}-${dia}`;
    return { iso, bruto: iso };
  }

  // Se o Excel importou como número serial
  if (typeof valor === "number" && !isNaN(valor)) {
    // 25569 = diferença entre epoch Excel (1900-01-01) e epoch Unix (1970-01-01)
    const milissegundos = Math.round((valor - 25569) * 86400 * 1000);
    const dateObj = new Date(milissegundos);
    if (!isNaN(dateObj.getTime())) {
      const iso = dateObj.toISOString().substring(0, 10);
      return { iso, bruto: iso };
    }
  }

  const str = String(valor).trim();
  // Formato dd/mm/aaaa ou d/m/aaaa
  const matchBr = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchBr) {
    const dia = matchBr[1].padStart(2, "0");
    const mes = matchBr[2].padStart(2, "0");
    const ano = matchBr[3];
    return { iso: `${ano}-${mes}-${dia}`, bruto: str };
  }

  // Formato YYYY-MM-DD
  const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return { iso: `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`, bruto: str };
  }

  return { iso: null, bruto: str };
}

/**
 * Calcula hash SHA-256 de um buffer binário ou array de bytes
 */
export async function calcularHashSha256(buffer: Uint8Array | ArrayBuffer): Promise<string> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Node.js fallback (para Vitest ou server side)
  try {
    const crypto = await import("crypto");
    return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  } catch {
    // fallback simplificado
    return `hash-${buffer.byteLength}-${Date.now()}`;
  }
}

export function checarColunaPresente(obrigatoria: string, cabecalhosNormalizados: string[]): boolean {
  if (obrigatoria === "chapa") {
    return cabecalhosNormalizados.some((c) => c === "chapa" || c === "cod chapa");
  }
  if (obrigatoria === "cpf") {
    return cabecalhosNormalizados.some((c) => c === "cpf" || c === "num cpf");
  }
  if (obrigatoria === "secao") {
    return cabecalhosNormalizados.some((c) => c === "secao" || c === "cod secao" || c === "codigo secao");
  }
  if (obrigatoria === "descricao secao") {
    return cabecalhosNormalizados.some((c) => c.includes("descricao") && c.includes("secao"));
  }
  if (obrigatoria === "nome funcao") {
    return cabecalhosNormalizados.some((c) => (c.includes("nome") && c.includes("funcao")) || c === "funcao" || c === "cargo");
  }
  if (obrigatoria === "situacao") {
    return cabecalhosNormalizados.some((c) => c === "situacao" || c === "cod situacao" || c.includes("situacao"));
  }
  return cabecalhosNormalizados.some((c) => c.includes(obrigatoria));
}

/**
 * ETAPA 2: Identificação do tipo de arquivo pelos cabeçalhos
 */
export function identificarTipoArquivo(cabecalhosBrutos: string[]): ResultadoIdentificacaoRm {
  const normalizados = cabecalhosBrutos.map(normalizarCabecalho);

  // 1. Identificar Funcionários RM
  const faltandoRm: string[] = [];
  for (const obrigatoria of COLUNAS_OBRIGATORIAS_RM) {
    const achou = checarColunaPresente(obrigatoria, normalizados);
    if (!achou) {
      faltandoRm.push(obrigatoria);
    }
  }

  if (faltandoRm.length === 0) {
    return {
      reconhecido: true,
      tipo: "FUNCIONARIOS_RM",
      colunasEncontradas: cabecalhosBrutos,
      colunasObrigatoriasFaltando: [],
    };
  }

  // 2. Identificar Alocados SIFAC (Aba Modelo com as 5 colunas obrigatórias)
  const colunasSifac5 = [
    "nrocontrato",
    "cnpj",
    "datacompetenciacadastro",
    "cpf",
    "codigosituacaoempregado",
  ];
  const achouSifac5 = colunasSifac5.every((c) =>
    normalizados.some((norm) => norm.replace(/[^a-z0-9]/g, "").includes(c))
  );
  // Fallback permissivo para variações
  const achouSifacFallback = ["nrocontrato", "cnpj", "cpf"].every((c) =>
    normalizados.some((norm) => norm.replace(/[^a-z0-9]/g, "").includes(c))
  );

  if (achouSifac5 || achouSifacFallback) {
    return {
      reconhecido: true,
      tipo: "ALOCADOS_SIFAC",
      colunasEncontradas: cabecalhosBrutos,
      colunasObrigatoriasFaltando: [],
    };
  }

  // 3. Identificar Ponto / Cubo de Registros RM ou RHID (prioritário sobre abono caso tenha marcações/batidas/ent1)
  const temChapaOuCpf = normalizados.some((c) => c.includes("chapa") || c.includes("cpf"));
  const temData = normalizados.some((c) => c.includes("data"));
  const temEnt1OuHora = normalizados.some(
    (c) => c.includes("ent1") || c.includes("hora") || c.includes("marcacao") || c.includes("batida")
  );

  if (temChapaOuCpf && temData && temEnt1OuHora) {
    return {
      reconhecido: true,
      tipo: "REGISTROS_PONTO_RM",
      colunasEncontradas: cabecalhosBrutos,
      colunasObrigatoriasFaltando: [],
    };
  }

  // 4. Identificar Cubo de Abono (planilhas de abono não possuem colunas de batidas/ent1)
  const colunasAbono = ["chapa", "data", "abono"];
  const achouAbono = colunasAbono.every((c) => normalizados.some((norm) => norm.includes(c)));
  if (achouAbono) {
    return {
      reconhecido: true,
      tipo: "ABONO_RM",
      colunasEncontradas: cabecalhosBrutos,
      colunasObrigatoriasFaltando: [],
    };
  }

  return {
    reconhecido: false,
    tipo: "DESCONHECIDO",
    colunasEncontradas: cabecalhosBrutos,
    colunasObrigatoriasFaltando: faltandoRm,
  };
}

/**
 * Confere compatibilidade dos cabeçalhos com o tipo esperado e avisa caso pareça ser de outro tipo
 */
export function conferirCabecalhosComTipo(
  tipoAlvo: "FUNCIONARIOS_RM" | "REGISTROS_PONTO_RM" | "ABONO_RM" | "ALOCADOS_SIFAC",
  cabecalhosBrutos: string[]
): {
  compativel: boolean;
  tipoDetectado: "FUNCIONARIOS_RM" | "REGISTROS_PONTO_RM" | "ABONO_RM" | "ALOCADOS_SIFAC" | "DESCONHECIDO";
  avisoDivergencia?: string;
  colunasFaltando: string[];
} {
  const detectado = identificarTipoArquivo(cabecalhosBrutos);
  if (detectado.tipo === tipoAlvo) {
    return {
      compativel: true,
      tipoDetectado: detectado.tipo,
      colunasFaltando: [],
    };
  }

  let avisoDivergencia: string | undefined;
  if (detectado.tipo === "ABONO_RM") {
    avisoDivergencia = "Este arquivo parece ser de Cubo de Abono.";
  } else if (detectado.tipo === "REGISTROS_PONTO_RM") {
    avisoDivergencia = "Este arquivo parece ser de Ponto / Registros.";
  } else if (detectado.tipo === "FUNCIONARIOS_RM") {
    avisoDivergencia = "Este arquivo parece ser de Funcionários (RM/TOTVS).";
  } else if (detectado.tipo === "ALOCADOS_SIFAC") {
    avisoDivergencia = "Este arquivo parece ser de Lista de Alocados (SIFAC).";
  }

  return {
    compativel: false,
    tipoDetectado: detectado.tipo,
    avisoDivergencia,
    colunasFaltando: detectado.colunasObrigatoriasFaltando,
  };
}

/**
 * Gera modelo oficial XLSX de Funcionários RM com 2 abas: CADASTRO e AFASTAMENTOS_FERIAS
 */
export function gerarModeloFuncionariosXlsx(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Aba 1: CADASTRO
  // Obrigatórias: CHAPA, NOME, COD.SECAO, DESC.SECAO, FUNCAO, HORARIO, SITUACAO, DATA_ADMISSAO
  // Opcionais: CPF, DATA_DEMISSAO, DATA_INICIO_AVISO
  const dadosCadastro = [
    {
      CHAPA: "000101",
      NOME: "CARLOS EDUARDO SILVA",
      "COD.SECAO": "1.01.080.029",
      "DESC.SECAO": "UFN-III (Três Lagoas - MS)",
      FUNCAO: "Almoxarife Líder",
      HORARIO: "001",
      SITUACAO: "A",
      DATA_ADMISSAO: "02/01/2024",
      CPF: "52998224725",
      DATA_DEMISSAO: "",
      DATA_INICIO_AVISO: "",
    },
    {
      CHAPA: "000102",
      NOME: "MARIANA SOUZA LIMA",
      "COD.SECAO": "1.01.080.029",
      "DESC.SECAO": "UFN-III (Três Lagoas - MS)",
      FUNCAO: "Auxiliar de Almoxarifado I",
      HORARIO: "001",
      SITUACAO: "A",
      DATA_ADMISSAO: "05/01/2024",
      CPF: "11144477735",
      DATA_DEMISSAO: "",
      DATA_INICIO_AVISO: "",
    },
    {
      CHAPA: "000104",
      NOME: "JOSE PEREIRA SANTOS",
      "COD.SECAO": "1.01.080.029",
      "DESC.SECAO": "UFN-III (Três Lagoas - MS)",
      FUNCAO: "Operador de Empilhadeira Líder",
      HORARIO: "002",
      SITUACAO: "A",
      DATA_ADMISSAO: "01/02/2024",
      CPF: "05299822472",
      DATA_DEMISSAO: "",
      DATA_INICIO_AVISO: "",
    },
    {
      CHAPA: "000114",
      NOME: "THIAGO BARBOSA",
      "COD.SECAO": "1.01.080.029",
      "DESC.SECAO": "UFN-III (Três Lagoas - MS)",
      FUNCAO: "Auxiliar de Pátio",
      HORARIO: "001",
      SITUACAO: "A",
      DATA_ADMISSAO: "01/05/2024",
      CPF: "78912345601",
      DATA_DEMISSAO: "",
      DATA_INICIO_AVISO: "",
    },
    {
      CHAPA: "037355",
      NOME: "MARCOS ROBERTO ALVES",
      "COD.SECAO": "1.01.080.029",
      "DESC.SECAO": "UFN-III (Três Lagoas - MS)",
      FUNCAO: "Almoxarife",
      HORARIO: "001",
      SITUACAO: "A",
      DATA_ADMISSAO: "10/03/2024",
      CPF: "85491237000",
      DATA_DEMISSAO: "",
      DATA_INICIO_AVISO: "",
    },
  ];

  const wsCadastro = XLSX.utils.json_to_sheet(dadosCadastro);
  XLSX.utils.book_append_sheet(wb, wsCadastro, "CADASTRO");

  // Aba 2: AFASTAMENTOS_FERIAS
  // Obrigatórias: CHAPA, TIPO, DATA_INICIO
  // Opcionais: DATA_FIM, DATA_RETORNO_PREVISTO
  const dadosAfastamentos = [
    {
      CHAPA: "000102",
      TIPO: "Férias Regulamentares",
      DATA_INICIO: "15/08/2026",
      DATA_FIM: "29/08/2026",
      DATA_RETORNO_PREVISTO: "30/08/2026",
    },
    {
      CHAPA: "000114",
      TIPO: "Afastamento Médico (INSS)",
      DATA_INICIO: "20/08/2026",
      DATA_FIM: "",
      DATA_RETORNO_PREVISTO: "10/09/2026",
    },
    {
      CHAPA: "037355",
      TIPO: "Licença Paternidade",
      DATA_INICIO: "01/09/2026",
      DATA_FIM: "05/09/2026",
      DATA_RETORNO_PREVISTO: "06/09/2026",
    },
  ];

  const wsAfastamentos = XLSX.utils.json_to_sheet(dadosAfastamentos);
  XLSX.utils.book_append_sheet(wb, wsAfastamentos, "AFASTAMENTOS_FERIAS");

  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbOut);
}

/**
 * Lê uma planilha suportando abas específicas: CADASTRO e AFASTAMENTOS_FERIAS
 */
export function lerPlanilhaFuncionariosComAbas(buffer: Uint8Array | ArrayBuffer): {
  cabecalhosCadastro: string[];
  linhasCadastro: Record<string, unknown>[];
  cabecalhosAfastamentos: string[];
  linhasAfastamentos: Record<string, unknown>[];
  temAbaAfastamentos: boolean;
} {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetNames = workbook.SheetNames || [];

  // Localiza aba de cadastro (nome contendo cadastro ou funcionarios, ou a 1ª aba)
  const nomeAbaCadastro =
    sheetNames.find((s) => {
      const norm = normalizarCabecalho(s);
      return norm.includes("cadastro") || norm.includes("funcionario");
    }) || sheetNames[0];

  // Localiza aba de afastamentos se houver
  const nomeAbaAfastamentos = sheetNames.find((s) => {
    const norm = normalizarCabecalho(s);
    return norm.includes("afastament") || norm.includes("feria");
  });

  const extrairLinhasAba = (nomeAba?: string) => {
    if (!nomeAba || !workbook.Sheets[nomeAba]) return { cabecalhos: [], linhas: [] };
    const worksheet = workbook.Sheets[nomeAba];
    const dados = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
    });
    if (!dados || dados.length < 2) return { cabecalhos: [], linhas: [] };
    const cabecalhos = (dados[0] as string[]).map((c) => String(c || "").trim());
    const linhas: Record<string, unknown>[] = [];
    for (let i = 1; i < dados.length; i++) {
      const row = dados[i] as unknown[];
      if (!row || row.length === 0 || row.every((c) => c === "" || c === null || c === undefined)) continue;
      const obj: Record<string, unknown> = {};
      cabecalhos.forEach((col, idx) => {
        obj[col] = row[idx] !== undefined ? row[idx] : "";
      });
      linhas.push(obj);
    }
    return { cabecalhos, linhas };
  };

  const { cabecalhos: cabCadastro, linhas: linCadastro } = extrairLinhasAba(nomeAbaCadastro);
  const { cabecalhos: cabAfastamentos, linhas: linAfastamentos } = extrairLinhasAba(nomeAbaAfastamentos);

  return {
    cabecalhosCadastro: cabCadastro,
    linhasCadastro: linCadastro,
    cabecalhosAfastamentos: cabAfastamentos,
    linhasAfastamentos: linAfastamentos,
    temAbaAfastamentos: !!nomeAbaAfastamentos && linAfastamentos.length > 0,
  };
}

/**
 * Extrai linhas de dados de uma planilha XLSX ou XLS
 */
export function lerPlanilhaEmLinhas(buffer: Uint8Array | ArrayBuffer): {
  cabecalhos: string[];
  linhas: Record<string, unknown>[];
} {
  const parsed = lerPlanilhaFuncionariosComAbas(buffer);
  if (parsed.cabecalhosCadastro.length > 0) {
    return { cabecalhos: parsed.cabecalhosCadastro, linhas: parsed.linhasCadastro };
  }
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const primeiraAba = workbook.SheetNames[0];
  if (!primeiraAba) {
    throw new Error("O arquivo Excel está vazio ou não possui abas de dados.");
  }
  const worksheet = workbook.Sheets[primeiraAba];
  const dados = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
  });
  if (!dados || dados.length < 2) {
    throw new Error("A planilha não possui dados suficientes (esperado cabeçalho e ao menos uma linha de dados).");
  }
  const cabecalhos = (dados[0] as string[]).map((c) => String(c || "").trim());
  const linhas: Record<string, unknown>[] = [];
  for (let i = 1; i < dados.length; i++) {
    const linhaArr = dados[i] as unknown[];
    if (!linhaArr || linhaArr.length === 0 || linhaArr.every((c) => c === "" || c === null || c === undefined)) {
      continue;
    }
    const linhaObj: Record<string, unknown> = {};
    cabecalhos.forEach((col, idx) => {
      linhaObj[col] = linhaArr[idx] !== undefined ? linhaArr[idx] : "";
    });
    linhas.push(linhaObj);
  }
  return { cabecalhos, linhas };
}

/**
 * ETAPA 3: Simulação / Pré-Visualização da importação (SEM GRAVAR NADA)
 */
export async function simularImportacaoFuncionariosRm(
  buffer: Uint8Array | ArrayBuffer,
  arquivoNome: string,
  dataReferencia: string,
  estadoCustomOuOptions?: EstadoOperacionalCompleto | { competencia?: string; dataExtracao?: string },
  optionsParam?: { competencia?: string; dataExtracao?: string }
): Promise<ResultadoSimulacaoRm> {
  const estadoCustom = estadoCustomOuOptions && "profissionais" in estadoCustomOuOptions ? estadoCustomOuOptions : undefined;
  const options = optionsParam || (estadoCustomOuOptions && !("profissionais" in estadoCustomOuOptions) ? estadoCustomOuOptions : undefined);
  const estado = estadoCustom || carregarEstado();
  const hash = await calcularHashSha256(buffer);

  // 1. Verificação de reimportação por hash SHA-256
  const loteExistente = (estado.lotesImportacao || []).find(
    (l) => l.hashSha256 === hash && l.status === "CONCLUIDO"
  );
  const arquivoDuplicado = !!loteExistente;

  // 2. Leitura com suporte a múltiplas abas (CADASTRO e AFASTAMENTOS_FERIAS)
  const {
    cabecalhosCadastro,
    linhasCadastro,
    cabecalhosAfastamentos,
    linhasAfastamentos,
  } = lerPlanilhaFuncionariosComAbas(buffer);

  const cabecalhos = cabecalhosCadastro.length > 0 ? cabecalhosCadastro : lerPlanilhaEmLinhas(buffer).cabecalhos;
  const linhas = linhasCadastro.length > 0 ? linhasCadastro : lerPlanilhaEmLinhas(buffer).linhas;

  // Mapeamento dinâmico de colunas para índices normalizados da aba CADASTRO
  const mapaColunas: Record<string, string> = {};
  cabecalhos.forEach((col) => {
    const norm = normalizarCabecalho(col);
    mapaColunas[norm] = col;
  });

  const getValor = (linhaObj: Record<string, unknown>, chavesPossiveis: string[]): unknown => {
    for (const chave of chavesPossiveis) {
      const norm = normalizarCabecalho(chave);
      if (mapaColunas[norm] && linhaObj[mapaColunas[norm]] !== undefined) {
        return linhaObj[mapaColunas[norm]];
      }
      for (const k in mapaColunas) {
        if (k.includes(norm) || norm.includes(k)) {
          return linhaObj[mapaColunas[k]];
        }
      }
    }
    return "";
  };

  const todasInconsistencias: ItemInconsistencia[] = [];
  const linhasProcessadas: LinhaFuncionarioRmProcessada[] = [];
  const linhasRejeitadasLista: ItemLinhaRejeitada[] = [];
  const afastamentosValidos: AfastamentoFeriasValido[] = [];

  let countNovos = 0;
  let countAtualizados = 0;
  let countSemAlteracao = 0;
  let countErros = 0;
  let countAlertas = 0;

  const chapasNoArquivo = new Set<string>();

  // Base REV04 para cruzamento de alocações contratuais
  const alocacoesRev04 = estado.alocacoes && estado.alocacoes.length > 0 ? estado.alocacoes : ALOCACOES_MC_REAIS;

  linhas.forEach((linhaObj, idx) => {
    const numLinha = idx + 2; // Linha 1 = cabeçalho no Excel
    const errosLinha: ItemInconsistencia[] = [];
    const alertasLinha: ItemInconsistencia[] = [];

    // --- LEITURA COM MINIMIZAÇÃO DE DADOS (COLUNAS PERMITIDAS) ---
    const rawChapa = String(getValor(linhaObj, ["chapa"])).trim();
    const rawCpf = String(getValor(linhaObj, ["cpf"])).trim();
    const rawNome = String(getValor(linhaObj, ["nome"])).trim();
    const rawNomeSocial = String(getValor(linhaObj, ["nome social", "nomesocial"])).trim();
    const rawSexo = String(getValor(linhaObj, ["sexo"])).trim().toUpperCase();
    const rawNascimento = getValor(linhaObj, ["data de nascimento", "data nascimento", "datanascimento", "nascimento"]);
    const rawSituacaoCod = String(getValor(linhaObj, ["situacao", "cod situacao"])).trim();
    const rawSituacaoDesc = String(getValor(linhaObj, ["descricao da situacao", "descricao situacao", "desc situacao"])).trim();
    const rawAdmissao = getValor(linhaObj, ["data de admissao", "data admissao", "admissao"]);
    const rawDemissao = getValor(linhaObj, ["data de demissao", "data demissao", "demissao"]);
    const rawSecaoCod = String(getValor(linhaObj, ["secao", "cod secao", "codigo secao", "cod.secao"])).trim();
    const rawSecaoDesc = String(getValor(linhaObj, ["descricao secao", "desc secao", "desc.secao"])).trim();
    const rawFuncao = String(getValor(linhaObj, ["nome funcao", "funcao", "cargo"])).trim();
    const rawHorarioCod = String(getValor(linhaObj, ["horario", "cod horario", "codigo horario"])).trim();
    const rawHorarioDesc = String(getValor(linhaObj, ["descricao do horario", "desc horario"])).trim();
    const rawJornada = String(getValor(linhaObj, ["jornada", "horas semanais"])).trim();
    const rawPonto = String(getValor(linhaObj, ["utiliza ponto", "ponto"])).trim();

    // 1. Chapa (Normalização estrita para 6 dígitos numéricos)
    const chapaDigitos = rawChapa.replace(/\D/g, "");
    const chapaNormalizada = chapaDigitos.length > 0 ? chapaDigitos.padStart(6, "0") : "";
    if (!chapaNormalizada) {
      errosLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "Chapa",
        mensagem: "Chapa ausente ou inválida.",
      });
    } else {
      chapasNoArquivo.add(chapaNormalizada);

      // Verificação REV04: Chapa sem posição na REV04 -> Alerta "Pendente de alocação" (não rejeitar)
      const temPosicaoRev04 = alocacoesRev04.some((a) => {
        const ch = String(a.matricula || "").replace(/\D/g, "").padStart(6, "0");
        return ch === chapaNormalizada;
      });
      if (!temPosicaoRev04) {
        alertasLinha.push({
          linha: numLinha,
          tipo: "ALERTA",
          coluna: "Alocação REV04",
          chapa: chapaNormalizada,
          nome: rawNome,
          mensagem: "Pendente de alocação (colaborador sem posição contratual mapeada na Base REV04).",
        });
      }
    }

    // 2. CPF (Opcional no RM ou quando informado, validado por módulo 11)
    const cpfDigitos = rawCpf.replace(/\D/g, "");
    let cpfNormalizado = "";
    if (cpfDigitos.length > 0) {
      cpfNormalizado = cpfDigitos.padStart(11, "0");
      if (!validarCpf(cpfNormalizado)) {
        errosLinha.push({
          linha: numLinha,
          tipo: "ERRO",
          coluna: "CPF",
          chapa: chapaNormalizada,
          nome: rawNome,
          mensagem: `CPF inválido (${cpfNormalizado}) com dígitos verificadores incorretos.`,
        });
      } else {
        const colaboradorComMesmoCpf = estado.profissionais.find(
          (p) => p.cpfLimpo === cpfNormalizado && p.chapa !== chapaNormalizada
        );
        if (colaboradorComMesmoCpf) {
          alertasLinha.push({
            linha: numLinha,
            tipo: "ALERTA",
            coluna: "CPF / Chapa",
            chapa: chapaNormalizada,
            nome: rawNome,
            mensagem: `Possível readmissão: CPF já cadastrado no sistema vinculado à chapa ${colaboradorComMesmoCpf.chapa} (${colaboradorComMesmoCpf.nome}).`,
          });
        }
      }
    }

    // 3. Nome
    if (!rawNome || rawNome.length < 2) {
      errosLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "Nome",
        chapa: chapaNormalizada,
        mensagem: "Nome do colaborador é obrigatório.",
      });
    }

    // 4. Sexo ("M" ou "F", case-insensitive)
    let sexoFinal: "M" | "F" | undefined = undefined;
    if (rawSexo === "M" || rawSexo === "MASCULINO") {
      sexoFinal = "M";
    } else if (rawSexo === "F" || rawSexo === "FEMININO") {
      sexoFinal = "F";
    } else {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "Sexo",
        chapa: chapaNormalizada,
        nome: rawNome,
        mensagem: "Sexo ausente ou inválido. Importado em branco.",
      });
    }

    // 5. Data de Nascimento
    const { iso: dataNascIso, bruto: dataNascBruta } = normalizarDataRm(rawNascimento);
    if (dataNascIso) {
      const hoje = new Date(dataReferencia || new Date());
      const dataNascObj = new Date(dataNascIso);

      if (dataNascObj > hoje) {
        errosLinha.push({
          linha: numLinha,
          tipo: "ERRO",
          coluna: "Data de Nascimento",
          chapa: chapaNormalizada,
          nome: rawNome,
          mensagem: `Data de nascimento futura (${dataNascBruta}).`,
        });
      } else {
        const idadeCalculada = calcularIdade(dataNascIso, dataReferencia);
        if (idadeCalculada !== null && idadeCalculada > 100) {
          errosLinha.push({
            linha: numLinha,
            tipo: "ERRO",
            coluna: "Data de Nascimento",
            chapa: chapaNormalizada,
            nome: rawNome,
            mensagem: `Idade calculada acima de 100 anos (${idadeCalculada} anos). Verifique o ano de nascimento.`,
          });
        } else if (idadeCalculada !== null && idadeCalculada < 18) {
          alertasLinha.push({
            linha: numLinha,
            tipo: "ALERTA",
            coluna: "Data de Nascimento",
            chapa: chapaNormalizada,
            nome: rawNome,
            mensagem: `Colaborador menor de 18 anos – verificar (${idadeCalculada} anos).`,
          });
        }
      }
    } else {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "Data de Nascimento",
        chapa: chapaNormalizada,
        nome: rawNome,
        mensagem: "Data de nascimento ausente.",
      });
    }

    // 6. Datas de Admissão e Demissão
    const { iso: dataAdmissaoIso } = normalizarDataRm(rawAdmissao);
    const { iso: dataDemissaoIso } = normalizarDataRm(rawDemissao);

    // 7. Situação no RM
    const descSituacaoNorm = normalizarCabecalho(rawSituacaoDesc || rawSituacaoCod);
    let situacaoNormalizada: "ATIVO" | "AFASTADO" | "FERIAS" | "DESLIGADO" = "ATIVO";

    if (descSituacaoNorm.includes("demit") || descSituacaoNorm.includes("deslig") || rawSituacaoCod === "D") {
      situacaoNormalizada = "DESLIGADO";
    } else if (descSituacaoNorm.includes("ferias") || rawSituacaoCod === "F") {
      situacaoNormalizada = "FERIAS";
    } else if (
      descSituacaoNorm.includes("afast") ||
      descSituacaoNorm.includes("previd") ||
      descSituacaoNorm.includes("mater") ||
      rawSituacaoCod === "P" ||
      rawSituacaoCod === "M"
    ) {
      situacaoNormalizada = "AFASTADO";
    } else if (descSituacaoNorm.includes("aviso") || rawSituacaoCod === "V") {
      situacaoNormalizada = "ATIVO";
    } else if (descSituacaoNorm.includes("ativ") || rawSituacaoCod === "A") {
      situacaoNormalizada = "ATIVO";
    } else if (rawSituacaoDesc || rawSituacaoCod) {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "Situação",
        chapa: chapaNormalizada,
        nome: rawNome,
        mensagem: `Situação do RM não mapeada: "${rawSituacaoDesc || rawSituacaoCod}". Importado como ATIVO.`,
      });
    }

    // 8. Seção e Unidade (Unidade pelo Unidade_RM da coluna DESC. SECAO, nunca pelo nome curto)
    if (rawSecaoCod) {
      registrarSecaoImportada(rawSecaoCod, rawSecaoDesc);
    }
    const baseResolvida = obterBasePorCodigoSecao(rawSecaoCod);
    const unidadeFinalNome = rawSecaoDesc || baseResolvida.unidadeNome;

    if (baseResolvida.unidadeId === "NAO_MAPEADA") {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "Seção",
        chapa: chapaNormalizada,
        nome: rawNome,
        mensagem: `Seção '${rawSecaoCod} - ${rawSecaoDesc}' não mapeada.`,
      });
    }

    // 9. Horário
    if (rawHorarioCod && rawHorarioDesc) {
      registrarHorarioRm(rawHorarioCod, rawHorarioDesc, rawJornada);
    }

    // 10. Inferência de Escala
    let escalaInferida: "5x2" | "12x36" | "6x1" | "OUTRA" = "5x2";
    const descHorarioNorm = normalizarCabecalho(rawHorarioDesc);
    if (descHorarioNorm.includes("12x36")) {
      escalaInferida = "12x36";
    } else if (descHorarioNorm.includes("6x1")) {
      escalaInferida = "6x1";
    }

    const temErro = errosLinha.length > 0;
    const temAlerta = alertasLinha.length > 0;

    let statusAcao: "NOVO" | "ATUALIZADO" | "SEM_ALTERACAO" | "ERRO" = "NOVO";
    if (temErro) {
      statusAcao = "ERRO";
      countErros++;
      errosLinha.forEach((err) => {
        linhasRejeitadasLista.push({
          linha: numLinha,
          aba: "CADASTRO",
          chapa: chapaNormalizada || "—",
          nome: rawNome || "—",
          coluna: err.coluna,
          motivo: err.mensagem,
        });
      });
    } else {
      const colaboradorExistente = estado.profissionais.find((p) => p.chapa === chapaNormalizada);
      if (!colaboradorExistente) {
        statusAcao = "NOVO";
        countNovos++;
      } else {
        const mudou =
          colaboradorExistente.nome !== rawNome ||
          colaboradorExistente.funcao !== rawFuncao ||
          colaboradorExistente.situacao !== situacaoNormalizada ||
          colaboradorExistente.secaoCodigo !== rawSecaoCod ||
          colaboradorExistente.horarioCodigo !== rawHorarioCod;

        if (mudou) {
          statusAcao = "ATUALIZADO";
          countAtualizados++;
        } else {
          statusAcao = "SEM_ALTERACAO";
          countSemAlteracao++;
        }
      }
    }

    if (temAlerta) countAlertas++;

    const inconsistenciasDaLinha = [...errosLinha, ...alertasLinha];
    todasInconsistencias.push(...inconsistenciasDaLinha);

    linhasProcessadas.push({
      linha: numLinha,
      validaParaGravacao: !temErro,
      statusAcao,
      inconsistencias: inconsistenciasDaLinha,
      dados: {
        chapa: chapaNormalizada,
        matricula: chapaNormalizada,
        nome: rawNome,
        nomeSocial: rawNomeSocial || undefined,
        cpfLimpo: cpfNormalizado,
        cpfMascarado: cpfNormalizado ? mascararCpf(cpfNormalizado) : "—",
        sexo: sexoFinal,
        dataNascimento: dataNascIso || undefined,
        situacao: situacaoNormalizada,
        situacaoCodigo: rawSituacaoCod,
        situacaoDescricao: rawSituacaoDesc || situacaoNormalizada,
        dataAdmissao: dataAdmissaoIso || dataReferencia,
        dataDesligamento: dataDemissaoIso || undefined,
        secaoCodigo: rawSecaoCod,
        secaoDescricao: rawSecaoDesc,
        unidadeId: baseResolvida.unidadeId,
        unidadeNome: unidadeFinalNome,
        funcao: rawFuncao,
        horarioCodigo: rawHorarioCod || undefined,
        horarioDescricao: rawHorarioDesc || undefined,
        jornadaDescricao: rawJornada || undefined,
        utilizaPonto: rawPonto.toLowerCase() === "sim" || rawPonto === "1" || rawPonto.toLowerCase() === "s",
        escala: escalaInferida,
      },
    });
  });

  // Alerta de colaboradores da Base REV04 que não vieram no arquivo (não apagar)
  alocacoesRev04.forEach((a) => {
    const ch = String(a.matricula || "").replace(/\D/g, "").padStart(6, "0");
    if (ch && !chapasNoArquivo.has(ch)) {
      const msg = `Colaborador ${a.nome} (Chapa ${ch}) não encontrada no RM (consta na Base REV04 mas ausente no arquivo).`;
      todasInconsistencias.push({
        linha: 0,
        tipo: "ALERTA",
        coluna: "Geral",
        chapa: ch,
        nome: a.nome,
        mensagem: msg,
      });
      countAlertas++;
    }
  });

  // --- LEITURA DA ABA AFASTAMENTOS_FERIAS ---
  if (linhasAfastamentos.length > 0) {
    const mapaColunasAf: Record<string, string> = {};
    cabecalhosAfastamentos.forEach((col) => {
      mapaColunasAf[normalizarCabecalho(col)] = col;
    });

    const getValorAf = (row: Record<string, unknown>, chavesPossiveis: string[]): unknown => {
      for (const c of chavesPossiveis) {
        const norm = normalizarCabecalho(c);
        if (mapaColunasAf[norm] && row[mapaColunasAf[norm]] !== undefined) {
          return row[mapaColunasAf[norm]];
        }
        for (const k in mapaColunasAf) {
          if (k.includes(norm) || norm.includes(k)) {
            return row[mapaColunasAf[k]];
          }
        }
      }
      return "";
    };

    const periodosAceitosPorChapa = new Map<string, Array<{ inicio: string; fim: string }>>();

    linhasAfastamentos.forEach((row, idx) => {
      const numLinhaAf = idx + 2;
      const rawChapaAf = String(getValorAf(row, ["chapa"])).trim();
      const chapaAf = rawChapaAf.replace(/\D/g, "").padStart(6, "0");
      const rawTipo = String(getValorAf(row, ["tipo", "tipo afastamento", "motivo"])).trim();
      const rawIni = getValorAf(row, ["data de inicio", "data inicio", "datainicio", "inicio", "data_inicio"]);
      const rawFim = getValorAf(row, ["data de fim", "data fim", "datafim", "fim", "termino", "data_fim"]);
      const rawRetorno = getValorAf(row, ["data retorno previsto", "retorno previsto", "retorno", "data_retorno_previsto"]);

      const { iso: dtInicioIso } = normalizarDataRm(rawIni);
      const { iso: dtFimIso } = normalizarDataRm(rawFim);
      const { iso: dtRetornoIso } = normalizarDataRm(rawRetorno);

      // Regra 1: Rejeitar CHAPA inexistente na aba CADASTRO
      if (!chapaAf || !chapasNoArquivo.has(chapaAf)) {
        countErros++;
        const itemRej: ItemLinhaRejeitada = {
          linha: numLinhaAf,
          aba: "AFASTAMENTOS_FERIAS",
          chapa: chapaAf || "—",
          coluna: "CHAPA",
          motivo: `Chapa ${chapaAf || "não informada"} não encontrada na aba CADASTRO.`,
        };
        linhasRejeitadasLista.push(itemRej);
        todasInconsistencias.push({
          linha: numLinhaAf,
          tipo: "ERRO",
          coluna: "Afastamentos - CHAPA",
          chapa: chapaAf,
          mensagem: itemRej.motivo,
        });
        return;
      }

      // Regra 2: Data de início obrigatória
      if (!dtInicioIso) {
        countErros++;
        const itemRej: ItemLinhaRejeitada = {
          linha: numLinhaAf,
          aba: "AFASTAMENTOS_FERIAS",
          chapa: chapaAf,
          coluna: "DATA_INICIO",
          motivo: "Data de início obrigatória ausente ou inválida.",
        };
        linhasRejeitadasLista.push(itemRej);
        todasInconsistencias.push({
          linha: numLinhaAf,
          tipo: "ERRO",
          coluna: "Afastamentos - DATA_INICIO",
          chapa: chapaAf,
          mensagem: itemRej.motivo,
        });
        return;
      }

      // Regra 3: Aceitar períodos que tocam a competência (início <= fimComp e (fim >= inícioComp ou vazio))
      if (options?.competencia) {
        const periodoComp = obterPeriodoCompetencia(options.competencia);
        const tocaCompetencia = dtInicioIso <= periodoComp.dataFim && (!dtFimIso || dtFimIso >= periodoComp.dataInicio);
        if (!tocaCompetencia) {
          countErros++;
          const itemRej: ItemLinhaRejeitada = {
            linha: numLinhaAf,
            aba: "AFASTAMENTOS_FERIAS",
            chapa: chapaAf,
            coluna: "Período",
            motivo: `Período (${dtInicioIso} a ${dtFimIso || "em aberto"}) não toca a competência selecionada (${periodoComp.textoFormatado}).`,
          };
          linhasRejeitadasLista.push(itemRej);
          todasInconsistencias.push({
            linha: numLinhaAf,
            tipo: "ERRO",
            coluna: "Afastamentos - Competência",
            chapa: chapaAf,
            mensagem: itemRej.motivo,
          });
          return;
        }
      }

      // Regra 4: Rejeitar períodos sobrepostos da mesma chapa
      const fimCalculado = dtFimIso || "9999-12-31";
      const periodosAceitos = periodosAceitosPorChapa.get(chapaAf) || [];
      const sobreposicao = periodosAceitos.find(
        (p) => dtInicioIso <= p.fim && p.inicio <= fimCalculado
      );
      if (sobreposicao) {
        countErros++;
        const itemRej: ItemLinhaRejeitada = {
          linha: numLinhaAf,
          aba: "AFASTAMENTOS_FERIAS",
          chapa: chapaAf,
          coluna: "Período",
          motivo: `Período sobreposto a outro afastamento já registrado da chapa ${chapaAf} (${sobreposicao.inicio} a ${sobreposicao.fim === "9999-12-31" ? "em aberto" : sobreposicao.fim}).`,
        };
        linhasRejeitadasLista.push(itemRej);
        todasInconsistencias.push({
          linha: numLinhaAf,
          tipo: "ERRO",
          coluna: "Afastamentos - Sobreposição",
          chapa: chapaAf,
          mensagem: itemRej.motivo,
        });
        return;
      }

      // Regra 5: Mapear TIPO para Férias | Afastamento | Licença
      const normTipo = normalizarCabecalho(rawTipo);
      let tipoMapeado: "Férias" | "Afastamento" | "Licença" = "Afastamento";
      if (normTipo.includes("feria")) {
        tipoMapeado = "Férias";
      } else if (
        normTipo.includes("licen") ||
        normTipo.includes("gala") ||
        normTipo.includes("luto") ||
        normTipo.includes("mater") ||
        normTipo.includes("pater")
      ) {
        tipoMapeado = "Licença";
      } else {
        tipoMapeado = "Afastamento";
      }

      periodosAceitos.push({ inicio: dtInicioIso, fim: fimCalculado });
      periodosAceitosPorChapa.set(chapaAf, periodosAceitos);

      afastamentosValidos.push({
        chapa: chapaAf,
        tipoOriginal: rawTipo || tipoMapeado,
        tipoMapeado,
        dataInicio: dtInicioIso,
        dataFim: dtFimIso || undefined,
        dataRetornoPrevisto: dtRetornoIso || undefined,
      });
    });
  }

  const totalLinhasLidas = linhas.length + linhasAfastamentos.length;

  return {
    tipo: "FUNCIONARIOS_RM",
    arquivoNome,
    hashSha256: hash,
    dataReferencia,
    competencia: options?.competencia,
    dataExtracao: options?.dataExtracao || dataReferencia,
    arquivoDuplicado,
    loteAnteriorId: loteExistente?.id,
    loteAnteriorData: loteExistente?.dataHora,
    totais: {
      lidos: totalLinhasLidas,
      novos: countNovos,
      atualizados: countAtualizados,
      semAlteracao: countSemAlteracao,
      erros: countErros,
      alertas: countAlertas,
    },
    linhas: linhasProcessadas,
    inconsistencias: todasInconsistencias,
    alertasColaboradoresNaoConstantes: [],
    linhasRejeitadasLista,
    afastamentosValidos,
  };
}

/**
 * Confirma a importação de Funcionários RM gravando as alterações no estado operacional.
 * Se já existir lote para a mesma competência, substitui o lote (desfaz o anterior e grava o novo, não somando).
 */
export function confirmarImportacaoFuncionariosRm(
  simulacao: ResultadoSimulacaoRm,
  usuarioNome: string = "Admin Premier"
): { sucesso: boolean; loteId: string; mensagem: string } {
  if (simulacao.arquivoDuplicado && !simulacao.competencia) {
    throw new Error(`este arquivo já foi importado anteriormente no lote ${simulacao.loteAnteriorId || ""}.`);
  }

  const estadoAtual = carregarEstado();
  const dataHoraAtual = new Date().toISOString();
  const loteId = `lote-rm-${Date.now()}`;

  // Se já existir lote do mesmo tipo e competência, substituir (desfaz anterior e grava o novo, não somar)
  let lotesExistentes = estadoAtual.lotesImportacao || [];
  let profissionaisBase = [...(estadoAtual.profissionais || [])];
  let ocorrenciasBase = [...(estadoAtual.ocorrencias || [])];

  if (simulacao.competencia) {
    const loteAnterior = lotesExistentes.find(
      (l) => l.tipo === "FUNCIONARIOS_RM" && l.competencia === simulacao.competencia && l.status === "CONCLUIDO"
    );
    if (loteAnterior && loteAnterior.snapshotAnterior) {
      // Reverter para o snapshot anterior para não somar
      profissionaisBase = [...(loteAnterior.snapshotAnterior.profissionais || [])];
      ocorrenciasBase = [...(loteAnterior.snapshotAnterior.ocorrencias || [])];
      lotesExistentes = lotesExistentes.filter((l) => l.id !== loteAnterior.id);
    }
  }

  const snapshotAnterior: EstadoOperacionalCompleto = {
    profissionais: [...profissionaisBase],
    ocorrencias: [...ocorrenciasBase],
    coberturas: [...(estadoAtual.coberturas || [])],
    alocadosSifac: [...(estadoAtual.alocadosSifac || [])],
  } as any;

  const mapaProfissionais = new Map<string, ProfissionalOperacional>();
  profissionaisBase.forEach((p) => {
    mapaProfissionais.set(p.chapa, p);
  });

  simulacao.linhas.forEach((linha) => {
    if (!linha.validaParaGravacao) return;
    const d = linha.dados;
    const existente = mapaProfissionais.get(d.chapa);

    if (existente) {
      // Mudança de seção, função ou horário -> gravar histórico com vigência
      const mudou =
        existente.secaoCodigo !== d.secaoCodigo ||
        existente.funcao !== d.funcao ||
        existente.horarioCodigo !== d.horarioCodigo;

      const historicoAtualizado: MovimentacaoHistorico[] = [...(existente.historico || [])];
      if (mudou) {
        historicoAtualizado.push({
          dataReferencia: simulacao.dataExtracao || simulacao.dataReferencia || dataHoraAtual.substring(0, 10),
          situacao: d.situacao,
          funcao: d.funcao,
          secaoCodigo: d.secaoCodigo,
          secaoDescricao: d.secaoDescricao,
          horarioCodigo: d.horarioCodigo,
          horarioDescricao: d.horarioDescricao,
        });
      }

      mapaProfissionais.set(d.chapa, {
        ...existente,
        nome: d.nome,
        nomeSocial: d.nomeSocial,
        cpfLimpo: d.cpfLimpo || existente.cpfLimpo,
        cpfMascarado: d.cpfMascarado || existente.cpfMascarado,
        sexo: d.sexo || existente.sexo,
        dataNascimento: d.dataNascimento || existente.dataNascimento,
        situacao: d.situacao,
        situacaoCodigo: d.situacaoCodigo || existente.situacaoCodigo,
        situacaoDescricao: d.situacaoDescricao || existente.situacaoDescricao,
        dataAdmissao: d.dataAdmissao || existente.dataAdmissao,
        dataDesligamento: d.dataDesligamento || existente.dataDesligamento,
        secaoCodigo: d.secaoCodigo,
        secaoDescricao: d.secaoDescricao,
        unidadeId: d.unidadeId,
        unidadeNome: d.unidadeNome,
        funcao: d.funcao,
        horarioCodigo: d.horarioCodigo,
        horarioDescricao: d.horarioDescricao,
        jornadaDescricao: d.jornadaDescricao,
        utilizaPonto: d.utilizaPonto,
        escala: d.escala,
        historico: historicoAtualizado,
      });
    } else {
      mapaProfissionais.set(d.chapa, {
        id: `prof-${d.chapa}`,
        chapa: d.chapa,
        matricula: d.matricula,
        nome: d.nome,
        nomeSocial: d.nomeSocial,
        cpfLimpo: d.cpfLimpo || "",
        cpfMascarado: d.cpfMascarado || "—",
        sexo: d.sexo,
        dataNascimento: d.dataNascimento,
        situacao: d.situacao,
        situacaoCodigo: d.situacaoCodigo,
        situacaoDescricao: d.situacaoDescricao,
        dataAdmissao: d.dataAdmissao,
        dataDesligamento: d.dataDesligamento,
        secaoCodigo: d.secaoCodigo,
        secaoDescricao: d.secaoDescricao,
        unidadeId: d.unidadeId,
        unidadeNome: d.unidadeNome,
        funcao: d.funcao,
        horarioCodigo: d.horarioCodigo,
        horarioDescricao: d.horarioDescricao,
        jornadaDescricao: d.jornadaDescricao,
        utilizaPonto: d.utilizaPonto,
        escala: d.escala,
      });
    }
  });

  // Grava afastamentos e férias na base de ocorrências
  const mapaOcorrencias = new Map<string, OcorrenciaOperacional>();
  ocorrenciasBase.forEach((o) => {
    mapaOcorrencias.set(`${o.matricula}_${o.dataInicio}_${o.tipoOcorrencia}`, o);
  });

  if (simulacao.afastamentosValidos && simulacao.afastamentosValidos.length > 0) {
    simulacao.afastamentosValidos.forEach((af) => {
      const chave = `${af.chapa}_${af.dataInicio}_${af.tipoMapeado}`;
      const tipoOcorr: "FERIAS" | "OUTROS" = af.tipoMapeado === "Férias" ? "FERIAS" : "OUTROS";
      mapaOcorrencias.set(chave, {
        id: `ocorr-rm-${af.chapa}-${af.dataInicio.replace(/-/g, "")}`,
        matricula: af.chapa,
        profissionalNome: af.chapa,
        dataInicio: af.dataInicio,
        dataFim: af.dataFim || af.dataInicio,
        diasAfetados: 1,
        tipoOcorrencia: tipoOcorr,
        categoriaAusencia: af.tipoMapeado,
        observacaoPublica: `Afastamento/Férias importado do RM (${af.tipoOriginal})`,
        criadoEm: dataHoraAtual,
        status: "VALIDADA",
      });
    });
  }

  // Gera ocorrências para colaboradores cuja situação no CADASTRO seja Férias, Afastamento ou Licença
  const compPeriodo = simulacao.competencia ? obterPeriodoCompetencia(simulacao.competencia) : null;
  const dataIniComp = compPeriodo?.dataInicio || "2026-08-10";
  const dataFimComp = compPeriodo?.dataFim || "2026-09-09";

  simulacao.linhas.forEach((linha) => {
    if (!linha.validaParaGravacao) return;
    const d = linha.dados;
    const ehFerias = d.situacao === "FERIAS" || d.situacaoCodigo === "F" || d.situacaoDescricao?.toLowerCase().includes("feria");
    const ehAfastado = d.situacao === "AFASTADO" || d.situacaoCodigo === "P" || d.situacaoDescricao?.toLowerCase().includes("previd") || d.situacaoDescricao?.toLowerCase().includes("afast");
    const ehLicenca = d.situacaoCodigo === "E" || d.situacaoDescricao?.toLowerCase().includes("licen");

    if (ehFerias || ehAfastado || ehLicenca) {
      const cat = ehFerias ? "Férias" : ehAfastado ? "Afastamento" : "Licença";
      const tipoOcorr: OcorrenciaOperacional["tipoOcorrencia"] = ehFerias ? "FERIAS" : ehAfastado ? "ATESTADO_MEDICO" : "FALTA_JUSTIFICADA";
      const chave = `${d.chapa}_${dataIniComp}_${tipoOcorr}`;
      if (!mapaOcorrencias.has(chave)) {
        mapaOcorrencias.set(chave, {
          id: `ocorr-rm-cad-${d.chapa}-${dataIniComp.replace(/-/g, "")}`,
          matricula: d.chapa,
          profissionalNome: d.nome || `Colaborador ${d.chapa}`,
          postoCodigo: estadoAtual.profissionais.find((p) => p.chapa === d.chapa)?.postoCodigo,
          dataInicio: dataIniComp,
          dataFim: dataFimComp,
          diasAfetados: compPeriodo?.datas?.length || 31,
          tipoOcorrencia: tipoOcorr,
          categoriaAusencia: cat,
          observacaoPublica: `Ausência RM: ${cat} (${d.situacaoDescricao || cat})`,
          criadoEm: dataHoraAtual,
          status: "VALIDADA",
        });
      }
    }
  });

  const novoLote: LoteImportacaoOperacional = {
    id: loteId,
    tipo: "FUNCIONARIOS_RM",
    competencia: simulacao.competencia,
    dataExtracao: simulacao.dataExtracao,
    linhasRejeitadas: simulacao.linhasRejeitadasLista ? simulacao.linhasRejeitadasLista.length : simulacao.totais.erros,
    arquivoNome: simulacao.arquivoNome,
    hashSha256: simulacao.hashSha256,
    dataReferencia: simulacao.dataReferencia,
    usuario: usuarioNome,
    dataHora: dataHoraAtual,
    totais: { ...simulacao.totais },
    status: "CONCLUIDO",
    snapshotAnterior,
    diasRetencao: 90,
  };

  const novoLog: LogAuditoriaOperacional = {
    id: `log-rm-${Date.now()}`,
    timestamp: dataHoraAtual,
    usuario: usuarioNome,
    perfil: "PREMIER_ADMIN",
    acao: "IMPORTAR_FUNCIONARIOS_RM",
    entidade: `Lote (${loteId})`,
    detalhes: `Importação de Funcionários RM confirmada no lote ${loteId} (${simulacao.arquivoNome})${simulacao.competencia ? ` - Competência ${simulacao.competencia}` : ""}: ${simulacao.totais.novos} novos, ${simulacao.totais.atualizados} atualizados, ${simulacao.totais.erros} erros.`,
    ip: "189.120.45.12",
  };

  salvarEstado({
    profissionais: Array.from(mapaProfissionais.values()),
    ocorrencias: Array.from(mapaOcorrencias.values()),
    lotesImportacao: [novoLote, ...lotesExistentes],
    logsAuditoria: [novoLog, ...(estadoAtual.logsAuditoria || [])],
  });

  if (simulacao.competencia) {
    marcarCalendarioDesatualizado(simulacao.competencia);
  }

  return {
    sucesso: true,
    loteId,
    mensagem: `Importação de Funcionários confirmada com sucesso! Lote ${loteId} processado.${simulacao.competencia ? ` Competência: ${simulacao.competencia}.` : ""}`,
  };
}



/**
 * Gera relatório de validação em formato XLSX binário para download do usuário
 */
export function gerarRelatorioValidacaoXlsx(simulacao: ResultadoSimulacaoRm): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo do Lote
  const resumo = [
    { Indicador: "Arquivo", Valor: simulacao.arquivoNome },
    { Indicador: "Hash SHA-256", Valor: simulacao.hashSha256 },
    { Indicador: "Data de Referência", Valor: simulacao.dataReferencia },
    { Indicador: "Total Registros Lidos", Valor: simulacao.totais.lidos },
    { Indicador: "Novos Colaboradores", Valor: simulacao.totais.novos },
    { Indicador: "Colaboradores Atualizados", Valor: simulacao.totais.atualizados },
    { Indicador: "Sem Alteração", Valor: simulacao.totais.semAlteracao },
    { Indicador: "Linhas com Erro (Impeditivas)", Valor: simulacao.totais.erros },
    { Indicador: "Linhas com Alerta", Valor: simulacao.totais.alertas },
    { Indicador: "Status da Simulação", Valor: simulacao.totais.erros > 0 ? "Com Erros Impeditivos" : "Apto para Importação" },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Aba 2: Inconsistências (Erros e Alertas)
  const itensInconsistencias = simulacao.inconsistencias.map((inc) => ({
    Linha: inc.linha === 0 ? "Geral / Base" : inc.linha,
    Tipo: inc.tipo,
    Coluna: inc.coluna || "—",
    Chapa: inc.chapa || "—",
    Nome: inc.nome || "—",
    Motivo: inc.mensagem,
  }));
  const wsInconsistencias = XLSX.utils.json_to_sheet(
    itensInconsistencias.length > 0 ? itensInconsistencias : [{ Linha: "—", Tipo: "OK", Mensagem: "Nenhum erro ou alerta encontrado." }]
  );
  XLSX.utils.book_append_sheet(wb, wsInconsistencias, "Erros e Alertas");

  // Aba 3: Todos os Registros Processados
  const itensLinhas = simulacao.linhas.map((l) => ({
    Linha: l.linha,
    Status: l.statusAcao,
    Chapa: l.dados.chapa,
    Nome: l.dados.nome,
    NomeSocial: l.dados.nomeSocial || "",
    CPF: l.dados.cpfMascarado,
    Sexo: l.dados.sexo || "",
    DataNascimento: l.dados.dataNascimento || "",
    Situacao: l.dados.situacao,
    Secao: `${l.dados.secaoCodigo} - ${l.dados.secaoDescricao}`,
    BaseSGP: l.dados.unidadeNome,
    Funcao: l.dados.funcao,
    Horario: l.dados.horarioDescricao || "",
  }));
  const wsLinhas = XLSX.utils.json_to_sheet(itensLinhas);
  XLSX.utils.book_append_sheet(wb, wsLinhas, "Dados Analisados");

  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbOut);
}

/**
 * Gera arquivo XLSX exclusivo contendo as linhas rejeitadas e seus respectivos motivos
 */
export function gerarPlanilhaLinhasRejeitadasXlsx(linhasRejeitadas: ItemLinhaRejeitada[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const dados = linhasRejeitadas.map((r) => ({
    Linha: r.linha,
    Aba: r.aba || "Principal",
    Chapa: r.chapa || "—",
    Colaborador: r.nome || "—",
    Coluna: r.coluna || "—",
    "Motivo da Rejeição": r.motivo,
  }));
  const ws = XLSX.utils.json_to_sheet(
    dados.length > 0 ? dados : [{ Linha: "—", Motivo: "Nenhuma linha rejeitada." }]
  );
  XLSX.utils.book_append_sheet(wb, ws, "Rejeitadas");
  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbOut);
}
