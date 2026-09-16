/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Adaptador de Dados para o Serviço de Ocupação e Painel Geral
 *
 * Converte o estado operacional (ou banco de dados) na estrutura padronizada
 * exigida pelo motor central `calcularOcupacao`.
 */

import {
  carregarEstado,
  EstadoOperacionalCompleto,
} from "@/lib/dados/estado-operacional";
import {
  PostoEntrada,
  OcorrenciaEntrada,
  CoberturaEntrada,
  PontoEntrada,
  ImportacaoLogEntrada,
  ParametroBaseEntrada,
  ApontamentoEntrada,
  FiltrosCalculoOcupacao,
  calcularOcupacao,
  ResultadoOcupacaoConsolidado,
} from "./calculo-ocupacao";

export interface OpcoesAdaptador {
  baseId?: string;
  competencia?: string; // "YYYY-MM", padrão "2026-09"
  dataHoje?: string;    // "YYYY-MM-DD", padrão "2026-09-16"
  horaHoje?: string;    // "HH:MM", padrão "08:00"
  perfilUsuario?: string;
  parametroAusente?: boolean; // Para testes do indicador "Parametrizar"
  simularRhidAtrasado?: boolean;
}

// Bases operacionais adicionais para composição do comparativo contratual
const POSTOS_OUTRAS_BASES: PostoEntrada[] = [
  // Base Macaé / Parque de Tubos (8 postos)
  {
    id: "pst-mac-001",
    codigoPosto: "MAC-LOG-001",
    funcao: "Almoxarife Líder Offshore",
    unidadeId: "MACAE",
    unidadeNome: "Base Macaé / Parque de Tubos",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:30",
    horarioFim: "17:18",
    titularMatricula: "MAC-001",
    titularNome: "Ricardo Silveira Peixoto",
    situacao: "ATIVO",
    valorMensal: 11200.0,
  },
  {
    id: "pst-mac-002",
    codigoPosto: "MAC-LOG-002",
    funcao: "Operador de Logística Especializada",
    unidadeId: "MACAE",
    unidadeNome: "Base Macaé / Parque de Tubos",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:30",
    horarioFim: "17:18",
    titularMatricula: "MAC-002",
    titularNome: "Gleice Vasconcelos",
    situacao: "ATIVO",
    valorMensal: 9800.0,
  },
  {
    id: "pst-mac-003",
    codigoPosto: "MAC-TEC-003",
    funcao: "Inspetor NDT de Tubulares",
    unidadeId: "MACAE",
    unidadeNome: "Base Macaé / Parque de Tubos",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "08:00",
    horarioFim: "17:48",
    titularMatricula: "MAC-003",
    titularNome: "Rodrigo Brandão",
    situacao: "ATIVO",
    valorMensal: 12500.0,
  },
  {
    id: "pst-mac-004",
    codigoPosto: "MAC-LOG-004",
    funcao: "Operador de Empilhadeira Pesada",
    unidadeId: "MACAE",
    unidadeNome: "Base Macaé / Parque de Tubos",
    escala: "12x36",
    jornadaSemanalHoras: 36,
    horarioInicio: "07:00",
    horarioFim: "19:00",
    titularMatricula: "MAC-004",
    titularNome: "Cleber Maranhão",
    situacao: "ATIVO",
    valorMensal: 10400.0,
  },

  // Base Santos / Terminal Portuário (6 postos)
  {
    id: "pst-san-001",
    codigoPosto: "SAN-LOG-001",
    funcao: "Supervisor de Terminal Portuário",
    unidadeId: "SANTOS",
    unidadeNome: "Terminal Portuário Santos/SP",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "08:00",
    horarioFim: "17:48",
    titularMatricula: "SAN-001",
    titularNome: "Vitor Hugo Santana",
    situacao: "ATIVO",
    valorMensal: 13500.0,
  },
  {
    id: "pst-san-002",
    codigoPosto: "SAN-LOG-002",
    funcao: "Conferente Portuário Químicos",
    unidadeId: "SANTOS",
    unidadeNome: "Terminal Portuário Santos/SP",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "08:00",
    horarioFim: "17:48",
    titularMatricula: "SAN-002",
    titularNome: "Aline Cristina Fonseca",
    situacao: "ATIVO",
    valorMensal: 9200.0,
  },

  // Base Paulínia / Refinaria Replan (5 postos)
  {
    id: "pst-pau-001",
    codigoPosto: "PAU-ALM-001",
    funcao: "Almoxarife de Manutenção Refinaria",
    unidadeId: "PAULINIA",
    unidadeNome: "Refinaria Paulínia (Replan/SP)",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: "PAU-001",
    titularNome: "Everton Guimarães",
    situacao: "ATIVO",
    valorMensal: 9900.0,
  },
  {
    id: "pst-pau-002",
    codigoPosto: "PAU-LOG-002",
    funcao: "Operador de Movimentação e Cargas",
    unidadeId: "PAULINIA",
    unidadeNome: "Refinaria Paulínia (Replan/SP)",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: "PAU-002",
    titularNome: "Renata Cordeiro",
    situacao: "ATIVO",
    valorMensal: 9100.0,
  },
];

/**
 * Gera entradas completas para cálculo consolidado de ocupação e indicadores.
 */
export function prepararEntradaCalculo(
  estadoCustomizado?: EstadoOperacionalCompleto,
  opcoes: OpcoesAdaptador = {}
): FiltrosCalculoOcupacao {
  const estado = estadoCustomizado || carregarEstado();

  const {
    baseId,
    competencia = "2026-09",
    dataHoje = "2026-09-16",
    horaHoje = "08:00",
    perfilUsuario = "PREMIER_GESTOR",
    parametroAusente = false,
    simularRhidAtrasado = false,
  } = opcoes;

  // 1. Mapeamento de Postos
  const valorPadraoPosto = parametroAusente ? null : 9850.0;
  const postosUfn3: PostoEntrada[] = estado.postos.map((p) => ({
    id: p.id,
    codigoPosto: p.codigoPosto,
    funcao: p.funcao,
    unidadeId: p.unidadeId,
    unidadeNome: p.unidadeNome,
    escala: p.escala,
    jornadaSemanalHoras: p.jornadaSemanalHoras,
    horarioInicio: p.horarioInicio,
    horarioFim: p.horarioFim,
    titularMatricula: p.titularMatricula,
    titularNome: p.titularNome,
    situacao: p.situacao,
    valorMensal: valorPadraoPosto,
  }));

  // Se o filtro for TODAS ou não especificado, agregamos as bases da malha Petrobras
  const postosCompletos: PostoEntrada[] = [...postosUfn3, ...POSTOS_OUTRAS_BASES];

  // 2. Mapeamento de Ocorrências
  const ocorrencias: OcorrenciaEntrada[] = estado.ocorrencias.map((o) => ({
    id: o.id,
    matricula: o.matricula,
    postoCodigo: o.postoCodigo,
    tipoOcorrencia: o.tipoOcorrencia,
    dataInicio: o.dataInicio,
    dataFim: o.dataFim,
    observacaoPublica: o.observacaoPublica,
    status: o.status,
  }));

  // 3. Mapeamento de Coberturas
  const coberturas: CoberturaEntrada[] = estado.coberturas.map((c) => ({
    id: c.id,
    postoCodigo: c.postoCodigo,
    titularMatricula: c.titularMatricula,
    substitutoMatricula: c.substitutoMatricula,
    substitutoNome: c.substitutoNome,
    dataInicio: c.dataInicio,
    dataFim: c.dataFim,
    tipoCobertura: c.tipoCobertura,
    status: c.status,
    justificativa: c.justificativa,
  }));

  // 4. Mapeamento de Apontamentos
  const apontamentos: ApontamentoEntrada[] = estado.apontamentos.map((a) => ({
    id: a.id,
    postoCodigo: a.postoCodigo,
    funcaoPosto: a.funcaoPosto,
    dataReferencia: a.dataReferencia,
    texto: a.texto,
    status: a.status,
    prazoResposta: a.status === "ABERTO" || a.status === "EM_TRATAMENTO" ? "2026-09-18" : undefined,
    criadoPor: a.criadoPor,
  }));

  // 5. Geração de Batidas de Ponto Realistas (RHID) do dia 01/09 ao dia 16/09
  const pontos: PontoEntrada[] = [];
  const datasPonto: string[] = [];
  for (let d = 1; d <= 16; d++) {
    const diaStr = d < 10 ? `0${d}` : `${d}`;
    datasPonto.push(`2026-09-${diaStr}`);
  }

  // Pontos de titulares das outras bases
  POSTOS_OUTRAS_BASES.forEach((p) => {
    if (p.titularMatricula) {
      datasPonto.forEach((dt) => {
        pontos.push({
          matricula: p.titularMatricula!,
          data: dt,
          situacaoPonto: "PRESENTE",
          horaEntrada: p.horarioInicio,
          horaSaida: p.horarioFim,
          horasTrabalhadas: 8.8,
          codigoPosto: p.codigoPosto,
        });
      });
    }
  });

  // Pontos dos titulares e substitutos de UFN-III
  postosUfn3.forEach((posto) => {
    const mat = posto.titularMatricula;
    if (!mat) return; // Posto sem titular não tem ponto de titular

    datasPonto.forEach((dt) => {
      // 07/09 é feriado nacional
      if (dt === "2026-09-07" && posto.escala === "5x2") {
        pontos.push({
          matricula: mat,
          data: dt,
          situacaoPonto: "FOLGA",
          codigoPosto: posto.codigoPosto,
        });
        return;
      }

      // Ocorrência 1: Thiago Barbosa (PRM-00114) no PST-ALM-014 (03/09 a 05/09)
      if (mat === "PRM-00114" && dt >= "2026-09-03" && dt <= "2026-09-05") {
        pontos.push({
          matricula: mat,
          data: dt,
          situacaoPonto: "AFASTADO",
          codigoPosto: posto.codigoPosto,
        });
        return;
      }

      // Ocorrência 2: Beatriz Santos Cruz (PRM-00113) no PST-ALM-015 (08/09)
      if (mat === "PRM-00113" && dt === "2026-09-08") {
        pontos.push({
          matricula: mat,
          data: dt,
          situacaoPonto: "AUSENTE",
          codigoPosto: posto.codigoPosto,
        });
        return;
      }

      // Ocorrência 3: Mariana Souza Lima (PRM-00102) no PST-ALM-002 (11/09)
      if (mat === "PRM-00102" && dt === "2026-09-11") {
        pontos.push({
          matricula: mat,
          data: dt,
          situacaoPonto: "AUSENTE",
          codigoPosto: posto.codigoPosto,
        });
        return;
      }

      // Presença normal
      pontos.push({
        matricula: mat,
        data: dt,
        situacaoPonto: "PRESENTE",
        horaEntrada: posto.horarioInicio,
        horaSaida: posto.horarioFim,
        horasTrabalhadas: posto.jornadaSemanalHoras === 44 ? 8.8 : 12.0,
        codigoPosto: posto.codigoPosto,
      });
    });
  });

  // Pontos de substitutos alocados nas coberturas
  // Substituto PRM-00115 (Diego Camargo) nos dias 03/09 a 05/09 para PST-ALM-014
  ["2026-09-03", "2026-09-04", "2026-09-05"].forEach((dt) => {
    pontos.push({
      matricula: "PRM-00115",
      data: dt,
      situacaoPonto: "PRESENTE",
      horaEntrada: "07:00",
      horaSaida: "16:48",
      horasTrabalhadas: 8.8,
      codigoPosto: "PST-ALM-014",
    });
  });

  // Substituto PRM-00116 (Aline Mendes) no dia 11/09 para PST-ALM-002
  pontos.push({
    matricula: "PRM-00116",
    data: "2026-09-11",
    situacaoPonto: "PRESENTE",
    horaEntrada: "07:00",
    horaSaida: "16:48",
    horasTrabalhadas: 8.8,
    codigoPosto: "PST-ALM-002",
  });

  // 6. Logs de Importação
  const logsImportacao: ImportacaoLogEntrada[] = [
    {
      fonte: "RHID",
      dataExecucao: simularRhidAtrasado ? "2026-09-14 07:00:00" : "2026-09-16 08:30:00",
      periodoFim: "2026-09-16 18:00:00",
      status: "CONCLUIDO",
    },
    {
      fonte: "RM",
      dataExecucao: "2026-09-16 07:00:00",
      periodoFim: "2026-09-16",
      status: "CONCLUIDO",
    },
  ];

  // 7. Parâmetros da Base / Contrato
  const parametros: ParametroBaseEntrada = {
    metaSla: 95.0,
    fatorGlosa: parametroAusente ? null : 1.0,
  };

  const baseIdsFiltro =
    baseId && baseId !== "TODAS" && baseId.trim().length > 0 ? [baseId] : undefined;

  return {
    baseIds: baseIdsFiltro,
    competencia,
    dataReferenciaHoje: dataHoje,
    horaReferenciaHoje: horaHoje,
    perfilUsuario,
    dados: {
      postos: postosCompletos,
      ocorrencias,
      coberturas,
      pontos,
      logsImportacao,
      apontamentos,
      parametros,
      feriados: ["2026-09-07"],
    },
  };
}

/**
 * Executa o cálculo unificado de ocupação utilizando os dados sincronizados.
 */
export function obterOcupacaoConsolidada(
  estadoCustomizado?: EstadoOperacionalCompleto,
  opcoes: OpcoesAdaptador = {}
): ResultadoOcupacaoConsolidado {
  const entradas = prepararEntradaCalculo(estadoCustomizado, opcoes);
  return calcularOcupacao(entradas);
}
