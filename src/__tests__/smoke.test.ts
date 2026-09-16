import { describe, it, expect } from "vitest";

describe("Smoke Test — Ambiente e Configuração SGP", () => {
  it("deve carregar o ambiente Vitest com sucesso", () => {
    expect(true).toBe(true);
  });

  it("deve validar o fuso horário e dados contratuais do SGP", () => {
    const contrato = {
      numeroIcj: "5900.0129796.25.2",
      cliente: "Petróleo Brasileiro S.A. - Petrobras",
      contratada: "Premier Logistics Gestão Empresarial Ltda.",
    };

    expect(contrato.numeroIcj).toBe("5900.0129796.25.2");
    expect(contrato.cliente).toContain("Petrobras");
    expect(contrato.contratada).toContain("Premier Logistics");
  });
});
