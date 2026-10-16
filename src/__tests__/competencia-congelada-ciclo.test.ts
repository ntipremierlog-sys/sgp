import { describe, it, expect } from "vitest";
import { obterCompetenciaCongeladaNoPeriodo } from "@/lib/dados/estado-operacional";

/**
 * Bloqueio de competência congelada pelo CICLO (dia 10 a 09, nome do mês de término),
 * e não pelo mês do calendário. A competência 2026-08 está congelada (FECHAMENTOS_INICIAIS).
 */
describe("competência congelada pelo ciclo", () => {
  it("05/08/2026 pertence à 2026-08 (congelada)", () => {
    expect(obterCompetenciaCongeladaNoPeriodo("2026-08-05")).toBe("2026-08");
  });
  it("20/08/2026 pertence à 2026-09 (não congelada)", () => {
    expect(obterCompetenciaCongeladaNoPeriodo("2026-08-20")).toBeNull();
  });
  it("período que cruza o dia 09/10 alcança a competência congelada", () => {
    expect(obterCompetenciaCongeladaNoPeriodo("2026-08-09", "2026-08-25")).toBe("2026-08");
    expect(obterCompetenciaCongeladaNoPeriodo("2026-08-10", "2026-08-25")).toBeNull();
  });
});
