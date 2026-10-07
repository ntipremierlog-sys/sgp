/**
 * Testes Automatizados — MOMENTO 3: Importação do Cubo de Abono RM e Ocorrências
 * SGP (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 *
 * NOTA DE CONFORMIDADE: Todos os testes utilizam planilhas e colaboradores fictícios/sintéticos.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import {
  identificarArquivoAbono,
  simularImportacaoAbono,
  confirmarImportacaoAbono,
  gerarRelatorioValidacaoAbonoXlsx,
  gerarModeloCuboAbonoXlsx,
} from "@/lib/importadores/cubo-abono";
import {
  carregarEstado,
  salvarEstado,
  desfazerUltimoLote,
  EstadoOperacionalCompleto,
} from "@/lib/dados/estado-operacional";
import {
  calcularOcupacao,
  FiltrosCalculoOcupacao,
} from "@/lib/servicos/calculo-ocupacao";

function criarPlanilhaBuffer(linhas: Record<string, unknown>[], sheetName: string = "Sheet"): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(linhas);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(out);
}

describe("MOMENTO 3 — Motor de Importação do Cubo de Abono e Ocorrências", () => {
  let estadoBaseMock: EstadoOperacionalCompleto;

  beforeEach(() => {
    estadoBaseMock = {
      postos: [
        {
          id: "pst-ufn3-01",
          idPosto: "1",
          codigoPosto: "UFN3-ALM-01",
          funcao: "Almoxarife Líder",
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
          titularMatricula: "010001",
          titularNome: "Colaborador Titular Fictício",
          situacao: "ATIVO",
          dataInicioVigencia: "2026-01-01",
        },
      ],
      profissionais: [
        {
          id: "prf-010001",
          chapa: "010001",
          matricula: "010001",
          nome: "Colaborador Titular Fictício",
          cpfLimpo: "11122233344",
          cpfMascarado: "***.222.333-**",
          funcao: "Almoxarife Líder",
          unidadeId: "UFN-III",
          postoCodigo: "UFN3-ALM-01",
          escala: "5x2",
          situacao: "ATIVO",
          dataAdmissao: "2025-01-01",
        },
        {
          id: "prf-020002",
          chapa: "020002",
          matricula: "020002",
          nome: "Colaborador Reserva Fictício",
          cpfLimpo: "55566677788",
          cpfMascarado: "***.666.777-**",
          funcao: "Almoxarife I",
          unidadeId: "UFN-III",
          escala: "5x2",
          situacao: "ATIVO",
          dataAdmissao: "2025-06-01",
        },
      ],
      ocorrencias: [],
      coberturas: [],
      apontamentos: [],
      logsAuditoria: [],
      lotesImportacao: [],
      perfilAtivo: "PREMIER_ADMIN",
      unidadeSelecionada: "UFN III – Três Lagoas/MS",
    };
    salvarEstado(estadoBaseMock);
  });

  describe("1. Identificação Automática de Cabeçalhos", () => {
    it("deve reconhecer corretamente os cabeçalhos oficiais do Cubo de Abono", () => {
      const cabecalhos = [
        "COD.SECÃO",
        "DESC. SECAO",
        "CHAPA",
        "NOME_FUNCIONARIO",
        "SITUACAO",
        "DATAADMISSAO",
        "DESC. FUNCAO",
        "DIA SEMANA",
        "DATA",
        "ABONO2",
        "DESCRICAO ABONO",
      ];
      const resultado = identificarArquivoAbono(cabecalhos);
      expect(resultado.reconhecido).toBe(true);
      expect(resultado.tipo).toBe("ABONO_RM");
      expect(resultado.colunasObrigatoriasFaltando.length).toBe(0);
    });

    it("deve reconhecer tolerando variações de acentuação (COD.SEÇÃO e DESC. SEÇÃO)", () => {
      const cabecalhos = [
        "COD.SEÇÃO",
        "DESC. SEÇÃO",
        "CHAPA",
        "DATA",
        "DESCRICAO ABONO",
      ];
      const resultado = identificarArquivoAbono(cabecalhos);
      expect(resultado.reconhecido).toBe(true);
      expect(resultado.tipo).toBe("ABONO_RM");
    });

    it("deve rejeitar arquivo quando faltarem colunas obrigatórias", () => {
      const cabecalhos = ["COD.SECÃO", "DESC. SECAO", "NOME_FUNCIONARIO"];
      const resultado = identificarArquivoAbono(cabecalhos);
      expect(resultado.reconhecido).toBe(false);
      expect(resultado.tipo).toBe("DESCONHECIDO");
      expect(resultado.colunasObrigatoriasFaltando).toContain("chapa");
      expect(resultado.colunasObrigatoriasFaltando).toContain("data");
      expect(resultado.colunasObrigatoriasFaltando).toContain("descricao abono");
    });
  });

  describe("2. Categorização das 6 Descrições Reais de Abono e Normalização", () => {
    it("deve classificar corretamente os tipos de abono reais do contrato", async () => {
      const linhas = [
        {
          CHAPA: "010001",
          NOME_FUNCIONARIO: "Colaborador Titular",
          "DESC. SECAO": "UFN-III",
          DATA: "03/08/2026",
          "DIA SEMANA": "SEG",
          "DESCRICAO ABONO": "ATESTADO MEDICO",
        },
        {
          CHAPA: "010001",
          NOME_FUNCIONARIO: "Colaborador Titular",
          "DESC. SECAO": "UFN-III",
          DATA: "04/08/2026",
          "DIA SEMANA": "TER",
          "DESCRICAO ABONO": "ABONADO PELO SUPERIOR",
        },
        {
          CHAPA: "010001",
          NOME_FUNCIONARIO: "Colaborador Titular",
          "DESC. SECAO": "UFN-III",
          DATA: "05/08/2026",
          "DIA SEMANA": "QUA",
          "DESCRICAO ABONO": "DECLARACAO COMPARECIMENTO",
        },
        {
          CHAPA: "010001",
          NOME_FUNCIONARIO: "Colaborador Titular",
          "DESC. SECAO": "UFN-III",
          DATA: "06/08/2026",
          "DIA SEMANA": "QUI",
          "DESCRICAO ABONO": "ATESTADO DE ACOMPANHAMENTO",
        },
        {
          CHAPA: "010001",
          NOME_FUNCIONARIO: "Colaborador Titular",
          "DESC. SECAO": "UFN-III",
          DATA: "07/08/2026",
          "DIA SEMANA": "SEX",
          "DESCRICAO ABONO": "DOACAO DE SANGUE",
        },
        {
          CHAPA: "010001",
          NOME_FUNCIONARIO: "Colaborador Titular",
          "DESC. SECAO": "UFN-III",
          DATA: "10/08/2026",
          "DIA SEMANA": "SEG",
          "DESCRICAO ABONO": "ATESTADO COMP ELEITORAL",
        },
      ];

      const buffer = criarPlanilhaBuffer(linhas);
      const simulacao = await simularImportacaoAbono(buffer, "abonos_ficticios.xlsx", "2026-08-31", estadoBaseMock);

      expect(simulacao.totais.lidos).toBe(6);
      expect(simulacao.totais.novos).toBe(6);
      expect(simulacao.totais.erros).toBe(0);

      // Verificação da categorização
      expect(simulacao.linhas[0].dados.tipoOcorrencia).toBe("ATESTADO_MEDICO");
      expect(simulacao.linhas[1].dados.tipoOcorrencia).toBe("ABONO_LEGAL");
      expect(simulacao.linhas[2].dados.tipoOcorrencia).toBe("FALTA_JUSTIFICADA");
      expect(simulacao.linhas[3].dados.tipoOcorrencia).toBe("FALTA_JUSTIFICADA");
      expect(simulacao.linhas[4].dados.tipoOcorrencia).toBe("ABONO_LEGAL");
      expect(simulacao.linhas[5].dados.tipoOcorrencia).toBe("ABONO_LEGAL");

      // Verificação das datas convertidas para ISO YYYY-MM-DD
      expect(simulacao.linhas[0].dados.data).toBe("2026-08-03");
      expect(simulacao.linhas[5].dados.data).toBe("2026-08-10");

      // Verificação do posto vinculado automaticamente
      expect(simulacao.linhas[0].dados.postoCodigo).toBe("UFN3-ALM-01");
    });

    it("deve normalizar chapa com zeros à esquerda e alertar se não encontrada no RM", async () => {
      const linhas = [
        {
          CHAPA: "10001", // 5 dígitos -> deve virar "010001"
          DATA: "11/08/2026",
          "DESCRICAO ABONO": "ATESTADO MEDICO",
        },
        {
          CHAPA: "999999", // Não existe no RM
          DATA: "12/08/2026",
          "DESCRICAO ABONO": "ATESTADO MEDICO",
        },
        {
          CHAPA: "", // Chapa vazia -> erro
          DATA: "13/08/2026",
          "DESCRICAO ABONO": "ATESTADO MEDICO",
        },
      ];

      const buffer = criarPlanilhaBuffer(linhas);
      const simulacao = await simularImportacaoAbono(buffer, "teste_chapas.xlsx", "2026-08-31", estadoBaseMock);

      expect(simulacao.totais.lidos).toBe(3);
      expect(simulacao.totais.erros).toBe(1); // Linha sem chapa
      expect(simulacao.totais.alertas).toBe(1); // Chapa 999999 não encontrada

      // Linha 1: 10001 virou 010001 e vinculou com RM
      expect(simulacao.linhas[0].dados.chapa).toBe("010001");
      expect(simulacao.linhas[0].validaParaGravacao).toBe(true);

      // Linha 2: 999999 gerou alerta de não cadastrado
      expect(simulacao.linhas[1].inconsistencias.some((i) => i.tipo === "ALERTA")).toBe(true);

      // Linha 3: chapa vazia gerou erro e não pode ser gravada
      expect(simulacao.linhas[2].validaParaGravacao).toBe(false);
      expect(simulacao.linhas[2].statusAcao).toBe("ERRO");
    });
  });

  describe("3. Confirmação do Lote, Deduplicação e Rollback (Desfazer Lote)", () => {
    it("deve confirmar importação, gravar ocorrências e permitir desfazer lote restaurando estado", async () => {
      const linhas = [
        {
          CHAPA: "010001",
          NOME_FUNCIONARIO: "Colaborador Titular",
          "DESC. SECAO": "UFN-III",
          DATA: "15/08/2026",
          "DIA SEMANA": "SAB",
          "DESCRICAO ABONO": "ATESTADO MEDICO",
        },
      ];

      const buffer = criarPlanilhaBuffer(linhas);
      const simulacao = await simularImportacaoAbono(buffer, "lote_teste.xlsx", "2026-08-31", estadoBaseMock);

      // 1. Confirmar Importação
      const resultado = confirmarImportacaoAbono(simulacao, "Administrador Premier Teste");
      expect(resultado.sucesso).toBe(true);
      expect(resultado.loteId).toContain("LOTE-ABONO-");

      const estadoPos = carregarEstado();
      expect(estadoPos.ocorrencias.length).toBe(1);
      expect(estadoPos.ocorrencias[0].matricula).toBe("010001");
      expect(estadoPos.ocorrencias[0].tipoOcorrencia).toBe("ATESTADO_MEDICO");
      expect(estadoPos.ocorrencias[0].postoCodigo).toBe("UFN3-ALM-01");
      expect(estadoPos.lotesImportacao?.[0].status).toBe("CONCLUIDO");

      // 2. Tentar importar o mesmo arquivo novamente (deve detectar duplicidade)
      const simulacaoDuplicada = await simularImportacaoAbono(buffer, "lote_teste.xlsx", "2026-08-31", estadoPos);
      expect(simulacaoDuplicada.arquivoDuplicado).toBe(true);
      expect(() => confirmarImportacaoAbono(simulacaoDuplicada)).toThrow(/já foi importado/);

      // 3. Rollback: Desfazer Lote
      const rollback = desfazerUltimoLote("ABONO_RM", "Administrador Premier Teste");
      expect(rollback.sucesso).toBe(true);

      const estadoAposRollback = carregarEstado();
      // Ocorrências devem voltar ao estado anterior (0 ocorrências)
      expect(estadoAposRollback.ocorrencias.length).toBe(0);
      expect(estadoAposRollback.lotesImportacao?.[0].status).toBe("DESFEITO");
    });
  });

  describe("4. Geração de Relatório de Validação e Modelo XLSX", () => {
    it("deve gerar arquivo XLSX de relatório de validação com as abas corretas", async () => {
      const linhas = [
        {
          CHAPA: "010001",
          NOME_FUNCIONARIO: "Colaborador Titular",
          "DESC. SECAO": "UFN-III",
          DATA: "17/08/2026",
          "DESCRICAO ABONO": "ATESTADO MEDICO",
        },
      ];
      const buffer = criarPlanilhaBuffer(linhas);
      const simulacao = await simularImportacaoAbono(buffer, "teste_relatorio.xlsx", "2026-08-31", estadoBaseMock);

      const relatorioBytes = gerarRelatorioValidacaoAbonoXlsx(simulacao);
      expect(relatorioBytes).toBeInstanceOf(Uint8Array);
      expect(relatorioBytes.length).toBeGreaterThan(100);

      // Ler o arquivo gerado
      const wb = XLSX.read(relatorioBytes, { type: "array" });
      expect(wb.SheetNames).toContain("Resumo");
      expect(wb.SheetNames).toContain("Ocorrências");
      expect(wb.SheetNames).toContain("Inconsistências");
    });

    it("deve gerar modelo oficial do Cubo de Abono", () => {
      const modeloBytes = gerarModeloCuboAbonoXlsx();
      expect(modeloBytes).toBeInstanceOf(Uint8Array);

      const wb = XLSX.read(modeloBytes, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any>(ws);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]["DESCRICAO ABONO"]).toBeDefined();
      expect(data[0]["CHAPA"]).toBeDefined();
    });
  });

  describe("5. Reflexo no Cálculo de Ocupação e Segregação LGPD", () => {
    it("deve refletir ausência justificada por abono como DESCOBERTO sem cobertura e COBERTO com cobertura", () => {
      const dataDia = "2026-08-17"; // Segunda-feira (escala 5x2 de UFN3-ALM-01 é ativa)

      // Cenário A: Titular com atestado médico ativo no dia e SEM substituto escalado
      const filtrosSemCobertura: FiltrosCalculoOcupacao = {
        baseIds: ["UFN-III"],
        competencia: "2026-08",
        dataReferenciaHoje: "2026-08-31",
        horaReferenciaHoje: "18:00",
        perfilUsuario: "PREMIER_ADMIN",
        dados: {
          postos: [
            {
              id: "pst-ufn3-01",
              codigoPosto: "UFN3-ALM-01",
              funcao: "Almoxarife Líder",
              unidadeId: "UFN-III",
              unidadeNome: "UFN III – Três Lagoas/MS",
              escala: "5x2",
              jornadaSemanalHoras: 44,
              horarioInicio: "07:00",
              horarioFim: "16:48",
              titularMatricula: "010001",
              titularNome: "Colaborador Titular Fictício",
              situacao: "ATIVO",
            },
          ],
          pontos: [], // Sem batida de ponto do titular
          ocorrencias: [
            {
              id: "oco-01",
              matricula: "010001",
              tipoOcorrencia: "ATESTADO_MEDICO",
              dataInicio: dataDia,
              dataFim: dataDia,
              status: "VALIDADA",
              observacaoPublica: "Abono/Ocorrência: ATESTADO MEDICO (SEG) - UFN-III",
            },
          ],
          coberturas: [],
          apontamentos: [],
          logsImportacao: [
            {
              fonte: "RHID",
              dataExecucao: "2026-08-31 18:00",
              periodoFim: "2026-08-31",
              status: "CONCLUIDO",
            },
          ],
        },
      };

      const resultadoA = calcularOcupacao(filtrosSemCobertura);
      const chaveDia = `pst-ufn3-01_${dataDia}`;
      const detalheDiaA = resultadoA.matrizDetalhada[chaveDia];

      expect(detalheDiaA).toBeDefined();
      expect(detalheDiaA.status).toBe("DESCOBERTO");
      expect(detalheDiaA.motivo).toMatch(/atestado/i);

      // Verificação de Segregação LGPD para Fiscal da Petrobras (sem expor detalhes internos)
      const filtrosFiscal: FiltrosCalculoOcupacao = {
        ...filtrosSemCobertura,
        perfilUsuario: "PETROBRAS_FISCAL",
      };
      const resultadoFiscal = calcularOcupacao(filtrosFiscal);
      const detalheDiaFiscal = resultadoFiscal.matrizDetalhada[chaveDia];
      expect(detalheDiaFiscal.status).toBe("DESCOBERTO");
      expect(detalheDiaFiscal.motivo).toBe("Titular em afastamento sem cobertura homologada");

      // Cenário B: Mesma ausência por atestado, mas COM substituto que bateu ponto
      const filtrosComCobertura: FiltrosCalculoOcupacao = {
        ...filtrosSemCobertura,
        dados: {
          ...filtrosSemCobertura.dados,
          coberturas: [
            {
              id: "cob-01",
              postoCodigo: "UFN3-ALM-01",
              titularMatricula: "010001",
              substitutoMatricula: "020002",
              substitutoNome: "Substituto Fictício",
              dataInicio: dataDia,
              dataFim: dataDia,
              tipoCobertura: "SUBSTITUICAO_INTERNA",
              status: "CONFIRMADA",
            },
          ],
          pontos: [
            {
              matricula: "020002",
              data: dataDia,
              horaEntrada: "07:00",
              horaSaida: "16:48",
              situacaoPonto: "PRESENTE",
            },
          ],
        },
      };

      const resultadoB = calcularOcupacao(filtrosComCobertura);
      const detalheDiaB = resultadoB.matrizDetalhada[chaveDia];

      expect(detalheDiaB).toBeDefined();
      expect(detalheDiaB.status).toBe("COBERTO");
      expect(detalheDiaB.ocupanteMatricula).toBe("020002");
    });
  });
});
