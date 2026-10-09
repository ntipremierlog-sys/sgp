/**
 * Correções da varredura de regras × planilhas (09/10/2026)
 * C2 — regra única de competência · A1 — ocorrências não médicas · M1 — feriados nacionais
 * M2 — "TRE" como palavra inteira · M3 — abono de jornada longa = 1 dia
 */
import { describe, it, expect } from "vitest";
import {
  calcularPeriodoCompetencia,
  competenciaDaData,
  competenciaDoInicioCiclo,
} from "@/lib/servicos/periodo-competencia";
import { obterPeriodoCompetencia } from "@/lib/servicos/calendario-competencia";
import { obterPeriodoCicloPadrao, FERIADOS_OFICIAIS_CONTRATO } from "@/lib/dados/estado-operacional";
import { ehFeriadoNacional } from "@/lib/dados/feriados-nacionais";
import { verificarJornadaPrevistaDia, sugerirInterpretacaoHorario } from "@/lib/servicos/interpretador-horarios";
import {
  categorizarAusencia,
  categorizarAbonoItem5,
  extrairQuantidadeHorasDias,
} from "@/lib/importadores/cubo-abono";
import ocorrenciasReais from "@/lib/dados/ocorrencias-reais.json";

describe("C2 — regra única de competência (igual à MC)", () => {
  it("competência 2026-09 = 10/08/2026 a 09/09/2026", () => {
    const p = calcularPeriodoCompetencia("2026-09");
    expect(p.dataInicio).toBe("2026-08-10");
    expect(p.dataFim).toBe("2026-09-09");
    expect(p.datas.length).toBe(31);
  });

  it("obterPeriodoCompetencia e obterPeriodoCicloPadrao produzem o MESMO período", () => {
    for (const comp of ["2026-01", "2026-03", "2026-09", "2026-10", "2027-01"]) {
      const a = obterPeriodoCompetencia(comp);
      const [ano, mes] = comp.split("-").map(Number);
      const anoIni = mes === 1 ? ano - 1 : ano;
      const mesIni = mes === 1 ? 12 : mes - 1;
      const b = obterPeriodoCicloPadrao(anoIni, mesIni);
      expect(b.competencia).toBe(comp);
      expect(b.dataInicio).toBe(a.dataInicio);
      expect(b.dataFim).toBe(a.dataFim);
      expect(b.datas).toEqual(a.datas);
    }
  });

  it("competenciaDaData respeita o corte no dia 10 e a virada de ano", () => {
    expect(competenciaDaData("2026-08-09")).toBe("2026-08");
    expect(competenciaDaData("2026-08-10")).toBe("2026-09");
    expect(competenciaDaData("2026-12-15")).toBe("2027-01");
    expect(competenciaDoInicioCiclo(2026, 12)).toBe("2027-01");
  });
});

describe("A1 — nenhuma ocorrência não médica carregada como ATESTADO_MEDICO", () => {
  it("DECLARACAO COMPARECIMENTO / ACOMPANHAMENTO / ELEITORAL não são ATESTADO_MEDICO", () => {
    const naoMedicas = (ocorrenciasReais as Array<{ tipoOcorrencia: string; tipoAbono?: string }>).filter(
      (o) => o.tipoOcorrencia === "ATESTADO_MEDICO" && /COMPARECIMENTO|ACOMPANHAMENTO|ELEITORAL/i.test(o.tipoAbono || "")
    );
    expect(naoMedicas).toEqual([]);
  });

  it("os dados carregados batem com a classificação do importador", () => {
    for (const o of ocorrenciasReais as Array<{ tipoOcorrencia: string; tipoAbono?: string }>) {
      if (!o.tipoAbono) continue;
      const pelo = categorizarAbonoItem5(o.tipoAbono);
      if (!pelo.ehConhecido) continue;
      expect(`${o.tipoAbono}:${o.tipoOcorrencia}`).toBe(`${o.tipoAbono}:${pelo.tipoOcorrencia}`);
    }
  });
});

describe("M1 — feriados nacionais na jornada SEG/SEX", () => {
  const horarioAdm = sugerirInterpretacaoHorario("ADM", "08:00 AS 17:00 - SEG/SEX");

  it.each(["2026-10-12", "2026-11-02", "2026-11-20", "2026-12-25", "2027-01-01"])(
    "%s não tem jornada prevista",
    (data) => {
      expect(ehFeriadoNacional(data)).toBe(true);
      expect(verificarJornadaPrevistaDia(data, horarioAdm).temJornada).toBe(false);
    }
  );

  it("dia útil comum continua com jornada", () => {
    expect(verificarJornadaPrevistaDia("2026-10-13", horarioAdm).temJornada).toBe(true);
  });

  it("lista contratual inclui todos os feriados nacionais", () => {
    const nacionais = FERIADOS_OFICIAIS_CONTRATO.filter((f) => f.tipo === "NACIONAL").map((f) => f.data);
    expect(nacionais).toContain("2026-11-15");
    expect(nacionais).toContain("2027-12-25");
  });
});

describe("M2 — termo TRE apenas como palavra inteira", () => {
  it.each(["ENTREGA DE DOCUMENTOS", "TREINAMENTO", "ESTRESSE"])("%s não vira ABONO_LEGAL", (desc) => {
    expect(categorizarAusencia(desc).tipoOcorrencia).not.toBe("ABONO_LEGAL");
    expect(categorizarAbonoItem5(desc).tipoOcorrencia).not.toBe("ABONO_LEGAL");
  });

  it("TRE isolado e ELEITORAL continuam ABONO_LEGAL", () => {
    expect(categorizarAbonoItem5("CONVOCACAO TRE").tipoOcorrencia).toBe("ABONO_LEGAL");
    expect(categorizarAbonoItem5("ATESTADO COMP ELEITORAL").tipoOcorrencia).toBe("ABONO_LEGAL");
  });
});

describe("M3 — abono de jornada longa conta 1 dia", () => {
  it.each([
    ["08:48", 1],
    ["12:00", 1],
    ["16:00", 1],
    ["24:00", 1],
    ["48:00", 2],
  ])("%s → %i dia(s)", (valor, dias) => {
    expect(extrairQuantidadeHorasDias(valor).dias).toBe(dias);
  });
});
