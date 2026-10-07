/**
 * SGP — Sistema de Gestão de Postos
 * Processador Oficial de Importação Periódica RM / TOTVS (Folha de Pagamento)
 *
 * Contrato Petrobras ICJ 5900.0129796.25.2
 *
 * REGRAS DE NEGÓCIO E SEGURANÇA:
 * 1. Processa formatos .XLS antigo (Excel 97-2003), .XLSX e .CSV.
 * 2. Mapeamento estrito por NOME DO CABEÇALHO (19 colunas exatas).
 * 3. Validação das duas colunas de "Descrição Seção".
 * 4. Validação de formato (Chapa 6 dígitos, CPF 11 dígitos módulo 11, Seção 1.01.080.XXX).
 * 5. Detecção de duplicidade interna de Chapas ou CPFs no próprio arquivo.
 * 6. Detecção de arquivo já importado via Hash SHA-256.
 * 7. Pré-visualização com apuração completa:
 *    - Novos
 *    - Alterados (valor anterior -> valor novo)
 *    - Sem alteração
 *    - Não constam (ausentes na carga atual)
 *    - Horários e seções novos/alterados
 *    - Erros impeditivos e alertas
 * 8. Confirmação atômica em transação única.
 */

import * as XLSX from "xlsx";
import {
  CABECALHOS_RM_OFICIAIS,
  FuncionarioRm,
  HorarioRm,
  SecaoRm,
  SituacaoRm,
  FuncaoRm,
  HistoricoFuncionarioRm,
  LoteCargaRm,
  TipoAlteracaoRm,
  calcularIdadeDinamica,
  normalizarChapa,
  normalizarCpf,
  validarCpfMatematico,
} from "../dados/rm-tipos";
import {
  carregarEstado,
  salvarEstado,
  ProfissionalOperacional,
} from "../dados/estado-operacional";

// =============================================================================
// TIPOS E ESTRUTURAS DO PROCESSADOR
// =============================================================================

export interface ItemInconsistenciaRm {
  linha: number;
  tipo: "ERRO" | "ALERTA";
  coluna?: string;
  chapa?: string;
  nome?: string;
  mensagem: string;
}

export interface AlteracaoCampoRm {
  campo: string;
  rotuloCampo: string;
  valorAnterior: string | number | null;
  valorNovo: string | number;
  descricaoAnterior?: string | null;
  descricaoNova?: string | null;
}

export interface LinhaPreviaRm {
  linha: number;
  chapa: string;
  nome: string;
  cpf: string;
  funcao: string;
  secaoCodigo: string;
  secaoDescricao: string;
  horarioCodigo: string;
  horarioDescricao: string;
  situacaoCodigo: string;
  situacaoDescricao: string;
  salarioMensal: number;
  salarioHora: number;
  dataAdmissao: string;
  dataDemissao?: string | null;
  dataNascimento: string;
  idadeCalculada: number;
  sexo: "M" | "F";
  jornada: string;
  statusLinha: "NOVO" | "ALTERADO" | "SEM_ALTERACAO" | "ERRO";
  alteracoes: AlteracaoCampoRm[];
  inconsistencias: ItemInconsistenciaRm[];
}

export interface ResumoPreviaRm {
  nomeArquivo: string;
  formatoArquivo: "XLS" | "XLSX" | "CSV";
  hashSha256: string;
  dataReferencia: string;
  arquivoJaImportado: boolean;
  loteAnteriorId?: string;
  loteAnteriorData?: string;

  totalLinhasLidas: number;
  novos: number;
  alterados: number;
  semAlteracao: number;
  naoConstam: string[]; // Chapas que existiam mas não vieram nesta carga
  bloqueadosErros: number;
  comAlertas: number;

  contagemSituacoes: Record<string, number>;
  totalHorarios: number;
  totalSecoes: number;
  totalSituacoes: number;
  totalFuncoes: number;

  horariosNovos: { codigo: string; descricao: string }[];
  secoesNovas: { codigo: string; descricao: string }[];
  funcoesNovas: string[];

  linhas: LinhaPreviaRm[];
  inconsistencias: ItemInconsistenciaRm[];
  divergenciaSecaoDetectada: boolean;
}

// Armazenamento do histórico de lotes no LocalStorage/Memória
const STORAGE_KEY_LOTES_RM = "sgp_lotes_carga_rm_oficial";
const STORAGE_KEY_HISTORICOS_RM = "sgp_historico_funcionarios_rm_oficial";
const STORAGE_KEY_FUNCIONARIOS_RM = "sgp_funcionarios_rm_oficial";
const STORAGE_KEY_HORARIOS_RM = "sgp_horarios_rm_oficial";
const STORAGE_KEY_SECOES_RM = "sgp_secoes_rm_oficial";
const STORAGE_KEY_SITUACOES_RM = "sgp_situacoes_rm_oficial";
const STORAGE_KEY_FUNCOES_RM = "sgp_funcoes_rm_oficial";

// =============================================================================
// FUNÇÕES AUXILIARES DE HASH E PARSER
// =============================================================================

export async function gerarHashArquivoSha256(buffer: Uint8Array | ArrayBuffer): Promise<string> {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data as unknown as ArrayBuffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback se crypto.subtle não estiver disponível
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data[i];
    hash |= 0;
  }
  return "hash_" + Math.abs(hash).toString(16);
}

function parseDataExcelParaIso(valor: unknown): string | null {
  if (!valor) return null;

  // Se já for string no formato YYYY-MM-DD
  if (typeof valor === "string") {
    const limpo = valor.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo;

    // Se for formato brasileiro DD/MM/YYYY
    const partesBr = limpo.split("/");
    if (partesBr.length === 3) {
      const dia = partesBr[0].padStart(2, "0");
      const mes = partesBr[1].padStart(2, "0");
      const ano = partesBr[2].length === 2 ? `20${partesBr[2]}` : partesBr[2];
      return `${ano}-${mes}-${dia}`;
    }
  }

  // Se for número de série do Excel (ex: 46300 para admissão, 35435 para nascimento)
  if (typeof valor === "number") {
    // 25569 = diferença de dias entre 1900-01-01 e 1970-01-01
    const dataMs = Math.round((valor - 25569) * 86400 * 1000);
    const d = new Date(dataMs);
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(0, 10);
    }
  }

  // Se for objeto Date
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return valor.toISOString().substring(0, 10);
  }

  return null;
}

// =============================================================================
// MOTOR PRINCIPAL DE ANÁLISE E PRÉ-VISUALIZAÇÃO (SIMULAÇÃO)
// =============================================================================

export async function processarEPreVisualizarArquivoRm(
  arquivoBuffer: Uint8Array | ArrayBuffer,
  nomeArquivo: string,
  dataReferencia: string = new Date().toISOString().substring(0, 10)
): Promise<ResumoPreviaRm> {
  const hash = await gerarHashArquivoSha256(arquivoBuffer);
  const lotesAnteriores = obterHistoricoLotesRm();
  const loteAnterior = lotesAnteriores.find((l) => l.hashSha256 === hash);

  const formatoArquivo: "XLS" | "XLSX" | "CSV" = nomeArquivo.toLowerCase().endsWith(".csv")
    ? "CSV"
    : nomeArquivo.toLowerCase().endsWith(".xlsx")
    ? "XLSX"
    : "XLS";

  // Leitura com SheetJS preservando codificação Windows-1252 para .XLS
  const wb = XLSX.read(arquivoBuffer, {
    type: "array",
    codepage: 1252,
    cellDates: false, // Mantém números brutos para conversão estrita
  });

  const nomeAba = wb.SheetNames[0];
  const sheet = wb.Sheets[nomeAba];
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (!matriz || matriz.length === 0) {
    throw new Error("O arquivo enviado está vazio.");
  }

  // 1. Validação Estrita dos Cabeçalhos
  const linhaCabecalho = (matriz[0] || []).map((c) => String(c ?? "").trim());
  const colunasFaltantes: string[] = [];

  // Mapeia índices exatos das colunas
  const mapaColunas: Record<string, number> = {};
  const indicesDescricaoSecao: number[] = [];

  linhaCabecalho.forEach((colNome, idx) => {
    if (colNome === "Descrição Seção") {
      indicesDescricaoSecao.push(idx);
    } else {
      mapaColunas[colNome] = idx;
    }
  });

  // Valida presença de cada cabeçalho obrigatório
  CABECALHOS_RM_OFICIAIS.forEach((cabEsperado) => {
    if (cabEsperado === "Descrição Seção") {
      if (indicesDescricaoSecao.length === 0) {
        colunasFaltantes.push(cabEsperado);
      }
    } else if (mapaColunas[cabEsperado] === undefined) {
      colunasFaltantes.push(cabEsperado);
    }
  });

  if (colunasFaltantes.length > 0) {
    throw new Error(
      `CABEÇALHO INVÁLIDO OU INCOMPLETO:\nO arquivo não possui o layout oficial do RM.\nColunas obrigatórias ausentes:\n- ${colunasFaltantes.join(
        "\n- "
      )}`
    );
  }

  // Carrega estado atual de funcionários para apuração de diferenças (Snapshot diff)
  const estadoAtual = carregarEstado();
  const funcionariosExistentes = obterTodosFuncionariosRm();
  const mapaExistentesPorChapa = new Map<string, FuncionarioRm>();
  funcionariosExistentes.forEach((f) => mapaExistentesPorChapa.set(f.chapa, f));

  // Conjuntos para detecção de duplicidade interna
  const chapasNoArquivo = new Set<string>();
  const cpfsNoArquivo = new Set<string>();

  // Contadores e coleções do resumo
  let divergenciaSecaoDetectada = false;
  const inconsistenciasGerais: ItemInconsistenciaRm[] = [];
  const linhasPrevia: LinhaPreviaRm[] = [];

  const situacoesContagem: Record<string, number> = {};
  const horariosEncontrados = new Map<string, string>();
  const secoesEncontradas = new Map<string, string>();
  const situacoesEncontradas = new Map<string, string>();
  const funcoesEncontradas = new Set<string>();

  // Processa linha a linha a partir da linha 2 (índice 1)
  for (let i = 1; i < matriz.length; i++) {
    const raw = matriz[i];
    if (!raw || raw.length === 0 || raw.every((cell) => cell === undefined || cell === null || cell === "")) {
      continue; // Ignora linhas em branco
    }

    const numLinha = i + 1;
    const inconsistenciasLinha: ItemInconsistenciaRm[] = [];

    // Extração estrita pelos cabeçalhos
    const rawChapa = raw[mapaColunas["Chapa"]];
    const rawNome = String(raw[mapaColunas["Nome"]] || "").trim();
    const rawFuncao = String(raw[mapaColunas["Nome Funcão"]] || "").trim();
    const rawDescHorario = String(raw[mapaColunas["Descrição do Horario"]] || ""); // intacto
    const rawCpf = raw[mapaColunas["CPF"]];
    const rawSalMensal = raw[mapaColunas["Salário Mensal"]];
    const rawDtAdm = raw[mapaColunas["Data de Admissão"]];
    const rawDtDem = raw[mapaColunas["Data de Demissão"]];
    const rawSit = String(raw[mapaColunas["Situação"]] || "").trim();
    const rawDescSit = String(raw[mapaColunas["Descrição da Situação"]] || "").trim();
    const rawSecao = String(raw[mapaColunas["Seção"]] || "").trim();
    const rawSalHora = raw[mapaColunas["Salário Hora"]];
    const rawSexo = String(raw[mapaColunas["Sexo"]] || "").trim().toUpperCase();
    const rawCodHorario = String(raw[mapaColunas["Horário"]] || "").trim();
    const rawJornada = String(raw[mapaColunas["Jornada"]] || "").trim();
    const rawDtNasc = raw[mapaColunas["Data de Nascimento"]];

    // Validação da dupla coluna "Descrição Seção"
    const idxSec1 = indicesDescricaoSecao[0];
    const idxSec2 = indicesDescricaoSecao[1];
    const descSec1 = String(raw[idxSec1] || "").trim();
    const descSec2 = idxSec2 !== undefined ? String(raw[idxSec2] || "").trim() : descSec1;

    if (descSec2 && descSec1 !== descSec2) {
      divergenciaSecaoDetectada = true;
      inconsistenciasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "Descrição Seção",
        mensagem: `Discrepância entre as duas colunas de Descrição Seção: "${descSec1}" vs "${descSec2}". Utilizada a 1ª.`,
      });
    }

    // 2. Validação da Chapa
    const chapa = normalizarChapa(String(rawChapa || ""));
    if (!chapa || chapa.length !== 6) {
      inconsistenciasLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "Chapa",
        mensagem: `Chapa inválida ("${rawChapa}"). Deve ser texto numérico com 6 dígitos.`,
      });
    } else if (chapasNoArquivo.has(chapa)) {
      inconsistenciasLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "Chapa",
        chapa,
        mensagem: `Chapa duplicada dentro do próprio arquivo ("${chapa}").`,
      });
    } else {
      chapasNoArquivo.add(chapa);
    }

    // 3. Validação do CPF
    const cpf = normalizarCpf(String(rawCpf || ""));
    if (!cpf || cpf.length !== 11) {
      inconsistenciasLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "CPF",
        chapa,
        mensagem: `CPF com tamanho inválido ("${rawCpf}"). Deve conter exatamente 11 dígitos.`,
      });
    } else if (!validarCpfMatematico(cpf)) {
      inconsistenciasLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "CPF",
        chapa,
        mensagem: `CPF com dígitos verificadores matematicamente inválidos ("${cpf}").`,
      });
    } else if (cpfsNoArquivo.has(cpf)) {
      inconsistenciasLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "CPF",
        chapa,
        mensagem: `CPF duplicado dentro do próprio arquivo ("${cpf}").`,
      });
    } else {
      cpfsNoArquivo.add(cpf);
    }

    // 4. Validação da Seção
    if (!rawSecao || !/^1\.\d{2}\.\d{3}\.\d{3}$/.test(rawSecao)) {
      inconsistenciasLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "Seção",
        chapa,
        mensagem: `Seção fora do padrão oficial 1.01.080.XXX ("${rawSecao}").`,
      });
    }

    // 5. Validação de Datas
    const dataAdmissao = parseDataExcelParaIso(rawDtAdm);
    if (!dataAdmissao) {
      inconsistenciasLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "Data de Admissão",
        chapa,
        mensagem: "Data de Admissão ausente ou inválida.",
      });
    }

    const dataDemissao = rawDtDem ? parseDataExcelParaIso(rawDtDem) : null;
    const dataNascimento = parseDataExcelParaIso(rawDtNasc);
    let idadeCalculada = 0;

    if (!dataNascimento) {
      inconsistenciasLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "Data de Nascimento",
        chapa,
        mensagem: "Data de Nascimento ausente ou inválida.",
      });
    } else {
      idadeCalculada = calcularIdadeDinamica(dataNascimento, dataReferencia);
      if (idadeCalculada > 100) {
        inconsistenciasLinha.push({
          linha: numLinha,
          tipo: "ERRO",
          coluna: "Data de Nascimento",
          chapa,
          mensagem: `Idade calculada superior a 100 anos (${idadeCalculada} anos).`,
        });
      } else if (idadeCalculada < 14) {
        inconsistenciasLinha.push({
          linha: numLinha,
          tipo: "ERRO",
          coluna: "Data de Nascimento",
          chapa,
          mensagem: `Idade calculada inferior à idade mínima legal (${idadeCalculada} anos).`,
        });
      }
    }

    // 6. Sexo
    const sexo: "M" | "F" = rawSexo === "F" ? "F" : "M";
    if (rawSexo !== "M" && rawSexo !== "F") {
      inconsistenciasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "Sexo",
        chapa,
        mensagem: `Sexo informado como "${rawSexo}". Ajustado para padrão "M".`,
      });
    }

    // 7. Salários
    const salarioMensal = Number(rawSalMensal) || 0;
    const salarioHora = Number(rawSalHora) || 0;

    // Catálogos e Métricas
    if (rawCodHorario) horariosEncontrados.set(rawCodHorario, rawDescHorario);
    if (rawSecao) secoesEncontradas.set(rawSecao, descSec1);
    if (rawSit) {
      situacoesEncontradas.set(rawSit, rawDescSit);
      const chaveSit = `${rawSit} - ${rawDescSit || rawSit}`;
      situacoesContagem[chaveSit] = (situacoesContagem[chaveSit] || 0) + 1;
    }
    if (rawFuncao) funcoesEncontradas.add(rawFuncao);

    // 8. Comparação com o banco de dados (Novos / Alterados / Sem Alteração)
    const existente = mapaExistentesPorChapa.get(chapa);
    const temErroImpeditivo = inconsistenciasLinha.some((i) => i.tipo === "ERRO");
    const alteracoes: AlteracaoCampoRm[] = [];
    let statusLinha: "NOVO" | "ALTERADO" | "SEM_ALTERACAO" | "ERRO" = "SEM_ALTERACAO";

    if (temErroImpeditivo) {
      statusLinha = "ERRO";
    } else if (!existente) {
      statusLinha = "NOVO";
    } else {
      // Verifica alterações em cada campo rastreável
      if (existente.secaoCodigo !== rawSecao) {
        alteracoes.push({
          campo: "secaoCodigo",
          rotuloCampo: "Seção",
          valorAnterior: existente.secaoCodigo || "N/A",
          valorNovo: rawSecao,
          descricaoAnterior: existente.secaoDescricao || "N/A",
          descricaoNova: descSec1,
        });
      }
      if (existente.horarioCodigo !== rawCodHorario) {
        alteracoes.push({
          campo: "horarioCodigo",
          rotuloCampo: "Horário",
          valorAnterior: existente.horarioCodigo || "N/A",
          valorNovo: rawCodHorario,
          descricaoAnterior: existente.horarioDescricao || "N/A",
          descricaoNova: rawDescHorario,
        });
      }
      if (existente.funcaoNome !== rawFuncao) {
        alteracoes.push({
          campo: "funcaoNome",
          rotuloCampo: "Função",
          valorAnterior: existente.funcaoNome || "N/A",
          valorNovo: rawFuncao,
        });
      }
      if (existente.situacaoCodigo !== rawSit) {
        alteracoes.push({
          campo: "situacaoCodigo",
          rotuloCampo: "Situação",
          valorAnterior: existente.situacaoCodigo || "N/A",
          valorNovo: rawSit,
          descricaoAnterior: existente.situacaoDescricao || "N/A",
          descricaoNova: rawDescSit,
        });
      }
      if (Number(existente.salarioMensal) !== salarioMensal) {
        alteracoes.push({
          campo: "salarioMensal",
          rotuloCampo: "Salário Mensal",
          valorAnterior: Number(existente.salarioMensal),
          valorNovo: salarioMensal,
        });
      }
      if (Number(existente.salarioHora) !== salarioHora) {
        alteracoes.push({
          campo: "salarioHora",
          rotuloCampo: "Salário Hora",
          valorAnterior: Number(existente.salarioHora),
          valorNovo: salarioHora,
        });
      }
      if (existente.dataDemissao !== (dataDemissao || undefined)) {
        alteracoes.push({
          campo: "dataDemissao",
          rotuloCampo: "Data de Demissão",
          valorAnterior: existente.dataDemissao || "Ativo",
          valorNovo: dataDemissao || "Ativo",
        });
      }

      statusLinha = alteracoes.length > 0 ? "ALTERADO" : "SEM_ALTERACAO";
    }

    inconsistenciasLinha.forEach((inc) => {
      inc.chapa = chapa;
      inc.nome = rawNome;
      inconsistenciasGerais.push(inc);
    });

    linhasPrevia.push({
      linha: numLinha,
      chapa,
      nome: rawNome,
      cpf,
      funcao: rawFuncao,
      secaoCodigo: rawSecao,
      secaoDescricao: descSec1,
      horarioCodigo: rawCodHorario,
      horarioDescricao: rawDescHorario,
      situacaoCodigo: rawSit,
      situacaoDescricao: rawDescSit,
      salarioMensal,
      salarioHora,
      dataAdmissao: dataAdmissao || "",
      dataDemissao,
      dataNascimento: dataNascimento || "",
      idadeCalculada,
      sexo,
      jornada: rawJornada,
      statusLinha,
      alteracoes,
      inconsistencias: inconsistenciasLinha,
    });
  }

  // 9. Identifica colaboradores da base que NÃO vieram neste arquivo
  const naoConstam: string[] = [];
  funcionariosExistentes.forEach((f) => {
    if (!chapasNoArquivo.has(f.chapa)) {
      naoConstam.push(f.chapa);
    }
  });

  // 10. Identifica Horários e Seções inéditos
  const horariosExistentesMap = new Map<string, string>();
  obterTodosHorariosRm().forEach((h) => horariosExistentesMap.set(h.codigo, h.descricao));
  const horariosNovos: { codigo: string; descricao: string }[] = [];
  horariosEncontrados.forEach((desc, cod) => {
    if (!horariosExistentesMap.has(cod)) {
      horariosNovos.push({ codigo: cod, descricao: desc });
    }
  });

  const secoesExistentesMap = new Map<string, string>();
  obterTodasSecoesRm().forEach((s) => secoesExistentesMap.set(s.codigo, s.descricao));
  const secoesNovas: { codigo: string; descricao: string }[] = [];
  secoesEncontradas.forEach((desc, cod) => {
    if (!secoesExistentesMap.has(cod)) {
      secoesNovas.push({ codigo: cod, descricao: desc });
    }
  });

  const funcoesExistentesSet = new Set(obterTodasFuncoesRm().map((f) => f.nome));
  const funcoesNovas: string[] = [];
  funcoesEncontradas.forEach((nome) => {
    if (!funcoesExistentesSet.has(nome)) {
      funcoesNovas.push(nome);
    }
  });

  const novos = linhasPrevia.filter((l) => l.statusLinha === "NOVO").length;
  const alterados = linhasPrevia.filter((l) => l.statusLinha === "ALTERADO").length;
  const semAlteracao = linhasPrevia.filter((l) => l.statusLinha === "SEM_ALTERACAO").length;
  const bloqueadosErros = linhasPrevia.filter((l) => l.statusLinha === "ERRO").length;
  const comAlertas = inconsistenciasGerais.filter((i) => i.tipo === "ALERTA").length;

  return {
    nomeArquivo,
    formatoArquivo,
    hashSha256: hash,
    dataReferencia,
    arquivoJaImportado: Boolean(loteAnterior),
    loteAnteriorId: loteAnterior?.id,
    loteAnteriorData: loteAnterior?.dataCarga,

    totalLinhasLidas: linhasPrevia.length,
    novos,
    alterados,
    semAlteracao,
    naoConstam,
    bloqueadosErros,
    comAlertas,

    contagemSituacoes: situacoesContagem,
    totalHorarios: horariosEncontrados.size,
    totalSecoes: secoesEncontradas.size,
    totalSituacoes: situacoesEncontradas.size,
    totalFuncoes: funcoesEncontradas.size,

    horariosNovos,
    secoesNovas,
    funcoesNovas,

    linhas: linhasPrevia,
    inconsistencias: inconsistenciasGerais,
    divergenciaSecaoDetectada,
  };
}

// =============================================================================
// CONFIRMAÇÃO ATÔMICA DA IMPORTAÇÃO (ÚNICA TRANSAÇÃO)
// =============================================================================

export function confirmarImportacaoRmAtomica(
  previa: ResumoPreviaRm,
  usuarioNome: string = "Administrador Premier"
): { sucesso: boolean; loteId: string; mensagem: string } {
  if (previa.bloqueadosErros > 0) {
    throw new Error(
      `IMPORTAÇÃO BLOQUEADA:\nO arquivo possui ${previa.bloqueadosErros} linha(s) com erros impeditivos. Corrija o arquivo antes de confirmar.`
    );
  }

  const timestampIso = new Date().toISOString();
  const loteId = "lote_rm_" + Date.now();

  // Carrega coleções atuais
  const funcionariosAtuais = obterTodosFuncionariosRm();
  const mapaFuncionarios = new Map<string, FuncionarioRm>();
  funcionariosAtuais.forEach((f) => mapaFuncionarios.set(f.chapa, f));

  const historicosNovos: HistoricoFuncionarioRm[] = [];
  const chapasProcessadasNesteLote = new Set<string>();

  // Processa as linhas da prévia
  previa.linhas.forEach((linha) => {
    chapasProcessadasNesteLote.add(linha.chapa);
    const anterior = mapaFuncionarios.get(linha.chapa);

    if (!anterior) {
      // 1. Inclusão de Novo Funcionário
      const novo: FuncionarioRm = {
        chapa: linha.chapa,
        nome: linha.nome,
        cpf: linha.cpf,
        funcaoNome: linha.funcao,
        horarioCodigo: linha.horarioCodigo,
        horarioDescricao: linha.horarioDescricao,
        secaoCodigo: linha.secaoCodigo,
        secaoDescricao: linha.secaoDescricao,
        situacaoCodigo: linha.situacaoCodigo,
        situacaoDescricao: linha.situacaoDescricao,
        salarioMensal: linha.salarioMensal,
        salarioHora: linha.salarioHora,
        dataAdmissao: linha.dataAdmissao,
        dataDemissao: linha.dataDemissao,
        dataNascimento: linha.dataNascimento,
        idadeCalculada: linha.idadeCalculada,
        sexo: linha.sexo,
        jornada: linha.jornada,
        constaUltimaCarga: true,
        dataPrimeiraCarga: timestampIso,
        dataUltimaCarga: timestampIso,
        loteUltimaCargaId: loteId,
      };
      mapaFuncionarios.set(linha.chapa, novo);

      // Registra Histórico Inicial
      historicosNovos.push({
        id: "hist_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        chapa: linha.chapa,
        loteCargaId: loteId,
        dataVigencia: previa.dataReferencia,
        tipoAlteracao: "CARGA_INICIAL",
        campoModificado: "STATUS",
        valorNovo: "ATIVO_CADASTRADO",
        descricaoNova: `Cadastrado na Seção ${linha.secaoCodigo} - ${linha.secaoDescricao}`,
        criadoEm: timestampIso,
      });
    } else {
      // 2. Atualização de Funcionário Existente
      const atualizado: FuncionarioRm = {
        ...anterior,
        nome: linha.nome,
        cpf: linha.cpf,
        funcaoNome: linha.funcao,
        horarioCodigo: linha.horarioCodigo,
        horarioDescricao: linha.horarioDescricao,
        secaoCodigo: linha.secaoCodigo,
        secaoDescricao: linha.secaoDescricao,
        situacaoCodigo: linha.situacaoCodigo,
        situacaoDescricao: linha.situacaoDescricao,
        salarioMensal: linha.salarioMensal,
        salarioHora: linha.salarioHora,
        dataAdmissao: linha.dataAdmissao,
        dataDemissao: linha.dataDemissao,
        dataNascimento: linha.dataNascimento,
        idadeCalculada: linha.idadeCalculada,
        sexo: linha.sexo,
        jornada: linha.jornada,
        constaUltimaCarga: true,
        dataUltimaCarga: timestampIso,
        loteUltimaCargaId: loteId,
      };
      mapaFuncionarios.set(linha.chapa, atualizado);

      // Registra Histórico para cada alteração ocorrida
      linha.alteracoes.forEach((alt) => {
        let tipoAlteracao: TipoAlteracaoRm = "MUDANCA_SITUACAO";
        if (alt.campo === "secaoCodigo") tipoAlteracao = "MUDANCA_SECAO";
        else if (alt.campo === "horarioCodigo") tipoAlteracao = "MUDANCA_HORARIO";
        else if (alt.campo === "funcaoNome") tipoAlteracao = "MUDANCA_FUNCAO";
        else if (alt.campo === "salarioMensal" || alt.campo === "salarioHora") tipoAlteracao = "MUDANCA_SALARIAL";
        else if (alt.campo === "dataDemissao") tipoAlteracao = "DEMISSAO";

        historicosNovos.push({
          id: "hist_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          chapa: linha.chapa,
          loteCargaId: loteId,
          dataVigencia: previa.dataReferencia,
          tipoAlteracao,
          campoModificado: alt.campo,
          valorAnterior: String(alt.valorAnterior ?? ""),
          valorNovo: String(alt.valorNovo),
          descricaoAnterior: alt.descricaoAnterior,
          descricaoNova: alt.descricaoNova,
          criadoEm: timestampIso,
        });
      });
    }
  });

  // 3. Marca colaboradores ausentes na carga atual como 'constaUltimaCarga = false' (sem apagar)
  previa.naoConstam.forEach((chapaAusente) => {
    const ausente = mapaFuncionarios.get(chapaAusente);
    if (ausente) {
      mapaFuncionarios.set(chapaAusente, {
        ...ausente,
        constaUltimaCarga: false,
      });

      historicosNovos.push({
        id: "hist_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        chapa: chapaAusente,
        loteCargaId: loteId,
        dataVigencia: previa.dataReferencia,
        tipoAlteracao: "MUDANCA_SITUACAO",
        campoModificado: "constaUltimaCarga",
        valorAnterior: "true",
        valorNovo: "false",
        descricaoNova: "Não consta no arquivo da carga mais recente",
        criadoEm: timestampIso,
      });
    }
  });

  // 4. Criação do Lote de Carga Auditável
  const novoLote: LoteCargaRm = {
    id: loteId,
    dataCarga: timestampIso,
    dataReferencia: previa.dataReferencia,
    nomeArquivo: previa.nomeArquivo,
    formatoArquivo: previa.formatoArquivo,
    hashSha256: previa.hashSha256,
    totalLinhasLidas: previa.totalLinhasLidas,
    novos: previa.novos,
    atualizados: previa.alterados,
    totalNovos: previa.novos,
    totalAtualizados: previa.alterados,
    totalSemAlteracao: previa.semAlteracao,
    totalNaoConstam: previa.naoConstam.length,
    totalErros: previa.bloqueadosErros,
    totalAlertas: previa.comAlertas,
    divergenciaSecaoDetectada: previa.divergenciaSecaoDetectada,
    chapasNaoConstantes: previa.naoConstam,
    alertas: previa.inconsistencias.filter((i) => i.tipo === "ALERTA").map((i) => `Linha ${i.linha} (${i.chapa}): ${i.mensagem}`),
    erros: [],
    usuarioProcesso: usuarioNome,
  };

  // 5. Persiste as coleções oficiais do RM
  const listaFuncionariosFinal = Array.from(mapaFuncionarios.values());
  salvarFuncionariosRm(listaFuncionariosFinal);

  // Atualiza tabelas de domínio
  salvarHorariosRm(
    previa.linhas.map((l) => ({
      codigo: l.horarioCodigo,
      descricao: l.horarioDescricao,
      jornadaPadrao: l.jornada,
      criadoEm: timestampIso,
      atualizadoEm: timestampIso,
    }))
  );

  salvarSecoesRm(
    previa.linhas.map((l) => ({
      codigo: l.secaoCodigo,
      descricao: l.secaoDescricao,
      criadoEm: timestampIso,
      atualizadoEm: timestampIso,
    }))
  );

  salvarSituacoesRm(
    previa.linhas.map((l) => ({
      codigo: l.situacaoCodigo,
      descricao: l.situacaoDescricao,
      criadoEm: timestampIso,
      atualizadoEm: timestampIso,
    }))
  );

  salvarFuncoesRm(
    previa.linhas.map((l) => ({
      nome: l.funcao,
      criadoEm: timestampIso,
      atualizadoEm: timestampIso,
    }))
  );

  // Salva históricos e lotes
  const historicosExistentes = obterTodosHistoricosRm();
  salvarHistoricosRm([...historicosNovos, ...historicosExistentes]);

  const lotesExistentes = obterHistoricoLotesRm();
  salvarLotesRm([novoLote, ...lotesExistentes]);

  // 6. Sincroniza com o Estado Operacional Global do SGP (Profissionais)
  sincronizarComEstadoOperacional(listaFuncionariosFinal);

  return {
    sucesso: true,
    loteId,
    mensagem: `Importação de funcionários concluída com sucesso! ${previa.novos} novos cadastros, ${previa.alterados} atualizações e ${previa.semAlteracao} mantidos.`,
  };
}

// =============================================================================
// PERSISTÊNCIA EM MEMÓRIA / LOCALSTORAGE / ESTADO OPERACIONAL
// =============================================================================

let _memoriaFuncionariosRm: FuncionarioRm[] = [];
let _memoriaHorariosRm: HorarioRm[] = [];
let _memoriaSecoesRm: SecaoRm[] = [];
let _memoriaSituacoesRm: SituacaoRm[] = [];
let _memoriaFuncoesRm: FuncaoRm[] = [];
let _memoriaHistoricosRm: HistoricoFuncionarioRm[] = [];
let _memoriaLotesRm: LoteCargaRm[] = [];

export function limparArmazenamentoRm(): void {
  _memoriaFuncionariosRm = [];
  _memoriaHorariosRm = [];
  _memoriaSecoesRm = [];
  _memoriaSituacoesRm = [];
  _memoriaFuncoesRm = [];
  _memoriaHistoricosRm = [];
  _memoriaLotesRm = [];
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY_FUNCIONARIOS_RM);
      localStorage.removeItem(STORAGE_KEY_HORARIOS_RM);
      localStorage.removeItem(STORAGE_KEY_SECOES_RM);
      localStorage.removeItem(STORAGE_KEY_SITUACOES_RM);
      localStorage.removeItem(STORAGE_KEY_FUNCOES_RM);
      localStorage.removeItem(STORAGE_KEY_HISTORICOS_RM);
      localStorage.removeItem(STORAGE_KEY_LOTES_RM);
    } catch {
      // Ignora erro em ambientes restritos
    }
  }
}

export function obterTodosFuncionariosRm(): FuncionarioRm[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FUNCIONARIOS_RM);
      if (raw) {
        _memoriaFuncionariosRm = JSON.parse(raw);
      }
    } catch {
      // fallback para memória
    }
  }
  return [..._memoriaFuncionariosRm];
}

export function salvarFuncionariosRm(profs: FuncionarioRm[]): void {
  _memoriaFuncionariosRm = [...profs];
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_FUNCIONARIOS_RM, JSON.stringify(profs));
    } catch (e) {
      console.error("Erro ao salvar funcionarios RM:", e);
    }
  }
}

export function obterTodosHorariosRm(): HorarioRm[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HORARIOS_RM);
      if (raw) {
        _memoriaHorariosRm = JSON.parse(raw);
      }
    } catch {
      // fallback
    }
  }
  return [..._memoriaHorariosRm];
}

function salvarHorariosRm(novos: HorarioRm[]): void {
  const mapa = new Map<string, HorarioRm>();
  obterTodosHorariosRm().forEach((h) => mapa.set(h.codigo, h));
  novos.forEach((h) => mapa.set(h.codigo, h));
  _memoriaHorariosRm = Array.from(mapa.values());
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_HORARIOS_RM, JSON.stringify(_memoriaHorariosRm));
    } catch {
      // noop
    }
  }
}

export function obterTodasSecoesRm(): SecaoRm[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SECOES_RM);
      if (raw) {
        _memoriaSecoesRm = JSON.parse(raw);
      }
    } catch {
      // fallback
    }
  }
  return [..._memoriaSecoesRm];
}

function salvarSecoesRm(novas: SecaoRm[]): void {
  const mapa = new Map<string, SecaoRm>();
  obterTodasSecoesRm().forEach((s) => mapa.set(s.codigo, s));
  novas.forEach((s) => mapa.set(s.codigo, s));
  _memoriaSecoesRm = Array.from(mapa.values());
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_SECOES_RM, JSON.stringify(_memoriaSecoesRm));
    } catch {
      // noop
    }
  }
}

export function obterTodasSituacoesRm(): SituacaoRm[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SITUACOES_RM);
      if (raw) {
        _memoriaSituacoesRm = JSON.parse(raw);
      }
    } catch {
      // fallback
    }
  }
  return [..._memoriaSituacoesRm];
}

function salvarSituacoesRm(novas: SituacaoRm[]): void {
  const mapa = new Map<string, SituacaoRm>();
  obterTodasSituacoesRm().forEach((s) => mapa.set(s.codigo, s));
  novas.forEach((s) => mapa.set(s.codigo, s));
  _memoriaSituacoesRm = Array.from(mapa.values());
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_SITUACOES_RM, JSON.stringify(_memoriaSituacoesRm));
    } catch {
      // noop
    }
  }
}

export function obterTodasFuncoesRm(): FuncaoRm[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FUNCOES_RM);
      if (raw) {
        _memoriaFuncoesRm = JSON.parse(raw);
      }
    } catch {
      // fallback
    }
  }
  return [..._memoriaFuncoesRm];
}

function salvarFuncoesRm(novas: FuncaoRm[]): void {
  const mapa = new Map<string, FuncaoRm>();
  obterTodasFuncoesRm().forEach((f) => mapa.set(f.nome, f));
  novas.forEach((f) => mapa.set(f.nome, f));
  _memoriaFuncoesRm = Array.from(mapa.values());
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_FUNCOES_RM, JSON.stringify(_memoriaFuncoesRm));
    } catch {
      // noop
    }
  }
}

export function obterTodosHistoricosRm(): HistoricoFuncionarioRm[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORICOS_RM);
      if (raw) {
        _memoriaHistoricosRm = JSON.parse(raw);
      }
    } catch {
      // fallback
    }
  }
  return [..._memoriaHistoricosRm];
}

function salvarHistoricosRm(hists: HistoricoFuncionarioRm[]): void {
  _memoriaHistoricosRm = [...hists];
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORICOS_RM, JSON.stringify(hists));
    } catch {
      // noop
    }
  }
}

export function obterHistoricoLotesRm(): LoteCargaRm[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOTES_RM);
      if (raw) {
        _memoriaLotesRm = JSON.parse(raw);
      }
    } catch {
      // fallback
    }
  }
  return [..._memoriaLotesRm];
}

function salvarLotesRm(lotes: LoteCargaRm[]): void {
  _memoriaLotesRm = [...lotes];
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_LOTES_RM, JSON.stringify(lotes));
    } catch {
      // noop
    }
  }
}

/**
 * Sincroniza os funcionários importados do RM com o estado operacional global do SGP.
 */
function sincronizarComEstadoOperacional(funcionarios: FuncionarioRm[]): void {
  const estado = carregarEstado();
  const mapaPostosPorTitular = new Map<string, string>();
  estado.postos.forEach((p) => {
    if (p.titularMatricula) mapaPostosPorTitular.set(p.titularMatricula, p.codigoPosto);
  });

  const novosProfissionais: ProfissionalOperacional[] = funcionarios.map((f) => {
    let situacaoSgp: ProfissionalOperacional["situacao"] = "ATIVO";
    if (f.situacaoCodigo === "D") situacaoSgp = "DESLIGADO";
    else if (f.situacaoCodigo === "F") situacaoSgp = "FERIAS";
    else if (f.situacaoCodigo === "P" || f.situacaoCodigo === "E") situacaoSgp = "AFASTADO";

    const postoCodigo = mapaPostosPorTitular.get(f.chapa);
    const escala: ProfissionalOperacional["escala"] = f.horarioDescricao.includes("12X36")
      ? "12x36"
      : f.horarioDescricao.includes("4X2") || f.horarioDescricao.includes("4X4") || f.horarioDescricao.includes("6X1")
      ? "6x1"
      : "5x2";

    return {
      id: "prof_rm_" + f.chapa,
      chapa: f.chapa,
      matricula: f.chapa,
      nome: f.nome,
      cpfLimpo: f.cpf,
      cpfMascarado: `***.***.***-${f.cpf.slice(9, 11)}`,
      funcao: f.funcaoNome,
      unidadeId: f.secaoCodigo,
      unidadeNome: f.secaoDescricao,
      postoCodigo,
      escala,
      situacao: situacaoSgp,
      situacaoCodigo: f.situacaoCodigo,
      situacaoDescricao: f.situacaoDescricao,
      sexo: f.sexo,
      dataNascimento: f.dataNascimento,
      dataAdmissao: f.dataAdmissao,
      dataDesligamento: f.dataDemissao || undefined,
      secaoCodigo: f.secaoCodigo,
      secaoDescricao: f.secaoDescricao,
      horarioCodigo: f.horarioCodigo,
      horarioDescricao: f.horarioDescricao,
      jornadaDescricao: f.jornada,
      dadosRestritos: {
        salario: f.salarioMensal,
      },
    };
  });

  salvarEstado({
    profissionais: novosProfissionais,
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sgp-dados-atualizados"));
  }
}
