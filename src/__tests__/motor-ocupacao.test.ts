import { describe, it, expect } from "vitest";
import {
  calcularStatusDia,
  calcularStatusVagaDia,
  calcularTotaisVagaCiclo,
  obterPeriodoCicloPadrao,
  PostoOperacional,
  VagaPosto,
  AlocacaoVaga,
  OcorrenciaOperacional,
  CoberturaOperacional,
} from "@/lib/dados/estado-operacional";

describe("Motor de Consolidação de Ocupação Diária", () => {
  const posto5x2: PostoOperacional = {
    id: "pst-teste-1",
    idPosto: "1",
    codigoPosto: "PST-TESTE-001",
    funcao: "Almoxarife",
    itemPPU: "3.1",
    tipoPostoId: "ADM_09H",
    periculosidade: "NÃO",
    municipio: "Três Lagoas",
    localAtuacao: "UFN III",
    gerenciaPetrobras: "GERÊNCIA UFN-III",
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

  it("deve identificar COBERTO quando há cobertura confirmada MESMO SEM ocorrência prévia lançada", () => {
    const coberturasSemOcorrencia: CoberturaOperacional[] = [
      {
        id: "cob-direta",
        postoCodigo: "PST-TESTE-001",
        funcaoPosto: "Almoxarife",
        titularMatricula: "PRM-99901",
        titularNome: "Colaborador Teste",
        substitutoMatricula: "PRM-99902",
        substitutoNome: "Substituto Teste",
        dataInicio: "2026-09-10",
        dataFim: "2026-09-10",
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        status: "CONFIRMADA",
        justificativa: "Designação de cobertura operacional direta",
        criadoEm: "2026-09-10 08:00",
      },
    ];

    // Sem nenhuma ocorrência cadastrada
    const resultado = calcularStatusDia(posto5x2, 10, 2026, 8, [], coberturasSemOcorrencia);
    expect(resultado.statusOcupacao).toBe("COBERTO");
    expect(resultado.ocupanteMatricula).toBe("PRM-99902");
    expect(resultado.ocupanteNome).toBe("Substituto Teste");
    expect(resultado.motivoPublico).toContain("Substituição por cobertura: Substituto Teste");
  });

  it("deve identificar COBERTO quando posto vago possui cobertura confirmada", () => {
    const postoVago: PostoOperacional = { ...posto5x2, titularMatricula: undefined, titularNome: undefined };
    const coberturasPostoVago: CoberturaOperacional[] = [
      {
        id: "cob-vago",
        postoCodigo: "PST-TESTE-001",
        funcaoPosto: "Almoxarife",
        substitutoMatricula: "PRM-99902",
        substitutoNome: "Substituto Teste",
        dataInicio: "2026-09-11",
        dataFim: "2026-09-11",
        tipoCobertura: "CONTRATACAO_TEMPORARIA",
        status: "CONFIRMADA",
        justificativa: "Cobertura de posto vago em contratação",
        criadoEm: "2026-09-11 08:00",
      },
    ];

    const resultado = calcularStatusDia(postoVago, 11, 2026, 8, [], coberturasPostoVago);
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

  // ===========================================================================
  // CASOS DE TESTE ESPECIFICADOS (A, B, C, D)
  // ===========================================================================
  describe("Casos de Teste Especificados (A, B, C, D)", () => {
    // -------------------------------------------------------------------------
    // a) Posto Turno/24h com uma vaga noturna descoberta em um dia
    // -------------------------------------------------------------------------
    it("a) posto Turno/24h com uma vaga noturna descoberta em um dia -> status agregado PARCIAL", () => {
      const postoTurno24h: PostoOperacional = {
        id: "pst-turno-24h",
        idPosto: "700",
        codigoPosto: "PST-TURNO-24H-001",
        funcao: "Operador de Central de Monitoramento",
        itemPPU: "3.6",
        tipoPostoId: "TURNO_24H",
        periculosidade: "SIM",
        municipio: "Itaboraí",
        localAtuacao: "BOAVENTURA",
        gerenciaPetrobras: "GERÊNCIA BOAVENTURA",
        unidadeId: "BOAVENTURA",
        unidadeNome: "BOAVENTURA",
        escala: "12x36",
        jornadaSemanalHoras: 36,
        horarioInicio: "07:00",
        horarioFim: "19:00",
        situacao: "ATIVO",
        dataInicioVigencia: "2024-01-01",
      };

      const vagasTurno: VagaPosto[] = [
        { id: "700.1", idPosto: "700", sequencia: 1 }, // Diurno Turma A
        { id: "700.2", idPosto: "700", sequencia: 2 }, // Noturno Turma A
        { id: "700.3", idPosto: "700", sequencia: 3 }, // Diurno Turma B
        { id: "700.4", idPosto: "700", sequencia: 4 }, // Noturno Turma B
      ];

      // Data de teste: 02/09/2026 (quarta-feira)
      // dataBaseCiclo 2026-08-10: diff para 02/09 = 23 (ímpar).
      // Turma B trabalha em dias com diff ímpar (dataBaseCiclo 2026-08-11)
      const alocacoesTurno: AlocacaoVaga[] = [
        {
          id: "alc-700.1",
          vagaId: "700.1",
          matricula: "OP-001",
          identificadorPetrobras: "PET-001",
          nome: "Operador Diurno A",
          dataInicio: "2024-01-01",
          dataFim: null,
          horarioEscalaRm: "12X36",
          dataBaseCiclo: "2026-08-10", // Folga em 02/09
          motivo: "titular",
        },
        {
          id: "alc-700.2",
          vagaId: "700.2",
          matricula: "OP-002",
          identificadorPetrobras: "PET-002",
          nome: "Operador Noturno A",
          dataInicio: "2024-01-01",
          dataFim: null,
          horarioEscalaRm: "12X36",
          dataBaseCiclo: "2026-08-10", // Folga em 02/09
          motivo: "titular",
        },
        {
          id: "alc-700.3",
          vagaId: "700.3",
          matricula: "OP-003",
          identificadorPetrobras: "PET-003",
          nome: "Operador Diurno B",
          dataInicio: "2024-01-01",
          dataFim: null,
          horarioEscalaRm: "12X36",
          dataBaseCiclo: "2026-08-11", // Trabalho em 02/09 (presente)
          motivo: "titular",
        },
        {
          id: "alc-700.4",
          vagaId: "700.4",
          matricula: "OP-004",
          identificadorPetrobras: "PET-004",
          nome: "Operador Noturno B",
          dataInicio: "2024-01-01",
          dataFim: null,
          horarioEscalaRm: "12X36",
          dataBaseCiclo: "2026-08-11", // Trabalho em 02/09 (com ausência sem cobertura!)
          motivo: "titular",
        },
      ];

      // Falta sem cobertura na vaga noturna 700.4 em 02/09/2026
      const ocorrencias: OcorrenciaOperacional[] = [
        {
          id: "oco-noturno-descoberto",
          matricula: "OP-004",
          profissionalNome: "Operador Noturno B",
          postoCodigo: "PST-TURNO-24H-001",
          tipoOcorrencia: "FALTA_INJUSTIFICADA",
          dataInicio: "2026-09-02",
          dataFim: "2026-09-02",
          diasAfetados: 1,
          status: "VALIDADA",
          observacaoPublica: "Falta injustificada no plantão noturno",
          criadoEm: "2026-09-02 20:00",
        },
      ];

      // Apuração do dia 02/09/2026
      const resultado = calcularStatusDia(
        postoTurno24h,
        2,
        2026,
        8,
        ocorrencias,
        [], // Sem cobertura
        [],
        undefined,
        "2026-09-15",
        vagasTurno,
        alocacoesTurno
      );

      // Verificações do Item 6:
      // - Vagas exigíveis no dia: 700.3 (diurna B - presente) e 700.4 (noturna B - descoberta)
      // - Vagas folga no dia: 700.1 (não exigível) e 700.2 (não exigível)
      // - Como há vaga atendida (700.3) e vaga descoberta (700.4), o status agregado deve ser PARCIAL
      expect(resultado.statusAgregado).toBe("PARCIAL");
      expect(resultado.statusOcupacao).toBe("DESCOBERTO");
      expect(resultado.vagasDetalhe?.length).toBe(4);

      const detalhe700_3 = resultado.vagasDetalhe?.find((v) => v.vagaId === "700.3");
      const detalhe700_4 = resultado.vagasDetalhe?.find((v) => v.vagaId === "700.4");
      const detalhe700_1 = resultado.vagasDetalhe?.find((v) => v.vagaId === "700.1");

      expect(detalhe700_3?.statusVaga).toBe("TITULAR_PRESENTE");
      expect(detalhe700_4?.statusVaga).toBe("DESCOBERTO");
      expect(detalhe700_1?.statusVaga).toBe("NAO_EXIGIVEL");
      expect(resultado.motivoPublico).toContain("PARCIAL");
    });

    // -------------------------------------------------------------------------
    // b) Posto Adm/09h em feriado municipal da base
    // -------------------------------------------------------------------------
    it("b) posto Adm/09h em feriado municipal da base -> NÃO EXIGÍVEL (status agregado COMPLETO)", () => {
      const postoAdm: PostoOperacional = {
        id: "pst-adm-boaventura",
        idPosto: "227",
        codigoPosto: "PST-BOAVENTURA-227",
        funcao: "Analista de Apoio à Gestão",
        itemPPU: "3.1",
        tipoPostoId: "ADM_09H",
        periculosidade: "NÃO",
        municipio: "Itaboraí",
        localAtuacao: "BOAVENTURA",
        gerenciaPetrobras: "COMPARTILHADO/GIO/OP-RJ/BOAVENTURA-GPC",
        unidadeId: "BOAVENTURA",
        unidadeNome: "BOAVENTURA",
        escala: "5x2",
        jornadaSemanalHoras: 40,
        horarioInicio: "08:00",
        horarioFim: "17:00",
        titularMatricula: "PRM-ITAB-01",
        titularNome: "Colaborador Itaboraí",
        situacao: "ATIVO",
        dataInicioVigencia: "2024-01-01",
      };

      // 22 de Maio de 2026 é Sexta-feira útil normal, mas é FERIADO MUNICIPAL DE ITABORAÍ
      // mês 4 em JS = Maio (0-indexed)
      const resultado = calcularStatusDia(
        postoAdm,
        22,
        2026,
        4, // Maio
        [],
        [],
        [],
        undefined,
        "2026-05-31"
      );

      // Verificação do Item 4 & 5:
      expect(resultado.statusOcupacao).toBe("NAO_EXIGIVEL");
      expect(resultado.statusAgregado).toBe("COMPLETO");
      expect(resultado.motivoPublico).toContain("Feriado Municipal");
      expect(resultado.motivoPublico).toContain("Aniversário de Itaboraí");
    });

    // -------------------------------------------------------------------------
    // c) Vaga 12x36 na virada de um mês com 31 dias
    // -------------------------------------------------------------------------
    it("c) vaga 12x36 na virada de um mês com 31 dias -> alterna corretamente sem repetição de paridade", () => {
      const posto12x36: PostoOperacional = {
        ...posto5x2,
        idPosto: "800",
        escala: "12x36",
        jornadaSemanalHoras: 36,
      };

      const vaga12x36: VagaPosto = {
        id: "800.1",
        idPosto: "800",
        sequencia: 1,
      };

      // dataBaseCiclo = 2026-08-10 (segunda-feira)
      const alocacoes: AlocacaoVaga[] = [
        {
          id: "alc-800.1",
          vagaId: "800.1",
          matricula: "039860",
          identificadorPetrobras: "48034378",
          nome: "Colaborador Escala 12x36",
          dataInicio: "2024-01-01",
          dataFim: null,
          horarioEscalaRm: "PETROBRAS - 07:00 AS 19:00 - ESCALA 12X36",
          dataBaseCiclo: "2026-08-10",
          motivo: "titular",
        },
      ];

      // Teste na virada de Agosto (31 dias) para Setembro (dia 1):
      // - 30/08/2026: (2026-08-30 - 2026-08-10) = 20 dias -> 20 mod 2 = 0 -> TRABALHO (exigível)
      // - 31/08/2026: (2026-08-31 - 2026-08-10) = 21 dias -> 21 mod 2 = 1 -> FOLGA (não exigível)
      // - 01/09/2026: (2026-09-01 - 2026-08-10) = 22 dias -> 22 mod 2 = 0 -> TRABALHO (exigível)
      // - 02/09/2026: (2026-09-02 - 2026-08-10) = 23 dias -> 23 mod 2 = 1 -> FOLGA (não exigível)

      const statusDia30Ago = calcularStatusVagaDia(
        vaga12x36,
        posto12x36,
        "2026-08-30",
        alocacoes
      );
      const statusDia31Ago = calcularStatusVagaDia(
        vaga12x36,
        posto12x36,
        "2026-08-31",
        alocacoes
      );
      const statusDia01Set = calcularStatusVagaDia(
        vaga12x36,
        posto12x36,
        "2026-09-01",
        alocacoes
      );
      const statusDia02Set = calcularStatusVagaDia(
        vaga12x36,
        posto12x36,
        "2026-09-02",
        alocacoes
      );

      // Verificação do Item 3:
      // Note que no calendário 31 e 1 são ambos ímpares. A regra antiga de par/ímpar erraria aqui.
      // Com a fórmula (data - dataBaseCiclo) mod 2 = 0, a alternância é perfeita:
      expect(statusDia30Ago.exigivel).toBe(true);
      expect(statusDia30Ago.statusVaga).toBe("TITULAR_PRESENTE");

      expect(statusDia31Ago.exigivel).toBe(false);
      expect(statusDia31Ago.statusVaga).toBe("NAO_EXIGIVEL");
      expect(statusDia31Ago.motivoNaoExigivel).toContain("Folga de compensação 36h");

      expect(statusDia01Set.exigivel).toBe(true);
      expect(statusDia01Set.statusVaga).toBe("TITULAR_PRESENTE");

      expect(statusDia02Set.exigivel).toBe(false);
      expect(statusDia02Set.statusVaga).toBe("NAO_EXIGIVEL");
    });

    // -------------------------------------------------------------------------
    // d) Vaga com titular de férias por 15 dias e ferista nos outros 15, ficando coberta o ciclo inteiro
    // -------------------------------------------------------------------------
    it("d) vaga com titular de férias por 15 dias e ferista nos outros 15 -> coberta o ciclo inteiro com 0 descobertos", () => {
      const postoAdm: PostoOperacional = {
        ...posto5x2,
        idPosto: "900",
        escala: "5x2",
        titularMatricula: "TIT-001",
        titularNome: "Titular Oficial",
      };

      const vaga: VagaPosto = {
        id: "900",
        idPosto: "900",
        sequencia: 1,
      };

      // Ciclo padrão de 30 dias: de 10/08/2026 a 08/09/2026
      const ciclo = obterPeriodoCicloPadrao(2026, 8);
      // Datas dos primeiros 15 dias do ciclo: 10/08 a 24/08
      const dataInicioFerias = "2026-08-10";
      const dataFimFerias = "2026-08-24";

      // 1. Ocorrência de férias do titular nos primeiros 15 dias
      const ocorrencias: OcorrenciaOperacional[] = [
        {
          id: "oco-ferias-titular",
          matricula: "TIT-001",
          profissionalNome: "Titular Oficial",
          postoCodigo: postoAdm.codigoPosto,
          tipoOcorrencia: "FERIAS",
          dataInicio: dataInicioFerias,
          dataFim: dataFimFerias,
          diasAfetados: 15,
          status: "VALIDADA",
          observacaoPublica: "Férias regulamentares do titular (15 dias)",
          criadoEm: "2026-08-01 08:00",
        },
      ];

      // 2. Cobertura confirmada por ferista designado para esses 15 dias
      const coberturas: CoberturaOperacional[] = [
        {
          id: "cob-ferista-15dias",
          postoCodigo: postoAdm.codigoPosto,
          funcaoPosto: postoAdm.funcao,
          titularMatricula: "TIT-001",
          titularNome: "Titular Oficial",
          substitutoMatricula: "FER-002",
          substitutoNome: "Ferista Contratado",
          dataInicio: dataInicioFerias,
          dataFim: dataFimFerias,
          tipoCobertura: "SUBSTITUICAO_INTERNA",
          status: "CONFIRMADA",
          justificativa: "Cobertura de férias com ferista",
          criadoEm: "2026-08-05 08:00",
        },
      ];

      // 3. Alocação do titular ativa na vaga
      const alocacoes: AlocacaoVaga[] = [
        {
          id: "alc-900-titular",
          vagaId: "900",
          matricula: "TIT-001",
          identificadorPetrobras: "PET-900",
          nome: "Titular Oficial",
          dataInicio: "2024-01-01",
          dataFim: null,
          horarioEscalaRm: "5X2",
          motivo: "titular",
        },
      ];

      // 4. Calcula os totais operacionais da vaga no ciclo inteiro (Item 7)
      const totais = calcularTotaisVagaCiclo(
        vaga,
        postoAdm,
        ciclo.datas,
        alocacoes,
        ocorrencias,
        coberturas,
        [],
        undefined,
        "2026-09-15"
      );

      // Verificações do Item 7 & Caso d):
      // - 0 dias descobertos no ciclo
      expect(totais.diasDescobertos).toBe(0);

      // - Dias cobertos pelo ferista (dias úteis de 10/08 a 24/08 na escala 5x2 = 11 dias úteis)
      expect(totais.diasCobertos).toBeGreaterThan(0);

      // - Dias presentes do titular (dias úteis de 25/08 a 09/09, excluindo fim de semana e feriado 07/09)
      expect(totais.diasPresentes).toBeGreaterThan(0);

      // - Dias de ausência do titular contabilizados (período de férias)
      expect(totais.diasAusencia).toBe(totais.diasCobertos);

      // - Total atendido (presentes + cobertos) cobre 100% dos dias exigíveis
      expect(totais.diasPresentes + totais.diasCobertos).toBe(totais.diasExigiveis);
    });
  });
});
