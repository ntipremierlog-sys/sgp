/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Suíte de Testes: Etapa Final Pré-Entrega aos Fiscais da Petrobras
 *
 * 1. Relatórios Oficiais (Tela, PDF e Excel idênticos para Boaventura)
 * 2. Trilha de auditoria (Registro de alteração de escala, titular, posição, cobertura e ausência com valor ant/novo)
 * 3. Segurança e LGPD (Bloqueio estrito de logs, pendências internas e dados pessoais para Fiscal Petrobras; timeout de sessão)
 * 4. Modo Homologação (Comparativo SGP × MC por posição e divergências por posto)
 */

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  carregarEstado,
  salvarEstado,
  atualizarEscalaPosicao,
  atualizarTitularPosicao,
  adicionarPosto,
  atualizarPosto,
  excluirPosto,
  adicionarCobertura,
  cancelarCobertura,
  adicionarOcorrencia,
  cancelarOcorrencia,
  VAGAS_MC_REAIS,
} from "@/lib/dados/estado-operacional";
import {
  gerarRelatorioOcupacaoPorPosto,
  gerarRelatorioCoberturas,
  gerarRelatorioDescobertos,
  gerarRelatorioQuadroFeristas,
  gerarComparativoHomologacaoMC,
  exportarRelatorioParaXlsx,
  CONTRATO_NUMERO,
} from "@/lib/servicos/relatorios-oficiais";
import { can } from "@/lib/auth/permissoes";
import { UsuarioSessao } from "@/lib/auth/tipos";
import { codificarTokenSessao, verificarSessaoAtiva, TIMEOUT_INATIVIDADE_MS } from "@/lib/auth/sessao";

describe("Etapa Final Pré-Entrega aos Fiscais da Petrobras", () => {
  const usuarioFiscal: UsuarioSessao = {
    id: "usr-fiscal-01",
    nome: "Carlos Eduardo Mendes",
    email: "carlos.mendes@petrobras.com.br",
    empresa: "Petróleo Brasileiro S.A. – Petrobras",
    perfil: "PETROBRAS_FISCAL",
    status: "ATIVO",
    tipoConta: "LOCAL",
    basesVinculadas: ["UFN-III", "BOAVENTURA"],
  };

  const usuarioAdmin: UsuarioSessao = {
    id: "usr-admin-01",
    nome: "Marcos Valério",
    email: "admin.sgp@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_ADMIN",
    status: "ATIVO",
    tipoConta: "LOCAL",
    basesVinculadas: ["TODAS"],
  };

  // ===========================================================================
  // 1. RELATÓRIOS OFICIAIS — BOAVENTURA IDÊNTICO EM TELA, PDF E EXCEL
  // ===========================================================================
  describe("1. Relatórios Oficiais (Critério de Aceite: Boaventura Idêntico em Tela, PDF e Excel)", () => {
    it("deve apurar a ocupação por posto de Boaventura com cabeçalho contratual padronizado", () => {
      const relatorio = gerarRelatorioOcupacaoPorPosto({
        unidadeId: "BOAVENTURA",
        periodo: "2026-09",
        usuarioEmissor: "Marcos Valério (Administrador Premier)",
        perfilEmissor: "PREMIER_ADMIN",
      });

      expect(relatorio.cabecalho.contrato).toBe(CONTRATO_NUMERO);
      expect(relatorio.cabecalho.periodoTexto).toContain("Setembro de 2026");
      expect(relatorio.cabecalho.usuarioEmissor).toContain("Marcos Valério");
      expect(relatorio.itens.length).toBeGreaterThan(0);

      // Todas as linhas devem pertencer a Boaventura
      const todasBoaventura = relatorio.itens.every(
        (i) => i.unidadeId === "BOAVENTURA" || i.unidadeNome.includes("Boaventura")
      );
      expect(todasBoaventura).toBe(true);

      // Todas as posições devem ter dados de P, C, D, N e % de ocupação
      for (const item of relatorio.itens) {
        expect(item.postoCodigo).toMatch(/PST-BOAVENTURA|Posto/);
        expect(item.posicaoCodigoVisual).toBeDefined();
        expect(typeof item.diasP).toBe("number");
        expect(typeof item.diasC).toBe("number");
        expect(typeof item.diasD).toBe("number");
        expect(typeof item.diasN).toBe("number");
        expect(item.diasExigiveis).toBe(item.diasP + item.diasC + item.diasD);
        expect(item.diasAtendidos).toBe(item.diasP + item.diasC);
        expect(item.percentualOcupacao).toBeGreaterThanOrEqual(0);
        expect(item.percentualOcupacao).toBeLessThanOrEqual(100);
      }
    });

    it("Relatório de Boaventura exportado em Excel (.xlsx) deve conter EXATAMENTE os mesmos dados da tela e do PDF", () => {
      // 1. Gera dados em memória (mesmo usado pela tela e pela impressão PDF)
      const relatorioTelaPdf = gerarRelatorioOcupacaoPorPosto({
        unidadeId: "BOAVENTURA",
        periodo: "2026-09",
        usuarioEmissor: "Marcos Valério",
      });

      // 2. Gera planilha Excel (.xlsx)
      const buffer = exportarRelatorioParaXlsx("ocupacao", {
        unidadeId: "BOAVENTURA",
        periodo: "2026-09",
        usuarioEmissor: "Marcos Valério",
      });

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(500);

      // 3. Lê de volta a planilha Excel e compara linha por linha
      const wb = XLSX.read(buffer, { type: "buffer" });
      expect(wb.SheetNames).toContain("Ocupacao_Postos");

      const ws = wb.Sheets["Ocupacao_Postos"];
      const linhas: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Cabeçalho da planilha
      expect(linhas[0][1]).toBe(CONTRATO_NUMERO);

      // Localiza cabeçalho de dados (linha que contém "UNIDADE / BASE")
      const idxHeader = linhas.findIndex((l) => l && l[0] === "UNIDADE / BASE");
      expect(idxHeader).toBeGreaterThan(0);

      // Linhas de dados no Excel
      const linhasDadosExcel = linhas.slice(idxHeader + 1).filter((l) => l && l[0] && l[0] !== "TOTAIS CONSOLIDADOS");
      expect(linhasDadosExcel.length).toBe(relatorioTelaPdf.itens.length);

      // Validação de paridade estrita: cada item na tela bate exatamente com o Excel
      for (let i = 0; i < relatorioTelaPdf.itens.length; i++) {
        const itemTela = relatorioTelaPdf.itens[i];
        const linhaExcel = linhasDadosExcel[i];

        expect(linhaExcel[1]).toBe(itemTela.postoCodigo); // CÓDIGO POSTO
        expect(linhaExcel[3]).toBe(itemTela.posicaoCodigoVisual); // POSIÇÃO
        expect(linhaExcel[6]).toBe(itemTela.diasP); // DIAS P
        expect(linhaExcel[7]).toBe(itemTela.diasC); // DIAS C
        expect(linhaExcel[8]).toBe(itemTela.diasD); // DIAS D
        expect(linhaExcel[9]).toBe(itemTela.diasN); // DIAS N
        expect(linhaExcel[10]).toBe(itemTela.diasExigiveis); // TOTAL EXIGÍVEL
        expect(linhaExcel[11]).toBe(itemTela.diasAtendidos); // TOTAL ATENDIDO
        expect(linhaExcel[12]).toBe(`${itemTela.percentualOcupacao.toFixed(1)}%`); // % OCUPAÇÃO
      }

      // Validação da linha de totais
      const linhaTotais = linhas.find((l) => l && l[0] === "TOTAIS CONSOLIDADOS");
      expect(linhaTotais).toBeDefined();
      expect(linhaTotais![6]).toBe(relatorioTelaPdf.totais.totalDiasP);
      expect(linhaTotais![7]).toBe(relatorioTelaPdf.totais.totalDiasC);
      expect(linhaTotais![8]).toBe(relatorioTelaPdf.totais.totalDiasD);
      expect(linhaTotais![9]).toBe(relatorioTelaPdf.totais.totalDiasN);
      expect(linhaTotais![10]).toBe(relatorioTelaPdf.totais.totalExigivel);
      expect(linhaTotais![11]).toBe(relatorioTelaPdf.totais.totalAtendido);
      expect(linhaTotais![12]).toBe(`${relatorioTelaPdf.totais.percentualGeral.toFixed(1)}%`);
    });

    it("deve gerar relatório de coberturas do período com motivos categorizados e SEM DADO MÉDICO", () => {
      const relatorio = gerarRelatorioCoberturas({ periodo: "2026-09" });
      expect(relatorio.cabecalho.contrato).toBe(CONTRATO_NUMERO);

      for (const item of relatorio.itens) {
        expect(item.postoCodigo).toBeDefined();
        expect(item.titularNome).toBeDefined();
        expect(item.substitutoNome).toBeDefined();
        expect(item.totalDias).toBeGreaterThan(0);
        // Garantia de zero dado médico
        expect(item.motivoCategoria).not.toMatch(/CID|cid|laudo|atestado|diagn[oó]stico|doen[çc]a/i);
      }
    });

    it("deve gerar quadro de feristas com total de coberturas e saldo de dias", () => {
      const relatorio = gerarRelatorioQuadroFeristas({ periodo: "2026-09" });
      expect(relatorio.itens.length).toBeGreaterThan(0);

      for (const ferista of relatorio.itens) {
        expect(ferista.chapa).toBeDefined();
        expect(ferista.nome).toBeDefined();
        expect(ferista.postosVinculados.length).toBeGreaterThanOrEqual(1);
        expect(ferista.diasEmCobertura + ferista.diasDisponiveis).toBe(30); // Setembro tem 30 dias
      }
    });
  });

  // ===========================================================================
  // 2. TRILHA DE AUDITORIA — CRITÉRIO DE ACEITE: ALTERAR ESCALA GERA LOG
  // ===========================================================================
  describe("2. Trilha de Auditoria (Critério de Aceite: Alterar Escala Gera Log com Valor Anterior e Novo)", () => {
    it("deve registrar alteração de escala na trilha de auditoria com valorAnterior e valorNovo estruturados", () => {
      const vagaAlvo = VAGAS_MC_REAIS[0];
      const escalaAnterior = vagaAlvo.grupo_revezamento;

      const resultado = atualizarEscalaPosicao(vagaAlvo.id, {
        grupo: "GRUPO_NOVO_AUDITORIA",
        fase: "TURNO_A",
        dataBase: "2026-09-01",
        faixaHoraria: "07:00-19:00",
        regimeDias: "12x36",
      });

      expect(resultado.sucesso).toBe(true);

      const estado = carregarEstado();
      const logEscala = estado.logsAuditoria.find(
        (l) => l.acao === "ALTERAR_ESCALA" && l.registroId === vagaAlvo.id
      );

      expect(logEscala).toBeDefined();
      expect(logEscala?.valorAnterior).toBeDefined();
      expect(logEscala?.valorNovo).toBeDefined();
      expect(logEscala?.valorNovo).toContain("GRUPO_NOVO_AUDITORIA");
      expect(logEscala?.timestamp).toBeDefined();
      expect(logEscala?.ip).toBe("Não capturado (cliente)");
    });

    it("deve registrar alteração de titular de uma posição na auditoria", () => {
      const res = atualizarTitularPosicao(
        "POS-AUDIT-TEST-01",
        "099887",
        "Carlos Teste Auditoria",
        "Designação formal de titular homologada"
      );

      expect(res.sucesso).toBe(true);

      const estado = carregarEstado();
      const logTitular = estado.logsAuditoria.find(
        (l) => l.acao === "ALTERAR_TITULAR" && l.registroId === "POS-AUDIT-TEST-01"
      );

      expect(logTitular).toBeDefined();
      expect(logTitular?.valorNovo).toContain("Carlos Teste Auditoria");
      expect(logTitular?.valorNovo).toContain("099887");
    });

    it("deve registrar criação e cancelamento de cobertura com valor anterior e novo", () => {
      const cob = adicionarCobertura({
        postoCodigo: "PST-TEST-AUDIT",
        idPosto: "PST-TEST-AUDIT",
        vagaId: "POS-TEST-01",
        funcaoPosto: "Técnico Teste",
        substitutoMatricula: "037196",
        substitutoNome: "Substituto Auditoria",
        dataInicio: "2026-09-20",
        dataFim: "2026-09-22",
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        status: "CONFIRMADA",
        justificativa: "Férias do titular",
      });

      const estadoAposCriar = carregarEstado();
      const logCriar = estadoAposCriar.logsAuditoria.find(
        (l) => l.acao === "CRIAR_COBERTURA" && l.registroId === cob.id
      );
      expect(logCriar).toBeDefined();
      expect(logCriar?.valorNovo).toContain("Substituto Auditoria");

      // Cancelar cobertura
      const cancelou = cancelarCobertura(cob.id);
      expect(cancelou).toBe(true);

      const estadoAposCancelar = carregarEstado();
      const logCancelar = estadoAposCancelar.logsAuditoria.find(
        (l) => l.acao === "EXCLUIR_COBERTURA" && l.registroId === cob.id
      );
      expect(logCancelar).toBeDefined();
      expect(logCancelar?.valorNovo).toContain("CANCELADA");
    });

    it("deve registrar criação e exclusão de ausência com valor anterior e novo", () => {
      const oco = adicionarOcorrencia({
        matricula: "037196",
        profissionalNome: "Titular Teste Ausência",
        postoCodigo: "PST-TEST-01",
        dataInicio: "2026-09-10",
        dataFim: "2026-09-11",
        diasAfetados: 2,
        tipoOcorrencia: "FERIAS",
        status: "VALIDADA",
        observacaoPublica: "Período regular de férias",
      });

      const estado = carregarEstado();
      const logOco = estado.logsAuditoria.find(
        (l) => l.acao === "CRIAR_AUSENCIA" && l.registroId === oco.id
      );
      expect(logOco).toBeDefined();
      expect(logOco?.valorNovo).toContain("FERIAS");

      // Cancelar ausência
      const cancelou = cancelarOcorrencia(oco.id);
      expect(cancelou).toBe(true);

      const estado2 = carregarEstado();
      const logCancelOco = estado2.logsAuditoria.find(
        (l) => l.acao === "EXCLUIR_AUSENCIA" && l.registroId === oco.id
      );
      expect(logCancelOco).toBeDefined();
    });
  });

  // ===========================================================================
  // 3. SEGURANÇA E LGPD — FISCAL PETROBRAS BLOQUEADO E SESSÃO INATIVA
  // ===========================================================================
  describe("3. Segurança e LGPD (Critério de Aceite: Fiscal Não Acessa Logs, Pendências Nem Dados Pessoais)", () => {
    it("Usuário Fiscal Petrobras NÃO deve ter acesso à Trilha de Auditoria", () => {
      expect(can(usuarioFiscal, "LER", "AUDITORIA")).toBe(false);
      expect(can(usuarioFiscal, "EXPORTAR", "AUDITORIA")).toBe(false);
      expect(can(usuarioFiscal, "GERENCIAR", "AUDITORIA")).toBe(false);
    });

    it("Apenas Administrador Premier deve ter acesso à Trilha de Auditoria Geral", () => {
      expect(can(usuarioAdmin, "LER", "AUDITORIA")).toBe(true);
      expect(can(usuarioAdmin, "EXPORTAR", "AUDITORIA")).toBe(true);
      expect(can(usuarioAdmin, "GERENCIAR", "AUDITORIA")).toBe(true);
    });

    it("Fiscal Petrobras NÃO deve ter acesso a Dados Sensíveis LGPD, Administração nem Glosa", () => {
      expect(can(usuarioFiscal, "LER", "ADMINISTRACAO")).toBe(false);
      expect(can(usuarioFiscal, "LER", "DADOS_SENSIVEIS_LGPD")).toBe(false);
      expect(can(usuarioFiscal, "LER", "GLOSA_FINANCEIRA")).toBe(false);
    });

    it("deve expirar token de sessão por inatividade após 30 minutos", () => {
      // Token recém criado
      const tokenRecente = codificarTokenSessao(usuarioAdmin);
      const resAtiva = verificarSessaoAtiva(tokenRecente);
      expect(resAtiva.valida).toBe(true);
      expect(resAtiva.expiradaPorInatividade).toBe(false);

      // Token assinado com timestamp antigo (mais de 30 minutos atrás)
      const tokenAntigo = codificarTokenSessao(usuarioAdmin, {
        timestamp: Date.now() - (TIMEOUT_INATIVIDADE_MS + 60000), // 31 min atrás
      });

      const resInativa = verificarSessaoAtiva(tokenAntigo);
      expect(resInativa.valida).toBe(false);
      expect(resInativa.expiradaPorInatividade).toBe(true);

      // Token sem assinatura (forjado editando o cookie) é rejeitado
      const tokenForjado = Buffer.from(
        JSON.stringify({ userId: usuarioAdmin.id, email: usuarioAdmin.email, perfil: "PREMIER_ADMIN", timestamp: Date.now() })
      ).toString("base64");
      expect(verificarSessaoAtiva(tokenForjado).valida).toBe(false);
    });
  });

  // ===========================================================================
  // 4. MODO HOMOLOGAÇÃO — COMPARATIVO SGP × MEMÓRIA DE CÁLCULO
  // ===========================================================================
  describe("4. Modo Homologação (Comparativo SGP × Memória de Cálculo)", () => {
    it("deve permitir escolher o mês de referência e listar divergências por posto", () => {
      const homologacao = gerarComparativoHomologacaoMC("2026-09");

      expect(homologacao.competencia).toBe("2026-09");
      expect(homologacao.totalPosicoesApuradas).toBeGreaterThan(0);
      expect(homologacao.taxaConformidade).toBeGreaterThanOrEqual(0);
      expect(homologacao.taxaConformidade).toBeLessThanOrEqual(100);
      expect(homologacao.itens.length).toBe(homologacao.totalPosicoesApuradas);

      // Verifica estrutura de cada item de homologação
      for (const item of homologacao.itens) {
        expect(item.postoCodigo).toBeDefined();
        expect(item.posicaoId).toBeDefined();
        expect(typeof item.sgpDiasP).toBe("number");
        expect(typeof item.mcTotalAtendido).toBe("number");
        expect(typeof item.divergente).toBe("boolean");
        expect(item.tipoDivergencia).toBeDefined();
      }
    });

    it("deve exportar planilha de homologação com aviso explícito de fora do faturamento", () => {
      const buffer = exportarRelatorioParaXlsx("homologacao", { periodo: "2026-09" });
      expect(buffer).toBeDefined();

      const wb = XLSX.read(buffer, { type: "buffer" });
      expect(wb.SheetNames).toContain("Homologacao_SGP_MC");

      const ws = wb.Sheets["Homologacao_SGP_MC"];
      const linhas: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Validação do aviso
      const linhaAviso = linhas.find((l) => l && l[0] === "AVISO");
      expect(linhaAviso).toBeDefined();
      expect(linhaAviso![1]).toContain("Faturamento e medição permanecem fora do escopo");
    });
  });
});
