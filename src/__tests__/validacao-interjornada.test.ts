import { describe, it, expect } from "vitest";
import {
  validarInterjornadaClt,
  formatarHorasMinutos,
  formatarDataBr,
  subtrairDias,
} from "@/lib/servicos/validacao-interjornada";
import {
  PostoOperacional,
  ProfissionalOperacional,
  CoberturaOperacional,
} from "@/lib/dados/estado-operacional";
import { MarcacaoPontoOriginal } from "@/lib/dados/ponto-tipos";

describe("Validação de Interjornada CLT Artigo 66 (Mínimo de 11 Horas)", () => {
  const postosMock: PostoOperacional[] = [
    {
      id: "pst-001",
      idPosto: "1",
      codigoPosto: "PST-ALM-001",
      funcao: "Almoxarife Líder",
      itemPPU: "3.1",
      tipoPostoId: "ADM_09H",
      periculosidade: "NÃO",
      municipio: "Três Lagoas",
      localAtuacao: "UFN III",
      gerenciaPetrobras: "GERÊNCIA UFN-III",
      unidadeId: "UFN-III",
      unidadeNome: "Unidade de Fertilizantes do Nordeste III",
      escala: "5x2",
      jornadaSemanalHoras: 44,
      horarioInicio: "07:00",
      horarioFim: "16:48",
      situacao: "ATIVO",
      dataInicioVigencia: "2024-01-01",
    },
    {
      id: "pst-noturno",
      idPosto: "2",
      codigoPosto: "PST-NOT-002",
      funcao: "Vigilante / Operador Noturno",
      itemPPU: "3.2",
      tipoPostoId: "TURNO_12H",
      periculosidade: "SIM",
      municipio: "Três Lagoas",
      localAtuacao: "UFN III",
      gerenciaPetrobras: "GERÊNCIA UFN-III",
      unidadeId: "UFN-III",
      unidadeNome: "Unidade de Fertilizantes do Nordeste III",
      escala: "12x36",
      jornadaSemanalHoras: 44,
      horarioInicio: "18:00",
      horarioFim: "06:00", // Atravessa meia-noite
      situacao: "ATIVO",
      dataInicioVigencia: "2024-01-01",
    },
    {
      id: "pst-tarde",
      idPosto: "3",
      codigoPosto: "PST-TAR-003",
      funcao: "Operador de Logística Tarde",
      itemPPU: "3.1",
      tipoPostoId: "ADM_09H",
      periculosidade: "NÃO",
      municipio: "Três Lagoas",
      localAtuacao: "UFN III",
      gerenciaPetrobras: "GERÊNCIA UFN-III",
      unidadeId: "UFN-III",
      unidadeNome: "Unidade de Fertilizantes do Nordeste III",
      escala: "5x2",
      jornadaSemanalHoras: 44,
      horarioInicio: "13:00",
      horarioFim: "22:00",
      situacao: "ATIVO",
      dataInicioVigencia: "2024-01-01",
    },
  ];

  const profissionaisMock: ProfissionalOperacional[] = [
    {
      id: "prf-001",
      chapa: "046082",
      matricula: "046082",
      nome: "Carlos Eduardo Silva",
      cpfMascarado: "***.000.001-**",
      cpfLimpo: "00000000001",
      funcao: "Almoxarife",
      unidadeId: "UFN-III",
      escala: "5x2",
      situacao: "ATIVO",
      postoCodigo: "PST-ALM-001",
      dataAdmissao: "2024-01-01",
    },
    {
      id: "prf-002",
      chapa: "037606",
      matricula: "037606",
      nome: "Marcos Vinicius Santos",
      cpfMascarado: "***.000.002-**",
      cpfLimpo: "00000000002",
      funcao: "Operador Noturno",
      unidadeId: "UFN-III",
      escala: "12x36",
      situacao: "ATIVO",
      postoCodigo: "PST-NOT-002",
      dataAdmissao: "2024-01-01",
    },
    {
      id: "prf-003",
      chapa: "045638",
      matricula: "045638",
      nome: "Ana Paula Souza",
      cpfMascarado: "***.000.003-**",
      cpfLimpo: "00000000003",
      funcao: "Reserva Técnica",
      unidadeId: "UFN-III",
      escala: "5x2",
      situacao: "ATIVO",
      postoCodigo: undefined, // Reserva técnica
      dataAdmissao: "2024-01-01",
    },
    {
      id: "prf-004",
      chapa: "046236",
      matricula: "046236",
      nome: "Roberto Mendes",
      cpfMascarado: "***.000.004-**",
      cpfLimpo: "00000000004",
      funcao: "Operador Tarde",
      unidadeId: "UFN-III",
      escala: "5x2",
      situacao: "ATIVO",
      postoCodigo: "PST-TAR-003",
      dataAdmissao: "2024-01-01",
    },
  ];

  it("deve aprovar (conforme) quando o colaborador tem mais de 11 horas de descanso entre jornadas", () => {
    // Carlos trabalha das 07:00 às 16:48.
    // Em 15/09 às 07:00, o turno anterior em 14/09 terminou às 16:48.
    // Descanso = 14h 12min (>= 11h)
    const resultado = validarInterjornadaClt({
      matricula: "046082",
      dataInicio: "2026-09-15",
      postoDestinoCodigo: "PST-ALM-001",
      postos: postosMock,
      profissionais: profissionaisMock,
    });

    expect(resultado.atende).toBe(true);
    expect(resultado.horasDescanso).toBeGreaterThanOrEqual(11.0);
    expect(resultado.deficitHoras).toBe(0);
    expect(resultado.severidade).toBe("REGULAR");
  });

  it("deve emitir alerta crítico quando colaborador de turno vespertino (sai às 22h) é designado para início às 07h do dia seguinte", () => {
    // Roberto Mendes trabalha no PST-TAR-003 que encerra às 22:00.
    // Se for designado para cobrir PST-ALM-001 em 15/09 com início às 07:00:
    // Das 22:00 do dia 14/09 até 07:00 do dia 15/09 = 9 horas de descanso (< 11h).
    const resultado = validarInterjornadaClt({
      matricula: "046236",
      dataInicio: "2026-09-15",
      postoDestinoCodigo: "PST-ALM-001",
      postos: postosMock,
      profissionais: profissionaisMock,
    });

    expect(resultado.atende).toBe(false);
    expect(resultado.severidade).toBe("ALERTA_CRITICO");
    expect(resultado.horasDescanso).toBeCloseTo(9.0, 1);
    expect(resultado.horasDescansoFormatado).toBe("9h 00min");
    expect(resultado.deficitHoras).toBeCloseTo(2.0, 1);
    expect(resultado.deficitFormatado).toBe("2h 00min");
    expect(resultado.mensagem).toContain("CLT Art. 66");
  });

  it("deve emitir alerta crítico quando colaborador sai de turno noturno (18h-06h) e assume posto matutino (07h)", () => {
    // Marcos Vinicius trabalha no PST-NOT-002 (18:00 às 06:00 do dia seguinte).
    // Se cobrir em 15/09 às 07:00, seu turno de 14/09 terminou em 15/09 às 06:00!
    // Descanso = 1h 00min (< 11h).
    const resultado = validarInterjornadaClt({
      matricula: "037606",
      dataInicio: "2026-09-15",
      postoDestinoCodigo: "PST-ALM-001",
      postos: postosMock,
      profissionais: profissionaisMock,
    });

    expect(resultado.atende).toBe(false);
    expect(resultado.severidade).toBe("ALERTA_CRITICO");
    expect(resultado.horasDescanso).toBeCloseTo(1.0, 1);
    expect(resultado.horasDescansoFormatado).toBe("1h 00min");
    expect(resultado.deficitHoras).toBeCloseTo(10.0, 1);
    expect(resultado.deficitFormatado).toBe("10h 00min");
  });

  it("deve detectar quebra de interjornada a partir de marcação de ponto real (RM / relógio)", () => {
    // Ana Paula (reserva técnica) teve marcação de ponto às 22:30 em 14/09.
    // Ao cobrir PST-ALM-001 às 07:00 em 15/09:
    // Das 22:30 às 07:00 = 8h 30min de descanso (déficit de 2h 30min).
    const marcacoes: MarcacaoPontoOriginal[] = [
      {
        id: "mk-1",
        loteId: "lote-1",
        arquivoOrigem: "CUBO.xlsx",
        colaboradorId: "prf-003",
        chapa: "045638",
        cpfLimpo: "12345678901",
        dataHoraUtc: "2026-09-15T01:30:00Z",
        dataLocal: "2026-09-14",
        horaLocal: "22:30",
        importadoEm: "2026-09-15",
      },
    ];

    const resultado = validarInterjornadaClt({
      matricula: "045638",
      dataInicio: "2026-09-15",
      postoDestinoCodigo: "PST-ALM-001",
      postos: postosMock,
      profissionais: profissionaisMock,
      marcacoesPonto: marcacoes,
    });

    expect(resultado.atende).toBe(false);
    expect(resultado.horasDescanso).toBeCloseTo(8.5, 1);
    expect(resultado.horasDescansoFormatado).toBe("8h 30min");
    expect(resultado.deficitHoras).toBeCloseTo(2.5, 1);
    expect(resultado.deficitFormatado).toBe("2h 30min");
    expect(resultado.ultimoTurnoFim?.origem).toBe("MARCACAO_PONTO");
  });

  it("deve detectar quebra de interjornada por cobertura prévia do colaborador", () => {
    // Ana Paula teve uma cobertura no posto PST-TAR-003 (termina às 22:00) em 14/09.
    // Ao cobrir PST-ALM-001 às 07:00 em 15/09:
    const coberturas: CoberturaOperacional[] = [
      {
        id: "cob-ant",
        postoCodigo: "PST-TAR-003",
        funcaoPosto: "Operador de Logística Tarde",
        substitutoMatricula: "045638",
        substitutoNome: "Ana Paula Souza",
        dataInicio: "2026-09-14",
        dataFim: "2026-09-14",
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        status: "CONFIRMADA",
        justificativa: "Cobertura anterior",
        criadoEm: "2026-09-14 10:00",
      },
    ];

    const resultado = validarInterjornadaClt({
      matricula: "045638",
      dataInicio: "2026-09-15",
      postoDestinoCodigo: "PST-ALM-001",
      postos: postosMock,
      profissionais: profissionaisMock,
      coberturas,
    });

    expect(resultado.atende).toBe(false);
    expect(resultado.horasDescanso).toBeCloseTo(9.0, 1);
    expect(resultado.deficitHoras).toBeCloseTo(2.0, 1);
    expect(resultado.ultimoTurnoFim?.origem).toBe("COBERTURA_ANTERIOR");
  });

  it("deve aprovar colaborador da reserva técnica sem marcações ou turnos nas últimas 48h", () => {
    const resultado = validarInterjornadaClt({
      matricula: "045638",
      dataInicio: "2026-09-15",
      postoDestinoCodigo: "PST-ALM-001",
      postos: postosMock,
      profissionais: profissionaisMock,
    });

    expect(resultado.atende).toBe(true);
    expect(resultado.horasDescanso).toBeGreaterThanOrEqual(24);
    expect(resultado.deficitHoras).toBe(0);
    expect(resultado.severidade).toBe("REGULAR");
  });

  it("deve formatar corretamente horas e minutos", () => {
    expect(formatarHorasMinutos(8.5)).toBe("8h 30min");
    expect(formatarHorasMinutos(11.0)).toBe("11h 00min");
    expect(formatarHorasMinutos(1.2)).toBe("1h 12min");
    expect(formatarHorasMinutos(0)).toBe("0h 00min");
  });

  it("deve formatar datas e subtrair dias corretamente", () => {
    expect(formatarDataBr("2026-09-15")).toBe("15/09/2026");
    expect(subtrairDias("2026-09-15", 1)).toBe("2026-09-14");
    expect(subtrairDias("2026-09-01", 1)).toBe("2026-08-31");
  });
});
