/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Motor de Importação da Lista de Alocados SIFAC (MOMENTO 2)
 *
 * Contrato Petrobras: 4600682336 | CNPJ Premier: 10.592.109/0001-19
 */

import * as XLSX from "xlsx";
import {
  carregarEstado,
  salvarEstado,
  salvarAlocadosSifac,
  salvarDivergenciasConciliacao,
  EstadoOperacionalCompleto,
  LoteImportacaoOperacional,
  LogAuditoriaOperacional,
} from "@/lib/dados/estado-operacional";
import {
  ItemAlocadoSifac,
  executarConciliacaoRmSifac,
  normalizarDataIso,
  normalizarTexto,
} from "@/lib/dados/conciliacao-sifac";
import { mascararCpf } from "@/lib/importadores/tipos";
import { ItemInconsistencia } from "@/lib/importadores/rm-funcionarios";

export const CONTRATO_SIFAC_ESPERADO = "4600682336";
export const CNPJ_PREMIER_ESPERADO = "10.592.109/0001-19";
export const CNPJ_PREMIER_LIMPO = "10592109000119";

// 5 colunas obrigatórias para identificação do tipo SIFAC na aba Modelo
export const COLUNAS_IDENTIFICACAO_SIFAC = [
  "nrocontrato",
  "cnpj",
  "datacompetenciacadastro",
  "cpf",
  "codigosituacaoempregado",
];

// Colunas estritamente permitidas (todas as outras são descartadas)
export const COLUNAS_PERMITIDAS_SIFAC = [
  "nrocontrato",
  "cnpj",
  "datacompetenciacadastro",
  "nome",
  "cpf",
  "codigogenero",
  "genero",
  "datanascimento",
  "codigosituacaoempregado",
  "datacompetenciasituacao",
  "dataadmissao",
  "datademissao",
  "dataultimasferias",
  "cargo",
  "salario",
  "codmunicipioprestacao",
  "codmunicipioprestservico",
  "municipioprestacao",
  "municipiodeprestacaodeservico",
  "codpericulosidade",
  "periculosidade",
  "codregime",
  "regime",
];

// Colunas expressamente descartadas por regra contratual e LGPD
export const COLUNAS_EXPRESSAMENTE_DESCARTADAS = [
  "codigonacionalidade",
  "nacionalidade",
  "planodesaude",
  "planodesaudeparadependentes",
  "segurodevida",
];

export interface ResultadoIdentificacaoSifac {
  reconhecido: boolean;
  tipo: "ALOCADOS_SIFAC" | "DESCONHECIDO";
  abaEncontrada: string;
  colunasEncontradas: string[];
  colunasObrigatoriasFaltando: string[];
}

export interface LinhaSifacProcessada {
  linha: number;
  validaParaGravacao: boolean;
  statusAcao: "NOVO" | "ATUALIZADO" | "SEM_ALTERACAO" | "ERRO";
  inconsistencias: ItemInconsistencia[];
  dados: ItemAlocadoSifac & {
    cpfMascarado: string;
    chapaRm?: string;
    unidadeId?: string;
    unidadeNome?: string;
    situacaoRm?: string;
  };
}

export interface ResultadoSimulacaoSifac {
  tipo: "ALOCADOS_SIFAC";
  arquivoNome: string;
  hashSha256: string;
  competencia: string; // YYYY-MM
  dataReferencia: string; // YYYY-MM-DD
  arquivoDuplicado: boolean;
  substituiLoteAnterior: boolean;
  loteAnteriorId?: string;
  loteAnteriorData?: string;
  erroBloqueanteArquivo?: string;
  totais: {
    lidos: number;
    novos: number;
    atualizados: number;
    semAlteracao: number;
    erros: number;
    alertas: number;
  };
  linhas: LinhaSifacProcessada[];
  inconsistencias: ItemInconsistencia[];
}

async function calcularHashSha256(buffer: Uint8Array | ArrayBuffer): Promise<string> {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data as unknown as ArrayBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  for (let i = 0; i < data.length; i++) {
    h = (Math.imul(31, h) + data[i]) | 0;
  }
  return `fallback-hash-${Math.abs(h).toString(16)}`;
}

/**
 * Normaliza nome de cabeçalho para comparação
 */
function normalizarNomeCabecalho(col: string): string {
  return col
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Identifica se a planilha é do tipo ALOCADOS SIFAC inspecionando a aba "Modelo"
 */
export function identificarArquivoSifac(
  cabecalhosBrutos: string[],
  abaNome: string = "Modelo"
): ResultadoIdentificacaoSifac {
  const normalizados = cabecalhosBrutos.map(normalizarNomeCabecalho);

  const faltando: string[] = [];
  for (const col of COLUNAS_IDENTIFICACAO_SIFAC) {
    const achou = normalizados.some((c) => c === col || c.includes(col));
    if (!achou) faltando.push(col);
  }

  const ehModeloOuPrimeira = abaNome === "Modelo" || abaNome.toLowerCase().includes("modelo");

  if (faltando.length === 0) {
    return {
      reconhecido: true,
      tipo: "ALOCADOS_SIFAC",
      abaEncontrada: abaNome,
      colunasEncontradas: cabecalhosBrutos,
      colunasObrigatoriasFaltando: [],
    };
  }

  return {
    reconhecido: false,
    tipo: "DESCONHECIDO",
    abaEncontrada: abaNome,
    colunasEncontradas: cabecalhosBrutos,
    colunasObrigatoriasFaltando: faltando,
  };
}

/**
 * Extrai competência YYYY-MM a partir de uma data serial Excel, Date ou string
 */
function extrairCompetencia(valor: unknown, fallback: string = "2026-08"): { competencia: string; dataCompleta: string } {
  const iso = normalizarDataIso(valor as string | Date);
  if (iso) {
    return {
      competencia: iso.substring(0, 7),
      dataCompleta: iso,
    };
  }
  return {
    competencia: fallback.substring(0, 7),
    dataCompleta: fallback.length === 7 ? `${fallback}-01` : fallback,
  };
}

/**
 * Simula a importação do arquivo SIFAC, executando validações estritas de cabeçalho,
 * dados bloqueantes (contrato e CNPJ), descarte de colunas e regras de negócio.
 */
export async function simularImportacaoSifac(
  buffer: Uint8Array | ArrayBuffer,
  arquivoNome: string,
  dataReferenciaManual: string,
  estadoCustom?: EstadoOperacionalCompleto
): Promise<ResultadoSimulacaoSifac> {
  const estado = estadoCustom || carregarEstado();
  const hash = await calcularHashSha256(buffer);

  // 1. Leitura do Workbook
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  // Exigência: Aba "Modelo" é a única importada como dados (outras abas são apenas tabelas de códigos de referência)
  const sheetName =
    workbook.SheetNames.find((s) => s.trim().toLowerCase() === "modelo") ||
    (workbook.SheetNames.length === 1 ? workbook.SheetNames[0] : null);

  if (!sheetName) {
    throw new Error(
      "A aba 'Modelo' não foi localizada no arquivo SIFAC. Apenas a aba 'Modelo' é aceita para importação de dados dos alocados."
    );
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });

  if (!rawRows || rawRows.length < 2) {
    throw new Error("A aba 'Modelo' da planilha SIFAC não contém dados suficientes.");
  }

  const cabecalhosOriginais = (rawRows[0] as string[]).map((c) => String(c || "").trim());

  // Mapeamento de colunas permitidas e detecção de índices
  const mapaColunasIndices = new Map<string, number>();
  cabecalhosOriginais.forEach((col, idx) => {
    const norm = normalizarNomeCabecalho(col);
    mapaColunasIndices.set(norm, idx);
  });

  // Localiza índice de colunas-chave (prioriza correspondência exata)
  const getIdx = (possiveisNomes: string[]): number => {
    for (const nome of possiveisNomes) {
      const norm = normalizarNomeCabecalho(nome);
      if (mapaColunasIndices.has(norm)) return mapaColunasIndices.get(norm)!;
    }
    for (const nome of possiveisNomes) {
      const norm = normalizarNomeCabecalho(nome);
      for (const [key, idx] of mapaColunasIndices.entries()) {
        if (key.includes(norm)) return idx;
      }
    }
    return -1;
  };

  const idxContrato = getIdx(["NroContrato", "nrocontrato"]);
  const idxCnpj = getIdx(["Cnpj", "cnpj"]);
  const idxComp = getIdx(["DataCompetenciaCadastro", "competenciacadastro"]);
  const idxNome = getIdx(["Nome", "nome"]);
  const idxCpf = getIdx(["Cpf", "cpf"]);
  const idxCodGen = getIdx(["CodigoGenero", "codigogenero"]);
  const idxGen = getIdx(["Genero", "genero"]);
  const idxNasc = getIdx(["DataNascimento", "datanascimento"]);
  const idxCodSit = getIdx(["CodigoSituacaoEmpregado", "codigosituacaoempregado"]);
  const idxCompSit = getIdx(["DataCompetenciaSituacao", "competenciasituacao"]);
  const idxAdm = getIdx(["DataAdmissao", "dataadmissao"]);
  const idxDem = getIdx(["DataDemissao", "datademissao"]);
  const idxFer = getIdx(["DataUltimasFerias", "ultimasferias"]);
  const idxCargo = getIdx(["Cargo", "cargo"]);
  const idxSalario = getIdx(["Salario", "salario"]);
  const idxCodMun = getIdx(["Cód. Municipio Prestação", "codmunicipioprestservico", "codmunicipio"]);
  const idxMun = getIdx(["Município de Prestação", "municipiodeprestacaodeservico", "municipio"]);
  const idxCodPeric = getIdx(["Cód. Periculosidade", "codpericulosidade"]);
  const idxPeric = getIdx(["Periculosidade", "periculosidade"]);
  const idxCodRegime = getIdx(["Cód. Regime", "codregime"]);
  const idxRegime = getIdx(["Regime", "regime"]);

  // Coleta dados das linhas
  const linhasRaw: unknown[][] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length === 0 || r.every((c) => c === "" || c === null || c === undefined)) continue;
    linhasRaw.push(r);
  }

  // Descobre a competência a partir da primeira linha válida com DataCompetenciaCadastro
  let competenciaLote = dataReferenciaManual.substring(0, 7) || "2026-08";
  let dataReferenciaArquivo = dataReferenciaManual;

  for (const r of linhasRaw) {
    if (idxComp !== -1 && r[idxComp]) {
      const extraida = extrairCompetencia(r[idxComp], dataReferenciaManual);
      competenciaLote = extraida.competencia;
      dataReferenciaArquivo = extraida.dataCompleta;
      break;
    }
  }

  // Verifica lote anterior
  const loteMesmoHash = (estado.lotesImportacao || []).find(
    (l) => l.hashSha256 === hash && l.status === "CONCLUIDO"
  );
  const arquivoDuplicado = !!loteMesmoHash;

  // Verifica se já existe lote ativo para a mesma competência (regra de substituição)
  const loteMesmaCompetencia = (estado.lotesImportacao || []).find(
    (l) =>
      l.tipo === "ALOCADOS_SIFAC" &&
      l.status === "CONCLUIDO" &&
      (l.dataReferencia || "").startsWith(competenciaLote)
  );
  const substituiLoteAnterior = !!loteMesmaCompetencia;

  const mapaRmPorCpf = new Map<string, any>();
  estado.profissionais.forEach((p) => mapaRmPorCpf.set(p.cpfLimpo.padStart(11, "0"), p));

  const todasInconsistencias: ItemInconsistencia[] = [];
  const linhasProcessadas: LinhaSifacProcessada[] = [];

  let countNovos = 0;
  let countErros = 0;
  let countAlertas = 0;
  let erroBloqueanteArquivo: string | undefined = undefined;

  // Itera sobre as linhas para validar
  linhasRaw.forEach((row, idx) => {
    const numLinha = idx + 2;
    const errosLinha: ItemInconsistencia[] = [];
    const alertasLinha: ItemInconsistencia[] = [];

    // Extração segura dos valores
    const getVal = (i: number): string => (i !== -1 && row[i] !== undefined ? String(row[i]).trim() : "");
    const getNum = (i: number): number | undefined => {
      if (i === -1 || row[i] === undefined || row[i] === "") return undefined;
      const n = Number(row[i]);
      return isNaN(n) ? undefined : n;
    };

    const contrato = getVal(idxContrato);
    const cnpj = getVal(idxCnpj);
    const rawCpf = getVal(idxCpf);
    const nome = getVal(idxNome);
    const codGen = getNum(idxCodGen);
    const genTexto = getVal(idxGen);
    const rawNasc = idxNasc !== -1 ? row[idxNasc] : undefined;
    const codSit = getNum(idxCodSit) ?? 1;
    const rawCompSit = idxCompSit !== -1 ? row[idxCompSit] : undefined;
    const rawAdm = idxAdm !== -1 ? row[idxAdm] : undefined;
    const rawDem = idxDem !== -1 ? row[idxDem] : undefined;
    const rawFer = idxFer !== -1 ? row[idxFer] : undefined;
    const cargo = getVal(idxCargo);
    const salario = getNum(idxSalario);
    const codMun = getVal(idxCodMun);
    const mun = getVal(idxMun);
    const codPeric = getNum(idxCodPeric);
    const peric = getVal(idxPeric);
    const codReg = getNum(idxCodRegime);
    const reg = getVal(idxRegime);

    // -------------------------------------------------------------------------
    // 1. VALIDAÇÃO BLOQUEANTE: CONTRATO (4600682336) E CNPJ DA PREMIER
    // -------------------------------------------------------------------------
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    const contratoValido = contrato === CONTRATO_SIFAC_ESPERADO || contrato.includes(CONTRATO_SIFAC_ESPERADO);
    const cnpjValido =
      !cnpj ||
      cnpj === CNPJ_PREMIER_ESPERADO ||
      cnpjLimpo === CNPJ_PREMIER_LIMPO ||
      cnpj.includes("10.592.109/0001-19");

    if (contrato && !contratoValido) {
      errosLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "NroContrato",
        mensagem: `Contrato '${contrato}' não corresponde ao contrato homologado (${CONTRATO_SIFAC_ESPERADO}). Erro bloqueante no arquivo.`,
      });
      erroBloqueanteArquivo = `O arquivo contém contrato divergente (${contrato} vs ${CONTRATO_SIFAC_ESPERADO}). Gravação bloqueada.`;
    }

    if (cnpj && !cnpjValido) {
      errosLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "Cnpj",
        mensagem: `CNPJ '${cnpj}' não corresponde ao da Premier Logistics (${CNPJ_PREMIER_ESPERADO}). Erro bloqueante no arquivo.`,
      });
      erroBloqueanteArquivo = `O arquivo contém CNPJ divergente (${cnpj} vs ${CNPJ_PREMIER_ESPERADO}). Gravação bloqueada.`;
    }

    // -------------------------------------------------------------------------
    // 2. VALIDAÇÃO DO CPF (Normalizado para 11 dígitos com zero à esquerda)
    // -------------------------------------------------------------------------
    const cpfLimpo = rawCpf.replace(/\D/g, "").padStart(11, "0");
    if (!rawCpf || cpfLimpo.length !== 11 || cpfLimpo === "00000000000") {
      errosLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "Cpf",
        mensagem: `CPF inválido ou não preenchido: "${rawCpf}".`,
      });
    }

    // -------------------------------------------------------------------------
    // 3. TABELA DE SITUAÇÕES SIFAC (1 a 6)
    // -------------------------------------------------------------------------
    const situacoesValidasSifac = [1, 2, 3, 4, 5, 6];
    if (codSit && !situacoesValidasSifac.includes(codSit)) {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "CodigoSituacaoEmpregado",
        mensagem: `Código de situação SIFAC '${codSit}' fora da tabela homologada (1..6).`,
      });
    }

    // -------------------------------------------------------------------------
    // 4. TABELA DE GÊNERO SIFAC (1 Feminino, 2 Masculino) & COERÊNCIA
    // -------------------------------------------------------------------------
    if (codGen !== undefined && codGen !== 1 && codGen !== 2) {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "CodigoGenero",
        mensagem: `Código de gênero SIFAC '${codGen}' fora da tabela homologada (1 Feminino, 2 Masculino).`,
      });
    }

    // Incoerência entre CodigoGenero e texto Genero
    if (codGen !== undefined && genTexto) {
      const genNorm = normalizarTexto(genTexto);
      const ehFem = genNorm.includes("fem") || genNorm === "f";
      const ehMasc = genNorm.includes("masc") || genNorm === "m";

      if ((codGen === 1 && ehMasc) || (codGen === 2 && ehFem)) {
        alertasLinha.push({
          linha: numLinha,
          tipo: "ALERTA",
          coluna: "CodigoGenero",
          mensagem: `Incoerência entre Código de Gênero (${codGen}) e Descrição ("${genTexto}") na mesma linha.`,
        });
      }
    }

    // -------------------------------------------------------------------------
    // 5. DATA DE NASCIMENTO (Campo obrigatório no SIFAC)
    // -------------------------------------------------------------------------
    const dataNascIso = normalizarDataIso(rawNasc as string | Date);
    if (!dataNascIso) {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "DataNascimento",
        mensagem: "Data de nascimento não informada (campo obrigatório no SIFAC).",
      });
    }

    // -------------------------------------------------------------------------
    // Cruzamento informativo preliminar com cadastro RM
    // -------------------------------------------------------------------------
    const funcRm = mapaRmPorCpf.get(cpfLimpo);
    if (!funcRm) {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "Cpf",
        mensagem: `Colaborador ${nome || "sem nome"} (CPF ${mascararCpf(cpfLimpo)}) não localizado no cadastro do RM.`,
      });
    }

    const temErro = errosLinha.length > 0;
    const temAlerta = alertasLinha.length > 0;
    if (temErro) countErros++;
    else countNovos++;
    countAlertas += alertasLinha.length;

    const inconsistenciasLinha = [...errosLinha, ...alertasLinha];
    todasInconsistencias.push(...inconsistenciasLinha);

    linhasProcessadas.push({
      linha: numLinha,
      validaParaGravacao: !temErro,
      statusAcao: temErro ? "ERRO" : "NOVO",
      inconsistencias: inconsistenciasLinha,
      dados: {
        id: `sifac-${competenciaLote}-${cpfLimpo}`,
        numeroContrato: contrato || CONTRATO_SIFAC_ESPERADO,
        cnpj: cnpj || CNPJ_PREMIER_ESPERADO,
        dataCompetenciaCadastro: competenciaLote,
        dataCompetencia: dataReferenciaArquivo,
        nome: nome || funcRm?.nome || "COLABORADOR",
        cpfLimpo,
        cpfMascarado: mascararCpf(cpfLimpo),
        codigoGenero: codGen,
        generoDescricao: genTexto || (codGen === 1 ? "Feminino" : codGen === 2 ? "Masculino" : undefined),
        dataNascimento: dataNascIso || undefined,
        codigoSituacaoEmpregado: codSit,
        dataCompetenciaSituacao: normalizarDataIso(rawCompSit as string | Date) || undefined,
        dataAdmissao: normalizarDataIso(rawAdm as string | Date) || undefined,
        dataDemissao: normalizarDataIso(rawDem as string | Date) || undefined,
        dataUltimasFerias: normalizarDataIso(rawFer as string | Date) || undefined,
        cargo: cargo || funcRm?.funcao || "FUNÇÃO NÃO INFORMADA",
        salario: salario !== undefined ? salario : funcRm?.dadosRestritos?.salario,
        codigoMunicipioPrestacao: codMun,
        municipioPrestacao: mun || funcRm?.unidadeNome || "Três Lagoas",
        codigoPericulosidade: codPeric,
        periculosidade: peric,
        codigoRegime: codReg,
        regime: reg || "OnShore",
        chapaRm: funcRm?.chapa,
        unidadeId: funcRm?.unidadeId,
        unidadeNome: funcRm?.unidadeNome,
        situacaoRm: funcRm?.situacao,
      },
    });
  });

  return {
    tipo: "ALOCADOS_SIFAC",
    arquivoNome,
    hashSha256: hash,
    competencia: competenciaLote,
    dataReferencia: dataReferenciaArquivo,
    arquivoDuplicado,
    substituiLoteAnterior,
    loteAnteriorId: loteMesmaCompetencia?.id || loteMesmoHash?.id,
    loteAnteriorData: loteMesmaCompetencia?.dataHora || loteMesmoHash?.dataHora,
    erroBloqueanteArquivo,
    totais: {
      lidos: linhasRaw.length,
      novos: countNovos,
      atualizados: 0,
      semAlteracao: 0,
      erros: countErros,
      alertas: countAlertas,
    },
    linhas: linhasProcessadas,
    inconsistencias: todasInconsistencias,
  };
}

/**
 * Confirma a gravação do lote de alocados SIFAC:
 * - Grava os dados na tabela própria segregada (alocadosSifac).
 * - Se já existia lote ativo para a mesma competência, substitui o lote anterior.
 * - Dispara a conciliação automática com o RM salvando as divergências.
 * - Registra log de auditoria detalhado.
 */
export function confirmarImportacaoSifac(
  simulacao: ResultadoSimulacaoSifac,
  usuarioNome: string = "Administrador Premier (Marcos Valério)"
): { sucesso: boolean; loteId: string; mensagem: string } {
  const estadoAtual = carregarEstado();

  if (simulacao.erroBloqueanteArquivo) {
    throw new Error(`Importação bloqueada: ${simulacao.erroBloqueanteArquivo}`);
  }

  const snapshotAnterior: EstadoOperacionalCompleto = {
    profissionais: [...(estadoAtual.profissionais || [])],
    ocorrencias: [...(estadoAtual.ocorrencias || [])],
    coberturas: [...(estadoAtual.coberturas || [])],
    alocadosSifac: [...(estadoAtual.alocadosSifac || [])],
  } as any;
  const loteId = `LOTE-SIFAC-${Date.now()}`;
  const dataHoraAtual = new Date().toISOString().replace("T", " ").substring(0, 19);

  // Extrai os itens válidos para gravação
  const novosAlocados: ItemAlocadoSifac[] = simulacao.linhas
    .filter((l) => l.validaParaGravacao)
    .map((l) => ({
      id: l.dados.id,
      numeroContrato: l.dados.numeroContrato,
      cnpj: l.dados.cnpj,
      dataCompetenciaCadastro: l.dados.dataCompetenciaCadastro,
      dataCompetencia: l.dados.dataCompetencia,
      nome: l.dados.nome,
      cpfLimpo: l.dados.cpfLimpo,
      cpfMascarado: l.dados.cpfMascarado,
      codigoGenero: l.dados.codigoGenero,
      generoDescricao: l.dados.generoDescricao,
      dataNascimento: l.dados.dataNascimento,
      codigoSituacaoEmpregado: l.dados.codigoSituacaoEmpregado,
      dataCompetenciaSituacao: l.dados.dataCompetenciaSituacao,
      dataAdmissao: l.dados.dataAdmissao,
      dataDemissao: l.dados.dataDemissao,
      dataUltimasFerias: l.dados.dataUltimasFerias,
      cargo: l.dados.cargo,
      salario: l.dados.salario,
      codigoMunicipioPrestacao: l.dados.codigoMunicipioPrestacao,
      municipioPrestacao: l.dados.municipioPrestacao,
      codigoPericulosidade: l.dados.codigoPericulosidade,
      periculosidade: l.dados.periculosidade,
      codigoRegime: l.dados.codigoRegime,
      regime: l.dados.regime,
    }));

  // Salva no estado isolado por competência (substitui anterior caso exista)
  const resultadoSalvar = salvarAlocadosSifac(
    novosAlocados,
    simulacao.competencia,
    true // sempre substitui lote anterior da mesma competência com confirmação
  );

  // Atualiza lotes de importação: se já havia um lote ativo da mesma competência, marca como DESFEITO/SUBSTITUIDO
  const lotesAtualizados = (estadoAtual.lotesImportacao || []).map((l) => {
    if (
      l.tipo === "ALOCADOS_SIFAC" &&
      l.status === "CONCLUIDO" &&
      (l.dataReferencia || "").startsWith(simulacao.competencia)
    ) {
      return { ...l, status: "DESFEITO" as const };
    }
    return l;
  });

  const novoLote: LoteImportacaoOperacional = {
    id: loteId,
    tipo: "ALOCADOS_SIFAC",
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

  const detalheSubstituicao = resultadoSalvar.substituiuAnterior
    ? `Substituído lote anterior da competência ${simulacao.competencia}. `
    : "";

  const novoLog: LogAuditoriaOperacional = {
    id: `log-${Date.now()}`,
    timestamp: dataHoraAtual,
    usuario: usuarioNome,
    perfil: "PREMIER_ADMIN",
    acao: "IMPORTACAO_ALOCADOS_SIFAC",
    entidade: `Lote (${loteId})`,
    detalhes: `${detalheSubstituicao}Importação da Lista de Alocados SIFAC confirmada: ${novosAlocados.length} colaboradores gravados para a competência ${simulacao.competencia} (Contrato ${CONTRATO_SIFAC_ESPERADO}).`,
    ip: "189.120.45.12",
  };

  salvarEstado({
    lotesImportacao: [novoLote, ...lotesAtualizados],
    logsAuditoria: [novoLog, ...estadoAtual.logsAuditoria],
  });

  // Executa automaticamente o motor de conciliação para essa competência
  try {
    const estadoAtualizado = carregarEstado();
    const divergenciasAnteriores = estadoAtualizado.divergenciasConciliacao?.[simulacao.competencia] || [];
    const conc = executarConciliacaoRmSifac(
      simulacao.competencia,
      estadoAtualizado.profissionais,
      novosAlocados,
      estadoAtualizado.equivalenciasConciliacao,
      divergenciasAnteriores,
      "2026-09-17", // data referência RM
      simulacao.dataReferencia // data referência SIFAC
    );
    salvarDivergenciasConciliacao(simulacao.competencia, conc.divergencias);
  } catch (err) {
    console.error("Erro ao executar conciliação pós-importação:", err);
  }

  return {
    sucesso: true,
    loteId,
    mensagem: `Importação SIFAC confirmada com sucesso! Lote ${loteId} gravado com ${novosAlocados.length} alocados na competência ${simulacao.competencia}.${resultadoSalvar.substituiuAnterior ? " (Lote anterior da competência foi substituído)" : ""}`,
  };
}
