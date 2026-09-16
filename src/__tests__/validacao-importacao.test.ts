import { describe, it, expect } from "vitest";
import {
  parseDataBrasileira,
  parseDecimalBrasileiro,
  sanitizarCpf,
  mascararCpf,
  ColaboradorImportSchema,
  PontoImportSchema,
  OcorrenciaImportSchema,
} from "@/lib/importadores/tipos";

describe("Importadores — Parsing e Validação de Dados Brasileiros", () => {
  it("deve fazer parse correto de datas no formato dd/mm/aaaa", () => {
    const dataValida = parseDataBrasileira("15/09/2026");
    expect(dataValida).not.toBeNull();
    expect(dataValida?.getDate()).toBe(15);
    expect(dataValida?.getMonth()).toBe(8); // 0-indexed (Setembro = 8)
    expect(dataValida?.getFullYear()).toBe(2026);

    const dataInvalida = parseDataBrasileira("31/02/2026");
    expect(dataInvalida).toBeNull();
  });

  it("deve converter números decimais com vírgula para float", () => {
    expect(parseDecimalBrasileiro("44,0")).toBe(44.0);
    expect(parseDecimalBrasileiro("8,80")).toBe(8.8);
    expect(parseDecimalBrasileiro("1.250,50")).toBe(1250.5);
  });

  it("deve mascarar o CPF para visualização segura da Petrobras (LGPD)", () => {
    const cpfBruto = "123.456.789-01";
    expect(sanitizarCpf(cpfBruto)).toBe("12345678901");
    expect(mascararCpf(cpfBruto)).toBe("***.456.789-**");
  });

  it("deve validar com sucesso a estrutura de importação de Colaborador", () => {
    const colaborador = {
      matricula: "PRM-00101",
      nomeCompleto: "Carlos Eduardo Silva",
      cpf: "123.456.789-01",
      funcao: "Auxiliar de Almoxarifado",
      unidadeCodigo: "UFN-III",
      postoCodigo: "PST-ALM-001",
      escala: "5x2" as const,
      jornadaSemanalHoras: "44,0",
      horarioInicio: "07:00",
      horarioFim: "16:48",
      dataAdmissao: "01/03/2024",
      situacao: "ATIVO" as const,
    };

    const resultado = ColaboradorImportSchema.safeParse(colaborador);
    expect(resultado.success).toBe(true);
  });

  it("deve validar com sucesso registro de Ponto com situação", () => {
    const ponto = {
      matricula: "PRM-00101",
      data: "01/09/2026",
      situacaoPonto: "PRESENTE" as const,
      horaEntrada: "07:02",
      horaSaida: "16:50",
      horasTrabalhadas: "8,80",
      codigoPosto: "PST-ALM-001",
    };

    const resultado = PontoImportSchema.safeParse(ponto);
    expect(resultado.success).toBe(true);
  });

  it("deve validar ocorrência de Atestado com segregação de CID para tabela isolada", () => {
    const ocorrencia = {
      matricula: "PRM-00101",
      tipoOcorrencia: "ATESTADO_MEDICO" as const,
      dataInicio: "03/09/2026",
      dataFim: "05/09/2026",
      observacaoPublica: "Ausência justificada - atestado médico apresentado",
      cid: "M54.5",
      medicoEmissor: "Dr. Roberto Mendes",
      crm: "12345/MS",
    };

    const resultado = OcorrenciaImportSchema.safeParse(ocorrencia);
    expect(resultado.success).toBe(true);
  });
});
