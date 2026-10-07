import { describe, it, expect } from "vitest";
import {
  TIPOS_POSTO_CATALOGO,
  LISTA_TIPOS_POSTO,
  obterTipoPosto,
  identificarTipoPostoPorTexto,
  gerarVagasPosto,
  obterAlocacaoVigenteVaga,
  obterAlocacaoVigenteVaga1,
  validarSobreposicaoAlocacao,
  POSTOS_MC_REAIS,
  VAGAS_MC_REAIS,
  ALOCACOES_MC_REAIS,
  RELATORIO_INCONSISTENCIAS_MC,
  PostoOperacional,
  VagaPosto,
  AlocacaoVaga,
  obterTodosPostosContrato,
} from "@/lib/dados/estado-operacional";

describe("Modelo de Dados SGP — Contrato Petrobras SAP 4600682336 (Aba MC)", () => {
  // ===========================================================================
  // 1. TipoPosto (catálogo fixo)
  // ===========================================================================
  describe("1. TipoPosto (Catálogo Fixo)", () => {
    it("deve conter exatamente os 6 tipos de postos oficiais com suas respectivas vagas (divisores)", () => {
      expect(LISTA_TIPOS_POSTO.length).toBe(6);

      // Adm/09h: 1 vaga
      const adm09 = obterTipoPosto("ADM_09H");
      expect(adm09).toBeDefined();
      expect(adm09?.nome).toBe("Adm/09h");
      expect(adm09?.vagas).toBe(1);

      // Adm/12h: 2 vagas
      const adm12 = obterTipoPosto("ADM_12H");
      expect(adm12).toBeDefined();
      expect(adm12?.nome).toBe("Adm/12h");
      expect(adm12?.vagas).toBe(2);

      // Adm/16h: 2 vagas
      const adm16 = obterTipoPosto("ADM_16H");
      expect(adm16).toBeDefined();
      expect(adm16?.nome).toBe("Adm/16h");
      expect(adm16?.vagas).toBe(2);

      // Turno/12h: 2 vagas
      const turno12 = obterTipoPosto("TURNO_12H");
      expect(turno12).toBeDefined();
      expect(turno12?.nome).toBe("Turno/12h");
      expect(turno12?.vagas).toBe(2);

      // Turno/16h: 3 vagas conforme regra estrutural
      const turno16 = obterTipoPosto("TURNO_16H");
      expect(turno16).toBeDefined();
      expect(turno16?.nome).toBe("Turno/16h");
      expect(turno16?.vagas).toBe(3);

      // Turno/24h: 4 vagas
      const turno24 = obterTipoPosto("TURNO_24H");
      expect(turno24).toBeDefined();
      expect(turno24?.nome).toBe("Turno/24h");
      expect(turno24?.vagas).toBe(4);
    });

    it("deve permitir busca por nome ou identificador", () => {
      expect(obterTipoPosto("Adm/09h")?.id).toBe("ADM_09H");
      expect(obterTipoPosto("Turno/24h")?.vagas).toBe(4);
    });

    it("deve identificar o tipo a partir do texto do posto de serviço na MC", () => {
      const t1 = identificarTipoPostoPorTexto("SUPORTE À OPERAÇÃO DE MOBILIDADE - Turno/24h");
      expect(t1.id).toBe("TURNO_24H");
      expect(t1.vagas).toBe(4);

      const t2 = identificarTipoPostoPorTexto("APOIO EM ANÁLISE DE LOGÍSTICA - Adm/09h");
      expect(t2.id).toBe("ADM_09H");
      expect(t2.vagas).toBe(1);

      // Caso com texto sem prefixo mas divisor conhecido
      const t3 = identificarTipoPostoPorTexto("SERVIÇO DE APOIO EM ANÁSELISE DE ENGENHARIA", 1);
      expect(t3.id).toBe("ADM_09H");
      expect(t3.vagas).toBe(1);
    });
  });

  // ===========================================================================
  // 2. PostoOperacional
  // ===========================================================================
  describe("2. PostoOperacional", () => {
    it("deve conter idPosto, itemPPU, tipoPostoId, periculosidade, município, localAtuacao e gerência", () => {
      const posto: PostoOperacional = {
        id: "pst-7",
        idPosto: "7",
        codigoPosto: "PST-BOAVENTURA-007",
        funcao: "SUPORTE À OPERAÇÃO DE MOBILIDADE",
        itemPPU: "3.6",
        tipoPostoId: "TURNO_24H",
        periculosidade: "SIM",
        municipio: "Itaboraí",
        localAtuacao: "BOAVENTURA",
        gerenciaPetrobras: "COMPARTILHADO/GIO/OP-RJ/BOAVENTURA-GPC",
        unidadeId: "BOAVENTURA",
        unidadeNome: "BOAVENTURA",
        escala: "12x36",
        jornadaSemanalHoras: 36,
        horarioInicio: "07:00",
        horarioFim: "19:00",
        situacao: "ATIVO",
        dataInicioVigencia: "2024-01-01",
      };

      expect(posto.idPosto).toBe("7");
      expect(posto.itemPPU).toBe("3.6");
      expect(posto.tipoPostoId).toBe("TURNO_24H");
      expect(posto.periculosidade).toBe("SIM");
      expect(posto.municipio).toBe("Itaboraí");
      expect(posto.localAtuacao).toBe("BOAVENTURA");
      expect(posto.gerenciaPetrobras).toBe("COMPARTILHADO/GIO/OP-RJ/BOAVENTURA-GPC");
    });
  });

  // ===========================================================================
  // 3. VagaPosto
  // ===========================================================================
  describe("3. VagaPosto (Geração Automática)", () => {
    it("deve gerar 1 vaga usando apenas o idPosto para posto de 1 vaga (Adm/09h)", () => {
      const vagas = gerarVagasPosto("227", "ADM_09H");
      expect(vagas.length).toBe(1);
      expect(vagas[0].id).toBe("227");
      expect(vagas[0].idPosto).toBe("227");
      expect(vagas[0].sequencia).toBe(1);
    });

    it("deve gerar vagas com idPosto.sequencia para postos com mais de 1 vaga", () => {
      // Turno/24h -> 4 vagas (7.1, 7.2, 7.3, 7.4)
      const vagas = gerarVagasPosto("7", "TURNO_24H");
      expect(vagas.length).toBe(4);
      expect(vagas.map((v) => v.id)).toEqual(["7.1", "7.2", "7.3", "7.4"]);
      expect(vagas.map((v) => v.sequencia)).toEqual([1, 2, 3, 4]);
      expect(vagas.every((v) => v.idPosto === "7")).toBe(true);

      // Adm/12h -> 2 vagas (6.1, 6.2)
      const vagasAdm12 = gerarVagasPosto("6", "ADM_12H");
      expect(vagasAdm12.length).toBe(2);
      expect(vagasAdm12.map((v) => v.id)).toEqual(["6.1", "6.2"]);

      // Turno/16h -> 3 vagas (10.1, 10.2, 10.3)
      const vagasTurno16 = gerarVagasPosto("10", "TURNO_16H");
      expect(vagasTurno16.length).toBe(3);
      expect(vagasTurno16.map((v) => v.id)).toEqual(["10.1", "10.2", "10.3"]);
    });
  });

  // ===========================================================================
  // 4. AlocacaoVaga
  // ===========================================================================
  describe("4. AlocacaoVaga", () => {
    const alocacoesTeste: AlocacaoVaga[] = [
      {
        id: "alc-1",
        vagaId: "7.1",
        matricula: "036830",
        identificadorPetrobras: "72034968",
        nome: "CARLOS AUGUSTO",
        dataInicio: "2024-01-01",
        dataFim: "2026-08-31",
        horarioEscalaRm: "PETROBRAS - 07:00 AS 19:00 - SEG/DOM - ESCALA 12X36",
        dataBaseCiclo: "2026-08-10",
        motivo: "titular",
      },
      {
        id: "alc-2",
        vagaId: "7.1",
        matricula: "041642",
        identificadorPetrobras: "73005055",
        nome: "ANDRE LUIS",
        dataInicio: "2026-09-01",
        dataFim: null, // Vigente
        horarioEscalaRm: "PETROBRAS - 07:00 AS 19:00 - SEG/DOM - ESCALA 12X36",
        dataBaseCiclo: "2026-08-10",
        motivo: "sucessao",
      },
    ];

    it("deve permitir consultar a alocação vigente na vaga em determinada data", () => {
      // Em agosto de 2026: titular era CARLOS AUGUSTO
      const vigenteAgosto = obterAlocacaoVigenteVaga("7.1", alocacoesTeste, "2026-08-15");
      expect(vigenteAgosto).toBeDefined();
      expect(vigenteAgosto?.matricula).toBe("036830");
      expect(vigenteAgosto?.nome).toBe("CARLOS AUGUSTO");

      // Em setembro de 2026: titular sucessor é ANDRE LUIS
      const vigenteSetembro = obterAlocacaoVigenteVaga("7.1", alocacoesTeste, "2026-09-10");
      expect(vigenteSetembro).toBeDefined();
      expect(vigenteSetembro?.matricula).toBe("041642");
      expect(vigenteSetembro?.nome).toBe("ANDRE LUIS");
    });

    it("deve validar que só pode haver uma alocação vigente por vaga em cada data", () => {
      // Tentar alocar alguém em período sobreposto
      const validacaoConflito = validarSobreposicaoAlocacao(
        "7.1",
        "2026-08-10",
        "2026-08-20",
        alocacoesTeste
      );
      expect(validacaoConflito.valido).toBe(false);
      expect(validacaoConflito.conflito?.matricula).toBe("036830");

      // Período no passado livre
      const validacaoLivre = validarSobreposicaoAlocacao(
        "7.1",
        "2023-01-01",
        "2023-12-31",
        alocacoesTeste
      );
      expect(validacaoLivre.valido).toBe(true);
    });

    it("deve manter o histórico de alocações na mesma vaga quando houver substituto ou sucessor", () => {
      const historicoVaga = alocacoesTeste.filter((a) => a.vagaId === "7.1");
      expect(historicoVaga.length).toBe(2);
      expect(historicoVaga[0].motivo).toBe("titular");
      expect(historicoVaga[1].motivo).toBe("sucessao");
    });
  });

  // ===========================================================================
  // 5. Carga Inicial a partir da Aba MC & Inconsistências
  // ===========================================================================
  describe("5. Carga Inicial da Aba MC & Relatório de Inconsistências", () => {
    it("deve ter carregado os postos reais da Memória de Cálculo", () => {
      expect(POSTOS_MC_REAIS.length).toBe(244);
      expect(VAGAS_MC_REAIS.length).toBeGreaterThanOrEqual(244);
      expect(ALOCACOES_MC_REAIS.length).toBe(322);
    });

    it("deve reportar as 3 ocorrências de IDs duplicados na aba MC sem correção automática", () => {
      expect(RELATORIO_INCONSISTENCIAS_MC.idsDuplicados.length).toBe(3);
      const ids = RELATORIO_INCONSISTENCIAS_MC.idsDuplicados.map((d) => d.id);
      expect(ids).toContain("7.3");
      expect(ids).toContain("110");
      expect(ids).toContain("250.2");
    });

    it("deve reportar os 11 postos com mais pessoas do que vagas na aba MC", () => {
      expect(RELATORIO_INCONSISTENCIAS_MC.excessoPessoasPorPosto.length).toBe(11);
      const postosComExcesso = RELATORIO_INCONSISTENCIAS_MC.excessoPessoasPorPosto.map((p) => p.idPosto);
      expect(postosComExcesso).toContain("8");
      expect(postosComExcesso).toContain("10");
      expect(postosComExcesso).toContain("110");
      expect(postosComExcesso).toContain("177");
      expect(postosComExcesso).toContain("250");
    });

    it("deve garantir que postos foram importados sem valores, notas ou medição (apenas itemPPU contratual)", () => {
      // Nenhum posto deve ter campos de faturamento/preço/medição
      for (const p of POSTOS_MC_REAIS) {
        expect(p.itemPPU).toBeDefined();
        expect(typeof p.itemPPU).toBe("string");
        expect((p as any).valorUnitario).toBeUndefined();
        expect((p as any).valorTotal).toBeUndefined();
        expect((p as any).medicao).toBeUndefined();
        expect((p as any).nota).toBeUndefined();
      }
    });

    it("deve reportar o colaborador sem correspondência no RM (linha com '-')", () => {
      expect(RELATORIO_INCONSISTENCIAS_MC.colaboradoresSemRm.length).toBe(1);
      expect(RELATORIO_INCONSISTENCIAS_MC.colaboradoresSemRm[0].idNaMC).toBe("199.1");
    });
  });

  // ===========================================================================
  // 6. Compatibilidade Temporária (Item 6)
  // ===========================================================================
  describe("6. Compatibilidade Temporária para Mapa de Ocupação e Fechamento", () => {
    it("deve preencher titularMatricula e titularNome a partir da alocação vigente da Vaga 1", () => {
      const vagasMock: VagaPosto[] = [
        { id: "7.1", idPosto: "7", sequencia: 1 },
        { id: "7.2", idPosto: "7", sequencia: 2 },
      ];
      const alocacoesMock: AlocacaoVaga[] = [
        {
          id: "alc-v1",
          vagaId: "7.1",
          matricula: "041642",
          nome: "ANDRE LUIS GUIMARAES SENA",
          dataInicio: "2024-01-01",
          dataFim: null,
          motivo: "titular",
        },
      ];

      const aloc1 = obterAlocacaoVigenteVaga1("7", vagasMock, alocacoesMock);
      expect(aloc1).toBeDefined();
      expect(aloc1?.matricula).toBe("041642");
      expect(aloc1?.nome).toBe("ANDRE LUIS GUIMARAES SENA");
    });

    it("obterTodosPostosContrato deve enriquecer dinamicamente os postos com a Vaga 1", () => {
      const todos = obterTodosPostosContrato();
      expect(todos.length).toBeGreaterThanOrEqual(244);

      // Posto 1 na MC tem vaga 1 ocupada por Carlos Augusto
      const posto1 = todos.find((p) => p.idPosto === "1");
      expect(posto1).toBeDefined();
      expect(posto1?.titularNome).toBe("CARLOS AUGUSTO VIEIRA DA SILVA NETO");
      expect(posto1?.itemPPU).toBe("3.1");
      expect(posto1?.tipoPostoId).toBe("ADM_09H");
    });
  });
});
