/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Validação de Interjornada Mínima de 11h Consecutivas conforme Artigo 66 da CLT e Súmula 110 do TST.
 *
 * Regra Legal:
 * "Art. 66 - Entre 2 (duas) jornadas de trabalho haverá um período mínimo de 11 (onze) horas consecutivas para descanso."
 * "Súmula 110/TST - O desrespeito ao intervalo mínimo interjornadas gera a obrigação de pagar a totalidade do tempo suprimido com adicional extraordinário de no mínimo 50%."
 */

import { MarcacaoPontoOriginal } from "@/lib/dados/ponto-tipos";
import {
  CoberturaOperacional,
  PostoOperacional,
  ProfissionalOperacional,
} from "@/lib/dados/estado-operacional";

export interface UltimoTurnoApurado {
  dataHora: string;              // "YYYY-MM-DDTHH:MM:SS"
  dataHoraFormatada: string;     // "14/09/2026 às 22:30"
  origem: "MARCACAO_PONTO" | "COBERTURA_ANTERIOR" | "POSTO_ORIGEM" | "SEM_HISTORICO_RECENTE";
  descricaoOrigem: string;       // "Marcação de Ponto Real no RM" | "Término da Cobertura do Posto PST-002" | etc.
}

export interface NovoTurnoApurado {
  dataHora: string;              // "YYYY-MM-DDTHH:MM:SS"
  dataHoraFormatada: string;     // "15/09/2026 às 07:00"
  postoCodigo: string;
  postoFuncao?: string;
  horarioInicio: string;
}

export interface ResultadoValidacaoInterjornada {
  atende: boolean;                     // true se horasDescanso >= 11, false se < 11
  horasDescanso: number;               // em horas decimais (ex: 8.5)
  horasDescansoFormatado: string;      // ex: "8h 30min"
  deficitHoras: number;                // 11 - horasDescanso (se < 11) ou 0
  deficitFormatado: string;            // ex: "2h 30min" ou "0h 00min"
  ultimoTurnoFim?: UltimoTurnoApurado;
  novoTurnoInicio: NovoTurnoApurado;
  mensagem: string;
  artigoLegal: string;
  sumulaTst: string;
  severidade: "REGULAR" | "ALERTA_CRITICO";
  podeGravarComCiencia: boolean;
}

export interface ParametrosValidacaoInterjornada {
  matricula: string;
  dataInicio: string; // "YYYY-MM-DD"
  postoDestinoCodigo: string;
  postos: PostoOperacional[];
  profissionais: ProfissionalOperacional[];
  coberturas?: CoberturaOperacional[];
  marcacoesPonto?: MarcacaoPontoOriginal[];
  horarioInicioCustomizado?: string; // Se fornecido, substitui horarioInicio do posto
}

/**
 * Converte horas decimais em string legível "Xh YYmin"
 */
export function formatarHorasMinutos(horasDecimais: number): string {
  if (isNaN(horasDecimais) || horasDecimais < 0) return "0h 00min";
  const h = Math.floor(horasDecimais);
  const m = Math.round((horasDecimais - h) * 60);
  if (m === 60) {
    return `${h + 1}h 00min`;
  }
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

/**
 * Formata data no padrão brasileiro DD/MM/YYYY
 */
export function formatarDataBr(dataIsoOuDate: string | Date): string {
  if (!dataIsoOuDate) return "--/--/----";
  if (dataIsoOuDate instanceof Date) {
    const d = String(dataIsoOuDate.getDate()).padStart(2, "0");
    const m = String(dataIsoOuDate.getMonth() + 1).padStart(2, "0");
    const y = dataIsoOuDate.getFullYear();
    return `${d}/${m}/${y}`;
  }
  const partes = dataIsoOuDate.split("-");
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataIsoOuDate;
}

/**
 * Retorna o dia anterior em formato YYYY-MM-DD
 */
export function subtrairDias(dataYmd: string, dias: number = 1): string {
  const [y, m, d] = dataYmd.split("-").map(Number);
  const data = new Date(y, m - 1, d);
  data.setDate(data.getDate() - dias);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Valida o intervalo interjornada mínimo de 11h (Art. 66 CLT).
 */
export function validarInterjornadaClt(
  params: ParametrosValidacaoInterjornada
): ResultadoValidacaoInterjornada {
  const {
    matricula,
    dataInicio,
    postoDestinoCodigo,
    postos,
    profissionais,
    coberturas = [],
    marcacoesPonto = [],
    horarioInicioCustomizado,
  } = params;

  const postoDestino = postos.find((p) => p.codigoPosto === postoDestinoCodigo);
  const profissional = profissionais.find((p) => p.matricula === matricula);

  const horaInicioPosto =
    horarioInicioCustomizado || postoDestino?.horarioInicio || "07:00";

  // Data/hora de início do novo turno
  const [ano, mes, dia] = dataInicio.split("-").map(Number);
  const [hIni, mIni] = horaInicioPosto.split(":").map(Number);
  const inicioNovoTurnoDate = new Date(ano, mes - 1, dia, hIni, mIni, 0, 0);

  const novoTurnoInfo: NovoTurnoApurado = {
    dataHora: inicioNovoTurnoDate.toISOString(),
    dataHoraFormatada: `${formatarDataBr(dataInicio)} às ${horaInicioPosto}`,
    postoCodigo: postoDestinoCodigo,
    postoFuncao: postoDestino?.funcao,
    horarioInicio: horaInicioPosto,
  };

  const ARTIGO_LEGAL = "Art. 66 da CLT (mínimo de 11 horas consecutivas de descanso)";
  const SUMULA_TST =
    "Súmula 110 do TST (remuneração do intervalo suprimido como hora extra com acréscimo de 50%)";

  // Se não foi informada matrícula ou posto, retorna neutro/conforme
  if (!matricula || !postoDestinoCodigo || !dataInicio) {
    return {
      atende: true,
      horasDescanso: 24,
      horasDescansoFormatado: "> 24h",
      deficitHoras: 0,
      deficitFormatado: "0h 00min",
      novoTurnoInicio: novoTurnoInfo,
      mensagem: "Selecione o posto e o colaborador para validar o intervalo interjornada.",
      artigoLegal: ARTIGO_LEGAL,
      sumulaTst: SUMULA_TST,
      severidade: "REGULAR",
      podeGravarComCiencia: true,
    };
  }

  // Candidatos de término de jornada anterior antes de inicioNovoTurnoDate
  interface CandidatoTermino {
    dataHora: Date;
    origem: UltimoTurnoApurado["origem"];
    descricaoOrigem: string;
  }

  const candidatos: CandidatoTermino[] = [];

  // Limite de busca: até 48 horas antes do início do novo turno
  const limitePassadoMs = inicioNovoTurnoDate.getTime() - 48 * 60 * 60 * 1000;

  // ---------------------------------------------------------------------------
  // 1. Marcações de ponto reais
  // ---------------------------------------------------------------------------
  const chapaNormalizada = matricula.padStart(6, "0");
  const pontosColaborador = marcacoesPonto.filter(
    (m) =>
      m.chapa === matricula ||
      m.chapa === chapaNormalizada ||
      (m.cpfLimpo && profissional?.cpfLimpo && m.cpfLimpo === profissional.cpfLimpo.replace(/\D/g, ""))
  );

  for (const ponto of pontosColaborador) {
    if (!ponto.dataLocal || !ponto.horaLocal) continue;
    const [pAno, pMes, pDia] = ponto.dataLocal.split("-").map(Number);
    const horaLimpa = ponto.horaLocal.substring(0, 5);
    const [pHora, pMin] = horaLimpa.split(":").map(Number);
    const pontoDate = new Date(pAno, pMes - 1, pDia, pHora, pMin, 0, 0);

    if (pontoDate.getTime() < inicioNovoTurnoDate.getTime() && pontoDate.getTime() >= limitePassadoMs) {
      candidatos.push({
        dataHora: pontoDate,
        origem: "MARCACAO_PONTO",
        descricaoOrigem: `Registro de ponto (${horaLimpa}) em ${formatarDataBr(ponto.dataLocal)}`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Coberturas ativas anteriores
  // ---------------------------------------------------------------------------
  const coberturasColaborador = coberturas.filter(
    (c) => c.substitutoMatricula === matricula && c.status !== "CANCELADA"
  );

  for (const cob of coberturasColaborador) {
    const cobPosto = postos.find((p) => p.codigoPosto === cob.postoCodigo);
    const cobHoraFim = cobPosto?.horarioFim || "16:48";
    const cobHoraIni = cobPosto?.horarioInicio || "07:00";
    const [cFimH, cFimM] = cobHoraFim.split(":").map(Number);
    const [cIniH, cIniM] = cobHoraIni.split(":").map(Number);

    const atravessaMeiaNoite = cFimH * 60 + cFimM <= cIniH * 60 + cIniM;

    // Se atravessa meia-noite, a jornada do último dia termina no dia seguinte
    const [cobAno, cobMes, cobDia] = cob.dataFim.split("-").map(Number);
    const cobFimDate = new Date(cobAno, cobMes - 1, cobDia, cFimH, cFimM, 0, 0);
    if (atravessaMeiaNoite) {
      cobFimDate.setDate(cobFimDate.getDate() + 1);
    }

    if (cobFimDate.getTime() < inicioNovoTurnoDate.getTime() && cobFimDate.getTime() >= limitePassadoMs) {
      candidatos.push({
        dataHora: cobFimDate,
        origem: "COBERTURA_ANTERIOR",
        descricaoOrigem: `Término de cobertura no posto ${cob.postoCodigo} (${cobHoraFim})`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Posto titular atual do colaborador (se houver)
  // ---------------------------------------------------------------------------
  if (profissional && profissional.postoCodigo) {
    const postoAtual = postos.find((p) => p.codigoPosto === profissional.postoCodigo);
    if (postoAtual) {
      const pAtualHoraIni = postoAtual.horarioInicio || "07:00";
      const pAtualHoraFim = postoAtual.horarioFim || "16:48";
      const [pHIniH, pHIniM] = pAtualHoraIni.split(":").map(Number);
      const [pHFimH, pHFimM] = pAtualHoraFim.split(":").map(Number);

      const atravessaMeiaNoite = pHFimH * 60 + pHFimM <= pHIniH * 60 + pHIniM;

      // Verificar dia anterior
      const dataOntem = subtrairDias(dataInicio, 1);
      const [ontemAno, ontemMes, ontemDia] = dataOntem.split("-").map(Number);

      let fimTurnoOntemDate = new Date(ontemAno, ontemMes - 1, ontemDia, pHFimH, pHFimM, 0, 0);
      if (atravessaMeiaNoite) {
        // Se trabalhou ontem à noite, termina na manhã de hoje (dataInicio)
        fimTurnoOntemDate = new Date(ano, mes - 1, dia, pHFimH, pHFimM, 0, 0);
      }

      if (
        fimTurnoOntemDate.getTime() < inicioNovoTurnoDate.getTime() &&
        fimTurnoOntemDate.getTime() >= limitePassadoMs
      ) {
        candidatos.push({
          dataHora: fimTurnoOntemDate,
          origem: "POSTO_ORIGEM",
          descricaoOrigem: `Fim do turno titular no posto ${postoAtual.codigoPosto} (${pAtualHoraFim})`,
        });
      }

      // Verificar mesmo dia caso o posto atual encerre antes do novo turno
      if (!atravessaMeiaNoite) {
        const fimTurnoHojeDate = new Date(ano, mes - 1, dia, pHFimH, pHFimM, 0, 0);
        if (
          fimTurnoHojeDate.getTime() < inicioNovoTurnoDate.getTime() &&
          fimTurnoHojeDate.getTime() >= limitePassadoMs
        ) {
          candidatos.push({
            dataHora: fimTurnoHojeDate,
            origem: "POSTO_ORIGEM",
            descricaoOrigem: `Fim do turno diurno no posto titular ${postoAtual.codigoPosto} (${pAtualHoraFim})`,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Avaliação do intervalo de descanso
  // ---------------------------------------------------------------------------
  if (candidatos.length === 0) {
    // Sem histórico de jornada ou marcação nas últimas 48h (ex: Reserva Técnica ou folga legal)
    return {
      atende: true,
      horasDescanso: 48,
      horasDescansoFormatado: "> 48h",
      deficitHoras: 0,
      deficitFormatado: "0h 00min",
      ultimoTurnoFim: {
        dataHora: new Date(limitePassadoMs).toISOString(),
        dataHoraFormatada: "Sem registro nas últimas 48 horas (Folga/Reserva)",
        origem: "SEM_HISTORICO_RECENTE",
        descricaoOrigem: "Colaborador sem turno ou marcação recente nas últimas 48h.",
      },
      novoTurnoInicio: novoTurnoInfo,
      mensagem:
        "Descanso regular confirmado: sem jornada ou marcação nas últimas 48h. Atende integralmente ao Art. 66 da CLT.",
      artigoLegal: ARTIGO_LEGAL,
      sumulaTst: SUMULA_TST,
      severidade: "REGULAR",
      podeGravarComCiencia: true,
    };
  }

  // Ordenar decrescente para pegar o término mais recente (mais restritivo)
  candidatos.sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
  const maisRecente = candidatos[0];

  const diffMs = inicioNovoTurnoDate.getTime() - maisRecente.dataHora.getTime();
  const horasDescanso = Math.max(0, diffMs / (1000 * 60 * 60));
  const horasFormatado = formatarHorasMinutos(horasDescanso);

  const horaFimStr = `${String(maisRecente.dataHora.getHours()).padStart(2, "0")}:${String(
    maisRecente.dataHora.getMinutes()
  ).padStart(2, "0")}`;

  const ultimoTurnoObj: UltimoTurnoApurado = {
    dataHora: maisRecente.dataHora.toISOString(),
    dataHoraFormatada: `${formatarDataBr(maisRecente.dataHora)} às ${horaFimStr}`,
    origem: maisRecente.origem,
    descricaoOrigem: maisRecente.descricaoOrigem,
  };

  // Avaliação do cumprimento do Art. 66 CLT (11 horas)
  if (horasDescanso < 11.0) {
    const deficit = Math.round((11.0 - horasDescanso) * 100) / 100;
    const deficitFormatado = formatarHorasMinutos(deficit);

    return {
      atende: false,
      horasDescanso,
      horasDescansoFormatado: horasFormatado,
      deficitHoras: deficit,
      deficitFormatado,
      ultimoTurnoFim: ultimoTurnoObj,
      novoTurnoInicio: novoTurnoInfo,
      mensagem: `ATENÇÃO (CLT Art. 66): O colaborador terá apenas ${horasFormatado} de descanso entre o término da jornada anterior (${ultimoTurnoObj.dataHoraFormatada}) e o início da cobertura (${novoTurnoInfo.dataHoraFormatada}). Déficit apurado de ${deficitFormatado} em relação ao mínimo de 11h consecutivas.`,
      artigoLegal: ARTIGO_LEGAL,
      sumulaTst: SUMULA_TST,
      severidade: "ALERTA_CRITICO",
      podeGravarComCiencia: true,
    };
  }

  return {
    atende: true,
    horasDescanso,
    horasDescansoFormatado: horasFormatado,
    deficitHoras: 0,
    deficitFormatado: "0h 00min",
    ultimoTurnoFim: ultimoTurnoObj,
    novoTurnoInicio: novoTurnoInfo,
    mensagem: `Interjornada regular: descanso de ${horasFormatado} apurado entre ${ultimoTurnoObj.dataHoraFormatada} e ${novoTurnoInfo.dataHoraFormatada}. Atende ao Art. 66 da CLT.`,
    artigoLegal: ARTIGO_LEGAL,
    sumulaTst: SUMULA_TST,
    severidade: "REGULAR",
    podeGravarComCiencia: true,
  };
}
