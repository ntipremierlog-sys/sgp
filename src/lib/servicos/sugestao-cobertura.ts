/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Serviço de Sugestão de Cobertura para Posições Descobertas (D)
 *
 * Regra: Quando surgir um D, listar os feristas vinculados àquele posto que não estejam
 * em cobertura ou ausentes no mesmo dia. Apenas sugerir; o registro continua manual.
 */

import {
  carregarEstado,
  EstadoOperacionalCompleto,
  PostoOperacional,
} from "@/lib/dados/estado-operacional";
import { FERISTAS_REV04 } from "@/lib/dados/estrutura-postos";

export interface FeristaSugerido {
  chapa: string;
  nome: string;
  unidade: string;
  funcao?: string;
  papel?: string;
  postoVinculadoId?: string;
  disponivel: boolean;
  motivoIndisponibilidade?: string;
}

/**
 * Retorna todos os feristas que possuem vínculo cadastral com o posto informado
 */
export function obterFeristasVinculadosAoPosto(
  postoId: string,
  estadoCustom?: EstadoOperacionalCompleto
): FeristaSugerido[] {
  const estado = estadoCustom || carregarEstado();
  const mapaFeristas = new Map<string, FeristaSugerido>();

  // Encontra o posto no catálogo operacional para obter todos os seus identificadores
  const posto = estado.postos.find(
    (p) =>
      p.id === postoId ||
      p.idPosto === postoId ||
      p.codigoPosto === postoId ||
      (p as any).postoIdSGP === postoId ||
      String(p.idReferencia) === String(postoId)
  );

  const idsAlvo = new Set<string>();
  if (postoId) idsAlvo.add(postoId.trim().toUpperCase());
  if (posto) {
    if (posto.id) idsAlvo.add(posto.id.trim().toUpperCase());
    if (posto.idPosto) idsAlvo.add(posto.idPosto.trim().toUpperCase());
    if (posto.codigoPosto) idsAlvo.add(posto.codigoPosto.trim().toUpperCase());
    if ((posto as any).postoIdSGP) idsAlvo.add(String((posto as any).postoIdSGP).trim().toUpperCase());
    if (posto.idReferencia !== undefined) idsAlvo.add(String(posto.idReferencia).trim().toUpperCase());
    if ((posto as any).postoBase !== undefined) idsAlvo.add(String((posto as any).postoBase).trim().toUpperCase());
  }

  // 1. Feristas do Catálogo Oficial REV04
  (FERISTAS_REV04 || []).forEach((f) => {
    const fPostoId = (f.postoIdSGP || "").trim().toUpperCase();
    const fPostoBase = f.postoBase !== undefined ? String(f.postoBase).trim().toUpperCase() : "";
    const fIdLuiz = (f.idLuizOriginal || "").trim().toUpperCase();
    const fIdRef = f.idReferenciaPosto !== undefined ? String(f.idReferenciaPosto).trim().toUpperCase() : "";

    const vinculado =
      (fPostoId && idsAlvo.has(fPostoId)) ||
      (fPostoBase && idsAlvo.has(fPostoBase)) ||
      (fIdLuiz && idsAlvo.has(fIdLuiz)) ||
      (fIdRef && idsAlvo.has(fIdRef));

    if (vinculado) {
      const chapa = (f.chapaRM || f.colaborador || "").replace(/\D/g, "").padStart(6, "0");
      if (chapa && chapa !== "000000") {
        mapaFeristas.set(chapa, {
          chapa,
          nome: f.colaborador,
          unidade: f.unidade || posto?.unidadeNome || "Unidade Contratual",
          funcao: f.funcaoRM || f.postoDeServico || posto?.funcao,
          papel: f.papel || "FERISTA",
          postoVinculadoId: f.postoIdSGP || postoId,
          disponivel: true,
        });
      }
    }
  });

  // 2. Profissionais cadastrados com tipoColaborador / statusAlocacao FERISTA ou postosVinculados
  (estado.profissionais || []).forEach((prof) => {
    const chapa = (prof.matricula || prof.chapa || "").replace(/\D/g, "").padStart(6, "0");
    if (!chapa || chapa === "000000") return;

    const ehFerista =
      prof.tipoColaborador === "FERISTA" ||
      prof.tipoColaborador === "RESERVA_TECNICA" ||
      prof.statusAlocacao === "FERISTA" ||
      prof.funcao?.toUpperCase().includes("FERISTA");

    const temVinculo = (prof.postosVinculados || []).some((v) => idsAlvo.has(v.trim().toUpperCase()));

    if (temVinculo || (ehFerista && posto && (prof.unidadeId === posto.unidadeId || prof.unidadeNome === posto.unidadeNome))) {
      if (!mapaFeristas.has(chapa)) {
        mapaFeristas.set(chapa, {
          chapa,
          nome: prof.nome,
          unidade: prof.unidadeNome || prof.unidadeId || posto?.unidadeNome || "Unidade Contratual",
          funcao: prof.funcao,
          papel: prof.tipoColaborador || "FERISTA",
          postoVinculadoId: postoId,
          disponivel: true,
        });
      }
    }
  });

  return Array.from(mapaFeristas.values());
}

/**
 * Retorna os feristas vinculados ao posto que estão DISPONÍVEIS na data especificada
 * Critério: vinculado ao posto E não alocado em cobertura E não ausente no RM na data.
 */
export function obterFeristasSugeridosParaPosicao(
  postoId: string,
  dataStr: string,
  estadoCustom?: EstadoOperacionalCompleto
): FeristaSugerido[] {
  const estado = estadoCustom || carregarEstado();
  const vinculados = obterFeristasVinculadosAoPosto(postoId, estado);

  const coberturas = estado.coberturas || [];
  const ocorrencias = estado.ocorrencias || [];

  return vinculados.filter((ferista) => {
    // 1. Não pode estar em cobertura confirmada no mesmo dia em qualquer posição
    const emCobertura = coberturas.some(
      (c) =>
        c.status === "CONFIRMADA" &&
        c.substitutoMatricula.replace(/\D/g, "").padStart(6, "0") === ferista.chapa &&
        dataStr >= c.dataInicio &&
        dataStr <= c.dataFim
    );

    if (emCobertura) {
      ferista.disponivel = false;
      ferista.motivoIndisponibilidade = "Já alocado em cobertura no mesmo dia";
      return false;
    }

    // 2. Não pode estar ausente no RM (férias, afastamento, licença, falta, etc.)
    const ausenteRM = ocorrencias.some(
      (o) =>
        o.status !== "CANCELADA" &&
        o.matricula.replace(/\D/g, "").padStart(6, "0") === ferista.chapa &&
        dataStr >= o.dataInicio &&
        dataStr <= o.dataFim
    );

    if (ausenteRM) {
      ferista.disponivel = false;
      ferista.motivoIndisponibilidade = "Ausente no RM (férias/afastamento/licença)";
      return false;
    }

    ferista.disponivel = true;
    return true;
  });
}
