import { describe, it, expect } from "vitest";
import {
  analisarJornadaDia,
  obterBatidasDoDia,
  montarEspelhoPeriodo,
  formatarDuracao,
} from "@/lib/servicos/analise-jornada";
import type { MarcacaoPontoOriginal } from "@/lib/dados/ponto-tipos";

function mk(chapa: string, dataLocal: string, horaLocal: string, nsr?: string): MarcacaoPontoOriginal {
  return {
    id: `MK-${chapa}-${dataLocal}-${horaLocal}`,
    loteId: "LOTE-TESTE",
    arquivoOrigem: "sintetico.xlsx",
    colaboradorId: `prf-${chapa}`,
    chapa,
    cpfLimpo: "00000000000",
    dataHoraUtc: `${dataLocal}T${horaLocal}:00.000Z`,
    dataLocal,
    horaLocal,
    nsr,
    importadoEm: "2026-10-09T00:00:00.000Z",
  };
}

const HORARIO_ADM = "PETROBRAS - 08:00 AS 17:00 - SEG/SEX";

describe("Análise de jornada — registros de ponto do dia", () => {
  it("detecta jornada não concluída: previsto até 17:00, saída às 15:00 → 2h00 antes", () => {
    const marcacoes = [
      mk("012345", "2026-09-01", "08:00"),
      mk("012345", "2026-09-01", "12:00"),
      mk("012345", "2026-09-01", "13:00"),
      mk("012345", "2026-09-01", "15:00"),
    ];
    const a = analisarJornadaDia({ dataStr: "2026-09-01", chapa: "12345", marcacoes, horarioDescricao: HORARIO_ADM });
    expect(a.temJornadaPrevista).toBe(true);
    expect(a.previstoInicio).toBe("08:00");
    expect(a.previstoFim).toBe("17:00");
    expect(a.ultimaSaida).toBe("15:00");
    expect(a.cargaPrevistaMin).toBe(480); // 9h de faixa − 1h de intervalo
    expect(a.saidaAntecipadaMin).toBe(120);
    expect(a.minutosNaoCumpridos).toBe(120);
    expect(a.situacao).toBe("SAIDA_ANTECIPADA");
    expect(a.descricao).toContain("2h00 antes do previsto (17:00)");
    expect(a.minutosEfetivos).toBe(240 + 120); // 08:00-12:00 + 13:00-15:00
    expect(a.pares).toHaveLength(2);
  });

  it("entrou e saiu mais cedo, mas cumpriu a carga horária → cumprida com horário alterado (caso real 10/08)", () => {
    const marcacoes = [
      mk("036828", "2026-08-10", "06:37"),
      mk("036828", "2026-08-10", "12:13"),
      mk("036828", "2026-08-10", "13:13"),
      mk("036828", "2026-08-10", "16:26"),
    ];
    const a = analisarJornadaDia({
      dataStr: "2026-08-10",
      chapa: "036828",
      marcacoes,
      horarioDescricao: "PETROBRAS - 07:00 AS 16:48 - SEG/SEX",
    });
    expect(a.cargaPrevistaMin).toBe(528); // 8h48
    expect(a.minutosEfetivos).toBe(529); // 8h49
    expect(a.saidaAntecipadaMin).toBe(22);
    expect(a.compensado).toBe(true);
    expect(a.minutosNaoCumpridos).toBe(0);
    expect(a.situacao).toBe("CARGA_CUMPRIDA_HORARIO_ALTERADO");
    expect(a.descricao).toContain("entrou às 06:37");
  });

  it("entrada e saída no horário com intervalo longo → carga incompleta", () => {
    const marcacoes = [
      mk("012345", "2026-09-01", "08:00"),
      mk("012345", "2026-09-01", "12:00"),
      mk("012345", "2026-09-01", "14:00"),
      mk("012345", "2026-09-01", "17:00"),
    ];
    const a = analisarJornadaDia({ dataStr: "2026-09-01", chapa: "012345", marcacoes, horarioDescricao: HORARIO_ADM });
    expect(a.situacao).toBe("CARGA_INCOMPLETA");
    expect(a.minutosNaoCumpridos).toBe(60);
  });

  it("marcação em dia fora da escala não gera atraso nem não cumprido", () => {
    const marcacoes = [mk("012345", "2026-09-05", "11:02"), mk("012345", "2026-09-05", "13:42")];
    const a = analisarJornadaDia({ dataStr: "2026-09-05", chapa: "012345", marcacoes, horarioDescricao: HORARIO_ADM });
    expect(a.situacao).toBe("MARCACAO_FORA_DA_ESCALA");
    expect(a.atrasoMin).toBe(0);
    expect(a.saidaAntecipadaMin).toBe(0);
    expect(a.minutosNaoCumpridos).toBe(0);
  });

  it("considera jornada cumprida dentro da tolerância de 10 minutos", () => {
    // Só entrada e saída: intervalo de 1h pré-assinalado; 08:05–16:56 = 7h51 de 8h00 → 9 min (dentro da tolerância)
    const marcacoes = [mk("012345", "2026-09-02", "08:05"), mk("012345", "2026-09-02", "16:56")];
    const a = analisarJornadaDia({ dataStr: "2026-09-02", chapa: "012345", marcacoes, horarioDescricao: HORARIO_ADM });
    expect(a.situacao).toBe("JORNADA_CUMPRIDA");
    expect(a.minutosNaoCumpridos).toBe(0);
  });

  it("identifica atraso combinado com saída antecipada", () => {
    const marcacoes = [mk("012345", "2026-09-03", "09:30"), mk("012345", "2026-09-03", "16:00")];
    const a = analisarJornadaDia({ dataStr: "2026-09-03", chapa: "012345", marcacoes, horarioDescricao: HORARIO_ADM });
    expect(a.situacao).toBe("ATRASO_E_SAIDA_ANTECIPADA");
    expect(a.atrasoMin).toBe(90);
    expect(a.saidaAntecipadaMin).toBe(60);
    expect(a.minutosNaoCumpridos).toBe(150);
  });

  it("marcação ímpar não afirma horário de saída", () => {
    const marcacoes = [mk("012345", "2026-09-04", "08:00"), mk("012345", "2026-09-04", "12:00"), mk("012345", "2026-09-04", "13:00")];
    const a = analisarJornadaDia({ dataStr: "2026-09-04", chapa: "012345", marcacoes, horarioDescricao: HORARIO_ADM });
    expect(a.situacao).toBe("MARCACAO_INCOMPLETA");
    expect(a.ultimaSaida).toBeUndefined();
    expect(a.saidaAntecipadaMin).toBe(0);
  });

  it("sem marcação em dia útil e sem jornada no fim de semana", () => {
    const util = analisarJornadaDia({ dataStr: "2026-09-04", chapa: "012345", marcacoes: [], horarioDescricao: HORARIO_ADM });
    expect(util.situacao).toBe("SEM_MARCACAO");
    const sabado = analisarJornadaDia({ dataStr: "2026-09-05", chapa: "012345", marcacoes: [], horarioDescricao: HORARIO_ADM });
    expect(sabado.situacao).toBe("SEM_JORNADA_PREVISTA");
  });

  it("turno noturno usa marcações do dia seguinte e detecta saída antecipada", () => {
    const horario = "PETROBRAS - 19:00 AS 07:00 - ESCALA 4X4";
    const marcacoes = [
      mk("054321", "2026-09-01", "06:55"), // saída do turno anterior — não pertence ao dia 01
      mk("054321", "2026-09-01", "18:57"),
      mk("054321", "2026-09-02", "04:00"),
    ];
    const a = analisarJornadaDia({
      dataStr: "2026-09-01",
      chapa: "054321",
      marcacoes,
      horarioDescricao: horario,
      jornadaExigivel: true,
    });
    expect(a.atravessaMeiaNoite).toBe(true);
    expect(a.batidas.map((b) => b.hora)).toEqual(["18:57", "04:00"]);
    expect(a.batidas[1].diaSeguinte).toBe(true);
    expect(a.saidaAntecipadaMin).toBe(180);
    expect(a.situacao).toBe("SAIDA_ANTECIPADA");
  });

  it("escala cíclica sem data-base e sem marcação não gera 'sem marcação'", () => {
    const a = analisarJornadaDia({
      dataStr: "2026-09-01",
      chapa: "054321",
      marcacoes: [],
      horarioDescricao: "PETROBRAS - 06:00 AS 18:00 - ESCALA 4X4",
    });
    expect(a.escalaNaoConfirmada).toBe(true);
    expect(a.situacao).toBe("SEM_JORNADA_PREVISTA");
  });

  it("4X2 com duas faixas escolhe a faixa mais próxima da 1ª marcação", () => {
    const horario = "PETROBRAS - 06:00 AS 15:00 E 12:00 AS 21:00 - ESCALA 4X2";
    const marcacoes = [mk("011111", "2026-09-01", "12:05"), mk("011111", "2026-09-01", "19:00")];
    const a = analisarJornadaDia({ dataStr: "2026-09-01", chapa: "011111", marcacoes, horarioDescricao: horario, jornadaExigivel: true });
    expect(a.previstoInicio).toBe("12:00");
    expect(a.previstoFim).toBe("21:00");
    expect(a.saidaAntecipadaMin).toBe(120);
  });

  it("obterBatidasDoDia normaliza chapa e remove duplicidades", () => {
    const marcacoes = [mk("000777", "2026-09-01", "08:00"), mk("000777", "2026-09-01", "08:00"), mk("000888", "2026-09-01", "09:00")];
    expect(obterBatidasDoDia(marcacoes, "777", "2026-09-01")).toHaveLength(1);
  });

  it("espelho do período totaliza dias e minutos não cumpridos", () => {
    const marcacoes = [
      mk("012345", "2026-09-01", "08:00"), mk("012345", "2026-09-01", "15:00"), // -2h
      mk("012345", "2026-09-02", "08:00"), mk("012345", "2026-09-02", "17:00"), // ok
    ];
    const { dias, resumo } = montarEspelhoPeriodo(["2026-09-01", "2026-09-02", "2026-09-03"], {
      chapa: "012345",
      marcacoes,
      horarioDescricao: HORARIO_ADM,
    });
    expect(dias).toHaveLength(3);
    expect(resumo.diasComJornada).toBe(3);
    expect(resumo.diasSaidaAntecipada).toBe(1);
    expect(resumo.diasCumpridos).toBe(1);
    expect(resumo.diasSemMarcacao).toBe(1);
    expect(resumo.minutosNaoCumpridos).toBe(120);
    expect(formatarDuracao(resumo.minutosNaoCumpridos)).toBe("2h00");
  });
});
