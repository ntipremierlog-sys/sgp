/**
 * SGP - Vínculo posição → titular (fonte ÚNICA para Mapa, Painel e Conferência).
 *
 * A tabela `alocacao` do banco guarda apenas o POSTO (posto_id), não a posição. As vagas que o
 * motor calcularStatusVagaDia recebe têm id = posicao_id_sgp (ex.: "POS-EDIHB-033-01"), e o motor
 * procura o ocupante por `alocacao.vagaId === vaga.id`. Antes, a API do estado operacional montava
 * vagaId = `${posto_id_sgp}-01` (ex.: "PST-EDIHB-033-01"), que nunca casava com nenhuma posição.
 *
 * Regra de vínculo (determinística, por posto):
 *  1. Alocação cuja chapa é a chapa_titular de uma posição do posto → essa posição.
 *  2. Alocações restantes → posições do posto SEM chapa_titular na REV04, em ordem de sufixo
 *     (ex.: PST-REPLAN-218, que tem 4 alocações e 4 posições sem chapa na REV04).
 *  3. Posição com chapa_titular da REV04 sem alocação correspondente → titular da própria posição.
 *  4. Alocação sem posição livre no posto → não vinculada (devolvida em `naoVinculadas`).
 * Não altera a ordem dos status do motor; apenas entrega a ele as alocações com o id correto.
 */

export interface PosicaoParaVinculo {
  posicaoIdSgp: string;
  postoId: string; // uuid do posto
  postoIdSgp?: string | null;
  codigoPosto?: string | null;
  sufixo: number;
  chapaTitular?: string | null;
  nomeTitular?: string | null;
  horarioRm?: string | null;
}

export interface AlocacaoParaVinculo {
  id: string;
  postoId: string; // uuid do posto
  postoIdSgp?: string | null;
  codigoPosto?: string | null;
  matricula: string;
  nome: string;
  tipo?: string | null;
  dataInicio: Date | string;
  dataFim?: Date | string | null;
  motivoMovimentacao?: string | null;
  documentoReferencia?: string | null;
}

export type OrigemVinculo = "CHAPA_TITULAR" | "POSICAO_SEM_CHAPA_REV04" | "TITULAR_REV04";

export interface AlocacaoVinculada {
  id: string;
  vagaId: string;
  posicaoIdSGP: string;
  postoIdSGP: string;
  matricula: string;
  identificadorPetrobras: string;
  nome: string;
  tipoAlocacao: string;
  dataInicio: string;
  dataFim: string | null;
  horarioEscalaRm?: string;
  motivo?: string;
  observacoes?: string;
  origemVinculo: OrigemVinculo;
}

const isoData = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
};
const normChapa = (c?: string | null) => (c ? String(c).trim().padStart(6, "0") : "");

/** Data de início usada quando o titular vem apenas da REV04 (sem alocação no banco). */
export const INICIO_TITULAR_REV04 = "2000-01-01";

export function vincularTitularesPosicoes(
  posicoes: PosicaoParaVinculo[],
  alocacoes: AlocacaoParaVinculo[]
): { alocacoes: AlocacaoVinculada[]; naoVinculadas: AlocacaoParaVinculo[] } {
  const posicoesPorPosto = new Map<string, PosicaoParaVinculo[]>();
  for (const p of posicoes) {
    const l = posicoesPorPosto.get(p.postoId) || [];
    l.push(p);
    posicoesPorPosto.set(p.postoId, l);
  }
  posicoesPorPosto.forEach((l) => l.sort((a, b) => a.sufixo - b.sufixo || a.posicaoIdSgp.localeCompare(b.posicaoIdSgp)));

  const alocPorPosto = new Map<string, AlocacaoParaVinculo[]>();
  for (const a of alocacoes) {
    const l = alocPorPosto.get(a.postoId) || [];
    l.push(a);
    alocPorPosto.set(a.postoId, l);
  }

  const saida: AlocacaoVinculada[] = [];
  const naoVinculadas: AlocacaoParaVinculo[] = [];

  const montar = (a: AlocacaoParaVinculo, p: PosicaoParaVinculo, origem: OrigemVinculo): AlocacaoVinculada => ({
    id: a.id,
    vagaId: p.posicaoIdSgp,
    posicaoIdSGP: p.posicaoIdSgp,
    postoIdSGP: p.postoIdSgp || a.postoIdSgp || p.codigoPosto || a.codigoPosto || "",
    matricula: a.matricula,
    identificadorPetrobras: a.matricula,
    nome: a.nome,
    tipoAlocacao: a.tipo === "SUBSTITUTO_FIXO" ? "SUBSTITUTO" : "TITULAR/REGULAR",
    dataInicio: isoData(a.dataInicio) || INICIO_TITULAR_REV04,
    dataFim: isoData(a.dataFim),
    horarioEscalaRm: p.horarioRm || undefined,
    motivo: a.motivoMovimentacao || "titular",
    observacoes: a.documentoReferencia || undefined,
    origemVinculo: origem,
  });

  // Postos com alocação e/ou posição
  const postoIds = new Set<string>([...Array.from(posicoesPorPosto.keys()), ...Array.from(alocPorPosto.keys())]);
  postoIds.forEach((postoId) => {
    const ps = posicoesPorPosto.get(postoId) || [];
    const as = [...(alocPorPosto.get(postoId) || [])].sort(
      (x, y) => (x.tipo === "TITULAR" ? 0 : 1) - (y.tipo === "TITULAR" ? 0 : 1) || String(x.documentoReferencia || x.id).localeCompare(String(y.documentoReferencia || y.id))
    );
    const ocupadas = new Set<string>();
    const restantes: AlocacaoParaVinculo[] = [];

    // 1. Pela chapa titular da posição
    for (const a of as) {
      const p = ps.find((x) => !ocupadas.has(x.posicaoIdSgp) && x.chapaTitular && normChapa(x.chapaTitular) === normChapa(a.matricula));
      if (p) {
        ocupadas.add(p.posicaoIdSgp);
        saida.push(montar(a, p, "CHAPA_TITULAR"));
      } else restantes.push(a);
    }
    // 2. Posições sem chapa na REV04, em ordem de sufixo
    for (const a of restantes) {
      const p = ps.find((x) => !ocupadas.has(x.posicaoIdSgp) && !x.chapaTitular);
      if (p) {
        ocupadas.add(p.posicaoIdSgp);
        saida.push(montar(a, p, "POSICAO_SEM_CHAPA_REV04"));
      } else naoVinculadas.push(a);
    }
    // 3. Titular da REV04 sem alocação no banco
    for (const p of ps) {
      if (ocupadas.has(p.posicaoIdSgp) || !p.chapaTitular) continue;
      saida.push({
        id: `tit-${p.posicaoIdSgp}`,
        vagaId: p.posicaoIdSgp,
        posicaoIdSGP: p.posicaoIdSgp,
        postoIdSGP: p.postoIdSgp || p.codigoPosto || "",
        matricula: p.chapaTitular,
        identificadorPetrobras: p.chapaTitular,
        nome: p.nomeTitular || "Titular",
        tipoAlocacao: "TITULAR/REGULAR",
        dataInicio: INICIO_TITULAR_REV04,
        dataFim: null,
        horarioEscalaRm: p.horarioRm || undefined,
        motivo: "titular",
        origemVinculo: "TITULAR_REV04",
      });
    }
  });

  return { alocacoes: saida, naoVinculadas };
}
