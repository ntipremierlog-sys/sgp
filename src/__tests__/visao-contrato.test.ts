import { describe, it, expect } from "vitest";
import {
  consolidarDecisoesPendentes,
  calcularFarolBase,
  ordenarBasesPorFarol,
  LinhaBaseContrato,
} from "@/lib/servicos/decisoes-consolidadas";
import { EstadoOperacionalCompleto } from "@/lib/dados/estado-operacional";
import { usuarioTemAcessoBase } from "@/lib/auth/permissoes";
import { UsuarioSessao } from "@/lib/auth/tipos";

describe("Visão do Contrato - Motor de Decisões e Farol das Bases (MOMENTO 2)", () => {
  const estadoMock: any = {
    postos: [
      {
        id: "P-01",
        codigo: "UFN3-TEC-01",
        nome: "Técnico de Operação I",
        base: "UFN-III",
        funcao: "Técnico de Operação",
        escala: "12x36",
        anexo: "1-A",
        criticidade: "CRITICO",
        coberturaObrigatoria: true,
      },
      {
        id: "P-02",
        codigo: "UFN3-ENG-02",
        nome: "Engenheiro de Segurança",
        base: "UFN-III",
        funcao: "Engenheiro",
        escala: "5x2",
        anexo: "1-A",
        criticidade: "MEDIA",
        coberturaObrigatoria: false,
      },
      {
        id: "P-03",
        codigo: "MAC-ADM-01",
        nome: "Assistente Administrativo",
        base: "MACAE",
        funcao: "Administrativo",
        escala: "5x2",
        anexo: "1-A",
        criticidade: "BAIXA",
        coberturaObrigatoria: false,
      },
    ],
    profissionais: [],
    alocacoes: [],
    escalas: [
      {
        id: "ESC-01",
        postoId: "P-01",
        profissionalId: "PRO-01",
        data: "2026-09-16",
        turno: "TURNO_A",
        horarioPrevisto: "07:00-19:00",
      },
    ],
    registrosPonto: [], // Sem registro => falta não coberta no turno atual
    ocorrencias: [],
    apontamentos: [
      {
        id: "AP-01",
        postoId: "P-01", // Mesmo posto P-01!
        tipo: "DOCUMENTACAO_VENCIDA",
        descricao: "Certificado de NR-10 vencido do titular",
        base: "UFN-III",
        dataCriacao: "2026-09-10",
        prazoResposta: "2026-09-14", // Vencido!
        status: "ABERTO",
        criticidade: "ALTA",
        impactaFaturamento: true,
      },
      {
        id: "AP-02",
        postoId: "P-02",
        tipo: "POSTO_DESCOBERTO",
        descricao: "Ausência sem substituto na quarta-feira",
        base: "UFN-III",
        dataCriacao: "2026-09-15",
        prazoResposta: "2026-09-16", // Vence hoje!
        status: "ABERTO",
        criticidade: "MEDIA",
        impactaFaturamento: false,
      },
      {
        id: "AP-03",
        postoId: "P-03",
        tipo: "POSTO_DESCOBERTO",
        descricao: "Aguardando documentação complementar",
        base: "MACAE",
        dataCriacao: "2026-09-15",
        prazoResposta: "2026-09-25", // Vence em 9 dias
        status: "ABERTO",
        criticidade: "BAIXA",
        impactaFaturamento: false,
      },
    ],
    competencias: [],
    frescorDados: {
      pontoRhidAte: "2026-09-16 08:00",
      rmAte: "2026-09-15 18:00",
      anexo1aVersao: "v2.4",
      ultimaSincronizacao: "2026-09-16 08:05",
    },
    parametros: {} as any,
  };

  describe("1. Consolidação de Decisões Pendentes", () => {
    it("deve agrupar múltiplos problemas do mesmo posto em 1 único card", () => {
      const decisoes = consolidarDecisoesPendentes(estadoMock, "2026-09-16");

      // P-01 tem:
      // 1. Falta sem cobertura no turno atual (da escala sem ponto)
      // 2. Apontamento AP-01 com NR-10 vencida
      const decisaoP01 = decisoes.find((d) => d.postoId === "P-01");
      expect(decisaoP01).toBeDefined();

      // Ambas as pendências devem estar agrupadas sob o mesmo item
      expect(decisaoP01!.pendencias.length).toBeGreaterThanOrEqual(2);
      expect(decisaoP01!.postoCodigo).toBe("UFN3-TEC-01");
      expect(decisaoP01!.postoNome).toBe("Técnico de Operação I");
    });

    it("deve priorizar categoria mais grave: Vencido precede Urgente turno atual, que precede Vence hoje", () => {
      const decisoes = consolidarDecisoesPendentes(estadoMock, "2026-09-16");

      expect(decisoes.length).toBeGreaterThanOrEqual(3);

      // P-01 tem apontamento vencido (2026-09-14 < 2026-09-16), então deve ser VENCIDO
      const p01 = decisoes.find((d) => d.postoId === "P-01");
      expect(p01?.categoria).toBe("VENCIDO");

      // P-02 tem prazo para hoje (2026-09-16)
      const p02 = decisoes.find((d) => d.postoId === "P-02");
      expect(p02?.categoria).toBe("VENCE_HOJE");

      // P-03 tem prazo para 2026-09-25 (em 9 dias)
      const p03 = decisoes.find((d) => d.postoId === "P-03");
      expect(p03?.categoria).toBe("NO_PRAZO");

      // O primeiro da lista ordenada deve ser o VENCIDO
      expect(decisoes[0].categoria).toBe("VENCIDO");
    });

    it("deve filtrar decisões por base se especificado", () => {
      const decisoesMacae = consolidarDecisoesPendentes(estadoMock, "2026-09-16", "MACAE");
      expect(decisoesMacae.every((d) => d.base === "MACAE")).toBe(true);
      expect(decisoesMacae.some((d) => d.postoId === "P-03")).toBe(true);
      expect(decisoesMacae.some((d) => d.postoId === "P-01")).toBe(false);
    });
  });

  describe("2. Farol e Alertas das Bases do Contrato", () => {
    it("deve classificar como VERMELHO quando SLA está abaixo da meta contratual (95%)", () => {
      const farol = calcularFarolBase({
        slaAtual: 94.2,
        postosVagosSemCobertura: 0,
        pendenciasVencidas: 0,
        pendenciasPrazoCurto: 0,
        slaProjetado: 96.0,
      });

      expect(farol.cor).toBe("VERMELHO");
      expect(farol.motivo).toContain("SLA abaixo da meta");
    });

    it("deve classificar como VERMELHO quando há postos vagos sem cobertura", () => {
      const farol = calcularFarolBase({
        slaAtual: 98.0,
        postosVagosSemCobertura: 2,
        pendenciasVencidas: 0,
        pendenciasPrazoCurto: 0,
        slaProjetado: 98.0,
      });

      expect(farol.cor).toBe("VERMELHO");
      expect(farol.motivo).toContain("postos vagos sem cobertura");
    });

    it("deve classificar como VERMELHO quando há pendência vencida", () => {
      const farol = calcularFarolBase({
        slaAtual: 98.0,
        postosVagosSemCobertura: 0,
        pendenciasVencidas: 1,
        pendenciasPrazoCurto: 0,
        slaProjetado: 98.0,
      });

      expect(farol.cor).toBe("VERMELHO");
      expect(farol.motivo).toContain("pendência(s) vencida(s)");
    });

    it("deve classificar como LARANJA quando pendência vence em até 3 dias ou projeção < 95%", () => {
      const farolPrazoCurto = calcularFarolBase({
        slaAtual: 97.0,
        postosVagosSemCobertura: 0,
        pendenciasVencidas: 0,
        pendenciasPrazoCurto: 2,
        slaProjetado: 97.0,
      });
      expect(farolPrazoCurto.cor).toBe("LARANJA");

      const farolProjecaoBaixa = calcularFarolBase({
        slaAtual: 96.0,
        postosVagosSemCobertura: 0,
        pendenciasVencidas: 0,
        pendenciasPrazoCurto: 0,
        slaProjetado: 93.5,
      });
      expect(farolProjecaoBaixa.cor).toBe("LARANJA");
    });

    it("deve classificar como VERDE quando SLA >= meta, sem vagas descobertas e sem pendências críticas", () => {
      const farolVerde = calcularFarolBase({
        slaAtual: 97.5,
        postosVagosSemCobertura: 0,
        pendenciasVencidas: 0,
        pendenciasPrazoCurto: 0,
        slaProjetado: 97.8,
      });

      expect(farolVerde.cor).toBe("VERDE");
      expect(farolVerde.motivo).toBe("Operação em conformidade com o contrato");
    });
  });

  describe("3. Ordenação das Bases na Tabela", () => {
    it("deve ordenar: Vermelho primeiro, depois Laranja, depois Verde, e pior SLA primeiro", () => {
      const bases: LinhaBaseContrato[] = [
        {
          id: "BASE-A",
          nome: "Base Verde A",
          municipioUf: "Santos/SP",
          postosPrevistos: 10,
          postosOcupados: 10,
          postosVagosSemCobertura: 0,
          slaAtual: 98.5,
          slaProjetado: 99.0,
          historicoSla: [],
          statusOperacional: "VERDE",
          motivoStatus: "OK",
          decisoesPendentesCount: 0,
        },
        {
          id: "BASE-B",
          nome: "Base Vermelha Baixa",
          municipioUf: "Paulínia/SP",
          postosPrevistos: 10,
          postosOcupados: 8,
          postosVagosSemCobertura: 2,
          slaAtual: 89.0,
          slaProjetado: 91.0,
          historicoSla: [],
          statusOperacional: "VERMELHO",
          motivoStatus: "Crítico",
          decisoesPendentesCount: 2,
        },
        {
          id: "BASE-C",
          nome: "Base Vermelha Menos Baixa",
          municipioUf: "Macaé/RJ",
          postosPrevistos: 10,
          postosOcupados: 9,
          postosVagosSemCobertura: 1,
          slaAtual: 93.0,
          slaProjetado: 94.0,
          historicoSla: [],
          statusOperacional: "VERMELHO",
          motivoStatus: "Crítico",
          decisoesPendentesCount: 1,
        },
        {
          id: "BASE-D",
          nome: "Base Laranja",
          municipioUf: "Três Lagoas/MS",
          postosPrevistos: 10,
          postosOcupados: 10,
          postosVagosSemCobertura: 0,
          slaAtual: 96.0,
          slaProjetado: 94.0,
          historicoSla: [],
          statusOperacional: "LARANJA",
          motivoStatus: "Alerta projeção",
          decisoesPendentesCount: 1,
        },
      ];

      const ordenadas = ordenarBasesPorFarol(bases);

      // 1º e 2º devem ser VERMELHO, com 89.0 antes de 93.0
      expect(ordenadas[0].id).toBe("BASE-B");
      expect(ordenadas[1].id).toBe("BASE-C");

      // 3º deve ser LARANJA
      expect(ordenadas[2].id).toBe("BASE-D");

      // 4º deve ser VERDE
      expect(ordenadas[3].id).toBe("BASE-A");
    });
  });

  describe("4. Restrição de Acesso às Bases por Perfil", () => {
    const fiscalUFN3: UsuarioSessao = {
      id: "usr-fiscal",
      nome: "Fiscal Petrobras UFN-III",
      email: "fiscal@petrobras.com.br",
      empresa: "Petróleo Brasileiro S.A. – Petrobras",
      perfil: "PETROBRAS_FISCAL",
      status: "ATIVO",
      tipoConta: "SSO_MICROSOFT",
      basesVinculadas: ["UFN-III"],
    };

    const gestorPremier: UsuarioSessao = {
      id: "usr-gestor",
      nome: "Gestor Premier Geral",
      email: "gestor@premierlogistics.com.br",
      empresa: "Premier Logistics",
      perfil: "PREMIER_GESTOR",
      status: "ATIVO",
      tipoConta: "SSO_MICROSOFT",
      basesVinculadas: ["TODAS"],
    };

    it("Fiscal com UFN-III deve ter acesso apenas a UFN-III", () => {
      expect(usuarioTemAcessoBase(fiscalUFN3, "UFN-III")).toBe(true);
      expect(usuarioTemAcessoBase(fiscalUFN3, "MACAE")).toBe(false);
      expect(usuarioTemAcessoBase(fiscalUFN3, "SANTOS")).toBe(false);
    });

    it("Gestor com TODAS deve ter acesso a qualquer base", () => {
      expect(usuarioTemAcessoBase(gestorPremier, "UFN-III")).toBe(true);
      expect(usuarioTemAcessoBase(gestorPremier, "MACAE")).toBe(true);
      expect(usuarioTemAcessoBase(gestorPremier, "PAULINIA")).toBe(true);
    });
  });
});
