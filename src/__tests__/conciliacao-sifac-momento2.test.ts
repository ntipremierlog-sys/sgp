import { describe, it, expect, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import {
  identificarArquivoSifac,
  simularImportacaoSifac,
  confirmarImportacaoSifac,
  CONTRATO_SIFAC_ESPERADO,
  CNPJ_PREMIER_ESPERADO,
} from "@/lib/importadores/sifac-alocados";
import {
  executarConciliacaoRmSifac,
  atualizarStatusDivergencia,
  exportarConciliacaoXlsx,
  cargosSaoEquivalentes,
  situacaoRmEquivalenteSifac,
  normalizarDataIso,
  ItemAlocadoSifac,
  DivergenciaConciliacao,
  EQUIVALENCIAS_PADRAO,
} from "@/lib/dados/conciliacao-sifac";
import {
  ProfissionalOperacional,
  carregarEstado,
  salvarEstado,
  EstadoOperacionalCompleto,
} from "@/lib/dados/estado-operacional";

// Função auxiliar para criar planilhas Excel em buffer para testes (com dados 100% fictícios)
function criarWorkbookBuffer(sheets: Record<string, Record<string, unknown>[]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(out);
}

describe("MOMENTO 2 — Importação SIFAC e Conciliação RM × SIFAC", () => {
  describe("1. Regras de Importação e Estrutura de Arquivo SIFAC", () => {
    it("deve identificar a planilha SIFAC pelas 5 colunas obrigatórias na aba Modelo", () => {
      const colunas = [
        "NroContrato",
        "Cnpj",
        "DataCompetenciaCadastro",
        "Cpf",
        "CodigoSituacaoEmpregado",
      ];
      const res = identificarArquivoSifac(colunas, "Modelo");
      expect(res.reconhecido).toBe(true);
      expect(res.tipo).toBe("ALOCADOS_SIFAC");
      expect(res.colunasObrigatoriasFaltando).toHaveLength(0);
    });

    it("deve rejeitar se faltar qualquer uma das 5 colunas obrigatórias", () => {
      const colunas = [
        "NroContrato",
        "Cnpj",
        "Cpf",
        "CodigoSituacaoEmpregado", // falta DataCompetenciaCadastro
      ];
      const res = identificarArquivoSifac(colunas, "Modelo");
      expect(res.reconhecido).toBe(false);
      expect(res.colunasObrigatoriasFaltando).toContain("datacompetenciacadastro");
    });

    it("deve ler estritamente a aba 'Modelo' e ignorar dados de outras abas anexas", async () => {
      const buffer = criarWorkbookBuffer({
        "Informações adicionais": [{ Codigo: "INF-1", Descricao: "Instruções" }],
        "Anexo Genero": [{ Cod: 1, Desc: "Feminino" }, { Cod: 2, Desc: "Masculino" }],
        "Modelo": [
          {
            NroContrato: "4600682336",
            Cnpj: "10.592.109/0001-19",
            DataCompetenciaCadastro: "2026-08",
            Nome: "ALICE SILVA MOCK",
            Cpf: "11122233344",
            CodigoGenero: 1,
            Genero: "Feminino",
            DataNascimento: "1990-05-12",
            CodigoSituacaoEmpregado: 1,
            Cargo: "ALMOXARIFE LIDER",
            "Município de Prestação": "Três Lagoas",
            Regime: "OnShore",
            // Colunas proibidas que devem ser descartadas
            CodigoNacionalidade: "10",
            PlanoDeSaude: "UNIMED BASICO",
            SeguroDeVida: "PORTO SEGURO",
          },
        ],
      });

      const sim = await simularImportacaoSifac(buffer, "sifac_modelo_anexos.xlsx", "2026-08-01");
      expect(sim.totais.lidos).toBe(1);
      expect(sim.totais.novos).toBe(1);
      expect(sim.linhas[0].dados.nome).toBe("ALICE SILVA MOCK");
      // Assegurar descarte de colunas proibidas
      expect((sim.linhas[0].dados as any).CodigoNacionalidade).toBeUndefined();
      expect((sim.linhas[0].dados as any).PlanoDeSaude).toBeUndefined();
      expect((sim.linhas[0].dados as any).SeguroDeVida).toBeUndefined();
    });

    it("deve bloquear o arquivo se o Contrato ou CNPJ for divergente da Premier / Petrobras", async () => {
      const bufferContratoInvalido = criarWorkbookBuffer({
        Modelo: [
          {
            NroContrato: "9999999999", // Contrato incorreto!
            Cnpj: "10.592.109/0001-19",
            DataCompetenciaCadastro: "2026-08",
            Nome: "BRUNO MOCK",
            Cpf: "22233344455",
            CodigoSituacaoEmpregado: 1,
          },
        ],
      });

      const sim = await simularImportacaoSifac(bufferContratoInvalido, "contrato_errado.xlsx", "2026-08-01");
      expect(sim.erroBloqueanteArquivo).toBeDefined();
      expect(sim.totais.erros).toBeGreaterThanOrEqual(1);

      // Confirmar gravação deve lançar erro bloqueante
      expect(() => confirmarImportacaoSifac(sim)).toThrow(/Importação bloqueada/);
    });

    it("deve normalizar CPF de 10 dígitos adicionando zero à esquerda", async () => {
      const bufferCpf10 = criarWorkbookBuffer({
        Modelo: [
          {
            NroContrato: "4600682336",
            Cnpj: "10.592.109/0001-19",
            DataCompetenciaCadastro: "2026-08",
            Nome: "CARLA MOCK",
            Cpf: "1234567890", // 10 dígitos (falta o zero inicial)
            CodigoGenero: 1,
            Genero: "Feminino",
            DataNascimento: "15/07/1992",
            CodigoSituacaoEmpregado: 1,
            Cargo: "ASSISTENTE DE LOGISTICA",
            "Município de Prestação": "Três Lagoas",
          },
        ],
      });

      const sim = await simularImportacaoSifac(bufferCpf10, "cpf_10_digitos.xlsx", "2026-08-01");
      expect(sim.linhas[0].dados.cpfLimpo).toBe("01234567890");
      expect(sim.linhas[0].dados.cpfLimpo.length).toBe(11);
    });

    it("deve gerar alerta para código de situação ou gênero fora da tabela SIFAC e incoerência de gênero", async () => {
      const bufferAlertas = criarWorkbookBuffer({
        Modelo: [
          {
            NroContrato: "4600682336",
            Cnpj: "10.592.109/0001-19",
            DataCompetenciaCadastro: "2026-08",
            Nome: "DANIEL MOCK",
            Cpf: "33344455566",
            CodigoGenero: 1, // 1 = Feminino
            Genero: "Masculino", // Incoerente com código 1!
            DataNascimento: "", // Vazia (obrigatória no SIFAC)
            CodigoSituacaoEmpregado: 9, // Fora de 1..6!
            Cargo: "MOTORISTA",
          },
        ],
      });

      const sim = await simularImportacaoSifac(bufferAlertas, "alertas_sifac.xlsx", "2026-08-01");
      expect(sim.totais.alertas).toBeGreaterThanOrEqual(3);
      const msgs = sim.inconsistencias.map((i) => i.mensagem);
      expect(msgs.some((m) => m.includes("fora da tabela homologada (1..6)"))).toBe(true);
      expect(msgs.some((m) => m.includes("Incoerência entre Código de Gênero"))).toBe(true);
      expect(msgs.some((m) => m.includes("Data de nascimento não informada"))).toBe(true);
    });
  });

  describe("2. Conciliação RM × SIFAC: Validação dos 12 Tipos de Divergência", () => {
    const funcionarioPadraoRm: ProfissionalOperacional = {
      id: "func-001",
      matricula: "MAT-001",
      chapa: "000101",
      nome: "COLABORADOR MODELO",
      cpfLimpo: "11111111111",
      cpfMascarado: "***.111.111-**",
      sexo: "M",
      dataNascimento: "1988-04-15",
      situacao: "ATIVO",
      situacaoCodigo: "A",
      situacaoDescricao: "Ativo",
      dataAdmissao: "2024-01-10",
      dataDesligamento: undefined,
      secaoCodigo: "1.01.080.023",
      secaoDescricao: "UFN-III",
      unidadeId: "UFN-III",
      unidadeNome: "UFN III – Três Lagoas/MS",
      funcao: "Almoxarife Líder",
      escala: "5x2",
      dadosRestritos: { salario: 4500.0 },
    };

    const alocadoPadraoSifac: ItemAlocadoSifac = {
      id: "sifac-001",
      numeroContrato: "4600682336",
      cnpj: "10.592.109/0001-19",
      dataCompetenciaCadastro: "2026-08",
      nome: "COLABORADOR MODELO",
      cpfLimpo: "11111111111",
      cpfMascarado: "***.111.111-**",
      codigoGenero: 2, // 2 = Masculino
      generoDescricao: "Masculino",
      dataNascimento: "1988-04-15",
      codigoSituacaoEmpregado: 1, // 1 = Ativo
      dataAdmissao: "2024-01-10",
      cargo: "Almoxarife Líder",
      salario: 4500.0,
      municipioPrestacao: "Três Lagoas",
      codigoMunicipioPrestacao: "5008305",
    };

    it("Cenário Conforme: RM e SIFAC idênticos -> 0 divergências", () => {
      const conc = executarConciliacaoRmSifac(
        "2026-08",
        [funcionarioPadraoRm],
        [alocadoPadraoSifac],
        EQUIVALENCIAS_PADRAO,
        [],
        "2026-08-31",
        "2026-08-31"
      );
      expect(conc.divergencias).toHaveLength(0);
      expect(conc.resumo.conciliadosSemDivergencia).toBe(1);
      expect(conc.resumo.totalDivergencias).toBe(0);
    });

    it("Tipo 1: No SIFAC e não no cadastro do RM ('Não encontrado no RM')", () => {
      const sifacFantasma = { ...alocadoPadraoSifac, cpfLimpo: "99999999999" };
      const conc = executarConciliacaoRmSifac(
        "2026-08",
        [funcionarioPadraoRm],
        [alocadoPadraoSifac, sifacFantasma]
      );
      const div = conc.divergencias.find((d) => d.tipo === "NAO_ENCONTRADO_RM");
      expect(div).toBeDefined();
      expect(div?.rotuloTipo).toBe("Não encontrado no RM");
    });

    it("Tipo 2: Ativo no RM e não no SIFAC ('Não informado no SIFAC')", () => {
      const conc = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm], []);
      const div = conc.divergencias.find((d) => d.tipo === "NAO_INFORMADO_SIFAC");
      expect(div).toBeDefined();
      expect(div?.rotuloTipo).toBe("Não informado no SIFAC");
    });

    it("Regra Especial: Admitidos APÓS a data da competência NÃO geram divergência", () => {
      const funcNovo: ProfissionalOperacional = {
        ...funcionarioPadraoRm,
        cpfLimpo: "22222222222",
        dataAdmissao: "2026-09-05", // Admitido em setembro, competência sob análise é agosto!
      };
      const conc = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm, funcNovo], [alocadoPadraoSifac]);
      expect(conc.resumo.admitidosAposCompetencia).toBe(1);
      const div = conc.divergencias.find((d) => d.cpfLimpo === "22222222222");
      expect(div).toBeUndefined(); // Não deve gerar divergência!
    });

    it("Tipo 3: Situação divergente com datas de ref diferentes classificada como 'Verificar'", () => {
      const sifacFerias = { ...alocadoPadraoSifac, codigoSituacaoEmpregado: 5 }; // Férias no SIFAC
      const conc = executarConciliacaoRmSifac(
        "2026-08",
        [funcionarioPadraoRm], // Ativo no RM
        [sifacFerias],
        EQUIVALENCIAS_PADRAO,
        [],
        "2026-08-31", // Ref RM
        "2026-08-10" // Ref SIFAC diferente!
      );
      const div = conc.divergencias.find((d) => d.tipo === "SITUACAO_DIVERGENTE");
      expect(div).toBeDefined();
      expect(div?.severidade).toBe("VERIFICAR");
      expect(div?.isVerificarDataReferencia).toBe(true);
    });

    it("Tipo 4: Demitido no RM informado como 2-Inativo no SIFAC", () => {
      const funcDemitido: ProfissionalOperacional = {
        ...funcionarioPadraoRm,
        situacao: "DESLIGADO",
        situacaoDescricao: "Demitido",
        dataDesligamento: "2026-08-15",
      };
      const sifacInativo = { ...alocadoPadraoSifac, codigoSituacaoEmpregado: 2 }; // 2 = Inativo
      const conc = executarConciliacaoRmSifac("2026-08", [funcDemitido], [sifacInativo]);
      const div = conc.divergencias.find((d) => d.tipo === "SITUACAO_INCONSISTENTE_DEMITIDO");
      expect(div).toBeDefined();
      expect(div?.rotuloTipo).toBe("Código de situação inconsistente (esperado 3 – Demitido)");
    });

    it("Tipo 5: Data de demissão diferente", () => {
      const funcDemitido: ProfissionalOperacional = {
        ...funcionarioPadraoRm,
        situacao: "DESLIGADO",
        situacaoDescricao: "Demitido",
        dataDesligamento: "2026-08-10",
      };
      const sifacDemissao = {
        ...alocadoPadraoSifac,
        codigoSituacaoEmpregado: 3,
        dataDemissao: "2026-08-20", // Data diferente!
      };
      const conc = executarConciliacaoRmSifac("2026-08", [funcDemitido], [sifacDemissao]);
      const div = conc.divergencias.find((d) => d.tipo === "DATA_DEMISSAO_DIVERGENTE");
      expect(div).toBeDefined();
      expect(div?.valorRm).toBe("2026-08-10");
      expect(div?.valorSifac).toBe("2026-08-20");
    });

    it("Tipo 6: Data de admissão diferente", () => {
      const sifacAdmDiferente = { ...alocadoPadraoSifac, dataAdmissao: "2024-02-01" };
      const conc = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm], [sifacAdmDiferente]);
      const div = conc.divergencias.find((d) => d.tipo === "DATA_ADMISSAO_DIVERGENTE");
      expect(div).toBeDefined();
      expect(div?.valorRm).toBe("2024-01-10");
      expect(div?.valorSifac).toBe("2024-02-01");
    });

    it("Tipo 7: Cargo divergente e equivalência de sinônimos", () => {
      // Caso 1: Equivalente na tabela ("motorista carreta" x "motorista pesados")
      const funcMotorista: ProfissionalOperacional = {
        ...funcionarioPadraoRm,
        funcao: "Motorista Carreta",
      };
      const sifacMotoristaPesado = {
        ...alocadoPadraoSifac,
        cargo: "Motorista de Veículos Pesados",
      };
      const concEquiv = executarConciliacaoRmSifac("2026-08", [funcMotorista], [sifacMotoristaPesado]);
      expect(concEquiv.divergencias.find((d) => d.tipo === "CARGO_DIVERGENTE")).toBeUndefined();

      // Caso 2: Totalmente divergente ("Almoxarife" x "Operador de Empilhadeira")
      const sifacOperador = { ...alocadoPadraoSifac, cargo: "Operador de Empilhadeira" };
      const concDiv = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm], [sifacOperador]);
      const div = concDiv.divergencias.find((d) => d.tipo === "CARGO_DIVERGENTE");
      expect(div).toBeDefined();
      expect(div?.rotuloTipo).toBe("Cargo divergente");
    });

    it("Tipo 8: Salário divergente com tolerância de R$ 0,01", () => {
      // Diferença de 1 centavo -> tolerada!
      const sifacCentavo = { ...alocadoPadraoSifac, salario: 4500.01 };
      const concTol = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm], [sifacCentavo]);
      expect(concTol.divergencias.find((d) => d.tipo === "SALARIO_DIVERGENTE")).toBeUndefined();

      // Diferença de R$ 50,00 -> gera divergência
      const sifacSalarioDiff = { ...alocadoPadraoSifac, salario: 4550.0 };
      const concDiff = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm], [sifacSalarioDiff]);
      const div = concDiff.divergencias.find((d) => d.tipo === "SALARIO_DIVERGENTE");
      expect(div).toBeDefined();
      expect(div?.rotuloTipo).toBe("Salário divergente");
    });

    it("Tipo 9: Município de prestação incompatível com a base RM", () => {
      const sifacMacaenaUfn = {
        ...alocadoPadraoSifac,
        municipioPrestacao: "Macaé",
        codigoMunicipioPrestacao: "3302403", // Código de Macaé para funcionário lotado em UFN-III!
      };
      const conc = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm], [sifacMacaenaUfn]);
      const div = conc.divergencias.find((d) => d.tipo === "MUNICIPIO_INCOMPATIVEL");
      expect(div).toBeDefined();
      expect(div?.rotuloTipo).toBe("Município de prestação incompatível com a base do RM");
    });

    it("Tipo 10: Gênero divergente entre RM e SIFAC (F x 2 / M x 1)", () => {
      const sifacFeminino = {
        ...alocadoPadraoSifac,
        codigoGenero: 1, // Feminino no SIFAC, mas RM é Masculino!
      };
      const conc = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm], [sifacFeminino]);
      const div = conc.divergencias.find((d) => d.tipo === "GENERO_DIVERGENTE");
      expect(div).toBeDefined();
      expect(div?.rotuloTipo).toBe("Gênero divergente entre RM e SIFAC");
    });

    it("Tipo 11: Data de nascimento divergente", () => {
      const sifacNascDiferente = {
        ...alocadoPadraoSifac,
        dataNascimento: "1992-10-20", // RM é 1988-04-15
      };
      const conc = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm], [sifacNascDiferente]);
      const div = conc.divergencias.find((d) => d.tipo === "DATA_NASCIMENTO_DIVERGENTE");
      expect(div).toBeDefined();
      expect(div?.rotuloTipo).toBe("Data de nascimento divergente entre RM e SIFAC");
      expect(div?.valorRm).toBe("1988-04-15");
      expect(div?.valorSifac).toBe("1992-10-20");
    });

    it("Tipo 12: Dado obrigatório ausente (data de nascimento ou gênero em um dos sistemas)", () => {
      const funcSemNasc: ProfissionalOperacional = {
        ...funcionarioPadraoRm,
        dataNascimento: undefined,
      };
      const conc = executarConciliacaoRmSifac("2026-08", [funcSemNasc], [alocadoPadraoSifac]);
      const div = conc.divergencias.find((d) => d.tipo === "DADO_OBRIGATORIO_AUSENTE");
      expect(div).toBeDefined();
      expect(div?.rotuloTipo).toBe("Dado obrigatório do SIFAC ausente");
    });

    it("deve carregar flag 'justificadaAnteriormente' se a divergência idêntica foi justificada em competência anterior", () => {
      const divAnterior: DivergenciaConciliacao = {
        id: "DIV-2026-07-11111111111-DATA_NASCIMENTO_DIVERGENTE",
        competencia: "2026-07",
        tipo: "DATA_NASCIMENTO_DIVERGENTE",
        rotuloTipo: "Data de nascimento divergente entre RM e SIFAC",
        cpfLimpo: "11111111111",
        cpfMascarado: "***.111.111-**",
        nome: "COLABORADOR MODELO",
        baseRmId: "UFN-III",
        baseRmNome: "UFN III – Três Lagoas/MS",
        valorRm: "1988-04-15",
        valorSifac: "1992-10-20",
        status: "JUSTIFICADA",
        severidade: "ALTA",
        justificativaAtual: "Apresentou certidão retificada pelo RH",
        historico: [],
      };

      const sifacNascDiferente = {
        ...alocadoPadraoSifac,
        dataNascimento: "1992-10-20",
      };

      const conc = executarConciliacaoRmSifac(
        "2026-08",
        [funcionarioPadraoRm],
        [sifacNascDiferente],
        EQUIVALENCIAS_PADRAO,
        [divAnterior]
      );

      const div = conc.divergencias.find((d) => d.tipo === "DATA_NASCIMENTO_DIVERGENTE");
      expect(div).toBeDefined();
      expect(div?.status).toBe("JUSTIFICADA");
      expect(div?.justificadaAnteriormente).toBe(true);
    });

    it("deve contabilizar divergências críticas abertas (tipos 1, 2, 4, 7, 10, 12) para o contador da Administração", () => {
      const sifacCriticos = [
        { ...alocadoPadraoSifac, id: "c1", cpfLimpo: "99999999901" }, // Tipo 1: Não no RM
        { ...alocadoPadraoSifac, id: "c2", cpfLimpo: "11111111111", codigoGenero: 1 }, // Tipo 10: Gênero
      ];

      const conc = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm], sifacCriticos);
      expect(conc.resumo.pendenciasCriticasAdmin).toBeGreaterThanOrEqual(2);
    });

    it("deve exportar relatório XLSX com abas de Resumo e Divergências e segregar sigilo salarial", () => {
      const sifacSalario = { ...alocadoPadraoSifac, salario: 5200.0 };
      const conc = executarConciliacaoRmSifac("2026-08", [funcionarioPadraoRm], [sifacSalario]);

      // Exportação sem permissão salarial (ex: fiscal ou gestor)
      const bytesSemSalario = exportarConciliacaoXlsx("2026-08", conc.resumo, conc.divergencias, false);
      const wbSem = XLSX.read(bytesSemSalario, { type: "array" });
      expect(wbSem.SheetNames).toContain("Resumo Conciliação");
      expect(wbSem.SheetNames).toContain("Divergências");

      const linhasDivSem = XLSX.utils.sheet_to_json<any>(wbSem.Sheets["Divergências"]);
      const linhaSalario = linhasDivSem.find((l) => l["Tipo de Divergência"] === "Salário divergente");
      if (linhaSalario) {
        expect(linhaSalario["Valor no SIFAC"]).toBe("[CONFIDENCIAL]");
      }

      // Exportação com permissão salarial (PREMIER_ADMIN)
      const bytesComSalario = exportarConciliacaoXlsx("2026-08", conc.resumo, conc.divergencias, true);
      const wbCom = XLSX.read(bytesComSalario, { type: "array" });
      const linhasDivCom = XLSX.utils.sheet_to_json<any>(wbCom.Sheets["Divergências"]);
      const linhaSalarioCom = linhasDivCom.find((l) => l["Tipo de Divergência"] === "Salário divergente");
      if (linhaSalarioCom) {
        expect(linhaSalarioCom["Valor no SIFAC"]).not.toBe("[CONFIDENCIAL]");
      }
    });
  });
});
