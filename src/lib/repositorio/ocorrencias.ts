/**
 * SGP — Sistema de Gestão de Postos
 * Repositório: Ocorrências de Ausência (Férias, Afastamentos, Atestados e Faltas)
 *
 * Regras estritas:
 * - LGPD: para o perfil PETROBRAS_FISCAL, a restrição de dados de saúde (CID, diagnóstico, médico, CRM)
 *   é aplicada no servidor (o dado sensível NUNCA é enviado ao navegador).
 * - Bloqueio de competência congelada no servidor.
 * - Auditoria: grava criado_por e atualizado_por a partir da sessão.
 */

import prisma from "@/lib/prisma";
import { garantirPeriodoNaoCongelado } from "./validacoes";
import { StatusOcorrencia, OrigemRegistro } from "@prisma/client";

export interface FiltrosOcorrencias {
  imovelId?: string;
  imovelNome?: string;
  postoCodigo?: string;
  postoIdSgp?: string;
  matricula?: string;
  periodoInicio?: string;
  periodoFim?: string;
  perfilUsuario?: string;
}

export async function obterOcorrencias(filtros?: FiltrosOcorrencias) {
  const where: any = {
    deletedAt: null,
  };

  if (filtros?.imovelId) where.posto = { ...where.posto, imovelId: filtros.imovelId };
  if (filtros?.imovelNome) {
    where.posto = {
      ...where.posto,
      imovel: { nome: filtros.imovelNome },
    };
  }
  if (filtros?.postoCodigo) where.posto = { ...where.posto, codigoPosto: filtros.postoCodigo };
  if (filtros?.postoIdSgp) where.posto = { ...where.posto, postoIdSgp: filtros.postoIdSgp };
  if (filtros?.matricula) where.profissional = { matricula: filtros.matricula };

  if (filtros?.periodoInicio && filtros?.periodoFim) {
    const dtIni = new Date(filtros.periodoInicio + "T00:00:00.000Z");
    const dtFim = new Date(filtros.periodoFim + "T23:59:59.999Z");
    where.AND = [
      { dataInicio: { lte: dtFim } },
      { dataFim: { gte: dtIni } },
    ];
  } else if (filtros?.periodoInicio) {
    where.dataFim = { gte: new Date(filtros.periodoInicio + "T00:00:00.000Z") };
  } else if (filtros?.periodoFim) {
    where.dataInicio = { lte: new Date(filtros.periodoFim + "T23:59:59.999Z") };
  }

  const isFiscalPetrobras = filtros?.perfilUsuario === "PETROBRAS_FISCAL";

  const ocorrencias = await prisma.ocorrencia.findMany({
    where,
    include: {
      profissional: {
        include: {
          unidade: true,
        },
      },
      posto: {
        include: {
          imovel: true,
          unidade: true,
          itemPpu: true,
        },
      },
      tipoOcorrencia: true,
      // Para o fiscal Petrobras, NÃO carregar dadoSensivel do banco
      dadoSensivel: !isFiscalPetrobras,
    },
    orderBy: { dataInicio: "desc" },
  });

  // Sanitização estrita LGPD no servidor
  if (isFiscalPetrobras) {
    return ocorrencias.map((oc) => ({
      ...oc,
      dadoSensivel: null,
      // Garantir que observação não contenha termos médicos caso existissem
      observacaoPublica: oc.tipoOcorrencia?.rotuloPublico || oc.observacaoPublica || "Ausência justificada",
    }));
  }

  return ocorrencias;
}

export async function obterOcorrenciaPorId(id: string, perfilUsuario?: string) {
  const isFiscalPetrobras = perfilUsuario === "PETROBRAS_FISCAL";
  const oc = await prisma.ocorrencia.findFirst({
    where: { id, deletedAt: null },
    include: {
      profissional: {
        include: { unidade: true },
      },
      posto: {
        include: { imovel: true, unidade: true, itemPpu: true },
      },
      tipoOcorrencia: true,
      dadoSensivel: !isFiscalPetrobras,
    },
  });

  if (!oc) return null;
  if (isFiscalPetrobras) {
    return {
      ...oc,
      dadoSensivel: null,
      observacaoPublica: oc.tipoOcorrencia?.rotuloPublico || oc.observacaoPublica || "Ausência justificada",
    };
  }
  return oc;
}

export interface DadosCriarOcorrencia {
  id?: string;
  matricula?: string;
  profissionalId?: string;
  postoId?: string;
  postoCodigo?: string;
  postoIdSgp?: string;
  tipoOcorrenciaCodigo?: string;
  tipoOcorrenciaId?: string;
  dataInicio: string;
  dataFim: string;
  diasUteisAfetados?: number;
  status?: StatusOcorrencia | string;
  origem?: OrigemRegistro | string;
  observacaoPublica?: string;
  dataConsultaPetrobras?: string | Date;
  substituicaoAprovada?: boolean;
  substitutoChapa?: string;
}

export async function criarOcorrencia(dados: DadosCriarOcorrencia, usuarioSessao: string) {
  garantirPeriodoNaoCongelado(dados.dataInicio, dados.dataFim, "criar ocorrência");

  // Resolver Profissional
  let profId = dados.profissionalId;
  if (!profId && dados.matricula) {
    const prof = await prisma.profissional.findUnique({
      where: { matricula: dados.matricula },
    });
    if (!prof) throw new Error(`Profissional com matrícula ${dados.matricula} não encontrado.`);
    profId = prof.id;
  }
  if (!profId) throw new Error("Profissional é obrigatório para registrar ocorrência.");

  // Resolver Posto (opcional na ocorrência)
  let postoId = dados.postoId;
  if (!postoId && (dados.postoCodigo || dados.postoIdSgp)) {
    const p = await prisma.posto.findFirst({
      where: {
        OR: [
          ...(dados.postoCodigo ? [{ codigoPosto: dados.postoCodigo }] : []),
          ...(dados.postoIdSgp ? [{ postoIdSgp: dados.postoIdSgp }] : []),
        ],
      },
    });
    if (p) postoId = p.id;
  }

  // Resolver Tipo de Ocorrência
  let tipoId = dados.tipoOcorrenciaId;
  if (!tipoId && dados.tipoOcorrenciaCodigo) {
    const t = await prisma.tipoOcorrencia.findUnique({
      where: { codigo: dados.tipoOcorrenciaCodigo },
    });
    if (t) tipoId = t.id;
  }
  if (!tipoId) {
    // Default para FALTA_JUSTIFICADA se não informado
    const tDef = await prisma.tipoOcorrencia.findFirst({ where: { codigo: "FALTA_JUSTIFICADA" } });
    if (!tDef) throw new Error("Tipo de ocorrência não configurado.");
    tipoId = tDef.id;
  }

  const status = (dados.status as StatusOcorrencia) || StatusOcorrencia.REGISTRADA;
  const origem = (dados.origem as OrigemRegistro) || OrigemRegistro.MANUAL;

  return prisma.ocorrencia.create({
    data: {
      ...(dados.id ? { id: dados.id } : {}),
      profissionalId: profId,
      postoId: postoId || null,
      tipoOcorrenciaId: tipoId,
      dataInicio: new Date(dados.dataInicio + "T00:00:00.000Z"),
      dataFim: new Date(dados.dataFim + "T23:59:59.000Z"),
      diasUteisAfetados: dados.diasUteisAfetados || 1,
      status,
      origem,
      registradoPor: usuarioSessao,
      observacaoPublica: dados.observacaoPublica || null,
      dataConsultaPetrobras: dados.dataConsultaPetrobras ? new Date(dados.dataConsultaPetrobras) : null,
      substituicaoAprovada: Boolean(dados.substituicaoAprovada),
      substitutoChapa: dados.substitutoChapa || null,
      criadoPor: usuarioSessao,
      atualizadoPor: usuarioSessao,
    },
    include: {
      profissional: true,
      posto: true,
      tipoOcorrencia: true,
    },
  });
}

export interface DadosAtualizarOcorrencia {
  dataInicio?: string;
  dataFim?: string;
  diasUteisAfetados?: number;
  status?: StatusOcorrencia | string;
  observacaoPublica?: string;
  substituicaoAprovada?: boolean;
  substitutoChapa?: string;
}

export async function atualizarOcorrencia(id: string, dados: DadosAtualizarOcorrencia, usuarioSessao: string) {
  const existente = await prisma.ocorrencia.findUnique({ where: { id } });
  if (!existente || existente.deletedAt) {
    throw new Error(`Ocorrência ${id} não encontrada ou já excluída.`);
  }

  const dataIniStr = dados.dataInicio || existente.dataInicio.toISOString().slice(0, 10);
  const dataFimStr = dados.dataFim || existente.dataFim.toISOString().slice(0, 10);
  garantirPeriodoNaoCongelado(dataIniStr, dataFimStr, "alterar ocorrência");

  return prisma.ocorrencia.update({
    where: { id },
    data: {
      dataInicio: dados.dataInicio ? new Date(dados.dataInicio + "T00:00:00.000Z") : undefined,
      dataFim: dados.dataFim ? new Date(dados.dataFim + "T23:59:59.000Z") : undefined,
      diasUteisAfetados: dados.diasUteisAfetados !== undefined ? dados.diasUteisAfetados : undefined,
      status: dados.status ? (dados.status as StatusOcorrencia) : undefined,
      observacaoPublica: dados.observacaoPublica !== undefined ? dados.observacaoPublica : undefined,
      substituicaoAprovada: dados.substituicaoAprovada !== undefined ? dados.substituicaoAprovada : undefined,
      substitutoChapa: dados.substitutoChapa !== undefined ? dados.substitutoChapa : undefined,
      atualizadoEm: new Date(),
      atualizadoPor: usuarioSessao,
    },
    include: {
      profissional: true,
      posto: true,
      tipoOcorrencia: true,
    },
  });
}
