/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Motor de Interpretação de Horários, Escalas e Ciclos por Colaborador
 *
 * Interpretação de turnos (SEG/SEX, SEG/DOM, 12X36, 4X4, 4X2), jornadas noturnas
 * e gestão de data-base de ciclo de trabalho.
 */

import {
  HorarioInterpretado,
  CicloEscalaColaborador,
  MarcacaoPontoOriginal,
} from "@/lib/dados/ponto-tipos";
import { ehFeriadoNacional } from "@/lib/dados/feriados-nacionais";

export type { HorarioInterpretado, CicloEscalaColaborador };

const CHAVE_STORAGE_HORARIOS_CONFIRMADOS = "sgp_horarios_interpretados_confirmados_v1";
const CHAVE_STORAGE_CICLOS_COLABORADOR = "sgp_ciclos_colaborador_confirmados_v1";

/**
 * Analisa a descrição do horário do RM e sugere os parâmetros de turno.
 */
export function sugerirInterpretacaoHorario(
  codigo: string,
  descricao: string
): HorarioInterpretado {
  const descUpper = (descricao || "").toUpperCase();

  // Tipo de escala
  let tipoEscala: HorarioInterpretado["tipoEscala"] = "OUTRO";
  if (descUpper.includes("12X36")) {
    tipoEscala = "12X36";
  } else if (descUpper.includes("4X4")) {
    tipoEscala = "4X4";
  } else if (descUpper.includes("4X2")) {
    tipoEscala = "4X2";
  } else if (descUpper.includes("SEG/SEX") || descUpper.includes("SEG A SEX")) {
    tipoEscala = "SEG/SEX";
  } else if (descUpper.includes("SEG/DOM") || descUpper.includes("SEG A DOM")) {
    tipoEscala = "SEG/DOM";
  }

  // Horários de entrada e saída (ex: "07:00 AS 16:48", "18:30 AS 06:30", "06:00 AS 15:00 E 12:00 AS 21:00")
  const regexHorarios = /(\d{1,2}:\d{2})\s*(?:AS|A|ÀS|-)\s*(\d{1,2}:\d{2})/g;
  const matches = [...descUpper.matchAll(regexHorarios)];

  let horaEntrada = "07:00";
  let horaSaida = "16:48";
  let segundoTurno: HorarioInterpretado["segundoTurno"] = undefined;

  if (matches.length >= 1) {
    horaEntrada = matches[0][1].padStart(5, "0");
    horaSaida = matches[0][2].padStart(5, "0");
  }

  if (matches.length >= 2 && tipoEscala === "4X2") {
    segundoTurno = {
      horaEntrada: matches[1][1].padStart(5, "0"),
      horaSaida: matches[1][2].padStart(5, "0"),
    };
  }

  // Jornada noturna (atravessa meia-noite) se saída for menor ou igual à entrada
  // ou se contiver termos noturnos explícitos
  const [hEnt, mEnt] = horaEntrada.split(":").map(Number);
  const [hSai, mSai] = horaSaida.split(":").map(Number);
  const minEnt = hEnt * 60 + mEnt;
  const minSai = hSai * 60 + mSai;

  const atravessaMeiaNoite =
    minSai <= minEnt ||
    descUpper.includes("NOTURNO") ||
    (hEnt >= 18 && hSai <= 8);

  return {
    codigoHorario: codigo,
    descricaoRm: descricao,
    tipoEscala,
    atravessaMeiaNoite,
    horaEntradaPadrao: horaEntrada,
    horaSaidaPadrao: horaSaida,
    segundoTurno,
    confirmado: false, // Exige confirmação do administrador
    atualizadoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
    atualizadoPor: "Sugestão do Sistema",
  };
}

/**
 * Carrega a lista de horários interpretados e confirmados
 */
export function carregarHorariosInterpretados(): HorarioInterpretado[] {
  if (typeof window !== "undefined") {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE_HORARIOS_CONFIRMADOS);
      if (salvo) {
        return JSON.parse(salvo);
      }
    } catch {
      // Fallback
    }
  }
  return [];
}

/**
 * Salva a lista de horários interpretados e confirmados
 */
export function salvarHorariosInterpretados(lista: HorarioInterpretado[]) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHAVE_STORAGE_HORARIOS_CONFIRMADOS, JSON.stringify(lista));
    } catch {
      // Fallback
    }
  }
}

/**
 * Retorna a interpretação de um horário, usando a confirmada ou sugerindo na hora
 */
export function obterInterpretacaoHorario(
  codigo: string,
  descricaoRm: string
): HorarioInterpretado {
  const lista = carregarHorariosInterpretados();
  const encontrado = lista.find((h) => h.codigoHorario === codigo);
  if (encontrado) return encontrado;
  return sugerirInterpretacaoHorario(codigo, descricaoRm);
}

/**
 * Sugere a data-base de início de ciclo para colaborador em escala cíclica (12x36, 4x4, 4x2)
 * a partir das suas primeiras marcações de presença.
 */
export function sugerirDataBaseCiclo(
  chapa: string,
  marcacoes: MarcacaoPontoOriginal[]
): string | undefined {
  const marcacoesColab = marcacoes
    .filter((m) => m.chapa === chapa)
    .sort((a, b) => a.dataLocal.localeCompare(b.dataLocal));

  if (marcacoesColab.length === 0) return undefined;

  // A primeira data com marcação representa tipicamente um dia de trabalho do ciclo
  return marcacoesColab[0].dataLocal;
}

/**
 * Carrega configurações de ciclos dos colaboradores
 */
export function carregarCiclosColaboradores(): CicloEscalaColaborador[] {
  if (typeof window !== "undefined") {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE_CICLOS_COLABORADOR);
      if (salvo) {
        return JSON.parse(salvo);
      }
    } catch {
      // Fallback
    }
  }
  return [];
}

/**
 * Salva ciclos confirmados de colaboradores
 */
export function salvarCiclosColaboradores(ciclos: CicloEscalaColaborador[]) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHAVE_STORAGE_CICLOS_COLABORADOR, JSON.stringify(ciclos));
    } catch {
      // Fallback
    }
  }
}

/**
 * Calcula a diferença em dias entre duas datas no formato YYYY-MM-DD
 */
function diferencaDias(dataA: string, dataB: string): number {
  const [ya, ma, da] = dataA.split("-").map(Number);
  const [yb, mb, db] = dataB.split("-").map(Number);
  const msA = Date.UTC(ya, ma - 1, da);
  const msB = Date.UTC(yb, mb - 1, db);
  return Math.round((msA - msB) / (1000 * 60 * 60 * 24));
}

/**
 * Verifica se em uma data específica o colaborador tem jornada prevista
 * conforme seu tipo de escala e data-base de ciclo.
 */
export function verificarJornadaPrevistaDia(
  dataIso: string, // YYYY-MM-DD
  horario: HorarioInterpretado,
  ciclo?: CicloEscalaColaborador
): {
  temJornada: boolean;
  escalaNaoConfirmada: boolean;
  horaInicio: string;
  horaFim: string;
  atravessaMeiaNoite: boolean;
  tipoEscala: string;
} {
  const { tipoEscala, horaEntradaPadrao, horaSaidaPadrao, atravessaMeiaNoite, segundoTurno } = horario;

  // 1. SEG/SEX: Trabalho de Segunda (1) a Sexta (5), exceto feriados nacionais conhecidos
  if (tipoEscala === "SEG/SEX") {
    const [y, m, d] = dataIso.split("-").map(Number);
    const dataJs = new Date(Date.UTC(y, m - 1, d));
    const diaSemana = dataJs.getUTCDay(); // 0 = Domingo, 6 = Sábado
    const isFeriadoNacional = ehFeriadoNacional(dataIso); // lista única em src/lib/dados/feriados-nacionais.ts
    const ehDiaUtil = diaSemana >= 1 && diaSemana <= 5 && !isFeriadoNacional;
    return {
      temJornada: ehDiaUtil,
      escalaNaoConfirmada: false,
      horaInicio: horaEntradaPadrao,
      horaFim: horaSaidaPadrao,
      atravessaMeiaNoite,
      tipoEscala,
    };
  }

  // 2. SEG/DOM: Todos os dias com jornada
  if (tipoEscala === "SEG/DOM") {
    return {
      temJornada: true,
      escalaNaoConfirmada: false,
      horaInicio: horaEntradaPadrao,
      horaFim: horaSaidaPadrao,
      atravessaMeiaNoite,
      tipoEscala,
    };
  }

  // 3. Escalas Cíclicas (12X36, 4X4, 4X2) exigem DATA-BASE confirmada
  if (tipoEscala === "12X36" || tipoEscala === "4X4" || tipoEscala === "4X2") {
    if (!ciclo || !ciclo.confirmado || !ciclo.dataBaseCiclo) {
      // REGRA: Sem data-base confirmada = "Escala não confirmada" (NUNCA gerar falta)
      return {
        temJornada: false,
        escalaNaoConfirmada: true,
        horaInicio: horaEntradaPadrao,
        horaFim: horaSaidaPadrao,
        atravessaMeiaNoite,
        tipoEscala,
      };
    }

    const diff = diferencaDias(dataIso, ciclo.dataBaseCiclo);
    // Se a data analisada for anterior à data-base, calcula módulo de forma cíclica
    const moduloSeguro = ((diff % 1000) + 1000) % 1000;

    // Escala 12x36: Ciclo de 2 dias (Dia 0 = trabalho, Dia 1 = folga)
    if (tipoEscala === "12X36") {
      const posCiclo = ((diff % 2) + 2) % 2;
      return {
        temJornada: posCiclo === 0,
        escalaNaoConfirmada: false,
        horaInicio: horaEntradaPadrao,
        horaFim: horaSaidaPadrao,
        atravessaMeiaNoite,
        tipoEscala,
      };
    }

    // Escala 4x4: Ciclo de 8 dias (Dias 0, 1, 2, 3 = trabalho; Dias 4, 5, 6, 7 = folga)
    if (tipoEscala === "4X4") {
      const posCiclo = ((diff % 8) + 8) % 8;
      return {
        temJornada: posCiclo >= 0 && posCiclo <= 3,
        escalaNaoConfirmada: false,
        horaInicio: horaEntradaPadrao,
        horaFim: horaSaidaPadrao,
        atravessaMeiaNoite,
        tipoEscala,
      };
    }

    // Escala 4x2: Ciclo de 6 dias (Dias 0, 1, 2, 3 = trabalho; Dias 4, 5 = folga)
    if (tipoEscala === "4X2") {
      const posCiclo = ((diff % 6) + 6) % 6;
      const temJornada = posCiclo >= 0 && posCiclo <= 3;
      // Se tiver dois turnos cadastrados, dias 0 e 1 podem ser turno 1 e dias 2 e 3 turno 2
      let hIn = horaEntradaPadrao;
      let hOut = horaSaidaPadrao;
      if (segundoTurno && (posCiclo === 2 || posCiclo === 3)) {
        hIn = segundoTurno.horaEntrada;
        hOut = segundoTurno.horaSaida;
      }
      return {
        temJornada,
        escalaNaoConfirmada: false,
        horaInicio: hIn,
        horaFim: hOut,
        atravessaMeiaNoite,
        tipoEscala,
      };
    }
  }

  // Padrão outros
  return {
    temJornada: true,
    escalaNaoConfirmada: false,
    horaInicio: horaEntradaPadrao,
    horaFim: horaSaidaPadrao,
    atravessaMeiaNoite,
    tipoEscala,
  };
}
