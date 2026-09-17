/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Testes Automatizados para Leitor e Validador de Arquivo AFD (Portaria MTP 671/2021)
 *
 * Utiliza exclusivamente dados e arquivos sintéticos/fictícios para validação.
 */

import { describe, it, expect } from "vitest";
import {
  processarArquivoAfd,
  CNPJ_PREMIER_ESPERADO,
  ColaboradorReferenciaAfd,
} from "@/lib/importadores/afd-ponto";

describe("Momento 4 — Importador de Arquivo AFD (Portaria 671/2021)", () => {
  const colaboradoresFicticios: ColaboradorReferenciaAfd[] = [
    {
      id: "prf-001",
      chapa: "037196",
      cpfLimpo: "07503191511",
      pis: "12345678901",
      nome: "Colaborador Sintético Alpha",
      unidadeId: "UFN-III", // Fuso -4
      situacao: "ATIVO",
    },
    {
      id: "prf-002",
      chapa: "036830",
      cpfLimpo: "09414064745",
      pis: "98765432109",
      nome: "Colaborador Sintético Demitido",
      unidadeId: "REDUC", // Fuso -3
      situacao: "DESLIGADO",
      dataDesligamento: "2026-08-20",
    },
  ];

  it("deve processar com sucesso um arquivo AFD válido com cabeçalho CNPJ Premier e registros tipo 3", async () => {
    // Monta AFD sintético:
    // Linha 1: 000000000 + Tipo 1 + Tipo Empregador 1 + CNPJ Premier (14 dígitos) + Razão Social
    // Linha 2: 000000001 + Tipo 3 + Data 31/08/2026 + Hora 07:00 + CPF
    // Linha 3: 000000002 + Tipo 3 + Data 31/08/2026 + Hora 16:50 + CPF
    const afdValido = [
      `00000000011${CNPJ_PREMIER_ESPERADO}0000PREMIER LOGISTICS OPERACOES CONTRATUAIS2026080120260831`,
      `000000001331082026070007503191511`,
      `000000002331082026165007503191511`,
    ].join("\n");

    const res = await processarArquivoAfd({
      arquivoNome: "afd_teste_valido.txt",
      loteId: "LOTE-AFD-001",
      conteudoTexto: afdValido,
      colaboradores: colaboradoresFicticios,
    });

    expect(res.sucesso).toBe(true);
    expect(res.totais.inconsistenciasEstruturais).toBe(0);
    expect(res.totais.marcacoesNovas).toBe(2);
    expect(res.marcacoesImportadas.length).toBe(2);
    expect(res.marcacoesImportadas[0].horaLocal).toBe("07:00");
    expect(res.marcacoesImportadas[1].horaLocal).toBe("16:50");
    expect(res.dataReferenciaLote).toBe("2026-08-31 16:50");
  });

  it("deve converter marcações de base com fuso UTC-4 (UFN-III) para UTC corretamente", async () => {
    // 07:00 no fuso de Três Lagoas/MS (-4) deve virar 11:00 UTC
    const afdFuso = [
      `00000000011${CNPJ_PREMIER_ESPERADO}PREMIER LOGISTICS`,
      `000000001331082026070007503191511`,
    ].join("\n");

    const res = await processarArquivoAfd({
      arquivoNome: "afd_fuso.txt",
      loteId: "LOTE-AFD-FUSO",
      conteudoTexto: afdFuso,
      colaboradores: colaboradoresFicticios,
    });

    expect(res.sucesso).toBe(true);
    const m = res.marcacoesImportadas[0];
    expect(m.horaLocal).toBe("07:00");
    expect(m.dataHoraUtc).toBe("2026-08-31T11:00:00.000Z");
  });

  it("deve rejeitar o arquivo inteiro se o CNPJ do cabeçalho não for o da Premier Logistics", async () => {
    const afdCnpjErrado = [
      `0000000001199999999000199OUTRA EMPRESA QUALQUER`,
      `000000001331082026070007503191511`,
    ].join("\n");

    const res = await processarArquivoAfd({
      arquivoNome: "afd_cnpj_invalido.txt",
      loteId: "LOTE-AFD-ERR-CNPJ",
      conteudoTexto: afdCnpjErrado,
      colaboradores: colaboradoresFicticios,
    });

    expect(res.sucesso).toBe(false);
    expect(res.totais.inconsistenciasEstruturais).toBeGreaterThan(0);
    expect(res.inconsistencias.some((i) => i.motivo.includes("CNPJ"))).toBe(true);
    expect(res.marcacoesImportadas.length).toBe(0);
  });

  it("deve rejeitar o arquivo inteiro se houver quebra na sequência estrita de NSR", async () => {
    // NSR linha 2 = 000000005, NSR linha 3 = 000000003 (não é crescente)
    const afdNsrQuebrado = [
      `00000000011${CNPJ_PREMIER_ESPERADO}PREMIER LOGISTICS`,
      `000000005331082026070007503191511`,
      `000000003331082026165007503191511`,
    ].join("\n");

    const res = await processarArquivoAfd({
      arquivoNome: "afd_nsr_quebrado.txt",
      loteId: "LOTE-AFD-ERR-NSR",
      conteudoTexto: afdNsrQuebrado,
      colaboradores: colaboradoresFicticios,
    });

    expect(res.sucesso).toBe(false);
    expect(res.inconsistencias.some((i) => i.motivo.includes("Quebra de sequência de NSR"))).toBe(true);
    expect(res.marcacoesImportadas.length).toBe(0);
  });

  it("deve ignorar registros que não sejam de marcação (ex: tipo 2, 4, 5) sem gerar erro", async () => {
    const afdMistos = [
      `00000000011${CNPJ_PREMIER_ESPERADO}PREMIER LOGISTICS`,
      `0000000012310820260700INCLUSAO EMPREGADO`, // Tipo 2 -> ignorar
      `000000002331082026070007503191511`,        // Tipo 3 -> marcação
      `0000000034310820260700AJUSTE RELOGIO`,     // Tipo 4 -> ignorar
      `000000004331082026165007503191511`,        // Tipo 3 -> marcação
    ].join("\n");

    const res = await processarArquivoAfd({
      arquivoNome: "afd_mistos.txt",
      loteId: "LOTE-AFD-MISTOS",
      conteudoTexto: afdMistos,
      colaboradores: colaboradoresFicticios,
    });

    expect(res.sucesso).toBe(true);
    expect(res.totais.marcacoesNovas).toBe(2);
  });

  it("deve gerar alerta quando colaborador demitido possuir marcação com data posterior à demissão", async () => {
    // Colaborador 036830 foi demitido em 2026-08-20, marcação em 2026-08-25
    const afdDemitido = [
      `00000000011${CNPJ_PREMIER_ESPERADO}PREMIER LOGISTICS`,
      `000000001325082026080009414064745`,
    ].join("\n");

    const res = await processarArquivoAfd({
      arquivoNome: "afd_demitido.txt",
      loteId: "LOTE-AFD-DEMITIDO",
      conteudoTexto: afdDemitido,
      colaboradores: colaboradoresFicticios,
    });

    expect(res.totais.alertasDemitidos).toBe(1);
    expect(res.inconsistencias.some((i) => i.gravidade === "ALERTA" && i.motivo.includes("desligamento"))).toBe(true);
  });

  it("não deve duplicar marcações já existentes na base em reimportações", async () => {
    const afdReimport = [
      `00000000011${CNPJ_PREMIER_ESPERADO}PREMIER LOGISTICS`,
      `000000001331082026070007503191511`,
    ].join("\n");

    // Simula marcação prévia existente
    const marcacaoExistente = {
      id: "MK-037196-20260831T110000000Z-000000001",
      loteId: "LOTE-ANTERIOR",
      arquivoOrigem: "afd_antigo.txt",
      colaboradorId: "prf-001",
      chapa: "037196",
      cpfLimpo: "07503191511",
      dataHoraUtc: "2026-08-31T11:00:00.000Z",
      dataLocal: "2026-08-31",
      horaLocal: "07:00",
      nsr: "000000001",
      importadoEm: "2026-08-31",
    };

    const res = await processarArquivoAfd({
      arquivoNome: "afd_reimport.txt",
      loteId: "LOTE-NOVO",
      conteudoTexto: afdReimport,
      colaboradores: colaboradoresFicticios,
      marcaçõesExistentes: [marcacaoExistente],
    });

    expect(res.sucesso).toBe(true);
    expect(res.totais.marcacoesNovas).toBe(0);
    expect(res.totais.marcacoesJaImportadas).toBe(1);
  });
});
