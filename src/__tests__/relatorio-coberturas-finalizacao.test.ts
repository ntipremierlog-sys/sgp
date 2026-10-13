import { describe, it, expect } from "vitest";
import {
  consultarDadosRelatorioCoberturas,
  classificarCategoriaLgpd,
  obterLimitesCompetencia,
} from "@/lib/dados/relatorio-coberturas-dados";

describe("Finalização do Relatório de Coberturas — Exportação, Perfis e Desempenho", () => {
  it("Revisão de Desempenho: agregação calcula totais consolidados sem payload volumoso", async () => {
    const res = await consultarDadosRelatorioCoberturas({
      competencia: "2026-09",
    });

    expect(res.sucesso).toBe(true);
    expect(res.competencia).toBe("2026-09");
    expect(res.indicadores).toBeDefined();

    // Valida que o resultado contém as 3 visões agregadas para exportação Excel e PDF
    expect(res.resumoItemPpu).toBeInstanceOf(Array);
    expect(res.resumoImovel).toBeInstanceOf(Array);
    expect(res.rankingFeristas).toBeInstanceOf(Array);

    // Valida totais de Setembro/2026 apurados
    expect(res.indicadores.totalAusencias).toBe(13);
    expect(res.indicadores.ausenciasCobertas).toBe(10);
    expect(res.indicadores.ausenciasSemCobertura).toBe(3);
    expect(res.indicadores.totalDiariasCobertas).toBe(102);
    expect(res.indicadores.totalDiariasDescobertas).toBe(27);
    expect(res.indicadores.percentualCobertura).toBeCloseTo(76.9, 1);
  });

  it("Perfis de Acesso: Regra estrita de LGPD para perfil Fiscal Petrobras", () => {
    // Motivos diversos com diagnósticos ou CID
    const caso1 = classificarCategoriaLgpd("Atestado CID-10 J06 infecção respiratória");
    const caso2 = classificarCategoriaLgpd("Licença maternidade 180 dias");
    const caso3 = classificarCategoriaLgpd("Férias regulares 30 dias");
    const caso4 = classificarCategoriaLgpd("Falta não justificada");

    // Perfil Fiscal Petrobras só pode ver a Categoria higienizada
    expect(caso1).toBe("Afastamento");
    expect(caso2).toBe("Licença");
    expect(caso3).toBe("Férias");
    expect(caso4).toBe("Falta");

    // Nenhuma ocorrência de termos médicos ou CID
    expect(caso1).not.toContain("CID");
    expect(caso1).not.toContain("infecção");
  });

  it("Exportação Excel: consolidação por 4 abas (Item PPU, Imóvel, Substituto e Detalhado)", async () => {
    const res = await consultarDadosRelatorioCoberturas({
      competencia: "2026-09",
    });

    // 1. Aba Item_PPU
    expect(res.resumoItemPpu.length).toBeGreaterThanOrEqual(1);
    const item1_1 = res.resumoItemPpu.find((p) => p.item === "1.1");
    expect(item1_1).toBeDefined();
    expect(item1_1?.diariasCobertas).toBe(18);
    expect(item1_1?.percentualCobertura).toBe(100);

    // 2. Aba Imovel
    expect(res.resumoImovel.length).toBeGreaterThanOrEqual(1);
    const boaventura = res.resumoImovel.find((i) => i.imovel.toUpperCase().includes("BOAVENTURA"));
    expect(boaventura).toBeDefined();
    expect(boaventura?.diariasCobertas).toBe(23);

    // 3. Aba Substituto
    expect(res.rankingFeristas.length).toBeGreaterThanOrEqual(1);
    const topFerista = res.rankingFeristas[0];
    expect(topFerista.nome).toBeTruthy();
    expect(topFerista.diarias).toBeGreaterThan(0);
  });
});
