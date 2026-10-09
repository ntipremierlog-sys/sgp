/**
 * SGP — Sistema de Gestão de Postos (Contrato Petrobras ICJ 5900.0129796.25.2)
 *
 * Análise de cumprimento de jornada a partir das marcações de ponto.
 *
 * Objetivo de gestão: evidenciar, dia a dia, se o colaborador cumpriu a faixa
 * horária prevista no RM. Ex.: jornada prevista até 17:00 com última marcação
 * às 15:00 → "Saída antecipada de 2h00".
 *
 * Regras:
 * - A jornada prevista vem da "Descrição do Horário" do RM (interpretador-horarios).
 * - O cumprimento é medido pela CARGA HORÁRIA do posto: faixa prevista − intervalo
 *   (CLT art. 71: 1h acima de 6h; 15 min entre 4h e 6h). Quem entra e sai mais cedo,
 *   mas cumpre a carga, tem a jornada cumprida ("horário alterado"), sem atraso a cobrar.
 * - Com apenas 2 marcações, o intervalo é considerado pré-assinalado (CLT art. 74 §2) e descontado.
 * - Tolerância de 10 minutos no dia (CLT art. 58 §1).
 * - Atraso/saída antecipada explicam a causa quando a carga não é cumprida.
 * - Jornadas que atravessam a meia-noite consideram marcações do dia seguinte.
 * - Escala 4X2 com duas faixas: usa a faixa cuja entrada é mais próxima da 1ª marcação.
 * - Marcações em número ímpar não permitem afirmar a saída → "Marcação incompleta".
 * - Dia sem jornada prevista não gera atraso/não cumprido ("Marcação fora da escala").
 * - Não é apuração de folha (não calcula hora extra/adicional); é evidência de gestão.
 */

import type { MarcacaoPontoOriginal, HorarioInterpretado, CicloEscalaColaborador } from "@/lib/dados/ponto-tipos";
import { sugerirInterpretacaoHorario, verificarJornadaPrevistaDia } from "@/lib/servicos/interpretador-horarios";

export const TOLERANCIA_PADRAO_MIN = 10;

export type SituacaoJornada =
  | "JORNADA_CUMPRIDA"
  | "CARGA_CUMPRIDA_HORARIO_ALTERADO"
  | "SAIDA_ANTECIPADA"
  | "ATRASO"
  | "ATRASO_E_SAIDA_ANTECIPADA"
  | "CARGA_INCOMPLETA"
  | "MARCACAO_INCOMPLETA"
  | "SEM_MARCACAO"
  | "SEM_JORNADA_PREVISTA"
  | "MARCACAO_FORA_DA_ESCALA";

/** Intervalo mínimo presumido pela CLT (art. 71) para uma faixa de `minutosFaixa`. */
export function intervaloPrevistoMin(minutosFaixa: number): number {
  if (minutosFaixa > 6 * 60) return 60;
  if (minutosFaixa > 4 * 60) return 15;
  return 0;
}

export interface BatidaDia {
  /** HH:MM local */
  hora: string;
  /** Minutos relativos à 00:00 do dia analisado (pode passar de 1440 no turno noturno) */
  minutos: number;
  /** Data local real da marcação (YYYY-MM-DD) */
  dataLocal: string;
  /** Marcação pertence ao dia seguinte (turno noturno) */
  diaSeguinte: boolean;
  nsr?: string;
  loteId?: string;
  equipamento?: string;
  arquivoOrigem?: string;
}

export interface ParBatidas {
  entrada: BatidaDia;
  saida?: BatidaDia;
  minutos: number;
}

export interface AnaliseJornadaDia {
  dataStr: string;
  chapa: string;
  temJornadaPrevista: boolean;
  escalaNaoConfirmada: boolean;
  tipoEscala: string;
  previstoInicio?: string;
  previstoFim?: string;
  previstoInicioMin?: number;
  previstoFimMin?: number;
  atravessaMeiaNoite: boolean;
  batidas: BatidaDia[];
  pares: ParBatidas[];
  primeiraEntrada?: string;
  ultimaSaida?: string;
  /** Minutos de atraso na entrada (bruto, sem descontar tolerância) */
  atrasoMin: number;
  /** Minutos que faltaram para concluir a jornada (bruto) */
  saidaAntecipadaMin: number;
  /** Minutos trabalhados além do fim previsto (informativo) */
  saidaPosteriorMin: number;
  /** Soma dos pares entrada→saída (descontado o intervalo pré-assinalado quando há só 2 marcações) */
  minutosEfetivos: number;
  /** Duração da faixa prevista */
  minutosPrevistos: number;
  /** Intervalo presumido (CLT art. 71) */
  intervaloPrevistoMin: number;
  /** Carga horária prevista do posto no dia = faixa − intervalo */
  cargaPrevistaMin: number;
  /** Carga prevista − efetivo, quando acima da tolerância */
  minutosNaoCumpridos: number;
  /** Atraso/saída antecipada compensados pelo cumprimento da carga horária */
  compensado: boolean;
  toleranciaMin: number;
  situacao: SituacaoJornada;
  descricao: string;
}

// -----------------------------------------------------------------------------
// Utilitários de tempo
// -----------------------------------------------------------------------------

export function horaParaMinutos(hora: string): number {
  const [h, m] = String(hora || "0:0").split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

export function minutosParaHora(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Formata duração em minutos como "2h00" / "45min". */
export function formatarDuracao(min: number): string {
  const total = Math.max(0, Math.round(min));
  if (total < 60) return `${total}min`;
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
}

function somarDias(dataStr: string, dias: number): string {
  const [y, m, d] = dataStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

function normalizarChapa(c: string | undefined | null): string {
  return String(c || "").replace(/\D/g, "").padStart(6, "0");
}

// -----------------------------------------------------------------------------
// Seleção das marcações do dia
// -----------------------------------------------------------------------------

/**
 * Seleciona as marcações que pertencem à jornada do dia `dataStr`.
 * - Jornada diurna: marcações do próprio dia.
 * - Jornada noturna: marcações do dia a partir de (entrada − 3h) + marcações do dia seguinte até (saída + 4h).
 */
export function obterBatidasDoDia(
  marcacoes: MarcacaoPontoOriginal[],
  chapa: string,
  dataStr: string,
  opcoes: { atravessaMeiaNoite?: boolean; horaEntrada?: string; horaSaida?: string } = {}
): BatidaDia[] {
  const chapaN = normalizarChapa(chapa);
  if (!chapa || !marcacoes?.length) return [];
  const amanha = somarDias(dataStr, 1);
  const entradaMin = opcoes.horaEntrada ? horaParaMinutos(opcoes.horaEntrada) : 0;
  const saidaMin = opcoes.horaSaida ? horaParaMinutos(opcoes.horaSaida) : 0;

  const resultado: BatidaDia[] = [];
  for (const m of marcacoes) {
    if (normalizarChapa(m.chapa) !== chapaN) continue;
    const min = horaParaMinutos(m.horaLocal);
    let incluir = false;
    let relativo = min;
    let diaSeguinte = false;
    if (opcoes.atravessaMeiaNoite) {
      if (m.dataLocal === dataStr && min >= entradaMin - 180) incluir = true;
      else if (m.dataLocal === amanha && min <= saidaMin + 240) {
        incluir = true;
        relativo = 1440 + min;
        diaSeguinte = true;
      }
    } else if (m.dataLocal === dataStr) {
      incluir = true;
    }
    if (!incluir) continue;
    resultado.push({
      hora: String(m.horaLocal).slice(0, 5),
      minutos: relativo,
      dataLocal: m.dataLocal,
      diaSeguinte,
      nsr: m.nsr,
      loteId: m.loteId,
      equipamento: m.equipamentoOrigem,
      arquivoOrigem: m.arquivoOrigem,
    });
  }
  // Remove duplicidades no mesmo minuto e ordena
  const vistos = new Set<number>();
  return resultado
    .sort((a, b) => a.minutos - b.minutos)
    .filter((b) => (vistos.has(b.minutos) ? false : (vistos.add(b.minutos), true)));
}

// -----------------------------------------------------------------------------
// Análise de um dia
// -----------------------------------------------------------------------------

export interface ParametrosAnaliseDia {
  dataStr: string;
  chapa: string;
  marcacoes: MarcacaoPontoOriginal[];
  /** Descrição do horário do RM (ex.: "PETROBRAS - 08:00 AS 17:00 - SEG/SEX") */
  horarioDescricao?: string | null;
  horarioCodigo?: string | null;
  /** Interpretação já confirmada (sobrepõe a descrição) */
  horario?: HorarioInterpretado;
  /** Data-base para escalas cíclicas */
  ciclo?: CicloEscalaColaborador;
  /** Força a existência de jornada (ex.: o mapa já apurou que o dia é exigível) */
  jornadaExigivel?: boolean;
  toleranciaMin?: number;
}

export function analisarJornadaDia(p: ParametrosAnaliseDia): AnaliseJornadaDia {
  const tolerancia = p.toleranciaMin ?? TOLERANCIA_PADRAO_MIN;
  const temHorario = Boolean(p.horario || (p.horarioDescricao && /\d{1,2}:\d{2}/.test(p.horarioDescricao)));
  const horario = p.horario || sugerirInterpretacaoHorario(p.horarioCodigo || "", p.horarioDescricao || "");
  const previsao = temHorario ? verificarJornadaPrevistaDia(p.dataStr, horario, p.ciclo) : null;

  // Pré-seleção ampla para escolher a faixa (4X2) a partir da 1ª marcação
  let horaEntrada = previsao?.horaInicio || horario.horaEntradaPadrao;
  let horaSaida = previsao?.horaFim || horario.horaSaidaPadrao;
  if (horario.segundoTurno) {
    const brutas = obterBatidasDoDia(p.marcacoes, p.chapa, p.dataStr);
    if (brutas.length > 0) {
      const primeira = brutas[0].minutos;
      const d1 = Math.abs(primeira - horaParaMinutos(horario.horaEntradaPadrao));
      const d2 = Math.abs(primeira - horaParaMinutos(horario.segundoTurno.horaEntrada));
      if (d2 < d1) {
        horaEntrada = horario.segundoTurno.horaEntrada;
        horaSaida = horario.segundoTurno.horaSaida;
      } else {
        horaEntrada = horario.horaEntradaPadrao;
        horaSaida = horario.horaSaidaPadrao;
      }
    }
  }
  const iniMin = horaParaMinutos(horaEntrada);
  let fimMin = horaParaMinutos(horaSaida);
  const atravessa = temHorario && fimMin <= iniMin;
  if (atravessa) fimMin += 1440;

  const batidas = obterBatidasDoDia(p.marcacoes, p.chapa, p.dataStr, {
    atravessaMeiaNoite: atravessa,
    horaEntrada,
    horaSaida,
  });

  const pares: ParBatidas[] = [];
  for (let i = 0; i < batidas.length; i += 2) {
    const entrada = batidas[i];
    const saida = batidas[i + 1];
    pares.push({ entrada, saida, minutos: saida ? saida.minutos - entrada.minutos : 0 });
  }
  const minutosBrutos = pares.reduce((s, x) => s + x.minutos, 0);
  const impar = batidas.length % 2 === 1;

  const temJornada =
    p.jornadaExigivel !== undefined ? p.jornadaExigivel && temHorario : Boolean(previsao?.temJornada);
  const escalaNaoConfirmada = Boolean(previsao?.escalaNaoConfirmada);
  // Atraso/saída só fazem sentido quando há jornada (ou escala cíclica a confirmar) — nunca em dia fora da escala
  const usarFaixa = temHorario && (temJornada || escalaNaoConfirmada);

  // Carga horária prevista = faixa − intervalo (CLT art. 71)
  const minutosFaixa = temHorario ? fimMin - iniMin : 0;
  const intervaloMin = intervaloPrevistoMin(minutosFaixa);
  const cargaPrevistaMin = Math.max(0, minutosFaixa - intervaloMin);
  // Com só entrada e saída, o intervalo é pré-assinalado (CLT art. 74 §2) e não conta como trabalhado
  const minutosEfetivos =
    !impar && batidas.length === 2 && minutosBrutos > 6 * 60 ? minutosBrutos - intervaloPrevistoMin(minutosBrutos) : minutosBrutos;

  let atrasoMin = 0;
  let saidaAntecipadaMin = 0;
  let saidaPosteriorMin = 0;
  if (usarFaixa && batidas.length > 0) {
    atrasoMin = Math.max(0, batidas[0].minutos - iniMin);
    if (!impar && batidas.length >= 2) {
      const ultima = batidas[batidas.length - 1].minutos;
      saidaAntecipadaMin = Math.max(0, fimMin - ultima);
      saidaPosteriorMin = Math.max(0, ultima - fimMin);
    }
  }
  const atrasoRelevante = atrasoMin > tolerancia;
  const saidaRelevante = saidaAntecipadaMin > tolerancia;

  // Déficit de carga horária (só com marcações pares; ímpar não permite fechar a conta)
  const deficitCarga = usarFaixa && !impar && batidas.length >= 2 ? Math.max(0, cargaPrevistaMin - minutosEfetivos) : 0;
  const cargaCumprida = deficitCarga <= tolerancia;
  let minutosNaoCumpridos = 0;
  if (usarFaixa && !impar && batidas.length >= 2) {
    minutosNaoCumpridos = cargaCumprida ? 0 : deficitCarga;
  } else if (usarFaixa && impar && atrasoRelevante) {
    minutosNaoCumpridos = atrasoMin;
  }
  const compensado = cargaCumprida && !impar && batidas.length >= 2 && (atrasoRelevante || saidaRelevante);

  let situacao: SituacaoJornada;
  let descricao: string;
  const faixaTxt = temHorario ? `${horaEntrada} às ${horaSaida}` : "faixa não informada no RM";
  const cargaTxt = `carga ${formatarDuracao(minutosEfetivos)} de ${formatarDuracao(cargaPrevistaMin)} prevista`;

  if (!temJornada && (!escalaNaoConfirmada || batidas.length === 0)) {
    if (batidas.length > 0) {
      situacao = "MARCACAO_FORA_DA_ESCALA";
      descricao = `Há ${batidas.length} marcação(ões) em dia sem jornada prevista pela escala.`;
    } else {
      situacao = "SEM_JORNADA_PREVISTA";
      descricao = escalaNaoConfirmada
        ? "Escala cíclica sem data-base confirmada: não é possível afirmar se havia jornada neste dia."
        : "Dia sem jornada prevista pela escala.";
    }
  } else if (batidas.length === 0) {
    situacao = "SEM_MARCACAO";
    descricao = `Nenhuma marcação de ponto para a jornada prevista (${faixaTxt}).`;
  } else if (impar) {
    situacao = "MARCACAO_INCOMPLETA";
    descricao = `Número ímpar de marcações (${batidas.length}); não é possível confirmar o horário de saída.`;
    if (atrasoRelevante) descricao += ` Entrada com atraso de ${formatarDuracao(atrasoMin)}.`;
  } else if (cargaCumprida) {
    const entrada = batidas[0];
    const saida = batidas[batidas.length - 1];
    if (compensado) {
      situacao = "CARGA_CUMPRIDA_HORARIO_ALTERADO";
      const partes: string[] = [];
      const antecipEntrada = iniMin - entrada.minutos;
      if (antecipEntrada > tolerancia) partes.push(`entrou às ${entrada.hora} (${formatarDuracao(antecipEntrada)} antes)`);
      if (atrasoRelevante) partes.push(`entrou às ${entrada.hora} (${formatarDuracao(atrasoMin)} depois)`);
      if (saidaRelevante) partes.push(`saiu às ${saida.hora} (${formatarDuracao(saidaAntecipadaMin)} antes do previsto ${horaSaida})`);
      if (saidaPosteriorMin > tolerancia) partes.push(`saiu às ${saida.hora} (${formatarDuracao(saidaPosteriorMin)} depois)`);
      descricao = `Carga horária cumprida em horário diferente do previsto (${faixaTxt}): ${partes.join(" e ")}; ${cargaTxt}.`;
    } else {
      situacao = "JORNADA_CUMPRIDA";
      descricao = `Jornada cumprida (${faixaTxt}); ${cargaTxt}, tolerância de ${tolerancia} min.`;
    }
  } else if (atrasoRelevante && saidaRelevante) {
    situacao = "ATRASO_E_SAIDA_ANTECIPADA";
    descricao = `Entrada às ${batidas[0].hora} (atraso de ${formatarDuracao(atrasoMin)}) e saída às ${
      batidas[batidas.length - 1].hora
    } (${formatarDuracao(saidaAntecipadaMin)} antes do previsto ${horaSaida}); faltaram ${formatarDuracao(deficitCarga)} da carga.`;
  } else if (saidaRelevante) {
    situacao = "SAIDA_ANTECIPADA";
    descricao = `Jornada não concluída: saída às ${batidas[batidas.length - 1].hora}, ${formatarDuracao(
      saidaAntecipadaMin
    )} antes do previsto (${horaSaida}); faltaram ${formatarDuracao(deficitCarga)} da carga.`;
  } else if (atrasoRelevante) {
    situacao = "ATRASO";
    descricao = `Entrada às ${batidas[0].hora}, ${formatarDuracao(atrasoMin)} após o previsto (${horaEntrada}); faltaram ${formatarDuracao(deficitCarga)} da carga.`;
  } else {
    situacao = "CARGA_INCOMPLETA";
    descricao = `Entrada e saída no horário, mas a carga ficou ${formatarDuracao(deficitCarga)} abaixo da prevista (intervalo maior que ${formatarDuracao(intervaloMin)}); ${cargaTxt}.`;
  }
  if (escalaNaoConfirmada) descricao += " Escala cíclica sem data-base confirmada: faixa usada apenas como referência.";

  return {
    dataStr: p.dataStr,
    chapa: normalizarChapa(p.chapa),
    temJornadaPrevista: temJornada,
    escalaNaoConfirmada,
    tipoEscala: horario.tipoEscala,
    previstoInicio: temHorario ? horaEntrada : undefined,
    previstoFim: temHorario ? horaSaida : undefined,
    previstoInicioMin: temHorario ? iniMin : undefined,
    previstoFimMin: temHorario ? fimMin : undefined,
    atravessaMeiaNoite: atravessa,
    batidas,
    pares,
    primeiraEntrada: batidas[0]?.hora,
    ultimaSaida: !impar && batidas.length >= 2 ? batidas[batidas.length - 1].hora : undefined,
    atrasoMin,
    saidaAntecipadaMin,
    saidaPosteriorMin,
    minutosEfetivos,
    minutosPrevistos: minutosFaixa,
    intervaloPrevistoMin: intervaloMin,
    cargaPrevistaMin,
    minutosNaoCumpridos,
    compensado,
    toleranciaMin: tolerancia,
    situacao,
    descricao,
  };
}

// -----------------------------------------------------------------------------
// Espelho do período
// -----------------------------------------------------------------------------

export interface ResumoEspelhoPeriodo {
  diasComJornada: number;
  diasCumpridos: number;
  /** Dias com carga cumprida em horário diferente do previsto (incluídos em diasCumpridos) */
  diasHorarioAlterado: number;
  diasSaidaAntecipada: number;
  diasAtraso: number;
  diasIncompletos: number;
  diasSemMarcacao: number;
  minutosNaoCumpridos: number;
  minutosEfetivos: number;
}

export function montarEspelhoPeriodo(
  datas: string[],
  base: Omit<ParametrosAnaliseDia, "dataStr" | "jornadaExigivel">,
  exigivelPorData?: (dataStr: string) => boolean | undefined
): { dias: AnaliseJornadaDia[]; resumo: ResumoEspelhoPeriodo } {
  const dias = datas.map((dataStr) =>
    analisarJornadaDia({ ...base, dataStr, jornadaExigivel: exigivelPorData?.(dataStr) })
  );
  const resumo: ResumoEspelhoPeriodo = {
    diasComJornada: dias.filter((d) => d.temJornadaPrevista).length,
    diasCumpridos: dias.filter((d) => d.situacao === "JORNADA_CUMPRIDA" || d.situacao === "CARGA_CUMPRIDA_HORARIO_ALTERADO").length,
    diasHorarioAlterado: dias.filter((d) => d.situacao === "CARGA_CUMPRIDA_HORARIO_ALTERADO").length,
    diasSaidaAntecipada: dias.filter((d) => d.situacao === "SAIDA_ANTECIPADA" || d.situacao === "ATRASO_E_SAIDA_ANTECIPADA").length,
    diasAtraso: dias.filter((d) => d.situacao === "ATRASO" || d.situacao === "ATRASO_E_SAIDA_ANTECIPADA").length,
    diasIncompletos: dias.filter((d) => d.situacao === "MARCACAO_INCOMPLETA").length,
    diasSemMarcacao: dias.filter((d) => d.situacao === "SEM_MARCACAO").length,
    minutosNaoCumpridos: dias.reduce((s, d) => s + d.minutosNaoCumpridos, 0),
    minutosEfetivos: dias.reduce((s, d) => s + d.minutosEfetivos, 0),
  };
  return { dias, resumo };
}

export const ROTULO_SITUACAO_JORNADA: Record<SituacaoJornada, { label: string; classes: string }> = {
  JORNADA_CUMPRIDA: { label: "Jornada cumprida", classes: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  CARGA_CUMPRIDA_HORARIO_ALTERADO: { label: "Carga cumprida · horário alterado", classes: "bg-sky-50 text-sky-800 border-sky-200" },
  SAIDA_ANTECIPADA: { label: "Saída antecipada", classes: "bg-orange-50 text-orange-800 border-orange-300" },
  ATRASO: { label: "Atraso na entrada", classes: "bg-amber-50 text-amber-800 border-amber-200" },
  ATRASO_E_SAIDA_ANTECIPADA: { label: "Atraso + saída antecipada", classes: "bg-rose-50 text-rose-800 border-rose-300" },
  CARGA_INCOMPLETA: { label: "Carga incompleta", classes: "bg-orange-50 text-orange-800 border-orange-300" },
  MARCACAO_INCOMPLETA: { label: "Marcação incompleta", classes: "bg-yellow-50 text-yellow-800 border-yellow-300" },
  SEM_MARCACAO: { label: "Sem marcação", classes: "bg-rose-50 text-rose-700 border-rose-200" },
  SEM_JORNADA_PREVISTA: { label: "Sem jornada prevista", classes: "bg-slate-50 text-slate-600 border-slate-200" },
  MARCACAO_FORA_DA_ESCALA: { label: "Marcação fora da escala", classes: "bg-indigo-50 text-indigo-800 border-indigo-200" },
};
