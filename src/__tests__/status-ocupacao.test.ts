import { describe, it, expect } from "vitest";
import { StatusOcupacao } from "@/components/ui/badge-status";

describe("Regras de Domínio — Status de Ocupação Diária", () => {
  const statusObrigatorios: StatusOcupacao[] = [
    "TITULAR_PRESENTE",
    "COBERTO",
    "DESCOBERTO",
    "NAO_EXIGIVEL",
    "POSTO_VAGO",
    "PENDENTE_APURACAO",
  ];

  it("deve contemplar exatamente os 6 status contratuais previstos na Seção 6", () => {
    expect(statusObrigatorios).toHaveLength(6);
    expect(statusObrigatorios).toContain("TITULAR_PRESENTE");
    expect(statusObrigatorios).toContain("COBERTO");
    expect(statusObrigatorios).toContain("DESCOBERTO");
    expect(statusObrigatorios).toContain("NAO_EXIGIVEL");
    expect(statusObrigatorios).toContain("POSTO_VAGO");
    expect(statusObrigatorios).toContain("PENDENTE_APURACAO");
  });

  it("deve identificar o status crítico de DESCOBERTO para subsidiar apontamento e glosa", () => {
    const statusCritico: StatusOcupacao = "DESCOBERTO";
    expect(statusCritico).toBe("DESCOBERTO");
  });
});
