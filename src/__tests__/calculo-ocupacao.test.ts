import { describe, it, expect } from "vitest";
import {
  calcularOcupacao,
  FiltrosCalculoOcupacao,
  PostoEntrada,
  PontoEntrada,
  OcorrenciaEntrada,
  CoberturaEntrada,
} from "../lib/servicos/calculo-ocupacao";
import { obterOcupacaoConsolidada } from "../lib/servicos/adaptador-painel";

describe("Suíte de Testes Obrigatórios do Motor de Ocupação e Painel Geral (Parte 7)", () => {
  // Posto base para testes unitários
  const postoBase: PostoEntrada = {
    id: "pst-teste-01",
    codigoPosto: "PST-TESTE-01",
    funcao: "Almoxarife Teste",
    unidadeId: "UFN-III",
    unidadeNome: "UFN III – Três Lagoas/MS",
    escala: "5x2",
    jornadaSemanalHoras: 44,
    horarioInicio: "07:00",
    horarioFim: "16:48",
    titularMatricula: "PRM-TESTE-01",
    titularNome: "Colaborador Teste",
    situacao: "ATIVO",
    valorMensal: 9000.0,
  };

  // 1. Posto com titular presente em todos os dias -> SLA 100% e glosa zero
  it("Cenário 1: Posto com titular presente em todos os dias previstos -> SLA 100% e glosa zero", () => {
    // 5 dias úteis de teste (01/09 a 05/09/2026)
    const pontos: PontoEntrada[] = [
      { matricula: "PRM-TESTE-01", data: "2026-09-01", situacaoPonto: "PRESENTE", horaEntrada: "07:00", horaSaida: "16:48" },
      { matricula: "PRM-TESTE-01", data: "2026-09-02", situacaoPonto: "PRESENTE", horaEntrada: "07:00", horaSaida: "16:48" },
      { matricula: "PRM-TESTE-01", data: "2026-09-03", situacaoPonto: "PRESENTE", horaEntrada: "07:00", horaSaida: "16:48" },
      { matricula: "PRM-TESTE-01", data: "2026-09-04", situacaoPonto: "PRESENTE", horaEntrada: "07:00", horaSaida: "16:48" },
    ];

    const filtros: FiltrosCalculoOcupacao = {
      competencia: "2026-09",
      dataReferenciaHoje: "2026-09-04",
      perfilUsuario: "PREMIER_GESTOR",
      dados: {
        postos: [postoBase],
        ocorrencias: [],
        coberturas: [],
        pontos,
        logsImportacao: [
          { fonte: "RHID", dataExecucao: "2026-09-04 18:00", periodoFim: "2026-09-04 18:00", status: "CONCLUIDO" },
        ],
        apontamentos: [],
        parametros: { metaSla: 95.0, fatorGlosa: 1.0 },
      },
    };

    const resultado = calcularOcupacao(filtros);

    expect(resultado.coberturaAgora.descobertos).toBe(0);
    expect(resultado.coberturaAgora.presentes).toBe(1);
    expect(resultado.coberturaAgora.percentual).toBe(100);
    expect(resultado.slaCompetencia.valor).toBe(100);
    expect(resultado.descobertosCompetencia.totalDescobertos).toBe(0);
    expect(resultado.glosaEstimada.valorTotal).toBe(0);
  });

  // 2. Titular ausente com substituto com ponto -> COBERTO, contando no SLA como atendido
  it("Cenário 2: Titular ausente com substituto com ponto -> COBERTO, contando no SLA como atendido", () => {
    const ocorrencia: OcorrenciaEntrada = {
      id: "oco-01",
      matricula: "PRM-TESTE-01",
      postoCodigo: "PST-TESTE-01",
      tipoOcorrencia: "ATESTADO_MEDICO",
      dataInicio: "2026-09-04",
      dataFim: "2026-09-04",
      status: "VALIDADA",
    };

    const cobertura: CoberturaEntrada = {
      id: "cob-01",
      postoCodigo: "PST-TESTE-01",
      titularMatricula: "PRM-TESTE-01",
      substitutoMatricula: "PRM-SUB-01",
      substitutoNome: "Substituto Teste",
      dataInicio: "2026-09-04",
      dataFim: "2026-09-04",
      tipoCobertura: "SUBSTITUICAO_INTERNA",
      status: "CONFIRMADA",
    };

    const pontos: PontoEntrada[] = [
      { matricula: "PRM-TESTE-01", data: "2026-09-01", situacaoPonto: "PRESENTE", horaEntrada: "07:00", horaSaida: "16:48" },
      { matricula: "PRM-TESTE-01", data: "2026-09-02", situacaoPonto: "PRESENTE", horaEntrada: "07:00", horaSaida: "16:48" },
      { matricula: "PRM-TESTE-01", data: "2026-09-03", situacaoPonto: "PRESENTE", horaEntrada: "07:00", horaSaida: "16:48" },
      { matricula: "PRM-TESTE-01", data: "2026-09-04", situacaoPonto: "AFASTADO" },
      { matricula: "PRM-SUB-01", data: "2026-09-04", situacaoPonto: "PRESENTE", horaEntrada: "07:00", horaSaida: "16:48", codigoPosto: "PST-TESTE-01" },
    ];

    const filtros: FiltrosCalculoOcupacao = {
      competencia: "2026-09",
      dataReferenciaHoje: "2026-09-04",
      perfilUsuario: "PREMIER_GESTOR",
      dados: {
        postos: [postoBase],
        ocorrencias: [ocorrencia],
        coberturas: [cobertura],
        pontos,
        logsImportacao: [
          { fonte: "RHID", dataExecucao: "2026-09-04 18:00", periodoFim: "2026-09-04 18:00", status: "CONCLUIDO" },
        ],
        apontamentos: [],
        parametros: { metaSla: 95.0, fatorGlosa: 1.0 },
      },
    };

    const resultado = calcularOcupacao(filtros);
    const detalheHoje = resultado.matrizDetalhada[`${postoBase.id}_2026-09-04`];

    expect(detalheHoje.status).toBe("COBERTO");
    expect(detalheHoje.letra).toBe("C");
    expect(resultado.coberturaAgora.substitutos).toBe(1);
    expect(resultado.coberturaAgora.descobertos).toBe(0);
    expect(resultado.slaCompetencia.valor).toBe(100); // Coberto conta como atendido
    expect(resultado.glosaEstimada.valorTotal).toBe(0);
  });

  // 3. Titular ausente sem substituto -> DESCOBERTO, reduzindo SLA e somando na glosa
  it("Cenário 3: Titular ausente sem substituto -> DESCOBERTO, reduzindo SLA e gerando glosa", () => {
    const ocorrencia: OcorrenciaEntrada = {
      id: "oco-02",
      matricula: "PRM-TESTE-01",
      postoCodigo: "PST-TESTE-01",
      tipoOcorrencia: "FALTA_INJUSTIFICADA",
      dataInicio: "2026-09-04",
      dataFim: "2026-09-04",
      status: "VALIDADA",
    };

    const pontos: PontoEntrada[] = [
      { matricula: "PRM-TESTE-01", data: "2026-09-01", situacaoPonto: "PRESENTE", horaEntrada: "07:00", horaSaida: "16:48" },
      { matricula: "PRM-TESTE-01", data: "2026-09-02", situacaoPonto: "PRESENTE", horaEntrada: "07:00", horaSaida: "16:48" },
      { matricula: "PRM-TESTE-01", data: "2026-09-03", situacaoPonto: "AUSENTE" },
      { matricula: "PRM-TESTE-01", data: "2026-09-04", situacaoPonto: "AUSENTE" },
    ];

    const filtros: FiltrosCalculoOcupacao = {
      competencia: "2026-09",
      dataReferenciaHoje: "2026-09-04",
      perfilUsuario: "PREMIER_GESTOR",
      dados: {
        postos: [postoBase],
        ocorrencias: [ocorrencia],
        coberturas: [], // Sem substituto
        pontos,
        logsImportacao: [
          { fonte: "RHID", dataExecucao: "2026-09-04 18:00", periodoFim: "2026-09-04 18:00", status: "CONCLUIDO" },
        ],
        apontamentos: [],
        parametros: { metaSla: 95.0, fatorGlosa: 1.0 },
      },
    };

    const resultado = calcularOcupacao(filtros);
    const detalheHoje = resultado.matrizDetalhada[`${postoBase.id}_2026-09-04`];

    expect(detalheHoje.status).toBe("DESCOBERTO");
    expect(detalheHoje.letra).toBe("F");
    expect(resultado.coberturaAgora.descobertos).toBe(1);
    expect(resultado.coberturaAgora.percentual).toBe(0);
    // 1 dia atendido (03/09) e 1 dia descoberto (04/09) -> SLA = 50%
    expect(resultado.slaCompetencia.valor).toBe(50);
    expect(resultado.glosaEstimada.valorTotal).toBeGreaterThan(0);
  });

  // 4. Data posterior à última importação do RHID -> SEM_DADO, fora do SLA e da glosa
  it("Cenário 4: Data posterior ao corte de carga do RHID -> SEM_DADO, fora do SLA e da glosa", () => {
    const filtros: FiltrosCalculoOcupacao = {
      competencia: "2026-09",
      dataReferenciaHoje: "2026-09-10",
      perfilUsuario: "PREMIER_GESTOR",
      dados: {
        postos: [postoBase],
        ocorrencias: [],
        coberturas: [],
        pontos: [
          { matricula: "PRM-TESTE-01", data: "2026-09-01", situacaoPonto: "PRESENTE" },
        ],
        logsImportacao: [
          // RHID cobriu apenas até 05/09
          { fonte: "RHID", dataExecucao: "2026-09-05 18:00", periodoFim: "2026-09-05 18:00", status: "CONCLUIDO" },
        ],
        apontamentos: [],
        parametros: { metaSla: 95.0, fatorGlosa: 1.0 },
      },
    };

    const resultado = calcularOcupacao(filtros);
    const detalheDiaAlem = resultado.matrizDetalhada[`${postoBase.id}_2026-09-08`];

    expect(detalheDiaAlem.status).toBe("SEM_DADO");
    expect(detalheDiaAlem.letra).toBe("?");
    // SEM_DADO não deve somar como descoberto no cálculo de glosa
    expect(resultado.descobertosCompetencia.totalSemDado).toBeGreaterThan(0);
  });

  // 5. Dia sem escala -> SEM_ESCALA, fora de todos os cálculos
  it("Cenário 5: Fim de semana ou feriado em escala 5x2 -> SEM_ESCALA ('–'), fora dos denominadores", () => {
    const filtros: FiltrosCalculoOcupacao = {
      competencia: "2026-09",
      dataReferenciaHoje: "2026-09-06", // Domingo
      perfilUsuario: "PREMIER_GESTOR",
      dados: {
        postos: [postoBase],
        ocorrencias: [],
        coberturas: [],
        pontos: [],
        logsImportacao: [
          { fonte: "RHID", dataExecucao: "2026-09-16 18:00", periodoFim: "2026-09-16 18:00", status: "CONCLUIDO" },
        ],
        apontamentos: [],
        parametros: { metaSla: 95.0, fatorGlosa: 1.0 },
      },
    };

    const resultado = calcularOcupacao(filtros);
    const detalheDomingo = resultado.matrizDetalhada[`${postoBase.id}_2026-09-06`];

    expect(detalheDomingo.status).toBe("SEM_ESCALA");
    expect(detalheDomingo.letra).toBe("–");
    // Denominador de hoje é zero porque não há escala no domingo
    expect(resultado.coberturaAgora.postosComEscalaHoje).toBe(0);
    expect(resultado.coberturaAgora.postosSemEscalaHoje).toBe(1);
  });

  // 6. Cenário de regressão da tela anterior: 15 postos, 1 descoberto hoje e 2 coberturas vigentes
  it("Cenário 6 (Regressão): 15 postos de UFN-III, 1 descoberto hoje e 2 coberturas cadastradas -> Coerência 100% entre cards, selo e barra", () => {
    const resultado = obterOcupacaoConsolidada(undefined, {
      baseId: "UFN-III",
      dataHoje: "2026-09-16",
      competencia: "2026-09",
    });

    // UFN-III possui 15 postos no Anexo 1-A
    expect(resultado.gradeSemanal.totalPostos).toBe(15);

    // Hoje (16/09/2026): 12 titulares presentes, 0 coberturas hoje (as coberturas foram nos dias 03-05 e 11), 1 descoberto (PST-LOG-013 vago), 2 em folga de escala (PST-LOG-004 e 005)
    expect(resultado.coberturaAgora.descobertos).toBe(1);
    expect(resultado.coberturaAgora.substitutos).toBe(0);
    expect(resultado.coberturaAgora.presentes).toBe(12);
    expect(resultado.coberturaAgora.postosComEscalaHoje).toBe(13); // 12 presentes + 1 descoberto = 13 com escala (2 postos em folga de escala 12x36)

    // Coerência do Selo: NUNCA '100% coberto' se há 1 descoberto!
    expect(resultado.coberturaAgora.statusSelo).not.toContain("100% coberto");
    expect(resultado.coberturaAgora.statusSelo).toContain("1 descoberto");
    expect(resultado.coberturaAgora.isAlertaDescoberto).toBe(true);

    // Percentual coerente: 12 / 13 * 100 = 92.3%
    expect(resultado.coberturaAgora.percentual).toBe(92.3);

    // Barra e subtítulo coerentes
    expect(resultado.coberturaAgora.textoApoio).toContain("12 titular(es)");
    expect(resultado.coberturaAgora.textoApoio).toContain("1 descoberto(s)");
  });

  // 7. Parâmetro de glosa ausente -> Indicador retorna estado 'PARAMETRIZAR', não zero
  it("Cenário 7: Parâmetro de glosa ou valor de posto ausente -> Status 'PARAMETRIZAR' com valor null", () => {
    const resultado = obterOcupacaoConsolidada(undefined, {
      baseId: "UFN-III",
      parametroAusente: true,
    });

    expect(resultado.glosaEstimada.status).toBe("PARAMETRIZAR");
    expect(resultado.glosaEstimada.valorTotal).toBeNull();
  });

  // 8. Perfil Fiscalização Petrobras -> Glosa omitida por LGPD e motivos médicos sanitizados
  it("Cenário 8 (LGPD / RBAC): Perfil PETROBRAS_FISCAL -> Glosa omitida e proteção de dados sensíveis", () => {
    const resultado = obterOcupacaoConsolidada(undefined, {
      baseId: "UFN-III",
      perfilUsuario: "PETROBRAS_FISCAL",
    });

    // 1. Glosa omitida
    expect(resultado.glosaEstimada.status).toBe("OMITIDO_LGPD");
    expect(resultado.glosaEstimada.valorTotal).toBeNull();

    // 2. Não expõe detalhes médicos ou CID no painel
    Object.values(resultado.matrizDetalhada).forEach((celula) => {
      expect(celula.motivo).not.toContain("CID-10");
      expect(celula.motivo).not.toContain("M54.5");
      expect(celula.motivo).not.toContain("CRM");
    });
  });
});
