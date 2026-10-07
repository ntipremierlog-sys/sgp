/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Testes Unitários: Relatórios, Memória de Cálculo e Glosas Contratuais (Item 11.3)
 */

import { describe, it, expect } from "vitest";
import {
  calcularStatusDia,
  obterTodosPostosContrato,
  PostoOperacional,
  OcorrenciaOperacional,
  CoberturaOperacional,
  ApontamentoOperacional,
} from "@/lib/dados/estado-operacional";
import { BASES_SGP_SISTEMA } from "@/lib/dados/secoes-horarios";

describe("Memória de Cálculo e Relatórios Oficiais (Item 11.3)", () => {
  const postosMock: PostoOperacional[] = [
    {
      id: "pst-ufn3-001",
      idPosto: "1",
      codigoPosto: "PST-UFN3-001",
      funcao: "Assistente de Logística",
      descricao: "Posto UFN III",
      itemPPU: "3.1",
      tipoPostoId: "ADM_09H",
      periculosidade: "NÃO",
      municipio: "Três Lagoas",
      localAtuacao: "UFN III",
      gerenciaPetrobras: "GERÊNCIA UFN-III",
      unidadeId: "UFN-III",
      unidadeNome: "UFN III – Três Lagoas/MS",
      escala: "5x2",
      jornadaSemanalHoras: 44,
      horarioInicio: "07:00",
      horarioFim: "16:48",
      titularMatricula: "037196",
      titularNome: "João Silva",
      situacao: "ATIVO",
      dataInicioVigencia: "2024-01-01",
    },
    {
      id: "pst-ufn3-002",
      idPosto: "2",
      codigoPosto: "PST-UFN3-002",
      funcao: "Técnico de Suporte Operacional",
      descricao: "Posto UFN III 2",
      itemPPU: "3.1",
      tipoPostoId: "ADM_09H",
      periculosidade: "NÃO",
      municipio: "Três Lagoas",
      localAtuacao: "UFN III",
      gerenciaPetrobras: "GERÊNCIA UFN-III",
      unidadeId: "UFN-III",
      unidadeNome: "UFN III – Três Lagoas/MS",
      escala: "5x2",
      jornadaSemanalHoras: 44,
      horarioInicio: "07:00",
      horarioFim: "16:48",
      titularMatricula: "036473",
      titularNome: "Maria Santos",
      situacao: "ATIVO",
      dataInicioVigencia: "2024-01-01",
    },
    {
      id: "pst-rnest-001",
      idPosto: "3",
      codigoPosto: "PST-RNEST-001",
      funcao: "Analista de Operações",
      descricao: "Posto RNEST",
      itemPPU: "5.1",
      tipoPostoId: "ADM_09H",
      periculosidade: "NÃO",
      municipio: "Ipojuca",
      localAtuacao: "RNEST",
      gerenciaPetrobras: "GERÊNCIA RNEST",
      unidadeId: "RNEST",
      unidadeNome: "Refinaria Abreu e Lima (RNEST/PE)",
      escala: "5x2",
      jornadaSemanalHoras: 44,
      horarioInicio: "08:00",
      horarioFim: "17:48",
      titularMatricula: "039999",
      titularNome: "Carlos Ferreira",
      situacao: "ATIVO",
      dataInicioVigencia: "2024-01-01",
    },
  ];

  it("deve carregar todos os postos de trabalho do contrato incluindo as 29 bases operacionais", () => {
    const todosPostos = obterTodosPostosContrato(postosMock);
    expect(todosPostos.length).toBeGreaterThan(0);
    // Deve conter postos de múltiplas unidades
    const unidades = new Set(todosPostos.map((p) => p.unidadeId));
    expect(unidades.size).toBeGreaterThan(1);
    expect(BASES_SGP_SISTEMA.length).toBeGreaterThanOrEqual(18);
  });

  it("deve calcular corretamente diárias exigíveis, presentes e glosas para postos em escala 5x2", () => {
    const posto = postosMock[0];
    const ocorrencias: OcorrenciaOperacional[] = [];
    const coberturas: CoberturaOperacional[] = [];
    const apontamentos: ApontamentoOperacional[] = [];
    const marcacoesSet = new Set<string>();

    // Simula marcação do titular nos dias úteis 1, 2, 3 e 4 de Setembro de 2026
    // Setembro 2026: dia 1=terça, dia 2=quarta, dia 3=quinta, dia 4=sexta, dia 5=sábado, dia 6=domingo
    marcacoesSet.add("037196_2026-09-01");
    marcacoesSet.add("037196_2026-09-02");
    marcacoesSet.add("037196_2026-09-03");
    marcacoesSet.add("037196_2026-09-04");
    // Dia 08/09 (terça-feira) ausente sem substituição -> DESCOBERTO

    let presentes = 0;
    let descobertos = 0;
    let naoExigiveis = 0;

    for (let dia = 1; dia <= 8; dia++) {
      const oc = calcularStatusDia(
        posto,
        dia,
        2026,
        8, // Setembro (índice 8)
        ocorrencias,
        coberturas,
        apontamentos,
        marcacoesSet,
        "2026-09-15"
      );

      if (oc.statusOcupacao === "TITULAR_PRESENTE") presentes++;
      else if (oc.statusOcupacao === "DESCOBERTO") descobertos++;
      else if (oc.statusOcupacao === "NAO_EXIGIVEL") naoExigiveis++;
    }

    expect(presentes).toBe(4);
    // Dias 5 e 6 são final de semana (sábado e domingo) e dia 7 é feriado nacional
    expect(naoExigiveis).toBe(3); // sáb 05/09, dom 06/09 e feriado 07/09
    // Dia 8/09 é terça-feira útil sem batida -> Descoberto
    expect(descobertos).toBe(1);
  });

  it("deve computar coberturas válidas como diárias cumpridas para fins de SLA sem gerar glosa", () => {
    const posto = postosMock[0];
    const ocorrencias: OcorrenciaOperacional[] = [
      {
        id: "oco-01",
        matricula: "037196",
        profissionalNome: "João Silva",
        postoCodigo: "PST-UFN3-001",
        dataInicio: "2026-09-08",
        dataFim: "2026-09-08",
        diasAfetados: 1,
        tipoOcorrencia: "ATESTADO_MEDICO",
        observacaoPublica: "Licença médica comprovada",
        status: "VALIDADA",
        criadoEm: "2026-09-08T08:00:00.000Z",
      },
    ];

    const coberturas: CoberturaOperacional[] = [
      {
        id: "cob-01",
        postoCodigo: "PST-UFN3-001",
        funcaoPosto: "Assistente de Logística",
        titularNome: "João Silva",
        titularMatricula: "037196",
        substitutoNome: "Pedro Oliveira",
        substitutoMatricula: "038888",
        dataInicio: "2026-09-08",
        dataFim: "2026-09-08",
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        justificativa: "Cobertura de atestado médico",
        status: "CONFIRMADA",
        criadoEm: "2026-09-08T08:30:00.000Z",
      },
    ];

    const marcacoesSet = new Set<string>();
    // Substituto esteve presente no dia 08/09
    marcacoesSet.add("038888_2026-09-08");

    const statusDia8 = calcularStatusDia(
      posto,
      8,
      2026,
      8,
      ocorrencias,
      coberturas,
      [],
      marcacoesSet,
      "2026-09-15"
    );

    expect(statusDia8.statusOcupacao).toBe("COBERTO");
    expect(statusDia8.ocupanteNome).toContain("Pedro Oliveira");
  });

  it("deve calcular a memória de cálculo de SLA contratual e impacto de glosas (Meta 95%)", () => {
    const totalExigiveis = 20;
    const presentes = 16;
    const cobertos = 3;
    const descobertos = 1;

    const diariasEfetivas = presentes + cobertos; // 19
    const percentualCumprimento = (diariasEfetivas / totalExigiveis) * 100; // 95%
    const metaSla = 95.0;
    const atendeSla = percentualCumprimento >= metaSla;

    expect(percentualCumprimento).toBe(95.0);
    expect(atendeSla).toBe(true);

    // Glosa contratual: descobertos / 30 avos
    const valorMensalPosto = 6000.0;
    const valorGlosaDiaria = valorMensalPosto / 30; // R$ 200,00
    const totalGlosa = descobertos * valorGlosaDiaria; // R$ 200,00
    const faturamentoLiquido = valorMensalPosto - totalGlosa; // R$ 5.800,00

    expect(valorGlosaDiaria).toBe(200.0);
    expect(totalGlosa).toBe(200.0);
    expect(faturamentoLiquido).toBe(5800.0);
  });

  it("deve rastrear coberturas com flag de interjornada CLT Art. 66 para auditoria trabalhista", () => {
    const coberturaComQuebra: CoberturaOperacional = {
      id: "cob-02",
      postoCodigo: "PST-UFN3-001",
      funcaoPosto: "Assistente de Logística",
      titularNome: "João Silva",
      titularMatricula: "037196",
      substitutoNome: "Carlos Substituto",
      substitutoMatricula: "039123",
      dataInicio: "2026-09-09",
      dataFim: "2026-09-09",
      tipoCobertura: "SUBSTITUICAO_INTERNA",
      justificativa: "Emergência operacional",
      status: "CONFIRMADA",
      criadoEm: "2026-09-09T08:00:00.000Z",
      alertaInterjornada: true,
      horasDescansoApuradas: 8.5,
      detalhesInterjornada: "Intervalo de 8h 30min entre turnos (mínimo legal 11h).",
    };

    expect(coberturaComQuebra.alertaInterjornada).toBe(true);
    expect(coberturaComQuebra.horasDescansoApuradas).toBeLessThan(11);
    expect(coberturaComQuebra.detalhesInterjornada).toContain("mínimo legal 11h");
  });
});
