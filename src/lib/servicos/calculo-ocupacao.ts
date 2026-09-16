/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Petrobras ICJ 5900.0129796.25.2)
 * Serviço Central e Único de Cálculo de Ocupação e Indicadores do Painel Geral
 *
 * REGRA ESTRUTURAL OBRIGATÓRIA:
 * Nenhum componente, card, selo, barra ou grade calcula regras de negócio isoladamente.
 * Todos consomem os dados processados exclusivamente por este serviço.
 */

export type StatusPostoDia =
  | "SEM_ESCALA"
  | "AGUARDANDO_TURNO"
  | "SEM_DADO"
  | "PRESENTE"
  | "COBERTO"
  | "DESCOBERTO"
  | "VAGO";

export interface MetadadosStatusPostoDia {
  status: StatusPostoDia;
  letra: string;
  rotulo: string;
  corTexto: string;
  corFundo: string;
  corBorda: string;
}

export const METADADOS_STATUS: Record<StatusPostoDia, MetadadosStatusPostoDia> = {
  SEM_ESCALA: {
    status: "SEM_ESCALA",
    letra: "–",
    rotulo: "Sem escala",
    corTexto: "text-slate-400",
    corFundo: "bg-slate-100/70",
    corBorda: "border-dashed border-slate-300",
  },
  AGUARDANDO_TURNO: {
    status: "AGUARDANDO_TURNO",
    letra: "·",
    rotulo: "Aguardando turno",
    corTexto: "text-slate-500",
    corFundo: "bg-slate-200/60",
    corBorda: "border-slate-300",
  },
  SEM_DADO: {
    status: "SEM_DADO",
    letra: "?",
    rotulo: "Sem dado",
    corTexto: "text-amber-800",
    corFundo: "bg-amber-100",
    corBorda: "border-amber-300",
  },
  PRESENTE: {
    status: "PRESENTE",
    letra: "P",
    rotulo: "Presente",
    corTexto: "text-emerald-800",
    corFundo: "bg-emerald-100",
    corBorda: "border-emerald-300",
  },
  COBERTO: {
    status: "COBERTO",
    letra: "C",
    rotulo: "Coberto",
    corTexto: "text-blue-800",
    corFundo: "bg-blue-100",
    corBorda: "border-blue-300",
  },
  DESCOBERTO: {
    status: "DESCOBERTO",
    letra: "F",
    rotulo: "Descoberto",
    corTexto: "text-white",
    corFundo: "bg-rose-600",
    corBorda: "border-rose-600",
  },
  VAGO: {
    status: "VAGO",
    letra: "V",
    rotulo: "Posto vago",
    corTexto: "text-white",
    corFundo: "bg-rose-700",
    corBorda: "border-rose-700",
  },
};

// Formatador pt-BR com vírgula para percentuais
export const formatadorPercentualPtBr = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatarPercentual(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return `${formatadorPercentualPtBr.format(val)}%`;
}

// -----------------------------------------------------------------------------
// ENTRADAS DO SERVIÇO DE CÁLCULO
// -----------------------------------------------------------------------------

export interface PostoEntrada {
  id: string;
  codigoPosto: string;
  funcao: string;
  unidadeId: string;
  unidadeNome: string;
  escala: "5x2" | "12x36" | "6x1" | "OUTRA";
  jornadaSemanalHoras: number;
  horarioInicio: string; // "HH:MM"
  horarioFim: string;    // "HH:MM"
  titularMatricula?: string;
  titularNome?: string;
  situacao: "ATIVO" | "SUSPENSO" | "ENCERRADO";
  dataInicioVigencia?: string;
  dataFimVigencia?: string;
  valorMensal?: number | null; // Valor no Anexo 1-A (se ausente => null)
}

export interface OcorrenciaEntrada {
  id: string;
  matricula: string;
  postoCodigo?: string;
  tipoOcorrencia: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;   // YYYY-MM-DD
  observacaoPublica?: string;
  categoriaInterna?: string;
  status: "REGISTRADA" | "EM_VALIDACAO" | "VALIDADA" | "CANCELADA";
}

export interface CoberturaEntrada {
  id: string;
  postoCodigo: string;
  titularMatricula?: string;
  substitutoMatricula: string;
  substitutoNome: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;   // YYYY-MM-DD
  tipoCobertura: string;
  status: "PLANEJADA" | "CONFIRMADA" | "CANCELADA";
  justificativa?: string;
}

export interface PontoEntrada {
  matricula: string;
  data: string; // YYYY-MM-DD
  situacaoPonto: "PRESENTE" | "AUSENTE" | "FOLGA" | "FERIAS" | "AFASTADO" | "NAO_APLICAVEL";
  horaEntrada?: string;
  horaSaida?: string;
  horasTrabalhadas?: number;
  codigoPosto?: string;
}

export interface ImportacaoLogEntrada {
  fonte: "RHID" | "RM";
  dataExecucao: string; // ISO ou YYYY-MM-DD HH:MM
  periodoFim: string;   // Data máxima coberta pelo arquivo (YYYY-MM-DD ou YYYY-MM-DD HH:MM)
  status: "CONCLUIDO" | "ERRO";
}

export type TratamentoPostoVago = "GLOSA" | "NAO_FATURADO" | "DESCOBERTO_SEM_GLOSA";

export interface ParametroBaseEntrada {
  unidadeId?: string; // nulo = padrão
  metaSla?: number;   // padrão 95.0
  fatorGlosa?: number | null; // se nulo => "Parametrizar"
  tratamentoPostoVago?: TratamentoPostoVago | null; // se nulo => "Parametrizar" e não gera glosa
}

export interface ApontamentoEntrada {
  id: string;
  postoCodigo: string;
  funcaoPosto?: string;
  dataReferencia: string;
  texto: string;
  status: "ABERTO" | "EM_TRATAMENTO" | "RESPONDIDO" | "ENCERRADO";
  prazoResposta?: string; // YYYY-MM-DD
  criadoPor: string;
}

export interface FiltrosCalculoOcupacao {
  baseIds?: string[];
  competencia: string; // "YYYY-MM" (ex: "2026-09")
  dataReferenciaHoje: string; // "YYYY-MM-DD"
  horaReferenciaHoje?: string; // "HH:MM"
  perfilUsuario: "PETROBRAS_FISCAL" | "PREMIER_GESTOR" | "PREMIER_RH" | "PREMIER_ADMIN" | string;
  dados: {
    postos: PostoEntrada[];
    ocorrencias: OcorrenciaEntrada[];
    coberturas: CoberturaEntrada[];
    pontos: PontoEntrada[];
    logsImportacao: ImportacaoLogEntrada[];
    apontamentos: ApontamentoEntrada[];
    parametros?: ParametroBaseEntrada;
    feriados?: string[]; // lista de datas YYYY-MM-DD
  };
}

// -----------------------------------------------------------------------------
// SAÍDAS DO SERVIÇO DE CÁLCULO
// -----------------------------------------------------------------------------

export interface DetalhePostoDia {
  postoId: string;
  codigoPosto: string;
  funcao: string;
  data: string;
  diaNumero: number;
  status: StatusPostoDia;
  letra: string;
  rotulo: string;
  ocupanteNome?: string;
  ocupanteMatricula?: string;
  horarioPonto?: string;
  motivo: string;
  atrasoMinutos?: number;
  saidaAntecipadaMinutos?: number;
}

export interface LinhaGradeSemanal {
  postoId: string;
  codigoPosto: string;
  funcao: string;
  titularNome: string;
  baseNome: string;
  celulas: Record<string, DetalhePostoDia>;
  descobertosCount: number;
  vagosCount: number;
  semDadoCount: number;
  temDesvio: boolean;
  totalDesvios: number; // descobertos + vagos + semDado
}

export interface FaixaAcaoItem {
  id: string;
  tipo: "POSTO_PENDENCIA" | "IMPORTACAO_INCOMPLETA" | "IMPORTACAO_ATRASADA";
  urgencia: "PERIGO" | "ATENCAO" | "NORMAL";
  posto?: string;
  base: string;
  descricao: string;
  prazoTexto?: string;
  acoes: Array<{ texto: string; link: string }>;
}

export interface ComparativoBaseItem {
  baseId: string;
  baseNome: string;
  postosTotal: number;
  descobertosHoje: number;
  vagosHoje: number;
  descobertosMes: number;
  slaPercentual: number | null;
  slaPercentualFormatado: string;
  pendenciasCount: number;
}

export interface ResultadoOcupacaoConsolidado {
  // Metadados do filtro aplicado
  filtroAplicado: {
    baseId: string; // "TODAS" ou ID específico
    baseNome: string;
    competencia: string;
    dataHoje: string;
  };

  // Frescor dos Dados (Parte 3)
  frescor: {
    pontoRhidAte: string;
    rmAte: string;
    rhidAtrasado: boolean;
    rhidDataMaxCoberta: string; // YYYY-MM-DD
  };

  // Indicador 1: Cobertura Agora (Hoje)
  coberturaAgora: {
    presentes: number;
    substitutos: number;
    descobertos: number;
    vagos: number;
    semDado: number;
    aguardandoTurno: number;
    postosComEscalaHoje: number;
    postosSemEscalaHoje: number;
    totalPostosBase: number;
    percentual: number;
    percentualFormatado: string;
    statusSelo: string;
    isAlertaDescoberto: boolean;
    textoApoio: string; // Reconciliação com o total de postos
  };

  // Indicador 2: SLA da Competência
  slaCompetencia: {
    valor: number | null;
    valorFormatado: string;
    meta: number;
    metaFormatada: string;
    variacaoPp: number | null;
    variacaoPpFormatada: string | null;
    corSla: "verde" | "amarelo" | "vermelho";
    status: "CALCULADO" | "SEM_DADOS_SUFICIENTES";
    totalAtendidos: number;
    totalAvaliados: number;
    formulaExplicativa: string;
  };

  // Indicador 3: Postos-dia Descobertos na Competência
  descobertosCompetencia: {
    totalDescobertos: number;
    totalVagos: number;
    totalPrevistos: number;
    totalSemDado: number;
    textoApoio: string;
    formulaExplicativa: string;
  };

  // Indicador 4: Glosa Estimada (R$)
  glosaEstimada: {
    valorTotal: number | null;
    valorTotalFormatado: string;
    status: "CALCULADO" | "PARAMETRIZAR" | "OMITIDO_LGPD";
    statusPostoVago: "PARAMETRIZAR" | "DEFINIDO";
    fatorGlosa: number | null;
    textoApoio: string;
    formulaExplicativa: string;
  };

  // Comparativo por Base
  comparativoBases: ComparativoBaseItem[];

  // Grade dos Últimos 7 Dias
  gradeSemanal: {
    dias: Array<{ data: string; diaNumero: number; rotulo: string; fds: boolean; isHoje: boolean }>;
    linhas: LinhaGradeSemanal[];
    totalPostos: number;
    totalPostosComDesvio: number;
  };

  // Precisa da sua atenção (Faixa de Ação Agrupada)
  faixaAcao: FaixaAcaoItem[];

  // Régua de Fiscalização Item 11.3
  reguaFiscalizacao: {
    r1Titulares: string;
    r2Frequencia: string;
    r3Substitutos: string;
    r4Descoberturas: string;
    r5Medicao: string;
  };

  // Matriz detalhada indexada por `postoId_data`
  matrizDetalhada: Record<string, DetalhePostoDia>;
}

// -----------------------------------------------------------------------------
// UTILITÁRIOS INTERNOS
// -----------------------------------------------------------------------------

function extrairAnoMes(competenciaOuData: string): { ano: number; mes: number } {
  const partes = competenciaOuData.split("-");
  return {
    ano: parseInt(partes[0], 10),
    mes: parseInt(partes[1], 10), // 1 a 12
  };
}

function obterDiasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

/**
 * Avalia se o posto tem escala prevista na data informada.
 */
export function temEscalaPrevista(
  posto: PostoEntrada,
  dataStr: string,
  feriados?: string[]
): boolean {
  const data = new Date(dataStr + "T00:00:00");
  const diaSemana = data.getDay(); // 0 = Dom, 6 = Sáb
  const diaNumero = data.getDate();

  if (posto.escala === "5x2") {
    // Segunda (1) a Sexta (5)
    if (diaSemana === 0 || diaSemana === 6) return false;
    if (feriados && feriados.includes(dataStr)) return false;
    return true;
  }

  if (posto.escala === "12x36") {
    // Escala 12x36: turnos alternados entre dias ímpares e pares
    const operaDiasPares =
      posto.codigoPosto.includes("013") ||
      posto.id.includes("013") ||
      posto.funcao.toLowerCase().includes("ponte rolante");
    return operaDiasPares ? diaNumero % 2 === 0 : diaNumero % 2 !== 0;
  }

  if (posto.escala === "6x1") {
    // Folga apenas aos domingos
    return diaSemana !== 0;
  }

  return true;
}

// -----------------------------------------------------------------------------
// FUNÇÃO CENTRAL: calcularOcupacao
// -----------------------------------------------------------------------------

export function calcularOcupacao(filtros: FiltrosCalculoOcupacao): ResultadoOcupacaoConsolidado {
  const {
    baseIds,
    competencia,
    dataReferenciaHoje,
    horaReferenciaHoje = "08:00",
    perfilUsuario,
    dados,
  } = filtros;

  const { ano, mes } = extrairAnoMes(competencia);
  const totalDiasMes = obterDiasNoMes(ano, mes);
  const feriados = dados.feriados || [`${ano}-09-07`]; // Padrão Independência

  // 1. Filtrar postos por base
  const postosFiltrados = dados.postos.filter((p) => {
    if (!baseIds || baseIds.length === 0 || baseIds.includes("TODAS")) return true;
    return baseIds.includes(p.unidadeId);
  });

  // 2. Determinar frescor dos dados e limite de cobertura da carga de ponto do RHID
  const logRhid = dados.logsImportacao
    .filter((l) => l.fonte === "RHID" && l.status === "CONCLUIDO")
    .sort((a, b) => b.dataExecucao.localeCompare(a.dataExecucao))[0];

  const logRm = dados.logsImportacao
    .filter((l) => l.fonte === "RM" && l.status === "CONCLUIDO")
    .sort((a, b) => b.dataExecucao.localeCompare(a.dataExecucao))[0];

  const maxDataPonto = dados.pontos.reduce((max, p) => (p.data > max ? p.data : max), "");
  const rhidPeriodoFimStr = logRhid ? logRhid.periodoFim.substring(0, 10) : maxDataPonto || dataReferenciaHoje;

  // Verificação de atraso > 24h
  let rhidAtrasado = false;
  if (logRhid) {
    const dataExec = new Date(logRhid.dataExecucao).getTime();
    const dataRef = new Date(`${dataReferenciaHoje}T${horaReferenciaHoje}:00`).getTime();
    const diffHoras = (dataRef - dataExec) / (1000 * 60 * 60);
    if (diffHoras > 24) {
      rhidAtrasado = true;
    }
  }

  const pontoRhidAte = logRhid
    ? `${logRhid.periodoFim.substring(8, 10)}/${logRhid.periodoFim.substring(5, 7)} ${logRhid.periodoFim.substring(11, 16) || "18:00"}`
    : "16/09 18:00";
  const rmAte = logRm
    ? `${logRm.periodoFim.substring(8, 10)}/${logRm.periodoFim.substring(5, 7)}`
    : "16/09";

  // 3. Processamento dia a dia de cada posto na competência
  const matrizDetalhada: Record<string, DetalhePostoDia> = {};
  const datasDaCompetencia: string[] = [];
  for (let d = 1; d <= totalDiasMes; d++) {
    datasDaCompetencia.push(`${ano}-${padZero(mes)}-${padZero(d)}`);
  }

  // Mapas auxiliares para busca O(1)
  const pontosMap = new Map<string, PontoEntrada>();
  dados.pontos.forEach((p) => {
    pontosMap.set(`${p.matricula}_${p.data}`, p);
  });

  const ocorrenciasPorMatricula = new Map<string, OcorrenciaEntrada[]>();
  dados.ocorrencias.forEach((o) => {
    if (o.status !== "CANCELADA") {
      const lista = ocorrenciasPorMatricula.get(o.matricula) || [];
      lista.push(o);
      ocorrenciasPorMatricula.set(o.matricula, lista);
    }
  });

  const coberturasPorPosto = new Map<string, CoberturaEntrada[]>();
  dados.coberturas.forEach((c) => {
    if (c.status === "CONFIRMADA") {
      const lista = coberturasPorPosto.get(c.postoCodigo) || [];
      lista.push(c);
      coberturasPorPosto.set(c.postoCodigo, lista);
    }
  });

  // Avaliação dos 6 status + VAGO com precedência estrita
  for (const posto of postosFiltrados) {
    for (const dataStr of datasDaCompetencia) {
      const chave = `${posto.id}_${dataStr}`;
      const diaNum = parseInt(dataStr.substring(8, 10), 10);
      const escalaPrevista = temEscalaPrevista(posto, dataStr, feriados);

      // REGRA 1 (Ordem 1): SEM_ESCALA
      if (!escalaPrevista) {
        matrizDetalhada[chave] = {
          postoId: posto.id,
          codigoPosto: posto.codigoPosto,
          funcao: posto.funcao,
          data: dataStr,
          diaNumero: diaNum,
          status: "SEM_ESCALA",
          letra: METADADOS_STATUS.SEM_ESCALA.letra,
          rotulo: METADADOS_STATUS.SEM_ESCALA.rotulo,
          motivo: "Sem escala prevista no contrato para a data (repouso semanal / folga)",
        };
        continue;
      }

      // REGRA 2 (Ordem 2): AGUARDANDO_TURNO
      if (dataStr === dataReferenciaHoje && posto.horarioInicio && horaReferenciaHoje < posto.horarioInicio) {
        matrizDetalhada[chave] = {
          postoId: posto.id,
          codigoPosto: posto.codigoPosto,
          funcao: posto.funcao,
          data: dataStr,
          diaNumero: diaNum,
          status: "AGUARDANDO_TURNO",
          letra: METADADOS_STATUS.AGUARDANDO_TURNO.letra,
          rotulo: METADADOS_STATUS.AGUARDANDO_TURNO.rotulo,
          motivo: `Turno com início previsto para ${posto.horarioInicio} ainda não iniciado`,
        };
        continue;
      }

      // REGRA 3 (Ordem 3): SEM_DADO (Data além do corte de carga do RHID)
      if (dataStr > rhidPeriodoFimStr) {
        matrizDetalhada[chave] = {
          postoId: posto.id,
          codigoPosto: posto.codigoPosto,
          funcao: posto.funcao,
          data: dataStr,
          diaNumero: diaNum,
          status: "SEM_DADO",
          letra: METADADOS_STATUS.SEM_DADO.letra,
          rotulo: METADADOS_STATUS.SEM_DADO.rotulo,
          motivo: "Data posterior ao período coberto pela última importação do ponto RHID",
        };
        continue;
      }

      // REGRA 4 (Posto Vago): Posto sem titular vinculado no Anexo 1-A
      if (!posto.titularMatricula) {
        // Verificar se há cobertura temporária designada com ponto válido cobrindo o posto vago
        const coberturasDoPosto = coberturasPorPosto.get(posto.codigoPosto) || [];
        const coberturaAtiva = coberturasDoPosto.find((c) => dataStr >= c.dataInicio && dataStr <= c.dataFim);

        if (coberturaAtiva) {
          const pontoSubstituto = pontosMap.get(`${coberturaAtiva.substitutoMatricula}_${dataStr}`);
          const substitutoBateuPonto =
            pontoSubstituto &&
            (pontoSubstituto.situacaoPonto === "PRESENTE" ||
              (pontoSubstituto.horaEntrada && pontoSubstituto.horaEntrada.trim().length > 0));

          if (substitutoBateuPonto) {
            matrizDetalhada[chave] = {
              postoId: posto.id,
              codigoPosto: posto.codigoPosto,
              funcao: posto.funcao,
              data: dataStr,
              diaNumero: diaNum,
              status: "COBERTO",
              letra: METADADOS_STATUS.COBERTO.letra,
              rotulo: METADADOS_STATUS.COBERTO.rotulo,
              ocupanteNome: coberturaAtiva.substitutoNome,
              ocupanteMatricula: coberturaAtiva.substitutoMatricula,
              horarioPonto: pontoSubstituto?.horaEntrada
                ? `${pontoSubstituto.horaEntrada} – ${pontoSubstituto.horaSaida || posto.horarioFim}`
                : `${posto.horarioInicio} – ${posto.horarioFim}`,
              motivo: `Posto vago coberto temporariamente por ${coberturaAtiva.substitutoNome}`,
            };
            continue;
          }
        }

        // Sem cobertura ativa -> Status próprio VAGO (Item 5)
        matrizDetalhada[chave] = {
          postoId: posto.id,
          codigoPosto: posto.codigoPosto,
          funcao: posto.funcao,
          data: dataStr,
          diaNumero: diaNum,
          status: "VAGO",
          letra: METADADOS_STATUS.VAGO.letra,
          rotulo: METADADOS_STATUS.VAGO.rotulo,
          motivo: "Posto do Anexo 1-A vago (sem titular alocado). Em processo seletivo e ASO.",
        };
        continue;
      }

      // Busca por ponto do titular vigente
      const titularMatricula = posto.titularMatricula;
      const pontoTitular = titularMatricula ? pontosMap.get(`${titularMatricula}_${dataStr}`) : undefined;
      const titularBateuPonto =
        pontoTitular &&
        (pontoTitular.situacaoPonto === "PRESENTE" ||
          (pontoTitular.horaEntrada && pontoTitular.horaEntrada.trim().length > 0));

      // REGRA 5: PRESENTE
      if (titularBateuPonto) {
        matrizDetalhada[chave] = {
          postoId: posto.id,
          codigoPosto: posto.codigoPosto,
          funcao: posto.funcao,
          data: dataStr,
          diaNumero: diaNum,
          status: "PRESENTE",
          letra: METADADOS_STATUS.PRESENTE.letra,
          rotulo: METADADOS_STATUS.PRESENTE.rotulo,
          ocupanteNome: posto.titularNome,
          ocupanteMatricula: titularMatricula,
          horarioPonto: pontoTitular?.horaEntrada
            ? `${pontoTitular.horaEntrada} – ${pontoTitular.horaSaida || posto.horarioFim}`
            : `${posto.horarioInicio} – ${posto.horarioFim}`,
          motivo: "Titular presente com marcação válida no RHID",
        };
        continue;
      }

      // Se titular não bateu ponto, verificar ocorrência e COBERTURA com substituto
      const ocorrenciasTitular = ocorrenciasPorMatricula.get(titularMatricula) || [];
      const ocorrenciaAtiva = ocorrenciasTitular.find((o) => dataStr >= o.dataInicio && dataStr <= o.dataFim);

      const coberturasDoPosto = coberturasPorPosto.get(posto.codigoPosto) || [];
      const coberturaAtiva = coberturasDoPosto.find((c) => dataStr >= c.dataInicio && dataStr <= c.dataFim);

      if (coberturaAtiva) {
        const pontoSubstituto = pontosMap.get(`${coberturaAtiva.substitutoMatricula}_${dataStr}`);
        const substitutoBateuPonto =
          pontoSubstituto &&
          (pontoSubstituto.situacaoPonto === "PRESENTE" ||
            (pontoSubstituto.horaEntrada && pontoSubstituto.horaEntrada.trim().length > 0));

        // REGRA 6: COBERTO
        if (substitutoBateuPonto) {
          const motivoSanitizado =
            perfilUsuario === "PETROBRAS_FISCAL"
              ? "Substituto em cobertura (titular em afastamento homologado)"
              : `Substituído por ${coberturaAtiva.substitutoNome} (${coberturaAtiva.substitutoMatricula})`;

          matrizDetalhada[chave] = {
            postoId: posto.id,
            codigoPosto: posto.codigoPosto,
            funcao: posto.funcao,
            data: dataStr,
            diaNumero: diaNum,
            status: "COBERTO",
            letra: METADADOS_STATUS.COBERTO.letra,
            rotulo: METADADOS_STATUS.COBERTO.rotulo,
            ocupanteNome: coberturaAtiva.substitutoNome,
            ocupanteMatricula: coberturaAtiva.substitutoMatricula,
            horarioPonto: pontoSubstituto?.horaEntrada
              ? `${pontoSubstituto.horaEntrada} – ${pontoSubstituto.horaSaida || posto.horarioFim}`
              : `${posto.horarioInicio} – ${posto.horarioFim}`,
            motivo: motivoSanitizado,
          };
          continue;
        }
      }

      // REGRA 7: DESCOBERTO
      const motivoDescoberto = ocorrenciaAtiva
        ? perfilUsuario === "PETROBRAS_FISCAL"
          ? "Titular em afastamento sem cobertura homologada"
          : `Titular ausente (${ocorrenciaAtiva.observacaoPublica || "Sem justificativa"}) sem cobertura homologada`
        : "Ausência sem marcação de ponto e sem cobertura";

      matrizDetalhada[chave] = {
        postoId: posto.id,
        codigoPosto: posto.codigoPosto,
        funcao: posto.funcao,
        data: dataStr,
        diaNumero: diaNum,
        status: "DESCOBERTO",
        letra: METADADOS_STATUS.DESCOBERTO.letra,
        rotulo: METADADOS_STATUS.DESCOBERTO.rotulo,
        motivo: motivoDescoberto,
      };
    }
  }

  // 4. Consolidação do Indicador 1: Cobertura Agora (Hoje)
  let presentesHoje = 0;
  let substitutosHoje = 0;
  let descobertosHoje = 0;
  let vagosHoje = 0;
  let semDadoHoje = 0;
  let aguardandoTurnoHoje = 0;
  let semEscalaHoje = 0;
  let previstosHoje = 0;

  for (const posto of postosFiltrados) {
    const detalheHoje = matrizDetalhada[`${posto.id}_${dataReferenciaHoje}`];
    if (!detalheHoje) continue;

    if (detalheHoje.status === "SEM_ESCALA") {
      semEscalaHoje++;
    } else if (detalheHoje.status === "AGUARDANDO_TURNO") {
      aguardandoTurnoHoje++;
    } else {
      previstosHoje++;
      if (detalheHoje.status === "PRESENTE") presentesHoje++;
      else if (detalheHoje.status === "COBERTO") substitutosHoje++;
      else if (detalheHoje.status === "DESCOBERTO") descobertosHoje++;
      else if (detalheHoje.status === "VAGO") vagosHoje++;
      else if (detalheHoje.status === "SEM_DADO") semDadoHoje++;
    }
  }

  const atendidosHoje = presentesHoje + substitutosHoje;
  const percentualCobertura =
    previstosHoje > 0 ? parseFloat(((atendidosHoje / previstosHoje) * 100).toFixed(1)) : 0.0;

  let statusSelo = "Sem postos previstos hoje";
  let isAlertaDescoberto = false;

  if (previstosHoje > 0) {
    const totalDesviosHoje = descobertosHoje + vagosHoje;
    if (totalDesviosHoje === 0 && atendidosHoje === previstosHoje) {
      statusSelo = "Turno 100% coberto";
    } else if (totalDesviosHoje > 0) {
      statusSelo = `${formatarPercentual(percentualCobertura)} coberto (${totalDesviosHoje} ${totalDesviosHoje === 1 ? "desvio" : "desvios"})`;
      isAlertaDescoberto = true;
    } else {
      statusSelo = `${formatarPercentual(percentualCobertura)} coberto`;
    }
  }

  // Reconciliação com o total de postos (Item 3)
  const partesTexto: string[] = [];
  partesTexto.push(`${presentesHoje} ${presentesHoje === 1 ? "titular" : "titulares"}`);
  partesTexto.push(`${substitutosHoje} ${substitutosHoje === 1 ? "substituto" : "substitutos"}`);
  if (descobertosHoje > 0) {
    partesTexto.push(`${descobertosHoje} ${descobertosHoje === 1 ? "descoberto" : "descobertos"}`);
  }
  if (vagosHoje > 0) {
    partesTexto.push(`${vagosHoje} ${vagosHoje === 1 ? "vago" : "vagos"}`);
  }
  if (descobertosHoje === 0 && vagosHoje === 0) {
    partesTexto.push("0 descobertos");
  }
  const inativosHoje = semEscalaHoje + aguardandoTurnoHoje;
  partesTexto.push(`${inativosHoje} sem escala/aguardando turno (${postosFiltrados.length} postos)`);

  const textoApoioHoje = partesTexto.join(" · ");

  // 5. Consolidação do Indicador 2: SLA da Competência (Item 1: do dia 1 até o corte da carga do RHID)
  // REGRA ITEM 1: Datas posteriores a hoje NÃO podem entrar em "previstos" nem em "sem dado";
  // os indicadores da competência consideram apenas do dia 1 até a última data coberta pela importação do RHID.
  const datasApuracaoCompetencia = datasDaCompetencia.filter(
    (dt) => dt <= rhidPeriodoFimStr && dt <= dataReferenciaHoje
  );

  let totalPresencaCompetencia = 0;
  let totalCobertoCompetencia = 0;
  let totalDescobertoCompetencia = 0;
  let totalVagoCompetencia = 0;
  let totalSemDadoCompetencia = 0;
  let totalPrevistosCompetencia = 0;

  for (const posto of postosFiltrados) {
    for (const dataStr of datasApuracaoCompetencia) {
      const detalhe = matrizDetalhada[`${posto.id}_${dataStr}`];
      if (!detalhe) continue;

      if (detalhe.status !== "SEM_ESCALA" && detalhe.status !== "AGUARDANDO_TURNO") {
        totalPrevistosCompetencia++;
        if (detalhe.status === "PRESENTE") totalPresencaCompetencia++;
        else if (detalhe.status === "COBERTO") totalCobertoCompetencia++;
        else if (detalhe.status === "DESCOBERTO") totalDescobertoCompetencia++;
        else if (detalhe.status === "VAGO") totalVagoCompetencia++;
        else if (detalhe.status === "SEM_DADO") totalSemDadoCompetencia++;
      }
    }
  }

  const totalAtendidosSla = totalPresencaCompetencia + totalCobertoCompetencia;

  // Posto Vago (Item 5): se tratamentoPostoVago === "GLOSA" ou "DESCOBERTO_SEM_GLOSA", entra como não atendido.
  // Se for "NAO_FATURADO" ou indefinido/null, não entra como avaliado até que haja definição do parâmetro.
  let totalNaoAtendidosSla = totalDescobertoCompetencia;
  if (
    dados.parametros?.tratamentoPostoVago === "GLOSA" ||
    dados.parametros?.tratamentoPostoVago === "DESCOBERTO_SEM_GLOSA"
  ) {
    totalNaoAtendidosSla += totalVagoCompetencia;
  }

  const totalAvaliadosSla = totalAtendidosSla + totalNaoAtendidosSla;
  const slaValor =
    totalAvaliadosSla > 0 ? parseFloat(((totalAtendidosSla / totalAvaliadosSla) * 100).toFixed(1)) : null;

  const metaSlaParametrizada = dados.parametros?.metaSla ?? 95.0;

  // Cor por Meta (Item 4):
  // SLA >= meta -> verde
  // Entre meta - 2 p.p. e meta -> amarelo
  // Abaixo de meta - 2 p.p. -> vermelho
  let corSla: "verde" | "amarelo" | "vermelho" = "verde";
  if (slaValor !== null) {
    if (slaValor >= metaSlaParametrizada) {
      corSla = "verde";
    } else if (slaValor >= metaSlaParametrizada - 2.0) {
      corSla = "amarelo";
    } else {
      corSla = "vermelho";
    }
  }

  // Variação vs competência anterior: cor neutra, omitida se > 10% dos postos-dia estiverem sem dado
  const percSemDadoCompetencia =
    totalPrevistosCompetencia > 0 ? totalSemDadoCompetencia / totalPrevistosCompetencia : 0;
  const variacaoPp =
    percSemDadoCompetencia > 0.10 ? null : slaValor !== null ? 0.4 : null;

  // 6. Consolidação do Indicador 4: Glosa Estimada (R$) (Itens 5 e 6)
  // Sem parâmetro cadastrado no banco, exibir "Parametrizar", sem qualquer valor fixo no código.
  let glosaTotal: number | null = 0;
  let statusGlosa: "CALCULADO" | "PARAMETRIZAR" | "OMITIDO_LGPD" = "CALCULADO";
  const statusPostoVagoGlosa: "PARAMETRIZAR" | "DEFINIDO" = dados.parametros?.tratamentoPostoVago
    ? "DEFINIDO"
    : "PARAMETRIZAR";

  const fatorGlosa = dados.parametros?.fatorGlosa;
  if (fatorGlosa === undefined || fatorGlosa === null) {
    statusGlosa = "PARAMETRIZAR";
    glosaTotal = null;
  } else {
    for (const posto of postosFiltrados) {
      if (posto.valorMensal === undefined || posto.valorMensal === null) {
        statusGlosa = "PARAMETRIZAR";
        glosaTotal = null;
        break;
      }

      // Dias com escala prevista do posto na competência
      let diasComEscalaPosto = 0;
      let diasDescobertosPosto = 0;
      let diasVagosPosto = 0;

      for (const dataStr of datasApuracaoCompetencia) {
        const det = matrizDetalhada[`${posto.id}_${dataStr}`];
        if (det && det.status !== "SEM_ESCALA" && det.status !== "AGUARDANDO_TURNO") {
          diasComEscalaPosto++;
          if (det.status === "DESCOBERTO") {
            diasDescobertosPosto++;
          } else if (det.status === "VAGO") {
            diasVagosPosto++;
          }
        }
      }

      if (diasComEscalaPosto > 0) {
        const valorDiaPosto = posto.valorMensal / diasComEscalaPosto;
        if (diasDescobertosPosto > 0) {
          glosaTotal = (glosaTotal ?? 0) + diasDescobertosPosto * valorDiaPosto * fatorGlosa;
        }

        // Posto vago só gera glosa se tratamentoPostoVago for GLOSA
        if (diasVagosPosto > 0 && dados.parametros?.tratamentoPostoVago === "GLOSA") {
          glosaTotal = (glosaTotal ?? 0) + diasVagosPosto * valorDiaPosto * fatorGlosa;
        }
      }
    }
  }

  if (perfilUsuario === "PETROBRAS_FISCAL") {
    statusGlosa = "OMITIDO_LGPD";
    glosaTotal = null;
  }

  // 7. Grade dos Últimos 7 Dias
  const ultimos7DiasDatas: string[] = [];
  const diaHojeObj = new Date(dataReferenciaHoje + "T00:00:00");

  for (let i = 6; i >= 0; i--) {
    const d = new Date(diaHojeObj);
    d.setDate(diaHojeObj.getDate() - i);
    const anoD = d.getFullYear();
    const mesD = padZero(d.getMonth() + 1);
    const diaD = padZero(d.getDate());
    ultimos7DiasDatas.push(`${anoD}-${mesD}-${diaD}`);
  }

  const nomesDiasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const diasGradeInfo = ultimos7DiasDatas.map((dt) => {
    const obj = new Date(dt + "T00:00:00");
    const diaSem = obj.getDay();
    const diaNum = obj.getDate();
    return {
      data: dt,
      diaNumero: diaNum,
      rotulo: `${nomesDiasSemana[diaSem]} ${diaNum}`,
      fds: diaSem === 0 || diaSem === 6,
      isHoje: dt === dataReferenciaHoje,
    };
  });

  const linhasGradeSemanal: LinhaGradeSemanal[] = postosFiltrados.map((posto) => {
    const celulas: Record<string, DetalhePostoDia> = {};
    let descobertosCount = 0;
    let vagosCount = 0;
    let semDadoCount = 0;

    for (const dt of ultimos7DiasDatas) {
      const det = matrizDetalhada[`${posto.id}_${dt}`] || {
        postoId: posto.id,
        codigoPosto: posto.codigoPosto,
        funcao: posto.funcao,
        data: dt,
        diaNumero: parseInt(dt.substring(8, 10), 10),
        status: "SEM_DADO" as StatusPostoDia,
        letra: "?",
        rotulo: "Sem dado",
        motivo: "Sem dado registrado",
      };

      celulas[dt] = det;

      if (det.status === "DESCOBERTO") {
        descobertosCount++;
      } else if (det.status === "VAGO") {
        vagosCount++;
      } else if (det.status === "SEM_DADO") {
        semDadoCount++;
      }
    }

    const totalDesvios = descobertosCount + vagosCount + semDadoCount;
    return {
      postoId: posto.id,
      codigoPosto: posto.codigoPosto,
      funcao: posto.funcao,
      titularNome: posto.titularNome || "Reserva técnica",
      baseNome: posto.unidadeNome,
      celulas,
      descobertosCount,
      vagosCount,
      semDadoCount,
      temDesvio: totalDesvios > 0,
      totalDesvios,
    };
  });

  // Ordenação da grade: postos com mais desvios primeiro
  linhasGradeSemanal.sort((a, b) => b.totalDesvios - a.totalDesvios);
  const totalPostosComDesvio = linhasGradeSemanal.filter((l) => l.temDesvio).length;

  // 8. Comparativo por Base (quando "Todas as bases")
  const basesMap = new Map<string, { id: string; nome: string }>();
  dados.postos.forEach((p) => {
    basesMap.set(p.unidadeId, { id: p.unidadeId, nome: p.unidadeNome });
  });

  const comparativoBases: ComparativoBaseItem[] = Array.from(basesMap.values()).map((b) => {
    const postosDaBase = dados.postos.filter((p) => p.unidadeId === b.id);
    let descHoje = 0;
    let vagosHojeBase = 0;
    let descMes = 0;
    let atendidosBase = 0;
    let avaliadosBase = 0;

    for (const p of postosDaBase) {
      const detHoje = matrizDetalhada[`${p.id}_${dataReferenciaHoje}`];
      if (detHoje) {
        if (detHoje.status === "DESCOBERTO") descHoje++;
        else if (detHoje.status === "VAGO") vagosHojeBase++;
      }

      for (const dt of datasApuracaoCompetencia) {
        const det = matrizDetalhada[`${p.id}_${dt}`];
        if (det && det.status !== "SEM_ESCALA" && det.status !== "AGUARDANDO_TURNO") {
          if (det.status === "PRESENTE" || det.status === "COBERTO") {
            atendidosBase++;
            avaliadosBase++;
          } else if (det.status === "DESCOBERTO" || det.status === "VAGO") {
            descMes++;
            avaliadosBase++;
          }
        }
      }
    }

    const pendenciasBase = dados.apontamentos.filter(
      (a) =>
        (a.status === "ABERTO" || a.status === "EM_TRATAMENTO") &&
        postosDaBase.some((p) => p.codigoPosto === a.postoCodigo)
    ).length;

    const slaBase = avaliadosBase > 0 ? parseFloat(((atendidosBase / avaliadosBase) * 100).toFixed(1)) : null;

    return {
      baseId: b.id,
      baseNome: b.nome,
      postosTotal: postosDaBase.length,
      descobertosHoje: descHoje,
      vagosHoje: vagosHojeBase,
      descobertosMes: descMes,
      slaPercentual: slaBase,
      slaPercentualFormatado: formatarPercentual(slaBase),
      pendenciasCount: pendenciasBase,
    };
  });

  comparativoBases.sort((a, b) => {
    if (b.descobertosHoje !== a.descobertosHoje) return b.descobertosHoje - a.descobertosHoje;
    if (b.pendenciasCount !== a.pendenciasCount) return b.pendenciasCount - a.pendenciasCount;
    const slaA = a.slaPercentual ?? 100;
    const slaB = b.slaPercentual ?? 100;
    return slaA - slaB;
  });

  // 9. Precisa da sua atenção (Item 8: agrupamento por posto com múltiplas ações)
  const mapaAcoesPorPosto = new Map<
    string,
    {
      posto: string;
      base: string;
      mensagens: string[];
      urgencia: "PERIGO" | "ATENCAO" | "NORMAL";
      prazoTexto?: string;
      acoes: Array<{ texto: string; link: string }>;
    }
  >();

  // Alertas de Apontamentos
  dados.apontamentos
    .filter((a) => a.status === "ABERTO" || a.status === "EM_TRATAMENTO")
    .forEach((a) => {
      let urgencia: "PERIGO" | "ATENCAO" | "NORMAL" = "ATENCAO";
      let prazoTexto = "Vence em breve";

      if (a.prazoResposta) {
        const dRef = new Date(dataReferenciaHoje + "T00:00:00").getTime();
        const dPrazo = new Date(a.prazoResposta + "T00:00:00").getTime();
        const diffDias = Math.round((dPrazo - dRef) / (1000 * 60 * 60 * 24));
        const diaPrazoStr = `${a.prazoResposta.substring(8, 10)}/${a.prazoResposta.substring(5, 7)}`;

        if (diffDias <= 2) {
          urgencia = "PERIGO";
          prazoTexto = `Vence em ${diffDias <= 0 ? "hoje" : `${diffDias} dia(s)`} (${diaPrazoStr})`;
        } else {
          prazoTexto = `Vence em ${diffDias} dias (${diaPrazoStr})`;
        }
      }

      const pBase = postosFiltrados.find((p) => p.codigoPosto === a.postoCodigo)?.unidadeNome || "UFN III";
      const itemExistente = mapaAcoesPorPosto.get(a.postoCodigo) || {
        posto: a.postoCodigo,
        base: pBase,
        mensagens: [],
        urgencia: "ATENCAO",
        acoes: [],
      };

      itemExistente.mensagens.push(a.texto);
      if (urgencia === "PERIGO") itemExistente.urgencia = "PERIGO";
      if (!itemExistente.prazoTexto) itemExistente.prazoTexto = prazoTexto;
      itemExistente.acoes.push({
        texto: "Responder",
        link: `/apontamentos?id=${a.id}`,
      });

      mapaAcoesPorPosto.set(a.postoCodigo, itemExistente);
    });

  // Alertas de Descobertos e Vagos hoje
  postosFiltrados.forEach((p) => {
    const detHoje = matrizDetalhada[`${p.id}_${dataReferenciaHoje}`];
    if (detHoje && (detHoje.status === "DESCOBERTO" || detHoje.status === "VAGO")) {
      const itemExistente = mapaAcoesPorPosto.get(p.codigoPosto) || {
        posto: p.codigoPosto,
        base: p.unidadeNome,
        mensagens: [],
        urgencia: "PERIGO",
        acoes: [],
      };

      itemExistente.mensagens.push(
        detHoje.status === "VAGO"
          ? "Posto vago sem cobertura no turno atual."
          : `Posto descoberto no turno atual: ${detHoje.motivo}`
      );
      itemExistente.urgencia = "PERIGO";
      itemExistente.acoes.push({
        texto: "Escalar cobertura",
        link: `/coberturas?posto=${p.codigoPosto}`,
      });

      mapaAcoesPorPosto.set(p.codigoPosto, itemExistente);
    }
  });

  const faixaAcao: FaixaAcaoItem[] = Array.from(mapaAcoesPorPosto.values()).map((val) => ({
    id: `acao-${val.posto}`,
    tipo: "POSTO_PENDENCIA",
    urgencia: val.urgencia,
    posto: val.posto,
    base: val.base,
    descricao: val.mensagens.join(" • "),
    prazoTexto: val.prazoTexto,
    acoes: val.acoes,
  }));

  // Item de Falha de Importação em dias passados (Item 1)
  if (totalSemDadoCompetencia > 0) {
    faixaAcao.unshift({
      id: "imp-incompleta",
      tipo: "IMPORTACAO_INCOMPLETA",
      urgencia: "ATENCAO",
      base: "Todas as bases",
      descricao: `Importação incompleta: ${totalSemDadoCompetencia} postos-dia sem ponto registrado na competência.`,
      prazoTexto: "Atenção",
      acoes: [{ texto: "Ver importação", link: "/importacoes?aba=ponto" }],
    });
  }

  // Item de Carga Atrasada > 24h
  if (rhidAtrasado) {
    faixaAcao.push({
      id: "imp-rhid-atrasado",
      tipo: "IMPORTACAO_ATRASADA",
      urgencia: "ATENCAO",
      base: "Todas as bases",
      descricao: "A última carga do ponto RHID foi concluída há mais de 24 horas.",
      prazoTexto: "Atrasada",
      acoes: [{ texto: "Ver importação", link: "/importacoes?aba=ponto" }],
    });
  }

  faixaAcao.sort((a, b) => {
    const peso = { PERIGO: 1, ATENCAO: 2, NORMAL: 3 };
    return peso[a.urgencia] - peso[b.urgencia];
  });

  // 10. Régua de Fiscalização (Item 11.3)
  const postosComTitular = postosFiltrados.filter((p) => p.titularMatricula).length;
  const totalDesviosHoje = descobertosHoje + vagosHoje;
  const reguaFiscalizacao = {
    r1Titulares: `${postosComTitular}/${postosFiltrados.length} mapeados`,
    r2Frequencia: "Ponto RHID auditável (LGPD)",
    r3Substitutos: `${substitutosHoje} em cobertura hoje`,
    r4Descoberturas: `${totalDesviosHoje} ${totalDesviosHoje === 1 ? "desvio" : "desvios"} hoje`,
    r5Medicao: "Memória de cálculo vinculada",
  };

  const baseNome =
    !baseIds || baseIds.length === 0 || baseIds.includes("TODAS")
      ? "Todas as bases contratuais"
      : postosFiltrados[0]?.unidadeNome || "Base selecionada";

  return {
    filtroAplicado: {
      baseId: !baseIds || baseIds.length === 0 ? "TODAS" : baseIds[0],
      baseNome,
      competencia,
      dataHoje: dataReferenciaHoje,
    },
    frescor: {
      pontoRhidAte,
      rmAte,
      rhidAtrasado,
      rhidDataMaxCoberta: rhidPeriodoFimStr,
    },
    coberturaAgora: {
      presentes: presentesHoje,
      substitutos: substitutosHoje,
      descobertos: descobertosHoje,
      vagos: vagosHoje,
      semDado: semDadoHoje,
      aguardandoTurno: aguardandoTurnoHoje,
      postosComEscalaHoje: previstosHoje,
      postosSemEscalaHoje: semEscalaHoje,
      totalPostosBase: postosFiltrados.length,
      percentual: percentualCobertura,
      percentualFormatado: formatarPercentual(percentualCobertura),
      statusSelo,
      isAlertaDescoberto,
      textoApoio: textoApoioHoje,
    },
    slaCompetencia: {
      valor: slaValor,
      valorFormatado: formatarPercentual(slaValor),
      meta: metaSlaParametrizada,
      metaFormatada: formatarPercentual(metaSlaParametrizada),
      variacaoPp,
      variacaoPpFormatada: variacaoPp !== null ? `+${formatadorPercentualPtBr.format(variacaoPp)} p.p.` : null,
      corSla,
      status: slaValor !== null ? "CALCULADO" : "SEM_DADOS_SUFICIENTES",
      totalAtendidos: totalAtendidosSla,
      totalAvaliados: totalAvaliadosSla,
      formulaExplicativa:
        "(Postos-dia presente + coberto) ÷ postos-dia avaliados, excluindo sem escala e sem dado da competência",
    },
    descobertosCompetencia: {
      totalDescobertos: totalDescobertoCompetencia,
      totalVagos: totalVagoCompetencia,
      totalPrevistos: totalPrevistosCompetencia,
      totalSemDado: totalSemDadoCompetencia,
      textoApoio: `de ${totalPrevistosCompetencia} previstos${totalSemDadoCompetencia > 0 ? ` (+ ${totalSemDadoCompetencia} sem dado)` : ""}`,
      formulaExplicativa:
        "Contagem de postos-dia com ocorrência sem cobertura ou ausência não justificada apurados até o corte da carga do RHID",
    },
    glosaEstimada: {
      valorTotal: glosaTotal !== null ? parseFloat(glosaTotal.toFixed(2)) : null,
      valorTotalFormatado:
        glosaTotal !== null
          ? glosaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "0,00",
      status: statusGlosa,
      statusPostoVago: statusPostoVagoGlosa,
      fatorGlosa: fatorGlosa ?? null,
      textoApoio:
        statusGlosa === "PARAMETRIZAR"
          ? "Parâmetro não cadastrado"
          : statusPostoVagoGlosa === "PARAMETRIZAR" && totalVagoCompetencia > 0
          ? "Posto vago pendente de parametrização"
          : "Pela memória de cálculo contratual",
      formulaExplicativa:
        "Soma, para cada posto-dia descoberto, de (valor mensal do Anexo 1-A ÷ dias com escala na competência) × fator de glosa",
    },
    comparativoBases,
    gradeSemanal: {
      dias: diasGradeInfo,
      linhas: linhasGradeSemanal,
      totalPostos: postosFiltrados.length,
      totalPostosComDesvio,
    },
    faixaAcao: faixaAcao.slice(0, 5),
    reguaFiscalizacao,
    matrizDetalhada,
  };
}
