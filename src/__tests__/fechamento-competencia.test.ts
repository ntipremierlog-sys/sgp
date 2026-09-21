/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Testes Unitários: Fechamento de Competência & Congelamento Mensal (Item 11.3)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  obterFechamentosCompetencia,
  obterStatusCompetencia,
  isCompetenciaCongelada,
  congelarCompetencia,
  reabrirCompetencia,
  homologarMedicaoPetrobras,
  carregarEstado,
  salvarEstado,
  FECHAMENTOS_INICIAIS,
} from "@/lib/dados/estado-operacional";

describe("Fechamento de Competência & Congelamento Mensal (Item 11.3)", () => {
  beforeEach(() => {
    // Restaura o estado inicial dos fechamentos antes de cada teste
    salvarEstado({
      fechamentosCompetencia: JSON.parse(JSON.stringify(FECHAMENTOS_INICIAIS)),
    });
  });

  it("deve carregar os fechamentos iniciais com Agosto/2026 CONGELADO e Setembro/2026 ABERTO", () => {
    const fechamentos = obterFechamentosCompetencia();
    expect(fechamentos.length).toBeGreaterThanOrEqual(2);

    const ago = fechamentos.find((f) => f.competencia === "2026-08");
    expect(ago).toBeDefined();
    expect(ago?.status).toBe("CONGELADO");
    expect(ago?.hashIntegridadeSha256).toContain("sha256:");
    expect(ago?.homologacaoPetrobras?.homologado).toBe(true);

    const set = fechamentos.find((f) => f.competencia === "2026-09");
    expect(set).toBeDefined();
    expect(set?.status).toBe("ABERTO");
  });

  it("deve verificar corretamente se uma data ou competência está congelada via isCompetenciaCongelada", () => {
    // Agosto/2026 está congelado
    expect(isCompetenciaCongelada("2026-08")).toBe(true);
    expect(isCompetenciaCongelada("2026-08-15")).toBe(true);
    expect(isCompetenciaCongelada("2026-08-31")).toBe(true);

    // Setembro/2026 está aberto
    expect(isCompetenciaCongelada("2026-09")).toBe(false);
    expect(isCompetenciaCongelada("2026-09-01")).toBe(false);
    expect(isCompetenciaCongelada("2026-09-15")).toBe(false);

    // Mês inexistente deve ser considerado ABERTO por padrão
    expect(isCompetenciaCongelada("2026-10")).toBe(false);
    expect(isCompetenciaCongelada("")).toBe(false);
  });

  it("deve congelar a competência Setembro/2026 gerando snapshot imutável e hash SHA-256", () => {
    const fechamento = congelarCompetencia("2026-09", {
      usuario: "Marcos Valério (Gestor Premier)",
      resumoMetricas: {
        postos: 380,
        exigiveis: 5700,
        efetivas: 5520,
        glosas: 180,
        taxaSla: 96.8,
        valorContrato: 2850000.0,
        valorGlosa: 45000.0,
        faturamentoLiquido: 2805000.0,
      },
      observacoes: "Fechamento mensal consolidado com a fiscalização.",
    });

    expect(fechamento.status).toBe("CONGELADO");
    expect(fechamento.congeladoEm).toBeDefined();
    expect(fechamento.congeladoPor).toContain("Marcos Valério");
    expect(fechamento.hashIntegridadeSha256).toContain("sha256:");
    expect(fechamento.resumoMetricas.taxaSla).toBe(96.8);

    // Agora Setembro/2026 deve constar como congelado
    expect(isCompetenciaCongelada("2026-09")).toBe(true);
    expect(isCompetenciaCongelada("2026-09-10")).toBe(true);
    expect(obterStatusCompetencia("2026-09")).toBe("CONGELADO");

    // Auditoria deve ter registrado o evento
    const estado = carregarEstado();
    const log = estado.logsAuditoria.find((l) => l.acao === "CONGELAR_COMPETENCIA");
    expect(log).toBeDefined();
    expect(log?.detalhes).toContain("2026-09");
  });

  it("deve registrar a homologação formal da fiscalização Petrobras", () => {
    const fechamento = homologarMedicaoPetrobras(
      "2026-08",
      "Medição mensal atestada para emissão de NF e faturamento contratual.",
      "Carlos Eduardo Mendes (Fiscal Técnico Petrobras)"
    );

    expect(fechamento.homologacaoPetrobras).toBeDefined();
    expect(fechamento.homologacaoPetrobras?.homologado).toBe(true);
    expect(fechamento.homologacaoPetrobras?.fiscalNome).toContain("Carlos Eduardo Mendes");
    expect(fechamento.homologacaoPetrobras?.parecer).toContain("faturamento contratual");

    const estado = carregarEstado();
    const log = estado.logsAuditoria.find((l) => l.acao === "HOMOLOGAR_MEDICAO_PETROBRAS");
    expect(log).toBeDefined();
  });

  it("deve permitir a reabertura emergencial com justificativa formal registrada no histórico", () => {
    // 1. Congela Setembro/2026
    congelarCompetencia("2026-09", {
      usuario: "Marcos Valério",
    });
    expect(isCompetenciaCongelada("2026-09")).toBe(true);

    // 2. Reabre com justificativa
    const justificativa = "Ajuste emergencial de atestado médico extemporâneo apresentado pelo colaborador.";
    const reaberto = reabrirCompetencia("2026-09", justificativa, "Diretor Premier");

    expect(reaberto.status).toBe("ABERTO");
    expect(isCompetenciaCongelada("2026-09")).toBe(false);
    expect(reaberto.historicoReaberturas).toBeDefined();
    expect(reaberto.historicoReaberturas?.length).toBe(1);
    expect(reaberto.historicoReaberturas?.[0].justificativa).toBe(justificativa);
    expect(reaberto.historicoReaberturas?.[0].usuario).toBe("Diretor Premier");

    const estado = carregarEstado();
    const log = estado.logsAuditoria.find((l) => l.acao === "REABRIR_COMPETENCIA");
    expect(log).toBeDefined();
    expect(log?.detalhes).toContain(justificativa);
  });

  it("deve rejeitar reabertura com justificativa vazia ou menor que 10 caracteres", () => {
    expect(() => reabrirCompetencia("2026-08", "")).toThrowError("no mínimo 10 caracteres");
    expect(() => reabrirCompetencia("2026-08", "curto")).toThrowError("no mínimo 10 caracteres");
  });
});
