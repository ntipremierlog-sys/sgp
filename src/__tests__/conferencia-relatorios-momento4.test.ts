/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Testes de Conferência dos Relatórios Importados e Validação do Cubo de Registros
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import * as XLSX from "xlsx";
import {
  identificarTipoArquivo,
  simularImportacaoFuncionariosRm,
} from "@/lib/importadores/rm-funcionarios";
import { simularImportacaoSifac } from "@/lib/importadores/sifac-alocados";
import { simularImportacaoAbono } from "@/lib/importadores/cubo-abono";
import {
  simularImportacaoPonto,
  confirmarImportacaoPonto,
} from "@/lib/importadores/planilha-ponto";
import {
  carregarEstado,
  obterMarcacoesPonto,
  obterDiasFolgaPonto,
} from "@/lib/dados/estado-operacional";
import { apurarPresencaEPostos } from "@/lib/servicos/apuracao-presenca";
import {
  carregarHorariosInterpretados,
  carregarCiclosColaboradores,
} from "@/lib/servicos/interpretador-horarios";

describe("Conferência dos Relatórios Importados e Cubo de Registros", () => {
  it("deve identificar corretamente os 4 tipos de relatórios sem colisão entre Cubo de Registros e Abono", () => {
    // 1. Cubo de Registros (deve ser REGISTROS_PONTO_RM mesmo contendo a coluna ABONO2)
    const bufCuboRegistros = fs.readFileSync("CUBO DE REGISTROS.xlsx");
    const wbCubo = XLSX.read(bufCuboRegistros, { type: "buffer" });
    const cabecalhosCubo = (
      XLSX.utils.sheet_to_json<string[]>(wbCubo.Sheets[wbCubo.SheetNames[0]], { header: 1 })[0] || []
    ).map((c) => String(c || "").trim());

    const idCubo = identificarTipoArquivo(cabecalhosCubo);
    expect(idCubo.reconhecido).toBe(true);
    expect(idCubo.tipo).toBe("REGISTROS_PONTO_RM");

    // 2. Cubo de Abono (deve ser ABONO_RM)
    const bufCuboAbono = fs.readFileSync("CUBO DE ABONO.xlsx");
    const wbAbono = XLSX.read(bufCuboAbono, { type: "buffer" });
    const cabecalhosAbono = (
      XLSX.utils.sheet_to_json<string[]>(wbAbono.Sheets[wbAbono.SheetNames[0]], { header: 1 })[0] || []
    ).map((c) => String(c || "").trim());

    const idAbono = identificarTipoArquivo(cabecalhosAbono);
    expect(idAbono.reconhecido).toBe(true);
    expect(idAbono.tipo).toBe("ABONO_RM");

    // 3. SIFAC Alocados (deve ser ALOCADOS_SIFAC)
    const bufSifac = fs.readFileSync("08_Lista de Alocados_SIFAC_Agosto_.xlsx");
    const wbSifac = XLSX.read(bufSifac, { type: "buffer" });
    const cabecalhosSifac = (
      XLSX.utils.sheet_to_json<string[]>(wbSifac.Sheets["Modelo"], { header: 1 })[0] || []
    ).map((c) => String(c || "").trim());

    const idSifac = identificarTipoArquivo(cabecalhosSifac);
    expect(idSifac.reconhecido).toBe(true);
    expect(idSifac.tipo).toBe("ALOCADOS_SIFAC");

    // 4. Funcionários Petrobras (deve ser FUNCIONARIOS_RM)
    const bufRm = fs.readFileSync("funcionarios petrobras.XLSX");
    const wbRm = XLSX.read(bufRm, { type: "buffer" });
    const cabecalhosRm = (
      XLSX.utils.sheet_to_json<string[]>(wbRm.Sheets[wbRm.SheetNames[0]], { header: 1 })[0] || []
    ).map((c) => String(c || "").trim());

    const idRm = identificarTipoArquivo(cabecalhosRm);
    expect(idRm.reconhecido).toBe(true);
    expect(idRm.tipo).toBe("FUNCIONARIOS_RM");
  });

  it("deve simular e extrair marcações e dias de folga/base zero de CUBO DE REGISTROS.xlsx", async () => {
    const bufCuboRegistros = fs.readFileSync("CUBO DE REGISTROS.xlsx");
    const simulacao = await simularImportacaoPonto(bufCuboRegistros, "CUBO DE REGISTROS.xlsx", "2026-08-31");

    expect(simulacao.tipo).toBe("REGISTROS_PONTO_RM");
    expect(simulacao.modeloUtilizado).toContain("Cubo de Registros");
    expect(simulacao.totais.novos).toBeGreaterThan(15000); // 15.752 marcações
    expect(simulacao.diasSemJornadaPrevista).toBeDefined();
    expect(simulacao.diasSemJornadaPrevista?.length).toBeGreaterThan(2000); // 2.885 dias sem jornada
  });

  it("deve realizar apuração correta no dia do Feriado Nacional de 07/09 e antes de admissões", async () => {
    const bufCuboRegistros = fs.readFileSync("CUBO DE REGISTROS.xlsx");
    const simulacao = await simularImportacaoPonto(bufCuboRegistros, "CUBO DE REGISTROS.xlsx", "2026-08-31");

    // Confirma lote de ponto no estado
    confirmarImportacaoPonto(simulacao, "Teste de Conferencia");

    const estado = carregarEstado();
    const marcacoes = obterMarcacoesPonto();
    const diasFolga = obterDiasFolgaPonto();

    expect(marcacoes.length).toBeGreaterThan(15000);
    expect(diasFolga.length).toBeGreaterThan(2000);

    const resultadoApuracao = apurarPresencaEPostos(
      estado.profissionais,
      marcacoes,
      estado.ocorrencias,
      estado.coberturas,
      estado.postos,
      {
        dataInicio: "2026-08-25",
        dataFim: "2026-09-15",
        dataReferenciaUltimoLote: "2026-09-15 23:59",
        diasSemJornadaRm: diasFolga,
      },
      carregarHorariosInterpretados(),
      carregarCiclosColaboradores()
    );

    // 1. No Feriado Nacional de 07/09/2026, colaboradores administrativos (SEG/SEX) devem estar em FOLGA_ESCALA, não FALTA
    const apuracoes07Set = resultadoApuracao.apuracoesPorColaboradorDia.filter(
      (a) => a.data === "2026-09-07"
    );
    const faltas07Set = apuracoes07Set.filter((a) => a.situacao === "FALTA");
    expect(faltas07Set.length).toBeLessThan(10); // Apenas faltas reais se houver plantão, zero faltas em massa

    // 2. Colaborador admitido em 01/09/2026 (ex: Chapa 046451) não pode receber falta em 31/08/2026
    const apuracaoFabio31 = resultadoApuracao.apuracoesPorColaboradorDia.find(
      (a) => a.chapa === "046451" && a.data === "2026-08-31"
    );
    expect(apuracaoFabio31?.situacao).not.toBe("FALTA");

    // 3. Colaboradora Amanda (Chapa 036073) com HORA_BASE2 == 0 em 31/08 não pode receber falta
    const apuracaoAmanda31 = resultadoApuracao.apuracoesPorColaboradorDia.find(
      (a) => a.chapa === "036073" && a.data === "2026-08-31"
    );
    expect(apuracaoAmanda31?.situacao).not.toBe("FALTA");
  });
});
