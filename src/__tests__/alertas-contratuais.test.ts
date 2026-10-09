import { describe, it, expect } from "vitest";
import {
  calcularAlertasContratuais,
  filtrarAlertasVisiveis,
  feriasSemConsulta,
  substituicoesVencendo,
  mobilizacoesNoPrazo,
  admissoesAguardandoAlocacao,
  prepostosAcimaDoLimite,
  somarDiasUteis,
  diasUteisEntre,
  contarPrepostos,
  AusenciaParaAlerta,
} from "@/lib/servicos/alertas-contratuais";
import imoveisRev04 from "@/lib/dados/imoveis-rev04.json";
import posicoesRev04 from "@/lib/dados/posicoes-rev04.json";
import feristasRev04 from "@/lib/dados/feristas-rev04.json";

const HOJE = "2026-10-08"; // quinta-feira

function porTipo(alertas: ReturnType<typeof calcularAlertasContratuais>) {
  return Object.fromEntries(alertas.map((a) => [a.tipo, a]));
}

describe("Etapa 5 — Alertas contratuais do Painel", () => {
  // ===========================================================================
  // CRITÉRIOS DE ACEITE COM A REV04
  // ===========================================================================
  describe("Critérios de aceite (REV04)", () => {
    const alertas = porTipo(calcularAlertasContratuais({ hoje: HOJE }));

    it("11 admissões aguardando alocação", () => {
      expect(alertas["admissoes-a-alocar"].quantidade).toBe(11);
      expect(alertas["admissoes-a-alocar"].cor).toBe("AMBAR");
    });

    it("101 posições com escala sem fase/data-base", () => {
      expect(alertas["escala-sem-fase"].quantidade).toBe(101);
      expect(alertas["escala-sem-fase"].cor).toBe("AMBAR");
    });

    it("28 validações MC × RM pendentes", () => {
      expect(alertas["validacoes-mc-rm"].quantidade).toBe(28);
      expect(alertas["validacoes-mc-rm"].cor).toBe("AMBAR");
    });

    it("cada alerta leva à lista filtrada correspondente", () => {
      for (const a of Object.values(alertas)) {
        expect(a.href).toBe(`/alertas?tipo=${a.tipo}`);
        expect(a.itens).toHaveLength(a.quantidade);
      }
    });

    it("exibe somente alertas com quantidade > 0", () => {
      const visiveis = filtrarAlertasVisiveis(Object.values(alertas));
      expect(visiveis.every((a) => a.quantidade > 0)).toBe(true);
      // Sem ausências informadas e todos os imóveis ATIVOS → alertas 1, 2 e 3 ocultos
      const tipos = visiveis.map((a) => a.tipo);
      expect(tipos).not.toContain("ferias-sem-consulta");
      expect(tipos).not.toContain("substituicao-vencendo");
      expect(tipos).not.toContain("mobilizacao");
    });

    it("nenhum CPF ou CID aparece nos alertas", () => {
      const json = JSON.stringify(Object.values(alertas));
      expect(json).not.toMatch(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
      expect(json).not.toMatch(/\bcpf\b/i);
      expect(json).not.toMatch(/\bcid\b/i);
    });
  });

  // ===========================================================================
  // 1. FÉRIAS SEM CONSULTA (ET 9.4.1)
  // ===========================================================================
  describe("1. Férias sem consulta à Petrobras", () => {
    const base: AusenciaParaAlerta = {
      id: "F1",
      matricula: "036475",
      profissionalNome: "IZAC NEVES DOS SANTOS",
      tipoOcorrencia: "FERIAS",
      dataInicio: "2026-11-10",
      dataFim: "2026-12-09",
      status: "VALIDADA",
    };

    it("alerta férias a menos de 60 dias sem data de consulta (prazo vencido = vermelho)", () => {
      const itens = feriasSemConsulta([base], HOJE);
      expect(itens).toHaveLength(1);
      expect(itens[0].situacao).toBe("VENCIDO");
      expect(itens[0].detalhe).toContain("sem substituição aprovada");
      const alerta = porTipo(calcularAlertasContratuais({ hoje: HOJE, ausencias: [base] }))["ferias-sem-consulta"];
      expect(alerta.cor).toBe("VERMELHO");
    });

    it("não alerta quando a consulta foi registrada", () => {
      expect(feriasSemConsulta([{ ...base, data_consulta_petrobras: "2026-09-01" }], HOJE)).toHaveLength(0);
    });

    it("não alerta férias com 60 dias ou mais de antecedência, nem já iniciadas", () => {
      expect(feriasSemConsulta([{ ...base, dataInicio: "2026-12-07" }], HOJE)).toHaveLength(0);
      expect(feriasSemConsulta([{ ...base, dataInicio: "2026-10-01" }], HOJE)).toHaveLength(0);
    });

    it("ignora ausências canceladas e que não são férias", () => {
      expect(feriasSemConsulta([{ ...base, status: "CANCELADA" }], HOJE)).toHaveLength(0);
      expect(feriasSemConsulta([{ ...base, tipoOcorrencia: "TREINAMENTO" }], HOJE)).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 2. SUBSTITUIÇÃO VENCENDO (ET 9.4.2)
  // ===========================================================================
  describe("2. Substituição vencendo (7 dias úteis)", () => {
    const afast: AusenciaParaAlerta = {
      id: "A1",
      matricula: "042009",
      profissionalNome: "DANIEL DOS SANTOS SILVA",
      tipoOcorrencia: "OUTROS",
      categoriaAusencia: "Licença",
      dataInicio: "2026-09-28",
      dataFim: "2026-12-31",
      status: "VALIDADA",
    };

    it("conta 7 dias úteis pulando fim de semana e feriado", () => {
      // 28/09 (seg) + 7 úteis = 07/10 (qua)
      expect(somarDiasUteis("2026-09-28", 7)).toBe("2026-10-07");
      // Com 12/10 feriado: 06/10 (ter) + 7 úteis = 16/10
      expect(somarDiasUteis("2026-10-06", 7, ["2026-10-12"])).toBe("2026-10-16");
      expect(diasUteisEntre("2026-10-08", "2026-10-07")).toBe(-1);
    });

    it("prazo vencido sem substituto → VENCIDO (vermelho)", () => {
      const itens = substituicoesVencendo([afast], HOJE);
      expect(itens).toHaveLength(1);
      expect(itens[0].situacao).toBe("VENCIDO");
      expect(itens[0].prazo).toBe("2026-10-07");
      expect(porTipo(calcularAlertasContratuais({ hoje: HOJE, ausencias: [afast] }))["substituicao-vencendo"].cor).toBe(
        "VERMELHO"
      );
    });

    it("prazo vencendo (até 2 dias úteis) → A_VENCER (âmbar)", () => {
      // 01/10 (qui) + 7 úteis = 12/10 (seg); de 08/10 restam 2 úteis
      const itens = substituicoesVencendo([{ ...afast, dataInicio: "2026-10-01" }], HOJE);
      expect(itens).toHaveLength(1);
      expect(itens[0].situacao).toBe("A_VENCER");
      expect(itens[0].diasParaPrazo).toBe(2);
    });

    it("não alerta quando há substituto ou substituição aprovada", () => {
      expect(substituicoesVencendo([{ ...afast, substituto_chapa: "045858" }], HOJE)).toHaveLength(0);
      expect(substituicoesVencendo([{ ...afast, substituicao_aprovada: true }], HOJE)).toHaveLength(0);
    });

    it("não alerta prazo folgado, afastamento encerrado ou falta pontual", () => {
      expect(substituicoesVencendo([{ ...afast, dataInicio: "2026-10-07" }], HOJE)).toHaveLength(0);
      expect(substituicoesVencendo([{ ...afast, dataFim: "2026-10-01" }], HOJE)).toHaveLength(0);
      expect(substituicoesVencendo([{ ...afast, categoriaAusencia: "Falta" }], HOJE)).toHaveLength(0);
    });

    it("desligamento também exige substituição", () => {
      expect(substituicoesVencendo([{ ...afast, categoriaAusencia: "Desligamento" }], HOJE)).toHaveLength(1);
    });
  });

  // ===========================================================================
  // 3. MOBILIZAÇÃO / DESMOBILIZAÇÃO (ET 9.2 e 9.3)
  // ===========================================================================
  describe("3. Mobilização/desmobilização", () => {
    it("usa prazo_limite ou data_comunicacao + 30 dias; alerta até 7 dias ou vencido", () => {
      const itens = mobilizacoesNoPrazo(
        [
          { nome: "A", status_imovel: "EM_MOBILIZACAO", prazo_limite: "2026-10-12" }, // a vencer (4 dias)
          { nome: "B", status_imovel: "DESMOBILIZADO", data_comunicacao_petrobras: "2026-09-01" }, // prazo 01/10 vencido
          { nome: "C", status_imovel: "EM_MOBILIZACAO", prazo_limite: "2026-10-30" }, // folgado
          { nome: "D", status_imovel: "ATIVO", prazo_limite: "2026-10-09" }, // não se aplica
        ],
        HOJE
      );
      expect(itens.map((i) => i.titulo)).toEqual(["B", "A"]);
      expect(itens[0].situacao).toBe("VENCIDO");
      expect(itens[0].prazo).toBe("2026-10-01");
      expect(itens[1].situacao).toBe("A_VENCER");
    });

    it("REV04 sem imóveis em mobilização → alerta oculto", () => {
      expect(mobilizacoesNoPrazo(imoveisRev04 as any[], HOJE)).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 4. ADMISSÕES A ALOCAR
  // ===========================================================================
  describe("4. Admissões aguardando alocação", () => {
    it("soma 04_PENDENTES_RM com a lista 'A alocar' sem duplicar a mesma pessoa", () => {
      const pendentes = [{ chapa: "046819", nome: "EDUARDO DIAS DE OLIVEIRA", alocarNoSGP: "A VALIDAR" }];
      const aAlocar = [
        { identificador: "046819", colaborador: "Eduardo Dias de Oliveira" }, // duplicado
        { identificador: "999001", colaborador: "NOVA PESSOA DA MC" },
      ];
      const itens = admissoesAguardandoAlocacao(pendentes, aAlocar, []);
      expect(itens).toHaveLength(2);
    });

    it("pessoa que já é titular de posição deixa de aparecer", () => {
      const pendentes = [{ chapa: "037196", nome: "CARLOS AUGUSTO VIEIRA DA SILVA NETO" }];
      expect(admissoesAguardandoAlocacao(pendentes, [], posicoesRev04 as any[])).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 7. PREPOSTO (ET 11.1.1)
  // ===========================================================================
  describe("7. Preposto acima de 20 profissionais", () => {
    it("divide a carga quando o imóvel tem mais de um preposto", () => {
      expect(contarPrepostos("Juliana dos Santos Bezerra e Daniela Wood")).toBe(2);
      expect(contarPrepostos("Kleydson Alves da Silva")).toBe(1);
    });

    it("lista os grupos acima do limite como informativo (roxo)", () => {
      const itens = prepostosAcimaDoLimite(imoveisRev04 as any[], posicoesRev04 as any[], feristasRev04 as any[]);
      expect(itens.length).toBeGreaterThan(0);
      expect(itens.every((i) => i.situacao === "INFORMATIVO")).toBe(true);
      const edihb = itens.find((i) => i.unidade === "EDIHB");
      expect(edihb?.detalhe).toContain("2 prepostos");
      const alerta = porTipo(calcularAlertasContratuais({ hoje: HOJE }))["preposto-acima-limite"];
      expect(alerta.cor).toBe("ROXO");
    });
  });
});
