import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import {
  processarEPreVisualizarArquivoRm,
  confirmarImportacaoRmAtomica,
  obterTodosFuncionariosRm,
  obterHistoricoLotesRm,
  obterTodosHistoricosRm,
  obterTodosHorariosRm,
  obterTodasSecoesRm,
  obterTodasSituacoesRm,
  obterTodasFuncoesRm,
  limparArmazenamentoRm,
} from "@/lib/importadores/processador-rm-totvs";

describe("Módulo Oficial de Importação Periódica RM/TOTVS — Telas e Fluxos", () => {
  beforeEach(() => {
    limparArmazenamentoRm();
  });

  describe("1. Teste Oficial com a Planilha Real: FUNCIONÁRIOS PETROBRAS.XLS", () => {
    it("deve carregar e apurar EXATAMENTE os 388 funcionários, 22 horários, 29 seções, 7 situações e 11 funções", async () => {
      const caminhoXls = path.resolve(process.cwd(), "FUNCIONÁRIOS PETROBRAS.XLS");
      expect(fs.existsSync(caminhoXls)).toBe(true);

      const buffer = fs.readFileSync(caminhoXls);
      const previa = await processarEPreVisualizarArquivoRm(
        buffer,
        "FUNCIONÁRIOS PETROBRAS.XLS",
        "2026-09-17"
      );

      // Validação das métricas exatas exigidas pelo usuário
      expect(previa.totalLinhasLidas).toBe(388);
      expect(previa.bloqueadosErros).toBe(0);
      expect(previa.novos).toBe(388);
      expect(previa.alterados).toBe(0);
      expect(previa.semAlteracao).toBe(0);

      // Catálogos
      expect(previa.totalHorarios).toBe(22);
      expect(previa.totalSecoes).toBe(29);
      expect(previa.totalSituacoes).toBe(7);
      expect(previa.totalFuncoes).toBe(11);

      // Breakdown por Situação:
      // 307 ativos, 65 demitidos, 7 em férias, 3 afastados previdência, 2 licença-maternidade, 1 aviso prévio, 3 admissão próximo mês
      expect(previa.contagemSituacoes["A - Ativo"]).toBe(307);
      expect(previa.contagemSituacoes["D - Demitido"]).toBe(65);
      expect(previa.contagemSituacoes["F - Férias"]).toBe(7);
      expect(previa.contagemSituacoes["P - Af.Previdência"]).toBe(3);
      expect(previa.contagemSituacoes["E - Licença Mater."]).toBe(2);
      expect(previa.contagemSituacoes["V - Aviso Prévio"]).toBe(1);
      expect(previa.contagemSituacoes["Z - Admissão prox.mês"]).toBe(3);

      // Validação das duas colunas de 'Descrição Seção'
      expect(previa.divergenciaSecaoDetectada).toBe(false);
    });
  });

  describe("2. Validações Automáticas de Cabeçalho e Regras de Bloqueio", () => {
    it("deve bloquear arquivo se faltar qualquer coluna obrigatória e listar exatamente qual", async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ["Chapa", "Nome", "CPF", "Seção"], // Faltando 15 colunas
        ["000100", "Teste", "11144477735", "1.01.080.023"],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Sheet");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });

      await expect(
        processarEPreVisualizarArquivoRm(buffer, "incompleto.xlsx", "2026-09-17")
      ).rejects.toThrow(/CABEÇALHO INVÁLIDO OU INCOMPLETO/);
    });

    it("deve acusar erro impeditivo para Chapa inválida, CPF com dígito inválido ou Seção fora do padrão 1.01.080.XXX", async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        [
          "Chapa",
          "Nome",
          "Nome Funcão",
          "Descrição do Horario",
          "CPF",
          "Salário Mensal",
          "Data de Admissão",
          "Data de Demissão",
          "Situação",
          "Descrição Seção",
          "Descrição da Situação",
          "Seção",
          "Salário Hora",
          "Idade",
          "Sexo",
          "Horário",
          "Jornada",
          "Descrição Seção",
          "Data de Nascimento",
        ],
        [
          "", // Chapa vazia (erro)
          "Colaborador Teste",
          "ALMOXARIFE",
          "PETROBRAS - 08:00 AS 17:48 - SEG/SEX",
          "12345678900", // CPF inválido (erro)
          3000,
          "2024-01-01",
          "",
          "A",
          "UFN-III",
          "Ativo",
          "999.000", // Seção fora do padrão 1.01.080.XXX (erro)
          15,
          30,
          "M",
          "1390",
          "220:00",
          "UFN-III",
          "1990-01-01",
        ],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Sheet");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });

      const previa = await processarEPreVisualizarArquivoRm(buffer, "teste_erros.xlsx", "2026-09-17");
      expect(previa.bloqueadosErros).toBe(1);
      expect(previa.linhas[0].inconsistencias.some((i) => i.coluna === "Chapa")).toBe(true);
      expect(previa.linhas[0].inconsistencias.some((i) => i.coluna === "CPF")).toBe(true);
      expect(previa.linhas[0].inconsistencias.some((i) => i.coluna === "Seção")).toBe(true);
    });

    it("deve acusar erro impeditivo para chapas ou CPFs duplicados dentro do próprio arquivo", async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        [
          "Chapa",
          "Nome",
          "Nome Funcão",
          "Descrição do Horario",
          "CPF",
          "Salário Mensal",
          "Data de Admissão",
          "Data de Demissão",
          "Situação",
          "Descrição Seção",
          "Descrição da Situação",
          "Seção",
          "Salário Hora",
          "Idade",
          "Sexo",
          "Horário",
          "Jornada",
          "Descrição Seção",
          "Data de Nascimento",
        ],
        [
          "000101",
          "Colaborador 1",
          "ALMOXARIFE",
          "HORARIO 1",
          "11144477735",
          3000,
          "2024-01-01",
          "",
          "A",
          "UFN-III",
          "Ativo",
          "1.01.080.023",
          15,
          30,
          "M",
          "1390",
          "220:00",
          "UFN-III",
          "1990-01-01",
        ],
        [
          "000101", // Mesma chapa duplicada no arquivo
          "Colaborador 2",
          "ALMOXARIFE",
          "HORARIO 1",
          "11144477735", // Mesmo CPF duplicado
          3000,
          "2024-01-01",
          "",
          "A",
          "UFN-III",
          "Ativo",
          "1.01.080.023",
          15,
          30,
          "M",
          "1390",
          "220:00",
          "UFN-III",
          "1990-01-01",
        ],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Sheet");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });

      const previa = await processarEPreVisualizarArquivoRm(buffer, "duplicados.xlsx", "2026-09-17");
      expect(previa.bloqueadosErros).toBe(1);
      expect(previa.linhas[1].inconsistencias.some((i) => i.mensagem.includes("duplicad"))).toBe(true);
    });
  });

  describe("3. Confirmação Atômica, Histórico de Alterações e Ausência de Colaborador", () => {
    it("deve gravar os 388 funcionários na confirmação e atualizar o estado operacional", async () => {
      const caminhoXls = path.resolve(process.cwd(), "FUNCIONÁRIOS PETROBRAS.XLS");
      const buffer = fs.readFileSync(caminhoXls);
      const previa = await processarEPreVisualizarArquivoRm(buffer, "FUNCIONÁRIOS PETROBRAS.XLS", "2026-09-17");

      const resultado = confirmarImportacaoRmAtomica(previa, "Administrador Premier");
      expect(resultado.sucesso).toBe(true);
      expect(resultado.loteId).toBeDefined();

      // Verifica dados gravados
      const funcionarios = obterTodosFuncionariosRm();
      expect(funcionarios.length).toBe(388);

      const lotes = obterHistoricoLotesRm();
      expect(lotes.length).toBe(1);
      expect(lotes[0].totalLinhasLidas).toBe(388);
      expect(lotes[0].novos).toBe(388);

      const horarios = obterTodosHorariosRm();
      expect(horarios.length).toBe(22);

      const secoes = obterTodasSecoesRm();
      expect(secoes.length).toBe(29);
    });

    it("em uma 2ª carga com alteração, deve registrar De/Para no histórico e marcar quem não veio", async () => {
      // 1ª carga
      const caminhoXls = path.resolve(process.cwd(), "FUNCIONÁRIOS PETROBRAS.XLS");
      const buffer = fs.readFileSync(caminhoXls);
      const previa1 = await processarEPreVisualizarArquivoRm(buffer, "FUNCIONÁRIOS PETROBRAS.XLS", "2026-09-17");
      confirmarImportacaoRmAtomica(previa1, "Administrador Premier");

      // 2ª carga: simulamos uma planilha que tem 1 funcionário que mudou de seção e 387 funcionários ausentes
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        [
          "Chapa",
          "Nome",
          "Nome Funcão",
          "Descrição do Horario",
          "CPF",
          "Salário Mensal",
          "Data de Admissão",
          "Data de Demissão",
          "Situação",
          "Descrição Seção",
          "Descrição da Situação",
          "Seção",
          "Salário Hora",
          "Idade",
          "Sexo",
          "Horário",
          "Jornada",
          "Descrição Seção",
          "Data de Nascimento",
        ],
        [
          "046862", // Chapa do ADIEL que existia na UFN-III
          "ADIEL WELISSON SANTOS CARDOSO",
          "ASSISTENTE DE LOGISTICA",
          "PETROBRAS - 12:00 AS 21:48 - SEG/SEX",
          "07391596582",
          3500.0, // Salário aumentou de 3152.47 para 3500.00
          "2024-01-01",
          "",
          "A",
          "RNEST (Ipojuca - PE)",
          "Ativo",
          "1.01.080.018", // Mudou de 1.01.080.023 para 1.01.080.018
          15.9,
          29,
          "M",
          "1409",
          "220:00",
          "RNEST (Ipojuca - PE)",
          "1997-01-01",
        ],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Sheet");
      const buffer2 = XLSX.write(wb, { bookType: "xlsx", type: "array" });

      const previa2 = await processarEPreVisualizarArquivoRm(buffer2, "segunda_carga.xlsx", "2026-10-01");
      expect(previa2.totalLinhasLidas).toBe(1);
      expect(previa2.novos).toBe(0);
      expect(previa2.alterados).toBe(1);
      expect(previa2.naoConstam.length).toBe(387); // 387 colaboradores anteriores não vieram nesta planilha

      // Confirma 2ª carga
      confirmarImportacaoRmAtomica(previa2, "Administrador Premier");

      // Verifica funcionário alterado
      const funcsPosCarga = obterTodosFuncionariosRm();
      const adiel = funcsPosCarga.find((f) => f.chapa === "046862");
      expect(adiel?.secaoCodigo).toBe("1.01.080.018");
      expect(adiel?.salarioMensal).toBe(3500.0);
      expect(adiel?.constaUltimaCarga).toBe(true);

      // Verifica que colaboradores que não vieram NÃO foram apagados, mas foram marcados com constaUltimaCarga = false
      const outro = funcsPosCarga.find((f) => f.chapa !== "046862");
      expect(outro).toBeDefined();
      expect(outro?.constaUltimaCarga).toBe(false);

      // Verifica histórico com data de vigência
      const historicos = obterTodosHistoricosRm();
      const histSecao = historicos.find(
        (h) => h.chapa === "046862" && h.tipoAlteracao === "MUDANCA_SECAO"
      );
      expect(histSecao).toBeDefined();
      expect(histSecao?.dataVigencia).toBe("2026-10-01");
      expect(histSecao?.valorNovo).toBe("1.01.080.018");
    });
  });
});
