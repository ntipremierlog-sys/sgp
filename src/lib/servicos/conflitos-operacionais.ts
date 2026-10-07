/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Motor de Detecção de Conflitos e Inconsistências Operacionais (Item 4)
 *
 * Conflitos a sinalizar como pendência:
 * 1. O mesmo ferista cobrindo duas posições no mesmo dia/horário (FERISTA_DUPLA_COBERTURA)
 * 2. Cobertura lançada para titular sem ausência no RM (COBERTURA_SEM_AUSENCIA_RM)
 * 3. Titular com ausência no RM em dia marcado como P manualmente (TITULAR_PRESENTE_COM_AUSENCIA_RM)
 */

import {
  carregarEstado,
  EstadoOperacionalCompleto,
  OcorrenciaOperacional,
  CoberturaOperacional,
} from "@/lib/dados/estado-operacional";
import { PendenciaPontoItem } from "@/lib/dados/ponto-tipos";

export type TipoConflitoOperacional =
  | "FERISTA_DUPLA_COBERTURA"
  | "COBERTURA_SEM_AUSENCIA_RM"
  | "TITULAR_PRESENTE_COM_AUSENCIA_RM";

export interface ConflitoOperacional {
  id: string;
  tipo: TipoConflitoOperacional;
  tipoDescricao: string;
  titulo: string;
  descricao: string;
  data: string;
  unidade: string;
  postoId?: string;
  codigoPosto?: string;
  posicaoId?: string;
  colaboradorMatricula?: string;
  colaboradorNome?: string;
  gravidade: "ALTA" | "MEDIA";
  detalhes: {
    feristaMatricula?: string;
    feristaNome?: string;
    postosConflitantes?: string[];
    titularMatricula?: string;
    titularNome?: string;
    categoriaAusencia?: string;
    coberturaId?: string;
    apontamentoId?: string;
  };
}

/**
 * Normaliza datas intermediárias entre dataInicio e dataFim (inclusive)
 */
function gerarDatasPeriodo(dataInicio: string, dataFim: string): string[] {
  const datas: string[] = [];
  const atual = new Date(dataInicio + "T00:00:00");
  const fim = new Date(dataFim + "T00:00:00");

  while (atual <= fim) {
    datas.push(atual.toISOString().slice(0, 10));
    atual.setDate(atual.getDate() + 1);
  }
  return datas;
}

/**
 * Detecta todos os conflitos operacionais ativos no sistema
 */
export function detectarConflitosOperacionais(
  estadoCustom?: EstadoOperacionalCompleto
): ConflitoOperacional[] {
  const estado = estadoCustom || carregarEstado();
  const conflitos: ConflitoOperacional[] = [];

  const coberturasAtivas = (estado.coberturas || []).filter((c) => c.status === "CONFIRMADA");
  const ocorrenciasValidas = (estado.ocorrencias || []).filter((o) => o.status !== "CANCELADA");

  // ===========================================================================
  // 1. O mesmo ferista cobrindo duas posições no mesmo dia/horário
  // ===========================================================================
  const coberturasPorDataSubstituto = new Map<string, CoberturaOperacional[]>();

  coberturasAtivas.forEach((cob) => {
    const datas = gerarDatasPeriodo(cob.dataInicio, cob.dataFim);
    const subMat = cob.substitutoMatricula.replace(/\D/g, "").padStart(6, "0");

    datas.forEach((dt) => {
      const chave = `${dt}_${subMat}`;
      const lista = coberturasPorDataSubstituto.get(chave) || [];
      lista.push(cob);
      coberturasPorDataSubstituto.set(chave, lista);
    });
  });

  coberturasPorDataSubstituto.forEach((listaCobs, chave) => {
    if (listaCobs.length > 1) {
      // Verifica se as posições ou postos são distintos
      const postosDistintos = new Set(
        listaCobs.map((c) => c.vagaId || c.postoCodigo || c.idPosto || c.id)
      );

      if (postosDistintos.size > 1) {
        const [dataStr, subMat] = chave.split("_");
        const ferista = listaCobs[0];
        const postosNomes = Array.from(postosDistintos);

        conflitos.push({
          id: `conf-dupla-cob-${subMat}-${dataStr}`,
          tipo: "FERISTA_DUPLA_COBERTURA",
          tipoDescricao: "Dupla Cobertura pelo Mesmo Ferista",
          titulo: "Ferista cobrindo múltiplas posições no mesmo dia",
          descricao: `O ferista ${ferista.substitutoNome} (${subMat}) possui ${listaCobs.length} coberturas ativas na mesma data (${dataStr}) para os postos/posições: ${postosNomes.join(", ")}.`,
          data: dataStr,
          unidade: ferista.postoCodigo || "Unidade Contratual",
          colaboradorMatricula: subMat,
          colaboradorNome: ferista.substitutoNome,
          gravidade: "ALTA",
          detalhes: {
            feristaMatricula: subMat,
            feristaNome: ferista.substitutoNome,
            postosConflitantes: postosNomes,
            coberturaId: ferista.id,
          },
        });
      }
    }
  });

  // ===========================================================================
  // 2. Cobertura lançada para titular sem ausência no RM
  // ===========================================================================
  coberturasAtivas.forEach((cob) => {
    if (!cob.titularMatricula) return;
    const titMat = cob.titularMatricula.replace(/\D/g, "").padStart(6, "0");
    const datas = gerarDatasPeriodo(cob.dataInicio, cob.dataFim);

    datas.forEach((dt) => {
      const temAusenciaRM = ocorrenciasValidas.some((o) => {
        const oMat = o.matricula.replace(/\D/g, "").padStart(6, "0");
        return oMat === titMat && dt >= o.dataInicio && dt <= o.dataFim;
      });

      if (!temAusenciaRM) {
        conflitos.push({
          id: `conf-cob-sem-ausencia-${cob.id}-${dt}`,
          tipo: "COBERTURA_SEM_AUSENCIA_RM",
          tipoDescricao: "Cobertura Sem Ausência no RM",
          titulo: "Cobertura lançada para titular sem ausência no RM",
          descricao: `Existe cobertura ativa para o titular ${cob.titularNome || "Titular"} (${titMat}) na data ${dt} no posto ${cob.postoCodigo}, mas não há registro de ausência, férias ou abono no RM para este colaborador.`,
          data: dt,
          unidade: cob.postoCodigo || "Unidade Contratual",
          postoId: cob.idPosto || cob.postoCodigo,
          codigoPosto: cob.postoCodigo,
          colaboradorMatricula: titMat,
          colaboradorNome: cob.titularNome,
          gravidade: "MEDIA",
          detalhes: {
            titularMatricula: titMat,
            titularNome: cob.titularNome,
            feristaMatricula: cob.substitutoMatricula,
            feristaNome: cob.substitutoNome,
            coberturaId: cob.id,
          },
        });
      }
    });
  });

  // ===========================================================================
  // 3. Titular com ausência no RM em dia marcado como P manualmente
  // ===========================================================================
  // Verifica apontamentos e marcações manuais onde foi assinalado P (Presença)
  (estado.apontamentos || []).forEach((apto) => {
    const textoApto = (apto.texto || "").toUpperCase();
    const ehMarcacaoPManual =
      textoApto.includes("PRESENÇA") ||
      textoApto.includes("PRESENTE") ||
      textoApto.includes("MARCADO COMO P") ||
      (apto as any).tipoAjuste === "PRESENCA" ||
      (apto as any).ajusteManual === "P";

    if (ehMarcacaoPManual && apto.dataReferencia) {
      // Localiza o posto do apontamento para obter o titular
      const posto = estado.postos.find(
        (p) => p.codigoPosto === apto.postoCodigo || p.idPosto === apto.idPosto || p.id === apto.idPosto
      );
      const titularMat = (posto?.titularMatricula || (apto as any).titularMatricula || "").replace(/\D/g, "").padStart(6, "0");

      if (titularMat && titularMat !== "000000") {
        const ausenciaRM = ocorrenciasValidas.find((o) => {
          const oMat = o.matricula.replace(/\D/g, "").padStart(6, "0");
          return oMat === titularMat && apto.dataReferencia >= o.dataInicio && apto.dataReferencia <= o.dataFim;
        });

        if (ausenciaRM) {
          const cat = ausenciaRM.categoriaAusencia || "Ausência";
          conflitos.push({
            id: `conf-titular-p-com-ausencia-${titularMat}-${apto.dataReferencia}`,
            tipo: "TITULAR_PRESENTE_COM_AUSENCIA_RM",
            tipoDescricao: "Titular Presente com Ausência no RM",
            titulo: "Titular com ausência no RM em dia marcado como P manualmente",
            descricao: `O titular ${posto?.titularNome || "Titular"} (${titularMat}) possui ausência registrada no RM (${cat}) na data ${apto.dataReferencia}, mas há registro manual marcando a jornada como Presente (P).`,
            data: apto.dataReferencia,
            unidade: posto?.unidadeNome || posto?.baseOperacional || "Unidade Contratual",
            postoId: posto?.idPosto || posto?.id,
            codigoPosto: posto?.codigoPosto,
            colaboradorMatricula: titularMat,
            colaboradorNome: posto?.titularNome,
            gravidade: "ALTA",
            detalhes: {
              titularMatricula: titularMat,
              titularNome: posto?.titularNome,
              categoriaAusencia: cat,
              apontamentoId: apto.id,
            },
          });
        }
      }
    }
  });

  return conflitos;
}

/**
 * Converte os conflitos operacionais em itens de Pendência para exibição
 * unificada no painel de pendências e gestão
 */
export function sincronizarConflitosComoPendencias(
  estadoCustom?: EstadoOperacionalCompleto
): PendenciaPontoItem[] {
  const estado = estadoCustom || carregarEstado();
  const conflitos = detectarConflitosOperacionais(estado);

  return conflitos.map((c) => ({
    id: c.id,
    tipo: c.tipo as any,
    chapa: c.colaboradorMatricula,
    nome: c.colaboradorNome,
    baseId: c.unidade,
    dataReferencia: c.data,
    detalhes: c.descricao,
    status: "ABERTA" as const,
    atualizadoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
    atualizadoPor: "Motor de Regras SGP",
  }));
}
