import { describe, it, expect } from "vitest";
import {
  obterArvoreEstruturalImovel,
  determinarMotivoVaga,
  categorizarSituacaoRM,
} from "@/lib/dados/painel-calculo";

describe("SGP — Árvore Estrutural do Imóvel no Painel (IMÓVEL → ITEM PPU → POSTO → POSIÇÃO)", () => {
  // ===========================================================================
  // CRITÉRIO DE ACEITE 1: BOAVENTURA (5 itens PPU, 7 postos, 14 posições, 4 posições no Turno 24h)
  // ===========================================================================
  it("CRITÉRIO DE ACEITE: BOAVENTURA mostra 5 itens PPU, 7 postos e 14 posições; o posto Turno/24h exibe 4 posições por posto", () => {
    const arvore = obterArvoreEstruturalImovel("BOAVENTURA");

    expect(arvore).toBeDefined();
    expect(arvore?.imovel).toBe("BOAVENTURA");
    expect(arvore?.total_itens_ppu).toBe(5);
    expect(arvore?.total_postos).toBe(7);
    expect(arvore?.total_posicoes).toBe(14);
    expect(arvore?.total_vagas).toBe(0);

    // Conferir os 5 itens PPU ordenados
    const codigosPPU = arvore!.itens_ppu.map((it) => it.codigo);
    expect(codigosPPU).toEqual(["3.1", "3.2", "3.6", "4.1", "5.1"]);

    // Verificar os postos Turno/24h (código PPU 3.6)
    const itemTurno24h = arvore!.itens_ppu.find((it) => it.codigo === "3.6");
    expect(itemTurno24h).toBeDefined();
    expect(itemTurno24h?.postos).toHaveLength(2); // PST-BOAVENTURA-007 e 008

    for (const posto of itemTurno24h!.postos) {
      expect(posto.regime).toContain("Turno/24h");
      expect(posto.qtd_posicoes).toBe(4);
      expect(posto.posicoes).toHaveLength(4);
      expect(posto.tem_periculosidade).toBe(true);
      expect(posto.fator_medicao).toBe(1.0);
    }

    // Conferir ferista no PST-BOAVENTURA-008
    const posto008 = itemTurno24h!.postos.find((p) => p.posto_id === "PST-BOAVENTURA-008");
    expect(posto008?.feristas).toHaveLength(1);
    expect(posto008?.feristas[0].nome).toContain("LUCAS VASCONCELLOS");
    expect(posto008?.feristas[0].chapa).toBe("045858");
  });

  // ===========================================================================
  // CRITÉRIO DE ACEITE 2: REPLAN mostra as 5 vagas em vermelho com o motivo
  // ===========================================================================
  it("CRITÉRIO DE ACEITE: REPLAN mostra as 5 vagas em vermelho com o motivo ('Sem titular na MC')", () => {
    const arvore = obterArvoreEstruturalImovel("REPLAN");

    expect(arvore).toBeDefined();
    expect(arvore?.imovel).toBe("REPLAN");
    expect(arvore?.total_postos).toBe(5);
    expect(arvore?.total_posicoes).toBe(11);
    expect(arvore?.total_vagas).toBe(5);

    // Extrair todas as vagas do REPLAN
    const todasPosicoes = arvore!.itens_ppu.flatMap((it) => it.postos.flatMap((p) => p.posicoes));
    const vagas = todasPosicoes.filter((p) => p.eh_vaga);

    expect(vagas).toHaveLength(5);

    // Todas as 5 vagas do REPLAN não tinham titular na MC
    for (const vaga of vagas) {
      expect(vaga.eh_vaga).toBe(true);
      expect(vaga.motivo_vaga).toBe("Sem titular na MC");
    }
  });

  // ===========================================================================
  // CRITÉRIO DE ACEITE 3: Motivo '<nome> (MC) não está no RM' quando há pessoa na MC mas não no RM
  // ===========================================================================
  it("deve atribuir o motivo '<nome> (MC) não está no RM' para colaboradores com vínculo na MC não localizados no RM", () => {
    // Teste com EDISEN (posicao POS-EDISEN-123-01 com Isabela Gonçalves)
    const arvoreEdisen = obterArvoreEstruturalImovel("EDISEN");
    expect(arvoreEdisen).toBeDefined();

    const todasPosicoes = arvoreEdisen!.itens_ppu.flatMap((it) => it.postos.flatMap((p) => p.posicoes));
    const vagaComTitularMC = todasPosicoes.find((p) => p.motivo_vaga?.includes("não está no RM"));

    expect(vagaComTitularMC).toBeDefined();
    expect(vagaComTitularMC?.motivo_vaga).toBe(
      "ISABELA GONCALVES FERNANDES DE ALBUQUERQUE (MC) não está no RM"
    );
  });

  // ===========================================================================
  // CRITÉRIO DE ACEITE 4: Nenhum CPF ou CID aparece na árvore estrutural
  // ===========================================================================
  it("CRITÉRIO DE ACEITE: Nenhum CPF ou CID aparece em nenhuma parte da árvore estrutural", () => {
    const arvoreBoa = obterArvoreEstruturalImovel("BOAVENTURA");
    const jsonStr = JSON.stringify(arvoreBoa);

    expect(jsonStr).not.toMatch(/cpf/i);
    expect(jsonStr).not.toMatch(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    expect(jsonStr).not.toMatch(/cid\b/i);
    expect(jsonStr).not.toMatch(/\b[A-Z]\d{2}(\.\d)?\b/); // formato de CID (ex: F32, M54.5)
  });

  // ===========================================================================
  // 5. Regras de Situação no RM e Escala Cíclica Pendente
  // ===========================================================================
  describe("Regras de Formatação e Classificação", () => {
    it("deve categorizar situação RM corretamente para estilização em etiqueta", () => {
      expect(categorizarSituacaoRM("Ativo")).toBe("ativo");
      expect(categorizarSituacaoRM("Férias")).toBe("ferias");
      expect(categorizarSituacaoRM("Ferias")).toBe("ferias");
      expect(categorizarSituacaoRM("Afastado")).toBe("afastado");
      expect(categorizarSituacaoRM("Licença")).toBe("afastado");
      expect(categorizarSituacaoRM("Aviso Prévio")).toBe("afastado");
      expect(categorizarSituacaoRM(null)).toBe("indefinido");
    });

    it("deve determinar motivo de vaga corretamente", () => {
      // Sem titular
      expect(
        determinarMotivoVaga({
          titularReferencia: null,
          chapaTitular: null,
          statusRMTitular: null,
        })
      ).toBe("Sem titular na MC");

      // Com titular na MC mas não localizado no RM
      expect(
        determinarMotivoVaga({
          titularReferencia: "FULANO DA SILVA",
          chapaTitular: "999999",
          statusRMTitular: "NÃO LOCALIZADO",
        })
      ).toBe("FULANO DA SILVA (MC) não está no RM");
    });
  });
});
