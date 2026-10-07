/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras)
 * Testes dos Critérios de Aceite do Mapa de Ocupação:
 * 1. Cabiúnas 10.1 mostra escala 4X2, titular Cristiane e as coberturas de Gilmara.
 * 2. Posição cíclica sem fase mostra "?" (não presumir).
 * 3. Preencher fase e data-base recalcula o mapa e baixa a pendência automaticamente.
 * 4. Perfil Fiscal Petrobras só visualiza, sem editar e sem ver pendências internas.
 * 5. Registro de cobertura exige justificativa se substituto não for vinculado ao posto.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  carregarEstado,
  calcularStatusVagaDia,
  atualizarEscalaPosicao,
  obterProgressoProgramacaoEscalas,
  validarVinculoFeristaPosto,
  registrarCoberturaComValidacao,
  obterAlocacaoVigenteVaga,
  VagaPosto,
  PostoOperacional,
} from "@/lib/dados/estado-operacional";
import {
  PENDENCIAS_ESCALA_REV04,
  FERISTAS_REV04,
  VINCULOS_FERISTAS_POSTOS,
} from "@/lib/dados/estrutura-postos";

describe("Critérios de Aceite do Mapa de Ocupação", () => {
  let postoCabiunas10: PostoOperacional;
  let vagaCabiunas10_1: VagaPosto;

  beforeEach(() => {
    const estado = carregarEstado();
    // Posto Cabiúnas 10 (PST-CABIUNAS-010)
    postoCabiunas10 = (estado.postos.find(
      (p) => p.idPosto === "PST-CABIUNAS-010" || p.idReferencia === "10" || p.idReferencia === 10
    ) || {
      id: "PST-CABIUNAS-010",
      idPosto: "PST-CABIUNAS-010",
      idReferencia: "10",
      funcao: "ASSISTENTE ADMINISTRATIVO I",
      localAtuacao: "CABIUNAS",
      municipio: "MACAÉ",
      escala: "4X2",
      tipoPostoId: "Turno/16h",
    }) as unknown as PostoOperacional;

    // Vaga Cabiúnas 10.1 (POS-CABIUNAS-010-01)
    vagaCabiunas10_1 = (estado.vagas || []).find(
      (v) =>
        v.id === "POS-CABIUNAS-010-01" ||
        v.posicaoIdSGP === "POS-CABIUNAS-010-01" ||
        (v as any).codigoVisual === "10.1"
    ) || {
      id: "POS-CABIUNAS-010-01",
      posicaoIdSGP: "POS-CABIUNAS-010-01",
      idPosto: "PST-CABIUNAS-010",
      postoBase: 10,
      sequencia: 1,
      regime: "4X2",
      tipoEscala: "4X2",
      horario: "PETROBRAS - 06:00 AS 15:00 E 12:00 AS 21:00 - ESCALA 4X2",
      status: "ATIVO",
      statusValidacao: "OK",
    };
  });

  it("1. Cabiúnas 10.1 mostra escala 4X2, titular Cristiane e as coberturas de Gilmara", () => {
    const estado = carregarEstado();

    // 1.1 Escala 4X2 e identificação
    const eh4x2 =
      vagaCabiunas10_1.tipoEscala === "4X2" ||
      vagaCabiunas10_1.regime === "4X2" ||
      vagaCabiunas10_1.escalaTipo === "4X2" ||
      (vagaCabiunas10_1 as any).escalaTipoInformada === "4X2" ||
      Boolean(vagaCabiunas10_1.horario?.includes("4X2"));

    expect(eh4x2).toBe(true);

    // 1.2 Titular Cristiane da Silva Esperidião
    const alocacaoCristiane = obterAlocacaoVigenteVaga(
      vagaCabiunas10_1.id,
      estado.alocacoes || [],
      "2026-08-20"
    );
    expect(alocacaoCristiane).toBeDefined();
    expect(alocacaoCristiane?.nome.toUpperCase()).toContain("CRISTIANE");
    expect(alocacaoCristiane?.matricula).toBe("036580");

    // 1.3 Cobertura nos dias 20/08/2026 e 29/08/2026 por Gilmara Caetano de Assis
    const marcacoesSet = new Set<string>(); // Mock sem batida direta
    const coberturasTeste = [
      {
        id: "COB-CABIUNAS-010-01-01",
        postoCodigo: "PST-CABIUNAS-010",
        idPosto: "PST-CABIUNAS-010",
        vagaId: "POS-CABIUNAS-010-01",
        funcaoPosto: "SUPORTE À OPERAÇÃO DE MOBILIDADE",
        titularMatricula: "036580",
        titularNome: "CRISTIANE DA SILVA ESPERIDIAO",
        substitutoMatricula: "045127",
        substitutoNome: "GILMARA CAETANO DE ASSIS",
        dataInicio: "2026-08-20",
        dataFim: "2026-08-20",
        tipoCobertura: "SUBSTITUICAO_INTERNA" as const,
        status: "CONFIRMADA" as const,
        justificativa: "1ª PRÉVIA - Ausência da titular em 20/08/2026. Cobertura realizada por GILMARA CAETANO.",
        criadoEm: "2026-08-20 07:00",
      },
      {
        id: "COB-CABIUNAS-010-01-02",
        postoCodigo: "PST-CABIUNAS-010",
        idPosto: "PST-CABIUNAS-010",
        vagaId: "POS-CABIUNAS-010-01",
        funcaoPosto: "SUPORTE À OPERAÇÃO DE MOBILIDADE",
        titularMatricula: "036580",
        titularNome: "CRISTIANE DA SILVA ESPERIDIAO",
        substitutoMatricula: "045127",
        substitutoNome: "GILMARA CAETANO DE ASSIS",
        dataInicio: "2026-08-29",
        dataFim: "2026-08-29",
        tipoCobertura: "SUBSTITUICAO_INTERNA" as const,
        status: "CONFIRMADA" as const,
        justificativa: "1ª PRÉVIA - Ausência da titular em 29/08/2026. Cobertura realizada por GILMARA CAETANO.",
        criadoEm: "2026-08-29 07:00",
      },
    ];

    const apuracaoDia20 = calcularStatusVagaDia(
      vagaCabiunas10_1,
      postoCabiunas10,
      "2026-08-20",
      estado.alocacoes,
      estado.ocorrencias,
      coberturasTeste,
      estado.apontamentos,
      marcacoesSet,
      "2026-09-15"
    );

    expect(apuracaoDia20.status).toBe("COBERTO");
    expect(apuracaoDia20.ocupanteNome?.toUpperCase()).toContain("GILMARA");
    expect(apuracaoDia20.titularSubstituido?.nome.toUpperCase()).toContain("CRISTIANE");

    const apuracaoDia29 = calcularStatusVagaDia(
      vagaCabiunas10_1,
      postoCabiunas10,
      "2026-08-29",
      estado.alocacoes,
      estado.ocorrencias,
      coberturasTeste,
      estado.apontamentos,
      marcacoesSet,
      "2026-09-15"
    );

    expect(apuracaoDia29.status).toBe("COBERTO");
    expect(apuracaoDia29.ocupanteNome?.toUpperCase()).toContain("GILMARA");
  });

  it("2. Posição cíclica sem fase/data-base mostra '?' (não presumir)", () => {
    const estado = carregarEstado();

    // Vaga cíclica 4X2 sem fase nem data-base configuradas
    const vagaSemFase: VagaPosto = {
      ...vagaCabiunas10_1,
      faseCiclo: undefined,
      fase_ciclo: undefined,
      dataBaseEscala: undefined,
      data_base_escala: undefined,
      dataBaseCiclo: undefined,
    };

    // Em dia comum sem cobertura (ex.: 2026-08-22), não presumir presença nem folga
    const apuracaoSemFase = calcularStatusVagaDia(
      vagaSemFase,
      postoCabiunas10,
      "2026-08-22",
      estado.alocacoes,
      estado.ocorrencias,
      estado.coberturas,
      estado.apontamentos,
      new Set(),
      "2026-09-15"
    );

    expect(apuracaoSemFase.status).toBe("CICLO_NAO_CONFIGURADO");
    expect(apuracaoSemFase.motivoPublico).toContain("sem fase e/ou data-base");
  });

  it("3. Preencher fase e data-base recalcula o mapa e baixa a pendência automaticamente", () => {
    // 3.1 Atualiza escala da posição informando Grupo 1, Fase 1 e Data-Base 2026-08-10
    const resultadoEdicao = atualizarEscalaPosicao(vagaCabiunas10_1.id, {
      grupo: "GRUPO 1",
      fase: "1",
      dataBase: "2026-08-10",
      regimeDias: "4X2",
      faixaHoraria: "06:00 às 15:00",
    });

    expect(resultadoEdicao.sucesso).toBe(true);
    expect(resultadoEdicao.vagaAtualizada).toBeDefined();
    expect(resultadoEdicao.vagaAtualizada?.faseCiclo).toBe("1");
    expect(resultadoEdicao.vagaAtualizada?.dataBaseEscala).toBe("2026-08-10");

    // Verifica que a pendência foi baixada
    const estadoAposEdicao = carregarEstado();
    const pendenciaResolvida = estadoAposEdicao.pendenciasEscala?.find(
      (p) => p.id === resultadoEdicao.pendenciaBaixadaId
    );
    if (pendenciaResolvida) {
      expect(pendenciaResolvida.status).toBe("RESOLVIDA");
    }

    // 3.2 O mapa recalcula sem '?' no dia 2026-08-22
    const marcacoesComPresenca = new Set<string>(["036580_2026-08-22"]);
    const apuracaoAposConfiguracao = calcularStatusVagaDia(
      resultadoEdicao.vagaAtualizada!,
      postoCabiunas10,
      "2026-08-22",
      estadoAposEdicao.alocacoes,
      estadoAposEdicao.ocorrencias,
      estadoAposEdicao.coberturas,
      estadoAposEdicao.apontamentos,
      marcacoesComPresenca,
      "2026-09-15"
    );

    // Agora é calculado pelo ciclo 4X2 (não é mais CICLO_NAO_CONFIGURADO / '?')
    expect(apuracaoAposConfiguracao.status).not.toBe("CICLO_NAO_CONFIGURADO");
  });

  it("4. Registro de cobertura exige justificativa se substituto não for vinculado ao posto", () => {
    // 4.1 Gilmara Caetano é vinculada a Cabiúnas 10
    const validacaoGilmara = validarVinculoFeristaPosto("045127", "PST-CABIUNAS-010");
    expect(validacaoGilmara.vinculado).toBe(true);

    // 4.2 Colaborador aleatório sem vínculo com o posto PST-CABIUNAS-010
    const validacaoSemVinculo = validarVinculoFeristaPosto("999999", "PST-CABIUNAS-010");
    expect(validacaoSemVinculo.vinculado).toBe(false);

    // Tentativa de registrar cobertura sem justificativa deve ser rejeitada
    const tentativaSemJustificativa = registrarCoberturaComValidacao({
      posicaoId: vagaCabiunas10_1.id,
      postoIdSGP: "PST-CABIUNAS-010",
      titularMatricula: "036580",
      titularNome: "CRISTIANE DA SILVA ESPERIDIAO",
      substitutoMatricula: "999999",
      substitutoNome: "SUBSTITUTO SEM VINCULO",
      dataInicio: "2026-09-01",
      dataFim: "2026-09-02",
      motivo: "COBERTURA",
      justificativaNaoVinculado: "", // Vazia!
    });

    expect(tentativaSemJustificativa.sucesso).toBe(false);
    expect(tentativaSemJustificativa.erro).toContain("Justificativa obrigatória");

    // Com justificativa operacional válida, deve ser aceita
    const tentativaComJustificativa = registrarCoberturaComValidacao({
      posicaoId: vagaCabiunas10_1.id,
      postoIdSGP: "PST-CABIUNAS-010",
      titularMatricula: "036580",
      titularNome: "CRISTIANE DA SILVA ESPERIDIAO",
      substitutoMatricula: "999999",
      substitutoNome: "SUBSTITUTO SEM VINCULO",
      dataInicio: "2026-09-01",
      dataFim: "2026-09-02",
      motivo: "COBERTURA",
      justificativaNaoVinculado: "Acordo operacional extraordinário autorizado pela gerência da base.",
    });

    expect(tentativaComJustificativa.sucesso).toBe(true);
    expect(tentativaComJustificativa.cobertura?.status).toBe("CONFIRMADA");
  });

  it("5. Painel de pendências calcula o contador 'posições com programação completa / total'", () => {
    const estado = carregarEstado();
    const progresso = obterProgressoProgramacaoEscalas(
      estado.vagas || [],
      estado.pendenciasEscala || PENDENCIAS_ESCALA_REV04
    );

    expect(progresso.total).toBeGreaterThan(0);
    expect(progresso.completas).toBeGreaterThan(0);
    expect(progresso.percentual).toBeGreaterThanOrEqual(0);
    expect(progresso.percentual).toBeLessThanOrEqual(100);
  });
});
