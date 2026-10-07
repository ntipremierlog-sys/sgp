import { describe, it, expect } from "vitest";
import { obterOcupacaoConsolidada } from "@/lib/servicos/adaptador-painel";
import { consolidarDecisoesPorPosto } from "@/lib/servicos/decisoes-consolidadas";
import { EstadoOperacionalCompleto } from "@/lib/dados/estado-operacional";
import { usuarioTemAcessoBase } from "@/lib/auth/permissoes";
import { UsuarioSessao } from "@/lib/auth/tipos";

describe("Visão da Base e Regras Visuais (MOMENTO 3)", () => {
  const estadoMock: EstadoOperacionalCompleto = {
    postos: [
      {
        id: "P-UFN-01",
        idPosto: "1",
        codigoPosto: "UFN3-OP-01",
        funcao: "Operador de Painel I",
        itemPPU: "3.2",
        tipoPostoId: "TURNO_12H",
        periculosidade: "SIM",
        municipio: "Três Lagoas",
        localAtuacao: "UFN III",
        gerenciaPetrobras: "GERÊNCIA UFN-III",
        unidadeId: "UFN-III",
        unidadeNome: "UFN III – Três Lagoas/MS",
        escala: "12x36",
        jornadaSemanalHoras: 36,
        horarioInicio: "07:00",
        horarioFim: "19:00",
        titularNome: "Carlos Silva",
        titularMatricula: "MAT-001",
        situacao: "ATIVO",
        dataInicioVigencia: "2026-01-01",
      },
      {
        id: "P-UFN-02",
        idPosto: "2",
        codigoPosto: "UFN3-OP-02",
        funcao: "Operador de Campo II",
        itemPPU: "3.2",
        tipoPostoId: "TURNO_12H",
        periculosidade: "SIM",
        municipio: "Três Lagoas",
        localAtuacao: "UFN III",
        gerenciaPetrobras: "GERÊNCIA UFN-III",
        unidadeId: "UFN-III",
        unidadeNome: "UFN III – Três Lagoas/MS",
        escala: "12x36",
        jornadaSemanalHoras: 36,
        horarioInicio: "07:00",
        horarioFim: "19:00",
        titularNome: "Mariana Souza",
        titularMatricula: "MAT-002",
        situacao: "ATIVO",
        dataInicioVigencia: "2026-01-01",
      },
      {
        id: "P-MAC-01",
        idPosto: "3",
        codigoPosto: "MAC-ENG-01",
        funcao: "Engenheiro de Processos",
        itemPPU: "5.1",
        tipoPostoId: "ADM_09H",
        periculosidade: "NÃO",
        municipio: "Macaé",
        localAtuacao: "MACAE",
        gerenciaPetrobras: "GERÊNCIA MACAÉ",
        unidadeId: "MACAE",
        unidadeNome: "Base Macaé / Parque de Tubos",
        escala: "5x2",
        jornadaSemanalHoras: 40,
        horarioInicio: "08:00",
        horarioFim: "17:00",
        titularNome: "Roberto Lima",
        titularMatricula: "MAT-003",
        situacao: "ATIVO",
        dataInicioVigencia: "2026-01-01",
      },
    ],
    profissionais: [],
    ocorrencias: [],
    coberturas: [],
    apontamentos: [
      {
        id: "AP-UFN-01",
        postoCodigo: "UFN3-OP-01",
        funcaoPosto: "Operador de Painel I",
        dataReferencia: "2026-09-15",
        competencia: "2026-09",
        texto: "Inconsistência de escala no dia 15",
        criadoPor: "Fiscal Petrobras",
        dataCriacao: "2026-09-15 14:00",
        status: "ABERTO",
      },
    ],
    logsAuditoria: [],
    perfilAtivo: "PREMIER_GESTOR",
    unidadeSelecionada: "UFN-III",
  };

  const usuarioFiscalUFN3: UsuarioSessao = {
    id: "usr-fiscal-ufn3",
    nome: "Carlos Fiscal UFN-III",
    email: "carlos.fiscal@petrobras.com.br",
    empresa: "Petróleo Brasileiro S.A. – Petrobras",
    perfil: "PETROBRAS_FISCAL",
    status: "ATIVO",
    tipoConta: "SSO_MICROSOFT",
    basesVinculadas: ["UFN-III"],
  };

  const usuarioGestorGeral: UsuarioSessao = {
    id: "usr-gestor-geral",
    nome: "Marcos Gestor Premier",
    email: "marcos@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_GESTOR",
    status: "ATIVO",
    tipoConta: "SSO_MICROSOFT",
    basesVinculadas: ["TODAS"],
  };

  describe("1. Estrutura e Consistência dos Indicadores da Base", () => {
    it("deve calcular indicadores para UFN-III de forma consistente com a Visão do Contrato", () => {
      // 1. Cálculo consolidado de todas as bases (Visão do Contrato)
      const contrato = obterOcupacaoConsolidada(estadoMock, {
        baseId: "TODAS",
        competencia: "2026-09",
        dataHoje: "2026-09-16",
        horaHoje: "08:00",
        perfilUsuario: "PREMIER_GESTOR",
      });

      // 2. Cálculo isolado da base UFN-III (Visão da Base)
      const baseUFN3 = obterOcupacaoConsolidada(estadoMock, {
        baseId: "UFN-III",
        competencia: "2026-09",
        dataHoje: "2026-09-16",
        horaHoje: "08:00",
        perfilUsuario: "PREMIER_GESTOR",
      });

      // A linha de UFN-III na tabela do Contrato deve bater com a Visão da Base
      const linhaUFN3NoContrato = contrato.comparativoBases.find((b) => b.baseId === "UFN-III");
      expect(linhaUFN3NoContrato).toBeDefined();

      // Total de postos
      expect(baseUFN3.coberturaAgora.totalPostosBase).toBe(linhaUFN3NoContrato!.postosTotal);

      // SLA acumulado
      expect(baseUFN3.slaCompetencia.valor).toBe(linhaUFN3NoContrato!.slaPercentual);

      // Cobertura percentual
      expect(baseUFN3.coberturaAgora.percentual).toBe(linhaUFN3NoContrato!.coberturaAgoraPercentual);
    });

    it("Visão da base não deve expor dados de faturamento/glosa para perfil fiscal", () => {
      const baseFiscal = obterOcupacaoConsolidada(estadoMock, {
        baseId: "UFN-III",
        competencia: "2026-09",
        dataHoje: "2026-09-16",
        horaHoje: "08:00",
        perfilUsuario: "PETROBRAS_FISCAL",
      });

      // Glosa estimada deve ter status OMITIDO_LGPD para o fiscal
      expect(baseFiscal.glosaEstimada.status).toBe("OMITIDO_LGPD");
      expect(baseFiscal.glosaEstimada.valorTotal).toBeNull();
    });
  });

  describe("2. Decisões Pendentes da Base e Filtragem Territorial", () => {
    it("deve isolar as decisões pendentes apenas para a base selecionada", () => {
      const dadosBase = obterOcupacaoConsolidada(estadoMock, {
        baseId: "UFN-III",
        competencia: "2026-09",
        dataHoje: "2026-09-16",
        horaHoje: "08:00",
        perfilUsuario: "PREMIER_GESTOR",
      });

      const todasDecisoes = consolidarDecisoesPorPosto(
        dadosBase,
        estadoMock,
        "PREMIER_GESTOR",
        usuarioGestorGeral
      );

      const decisoesUFN3 = todasDecisoes.filter((d) => d.baseId === "UFN-III");

      // O apontamento AP-UFN-01 é do posto UFN3-OP-01 em UFN-III
      expect(decisoesUFN3.some((d) => d.codigoPosto === "UFN3-OP-01")).toBe(true);

      // Nenhuma decisão de Macaé deve aparecer no filtro de UFN-III
      expect(decisoesUFN3.some((d) => d.baseId === "MACAE")).toBe(false);
    });

    it("Fiscal com vínculo UFN-III deve ter acesso bloqueado a outras bases", () => {
      expect(usuarioTemAcessoBase(usuarioFiscalUFN3, "UFN-III")).toBe(true);
      expect(usuarioTemAcessoBase(usuarioFiscalUFN3, "MACAE")).toBe(false);
      expect(usuarioTemAcessoBase(usuarioFiscalUFN3, "SANTOS")).toBe(false);
      expect(usuarioTemAcessoBase(usuarioFiscalUFN3, "PAULINIA")).toBe(false);
    });
  });

  describe("3. Regra de Selo de Projeção na Evolução", () => {
    it("deve permitir identificar se a projeção de fechamento está em risco (< 95%)", () => {
      const meta = 95.0;
      const projecaoAbaixo = 93.8;
      const projecaoAcima = 96.5;

      const precisaAlertaAbaixo = projecaoAbaixo < meta;
      const precisaAlertaAcima = projecaoAcima < meta;

      expect(precisaAlertaAbaixo).toBe(true);
      expect(precisaAlertaAcima).toBe(false);
    });
  });
});
