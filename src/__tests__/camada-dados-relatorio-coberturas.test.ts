import { describe, it, expect } from "vitest";
import {
  consultarDadosRelatorioCoberturas,
  calcularDiasCortadosNoMes,
  classificarCategoriaLgpd,
  obterLimitesCompetencia,
} from "@/lib/dados/relatorio-coberturas-dados";

describe("Camada de Dados — Relatório de Coberturas", () => {
  it("Regra de Corte de Datas: deve cortar estritamente períodos que atravessam meses", () => {
    const inicioSet = "2026-09-01";
    const fimSet = "2026-09-30";

    // 1. Período totalmente contido em setembro (01/09 a 09/09 -> 9 dias)
    const diasContido = calcularDiasCortadosNoMes("2026-09-01", "2026-09-09", inicioSet, fimSet);
    expect(diasContido).toBe(9);

    // 2. Período que começou em agosto e entrou em setembro (25/08 a 05/09 -> 5 dias em setembro: 01 a 05)
    const diasCruzouInicio = calcularDiasCortadosNoMes("2026-08-25", "2026-09-05", inicioSet, fimSet);
    expect(diasCruzouInicio).toBe(5);

    // 3. Período que começou em setembro e terminou em outubro (25/09 a 05/10 -> 6 dias em setembro: 25 a 30)
    const diasCruzouFim = calcularDiasCortadosNoMes("2026-09-25", "2026-10-05", inicioSet, fimSet);
    expect(diasCruzouFim).toBe(6);

    // 4. Período totalmente fora de setembro (em agosto ou outubro -> 0 dias)
    const diasFora = calcularDiasCortadosNoMes("2026-10-01", "2026-10-10", inicioSet, fimSet);
    expect(diasFora).toBe(0);
  });

  it("Regra LGPD: motivo deve retornar exclusivamente categoria limpa, sem CID ou dados médicos", () => {
    expect(classificarCategoriaLgpd("Férias regulamentares")).toBe("Férias");
    expect(classificarCategoriaLgpd("Atestado médico CID-10 M54.5 lombalgia")).toBe("Afastamento");
    expect(classificarCategoriaLgpd("Licença gala")).toBe("Licença");
    expect(classificarCategoriaLgpd("Falta injustificada")).toBe("Falta");
    expect(classificarCategoriaLgpd(undefined)).toBe("Outros");
  });

  it("deve calcular os limites de competência corretamente", () => {
    const l1 = obterLimitesCompetencia("2026-09");
    expect(l1.inicio).toBe("2026-09-01");
    expect(l1.fim).toBe("2026-09-30");
    expect(l1.diasNoMes).toBe(30);

    const l2 = obterLimitesCompetencia("10/2026");
    expect(l2.inicio).toBe("2026-10-01");
    expect(l2.fim).toBe("2026-10-31");
    expect(l2.diasNoMes).toBe(31);
  });

  it("deve retornar as quatro seções (A, B, C, D) calculadas na competência 2026-09", async () => {
    const res = await consultarDadosRelatorioCoberturas({
      competencia: "2026-09",
    });

    expect(res.sucesso).toBe(true);
    expect(res.competencia).toBe("2026-09");

    // A) Indicadores do período
    expect(res.indicadores).toBeDefined();
    expect(res.indicadores.totalAusencias).toBeGreaterThanOrEqual(1);
    expect(res.indicadores.ausenciasCobertas).toBeGreaterThanOrEqual(1);
    expect(res.indicadores.percentualCobertura).toBeGreaterThanOrEqual(0);
    expect(res.indicadores.percentualCobertura).toBeLessThanOrEqual(100);
    expect(res.indicadores.totalDiariasCobertas).toBeGreaterThan(0);

    // B) Resumo por Item da PPU
    expect(res.resumoItemPpu).toBeInstanceOf(Array);
    expect(res.resumoItemPpu.length).toBeGreaterThan(0);
    const item1_1 = res.resumoItemPpu.find((p) => p.item === "1.1");
    expect(item1_1).toBeDefined();
    expect(item1_1?.descricao).toBeDefined();
    expect(item1_1?.numeroCoberturas).toBeGreaterThanOrEqual(1);
    expect(item1_1?.diariasCobertas).toBeGreaterThan(0);
    expect(item1_1?.percentualCobertura).toBeGreaterThan(0);

    // C) Resumo por Imóvel
    expect(res.resumoImovel).toBeInstanceOf(Array);
    expect(res.resumoImovel.length).toBeGreaterThan(0);
    res.resumoImovel.forEach((im) => {
      expect(im.imovel).toBeTruthy();
      expect(typeof im.numeroCoberturas).toBe("number");
      expect(typeof im.diariasCobertas).toBe("number");
      expect(typeof im.percentualCobertura).toBe("number");
    });

    // D) Ranking dos Feristas / Substitutos
    expect(res.rankingFeristas).toBeInstanceOf(Array);
    expect(res.rankingFeristas.length).toBeGreaterThan(0);
    res.rankingFeristas.forEach((f) => {
      expect(f.nome).toBeTruthy();
      expect(f.numeroCoberturas).toBeGreaterThan(0);
      expect(f.diarias).toBeGreaterThan(0);
    });

    // Ordenação do ranking decrescente por diárias
    for (let i = 0; i < res.rankingFeristas.length - 1; i++) {
      expect(res.rankingFeristas[i].diarias).toBeGreaterThanOrEqual(res.rankingFeristas[i + 1].diarias);
    }
  });

  it("deve filtrar corretamente por Item da PPU opcional", async () => {
    const res = await consultarDadosRelatorioCoberturas({
      competencia: "2026-09",
      itemPpu: "1.1",
    });

    expect(res.sucesso).toBe(true);
    expect(res.resumoItemPpu.every((p) => p.item === "1.1")).toBe(true);
  });

  it("deve filtrar corretamente por Imóvel opcional", async () => {
    const res = await consultarDadosRelatorioCoberturas({
      competencia: "2026-09",
      imovel: "EDIHB",
    });

    expect(res.sucesso).toBe(true);
    expect(res.resumoImovel.every((im) => im.imovel.toLowerCase().includes("edihb"))).toBe(true);
  });
});
