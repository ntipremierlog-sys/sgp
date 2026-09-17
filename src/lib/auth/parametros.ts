import { ParametrosContrato } from "./tipos";

const CHAVE_STORAGE_PARAMETROS = "sgp_parametros_contrato_v1";

// Estado inicial: parâmetros pendentes de cadastro inicial conforme exigido pela especificação
const PARAMETROS_PADRAO: ParametrosContrato = {
  id: "param-contrato-icj",
  contratoNumero: "5900.0129796.25.2",
  fatorGlosa: null, // PENDENTE inicial
  prazoFechamento: null, // PENDENTE inicial
  metaSla: 95.0,
  atualizadoEm: "2026-09-01T08:00:00.000Z",
  atualizadoPor: "TI Corporativa Premier",
};

let parametrosMemoria: ParametrosContrato = { ...PARAMETROS_PADRAO };

export function obterParametrosContrato(): ParametrosContrato {
  if (typeof window !== "undefined") {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE_PARAMETROS);
      if (salvo) {
        parametrosMemoria = { ...parametrosMemoria, ...JSON.parse(salvo) };
      }
    } catch {
      // fallback para memória
    }
  }
  return parametrosMemoria;
}

export function salvarParametrosContrato(
  novos: Partial<Omit<ParametrosContrato, "id" | "contratoNumero">>,
  usuarioResponsavel: string = "Administrador Premier"
): ParametrosContrato {
  parametrosMemoria = {
    ...parametrosMemoria,
    ...novos,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: usuarioResponsavel,
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHAVE_STORAGE_PARAMETROS, JSON.stringify(parametrosMemoria));
      window.dispatchEvent(new CustomEvent("sgp-parametros-atualizados", { detail: parametrosMemoria }));
    } catch {
      // ignora falha de storage
    }
  }

  return parametrosMemoria;
}

/**
 * Retorna os itens de configuração pendentes no sistema
 */
export function listarConfiguracoesPendentes(params: ParametrosContrato = obterParametrosContrato()) {
  const pendencias: { id: string; titulo: string; descricao: string; campo: "fatorGlosa" | "prazoFechamento" }[] = [];

  if (params.fatorGlosa === null || params.fatorGlosa === undefined) {
    pendencias.push({
      id: "pendencia-glosa",
      titulo: "Parâmetro de glosa",
      descricao: "O multiplicador financeiro de glosa contratual para ausências não justificadas ainda não foi cadastrado.",
      campo: "fatorGlosa",
    });
  }

  if (!params.prazoFechamento || params.prazoFechamento.trim() === "") {
    pendencias.push({
      id: "pendencia-prazo-fechamento",
      titulo: "Prazo de fechamento da medição",
      descricao: "A data-limite ou regra de fechamento da medição mensal com a Petrobras não foi configurada.",
      campo: "prazoFechamento",
    });
  }

  return pendencias;
}

export function temConfiguracaoPendente(params?: ParametrosContrato): boolean {
  return listarConfiguracoesPendentes(params).length > 0;
}
