/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Serviço Central do Calendário da Competência
 *
 * Consolida mensalmente os 3 arquivos do RM/TOTVS para a competência:
 * (1) Funcionários (cadastro + férias/afastamentos)
 * (2) Ponto / Registros
 * (3) Cubo de Abono
 *
 * Aplica as 6 regras prioritárias por colaborador × dia:
 * 1. Fora do vínculo (antes da admissão ou após demissão) → "Não se aplica"
 * 2. Férias / Afastamento / Licença → "Férias" | "Afastamento" | "Licença"
 * 3. Feriado ou folga da escala → "Folga"
 * 4. Com ponto registrado → "Trabalhado" (+ horas abonadas se parcial)
 * 5. Sem ponto + abono de dia inteiro → "Ausência justificada"
 * 6. Sem ponto e sem justificativa → "Falta" + alerta ao gestor da unidade
 */

import {
  carregarEstado,
  salvarEstado,
  obterTodosPostosContrato,
  verificarFeriadoBase,
  obterMarcacoesPonto,
  EstadoOperacionalCompleto,
  ProfissionalOperacional,
  VagaPosto,
  VAGAS_MC_REAIS,
  ALOCACOES_MC_REAIS,
} from "@/lib/dados/estado-operacional";

export type StatusDiaCalendario =
  | "Não se aplica"
  | "Férias"
  | "Afastamento"
  | "Licença"
  | "Folga"
  | "Trabalhado"
  | "Ausência justificada"
  | "Falta";

export interface RegistroDiaColaborador {
  data: string; // YYYY-MM-DD
  diaSemana: string; // DOM, SEG, TER...
  status: StatusDiaCalendario;
  detalhe?: string;
  horasAbonadas?: number;
  tipoAbono?: string;
  isFimDeSemana: boolean;
  isFeriado: boolean;
  alertaGestor?: string;
}

export interface ResumoColaboradorCalendario {
  chapa: string;
  nome: string;
  funcao: string;
  unidadeId: string;
  unidadeNome: string;
  posicaoId?: string;
  postoCodigo?: string;
  dias: Record<string, RegistroDiaColaborador>;
  totais: {
    totalDias: number;
    diasTrabalhados: number;
    diasFolga: number;
    diasFerias: number;
    diasAfastamento: number;
    diasLicenca: number;
    diasNaoAplica: number;
    diasFalta: number;
    diasJustificados: number;
    ausenciasDiasUteis: number;
    ausenciasDiasCorridos: number;
    horasAbonadasTotal: number;
  };
}

export interface ResumoPosicaoCalendario {
  posicaoId: string;
  postoId: string;
  postoDescricao: string;
  unidadeNome: string;
  ocupanteChapa?: string;
  ocupanteNome?: string;
  diasExigiveis: number;
  diasAtendidos: number;
  taxaCobertura: number; // percentual 0 a 100
  ausencias: number;
}

export interface AlertaGestorUnidade {
  id: string;
  chapa: string;
  nome: string;
  unidadeNome: string;
  data: string;
  motivo: string;
}

export interface ResultadoCalendarioCompetencia {
  competencia: string;
  periodo: {
    dataInicio: string;
    dataFim: string;
    textoFormatado: string;
    datas: string[];
  };
  dataProcessamento: string;
  geradoPor: string;
  status: "GERADO" | "DESATUALIZADO";
  metricasGerais: {
    totalColaboradores: number;
    totalPosicoes: number;
    taxaCoberturaMedia: number;
    totalAusenciasUteis: number;
    totalFaltas: number;
    totalAlertasGestor: number;
  };
  colaboradores: ResumoColaboradorCalendario[];
  posicoes: ResumoPosicaoCalendario[];
  alertasGestor: AlertaGestorUnidade[];
}

/**
 * Calcula o período oficial da competência (dia 10 do mês anterior ao dia 09 do mês de referência)
 */
export function obterPeriodoCompetencia(competencia: string): {
  dataInicio: string;
  dataFim: string;
  textoFormatado: string;
  datas: string[];
} {
  const [anoStr, mesStr] = competencia.split("-");
  const ano = parseInt(anoStr, 10) || 2026;
  const mes = parseInt(mesStr, 10) || 9;

  let anoAnt = ano;
  let mesAnt = mes - 1;
  if (mesAnt === 0) {
    mesAnt = 12;
    anoAnt = ano - 1;
  }

  const dataInicio = `${anoAnt}-${String(mesAnt).padStart(2, "0")}-10`;
  const dataFim = `${ano}-${String(mes).padStart(2, "0")}-09`;
  const textoFormatado = `10/${String(mesAnt).padStart(2, "0")}/${anoAnt} a 09/${String(mes).padStart(2, "0")}/${ano}`;

  const datas: string[] = [];
  const dtAtual = new Date(anoAnt, mesAnt - 1, 10);
  const dtFim = new Date(ano, mes - 1, 9);
  while (dtAtual <= dtFim) {
    const y = dtAtual.getFullYear();
    const m = String(dtAtual.getMonth() + 1).padStart(2, "0");
    const d = String(dtAtual.getDate()).padStart(2, "0");
    datas.push(`${y}-${m}-${d}`);
    dtAtual.setDate(dtAtual.getDate() + 1);
  }

  return { dataInicio, dataFim, textoFormatado, datas };
}

const NOMES_DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/**
 * Motor central de processamento do Calendário da Competência
 */
export function gerarCalendarioCompetencia(
  competencia: string = "2026-09",
  usuarioNome: string = "Administrador Premier"
): ResultadoCalendarioCompetencia {
  const estado = carregarEstado();
  const periodo = obterPeriodoCompetencia(competencia);
  const postos = obterTodosPostosContrato(estado.postos);
  const vagas = (estado.vagas && estado.vagas.length > 0) ? estado.vagas : VAGAS_MC_REAIS;
  const alocacoes = (estado.alocacoes && estado.alocacoes.length > 0) ? estado.alocacoes : ALOCACOES_MC_REAIS;

  // Mapa de colaboradores: se houver no estado, usa; caso contrário, usa alocações vigentes
  const mapaColaboradores = new Map<string, ProfissionalOperacional>();
  (estado.profissionais || []).forEach((p) => {
    const chapaPad = String(p.chapa || p.matricula || "").replace(/\D/g, "").padStart(6, "0");
    if (chapaPad) mapaColaboradores.set(chapaPad, p);
  });

  // Complementa com alocações da REV04 se não houver colaboradores importados
  if (mapaColaboradores.size === 0) {
    alocacoes.forEach((a) => {
      const chapaPad = String(a.matricula || "").replace(/\D/g, "").padStart(6, "0");
      if (chapaPad && !mapaColaboradores.has(chapaPad)) {
        mapaColaboradores.set(chapaPad, {
          id: `prf-${chapaPad}`,
          chapa: chapaPad,
          matricula: a.matricula,
          nome: a.nome,
          cpfLimpo: "",
          cpfMascarado: "—",
          funcao: (a as any).funcao || "Operacional",
          unidadeId: (a as any).unidadeId || "CONTRATO",
          escala: (a.horarioEscalaRm?.includes("12X36") ? "12x36" : "5x2") as any,
          situacao: "ATIVO",
          dataAdmissao: "2024-01-01",
        });
      }
    });
  }

  // Mapeamento de marcações de ponto: Set de chaves `${chapaPad}_${dataStr}`
  const marcacoesPonto = obterMarcacoesPonto();
  const setPontos = new Set<string>();
  marcacoesPonto.forEach((m) => {
    const chapaRaw = m.chapa || "";
    const chapaPad = String(chapaRaw).replace(/\D/g, "").padStart(6, "0");
    const dataStr = (m.dataLocal || m.dataHoraUtc || "").substring(0, 10);
    if (chapaPad && dataStr) {
      setPontos.add(`${chapaPad}_${dataStr}`);
    }
  });

  // Mapeamento de Ocorrências (Férias / Afastamentos / Licenças)
  const ocorrencias = estado.ocorrencias || [];

  // Mapeamento de Abonos
  const apontamentos = estado.apontamentos || [];

  // Mapeamento de Vagas e Alocações por Chapa
  const mapaVagaPorChapa = new Map<string, { vaga: VagaPosto; postoCodigo: string }>();
  vagas.forEach((v) => {
    const aloc = alocacoes.find((a) => a.vagaId === v.id && !a.dataFim);
    if (aloc && aloc.matricula) {
      const chapaPad = String(aloc.matricula).replace(/\D/g, "").padStart(6, "0");
      mapaVagaPorChapa.set(chapaPad, { vaga: v, postoCodigo: v.idPosto });
    }
  });

  const listaColaboradoresResumo: ResumoColaboradorCalendario[] = [];
  const listaAlertasGestor: AlertaGestorUnidade[] = [];

  let somaAusenciasUteis = 0;
  let somaFaltas = 0;

  for (const colab of Array.from(mapaColaboradores.values())) {
    const chapaPad = String(colab.chapa || colab.matricula || "").replace(/\D/g, "").padStart(6, "0");
    const vinculoVaga = mapaVagaPorChapa.get(chapaPad);

    const diasRegistro: Record<string, RegistroDiaColaborador> = {};
    let countTrabalhados = 0;
    let countFolga = 0;
    let countFerias = 0;
    let countAfastamento = 0;
    let countLicenca = 0;
    let countNaoAplica = 0;
    let countFalta = 0;
    let countJustificados = 0;
    let countAusenciasUteis = 0;
    let countAusenciasCorridos = 0;
    let somaHorasAbono = 0;

    for (const dataDia of periodo.datas) {
      const dt = new Date(dataDia + "T12:00:00");
      const diaSemanaIndex = dt.getDay();
      const diaSemanaNome = NOMES_DIAS_SEMANA[diaSemanaIndex];
      const isFimDeSemana = diaSemanaIndex === 0 || diaSemanaIndex === 6;

      // Verifica feriado municipal / nacional na unidade do colaborador
      const feriadoCheck = verificarFeriadoBase(dataDia, colab.unidadeNome, undefined, undefined, colab.unidadeId);
      const isFeriado = feriadoCheck.ehFeriado;

      // REGRA 1: Fora do vínculo contratual
      if (colab.dataAdmissao && dataDia < colab.dataAdmissao) {
        diasRegistro[dataDia] = {
          data: dataDia,
          diaSemana: diaSemanaNome,
          status: "Não se aplica",
          detalhe: "Data anterior à admissão",
          isFimDeSemana,
          isFeriado,
        };
        countNaoAplica++;
        continue;
      }
      if (colab.dataDesligamento && dataDia > colab.dataDesligamento) {
        diasRegistro[dataDia] = {
          data: dataDia,
          diaSemana: diaSemanaNome,
          status: "Não se aplica",
          detalhe: "Data posterior à demissão",
          isFimDeSemana,
          isFeriado,
        };
        countNaoAplica++;
        continue;
      }

      // REGRA 2: Dentro de período de Férias / Afastamento / Licença
      const ocorrenciaAtiva = ocorrencias.find((o) => {
        const oChapa = String(o.matricula || "").replace(/\D/g, "").padStart(6, "0");
        if (oChapa !== chapaPad) return false;
        const inicio = o.dataInicio?.substring(0, 10);
        const fim = o.dataFim ? o.dataFim.substring(0, 10) : "9999-12-31";
        return dataDia >= inicio && dataDia <= fim;
      });

      if (ocorrenciaAtiva) {
        const cat = (ocorrenciaAtiva.categoriaAusencia || ocorrenciaAtiva.tipoOcorrencia || "").toUpperCase();
        let statusRegra2: StatusDiaCalendario = "Afastamento";
        if (cat.includes("FERIA") || ocorrenciaAtiva.tipoOcorrencia === "FERIAS") {
          statusRegra2 = "Férias";
          countFerias++;
        } else if (cat.includes("LICEN") || (ocorrenciaAtiva.tipoOcorrencia as string) === "LICENCA") {
          statusRegra2 = "Licença";
          countLicenca++;
        } else {
          statusRegra2 = "Afastamento";
          countAfastamento++;
        }

        diasRegistro[dataDia] = {
          data: dataDia,
          diaSemana: diaSemanaNome,
          status: statusRegra2,
          detalhe: ocorrenciaAtiva.observacaoPublica || statusRegra2,
          isFimDeSemana,
          isFeriado,
        };
        countAusenciasCorridos++;
        continue;
      }

      // REGRA 3: Feriado ou folga da escala (5x2, 12x36, etc.)
      const escalaColab = String(colab.escala || "").toUpperCase();
      let ehFolgaEscala = false;
      if (escalaColab.includes("12X36") || escalaColab.includes("4X4")) {
        // Escala alternada simples ou fim de semana
        ehFolgaEscala = isFimDeSemana;
      } else {
        // Escala padrão 5x2: folga aos sábados e domingos
        ehFolgaEscala = isFimDeSemana;
      }

      if (isFeriado || ehFolgaEscala) {
        diasRegistro[dataDia] = {
          data: dataDia,
          diaSemana: diaSemanaNome,
          status: "Folga",
          detalhe: isFeriado ? `Feriado: ${feriadoCheck.feriado?.nome || "Municipal/Nacional"}` : "Folga programada da escala",
          isFimDeSemana,
          isFeriado,
        };
        countFolga++;
        continue;
      }

      // REGRA 4: Ponto registrado no dia
      const temPontoNoDia = setPontos.has(`${chapaPad}_${dataDia}`);

      // Verifica se há abono registrado para o colaborador nesta data
      const abonoNoDia = ocorrencias.find((o) => {
        const oChapa = String(o.matricula || "").replace(/\D/g, "").padStart(6, "0");
        return oChapa === chapaPad && o.dataInicio?.substring(0, 10) === dataDia;
      });

      if (temPontoNoDia) {
        const horasAb = abonoNoDia?.quantidadeHoras || 0;
        if (horasAb > 0) somaHorasAbono += horasAb;

        diasRegistro[dataDia] = {
          data: dataDia,
          diaSemana: diaSemanaNome,
          status: "Trabalhado",
          detalhe: horasAb > 0 ? `Trabalhado + ${horasAb}h abonadas (${abonoNoDia?.categoriaAusencia || "Abono parcial"})` : "Jornada cumprida",
          horasAbonadas: horasAb > 0 ? horasAb : undefined,
          tipoAbono: abonoNoDia?.categoriaAusencia,
          isFimDeSemana,
          isFeriado,
        };
        countTrabalhados++;
        continue;
      }

      // REGRA 5: Sem ponto + abono de dia inteiro
      if (abonoNoDia) {
        diasRegistro[dataDia] = {
          data: dataDia,
          diaSemana: diaSemanaNome,
          status: "Ausência justificada",
          detalhe: `Abono de dia inteiro: ${abonoNoDia.categoriaAusencia || abonoNoDia.observacaoPublica || "Justificativa aceita"}`,
          tipoAbono: abonoNoDia.categoriaAusencia,
          isFimDeSemana,
          isFeriado,
        };
        countJustificados++;
        countAusenciasUteis++;
        countAusenciasCorridos++;
        somaAusenciasUteis++;
        continue;
      }

      // REGRA 6: Sem ponto e sem justificativa → Falta
      diasRegistro[dataDia] = {
        data: dataDia,
        diaSemana: diaSemanaNome,
        status: "Falta",
        detalhe: "Ausência sem justificativa registrada no RM",
        isFimDeSemana,
        isFeriado,
        alertaGestor: `Alerta: Falta do colaborador ${colab.nome} (${chapaPad}) em dia útil (${dataDia}).`,
      };
      countFalta++;
      countAusenciasUteis++;
      countAusenciasCorridos++;
      somaFaltas++;
      somaAusenciasUteis++;

      listaAlertasGestor.push({
        id: `alt-${chapaPad}-${dataDia}`,
        chapa: chapaPad,
        nome: colab.nome,
        unidadeNome: colab.unidadeNome || colab.unidadeId || "Unidade Operacional",
        data: dataDia,
        motivo: "Falta em dia de trabalho programado sem ponto e sem abono no RM",
      });
    }

    listaColaboradoresResumo.push({
      chapa: chapaPad,
      nome: colab.nome,
      funcao: colab.funcao,
      unidadeId: colab.unidadeId,
      unidadeNome: colab.unidadeNome || colab.unidadeId,
      posicaoId: vinculoVaga?.vaga.id,
      postoCodigo: vinculoVaga?.postoCodigo,
      dias: diasRegistro,
      totais: {
        totalDias: periodo.datas.length,
        diasTrabalhados: countTrabalhados,
        diasFolga: countFolga,
        diasFerias: countFerias,
        diasAfastamento: countAfastamento,
        diasLicenca: countLicenca,
        diasNaoAplica: countNaoAplica,
        diasFalta: countFalta,
        diasJustificados: countJustificados,
        ausenciasDiasUteis: countAusenciasUteis,
        ausenciasDiasCorridos: countAusenciasCorridos,
        horasAbonadasTotal: somaHorasAbono,
      },
    });
  }

  // Métricas por Posição / Posto
  const listaPosicoesResumo: ResumoPosicaoCalendario[] = [];
  let somaPercentualCobertura = 0;

  vagas.forEach((v) => {
    const aloc = alocacoes.find((a) => a.vagaId === v.id && !a.dataFim);
    const colabChapaPad = aloc?.matricula ? String(aloc.matricula).replace(/\D/g, "").padStart(6, "0") : undefined;
    const colabResumo = colabChapaPad ? listaColaboradoresResumo.find((c) => c.chapa === colabChapaPad) : undefined;

    let diasExigiveis = 0;
    let diasAtendidos = 0;
    let ausencias = 0;

    periodo.datas.forEach((dataDia) => {
      const reg = colabResumo?.dias[dataDia];
      if (reg && reg.status !== "Não se aplica" && reg.status !== "Folga") {
        diasExigiveis++;
        if (reg.status === "Trabalhado") {
          diasAtendidos++;
        } else {
          ausencias++;
        }
      }
    });

    const taxa = diasExigiveis > 0 ? Math.round((diasAtendidos / diasExigiveis) * 100) : 100;
    somaPercentualCobertura += taxa;

    const postoRef = postos.find((p) => p.idPosto === v.idPosto || p.codigoPosto === v.idPosto || p.id === v.idPosto);

    listaPosicoesResumo.push({
      posicaoId: v.id,
      postoId: v.idPosto,
      postoDescricao: postoRef?.funcao || postoRef?.descricao || "Posto Operacional",
      unidadeNome: postoRef?.unidadeNome || postoRef?.localAtuacao || "Base Contratual",
      ocupanteChapa: colabChapaPad,
      ocupanteNome: aloc?.nome,
      diasExigiveis,
      diasAtendidos,
      taxaCobertura: taxa,
      ausencias,
    });
  });

  const mediaCobertura = listaPosicoesResumo.length > 0
    ? Math.round(somaPercentualCobertura / listaPosicoesResumo.length)
    : 100;

  const resultado: ResultadoCalendarioCompetencia = {
    competencia,
    periodo,
    dataProcessamento: new Date().toISOString().replace("T", " ").substring(0, 19),
    geradoPor: usuarioNome,
    status: "GERADO",
    metricasGerais: {
      totalColaboradores: listaColaboradoresResumo.length,
      totalPosicoes: listaPosicoesResumo.length,
      taxaCoberturaMedia: mediaCobertura,
      totalAusenciasUteis: somaAusenciasUteis,
      totalFaltas: somaFaltas,
      totalAlertasGestor: listaAlertasGestor.length,
    },
    colaboradores: listaColaboradoresResumo,
    posicoes: listaPosicoesResumo,
    alertasGestor: listaAlertasGestor,
  };

  // Salva no estado
  const calendariosAtuais = (estado as any).calendarioCompetencia || {};
  salvarEstado({
    ...(estado as any),
    calendarioCompetencia: {
      ...calendariosAtuais,
      [competencia]: resultado,
    },
  });

  return resultado;
}

/**
 * Obtém o calendário já gerado para uma competência
 */
export function obterCalendarioCompetencia(
  competencia: string
): ResultadoCalendarioCompetencia | null {
  const estado = carregarEstado();
  const mapa = (estado as any).calendarioCompetencia || {};
  return mapa[competencia] || null;
}

/**
 * Marca o calendário da competência como DESATUALIZADO (quando um lote é substituído ou desfeito)
 */
export function marcarCalendarioDesatualizado(competencia: string): void {
  const estado = carregarEstado();
  const mapa = (estado as any).calendarioCompetencia || {};
  if (mapa[competencia]) {
    mapa[competencia].status = "DESATUALIZADO";
    salvarEstado({
      ...(estado as any),
      calendarioCompetencia: mapa,
    });
  }
}
