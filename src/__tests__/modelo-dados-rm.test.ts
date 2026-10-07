import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import * as path from "path";
import {
  CABECALHOS_RM_OFICIAIS,
  calcularIdadeDinamica,
  normalizarChapa,
  normalizarCpf,
  validarCpfMatematico,
  formatarDescricaoHorarioParaTela,
} from "@/lib/dados/rm-tipos";

describe("Modelo de Dados Oficial — Importação Periódica RM/TOTVS", () => {
  it("deve conter exatamente os 19 cabeçalhos oficiais com a grafia exata do RM", () => {
    expect(CABECALHOS_RM_OFICIAIS.length).toBe(19);
    expect(CABECALHOS_RM_OFICIAIS[2]).toBe("Nome Funcão"); // Erro de digitação original preservado
    expect(CABECALHOS_RM_OFICIAIS[9]).toBe("Descrição Seção");
    expect(CABECALHOS_RM_OFICIAIS[17]).toBe("Descrição Seção"); // 2ª ocorrência
    expect(CABECALHOS_RM_OFICIAIS[0]).toBe("Chapa");
    expect(CABECALHOS_RM_OFICIAIS[15]).toBe("Horário");
    expect(CABECALHOS_RM_OFICIAIS[11]).toBe("Seção");
  });

  it("deve validar e extrair com fidelidade os dados do arquivo real FUNCIONÁRIOS PETROBRAS.XLS", () => {
    const caminhoArquivo = path.resolve(process.cwd(), "FUNCIONÁRIOS PETROBRAS.XLS");
    const wb = XLSX.readFile(caminhoArquivo);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    const cabecalhoArquivo = rows[0] as string[];
    expect(cabecalhoArquivo.length).toBe(19);
    expect(cabecalhoArquivo[2]).toBe("Nome Funcão");

    // Valida que a primeira linha de dados possui tipos de dados corretos
    const primeiraLinha = rows[1];
    const chapa = normalizarChapa(primeiraLinha[0] as string);
    const cpf = normalizarCpf(primeiraLinha[4] as string);
    const codHorario = String(primeiraLinha[15]);
    const codSecao = String(primeiraLinha[11]);
    const salarioMensal = Number(primeiraLinha[5]);
    const salarioHora = Number(primeiraLinha[12]);

    expect(chapa).toBe("046862"); // 6 dígitos texto
    expect(cpf).toBe("07391596582"); // 11 dígitos texto
    expect(validarCpfMatematico(cpf)).toBe(true);
    expect(codHorario).toBe("1409");
    expect(codSecao).toBe("1.01.080.023");
    expect(salarioMensal).toBe(3152.47);
    expect(salarioHora).toBe(14.33);

    // Valida que em nenhuma linha a 1ª e a 2ª ocorrência de Descrição Seção divergem no arquivo real
    let totalDivergencias = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      if (r[9] !== r[17]) {
        totalDivergencias++;
      }
    }
    expect(totalDivergencias).toBe(0);
  });

  it("deve calcular a idade de forma dinâmica e precisa sem depender da coluna fixa da planilha", () => {
    // Nascido em 15/05/1990
    expect(calcularIdadeDinamica("1990-05-15", "2026-05-14")).toBe(35); // 1 dia antes do aniversário
    expect(calcularIdadeDinamica("1990-05-15", "2026-05-15")).toBe(36); // No aniversário
    expect(calcularIdadeDinamica("1990-05-15", "2026-10-05")).toBe(36); // Meses após
  });

  it("deve normalizar Chapa para 6 dígitos texto com zeros à esquerda", () => {
    expect(normalizarChapa("46862")).toBe("046862");
    expect(normalizarChapa(123)).toBe("000123");
    expect(normalizarChapa("046862")).toBe("046862");
  });

  it("deve normalizar e validar CPF matematicamente", () => {
    expect(normalizarCpf("7391596582")).toBe("07391596582"); // Completa zero à esquerda
    expect(validarCpfMatematico("07391596582")).toBe(true);
    expect(validarCpfMatematico("11144477735")).toBe(true);
    expect(validarCpfMatematico("12345678900")).toBe(false);
    expect(validarCpfMatematico("11111111111")).toBe(false);
  });

  it("deve manter o valor original do horário intacto e apenas limpar na exibição em tela", () => {
    const horarioOriginal = "PETROBRAS - 09:00 AS 18:48 - SEG/SEX \n";
    const horarioFormatado = formatarDescricaoHorarioParaTela(horarioOriginal);

    // O original não pode ser alterado
    expect(horarioOriginal.includes("\n")).toBe(true);
    expect(horarioOriginal.endsWith(" \n")).toBe(true);

    // O formatado para tela remove \n e espaços em branco do final
    expect(horarioFormatado).toBe("PETROBRAS - 09:00 AS 18:48 - SEG/SEX");
    expect(horarioFormatado.endsWith(" ")).toBe(false);
  });
});
