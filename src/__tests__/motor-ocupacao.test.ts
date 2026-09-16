import { describe, it, expect } from "vitest";
import {
  calcularStatusDia,
  PostoOperacional,
  OcorrenciaOperacional,
  CoberturaOperacional,
} from "@/lib/dados/estado-operacional";

describe("Motor de Consolidação de Ocupação Diária", () => {
  const posto5x2: PostoOperacional = {
    id: "pst-teste-1",
    codigoPosto: "PST-TESTE-001",
    funcao: "Almoxarife",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: "PRM-99901",
    titularNome: "Colaborador Teste",
    situacao: "ATIVO",
    dataInicioVigencia: "2024-01-01",
  };

  it("deve identificar POSTO_VAGO quando posto não possui titular", () => {
    const postoVago: PostoOperacional = { ...posto5x2, titularMatricula: undefined, titularNome: undefined };
    const resultado = calcularStatusDia(postoVago, 1, 2026, 8);
    expect(resultado.statusOcupacao).toBe("POSTO_VAGO");
  });

  it("deve identificar NAO_EXIGIVEL em finais de semana para escala 5x2", () => {
    // 06/09/2026 é Domingo
    const resultadoDomingo = calcularStatusDia(posto5x2, 6, 2026, 8);
    expect(resultadoDomingo.statusOcupacao).toBe("NAO_EXIGIVEL");

    // 05/09/2026 é Sábado
    const resultadoSabado = calcularStatusDia(posto5x2, 5, 2026, 8);
    expect(resultadoSabado.statusOcupacao).toBe("NAO_EXIGIVEL");
  });

  it("deve identificar NAO_EXIGIVEL no Feriado Nacional de 07/09/2026", () => {
    const resultado = calcularStatusDia(posto5x2, 7, 2026, 8);
    expect(resultado.statusOcupacao).toBe("NAO_EXIGIVEL");
    expect(resultado.motivoPublico).toContain("Feriado Nacional");
  });

  it("deve identificar TITULAR_PRESENTE em dia normal de trabalho", () => {
    // 01/09/2026 é Terça-feira (dia útil normal)
    const resultado = calcularStatusDia(posto5x2, 1, 2026, 8);
    expect(resultado.statusOcupacao).toBe("TITULAR_PRESENTE");
    expect(resultado.ocupanteMatricula).toBe("PRM-99901");
  });

  it("deve identificar DESCOBERTO quando titular tem ocorrência e NÃO há cobertura", () => {
    const ocorrencias: OcorrenciaOperacional[] = [
      {
        id: "oco-test",
        matricula: "PRM-99901",
        profissionalNome: "Colaborador Teste",
        postoCodigo: "PST-TESTE-001",
        tipoOcorrencia: "FALTA_INJUSTIFICADA",
        dataInicio: "2026-09-02",
        dataFim: "2026-09-02",
        diasAfetados: 1,
        status: "VALIDADA",
        observacaoPublica: "Falta injustificada",
        criadoEm: "2026-09-02 08:00",
      },
    ];

    const resultado = calcularStatusDia(posto5x2, 2, 2026, 8, ocorrencias, []);
    expect(resultado.statusOcupacao).toBe("DESCOBERTO");
  });

  it("deve identificar COBERTO quando titular tem ocorrência e HÁ cobertura confirmada", () => {
    const ocorrencias: OcorrenciaOperacional[] = [
      {
        id: "oco-test",
        matricula: "PRM-99901",
        profissionalNome: "Colaborador Teste",
        postoCodigo: "PST-TESTE-001",
        tipoOcorrencia: "ATESTADO_MEDICO",
        dataInicio: "2026-09-03",
        dataFim: "2026-09-03",
        diasAfetados: 1,
        status: "VALIDADA",
        observacaoPublica: "Atestado homologado",
        criadoEm: "2026-09-03 08:00",
      },
    ];

    const coberturas: CoberturaOperacional[] = [
      {
        id: "cob-test",
        postoCodigo: "PST-TESTE-001",
        funcaoPosto: "Almoxarife",
        titularMatricula: "PRM-99901",
        titularNome: "Colaborador Teste",
        substitutoMatricula: "PRM-99902",
        substitutoNome: "Substituto Teste",
        dataInicio: "2026-09-03",
        dataFim: "2026-09-03",
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        status: "CONFIRMADA",
        justificativa: "Cobertura de atestado médico",
        criadoEm: "2026-09-03 08:30",
      },
    ];

    const resultado = calcularStatusDia(posto5x2, 3, 2026, 8, ocorrencias, coberturas);
    expect(resultado.statusOcupacao).toBe("COBERTO");
    expect(resultado.ocupanteMatricula).toBe("PRM-99902");
    expect(resultado.ocupanteNome).toBe("Substituto Teste");
  });

  it("deve identificar PENDENTE_APURACAO para dias futuros da competência", () => {
    // 25/09/2026 é dia futuro (> 15)
    // 25/09/2026 é Sexta-feira
    const resultado = calcularStatusDia(posto5x2, 25, 2026, 8);
    expect(resultado.statusOcupacao).toBe("PENDENTE_APURACAO");
  });
});
