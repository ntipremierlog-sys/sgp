/**
 * Item da PPU na cobertura: derivação a partir do posto, persistência e presença
 * no relatório de coberturas (tela e XLSX). Base de cálculo da medição Petrobras.
 */
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  adicionarCobertura,
  carregarEstado,
  salvarEstado,
  obterItemPpuDoPosto,
} from "@/lib/dados/estado-operacional";
import { POSTOS_REV04 } from "@/lib/dados/estrutura-postos";
import {
  gerarRelatorioCoberturas,
  exportarRelatorioParaXlsx,
} from "@/lib/servicos/relatorios-oficiais";

const postoReal = (POSTOS_REV04 as any[]).find((p) => String(p.itemPPU ?? p.item_ppu ?? "").trim());
const itemDoPostoReal = String(postoReal?.itemPPU ?? postoReal?.item_ppu ?? "").trim();
const codigoPostoReal: string = postoReal?.codigoPosto || postoReal?.idPosto || postoReal?.postoIdSGP;

describe("Cobertura — Item da PPU", () => {
  it("obterItemPpuDoPosto retorna o item do posto REV04 (por qualquer identificador)", () => {
    expect(postoReal).toBeTruthy();
    for (const chave of [postoReal.postoIdSGP, postoReal.idPosto, postoReal.codigoPosto].filter(Boolean)) {
      expect(obterItemPpuDoPosto(chave)).toBe(itemDoPostoReal);
    }
    expect(obterItemPpuDoPosto("POSTO-INEXISTENTE")).toBeUndefined();
    expect(obterItemPpuDoPosto("")).toBeUndefined();
  });

  it("adicionarCobertura deriva o item do posto quando não informado", () => {
    const cob = adicionarCobertura({
      postoCodigo: codigoPostoReal,
      funcaoPosto: "Teste",
      substitutoMatricula: "099001",
      substitutoNome: "Ferista Teste PPU",
      dataInicio: "2026-10-05",
      dataFim: "2026-10-07",
      tipoCobertura: "SUBSTITUICAO_INTERNA",
      status: "CONFIRMADA",
      justificativa: "Férias do titular",
    } as any);
    expect(cob.itemPpu).toBe(itemDoPostoReal);
  });

  it("adicionarCobertura respeita o item informado manualmente", () => {
    const cob = adicionarCobertura({
      postoCodigo: codigoPostoReal,
      funcaoPosto: "Teste",
      substitutoMatricula: "099002",
      substitutoNome: "Ferista Item Manual",
      dataInicio: "2026-10-12",
      dataFim: "2026-10-12",
      tipoCobertura: "SUBSTITUICAO_INTERNA",
      status: "CONFIRMADA",
      justificativa: "Cobertura operacional",
      itemPpu: "ITEM-MANUAL-X",
    } as any);
    expect(cob.itemPpu).toBe("ITEM-MANUAL-X");
    expect(carregarEstado().coberturas.find((c) => c.id === cob.id)?.itemPpu).toBe("ITEM-MANUAL-X");
  });

  it("relatório de coberturas e XLSX exibem o Item da PPU", () => {
    const antes = carregarEstado().coberturas;
    salvarEstado({
      coberturas: [
        {
          id: "cob-ppu-relatorio",
          postoCodigo: codigoPostoReal,
          funcaoPosto: "Teste",
          substitutoMatricula: "099003",
          substitutoNome: "Ferista Relatório PPU",
          dataInicio: "2026-10-01",
          dataFim: "2026-10-03",
          tipoCobertura: "SUBSTITUICAO_INTERNA",
          status: "CONFIRMADA",
          justificativa: "Férias",
          criadoEm: "2026-10-01 08:00",
          itemPpu: itemDoPostoReal,
        } as any,
        ...antes,
      ],
    });

    const rel = gerarRelatorioCoberturas({ periodo: "2026-10" });
    const linha = rel.itens.find((i) => i.id === "cob-ppu-relatorio");
    expect(linha?.itemPpu).toBe(itemDoPostoReal);
    expect(linha?.itemPpuDescricao).toBeTypeOf("string");

    const buf = exportarRelatorioParaXlsx("coberturas", { periodo: "2026-10" });
    const wb = XLSX.read(buf, { type: "array" });
    const conteudo = wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");
    expect(conteudo).toContain("ITEM PPU");
    expect(conteudo).toContain("Ferista Relatório PPU");

    salvarEstado({ coberturas: antes });
  });
});
