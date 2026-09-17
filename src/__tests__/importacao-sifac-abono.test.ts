import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  identificarArquivoSifac,
  simularImportacaoSifac,
  confirmarImportacaoSifac,
  CONTRATO_SIFAC_ESPERADO,
  CNPJ_PREMIER_ESPERADO,
} from "@/lib/importadores/sifac-alocados";
import {
  identificarArquivoAbono,
  simularImportacaoAbono,
  confirmarImportacaoAbono,
} from "@/lib/importadores/cubo-abono";
import { carregarEstado } from "@/lib/dados/estado-operacional";

function criarPlanilhaBuffer(sheetName: string, linhas: Record<string, unknown>[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(linhas);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(out);
}

describe("MOMENTO 2 & 3 — Motores de Importação SIFAC e Cubo de Abono", () => {
  describe("1. Importação de Alocados SIFAC", () => {
    it("deve identificar corretamente os cabeçalhos do modelo SIFAC", () => {
      const cabecalhos = [
        "NroContrato",
        "Cnpj",
        "DataCompetenciaCadastro",
        "Nome",
        "Cpf",
        "CodigoSituacaoEmpregado",
        "Cargo",
        "Município de Prestação de Serviço",
        "Regime",
      ];
      const id = identificarArquivoSifac(cabecalhos);
      expect(id.reconhecido).toBe(true);
      expect(id.tipo).toBe("ALOCADOS_SIFAC");
      expect(id.colunasObrigatoriasFaltando.length).toBe(0);
    });

    it("deve rejeitar cabeçalhos incompletos do SIFAC", () => {
      const cabecalhos = ["NroContrato", "Cnpj", "Cidade"];
      const id = identificarArquivoSifac(cabecalhos);
      expect(id.reconhecido).toBe(false);
      expect(id.tipo).toBe("DESCONHECIDO");
      expect(id.colunasObrigatoriasFaltando.length).toBeGreaterThan(0);
    });

    it("deve simular importação SIFAC com validação de contrato e alerta de CPF não encontrado no RM", async () => {
      const buffer = criarPlanilhaBuffer("Modelo", [
        {
          NroContrato: 4600682336,
          Cnpj: "10.592.109/0001-19",
          Nome: "Colaborador Fictício SIFAC",
          Cpf: "12345678901",
          Cargo: "ASSISTENTE DE LOGISTICA",
          "Município de Prestação de Serviço": "Três Lagoas",
          Regime: "OnShore",
        },
      ]);

      const simulacao = await simularImportacaoSifac(buffer, "sifac_teste.xlsx", "2026-08-10");
      expect(simulacao.tipo).toBe("ALOCADOS_SIFAC");
      expect(simulacao.totais.lidos).toBe(1);
      expect(simulacao.totais.novos).toBe(1);
      // Como é fictício e não consta no RM, deve gerar alerta
      expect(simulacao.totais.alertas).toBeGreaterThanOrEqual(1);
      expect(simulacao.inconsistencias.some((i) => i.tipo === "ALERTA")).toBe(true);
    });
  });

  describe("2. Importação do Cubo de Abono RM", () => {
    it("deve identificar corretamente os cabeçalhos do Cubo de Abono", () => {
      const cabecalhos = [
        "COD.SECÃO",
        "DESC. SECAO",
        "CHAPA",
        "NOME_FUNCIONARIO",
        "DATA",
        "DESCRICAO ABONO",
      ];
      const id = identificarArquivoAbono(cabecalhos);
      expect(id.reconhecido).toBe(true);
      expect(id.tipo).toBe("ABONO_RM");
    });

    it("deve simular importação de abonos categorizando Atestado Médico e Abono Legal", async () => {
      const buffer = criarPlanilhaBuffer("Sheet", [
        {
          "COD.SECÃO": "1.01.080.023",
          "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
          CHAPA: "037606",
          NOME_FUNCIONARIO: "LARISSA OLIVEIRA",
          DATA: "06/08/2026",
          "DIA SEMANA": "QUI",
          "DESCRICAO ABONO": "ATESTADO MEDICO",
        },
        {
          "COD.SECÃO": "1.01.080.023",
          "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
          CHAPA: "037606",
          NOME_FUNCIONARIO: "LARISSA OLIVEIRA",
          DATA: "07/08/2026",
          "DIA SEMANA": "SEX",
          "DESCRICAO ABONO": "ABONADO PELO SUPERIOR",
        },
      ]);

      const simulacao = await simularImportacaoAbono(buffer, "abono_teste.xlsx", "2026-08-31");
      expect(simulacao.tipo).toBe("ABONO_RM");
      expect(simulacao.totais.lidos).toBe(2);
      expect(simulacao.linhas[0].dados.tipoOcorrencia).toBe("ATESTADO_MEDICO");
      expect(simulacao.linhas[1].dados.tipoOcorrencia).toBe("ABONO_LEGAL");
      expect(simulacao.linhas[0].dados.data).toBe("2026-08-06");
      expect(simulacao.linhas[1].dados.data).toBe("2026-08-07");
    });
  });
});
