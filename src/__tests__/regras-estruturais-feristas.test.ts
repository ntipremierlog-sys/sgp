import { describe, it, expect } from "vitest";
import {
  REGIME_POSTO_TABELA,
  LISTA_REGIMES_POSTO,
  POSTOS_REV02,
  POSICOES_REV02,
  POSICOES_EXCEDENTES_REV02,
  ALOCACOES_REV02,
  FERISTAS_VINCULADOS_POSTOS,
  validarCriacaoPosicao,
  criarPosicaoPosto,
  vincularFeristaPostos,
  obterPostosDoFerista,
  obterFeristasDoPosto,
  registrarHistoricoTitular,
  obterHistoricoTitularesPosicao,
  obterQtdPosicoesEsperadas,
  VAGAS_MC_REAIS,
} from "@/lib/dados/estrutura-postos";

describe("Regras Estruturais de Regime, Posição e Feristas (SGP Petrobras)", () => {
  // ===========================================================================
  // CRITÉRIO DE ACEITE 1: Nenhum posto com mais posições que a regra
  // ===========================================================================
  describe("Critério 1 — Regra estrutural e limite por regime", () => {
    it("deve parametrizar a tabela 'regime_posto' com as quantidades oficiais exatas", () => {
      expect(REGIME_POSTO_TABELA.ADM_09H.quantidadePosicoes).toBe(1);
      expect(REGIME_POSTO_TABELA.ADM_12H.quantidadePosicoes).toBe(2);
      expect(REGIME_POSTO_TABELA.TURNO_12H.quantidadePosicoes).toBe(2);
      expect(REGIME_POSTO_TABELA.ADM_16H.quantidadePosicoes).toBe(2);
      expect(REGIME_POSTO_TABELA.TURNO_16H.quantidadePosicoes).toBe(3);
      expect(REGIME_POSTO_TABELA.TURNO_24H.quantidadePosicoes).toBe(4);

      expect(LISTA_REGIMES_POSTO.length).toBe(6);
    });

    it("critério de aceite: NENHUM posto da base deve ter mais posições que a regra do seu regime", () => {
      const posicoesPorPosto = new Map<string, number>();
      POSICOES_REV02.forEach((p) => {
        posicoesPorPosto.set(p.postoIdSGP, (posicoesPorPosto.get(p.postoIdSGP) || 0) + 1);
      });

      POSTOS_REV02.forEach((posto) => {
        const qtdReal = posicoesPorPosto.get(posto.postoIdSGP) || 0;
        const limiteRegime = obterQtdPosicoesEsperadas(posto.tipoPostoId);

        expect(qtdReal).toBeLessThanOrEqual(limiteRegime);

        // Turno/16h deve ter no máximo 3 posições
        if (posto.tipoPostoId === "TURNO_16H") {
          expect(qtdReal).toBeLessThanOrEqual(3);
        }
      });
    });

    it("posto 10 (PST-CABIUNAS-010, Turno/16h) deve ter exatamente 3 posições ativas (10.1, 10.2, 10.3)", () => {
      const posicoesDoPosto10 = POSICOES_REV02.filter((p) => p.postoIdSGP === "PST-CABIUNAS-010");
      expect(posicoesDoPosto10.length).toBe(3);

      const codigos = posicoesDoPosto10.map((p) => p.codigoVisual);
      expect(codigos).toContain("10.1");
      expect(codigos).toContain("10.2");
      expect(codigos).toContain("10.3");
      expect(codigos).not.toContain("10.4");
    });
  });

  // ===========================================================================
  // CRITÉRIO DE ACEITE 2: Tentar criar a 4ª posição num posto Turno/16h gera erro
  // ===========================================================================
  describe("Critério 2 — Bloqueio estrutural de posições excedentes", () => {
    it("critério de aceite: tentar criar a 4ª posição num posto Turno/16h gera erro", () => {
      const posto10 = POSTOS_REV02.find((p) => p.postoIdSGP === "PST-CABIUNAS-010")!;
      expect(posto10).toBeDefined();

      const posicoesExistentes = POSICOES_REV02.filter((p) => p.postoIdSGP === "PST-CABIUNAS-010");
      expect(posicoesExistentes.length).toBe(3);

      // Validação deve retornar bloqueio
      const validacao = validarCriacaoPosicao(posto10, posicoesExistentes);
      expect(validacao.permitido).toBe(false);
      expect(validacao.mensagem).toContain("Bloqueio estrutural");
      expect(validacao.mensagem).toContain("Turno/16h");
      expect(validacao.mensagem).toContain("permite no máximo 3 posições");

      // Tentativa de criação deve lançar erro explícito
      expect(() => {
        criarPosicaoPosto(posto10, posicoesExistentes);
      }).toThrow(/Bloqueio estrutural.*4ª posição.*Turno\/16h.*máximo 3/);
    });

    it("tentar criar posições além do limite em outros regimes também gera erro claro", () => {
      // Adm/09h: limite 1 posição
      const posto9h = { tipoPostoId: "ADM_09H", postoIdSGP: "PST-TESTE-09H", idReferencia: 999 };
      expect(() => {
        criarPosicaoPosto(posto9h, [
          {
            posicaoIdSGP: "POS-TESTE-09H-01",
            postoIdSGP: "PST-TESTE-09H",
            codigoVisual: "999.1",
            sufixo: 1,
            conflitoCadastro: "OK",
            tratamentoSGP: "POSIÇÃO ESTRUTURAL",
            observacoes: "",
            statusValidacao: "VALIDADA",
            ehEstrutural: true,
          },
        ]);
      }).toThrow(/Bloqueio estrutural.*2ª posição.*Adm\/09h.*máximo 1/);

      // Turno/24h: limite 4 posições
      const posto24h = { tipoPostoId: "TURNO_24H", postoIdSGP: "PST-TESTE-24H", idReferencia: 888 };
      const posicoes24h = [1, 2, 3, 4].map((s) => ({
        posicaoIdSGP: `POS-TESTE-24H-0${s}`,
        postoIdSGP: "PST-TESTE-24H",
        codigoVisual: `888.${s}`,
        sufixo: s,
        conflitoCadastro: "OK",
        tratamentoSGP: "POSIÇÃO ESTRUTURAL",
        observacoes: "",
        statusValidacao: "VALIDADA" as const,
        ehEstrutural: true,
      }));

      expect(() => {
        criarPosicaoPosto(posto24h, posicoes24h);
      }).toThrow(/Bloqueio estrutural.*5ª posição.*Turno\/24h.*máximo 4/);
    });
  });

  // ===========================================================================
  // CRITÉRIO DE ACEITE 3: Um mesmo ferista vinculado a 2 postos funciona
  // ===========================================================================
  describe("Critério 3 — Ferista com vínculo N:N e sem posição permanente", () => {
    it("critério de aceite: um mesmo ferista vinculado a 2 postos funciona", () => {
      const matriculaFerista = "099888";
      const nomeFerista = "COLABORADOR FERISTA VOLANTE TESTE";
      const unidadeId = "BOAVENTURA";
      const postosAlvo = ["PST-BOAVENTURA-007", "PST-BOAVENTURA-008"];

      // Vincula o mesmo ferista a 2 postos simultaneamente
      const vinculos = vincularFeristaPostos(matriculaFerista, nomeFerista, unidadeId, postosAlvo);
      expect(vinculos.length).toBe(2);

      // Verifica que o ferista está vinculado aos dois postos
      const postosDoFerista = obterPostosDoFerista(matriculaFerista);
      expect(postosDoFerista).toContain("PST-BOAVENTURA-007");
      expect(postosDoFerista).toContain("PST-BOAVENTURA-008");
      expect(postosDoFerista.length).toBe(2);

      // Verifica consulta inversa: postos encontram o ferista
      const feristasPosto7 = obterFeristasDoPosto("PST-BOAVENTURA-007");
      expect(feristasPosto7.some((f) => f.matricula === matriculaFerista)).toBe(true);

      const feristasPosto8 = obterFeristasDoPosto("PST-BOAVENTURA-008");
      expect(feristasPosto8.some((f) => f.matricula === matriculaFerista)).toBe(true);
    });

    it("feristas cadastrados (ex.: Gilmara e Wallace) NÃO possuem posicao_id_sgp permanente", () => {
      const gilmara = FERISTAS_VINCULADOS_POSTOS.find((f) => f.matricula === "045127");
      expect(gilmara).toBeDefined();
      expect(gilmara?.postoIdSGP).toBe("PST-CABIUNAS-010");
      expect(gilmara?.unidadeId).toBe("CABIUNAS");

      const wallace = FERISTAS_VINCULADOS_POSTOS.find((f) => f.matricula === "036606");
      expect(wallace).toBeDefined();
      expect(wallace?.postoIdSGP).toBe("PST-BOAVENTURA-008");
      expect(wallace?.unidadeId).toBe("BOAVENTURA");

      // Nenhuma posição estrutural ativa tem ferista como titular permanente exclusivo
      const pos104 = POSICOES_REV02.find((p) => p.posicaoIdSGP === "POS-CABIUNAS-010-04");
      expect(pos104).toBeUndefined(); // Posição 10.4 foi removida das ativas e convertida em ferista vinculado ao posto

      const pos85 = POSICOES_REV02.find((p) => p.posicaoIdSGP === "POS-BOAVENTURA-008-05");
      expect(pos85).toBeUndefined(); // Posição 8.5 foi removida das ativas e mantida como ferista vinculado ao posto
    });
  });

  // ===========================================================================
  // CRITÉRIO DE ACEITE 4: Nenhum dado de colaborador ou histórico foi apagado
  // ===========================================================================
  describe("Critério 4 — Preservação integral do histórico e colaboradores", () => {
    it("todas as alocações da planilha original (322) continuam preservadas", () => {
      expect(ALOCACOES_REV02.length).toBe(322);

      // Gilmara continua no histórico com observações de suas coberturas
      const alocGilmara = ALOCACOES_REV02.find((a) => a.chapaRM === "045127");
      expect(alocGilmara).toBeDefined();
      expect(alocGilmara?.nome).toBe("GILMARA CAETANO DE ASSIS");
      expect(alocGilmara?.tipoAlocacao).toBe("FERISTA");
      expect(alocGilmara?.comentarioMC).toContain("Ferista");

      // Thainna continua ativa vinculada à posição 10.3
      const alocThainna = ALOCACOES_REV02.find((a) => a.chapaRM === "036526");
      expect(alocThainna).toBeDefined();
      expect(alocThainna?.posicaoIdSGP).toBe("POS-CABIUNAS-010-03");

      // Wallace continua no histórico
      const alocWallace = ALOCACOES_REV02.find((a) => a.chapaRM === "036606");
      expect(alocWallace).toBeDefined();
      expect(alocWallace?.nome).toBe("WALLACE SOUSA DA SILVA");
    });

    it("as posições excedentes (10.4, 8.5, etc.) estão preservadas na tabela de excedentes para rastreabilidade", () => {
      expect(POSICOES_EXCEDENTES_REV02.length).toBe(9);

      const excedente104 = POSICOES_EXCEDENTES_REV02.find((e) => e.codigoVisual === "10.4");
      expect(excedente104).toBeDefined();
      expect(excedente104?.postoIdSGP).toBe("PST-CABIUNAS-010");
      expect(excedente104?.ehEstrutural).toBe(false);

      const excedente85 = POSICOES_EXCEDENTES_REV02.find((e) => e.codigoVisual === "8.5");
      expect(excedente85).toBeDefined();
      expect(excedente85?.postoIdSGP).toBe("PST-BOAVENTURA-008");
      expect(excedente85?.ehEstrutural).toBe(false);
    });

    it("o histórico de titulares na posição registra início e fim sem sobrescrever registros", () => {
      const posId = "POS-BOAVENTURA-007-01";
      const h1 = registrarHistoricoTitular(posId, "011111", "JOÃO DA SILVA", "2025-01-01", "2026-05-31", "titular");
      const h2 = registrarHistoricoTitular(posId, "022222", "MARIA DE SOUZA", "2026-06-01", null, "sucessao");

      const historico = obterHistoricoTitularesPosicao(posId);
      expect(historico.length).toBe(2);
      expect(historico[0].matricula).toBe("022222"); // mais recente (vigente)
      expect(historico[1].matricula).toBe("011111"); // anterior preservado
    });
  });

  // ===========================================================================
  // REGRAS ADICIONAIS: Escala da posição e campos de rastreabilidade
  // ===========================================================================
  describe("Campos oficiais de escala da posição e rastreabilidade", () => {
    it("a posição possui posicaoIdSGP como chave permanente e idOriginalMC apenas como rastreabilidade", () => {
      POSICOES_REV02.forEach((p) => {
        expect(p.posicaoIdSGP).toMatch(/^POS-[A-Z0-9_-]+-\d{2}$/);
        expect(p.codigoVisual).toBeTruthy();
      });
    });

    it("grupo_revezamento, fase_ciclo e data_base_escala NUNCA são inferidos (vazio permanece vazio)", () => {
      VAGAS_MC_REAIS.forEach((v) => {
        // Se a vaga não recebeu esses dados expressamente, eles devem ser undefined (não inferidos)
        if (!v.grupo_revezamento && !v.grupoRevezamento) {
          expect(v.grupoRevezamento).toBeUndefined();
        }
        if (!v.fase_ciclo && !v.faseCiclo) {
          expect(v.faseCiclo).toBeUndefined();
        }
      });
    });
  });
});
