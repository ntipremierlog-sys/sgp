import { describe, it, expect, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import {
  simularImportacaoFuncionariosRm,
  confirmarImportacaoFuncionariosRm,
  gerarModeloFuncionariosXlsx,
  lerPlanilhaFuncionariosComAbas,
  conferirCabecalhosComTipo,
} from "@/lib/importadores/rm-funcionarios";
import {
  simularImportacaoPonto,
  confirmarImportacaoPonto,
  processarPlanilhaPonto,
} from "@/lib/importadores/planilha-ponto";
import {
  simularImportacaoAbono,
  confirmarImportacaoAbono,
} from "@/lib/importadores/cubo-abono";
import {
  carregarEstado,
  salvarEstado,
  desfazerLotePorId,
} from "@/lib/dados/estado-operacional";
import {
  obterPeriodoCompetencia,
  gerarCalendarioCompetencia,
  obterCalendarioCompetencia,
  marcarCalendarioDesatualizado,
} from "@/lib/servicos/calendario-competencia";

/**
 * Cria buffer binário de XLSX com suporte a múltiplas abas
 */
function criarWorkbookBuffer(abas: Record<string, Record<string, unknown>[]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [nomeAba, dados] of Object.entries(abas)) {
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  }
  return new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
}

describe("CENÁRIO DE 3 ARQUIVOS DO RM POR COMPETÊNCIA (Funcionários → Ponto → Abonos)", () => {
  const competencia = "2026-09"; // 10/08/2026 a 09/09/2026

  beforeEach(() => {
    salvarEstado({
      profissionais: [],
      lotesImportacao: [],
      ocorrencias: [],
      marcacoesPonto: [],
      logsAuditoria: [],
    });
  });

  describe("1. Período e Seleção de Competência", () => {
    it("deve calcular corretamente o período do dia 10 do mês anterior ao dia 09 do mês de referência", () => {
      const periodo = obterPeriodoCompetencia("2026-09");
      expect(periodo.dataInicio).toBe("2026-08-10");
      expect(periodo.dataFim).toBe("2026-09-09");
      expect(periodo.textoFormatado).toBe("10/08/2026 a 09/09/2026");
      expect(periodo.datas.length).toBe(31);
    });

    it("deve calcular o período na virada de ano corretamente", () => {
      const periodo = obterPeriodoCompetencia("2027-01");
      expect(periodo.dataInicio).toBe("2026-12-10");
      expect(periodo.dataFim).toBe("2027-01-09");
      expect(periodo.textoFormatado).toBe("10/12/2026 a 09/01/2027");
    });
  });

  describe("2. Normalização de CHAPA (6 dígitos)", () => {
    it("deve tratar '37355' e '037355' como a mesma pessoa completando zeros à esquerda", async () => {
      const planilha = criarWorkbookBuffer({
        CADASTRO: [
          {
            CHAPA: "37355",
            NOME: "Colaborador Zeros Teste",
            "COD.SECAO": "1.01.080.029",
            "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
            FUNCAO: "Auxiliar",
            HORARIO: "001",
            SITUACAO: "A",
            DATA_ADMISSAO: "01/01/2024",
          },
        ],
      });

      const sim = await simularImportacaoFuncionariosRm(
        planilha,
        "funcionarios.xlsx",
        "2026-09-01",
        { competencia }
      );

      expect(sim.linhas[0].dados.chapa).toBe("037355");
      expect(sim.linhas[0].dados.matricula).toBe("037355");

      confirmarImportacaoFuncionariosRm(sim);

      const estado = carregarEstado();
      const prof = estado.profissionais.find((p) => p.chapa === "037355");
      expect(prof).toBeDefined();
      expect(prof?.nome).toBe("Colaborador Zeros Teste");
    });
  });

  describe("3. Modelo de Funcionários com 2 Abas (CADASTRO e AFASTAMENTOS_FERIAS)", () => {
    it("deve gerar modelo oficial com abas CADASTRO e AFASTAMENTOS_FERIAS", () => {
      const buffer = gerarModeloFuncionariosXlsx();
      const abas = lerPlanilhaFuncionariosComAbas(buffer);
      expect(abas.linhasCadastro.length).toBeGreaterThan(0);
      expect(abas.linhasAfastamentos.length).toBeGreaterThan(0);
      expect(abas.cabecalhosCadastro.map((c) => c.toLowerCase())).toContain("chapa");
      expect(abas.cabecalhosAfastamentos.map((c) => c.toLowerCase())).toContain("tipo");
    });

    it("deve validar afastamentos rejeitando chapa inexistente no cadastro e períodos sobrepostos", async () => {
      const planilha = criarWorkbookBuffer({
        CADASTRO: [
          {
            CHAPA: "000101",
            NOME: "Funcionario Valido",
            "COD.SECAO": "1.01.080.029",
            "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
            FUNCAO: "Operador",
            HORARIO: "001",
            SITUACAO: "A",
            DATA_ADMISSAO: "01/01/2024",
          },
        ],
        AFASTAMENTOS_FERIAS: [
          {
            CHAPA: "999999", // Não existe no CADASTRO -> Deve rejeitar
            TIPO: "Férias",
            DATA_INICIO: "15/08/2026",
            DATA_FIM: "25/08/2026",
          },
          {
            CHAPA: "000101",
            TIPO: "Férias",
            DATA_INICIO: "12/08/2026",
            DATA_FIM: "20/08/2026",
          },
          {
            CHAPA: "000101",
            TIPO: "Licença", // Sobreposto ao período anterior -> Deve rejeitar
            DATA_INICIO: "18/08/2026",
            DATA_FIM: "22/08/2026",
          },
        ],
      });

      const sim = await simularImportacaoFuncionariosRm(
        planilha,
        "func_afastamentos.xlsx",
        "2026-09-01",
        { competencia }
      );

      expect(sim.linhasRejeitadasLista!.length).toBe(2);
      expect(sim.linhasRejeitadasLista!.some((r) => r.motivo.includes("não encontrada na aba CADASTRO"))).toBe(true);
      expect(sim.linhasRejeitadasLista!.some((r) => r.motivo.includes("Período sobreposto"))).toBe(true);
      expect(sim.afastamentosValidos!.length).toBe(1);
      expect(sim.afastamentosValidos![0].tipoMapeado).toBe("Férias");
    });
  });

  describe("4. Regra de Ordem e Substituição sem Somar (Não Duplicar)", () => {
    it("deve substituir lote da mesma competência ao reimportar, sem somar registros", async () => {
      const planilha1 = criarWorkbookBuffer({
        CADASTRO: [
          {
            CHAPA: "000101",
            NOME: "Funcionario Versao 1",
            "COD.SECAO": "1.01.080.029",
            "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
            FUNCAO: "Operador",
            HORARIO: "001",
            SITUACAO: "A",
            DATA_ADMISSAO: "01/01/2024",
          },
        ],
      });

      const sim1 = await simularImportacaoFuncionariosRm(planilha1, "v1.xlsx", "2026-09-01", {
        competencia,
      });
      const conf1 = confirmarImportacaoFuncionariosRm(sim1);
      expect(conf1.sucesso).toBe(true);

      expect(carregarEstado().profissionais.length).toBe(1);
      expect(carregarEstado().profissionais[0].nome).toBe("Funcionario Versao 1");

      // Segunda importação com nova pessoa substituindo
      const planilha2 = criarWorkbookBuffer({
        CADASTRO: [
          {
            CHAPA: "000102",
            NOME: "Funcionario Versao 2 Substituto",
            "COD.SECAO": "1.01.080.029",
            "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
            FUNCAO: "Assistente",
            HORARIO: "001",
            SITUACAO: "A",
            DATA_ADMISSAO: "01/01/2024",
          },
        ],
      });

      const sim2 = await simularImportacaoFuncionariosRm(planilha2, "v2.xlsx", "2026-09-02", {
        competencia,
      });
      const conf2 = confirmarImportacaoFuncionariosRm(sim2);
      expect(conf2.sucesso).toBe(true);

      const estadoPosSubst = carregarEstado();
      // Não deve ter somado para 2: deve conter a nova lista substituída
      expect(estadoPosSubst.profissionais.length).toBe(1);
      expect(estadoPosSubst.profissionais[0].chapa).toBe("000102");
      expect(estadoPosSubst.profissionais[0].nome).toBe("Funcionario Versao 2 Substituto");
    });
  });

  describe("5. Desfazer Lote de Funcionários em Cascata", () => {
    it("deve desfazer lotes de Ponto e Abonos em cascata ao desfazer Funcionários da mesma competência", async () => {
      // 1. Cadastra Funcionários
      const planFunc = criarWorkbookBuffer({
        CADASTRO: [
          {
            CHAPA: "000101",
            NOME: "Funcionario Cascata",
            "COD.SECAO": "1.01.080.029",
            "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
            FUNCAO: "Operador",
            HORARIO: "001",
            SITUACAO: "A",
            DATA_ADMISSAO: "01/01/2024",
          },
        ],
      });
      const simFunc = await simularImportacaoFuncionariosRm(planFunc, "func.xlsx", "2026-09-01", {
        competencia,
      });
      const resFunc = confirmarImportacaoFuncionariosRm(simFunc);

      // 2. Cadastra Ponto na mesma competência
      const planPonto = criarWorkbookBuffer({
        Sheet1: [
          {
            CHAPA: "000101",
            DATA: "15/08/2026",
            ENT1: "07:00",
            SAI1: "16:48",
          },
        ],
      });
      const simPonto = await simularImportacaoPonto(planPonto, "ponto.xlsx", "2026-09-01", {
        competencia,
      });
      const resPonto = confirmarImportacaoPonto(simPonto as any);

      // 3. Cadastra Abono na mesma competência
      const planAbono = criarWorkbookBuffer({
        Sheet1: [
          {
            CHAPA: "000101",
            NOME_FUNCIONARIO: "Funcionario Cascata",
            "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
            DATA: "18/08/2026",
            ABONO2: "08:48:00",
            "DESCRICAO ABONO": "ATESTADO MEDICO",
          },
        ],
      });
      const simAbono = await simularImportacaoAbono(planAbono, "abono.xlsx", "2026-09-01", {
        competencia,
      });
      const resAbono = confirmarImportacaoAbono(simAbono);

      expect((carregarEstado().lotesImportacao || []).filter((l) => l.status === "CONCLUIDO").length).toBe(3);

      // Desfaz o lote de Funcionários com desfazerCascata = true
      const rollback = desfazerLotePorId(resFunc.loteId, "Admin Premier", true);
      expect(rollback.sucesso).toBe(true);
      expect(rollback.lotesDesfeitos).toContain(resFunc.loteId);
      expect(rollback.lotesDesfeitos).toContain(resPonto.loteId);
      expect(rollback.lotesDesfeitos).toContain(resAbono.loteId);

      const estadoPosRollback = carregarEstado();
      const lotesConcluidos = (estadoPosRollback.lotesImportacao || []).filter((l) => l.status === "CONCLUIDO");
      expect(lotesConcluidos.length).toBe(0);
    });
  });

  describe("6. Motor do Calendário da Competência e Invalidação", () => {
    it("deve gerar o calendário aplicando as regras de prioridade e marcar como desatualizado ao modificar lote", async () => {
      // 1. Cadastra Funcionário com férias de 15/08 a 20/08
      const planFunc = criarWorkbookBuffer({
        CADASTRO: [
          {
            CHAPA: "000101",
            NOME: "Colaborador Calendario",
            "COD.SECAO": "1.01.080.029",
            "DESC. SECAO": "UFN-III (Três Lagoas - MS)",
            FUNCAO: "Operador",
            HORARIO: "001",
            SITUACAO: "A",
            DATA_ADMISSAO: "01/01/2024",
          },
        ],
        AFASTAMENTOS_FERIAS: [
          {
            CHAPA: "000101",
            TIPO: "Férias",
            DATA_INICIO: "15/08/2026",
            DATA_FIM: "20/08/2026",
          },
        ],
      });
      const simFunc = await simularImportacaoFuncionariosRm(planFunc, "func.xlsx", "2026-09-01", {
        competencia,
      });
      confirmarImportacaoFuncionariosRm(simFunc);

      // 2. Gera o calendário
      const cal = gerarCalendarioCompetencia(competencia, "Admin Premier");
      expect(cal.status).toBe("GERADO");
      expect(cal.colaboradores.length).toBe(1);

      const colab = cal.colaboradores[0];
      // Dia 16/08 deve ser "Férias" (Regra 2)
      expect(colab.dias["2026-08-16"].status).toBe("Férias");

      // 3. Ao marcar como desatualizado
      marcarCalendarioDesatualizado(competencia);
      const calAtual = obterCalendarioCompetencia(competencia);
      expect(calAtual?.status).toBe("DESATUALIZADO");
    });
  });
});
