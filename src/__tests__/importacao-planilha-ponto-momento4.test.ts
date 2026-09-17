/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Testes Automatizados para Importação de Planilhas de Ponto (RHID / Cubo RM)
 *
 * Utiliza buffers XLSX sintéticos criados em memória com dados fictícios.
 */

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  processarPlanilhaPonto,
  gerarRelatorioValidacaoPontoXlsx,
  gerarModeloPontoXlsx,
  normalizarCpf,
  normalizarChapa,
  converterDataPlanilha,
  converterHoraPlanilha,
  ColaboradorReferenciaPonto,
} from "@/lib/importadores/planilha-ponto";

describe("Momento 4 — Importador de Planilhas de Ponto (RHID / Cubo de Registros)", () => {
  const colaboradoresFicticios: ColaboradorReferenciaPonto[] = [
    {
      id: "prf-001",
      chapa: "037196",
      cpfLimpo: "07503191511",
      nome: "Colaborador Fictício Alpha",
      unidadeId: "UFN-III", // Fuso -4
      situacao: "ATIVO",
    },
    {
      id: "prf-002",
      chapa: "036830",
      cpfLimpo: "09414064745",
      nome: "Colaborador Fictício Beta",
      unidadeId: "REDUC", // Fuso -3
      situacao: "ATIVO",
    },
  ];

  it("deve normalizar CPF sem zero à esquerda para 11 dígitos e Chapa para 6 dígitos", () => {
    expect(normalizarCpf(7503191511)).toBe("07503191511");
    expect(normalizarCpf("7503191511")).toBe("07503191511");
    expect(normalizarChapa(37196)).toBe("037196");
    expect(normalizarChapa("37196")).toBe("037196");
  });

  it("deve converter frações de dia do Excel em strings de hora formatadas HH:MM", () => {
    // 0.3666666... dia = 8.8 horas = 08:48
    const hora = converterHoraPlanilha(0.36666666666666664);
    expect(hora).toBe("08:48");
    expect(converterHoraPlanilha("07:00:00")).toBe("07:00");
    expect(converterHoraPlanilha("18:30")).toBe("18:30");
  });

  it("deve converter formatos de datas válidos em YYYY-MM-DD", () => {
    expect(converterDataPlanilha("31/08/2026")).toBe("2026-08-31");
    expect(converterDataPlanilha("2026-08-31")).toBe("2026-08-31");
  });

  it("deve processar com sucesso uma planilha formato Cubo de Registros com múltiplas batidas (ENT1/SAI1/ENT2/SAI2)", async () => {
    // Monta buffer sintético
    const dados = [
      {
        "COD.SECÃO": "1.01.080.023",
        "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
        CHAPA: "037196",
        CPF: "7503191511", // Sem zero à esquerda propositalmente
        DATA: "31/08/2026",
        ENT1: "06:59:00",
        SAI1: "12:35:00",
        ENT2: "13:38:00",
        SAI2: "16:50:00",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const res = await processarPlanilhaPonto({
      arquivoNome: "cubo_registros_sintetico.xlsx",
      loteId: "LOTE-CUBO-001",
      bufferOuArray: buffer,
      colaboradores: colaboradoresFicticios,
    });

    expect(res.sucesso).toBe(true);
    expect(res.modeloUtilizado).toContain("Cubo de Registros");
    // Extrai 4 batidas para a linha (ENT1, SAI1, ENT2, SAI2)
    expect(res.totais.marcacoesNovas).toBe(4);
    expect(res.marcacoesImportadas.length).toBe(4);
    expect(res.marcacoesImportadas[0].horaLocal).toBe("06:59");
    expect(res.marcacoesImportadas[3].horaLocal).toBe("16:50");
  });

  it("deve processar uma planilha formato RHID tradicional com 1 marcação por linha", async () => {
    const dados = [
      {
        CPF: "09414064745",
        DATA: "31/08/2026",
        HORA: "07:00",
        NSR: "000101",
        EQUIPAMENTO: "REP-PORTARIA-REDUC",
      },
      {
        CPF: "09414064745",
        DATA: "31/08/2026",
        HORA: "16:48",
        NSR: "000102",
        EQUIPAMENTO: "REP-PORTARIA-REDUC",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "RHID");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const res = await processarPlanilhaPonto({
      arquivoNome: "rhid_sintetico.xlsx",
      loteId: "LOTE-RHID-001",
      bufferOuArray: buffer,
      colaboradores: colaboradoresFicticios,
    });

    expect(res.sucesso).toBe(true);
    expect(res.totais.marcacoesNovas).toBe(2);
    expect(res.marcacoesImportadas[0].horaLocal).toBe("07:00");
    expect(res.marcacoesImportadas[1].horaLocal).toBe("16:48");
  });

  it("deve identificar colaborador inexistente no RM e registrar erro na linha", async () => {
    const dados = [
      {
        CHAPA: "999999", // Não existe
        CPF: "99999999999",
        DATA: "31/08/2026",
        ENT1: "07:00",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const res = await processarPlanilhaPonto({
      arquivoNome: "colab_inexistente.xlsx",
      loteId: "LOTE-INEXISTENTE",
      bufferOuArray: buffer,
      colaboradores: colaboradoresFicticios,
    });

    expect(res.totais.colaboradoresNaoEncontrados).toBe(1);
    expect(res.inconsistencias.some((i) => i.motivo.includes("não encontrado no cadastro RM"))).toBe(true);
  });

  it("deve ignorar e não gravar dados fora das colunas permitidas (minimização LGPD)", async () => {
    // Inclui colunas proibidas (FOTO_SELFIE, IP_ORIGEM, LATITUDE, LONGITUDE, NOME)
    const dados = [
      {
        CHAPA: "037196",
        CPF: "07503191511",
        DATA: "31/08/2026",
        ENT1: "07:00",
        FOTO_SELFIE: "base64_foto_proibida",
        IP_ORIGEM: "192.168.1.100",
        LATITUDE: "-20.7512",
        LONGITUDE: "-51.7012",
        NOME_PLANILHA: "NOME VINDO DO PONTO (DESCONSIDERAR)",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const res = await processarPlanilhaPonto({
      arquivoNome: "dados_proibidos_lgpd.xlsx",
      loteId: "LOTE-LGPD",
      bufferOuArray: buffer,
      colaboradores: colaboradoresFicticios,
    });

    expect(res.sucesso).toBe(true);
    const marcacao = res.marcacoesImportadas[0] as any;
    // Garante que campos proibidos não existem na marcação gravada
    expect(marcacao.FOTO_SELFIE).toBeUndefined();
    expect(marcacao.IP_ORIGEM).toBeUndefined();
    expect(marcacao.LATITUDE).toBeUndefined();
    expect(marcacao.LONGITUDE).toBeUndefined();
    expect(marcacao.NOME_PLANILHA).toBeUndefined();
  });

  it("deve gerar o relatório de validação XLSX com as abas Resumo, Marcações e Inconsistências", () => {
    const resSimulado = {
      sucesso: true,
      loteId: "LOTE-RELATORIO",
      arquivoNome: "ponto_teste.xlsx",
      formato: "PLANILHA" as const,
      modeloUtilizado: "Cubo de Registros",
      hashSha256: "abc123hash",
      dataReferenciaLote: "2026-08-31 16:50",
      dataExecucao: "2026-09-17 10:00:00",
      totais: {
        linhasLidas: 10,
        marcacoesNovas: 20,
        marcacoesJaImportadas: 0,
        colaboradoresNaoEncontrados: 0,
        alertasDemitidos: 0,
        inconsistenciasEstruturais: 0,
      },
      inconsistencias: [],
      marcacoesImportadas: [
        {
          id: "MK-037196-1",
          loteId: "LOTE-RELATORIO",
          arquivoOrigem: "ponto_teste.xlsx",
          colaboradorId: "prf-001",
          chapa: "037196",
          cpfLimpo: "07503191511",
          dataHoraUtc: "2026-08-31T11:00:00.000Z",
          dataLocal: "2026-08-31",
          horaLocal: "07:00",
          importadoEm: "2026-09-17",
        },
      ],
    };

    const bytes = gerarRelatorioValidacaoPontoXlsx(resSimulado);
    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(500);

    const wb = XLSX.read(bytes, { type: "array" });
    expect(wb.SheetNames).toContain("Resumo");
    expect(wb.SheetNames).toContain("Marcações");
    expect(wb.SheetNames).toContain("Inconsistências");
  });

  it("deve gerar a planilha modelo oficial de ponto para download", () => {
    const bytes = gerarModeloPontoXlsx();
    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(500);
    const wb = XLSX.read(bytes, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0]).toHaveProperty("CHAPA");
    expect(json[0]).toHaveProperty("DATA");
    expect(json[0]).toHaveProperty("ENT1");
  });
});
