/**
 * Testes Automatizados: Exibição RM (Código - Descrição) e Regras Estritas de LGPD por Perfil
 *
 * Requisitos:
 * EXIBIÇÃO:
 * - Em todas as telas (cadastro, filtros, Mapa de Ocupação, relatórios), mostrar Horário e Seção como "código – descrição", exatamente como vieram do RM.
 * - Filtros por Seção, Horário, Função, Situação e Sexo usando os cadastros importados.
 * - Campo auxiliar SOMENTE PARA FILTRO, sem alterar a descrição original: "Tipo de escala", identificado a partir do texto do horário (SEG/SEX, 12X36, 4X4, 4X2). Se não identificar, deixar "Não identificado".
 *
 * PERFIS E LGPD:
 * - Administração Premier: vê todos os campos, incluindo salários.
 * - Gestor Premier: vê tudo, exceto salários.
 * - Fiscal Petrobras: vê chapa, nome, função, seção, horário, situação, sexo e idade. CPF mascarado (***.***.***-82). Não vê salário nem data de nascimento completa.
 * - A visualização é definida pelo perfil. O usuário não pode alternar o modo de visualização.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import {
  formatarHorarioExibicao,
  formatarSecaoExibicao,
  identificarTipoEscala,
  formatarCpfPorPerfil,
  formatarDataNascimentoPorPerfil,
  calcularIdade,
  podeVisualizarSalario,
  formatarSalarioPorPerfil,
  ehPerfilFiscalPetrobras,
  PerfilUsuario,
} from "../lib/dados/rm-tipos";
import { processarEPreVisualizarArquivoRm } from "../lib/importadores/processador-rm-totvs";

describe("1. Exibição RM: Código – Descrição", () => {
  it("deve formatar Horário como 'código – descrição' sem duplicar código se já prefixado", () => {
    // Caso com código e descrição separados
    expect(formatarHorarioExibicao("10103", "ADM 07:00 AS 16:48 INTERVALO 01:00")).toBe(
      "10103 – ADM 07:00 AS 16:48 INTERVALO 01:00"
    );

    // Caso onde a descrição já começa com o código
    expect(formatarHorarioExibicao("10103", "10103 - ADM 07:00 AS 16:48")).toBe(
      "10103 - ADM 07:00 AS 16:48"
    );

    // Caso onde só veio o código
    expect(formatarHorarioExibicao("10103", "")).toBe("10103");

    // Caso onde só veio a descrição
    expect(formatarHorarioExibicao("", "12X36 TURNO")).toBe("12X36 TURNO");

    // Caso nulo / vazio
    expect(formatarHorarioExibicao(undefined, undefined)).toBe("–");
  });

  it("deve formatar Seção como 'código – descrição' sem duplicar código se já prefixado", () => {
    expect(formatarSecaoExibicao("1.01.080.001", "OPERAÇÃO BOAVENTURA")).toBe(
      "1.01.080.001 – OPERAÇÃO BOAVENTURA"
    );

    expect(formatarSecaoExibicao("1.01.080.002", "1.01.080.002 – MANUTENÇÃO")).toBe(
      "1.01.080.002 – MANUTENÇÃO"
    );

    expect(formatarSecaoExibicao("1.01.080.001", "")).toBe("1.01.080.001");
    expect(formatarSecaoExibicao("", "ADMINISTRATIVO")).toBe("ADMINISTRATIVO");
    expect(formatarSecaoExibicao(undefined, undefined)).toBe("–");
  });
});

describe("2. Campo Auxiliar 'Tipo de escala' (SOMENTE PARA FILTRO)", () => {
  it("deve identificar corretamente 'SEG/SEX' a partir do texto do horário", () => {
    expect(identificarTipoEscala("ADM 07:00 AS 16:48 (SEG/SEX)")).toBe("SEG/SEX");
    expect(identificarTipoEscala("10103 - HORÁRIO ADM SEG A SEX")).toBe("SEG/SEX");
    expect(identificarTipoEscala("5X2 SEGUNDA A SEXTA")).toBe("SEG/SEX");
  });

  it("deve identificar corretamente '12X36' a partir do texto do horário", () => {
    expect(identificarTipoEscala("12X36 DIA (07:00 AS 19:00)")).toBe("12X36");
    expect(identificarTipoEscala("12 X 36 TURNO NOTURNO")).toBe("12X36");
    expect(identificarTipoEscala("PLANTÃO 12x36")).toBe("12X36");
  });

  it("deve identificar corretamente '4X4' a partir do texto do horário", () => {
    expect(identificarTipoEscala("TURNO DE REVEZAMENTO 4X4")).toBe("4X4");
    expect(identificarTipoEscala("4 X 4 TURNO")).toBe("4X4");
  });

  it("deve identificar corretamente '4X2' a partir do texto do horário", () => {
    expect(identificarTipoEscala("TURNO 4X2 DIURNO")).toBe("4X2");
    expect(identificarTipoEscala("4 X 2")).toBe("4X2");
  });

  it("deve retornar 'Não identificado' para textos que não correspondem aos tipos conhecidos", () => {
    expect(identificarTipoEscala("JORNADA ESPECIAL")).toBe("Não identificado");
    expect(identificarTipoEscala("")).toBe("Não identificado");
    expect(identificarTipoEscala(undefined)).toBe("Não identificado");
  });

  it("não deve alterar ou mutar o texto original de horário fornecido", () => {
    const textoOriginal = "10103 - ADM 07:00 AS 16:48 INTERVALO 01:00 (SEG/SEX)";
    const copia = String(textoOriginal);
    const tipo = identificarTipoEscala(textoOriginal);
    expect(tipo).toBe("SEG/SEX");
    expect(textoOriginal).toBe(copia);
  });
});

describe("3. Perfis de Visualização e LGPD Estrita", () => {
  const perfis: PerfilUsuario[] = [
    "PREMIER_ADMIN",
    "PREMIER_GESTOR",
    "PETROBRAS_FISCAL",
  ];

  it("Administração Premier: vê todos os campos, incluindo salários", () => {
    const perfil: PerfilUsuario = "PREMIER_ADMIN";
    expect(podeVisualizarSalario(perfil)).toBe(true);
    expect(formatarSalarioPorPerfil(3842.5, perfil)).toBe("R$ 3.842,50");
    expect(formatarCpfPorPerfil("07391596582", perfil)).toBe("073.915.965-82");
    expect(formatarDataNascimentoPorPerfil("1988-04-15", perfil)).toBe("15/04/1988");
  });

  it("Gestor Premier: vê tudo, exceto salários", () => {
    const perfil: PerfilUsuario = "PREMIER_GESTOR";
    expect(podeVisualizarSalario(perfil)).toBe(false);
    expect(formatarSalarioPorPerfil(3842.5, perfil)).toBe("Restrito (LGPD)");
    expect(formatarCpfPorPerfil("07391596582", perfil)).toBe("073.915.965-82");
    expect(formatarDataNascimentoPorPerfil("1988-04-15", perfil)).toBe("15/04/1988");
  });

  it("Fiscal Petrobras: vê chapa, nome, função, seção, horário, situação, sexo e idade. CPF mascarado (***.***.***-82). Não vê salário nem data de nascimento completa.", () => {
    const perfil: PerfilUsuario = "PETROBRAS_FISCAL";
    expect(ehPerfilFiscalPetrobras(perfil)).toBe(true);
    expect(podeVisualizarSalario(perfil)).toBe(false);
    expect(formatarSalarioPorPerfil(3842.5, perfil)).toBe("");
    expect(formatarCpfPorPerfil("07391596582", perfil)).toBe("***.***.***-82");
    expect(formatarDataNascimentoPorPerfil("1988-04-15", perfil)).toBe("**/**/****");

    // Idade deve ser calculada a partir da data de nascimento mesmo que a data em si seja mascarada
    const idade = calcularIdade("1988-04-15");
    expect(idade).toBeGreaterThanOrEqual(35);
  });

  it("deve tratar perfil FISCAL_PETROBRAS identicamente a PETROBRAS_FISCAL", () => {
    expect(ehPerfilFiscalPetrobras("FISCAL_PETROBRAS")).toBe(true);
    expect(podeVisualizarSalario("FISCAL_PETROBRAS")).toBe(false);
    expect(formatarCpfPorPerfil("12345678901", "FISCAL_PETROBRAS")).toBe("***.***.***-01");
    expect(formatarDataNascimentoPorPerfil("1990-01-01", "FISCAL_PETROBRAS")).toBe("**/**/****");
  });
});

describe("4. Validação Integrada com a Base Real do RM (FUNCIONÁRIOS PETROBRAS.XLS)", () => {
  const caminhoXls = path.resolve(process.cwd(), "FUNCIONÁRIOS PETROBRAS.XLS");

  it("deve carregar todos os funcionários e validar tipos de escala e mascaramento LGPD", async () => {
    if (!fs.existsSync(caminhoXls)) {
      console.warn("Arquivo FUNCIONÁRIOS PETROBRAS.XLS não encontrado para teste integrado.");
      return;
    }

    const buffer = fs.readFileSync(caminhoXls);
    const resultado = await processarEPreVisualizarArquivoRm(buffer, "FUNCIONÁRIOS PETROBRAS.XLS");

    expect(resultado.bloqueadosErros).toBe(0);
    expect(resultado.totalLinhasLidas).toBe(388);
    expect(resultado.linhas.length).toBe(388);

    // Valida que todos os funcionários têm Horário e Seção formatáveis
    const horariosFormatados = new Set<string>();
    const secoesFormatadas = new Set<string>();
    const tiposEscala = new Set<string>();

    for (const f of resultado.linhas) {
      const hFmt = formatarHorarioExibicao(f.horarioCodigo, f.horarioDescricao);
      const sFmt = formatarSecaoExibicao(f.secaoCodigo, f.secaoDescricao);
      const tipoEscala = identificarTipoEscala(f.horarioDescricao || f.horarioCodigo);

      horariosFormatados.add(hFmt);
      secoesFormatadas.add(sFmt);
      tiposEscala.add(tipoEscala);

      // Valida padrão de Seção
      expect(sFmt).toMatch(/^1\.01\.080\.\d{3} – /);

      // Valida padrão de CPF para Fiscal Petrobras: exatamente ***.***.***-XX
      const cpfFiscal = formatarCpfPorPerfil(f.cpf, "PETROBRAS_FISCAL");
      expect(cpfFiscal).toMatch(/^\*\*\*\.\*\*\*\.\*\*\*-\d{2}$/);
      expect(cpfFiscal.slice(-2)).toBe(f.cpf.slice(-2));

      // Valida data de nascimento mascarada para Fiscal Petrobras
      const dataNascFiscal = formatarDataNascimentoPorPerfil(f.dataNascimento, "PETROBRAS_FISCAL");
      expect(dataNascFiscal).toBe("**/**/****");

      // Idade calculada está presente e coerente
      const idade = calcularIdade(f.dataNascimento);
      expect(idade).toBeGreaterThanOrEqual(18);
    }

    // Na base real do RM, existem escalas 12X36, SEG/SEX, 4X4, 4X2
    expect(tiposEscala.has("12X36")).toBe(true);
    expect(tiposEscala.has("SEG/SEX")).toBe(true);
    expect(tiposEscala.has("4X4")).toBe(true);
    expect(tiposEscala.has("4X2")).toBe(true);
  });
});
