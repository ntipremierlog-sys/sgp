/**
 * Testes Automatizados — Cruzamento de Programação com Ausências do RM e Descobertos (Item 11.3)
 * SGP (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import {
  simularImportacaoAbono,
  confirmarImportacaoAbono,
  categorizarAusencia,
  extrairQuantidadeHorasDias,
} from "@/lib/importadores/cubo-abono";
import {
  carregarEstado,
  salvarEstado,
  calcularStatusVagaDia,
  EstadoOperacionalCompleto,
  PostoOperacional,
  VagaPosto,
  AlocacaoVaga,
  OcorrenciaOperacional,
  CoberturaOperacional,
} from "@/lib/dados/estado-operacional";
import {
  obterFeristasVinculadosAoPosto,
  obterFeristasSugeridosParaPosicao,
} from "@/lib/servicos/sugestao-cobertura";
import {
  detectarConflitosOperacionais,
  sincronizarConflitosComoPendencias,
} from "@/lib/servicos/conflitos-operacionais";
import { gerarPlanilhaDescobertosXlsx } from "@/lib/exportadores/descobertos-xlsx";

function criarPlanilhaBuffer(linhas: Record<string, unknown>[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(linhas);
  XLSX.utils.book_append_sheet(wb, ws, "Abonos");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(out);
}

describe("Evolução SGP — Cruzamento de Escala com Ausências do RM e Gestão de Descobertos", () => {
  let postoMock5x2: PostoOperacional;
  let vagaMock5x2: VagaPosto;
  let alocacaoMock: AlocacaoVaga;
  let estadoTeste: EstadoOperacionalCompleto;

  beforeEach(() => {
    postoMock5x2 = {
      id: "pst-teste-5x2",
      idPosto: "PST-TESTE-001",
      codigoPosto: "PST-TESTE-001",
      funcao: "Almoxarife Líder",
      itemPPU: "3.1",
      tipoPostoId: "ADM_09H",
      periculosidade: "NÃO",
      municipio: "MACAÉ",
      localAtuacao: "CABIUNAS",
      unidadeId: "CABIUNAS",
      unidadeNome: "Cabiúnas / Macaé",
      gerenciaPetrobras: "GERENCIA CABIUNAS",
      escala: "5x2",
      jornadaSemanalHoras: 44,
      horarioInicio: "07:00",
      horarioFim: "16:48",
      titularMatricula: "010001",
      titularNome: "Carlos Eduardo Silva",
      situacao: "ATIVO",
      dataInicioVigencia: "2026-01-01",
    };

    vagaMock5x2 = {
      id: "POS-TESTE-001-01",
      posicaoIdSGP: "POS-TESTE-001-01",
      idPosto: "PST-TESTE-001",
      postoIdSGP: "PST-TESTE-001",
      postoBase: 1,
      sequencia: 1,
      regime: "5x2",
      tipoEscala: "5x2",
      escalaTipo: "5x2",
      horario: "07:00 às 16:48",
    };

    alocacaoMock = {
      id: "alc-teste-01",
      vagaId: "POS-TESTE-001-01",
      posicaoIdSGP: "POS-TESTE-001-01",
      postoIdSGP: "PST-TESTE-001",
      matricula: "010001",
      nome: "Carlos Eduardo Silva",
      dataInicio: "2026-01-01",
      dataFim: null,
      horarioEscalaRm: "5x2",
      motivo: "titular",
    };

    estadoTeste = {
      postos: [postoMock5x2],
      vagas: [vagaMock5x2],
      alocacoes: [alocacaoMock],
      profissionais: [
        {
          id: "prf-010001",
          chapa: "010001",
          matricula: "010001",
          nome: "Carlos Eduardo Silva",
          cpfMascarado: "***.123.456-**",
          cpfLimpo: "12345678901",
          funcao: "Almoxarife Líder",
          unidadeId: "CABIUNAS",
          unidadeNome: "Cabiúnas / Macaé",
          escala: "5x2",
          situacao: "ATIVO",
          dataAdmissao: "2024-01-01",
        },
        {
          id: "prf-020002",
          chapa: "020002",
          matricula: "020002",
          nome: "Gilmara Caetano de Assis",
          cpfMascarado: "***.987.654-**",
          cpfLimpo: "98765432100",
          funcao: "Almoxarife Ferista",
          unidadeId: "CABIUNAS",
          unidadeNome: "Cabiúnas / Macaé",
          escala: "5x2",
          situacao: "ATIVO",
          dataAdmissao: "2024-02-01",
          tipoColaborador: "FERISTA",
          postosVinculados: ["PST-TESTE-001", "POS-TESTE-001-01"],
        },
      ],
      ocorrencias: [],
      coberturas: [],
      apontamentos: [],
      logsAuditoria: [],
      perfilAtivo: "PREMIER_ADMIN",
      unidadeSelecionada: "CABIUNAS",
    };

    salvarEstado(estadoTeste);
  });

  // ===========================================================================
  // REQUISITO 1: Importação do Cubo de Abono (RM)
  // ===========================================================================
  describe("1. Importação do Cubo de Abono (RM) e Upsert por Chapa + Data + Tipo", () => {
    it("deve extrair chapa, data, quantidade de horas/dias e categorizar ausência", () => {
      const { horas, dias } = extrairQuantidadeHorasDias(0.3680555555555555);
      expect(horas).toBeCloseTo(8.83, 1);
      expect(dias).toBe(1);

      const resFerias = categorizarAusencia("GOZO DE FERIAS");
      expect(resFerias.categoria).toBe("Férias");
      expect(resFerias.tipoOcorrencia).toBe("FERIAS");

      const resMedico = categorizarAusencia("ATESTADO MEDICO 1 DIA");
      expect(resMedico.categoria).toBe("Afastamento");
      expect(resMedico.tipoOcorrencia).toBe("ATESTADO_MEDICO");

      const resLicenca = categorizarAusencia("DECLARACAO COMPARECIMENTO");
      expect(resLicenca.categoria).toBe("Licença");
      expect(resLicenca.tipoOcorrencia).toBe("FALTA_JUSTIFICADA");

      const resFolga = categorizarAusencia("ABONADO PELO SUPERIOR");
      expect(resFolga.categoria).toBe("Folga compensatória");
      expect(resFolga.tipoOcorrencia).toBe("ABONO_LEGAL");
    });

    it("NUNCA deve gravar CID, diagnóstico ou texto médico (Conformidade LGPD)", async () => {
      const linhas = [
        {
          CHAPA: "010001",
          NOME_FUNCIONARIO: "Carlos Eduardo Silva",
          DATA: "17/08/2026",
          "DESCRICAO ABONO": "ATESTADO MEDICO CID J06.9 INFECTO RESPIRATORIO",
          ABONO2: "08:48:00",
        },
      ];

      const buffer = criarPlanilhaBuffer(linhas);
      const simulacao = await simularImportacaoAbono(buffer, "abonos.xlsx", "2026-08-31", estadoTeste);
      expect(simulacao.totais.novos).toBe(1);

      confirmarImportacaoAbono(simulacao, "Administrador Teste");
      const estadoPos = carregarEstado();

      const oco = estadoPos.ocorrencias.find((o) => o.matricula === "010001");
      expect(oco).toBeDefined();
      expect(oco?.categoriaAusencia).toBe("Afastamento");
      // observacaoPublica deve conter apenas a categoria genérica, NUNCA o CID ou texto clínico
      expect(oco?.observacaoPublica).toBe("Ausência RM: Afastamento");
      expect(oco?.observacaoPublica).not.toContain("CID");
      expect(oco?.observacaoPublica).not.toContain("J06.9");
      expect(oco?.dadoSensivel).toBeUndefined();
    });

    it("deve realizar Upsert por chapa + data + tipo sem duplicar ocorrências", async () => {
      const linhas1 = [
        {
          CHAPA: "010001",
          DATA: "17/08/2026",
          "DESCRICAO ABONO": "ATESTADO MEDICO",
          ABONO2: 0.368,
        },
      ];

      // 1. Primeira importação (deve ser NOVO)
      const buffer1 = criarPlanilhaBuffer(linhas1);
      const sim1 = await simularImportacaoAbono(buffer1, "lote1.xlsx", "2026-08-31", estadoTeste);
      expect(sim1.totais.novos).toBe(1);
      expect(sim1.totais.atualizados).toBe(0);
      confirmarImportacaoAbono(sim1);

      let estadoAtualizado = carregarEstado();
      expect(estadoAtualizado.ocorrencias.length).toBe(1);
      expect(estadoAtualizado.ocorrencias[0].quantidadeHoras).toBeCloseTo(8.83, 1);

      // 2. Segunda importação com horas atualizadas para a mesma chave (chapa + data + tipo)
      const linhas2 = [
        {
          CHAPA: "010001",
          DATA: "17/08/2026",
          "DESCRICAO ABONO": "ATESTADO MEDICO",
          ABONO2: "12:00:00",
        },
      ];
      const buffer2 = criarPlanilhaBuffer(linhas2);
      const sim2 = await simularImportacaoAbono(buffer2, "lote2.xlsx", "2026-08-31", estadoAtualizado);
      expect(sim2.totais.novos).toBe(0);
      expect(sim2.totais.atualizados).toBe(1);
      confirmarImportacaoAbono(sim2);

      estadoAtualizado = carregarEstado();
      // Não deve ter duplicado! Continua 1 única ocorrência atualizada
      expect(estadoAtualizado.ocorrencias.length).toBe(1);
      expect(estadoAtualizado.ocorrencias[0].quantidadeHoras).toBe(12);
    });
  });

  // ===========================================================================
  // REQUISITO 2 & CRITÉRIOS DE ACEITE: Regra de Apuração por Dia e por Posição
  // ===========================================================================
  describe("2. Regra de Apuração por Dia e Posição (P, C, D, N, ?)", () => {
    it("Critério de Aceite: Férias do titular geram D nos dias programados até que cobertura seja registrada, passando a C", () => {
      // 17/08/2026 é Segunda-feira (dia programado para escala 5x2)
      const dataProgramada = "2026-08-17";

      // 1. Dia programado + titular sem ausência -> P
      const apuracaoSemAusencia = calcularStatusVagaDia(
        vagaMock5x2,
        postoMock5x2,
        dataProgramada,
        [alocacaoMock],
        [],
        []
      );
      expect(apuracaoSemAusencia.status).toBe("PRESENTE");

      // 2. Importa Férias do titular do Cubo de Abono
      const ocorrenciaFerias: OcorrenciaOperacional = {
        id: "oco-ferias-01",
        matricula: "010001",
        profissionalNome: "Carlos Eduardo Silva",
        postoCodigo: "PST-TESTE-001",
        tipoOcorrencia: "FERIAS",
        categoriaAusencia: "Férias",
        dataInicio: "2026-08-17",
        dataFim: "2026-08-21",
        diasAfetados: 5,
        status: "VALIDADA",
        observacaoPublica: "Ausência RM: Férias",
        criadoEm: "2026-08-10",
      };

      // Dia programado + titular ausente + SEM cobertura -> D com alerta "posição descoberta"
      const apuracaoDescoberto = calcularStatusVagaDia(
        vagaMock5x2,
        postoMock5x2,
        dataProgramada,
        [alocacaoMock],
        [ocorrenciaFerias],
        []
      );
      expect(apuracaoDescoberto.status).toBe("DESCOBERTO");
      expect(apuracaoDescoberto.alertaDescoberto).toBe(true);
      expect(apuracaoDescoberto.categoriaAusencia).toBe("Férias");
      expect(apuracaoDescoberto.motivoPublico).toContain("Posição Descoberta");

      // 3. Após registrar a cobertura, os dias passam a C
      const coberturaGilmara: CoberturaOperacional = {
        id: "cob-01",
        postoCodigo: "PST-TESTE-001",
        vagaId: "POS-TESTE-001-01",
        funcaoPosto: "Almoxarife Líder",
        titularMatricula: "010001",
        titularNome: "Carlos Eduardo Silva",
        substitutoMatricula: "020002",
        substitutoNome: "Gilmara Caetano de Assis",
        dataInicio: "2026-08-17",
        dataFim: "2026-08-21",
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        status: "CONFIRMADA",
        justificativa: "Cobertura de férias programadas",
        criadoEm: "2026-08-11",
      };

      const apuracaoCoberto = calcularStatusVagaDia(
        vagaMock5x2,
        postoMock5x2,
        dataProgramada,
        [alocacaoMock],
        [ocorrenciaFerias],
        [coberturaGilmara]
      );
      expect(apuracaoCoberto.status).toBe("COBERTO");
      expect(apuracaoCoberto.ocupanteMatricula).toBe("020002");
      expect(apuracaoCoberto.ocupanteNome).toBe("Gilmara Caetano de Assis");
    });

    it("Ausência lançada num dia não programado pela escala (N) NÃO gera D", () => {
      // 16/08/2026 é Domingo (dia de folga na escala 5x2)
      const dataDomingo = "2026-08-16";

      const ocorrenciaAtestado: OcorrenciaOperacional = {
        id: "oco-domingo",
        matricula: "010001",
        profissionalNome: "Carlos Eduardo Silva",
        tipoOcorrencia: "ATESTADO_MEDICO",
        categoriaAusencia: "Afastamento",
        dataInicio: "2026-08-15",
        dataFim: "2026-08-16",
        diasAfetados: 2,
        status: "VALIDADA",
        observacaoPublica: "Ausência RM: Afastamento",
        criadoEm: "2026-08-15",
      };

      const apuracao = calcularStatusVagaDia(
        vagaMock5x2,
        postoMock5x2,
        dataDomingo,
        [alocacaoMock],
        [ocorrenciaAtestado],
        []
      );

      // Deve retornar FOLGA (N), e NUNCA D
      expect(apuracao.status).toBe("FOLGA");
      expect(apuracao.exigivel).toBe(false);
      expect(apuracao.status).not.toBe("DESCOBERTO");
    });

    it("Escala cíclica sem fase/data-base deve manter status ? (CICLO_NAO_CONFIGURADO)", () => {
      const vagaCiclicaSemFase: VagaPosto = {
        id: "POS-CICLO-SEM-FASE",
        posicaoIdSGP: "POS-CICLO-SEM-FASE",
        idPosto: "PST-TURNO-01",
        sequencia: 1,
        regime: "12x36",
        tipoEscala: "12x36",
        escalaTipo: "12x36",
        // Sem faseCiclo e sem dataBaseEscala
      };

      const postoTurno: PostoOperacional = {
        ...postoMock5x2,
        idPosto: "PST-TURNO-01",
        escala: "12x36",
      };

      const apuracao = calcularStatusVagaDia(
        vagaCiclicaSemFase,
        postoTurno,
        "2026-08-17",
        [
          {
            ...alocacaoMock,
            vagaId: "POS-CICLO-SEM-FASE",
            horarioEscalaRm: "12x36",
          },
        ],
        [],
        []
      );

      expect(apuracao.status).toBe("CICLO_NAO_CONFIGURADO");
      expect(apuracao.exigivel).toBe(false);
      expect(apuracao.motivoNaoExigivel).toContain("Ciclo não configurado");
    });
  });

  // ===========================================================================
  // REQUISITO 3: Sugestão de Cobertura para D
  // ===========================================================================
  describe("3. Sugestão de Cobertura para Posições Descobertas", () => {
    it("deve sugerir feristas vinculados ao posto que estejam livres e não ausentes no mesmo dia", () => {
      const dataAlvo = "2026-08-17";

      // Gilmara (020002) está vinculada ao posto PST-TESTE-001 e está livre
      const sugeridos = obterFeristasSugeridosParaPosicao("PST-TESTE-001", dataAlvo, estadoTeste);

      expect(sugeridos.length).toBeGreaterThan(0);
      const gilmara = sugeridos.find((f) => f.chapa === "020002");
      expect(gilmara).toBeDefined();
      expect(gilmara?.disponivel).toBe(true);
    });

    it("NÃO deve sugerir ferista que já esteja alocado em outra cobertura no mesmo dia", () => {
      const dataAlvo = "2026-08-17";

      // Adiciona cobertura ativa para Gilmara em outro posto no mesmo dia
      const coberturaExistente: CoberturaOperacional = {
        id: "cob-outro-posto",
        postoCodigo: "PST-OUTRO-999",
        funcaoPosto: "Almoxarife",
        substitutoMatricula: "020002",
        substitutoNome: "Gilmara Caetano de Assis",
        dataInicio: "2026-08-17",
        dataFim: "2026-08-17",
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        status: "CONFIRMADA",
        justificativa: "Outra cobertura",
        criadoEm: "2026-08-10",
      };

      const estadoComCobertura = {
        ...estadoTeste,
        coberturas: [coberturaExistente],
      };

      const sugeridos = obterFeristasSugeridosParaPosicao("PST-TESTE-001", dataAlvo, estadoComCobertura);
      const gilmara = sugeridos.find((f) => f.chapa === "020002");
      // Não deve estar na lista de sugeridos disponíveis
      expect(gilmara).toBeUndefined();
    });

    it("NÃO deve sugerir ferista que esteja ausente no RM (férias/afastamento) no mesmo dia", () => {
      const dataAlvo = "2026-08-17";

      // Adiciona ocorrência de férias para Gilmara
      const feriasGilmara: OcorrenciaOperacional = {
        id: "oco-ferias-gilmara",
        matricula: "020002",
        profissionalNome: "Gilmara Caetano de Assis",
        tipoOcorrencia: "FERIAS",
        categoriaAusencia: "Férias",
        dataInicio: "2026-08-15",
        dataFim: "2026-08-30",
        diasAfetados: 15,
        status: "VALIDADA",
        observacaoPublica: "Ausência RM: Férias",
        criadoEm: "2026-08-10",
      };

      const estadoComFerias = {
        ...estadoTeste,
        ocorrencias: [feriasGilmara],
      };

      const sugeridos = obterFeristasSugeridosParaPosicao("PST-TESTE-001", dataAlvo, estadoComFerias);
      const gilmara = sugeridos.find((f) => f.chapa === "020002");
      expect(gilmara).toBeUndefined();
    });
  });

  // ===========================================================================
  // REQUISITO 4: Conflitos Operacionais a Sinalizar como Pendência
  // ===========================================================================
  describe("4. Detecção de Conflitos e Inconsistências Operacionais", () => {
    it("deve sinalizar conflito quando o mesmo ferista cobre duas posições no mesmo dia", () => {
      const dataConflito = "2026-08-20";

      const cob1: CoberturaOperacional = {
        id: "cob-dup-1",
        postoCodigo: "PST-TESTE-001",
        vagaId: "POS-001",
        funcaoPosto: "Almoxarife",
        substitutoMatricula: "020002",
        substitutoNome: "Gilmara",
        dataInicio: dataConflito,
        dataFim: dataConflito,
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        status: "CONFIRMADA",
        justificativa: "Cobertura 1",
        criadoEm: "2026-08-10",
      };

      const cob2: CoberturaOperacional = {
        id: "cob-dup-2",
        postoCodigo: "PST-TESTE-002",
        vagaId: "POS-002",
        funcaoPosto: "Almoxarife",
        substitutoMatricula: "020002",
        substitutoNome: "Gilmara",
        dataInicio: dataConflito,
        dataFim: dataConflito,
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        status: "CONFIRMADA",
        justificativa: "Cobertura 2",
        criadoEm: "2026-08-10",
      };

      const estadoConflito = {
        ...estadoTeste,
        coberturas: [cob1, cob2],
      };

      const conflitos = detectarConflitosOperacionais(estadoConflito);
      const confDupla = conflitos.find((c) => c.tipo === "FERISTA_DUPLA_COBERTURA");
      expect(confDupla).toBeDefined();
      expect(confDupla?.detalhes.feristaMatricula).toBe("020002");
    });

    it("deve sinalizar conflito quando cobertura é lançada para titular sem ausência no RM", () => {
      const dataConflito = "2026-08-22";

      const cobSemAusencia: CoberturaOperacional = {
        id: "cob-sem-ausencia",
        postoCodigo: "PST-TESTE-001",
        funcaoPosto: "Almoxarife Líder",
        titularMatricula: "010001",
        titularNome: "Carlos Eduardo Silva",
        substitutoMatricula: "020002",
        substitutoNome: "Gilmara",
        dataInicio: dataConflito,
        dataFim: dataConflito,
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        status: "CONFIRMADA",
        justificativa: "Cobertura preventiva",
        criadoEm: "2026-08-10",
      };

      const estadoConflito = {
        ...estadoTeste,
        ocorrencias: [], // Sem ocorrência no RM para o titular
        coberturas: [cobSemAusencia],
      };

      const conflitos = detectarConflitosOperacionais(estadoConflito);
      const confSemAusencia = conflitos.find((c) => c.tipo === "COBERTURA_SEM_AUSENCIA_RM");
      expect(confSemAusencia).toBeDefined();
      expect(confSemAusencia?.detalhes.titularMatricula).toBe("010001");
    });

    it("deve sinalizar conflito quando titular possui ausência no RM mas dia está marcado manualmente como P", () => {
      const dataConflito = "2026-08-25";

      const ausenciaRM: OcorrenciaOperacional = {
        id: "oco-rm-25",
        matricula: "010001",
        profissionalNome: "Carlos Eduardo Silva",
        tipoOcorrencia: "ATESTADO_MEDICO",
        categoriaAusencia: "Afastamento",
        dataInicio: dataConflito,
        dataFim: dataConflito,
        diasAfetados: 1,
        status: "VALIDADA",
        observacaoPublica: "Ausência RM: Afastamento",
        criadoEm: "2026-08-24",
      };

      // Apontamento manual marcando como Presente
      const aptoManualP = {
        id: "apto-manual-p",
        postoCodigo: "PST-TESTE-001",
        idPosto: "PST-TESTE-001",
        funcaoPosto: "Almoxarife",
        dataReferencia: dataConflito,
        competencia: "2026-08",
        texto: "Colaborador compareceu presencialmente. Marcado como P manualmente.",
        criadoPor: "Supervisor Premier",
        dataCriacao: "2026-08-25",
        status: "ABERTO" as const,
      };

      const estadoConflito = {
        ...estadoTeste,
        ocorrencias: [ausenciaRM],
        apontamentos: [aptoManualP],
      };

      const conflitos = detectarConflitosOperacionais(estadoConflito);
      const confPComAusencia = conflitos.find((c) => c.tipo === "TITULAR_PRESENTE_COM_AUSENCIA_RM");
      expect(confPComAusencia).toBeDefined();
      expect(confPComAusencia?.detalhes.titularMatricula).toBe("010001");

      // Sincronização como pendências de ponto
      const pendencias = sincronizarConflitosComoPendencias(estadoConflito);
      expect(pendencias.some((p: any) => p.tipo === "TITULAR_PRESENTE_COM_AUSENCIA_RM")).toBe(true);
    });
  });

  // ===========================================================================
  // REQUISITO 5: Exportação XLSX de Descobertos do Período
  // ===========================================================================
  describe("5. Exportação Oficial de Descobertos para Excel (.xlsx)", () => {
    it("deve gerar buffer XLSX formatado com abas de Resumo Executivo e Descobertos Analítico", () => {
      const buffer = gerarPlanilhaDescobertosXlsx(
        [
          {
            unidade: "CABIUNAS",
            posicaoId: "POS-TESTE-001-01",
            codigoVisual: "1.1",
            codigoPosto: "PST-TESTE-001",
            funcao: "Almoxarife Líder",
            data: "17/08/2026",
            diaSemana: "SEG",
            titularNome: "Carlos Eduardo Silva",
            titularChapa: "010001",
            categoriaAusencia: "Férias",
            horario: "07:00 às 16:48",
            feristasSugeridos: "Gilmara (020002)",
            status: "DESCOBERTO (D)",
          },
        ],
        "Agosto / 2026"
      );

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);

      // Lê a planilha gerada e valida abas
      const wb = XLSX.read(buffer, { type: "array" });
      expect(wb.SheetNames).toContain("Resumo Executivo");
      expect(wb.SheetNames).toContain("Descobertos Analítico");

      const dadosAnaliticos = XLSX.utils.sheet_to_json(wb.Sheets["Descobertos Analítico"]);
      expect(dadosAnaliticos.length).toBe(1);
      expect((dadosAnaliticos[0] as any)["Status"]).toBe("DESCOBERTO (D)");
      expect((dadosAnaliticos[0] as any)["Categoria Ausência (RM)"]).toBe("Férias");
    });
  });
});
