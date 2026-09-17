/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Testes Automatizados para Apuração Diária de Presença e Situação de Postos
 *
 * Validação rigorosa das 9 prioridades, jornadas noturnas, fusos horários,
 * escalas cíclicas e cruzamento de postos do Anexo 1-A.
 */

import { describe, it, expect } from "vitest";
import {
  apurarPresencaEPostos,
  ColaboradorParaApuracao,
  OcorrenciaParaApuracao,
  CoberturaParaApuracao,
  PostoParaApuracao,
} from "@/lib/servicos/apuracao-presenca";
import { MarcacaoPontoOriginal } from "@/lib/dados/ponto-tipos";
import { HorarioInterpretado, CicloEscalaColaborador } from "@/lib/dados/ponto-tipos";

describe("Momento 4 — Apuração Diária de Presença e Cobertura de Postos", () => {
  // Base fictícia de colaboradores
  const colaboradores: ColaboradorParaApuracao[] = [
    {
      id: "colab-titular-01",
      chapa: "037196",
      matricula: "037196",
      nome: "Carlos Augusto Silva",
      cpfMascarado: "***.031.915-**",
      cpfLimpo: "07503191511",
      unidadeId: "UFN-III",
      postoCodigo: "PST-ALM-001",
      funcao: "Almoxarife",
      situacao: "ATIVO",
      dataAdmissao: "2025-01-01",
      horarioCodigo: "1389",
      horarioDescricao: "07:00 AS 16:48 - SEG/SEX",
    },
    {
      id: "colab-substituto-01",
      chapa: "036830",
      matricula: "036830",
      nome: "Roberto Mendes Souza",
      cpfMascarado: "***.140.647-**",
      cpfLimpo: "09414064745",
      unidadeId: "UFN-III",
      funcao: "Almoxarife Substituto",
      situacao: "ATIVO",
      dataAdmissao: "2025-01-01",
      horarioCodigo: "1389",
      horarioDescricao: "07:00 AS 16:48 - SEG/SEX",
    },
    {
      id: "colab-noturno-01",
      chapa: "036475",
      matricula: "036475",
      nome: "Marcos Vinicius Turno",
      cpfMascarado: "***.542.487-**",
      cpfLimpo: "12154248764",
      unidadeId: "EDIHB",
      postoCodigo: "PST-NOT-002",
      funcao: "Operador Noturno",
      situacao: "ATIVO",
      dataAdmissao: "2025-01-01",
      horarioCodigo: "1443",
      horarioDescricao: "PETROBRAS - 18:30 AS 06:30 - ESCALA 4X4",
    },
    {
      id: "colab-demitido-01",
      chapa: "036999",
      matricula: "036999",
      nome: "Demitido Teste",
      cpfMascarado: "***.999.888-**",
      cpfLimpo: "99988877766",
      unidadeId: "UFN-III",
      funcao: "Assistente",
      situacao: "DESLIGADO",
      dataAdmissao: "2025-01-01",
      dataDesligamento: "2026-08-25",
    },
  ];

  const postos: PostoParaApuracao[] = [
    {
      codigoPosto: "PST-ALM-001",
      funcao: "Almoxarife",
      unidadeId: "UFN-III",
      unidadeNome: "UFN III",
      titularMatricula: "037196",
      titularNome: "Carlos Augusto Silva",
      situacao: "ATIVO",
      horarioInicio: "07:00",
      horarioFim: "16:48",
      escala: "5x2",
    },
    {
      codigoPosto: "PST-VAGO-003",
      funcao: "Operador Empilhadeira",
      unidadeId: "UFN-III",
      unidadeNome: "UFN III",
      titularMatricula: undefined,
      situacao: "ATIVO",
      horarioInicio: "07:00",
      horarioFim: "16:48",
      escala: "5x2",
    },
  ];

  it("deve apurar PRESENTE quando houver entrada e saída associadas à jornada", () => {
    const marcacoes: MarcacaoPontoOriginal[] = [
      {
        id: "m1",
        loteId: "L1",
        arquivoOrigem: "ponto.xlsx",
        colaboradorId: "colab-titular-01",
        chapa: "037196",
        cpfLimpo: "07503191511",
        dataHoraUtc: "2026-08-31T11:00:00.000Z",
        dataLocal: "2026-08-31",
        horaLocal: "07:00",
        importadoEm: "2026-08-31",
      },
      {
        id: "m2",
        loteId: "L1",
        arquivoOrigem: "ponto.xlsx",
        colaboradorId: "colab-titular-01",
        chapa: "037196",
        cpfLimpo: "07503191511",
        dataHoraUtc: "2026-08-31T20:50:00.000Z",
        dataLocal: "2026-08-31",
        horaLocal: "16:50",
        importadoEm: "2026-08-31",
      },
    ];

    const res = apurarPresencaEPostos(
      colaboradores,
      marcacoes,
      [],
      [],
      postos,
      {
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        dataReferenciaUltimoLote: "2026-08-31 23:59",
      }
    );

    const apTitular = res.apuracoesPorColaboradorDia.find((a) => a.chapa === "037196");
    expect(apTitular?.situacao).toBe("PRESENTE");
    expect(res.mapaPostosDia.get("PST-ALM-001_2026-08-31")).toBe("P");
  });

  it("deve apurar MARCACAO_INCOMPLETA quando houver apenas 1 batida no dia", () => {
    const marcacoes: MarcacaoPontoOriginal[] = [
      {
        id: "m1",
        loteId: "L1",
        arquivoOrigem: "ponto.xlsx",
        colaboradorId: "colab-titular-01",
        chapa: "037196",
        cpfLimpo: "07503191511",
        dataHoraUtc: "2026-08-31T11:00:00.000Z",
        dataLocal: "2026-08-31",
        horaLocal: "07:00",
        importadoEm: "2026-08-31",
      },
    ];

    const res = apurarPresencaEPostos(
      colaboradores,
      marcacoes,
      [],
      [],
      postos,
      {
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        dataReferenciaUltimoLote: "2026-08-31 23:59",
      }
    );

    const apTitular = res.apuracoesPorColaboradorDia.find((a) => a.chapa === "037196");
    expect(apTitular?.situacao).toBe("MARCACAO_INCOMPLETA");
    // Gera pendência de marcação incompleta
    expect(res.pendencias.some((p) => p.tipo === "MARCACAO_INCOMPLETA" && p.chapa === "037196")).toBe(true);
    // Posto exibe P com indicador de marcação incompleta
    expect(res.mapaPostosDia.get("PST-ALM-001_2026-08-31")).toBe("P");
  });

  it("deve apurar AUSENCIA_JUSTIFICADA quando o colaborador possuir abono cobrindo o dia", () => {
    const ocorrencias: OcorrenciaParaApuracao[] = [
      {
        id: "oc-abono-01",
        matricula: "037196",
        tipoOcorrencia: "ATESTADO_MEDICO",
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        status: "VALIDADA",
        observacaoPublica: "Atestado médico de 1 dia",
      },
    ];

    const res = apurarPresencaEPostos(
      colaboradores,
      [], // Sem batidas
      ocorrencias,
      [],
      postos,
      {
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        dataReferenciaUltimoLote: "2026-08-31 23:59",
      }
    );

    const apTitular = res.apuracoesPorColaboradorDia.find((a) => a.chapa === "037196");
    expect(apTitular?.situacao).toBe("AUSENCIA_JUSTIFICADA");
    expect(apTitular?.abonoVinculado?.tipoOcorrencia).toBe("ATESTADO_MEDICO");
  });

  it("deve apurar COBERTO (C) no posto quando titular faltar mas substituto na cobertura estiver PRESENTE", () => {
    const ocorrencias: OcorrenciaParaApuracao[] = [
      {
        id: "oc-abono-01",
        matricula: "037196", // Titular ausente
        tipoOcorrencia: "ATESTADO_MEDICO",
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        status: "VALIDADA",
        observacaoPublica: "Atestado médico",
      },
    ];

    const coberturas: CoberturaParaApuracao[] = [
      {
        id: "cob-01",
        postoCodigo: "PST-ALM-001",
        titularMatricula: "037196",
        substitutoMatricula: "036830",
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        status: "CONFIRMADA",
      },
    ];

    // Substituto Roberto bateu ponto
    const marcacoes: MarcacaoPontoOriginal[] = [
      {
        id: "sub-1",
        loteId: "L1",
        arquivoOrigem: "ponto.xlsx",
        colaboradorId: "colab-substituto-01",
        chapa: "036830",
        cpfLimpo: "09414064745",
        dataHoraUtc: "2026-08-31T11:00:00.000Z",
        dataLocal: "2026-08-31",
        horaLocal: "07:00",
        importadoEm: "2026-08-31",
      },
      {
        id: "sub-2",
        loteId: "L1",
        arquivoOrigem: "ponto.xlsx",
        colaboradorId: "colab-substituto-01",
        chapa: "036830",
        cpfLimpo: "09414064745",
        dataHoraUtc: "2026-08-31T20:48:00.000Z",
        dataLocal: "2026-08-31",
        horaLocal: "16:48",
        importadoEm: "2026-08-31",
      },
    ];

    const res = apurarPresencaEPostos(
      colaboradores,
      marcacoes,
      ocorrencias,
      coberturas,
      postos,
      {
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        dataReferenciaUltimoLote: "2026-08-31 23:59",
      }
    );

    expect(res.mapaPostosDia.get("PST-ALM-001_2026-08-31")).toBe("C");
  });

  it("deve apurar DESCOBERTO (D) no posto quando titular faltar e NÃO houver substituto presente", () => {
    // Sem marcações e sem coberturas
    const res = apurarPresencaEPostos(
      colaboradores,
      [],
      [],
      [],
      postos,
      {
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        dataReferenciaUltimoLote: "2026-08-31 23:59",
      }
    );

    const apTitular = res.apuracoesPorColaboradorDia.find((a) => a.chapa === "037196");
    expect(apTitular?.situacao).toBe("FALTA");
    expect(res.mapaPostosDia.get("PST-ALM-001_2026-08-31")).toBe("D");
  });

  it("deve apurar SEM DADO (?) para dias posteriores à data do último lote de ponto (NUNCA falta)", () => {
    // Lote de ponto vai até 15/09. Dia 16/09 deve ser SEM_DADO
    const res = apurarPresencaEPostos(
      colaboradores,
      [],
      [],
      [],
      postos,
      {
        dataInicio: "2026-09-16",
        dataFim: "2026-09-16",
        dataReferenciaUltimoLote: "2026-09-15 23:59",
      }
    );

    const apTitular = res.apuracoesPorColaboradorDia.find((a) => a.chapa === "037196");
    expect(apTitular?.situacao).toBe("SEM_DADO");
    expect(res.mapaPostosDia.get("PST-ALM-001_2026-09-16")).toBe("?");
  });

  it("deve apurar ESCALA_NAO_CONFIRMADA em escala cíclica sem data-base confirmada (sem gerar falta)", () => {
    // Colaborador noturno 036475 em escala 4x4 sem data-base confirmada
    const res = apurarPresencaEPostos(
      colaboradores,
      [],
      [],
      [],
      postos,
      {
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        dataReferenciaUltimoLote: "2026-08-31 23:59",
      }
    );

    const apNoturno = res.apuracoesPorColaboradorDia.find((a) => a.chapa === "036475");
    expect(apNoturno?.situacao).toBe("ESCALA_NAO_CONFIRMADA");
    expect(res.pendencias.some((p) => p.tipo === "ESCALA_NAO_CONFIRMADA" && p.chapa === "036475")).toBe(true);
  });

  it("deve associar corretamente a jornada noturna (18:30 às 06:30) às marcações da madrugada do dia seguinte", () => {
    // Colaborador noturno 036475 com data-base confirmada em 2026-08-28
    const ciclos: CicloEscalaColaborador[] = [
      {
        colaboradorId: "colab-noturno-01",
        chapa: "036475",
        horarioCodigo: "1443",
        dataBaseCiclo: "2026-08-28", // Dia 0 do ciclo 4x4
        confirmado: true,
      },
    ];

    // Horário 1443: 18:30 às 06:30 (Noturno)
    const horarios: HorarioInterpretado[] = [
      {
        codigoHorario: "1443",
        descricaoRm: "PETROBRAS - 18:30 AS 06:30 - ESCALA 4X4",
        tipoEscala: "4X4",
        atravessaMeiaNoite: true,
        horaEntradaPadrao: "18:30",
        horaSaidaPadrao: "06:30",
        confirmado: true,
        atualizadoEm: "2026-08-01",
        atualizadoPor: "Admin",
      },
    ];

    // Entrada às 18:25 em 31/08, saída às 06:35 da manhã de 01/09
    const marcacoes: MarcacaoPontoOriginal[] = [
      {
        id: "not-1",
        loteId: "L1",
        arquivoOrigem: "ponto.xlsx",
        colaboradorId: "colab-noturno-01",
        chapa: "036475",
        cpfLimpo: "12154248764",
        dataHoraUtc: "2026-08-31T21:25:00.000Z",
        dataLocal: "2026-08-31",
        horaLocal: "18:25",
        importadoEm: "2026-08-31",
      },
      {
        id: "not-2",
        loteId: "L1",
        arquivoOrigem: "ponto.xlsx",
        colaboradorId: "colab-noturno-01",
        chapa: "036475",
        cpfLimpo: "12154248764",
        dataHoraUtc: "2026-09-01T09:35:00.000Z",
        dataLocal: "2026-09-01",
        horaLocal: "06:35",
        importadoEm: "2026-08-31",
      },
    ];

    const res = apurarPresencaEPostos(
      colaboradores,
      marcacoes,
      [],
      [],
      postos,
      {
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        dataReferenciaUltimoLote: "2026-09-02 12:00",
      },
      horarios,
      ciclos
    );

    const apNoturno = res.apuracoesPorColaboradorDia.find((a) => a.chapa === "036475");
    expect(apNoturno?.situacao).toBe("PRESENTE");
    // Ambas as marcações (18:25 de 31/08 e 06:35 de 01/09) associadas à jornada de 31/08
    expect(apNoturno?.marcacoesDoDia.length).toBe(2);
  });

  it("deve sinalizar atraso quando a entrada for superior a 10 minutos após o horário previsto", () => {
    // Entrada às 07:15 (horário previsto: 07:00, tolerância: 10 min)
    const marcacoes: MarcacaoPontoOriginal[] = [
      {
        id: "m1",
        loteId: "L1",
        arquivoOrigem: "ponto.xlsx",
        colaboradorId: "colab-titular-01",
        chapa: "037196",
        cpfLimpo: "07503191511",
        dataHoraUtc: "2026-08-31T11:15:00.000Z",
        dataLocal: "2026-08-31",
        horaLocal: "07:15",
        importadoEm: "2026-08-31",
      },
      {
        id: "m2",
        loteId: "L1",
        arquivoOrigem: "ponto.xlsx",
        colaboradorId: "colab-titular-01",
        chapa: "037196",
        cpfLimpo: "07503191511",
        dataHoraUtc: "2026-08-31T20:48:00.000Z",
        dataLocal: "2026-08-31",
        horaLocal: "16:48",
        importadoEm: "2026-08-31",
      },
    ];

    const res = apurarPresencaEPostos(
      colaboradores,
      marcacoes,
      [],
      [],
      postos,
      {
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        dataReferenciaUltimoLote: "2026-08-31 23:59",
      }
    );

    const apTitular = res.apuracoesPorColaboradorDia.find((a) => a.chapa === "037196");
    expect(apTitular?.situacao).toBe("PRESENTE");
    expect(apTitular?.indicadores.entradaAposHorario).toBe(true);
  });

  it("deve identificar posto vago (V) quando não houver titular alocado", () => {
    const res = apurarPresencaEPostos(
      colaboradores,
      [],
      [],
      [],
      postos,
      {
        dataInicio: "2026-08-31",
        dataFim: "2026-08-31",
        dataReferenciaUltimoLote: "2026-08-31 23:59",
      }
    );

    expect(res.mapaPostosDia.get("PST-VAGO-003_2026-08-31")).toBe("V");
  });
});
