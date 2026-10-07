import { describe, it, expect } from "vitest";
import {
  POSTOS_REV04,
  POSICOES_REV04,
  FERISTAS_REV04,
  ESCALAS_REV04,
  PENDENCIAS_ESCALA_REV04,
  RELATORIO_IMPORTACAO_REV04,
  obterFeristasConsolidados,
  obterPostosDoFerista,
  obterFeristasDoPosto,
} from "@/lib/dados/estrutura-postos";
import {
  processarPlanilhaREV04,
  obterDadosBaseREV04,
} from "@/lib/importadores/base-estruturada-rev02";

describe("Importação da Base Estruturada SGP Petrobras REV04", () => {
  // ===========================================================================
  // CRITÉRIO DE ACEITE 1: TOTAIS ESPERADOS
  // 244 postos | 311 posições | 23 registros de ferista | 311 escalas | 101 pendências de escala
  // ===========================================================================
  describe("Critério de Aceite 1: Totais esperados da base REV04", () => {
    it("deve conter exatamente 244 postos na base oficial", () => {
      expect(POSTOS_REV04.length).toBe(244);
    });

    it("deve conter exatamente 311 posições estruturais ativas", () => {
      expect(POSICOES_REV04.length).toBe(311);
    });

    it("deve conter exatamente 23 registros de ferista na aba 07_FERISTAS_COBERTURA", () => {
      expect(FERISTAS_REV04.length).toBe(23);
    });

    it("deve conter exatamente 311 escalas de posição na aba 08_ESCALAS_POSICOES", () => {
      expect(ESCALAS_REV04.length).toBe(311);
    });

    it("deve conter exatamente 101 pendências de escala na aba 09_PENDENCIAS_ESCALA", () => {
      expect(PENDENCIAS_ESCALA_REV04.length).toBe(101);
    });

    it("obterDadosBaseREV04() deve reportar os totais oficiais sincronizados", () => {
      const dados = obterDadosBaseREV04();
      expect(dados.totalPostos).toBe(244);
      expect(dados.totalPosicoes).toBe(311);
      expect(dados.totalFeristas).toBe(23);
      expect(dados.totalEscalas).toBe(311);
      expect(dados.totalPendenciasEscala).toBe(101);
    });
  });

  // ===========================================================================
  // CRITÉRIO DE ACEITE 2: CABIÚNAS POSTO 10
  // Cabiúnas Posto 10 = 10.1, 10.2, 10.3, com Gilmara como ferista (sem 10.4)
  // ===========================================================================
  describe("Critério de Aceite 2: Cabiúnas Posto 10", () => {
    it("Cabiúnas Posto 10 deve ter exatamente 3 posições: 10.1, 10.2, 10.3", () => {
      const posPosto10 = POSICOES_REV04.filter((p) => p.postoIdSGP === "PST-CABIUNAS-010");
      expect(posPosto10.length).toBe(3);

      const codigos = posPosto10.map((p) => p.codigoVisual);
      expect(codigos).toContain("10.1");
      expect(codigos).toContain("10.2");
      expect(codigos).toContain("10.3");
      expect(codigos).not.toContain("10.4");

      // Titulares de cada posição
      const pos101 = posPosto10.find((p) => p.codigoVisual === "10.1");
      const pos102 = posPosto10.find((p) => p.codigoVisual === "10.2");
      const pos103 = posPosto10.find((p) => p.codigoVisual === "10.3");

      expect(pos101?.titularReferencia).toBe("CRISTIANE DA SILVA ESPERIDIAO");
      expect(pos102?.titularReferencia).toBe("FLAVIA NIELE SOUZA DOS SANTOS");
      expect(pos103?.titularReferencia).toBe("THAINNA DE ALMEIDA VANDELLI");
    });

    it("Gilmara Caetano de Assis deve estar vinculada como ferista ao Posto 10 de Cabiúnas", () => {
      const feristaPosto10 = FERISTAS_REV04.find((f) => f.postoIdSGP === "PST-CABIUNAS-010");
      expect(feristaPosto10).toBeDefined();
      expect(feristaPosto10?.colaborador).toBe("GILMARA CAETANO DE ASSIS");
      expect(feristaPosto10?.chapaRM).toBe("045127");
      expect(feristaPosto10?.papel).toContain("FERISTA");

      const feristasVinculados = obterFeristasDoPosto("PST-CABIUNAS-010");
      expect(feristasVinculados.some((f) => f.nome.includes("GILMARA"))).toBe(true);
    });
  });

  // ===========================================================================
  // CRITÉRIO DE ACEITE 3: BOAVENTURA POSTOS 7 E 8
  // Boaventura Posto 7 = 7.1 a 7.4; Posto 8 = 8.1 a 8.4, com Lucas Vasconcellos como ferista
  // ===========================================================================
  describe("Critério de Aceite 3: Boaventura Postos 7 e 8", () => {
    it("Boaventura Posto 7 deve ter exatamente 4 posições: 7.1 a 7.4", () => {
      const posPosto7 = POSICOES_REV04.filter((p) => p.postoIdSGP === "PST-BOAVENTURA-007");
      expect(posPosto7.length).toBe(4);

      const codigos = posPosto7.map((p) => p.codigoVisual).sort();
      expect(codigos).toEqual(["7.1", "7.2", "7.3", "7.4"]);

      // 7.3 saneado e validado
      const pos73 = posPosto7.find((p) => p.codigoVisual === "7.3");
      expect(pos73?.titularReferencia).toBe("JORGE RENATO PATROCINIO DOS SANTOS");
      expect(pos73?.statusValidacao).toBe("VALIDADA");
    });

    it("Boaventura Posto 8 deve ter exatamente 4 posições: 8.1 a 8.4 (sem 8.5)", () => {
      const posPosto8 = POSICOES_REV04.filter((p) => p.postoIdSGP === "PST-BOAVENTURA-008");
      expect(posPosto8.length).toBe(4);

      const codigos = posPosto8.map((p) => p.codigoVisual).sort();
      expect(codigos).toEqual(["8.1", "8.2", "8.3", "8.4"]);
      expect(codigos).not.toContain("8.5");

      // Wallace Sousa da Silva é titular da posição 8.4
      const pos84 = posPosto8.find((p) => p.codigoVisual === "8.4");
      expect(pos84?.titularReferencia).toBe("WALLACE SOUSA DA SILVA");
      expect(pos84?.chapaTitular).toBe("036606");
    });

    it("Lucas Vasconcellos dos Santos deve ser o ferista vinculado ao Posto 8 de Boaventura", () => {
      const feristaPosto8 = FERISTAS_REV04.find(
        (f) => f.postoIdSGP === "PST-BOAVENTURA-008" && f.colaborador.includes("LUCAS VASCONCELLOS")
      );
      expect(feristaPosto8).toBeDefined();
      expect(feristaPosto8?.feristaIdSGP).toBe("FER-001");
      expect(feristaPosto8?.colaborador).toBe("LUCAS VASCONCELLOS DOS SANTOS");
      expect(feristaPosto8?.chapaRM).toBe("045858");

      const feristasVinculados = obterFeristasDoPosto("PST-BOAVENTURA-008");
      expect(feristasVinculados.some((f) => f.nome.includes("LUCAS VASCONCELLOS"))).toBe(true);
    });
  });

  // ===========================================================================
  // CRITÉRIO DE ACEITE 4: REIMPORTAR NÃO DUPLICA (IDEMPOTÊNCIA)
  // ===========================================================================
  describe("Critério de Aceite 4: Idempotência da importação", () => {
    it("processarPlanilhaREV04() executada duas vezes mantém exatamente os mesmos totais", () => {
      // Primeira execução
      const carga1 = processarPlanilhaREV04();
      expect(carga1.totalPostos).toBe(244);
      expect(carga1.totalPosicoes).toBe(311);
      expect(carga1.totalFeristas).toBe(23);
      expect(carga1.totalEscalas).toBe(311);
      expect(carga1.totalPendenciasEscala).toBe(101);

      // Segunda execução (reimportação)
      const carga2 = processarPlanilhaREV04();
      expect(carga2.totalPostos).toBe(244);
      expect(carga2.totalPosicoes).toBe(311);
      expect(carga2.totalFeristas).toBe(23);
      expect(carga2.totalEscalas).toBe(311);
      expect(carga2.totalPendenciasEscala).toBe(101);

      // Não duplica chaves primárias
      const postosIds1 = new Set(carga1.postos.map((p) => p.postoIdSGP));
      const postosIds2 = new Set(carga2.postos.map((p) => p.postoIdSGP));
      expect(postosIds1.size).toBe(244);
      expect(postosIds2.size).toBe(244);

      const posIds1 = new Set(carga1.posicoes.map((p) => p.posicaoIdSGP));
      const posIds2 = new Set(carga2.posicoes.map((p) => p.posicaoIdSGP));
      expect(posIds1.size).toBe(311);
      expect(posIds2.size).toBe(311);
    });
  });

  // ===========================================================================
  // REGRAS OBRIGATÓRIAS E REJEIÇÃO DE LINHAS
  // ===========================================================================
  describe("Regras obrigatórias de origem das posições e descarte de notas", () => {
    it("posições vêm SOMENTE da aba 03_POSICOES e NUNCA a partir de sufixos de MC (10.4, 8.5)", () => {
      // Nenhuma posição 10.4 ou 8.5 foi criada
      expect(POSICOES_REV04.some((p) => p.posicaoIdSGP === "POS-CABIUNAS-010-04")).toBe(false);
      expect(POSICOES_REV04.some((p) => p.posicaoIdSGP === "POS-BOAVENTURA-008-05")).toBe(false);
      expect(POSICOES_REV04.some((p) => p.codigoVisual === "10.4")).toBe(false);
      expect(POSICOES_REV04.some((p) => p.codigoVisual === "8.5")).toBe(false);
    });

    it("deve rejeitar e registrar as 8 linhas de anotação de regra descritiva em 03_POSICOES", () => {
      const carga = processarPlanilhaREV04();
      expect(carga.totalLinhasRejeitadasPosicoes).toBe(8);
      expect(carga.linhasRejeitadas.length).toBe(8);

      carga.linhasRejeitadas.forEach((rej) => {
        expect(rej.motivo).toContain("Linha sem Posicao_ID_SGP válido");
      });
    });

    it("campos vazios de escala permanecem vazios (sem inferência)", () => {
      const semTit = ESCALAS_REV04.filter((e) => !e.chapaTitular);
      expect(semTit.length).toBe(24);

      // Não foi preenchido grupo, fase ou data-base fictícios
      semTit.forEach((e) => {
        expect(e.horarioRMInformado).toBeUndefined();
        expect(e.escalaTipoInformada).toBeUndefined();
      });
    });

    it("mesmo ferista em 2 postos gera 1 ferista com 2 vínculos consolidados", () => {
      const feristasConsolidados = obterFeristasConsolidados();
      expect(feristasConsolidados.length).toBe(20); // 20 colaboradores únicos para 23 vínculos

      // Marcio Marques: REFAP 204 e 205
      const marcio = feristasConsolidados.find((f) => f.colaborador.includes("MARCIO MARQUES"));
      expect(marcio).toBeDefined();
      expect(marcio?.postosIdsSGP.length).toBe(2);
      expect(marcio?.postosIdsSGP).toContain("PST-REFAP-204");
      expect(marcio?.postosIdsSGP).toContain("PST-REFAP-205");

      // Jefferson Melo: RNEST 226 e 229
      const jefferson = feristasConsolidados.find((f) => f.colaborador.includes("JEFFERSON MELO"));
      expect(jefferson).toBeDefined();
      expect(jefferson?.postosIdsSGP.length).toBe(2);
      expect(jefferson?.postosIdsSGP).toContain("PST-RNEST-226");
      expect(jefferson?.postosIdsSGP).toContain("PST-RNEST-229");

      // Jose Artur: RPBC 245 e 251
      const joseArtur = feristasConsolidados.find((f) => f.colaborador.includes("JOSE ARTUR"));
      expect(joseArtur).toBeDefined();
      expect(joseArtur?.postosIdsSGP.length).toBe(2);
      expect(joseArtur?.postosIdsSGP).toContain("PST-RPBC-245");
      expect(joseArtur?.postosIdsSGP).toContain("PST-RPBC-251");
    });
  });

  // ===========================================================================
  // VALIDAÇÕES AUTOMÁTICAS QUE GERAM PENDÊNCIA SEM BLOQUEAR A CARGA
  // ===========================================================================
  describe("Validações automáticas sem bloqueio de carga", () => {
    it("1. Titular com horário SEG/SEX em posto Turno: detecta exatamente 3 casos", () => {
      const res = processarPlanilhaREV04();
      const pendencias = res.validacoesAutomaticas.titularSegSexEmTurno;
      expect(pendencias.length).toBe(3);

      const posicoesDetectadas = pendencias.map((p) => p.posicaoIdSGP);
      expect(posicoesDetectadas).toContain("POS-BOAVENTURA-008-02");
      expect(posicoesDetectadas).toContain("POS-RECAP-177-02");
      expect(posicoesDetectadas).toContain("POS-RPBC-250-01");
    });

    it("2. Posição sem titular: detecta exatamente 24 posições ativas desocupadas", () => {
      const res = processarPlanilhaREV04();
      const pendencias = res.validacoesAutomaticas.posicaoSemTitular;
      expect(pendencias.length).toBe(24);
    });

    it("3. Posto 9h cuja única pessoa é ferista: detecta exatamente 9 postos", () => {
      const res = processarPlanilhaREV04();
      const pendencias = res.validacoesAutomaticas.posto9hUnicaPessoaFerista;
      expect(pendencias.length).toBe(9);

      const postosDetectados = pendencias.map((p) => p.postoIdSGP);
      expect(postosDetectados).toContain("PST-EDIBRA-020");
      expect(postosDetectados).toContain("PST-EDIBRA-032");
      expect(postosDetectados).toContain("PST-EDIHB-069");
      expect(postosDetectados).toContain("PST-EDIHB-090");
      expect(postosDetectados).toContain("PST-EDIHB-094");
      expect(postosDetectados).toContain("PST-REFAP-204");
      expect(postosDetectados).toContain("PST-REVAP-220");
      expect(postosDetectados).toContain("PST-RNEST-226");
      expect(postosDetectados).toContain("PST-RPBC-245");
    });

    it("4. Posto sem regime identificável no nome: detecta exatamente 2 postos", () => {
      const res = processarPlanilhaREV04();
      const pendencias = res.validacoesAutomaticas.postoSemRegimeIdentificavel;
      expect(pendencias.length).toBe(2);

      const postosDetectados = pendencias.map((p) => p.postoIdSGP);
      expect(postosDetectados).toContain("PST-EDISA-118");
      expect(postosDetectados).toContain("PST-IMBETIBA-150");
    });

    it("5. Colaborador da MC não localizado no RM: detecta exatamente 6 colaboradores", () => {
      const res = processarPlanilhaREV04();
      const pendencias = res.validacoesAutomaticas.colaboradorMcNaoLocalizadoRM;
      expect(pendencias.length).toBe(6);
    });
  });
});
