import { describe, it, expect } from "vitest";
import path from "path";
import {
  sanitizarTexto,
  normalizarParaComparacao,
  resolverRegimePosto,
  sanitizarCampoNumerico,
  obterCicloEsperadoCompetencia,
  extrairCicloCabecalhoMC,
  processarMemoriaCalculo,
  simularImportacaoMC,
  InconsistenciaMC,
} from "@/lib/importadores/memoria-calculo";
import {
  processarPlanilhaREV04,
  obterDadosBaseREV04,
} from "@/lib/importadores/base-estruturada-rev02";
import {
  IMOVEIS_REV04,
  obterCidadeUfImovel,
  obterImovelPorNome,
} from "@/lib/dados/painel-calculo";
import {
  POSTOS_REV04,
  POSICOES_REV04,
  FERISTAS_REV04,
} from "@/lib/dados/estrutura-postos";

describe("Carga Inicial Base Estruturada REV04 e Importação Mensal MC", () => {
  // ===========================================================================
  // PILAR 1: CARGA INICIAL A PARTIR DA REV04 (Critérios de Aceite 1 e 2)
  // ===========================================================================
  describe("Pilar 1: Carga inicial a partir da REV04", () => {
    it("deve carregar exatamente 29 imóveis, 244 postos, 311 posições e 23 feristas", () => {
      const dados = obterDadosBaseREV04();
      expect(dados.totalImoveis).toBe(29);
      expect(dados.imoveis.length).toBe(29);
      expect(dados.totalPostos).toBe(244);
      expect(dados.totalPosicoes).toBe(311);
      expect(dados.totalFeristas).toBe(23);

      expect(IMOVEIS_REV04.length).toBe(29);
      expect(POSTOS_REV04.length).toBe(244);
      expect(POSICOES_REV04.length).toBe(311);
      expect(FERISTAS_REV04.length).toBe(23);
    });

    it("nenhum imóvel deve ter cidade/UF errada ou vazia, e Paulínia deve ser apenas da REPLAN", () => {
      const dados = obterDadosBaseREV04();
      const errosCidade = dados.imoveis.filter((im) => {
        if (!im.cidade || !im.uf) return true;
        // Erro anterior onde todos apareciam como Paulínia/SP
        if (im.cidade.toLowerCase() === "paulínia" || im.cidade.toLowerCase() === "paulinia") {
          return im.nome !== "REPLAN";
        }
        return false;
      });

      expect(errosCidade).toHaveLength(0);

      // Verificações específicas de cidades extraídas de Unidade_RM
      const boaventura = dados.imoveis.find((im) => im.nome === "BOAVENTURA");
      expect(boaventura?.cidade).toBe("Itaboraí");
      expect(boaventura?.uf).toBe("RJ");

      const ufn3 = dados.imoveis.find((im) => im.nome === "UFN-III");
      expect(ufn3?.cidade).toBe("Três Lagoas");
      expect(ufn3?.uf).toBe("MS");

      const cabiunas = dados.imoveis.find((im) => im.nome === "CABIUNAS");
      expect(cabiunas?.cidade).toBe("Macaé");
      expect(cabiunas?.uf).toBe("RJ");

      const edisa = dados.imoveis.find((im) => im.nome === "EDISA");
      expect(edisa?.cidade).toBe("Santos");
      expect(edisa?.uf).toBe("SP");

      const replan = dados.imoveis.find((im) => im.nome === "REPLAN");
      expect(replan?.cidade).toBe("Paulínia");
      expect(replan?.uf).toBe("SP");
    });

    it("status inicial dos imóveis deve ser ATIVO para os que têm posições ocupadas", () => {
      const dados = obterDadosBaseREV04();
      dados.imoveis.forEach((im) => {
        if ((im.posicoesOcupadas || 0) > 0) {
          expect(im.status_imovel).toBe("ATIVO");
        } else if ((im.postosCount || 0) > 0) {
          expect(im.status_imovel).toBe("EM_MOBILIZACAO");
        }
      });
    });

    it("preposto por imóvel deve estar vinculado conforme a aba de atividades da MC", () => {
      const dados = obterDadosBaseREV04();
      const taquipe = dados.imoveis.find((im) => im.nome === "BASE TAQUIPE");
      expect(taquipe?.preposto).toBe("Kleydson Alves da Silva");

      const boaventura = dados.imoveis.find((im) => im.nome === "BOAVENTURA");
      expect(boaventura?.preposto).toBe("Jeniffer de Almeida Medeiros");

      const cenpes = dados.imoveis.find((im) => im.nome === "CENPES");
      expect(cenpes?.preposto).toBe("Caroline Fernandes");
    });
  });

  // ===========================================================================
  // PILAR 2: SANEAMENTO OBRIGATÓRIO (MC E RM)
  // ===========================================================================
  describe("Pilar 2: Saneamento obrigatório em toda importação", () => {
    it("deve remover espaços no início/fim e espaços duplos", () => {
      expect(sanitizarTexto("UFN-III ")).toBe("UFN-III");
      expect(sanitizarTexto("  BOAVENTURA   ")).toBe("BOAVENTURA");
      expect(sanitizarTexto("BASE   TAQUIPE  ")).toBe("BASE TAQUIPE");
      expect(sanitizarTexto(null)).toBe("");
    });

    it("deve comparar textos sem diferença de maiúsculas e acentos ('Não' = 'NÃO')", () => {
      expect(normalizarParaComparacao("Não")).toBe("NAO");
      expect(normalizarParaComparacao("NÃO")).toBe("NAO");
      expect(normalizarParaComparacao("não")).toBe("NAO");
      expect(normalizarParaComparacao("Não")).toBe(normalizarParaComparacao("NÃO"));
      expect(normalizarParaComparacao("ANÁLISE")).toBe(normalizarParaComparacao("analise"));
    });

    it("regime ausente no nome do posto (ex.: item 10.1) deve usar o regime do catálogo ITEM_PPU", () => {
      // Item 10.1 "APOIO EM ANÁLISE DE ENGENHARIA" não traz "Adm/09h" no texto
      const regime101 = resolverRegimePosto("10.1", "APOIO EM ANÁLISE DE ENGENHARIA");
      expect(regime101).toBe("Adm/09h");

      // Item 3.6 com regime explícito
      const regime36 = resolverRegimePosto("3.6", "SUPORTE À OPERAÇÃO DE MOBILIDADE - Turno/24h");
      expect(regime36).toBe("Turno/24h");
    });

    it("valor '-' em campo numérico deve ser tratado como vazio e registrado na lista de inconsistências", () => {
      const inconsistencias: InconsistenciaMC[] = [];
      const res = sanitizarCampoNumerico("-", 15, "Disponibilidade em dias", inconsistencias, "COLABORADOR TESTE");

      expect(res).toBeNull();
      expect(inconsistencias).toHaveLength(1);
      expect(inconsistencias[0].linha).toBe(15);
      expect(inconsistencias[0].campo).toBe("Disponibilidade em dias");
      expect(inconsistencias[0].colaborador).toBe("COLABORADOR TESTE");
      expect(inconsistencias[0].motivo).toContain("tratado como vazio");
    });

    it("números válidos não devem gerar inconsistências", () => {
      const inconsistencias: InconsistenciaMC[] = [];
      const res = sanitizarCampoNumerico(31, 10, "Disponibilidade em dias", inconsistencias);
      expect(res).toBe(31);
      expect(inconsistencias).toHaveLength(0);
    });
  });

  // ===========================================================================
  // PILAR 3 & 4: BLOQUEIO OBRIGATÓRIO POR DIVERGÊNCIA DE CICLO (Critério de Aceite 3)
  // ===========================================================================
  describe("Pilar 4: Período de Medição e Bloqueio Obrigatório", () => {
    it("deve BLOQUEAR a importação da MC de outubro prévia 01 com a mensagem exata requerida", () => {
      const caminhoOutubro = path.join(process.cwd(), "Premier_Memoria_Cálculo_outubro_prévia_01.xlsx");
      const res = simularImportacaoMC(caminhoOutubro, "2026-10", 10, 9);

      // Critério de Aceite: BLOQUEADO
      expect(res.sucesso).toBe(false);
      expect(res.bloqueado).toBe(true);
      expect(res.totalImportado).toBe(0);

      // Mensagem exata de bloqueio
      expect(res.mensagemBloqueio).toBe(
        "O ciclo das linhas (10/08 a 09/09) não corresponde à competência informada. Atualize a MC e importe novamente."
      );
      expect(res.cicloLinhas).toBe("10/08 a 09/09");
      expect(res.cicloCabecalho).toBe("10/09 a 09/10");
    });

    it("deve PERMITIR a importação da MC de setembro com sucesso total", () => {
      const caminhoSetembro = path.join(process.cwd(), "Memoria_Calculo.xlsx");
      const res = simularImportacaoMC(caminhoSetembro, "2026-09", 10, 9);

      expect(res.bloqueado).toBe(false);
      expect(res.sucesso).toBe(true);
      expect(res.mensagemBloqueio).toBeUndefined();

      // Totais oficiais
      expect(res.totalImportado).toBe(322);
      expect(res.totalIgnorado).toBe(36); // 36 itens fora dos 19 postos ignorados
      expect(res.linhasLigadas.length).toBe(322);
    });

    it("deve permitir configurar ciclo de medição customizado por competência", () => {
      const cicloPadrao = obterCicloEsperadoCompetencia("2026-10", 10, 9);
      expect(cicloPadrao.texto).toBe("10/09 a 09/10");

      const cicloCustom = obterCicloEsperadoCompetencia("2026-10", 1, 30);
      expect(cicloCustom.texto).toBe("01/09 a 30/10");
    });
  });

  // ===========================================================================
  // PILAR 3: LIGAÇÃO MC × SGP E PESSOAS 'A ALOCAR'
  // ===========================================================================
  describe("Pilar 3: Ligação MC × SGP", () => {
    it("itens da MC fora dos 19 postos devem ser listados em itensIgnorados", () => {
      const caminhoSetembro = path.join(process.cwd(), "Memoria_Calculo.xlsx");
      const res = simularImportacaoMC(caminhoSetembro, "2026-09");

      expect(res.itensIgnorados.length).toBe(36);
      res.itensIgnorados.forEach((item) => {
        expect(item.motivo).toContain("fora do catálogo de 19 postos");
      });
    });

    it("ligações da MC devem vincular aos postos e posições do SGP por IDENTIFICADOR", () => {
      const caminhoSetembro = path.join(process.cwd(), "Memoria_Calculo.xlsx");
      const res = simularImportacaoMC(caminhoSetembro, "2026-09");

      // Carlos Augusto em Base Taquipe
      const carlos = res.linhasLigadas.find((l) => l.identificador === "72034968");
      expect(carlos).toBeDefined();
      expect(carlos?.postoIdSGP).toBe("PST-BASE_TAQUIPE-001");
      expect(carlos?.posicaoIdSGP).toBe("POS-BASE_TAQUIPE-001-01");
      expect(carlos?.tipoLigacao).toBe("IDENTIFICADOR");
    });

    it("colaborador não encontrado deve ir para pessoasAAlocar e NÃO criar posição", () => {
      // Simulação com posições vazias para forçar pessoas a alocar
      const caminhoSetembro = path.join(process.cwd(), "Memoria_Calculo.xlsx");
      const res = processarMemoriaCalculo(caminhoSetembro, {
        competencia: "2026-09",
        postosBase: [],
        posicoesBase: [],
        alocacoesBase: [],
      });

      expect(res.pessoasAAlocar.length).toBeGreaterThan(0);
      res.pessoasAAlocar.forEach((p) => {
        expect(p.motivo).toContain("sem posição vinculada no SGP");
      });
      // Nenhuma linha ligada quando não há posições
      expect(res.linhasLigadas.length).toBe(0);
    });
  });
});
