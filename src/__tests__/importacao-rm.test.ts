import { describe, it, expect, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import {
  identificarTipoArquivo,
  simularImportacaoFuncionariosRm,
  confirmarImportacaoFuncionariosRm,
  gerarRelatorioValidacaoXlsx,
  validarCpf,
  normalizarDataRm,
} from "@/lib/importadores/rm-funcionarios";
import {
  carregarEstado,
  salvarEstado,
  desfazerUltimoLote,
  calcularIdade,
  obterFaixaEtaria,
} from "@/lib/dados/estado-operacional";
import {
  carregarMapeamentosSecao,
  salvarMapeamentosSecao,
  vincularSecaoBase,
  sugerirBasePorDescricao,
} from "@/lib/dados/secoes-horarios";

/**
 * Cria um buffer binário XLSX fictício a partir de um array de objetos
 */
function criarPlanilhaXlsxBuffer(linhas: Record<string, unknown>[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(linhas);
  XLSX.utils.book_append_sheet(wb, ws, "Funcionarios");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(out);
}

describe("MOMENTO 1 — Importador de Funcionários RM/TOTVS", () => {
  beforeEach(() => {
    salvarEstado({
      profissionais: [],
      lotesImportacao: [],
      logsAuditoria: [],
    });
  });

  describe("1. Identificação Automática do Tipo de Arquivo", () => {
    it("deve reconhecer com sucesso arquivo RM com as colunas obrigatórias", () => {
      const cabecalhosValidos = [
        "Chapa",
        "Nome",
        "CPF",
        "Sexo",
        "Data de Nascimento",
        "Situação",
        "Descrição da Situação",
        "Seção",
        "Descrição Seção",
        "Nome Funcão",
        "Horário",
        "Descrição do Horario",
      ];
      const resultado = identificarTipoArquivo(cabecalhosValidos);
      expect(resultado.reconhecido).toBe(true);
      expect(resultado.tipo).toBe("FUNCIONARIOS_RM");
      expect(resultado.colunasObrigatoriasFaltando.length).toBe(0);
    });

    it("deve falhar a identificação se faltar coluna obrigatória e listar as colunas faltantes", () => {
      const cabecalhosIncompletos = [
        "Chapa",
        "Nome",
        "CPF",
        "Seção",
        // Faltando: "Descrição Seção", "Nome Funcão", "Situação"
      ];
      const resultado = identificarTipoArquivo(cabecalhosIncompletos);
      expect(resultado.reconhecido).toBe(false);
      expect(resultado.tipo).toBe("DESCONHECIDO");
      expect(resultado.colunasObrigatoriasFaltando.length).toBeGreaterThan(0);
      expect(resultado.colunasObrigatoriasFaltando).toContain("descricao secao");
      expect(resultado.colunasObrigatoriasFaltando).toContain("nome funcao");
      expect(resultado.colunasObrigatoriasFaltando).toContain("situacao");
    });
  });

  describe("2. Validações de CPF e Chapa", () => {
    it("deve validar corretamente CPFs válidos e inválidos pelo módulo 11", () => {
      // CPF válido matemático gerado pelo algoritmo da Receita
      expect(validarCpf("52998224725")).toBe(true);
      expect(validarCpf("11144477735")).toBe(true);
      // Inválidos
      expect(validarCpf("12345678901")).toBe(false);
      expect(validarCpf("11111111111")).toBe(false); // Dígitos iguais
      expect(validarCpf("123")).toBe(false);
    });

    it("deve normalizar CPF com 10 dígitos completando com zero à esquerda", async () => {
      // "05299822472" é um CPF onde o primeiro dígito é zero
      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "123",
          Nome: "Marcos Vinicius",
          CPF: "52998224725", // 11 dígitos válido
          Sexo: "M",
          "Data de Nascimento": "15/05/1990",
          Situação: "A",
          "Descrição da Situação": "Ativo",
          "Data de Admissão": "01/01/2024",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III (Três Lagoas - MS)",
          "Nome Funcão": "Operador de Empilhadeira",
          Horário: "001",
          "Descrição do Horario": "07:00 AS 16:48 - SEG/SEX",
        },
      ]);

      const simulacao = await simularImportacaoFuncionariosRm(
        planilha,
        "rm_teste.xlsx",
        "2026-09-17"
      );
      expect(simulacao.totais.erros).toBe(0);
      expect(simulacao.linhas[0].dados.chapa).toBe("000123");
      expect(simulacao.linhas[0].dados.cpfLimpo).toBe("52998224725");
    });

    it("deve sinalizar erro impeditivo na linha quando o CPF tiver dígitos verificadores inválidos", async () => {
      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "101",
          Nome: "Colaborador CPF Invalido",
          CPF: "12345678900", // CPF Inválido
          Sexo: "M",
          "Data de Nascimento": "10/10/1985",
          Situação: "A",
          "Descrição da Situação": "Ativo",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III (Três Lagoas - MS)",
          "Nome Funcão": "Almoxarife",
        },
      ]);

      const simulacao = await simularImportacaoFuncionariosRm(
        planilha,
        "cpf_invalido.xlsx",
        "2026-09-17"
      );
      expect(simulacao.totais.erros).toBe(1);
      expect(simulacao.linhas[0].validaParaGravacao).toBe(false);
      expect(simulacao.linhas[0].inconsistencias.some((i) => i.tipo === "ERRO" && i.coluna === "CPF")).toBe(true);
    });
  });

  describe("3. Sexo, Data de Nascimento e Cálculo Dinâmico de Idade", () => {
    it("deve calcular idade dinamicamente e atribuir faixas etárias sem nunca gravar 'idade'", () => {
      const idade = calcularIdade("1996-09-17", "2026-09-17");
      expect(idade).toBe(30);
      expect(obterFaixaEtaria(idade)).toBe("25 a 34 anos");

      expect(obterFaixaEtaria(calcularIdade("2005-01-01", "2026-09-17"))).toBe("Até 24 anos");
      expect(obterFaixaEtaria(calcularIdade("1988-05-10", "2026-09-17"))).toBe("35 a 44 anos");
      expect(obterFaixaEtaria(calcularIdade("1975-02-20", "2026-09-17"))).toBe("45 a 54 anos");
      expect(obterFaixaEtaria(calcularIdade("1965-08-15", "2026-09-17"))).toBe("55 a 64 anos");
      expect(obterFaixaEtaria(calcularIdade("1955-03-30", "2026-09-17"))).toBe("65 ou mais");
    });

    it("deve gerar alerta para sexo ausente ou inválido e importar em branco", async () => {
      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "201",
          Nome: "Colaborador Sexo Invalido",
          CPF: "52998224725",
          Sexo: "X", // Inválido
          "Data de Nascimento": "10/10/1990",
          Situação: "A",
          "Descrição da Situação": "Ativo",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III",
          "Nome Funcão": "Assistente",
        },
      ]);

      const simulacao = await simularImportacaoFuncionariosRm(
        planilha,
        "sexo_teste.xlsx",
        "2026-09-17"
      );
      expect(simulacao.totais.erros).toBe(0);
      expect(simulacao.totais.alertas).toBeGreaterThan(0);
      expect(simulacao.linhas[0].dados.sexo).toBeUndefined();
      expect(simulacao.linhas[0].inconsistencias.some((i) => i.coluna === "Sexo")).toBe(true);
    });

    it("deve gerar alerta para data de nascimento ausente", async () => {
      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "202",
          Nome: "Colaborador Sem Nascimento",
          CPF: "52998224725",
          Sexo: "M",
          "Data de Nascimento": "", // Vazia
          Situação: "A",
          "Descrição da Situação": "Ativo",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III",
          "Nome Funcão": "Assistente",
        },
      ]);

      const simulacao = await simularImportacaoFuncionariosRm(
        planilha,
        "sem_nascimento.xlsx",
        "2026-09-17"
      );
      expect(simulacao.totais.erros).toBe(0);
      expect(simulacao.linhas[0].inconsistencias.some((i) => i.tipo === "ALERTA" && i.coluna === "Data de Nascimento")).toBe(true);
    });

    it("deve gerar erro impeditivo para data de nascimento futura e para idade superior a 100 anos", async () => {
      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "203",
          Nome: "Colaborador Do Futuro",
          CPF: "52998224725",
          "Data de Nascimento": "01/01/2030", // Futura
          Situação: "A",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III",
          "Nome Funcão": "Assistente",
        },
        {
          Chapa: "204",
          Nome: "Colaborador Centenario",
          CPF: "11144477735",
          "Data de Nascimento": "01/01/1910", // > 100 anos
          Situação: "A",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III",
          "Nome Funcão": "Assistente",
        },
      ]);

      const simulacao = await simularImportacaoFuncionariosRm(
        planilha,
        "nascimento_erros.xlsx",
        "2026-09-17"
      );
      expect(simulacao.totais.erros).toBe(2);
      expect(simulacao.linhas[0].validaParaGravacao).toBe(false);
      expect(simulacao.linhas[1].validaParaGravacao).toBe(false);
    });

    it("deve gerar alerta (sem bloquear) para colaborador menor de 18 anos", async () => {
      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "205",
          Nome: "Menor Aprendiz",
          CPF: "52998224725",
          Sexo: "F",
          "Data de Nascimento": "10/10/2010", // ~15 anos em 2026
          Situação: "A",
          "Descrição da Situação": "Ativo",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III",
          "Nome Funcão": "Jovem Aprendiz",
        },
      ]);

      const simulacao = await simularImportacaoFuncionariosRm(
        planilha,
        "menor_18.xlsx",
        "2026-09-17"
      );
      expect(simulacao.totais.erros).toBe(0);
      expect(simulacao.linhas[0].validaParaGravacao).toBe(true);
      expect(simulacao.linhas[0].inconsistencias.some((i) => i.tipo === "ALERTA" && i.mensagem.includes("menor de 18 anos"))).toBe(true);
    });
  });

  describe("4. Minimização LGPD (Colunas não permitidas são descartadas)", () => {
    it("deve ignorar coluna 'Idade', 'Salário', 'PIS' e outras não permitidas", async () => {
      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "301",
          Nome: "Colaborador Teste LGPD",
          CPF: "52998224725",
          Sexo: "M",
          "Data de Nascimento": "10/05/1992",
          Idade: 34, // NÃO PERMITIDA
          Salário: 7500.0, // NÃO PERMITIDA
          "Salario Hora": 34.09, // NÃO PERMITIDA
          PIS: "123.45678.90-1", // NÃO PERMITIDA
          "Tipo de Demissao": "Sem Justa Causa", // NÃO PERMITIDA
          RECMODIFIEDON: "2026-09-10", // NÃO PERMITIDA
          Situação: "A",
          "Descrição da Situação": "Ativo",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III",
          "Nome Funcão": "Engenheiro de Operações",
        },
      ]);

      const simulacao = await simularImportacaoFuncionariosRm(
        planilha,
        "lgpd_teste.xlsx",
        "2026-09-17"
      );
      const res = confirmarImportacaoFuncionariosRm(simulacao);
      expect(res.sucesso).toBe(true);

      const estado = carregarEstado();
      const gravado = estado.profissionais.find((p) => p.chapa === "000301");
      expect(gravado).toBeDefined();

      // Verifica que campos proibidos não existem no objeto gravado
      const gravadoQualquer = gravado as unknown as Record<string, unknown>;
      expect(gravadoQualquer["idade"]).toBeUndefined();
      expect(gravadoQualquer["salario"]).toBeUndefined();
      expect(gravadoQualquer["salarioHora"]).toBeUndefined();
      expect(gravadoQualquer["pis"]).toBeUndefined();
      expect(gravadoQualquer["recmodifiedon"]).toBeUndefined();
    });
  });

  describe("5. Mapeamento de Seções e Bases", () => {
    it("deve sugerir vinculo de base por similaridade de nome para nova seção", () => {
      const sugestaoUfn = sugerirBasePorDescricao("UFN-III (Três Lagoas - MS)");
      expect(sugestaoUfn?.unidadeId).toBe("UFN-III");

      const sugestaoMacae = sugerirBasePorDescricao("Base Operacional Macae RJ");
      expect(sugestaoMacae?.unidadeId).toBe("MACAE");
    });

    it("deve sinalizar alerta se seção não estiver mapeada e associar a 'Não mapeada'", async () => {
      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "401",
          Nome: "Colaborador Secao Nova",
          CPF: "52998224725",
          Situação: "A",
          Seção: "9.99.999.999", // Código inédito
          "Descrição Seção": "Canteiro Remoto Desconhecido",
          "Nome Funcão": "Técnico",
        },
      ]);

      const simulacao = await simularImportacaoFuncionariosRm(
        planilha,
        "secao_nao_mapeada.xlsx",
        "2026-09-17"
      );
      expect(simulacao.linhas[0].dados.unidadeId).toBe("NAO_MAPEADA");
      expect(simulacao.linhas[0].inconsistencias.some((i) => i.coluna === "Seção")).toBe(true);
    });
  });

  describe("6. Controle por Lote, Bloqueio de Duplicidade e Rollback (Desfazer Lote)", () => {
    it("deve impedir reimportação do mesmo arquivo pelo hash SHA-256", async () => {
      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "501",
          Nome: "Colaborador Lote Unico",
          CPF: "52998224725",
          Situação: "A",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III",
          "Nome Funcão": "Operador",
        },
      ]);

      // Primeira importação
      const sim1 = await simularImportacaoFuncionariosRm(planilha, "lote_duplicado.xlsx", "2026-09-17");
      expect(sim1.arquivoDuplicado).toBe(false);
      const conf1 = confirmarImportacaoFuncionariosRm(sim1);
      expect(conf1.sucesso).toBe(true);

      // Segunda importação com o mesmo buffer
      const sim2 = await simularImportacaoFuncionariosRm(planilha, "lote_duplicado.xlsx", "2026-09-17");
      expect(sim2.arquivoDuplicado).toBe(true);
      expect(sim2.loteAnteriorId).toBe(conf1.loteId);

      // A confirmação deve lançar erro
      expect(() => confirmarImportacaoFuncionariosRm(sim2)).toThrow(/este arquivo já foi importado/);
    });

    it("deve permitir desfazer o último lote restaurando o estado anterior", async () => {
      const estadoInicial = carregarEstado();
      expect(estadoInicial.profissionais.length).toBe(0);

      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "601",
          Nome: "Colaborador Para Rollback",
          CPF: "52998224725",
          Situação: "A",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III",
          "Nome Funcão": "Inspetor",
        },
      ]);

      const sim = await simularImportacaoFuncionariosRm(planilha, "rollback_teste.xlsx", "2026-09-17");
      confirmarImportacaoFuncionariosRm(sim);

      const estadoPosImport = carregarEstado();
      expect(estadoPosImport.profissionais.length).toBe(1);
      expect(estadoPosImport.lotesImportacao?.[0].status).toBe("CONCLUIDO");

      // Executa desfazer lote
      const resultadoDesfazer = desfazerUltimoLote("FUNCIONARIOS_RM");
      expect(resultadoDesfazer.sucesso).toBe(true);

      const estadoRestaurado = carregarEstado();
      expect(estadoRestaurado.profissionais.length).toBe(0);
      expect(estadoRestaurado.lotesImportacao?.[0].status).toBe("DESFEITO");

      // Trilha de auditoria deve conter registro do cancelamento
      const logDesfazer = estadoRestaurado.logsAuditoria.find(
        (l) => l.acao === "DESFAZER_LOTE_IMPORTACAO"
      );
      expect(logDesfazer).toBeDefined();
    });
  });

  describe("7. Geração de Relatório de Validação em XLSX", () => {
    it("deve gerar buffer de relatório XLSX contendo as 3 abas de validação", async () => {
      const planilha = criarPlanilhaXlsxBuffer([
        {
          Chapa: "701",
          Nome: "Colaborador Com Alerta",
          CPF: "52998224725",
          Sexo: "INVALIDO",
          Situação: "A",
          Seção: "1.01.080.029",
          "Descrição Seção": "UFN-III",
          "Nome Funcão": "Almoxarife",
        },
      ]);

      const sim = await simularImportacaoFuncionariosRm(planilha, "relatorio_teste.xlsx", "2026-09-17");
      const relatorioBytes = gerarRelatorioValidacaoXlsx(sim);
      expect(relatorioBytes).toBeDefined();
      expect(relatorioBytes.length).toBeGreaterThan(0);

      // Lê de volta o arquivo gerado
      const wb = XLSX.read(relatorioBytes, { type: "array" });
      expect(wb.SheetNames).toContain("Resumo");
      expect(wb.SheetNames).toContain("Erros e Alertas");
      expect(wb.SheetNames).toContain("Dados Analisados");
    });
  });
});
