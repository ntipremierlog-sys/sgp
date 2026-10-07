/**
 * Testes de regressão das correções dos módulos Mapa de Ocupação, Coberturas e Ocorrências:
 * - LGPD fail-closed (perfil nulo/desconhecido não vê dados pessoais)
 * - Coberturas excluídas não "ressuscitam" ao recarregar o estado
 * - Cobertura vale somente para a posição (sem match frouxo por endsWith)
 * - Auditoria com usuário da sessão real e sem IP falso
 * - Bloqueio de competência congelada em todas as mutações
 * - Checagem de conflitos de cobertura e de ausências sobrepostas
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  carregarEstado,
  adicionarCobertura,
  excluirCobertura,
  adicionarOcorrencia,
  cancelarOcorrencia,
  registrarLog,
  definirSessaoAtiva,
  isCoberturaAtivaParaPosicao,
  verificarConflitosCobertura,
  verificarConflitosOcorrencia,
  obterCompetenciaCongeladaNoPeriodo,
  registrarCoberturaComValidacao,
  COBERTURAS_INICIAIS,
  CoberturaOperacional,
} from "@/lib/dados/estado-operacional";
import {
  podeVerDadosPessoaisCompletos,
  formatarCpfPorPerfil,
  formatarSalarioPorPerfil,
} from "@/lib/dados/rm-tipos";

const baseCobertura = (extra: Partial<CoberturaOperacional> = {}): CoberturaOperacional =>
  ({
    id: "cob-teste",
    postoCodigo: "PST-UFN-021",
    funcaoPosto: "Técnico Teste",
    substitutoMatricula: "070001",
    substitutoNome: "Substituto Teste",
    dataInicio: "2026-09-10",
    dataFim: "2026-09-12",
    tipoCobertura: "SUBSTITUICAO_INTERNA",
    status: "CONFIRMADA",
    justificativa: "Teste",
    criadoEm: "2026-09-01 10:00",
    ...extra,
  }) as CoberturaOperacional;

describe("Correções — Mapa de Ocupação, Coberturas e Ocorrências", () => {
  afterEach(() => {
    definirSessaoAtiva(null);
    vi.unstubAllGlobals();
  });

  describe("LGPD fail-closed", () => {
    it("perfil nulo, vazio ou desconhecido não vê CPF completo nem salário", () => {
      for (const perfil of [null, undefined, "", "DESCONHECIDO", "PETROBRAS_FISCAL"]) {
        expect(podeVerDadosPessoaisCompletos(perfil as string | null)).toBe(false);
        expect(formatarCpfPorPerfil("12345678901", perfil as string | null)).toContain("***");
        expect(formatarSalarioPorPerfil(5000, perfil as string | null)).not.toContain("5.000");
      }
    });

    it("perfis Premier veem dados pessoais completos", () => {
      expect(podeVerDadosPessoaisCompletos("PREMIER_ADMIN")).toBe(true);
      expect(podeVerDadosPessoaisCompletos("PREMIER_GESTOR")).toBe(true);
      expect(formatarCpfPorPerfil("12345678901", "PREMIER_ADMIN")).not.toContain("***");
    });
  });

  describe("Cobertura vale somente para a posição", () => {
    const posto = { codigoPosto: "PST-UFN-021", idReferencia: 21 };

    it("cobertura com vagaId marca apenas a posição indicada", () => {
      const c = baseCobertura({ vagaId: "VAGA-021-2" });
      expect(isCoberturaAtivaParaPosicao(c, "2026-09-11", posto, { id: "VAGA-021-2", sequencia: 2 })).toBe(true);
      expect(isCoberturaAtivaParaPosicao(c, "2026-09-11", posto, { id: "VAGA-021-1", sequencia: 1 })).toBe(false);
      expect(isCoberturaAtivaParaPosicao(c, "2026-09-13", posto, { id: "VAGA-021-2", sequencia: 2 })).toBe(false);
    });

    it("identificador numérico curto não casa por sufixo com outro posto (\"1\" x \"-021\")", () => {
      const c = baseCobertura({ postoCodigo: "1" });
      expect(isCoberturaAtivaParaPosicao(c, "2026-09-11", posto, { id: "VAGA-021-1", sequencia: 1 })).toBe(false);
    });

    it("cobertura sem posição mas com titular vale só para a posição desse titular", () => {
      const c = baseCobertura({ titularMatricula: "000123" });
      expect(isCoberturaAtivaParaPosicao(c, "2026-09-11", posto, { id: "V1", sequencia: 1 }, "000123")).toBe(true);
      expect(isCoberturaAtivaParaPosicao(c, "2026-09-11", posto, { id: "V2", sequencia: 2 }, "000999")).toBe(false);
    });
  });

  describe("Auditoria com usuário real", () => {
    it("usa o usuário da sessão e não grava IP falso", () => {
      definirSessaoAtiva({ nome: "Usuária Sessão Teste", perfil: "PREMIER_GESTOR" });
      const log = registrarLog("TESTE_ACAO", "Entidade", "Detalhe");
      expect(log.usuario).toBe("Usuária Sessão Teste");
      expect(log.perfil).toBe("PREMIER_GESTOR");
      expect(log.ip).toBe("Não capturado (cliente)");
    });

    it("sem sessão registra usuário não identificado (nunca um usuário fixo)", () => {
      const log = registrarLog("TESTE_ACAO", "Entidade", "Detalhe");
      expect(log.usuario).toBe("Usuário não identificado");
      expect(log.usuario).not.toContain("Marcos");
    });
  });

  describe("Bloqueio de competência congelada", () => {
    it("detecta competência congelada em qualquer mês do período", () => {
      expect(obterCompetenciaCongeladaNoPeriodo("2026-08-30", "2026-09-02")).toBe("2026-08");
      expect(obterCompetenciaCongeladaNoPeriodo("2026-09-01", "2026-09-30")).toBeNull();
    });

    it("impede criar cobertura e ausência em mês congelado", () => {
      expect(() =>
        adicionarCobertura({ ...baseCobertura(), dataInicio: "2026-08-10", dataFim: "2026-08-11" })
      ).toThrow(/CONGELADA/);
      expect(() =>
        adicionarOcorrencia({
          matricula: "070002",
          profissionalNome: "Teste",
          dataInicio: "2026-08-10",
          dataFim: "2026-08-10",
          diasAfetados: 1,
          tipoOcorrencia: "FALTA_JUSTIFICADA",
          status: "VALIDADA",
          observacaoPublica: "Teste",
        })
      ).toThrow(/CONGELADA/);
    });

    it("registro pelo Mapa retorna erro (sem lançar) para mês congelado", () => {
      const res = registrarCoberturaComValidacao({
        postoIdSGP: "PST-TESTE-CONG",
        posicaoId: "VAGA-TESTE-CONG-1",
        substitutoMatricula: "070003",
        substitutoNome: "Teste",
        dataInicio: "2026-08-05",
        dataFim: "2026-08-06",
        motivo: "Teste",
        justificativaNaoVinculado: "Justificativa operacional de teste",
      });
      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/CONGELADA/);
    });
  });

  describe("Conflitos", () => {
    it("bloqueia segunda cobertura na mesma posição e alerta substituto em dois postos", () => {
      const criada = adicionarCobertura({
        ...baseCobertura(),
        postoCodigo: "PST-CONF-001",
        vagaId: "VAGA-CONF-001-1",
        substitutoMatricula: "070010",
        dataInicio: "2026-09-20",
        dataFim: "2026-09-22",
      });

      const mesmaPosicao = verificarConflitosCobertura({
        postoCodigo: "PST-CONF-001",
        vagaId: "VAGA-CONF-001-1",
        substitutoMatricula: "070011",
        dataInicio: "2026-09-21",
        dataFim: "2026-09-21",
      });
      expect(mesmaPosicao.bloqueios.length).toBe(1);

      const outroPosto = verificarConflitosCobertura({
        postoCodigo: "PST-CONF-002",
        vagaId: "VAGA-CONF-002-1",
        substitutoMatricula: "070010",
        dataInicio: "2026-09-22",
        dataFim: "2026-09-23",
      });
      expect(outroPosto.bloqueios.length).toBe(0);
      expect(outroPosto.alertas.length).toBe(1);

      // Ignora a própria cobertura na edição
      const edicao = verificarConflitosCobertura(
        {
          postoCodigo: "PST-CONF-001",
          vagaId: "VAGA-CONF-001-1",
          substitutoMatricula: "070010",
          dataInicio: "2026-09-20",
          dataFim: "2026-09-22",
        },
        criada.id
      );
      expect(edicao.bloqueios.length).toBe(0);
    });

    it("detecta ausências sobrepostas do mesmo profissional", () => {
      const oco = adicionarOcorrencia({
        matricula: "070020",
        profissionalNome: "Teste Sobreposição",
        dataInicio: "2026-09-14",
        dataFim: "2026-09-16",
        diasAfetados: 3,
        tipoOcorrencia: "FERIAS",
        status: "VALIDADA",
        observacaoPublica: "Teste",
      });
      expect(verificarConflitosOcorrencia({ matricula: "070020", dataInicio: "2026-09-16", dataFim: "2026-09-18" }).length).toBe(1);
      expect(verificarConflitosOcorrencia({ matricula: "070020", dataInicio: "2026-09-17", dataFim: "2026-09-18" }).length).toBe(0);
      expect(verificarConflitosOcorrencia({ matricula: "070020", dataInicio: "2026-09-14", dataFim: "2026-09-16" }, oco.id).length).toBe(0);
      expect(cancelarOcorrencia(oco.id)).toBe(true);
    });
  });

  describe("Coberturas excluídas não ressuscitam", () => {
    it("cobertura inicial excluída não é reinjetada ao recarregar o estado do navegador", () => {
      const alvo = COBERTURAS_INICIAIS.find((c) => !obterCompetenciaCongeladaNoPeriodo(c.dataInicio, c.dataFim));
      if (!alvo) return; // sem seed elegível (todas em mês congelado)

      const armazenamento = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => armazenamento.get(k) ?? null,
        setItem: (k: string, v: string) => void armazenamento.set(k, v),
        removeItem: (k: string) => void armazenamento.delete(k),
      });
      vi.stubGlobal("window", { dispatchEvent: () => true, alert: () => undefined });

      // Garante que a cobertura está presente antes da exclusão
      const antes = carregarEstado();
      if (!antes.coberturas.some((c) => c.id === alvo.id)) {
        antes.coberturas.push(alvo);
      }

      expect(excluirCobertura(alvo.id)).toBe(true);
      const recarregado = carregarEstado();
      expect(recarregado.coberturas.some((c) => c.id === alvo.id)).toBe(false);
      expect(recarregado.coberturasExcluidasIds).toContain(alvo.id);

      const log = recarregado.logsAuditoria.find((l) => l.acao === "EXCLUIR_COBERTURA" && l.registroId === alvo.id);
      expect(log?.valorAnterior).toContain(alvo.id);
    });
  });
});
