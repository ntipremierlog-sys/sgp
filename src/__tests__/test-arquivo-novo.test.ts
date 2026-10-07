import { describe, it, expect } from "vitest";
import fs from "fs";
import * as XLSX from "xlsx";
import { conferirCabecalhosComTipo, simularImportacaoFuncionariosRm } from "@/lib/importadores/rm-funcionarios";

describe("Teste com FUNCIONÁRIOS PETROBRAS novo.XLS", () => {
  it("deve inspecionar e testar conferência e simulação", async () => {
    for (const nomeArquivo of ["FUNCIONÁRIOS PETROBRAS novo.XLS", "FUNCIONÁRIOS PETROBRAS.XLS", "funcionarios petrobras.XLSX"]) {
      if (!fs.existsSync(nomeArquivo)) continue;
      
      const nomeMinusculo = nomeArquivo.toLowerCase();
      expect(nomeMinusculo.endsWith(".xls") || nomeMinusculo.endsWith(".xlsx")).toBe(true);

      const buf = fs.readFileSync(nomeArquivo);
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      const cabecalhos = (rows[0] || []).map((c: any) => String(c || "").trim());

      const conf = conferirCabecalhosComTipo("FUNCIONARIOS_RM", cabecalhos);
      expect(conf.compativel).toBe(true);
      expect(conf.tipoDetectado).toBe("FUNCIONARIOS_RM");
      expect(conf.colunasFaltando.length).toBe(0);

      const sim = await simularImportacaoFuncionariosRm(buf, nomeArquivo, "2026-09-01", {
        competencia: "2026-09",
      });
      expect(sim.totais.lidos).toBeGreaterThan(0);
      expect(sim.totais.erros).toBe(0);
    }
  });
});
