import { describe, it, expect } from "vitest";
import {
  CATALOGO_ITEM_PPU,
  MAPA_ITEM_PPU,
  ehItemPostoValido,
  obterItemPPU,
  calcularPrazoLimite,
  determinarStatusImovel,
  calcularFatorMedicao,
  obterQtdPosicoesDoRegime,
  verificarEscalaPendente,
  isPosicaoOcupada,
  isPostoOcupado,
  calcularMetricasPainel,
  obterDadosPainelContratual,
  obterFeristasREV04,
  StatusImovel,
} from "@/lib/dados/painel-calculo";
import { POSTOS_REV04, POSICOES_REV04 } from "@/lib/dados/estrutura-postos";

describe("SGP — Contrato Petrobras ICJ 5900.0129796.25.2 — Painel e Modelos Contratuais", () => {
  // ===========================================================================
  // 1. CRITÉRIO DE ACEITE 1: Catálogo ITEM_PPU com os 19 itens de posto
  // ===========================================================================
  describe("1. Catálogo ITEM_PPU (Catálogo Fixo de Postos Contratuais)", () => {
    it("deve conter exatamente os 19 itens de postos contratuais", () => {
      expect(CATALOGO_ITEM_PPU).toHaveLength(19);
    });

    it("deve conter todos os códigos e posições por regime especificados", () => {
      const esperado = [
        { codigo: "1.1", regime: "Adm/09h", posicoes: 1 },
        { codigo: "1.2", regime: "Turno/12h", posicoes: 2 },
        { codigo: "2.1", regime: "Adm/09h", posicoes: 1 },
        { codigo: "2.2", regime: "Turno/12h", posicoes: 2 },
        { codigo: "3.1", regime: "Adm/09h", posicoes: 1 },
        { codigo: "3.2", regime: "Adm/12h", posicoes: 2 },
        { codigo: "3.3", regime: "Adm/16h", posicoes: 2 },
        { codigo: "3.4", regime: "Turno/12h", posicoes: 2 },
        { codigo: "3.5", regime: "Turno/16h", posicoes: 3 },
        { codigo: "3.6", regime: "Turno/24h", posicoes: 4 },
        { codigo: "4.1", regime: "Adm/09h", posicoes: 1 },
        { codigo: "4.2", regime: "Turno/12h", posicoes: 2 },
        { codigo: "5.1", regime: "Adm/09h", posicoes: 1 },
        { codigo: "6.1", regime: "Adm/09h", posicoes: 1 },
        { codigo: "7.1", regime: "Adm/09h", posicoes: 1 },
        { codigo: "8.1", regime: "Adm/09h", posicoes: 1 },
        { codigo: "9.1", regime: "Adm/09h", posicoes: 1 },
        { codigo: "10.1", regime: "Adm/09h", posicoes: 1 },
        { codigo: "11.1", regime: "Adm/09h", posicoes: 1 },
      ];

      for (const item of esperado) {
        const encontrado = obterItemPPU(item.codigo);
        expect(encontrado).toBeDefined();
        expect(encontrado?.regime).toBe(item.regime);
        expect(encontrado?.posicoesPorPosto).toBe(item.posicoes);
      }
    });

    it("NÃO deve aceitar itens que não são de postos (offshore, serviços adicionais, receptivo, vistorias)", () => {
      // DS (Offshore), HS (Horas de Serviços Adicionais), 12.x (Receptivo), 13.x (Vistorias)
      expect(ehItemPostoValido("DS")).toBe(false);
      expect(ehItemPostoValido("HS")).toBe(false);
      expect(ehItemPostoValido("12.1")).toBe(false);
      expect(ehItemPostoValido("13.1")).toBe(false);
      expect(ehItemPostoValido("99.9")).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Modelo IMOVEL e Regras de Status / Prazo
  // ===========================================================================
  describe("2. Tabela / Regras de IMOVEL", () => {
    it("deve calcular o prazo limite como data_comunicacao + 30 dias corridos (ET 9.2 e 9.3)", () => {
      const dataComunicacao = "2026-08-01";
      const prazo = calcularPrazoLimite(dataComunicacao);
      expect(prazo).toBe("2026-08-31");
    });

    it("deve aplicar as regras de uso do status do imóvel", () => {
      // ATIVO = imóvel com postos mobilizados em operação
      expect(determinarStatusImovel(5, false, false)).toBe<StatusImovel>("ATIVO");

      // EM_MOBILIZACAO = Petrobras solicitou postos e a mobilização ainda não foi concluída
      expect(determinarStatusImovel(0, true, false)).toBe<StatusImovel>("EM_MOBILIZACAO");

      // DESMOBILIZADO = Petrobras comunicou a desmobilização (manter histórico, não apagar)
      expect(determinarStatusImovel(5, false, true)).toBe<StatusImovel>("DESMOBILIZADO");

      // INATIVO = imóvel cadastrado sem postos solicitados
      expect(determinarStatusImovel(0, false, false)).toBe<StatusImovel>("INATIVO");
    });
  });

  // ===========================================================================
  // 3. Modelo POSTO: fator de medição e posições por regime
  // ===========================================================================
  describe("3. Tabela POSTO (Regras e Parâmetros)", () => {
    it("deve calcular o fator de medição informativo: 1,0 para SIM e 0,8 para NÃO (ET 10.6)", () => {
      expect(calcularFatorMedicao("SIM")).toBe(1.0);
      expect(calcularFatorMedicao("NÃO")).toBe(0.8);
      expect(calcularFatorMedicao("NAO")).toBe(0.8);
    });

    it("deve calcular a quantidade de posições estruturais conforme o regime", () => {
      expect(obterQtdPosicoesDoRegime("Adm/09h")).toBe(1);
      expect(obterQtdPosicoesDoRegime("Adm/12h")).toBe(2);
      expect(obterQtdPosicoesDoRegime("Turno/12h")).toBe(2);
      expect(obterQtdPosicoesDoRegime("Adm/16h")).toBe(2);
      expect(obterQtdPosicoesDoRegime("Turno/16h")).toBe(3);
      expect(obterQtdPosicoesDoRegime("Turno/24h")).toBe(4);
    });
  });

  // ===========================================================================
  // 4. Modelo POSICAO e FERISTA_POSTO
  // ===========================================================================
  describe("4. Tabela POSICAO e FERISTA_POSTO", () => {
    it("deve identificar escala cíclica sem fase ou data-base como escala_pendente", () => {
      // 12x36 sem fase/data-base: pendente
      expect(
        verificarEscalaPendente({
          escala_tipo: "12X36",
          fase_ciclo: null,
          data_base_escala: null,
        })
      ).toBe(true);

      // 12x36 com fase e data-base: não pendente
      expect(
        verificarEscalaPendente({
          escala_tipo: "12X36",
          fase_ciclo: "TURMA A",
          data_base_escala: "2026-08-10",
        })
      ).toBe(false);

      // 5x2 (administrativo): não é cíclica, não pendente
      expect(
        verificarEscalaPendente({
          escala_tipo: "5X2",
          fase_ciclo: null,
          data_base_escala: null,
        })
      ).toBe(false);
    });

    it("deve carregar feristas como recurso de cobertura vinculado a postos sem criar posição nem posto", () => {
      const feristas = obterFeristasREV04();
      expect(feristas.length).toBeGreaterThan(0);
      for (const f of feristas) {
        expect(f.posto_id).toBeDefined();
        expect(f.chapa).toBeDefined();
        expect(f.nome).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // 5. CRITÉRIO DE ACEITE 2: Funções de Cálculo do Painel com a base REV04
  // CRITÉRIOS DE ACEITE:
  // Funções retornam, no total: 244 postos mobilizados · 223 postos ocupados · 24 vagas
  // em aberto · 21 postos com vaga · 311 posições.
  // ===========================================================================
  describe("5. Funções de Cálculo do Painel (Critérios de Aceite REV04)", () => {
    it("deve avaliar posicao_ocupada com fidelidade (tem titular e titular existe no RM)", () => {
      // Posição com titular e status RM: ocupada
      expect(
        isPosicaoOcupada({
          chapa_titular: "037196",
          situacao_rm: "Ativo",
        })
      ).toBe(true);

      // Titular em férias/afastado/licença/aviso prévio também conta como ocupada
      expect(
        isPosicaoOcupada({
          chapa_titular: "037196",
          situacao_rm: "Férias",
        })
      ).toBe(true);

      expect(
        isPosicaoOcupada({
          chapa_titular: "037196",
          situacao_rm: "Afastado",
        })
      ).toBe(true);

      // Sem chapa: vaga
      expect(
        isPosicaoOcupada({
          chapa_titular: null,
          situacao_rm: null,
        })
      ).toBe(false);

      // Chapa vazia ou '-'
      expect(
        isPosicaoOcupada({
          chapa_titular: "-",
          situacao_rm: "-",
        })
      ).toBe(false);

      // Não localizado no RM: não ocupada
      expect(
        isPosicaoOcupada({
          chapa_titular: "999999",
          situacao_rm: "NÃO LOCALIZADO",
        })
      ).toBe(false);
    });

    it("deve avaliar posto_ocupado apenas quando TODAS as posições do posto estiverem ocupadas", () => {
      const postoId = "PST-TESTE-001";

      // 2 posições ocupadas
      const posicoesOcupadas = [
        { posto_id: postoId, chapa_titular: "01", situacao_rm: "Ativo" },
        { posto_id: postoId, chapa_titular: "02", situacao_rm: "Ativo" },
      ];
      expect(isPostoOcupado(postoId, posicoesOcupadas)).toBe(true);

      // 1 ocupada e 1 vaga
      const posicoesMistas = [
        { posto_id: postoId, chapa_titular: "01", situacao_rm: "Ativo" },
        { posto_id: postoId, chapa_titular: null, situacao_rm: null },
      ];
      expect(isPostoOcupado(postoId, posicoesMistas)).toBe(false);

      // Posto sem posições cadastradas não é ocupado
      expect(isPostoOcupado(postoId, [])).toBe(false);
    });

    it("CRITÉRIO OFICIAL DE ACEITE: retorna exatamente 244 postos mobilizados · 223 postos ocupados · 24 vagas em aberto · 21 postos com vaga · 311 posições", () => {
      const resultado = obterDadosPainelContratual();

      expect(resultado.totais.postos_mobilizados).toBe(244);
      expect(resultado.totais.postos_ocupados).toBe(223);
      expect(resultado.totais.vagas_em_aberto).toBe(24);
      expect(resultado.totais.postos_com_vaga).toBe(21);
      expect(resultado.totais.posicoes_total).toBe(311);

      // Validação da taxa de ocupação: 223 / 244 = ~91.39%
      expect(resultado.totais.taxa_ocupacao).toBeCloseTo(223 / 244, 4);

      // Relação estrita: postos_mobilizados = postos_ocupados + postos_com_vaga
      expect(resultado.totais.postos_ocupados + resultado.totais.postos_com_vaga).toBe(
        resultado.totais.postos_mobilizados
      );
    });

    it("deve garantir que a soma dos imóveis bate perfeitamente com os totais contratuais", () => {
      const resultado = calcularMetricasPainel(POSTOS_REV04, POSICOES_REV04);

      let somaMobilizados = 0;
      let somaOcupados = 0;
      let somaVagas = 0;
      let somaPostosComVaga = 0;
      let somaPosicoes = 0;

      for (const imovel of resultado.lista_imoveis) {
        somaMobilizados += imovel.postos_mobilizados;
        somaOcupados += imovel.postos_ocupados;
        somaVagas += imovel.vagas_em_aberto;
        somaPostosComVaga += imovel.postos_com_vaga;
        somaPosicoes += imovel.posicoes_total;

        // Cada imóvel deve satisfazer: postos_mobilizados = postos_ocupados + postos_com_vaga
        expect(imovel.postos_ocupados + imovel.postos_com_vaga).toBe(imovel.postos_mobilizados);

        // Taxa do imóvel deve ser postos_ocupados / postos_mobilizados
        expect(imovel.taxa_ocupacao).toBeCloseTo(
          imovel.postos_ocupados / imovel.postos_mobilizados,
          4
        );
      }

      expect(somaMobilizados).toBe(244);
      expect(somaOcupados).toBe(223);
      expect(somaVagas).toBe(24);
      expect(somaPostosComVaga).toBe(21);
      expect(somaPosicoes).toBe(311);
    });

    it("CRITÉRIO DE ACEITE: Conferência por imóvel (BOAVENTURA, REPLAN, EDIHB, REDUC, CENPES)", () => {
      const { por_imovel } = obterDadosPainelContratual();

      // BOAVENTURA 7 / 7 / — (0 vagas)
      expect(por_imovel["BOAVENTURA"].postos_mobilizados).toBe(7);
      expect(por_imovel["BOAVENTURA"].postos_ocupados).toBe(7);
      expect(por_imovel["BOAVENTURA"].vagas_em_aberto).toBe(0);

      // REPLAN 5 / 3 / 5 (5 vagas em 2 postos com vaga)
      expect(por_imovel["REPLAN"].postos_mobilizados).toBe(5);
      expect(por_imovel["REPLAN"].postos_ocupados).toBe(3);
      expect(por_imovel["REPLAN"].vagas_em_aberto).toBe(5);

      // EDIHB 83 / 80 / 3
      expect(por_imovel["EDIHB"].postos_mobilizados).toBe(83);
      expect(por_imovel["EDIHB"].postos_ocupados).toBe(80);
      expect(por_imovel["EDIHB"].vagas_em_aberto).toBe(3);

      // REDUC 14 / 13 / 1
      expect(por_imovel["REDUC"].postos_mobilizados).toBe(14);
      expect(por_imovel["REDUC"].postos_ocupados).toBe(13);
      expect(por_imovel["REDUC"].vagas_em_aberto).toBe(1);

      // CENPES 5 / 3 / 2
      expect(por_imovel["CENPES"].postos_mobilizados).toBe(5);
      expect(por_imovel["CENPES"].postos_ocupados).toBe(3);
      expect(por_imovel["CENPES"].vagas_em_aberto).toBe(2);
    });
  });
});
