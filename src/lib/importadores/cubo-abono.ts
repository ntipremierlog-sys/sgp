/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Motor de Importação de Ocorrências e Abonos — Cubo de Abono RM (MOMENTO 3)
 */

import * as XLSX from "xlsx";
import {
  carregarEstado,
  salvarEstado,
  EstadoOperacionalCompleto,
  LoteImportacaoOperacional,
  LogAuditoriaOperacional,
  OcorrenciaOperacional,
} from "@/lib/dados/estado-operacional";
import { ItemInconsistencia } from "@/lib/importadores/rm-funcionarios";

export const COLUNAS_OBRIGATORIAS_ABONO = [
  "chapa",
  "data",
  "descricao abono",
];

export interface ResultadoIdentificacaoAbono {
  reconhecido: boolean;
  tipo: "ABONO_RM" | "DESCONHECIDO";
  colunasEncontradas: string[];
  colunasObrigatoriasFaltando: string[];
}

export interface LinhaAbonoProcessada {
  linha: number;
  validaParaGravacao: boolean;
  statusAcao: "NOVO" | "ATUALIZADO" | "SEM_ALTERACAO" | "ERRO";
  inconsistencias: ItemInconsistencia[];
  dados: {
    chapa: string;
    nomeFuncionario: string;
    secaoCodigo: string;
    secaoDescricao: string;
    data: string;
    diaSemana: string;
    descricaoAbono: string;
    tipoOcorrencia: OcorrenciaOperacional["tipoOcorrencia"];
    postoCodigo?: string;
  };
}

export interface ResultadoSimulacaoAbono {
  tipo: "ABONO_RM";
  arquivoNome: string;
  hashSha256: string;
  dataReferencia: string;
  arquivoDuplicado: boolean;
  loteAnteriorId?: string;
  loteAnteriorData?: string;
  totais: {
    lidos: number;
    novos: number;
    atualizados: number;
    semAlteracao: number;
    erros: number;
    alertas: number;
  };
  linhas: LinhaAbonoProcessada[];
  inconsistencias: ItemInconsistencia[];
}

export async function calcularHashSha256(buffer: Uint8Array | ArrayBuffer): Promise<string> {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    try {
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data as unknown as ArrayBuffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // fallback
    }
  }

  // Suporte a Node.js (testes e scripts)
  try {
    const nodeCrypto = await import("crypto");
    if (nodeCrypto.createHash) {
      return nodeCrypto.createHash("sha256").update(Buffer.from(data)).digest("hex");
    }
  } catch {
    // fallback
  }

  // Fallback rápido
  let h = 0;
  for (let i = 0; i < data.length; i++) {
    h = (Math.imul(31, h) + data[i]) | 0;
  }
  return `hash-abono-${Math.abs(h).toString(16).padStart(16, "0")}`;
}

export function identificarArquivoAbono(cabecalhosBrutos: string[]): ResultadoIdentificacaoAbono {
  const normalizados = cabecalhosBrutos.map((c) =>
    c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
  );

  const faltando: string[] = [];
  for (const col of COLUNAS_OBRIGATORIAS_ABONO) {
    const colNorm = col.toLowerCase().replace(/[^a-z0-9]/g, "");
    const achou = normalizados.some((c) => c.includes(colNorm));
    if (!achou) faltando.push(col);
  }

  if (faltando.length === 0) {
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
    colunasObrigatoriasFaltando: faltando,
  };
}

export async function simularImportacaoAbono(
  buffer: Uint8Array | ArrayBuffer,
  arquivoNome: string,
  dataReferencia: string,
  estadoCustom?: EstadoOperacionalCompleto
): Promise<ResultadoSimulacaoAbono> {
  const estado = estadoCustom || carregarEstado();
  const hash = await calcularHashSha256(buffer);

  const loteExistente = (estado.lotesImportacao || []).find(
    (l) => l.hashSha256 === hash && l.status === "CONCLUIDO"
  );
  const arquivoDuplicado = !!loteExistente;

  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const dados = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });

  if (!dados || dados.length < 2) {
    throw new Error("Planilha de Cubo de Abono não contém dados suficientes.");
  }

  const cabecalhos = (dados[0] as string[]).map((c) => String(c || "").trim());
  const linhasRaw: Record<string, unknown>[] = [];
  for (let i = 1; i < dados.length; i++) {
    const row = dados[i] as unknown[];
    if (!row || row.length === 0 || row.every((c) => c === "" || c === null || c === undefined)) continue;
    const obj: Record<string, unknown> = {};
    cabecalhos.forEach((col, idx) => {
      obj[col] = row[idx] !== undefined ? row[idx] : "";
    });
    linhasRaw.push(obj);
  }

  const mapaRmPorChapa = new Map<string, any>();
  estado.profissionais.forEach((p) => mapaRmPorChapa.set(p.chapa, p));

  const mapaPostoPorTitular = new Map<string, any>();
  estado.postos.forEach((p) => {
    if (p.titularMatricula) {
      mapaPostoPorTitular.set(p.titularMatricula, p);
    }
  });

  const todasInconsistencias: ItemInconsistencia[] = [];
  const linhasProcessadas: LinhaAbonoProcessada[] = [];

  let countNovos = 0;
  let countErros = 0;
  let countAlertas = 0;

  linhasRaw.forEach((row, idx) => {
    const numLinha = idx + 2;
    const errosLinha: ItemInconsistencia[] = [];
    const alertasLinha: ItemInconsistencia[] = [];

    const rawChapa = String(row["CHAPA"] || "").trim();
    const nome = String(row["NOME_FUNCIONARIO"] || "").trim();
    const secaoCod = String(row["COD.SECÃO"] || row["COD.SEÇÃO"] || "").trim();
    const secaoDesc = String(row["DESC. SECAO"] || row["DESC. SEÇÃO"] || "").trim();
    const rawData = String(row["DATA"] || "").trim();
    const diaSemana = String(row["DIA SEMANA"] || "").trim();
    const descAbono = String(row["DESCRICAO ABONO"] || "OUTROS").trim().toUpperCase();

    // 1. Chapa
    const chapa = rawChapa.replace(/\D/g, "").padStart(6, "0");
    if (!chapa || chapa === "000000") {
      errosLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "CHAPA",
        mensagem: "Chapa não informada ou inválida.",
      });
    }

    // 2. Data
    let dataIso = "";
    if (rawData.includes("/")) {
      const p = rawData.split("/");
      dataIso = `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
    } else {
      dataIso = rawData;
    }

    if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
      errosLinha.push({
        linha: numLinha,
        tipo: "ERRO",
        coluna: "DATA",
        mensagem: `Data inválida: "${rawData}".`,
      });
    }

    // Match com RM (somente se chapa for informada)
    const funcRm = chapa && chapa !== "000000" ? mapaRmPorChapa.get(chapa) : undefined;
    if (chapa && chapa !== "000000" && !funcRm) {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "CHAPA",
        mensagem: `Colaborador com chapa ${chapa} (${nome}) não encontrado no cadastro do RM.`,
      });
    }

    // Identificar posto associado caso o colaborador seja titular
    const postoDoTitular = mapaPostoPorTitular.get(chapa);
    const postoCodigo = funcRm?.postoCodigo || postoDoTitular?.codigoPosto || undefined;

    // Categorização dos 6 tipos reais de abono/atestado
    let tipoOcorrencia: OcorrenciaOperacional["tipoOcorrencia"] = "OUTROS";
    if (descAbono.includes("ATESTADO MEDICO")) {
      tipoOcorrencia = "ATESTADO_MEDICO";
    } else if (descAbono.includes("ABONADO")) {
      tipoOcorrencia = "ABONO_LEGAL";
    } else if (descAbono.includes("COMPARECIMENTO") || descAbono.includes("ACOMPANHAMENTO")) {
      tipoOcorrencia = "FALTA_JUSTIFICADA";
    } else if (descAbono.includes("SANGUE") || descAbono.includes("ELEITORAL")) {
      tipoOcorrencia = "ABONO_LEGAL";
    } else if (descAbono.includes("FERIAS")) {
      tipoOcorrencia = "FERIAS";
    }

    const temErro = errosLinha.length > 0;
    const temAlerta = alertasLinha.length > 0;
    if (temErro) countErros++;
    else countNovos++;
    if (temAlerta) countAlertas++;

    const inconsistenciasLinha = [...errosLinha, ...alertasLinha];
    todasInconsistencias.push(...inconsistenciasLinha);

    linhasProcessadas.push({
      linha: numLinha,
      validaParaGravacao: !temErro,
      statusAcao: temErro ? "ERRO" : "NOVO",
      inconsistencias: inconsistenciasLinha,
      dados: {
        chapa,
        nomeFuncionario: nome || funcRm?.nome || `Colaborador ${chapa}`,
        secaoCodigo: secaoCod,
        secaoDescricao: secaoDesc,
        data: dataIso,
        diaSemana,
        descricaoAbono: descAbono,
        tipoOcorrencia,
        postoCodigo,
      },
    });
  });

  return {
    tipo: "ABONO_RM",
    arquivoNome,
    hashSha256: hash,
    dataReferencia,
    arquivoDuplicado,
    loteAnteriorId: loteExistente?.id,
    loteAnteriorData: loteExistente?.dataHora,
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

export function confirmarImportacaoAbono(
  simulacao: ResultadoSimulacaoAbono,
  usuarioNome: string = "Administrador Premier (Marcos Valério)"
): { sucesso: boolean; loteId: string; mensagem: string } {
  const estadoAtual = carregarEstado();

  if (simulacao.arquivoDuplicado) {
    throw new Error(`Este arquivo já foi importado no lote ${simulacao.loteAnteriorId}.`);
  }

  const snapshotAnterior: EstadoOperacionalCompleto = JSON.parse(JSON.stringify(estadoAtual));
  const dataHoraAtual = new Date().toISOString().replace("T", " ").substring(0, 19);
  const stamp = dataHoraAtual.replace(/[-: ]/g, "").substring(0, 14);
  const loteId = `LOTE-ABONO-${stamp}`;

  const novasOcorrencias: OcorrenciaOperacional[] = simulacao.linhas
    .filter((l) => l.validaParaGravacao)
    .map((l, idx) => ({
      id: `oco-${Date.now()}-${idx + 1}`,
      matricula: l.dados.chapa,
      profissionalNome: l.dados.nomeFuncionario,
      postoCodigo: l.dados.postoCodigo,
      tipoOcorrencia: l.dados.tipoOcorrencia,
      dataInicio: l.dados.data,
      dataFim: l.dados.data,
      diasAfetados: 1,
      status: "VALIDADA" as const,
      observacaoPublica: `Abono/Ocorrência: ${l.dados.descricaoAbono} (${l.dados.diaSemana || ""}) - ${l.dados.secaoDescricao || ""}`,
      criadoEm: dataHoraAtual,
    }));

  // Deduplicação: substitui ocorrência prévia da mesma matrícula e mesma data para evitar duplicidade
  const chavesNovas = new Set(novasOcorrencias.map((o) => `${o.matricula}_${o.dataInicio}`));
  const ocorrenciasFiltradas = (estadoAtual.ocorrencias || []).filter(
    (o) => !chavesNovas.has(`${o.matricula}_${o.dataInicio}`)
  );

  const novoLote: LoteImportacaoOperacional = {
    id: loteId,
    tipo: "ABONO_RM",
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
    id: `log-${Date.now()}`,
    timestamp: dataHoraAtual,
    usuario: usuarioNome,
    perfil: "PREMIER_ADMIN",
    acao: "IMPORTACAO_CUBO_ABONO",
    entidade: `Lote (${loteId})`,
    detalhes: `Importação de ocorrências do Cubo de Abono confirmada: ${novasOcorrencias.length} justificativas legais inseridas na competência.`,
    ip: "189.120.45.12",
  };

  salvarEstado({
    ocorrencias: [...novasOcorrencias, ...ocorrenciasFiltradas],
    lotesImportacao: [novoLote, ...(estadoAtual.lotesImportacao || [])],
    logsAuditoria: [novoLog, ...estadoAtual.logsAuditoria],
  });

  return {
    sucesso: true,
    loteId,
    mensagem: `Importação de Abonos confirmada com sucesso! Lote ${loteId} gravado com ${novasOcorrencias.length} ocorrências validadas.`,
  };
}

/**
 * Gera relatório de validação em formato XLSX com abas de Resumo, Ocorrências e Inconsistências
 */
export function gerarRelatorioValidacaoAbonoXlsx(simulacao: ResultadoSimulacaoAbono): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo do Lote
  const resumo = [
    { Indicador: "Arquivo", Valor: simulacao.arquivoNome },
    { Indicador: "Hash SHA-256", Valor: simulacao.hashSha256 },
    { Indicador: "Data de Referência", Valor: simulacao.dataReferencia },
    { Indicador: "Total de Registros Lidos", Valor: simulacao.totais.lidos },
    { Indicador: "Ocorrências Novas/Válidas", Valor: simulacao.totais.novos },
    { Indicador: "Linhas com Erro", Valor: simulacao.totais.erros },
    { Indicador: "Linhas com Alerta", Valor: simulacao.totais.alertas },
    { Indicador: "Status", Valor: simulacao.totais.erros > 0 ? "Com Erros" : "Válido para Importação" },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Aba 2: Ocorrências Processadas
  const ocorrencias = simulacao.linhas.map((l) => ({
    Linha: l.linha,
    Chapa: l.dados.chapa,
    Nome: l.dados.nomeFuncionario,
    Seção: l.dados.secaoDescricao,
    Data: l.dados.data,
    "Dia Semana": l.dados.diaSemana,
    "Descrição Abono": l.dados.descricaoAbono,
    "Tipo Mapeado": l.dados.tipoOcorrencia,
    "Posto Vinculado": l.dados.postoCodigo || "Reserva Técnica / Sem Posto",
    Status: l.validaParaGravacao ? "Válida" : "Erro",
  }));
  const wsOcorrencias = XLSX.utils.json_to_sheet(ocorrencias);
  XLSX.utils.book_append_sheet(wb, wsOcorrencias, "Ocorrências");

  // Aba 3: Inconsistências (se houver)
  const itensInconsistencias = simulacao.inconsistencias.map((inc) => ({
    Linha: inc.linha,
    Tipo: inc.tipo,
    Coluna: inc.coluna || "—",
    Chapa: inc.chapa || "—",
    Mensagem: inc.mensagem,
  }));
  const wsInconsistencias = XLSX.utils.json_to_sheet(
    itensInconsistencias.length > 0 ? itensInconsistencias : [{ Mensagem: "Nenhum erro ou alerta encontrado." }]
  );
  XLSX.utils.book_append_sheet(wb, wsInconsistencias, "Inconsistências");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(out);
}

/**
 * Gera modelo oficial do Cubo de Abono em XLSX para download do usuário
 */
export function gerarModeloCuboAbonoXlsx(): Uint8Array {
  const dadosModelo = [
    {
      "COD.SECÃO": "1.01.080.029",
      "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
      CHAPA: "000101",
      NOME_FUNCIONARIO: "CARLOS EDUARDO SILVA",
      SITUACAO: "Ativo",
      DATAADMISSAO: "02/01/2024",
      "DESC. FUNCAO": "Almoxarife Líder",
      "DIA SEMANA": "SEG",
      DATA: "17/08/2026",
      ABONO2: "08:48:00",
      "DESCRICAO ABONO": "ATESTADO MEDICO",
    },
    {
      "COD.SECÃO": "1.01.080.029",
      "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
      CHAPA: "000102",
      NOME_FUNCIONARIO: "MARIANA SOUZA LIMA",
      SITUACAO: "Ativo",
      DATAADMISSAO: "05/01/2024",
      "DESC. FUNCAO": "Auxiliar de Almoxarifado I",
      "DIA SEMANA": "TER",
      DATA: "18/08/2026",
      ABONO2: "08:48:00",
      "DESCRICAO ABONO": "DECLARACAO COMPARECIMENTO",
    },
    {
      "COD.SECÃO": "1.01.080.029",
      "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
      CHAPA: "000104",
      NOME_FUNCIONARIO: "JOSE PEREIRA SANTOS",
      SITUACAO: "Ativo",
      DATAADMISSAO: "01/02/2024",
      "DESC. FUNCAO": "Operador de Empilhadeira Líder",
      "DIA SEMANA": "QUA",
      DATA: "19/08/2026",
      ABONO2: "12:00:00",
      "DESCRICAO ABONO": "ABONADO PELO SUPERIOR",
    },
    {
      "COD.SECÃO": "1.01.080.029",
      "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
      CHAPA: "000114",
      NOME_FUNCIONARIO: "THIAGO BARBOSA",
      SITUACAO: "Ativo",
      DATAADMISSAO: "01/05/2024",
      "DESC. FUNCAO": "Auxiliar de Pátio",
      "DIA SEMANA": "QUI",
      DATA: "20/08/2026",
      ABONO2: "08:48:00",
      "DESCRICAO ABONO": "DOACAO DE SANGUE",
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dadosModelo);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(out);
}
