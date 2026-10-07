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
import {
  obterPeriodoCompetencia,
  marcarCalendarioDesatualizado,
} from "@/lib/servicos/calendario-competencia";

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
    categoriaAusencia: string;
    categoriaItem5?: string;
    quantidadeHoras?: number;
    quantidadeDias?: number;
    classificacaoPonto?: "Sem horas" | "Parcial" | "Dia inteiro";
    tipoOcorrencia: OcorrenciaOperacional["tipoOcorrencia"];
    postoCodigo?: string;
  };
}

export interface ItemRejeitadoAbono {
  linha: number;
  chapa?: string;
  nome?: string;
  coluna?: string;
  motivo: string;
}

export interface ResultadoSimulacaoAbono {
  tipo: "ABONO_RM";
  arquivoNome: string;
  hashSha256: string;
  dataReferencia: string;
  competencia?: string;
  dataExtracao?: string;
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
  linhasRejeitadasLista?: ItemRejeitadoAbono[];
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

/**
 * Extrai a quantidade de horas e dias informados na linha do Cubo de Abono
 */
export function extrairQuantidadeHorasDias(valorRaw: unknown): { horas?: number; dias: number } {
  if (valorRaw === null || valorRaw === undefined || valorRaw === "") {
    return { dias: 1 };
  }
  let horas: number | undefined;
  let dias = 1;

  if (typeof valorRaw === "number") {
    if (valorRaw > 0 && valorRaw <= 1) {
      // Fração de 24h no Excel (ex: 0.3680555555555555 * 24 = 8.83h)
      horas = Math.round(valorRaw * 24 * 100) / 100;
    } else {
      horas = valorRaw;
    }
  } else if (typeof valorRaw === "string" && valorRaw.trim() !== "") {
    const s = valorRaw.trim();
    if (s.includes(":")) {
      const parts = s.split(":");
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      horas = Math.round((h + m / 60) * 100) / 100;
    } else {
      const parsed = parseFloat(s.replace(",", "."));
      if (!isNaN(parsed)) {
        if (parsed > 0 && parsed <= 1) {
          horas = Math.round(parsed * 24 * 100) / 100;
        } else {
          horas = parsed;
        }
      }
    }
  }

  if (horas !== undefined && horas >= 8) {
    dias = Math.max(1, Math.round(horas / 8));
  }

  return { horas, dias };
}

/**
 * Categorização estrita sem dados médicos (LGPD Item 11.3)
 * Mapeia apenas para categorias contratuais: Férias, Falta, Afastamento, Licença, Folga compensatória, etc.
 * NUNCA CID, diagnóstico ou texto de atestado.
 */
export function categorizarAusencia(descAbono: string): {
  categoria: string;
  tipoOcorrencia: OcorrenciaOperacional["tipoOcorrencia"];
} {
  const d = (descAbono || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (d.includes("FERIAS")) {
    return { categoria: "Férias", tipoOcorrencia: "FERIAS" };
  }
  if (
    d.includes("ATESTADO MEDICO") ||
    d.includes("DOENCA") ||
    d.includes("SAUDE") ||
    d.includes("INSS") ||
    d.includes("ACIDENTE") ||
    d.includes("AFASTAMENTO")
  ) {
    return { categoria: "Afastamento", tipoOcorrencia: "ATESTADO_MEDICO" };
  }
  if (
    d.includes("COMPARECIMENTO") ||
    d.includes("ACOMPANHAMENTO") ||
    d.includes("DECLARACAO") ||
    d.includes("CONSULTA") ||
    d.includes("LICENCA") ||
    d.includes("MATERNIDADE") ||
    d.includes("PATERNIDADE") ||
    d.includes("LUTO") ||
    d.includes("CASAMENTO") ||
    d.includes("GALA")
  ) {
    return { categoria: "Licença", tipoOcorrencia: "FALTA_JUSTIFICADA" };
  }
  if (
    d.includes("ABONADO") ||
    d.includes("SANGUE") ||
    d.includes("ELEITORAL") ||
    d.includes("JURADO") ||
    d.includes("TRE")
  ) {
    return { categoria: "Folga compensatória", tipoOcorrencia: "ABONO_LEGAL" };
  }
  if (
    d.includes("FALTA") ||
    d.includes("INJUSTIFICADA") ||
    d.includes("SUSPENSAO")
  ) {
    return { categoria: "Falta", tipoOcorrencia: "FALTA_INJUSTIFICADA" };
  }
  if (
    d.includes("FOLGA") ||
    d.includes("COMPENSACAO") ||
    d.includes("DSR") ||
    d.includes("BANCO")
  ) {
    return { categoria: "Folga compensatória", tipoOcorrencia: "FOLGA_ESCALA" };
  }
  return { categoria: "Outros", tipoOcorrencia: "OUTROS" };
}

export function categorizarAbonoItem5(descAbono: string): {
  categoria: string;
  tipoOcorrencia: OcorrenciaOperacional["tipoOcorrencia"];
  ehConhecido: boolean;
} {
  const d = (descAbono || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (d.includes("ATESTADO MEDICO") || d.includes("DOENCA") || d.includes("INSS") || d.includes("MEDICO")) {
    return { categoria: "ATESTADO MEDICO", tipoOcorrencia: "ATESTADO_MEDICO", ehConhecido: true };
  }
  if (d.includes("ACOMPANHAMENTO")) {
    return { categoria: "ATESTADO DE ACOMPANHAMENTO", tipoOcorrencia: "FALTA_JUSTIFICADA", ehConhecido: true };
  }
  if (d.includes("COMPARECIMENTO") || d.includes("DECLARACAO") || d.includes("CONSULTA")) {
    return { categoria: "DECLARACAO COMPARECIMENTO", tipoOcorrencia: "FALTA_JUSTIFICADA", ehConhecido: true };
  }
  if (d.includes("ABONADO") || d.includes("SUPERIOR") || d.includes("GESTOR")) {
    return { categoria: "ABONADO PELO SUPERIOR", tipoOcorrencia: "ABONO_LEGAL", ehConhecido: true };
  }
  if (d.includes("ELEITORAL") || d.includes("TRE") || d.includes("JURADO") || d.includes("SANGUE")) {
    return { categoria: "ATESTADO COMP ELEITORAL", tipoOcorrencia: "ABONO_LEGAL", ehConhecido: true };
  }
  if (d.includes("FERIAS")) {
    return { categoria: "Férias", tipoOcorrencia: "FERIAS", ehConhecido: true };
  }
  if (d.includes("LICENCA") || d.includes("MATERNIDADE") || d.includes("PATERNIDADE") || d.includes("LUTO") || d.includes("CASAMENTO") || d.includes("GALA")) {
    return { categoria: "DECLARACAO COMPARECIMENTO", tipoOcorrencia: "FALTA_JUSTIFICADA", ehConhecido: true };
  }

  return { categoria: "Outros", tipoOcorrencia: "OUTROS", ehConhecido: false };
}

export async function simularImportacaoAbono(
  buffer: Uint8Array | ArrayBuffer,
  arquivoNome: string,
  dataReferencia: string,
  estadoCustomOuOptions?: EstadoOperacionalCompleto | { competencia?: string; dataExtracao?: string },
  optionsParam?: { competencia?: string; dataExtracao?: string }
): Promise<ResultadoSimulacaoAbono> {
  const estadoCustom = estadoCustomOuOptions && "profissionais" in estadoCustomOuOptions ? estadoCustomOuOptions : undefined;
  const options = optionsParam || (estadoCustomOuOptions && !("profissionais" in estadoCustomOuOptions) ? estadoCustomOuOptions : undefined);
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

  // Cabeçalho na linha 1; ignorar as colunas "Total Geral", SITUACAO, DATAADMISSAO e DTDEMISSAO
  const colunasIgnorar = new Set(["TOTAL GERAL", "SITUACAO", "DATAADMISSAO", "DTDEMISSAO", "DATA ADMISSAO", "DATA DEMISSAO"]);
  const cabecalhosBrutos = (dados[0] as string[]).map((c) => String(c || "").trim());

  const linhasRaw: Record<string, unknown>[] = [];
  for (let i = 1; i < dados.length; i++) {
    const row = dados[i] as unknown[];
    if (!row || row.length === 0 || row.every((c) => c === "" || c === null || c === undefined)) continue;
    // Ignora linha "Total Geral"
    if (row.some((c) => String(c || "").toUpperCase().includes("TOTAL GERAL"))) continue;

    const obj: Record<string, unknown> = {};
    cabecalhosBrutos.forEach((col, idx) => {
      const colUpper = col.toUpperCase().trim();
      if (!colunasIgnorar.has(colUpper)) {
        obj[col] = row[idx] !== undefined ? row[idx] : "";
      }
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
  const linhasRejeitadasLista: ItemRejeitadoAbono[] = [];

  let countNovos = 0;
  let countAtualizados = 0;
  let countErros = 0;
  let countAlertas = 0;

  linhasRaw.forEach((row, idx) => {
    const numLinha = idx + 2;
    const errosLinha: ItemInconsistencia[] = [];
    const alertasLinha: ItemInconsistencia[] = [];

    const rawChapa = String(row["CHAPA"] || row["chapa"] || "").trim();
    const nome = String(row["NOME_FUNCIONARIO"] || row["NOME"] || "").trim();
    const secaoCod = String(row["COD.SECÃO"] || row["COD.SEÇÃO"] || row["COD.SECAO"] || "").trim();
    const secaoDesc = String(row["DESC. SECAO"] || row["DESC. SEÇÃO"] || "").trim();
    const rawData = String(row["DATA"] || "").trim();
    const diaSemana = String(row["DIA SEMANA"] || row["DIA_SEMANA"] || "").trim();
    const descAbono = String(row["DESCRICAO ABONO"] || row["DESCRICAO"] || "OUTROS").trim().toUpperCase();

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

    // Regra: Linhas com data fora da competência -> rejeitar
    if (options?.competencia && dataIso && /^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
      const periodoComp = obterPeriodoCompetencia(options.competencia);
      if (dataIso < periodoComp.dataInicio || dataIso > periodoComp.dataFim) {
        errosLinha.push({
          linha: numLinha,
          tipo: "ERRO",
          coluna: "DATA",
          chapa,
          mensagem: `Data ${dataIso} fora da competência selecionada (${periodoComp.textoFormatado}).`,
        });
      }
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

    // Extração de quantidade de horas decimais e dias (ABONO2, HORAS, QUANTIDADE, DIAS)
    const rawQtd =
      row["ABONO2"] !== undefined && row["ABONO2"] !== ""
        ? row["ABONO2"]
        : row["HORAS"] !== undefined && row["HORAS"] !== ""
        ? row["HORAS"]
        : row["QUANTIDADE"] !== undefined && row["QUANTIDADE"] !== ""
        ? row["QUANTIDADE"]
        : row["DIAS"] !== undefined && row["DIAS"] !== ""
        ? row["DIAS"]
        : row["ABONO"];
    const { horas: quantidadeHoras, dias: quantidadeDias } = extrairQuantidadeHorasDias(rawQtd);

    // Classificação cruzando com o Ponto da competência:
    // horas = 0 → "Sem horas"; dia com ponto → "Parcial"; dia sem ponto → "Dia inteiro"
    const pontosNoDia = (estado.marcacoesPonto || []).filter(
      (m) => (m.chapa === chapa || m.cpfLimpo === funcRm?.cpfLimpo) && m.dataLocal === dataIso
    );
    let classificacaoPonto: "Sem horas" | "Parcial" | "Dia inteiro" = "Dia inteiro";
    if (quantidadeHoras === 0 || !quantidadeHoras) {
      classificacaoPonto = "Sem horas";
    } else if (pontosNoDia.length > 0) {
      classificacaoPonto = "Parcial";
    } else {
      classificacaoPonto = "Dia inteiro";
    }

    // Categorias: ATESTADO MEDICO, ATESTADO DE ACOMPANHAMENTO, DECLARACAO COMPARECIMENTO,
    // ABONADO PELO SUPERIOR, ATESTADO COMP ELEITORAL. Valor desconhecido → "Outros" + alerta.
    const catItem5 = categorizarAbonoItem5(descAbono);
    const catAusencia = categorizarAusencia(descAbono);
    const categoriaAusencia = catAusencia.categoria;
    const tipoOcorrencia = catAusencia.tipoOcorrencia;
    if (!catItem5.ehConhecido) {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "DESCRICAO ABONO",
        chapa,
        mensagem: `Tipo de abono não reconhecido no catálogo padrão: "${descAbono}". Mapeado para Outros.`,
      });
    }

    // Alerta: abono dentro de período de férias ou afastamento
    const temAfastamentoNoDia = (estado.ocorrencias || []).some(
      (o) =>
        o.matricula === chapa &&
        dataIso >= o.dataInicio &&
        dataIso <= (o.dataFim || o.dataInicio) &&
        (o.tipoOcorrencia === "FERIAS" ||
          o.categoriaAusencia === "Férias" ||
          o.categoriaAusencia === "Afastamento" ||
          o.categoriaAusencia === "Licença")
    );
    if (temAfastamentoNoDia) {
      alertasLinha.push({
        linha: numLinha,
        tipo: "ALERTA",
        coluna: "DATA / ABONO",
        chapa,
        mensagem: `Abono registrado dentro de período de férias ou afastamento do colaborador.`,
      });
    }

    // Chave única: CHAPA + DATA + DESCRICAO ABONO
    const chaveUpsert = `${chapa}_${dataIso}_${tipoOcorrencia}`;
    const jaExiste = (estado.ocorrencias || []).some(
      (o) => `${o.matricula}_${o.dataInicio}_${o.tipoOcorrencia}` === chaveUpsert
    );

    const temErro = errosLinha.length > 0;
    const temAlerta = alertasLinha.length > 0;
    if (temErro) {
      countErros++;
      errosLinha.forEach((err) => {
        linhasRejeitadasLista.push({
          linha: numLinha,
          chapa: chapa || "—",
          nome: nome || funcRm?.nome || "—",
          coluna: err.coluna,
          motivo: err.mensagem,
        });
      });
    } else if (jaExiste) {
      countAtualizados++;
    } else {
      countNovos++;
    }
    if (temAlerta) countAlertas++;

    const inconsistenciasLinha = [...errosLinha, ...alertasLinha];
    todasInconsistencias.push(...inconsistenciasLinha);

    linhasProcessadas.push({
      linha: numLinha,
      validaParaGravacao: !temErro,
      statusAcao: temErro ? "ERRO" : jaExiste ? "ATUALIZADO" : "NOVO",
      inconsistencias: inconsistenciasLinha,
      dados: {
        chapa,
        nomeFuncionario: nome || funcRm?.nome || `Colaborador ${chapa}`,
        secaoCodigo: secaoCod,
        secaoDescricao: secaoDesc,
        data: dataIso,
        diaSemana,
        descricaoAbono: descAbono,
        categoriaAusencia,
        categoriaItem5: catItem5.categoria,
        quantidadeHoras,
        quantidadeDias,
        classificacaoPonto,
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
    competencia: options?.competencia,
    dataExtracao: options?.dataExtracao || dataReferencia,
    arquivoDuplicado,
    loteAnteriorId: loteExistente?.id,
    loteAnteriorData: loteExistente?.dataHora,
    totais: {
      lidos: linhasRaw.length,
      novos: countNovos,
      atualizados: countAtualizados,
      semAlteracao: 0,
      erros: countErros,
      alertas: countAlertas,
    },
    linhas: linhasProcessadas,
    inconsistencias: todasInconsistencias,
    linhasRejeitadasLista,
  };
}

export function confirmarImportacaoAbono(
  simulacao: ResultadoSimulacaoAbono,
  usuarioNome: string = "Administrador Premier (Marcos Valério)"
): { sucesso: boolean; loteId: string; mensagem: string } {
  const estadoAtual = carregarEstado();

  if (simulacao.arquivoDuplicado && !simulacao.competencia) {
    throw new Error(`Este arquivo já foi importado no lote ${simulacao.loteAnteriorId}.`);
  }

  const snapshotAnterior: EstadoOperacionalCompleto = {
    profissionais: [...(estadoAtual.profissionais || [])],
    ocorrencias: [...(estadoAtual.ocorrencias || [])],
    coberturas: [...(estadoAtual.coberturas || [])],
    alocadosSifac: [...(estadoAtual.alocadosSifac || [])],
  } as any;
  const dataHoraAtual = new Date().toISOString().replace("T", " ").substring(0, 19);
  const stamp = dataHoraAtual.replace(/[-: ]/g, "").substring(0, 14);
  const loteId = `LOTE-ABONO-${stamp}`;

  // Se houver lote de abono da mesma competência, substitui o anterior (marca como DESFEITO)
  let lotesExistentes = estadoAtual.lotesImportacao || [];
  if (simulacao.competencia) {
    lotesExistentes = lotesExistentes.map((l) => {
      if (l.tipo === "ABONO_RM" && l.competencia === simulacao.competencia && l.status === "CONCLUIDO") {
        return { ...l, status: "DESFEITO" as const };
      }
      return l;
    });
  }

  const novasOcorrencias: OcorrenciaOperacional[] = simulacao.linhas
    .filter((l) => l.validaParaGravacao)
    .map((l, idx) => ({
      id: `oco-${Date.now()}-${idx + 1}`,
      matricula: l.dados.chapa,
      profissionalNome: l.dados.nomeFuncionario,
      postoCodigo: l.dados.postoCodigo,
      tipoOcorrencia: l.dados.tipoOcorrencia,
      categoriaAusencia: l.dados.categoriaAusencia,
      tipoAbono: l.dados.categoriaItem5 || l.dados.descricaoAbono,
      quantidadeHoras: l.dados.quantidadeHoras,
      quantidadeDias: l.dados.quantidadeDias,
      dataInicio: l.dados.data,
      dataFim: l.dados.data,
      diasAfetados: l.dados.quantidadeDias || 1,
      status: "VALIDADA" as const,
      observacaoPublica: `Ausência RM: ${l.dados.categoriaAusencia}`,
      criadoEm: dataHoraAtual,
    }));

  // Upsert por chapa + data + tipo
  const mapaOcorrencias = new Map<string, OcorrenciaOperacional>();
  (estadoAtual.ocorrencias || []).forEach((o) => {
    const k = `${o.matricula}_${o.dataInicio}_${o.tipoOcorrencia}`;
    mapaOcorrencias.set(k, o);
  });

  novasOcorrencias.forEach((nova) => {
    const k = `${nova.matricula}_${nova.dataInicio}_${nova.tipoOcorrencia}`;
    const existente = mapaOcorrencias.get(k);
    if (existente) {
      mapaOcorrencias.set(k, {
        ...existente,
        profissionalNome: nova.profissionalNome,
        postoCodigo: nova.postoCodigo || existente.postoCodigo,
        categoriaAusencia: nova.categoriaAusencia,
        tipoAbono: nova.tipoAbono,
        quantidadeHoras: nova.quantidadeHoras || existente.quantidadeHoras,
        quantidadeDias: nova.quantidadeDias || existente.quantidadeDias,
        status: "VALIDADA",
        observacaoPublica: nova.observacaoPublica,
        dadoSensivel: undefined,
      });
    } else {
      mapaOcorrencias.set(k, nova);
    }
  });

  const ocorrenciasFiltradas = Array.from(mapaOcorrencias.values());

  const novoLote: LoteImportacaoOperacional = {
    id: loteId,
    tipo: "ABONO_RM",
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
    id: `log-abono-${Date.now()}`,
    timestamp: dataHoraAtual,
    usuario: usuarioNome,
    perfil: "PREMIER_ADMIN",
    acao: "IMPORTAR_CUBO_ABONO",
    entidade: `Lote (${loteId})`,
    detalhes: `Importação de Cubo de Abono e Ocorrências confirmada no lote ${loteId} (${simulacao.arquivoNome})${simulacao.competencia ? ` - Competência ${simulacao.competencia}` : ""}: ${simulacao.totais.novos} novos, ${simulacao.totais.atualizados} atualizados, ${simulacao.totais.erros} erros.`,
    ip: "189.120.45.12",
  };

  salvarEstado({
    ocorrencias: ocorrenciasFiltradas,
    lotesImportacao: [novoLote, ...lotesExistentes],
    logsAuditoria: [novoLog, ...(estadoAtual.logsAuditoria || [])],
  });

  if (simulacao.competencia) {
    marcarCalendarioDesatualizado(simulacao.competencia);
  }

  return {
    sucesso: true,
    loteId,
    mensagem: `Importação de Abonos confirmada com sucesso! Lote ${loteId} com ${simulacao.totais.novos} novos registros e ${simulacao.totais.atualizados} atualizações.${simulacao.competencia ? ` Competência: ${simulacao.competencia}.` : ""}`,
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
    "Categoria Ausência": l.dados.categoriaAusencia,
    "Horas": l.dados.quantidadeHoras || "—",
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
