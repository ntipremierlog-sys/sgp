/**
 * SGP — Sistema de Gestão de Postos
 * Repositório: Conferência Petrobras por prévia (posição-dia).
 *
 * - A apuração usa o motor existente calcularStatusVagaDia (sem alterá-lo), no período da prévia.
 * - Nível 1: por posto — dias exigíveis, dias atendidos (PRESENTE + COBERTO), % de cobertura,
 *   linhas sem parecer e situação da conferência.
 * - Nível 2: linhas posição-dia cujo status NÃO é PRESENTE nem FOLGA.
 * - Justificativa Premier e parecer da fiscal: somente inclusão (append-only); vale o mais recente.
 * - LGPD: nada de CID, diagnóstico, médico, CRM ou comentários internos. Do colaborador, só nome e chapa.
 */

import prisma from "@/lib/prisma";
import { Prisma, StatusConferenciaPosto, TipoRegistroConferencia } from "@prisma/client";
import { calcularStatusVagaDia, isCompetenciaCongelada } from "@/lib/dados/estado-operacional";
import { somarDias, diasEntre, type Previa } from "@/lib/servicos/previas";
import { obterPreviasDaCompetencia } from "./previas";
import { PeriodoCongeladoError } from "./validacoes";
import { vincularTitularesPosicoes } from "./vinculo-titular";

/**
 * Bloqueio por competência congelada usando a competência DA PRÉVIA
 * (convenção de ciclo: competência = mês em que o ciclo termina).
 * Não usa a verificação por mês-calendário da data (garantirPeriodoNaoCongelado),
 * que trataria 20/08 como competência 2026-08.
 */
function garantirCompetenciaNaoCongelada(competencia: string, acao: string): void {
  if (isCompetenciaCongelada(competencia)) throw new PeriodoCongeladoError(competencia, acao);
}

/** Status que geram linha no Nível 2 (tudo que não é PRESENTE nem FOLGA). */
export const STATUS_LINHA_CONFERENCIA = [
  "COBERTO",
  "DESCOBERTO",
  "SEM_OCUPANTE",
  "SEM_DADO",
  "PENDENTE",
  "CICLO_NAO_CONFIGURADO",
] as const;

/** Status que não contam como dia exigível (mesma regra do percentual diário do motor). */
const STATUS_NAO_EXIGIVEIS = new Set(["FOLGA", "PENDENTE", "CICLO_NAO_CONFIGURADO"]);
const STATUS_ATENDIDOS = new Set(["PRESENTE", "COBERTO"]);

export type StatusParecerFiscal = "COBERTO" | "DESCOBERTO" | "PARCIAL";
export type SituacaoConferencia = "NAO_INICIADA" | "EM_ANDAMENTO" | "CONCLUIDA";

export interface ParecerLinha {
  status: string;
  comentario: string | null;
  horasDescobertas: number | null;
  registradoPor: string | null;
  registradoEm: string;
}

export interface JustificativaLinha {
  texto: string;
  registradoPor: string | null;
  registradoEm: string;
}

export interface LinhaConferencia {
  chave: string; // posicaoId:data
  postoId: string;
  posicaoId: string;
  posicaoCodigo: string;
  data: string;
  titularNome: string | null;
  titularChapa: string | null;
  situacao: string;
  ocorrenciaTipo: string | null; // rótulo público (sem dado médico)
  ocorrenciaId: string | null;
  coberturaId: string | null;
  cobertoPorNome: string | null;
  cobertoPorChapa: string | null;
  justificativa: JustificativaLinha | null;
  parecer: ParecerLinha | null;
}

export interface PostoConferencia {
  postoId: string;
  imovel: string;
  codigoPosto: string;
  descricao: string;
  tipoPosto: string;
  posicoes: number;
  diasExigiveis: number;
  diasAtendidos: number;
  percentualCobertura: number | null;
  totalLinhas: number;
  linhasSemParecer: number;
  temFalha: boolean;
  situacaoConferencia: SituacaoConferencia;
}

export interface ResultadoConferencia {
  previa: Previa;
  imoveis: string[];
  indicadores: {
    postosNaPrevia: number;
    postos100: number;
    postosComFalha: number;
    linhasAguardandoParecer: number;
  };
  postos: PostoConferencia[];
  linhas: LinhaConferencia[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dataBanco = (s: string) => new Date(s + "T00:00:00.000Z");
const chaveLinha = (posicaoId: string, data: string) => `${posicaoId}:${data}`;

export class ConferenciaInvalidaError extends Error {
  public readonly statusCode = 422;
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ConferenciaInvalidaError";
  }
}

/** Prévia (competência + número) do cadastro; cria pela regra de datas se não existir. */
export async function obterPreviaConferencia(competencia: string, numero: number): Promise<Previa> {
  if (![1, 2, 3].includes(numero)) throw new ConferenciaInvalidaError("Prévia inválida (use 1, 2 ou 3).");
  const previa = (await obterPreviasDaCompetencia(competencia)).find((p) => p.numero === numero);
  if (!previa) throw new ConferenciaInvalidaError(`Prévia ${numero} da competência ${competencia} não encontrada.`);
  return previa;
}

function datasDaPrevia(previa: Previa): string[] {
  const n = diasEntre(previa.dataInicio, previa.dataFim);
  return Array.from({ length: n }, (_, i) => somarDias(previa.dataInicio, i));
}

interface FiltrosApuracao {
  imovel?: string;
  postoIds?: string[]; // posto_id_sgp (ou código)
}

/**
 * Apura a prévia: carrega os dados do banco, roda calcularStatusVagaDia para cada posição-dia
 * e agrega por posto. Retorna também as linhas do Nível 2 com justificativa e parecer vigentes.
 */
export async function apurarConferenciaPrevia(previa: Previa, filtros: FiltrosApuracao = {}): Promise<ResultadoConferencia> {
  const ini = previa.dataInicio;
  const fim = previa.dataFim;
  const filtroImovel = filtros.imovel && filtros.imovel !== "TODOS" ? filtros.imovel : undefined;

  const wherePosto: Prisma.PostoWhereInput = { deletedAt: null };
  if (filtroImovel) wherePosto.imovel = { nome: filtroImovel };
  if (filtros.postoIds?.length) {
    wherePosto.OR = [{ postoIdSgp: { in: filtros.postoIds } }, { codigoPosto: { in: filtros.postoIds } }];
  }

  const [imoveisDb, postosDb, ocorrenciasDb, coberturasDb, marcacoesDb, maxPonto, tiposDb, alocacoesDb] = await Promise.all([
    prisma.imovel.findMany({ select: { nome: true }, orderBy: { nome: "asc" } }),
    prisma.posto.findMany({
      where: wherePosto,
      include: { imovel: true, unidade: true, regimePosto: true, posicoes: { orderBy: { sufixo: "asc" } } },
    }),
    prisma.ocorrencia.findMany({
      where: { deletedAt: null, dataInicio: { lte: new Date(fim + "T23:59:59.999Z") }, dataFim: { gte: dataBanco(ini) } },
      select: {
        id: true,
        dataInicio: true,
        dataFim: true,
        status: true,
        observacaoPublica: true,
        profissional: { select: { matricula: true, nome: true } },
        posto: { select: { postoIdSgp: true, codigoPosto: true } },
        tipoOcorrencia: { select: { codigo: true, rotuloPublico: true } },
      },
    }),
    prisma.cobertura.findMany({
      where: { deletedAt: null, dataInicio: { lte: new Date(fim + "T23:59:59.999Z") }, dataFim: { gte: dataBanco(ini) } },
      select: {
        id: true,
        dataInicio: true,
        dataFim: true,
        status: true,
        tipoCobertura: true,
        ocorrenciaId: true,
        posto: { select: { postoIdSgp: true, codigoPosto: true } },
        posicao: { select: { posicaoIdSgp: true } },
        profissionalSubstituto: { select: { matricula: true, nome: true } },
        ocorrencia: { select: { profissional: { select: { matricula: true, nome: true } } } },
      },
    }),
    prisma.marcacaoPonto.findMany({
      where: { dataLocal: { gte: ini, lte: fim } },
      select: { chapa: true, dataLocal: true },
      distinct: ["chapa", "dataLocal"],
    }),
    prisma.marcacaoPonto.aggregate({ _max: { dataLocal: true } }),
    prisma.tipoOcorrencia.findMany({ select: { codigo: true, rotuloPublico: true } }),
    prisma.alocacao.findMany({
      where: { deletedAt: null, posto: wherePosto },
      select: {
        id: true,
        postoId: true,
        tipo: true,
        dataInicio: true,
        dataFim: true,
        motivoMovimentacao: true,
        documentoReferencia: true,
        posto: { select: { postoIdSgp: true, codigoPosto: true } },
        profissional: { select: { matricula: true, nome: true } },
      },
    }),
  ]);

  const rotuloTipo = new Map(tiposDb.map((t) => [t.codigo, t.rotuloPublico]));

  // Entradas do motor (mesmo formato do estado operacional)
  const ocorrencias = ocorrenciasDb.map((oc) => ({
    id: oc.id,
    matricula: oc.profissional.matricula,
    profissionalNome: oc.profissional.nome,
    postoCodigo: oc.posto?.postoIdSgp || oc.posto?.codigoPosto,
    tipoOcorrencia: oc.tipoOcorrencia.codigo,
    dataInicio: iso(oc.dataInicio),
    dataFim: iso(oc.dataFim),
    status: oc.status,
    observacaoPublica: oc.observacaoPublica || oc.tipoOcorrencia.rotuloPublico,
  })) as any[];

  const coberturas = coberturasDb.map((cob) => ({
    id: cob.id,
    postoCodigo: cob.posto.postoIdSgp || cob.posto.codigoPosto,
    idPosto: cob.posto.codigoPosto,
    vagaId: cob.posicao?.posicaoIdSgp || undefined,
    posicaoIdSGP: cob.posicao?.posicaoIdSgp || undefined,
    titularMatricula: cob.ocorrencia?.profissional?.matricula || undefined,
    titularNome: cob.ocorrencia?.profissional?.nome || undefined,
    substitutoMatricula: cob.profissionalSubstituto.matricula,
    substitutoNome: cob.profissionalSubstituto.nome,
    dataInicio: iso(cob.dataInicio),
    dataFim: iso(cob.dataFim),
    tipoCobertura: cob.tipoCobertura,
    status: cob.status,
    justificativa: "",
    ocorrenciaId: cob.ocorrenciaId || undefined,
  })) as any[];

  const marcacoesSet = new Set<string>();
  for (const m of marcacoesDb) marcacoesSet.add(`${String(m.chapa).padStart(6, "0")}_${m.dataLocal}`);
  const dataMaxPonto = maxPonto._max.dataLocal || "";

  // Ocupante vigente: vínculo posição → titular (fonte única, igual ao Mapa e ao Painel).
  const alocacoes: any[] = vincularTitularesPosicoes(
    postosDb.flatMap((p) =>
      p.posicoes.map((pos) => ({
        posicaoIdSgp: pos.posicaoIdSgp,
        postoId: p.id,
        postoIdSgp: p.postoIdSgp,
        codigoPosto: p.codigoPosto,
        sufixo: pos.sufixo,
        chapaTitular: pos.chapaTitular,
        nomeTitular: pos.nomeTitular,
        horarioRm: pos.horarioRm,
      }))
    ),
    alocacoesDb.map((a) => ({
      id: a.id,
      postoId: a.postoId,
      postoIdSgp: a.posto.postoIdSgp,
      codigoPosto: a.posto.codigoPosto,
      matricula: a.profissional.matricula,
      nome: a.profissional.nome,
      tipo: a.tipo,
      dataInicio: a.dataInicio,
      dataFim: a.dataFim,
      motivoMovimentacao: a.motivoMovimentacao,
      documentoReferencia: a.documentoReferencia,
    }))
  ).alocacoes;

  const datas = datasDaPrevia(previa);
  const postos: PostoConferencia[] = [];
  const linhas: LinhaConferencia[] = [];

  for (const p of postosDb) {
    const imovelNome = p.imovel?.nome || p.unidade.nome;
    const postoId = p.postoIdSgp || p.codigoPosto;
    const escala = p.escala === "ESCALA_12X36" ? "12x36" : p.escala === "ESCALA_6X1" ? "6x1" : "5x2";
    const posto = {
      id: postoId,
      idPosto: p.codigoPosto,
      postoIdSGP: p.postoIdSgp || undefined,
      codigoPosto: p.codigoPosto,
      funcao: p.funcao,
      tipoPostoId: p.regimePosto?.codigo || p.regime || "ADM_09H",
      municipio: p.imovel?.cidade || p.unidade.municipio,
      localAtuacao: imovelNome,
      baseOperacional: imovelNome,
      unidadeNome: p.unidade.nome,
      escala,
      jornadaSemanalHoras: Number(p.jornadaSemanalHoras || 44),
      horarioInicio: p.horarioInicio || "07:00",
      horarioFim: p.horarioFim || "16:48",
    } as any;

    let diasExigiveis = 0;
    let diasAtendidos = 0;
    const linhasPosto: LinhaConferencia[] = [];

    for (const pos of p.posicoes) {
      const vaga = {
        id: pos.posicaoIdSgp,
        posicaoIdSGP: pos.posicaoIdSgp,
        idPosto: p.codigoPosto,
        postoIdSGP: p.postoIdSgp || undefined,
        postoBase: p.codigoPosto,
        sequencia: pos.sufixo,
        idOriginalMC: pos.idOriginalMc || undefined,
        chapaTitular: pos.chapaTitular || undefined,
        horarioRm: pos.horarioRm || undefined,
        escalaTipo: pos.escalaTipo || undefined,
        faixaHoraria: pos.faixaHoraria || undefined,
        dataBaseEscala: pos.dataBaseEscala ? iso(pos.dataBaseEscala) : undefined,
        faseCiclo: pos.faseCiclo || undefined,
      } as any;

      for (const data of datas) {
        const r = calcularStatusVagaDia(vaga, posto, data, alocacoes, ocorrencias, coberturas, [], marcacoesSet, dataMaxPonto);
        const status = String(r.status);
        if (!STATUS_NAO_EXIGIVEIS.has(status)) diasExigiveis++;
        if (STATUS_ATENDIDOS.has(status)) diasAtendidos++;
        if (status === "PRESENTE" || status === "FOLGA") continue;

        const ocId = (r as any).ocorrenciaId || null;
        const oc = ocId ? ocorrenciasDb.find((o) => o.id === ocId) : undefined;
        const coberto = status === "COBERTO";
        const titular = (r as any).titularSubstituido || (r as any).ocupante || null;
        linhasPosto.push({
          chave: chaveLinha(pos.posicaoIdSgp, data),
          postoId,
          posicaoId: pos.posicaoIdSgp,
          posicaoCodigo: pos.codigoEstrutural || `${p.codigoPosto}.${pos.sufixo}`,
          data,
          titularNome: coberto ? titular?.nome || pos.nomeTitular || null : (r as any).ocupanteNome || pos.nomeTitular || null,
          titularChapa: coberto ? titular?.matricula || pos.chapaTitular || null : (r as any).ocupanteMatricula || pos.chapaTitular || null,
          situacao: status,
          ocorrenciaTipo: oc ? rotuloTipo.get(oc.tipoOcorrencia.codigo) || oc.tipoOcorrencia.rotuloPublico : null,
          ocorrenciaId: ocId,
          coberturaId: (r as any).coberturaId || null,
          cobertoPorNome: coberto ? (r as any).ocupanteNome || null : null,
          cobertoPorChapa: coberto ? (r as any).ocupanteMatricula || null : null,
          justificativa: null,
          parecer: null,
        });
      }
    }

    linhas.push(...linhasPosto);
    postos.push({
      postoId,
      imovel: imovelNome,
      codigoPosto: p.codigoPosto,
      descricao: p.funcao,
      tipoPosto: p.regimePosto?.nome || p.regime || "—",
      posicoes: p.posicoes.length,
      diasExigiveis,
      diasAtendidos,
      percentualCobertura: diasExigiveis > 0 ? Math.round((diasAtendidos / diasExigiveis) * 1000) / 10 : null,
      totalLinhas: linhasPosto.length,
      linhasSemParecer: 0,
      temFalha: diasAtendidos < diasExigiveis,
      situacaoConferencia: "NAO_INICIADA",
    });
  }

  // Justificativas e pareceres vigentes da prévia (mais recente por posição-dia)
  const posicaoIds = Array.from(new Set(linhas.map((l) => l.posicaoId)));
  const [justDb, parDb] = posicaoIds.length
    ? await Promise.all([
        prisma.justificativaPremier.findMany({
          where: { competencia: previa.competencia, previaNumero: previa.numero, posicaoId: { in: posicaoIds } },
          orderBy: { registradoEm: "desc" },
        }),
        prisma.conferenciaPrevia.findMany({
          where: {
            tipoRegistro: TipoRegistroConferencia.POSICAO_DIA,
            competencia: previa.competencia,
            previaNumero: previa.numero,
            posicaoId: { in: posicaoIds },
          },
          orderBy: { registradoEm: "desc" },
        }),
      ])
    : [[], []];

  const justVig = new Map<string, (typeof justDb)[number]>();
  for (const j of justDb) {
    const k = chaveLinha(j.posicaoId, iso(j.data));
    if (!justVig.has(k)) justVig.set(k, j);
  }
  const parVig = new Map<string, (typeof parDb)[number]>();
  for (const pr of parDb) {
    if (!pr.posicaoId || !pr.dataReferencia) continue;
    const k = chaveLinha(pr.posicaoId, iso(pr.dataReferencia));
    if (!parVig.has(k)) parVig.set(k, pr);
  }

  for (const l of linhas) {
    const j = justVig.get(l.chave);
    if (j) l.justificativa = { texto: j.texto, registradoPor: j.registradoPor, registradoEm: j.registradoEm.toISOString() };
    const pr = parVig.get(l.chave);
    if (pr) {
      l.parecer = {
        status: pr.status,
        comentario: pr.comentario,
        horasDescobertas: pr.horasDescobertas !== null ? Number(pr.horasDescobertas) : null,
        registradoPor: pr.registradoPor,
        registradoEm: pr.registradoEm.toISOString(),
      };
    }
  }

  const porPosto = new Map<string, LinhaConferencia[]>();
  for (const l of linhas) {
    const lista = porPosto.get(l.postoId) || [];
    lista.push(l);
    porPosto.set(l.postoId, lista);
  }
  for (const p of postos) {
    const ls = porPosto.get(p.postoId) || [];
    const comParecer = ls.filter((l) => l.parecer).length;
    p.linhasSemParecer = ls.length - comParecer;
    p.situacaoConferencia = comParecer === ls.length ? "CONCLUIDA" : comParecer === 0 ? "NAO_INICIADA" : "EM_ANDAMENTO";
  }

  postos.sort(
    (a, b) =>
      b.linhasSemParecer - a.linhasSemParecer ||
      (a.percentualCobertura ?? 101) - (b.percentualCobertura ?? 101) ||
      a.imovel.localeCompare(b.imovel) ||
      a.codigoPosto.localeCompare(b.codigoPosto, "pt-BR", { numeric: true })
  );

  return {
    previa,
    imoveis: imoveisDb.map((i) => i.nome),
    indicadores: {
      postosNaPrevia: postos.length,
      postos100: postos.filter((p) => p.percentualCobertura === 100).length,
      postosComFalha: postos.filter((p) => p.temFalha).length,
      linhasAguardandoParecer: postos.reduce((s, p) => s + p.linhasSemParecer, 0),
    },
    postos,
    linhas,
  };
}

/** Localiza as linhas do Nível 2 (recalculadas no servidor) para validar justificativa/parecer. */
async function localizarLinhas(previa: Previa, itens: Array<{ posicaoId: string; data: string }>) {
  if (!itens.length) throw new ConferenciaInvalidaError("Selecione ao menos uma linha.");
  for (const it of itens) {
    if (!it.posicaoId || !/^\d{4}-\d{2}-\d{2}$/.test(it.data || "")) {
      throw new ConferenciaInvalidaError("Linha inválida (posição e data são obrigatórias).");
    }
    if (it.data < previa.dataInicio || it.data > previa.dataFim) {
      throw new ConferenciaInvalidaError(`A data ${it.data} está fora da ${previa.numero}ª prévia.`);
    }
  }
  const posicoes = await prisma.posicaoPosto.findMany({
    where: { posicaoIdSgp: { in: Array.from(new Set(itens.map((i) => i.posicaoId))) } },
    select: { posicaoIdSgp: true, posto: { select: { postoIdSgp: true, codigoPosto: true } } },
  });
  const postoIds = Array.from(new Set(posicoes.map((p) => p.posto.postoIdSgp || p.posto.codigoPosto)));
  const apuracao = await apurarConferenciaPrevia(previa, { postoIds });
  const mapa = new Map(apuracao.linhas.map((l) => [l.chave, l]));
  return itens.map((it) => {
    const l = mapa.get(chaveLinha(it.posicaoId, it.data));
    if (!l) {
      throw new ConferenciaInvalidaError(
        `A linha ${it.posicaoId} em ${it.data} não está na conferência (status Presente/Folga ou posição inexistente).`
      );
    }
    return l;
  });
}

export async function registrarJustificativaPremier(
  dados: { competencia: string; previaNumero: number; posicaoId: string; data: string; texto: string },
  usuario: string
) {
  const texto = (dados.texto || "").trim();
  if (texto.length < 3) throw new ConferenciaInvalidaError("Informe o texto da justificativa.");
  const previa = await obterPreviaConferencia(dados.competencia, Number(dados.previaNumero));
  await localizarLinhas(previa, [{ posicaoId: dados.posicaoId, data: dados.data }]);
  garantirCompetenciaNaoCongelada(previa.competencia, "registrar justificativa da Premier");
  return prisma.justificativaPremier.create({
    data: {
      posicaoId: dados.posicaoId,
      data: dataBanco(dados.data),
      competencia: previa.competencia,
      previaNumero: previa.numero,
      texto,
      registradoPor: usuario,
    },
  });
}

export async function registrarParecerFiscalLote(
  dados: {
    competencia: string;
    previaNumero: number;
    linhas: Array<{ posicaoId: string; data: string }>;
    status: StatusParecerFiscal | string;
    comentario?: string;
    horasDescobertas?: number | string | null;
  },
  usuario: string
) {
  const status = String(dados.status || "").toUpperCase();
  if (!["COBERTO", "DESCOBERTO", "PARCIAL"].includes(status)) {
    throw new ConferenciaInvalidaError("Parecer inválido (use COBERTO, DESCOBERTO ou PARCIAL).");
  }
  const comentario = (dados.comentario || "").trim();
  if ((status === "DESCOBERTO" || status === "PARCIAL") && comentario.length < 3) {
    throw new ConferenciaInvalidaError("Comentário obrigatório para os pareceres DESCOBERTO e PARCIAL.");
  }
  let horas: number | null = null;
  if (status === "PARCIAL" && dados.horasDescobertas !== undefined && dados.horasDescobertas !== null && String(dados.horasDescobertas).trim() !== "") {
    horas = Number(String(dados.horasDescobertas).replace(",", "."));
    if (!Number.isFinite(horas) || horas < 0 || horas > 24) {
      throw new ConferenciaInvalidaError("Horas descobertas inválidas (0 a 24).");
    }
  }
  const previa = await obterPreviaConferencia(dados.competencia, Number(dados.previaNumero));
  const unicos = Array.from(new Map((dados.linhas || []).map((l) => [chaveLinha(l.posicaoId, l.data), l])).values());
  const linhas = await localizarLinhas(previa, unicos);
  garantirCompetenciaNaoCongelada(previa.competencia, "registrar parecer da fiscal");

  const registradoEm = new Date();
  await prisma.conferenciaPrevia.createMany({
    data: linhas.map((l) => ({
      tipoRegistro: TipoRegistroConferencia.POSICAO_DIA,
      registroId: l.chave,
      competencia: previa.competencia,
      previaNumero: previa.numero,
      status: status as StatusConferenciaPosto,
      comentario: comentario || null,
      registradoPor: usuario,
      registradoEm,
      posicaoId: l.posicaoId,
      dataReferencia: dataBanco(l.data),
      ocorrenciaId: l.ocorrenciaId,
      coberturaId: l.coberturaId,
      horasDescobertas: horas,
    })),
  });
  return { total: linhas.length, previa };
}

/** Parecer vigente de uma posição-dia (usado no painel do Mapa de Ocupação). */
export async function obterParecerPosicaoDia(posicaoId: string, data: string, previa: Previa) {
  const pr = await prisma.conferenciaPrevia.findFirst({
    where: {
      tipoRegistro: TipoRegistroConferencia.POSICAO_DIA,
      posicaoId,
      dataReferencia: dataBanco(data),
      competencia: previa.competencia,
      previaNumero: previa.numero,
    },
    orderBy: { registradoEm: "desc" },
  });
  return pr
    ? {
        status: pr.status,
        comentario: pr.comentario,
        horasDescobertas: pr.horasDescobertas !== null ? Number(pr.horasDescobertas) : null,
        registradoPor: pr.registradoPor,
        registradoEm: pr.registradoEm.toISOString(),
      }
    : null;
}
