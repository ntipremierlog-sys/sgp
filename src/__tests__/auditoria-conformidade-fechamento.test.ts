import { describe, it, expect, beforeEach } from "vitest";
import {
  carregarEstado,
  salvarEstado,
  congelarCompetencia,
  reabrirCompetencia,
  homologarMedicaoPetrobras,
  FECHAMENTOS_INICIAIS,
} from "../lib/dados/estado-operacional";

describe("Momento 5 / Etapa 3 — Auditoria de Governança, Fechamento e Conformidade Contratual", () => {
  beforeEach(() => {
    salvarEstado({
      fechamentosCompetencia: JSON.parse(JSON.stringify(FECHAMENTOS_INICIAIS)),
      logsAuditoria: [],
    });
  });

  it("deve registrar evento de auditoria com ação CONGELAR_COMPETENCIA e hash SHA-256", () => {
    const comp = "2026-10";
    const res = congelarCompetencia(comp, {
      usuario: "Marcos Valério de Souza (Administrador Premier)",
      hashIntegridadeSha256: "sha256:teste_auditoria_hash_congelamento_12345",
      resumoMetricas: {
        postos: 380,
        exigiveis: 7600,
        efetivas: 7450,
        glosas: 150,
        taxaSla: 98.0,
        valorContrato: 2850000.0,
        valorGlosa: 51250.0,
        faturamentoLiquido: 2798750.0,
      },
    });

    expect(res.status).toBe("CONGELADO");

    const estado = carregarEstado();
    const logCongelamento = estado.logsAuditoria.find(
      (l) => l.acao === "CONGELAR_COMPETENCIA" && l.entidade.includes("2026-10")
    );

    expect(logCongelamento).toBeDefined();
    expect(logCongelamento?.detalhes).toContain("2026-10");
    expect(logCongelamento?.detalhes).toContain("sha256:teste_auditoria");
    expect(logCongelamento?.ip).toBeDefined();
    expect(logCongelamento?.timestamp).toBeDefined();
  });

  it("deve registrar evento de auditoria com ação HOMOLOGAR_MEDICAO_PETROBRAS com parecer do fiscal", () => {
    const comp = "2026-08";
    homologarMedicaoPetrobras(
      comp,
      "Medição atestada sem ressalvas pela fiscalização técnica da Petrobras.",
      "Carlos Eduardo Mendes (Fiscal Técnico Petrobras)"
    );

    const estado = carregarEstado();
    const logHomologacao = estado.logsAuditoria.find(
      (l) => l.acao === "HOMOLOGAR_MEDICAO_PETROBRAS" && l.entidade.includes("2026-08")
    );

    expect(logHomologacao).toBeDefined();
    expect(logHomologacao?.detalhes).toContain("Carlos Eduardo Mendes");
    expect(logHomologacao?.detalhes).toContain("Medição atestada sem ressalvas");
  });

  it("deve registrar evento de auditoria com ação REABRIR_COMPETENCIA contendo a justificativa", () => {
    const comp = "2026-08";
    reabrirCompetencia(
      comp,
      "Reabertura formal autorizada para acerto de atestado médico retroativo.",
      "Marcos Valério de Souza"
    );

    const estado = carregarEstado();
    const logReabertura = estado.logsAuditoria.find(
      (l) => l.acao === "REABRIR_COMPETENCIA" && l.entidade.includes("2026-08")
    );

    expect(logReabertura).toBeDefined();
    expect(logReabertura?.detalhes).toContain("Reabertura formal autorizada");
    expect(logReabertura?.detalhes).toContain("acerto de atestado médico");
  });

  it("deve manter integridade cronológica de múltiplos eventos na trilha de auditoria", () => {
    congelarCompetencia("2026-11", {
      usuario: "Gestor Premier",
      hashIntegridadeSha256: "sha256:log_1",
    });

    homologarMedicaoPetrobras(
      "2026-11",
      "Primeira análise realizada com parecer favorável.",
      "Fiscal Petrobras"
    );

    reabrirCompetencia(
      "2026-11",
      "Solicitação de reanálise por divergência documental de posto.",
      "Gestor Premier"
    );

    const estado = carregarEstado();
    const logsComp = estado.logsAuditoria.filter((l) => l.entidade.includes("2026-11"));

    expect(logsComp.length).toBe(3);
    // O mais recente inserido deve ser o primeiro
    expect(logsComp[0].acao).toBe("REABRIR_COMPETENCIA");
    expect(logsComp[1].acao).toBe("HOMOLOGAR_MEDICAO_PETROBRAS");
    expect(logsComp[2].acao).toBe("CONGELAR_COMPETENCIA");
  });
});
