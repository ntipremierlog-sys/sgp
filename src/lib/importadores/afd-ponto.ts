/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Leitor e Validador de Arquivo Fonte de Dados (AFD) — Portaria MTP nº 671/2021 (Anexo V)
 *
 * STATUS: PENDENTE DE VALIDAÇÃO OFICIAL EM AMBIENTE HOMOLOGADO REP - PORTARIA 671/2021 ANEXO V
 * AVISO: Implementação isolada conforme especificações técnicas normativas. Requer homologação formal
 * perante arquivos de telemetria emitidos por registradores eletrônicos de ponto (REP-C/REP-A/REP-P).
 */

import {
  MarcacaoPontoOriginal,
  ResultadoImportacaoPonto,
} from "@/lib/dados/ponto-tipos";
import {
  obterFusoHorarioBase,
  converterLocalParaUtc,
} from "@/lib/dados/secoes-horarios";

export const CNPJ_PREMIER_ESPERADO = "01328799000120"; // 01.328.799/0001-20

export interface ColaboradorReferenciaAfd {
  id: string;
  chapa: string;
  cpfLimpo: string;
  pis?: string;
  nome: string;
  unidadeId: string;
  situacao: string;
  dataDesligamento?: string;
}

export interface OpcoesImportacaoAfd {
  arquivoNome: string;
  loteId: string;
  conteudoTexto: string;
  colaboradores: ColaboradorReferenciaAfd[];
  basePadraoId?: string;
  marcaçõesExistentes?: MarcacaoPontoOriginal[];
}

/**
 * Calcula hash SHA-256 rápido do conteúdo
 */
async function calcularHashSha256(texto: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  try {
    // Fallback Node.js
    const cryptoNode = await import("crypto");
    return cryptoNode.createHash("sha256").update(texto).digest("hex");
  } catch {
    return "hash-" + Math.random().toString(36).substring(2, 12);
  }
}

/**
 * Processa e valida um arquivo AFD conforme Portaria 671/2021.
 * Se houver erro de estrutura em qualquer linha, rejeita o arquivo inteiro.
 */
export async function processarArquivoAfd(
  opcoes: OpcoesImportacaoAfd
): Promise<ResultadoImportacaoPonto> {
  const {
    arquivoNome,
    loteId,
    conteudoTexto,
    colaboradores,
    basePadraoId = "UFN-III",
    marcaçõesExistentes = [],
  } = opcoes;

  const hashSha256 = await calcularHashSha256(conteudoTexto);
  const dataExecucao = new Date().toISOString();

  const mapaColaboradoresCpf = new Map<string, ColaboradorReferenciaAfd>();
  const mapaColaboradoresChapa = new Map<string, ColaboradorReferenciaAfd>();
  const mapaColaboradoresPis = new Map<string, ColaboradorReferenciaAfd>();

  for (const c of colaboradores) {
    if (c.cpfLimpo) mapaColaboradoresCpf.set(c.cpfLimpo, c);
    if (c.chapa) mapaColaboradoresChapa.set(c.chapa.padStart(6, "0"), c);
    if (c.pis) mapaColaboradoresPis.set(c.pis.replace(/\D/g, ""), c);
  }

  // Set de chaves de marcações existentes para evitar duplicidade:
  // Chave: `${colaboradorId}_${dataHoraUtc}_${nsr}`
  const setMarcacoesExistentes = new Set<string>();
  for (const m of marcaçõesExistentes) {
    const chave = `${m.colaboradorId}_${m.dataHoraUtc.substring(0, 16)}_${m.nsr || "S_NSR"}`;
    setMarcacoesExistentes.add(chave);
  }

  const linhas = conteudoTexto.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const resultado: ResultadoImportacaoPonto = {
    sucesso: false,
    loteId,
    arquivoNome,
    formato: "AFD",
    hashSha256,
    dataReferenciaLote: "",
    dataExecucao,
    totais: {
      linhasLidas: linhas.length,
      marcacoesNovas: 0,
      marcacoesJaImportadas: 0,
      colaboradoresNaoEncontrados: 0,
      alertasDemitidos: 0,
      inconsistenciasEstruturais: 0,
    },
    inconsistencias: [],
    marcacoesImportadas: [],
  };

  if (linhas.length === 0) {
    resultado.inconsistencias.push({
      linha: 1,
      motivo: "Arquivo AFD vazio ou sem registros válidos.",
      gravidade: "ERRO",
    });
    resultado.totais.inconsistenciasEstruturais++;
    return resultado;
  }

  // ---------------------------------------------------------------------------
  // 1. VALIDAÇÃO DO CABEÇALHO (LINHA 1)
  // ---------------------------------------------------------------------------
  const linhaCabecalho = linhas[0];
  const _tipoCabecalho = linhaCabecalho.substring(9, 10);
  const nsrCabecalho = linhaCabecalho.substring(0, 9);

  // Formato Portaria 671 / 1510: NSR (9 zeros) + Tipo '1' (ou '0')
  if (nsrCabecalho !== "000000000" && !linhaCabecalho.startsWith("000000000")) {
    resultado.inconsistencias.push({
      linha: 1,
      motivo: `Cabeçalho AFD inválido: esperava-se NSR inicial '000000000', obtido '${nsrCabecalho}'.`,
      gravidade: "ERRO",
    });
    resultado.totais.inconsistenciasEstruturais++;
    return resultado;
  }

  // Identificador do empregador: tipo empregador (pos 10) e número (pos 11 a 24)
  const tipoIdentificadorEmpregador = linhaCabecalho.substring(9, 10); // '1' = CNPJ, '2' = CPF
  // Procurar CNPJ na linha 1
  const apenasDigitosCabecalho = linhaCabecalho.replace(/\D/g, "");
  const cnpjEncontrado = apenasDigitosCabecalho.includes(CNPJ_PREMIER_ESPERADO);

  if (!cnpjEncontrado) {
    resultado.inconsistencias.push({
      linha: 1,
      motivo: `CNPJ da empresa no cabeçalho do AFD não corresponde ao da Premier Logistics (${CNPJ_PREMIER_ESPERADO}).`,
      gravidade: "ERRO",
    });
    resultado.totais.inconsistenciasEstruturais++;
    return resultado;
  }

  // ---------------------------------------------------------------------------
  // 2. PROCESSAMENTO DAS LINHAS E VALIDAÇÃO DE NSR
  // ---------------------------------------------------------------------------
  let ultimoNsr = 0;
  let dataHoraMaisRecenteMs = 0;
  let dataHoraMaisRecenteStr = "";

  function rejeitarArquivoEstrutural(numLinha: number, motivo: string) {
    resultado.inconsistencias.push({
      linha: numLinha,
      motivo,
      gravidade: "ERRO",
    });
    resultado.totais.inconsistenciasEstruturais++;
    resultado.marcacoesImportadas = [];
    resultado.totais.marcacoesNovas = 0;
    resultado.sucesso = false;
    return resultado;
  }

  for (let i = 1; i < linhas.length; i++) {
    const numLinha = i + 1;
    const linha = linhas[i];

    if (linha.length < 10) {
      return rejeitarArquivoEstrutural(numLinha, `Linha com tamanho insuficiente (${linha.length} caracteres).`);
    }

    const nsrStr = linha.substring(0, 9);
    const nsrNum = parseInt(nsrStr, 10);

    if (isNaN(nsrNum)) {
      return rejeitarArquivoEstrutural(numLinha, `NSR '${nsrStr}' inválido ou não numérico.`);
    }

    // Validação de sequência estrita de NSR crescente
    if (nsrNum <= ultimoNsr) {
      return rejeitarArquivoEstrutural(
        numLinha,
        `Quebra de sequência de NSR na linha ${numLinha}: NSR atual (${nsrNum}) não é maior que o anterior (${ultimoNsr}).`
      );
    }
    ultimoNsr = nsrNum;

    const tipoRegistro = linha.substring(9, 10);

    // Tipos Portaria 671 / 1510:
    // '2': Inclusão/alteração de empregado -> ignorar
    // '3': Marcação de ponto -> IMPORTAR
    // '4': Ajuste de relógio -> ignorar
    // '5': Alteração empregador -> ignorar
    if (tipoRegistro !== "3") {
      // Ignorar demais tipos sem erro estrutural
      continue;
    }

    // REGISTRO TIPO 3: MARCAÇÃO DE PONTO
    // Posições 11-18: Data (DDMMAAAA)
    // Posições 19-22: Horário (HHMM)
    if (linha.length < 22) {
      return rejeitarArquivoEstrutural(numLinha, `Registro de marcação tipo 3 incompleto na linha ${numLinha}.`);
    }

    const diaStr = linha.substring(10, 12);
    const mesStr = linha.substring(12, 14);
    const anoStr = linha.substring(14, 18);
    const horaStr = linha.substring(18, 20);
    const minStr = linha.substring(20, 22);

    const dia = parseInt(diaStr, 10);
    const mes = parseInt(mesStr, 10);
    const ano = parseInt(anoStr, 10);
    const hora = parseInt(horaStr, 10);
    const min = parseInt(minStr, 10);

    if (
      isNaN(dia) || dia < 1 || dia > 31 ||
      isNaN(mes) || mes < 1 || mes > 12 ||
      isNaN(ano) || ano < 2000 || ano > 2099 ||
      isNaN(hora) || hora < 0 || hora > 23 ||
      isNaN(min) || min < 0 || min > 59
    ) {
      return rejeitarArquivoEstrutural(
        numLinha,
        `Data/hora inválida (${diaStr}/${mesStr}/${anoStr} ${horaStr}:${minStr}) na marcação.`
      );
    }

    const dataLocal = `${anoStr}-${mesStr}-${diaStr}`;
    const horaLocal = `${horaStr}:${minStr}`;

    // Identificador do empregado (CPF 11 dígitos ou PIS 11-12 dígitos)
    const restanteLinha = linha.substring(22).trim();
    const digitosRestantes = restanteLinha.replace(/\D/g, "");

    let colaboradorEncontrado: ColaboradorReferenciaAfd | undefined;
    let identificadorUsado = "";

    // 1. Tenta CPF (11 dígitos)
    if (digitosRestantes.length >= 11) {
      const possivelCpf = digitosRestantes.substring(0, 11);
      if (mapaColaboradoresCpf.has(possivelCpf)) {
        colaboradorEncontrado = mapaColaboradoresCpf.get(possivelCpf);
        identificadorUsado = possivelCpf;
      }
    }

    // 2. Tenta PIS se não achou por CPF
    if (!colaboradorEncontrado && digitosRestantes.length >= 11) {
      const possivelPis = digitosRestantes.substring(0, 11);
      if (mapaColaboradoresPis.has(possivelPis)) {
        colaboradorEncontrado = mapaColaboradoresPis.get(possivelPis);
        identificadorUsado = possivelPis;
      }
    }

    // 3. Tenta chapa se couber
    if (!colaboradorEncontrado && digitosRestantes.length >= 6) {
      const possivelChapa = digitosRestantes.substring(0, 6);
      if (mapaColaboradoresChapa.has(possivelChapa)) {
        colaboradorEncontrado = mapaColaboradoresChapa.get(possivelChapa);
        identificadorUsado = possivelChapa;
      }
    }

    if (!colaboradorEncontrado) {
      resultado.inconsistencias.push({
        linha: numLinha,
        identificador: digitosRestantes.substring(0, 11) || "Desconhecido",
        motivo: `Colaborador com identificador '${digitosRestantes.substring(0, 11)}' não encontrado no cadastro RM.`,
        gravidade: "ERRO",
      });
      resultado.totais.colaboradoresNaoEncontrados++;
      continue;
    }

    // Alerta de colaborador demitido com marcação após a demissão
    if (colaboradorEncontrado.dataDesligamento && dataLocal > colaboradorEncontrado.dataDesligamento) {
      resultado.inconsistencias.push({
        linha: numLinha,
        identificador: colaboradorEncontrado.chapa,
        motivo: `Colaborador ${colaboradorEncontrado.nome} (Chapa ${colaboradorEncontrado.chapa}) possui marcação em ${dataLocal}, posterior à data de desligamento (${colaboradorEncontrado.dataDesligamento}).`,
        gravidade: "ALERTA",
      });
      resultado.totais.alertasDemitidos++;
    }

    // Determina o fuso da base do colaborador
    const baseId = colaboradorEncontrado.unidadeId || basePadraoId;
    const fuso = obterFusoHorarioBase(baseId);
    const dataHoraUtcIso = converterLocalParaUtc(dataLocal, horaLocal, fuso);

    // Rastreia data/hora mais recente para a referência do lote
    const dtMs = new Date(dataHoraUtcIso).getTime();
    if (dtMs > dataHoraMaisRecenteMs) {
      dataHoraMaisRecenteMs = dtMs;
      dataHoraMaisRecenteStr = `${dataLocal} ${horaLocal}`;
    }

    // Chave de duplicidade: colaborador + dataHoraUtc (minuto) + nsr
    const chaveDuplicidade = `${colaboradorEncontrado.id}_${dataHoraUtcIso.substring(0, 16)}_${nsrStr}`;

    if (setMarcacoesExistentes.has(chaveDuplicidade)) {
      resultado.totais.marcacoesJaImportadas++;
      continue;
    }

    setMarcacoesExistentes.add(chaveDuplicidade);

    const marcacao: MarcacaoPontoOriginal = {
      id: `MK-${colaboradorEncontrado.chapa}-${dataHoraUtcIso.replace(/[-:]/g, "").replace(/\..+/, "")}-${nsrStr}`,
      loteId,
      arquivoOrigem: arquivoNome,
      colaboradorId: colaboradorEncontrado.id,
      chapa: colaboradorEncontrado.chapa,
      cpfLimpo: colaboradorEncontrado.cpfLimpo,
      dataHoraUtc: dataHoraUtcIso,
      dataLocal,
      horaLocal,
      nsr: nsrStr,
      equipamentoOrigem: "REP Portaria 671",
      importadoEm: dataExecucao,
    };

    resultado.marcacoesImportadas.push(marcacao);
    resultado.totais.marcacoesNovas++;
  }

  resultado.sucesso = resultado.totais.inconsistenciasEstruturais === 0;
  resultado.dataReferenciaLote = dataHoraMaisRecenteStr;

  return resultado;
}
