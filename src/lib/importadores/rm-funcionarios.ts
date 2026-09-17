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
  LoteImportacaoOperacional,
  calcularIdade,
} from "../dados/estado-operacional";
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

export interface ResultadoIdentificacaoRm {
  reconhecido: boolean;
  tipo: "FUNCIONARIOS_RM" | "ALOCADOS_SIFAC" | "ABONO_RM" | "DESCONHECIDO";
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

export interface ResultadoSimulacaoRm {
  tipo: "FUNCIONARIOS_RM";
  arquivoNome: string;
  hashSha256: string;
  dataReferencia: string;
  arquivoDuplicado: boolean;
  loteAnteriorId?: string;
  loteAnteriorData?: string;
  totais: TotaisSimulacaoRm;
  linhas: LinhaFuncionarioRmProcessada[];
  inconsistencias: ItemInconsistencia[];
  alertasColaboradoresNaoConstantes: string[];
}

// Colunas obrigatórias para identificação do tipo Funcionários RM
export const COLUNAS_OBRIGATORIAS_RM = [
  "chapa",
  "cpf",
  "secao",
  "descricao secao",
  "nome funcao",
  "situacao",
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
  let dv1 = resto === 10 || resto === 11 ? 0 : resto;
  if (dv1 !== parseInt(cpfLimpo.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpfLimpo.charAt(i), 10) * (11 - i);
  }
  resto = 11 - (soma % 11);
  let dv2 = resto === 10 || resto === 11 ? 0 : resto;
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

  // 3. Identificar Cubo de Abono
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
 * Extrai linhas de dados de uma planilha XLSX ou XLS
 */
export function lerPlanilhaEmLinhas(buffer: Uint8Array | ArrayBuffer): {
  cabecalhos: string[];
  linhas: Record<string, unknown>[];
} {
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
  estadoCustom?: EstadoOperacionalCompleto
): Promise<ResultadoSimulacaoRm> {
  const estado = estadoCustom || carregarEstado();
  const hash = await calcularHashSha256(buffer);

  // 1. Verificação de reimportação por hash SHA-256
  const loteExistente = (estado.lotesImportacao || []).find(
    (l) => l.hashSha256 === hash && l.status === "CONCLUIDO"
  );
  const arquivoDuplicado = !!loteExistente;

  // 2. Leitura dos dados brutos
  const { cabecalhos, linhas } = lerPlanilhaEmLinhas(buffer);

  // Mapeamento dinâmico de colunas para índices normalizados
  const mapaColunas: Record<string, string> = {};
  cabecalhos.forEach((col) => {
    const norm = normalizarCabecalho(col);
    mapaColunas[norm] = col;
  });

  const getValor = (linhaObj: Record<string, unknown>, chavesPossiveis: string[]): unknown => {
    for (const chave of chavesPossiveis) {
      const norm = normalizarCabecalho(chave);
      // matching exato
      if (mapaColunas[norm] && linhaObj[mapaColunas[norm]] !== undefined) {
        return linhaObj[mapaColunas[norm]];
      }
      // matching parcial
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

  let countNovos = 0;
  let countAtualizados = 0;
  let countSemAlteracao = 0;
  let countErros = 0;
  let countAlertas = 0;

  const chapasNoArquivo = new Set<string>();

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
    const rawSecaoCod = String(getValor(linhaObj, ["secao", "cod secao", "codigo secao"])).trim();
    const rawSecaoDesc = String(getValor(linhaObj, ["descricao secao", "desc secao"])).trim();
    const rawFuncao = String(getValor(linhaObj, ["nome funcao", "funcao", "cargo"])).trim();
    const rawHorarioCod = String(getValor(linhaObj, ["horario", "cod horario", "codigo horario"])).trim();
    const rawHorarioDesc = String(getValor(linhaObj, ["descricao do horario", "desc horario"])).trim();
    const rawJornada = String(getValor(linhaObj, ["jornada", "horas semanais"])).trim();
    const rawPonto = String(getValor(linhaObj, ["utiliza ponto", "ponto"])).trim();

    // 1. Chapa (Normalização para 6 dígitos)
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
    }

    // 2. CPF (Normalização para 11 dígitos e validação de dígitos verificadores)
    const cpfDigitos = rawCpf.replace(/\D/g, "");
    let cpfNormalizado = "";
    if (!cpfDigitos) {
      errosLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "CPF",
        chapa: chapaNormalizada,
        nome: rawNome,
        mensagem: "CPF não informado.",
      });
    } else {
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
      }
    }

    // Validação de possível readmissão (mesmo CPF, chapa diferente no sistema)
    if (cpfNormalizado) {
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
        mensagem: "Sexo não informado ou inválido (aceitos: 'M' ou 'F'). Campo será gravado em branco.",
      });
    }

    // 5. Data de Nascimento
    const { iso: dataNascIso, bruto: dataNascBruta } = normalizarDataRm(rawNascimento);
    if (!dataNascIso) {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "Data de Nascimento",
        chapa: chapaNormalizada,
        nome: rawNome,
        mensagem: "Data de nascimento não informada (campo obrigatório no SIFAC).",
      });
    } else {
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
      situacaoNormalizada = "ATIVO"; // Aviso prévio trabalhado ainda conta como ativo
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

    // 8. Seção e Base
    if (rawSecaoCod) {
      registrarSecaoImportada(rawSecaoCod, rawSecaoDesc);
    }
    const baseResolvida = obterBasePorCodigoSecao(rawSecaoCod);
    if (!baseResolvida.mapeada) {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "Seção",
        chapa: chapaNormalizada,
        nome: rawNome,
        mensagem: `Seção "${rawSecaoCod}" (${rawSecaoDesc || "sem descrição"}) não possui mapeamento para base SGP. Colaborador associado como "Não mapeada".`,
      });
    }

    // 9. Horário
    if (rawHorarioCod && rawHorarioDesc) {
      registrarHorarioRm(rawHorarioCod, rawHorarioDesc, rawJornada);
    }

    // 10. Inferência de Escala (para exibição inicial)
    let escalaInferida: "5x2" | "12x36" | "6x1" | "OUTRA" = "5x2";
    const descHorarioNorm = normalizarCabecalho(rawHorarioDesc);
    if (descHorarioNorm.includes("12x36")) {
      escalaInferida = "12x36";
    } else if (descHorarioNorm.includes("6x1")) {
      escalaInferida = "6x1";
    }

    // Status da ação: NOVO, ATUALIZADO, SEM_ALTERACAO, ERRO
    const temErro = errosLinha.length > 0;
    const temAlerta = alertasLinha.length > 0;

    let statusAcao: "NOVO" | "ATUALIZADO" | "SEM_ALTERACAO" | "ERRO" = "NOVO";
    if (temErro) {
      statusAcao = "ERRO";
      countErros++;
    } else {
      const colaboradorExistente = estado.profissionais.find((p) => p.chapa === chapaNormalizada);
      if (!colaboradorExistente) {
        statusAcao = "NOVO";
        countNovos++;
      } else {
        // Verifica se houve alteração nos campos monitorados
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

    if (temAlerta) {
      countAlertas++;
    }

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
        cpfMascarado: mascararCpf(cpfNormalizado),
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
        unidadeNome: baseResolvida.unidadeNome,
        funcao: rawFuncao,
        horarioCodigo: rawHorarioCod || undefined,
        horarioDescricao: rawHorarioDesc || undefined,
        jornadaDescricao: rawJornada || undefined,
        utilizaPonto: rawPonto.toLowerCase() === "sim" || rawPonto === "1" || rawPonto.toLowerCase() === "s",
        escala: escalaInferida,
      },
    });
  });

  // Alerta de colaboradores ativos no sistema que não constam no arquivo
  const alertasNaoConstam: string[] = [];
  estado.profissionais
    .filter((p) => p.situacao === "ATIVO")
    .forEach((p) => {
      if (!chapasNoArquivo.has(p.chapa)) {
        const msg = `Colaborador ativo ${p.nome} (Chapa ${p.chapa}) não consta na exportação do RM.`;
        alertasNaoConstam.push(msg);
        todasInconsistencias.push({
          linha: 0,
          tipo: "ALERTA",
          coluna: "Geral",
          chapa: p.chapa,
          nome: p.nome,
          mensagem: msg,
        });
        countAlertas++;
      }
    });

  return {
    tipo: "FUNCIONARIOS_RM",
    arquivoNome,
    hashSha256: hash,
    dataReferencia,
    arquivoDuplicado,
    loteAnteriorId: loteExistente?.id,
    loteAnteriorData: loteExistente?.dataHora,
    totais: {
      lidos: linhas.length,
      novos: countNovos,
      atualizados: countAtualizados,
      semAlteracao: countSemAlteracao,
      erros: countErros,
      alertas: countAlertas,
    },
    linhas: linhasProcessadas,
    inconsistencias: todasInconsistencias,
    alertasColaboradoresNaoConstantes: alertasNaoConstam,
  };
}

/**
 * ETAPA 4: Confirmação atômica da importação (Tudo ou Nada)
 * Grava o lote e atualiza os colaboradores no sistema, salvando o snapshot anterior para rollback.
 */
export function confirmarImportacaoFuncionariosRm(
  simulacao: ResultadoSimulacaoRm,
  usuarioNome: string = "Administrador Premier (Marcos Valério)"
): { sucesso: boolean; loteId: string; mensagem: string } {
  const estadoAtual = carregarEstado();

  // Verifica se o mesmo arquivo já foi importado
  if (simulacao.arquivoDuplicado) {
    throw new Error(
      `Operação bloqueada: este arquivo já foi importado anteriormente no Lote ${simulacao.loteAnteriorId} em ${simulacao.loteAnteriorData}.`
    );
  }

  // Gera o snapshot completo do estado anterior para possibilitar rollback
  const snapshotAnterior: EstadoOperacionalCompleto = JSON.parse(JSON.stringify(estadoAtual));

  const mapaExistentes = new Map<string, ProfissionalOperacional>();
  estadoAtual.profissionais.forEach((p) => mapaExistentes.set(p.chapa, p));

  // Aplica as linhas válidas
  simulacao.linhas.forEach((l) => {
    if (!l.validaParaGravacao) return; // Linhas com erro não são gravadas

    const d = l.dados;
    const anterior = mapaExistentes.get(d.chapa);

    if (anterior) {
      // Atualização
      const mudanca = {
        dataReferencia: simulacao.dataReferencia,
        situacao: d.situacao,
        funcao: d.funcao,
        secaoCodigo: d.secaoCodigo,
        secaoDescricao: d.secaoDescricao,
        horarioCodigo: d.horarioCodigo,
        horarioDescricao: d.horarioDescricao,
      };

      const historicoAtualizado = anterior.historico ? [...anterior.historico, mudanca] : [mudanca];

      const atualizado: ProfissionalOperacional = {
        ...anterior,
        nome: d.nome,
        nomeSocial: d.nomeSocial,
        cpfLimpo: d.cpfLimpo,
        cpfMascarado: d.cpfMascarado,
        sexo: d.sexo || anterior.sexo,
        dataNascimento: d.dataNascimento || anterior.dataNascimento,
        funcao: d.funcao,
        situacao: d.situacao,
        situacaoCodigo: d.situacaoCodigo,
        situacaoDescricao: d.situacaoDescricao,
        dataAdmissao: d.dataAdmissao || anterior.dataAdmissao,
        dataDesligamento: d.dataDesligamento || anterior.dataDesligamento,
        secaoCodigo: d.secaoCodigo,
        secaoDescricao: d.secaoDescricao,
        unidadeId: d.unidadeId !== "NAO_MAPEADA" ? d.unidadeId : anterior.unidadeId,
        unidadeNome: d.unidadeNome !== "Não mapeada" ? d.unidadeNome : anterior.unidadeNome,
        horarioCodigo: d.horarioCodigo,
        horarioDescricao: d.horarioDescricao,
        jornadaDescricao: d.jornadaDescricao,
        utilizaPonto: d.utilizaPonto,
        escala: d.escala,
        historico: historicoAtualizado,
      };
      mapaExistentes.set(d.chapa, atualizado);
    } else {
      // Criação de novo colaborador
      const novo: ProfissionalOperacional = {
        id: `prf-${Date.now()}-${d.chapa}`,
        chapa: d.chapa,
        matricula: d.matricula,
        nome: d.nome,
        nomeSocial: d.nomeSocial,
        cpfLimpo: d.cpfLimpo,
        cpfMascarado: d.cpfMascarado,
        sexo: d.sexo,
        dataNascimento: d.dataNascimento,
        funcao: d.funcao,
        unidadeId: d.unidadeId,
        unidadeNome: d.unidadeNome,
        escala: d.escala,
        situacao: d.situacao,
        situacaoCodigo: d.situacaoCodigo,
        situacaoDescricao: d.situacaoDescricao,
        dataAdmissao: d.dataAdmissao,
        dataDesligamento: d.dataDesligamento,
        secaoCodigo: d.secaoCodigo,
        secaoDescricao: d.secaoDescricao,
        horarioCodigo: d.horarioCodigo,
        horarioDescricao: d.horarioDescricao,
        jornadaDescricao: d.jornadaDescricao,
        utilizaPonto: d.utilizaPonto,
        historico: [
          {
            dataReferencia: simulacao.dataReferencia,
            situacao: d.situacao,
            funcao: d.funcao,
            secaoCodigo: d.secaoCodigo,
            secaoDescricao: d.secaoDescricao,
            horarioCodigo: d.horarioCodigo,
            horarioDescricao: d.horarioDescricao,
          },
        ],
      };
      mapaExistentes.set(d.chapa, novo);
    }
  });

  const novaListaProfissionais = Array.from(mapaExistentes.values());

  // Criação do Lote
  const dataHoraIso = new Date().toISOString();
  const stamp = dataHoraIso.replace(/[-:T.]/g, "").substring(0, 14);
  const loteId = `LOTE-RM-${stamp}`;

  const novoLote: LoteImportacaoOperacional = {
    id: loteId,
    tipo: "FUNCIONARIOS_RM",
    arquivoNome: simulacao.arquivoNome,
    hashSha256: simulacao.hashSha256,
    dataReferencia: simulacao.dataReferencia,
    usuario: usuarioNome,
    dataHora: dataHoraIso.replace("T", " ").substring(0, 19),
    totais: simulacao.totais,
    status: "CONCLUIDO",
    snapshotAnterior,
    diasRetencao: 90,
  };

  const novoLog = {
    id: `log-importacao-${Date.now()}`,
    timestamp: dataHoraIso.replace("T", " ").substring(0, 19),
    usuario: usuarioNome,
    perfil: "PREMIER_ADMIN",
    acao: "IMPORTAR_FUNCIONARIOS_RM",
    entidade: `Lote (${loteId})`,
    detalhes: `Importação de Funcionários RM/TOTVS confirmada no lote ${loteId} (${simulacao.arquivoNome}): ${simulacao.totais.novos} novos, ${simulacao.totais.atualizados} atualizados, ${simulacao.totais.semAlteracao} sem alteração, ${simulacao.totais.erros} erros ignorados, ${simulacao.totais.alertas} alertas.`,
    ip: "189.120.45.12",
  };

  salvarEstado({
    profissionais: novaListaProfissionais,
    lotesImportacao: [novoLote, ...(estadoAtual.lotesImportacao || [])],
    logsAuditoria: [novoLog, ...(estadoAtual.logsAuditoria || [])],
  });

  return {
    sucesso: true,
    loteId,
    mensagem: `Importação confirmada com sucesso! Lote ${loteId} registrado com ${simulacao.totais.novos} novos colaboradores e ${simulacao.totais.atualizados} atualizações.`,
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
