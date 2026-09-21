/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Motor de Conciliação RM × SIFAC (MOMENTO 2)
 *
 * Realiza o cruzamento cadastral entre a base RM (TOTVS) e a Lista de Alocados SIFAC,
 * detectando os 12 tipos de divergência contratuais antes do reporte à fiscalização.
 */

import * as XLSX from "xlsx";
import { ProfissionalOperacional } from "@/lib/dados/estado-operacional";
import { mascararCpf } from "@/lib/importadores/tipos";

export type StatusDivergencia =
  | "ABERTA"
  | "JUSTIFICADA"
  | "CORRIGIR_SIFAC"
  | "CORRIGIR_RM"
  | "RESOLVIDA";

export type TipoDivergencia =
  | "NAO_ENCONTRADO_RM" // 1. No SIFAC e não no cadastro do RM
  | "NAO_INFORMADO_SIFAC" // 2. Ativo no RM e não no SIFAC
  | "SITUACAO_DIVERGENTE" // 3. Situação divergente na data de referência
  | "SITUACAO_INCONSISTENTE_DEMITIDO" // 4. Demitido no RM informado como 2-Inativo no SIFAC
  | "DATA_DEMISSAO_DIVERGENTE" // 5. Data de demissão diferente
  | "DATA_ADMISSAO_DIVERGENTE" // 6. Data de admissão diferente
  | "CARGO_DIVERGENTE" // 7. Cargo divergente
  | "SALARIO_DIVERGENTE" // 8. Salário divergente (tolerância R$ 0,01)
  | "MUNICIPIO_INCOMPATIVEL" // 9. Município incompatível com a base RM
  | "GENERO_DIVERGENTE" // 10. Gênero divergente (RM Sexo vs SIFAC CodigoGenero)
  | "DATA_NASCIMENTO_DIVERGENTE" // 11. Data de nascimento divergente
  | "DADO_OBRIGATORIO_AUSENTE"; // 12. Dado obrigatório ausente (gênero ou data de nascimento)

export interface RegistroHistoricoTratamento {
  id: string;
  dataHora: string;
  usuario: string;
  statusAnterior: StatusDivergencia;
  novoStatus: StatusDivergencia;
  justificativa: string;
}

export interface ItemAlocadoSifac {
  id: string;
  numeroContrato: string;
  cnpj: string;
  dataCompetenciaCadastro?: string; // YYYY-MM ou YYYY-MM-DD
  dataCompetencia?: string; // alias retrocompatível
  nome: string;
  cpfLimpo: string;
  cpfMascarado: string;
  codigoGenero?: number; // 1 = Feminino, 2 = Masculino
  generoDescricao?: string;
  dataNascimento?: string; // YYYY-MM-DD
  codigoSituacaoEmpregado: number; // 1 Ativo, 2 Inativo, 3 Demitido, 4 Afastado, 5 Férias, 6 Transferido fora
  dataCompetenciaSituacao?: string; // YYYY-MM-DD
  dataAdmissao?: string; // YYYY-MM-DD
  dataDemissao?: string; // YYYY-MM-DD
  dataUltimasFerias?: string; // YYYY-MM-DD
  cargo: string;
  salario?: number; // Protegido LGPD: Visível exclusivamente para PREMIER_ADMIN
  codigoMunicipioPrestacao?: string;
  municipioPrestacao: string;
  codigoPericulosidade?: number;
  periculosidade?: string;
  codigoRegime?: number;
  regime?: string;
  // Campos estendidos presentes nos dados reais importados do RM (sifac-reais.json)
  chapaRm?: string;       // Chapa do colaborador no sistema RM
  unidadeId?: string;     // Identificador da base (ex: "RNEST", "UFN-III")
  unidadeNome?: string;   // Nome amigável da base (ex: "Refinaria Abreu e Lima (RNEST/PE)")
  situacaoRm?: string;    // Situação no RM (ex: "ATIVO", "FERIAS")
}


export interface DivergenciaConciliacao {
  id: string;
  competencia: string;
  tipo: TipoDivergencia;
  rotuloTipo: string;
  cpfLimpo: string;
  cpfMascarado: string;
  nome: string;
  chapaRm?: string;
  matriculaRm?: string;
  baseRmId: string;
  baseRmNome: string;
  valorRm: string;
  valorSifac: string;
  status: StatusDivergencia;
  severidade: "ALTA" | "MEDIA" | "BAIXA" | "VERIFICAR";
  isVerificarDataReferencia?: boolean;
  dataRefRm?: string;
  dataRefSifac?: string;
  justificadaAnteriormente?: boolean;
  competenciaOrigemJustificativa?: string;
  justificativaAtual?: string;
  ultimaAlteracaoPor?: string;
  ultimaAlteracaoEm?: string;
  historico: RegistroHistoricoTratamento[];
}

export interface ResumoConciliacao {
  competencia: string;
  totalSifac: number;
  totalRmCompetencia: number;
  conciliadosSemDivergencia: number;
  totalDivergencias: number;
  admitidosAposCompetencia: number;
  totaisPorTipo: Record<TipoDivergencia, number>;
  totaisPorStatus: Record<StatusDivergencia, number>;
  pendenciasCriticasAdmin: number; // Tipos 1, 2, 4, 7, 10 e 12 com status ABERTA
}

export interface ConfiguracaoEquivalencias {
  // 3. Tabela de equivalência de situações (Código SIFAC 1..6 para strings do RM)
  situacoes: {
    rmAtivo: number[]; // Padrão: [1]
    rmFerias: number[]; // Padrão: [5]
    rmAfastado: number[]; // Padrão: [4]
    rmDemitido: number[]; // Padrão: [3]
  };
  // 7. Cargos equivalentes (Chave normalizada -> sinônimos normalizados)
  cargosEquivalentes: Record<string, string[]>;
  // 9. Base RM -> Códigos IBGE e Nomes aceitos de municípios
  municipiosPorBase: Record<string, { codigosIbge: string[]; nomes: string[] }>;
}

// Configuração padrão de equivalências do contrato
export const EQUIVALENCIAS_PADRAO: ConfiguracaoEquivalencias = {
  situacoes: {
    rmAtivo: [1],
    rmFerias: [5],
    rmAfastado: [4],
    rmDemitido: [3],
  },
  cargosEquivalentes: {
    "motorista carreta": ["motorista de veiculos pesados", "motorista pesados", "motorista de carreta"],
    "motorista de veiculos pesados": ["motorista carreta", "motorista pesados"],
    "almoxarife lider": ["almoxarife", "almoxarife pleno", "lider de almoxarifado"],
    "auxiliar de almoxarifado i": ["auxiliar de almoxarifado", "auxiliar almoxarifado", "assistente de almoxarifado"],
    "assistente de logistica": ["assistente logistica", "analista de logistica jr", "auxiliar de logistica"],
    "operador de empilhadeira": ["operador empilhadeira", "motorista operador"],
  },
  municipiosPorBase: {
    "UFN-III": {
      codigosIbge: ["5008305", "5000203", "5002100", "3511009"],
      nomes: ["tres lagoas", "agua clara", "brasilandia", "castilho"],
    },
    "MACAE": {
      codigosIbge: ["3302403", "3304524", "3301009", "3304151"],
      nomes: ["macae", "rio das ostras", "campos dos goytacazes", "quissama"],
    },
    "SANTOS": {
      codigosIbge: ["3548500", "3513504", "3551009", "3518701"],
      nomes: ["santos", "cubatao", "sao vicente", "guaruja"],
    },
    "PAULINIA": {
      codigosIbge: ["3536505", "3509502", "3512803", "3552403"],
      nomes: ["paulinia", "campinas", "cosmopolis", "sumare"],
    },
    "RNEST": {
      codigosIbge: ["2607208", "2602902", "2611606"],
      nomes: ["ipojuca", "cabo de santo agostinho", "recife"],
    },
  },
};

export const ROTULOS_TIPOS_DIVERGENCIA: Record<TipoDivergencia, string> = {
  NAO_ENCONTRADO_RM: "Não encontrado no RM",
  NAO_INFORMADO_SIFAC: "Não informado no SIFAC",
  SITUACAO_DIVERGENTE: "Situação divergente",
  SITUACAO_INCONSISTENTE_DEMITIDO: "Código de situação inconsistente (esperado 3 – Demitido)",
  DATA_DEMISSAO_DIVERGENTE: "Data de demissão diferente",
  DATA_ADMISSAO_DIVERGENTE: "Data de admissão diferente",
  CARGO_DIVERGENTE: "Cargo divergente",
  SALARIO_DIVERGENTE: "Salário divergente",
  MUNICIPIO_INCOMPATIVEL: "Município de prestação incompatível com a base do RM",
  GENERO_DIVERGENTE: "Gênero divergente entre RM e SIFAC",
  DATA_NASCIMENTO_DIVERGENTE: "Data de nascimento divergente entre RM e SIFAC",
  DADO_OBRIGATORIO_AUSENTE: "Dado obrigatório do SIFAC ausente",
};

/**
 * Normaliza textos para comparação sem acento, caixa baixa e sem pontuações
 */
export function normalizarTexto(txt?: string): string {
  if (!txt) return "";
  return txt
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Normaliza datas para o formato ISO YYYY-MM-DD
 * Suporta instâncias de Date, números seriais do Excel e strings dd/mm/aaaa ou YYYY-MM-DD
 */
export function normalizarDataIso(d?: string | number | Date | null): string | null {
  if (d === undefined || d === null || d === "") return null;
  if (d instanceof Date && !isNaN(d.getTime())) {
    const ano = d.getUTCFullYear();
    const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(d.getUTCDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  // Se for número serial do Excel
  if (typeof d === "number" && !isNaN(d) && d > 20000 && d < 75000) {
    const milissegundos = Math.round((d - 25569) * 86400 * 1000);
    const dateObj = new Date(milissegundos);
    if (!isNaN(dateObj.getTime())) {
      const ano = dateObj.getUTCFullYear();
      const mes = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
      const dia = String(dateObj.getUTCDate()).padStart(2, "0");
      return `${ano}-${mes}-${dia}`;
    }
  }

  const str = String(d).trim();
  if (!str) return null;

  // Se for string puramente numérica (serial Excel como string)
  if (/^\d{5}$/.test(str)) {
    const num = Number(str);
    if (num > 20000 && num < 75000) {
      const milissegundos = Math.round((num - 25569) * 86400 * 1000);
      const dateObj = new Date(milissegundos);
      if (!isNaN(dateObj.getTime())) {
        const ano = dateObj.getUTCFullYear();
        const mes = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
        const dia = String(dateObj.getUTCDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
      }
    }
  }

  // Formato dd/mm/aaaa
  const matchBr = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchBr) {
    const dia = matchBr[1].padStart(2, "0");
    const mes = matchBr[2].padStart(2, "0");
    const ano = matchBr[3];
    return `${ano}-${mes}-${dia}`;
  }

  // Formato YYYY-MM-DD
  const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
  }

  return null;
}

/**
 * Verifica se dois cargos são considerados equivalentes
 */
export function cargosSaoEquivalentes(
  cargoRm: string,
  cargoSifac: string,
  equivalencias: Record<string, string[]> = EQUIVALENCIAS_PADRAO.cargosEquivalentes
): boolean {
  const c1 = normalizarTexto(cargoRm);
  const c2 = normalizarTexto(cargoSifac);

  if (c1 === c2) return true;

  // Verifica se um é substring significativa do outro
  if (c1.includes(c2) || c2.includes(c1)) return true;

  // Verifica na tabela de equivalências
  const sinonimos1 = equivalencias[c1] || [];
  if (sinonimos1.includes(c2)) return true;

  const sinonimos2 = equivalencias[c2] || [];
  if (sinonimos2.includes(c1)) return true;

  return false;
}

/**
 * Verifica equivalência de situação entre RM e SIFAC
 */
export function situacaoRmEquivalenteSifac(
  situacaoRm: string,
  codigoSifac: number,
  tabela: ConfiguracaoEquivalencias["situacoes"] = EQUIVALENCIAS_PADRAO.situacoes
): boolean {
  const norm = normalizarTexto(situacaoRm);

  if (norm.includes("ativo") || norm === "a" || norm.includes("aviso previo")) {
    return tabela.rmAtivo.includes(codigoSifac);
  }
  if (norm.includes("ferias") || norm === "f") {
    return tabela.rmFerias.includes(codigoSifac);
  }
  if (
    norm.includes("afastad") ||
    norm.includes("previdencia") ||
    norm.includes("maternidade") ||
    norm === "p" ||
    norm === "m"
  ) {
    return tabela.rmAfastado.includes(codigoSifac);
  }
  if (norm.includes("demitid") || norm.includes("desligad") || norm === "d") {
    return tabela.rmDemitido.includes(codigoSifac);
  }

  return false;
}

/**
 * Motor Principal: Executa a conciliação completa entre RM e SIFAC
 */
export function executarConciliacaoRmSifac(
  competencia: string, // YYYY-MM
  profissionaisRm: ProfissionalOperacional[],
  alocadosSifac: ItemAlocadoSifac[],
  configEquivalencias: ConfiguracaoEquivalencias = EQUIVALENCIAS_PADRAO,
  divergenciasAnteriores: DivergenciaConciliacao[] = [],
  dataRefRm?: string,
  dataRefSifac?: string
): {
  divergencias: DivergenciaConciliacao[];
  resumo: ResumoConciliacao;
} {
  const mapaDivergenciasAnteriores = new Map<string, DivergenciaConciliacao>();
  divergenciasAnteriores.forEach((div) => {
    // Chave única: CPF + Tipo de divergência
    const chave = `${div.cpfLimpo}|${div.tipo}`;
    mapaDivergenciasAnteriores.set(chave, div);
  });

  const divergenciasGeradas: DivergenciaConciliacao[] = [];
  const cpfsConciliadosSemDivergencia = new Set<string>();

  // Índices por CPF limpo normalizado (11 dígitos)
  const mapaSifacPorCpf = new Map<string, ItemAlocadoSifac>();
  alocadosSifac.forEach((s) => {
    const cpfNorm = s.cpfLimpo.padStart(11, "0");
    mapaSifacPorCpf.set(cpfNorm, s);
  });

  const mapaRmPorCpf = new Map<string, ProfissionalOperacional>();
  profissionaisRm.forEach((p) => {
    const cpfNorm = p.cpfLimpo.padStart(11, "0");
    mapaRmPorCpf.set(cpfNorm, p);
  });

  // Competência limite (último dia do mês da competência YYYY-MM)
  const partesComp = competencia.split("-");
  const anoComp = parseInt(partesComp[0], 10);
  const mesComp = parseInt(partesComp[1], 10);
  const ultimoDiaMes = new Date(anoComp, mesComp, 0).getDate();
  const dataFimCompetencia = `${competencia}-${String(ultimoDiaMes).padStart(2, "0")}`;

  let totalAdmitidosAposCompetencia = 0;

  // Função auxiliar para registrar divergência
  const adicionarDivergencia = (
    tipo: TipoDivergencia,
    cpf: string,
    nome: string,
    baseId: string,
    baseNome: string,
    valorRm: string,
    valorSifac: string,
    severidade: "ALTA" | "MEDIA" | "BAIXA" | "VERIFICAR" = "ALTA",
    extras?: {
      isVerificarDataReferencia?: boolean;
      chapaRm?: string;
      matriculaRm?: string;
    }
  ) => {
    const cpfLimpo = cpf.padStart(11, "0");
    const chaveAnt = `${cpfLimpo}|${tipo}`;
    const divAnt = mapaDivergenciasAnteriores.get(chaveAnt);

    const justificadaAntes = divAnt?.status === "JUSTIFICADA";
    const statusInicial: StatusDivergencia = justificadaAntes
      ? "JUSTIFICADA"
      : divAnt
      ? divAnt.status
      : "ABERTA";

    const idDiv = `DIV-${competencia}-${cpfLimpo}-${tipo}`;

    divergenciasGeradas.push({
      id: idDiv,
      competencia,
      tipo,
      rotuloTipo: ROTULOS_TIPOS_DIVERGENCIA[tipo],
      cpfLimpo,
      cpfMascarado: mascararCpf(cpfLimpo),
      nome,
      chapaRm: extras?.chapaRm,
      matriculaRm: extras?.matriculaRm,
      baseRmId: baseId || "NAO_IDENTIFICADA",
      baseRmNome: baseNome || "Base Não Identificada",
      valorRm,
      valorSifac,
      status: statusInicial,
      severidade,
      isVerificarDataReferencia: extras?.isVerificarDataReferencia,
      dataRefRm,
      dataRefSifac,
      justificadaAnteriormente: justificadaAntes,
      competenciaOrigemJustificativa: justificadaAntes ? divAnt?.competencia : undefined,
      justificativaAtual: divAnt?.justificativaAtual,
      ultimaAlteracaoPor: divAnt?.ultimaAlteracaoPor,
      ultimaAlteracaoEm: divAnt?.ultimaAlteracaoEm,
      historico: divAnt?.historico || [],
    });
  };

  // ---------------------------------------------------------------------------
  // 1. ITERAÇÃO SOBRE OS REGISTROS DO SIFAC
  // ---------------------------------------------------------------------------
  alocadosSifac.forEach((sifac) => {
    const cpfNorm = sifac.cpfLimpo.padStart(11, "0");
    const funcRm = mapaRmPorCpf.get(cpfNorm);

    // TIPO 1: No SIFAC e não no cadastro do RM
    if (!funcRm) {
      adicionarDivergencia(
        "NAO_ENCONTRADO_RM",
        cpfNorm,
        sifac.nome,
        "NAO_IDENTIFICADA",
        `Município SIFAC: ${sifac.municipioPrestacao}`,
        "Não cadastrado no RM",
        `Cargo: ${sifac.cargo} | Situação SIFAC: ${sifac.codigoSituacaoEmpregado}`,
        "ALTA"
      );
      return;
    }

    let teveDivergencia = false;
    const baseId = funcRm.unidadeId || "NAO_MAPEADA";
    const baseNome = funcRm.unidadeNome || funcRm.unidadeId || "Base Desconhecida";

    // TIPO 12: Dado obrigatório ausente (nascimento ou gênero em um dos sistemas)
    const faltaNascRm = !funcRm.dataNascimento;
    const faltaNascSifac = !sifac.dataNascimento;
    const faltaGenRm = !funcRm.sexo;
    const faltaGenSifac = !sifac.codigoGenero;

    if (faltaNascRm || faltaNascSifac || faltaGenRm || faltaGenSifac) {
      const faltas: string[] = [];
      if (faltaNascSifac) faltas.push("Data Nascimento (SIFAC)");
      if (faltaNascRm) faltas.push("Data Nascimento (RM)");
      if (faltaGenSifac) faltas.push("Gênero (SIFAC)");
      if (faltaGenRm) faltas.push("Gênero (RM)");

      adicionarDivergencia(
        "DADO_OBRIGATORIO_AUSENTE",
        cpfNorm,
        funcRm.nome,
        baseId,
        baseNome,
        `Nasc: ${funcRm.dataNascimento || "Vazio"} | Sexo: ${funcRm.sexo || "Vazio"}`,
        `Nasc: ${sifac.dataNascimento || "Vazio"} | Gênero: ${sifac.codigoGenero || "Vazio"}`,
        "ALTA",
        { chapaRm: funcRm.chapa, matriculaRm: funcRm.matricula }
      );
      teveDivergencia = true;
    }

    // TIPO 10: Sexo / Gênero divergente (F ↔ 1, M ↔ 2)
    if (funcRm.sexo && sifac.codigoGenero) {
      const esperadoCod = funcRm.sexo === "F" ? 1 : funcRm.sexo === "M" ? 2 : null;
      if (esperadoCod !== null && sifac.codigoGenero !== esperadoCod) {
        adicionarDivergencia(
          "GENERO_DIVERGENTE",
          cpfNorm,
          funcRm.nome,
          baseId,
          baseNome,
          `Sexo RM: ${funcRm.sexo === "F" ? "Feminino (F)" : "Masculino (M)"}`,
          `Gênero SIFAC: ${sifac.codigoGenero === 1 ? "1 - Feminino" : sifac.codigoGenero === 2 ? "2 - Masculino" : `Código ${sifac.codigoGenero}`}`,
          "ALTA",
          { chapaRm: funcRm.chapa, matriculaRm: funcRm.matricula }
        );
        teveDivergencia = true;
      }
    }

    // TIPO 11: Data de nascimento divergente
    if (funcRm.dataNascimento && sifac.dataNascimento) {
      const dnRm = normalizarDataIso(funcRm.dataNascimento);
      const dnSifac = normalizarDataIso(sifac.dataNascimento);
      if (dnRm && dnSifac && dnRm !== dnSifac) {
        adicionarDivergencia(
          "DATA_NASCIMENTO_DIVERGENTE",
          cpfNorm,
          funcRm.nome,
          baseId,
          baseNome,
          dnRm,
          dnSifac,
          "ALTA",
          { chapaRm: funcRm.chapa, matriculaRm: funcRm.matricula }
        );
        teveDivergencia = true;
      }
    }

    // TIPO 4: Demitido no RM informado como 2 - Inativo no SIFAC (esperado 3 - Demitido)
    const situacaoRmNorm = normalizarTexto(funcRm.situacao || funcRm.situacaoDescricao);
    const ehDemitidoRm = situacaoRmNorm.includes("demitid") || situacaoRmNorm.includes("desligad") || situacaoRmNorm === "d";

    if (ehDemitidoRm && sifac.codigoSituacaoEmpregado === 2) {
      adicionarDivergencia(
        "SITUACAO_INCONSISTENTE_DEMITIDO",
        cpfNorm,
        funcRm.nome,
        baseId,
        baseNome,
        "Demitido / Desligado",
        "2 – Inativo (Esperado: 3 – Demitido)",
        "ALTA",
        { chapaRm: funcRm.chapa, matriculaRm: funcRm.matricula }
      );
      teveDivergencia = true;
    } else {
      // TIPO 3: Situação divergente comparada na data de referência
      const situacaoEquivalente = situacaoRmEquivalenteSifac(
        funcRm.situacao || funcRm.situacaoDescricao || "ATIVO",
        sifac.codigoSituacaoEmpregado,
        configEquivalencias.situacoes
      );

      if (!situacaoEquivalente) {
        const datasRefDiferentes = !!(dataRefRm && dataRefSifac && dataRefRm !== dataRefSifac);
        adicionarDivergencia(
          "SITUACAO_DIVERGENTE",
          cpfNorm,
          funcRm.nome,
          baseId,
          baseNome,
          `${funcRm.situacao || "Ativo"} (Data Ref: ${dataRefRm || "N/D"})`,
          `Código ${sifac.codigoSituacaoEmpregado} (Data Ref: ${dataRefSifac || "N/D"})`,
          datasRefDiferentes ? "VERIFICAR" : "ALTA",
          {
            isVerificarDataReferencia: datasRefDiferentes,
            chapaRm: funcRm.chapa,
            matriculaRm: funcRm.matricula,
          }
        );
        teveDivergencia = true;
      }
    }

    // TIPO 5: Data de demissão diferente
    if (funcRm.dataDesligamento || sifac.dataDemissao) {
      const ddRm = normalizarDataIso(funcRm.dataDesligamento);
      const ddSifac = normalizarDataIso(sifac.dataDemissao);
      if (ddRm && ddSifac && ddRm !== ddSifac) {
        adicionarDivergencia(
          "DATA_DEMISSAO_DIVERGENTE",
          cpfNorm,
          funcRm.nome,
          baseId,
          baseNome,
          ddRm,
          ddSifac,
          "MEDIA",
          { chapaRm: funcRm.chapa, matriculaRm: funcRm.matricula }
        );
        teveDivergencia = true;
      }
    }

    // TIPO 6: Data de admissão diferente
    if (funcRm.dataAdmissao && sifac.dataAdmissao) {
      const daRm = normalizarDataIso(funcRm.dataAdmissao);
      const daSifac = normalizarDataIso(sifac.dataAdmissao);
      if (daRm && daSifac && daRm !== daSifac) {
        adicionarDivergencia(
          "DATA_ADMISSAO_DIVERGENTE",
          cpfNorm,
          funcRm.nome,
          baseId,
          baseNome,
          daRm,
          daSifac,
          "MEDIA",
          { chapaRm: funcRm.chapa, matriculaRm: funcRm.matricula }
        );
        teveDivergencia = true;
      }
    }

    // TIPO 7: Cargo divergente
    if (funcRm.funcao && sifac.cargo) {
      const cargoBate = cargosSaoEquivalentes(
        funcRm.funcao,
        sifac.cargo,
        configEquivalencias.cargosEquivalentes
      );
      if (!cargoBate) {
        adicionarDivergencia(
          "CARGO_DIVERGENTE",
          cpfNorm,
          funcRm.nome,
          baseId,
          baseNome,
          funcRm.funcao,
          sifac.cargo,
          "MEDIA",
          { chapaRm: funcRm.chapa, matriculaRm: funcRm.matricula }
        );
        teveDivergencia = true;
      }
    }

    // TIPO 8: Salário divergente (tolerância de R$ 0,01)
    const salRm = funcRm.dadosRestritos?.salario;
    const salSifac = sifac.salario;
    if (salRm !== undefined && salSifac !== undefined && salRm !== null && salSifac !== null) {
      const diff = Math.abs(salRm - salSifac);
      if (Math.round(diff * 100) / 100 > 0.01) {
        adicionarDivergencia(
          "SALARIO_DIVERGENTE",
          cpfNorm,
          funcRm.nome,
          baseId,
          baseNome,
          `R$ ${salRm.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `R$ ${salSifac.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          "BAIXA",
          { chapaRm: funcRm.chapa, matriculaRm: funcRm.matricula }
        );
        teveDivergencia = true;
      }
    }

    // TIPO 9: Município de prestação incompatível com a base RM
    if (sifac.municipioPrestacao && baseId) {
      const baseMap = configEquivalencias.municipiosPorBase[baseId];
      if (baseMap) {
        const munSifacNorm = normalizarTexto(sifac.municipioPrestacao);
        const codMunSifac = (sifac.codigoMunicipioPrestacao || "").trim();

        const matchNome = baseMap.nomes.some((n) => munSifacNorm.includes(n) || n.includes(munSifacNorm));
        const matchCodigo = codMunSifac && baseMap.codigosIbge.includes(codMunSifac);

        if (!matchNome && !matchCodigo) {
          adicionarDivergencia(
            "MUNICIPIO_INCOMPATIVEL",
            cpfNorm,
            funcRm.nome,
            baseId,
            baseNome,
            `Base RM: ${baseNome}`,
            `Município SIFAC: ${sifac.municipioPrestacao}${codMunSifac ? ` (${codMunSifac})` : ""}`,
            "MEDIA",
            { chapaRm: funcRm.chapa, matriculaRm: funcRm.matricula }
          );
          teveDivergencia = true;
        }
      }
    }

    if (!teveDivergencia) {
      cpfsConciliadosSemDivergencia.add(cpfNorm);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. ITERAÇÃO SOBRE OS REGISTROS DO RM (PARA DETECTAR QUEM FALTOU NO SIFAC)
  // ---------------------------------------------------------------------------
  let totalRmCompetencia = 0;

  profissionaisRm.forEach((funcRm) => {
    const cpfNorm = funcRm.cpfLimpo.padStart(11, "0");
    const admIso = normalizarDataIso(funcRm.dataAdmissao);

    // Regra: se admitido APÓS a data da competência, não é divergência!
    if (admIso && admIso > dataFimCompetencia) {
      totalAdmitidosAposCompetencia++;
      return;
    }

    // Apenas colaboradores ativos ou que estavam vigentes na competência
    const sitNorm = normalizarTexto(funcRm.situacao || funcRm.situacaoDescricao);
    const ehDemitido = sitNorm.includes("demitid") || sitNorm.includes("desligad") || sitNorm === "d";
    const demIso = normalizarDataIso(funcRm.dataDesligamento);

    // Se demitido antes da competência começar, não deveria estar no SIFAC dessa competência
    if (ehDemitido && demIso && demIso < `${competencia}-01`) {
      return;
    }

    totalRmCompetencia++;

    // TIPO 2: Ativo no RM (admitido até a competência) e não no SIFAC
    if (!mapaSifacPorCpf.has(cpfNorm)) {
      adicionarDivergencia(
        "NAO_INFORMADO_SIFAC",
        cpfNorm,
        funcRm.nome,
        funcRm.unidadeId || "NAO_MAPEADA",
        funcRm.unidadeNome || funcRm.unidadeId || "Base RM",
        `Situação RM: ${funcRm.situacao || "Ativo"} (Admissão: ${funcRm.dataAdmissao || "N/D"})`,
        "Não consta na lista de alocados SIFAC",
        "ALTA",
        { chapaRm: funcRm.chapa, matriculaRm: funcRm.matricula }
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 3. CONSOLIDAÇÃO DO RESUMO E INDICADORES
  // ---------------------------------------------------------------------------
  const totaisPorTipo: Record<TipoDivergencia, number> = {
    NAO_ENCONTRADO_RM: 0,
    NAO_INFORMADO_SIFAC: 0,
    SITUACAO_DIVERGENTE: 0,
    SITUACAO_INCONSISTENTE_DEMITIDO: 0,
    DATA_DEMISSAO_DIVERGENTE: 0,
    DATA_ADMISSAO_DIVERGENTE: 0,
    CARGO_DIVERGENTE: 0,
    SALARIO_DIVERGENTE: 0,
    MUNICIPIO_INCOMPATIVEL: 0,
    GENERO_DIVERGENTE: 0,
    DATA_NASCIMENTO_DIVERGENTE: 0,
    DADO_OBRIGATORIO_AUSENTE: 0,
  };

  const totaisPorStatus: Record<StatusDivergencia, number> = {
    ABERTA: 0,
    JUSTIFICADA: 0,
    CORRIGIR_SIFAC: 0,
    CORRIGIR_RM: 0,
    RESOLVIDA: 0,
  };

  let pendenciasCriticasAdmin = 0;
  // Tipos críticos que devem entrar em "Configurações/pendências" na Administração quando ABERTAS:
  // Tipos 1, 2, 4, 7, 10 e 12
  const tiposCriticosAdmin: TipoDivergencia[] = [
    "NAO_ENCONTRADO_RM", // 1
    "NAO_INFORMADO_SIFAC", // 2
    "SITUACAO_INCONSISTENTE_DEMITIDO", // 4
    "CARGO_DIVERGENTE", // 7
    "GENERO_DIVERGENTE", // 10
    "DADO_OBRIGATORIO_AUSENTE", // 12
  ];

  divergenciasGeradas.forEach((d) => {
    totaisPorTipo[d.tipo]++;
    totaisPorStatus[d.status]++;

    if (d.status === "ABERTA" && tiposCriticosAdmin.includes(d.tipo)) {
      pendenciasCriticasAdmin++;
    }
  });

  const resumo: ResumoConciliacao = {
    competencia,
    totalSifac: alocadosSifac.length,
    totalRmCompetencia,
    conciliadosSemDivergencia: cpfsConciliadosSemDivergencia.size,
    totalDivergencias: divergenciasGeradas.length,
    admitidosAposCompetencia: totalAdmitidosAposCompetencia,
    totaisPorTipo,
    totaisPorStatus,
    pendenciasCriticasAdmin,
  };

  return {
    divergencias: divergenciasGeradas,
    resumo,
  };
}

/**
 * Atualiza o status e justificativa de uma divergência
 */
export function atualizarStatusDivergencia(
  divergencias: DivergenciaConciliacao[],
  divergenciaId: string,
  novoStatus: StatusDivergencia,
  justificativa: string,
  usuarioNome: string
): { atualizadas: DivergenciaConciliacao[]; sucesso: boolean } {
  const agora = new Date().toISOString().replace("T", " ").substring(0, 19);

  let achou = false;
  const atualizadas = divergencias.map((div) => {
    if (div.id === divergenciaId) {
      achou = true;
      const novoHistorico: RegistroHistoricoTratamento = {
        id: `hist-${Date.now()}`,
        dataHora: agora,
        usuario: usuarioNome,
        statusAnterior: div.status,
        novoStatus,
        justificativa,
      };

      return {
        ...div,
        status: novoStatus,
        justificativaAtual: justificativa,
        ultimaAlteracaoPor: usuarioNome,
        ultimaAlteracaoEm: agora,
        historico: [novoHistorico, ...div.historico],
      };
    }
    return div;
  });

  return { atualizadas, sucesso: achou };
}

/**
 * Exporta as divergências para uma planilha XLSX com abas "Resumo" e "Divergências"
 */
export function exportarConciliacaoXlsx(
  competencia: string,
  resumo: ResumoConciliacao,
  divergencias: DivergenciaConciliacao[],
  incluirSalario: boolean = false
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // ABA 1: RESUMO
  const dadosResumo = [
    { Indicador: "Competência do Arquivo", Valor: competencia },
    { Indicador: "Total de Alocados no SIFAC", Valor: resumo.totalSifac },
    { Indicador: "Total no Cadastro RM (Competência)", Valor: resumo.totalRmCompetencia },
    { Indicador: "Conciliados 100% sem Divergência", Valor: resumo.conciliadosSemDivergencia },
    { Indicador: "Admitidos após a Competência (Ignorados)", Valor: resumo.admitidosAposCompetencia },
    { Indicador: "Total de Divergências Identificadas", Valor: resumo.totalDivergencias },
    { Indicador: "Pendências Críticas na Administração", Valor: resumo.pendenciasCriticasAdmin },
    { Indicador: "—", Valor: "—" },
    { Indicador: "DIVERGÊNCIAS POR TIPO", Valor: "" },
    ...Object.entries(resumo.totaisPorTipo).map(([tipo, qtd]) => ({
      Indicador: ROTULOS_TIPOS_DIVERGENCIA[tipo as TipoDivergencia] || tipo,
      Valor: qtd,
    })),
    { Indicador: "—", Valor: "—" },
    { Indicador: "DIVERGÊNCIAS POR STATUS", Valor: "" },
    ...Object.entries(resumo.totaisPorStatus).map(([status, qtd]) => ({
      Indicador: status,
      Valor: qtd,
    })),
  ];
  const wsResumo = XLSX.utils.json_to_sheet(dadosResumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Conciliação");

  // ABA 2: DIVERGÊNCIAS
  const dadosDivergencias = divergencias.map((d) => {
    const item: Record<string, unknown> = {
      "CPF": d.cpfMascarado,
      "Colaborador": d.nome,
      "Chapa RM": d.chapaRm || "—",
      "Matrícula": d.matriculaRm || "—",
      "Base (RM)": d.baseRmNome,
      "Tipo de Divergência": d.rotuloTipo,
      "Classificação": d.isVerificarDataReferencia ? "Verificar (Datas Ref Diferentes)" : d.severidade,
      "Valor no RM": d.valorRm,
      "Valor no SIFAC": d.tipo === "SALARIO_DIVERGENTE" && !incluirSalario ? "[CONFIDENCIAL]" : d.valorSifac,
      "Status": d.status,
      "Justificada Anteriormente?": d.justificadaAnteriormente ? "Sim" : "Não",
      "Justificativa": d.justificativaAtual || "—",
      "Última Alteração Por": d.ultimaAlteracaoPor || "—",
      "Última Alteração Em": d.ultimaAlteracaoEm || "—",
    };
    return item;
  });

  const wsDivergencias = XLSX.utils.json_to_sheet(
    dadosDivergencias.length > 0 ? dadosDivergencias : [{ Mensagem: "Nenhuma divergência encontrada!" }]
  );
  XLSX.utils.book_append_sheet(wb, wsDivergencias, "Divergências");

  return new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
}
