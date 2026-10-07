import { describe, it, expect } from "vitest";
import {
  POSTOS_REV02,
  POSICOES_REV02,
  POSICOES_EXCEDENTES_REV02,
  ALOCACOES_REV02,
  PENDENTES_RM_REV02,
  VALIDACOES_REV02,
  REGISTRO_CARGA_REV02,
  TIPOS_POSTO_CATALOGO,
  obterQtdPosicoesEsperadas,
} from "@/lib/dados/estrutura-postos";

describe("Importação da Base Estruturada SGP Petrobras REV02", () => {
  it("Critério 1: deve importar exatamente 244 postos", () => {
    expect(POSTOS_REV02.length).toBe(244);
    expect(REGISTRO_CARGA_REV02.totalPostos).toBe(244);
  });

  it("Critério 2: deve importar exatamente a quantidade de posições conforme as regras estruturais (311 posições)", () => {
    expect(POSICOES_REV02.length).toBe(311);
    expect(REGISTRO_CARGA_REV02.totalPosicoesEstruturais).toBe(311);
  });

  it("Critério 3: nenhum posto deve ter mais posições do que a regra estrutural (Turno/16h = 3)", () => {
    const posicoesPorPosto = new Map<string, number>();
    POSICOES_REV02.forEach((p) => {
      posicoesPorPosto.set(p.postoIdSGP, (posicoesPorPosto.get(p.postoIdSGP) || 0) + 1);
    });

    POSTOS_REV02.forEach((posto) => {
      const qtdReal = posicoesPorPosto.get(posto.postoIdSGP) || 0;
      const qtdEsperada = obterQtdPosicoesEsperadas(posto.tipoPostoId, posto.postoIdSGP, posto.unidade);

      // Quantidade real de posições não pode exceder a premissa da regra
      expect(qtdReal).toBeLessThanOrEqual(qtdEsperada);
      expect(qtdReal).toBe(posto.qtdEstruturalPremissa);

      // Turno/16h tem 3 posições conforme regra estrutural
      if (posto.postoIdSGP === "PST-CABIUNAS-010") {
        expect(qtdReal).toBe(3);
      }
    });
  });

  it("Critério 4: deve importar exatamente 322 alocações vinculadas a posições", () => {
    expect(ALOCACOES_REV02.length).toBe(322);
    expect(REGISTRO_CARGA_REV02.totalAlocacoes).toBe(322);

    // Todas as alocações devem ter ID e posto definidos
    ALOCACOES_REV02.forEach((a) => {
      expect(a.alocacaoIdSGP).toMatch(/^ALOC-\d{4}$/);
      expect(a.postoIdSGP).toMatch(/^PST-/);
    });
  });

  it("Critério 5: posições saneadas na base oficial (7.3, 110, 250.2) devem estar devidamente validadas", () => {
    const conflito73 = POSICOES_REV02.find((p) => p.posicaoIdSGP === "POS-BOAVENTURA-007-03");
    expect(conflito73).toBeDefined();
    expect(conflito73?.statusValidacao).toBe("VALIDADA");

    const conflito110 = POSICOES_REV02.find((p) => p.posicaoIdSGP === "POS-EDIHB-110-01");
    expect(conflito110).toBeDefined();
    expect(conflito110?.statusValidacao).toBe("VALIDADA");

    const conflito250 = POSICOES_REV02.find((p) => p.posicaoIdSGP === "POS-RPBC-250-02");
    expect(conflito250).toBeDefined();
    expect(conflito250?.statusValidacao).toBe("VALIDADA");
  });

  it("Critério 6: as 9 posições excedentes da planilha NÃO devem virar posições estruturais extras", () => {
    expect(POSICOES_EXCEDENTES_REV02.length).toBe(9);
    POSICOES_EXCEDENTES_REV02.forEach((ex) => {
      expect(ex.ehEstrutural).toBe(false);
      expect(ex.statusValidacao).toBe("A VALIDAR");
    });
  });

  it("Critério 7: deve carregar a fila de 11 pendentes RM e 29 validações da planilha oficial", () => {
    expect(PENDENTES_RM_REV02.length).toBe(11);
    expect(VALIDACOES_REV02.length).toBe(29);
  });

  it("Critério 8: catálogo TipoPosto deve conter as premissas e status definidos no Passo 1", () => {
    expect(TIPOS_POSTO_CATALOGO.ADM_09H.posicoesPorPosto).toBe(1);
    expect(TIPOS_POSTO_CATALOGO.ADM_09H.statusPremissa).toBe("fechada");

    expect(TIPOS_POSTO_CATALOGO.ADM_12H.posicoesPorPosto).toBe(2);
    expect(TIPOS_POSTO_CATALOGO.ADM_12H.statusPremissa).toBe("fechada");

    expect(TIPOS_POSTO_CATALOGO.TURNO_12H.posicoesPorPosto).toBe(2);
    expect(TIPOS_POSTO_CATALOGO.TURNO_12H.statusPremissa).toBe("fechada");

    expect(TIPOS_POSTO_CATALOGO.ADM_16H.posicoesPorPosto).toBe(2);
    expect(TIPOS_POSTO_CATALOGO.ADM_16H.statusPremissa).toBe("fechada");

    expect(TIPOS_POSTO_CATALOGO.TURNO_16H.posicoesPorPosto).toBe(3);
    expect(TIPOS_POSTO_CATALOGO.TURNO_16H.statusPremissa).toBe("fechada");

    expect(TIPOS_POSTO_CATALOGO.TURNO_24H.posicoesPorPosto).toBe(4);
    expect(TIPOS_POSTO_CATALOGO.TURNO_24H.statusPremissa).toBe("fechada");
  });
});
