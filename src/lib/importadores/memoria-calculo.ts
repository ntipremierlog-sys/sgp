/**
 * SGP — Sistema de Gestão de Postos
 * Contrato Petrobras ICJ 5900.0129796.25.2
 *
 * Módulo de Importação, Saneamento e Ligação da Memória de Cálculo (MC)
 *
 * Regras Contratuais:
 * 1. Saneamento obrigatório (MC e RM):
 *    - Remover espaços no início/fim e espaços duplos ("UFN-III " = "UFN-III").
 *    - Comparar textos sem diferença de maiúsculas e acentos ("Não" = "NÃO").
 *    - Regime ausente no nome do posto (ex.: item 10.1): usar regime do catálogo ITEM_PPU.
 *    - Valor "-" em campo numérico = vazio; registrar em lista de inconsistências.
 *    - Linhas de itens que não são postos (offshore, serviços adicionais, receptivo, vistorias)
 *      são ignoradas no Painel.
 *
 * 2. Ligação MC × SGP:
 *    - Chave principal: Posto_ID_SGP / código estrutural da posição.
 *    - Se a MC não trouxer o número do posto, ligar pelo IDENTIFICADOR (ID) da pessoa.
 *    - Em último caso, pelo nome normalizado (registrado como inconsistência para validação).
 *    - Pessoa da MC sem posição no SGP → lista "A alocar" (não cria posição automaticamente).
 *
 * 3. Período de medição configurável por competência:
 *    - Padrão: dia 10 ao dia 09.
 *    - Se o ciclo das linhas for diferente do período informado no cabeçalho ou competência,
 *      BLOQUEAR a carga e mostrar a mensagem:
 *      "O ciclo das linhas (dd/mm a dd/mm) não corresponde à competência informada. Atualize a MC e importe novamente."
 */

import * as XLSX from "xlsx";
import {
  CATALOGO_ITEM_PPU,
  MAPA_ITEM_PPU,
  ehItemPostoValido,
  obterItemPPU,
} from "@/lib/dados/painel-calculo";
import {
  POSTOS_REV04,
  POSICOES_REV04,
  ALOCACOES_REV04,
  FERISTAS_REV04,
  PostoEstrutural,
  PosicaoEstrutural,
  AlocacaoEstrutural,
} from "@/lib/dados/estrutura-postos";

// =============================================================================
// FUNÇÕES OBRIGATÓRIAS DE SANEAMENTO
// =============================================================================

/**
 * Remove espaços em branco nas extremidades e colapsa múltiplos espaços em um único.
 * Exemplo: "UFN-III " -> "UFN-III", "  BOAVENTURA   " -> "BOAVENTURA".
 */
export function sanitizarTexto(texto: any): string {
  if (texto === null || texto === undefined) return "";
  return String(texto).trim().replace(/\s+/g, " ");
}

/**
 * Normaliza o texto para comparações insensíveis a maiúsculas/minúsculas e acentuação.
 * Exemplo: "Não" === "NÃO" === "nao".
 */
export function normalizarParaComparacao(texto: any): string {
  return sanitizarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/**
 * Resolve o regime de trabalho do posto:
 * Se estiver ausente do nome do posto (ex.: item 10.1 "APOIO EM ANÁLISE DE ENGENHARIA"),
 * busca o regime oficial no catálogo ITEM_PPU.
 */
export function resolverRegimePosto(itemPpu: string, nomePosto?: string): string {
  const nomeNorm = normalizarParaComparacao(nomePosto || "");

  if (nomeNorm.includes("TURNO/24H") || nomeNorm.includes("TURNO 24H")) return "Turno/24h";
  if (nomeNorm.includes("TURNO/16H") || nomeNorm.includes("TURNO 16H")) return "Turno/16h";
  if (nomeNorm.includes("TURNO/12H") || nomeNorm.includes("TURNO 12H")) return "Turno/12h";
  if (nomeNorm.includes("ADM/16H") || nomeNorm.includes("ADM 16H")) return "Adm/16h";
  if (nomeNorm.includes("ADM/12H") || nomeNorm.includes("ADM 12H")) return "Adm/12h";
  if (nomeNorm.includes("ADM/09H") || nomeNorm.includes("ADM 09H") || nomeNorm.includes("ADM/9H")) return "Adm/09h";

  // Recurso ao catálogo oficial ITEM_PPU
  const c = sanitizarTexto(itemPpu);
  const catalogoItem = obterItemPPU(c);
  if (catalogoItem) {
    return catalogoItem.regime;
  }

  return "Adm/09h";
}

/**
 * Sanitiza campos numéricos. Se o valor for "-", considera como vazio (null)
 * e registra na lista de inconsistências conforme a Especificação Técnica.
 */
export function sanitizarCampoNumerico(
  valor: any,
  linha: number,
  campo: string,
  inconsistencias?: InconsistenciaMC[],
  colaborador?: string
): number | null {
  if (valor === null || valor === undefined) return null;
  const str = String(valor).trim();
  if (str === "" || str === "-" || str === "—" || str === "- ") {
    if (str === "-" || str === "—" || str === "- ") {
      if (inconsistencias) {
        inconsistencias.push({
          linha,
          campo,
          colaborador,
          valorOriginal: valor,
          motivo: `Valor '-' em campo numérico (${campo}) tratado como vazio`,
        });
      }
    }
    return null;
  }

  const num = typeof valor === "number" ? valor : parseFloat(str.replace(/[^\d.,-]/g, "").replace(",", "."));
  return isNaN(num) ? null : num;
}

/**
 * Normaliza valores de data/dia e mês para comparação de ciclos de medição (formato "DD/MM").
 */
export function extrairDataDiaMes(val: any): string {
  if (val === null || val === undefined) return "";

  // Número de série Excel
  if (typeof val === "number") {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        return `${String(parsed.d).padStart(2, "0")}/${String(parsed.m).padStart(2, "0")}`;
      }
    } catch {
      // continua
    }
  }

  const str = String(val).trim();
  if (!str) return "";

  // Formatos: "DD/MM/YYYY" ou "DD/MM" ou "M/D/YY"
  const partes = str.split(/[/ -]/);
  if (partes.length >= 2) {
    const p1 = parseInt(partes[0], 10);
    const p2 = parseInt(partes[1], 10);
    if (!isNaN(p1) && !isNaN(p2)) {
      // Detecta formato US m/d/y se ano estiver no final e p1 <= 12 e p2 > 12
      if (partes.length === 3 && p1 <= 12 && p2 > 12) {
        return `${String(p2).padStart(2, "0")}/${String(p1).padStart(2, "0")}`;
      }
      // Padrão brasileiro DD/MM
      if (p1 <= 31 && p2 <= 12) {
        return `${String(p1).padStart(2, "0")}/${String(p2).padStart(2, "0")}`;
      }
    }
  }

  return "";
}

// =============================================================================
// INTERFACES DO PROCESSO DE IMPORTAÇÃO DA MC
// =============================================================================

export interface InconsistenciaMC {
  linha: number;
  campo?: string;
  colaborador?: string;
  valorOriginal?: any;
  motivo: string;
}

export interface PessoaAAlocar {
  linha: number;
  identificador: string;
  colaborador: string;
  local: string;
  funcao?: string;
  itemPpu?: string;
  motivo: string;
}

export interface ItemIgnoradoMC {
  linha: number;
  itemPpu: string;
  colaborador?: string;
  descricao?: string;
  motivo: string;
}

export interface LinhaMCLigada {
  linha: number;
  postoIdSGP: string;
  posicaoIdSGP?: string;
  codigoEstrutural?: string;
  itemPpu: string;
  colaborador: string;
  identificador: string;
  tipoLigacao: "CHAVE_PRINCIPAL" | "IDENTIFICADOR" | "NOME_NORMALIZADO";
  diasDisponibilidade?: number | null;
  diasAusencia?: number | null;
  motivoInconsistencia?: string;
}

export interface ResultadoImportacaoMC {
  sucesso: boolean;
  bloqueado: boolean;
  mensagemBloqueio?: string;
  competencia: string;
  cicloCabecalho: string;
  cicloLinhas: string;
  totalLinhasLidas: number;
  totalImportado: number;
  totalIgnorado: number;
  inconsistencias: InconsistenciaMC[];
  pessoasAAlocar: PessoaAAlocar[];
  itensIgnorados: ItemIgnoradoMC[];
  linhasLigadas: LinhaMCLigada[];
}

// =============================================================================
// VALIDAÇÃO DE PERÍODO / CICLO DE MEDIÇÃO
// =============================================================================

/**
 * Retorna o ciclo esperado da competência informada (padrão dia 10 ao dia 09).
 * Ex: "2026-09" -> { inicio: "10/08", fim: "09/09", texto: "10/08 a 09/09" }
 * Ex: "2026-10" -> { inicio: "10/09", fim: "09/10", texto: "10/09 a 09/10" }
 */
export function obterCicloEsperadoCompetencia(
  competencia: string = "2026-09",
  diaInicio: number = 10,
  diaFim: number = 9
): {
  inicio: string;
  fim: string;
  texto: string;
} {
  const partes = competencia.split("-");
  const ano = parseInt(partes[0], 10) || 2026;
  const mes = parseInt(partes[1], 10) || 9;

  let mesAnt = mes - 1;
  if (mesAnt === 0) mesAnt = 12;

  const strIni = String(diaInicio).padStart(2, "0");
  const strFim = String(diaFim).padStart(2, "0");
  const inicio = `${strIni}/${String(mesAnt).padStart(2, "0")}`;
  const fim = `${strFim}/${String(mes).padStart(2, "0")}`;
  return {
    inicio,
    fim,
    texto: `${inicio} a ${fim}`,
  };
}

/**
 * Extrai o ciclo de medição contido no cabeçalho da planilha da MC (ex: "Medição: 10/08/2026 À 09/09/2026").
 */
export function extrairCicloCabecalhoMC(textoCabecalho: string): {
  inicio: string;
  fim: string;
  texto: string;
} | null {
  if (!textoCabecalho) return null;
  const match = textoCabecalho.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:[ÀàAa]|-)\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  if (match) {
    const ini = extrairDataDiaMes(match[1]);
    const fim = extrairDataDiaMes(match[2]);
    if (ini && fim) {
      return {
        inicio: ini,
        fim,
        texto: `${ini} a ${fim}`,
      };
    }
  }
  return null;
}

// =============================================================================
// MOTOR PRINCIPAL DE PROCESSAMENTO DA MEMÓRIA DE CÁLCULO (MC)
// =============================================================================

export interface OpcoesProcessamentoMC {
  competencia?: string; // Padrão "2026-09"
  diaInicioCiclo?: number; // Padrão 10
  diaFimCiclo?: number; // Padrão 09
  postosBase?: PostoEstrutural[];
  posicoesBase?: PosicaoEstrutural[];
  alocacoesBase?: AlocacaoEstrutural[];
}

/**
 * Processa uma pasta de trabalho, buffer ou caminho da Memória de Cálculo (MC) aplicando
 * todas as regras de saneamento, bloqueio por ciclo divergente e ligação com o SGP.
 */
export function processarMemoriaCalculo(
  workbookOuBuffer: XLSX.WorkBook | ArrayBuffer | Buffer | string,
  opcoes: OpcoesProcessamentoMC = {}
): ResultadoImportacaoMC {
  const competencia = opcoes.competencia || "2026-09";
  const diaInicio = opcoes.diaInicioCiclo ?? 10;
  const diaFim = opcoes.diaFimCiclo ?? 9;

  const postosSgp = opcoes.postosBase || POSTOS_REV04;
  const posicoesSgp = opcoes.posicoesBase || POSICOES_REV04;
  const alocacoesSgp = opcoes.alocacoesBase || ALOCACOES_REV04;

  let wb: XLSX.WorkBook;
  if (typeof workbookOuBuffer === "string") {
    wb = XLSX.readFile(workbookOuBuffer);
  } else if ("SheetNames" in (workbookOuBuffer as any)) {
    wb = workbookOuBuffer as XLSX.WorkBook;
  } else {
    wb = XLSX.read(workbookOuBuffer, { type: "buffer", cellDates: true });
  }

  // 1. Localiza a aba "MC"
  const sheetNameMC = wb.SheetNames.find((s) => s.trim().toUpperCase() === "MC") || wb.SheetNames[0];
  const ws = wb.Sheets[sheetNameMC];
  if (!ws) {
    throw new Error(`Aba 'MC' não foi encontrada na planilha de Memória de Cálculo.`);
  }

  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

  // 2. Extrai cabeçalho de ciclo de medição
  let cicloCabecalhoStr = "";
  for (let r = 0; r < Math.min(5, rawRows.length); r++) {
    for (const cel of rawRows[r]) {
      const cStr = String(cel || "");
      if (cStr.toLowerCase().includes("medição:") || cStr.toLowerCase().includes("medicao:")) {
        cicloCabecalhoStr = cStr;
        break;
      }
    }
    if (cicloCabecalhoStr) break;
  }

  const cicloCabecalhoInfo = extrairCicloCabecalhoMC(cicloCabecalhoStr);
  const cicloEsperado = obterCicloEsperadoCompetencia(competencia, diaInicio, diaFim);

  // 3. Localiza linha de cabeçalhos de colunas
  let headerRowIndex = 3;
  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const rowStr = (rawRows[r] || []).map((c) => normalizarParaComparacao(c)).join(" ");
    if (rowStr.includes("ITEM PPU") && (rowStr.includes("COLABORADOR") || rowStr.includes("LOCAL DE ATUACAO"))) {
      headerRowIndex = r;
      break;
    }
  }

  const headerRow = (rawRows[headerRowIndex] || []).map((h) => sanitizarTexto(h));
  const colIndex = {
    id: headerRow.findIndex((h) => normalizarParaComparacao(h) === "ID"),
    postoIdSgp: headerRow.findIndex((h) => {
      const norm = normalizarParaComparacao(h);
      return norm.includes("POSTO_ID_SGP") || norm.includes("POSTO ID SGP") || norm === "POSTO";
    }),
    itemPpu: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("ITEM PPU")),
    periculosidade: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("PERICULOSIDADE")),
    municipio: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("MUNICIPIO")),
    local: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("LOCAL DE ATUACAO")),
    gerencia: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("GERENCIA")),
    identificador: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("IDENTIFICADOR")),
    colaborador: headerRow.findIndex((h) => normalizarParaComparacao(h) === "COLABORADOR"),
    postoServico: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("POSTO DE SERVICO")),
    cargo: headerRow.findIndex((h) => normalizarParaComparacao(h) === "CARGO"),
    cicloInicio: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("CICLO DE MEDICAO INICIO")),
    cicloFim: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("CICLO DE MEDICAO FIM")),
    disponibilidadeDias: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("DISPONIBILIDADE DO POSTO EM DIAS")),
    diasAusencia: headerRow.findIndex((h) => normalizarParaComparacao(h).includes("DIAS DE AUSENCIA")),
  };

  // 4. Índices para lookup eficiente de postos e posições no SGP
  const mapaPostoPorIdSgp = new Map<string, PostoEstrutural>();
  for (const p of postosSgp) {
    mapaPostoPorIdSgp.set(sanitizarTexto(p.postoIdSGP), p);
  }

  const mapaPosicaoPorIdSgp = new Map<string, PosicaoEstrutural>();
  const mapaPosicaoPorCodigoVisual = new Map<string, PosicaoEstrutural>();
  const mapaPosicaoPorChapa = new Map<string, PosicaoEstrutural>();
  const mapaPosicaoPorNome = new Map<string, PosicaoEstrutural>();

  for (const pos of posicoesSgp) {
    mapaPosicaoPorIdSgp.set(sanitizarTexto(pos.posicaoIdSGP), pos);
    if (pos.codigoVisual) mapaPosicaoPorCodigoVisual.set(sanitizarTexto(pos.codigoVisual), pos);
    if ((pos as any).codigoPosicaoEstrutural) {
      mapaPosicaoPorCodigoVisual.set(sanitizarTexto((pos as any).codigoPosicaoEstrutural), pos);
    }

    const chapa = sanitizarTexto(pos.chapaTitular);
    if (chapa && chapa !== "-" && chapa !== "SEM TITULAR") {
      mapaPosicaoPorChapa.set(chapa, pos);
    }

    const nomeNorm = normalizarParaComparacao(pos.titularReferencia);
    if (nomeNorm && !nomeNorm.includes("SEM TITULAR")) {
      mapaPosicaoPorNome.set(nomeNorm, pos);
    }
  }

  // Mapa de ligação por IDENTIFICADOR (ID) e Chapa RM a partir de ALOCACOES_REV04
  const mapaPorIdentificadorMC = new Map<string, { posicao?: PosicaoEstrutural; posto: PostoEstrutural }>();
  for (const aloc of alocacoesSgp) {
    const pos = mapaPosicaoPorIdSgp.get(aloc.posicaoIdSGP);
    const pst = mapaPostoPorIdSgp.get(aloc.postoIdSGP);
    if (pst) {
      const idPetrobras = (aloc as any).identificadorMC || aloc.identificadorPetrobras;
      if (idPetrobras) {
        mapaPorIdentificadorMC.set(sanitizarTexto(idPetrobras), { posicao: pos, posto: pst });
      }
      if (aloc.chapaRM && aloc.chapaRM !== "-" && aloc.chapaRM !== "000000") {
        mapaPorIdentificadorMC.set(sanitizarTexto(aloc.chapaRM), { posicao: pos, posto: pst });
      }
      const nomeColaborador = aloc.nome || (aloc as any).colaborador;
      const nomeNorm = normalizarParaComparacao(nomeColaborador);
      if (nomeNorm && !mapaPosicaoPorNome.has(nomeNorm)) {
        if (pos) mapaPosicaoPorNome.set(nomeNorm, pos);
      }
    }
  }

  const inconsistencias: InconsistenciaMC[] = [];
  const pessoasAAlocar: PessoaAAlocar[] = [];
  const itensIgnorados: ItemIgnoradoMC[] = [];
  const linhasLigadas: LinhaMCLigada[] = [];

  let totalLinhasLidas = 0;
  let cicloLinhasDetectado = "";

  // 5. Itera sobre as linhas de dados da MC
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;
    const linhaExcel = r + 1;

    const idPostoCol = colIndex.postoIdSgp !== -1 ? sanitizarTexto(row[colIndex.postoIdSgp]) : "";
    const itemPpu = sanitizarTexto(colIndex.itemPpu !== -1 ? row[colIndex.itemPpu] : row[1]);
    const colaborador = sanitizarTexto(colIndex.colaborador !== -1 ? row[colIndex.colaborador] : row[7]);
    const identificador = sanitizarTexto(colIndex.identificador !== -1 ? row[colIndex.identificador] : row[6]);
    const local = sanitizarTexto(colIndex.local !== -1 ? row[colIndex.local] : row[4]);
    const funcao = sanitizarTexto(colIndex.postoServico !== -1 ? row[colIndex.postoServico] : row[8]);

    // Ignora linhas totalmente em branco
    if (!itemPpu && !colaborador && !identificador && !local) {
      continue;
    }

    totalLinhasLidas++;

    // Detecção do ciclo nas linhas (primeira linha válida com ciclo)
    if (!cicloLinhasDetectado) {
      const valIni = colIndex.cicloInicio !== -1 ? row[colIndex.cicloInicio] : row[10];
      const valFim = colIndex.cicloFim !== -1 ? row[colIndex.cicloFim] : row[11];
      const iniFormatado = extrairDataDiaMes(valIni);
      const fimFormatado = extrairDataDiaMes(valFim);
      if (iniFormatado && fimFormatado) {
        cicloLinhasDetectado = `${iniFormatado} a ${fimFormatado}`;
      }
    }

    // Regra: Linhas da MC de itens que NÃO são postos (offshore, adicionais, receptivo, vistorias)
    // são ignoradas no Painel.
    if (!ehItemPostoValido(itemPpu)) {
      itensIgnorados.push({
        linha: linhaExcel,
        itemPpu,
        colaborador,
        motivo: `Item ${itemPpu || "não informado"} fora do catálogo de 19 postos (não entra no Painel)`,
      });
      continue;
    }

    // Saneamento de campos numéricos (ex: "-" vira vazio e gera inconsistência)
    const valDisp = colIndex.disponibilidadeDias !== -1 ? row[colIndex.disponibilidadeDias] : null;
    const diasDisponibilidade = sanitizarCampoNumerico(valDisp, linhaExcel, "Disponibilidade em dias", inconsistencias, colaborador);

    const valAus = colIndex.diasAusencia !== -1 ? row[colIndex.diasAusencia] : null;
    const diasAusencia = sanitizarCampoNumerico(valAus, linhaExcel, "Dias de ausência", inconsistencias, colaborador);

    // Registra inconsistências para outros campos com "-" na linha
    for (let c = 0; c < row.length; c++) {
      if (c !== colIndex.disponibilidadeDias && c !== colIndex.diasAusencia) {
        const cellVal = String(row[c] || "").trim();
        if (cellVal === "-" || cellVal === "—") {
          const nomeCol = headerRow[c] || `Coluna ${c + 1}`;
          inconsistencias.push({
            linha: linhaExcel,
            campo: nomeCol,
            colaborador,
            valorOriginal: row[c],
            motivo: `Valor '-' em campo (${nomeCol}) tratado como vazio`,
          });
        }
      }
    }

    // =========================================================================
    // LIGAÇÃO MC × SGP
    // =========================================================================
    let posicaoEncontrada: PosicaoEstrutural | undefined;
    let postoEncontrado: PostoEstrutural | undefined;
    let tipoLigacao: "CHAVE_PRINCIPAL" | "IDENTIFICADOR" | "NOME_NORMALIZADO" = "CHAVE_PRINCIPAL";

    // 1. Chave principal: Posto_ID_SGP / código estrutural da posição (se presente)
    if (idPostoCol && (idPostoCol.startsWith("POS-") || idPostoCol.startsWith("PST-"))) {
      if (mapaPosicaoPorIdSgp.has(idPostoCol)) {
        posicaoEncontrada = mapaPosicaoPorIdSgp.get(idPostoCol);
        postoEncontrado = mapaPostoPorIdSgp.get(posicaoEncontrada!.postoIdSGP);
        tipoLigacao = "CHAVE_PRINCIPAL";
      } else if (mapaPostoPorIdSgp.has(idPostoCol)) {
        postoEncontrado = mapaPostoPorIdSgp.get(idPostoCol);
        tipoLigacao = "CHAVE_PRINCIPAL";
      }
    }

    // 2. Se a MC não trouxer o número do posto, ligar pela coluna IDENTIFICADOR (ID) da pessoa
    if (!posicaoEncontrada && !postoEncontrado && identificador) {
      if (mapaPorIdentificadorMC.has(identificador)) {
        const match = mapaPorIdentificadorMC.get(identificador)!;
        posicaoEncontrada = match.posicao;
        postoEncontrado = match.posto;
        tipoLigacao = "IDENTIFICADOR";
      } else if (mapaPosicaoPorChapa.has(identificador)) {
        posicaoEncontrada = mapaPosicaoPorChapa.get(identificador);
        postoEncontrado = mapaPostoPorIdSgp.get(posicaoEncontrada!.postoIdSGP);
        tipoLigacao = "IDENTIFICADOR";
      }
    }

    // 3. Em último caso, pelo nome normalizado (vai para lista de inconsistências para validação)
    if (!posicaoEncontrada && !postoEncontrado && colaborador) {
      const nomeNorm = normalizarParaComparacao(colaborador);
      if (mapaPosicaoPorNome.has(nomeNorm)) {
        posicaoEncontrada = mapaPosicaoPorNome.get(nomeNorm);
        postoEncontrado = mapaPostoPorIdSgp.get(posicaoEncontrada!.postoIdSGP);
        tipoLigacao = "NOME_NORMALIZADO";
        inconsistencias.push({
          linha: linhaExcel,
          colaborador,
          motivo: `Ligação realizada por nome normalizado (sem chave técnica de posto ou ID cadastrado)`,
        });
      }
    }

    // 4. Pessoa da MC sem posição no SGP → lista "A alocar" (não criar posição automaticamente)
    if (!posicaoEncontrada && !postoEncontrado) {
      pessoasAAlocar.push({
        linha: linhaExcel,
        identificador,
        colaborador,
        local,
        funcao,
        itemPpu,
        motivo: `Colaborador na MC sem posição vinculada no SGP`,
      });
      continue;
    }

    const postoIdFinal = postoEncontrado?.postoIdSGP || posicaoEncontrada?.postoIdSGP || "";

    linhasLigadas.push({
      linha: linhaExcel,
      postoIdSGP: postoIdFinal,
      posicaoIdSGP: posicaoEncontrada?.posicaoIdSGP,
      codigoEstrutural: posicaoEncontrada?.codigoVisual || (posicaoEncontrada as any)?.codigoPosicaoEstrutural,
      itemPpu,
      colaborador,
      identificador,
      tipoLigacao,
      diasDisponibilidade,
      diasAusencia,
    });
  }

  // ===========================================================================
  // 6. VALIDAÇÃO DE PERÍODO / BLOQUEIO OBRIGATÓRIO (Critério de Aceite 3)
  // "Na importação, se o ciclo das linhas da MC for diferente do período informado
  // no cabeçalho, BLOQUEAR a carga e mostrar a mensagem:
  // 'O ciclo das linhas (dd/mm a dd/mm) não corresponde à competência informada.
  // Atualize a MC e importe novamente.'"
  // ===========================================================================
  let bloqueado = false;
  let mensagemBloqueio: string | undefined;

  const cicloEsperadoCompetencia = cicloEsperado.texto;
  const cicloCabecalhoTexto = cicloCabecalhoInfo ? cicloCabecalhoInfo.texto : cicloEsperadoCompetencia;

  if (cicloLinhasDetectado) {
    if (cicloLinhasDetectado !== cicloCabecalhoTexto || cicloLinhasDetectado !== cicloEsperadoCompetencia) {
      bloqueado = true;
      mensagemBloqueio = `O ciclo das linhas (${cicloLinhasDetectado}) não corresponde à competência informada. Atualize a MC e importe novamente.`;
    }
  }

  return {
    sucesso: !bloqueado,
    bloqueado,
    mensagemBloqueio,
    competencia,
    cicloCabecalho: cicloCabecalhoTexto,
    cicloLinhas: cicloLinhasDetectado,
    totalLinhasLidas,
    totalImportado: bloqueado ? 0 : linhasLigadas.length,
    totalIgnorado: itensIgnorados.length,
    inconsistencias,
    pessoasAAlocar,
    itensIgnorados,
    linhasLigadas,
  };
}

/**
 * Confirma a importação da MC gerando registro de lote quando não estiver bloqueada.
 */
export function confirmarImportacaoMC(
  resultado: ResultadoImportacaoMC,
  usuario: string = "Administrador Premier"
): {
  sucesso: boolean;
  loteId: string;
  mensagem: string;
} {
  if (resultado.bloqueado) {
    throw new Error(
      resultado.mensagemBloqueio || "A importação está bloqueada devido a divergência no ciclo de medição."
    );
  }

  const loteId = `LOTE-MC-${Date.now().toString(36).toUpperCase()}`;
  return {
    sucesso: true,
    loteId,
    mensagem: `Memória de Cálculo da competência ${resultado.competencia} importada com sucesso: ${resultado.totalImportado} registros vinculados, ${resultado.totalIgnorado} ignorados, ${resultado.pessoasAAlocar.length} a alocar.`,
  };
}

/**
 * Simula a importação da MC a partir de arquivo em disco ou buffer (para testes e tela).
 */
export function simularImportacaoMC(
  caminhoOuBuffer: string | ArrayBuffer | Buffer,
  competencia: string = "2026-09",
  diaInicioCiclo: number = 10,
  diaFimCiclo: number = 9
): ResultadoImportacaoMC {
  let wb: XLSX.WorkBook;
  if (typeof caminhoOuBuffer === "string") {
    wb = XLSX.readFile(caminhoOuBuffer);
  } else {
    wb = XLSX.read(caminhoOuBuffer, { type: "buffer" });
  }

  return processarMemoriaCalculo(wb, { competencia, diaInicioCiclo, diaFimCiclo });
}

