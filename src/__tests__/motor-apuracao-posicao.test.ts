import { describe, it, expect } from "vitest";
import {
  calcularStatusVagaDia,
  calcularStatusDia,
  calcularTotaisVagaCiclo,
  calcularApuracaoPostoCiclo,
  obterPosicoesCicloNaoConfigurado,
  obterPeriodoCicloPadrao,
  normalizarEscalaOperacional,
  verificarFeriadoBase,
  PostoOperacional,
  VagaPosto,
  AlocacaoVaga,
  OcorrenciaOperacional,
  CoberturaOperacional,
} from "@/lib/dados/estado-operacional";

describe("Motor de Apuração SGP — Posto → Posição → Alocação", () => {
  // Posto base Turno 24h
  const postoTurno24h: PostoOperacional = {
    id: "PST-BOAVENTURA-007",
    idPosto: "7",
    postoIdSGP: "PST-BOAVENTURA-007",
    idReferencia: 7,
    codigoPosto: "7",
    funcao: "Operador de Painel",
    itemPPU: "3.6",
    tipoPostoId: "TURNO_24H",
    periculosidade: "SIM",
    municipio: "Itaboraí",
    localAtuacao: "BOAVENTURA",
    unidadeId: "BOAVENTURA",
    unidadeNome: "BOAVENTURA",
    gerenciaPetrobras: "GERÊNCIA BOAVENTURA",
    escala: "4x4",
    jornadaSemanalHoras: 40,
    horarioInicio: "07:00",
    horarioFim: "19:00",
    situacao: "ATIVO",
    dataInicioVigencia: "2026-08-10",
  };

  // Posto base Adm 09h
  const postoAdm09h: PostoOperacional = {
    id: "PST-BOAVENTURA-002",
    idPosto: "2",
    postoIdSGP: "PST-BOAVENTURA-002",
    idReferencia: 2,
    codigoPosto: "2",
    funcao: "Assistente Administrativo",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Itaboraí",
    localAtuacao: "BOAVENTURA",
    unidadeId: "BOAVENTURA",
    unidadeNome: "BOAVENTURA",
    gerenciaPetrobras: "GERÊNCIA BOAVENTURA",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    situacao: "ATIVO",
    dataInicioVigencia: "2026-08-10",
  };

  // ===========================================================================
  // Passo 1 — Período do Ciclo
  // ===========================================================================
  describe("Passo 1 — Período de Acompanhamento do Ciclo", () => {
    it("deve gerar o ciclo padrão do dia 10 ao dia 09 do mês seguinte", () => {
      const ciclo = obterPeriodoCicloPadrao(2026, 8); // Ciclo de Agosto/Setembro 2026
      expect(ciclo.dataInicio).toBe("2026-08-10");
      expect(ciclo.dataFim).toBe("2026-09-09");
      expect(ciclo.datas[0]).toBe("2026-08-10");
      expect(ciclo.datas[ciclo.datas.length - 1]).toBe("2026-09-09");
      expect(ciclo.datas.length).toBe(31);
    });

    it("deve virar o ano corretamente no ciclo de Dezembro (10/12 a 09/01)", () => {
      const cicloVirada = obterPeriodoCicloPadrao(2026, 12);
      expect(cicloVirada.dataInicio).toBe("2026-12-10");
      expect(cicloVirada.dataFim).toBe("2027-01-09");
    });
  });

  // ===========================================================================
  // Passo 2 & Passo 8 — Apuração por (Posição, Dia)
  // ===========================================================================
  describe("Passo 2 e Passo 8 — Apuração por (Posição, Dia) e Dados Disponíveis", () => {
    const vagaPos: VagaPosto = {
      id: "POS-BOAVENTURA-007-01",
      idPosto: "PST-BOAVENTURA-007",
      sequencia: 1,
    };

    const alocacaoTitular: AlocacaoVaga = {
      id: "ALOC-0001",
      vagaId: "POS-BOAVENTURA-007-01",
      matricula: "036830",
      identificadorPetrobras: "72034968",
      nome: "CARLOS AUGUSTO VIEIRA",
      dataInicio: "2026-08-10",
      dataFim: null,
      horarioEscalaRm: "5x2",
      motivo: "titular",
    };

    it("deve identificar o ocupante vigente da data e disponibilizar todos os campos exigidos no Passo 8", () => {
      const marcacoes = new Set(["036830_2026-08-18"]); // Terça-feira
      const resultado = calcularStatusVagaDia(
        vagaPos,
        postoAdm09h,
        "2026-08-18",
        [alocacaoTitular],
        [],
        [],
        [],
        marcacoes
      );

      // Passo 8: Deixar disponível status, ocupante, tipoOcupacao, titularSubstituido, horarioPrevisto, batidas, ocorrencia
      expect(resultado.status).toBe("PRESENTE");
      expect(resultado.ocupante).toEqual({
        matricula: "036830",
        nome: "CARLOS AUGUSTO VIEIRA",
      });
      expect(resultado.tipoOcupacao).toBe("titular");
      expect(resultado.titularSubstituido).toBeUndefined();
      expect(resultado.horarioPrevisto).toBe("07:00 às 16:48");
      expect(resultado.batidas).toBeDefined();
      expect(resultado.batidas?.entrada).toBe("07:00");
    });
  });

  // ===========================================================================
  // Passo 3 — Exigibilidade por Escala e dataBaseCiclo
  // ===========================================================================
  describe("Passo 3 — Exigibilidade por Escala e Posições sem dataBaseCiclo", () => {
    it("deve normalizar corretamente as escalas textuais do RM", () => {
      expect(normalizarEscalaOperacional("Turno 12X36")).toBe("12x36");
      expect(normalizarEscalaOperacional("4X4 DIURNO")).toBe("4x4");
      expect(normalizarEscalaOperacional("4X2 REFINARIA")).toBe("4x2");
      expect(normalizarEscalaOperacional("6X1 OPERACIONAL")).toBe("6x1");
      expect(normalizarEscalaOperacional("SEG/SEX ADMINISTRATIVO")).toBe("5x2");
    });

    it("deve marcar 'CICLO_NAO_CONFIGURADO' quando posição em escala cíclica (4x4) não possui dataBaseCiclo", () => {
      const vagaSemCiclo: VagaPosto = {
        id: "POS-BOAVENTURA-007-01",
        idPosto: "PST-BOAVENTURA-007",
        sequencia: 1,
      };
      const alocSemCiclo: AlocacaoVaga = {
        id: "ALOC-0001",
        vagaId: "POS-BOAVENTURA-007-01",
        matricula: "036830",
        nome: "CARLOS AUGUSTO",
        dataInicio: "2026-08-10",
        dataFim: null,
        horarioEscalaRm: "4x4",
        motivo: "titular",
        // sem dataBaseCiclo
      };

      const resultado = calcularStatusVagaDia(
        vagaSemCiclo,
        { ...postoTurno24h, dataBaseCiclo: undefined },
        "2026-08-15",
        [alocSemCiclo]
      );

      expect(resultado.status).toBe("CICLO_NAO_CONFIGURADO");
      expect(resultado.motivoPublico).toContain("Ciclo não configurado");
      expect(resultado.exigivel).toBe(false);
    });

    it("deve listar posições sem ciclo configurado no relatório via obterPosicoesCicloNaoConfigurado", () => {
      const vagas = [
        { id: "POS-1", idPosto: "PST-1", sequencia: 1 },
        { id: "POS-2", idPosto: "PST-2", sequencia: 1, dataBaseCiclo: "2026-08-10" },
      ];
      const postos = [
        { ...postoTurno24h, idPosto: "PST-1", escala: "12x36", dataBaseCiclo: undefined },
        { ...postoTurno24h, idPosto: "PST-2", escala: "12x36", dataBaseCiclo: "2026-08-10" },
      ];
      const alocacoes = [
        { id: "A1", vagaId: "POS-1", matricula: "111", nome: "Sem Ciclo", dataInicio: "2026-08-10", motivo: "titular" as const },
        { id: "A2", vagaId: "POS-2", matricula: "222", nome: "Com Ciclo", dataInicio: "2026-08-10", dataBaseCiclo: "2026-08-10", motivo: "titular" as const },
      ];

      const relatorio = obterPosicoesCicloNaoConfigurado(vagas, postos, alocacoes, "2026-08-15");
      expect(relatorio.length).toBe(1);
      expect(relatorio[0].posicaoId).toBe("POS-1");
      expect(relatorio[0].escala).toBe("12x36");
    });
  });

  // ===========================================================================
  // Passo 4 — Feriados por Unidade
  // ===========================================================================
  describe("Passo 4 — Feriados Nacionais, Estaduais e Municipais por Unidade", () => {
    it("deve reconhecer feriado municipal específico da unidade (Aniversário de Itaboraí)", () => {
      const feriado = verificarFeriadoBase("2026-05-22", "BOAVENTURA", "Itaboraí");
      expect(feriado.ehFeriado).toBe(true);
      expect(feriado.feriado?.tipo).toBe("MUNICIPAL");
      expect(feriado.feriado?.nome).toContain("Itaboraí");
    });

    it("NÃO deve aplicar feriado municipal de outra cidade para a unidade atual", () => {
      // 2026-05-22 é feriado de Itaboraí, NÃO de Três Lagoas (UFN-III)
      const feriadoUfn = verificarFeriadoBase("2026-05-22", "UFN-III", "Três Lagoas");
      expect(feriadoUfn.ehFeriado).toBe(false);
    });

    it("deve aplicar feriado nacional em todas as unidades", () => {
      // 07/09/2026 - Independência do Brasil
      const feriadoBoaventura = verificarFeriadoBase("2026-09-07", "BOAVENTURA", "Itaboraí");
      const feriadoUfn = verificarFeriadoBase("2026-09-07", "UFN-III", "Três Lagoas");
      expect(feriadoBoaventura.ehFeriado).toBe(true);
      expect(feriadoUfn.ehFeriado).toBe(true);
      expect(feriadoBoaventura.feriado?.tipo).toBe("NACIONAL");
    });
  });

  // ===========================================================================
  // Passo 5 — Cascata de Status da Posição
  // ===========================================================================
  describe("Passo 5 — Cascata Obrigatória de Status da Posição", () => {
    const vagaTeste: VagaPosto = { id: "POS-TESTE-01", idPosto: "PST-TESTE", sequencia: 1 };
    const postoTeste: PostoOperacional = { ...postoAdm09h, idPosto: "PST-TESTE" };
    const dataUtil = "2026-08-18"; // Terça-feira

    it("1. FOLGA: em final de semana ou dia de folga", () => {
      const res = calcularStatusVagaDia(vagaTeste, postoTeste, "2026-08-16"); // Domingo
      expect(res.status).toBe("FOLGA");
      expect(res.statusVaga).toBe("NAO_EXIGIVEL");
      expect(res.exigivel).toBe(false);
    });

    it("2. PENDENTE: quando data posterior ao corte da unidade", () => {
      const aloc: AlocacaoVaga = {
        id: "AL1",
        vagaId: "POS-TESTE-01",
        matricula: "010101",
        nome: "João",
        dataInicio: "2026-08-10",
        motivo: "titular",
      };
      // Corte da base BOAVENTURA definido como 2026-09-15; data testada: 2026-09-16 (quarta-feira, dia útil após corte)
      const res = calcularStatusVagaDia(
        vagaTeste,
        postoTeste,
        "2026-09-16",
        [aloc],
        [],
        [],
        [],
        undefined,
        { BOAVENTURA: "2026-09-15" }
      );
      expect(res.status).toBe("PENDENTE");
      expect(res.statusVaga).toBe("PENDENTE_APURACAO");
      expect(res.exigivel).toBe(false);
    });

    it("3. COBERTO: titular ausente e cobertura confirmada", () => {
      const aloc: AlocacaoVaga = {
        id: "AL1",
        vagaId: "POS-TESTE-01",
        matricula: "010101",
        nome: "João Titular",
        dataInicio: "2026-08-10",
        motivo: "titular",
      };
      const ocorrencias: OcorrenciaOperacional[] = [
        {
          id: "OC-1",
          matricula: "010101",
          profissionalNome: "João Titular",
          postoCodigo: "PST-TESTE",
          tipoOcorrencia: "ATESTADO_MEDICO",
          dataInicio: dataUtil,
          dataFim: dataUtil,
          diasAfetados: 1,
          status: "VALIDADA",
          observacaoPublica: "Atestado 1 dia",
          criadoEm: "2026-08-18",
        },
      ];
      const coberturas: CoberturaOperacional[] = [
        {
          id: "COB-1",
          postoCodigo: "PST-TESTE",
          vagaId: "POS-TESTE-01",
          titularMatricula: "010101",
          titularNome: "João Titular",
          substitutoMatricula: "020202",
          substitutoNome: "Maria Cobertura",
          dataInicio: dataUtil,
          dataFim: dataUtil,
          tipoCobertura: "SUBSTITUICAO_INTERNA",
          status: "CONFIRMADA",
          funcaoPosto: "Operador",
          justificativa: "Cobrir atestado",
          criadoEm: "2026-08-18",
        },
      ];

      const res = calcularStatusVagaDia(
        vagaTeste,
        postoTeste,
        dataUtil,
        [aloc],
        ocorrencias,
        coberturas
      );
      expect(res.status).toBe("COBERTO");
      expect(res.statusVaga).toBe("COBERTO");
      expect(res.ocupante?.matricula).toBe("020202");
      expect(res.titularSubstituido?.matricula).toBe("010101");
      expect(res.tipoOcupacao).toBe("cobertura");
    });

    it("4. DESCOBERTO: ausência com ocorrência sem cobertura", () => {
      const aloc: AlocacaoVaga = {
        id: "AL1",
        vagaId: "POS-TESTE-01",
        matricula: "010101",
        nome: "João Titular",
        dataInicio: "2026-08-10",
        motivo: "titular",
      };
      const ocorrencias: OcorrenciaOperacional[] = [
        {
          id: "OC-1",
          matricula: "010101",
          profissionalNome: "João Titular",
          postoCodigo: "PST-TESTE",
          tipoOcorrencia: "FALTA_INJUSTIFICADA",
          dataInicio: dataUtil,
          dataFim: dataUtil,
          diasAfetados: 1,
          status: "VALIDADA",
          observacaoPublica: "Falta sem justificativa",
          criadoEm: "2026-08-18",
        },
      ];

      const res = calcularStatusVagaDia(
        vagaTeste,
        postoTeste,
        dataUtil,
        [aloc],
        ocorrencias,
        []
      );
      expect(res.status).toBe("DESCOBERTO");
      expect(res.statusVaga).toBe("DESCOBERTO");
      expect(res.exigivel).toBe(true);
    });

    it("5. SEM OCUPANTE: posição sem alocação vigente em dia exigível", () => {
      const res = calcularStatusVagaDia(vagaTeste, postoTeste, dataUtil, []);
      expect(res.status).toBe("SEM_OCUPANTE");
      expect(res.statusVaga).toBe("POSTO_VAGO");
      expect(res.exigivel).toBe(true);
    });

    it("6. SEM DADO: ocupante escalado sem ponto registrado e sem ausência registrada (Item 0b)", () => {
      const aloc: AlocacaoVaga = {
        id: "AL1",
        vagaId: "POS-TESTE-01",
        matricula: "010101",
        nome: "João Titular",
        dataInicio: "2026-08-10",
        motivo: "titular",
      };
      // marcacoesSet fornecido porém sem o ponto de João e sem ocorrência de ausência
      const marcacoesVazia = new Set<string>();

      const res = calcularStatusVagaDia(
        vagaTeste,
        postoTeste,
        dataUtil,
        [aloc],
        [],
        [],
        [],
        marcacoesVazia
      );
      expect(res.status).toBe("SEM_DADO");
      expect(res.statusVaga).toBe("SEM_DADO");
    });

    it("7. PRESENTE: ocupante com ponto registrado na data", () => {
      const aloc: AlocacaoVaga = {
        id: "AL1",
        vagaId: "POS-TESTE-01",
        matricula: "010101",
        nome: "João Titular",
        dataInicio: "2026-08-10",
        motivo: "titular",
      };
      const marcacoes = new Set([`010101_${dataUtil}`]);

      const res = calcularStatusVagaDia(
        vagaTeste,
        postoTeste,
        dataUtil,
        [aloc],
        [],
        [],
        [],
        marcacoes
      );
      expect(res.status).toBe("PRESENTE");
      expect(res.statusVaga).toBe("TITULAR_PRESENTE");
    });
  });

  // ===========================================================================
  // CRITÉRIOS DE ACEITE OBRIGATÓRIOS DO PROMPT
  // ===========================================================================
  describe("Critérios de Aceite Obrigatórios", () => {
    // 4 posições do posto Turno 24h
    const vagas4x4: VagaPosto[] = [
      { id: "POS-7.1", idPosto: "7", sequencia: 1, dataBaseCiclo: "2026-08-10" }, // Trabalho em 2026-08-10 (offset 0)
      { id: "POS-7.2", idPosto: "7", sequencia: 2, dataBaseCiclo: "2026-08-10" }, // Trabalho em 2026-08-10 (offset 0)
      { id: "POS-7.3", idPosto: "7", sequencia: 3, dataBaseCiclo: "2026-08-06" }, // Folga em 2026-08-10 (offset 4)
      { id: "POS-7.4", idPosto: "7", sequencia: 4, dataBaseCiclo: "2026-08-06" }, // Folga em 2026-08-10 (offset 4)
    ];

    const alocacoes4x4: AlocacaoVaga[] = [
      { id: "A1", vagaId: "POS-7.1", matricula: "1001", nome: "Op 1", dataInicio: "2026-08-10", horarioEscalaRm: "4x4", dataBaseCiclo: "2026-08-10", motivo: "titular" },
      { id: "A2", vagaId: "POS-7.2", matricula: "1002", nome: "Op 2", dataInicio: "2026-08-10", horarioEscalaRm: "4x4", dataBaseCiclo: "2026-08-10", motivo: "titular" },
      { id: "A3", vagaId: "POS-7.3", matricula: "1003", nome: "Op 3", dataInicio: "2026-08-10", horarioEscalaRm: "4x4", dataBaseCiclo: "2026-08-06", motivo: "titular" },
      { id: "A4", vagaId: "POS-7.4", matricula: "1004", nome: "Op 4", dataInicio: "2026-08-10", horarioEscalaRm: "4x4", dataBaseCiclo: "2026-08-06", motivo: "titular" },
    ];

    // a) Posto Turno/24h em 4x4, com 2 posições exigíveis no dia e uma descoberta → 50%
    it("Critério a: Posto Turno/24h em 4x4, com 2 posições exigíveis no dia e uma descoberta → 50%", () => {
      // Data: 2026-08-10 (dia 10 do mês 8)
      // Apenas Op 1 tem ponto; Op 2 sem ponto (descoberto). Vagas 3 e 4 estão de folga na escala 4x4.
      const marcacoes = new Set(["1001_2026-08-10"]);

      const apuracaoDia = calcularStatusDia(
        postoTurno24h,
        10,
        2026,
        7, // Mês 7 = Agosto (0-indexed)
        [],
        [],
        [],
        marcacoes,
        "2026-09-15",
        vagas4x4,
        alocacoes4x4
      );

      expect(apuracaoDia.posicoesExigiveis).toBe(2);
      expect(apuracaoDia.posicoesAtendidas).toBe(1);
      expect(apuracaoDia.percentualCobertura).toBe(50);
      expect(apuracaoDia.percentualCoberturaFormatado).toBe("50%");
    });

    // b) Mesmo posto com as 2 cobertas, uma delas por cobertura → 100%
    it("Critério b: Mesmo posto com as 2 cobertas, uma delas por cobertura → 100%", () => {
      // Data: 2026-08-10.
      // Op 1 tem ponto (PRESENTE).
      // Op 2 tem ocorrência de afastamento e cobertura confirmada por Substituto (COBERTO).
      const marcacoes = new Set(["1001_2026-08-10"]);
      const ocorrencias: OcorrenciaOperacional[] = [
        {
          id: "OC-2",
          matricula: "1002",
          profissionalNome: "Op 2",
          postoCodigo: "7",
          tipoOcorrencia: "ATESTADO_MEDICO",
          dataInicio: "2026-08-10",
          dataFim: "2026-08-10",
          diasAfetados: 1,
          status: "VALIDADA",
          observacaoPublica: "Atestado",
          criadoEm: "2026-08-10",
        },
      ];
      const coberturas: CoberturaOperacional[] = [
        {
          id: "COB-2",
          postoCodigo: "7",
          vagaId: "POS-7.2",
          titularMatricula: "1002",
          titularNome: "Op 2",
          substitutoMatricula: "9999",
          substitutoNome: "Substituto Alocado",
          dataInicio: "2026-08-10",
          dataFim: "2026-08-10",
          tipoCobertura: "SUBSTITUICAO_INTERNA",
          status: "CONFIRMADA",
          funcaoPosto: "Operador de Painel",
          justificativa: "Cobrir Op 2",
          criadoEm: "2026-08-10",
        },
      ];

      const apuracaoDia = calcularStatusDia(
        postoTurno24h,
        10,
        2026,
        7, // Agosto
        ocorrencias,
        coberturas,
        [],
        marcacoes,
        "2026-09-15",
        vagas4x4,
        alocacoes4x4
      );

      expect(apuracaoDia.posicoesExigiveis).toBe(2);
      expect(apuracaoDia.posicoesAtendidas).toBe(2);
      expect(apuracaoDia.percentualCobertura).toBe(100);
      expect(apuracaoDia.percentualCoberturaFormatado).toBe("100%");
    });

    // c) Posto Adm/09h em feriado municipal da unidade → "–"
    it("Critério c: Posto Adm/09h em feriado municipal da unidade → '–'", () => {
      // 2026-05-22 é Feriado Municipal em Itaboraí (Aniversário de Itaboraí - BOAVENTURA)
      const vagaAdm: VagaPosto[] = [{ id: "POS-2.1", idPosto: "2", sequencia: 1 }];
      const alocAdm: AlocacaoVaga[] = [
        { id: "A-ADM", vagaId: "POS-2.1", matricula: "3333", nome: "Adm Titular", dataInicio: "2026-01-01", horarioEscalaRm: "5x2", motivo: "titular" },
      ];

      const apuracaoFeriado = calcularStatusDia(
        postoAdm09h,
        22,
        2026,
        4, // Mês 4 = Maio (0-indexed)
        [],
        [],
        [],
        undefined,
        "2026-09-15",
        vagaAdm,
        alocAdm
      );

      expect(apuracaoFeriado.posicoesExigiveis).toBe(0);
      expect(apuracaoFeriado.posicoesAtendidas).toBe(0);
      expect(apuracaoFeriado.percentualCobertura).toBeNull();
      expect(apuracaoFeriado.percentualCoberturaFormatado).toBe("–");
    });

    // d) Posição com titular de férias por 15 dias e ferista nos outros 15 → 100% no ciclo
    it("Critério d: Posição com titular de férias por 15 dias e ferista nos outros 15 → 100% no ciclo", () => {
      const periodo30Dias = {
        ano: 2026,
        mesReferencia: 8,
        dataInicio: "2026-08-10",
        dataFim: "2026-09-08",
        datas: Array.from({ length: 30 }, (_, i) => {
          const d = i + 10;
          if (d <= 31) return `2026-08-${String(d).padStart(2, "0")}`;
          return `2026-09-${String(d - 31).padStart(2, "0")}`;
        }),
      };

      const vagaUnica: VagaPosto[] = [{ id: "POS-TESTE-CICLO", idPosto: "PST-CICLO", sequencia: 1 }];
      const postoCiclo: PostoOperacional = {
        ...postoTurno24h,
        idPosto: "PST-CICLO",
        escala: "12x36",
        dataBaseCiclo: "2026-08-10",
      };

      // Titular ativo nos primeiros 15 dias (10/08 a 24/08)
      // Ferista ativo nos seguintes 15 dias (25/08 a 08/09)
      const alocacoesCiclo: AlocacaoVaga[] = [
        {
          id: "ALOC-TITULAR",
          vagaId: "POS-TESTE-CICLO",
          matricula: "0001",
          nome: "Titular",
          dataInicio: "2026-08-10",
          dataFim: "2026-08-24",
          horarioEscalaRm: "12x36",
          dataBaseCiclo: "2026-08-10",
          motivo: "titular",
        },
        {
          id: "ALOC-FERISTA",
          vagaId: "POS-TESTE-CICLO",
          matricula: "0002",
          nome: "Ferista",
          dataInicio: "2026-08-25",
          dataFim: "2026-09-08",
          horarioEscalaRm: "12x36",
          dataBaseCiclo: "2026-08-10",
          motivo: "ferista",
        },
      ];

      // Ambos batem ponto em todos os seus dias de plantão (12x36 = dias pares em relação à base)
      const marcacoes = new Set<string>();
      periodo30Dias.datas.forEach((data, index) => {
        if (index % 2 === 0) {
          if (index < 15) {
            marcacoes.add(`0001_${data}`);
          } else {
            marcacoes.add(`0002_${data}`);
          }
        }
      });

      const resultadoCiclo = calcularApuracaoPostoCiclo(
        postoCiclo,
        periodo30Dias,
        alocacoesCiclo,
        [],
        [],
        [],
        marcacoes,
        "2026-09-15",
        vagaUnica
      );

      expect(resultadoCiclo.totalPosicoesExigiveis).toBe(15);
      expect(resultadoCiclo.totalPosicoesAtendidas).toBe(15);
      expect(resultadoCiclo.percentualCiclo).toBe(100);
      expect(resultadoCiclo.percentualCicloFormatado).toBe("100%");
    });

    // e) Posição sem ocupante em dia exigível → reduz o percentual do posto
    it("Critério e: Posição sem ocupante em dia exigível → reduz o percentual do posto", () => {
      // Posto com 2 vagas exigíveis no dia 2026-08-18 (terça-feira)
      const vagas2: VagaPosto[] = [
        { id: "POS-ADM.1", idPosto: "2", sequencia: 1 },
        { id: "POS-ADM.2", idPosto: "2", sequencia: 2 },
      ];

      // Apenas a Vaga 1 tem ocupante com ponto; Vaga 2 está SEM OCUPANTE (sem alocação vigente)
      const alocacoes: AlocacaoVaga[] = [
        {
          id: "ALOC-V1",
          vagaId: "POS-ADM.1",
          matricula: "5555",
          nome: "Titular Vaga 1",
          dataInicio: "2026-08-10",
          horarioEscalaRm: "5x2",
          motivo: "titular",
        },
      ];
      const marcacoes = new Set(["5555_2026-08-18"]);

      const apuracao = calcularStatusDia(
        postoAdm09h,
        18,
        2026,
        7, // Agosto
        [],
        [],
        [],
        marcacoes,
        "2026-09-15",
        vagas2,
        alocacoes
      );

      // Posição 2 conta como exigível (dia útil de trabalho para a função), mas não é atendida (status = SEM_OCUPANTE)
      expect(apuracao.posicoesExigiveis).toBe(2);
      expect(apuracao.posicoesAtendidas).toBe(1);
      // Reduziu o percentual de 100% para 50%
      expect(apuracao.percentualCobertura).toBe(50);
      expect(apuracao.percentualCoberturaFormatado).toBe("50%");
    });

    // f) Posto Turno/24h REGAP-208 em 4X4 — dados reais do RM e do ponto:
    //    208.1 (07-19), 208.3 (19-07) e 208.4 (06-18) trabalham 25-28/08; 208.2 (07-19) trabalha 29/08-01/09.
    //    A escala segue o horário RM do ocupante (4X4), nunca um 12x36 presumido pelo tipo de posto.
    it("Critério f: Posto 24h em 4X4 segue horário/escala do RM e alterna blocos de 4 dias", () => {
      const posto208: PostoOperacional = { ...postoTurno24h, idPosto: "208", codigoPosto: "208", escala: "4x4" };
      const vagas208: VagaPosto[] = [
        { id: "POS-REGAP-208-01", posicaoIdSGP: "POS-REGAP-208-01", idPosto: "208", sequencia: 1, faseCiclo: "1", dataBaseCiclo: "2026-08-25" } as VagaPosto,
        { id: "POS-REGAP-208-02", posicaoIdSGP: "POS-REGAP-208-02", idPosto: "208", sequencia: 2, faseCiclo: "1", dataBaseCiclo: "2026-08-29" } as VagaPosto,
        { id: "POS-REGAP-208-03", posicaoIdSGP: "POS-REGAP-208-03", idPosto: "208", sequencia: 3, faseCiclo: "1", dataBaseCiclo: "2026-08-25" } as VagaPosto,
        { id: "POS-REGAP-208-04", posicaoIdSGP: "POS-REGAP-208-04", idPosto: "208", sequencia: 4, faseCiclo: "1", dataBaseCiclo: "2026-08-25" } as VagaPosto,
      ];
      const alocacoes208: AlocacaoVaga[] = [
        { id: "A1", vagaId: "POS-REGAP-208-01", matricula: "039534", nome: "Bruno", dataInicio: "2026-08-10", horarioEscalaRm: "PETROBRAS - 07:00 AS 19:00 - ESCALA 4X4", motivo: "titular" },
        { id: "A2", vagaId: "POS-REGAP-208-02", matricula: "044211", nome: "Denis", dataInicio: "2026-08-10", horarioEscalaRm: "PETROBRAS - 07:00 AS 19:00 - ESCALA 4X4", motivo: "titular" },
        { id: "A3", vagaId: "POS-REGAP-208-03", matricula: "037996", nome: "Elisson", dataInicio: "2026-08-10", horarioEscalaRm: "PETROBRAS - 19:00 AS 07:00 - ESCALA 4X4", motivo: "titular" },
        { id: "A4", vagaId: "POS-REGAP-208-04", matricula: "038077", nome: "Jose Carlos", dataInicio: "2026-08-10", horarioEscalaRm: "PETROBRAS - 06:00 AS 18:00 - ESCALA 4X4", motivo: "titular" },
      ];
      const marcacoes = new Set([
        "039534_2026-08-26", "037996_2026-08-26", "038077_2026-08-26",
        "044211_2026-08-30",
      ]);
      const status = (dia: number) =>
        calcularStatusDia(posto208, dia, 2026, 7, [], [], [], marcacoes, "2026-09-15", vagas208, alocacoes208);

      // 26/08 — bloco A: 208.1, 208.3 e 208.4 exigíveis e presentes; 208.2 de folga
      const d26 = status(26);
      expect(d26.posicoesExigiveis).toBe(3);
      expect(d26.posicoesAtendidas).toBe(3);
      expect(d26.vagasDetalhe?.find(v => v.vagaId === "POS-REGAP-208-02")?.status).toBe("FOLGA");
      expect(d26.vagasDetalhe?.find(v => v.vagaId === "POS-REGAP-208-04")?.horarioPrevisto).toBe("06:00 às 18:00");
      expect(d26.vagasDetalhe?.find(v => v.vagaId === "POS-REGAP-208-03")?.horarioPrevisto).toBe("19:00 às 07:00");

      // 27/08 — dia seguinte continua o MESMO bloco (4X4 não troca diariamente)
      expect(status(27).vagasDetalhe?.find(v => v.vagaId === "POS-REGAP-208-02")?.status).toBe("FOLGA");

      // 30/08 — bloco B: só 208.2 exigível (presente); bloco A de folga
      const d30 = status(30);
      expect(d30.posicoesExigiveis).toBe(1);
      expect(d30.posicoesAtendidas).toBe(1);
      expect(d30.vagasDetalhe?.find(v => v.vagaId === "POS-REGAP-208-01")?.status).toBe("FOLGA");
      expect(d30.vagasDetalhe?.find(v => v.vagaId === "POS-REGAP-208-04")?.status).toBe("FOLGA");
    });
  });
});
