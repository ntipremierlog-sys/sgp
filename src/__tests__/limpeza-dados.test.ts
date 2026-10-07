import { describe, it, expect, beforeEach } from "vitest";
import {
  simularLimpezaDadosDemo,
  executarLimpezaDadosDemo,
  semearDadosDemoParaTeste,
} from "@/lib/dados/limpeza-dados-demo";
import {
  gerarSnapshotSistema,
  restaurarSnapshotSistema,
} from "@/lib/dados/backup-dados";
import { carregarEstado, salvarEstado } from "@/lib/dados/estado-operacional";
import fs from "fs";
import path from "path";

describe("MOMENTO 1 — Limpeza dos Dados de Demonstração e Backup Completo", () => {
  beforeEach(() => {
    semearDadosDemoParaTeste();
  });

  it("deve gerar backup completo em arquivo JSON pré-limpeza", () => {
    const snapshot = gerarSnapshotSistema(
      "Backup de teste pré-limpeza",
      "Administrador Premier"
    );

    expect(snapshot).toBeDefined();
    expect(snapshot.contrato.numeroIcj).toBe("5900.0129796.25.2");
    expect(snapshot.contrato.numeroSifac).toBe("4600682336");
    expect(snapshot.estadoOperacional.postos.length).toBe(15);
    expect(snapshot.estadoOperacional.profissionais.length).toBeGreaterThan(0);

    // Grava o backup físico no diretório backups/
    const pastaBackup = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(pastaBackup)) {
      fs.mkdirSync(pastaBackup, { recursive: true });
    }
    const nomeArquivo = `backup_pre_limpeza_dados_demonstracao_2026-09-17.json`;
    const caminhoBackup = path.join(pastaBackup, nomeArquivo);
    fs.writeFileSync(caminhoBackup, JSON.stringify(snapshot, null, 2), "utf-8");

    expect(fs.existsSync(caminhoBackup)).toBe(true);
    const conteudoLido = JSON.parse(fs.readFileSync(caminhoBackup, "utf-8"));
    expect(conteudoLido.contrato.numeroIcj).toBe("5900.0129796.25.2");
  });

  it("deve simular a limpeza e reportar as quantidades exatas por tabela", () => {
    const relatorio = simularLimpezaDadosDemo("Administrador Premier (Marcos Valério)");

    expect(relatorio.sucesso).toBe(true);
    expect(relatorio.executadoPor).toBe("Administrador Premier (Marcos Valério)");
    expect(relatorio.postosAnexo1APreservados).toBe(15);

    const profItem = relatorio.tabelasAfetadas.find((t) =>
      t.tabela.includes("profissional")
    );
    expect(profItem?.status).toBe("LIMPO");
    expect(profItem?.registrosRemovidos).toBe(16);

    const alocItem = relatorio.tabelasAfetadas.find((t) =>
      t.tabela.includes("alocacao")
    );
    expect(alocItem?.status).toBe("LIMPO");
    expect(alocItem?.registrosRemovidos).toBe(14);

    const ocoItem = relatorio.tabelasAfetadas.find((t) =>
      t.tabela.includes("ocorrencia")
    );
    expect(ocoItem?.status).toBe("LIMPO");
    expect(ocoItem?.registrosRemovidos).toBe(3);

    const cobItem = relatorio.tabelasAfetadas.find((t) =>
      t.tabela.includes("cobertura")
    );
    expect(cobItem?.status).toBe("LIMPO");
    expect(cobItem?.registrosRemovidos).toBe(2);

    const aptItem = relatorio.tabelasAfetadas.find((t) =>
      t.tabela.includes("apontamento")
    );
    expect(aptItem?.status).toBe("LIMPO");
    expect(aptItem?.registrosRemovidos).toBe(2);

    const postoPreservado = relatorio.tabelasAfetadas.find((t) =>
      t.tabela.includes("posto (Anexo 1-A)")
    );
    expect(postoPreservado?.status).toBe("PRESERVADO");
    expect(postoPreservado?.registrosRemovidos).toBe(0);

    const usuarioPreservado = relatorio.tabelasAfetadas.find((t) =>
      t.tabela.includes("usuario")
    );
    expect(usuarioPreservado?.status).toBe("PRESERVADO");

    const auditPreservada = relatorio.tabelasAfetadas.find((t) =>
      t.tabela.includes("log_auditoria")
    );
    expect(auditPreservada?.status).toBe("PRESERVADO");
  });

  it("deve executar a limpeza efetiva, preservando os 15 postos do Anexo 1-A e registrando na auditoria", () => {
    const relatorio = executarLimpezaDadosDemo("Administrador Premier (Marcos Valério)");
    expect(relatorio.sucesso).toBe(true);

    const estadoLimpo = carregarEstado();

    // 1. Colaboradores zerados
    expect(estadoLimpo.profissionais.length).toBe(0);

    // 2. Ocorrências, coberturas e apontamentos zerados
    expect(estadoLimpo.ocorrencias.length).toBe(0);
    expect(estadoLimpo.coberturas.length).toBe(0);
    expect(estadoLimpo.apontamentos.length).toBe(0);

    // 3. Postos do Anexo 1-A preservados (15 postos), todos agora vagos (sem titular fictício)
    expect(estadoLimpo.postos.length).toBe(15);
    const postosComTitular = estadoLimpo.postos.filter((p) => !!p.titularMatricula);
    expect(postosComTitular.length).toBe(0);

    // 4. Auditoria com o registro obrigatório da limpeza
    const logLimpeza = estadoLimpo.logsAuditoria.find(
      (l) => l.acao === "LIMPEZA_DADOS_DEMONSTRACAO"
    );
    expect(logLimpeza).toBeDefined();
    expect(logLimpeza?.usuario).toBe("Administrador Premier (Marcos Valério)");
    expect(logLimpeza?.detalhes).toContain("16 profissionais removidos");
  });

  it("deve ser capaz de restaurar o backup caso necessário", () => {
    const snapshot = gerarSnapshotSistema();
    const sucesso = restaurarSnapshotSistema(snapshot);
    expect(sucesso).toBe(true);
  });

  it("deve limpar dados operacionais do mapa mantendo as posições e zerando presença, cobertura e descoberto", async () => {
    const { limparDadosOperacionaisOcupacao } = await import("@/lib/dados/limpeza-dados-demo");
    const { registrarAjusteManualDia, calcularStatusDia } = await import("@/lib/dados/estado-operacional");

    // Simula presença manual e dados operacionais
    registrarAjusteManualDia({
      posicaoId: "PST-ALM-001.1",
      data: "2026-09-02",
      status: "PRESENTE",
      justificativa: "Teste presenca manual",
    });

    const relatorio = limparDadosOperacionaisOcupacao("Administrador Premier (Marcos Valério)");
    expect(relatorio.sucesso).toBe(true);

    const estadoLimpo = carregarEstado();

    // 1. As posições (vagas) e postos são preservados
    expect(estadoLimpo.postos.length).toBeGreaterThan(0);
    const vagasTab = relatorio.tabelasAfetadas.find((t) => t.tabela.includes("vagas"));
    expect(vagasTab?.status).toBe("PRESERVADO");

    // 2. Informações de presença, cobertura e descoberto zeradas
    expect(estadoLimpo.ocorrencias.length).toBe(0);
    expect(estadoLimpo.coberturas.length).toBe(0);
    expect(estadoLimpo.apontamentos.length).toBe(0);
    expect(estadoLimpo.ajustesManuaisDia?.length).toBe(0);
    expect(estadoLimpo.marcacoesPonto?.length).toBe(0);

    // 3. Verificação no cálculo de apuração: zero presença, zero cobertura e zero descoberto
    const postoTeste = estadoLimpo.postos[0];
    const apuracao = calcularStatusDia(
      postoTeste,
      2,
      2026,
      8, // Setembro
      estadoLimpo.ocorrencias,
      estadoLimpo.coberturas,
      estadoLimpo.apontamentos,
      new Set(),
      "2026-09-15"
    );

    expect(apuracao.posicoesAtendidas).toBe(0);
    const posicoes = apuracao.posicoesDetalhe || [];
    const temPresente = posicoes.some((p) => p.status === "PRESENTE");
    const temCoberto = posicoes.some((p) => p.status === "COBERTO");
    const temDescoberto = posicoes.some((p) => p.status === "DESCOBERTO");
    expect(temPresente).toBe(false);
    expect(temCoberto).toBe(false);
    expect(temDescoberto).toBe(false);
  });
});

