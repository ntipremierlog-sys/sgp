/**
 * SGP — Sistema de Gestão de Postos (Contrato Petrobras SAP 4600682336)
 * Módulo de Importação da Base Estruturada Oficial (REV02)
 *
 * Arquivo fonte: Base_Estruturada_SGP_Petrobras_REV02.xlsx
 * Hierarquia: UNIDADE → POSTO → POSIÇÃO → COLABORADOR
 *
 * Regras implementadas:
 * - Passo 1: Regras estruturais de TipoPosto e premissas
 * - Passo 2: Postos estruturais (chave técnica postoIdSGP imutável)
 * - Passo 3: Posições estruturais (quantidade conforme regras do Passo 1, NÃO por pessoas)
 * - Passo 4: Alocações vinculadas a posições (sem criar posição nova para ferista/substituto)
 * - Passo 5: Pendências RM (04_PENDENTES_RM) e Validações de cadastro (05_VALIDACOES)
 * - Passo 6: Regras de segurança (não correção automática de conflitos, marcação 'A VALIDAR', auditoria de carga)
 */

import * as XLSX from "xlsx";
import {
  TipoPosto,
  PostoEstrutural,
  PosicaoEstrutural,
  AlocacaoEstrutural,
  ColaboradorPendenteRM,
  PendenciaValidacao,
  RegistroCargaPlanilha,
  TIPOS_POSTO_CATALOGO,
  POSTOS_REV02,
  POSICOES_REV02,
  POSICOES_EXCEDENTES_REV02,
  ALOCACOES_REV02,
  PENDENTES_RM_REV02,
  VALIDACOES_REV02,
  REGISTRO_CARGA_REV02,
  POSTOS_REV04,
  POSICOES_REV04,
  FERISTAS_REV04,
  ESCALAS_REV04,
  PENDENCIAS_ESCALA_REV04,
  RELATORIO_IMPORTACAO_REV04,
  FeristaItemREV04,
  EscalaPosicaoEstrutural,
  PendenciaEscalaItem,
  LinhaRejeitadaImportacao,
  ValidacaoAutomaticaItem,
  RelatorioImportacaoREV04,
  Imovel,
  IMOVEIS_REV04,
} from "@/lib/dados/estrutura-postos";
import funcionariosReaisJson from "@/lib/dados/funcionarios-reais.json";

export interface ResultadoImportacaoREV04 {
  sucesso: boolean;
  arquivo: string;
  dataImportacao: string;
  usuario: string;
  versao: string;
  totalImoveis: number;
  imoveis: Imovel[];
  totalPostos: number;
  totalPosicoes: number;
  totalFeristas: number;
  totalEscalas: number;
  totalPendenciasEscala: number;
  totalPendentesRM: number;
  totalValidacoes: number;
  totalLinhasRejeitadasPosicoes: number;
  postos: PostoEstrutural[];
  posicoes: PosicaoEstrutural[];
  feristas: FeristaItemREV04[];
  escalas: EscalaPosicaoEstrutural[];
  pendenciasEscala: PendenciaEscalaItem[];
  pendentesRM: ColaboradorPendenteRM[];
  validacoes: PendenciaValidacao[];
  linhasRejeitadas: LinhaRejeitadaImportacao[];
  validacoesAutomaticas: {
    titularSegSexEmTurno: ValidacaoAutomaticaItem[];
    posicaoSemTitular: ValidacaoAutomaticaItem[];
    posto9hUnicaPessoaFerista: ValidacaoAutomaticaItem[];
    postoSemRegimeIdentificavel: ValidacaoAutomaticaItem[];
    colaboradorMcNaoLocalizadoRM: ValidacaoAutomaticaItem[];
  };
}

export interface ResultadoImportacaoREV02 {
  sucesso: boolean;
  arquivo: string;
  dataImportacao: string;
  usuario: string;
  versao: string;
  totalPostos: number;
  totalPosicoes: number;
  totalPosicoesExcedentesNaoCriadas: number;
  totalAlocacoes: number;
  totalPendentesRM: number;
  totalValidacoes: number;
  totalConflitosAValidar: number;
  totalFeristas?: number;
  totalEscalas?: number;
  totalPendenciasEscala?: number;
  postos: PostoEstrutural[];
  posicoes: PosicaoEstrutural[];
  alocacoes: AlocacaoEstrutural[];
  pendentesRM: ColaboradorPendenteRM[];
  validacoes: PendenciaValidacao[];
  conflitos: Array<{
    tipo: string;
    referencia: string;
    descricao: string;
    status: string;
  }>;
}

/**
 * Retorna os dados oficiais atualmente carregados da REV04
 */
export function obterDadosBaseREV04(): ResultadoImportacaoREV04 {
  return {
    sucesso: true,
    arquivo: RELATORIO_IMPORTACAO_REV04?.planilhaFonte || "Base_Estruturada_SGP_Petrobras_REV04.xlsx",
    dataImportacao: RELATORIO_IMPORTACAO_REV04?.dataGeracao || new Date().toISOString(),
    usuario: REGISTRO_CARGA_REV02.usuario,
    versao: "REV04",
    totalImoveis: IMOVEIS_REV04.length,
    imoveis: IMOVEIS_REV04,
    totalPostos: POSTOS_REV04.length,
    totalPosicoes: POSICOES_REV04.length,
    totalFeristas: FERISTAS_REV04.length,
    totalEscalas: ESCALAS_REV04.length,
    totalPendenciasEscala: PENDENCIAS_ESCALA_REV04.length,
    totalPendentesRM: PENDENTES_RM_REV02.length,
    totalValidacoes: VALIDACOES_REV02.length,
    totalLinhasRejeitadasPosicoes: RELATORIO_IMPORTACAO_REV04?.totais?.totalLinhasRejeitadasPosicoes || 8,
    postos: POSTOS_REV04,
    posicoes: POSICOES_REV04,
    feristas: FERISTAS_REV04,
    escalas: ESCALAS_REV04,
    pendenciasEscala: PENDENCIAS_ESCALA_REV04,
    pendentesRM: PENDENTES_RM_REV02,
    validacoes: VALIDACOES_REV02,
    linhasRejeitadas: RELATORIO_IMPORTACAO_REV04?.linhasRejeitadas || [],
    validacoesAutomaticas: RELATORIO_IMPORTACAO_REV04?.validacoesAutomaticas || {
      titularSegSexEmTurno: [],
      posicaoSemTitular: [],
      posto9hUnicaPessoaFerista: [],
      postoSemRegimeIdentificavel: [],
      colaboradorMcNaoLocalizadoRM: [],
    },
  };
}

/**
 * Retorna os dados oficiais atualmente carregados (retrocompatibilidade)
 */
export function obterDadosBaseREV02(): ResultadoImportacaoREV02 {
  return {
    sucesso: true,
    arquivo: REGISTRO_CARGA_REV02.arquivo,
    dataImportacao: REGISTRO_CARGA_REV02.dataImportacao,
    usuario: REGISTRO_CARGA_REV02.usuario,
    versao: REGISTRO_CARGA_REV02.versao,
    totalPostos: POSTOS_REV02.length,
    totalPosicoes: POSICOES_REV02.length,
    totalPosicoesExcedentesNaoCriadas: POSICOES_EXCEDENTES_REV02.length,
    totalAlocacoes: ALOCACOES_REV02.length,
    totalPendentesRM: PENDENTES_RM_REV02.length,
    totalValidacoes: VALIDACOES_REV02.length,
    totalConflitosAValidar: REGISTRO_CARGA_REV02.totalConflitosAValidar,
    totalFeristas: FERISTAS_REV04.length,
    totalEscalas: ESCALAS_REV04.length,
    totalPendenciasEscala: PENDENCIAS_ESCALA_REV04.length,
    postos: POSTOS_REV02,
    posicoes: POSICOES_REV02,
    alocacoes: ALOCACOES_REV02,
    pendentesRM: PENDENTES_RM_REV02,
    validacoes: VALIDACOES_REV02,
    conflitos: [
      ...POSICOES_REV02.filter((p) => p.statusValidacao === "A VALIDAR").map((p) => ({
        tipo: p.conflitoCadastro || "CONFLITO DE POSIÇÃO",
        referencia: p.codigoVisual,
        descricao: p.motivoConflito || p.observacoes,
        status: p.statusValidacao,
      })),
      ...POSICOES_EXCEDENTES_REV02.map((p) => ({
        tipo: "EXCEDE A ESTRUTURA",
        referencia: p.codigoVisual,
        descricao: p.motivoConflito || p.observacoes,
        status: p.statusValidacao,
      })),
    ],
  };
}

/**
 * Processa a planilha Base Estruturada REV04 com mapeamento oficial,
 * validações automáticas, idempotência por upsert e relatório detalhado.
 */
export function processarPlanilhaREV04(
  fonte?: ArrayBuffer | Uint8Array | Buffer | string,
  nomeArquivo: string = "Base_Estruturada_SGP_Petrobras_REV04.xlsx",
  usuario: string = "Administrador Premier"
): ResultadoImportacaoREV04 {
  let wb: XLSX.WorkBook;
  if (fonte) {
    if (typeof fonte === "string") {
      wb = XLSX.readFile(fonte);
    } else {
      wb = XLSX.read(fonte, { type: typeof Buffer !== "undefined" && Buffer.isBuffer(fonte) ? "buffer" : "array" });
    }
  } else {
    try {
      const fsMod = eval("require('fs')");
      const pathMod = eval("require('path')");
      const defaultPath = pathMod.join(process.cwd(), "Base_Estruturada_SGP_Petrobras_REV04.xlsx");
      if (fsMod.existsSync(defaultPath)) {
        wb = XLSX.readFile(defaultPath);
      } else {
        throw new Error(`Planilha oficial não encontrada no caminho: ${defaultPath}`);
      }
    } catch (err: any) {
      throw new Error(err.message || "Planilha oficial não encontrada");
    }
  }

  // ===========================================================================
  // 1. 02_POSTOS → postos (chave Posto_ID_SGP; usar Qtd_Estrutural_Confirmada)
  // Idempotente via Map<Posto_ID_SGP, PostoEstrutural>
  // ===========================================================================
  const postosSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets["02_POSTOS"] || []);
  const postosMap = new Map<string, PostoEstrutural>();

  postosSheet.forEach((row) => {
    const postoIdSGP = String(row.Posto_ID_SGP || "").trim();
    if (!postoIdSGP) return;

    const pServ = String(row.Posto_de_Servico || "").trim();
    let tipoId = "ADM_09H";
    let tipoNome = "Adm/09h";
    let qtdRegra = 1;

    if (pServ.includes("Turno/24h")) {
      tipoId = "TURNO_24H";
      tipoNome = "Turno/24h";
      qtdRegra = 4;
    } else if (pServ.includes("Turno/16h")) {
      tipoId = "TURNO_16H";
      tipoNome = "Turno/16h";
      qtdRegra = 3;
    } else if (pServ.includes("Adm/16h")) {
      tipoId = "ADM_16H";
      tipoNome = "Adm/16h";
      qtdRegra = 2;
    } else if (pServ.includes("Turno/12h")) {
      tipoId = "TURNO_12H";
      tipoNome = "Turno/12h";
      qtdRegra = 2;
    } else if (pServ.includes("Adm/12h")) {
      tipoId = "ADM_12H";
      tipoNome = "Adm/12h";
      qtdRegra = 2;
    }

    const qtdConfirmada = Number(row.Qtd_Estrutural_Confirmada || qtdRegra);

    postosMap.set(postoIdSGP, {
      postoIdSGP,
      idReferencia: row.Posto_Base,
      unidade: String(row.Unidade || "").trim(),
      itemPPU: String(row.Item_PPU || "").trim(),
      postoDeServico: pServ,
      nomenclaturaSugerida: String(row.Nomenclatura_Sugerida || "").trim(),
      municipio: String(row.Municipio || "").trim(),
      gerencia: String(row.Gerencia || "").trim(),
      periculosidade: String(row.Periculosidade || "NÃO").trim().toUpperCase() === "SIM" ? "SIM" : "NÃO",
      tipoPostoId: tipoId,
      tipoPostoNome: tipoNome,
      qtdEstruturalPremissa: qtdConfirmada,
      qtdPosicoesIDObservadas: Number(row.Qtd_Posicoes_ID_Observadas || 0),
      qtdAlocacoesMC: Number(row.Qtd_Alocacoes_MC || 0),
      statusEstrutura: String(row.Status_Estrutura || "COERENTE COM A REGRA").trim(),
      observacaoEstrutura: String(row.Observacao_Estrutura || "").trim(),
    });
  });
  const postos = Array.from(postosMap.values());

  // ===========================================================================
  // 2. 03_POSICOES → posições + titulares (chave Posicao_ID_SGP; ignorar linhas vazias)
  // REGRA OBRIGATÓRIA 1: A importação NUNCA pode criar posição a partir do sufixo da MC.
  // As posições vêm SOMENTE da aba 03_POSICOES.
  // Idempotente via Map<Posicao_ID_SGP, PosicaoEstrutural>
  // ===========================================================================
  const posicoesSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets["03_POSICOES"] || []);
  const posicoesMap = new Map<string, PosicaoEstrutural>();
  const linhasRejeitadasPosicoes: LinhaRejeitadaImportacao[] = [];

  posicoesSheet.forEach((row, idx) => {
    const posId = row.Posicao_ID_SGP ? String(row.Posicao_ID_SGP).trim() : "";
    if (!posId || !posId.startsWith("POS-")) {
      linhasRejeitadasPosicoes.push({
        aba: "03_POSICOES",
        linhaExcel: idx + 2,
        conteudo: row,
        motivo: "Linha sem Posicao_ID_SGP válido (anotação descritiva de regra operacional)",
      });
      return;
    }

    const statusMapeamento = String(row.Status_Mapeamento || "OK").trim();
    const isAValidar = statusMapeamento.includes("A VALIDAR") || row.Posicao_Sem_Titular_MC === "SIM";

    posicoesMap.set(posId, {
      posicaoIdSGP: posId,
      postoIdSGP: String(row.Posto_ID_SGP || "").trim(),
      postoBase: row.Posto_Base,
      codigoVisual: String(row.Codigo_Posicao_Estrutural || row.IDs_Luiz_Origem || "").trim(),
      idOriginalMC: String(row.IDs_Luiz_Origem || row.Codigo_Posicao_Estrutural || "").trim(),
      sufixo: Number(row.Numero_Posicao || 1),
      conflitoCadastro: isAValidar ? "REVISAR" : "OK",
      motivoConflito: String(row.Observacao || "").trim(),
      tratamentoSGP: "POSIÇÃO ESTRUTURAL CONFIRMADA",
      observacoes: String(row.Observacao || row.Observacao_Escala || "").trim(),
      statusValidacao: isAValidar ? "A VALIDAR" : "VALIDADA",
      ehEstrutural: true,
      // Titular
      titularReferencia: row.Titular_Referencia || undefined,
      chapaTitular: row.Chapa_Titular ? String(row.Chapa_Titular).trim().padStart(6, "0") : undefined,
      statusRMTitular: row.Status_RM_Titular || undefined,
      posicaoSemTitularMC: row.Posicao_Sem_Titular_MC || "NÃO",
      // Escala da posição
      horario_rm: row.Horario_RM_Titular || undefined,
      horarioRm: row.Horario_RM_Titular || undefined,
      escala_tipo: row.Escala_Tipo_Informada || undefined,
      escalaTipo: row.Escala_Tipo_Informada || undefined,
      faixa_horaria: row.Faixa_Horaria_Informada || undefined,
      faixaHoraria: row.Faixa_Horaria_Informada || undefined,
      regime_dias: row.Regime_Dias_Informado || undefined,
      regimeDias: row.Regime_Dias_Informado || undefined,
      fonte_escala: row.Fonte_Escala || undefined,
      fonteEscala: row.Fonte_Escala || undefined,
      status_programacao: row.Status_Programacao_Diaria || undefined,
      statusProgramacao: row.Status_Programacao_Diaria || undefined,
    });
  });
  const posicoes = Array.from(posicoesMap.values());

  // ===========================================================================
  // 3. 07_FERISTAS_COBERTURA → feristas + vínculos com postos
  // (mesmo colaborador em 2 postos = 1 ferista com 2 vínculos)
  // Idempotente via Map<Ferista_ID_SGP, FeristaItemREV04>
  // ===========================================================================
  const feristasSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets["07_FERISTAS_COBERTURA"] || []);
  const feristasMap = new Map<string, FeristaItemREV04>();

  feristasSheet.forEach((row) => {
    const feristaId = String(row.Ferista_ID_SGP || "").trim();
    if (!feristaId) return;

    const chapaRaw = row.Chapa_RM ? String(row.Chapa_RM).trim() : "";
    const chapaRM = chapaRaw && chapaRaw !== "undefined" ? chapaRaw.padStart(6, "0") : "";

    feristasMap.set(feristaId, {
      feristaIdSGP: feristaId,
      unidade: String(row.Unidade || "").trim(),
      postoBase: row.Posto_Base,
      postoIdSGP: String(row.Posto_ID_SGP || "").trim(),
      idLuizOriginal: String(row.ID_Luiz_Original || "").trim(),
      colaborador: String(row.Colaborador || "").trim(),
      chapaRM,
      statusRM: String(row.Status_RM || "").trim(),
      funcaoRM: String(row.Funcao_RM || "").trim(),
      horarioRM: String(row.Horario_RM || "").trim(),
      postoDeServico: String(row.Posto_de_Servico || "").trim(),
      papel: String(row.Papel || "FERISTA").trim(),
      comentarioMC: String(row.Comentario_MC || "").trim(),
    });
  });
  const feristas = Array.from(feristasMap.values());

  // ===========================================================================
  // 4. 08_ESCALAS_POSICOES → escala da posição (campos vazios permanecem vazios)
  // Idempotente via Map<Escala_ID_SGP || Posicao_ID_SGP, EscalaPosicaoEstrutural>
  // ===========================================================================
  const escalasSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets["08_ESCALAS_POSICOES"] || []);
  const escalasMap = new Map<string, EscalaPosicaoEstrutural>();

  escalasSheet.forEach((row) => {
    const escalaId = String(row.Escala_ID_SGP || "").trim();
    const posId = String(row.Posicao_ID_SGP || "").trim();
    const chave = escalaId || posId;
    if (!chave) return;

    escalasMap.set(chave, {
      escalaIdSGP: escalaId,
      posicaoIdSGP: posId,
      postoIdSGP: String(row.Posto_ID_SGP || "").trim(),
      unidade: String(row.Unidade || "").trim(),
      postoBase: row.Posto_Base,
      codigoPosicaoEstrutural: String(row.Codigo_Posicao_Estrutural || "").trim(),
      titularReferencia: row.Titular_Referencia || undefined,
      chapaTitular: row.Chapa_Titular ? String(row.Chapa_Titular).trim().padStart(6, "0") : undefined,
      horarioRMInformado: row.Horario_RM_Informado || undefined,
      escalaTipoInformada: row.Escala_Tipo_Informada || undefined,
      faixaHorariaInformada: row.Faixa_Horaria_Informada || undefined,
      regimeDiasInformado: row.Regime_Dias_Informado || undefined,
      fonteEscala: row.Fonte_Escala || undefined,
      statusProgramacaoDiaria: row.Status_Programacao_Diaria || undefined,
      observacaoEscala: row.Observacao_Escala || undefined,
    });
  });
  const escalas = Array.from(escalasMap.values());

  // ===========================================================================
  // 5. 09_PENDENCIAS_ESCALA, 04_PENDENTES_RM, 05_VALIDACOES → pendências
  // ===========================================================================
  const pendEscalaSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets["09_PENDENCIAS_ESCALA"] || []);
  const pendenciasEscala: PendenciaEscalaItem[] = pendEscalaSheet.map((row, idx) => ({
    id: `PEND-ESC-${String(idx + 1).padStart(4, "0")}`,
    prioridade: String(row.Prioridade || "ALTA").trim(),
    unidade: String(row.Unidade || "").trim(),
    postoBase: row.Posto_Base,
    posicao: String(row.Posicao || "").trim(),
    titular: String(row.Titular || "").trim(),
    horarioRM: String(row.Horario_RM || "").trim(),
    escalaInformada: String(row.Escala_Informada || "").trim(),
    dadoFaltante: String(row.Dado_Faltante || "").trim(),
    acao: String(row.Acao || "").trim(),
    status: String(row.Status || "A VALIDAR").trim(),
  }));

  const pendRmSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets["04_PENDENTES_RM"] || []);
  const pendentesRM: ColaboradorPendenteRM[] = pendRmSheet.map((row) => ({
    chapa: String(row.Chapa || "").trim().padStart(6, "0"),
    nome: String(row.Nome || "").trim(),
    statusRM: String(row.Status_RM || "Ativo").trim(),
    dataAdmissao: row.Data_Admissao,
    unidadeRM: String(row.Unidade_RM || "").trim(),
    funcaoRM: String(row.Funcao_RM || "").trim(),
    horarioRM: String(row.Horario_RM || "").trim(),
    motivo: String(row.Motivo || "").trim(),
    alocarNoSGP: String(row.Alocar_no_SGP || "A VALIDAR").trim(),
  }));

  const validacoesSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets["05_VALIDACOES"] || []);
  const validacoes: PendenciaValidacao[] = validacoesSheet.map((row, idx) => ({
    id: `VAL-${String(idx + 1).padStart(4, "0")}`,
    prioridade: String(row.Prioridade || "MÉDIA").trim().toUpperCase(),
    tipo: String(row.Tipo || "").trim(),
    unidade: String(row.Unidade || "").trim(),
    referencia: String(row.Referencia || "").trim(),
    colaboradores: String(row.Colaborador_es || "").trim(),
    achado: String(row.Achado || "").trim(),
    acaoRecomendada: String(row.Acao_Recomendada || "").trim(),
    responsavel: String(row.Responsavel_Sugerido || "Luiz").trim(),
    status: String(row.Status || "A VALIDAR").trim(),
  }));

  // ===========================================================================
  // 6. Validações automáticas que geram pendência sem bloquear a carga:
  // - titular com horário SEG/SEX em posto Turno;
  // - posição sem titular;
  // - posto 9h cuja única pessoa é ferista;
  // - posto sem regime identificável no nome;
  // - colaborador da MC não localizado no RM.
  // ===========================================================================

  // a) Titular com horário SEG/SEX em posto Turno
  const titularSegSexEmTurno: ValidacaoAutomaticaItem[] = posicoes
    .filter((p) => {
      const posto = postosMap.get(p.postoIdSGP);
      const isTurno = (posto?.postoDeServico || "").includes("Turno");
      const h = (p.horario_rm || p.regime_dias || p.escala_tipo || "").toUpperCase();
      return isTurno && (h.includes("SEG/SEX") || h.includes("5X2") || h.includes("ADMINISTRATIVO"));
    })
    .map((p) => ({
      tipo: "TITULAR_SEG_SEX_EM_TURNO",
      posicaoIdSGP: p.posicaoIdSGP,
      postoIdSGP: p.postoIdSGP,
      titular: p.titularReferencia,
      horario: p.horario_rm,
      mensagem: "Titular com horário administrativo SEG/SEX em posto de Turno contínuo",
    }));

  // b) Posição sem titular
  const posicaoSemTitular: ValidacaoAutomaticaItem[] = posicoes
    .filter(
      (p) =>
        !p.chapaTitular ||
        p.posicaoSemTitularMC === "SIM" ||
        String(p.titularReferencia || "").toUpperCase().includes("SEM TITULAR")
    )
    .map((p) => ({
      tipo: "POSICAO_SEM_TITULAR",
      posicaoIdSGP: p.posicaoIdSGP,
      postoIdSGP: p.postoIdSGP,
      mensagem: "Posição estrutural ativa sem titular confirmado na MC",
    }));

  // c) Posto 9h cuja única pessoa é ferista
  const posto9hUnicaPessoaFerista: ValidacaoAutomaticaItem[] = postos
    .filter((post) => {
      const is9h = (post.postoDeServico || "").includes("09h") || (post.postoDeServico || "").includes("9h");
      if (!is9h) return false;
      const posDoPosto = posicoes.filter((p) => p.postoIdSGP === post.postoIdSGP);
      const ferDoPosto = feristas.filter((f) => f.postoIdSGP === post.postoIdSGP);
      const temTitular = posDoPosto.some(
        (p) => p.chapaTitular && !String(p.titularReferencia || "").toUpperCase().includes("SEM TITULAR")
      );
      return !temTitular && ferDoPosto.length > 0;
    })
    .map((post) => ({
      tipo: "POSTO_9H_UNICA_PESSOA_FERISTA",
      postoIdSGP: post.postoIdSGP,
      postoDeServico: post.postoDeServico,
      mensagem: "Posto 09h cuja única pessoa identificada é ferista",
    }));

  // d) Posto sem regime identificável no nome
  const postoSemRegimeIdentificavel: ValidacaoAutomaticaItem[] = postos
    .filter((post) => {
      const s = post.postoDeServico || "";
      return !s.includes("09h") && !s.includes("9h") && !s.includes("12h") && !s.includes("16h") && !s.includes("24h");
    })
    .map((post) => ({
      tipo: "POSTO_SEM_REGIME_IDENTIFICAVEL",
      postoIdSGP: post.postoIdSGP,
      postoDeServico: post.postoDeServico,
      mensagem: "Posto sem regime de jornada identificável no nome do serviço",
    }));

  // e) Colaborador da MC não localizado no RM
  const rmChapas = new Set(
    (funcionariosReaisJson as any[]).map((f) => String(f.matricula || f.chapa || "").padStart(6, "0"))
  );
  const mapaCadastroSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets["01_MAPA_CADASTRO"] || []);
  const colaboradorMcNaoLocalizadoRM: ValidacaoAutomaticaItem[] = mapaCadastroSheet
    .filter((r) => {
      const chapa = String(r.Chapa_RM || "").trim().padStart(6, "0");
      return chapa === "000000" || !rmChapas.has(chapa);
    })
    .map((r) => ({
      tipo: "COLABORADOR_MC_NAO_LOCALIZADO_RM",
      colaborador: r.Colaborador,
      chapa: r.Chapa_RM,
      postoIdSGP: r.Posto_ID_SGP,
      mensagem: "Colaborador da MC não localizado no cadastro de funcionários RM",
    }));

  // ===========================================================================
  // 7. Extração Oficial dos Imóveis (Etapa 1 - Regra Contratual)
  // - Nome = campo Unidade
  // - Cidade/UF extraídos de Unidade_RM (ex.: "BOAVENTURA (Itaboraí - RJ)" -> Itaboraí / RJ)
  // - Status inicial: ATIVO se tiver >= 1 posição ocupada; EM_MOBILIZACAO se tiver postos e nenhuma posição ocupada
  // - Preposto por imóvel: da aba "Relatório Mensal de atividades" da MC ou mapa consolidado
  // ===========================================================================
  const prepostosMap = new Map<string, string>();
  const sheetAtiv = wb.Sheets["Relatório Mensal de atividades"];
  if (sheetAtiv) {
    const ativRows = XLSX.utils.sheet_to_json<any>(sheetAtiv);
    ativRows.forEach((r) => {
      const local = String(r["LOCAL DE ATUAÇÃO"] || "").trim();
      const prep = String(r["PREPOSTO"] || "").trim();
      if (local && prep) {
        prepostosMap.set(
          local.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(),
          prep
        );
      }
    });
  }
  // Mapeamentos consolidados de prepostos (da MC de Setembro/REV04)
  prepostosMap.set("EDIBRA", "Kleydson Alves da Silva");
  prepostosMap.set("EDMAN", "Kleydson Alves da Silva");
  IMOVEIS_REV04.forEach((im) => {
    if (im.preposto) {
      const norm = im.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (!prepostosMap.has(norm)) prepostosMap.set(norm, im.preposto);
    }
  });

  const unidadeInfoMap = new Map<string, { unidadeRm: string; gerencia: string }>();
  mapaCadastroSheet.forEach((r) => {
    const u = String(r.Unidade || "").trim();
    const urm = String(r.Unidade_RM || "").trim();
    const ger = String(r.Gerencia || "").trim();
    if (!u) return;

    if (!unidadeInfoMap.has(u)) {
      unidadeInfoMap.set(u, { unidadeRm: urm, gerencia: ger });
    } else {
      const existing = unidadeInfoMap.get(u)!;
      if (!existing.unidadeRm && urm) existing.unidadeRm = urm;
      if (u === "EDIHB" && urm.includes("EDIHB")) existing.unidadeRm = urm;
      if (u === "IMBOASSICA" && urm.includes("IMBOASSICA")) existing.unidadeRm = urm;
      if (u === "RNEST" && urm.includes("RNEST")) existing.unidadeRm = urm;
      if (u === "RPBC" && urm.includes("RPBC")) existing.unidadeRm = urm;
    }
  });

  function extrairCidadeUfLocal(unidadeRm: string, nomeUnidade: string) {
    if (!unidadeRm) return { cidade: nomeUnidade, uf: "" };
    const match = unidadeRm.match(/\((.*?)\s*-\s*([A-Za-z]{2})\)/);
    if (match) {
      return {
        cidade: match[1].trim(),
        uf: match[2].trim().toUpperCase(),
      };
    }
    return { cidade: nomeUnidade, uf: "" };
  }

  const postosPorUnidade = new Map<string, number>();
  postos.forEach((p) => {
    const u = p.unidade;
    if (u) postosPorUnidade.set(u, (postosPorUnidade.get(u) || 0) + 1);
  });

  const posicoesPorUnidade = new Map<string, number>();
  const ocupadasPorUnidade = new Map<string, number>();
  posicoes.forEach((pos) => {
    const pPosto = postosMap.get(pos.postoIdSGP);
    const u = pPosto?.unidade || (pos as any).unidade;
    if (!u) return;
    posicoesPorUnidade.set(u, (posicoesPorUnidade.get(u) || 0) + 1);

    const titular = String(pos.titularReferencia || "").trim();
    const semTitular = String(pos.posicaoSemTitularMC || "").toUpperCase() === "SIM";
    const ehOcupada = !semTitular && titular && !titular.toUpperCase().includes("SEM TITULAR");
    if (ehOcupada) {
      ocupadasPorUnidade.set(u, (ocupadasPorUnidade.get(u) || 0) + 1);
    }
  });

  const unidadesOrdenadas = Array.from(unidadeInfoMap.keys()).sort();
  const imoveis: Imovel[] = unidadesOrdenadas.map((nome, idx) => {
    const info = unidadeInfoMap.get(nome) || { unidadeRm: "", gerencia: "" };
    const { cidade, uf } = extrairCidadeUfLocal(info.unidadeRm, nome);
    const nomeNorm = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const preposto = prepostosMap.get(nomeNorm) || null;

    const pCount = postosPorUnidade.get(nome) || 0;
    const posCount = posicoesPorUnidade.get(nome) || 0;
    const posOcup = ocupadasPorUnidade.get(nome) || 0;
    const vCount = Math.max(0, posCount - posOcup);

    let statusImovel: "ATIVO" | "EM_MOBILIZACAO" | "INATIVO" = "INATIVO";
    if (posOcup > 0) {
      statusImovel = "ATIVO";
    } else if (pCount > 0 && posOcup === 0) {
      statusImovel = "EM_MOBILIZACAO";
    }

    return {
      id: `IMO-${String(idx + 1).padStart(3, "0")}`,
      nome,
      cidade,
      uf,
      gerencia: info.gerencia || "",
      preposto,
      status_imovel: statusImovel,
      postosCount: pCount,
      posicoesCount: posCount,
      posicoesOcupadas: posOcup,
      vagasCount: vCount,
    };
  });

  return {
    sucesso: true,
    arquivo: nomeArquivo,
    dataImportacao: new Date().toISOString(),
    usuario,
    versao: "REV04",
    totalImoveis: imoveis.length,
    imoveis,
    totalPostos: postos.length,
    totalPosicoes: posicoes.length,
    totalFeristas: feristas.length,
    totalEscalas: escalas.length,
    totalPendenciasEscala: pendenciasEscala.length,
    totalPendentesRM: pendentesRM.length,
    totalValidacoes: validacoes.length,
    totalLinhasRejeitadasPosicoes: linhasRejeitadasPosicoes.length,
    postos,
    posicoes,
    feristas,
    escalas,
    pendenciasEscala,
    pendentesRM,
    validacoes,
    linhasRejeitadas: linhasRejeitadasPosicoes,
    validacoesAutomaticas: {
      titularSegSexEmTurno,
      posicaoSemTitular,
      posto9hUnicaPessoaFerista,
      postoSemRegimeIdentificavel,
      colaboradorMcNaoLocalizadoRM,
    },
  };
}

/**
 * Função executável para processar buffer de planilha (REV04 / REV02) recebido via upload ou script.
 * Se a planilha contiver abas da REV04 (08_ESCALAS_POSICOES / 07_FERISTAS_COBERTURA),
 * delega automaticamente para processarPlanilhaREV04.
 */
export function processarPlanilhaREV02(
  buffer: Buffer,
  nomeArquivo: string = "Base_Estruturada_SGP_Petrobras_REV02.xlsx",
  usuario: string = "Administrador Premier"
): ResultadoImportacaoREV02 {
  const wb = XLSX.read(buffer, { type: "buffer" });

  // Detecção inteligente de REV04
  if (wb.Sheets["08_ESCALAS_POSICOES"] || wb.Sheets["07_FERISTAS_COBERTURA"]) {
    const res04 = processarPlanilhaREV04(buffer, nomeArquivo, usuario);
    return {
      sucesso: res04.sucesso,
      arquivo: res04.arquivo,
      dataImportacao: res04.dataImportacao,
      usuario: res04.usuario,
      versao: "REV04",
      totalPostos: res04.totalPostos,
      totalPosicoes: res04.totalPosicoes,
      totalPosicoesExcedentesNaoCriadas: 0,
      totalAlocacoes: ALOCACOES_REV02.length,
      totalPendentesRM: res04.totalPendentesRM,
      totalValidacoes: res04.totalValidacoes,
      totalConflitosAValidar: res04.posicoes.filter((p) => p.statusValidacao === "A VALIDAR").length,
      totalFeristas: res04.totalFeristas,
      totalEscalas: res04.totalEscalas,
      totalPendenciasEscala: res04.totalPendenciasEscala,
      postos: res04.postos,
      posicoes: res04.posicoes,
      alocacoes: ALOCACOES_REV02,
      pendentesRM: res04.pendentesRM,
      validacoes: res04.validacoes,
      conflitos: res04.posicoes
        .filter((p) => p.statusValidacao === "A VALIDAR")
        .map((p) => ({
          tipo: p.conflitoCadastro || "CONFLITO DE POSIÇÃO",
          referencia: p.codigoVisual,
          descricao: p.motivoConflito || p.observacoes,
          status: p.statusValidacao,
        })),
    };
  }

  // Fallback para planilhas antigas estritamente REV02
  const postosSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets["02_POSTOS"] || []);
  const postos: PostoEstrutural[] = postosSheet.map((row) => {
    const pServ = String(row.Posto_de_Servico || "").trim();
    const postoIdSGP = String(row.Posto_ID_SGP).trim();
    let tipoId = "ADM_09H";
    let tipoNome = "Adm/09h";
    let qtd = 1;

    if (pServ.includes("Turno/24h")) {
      tipoId = "TURNO_24H";
      tipoNome = "Turno/24h";
      qtd = 4;
    } else if (pServ.includes("Turno/16h")) {
      tipoId = "TURNO_16H";
      tipoNome = "Turno/16h";
      qtd = 3;
    } else if (pServ.includes("Adm/16h")) {
      tipoId = "ADM_16H";
      tipoNome = "Adm/16h";
      qtd = 2;
    } else if (pServ.includes("Turno/12h")) {
      tipoId = "TURNO_12H";
      tipoNome = "Turno/12h";
      qtd = 2;
    } else if (pServ.includes("Adm/12h")) {
      tipoId = "ADM_12H";
      tipoNome = "Adm/12h";
      qtd = 2;
    }

    return {
      postoIdSGP,
      idReferencia: row.Posto_Base,
      unidade: String(row.Unidade || "").trim(),
      itemPPU: String(row.Item_PPU || "").trim(),
      postoDeServico: pServ,
      nomenclaturaSugerida: String(row.Nomenclatura_Sugerida || "").trim(),
      municipio: String(row.Municipio || "").trim(),
      gerencia: String(row.Gerencia || "").trim(),
      periculosidade: String(row.Periculosidade || "NÃO").trim().toUpperCase() === "SIM" ? "SIM" : "NÃO",
      tipoPostoId: tipoId,
      tipoPostoNome: tipoNome,
      qtdEstruturalPremissa: Number(row.Qtd_Estrutural_Confirmada || row.Qtd_Estrutural_Premissa || qtd),
      qtdPosicoesIDObservadas: Number(row.Qtd_Posicoes_ID_Observadas || 0),
      qtdAlocacoesMC: Number(row.Qtd_Alocacoes_MC || 0),
      statusEstrutura: String(row.Status_Estrutura || "COERENTE COM A REGRA").trim(),
      observacaoEstrutura: String(row.Observacao_Estrutura || "").trim(),
    };
  });

  const posicoesSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets["03_POSICOES"] || []);
  const posicoes: PosicaoEstrutural[] = [];
  posicoesSheet.forEach((row) => {
    const posId = row.Posicao_ID_SGP ? String(row.Posicao_ID_SGP).trim() : "";
    if (!posId || !posId.startsWith("POS-")) return;
    posicoes.push({
      posicaoIdSGP: posId,
      postoIdSGP: String(row.Posto_ID_SGP).trim(),
      postoBase: row.Posto_Base,
      codigoVisual: String(row.Codigo_Posicao_Estrutural || row.IDs_Luiz_Origem || "").trim(),
      sufixo: Number(row.Numero_Posicao || 1),
      conflitoCadastro: "OK",
      motivoConflito: "",
      tratamentoSGP: "POSIÇÃO ESTRUTURAL",
      observacoes: "",
      statusValidacao: "VALIDADA",
      ehEstrutural: true,
    });
  });

  return {
    sucesso: true,
    arquivo: nomeArquivo,
    dataImportacao: new Date().toISOString(),
    usuario,
    versao: "REV02",
    totalPostos: postos.length,
    totalPosicoes: posicoes.length,
    totalPosicoesExcedentesNaoCriadas: 0,
    totalAlocacoes: ALOCACOES_REV02.length,
    totalPendentesRM: PENDENTES_RM_REV02.length,
    totalValidacoes: VALIDACOES_REV02.length,
    totalConflitosAValidar: 0,
    totalFeristas: FERISTAS_REV04.length,
    totalEscalas: ESCALAS_REV04.length,
    totalPendenciasEscala: PENDENCIAS_ESCALA_REV04.length,
    postos,
    posicoes,
    alocacoes: ALOCACOES_REV02,
    pendentesRM: PENDENTES_RM_REV02,
    validacoes: VALIDACOES_REV02,
    conflitos: [],
  };
}
