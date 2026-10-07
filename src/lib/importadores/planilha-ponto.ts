/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Motor de Importação de Planilhas de Ponto (.xlsx, .xls, .csv) com Mapeamento Configurável
 *
 * Finalidade estrita: GESTÃO de presença, ausência e postos contratuais.
 * Minimização LGPD: Descarte sumário de fotos, IPs, geolocalização e nomes do arquivo de ponto.
 */

import * as XLSX from "xlsx";
import {
  MarcacaoPontoOriginal,
  MapeamentoColunasPonto,
  ResultadoImportacaoPonto,
} from "@/lib/dados/ponto-tipos";
import { ItemInconsistencia } from "@/lib/importadores/rm-funcionarios";

export type { MapeamentoColunasPonto };
import {
  obterFusoHorarioBase,
  converterLocalParaUtc,
} from "@/lib/dados/secoes-horarios";
import { salvarLotePonto, carregarEstado } from "@/lib/dados/estado-operacional";
import {
  obterPeriodoCompetencia,
  marcarCalendarioDesatualizado,
} from "../servicos/calendario-competencia";

export interface ColaboradorReferenciaPonto {
  id: string;
  chapa: string;
  cpfLimpo: string;
  pis?: string;
  nome: string;
  unidadeId: string;
  situacao: string;
  dataDesligamento?: string;
}

export interface OpcoesImportacaoPlanilhaPonto {
  arquivoNome: string;
  loteId: string;
  bufferOuArray: ArrayBuffer | Uint8Array;
  colaboradores: ColaboradorReferenciaPonto[];
  modelosConfigurados?: MapeamentoColunasPonto[];
  modeloIdForcado?: string;
  basePadraoId?: string;
  marcaçõesExistentes?: MarcacaoPontoOriginal[];
  competencia?: string;
  dataExtracao?: string;
}

/**
 * Modelos de fábrica pré-configurados
 */
export const MODELOS_PADRAO_PONTO: MapeamentoColunasPonto[] = [
  {
    id: "modelo-cubo-registros-rm",
    nomeModelo: "Cubo de Registros – RM (Múltiplas Batidas)",
    colunaIdentificador: "CHAPA",
    tipoIdentificador: "CHAPA",
    colunaData: "DATA",
    formatoData: "DD/MM/YYYY",
    formatoHora: "HH:MM:SS",
    colunasMultiplasBatidas: {
      ent1: "ENT1",
      sai1: "SAI1",
      ent2: "ENT2",
      sai2: "SAI2",
      ent3: "ENT3",
      sai3: "SAI3",
    },
    colunaEquipamento: "DESC. SECAO",
    padrao: true,
  },
  {
    id: "modelo-rhid-padrao",
    nomeModelo: "RHID – Exportação Padrão",
    colunaIdentificador: "CPF",
    tipoIdentificador: "CPF",
    colunaData: "DATA",
    formatoData: "DD/MM/YYYY",
    colunaHora: "HORA",
    formatoHora: "HH:MM",
    colunaNsr: "NSR",
    colunaEquipamento: "EQUIPAMENTO",
    padrao: false,
  },
];

const CHAVE_STORAGE_MODELOS_PONTO = "sgp_modelos_ponto_configurados_v1";

/**
 * Carrega modelos de mapeamento de ponto
 */
export function carregarModelosPonto(): MapeamentoColunasPonto[] {
  if (typeof window !== "undefined") {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE_MODELOS_PONTO);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
  }
  return MODELOS_PADRAO_PONTO;
}

/**
 * Salva modelos de mapeamento de ponto
 */
export function salvarModelosPonto(modelos: MapeamentoColunasPonto[]) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHAVE_STORAGE_MODELOS_PONTO, JSON.stringify(modelos));
    } catch {
      // Erro silencioso
    }
  }
}

/**
 * Detecta o melhor modelo para os cabeçalhos da planilha
 */
export function detectarModeloPonto(
  cabecalhos: string[],
  modelos: MapeamentoColunasPonto[] = carregarModelosPonto()
): MapeamentoColunasPonto | null {
  const normalizados = cabecalhos.map((c) =>
    (c || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  );

  // 1. Testa Cubo de Registros RM (se tem CHAPA, DATA e ENT1)
  const temChapa = normalizados.some((c) => c === "CHAPA");
  const temData = normalizados.some((c) => c === "DATA");
  const temEnt1 = normalizados.some((c) => c === "ENT1");

  if (temChapa && temData && temEnt1) {
    const mCubo = modelos.find((m) => m.id === "modelo-cubo-registros-rm");
    if (mCubo) return mCubo;
  }

  // 2. Testa RHID padrão
  const temCpf = normalizados.some((c) => c === "CPF");
  const temHora = normalizados.some((c) => c === "HORA");
  if ((temCpf || temChapa) && temData && temHora) {
    const mRhid = modelos.find((m) => m.id === "modelo-rhid-padrao");
    if (mRhid) return mRhid;
  }

  // 3. Testa outros modelos pelo maior match de colunas
  let melhorModelo: MapeamentoColunasPonto | null = null;
  let maxPontos = 0;

  for (const mod of modelos) {
    let pontos = 0;
    const colIdNorm = (mod.colunaIdentificador || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const colDtNorm = (mod.colunaData || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const colHrNorm = (mod.colunaHora || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (normalizados.includes(colIdNorm)) pontos += 2;
    if (normalizados.includes(colDtNorm)) pontos += 2;
    if (colHrNorm && normalizados.includes(colHrNorm)) pontos += 2;

    if (pontos > maxPontos) {
      maxPontos = pontos;
      melhorModelo = mod;
    }
  }

  return maxPontos >= 4 ? melhorModelo : null;
}

/**
 * Normaliza número de CPF para 11 dígitos com zeros à esquerda
 */
export function normalizarCpf(valor: any): string {
  if (valor === undefined || valor === null) return "";
  const str = String(valor).trim().replace(/\D/g, "");
  if (str.length === 0) return "";
  return str.padStart(11, "0");
}

/**
 * Normaliza número de Chapa para 6 dígitos
 */
export function normalizarChapa(valor: any): string {
  if (valor === undefined || valor === null) return "";
  const str = String(valor).trim();
  const apenasDigitos = str.replace(/\D/g, "");
  if (apenasDigitos.length === 0) return "";
  return apenasDigitos.padStart(6, "0");
}

/**
 * Converte data da planilha em string YYYY-MM-DD
 */
export function converterDataPlanilha(valor: any): string | null {
  if (!valor) return null;

  // Número serial do Excel
  if (typeof valor === "number") {
    // 25569 = 01/01/1970
    const dataJs = new Date(Math.round((valor - 25569) * 86400 * 1000));
    const a = dataJs.getUTCFullYear();
    const m = String(dataJs.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dataJs.getUTCDate()).padStart(2, "0");
    return `${a}-${m}-${d}`;
  }

  const str = String(valor).trim();

  // Formato DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  return null;
}

/**
 * Converte hora da planilha em HH:MM ou HH:MM:SS
 */
export function converterHoraPlanilha(valor: any): string | null {
  if (valor === undefined || valor === null || valor === "") return null;

  // Número decimal do Excel (fração de dia)
  if (typeof valor === "number") {
    const totalSegundos = Math.round(valor * 86400);
    const h = Math.floor(totalSegundos / 3600);
    const m = Math.floor((totalSegundos % 3600) / 60);
    const s = totalSegundos % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const str = String(valor).trim();

  // HH:MM ou HH:MM:SS
  const matchHora = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (matchHora) {
    const h = matchHora[1].padStart(2, "0");
    const m = matchHora[2];
    return `${h}:${m}`;
  }

  return null;
}

/**
 * Calcula hash SHA-256 do arquivo
 */
async function calcularHashSha256Buffer(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  try {
    const cryptoNode = await import("crypto");
    return cryptoNode.createHash("sha256").update(Buffer.from(buffer as any)).digest("hex");
  } catch {
    return "hash-" + Math.random().toString(36).substring(2, 12);
  }
}

/**
 * Processa a planilha de ponto e extrai as marcações originais.
 */
export async function processarPlanilhaPonto(
  opcoes: OpcoesImportacaoPlanilhaPonto
): Promise<ResultadoImportacaoPonto> {
  const {
    arquivoNome,
    loteId,
    bufferOuArray,
    colaboradores,
    modelosConfigurados = carregarModelosPonto(),
    modeloIdForcado,
    basePadraoId = "UFN-III",
    marcaçõesExistentes = [],
  } = opcoes;

  const hashSha256 = await calcularHashSha256Buffer(bufferOuArray);
  const dataExecucao = new Date().toISOString();

  // Indexação de colaboradores
  const mapaColaboradoresCpf = new Map<string, ColaboradorReferenciaPonto>();
  const mapaColaboradoresChapa = new Map<string, ColaboradorReferenciaPonto>();
  const mapaColaboradoresPis = new Map<string, ColaboradorReferenciaPonto>();

  for (const c of colaboradores) {
    if (c.cpfLimpo) mapaColaboradoresCpf.set(c.cpfLimpo, c);
    if (c.chapa) mapaColaboradoresChapa.set(c.chapa.padStart(6, "0"), c);
    if (c.pis) mapaColaboradoresPis.set(c.pis.replace(/\D/g, ""), c);
  }

  // Set de chaves existentes para evitar duplicidade
  const setMarcacoesExistentes = new Set<string>();
  for (const m of marcaçõesExistentes) {
    const chave = `${m.colaboradorId}_${m.dataHoraUtc.substring(0, 16)}_${m.nsr || "S_NSR"}`;
    setMarcacoesExistentes.add(chave);
  }

  const wb = XLSX.read(bufferOuArray, { type: "buffer", raw: false });
  const primeiraAbaNome = wb.SheetNames[0];
  const ws = wb.Sheets[primeiraAbaNome];

  // Converte com header na primeira linha
  const linhasMatriz: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const resultado: ResultadoImportacaoPonto = {
    sucesso: false,
    loteId,
    arquivoNome,
    formato: "PLANILHA",
    hashSha256,
    dataReferenciaLote: "",
    dataExecucao,
    totais: {
      linhasLidas: 0,
      marcacoesNovas: 0,
      marcacoesJaImportadas: 0,
      colaboradoresNaoEncontrados: 0,
      alertasDemitidos: 0,
      inconsistenciasEstruturais: 0,
    },
    inconsistencias: [],
    marcacoesImportadas: [],
  };

  if (!linhasMatriz || linhasMatriz.length < 2) {
    resultado.inconsistencias.push({
      linha: 1,
      motivo: "Planilha vazia ou sem linhas de dados.",
      gravidade: "ERRO",
    });
    resultado.totais.inconsistenciasEstruturais++;
    return resultado;
  }

  let idxLinhaCabecalho = 0;
  let cabecalho = (linhasMatriz[0] || []).map((c) => String(c || "").trim());

  // Se a linha 1 não contém termos de cabeçalho comuns mas a linha 2 contém (ex: cabeçalho na linha 2 do RM Chronus):
  const temTermosCabecalhoL1 = cabecalho.some((c) => {
    const n = c.toUpperCase();
    return n.includes("CHAPA") || n.includes("CPF") || n.includes("DATA");
  });

  if (!temTermosCabecalhoL1 && linhasMatriz.length > 1) {
    const cabL2 = (linhasMatriz[1] || []).map((c) => String(c || "").trim());
    const temTermosCabecalhoL2 = cabL2.some((c) => {
      const n = c.toUpperCase();
      return n.includes("CHAPA") || n.includes("CPF") || n.includes("DATA");
    });
    if (temTermosCabecalhoL2) {
      idxLinhaCabecalho = 1;
      cabecalho = cabL2;
    }
  }

  // Localiza ou detecta o modelo
  let modelo: MapeamentoColunasPonto | null = null;
  if (modeloIdForcado) {
    modelo = modelosConfigurados.find((m) => m.id === modeloIdForcado) || null;
  }
  if (!modelo) {
    modelo = detectarModeloPonto(cabecalho, modelosConfigurados);
  }

  if (!modelo) {
    resultado.inconsistencias.push({
      linha: idxLinhaCabecalho + 1,
      motivo:
        "Cabeçalhos da planilha não reconhecidos automaticamente por nenhum modelo cadastrado. Configure um modelo em Administração.",
      gravidade: "ERRO",
    });
    resultado.totais.inconsistenciasEstruturais++;
    return resultado;
  }

  resultado.modeloUtilizado = modelo.nomeModelo;

  // Mapa de nome de coluna para índice
  const mapaIndices = new Map<string, number>();
  cabecalho.forEach((nome, idx) => {
    mapaIndices.set(nome.toUpperCase(), idx);
  });

  const idxId = mapaIndices.get(modelo.colunaIdentificador.toUpperCase());
  const idxData = mapaIndices.get(modelo.colunaData.toUpperCase());

  if (idxId === undefined || idxData === undefined) {
    resultado.inconsistencias.push({
      linha: idxLinhaCabecalho + 1,
      motivo: `Colunas obrigatórias ('${modelo.colunaIdentificador}' ou '${modelo.colunaData}') não encontradas na planilha.`,
      gravidade: "ERRO",
    });
    resultado.totais.inconsistenciasEstruturais++;
    return resultado;
  }

  const idxHora = modelo.colunaHora ? mapaIndices.get(modelo.colunaHora.toUpperCase()) : undefined;
  const idxNsr = modelo.colunaNsr ? mapaIndices.get(modelo.colunaNsr.toUpperCase()) : undefined;
  const idxEquip = modelo.colunaEquipamento ? mapaIndices.get(modelo.colunaEquipamento.toUpperCase()) : undefined;

  // Se o modelo tem colunas de múltiplas batidas (ex: Cubo de Registros)
  const indicesMultiplas: { rotulo: string; idx: number }[] = [];
  if (modelo.colunasMultiplasBatidas) {
    const mb = modelo.colunasMultiplasBatidas;
    if (mb.ent1 && mapaIndices.has(mb.ent1.toUpperCase())) indicesMultiplas.push({ rotulo: "ENT1", idx: mapaIndices.get(mb.ent1.toUpperCase())! });
    if (mb.sai1 && mapaIndices.has(mb.sai1.toUpperCase())) indicesMultiplas.push({ rotulo: "SAI1", idx: mapaIndices.get(mb.sai1.toUpperCase())! });
    if (mb.ent2 && mapaIndices.has(mb.ent2.toUpperCase())) indicesMultiplas.push({ rotulo: "ENT2", idx: mapaIndices.get(mb.ent2.toUpperCase())! });
    if (mb.sai2 && mapaIndices.has(mb.sai2.toUpperCase())) indicesMultiplas.push({ rotulo: "SAI2", idx: mapaIndices.get(mb.sai2.toUpperCase())! });
    if (mb.ent3 && mapaIndices.has(mb.ent3.toUpperCase())) indicesMultiplas.push({ rotulo: "ENT3", idx: mapaIndices.get(mb.ent3.toUpperCase())! });
    if (mb.sai3 && mapaIndices.has(mb.sai3.toUpperCase())) indicesMultiplas.push({ rotulo: "SAI3", idx: mapaIndices.get(mb.sai3.toUpperCase())! });
  }

  // Índices analíticos do Cubo RM (horas previstas e falta apontada)
  const idxHoraBase = mapaIndices.get("HORA_BASE2") ?? mapaIndices.get("HORA_BASE") ?? mapaIndices.get("HORABASE");
  const idxFalta = mapaIndices.get("FALTA2") ?? mapaIndices.get("FALTA") ?? mapaIndices.get("FALTAS");
  const diasSemJornadaSet = new Set<string>();

  let dataHoraMaisRecenteMs = 0;
  let dataHoraMaisRecenteStr = "";

  const estadoOcorrencias = carregarEstado().ocorrencias || [];

  // Itera linhas de dados (começando após a linha de cabeçalho)
  for (let i = idxLinhaCabecalho + 1; i < linhasMatriz.length; i++) {
    const linha = linhasMatriz[i];
    const numLinha = i + 1;

    // Linha vazia ou com "Total Geral"
    if (!linha || linha.every((cel) => cel === "" || cel === undefined || cel === null)) {
      continue;
    }
    if (linha.some((cel) => String(cel || "").toUpperCase().includes("TOTAL GERAL"))) {
      continue;
    }

    resultado.totais.linhasLidas++;

    const valId = linha[idxId];
    const valData = linha[idxData];

    if (!valId || !valData) {
      continue;
    }

    const dataFormatada = converterDataPlanilha(valData);
    if (!dataFormatada) {
      resultado.inconsistencias.push({
        linha: numLinha,
        motivo: `Formato de data inválido ('${valData}') na linha ${numLinha}.`,
        gravidade: "ALERTA",
      });
      continue;
    }

    // Regra: Linhas com data fora da competência -> rejeitar
    if (opcoes.competencia) {
      const periodo = obterPeriodoCompetencia(opcoes.competencia);
      if (dataFormatada < periodo.dataInicio || dataFormatada > periodo.dataFim) {
        resultado.inconsistencias.push({
          linha: numLinha,
          identificador: String(valId),
          motivo: `Data ${dataFormatada} fora da competência selecionada (${periodo.textoFormatado}).`,
          gravidade: "ERRO",
        });
        resultado.totais.inconsistenciasEstruturais++;
        continue;
      }
    }

    // Identificação do colaborador
    const chapaNormalizada = normalizarChapa(valId);
    const cpfNormalizado = normalizarCpf(valId);

    let colaboradorEncontrado: ColaboradorReferenciaPonto | undefined;

    // Prioridade: CPF -> PIS -> Chapa
    if (cpfNormalizado && mapaColaboradoresCpf.has(cpfNormalizado)) {
      colaboradorEncontrado = mapaColaboradoresCpf.get(cpfNormalizado);
    } else if (chapaNormalizada && mapaColaboradoresChapa.has(chapaNormalizada)) {
      colaboradorEncontrado = mapaColaboradoresChapa.get(chapaNormalizada);
    }

    // Se o valorId tiver 11 dígitos de PIS
    if (!colaboradorEncontrado) {
      const pisNormalizado = String(valId).replace(/\D/g, "");
      if (pisNormalizado && mapaColaboradoresPis.has(pisNormalizado)) {
        colaboradorEncontrado = mapaColaboradoresPis.get(pisNormalizado);
      }
    }

    // Regra: Rejeitar CHAPA que não esteja no cadastro da competência
    if (!colaboradorEncontrado) {
      resultado.inconsistencias.push({
        linha: numLinha,
        identificador: String(valId),
        motivo: `Colaborador com chapa/identificador '${valId}' não encontrado no cadastro RM da competência.`,
        gravidade: "ERRO",
      });
      resultado.totais.colaboradoresNaoEncontrados++;
      continue;
    }

    // Alerta se demitido
    if (colaboradorEncontrado.dataDesligamento && dataFormatada > colaboradorEncontrado.dataDesligamento) {
      resultado.inconsistencias.push({
        linha: numLinha,
        identificador: colaboradorEncontrado.chapa,
        motivo: `Colaborador ${colaboradorEncontrado.nome} (Chapa ${colaboradorEncontrado.chapa}) possui marcação em ${dataFormatada}, após sua demissão (${colaboradorEncontrado.dataDesligamento}).`,
        gravidade: "ALERTA",
      });
      resultado.totais.alertasDemitidos++;
    }

    const baseId = colaboradorEncontrado.unidadeId || basePadraoId;
    const fuso = obterFusoHorarioBase(baseId);

    const valNsr = idxNsr !== undefined ? String(linha[idxNsr] || "").trim() : undefined;
    const valEquip = idxEquip !== undefined ? String(linha[idxEquip] || "").trim() : "Planilha Ponto";

    // Extração das horas da linha:
    const horasParaProcessar: { hora: string; nsrComp?: string }[] = [];

    if (indicesMultiplas.length > 0) {
      // Múltiplas batidas por linha (ENT1, SAI1, ENT2, etc.)
      for (const mb of indicesMultiplas) {
        const celHora = linha[mb.idx];
        const horaFormatada = converterHoraPlanilha(celHora);
        if (horaFormatada) {
          horasParaProcessar.push({
            hora: horaFormatada,
            nsrComp: `${valNsr || "BAT"}-${mb.rotulo}`,
          });
        }
      }
    } else if (idxHora !== undefined) {
      // Linha única com coluna de hora
      const celHora = linha[idxHora];
      const horaFormatada = converterHoraPlanilha(celHora);
      if (horaFormatada) {
        horasParaProcessar.push({
          hora: horaFormatada,
          nsrComp: valNsr,
        });
      }
    }

    // Alertas (não rejeitar):
    // 1. Marcação ímpar
    if (horasParaProcessar.length > 0 && horasParaProcessar.length % 2 !== 0) {
      resultado.inconsistencias.push({
        linha: numLinha,
        identificador: colaboradorEncontrado.chapa,
        motivo: `Marcação ímpar detectada (${horasParaProcessar.length} batidas registradas no dia).`,
        gravidade: "ALERTA",
      });
    }

    // 2. Trabalho em dia com HORA_BASE = 0
    if (idxHoraBase !== undefined && horasParaProcessar.length > 0) {
      const rawHb = String(linha[idxHoraBase] || "").trim();
      if (rawHb === "0" || rawHb === "0,0" || rawHb === "00:00" || rawHb === "0.0") {
        resultado.inconsistencias.push({
          linha: numLinha,
          identificador: colaboradorEncontrado.chapa,
          motivo: `Trabalho registrado em dia com HORA_BASE = 0.`,
          gravidade: "ALERTA",
        });
      }
    }

    // 3. Ponto dentro de período de férias ou afastamento
    if (horasParaProcessar.length > 0) {
      const temAfastamentoNoDia = estadoOcorrencias.some(
        (o) =>
          o.matricula === colaboradorEncontrado!.chapa &&
          dataFormatada >= o.dataInicio &&
          dataFormatada <= (o.dataFim || o.dataInicio) &&
          (o.tipoOcorrencia === "FERIAS" ||
            o.categoriaAusencia === "Férias" ||
            o.categoriaAusencia === "Afastamento" ||
            o.categoriaAusencia === "Licença")
      );
      if (temAfastamentoNoDia) {
        resultado.inconsistencias.push({
          linha: numLinha,
          identificador: colaboradorEncontrado.chapa,
          motivo: `Ponto registrado dentro de período de férias ou afastamento do colaborador.`,
          gravidade: "ALERTA",
        });
      }
    }

    // Se a linha não possui nenhuma batida preenchida (ex: folga, compensação ou falta)
    if (horasParaProcessar.length === 0) {
      if (idxHoraBase !== undefined) {
        const valBase = Number(linha[idxHoraBase] || 0);
        const valFalta = idxFalta !== undefined ? Number(linha[idxFalta] || 0) : 0;
        // HORA_BASE2 == 0 e FALTA2 == 0: RM define expressamente que o dia não tem previsão de trabalho
        if (valBase === 0 && valFalta === 0) {
          diasSemJornadaSet.add(`${colaboradorEncontrado.chapa}_${dataFormatada}`);
        }
      }
      continue;
    }

    // Gera marcações para cada hora detectada
    for (const itemHora of horasParaProcessar) {
      const dataHoraUtcIso = converterLocalParaUtc(dataFormatada, itemHora.hora, fuso);

      const dtMs = new Date(dataHoraUtcIso).getTime();
      if (dtMs > dataHoraMaisRecenteMs) {
        dataHoraMaisRecenteMs = dtMs;
        dataHoraMaisRecenteStr = `${dataFormatada} ${itemHora.hora}`;
      }

      const chaveDuplicidade = `${colaboradorEncontrado.id}_${dataHoraUtcIso.substring(0, 16)}_${itemHora.nsrComp || "S_NSR"}`;

      if (setMarcacoesExistentes.has(chaveDuplicidade)) {
        resultado.totais.marcacoesJaImportadas++;
        continue;
      }

      setMarcacoesExistentes.add(chaveDuplicidade);

      const marcacao: MarcacaoPontoOriginal = {
        id: `MK-${colaboradorEncontrado.chapa}-${dataHoraUtcIso.replace(/[-:]/g, "").replace(/\..+/, "")}-${itemHora.nsrComp || "S_NSR"}`,
        loteId,
        arquivoOrigem: arquivoNome,
        colaboradorId: colaboradorEncontrado.id,
        chapa: colaboradorEncontrado.chapa,
        cpfLimpo: colaboradorEncontrado.cpfLimpo,
        dataHoraUtc: dataHoraUtcIso,
        dataLocal: dataFormatada,
        horaLocal: itemHora.hora,
        nsr: itemHora.nsrComp,
        equipamentoOrigem: valEquip,
        importadoEm: dataExecucao,
      };

      resultado.marcacoesImportadas.push(marcacao);
      resultado.totais.marcacoesNovas++;
    }
  }

  resultado.sucesso = resultado.totais.inconsistenciasEstruturais === 0;
  resultado.dataReferenciaLote = dataHoraMaisRecenteStr;
  resultado.diasSemJornadaPrevista = Array.from(diasSemJornadaSet);

  return resultado;
}

/**
 * Gera relatório de validação XLSX completo com abas Resumo, Marcações e Inconsistências
 */
export function gerarRelatorioValidacaoPontoXlsx(resultado: ResultadoImportacaoPonto): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo
  const resumo = [
    { Indicador: "Arquivo Processado", Valor: resultado.arquivoNome },
    { Indicador: "Formato do Arquivo", Valor: resultado.formato },
    { Indicador: "Modelo Utilizado", Valor: resultado.modeloUtilizado || "Padrão" },
    { Indicador: "Hash SHA-256", Valor: resultado.hashSha256 },
    { Indicador: "Data de Referência Mais Recente", Valor: resultado.dataReferenciaLote || "Não apurada" },
    { Indicador: "Data de Execução da Importação", Valor: resultado.dataExecucao },
    { Indicador: "Total de Linhas Lidas", Valor: resultado.totais.linhasLidas },
    { Indicador: "Novas Marcações Extraídas", Valor: resultado.totais.marcacoesNovas },
    { Indicador: "Marcações Já Importadas (Ignoradas)", Valor: resultado.totais.marcacoesJaImportadas },
    { Indicador: "Colaboradores Não Encontrados", Valor: resultado.totais.colaboradoresNaoEncontrados },
    { Indicador: "Alertas de Colaboradores Demitidos", Valor: resultado.totais.alertasDemitidos },
    { Indicador: "Inconsistências Estruturais", Valor: resultado.totais.inconsistenciasEstruturais },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Aba 2: Marcações Extraídas
  const marcacoesAba = resultado.marcacoesImportadas.map((m) => ({
    Chapa: m.chapa,
    Data_Local: m.dataLocal,
    Hora_Local: m.horaLocal,
    DataHora_UTC: m.dataHoraUtc,
    NSR: m.nsr || "",
    Origem: m.equipamentoOrigem || "",
  }));
  const wsMarcacoes = XLSX.utils.json_to_sheet(marcacoesAba);
  XLSX.utils.book_append_sheet(wb, wsMarcacoes, "Marcações");

  // Aba 3: Inconsistências
  const inconsistenciasAba = resultado.inconsistencias.map((inc) => ({
    Linha: inc.linha,
    Identificador: inc.identificador || "",
    Gravidade: inc.gravidade,
    Motivo: inc.motivo,
  }));
  const wsInconsistencias = XLSX.utils.json_to_sheet(
    inconsistenciasAba.length > 0 ? inconsistenciasAba : [{ Mensagem: "Nenhuma inconsistência detectada." }]
  );
  XLSX.utils.book_append_sheet(wb, wsInconsistencias, "Inconsistências");

  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buffer);
}

/**
 * Gera arquivo XLSX modelo para download
 */
export function gerarModeloPontoXlsx(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const dadosExemplo = [
    {
      "COD.SECÃO": "1.01.080.023",
      "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
      CHAPA: "037196",
      CPF: "07503191511",
      DATA: "31/08/2026",
      "DIA SEMANA": "SEG",
      ENT1: "06:59:00",
      SAI1: "12:35:00",
      ENT2: "13:38:00",
      SAI2: "16:50:00",
    },
    {
      "COD.SECÃO": "1.01.080.023",
      "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
      CHAPA: "037196",
      CPF: "07503191511",
      DATA: "01/09/2026",
      "DIA SEMANA": "TER",
      ENT1: "07:01:00",
      SAI1: "12:00:00",
      ENT2: "13:00:00",
      SAI2: "16:49:00",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(dadosExemplo);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet");
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buffer);
}

export interface ResultadoSimulacaoPonto {
  tipo: "REGISTROS_PONTO_RM" | "AFD_PONTO";
  arquivoNome: string;
  formato: "AFD" | "PLANILHA";
  modeloUtilizado?: string;
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
  linhas?: any[];
  marcacoesExtraidas: MarcacaoPontoOriginal[];
  diasSemJornadaPrevista?: string[];
  inconsistencias: ItemInconsistencia[];
  resultadoPontoCompleto: ResultadoImportacaoPonto;
}

/**
 * Simula a importação de arquivo de ponto (.xlsx, .xls, .csv ou .txt AFD)
 */
export async function simularImportacaoPonto(
  buffer: ArrayBuffer | Uint8Array,
  arquivoNome: string,
  dataReferencia: string = "2026-08-31",
  opcoes?: { competencia?: string; dataExtracao?: string }
): Promise<ResultadoSimulacaoPonto> {
  const { carregarEstado } = await import("@/lib/dados/estado-operacional");
  const estado = carregarEstado();
  const marcacoesExistentes = estado.marcacoesPonto || [];

  const colaboradoresRef: ColaboradorReferenciaPonto[] = estado.profissionais.map((p) => ({
    id: p.id,
    chapa: p.chapa,
    cpfLimpo: p.cpfLimpo,
    nome: p.nome,
    unidadeId: p.unidadeId,
    situacao: p.situacao,
    dataDesligamento: p.dataDesligamento,
  }));

  const loteIdProvisorio = `LOTE-PTO-${Date.now()}`;
  let resPonto: ResultadoImportacaoPonto;

  const ehAfd = arquivoNome.toLowerCase().endsWith(".txt");

  if (ehAfd) {
    const { processarArquivoAfd } = await import("@/lib/importadores/afd-ponto");
    const decoder = new TextDecoder("utf-8");
    const textoAfd = decoder.decode(buffer);
    resPonto = await processarArquivoAfd({
      arquivoNome,
      loteId: loteIdProvisorio,
      conteudoTexto: textoAfd,
      colaboradores: colaboradoresRef,
      marcaçõesExistentes: marcacoesExistentes,
    });
  } else {
    resPonto = await processarPlanilhaPonto({
      arquivoNome,
      loteId: loteIdProvisorio,
      bufferOuArray: buffer,
      colaboradores: colaboradoresRef,
      marcaçõesExistentes: marcacoesExistentes,
      competencia: opcoes?.competencia,
      dataExtracao: opcoes?.dataExtracao,
    });
  }

  // Verifica arquivo duplicado por hash SHA-256
  const lotesExistentes = estado.lotesImportacao || [];
  const loteDuplicado = lotesExistentes.find(
    (l) => l.hashSha256 === resPonto.hashSha256 && l.status === "CONCLUIDO"
  );

  return {
    tipo: ehAfd ? "AFD_PONTO" : "REGISTROS_PONTO_RM",
    arquivoNome,
    formato: ehAfd ? "AFD" : "PLANILHA",
    modeloUtilizado: resPonto.modeloUtilizado,
    hashSha256: resPonto.hashSha256,
    dataReferencia: resPonto.dataReferenciaLote || dataReferencia,
    competencia: opcoes?.competencia,
    dataExtracao: opcoes?.dataExtracao || dataReferencia,
    arquivoDuplicado: !!loteDuplicado,
    loteAnteriorId: loteDuplicado?.id,
    loteAnteriorData: loteDuplicado?.dataHora,
    totais: {
      lidos: resPonto.totais.linhasLidas,
      novos: resPonto.totais.marcacoesNovas,
      atualizados: 0,
      semAlteracao: resPonto.totais.marcacoesJaImportadas,
      erros: resPonto.totais.colaboradoresNaoEncontrados + resPonto.totais.inconsistenciasEstruturais,
      alertas: resPonto.totais.alertasDemitidos,
    },
    linhas: resPonto.marcacoesImportadas.map((m, idx) => ({
      linha: idx + 1,
      validaParaGravacao: true,
      dados: {
        chapa: m.chapa,
        nome: m.chapa,
        secaoDescricao: m.equipamentoOrigem || "Ponto",
        funcao: `${m.dataLocal} ${m.horaLocal}`,
      },
    })),
    marcacoesExtraidas: resPonto.marcacoesImportadas,
    diasSemJornadaPrevista: resPonto.diasSemJornadaPrevista,
    inconsistencias: resPonto.inconsistencias.map((inc) => ({
      linha: inc.linha,
      chapa: inc.identificador,
      tipo: inc.gravidade,
      coluna: inc.campo,
      mensagem: inc.motivo,
    })),
    resultadoPontoCompleto: resPonto,
  };
}

/**
 * Confirma a importação do lote de ponto
 */
export function confirmarImportacaoPonto(
  simulacao: ResultadoSimulacaoPonto,
  usuarioLogado: string = "Administrador Premier"
): { sucesso: boolean; loteId: string; mensagem: string } {
  const loteId = `LOTE-PTO-${new Date().toISOString().replace(/\D/g, "").substring(0, 14)}`;

  const marcacoesComLote = simulacao.marcacoesExtraidas.map((m) => ({
    ...m,
    loteId,
  }));

  const loteObj = {
    id: loteId,
    tipo: simulacao.tipo,
    competencia: simulacao.competencia,
    dataExtracao: simulacao.dataExtracao,
    linhasRejeitadas: simulacao.totais.erros,
    arquivoNome: simulacao.arquivoNome,
    hashSha256: simulacao.hashSha256,
    dataReferencia: simulacao.dataReferencia,
    usuario: usuarioLogado,
    dataHora: new Date().toISOString().replace("T", " ").substring(0, 19),
    totais: simulacao.totais,
    status: "CONCLUIDO" as const,
    diasRetencao: 90,
  };

  salvarLotePonto(
    loteObj,
    marcacoesComLote,
    [],
    simulacao.resultadoPontoCompleto?.diasSemJornadaPrevista || []
  );

  if (simulacao.competencia) {
    marcarCalendarioDesatualizado(simulacao.competencia);
  }

  return {
    sucesso: true,
    loteId,
    mensagem: `Lote de ponto ${loteId} confirmado com sucesso. ${simulacao.totais.novos} marcações importadas.`,
  };
}


