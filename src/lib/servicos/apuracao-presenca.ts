/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Motor de Apuração Diária de Presença e Cobertura de Postos do Contrato Petrobras
 *
 * Finalidade estrita: GESTÃO de presença, ausência e evidência contratual.
 * Ordem estrita de prioridade (1 a 9) e cálculo determinístico.
 */

import {
  MarcacaoPontoOriginal,
  ApuracaoPresencaDiaria,
  SituacaoPresencaDiaria,
  SituacaoPostoDia,
  PendenciaPontoItem,
  HorarioInterpretado,
  CicloEscalaColaborador,
} from "@/lib/dados/ponto-tipos";
import {
  obterInterpretacaoHorario,
  verificarJornadaPrevistaDia,
} from "./interpretador-horarios";
import { obterFusoHorarioBase } from "@/lib/dados/secoes-horarios";

export interface ColaboradorParaApuracao {
  id: string;
  chapa: string;
  matricula: string;
  nome: string;
  cpfMascarado: string;
  cpfLimpo: string;
  unidadeId: string;
  unidadeNome?: string;
  postoCodigo?: string;
  funcao: string;
  situacao: "ATIVO" | "AFASTADO" | "FERIAS" | "DESLIGADO" | string;
  situacaoDescricao?: string;
  dataAdmissao: string;
  dataDesligamento?: string;
  horarioCodigo?: string;
  horarioDescricao?: string;
}

export interface OcorrenciaParaApuracao {
  id: string;
  matricula: string; // Chapa
  tipoOcorrencia: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  status: string;
  observacaoPublica: string;
}

export interface CoberturaParaApuracao {
  id: string;
  postoCodigo: string;
  titularMatricula?: string;
  substitutoMatricula: string;
  dataInicio: string;
  dataFim: string;
  status: string;
}

export interface PostoParaApuracao {
  codigoPosto: string;
  funcao: string;
  unidadeId: string;
  unidadeNome: string;
  titularMatricula?: string;
  titularNome?: string;
  situacao: string;
  horarioInicio?: string;
  horarioFim?: string;
  escala?: string;
}

export interface ParametrosApuracao {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  dataReferenciaUltimoLote?: string; // YYYY-MM-DD HH:MM
  dataHojeLocal?: string; // YYYY-MM-DD
  horaHojeLocal?: string; // HH:MM
  toleranciaMinutos?: number; // Padrão 10 min
  janelaJornadaHoras?: number; // Padrão 3h antes e depois
}

export interface ResultadoApuracaoCompleta {
  periodo: { inicio: string; fim: string };
  dataReferenciaPonto: string;
  apuracoesPorColaboradorDia: ApuracaoPresencaDiaria[];
  mapaPostosDia: Map<string, SituacaoPostoDia>; // Chave: `${codigoPosto}_${data}`
  detalhesPostosDia: {
    codigoPosto: string;
    data: string;
    situacao: SituacaoPostoDia;
    titularChapa?: string;
    titularNome?: string;
    substitutoChapa?: string;
    substitutoNome?: string;
    motivo: string;
    temAlerta: boolean;
  }[];
  pendencias: PendenciaPontoItem[];
  totais: {
    totalColaboradorDias: number;
    presentes: number;
    ausenciasJustificadas: number;
    faltas: number;
    folgas: number;
    feriasAfastamentos: number;
    marcacoesIncompletas: number;
    semDado: number;
    escalasNaoConfirmadas: number;
  };
}

/**
 * Converte horário "HH:MM" em minutos desde o início do dia
 */
function horaParaMinutos(horaStr: string): number {
  const [h, m] = horaStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Soma dias a uma data YYYY-MM-DD
 */
function somarDias(dataIso: string, dias: number): string {
  const [y, m, d] = dataIso.split("-").map(Number);
  const dataJs = new Date(Date.UTC(y, m - 1, d + dias));
  const ano = dataJs.getUTCFullYear();
  const mes = String(dataJs.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(dataJs.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Gera lista de datas entre duas datas inclusivas
 */
function gerarIntervaloDatas(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  let atual = inicio;
  while (atual <= fim) {
    datas.push(atual);
    atual = somarDias(atual, 1);
  }
  return datas;
}

/**
 * Motor Principal de Apuração Diária de Presença
 */
export function apurarPresencaEPostos(
  colaboradores: ColaboradorParaApuracao[],
  marcacoes: MarcacaoPontoOriginal[],
  ocorrencias: OcorrenciaParaApuracao[],
  coberturas: CoberturaParaApuracao[],
  postos: PostoParaApuracao[],
  parametros: ParametrosApuracao,
  horariosConfirmados?: HorarioInterpretado[],
  ciclosConfirmados?: CicloEscalaColaborador[]
): ResultadoApuracaoCompleta {
  const {
    dataInicio,
    dataFim,
    dataReferenciaUltimoLote = "2026-09-15 23:59",
    dataHojeLocal = "2026-09-17",
    horaHojeLocal = "12:00",
    toleranciaMinutos = 10,
    janelaJornadaHoras = 3,
  } = parametros;

  // Extrai data máxima do último lote de ponto
  const dataMaxPonto = dataReferenciaUltimoLote.substring(0, 10);

  const datasPeriodo = gerarIntervaloDatas(dataInicio, dataFim);

  // Mapeamento rápido de marcações por chapa
  const marcacoesPorChapa = new Map<string, MarcacaoPontoOriginal[]>();
  for (const m of marcacoes) {
    const lista = marcacoesPorChapa.get(m.chapa) || [];
    lista.push(m);
    marcacoesPorChapa.set(m.chapa, lista);
  }

  // Mapeamento rápido de ocorrências válidas por chapa
  const ocorrenciasPorChapa = new Map<string, OcorrenciaParaApuracao[]>();
  for (const oc of ocorrencias) {
    if (oc.status !== "CANCELADA") {
      const lista = ocorrenciasPorChapa.get(oc.matricula) || [];
      lista.push(oc);
      ocorrenciasPorChapa.set(oc.matricula, lista);
    }
  }

  // Mapeamento de ciclos por chapa
  const ciclosPorChapa = new Map<string, CicloEscalaColaborador>();
  for (const c of ciclosConfirmados || []) {
    ciclosPorChapa.set(c.chapa, c);
  }

  const apuracoes: ApuracaoPresencaDiaria[] = [];
  const pendencias: PendenciaPontoItem[] = [];

  const totais = {
    totalColaboradorDias: 0,
    presentes: 0,
    ausenciasJustificadas: 0,
    faltas: 0,
    folgas: 0,
    feriasAfastamentos: 0,
    marcacoesIncompletas: 0,
    semDado: 0,
    escalasNaoConfirmadas: 0,
  };

  // Mapa de situação do colaborador em cada dia: Chave `${chapa}_${data}` => SituacaoPresencaDiaria
  const situacaoColaboradorDia = new Map<string, SituacaoPresencaDiaria>();

  // ---------------------------------------------------------------------------
  // 1. APURAÇÃO INDIVIDUAL POR COLABORADOR E DIA
  // ---------------------------------------------------------------------------
  for (const colab of colaboradores) {
    const chapa = colab.chapa.padStart(6, "0");
    const marcacoesColab = marcacoesPorChapa.get(chapa) || [];
    const ocorrenciasColab = ocorrenciasPorChapa.get(chapa) || [];
    const cicloColab = ciclosPorChapa.get(chapa);

    const fuso = obterFusoHorarioBase(colab.unidadeId);
    const horarioInterp = obterInterpretacaoHorario(
      colab.horarioCodigo || "PADRAO",
      colab.horarioDescricao || "07:00 AS 16:48 - SEG/SEX"
    );

    for (const dt of datasPeriodo) {
      totais.totalColaboradorDias++;

      const [ano, mes, dia] = dt.split("-").map(Number);
      const dataJs = new Date(Date.UTC(ano, mes - 1, dia));
      const diasSemanaNomes = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
      const diaSemana = diasSemanaNomes[dataJs.getUTCDay()];

      // Analisa jornada prevista conforme escala
      const jornada = verificarJornadaPrevistaDia(dt, horarioInterp, cicloColab);

      // Associação de marcações à jornada:
      // Para jornadas noturnas, marcações da madrugada do dia seguinte (até a hora de saída + janela) pertencem a este dia.
      const minEntrada = horaParaMinutos(jornada.horaInicio);
      const minSaida = horaParaMinutos(jornada.horaFim);
      const janelaMin = janelaJornadaHoras * 60;

      const marcacoesDoDia = marcacoesColab.filter((m) => {
        if (m.dataLocal === dt) {
          const minM = horaParaMinutos(m.horaLocal);
          // Marcação no dia da jornada
          if (!jornada.atravessaMeiaNoite) {
            return minM >= minEntrada - janelaMin && minM <= minSaida + janelaMin;
          } else {
            // Noturna: marcação a partir do início da janela de entrada
            return minM >= minEntrada - janelaMin;
          }
        } else if (jornada.atravessaMeiaNoite && m.dataLocal === somarDias(dt, 1)) {
          // Noturna: marcação na madrugada/manhã seguinte
          const minM = horaParaMinutos(m.horaLocal);
          return minM <= minSaida + janelaMin;
        }
        return false;
      });

      // Ordena por horário
      marcacoesDoDia.sort((a, b) => {
        if (a.dataLocal !== b.dataLocal) return a.dataLocal.localeCompare(b.dataLocal);
        return a.horaLocal.localeCompare(b.horaLocal);
      });

      // -----------------------------------------------------------------------
      // AVALIAÇÃO DAS 9 PRIORIDADES ESTRITAS
      // -----------------------------------------------------------------------
      let situacao: SituacaoPresencaDiaria = "FOLGA_ESCALA";
      let abonoVinculado: ApuracaoPresencaDiaria["abonoVinculado"] = undefined;
      const indicadores = {
        abonoParcial: false,
        entradaAposHorario: false,
        saidaAntesHorario: false,
        toleranciaMinutos,
      };

      // 1. DESLIGADO: após a data de demissão
      if (colab.situacao === "DESLIGADO" && colab.dataDesligamento && dt > colab.dataDesligamento) {
        situacao = "DESLIGADO";
      }
      // 2. FÉRIAS / AFASTADO / LICENÇA: vindo do RM
      else if (
        colab.situacao === "FERIAS" ||
        colab.situacao === "AFASTADO" ||
        (colab.situacaoDescricao && /férias|afastad|licença/i.test(colab.situacaoDescricao))
      ) {
        situacao = "FERIAS_AFASTADO_LICENCA";
        totais.feriasAfastamentos++;
      }
      // 3. FOLGA DA ESCALA: dia sem jornada prevista
      else if (!jornada.temJornada && !jornada.escalaNaoConfirmada) {
        situacao = "FOLGA_ESCALA";
        totais.folgas++;
      }
      // 9. ESCALA NÃO CONFIRMADA: escala cíclica sem data-base confirmada (NUNCA gerar falta)
      else if (jornada.escalaNaoConfirmada) {
        situacao = "ESCALA_NAO_CONFIRMADA";
        totais.escalasNaoConfirmadas++;
        pendencias.push({
          id: `PEND-ESC-${chapa}-${dt}`,
          tipo: "ESCALA_NAO_CONFIRMADA",
          colaboradorId: colab.id,
          chapa,
          nome: colab.nome,
          baseId: colab.unidadeId,
          dataReferencia: dt,
          detalhes: `Colaborador em escala cíclica (${jornada.tipoEscala}) aguardando confirmação de data-base de início de ciclo.`,
          status: "ABERTA",
        });
      }
      // Se tem jornada prevista:
      else {
        // Verifica se há abono cobrindo o dia (Momento 3)
        const abonoCobridor = ocorrenciasColab.find(
          (oc) => dt >= oc.dataInicio && dt <= oc.dataFim
        );

        if (abonoCobridor) {
          abonoVinculado = {
            ocorrenciaId: abonoCobridor.id,
            tipoOcorrencia: abonoCobridor.tipoOcorrencia,
            observacaoPublica: abonoCobridor.observacaoPublica,
          };
        }

        // 5. PRESENTE: possui entrada e saída associadas
        if (marcacoesDoDia.length >= 2) {
          situacao = "PRESENTE";
          totais.presentes++;

          const primeira = marcacoesDoDia[0];
          const ultima = marcacoesDoDia[marcacoesDoDia.length - 1];

          // Verifica tolerância de atraso (entrada após horário + 10 min)
          const minPrimeira = horaParaMinutos(primeira.horaLocal);
          if (minPrimeira > minEntrada + toleranciaMinutos) {
            indicadores.entradaAposHorario = true;
          }

          // Verifica saída antes do horário (- 10 min)
          let minUltima = horaParaMinutos(ultima.horaLocal);
          if (jornada.atravessaMeiaNoite && ultima.dataLocal > dt) {
            minUltima += 1440; // 24h
          }
          let minEsperadoSaida = minSaida;
          if (jornada.atravessaMeiaNoite) minEsperadoSaida += 1440;

          if (minUltima < minEsperadoSaida - toleranciaMinutos) {
            indicadores.saidaAntesHorario = true;
          }

          if (abonoCobridor) {
            indicadores.abonoParcial = true;
          }
        }
        // 6. MARCAÇÃO INCOMPLETA: ímpar ou falta entrada/saída
        else if (marcacoesDoDia.length === 1) {
          situacao = "MARCACAO_INCOMPLETA";
          totais.marcacoesIncompletas++;
          pendencias.push({
            id: `PEND-INC-${chapa}-${dt}`,
            tipo: "MARCACAO_INCOMPLETA",
            colaboradorId: colab.id,
            chapa,
            nome: colab.nome,
            baseId: colab.unidadeId,
            dataReferencia: dt,
            detalhes: `Marcação incompleta (${marcacoesDoDia[0].horaLocal}). Necessário verificar registro de saída ou entrada no sistema de origem.`,
            status: "ABERTA",
          });
        }
        // Sem marcações:
        else {
          // 4. AUSÊNCIA JUSTIFICADA: Abono aprovado cobrindo o dia
          if (abonoCobridor) {
            situacao = "AUSENCIA_JUSTIFICADA";
            totais.ausenciasJustificadas++;
          }
          // 8. SEM DADO: dia após a data de referência do último lote de ponto
          else if (dt > dataMaxPonto) {
            situacao = "SEM_DADO";
            totais.semDado++;
          }
          // 7. FALTA: dia com jornada prevista, sem marcação e sem abono até a data do lote
          else {
            situacao = "FALTA";
            totais.faltas++;
            pendencias.push({
              id: `PEND-FLT-${chapa}-${dt}`,
              tipo: "FALTA_SEM_ABONO",
              colaboradorId: colab.id,
              chapa,
              nome: colab.nome,
              baseId: colab.unidadeId,
              dataReferencia: dt,
              detalhes: `Ausência sem marcação de ponto e sem abono/atestado registrado na competência.`,
              status: "ABERTA",
            });
          }
        }
      }

      situacaoColaboradorDia.set(`${chapa}_${dt}`, situacao);

      apuracoes.push({
        id: `${chapa}_${dt}`,
        colaboradorId: colab.id,
        chapa,
        nomeColaborador: colab.nome,
        cpfMascarado: colab.cpfMascarado,
        baseId: colab.unidadeId,
        baseNome: colab.unidadeNome || colab.unidadeId,
        fusoHorario: fuso,
        data: dt,
        diaSemana,
        postoCodigo: colab.postoCodigo,
        funcao: colab.funcao,
        jornadaPrevista: {
          horaInicio: jornada.horaInicio,
          horaFim: jornada.horaFim,
          atravessaMeiaNoite: jornada.atravessaMeiaNoite,
          tipoEscala: jornada.tipoEscala,
        },
        situacao,
        marcacoesDoDia: marcacoesDoDia.map((m) => ({
          horaLocal: m.horaLocal,
          horaUtc: m.dataHoraUtc,
          nsr: m.nsr,
          loteId: m.loteId,
          equipamento: m.equipamentoOrigem,
        })),
        indicadores,
        abonoVinculado,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. APURAÇÃO DA SITUAÇÃO DO POSTO (MAPA DE OCUPAÇÃO ANEXO 1-A)
  // ---------------------------------------------------------------------------
  const mapaPostosDia = new Map<string, SituacaoPostoDia>();
  const detalhesPostosDia: ResultadoApuracaoCompleta["detalhesPostosDia"] = [];

  for (const posto of postos) {
    const titularChapa = posto.titularMatricula ? posto.titularMatricula.padStart(6, "0") : undefined;

    for (const dt of datasPeriodo) {
      let situacaoPosto: SituacaoPostoDia = "–";
      let motivo = "Sem escala";
      let titularAusente = false;
      let substitutoPresente = false;
      let substitutoChapa: string | undefined = undefined;
      let substitutoNome: string | undefined = undefined;
      let temAlerta = false;

      // Se o dia for posterior ao último lote de ponto
      if (dt > dataMaxPonto) {
        situacaoPosto = "?";
        motivo = "Dia sem lote de ponto importado";
      }
      // Se o posto for vago (sem titular vinculado)
      else if (!titularChapa) {
        situacaoPosto = "V";
        motivo = "Posto vago sem titular";
        temAlerta = true;
      } else {
        const sitTitular = situacaoColaboradorDia.get(`${titularChapa}_${dt}`);

        // Titular Presente
        if (sitTitular === "PRESENTE") {
          situacaoPosto = "P";
          motivo = "Titular presente no posto";
        }
        // Marcação incompleta do titular -> exibe P com indicador de alerta
        else if (sitTitular === "MARCACAO_INCOMPLETA") {
          situacaoPosto = "P";
          motivo = "Titular presente (marcação incompleta pendente de verificação)";
          temAlerta = true;
        }
        // Folga da escala do posto
        else if (sitTitular === "FOLGA_ESCALA") {
          situacaoPosto = "–";
          motivo = "Folga da escala regular";
        }
        // Escala não confirmada
        else if (sitTitular === "ESCALA_NAO_CONFIRMADA") {
          situacaoPosto = "–";
          motivo = "Escala cíclica aguardando confirmação de data-base";
          temAlerta = true;
        }
        // Titular ausente (Falta, Férias, Afastado ou Ausência Justificada)
        else {
          titularAusente = true;

          // Verifica se há cobertura/substituto ativo para o posto na data
          const coberturaAtiva = coberturas.find(
            (c) =>
              c.postoCodigo === posto.codigoPosto &&
              c.status !== "CANCELADA" &&
              dt >= c.dataInicio &&
              dt <= c.dataFim
          );

          if (coberturaAtiva) {
            substitutoChapa = coberturaAtiva.substitutoMatricula.padStart(6, "0");
            const sitSubstituto = situacaoColaboradorDia.get(`${substitutoChapa}_${dt}`);

            if (sitSubstituto === "PRESENTE" || sitSubstituto === "MARCACAO_INCOMPLETA") {
              substitutoPresente = true;
              situacaoPosto = "C";
              motivo = `Posto coberto pelo substituto (Chapa ${substitutoChapa})`;
            }
          }

          if (!substitutoPresente) {
            situacaoPosto = "D";
            motivo =
              sitTitular === "FALTA"
                ? "Titular ausente por falta sem cobertura"
                : sitTitular === "AUSENCIA_JUSTIFICADA"
                ? "Titular ausente justificadamente sem cobertura"
                : "Titular afastado sem cobertura alocada";
            temAlerta = true;
          }
        }
      }

      // Se for o dia atual e o turno ainda não começou
      if (dt === dataHojeLocal && situacaoPosto === "D" && posto.horarioInicio) {
        if (horaHojeLocal < posto.horarioInicio) {
          situacaoPosto = "A";
          motivo = `Aguardando início do turno às ${posto.horarioInicio}`;
          temAlerta = false;
        }
      }

      const chavePostoDia = `${posto.codigoPosto}_${dt}`;
      mapaPostosDia.set(chavePostoDia, situacaoPosto);

      detalhesPostosDia.push({
        codigoPosto: posto.codigoPosto,
        data: dt,
        situacao: situacaoPosto,
        titularChapa,
        titularNome: posto.titularNome,
        substitutoChapa,
        substitutoNome,
        motivo,
        temAlerta,
      });
    }
  }

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    dataReferenciaPonto: dataReferenciaUltimoLote,
    apuracoesPorColaboradorDia: apuracoes,
    mapaPostosDia,
    detalhesPostosDia,
    pendencias,
    totais,
  };
}
