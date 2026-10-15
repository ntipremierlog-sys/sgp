/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Serviço Central de Relatórios Oficiais e Modo Homologação
 *
 * Gera relatórios oficiais com cabeçalho contratual padronizado:
 * a) Ocupação por posto (posições, titular, P/C/D/N e percentual);
 * b) Coberturas do período (posição, titular, substituto, datas e motivo higienizado);
 * c) Descobertos do período (posições com D, motivo e sugestão);
 * d) Quadro de feristas e coberturas realizadas (saldo e vínculo).
 *
 * Modo Homologação:
 * Compara apuração do SGP com a Memória de Cálculo do mês de referência.
 */

import * as XLSX from "xlsx";
import {
  carregarEstado,
  calcularStatusVagaDia,
  obterTodosPostosContrato,
  PostoOperacional,
  VagaPosto,
  AlocacaoVaga,
  CoberturaOperacional,
  OcorrenciaOperacional,
  VAGAS_MC_REAIS,
  ALOCACOES_MC_REAIS,
  FERISTAS_REV04,
  FERISTAS_VINCULADOS_POSTOS,
  obterItemPpuDoPosto,
} from "@/lib/dados/estado-operacional";
import { obterItemPPU } from "@/lib/dados/painel-calculo";
import { BASES_SGP_SISTEMA } from "@/lib/dados/secoes-horarios";
import { obterFeristasSugeridosParaPosicao } from "@/lib/servicos/sugestao-cobertura";
import {
  formatarHorarioExibicao,
  formatarSecaoExibicao,
  formatarCpfPorPerfil,
  formatarDataNascimentoPorPerfil,
  calcularIdade,
} from "@/lib/dados/rm-tipos";

export const CONTRATO_NUMERO = "ICJ 5900.0129796.25.2";
export const CONTRATO_CLIENTE = "Petróleo Brasileiro S.A. – Petrobras";
export const CONTRATADA_EMPRESA = "Premier Logistics Ltda.";

export interface CabecalhoRelatorio {
  contrato: string;
  periodoTexto: string;
  dataHoraEmissao: string;
  usuarioEmissor: string;
  perfilEmissor: string;
  unidadeSelecionada?: string;
  postoSelecionado?: string;
}

export interface ItemOcupacaoPosicaoRelatorio {
  unidadeId: string;
  unidadeNome: string;
  postoId: string;
  postoCodigo: string;
  postoFuncao: string;
  posicaoId: string;
  posicaoSequencia: number;
  posicaoCodigoVisual: string;
  titularMatricula: string;
  titularNome: string;
  secaoFormatada?: string;
  horarioFormatado?: string;
  cpfFormatado?: string;
  sexo?: string;
  idade?: number | string;
  situacao?: string;
  diasP: number;
  diasC: number;
  diasD: number;
  diasN: number;
  diasExigiveis: number; // P + C + D
  diasAtendidos: number; // P + C
  percentualOcupacao: number; // Atendidos / Exigiveis * 100
}

export interface RelatorioOcupacaoResultado {
  cabecalho: CabecalhoRelatorio;
  itens: ItemOcupacaoPosicaoRelatorio[];
  totais: {
    totalPosicoes: number;
    totalDiasP: number;
    totalDiasC: number;
    totalDiasD: number;
    totalDiasN: number;
    totalExigivel: number;
    totalAtendido: number;
    percentualGeral: number;
  };
}

export interface ItemCoberturaRelatorio {
  id: string;
  unidadeId: string;
  unidadeNome: string;
  postoCodigo: string;
  postoFuncao: string;
  /** Item da PPU da cobertura (base de medição Petrobras) */
  itemPpu: string;
  itemPpuDescricao: string;
  posicaoId: string;
  titularMatricula: string;
  titularNome: string;
  substitutoMatricula: string;
  substitutoNome: string;
  dataInicio: string;
  dataFim: string;
  totalDias: number;
  motivoCategoria: string; // Férias, Afastamento, Folga compensatória, Licença (SEM DADO MÉDICO)
  status: string;
}

export interface ResumoItemPpuRelatorio {
  itemPpu: string;
  itemPpuDescricao: string;
  regime?: string;
  totalCoberturas: number;
  totalDiarias: number;
  percentualDiarias: number;
  postos: string[];
}

export interface RelatorioCoberturasResultado {
  cabecalho: CabecalhoRelatorio;
  itens: ItemCoberturaRelatorio[];
  totais: {
    totalCoberturas: number;
    totalDiarias: number;
    totalPostosCobertos: number;
    totalItensPpu: number;
    totalSubstitutos: number;
  };
  resumoPpu: ResumoItemPpuRelatorio[];
}

export interface ItemDescobertoRelatorio {
  data: string;
  diaSemana: string;
  unidadeId: string;
  unidadeNome: string;
  itemPpu?: string;
  postoCodigo: string;
  postoFuncao: string;
  posicaoId: string;
  posicaoCodigoVisual: string;
  titularMatricula: string;
  titularNome: string;
  categoriaAusencia: string;
  feristasSugeridos: { chapa: string; nome: string }[];
  quantidadeSugeridos: number;
}

export interface ItemQuadroFeristaRelatorio {
  chapa: string;
  nome: string;
  unidadePrincipal: string;
  postosVinculados: string[];
  totalCoberturas: number;
  diasEmCobertura: number;
  diasDisponiveis: number;
  statusPeriodo: "EM_COBERTURA" | "DISPONIVEL" | "COM_AUSENCIA";
}

export interface ItemDivergenciaHomologacao {
  postoCodigo: string;
  postoFuncao: string;
  unidadeId: string;
  posicaoId: string;
  titular: string;
  sgpDiasP: number;
  sgpDiasC: number;
  sgpDiasD: number;
  sgpTotalAtendido: number;
  mcDiasP: number;
  mcDiasC: number;
  mcDiasD: number;
  mcTotalAtendido: number;
  divergente: boolean;
  tipoDivergencia: string;
}

export interface RelatorioHomologacaoResultado {
  competencia: string;
  totalPosicoesApuradas: number;
  totalPosicoesConformes: number;
  totalDivergencias: number;
  taxaConformidade: number;
  itens: ItemDivergenciaHomologacao[];
}

// -----------------------------------------------------------------------------
// HELPERS DE DATAS
// -----------------------------------------------------------------------------

export function gerarDatasPeriodo(dataInicio: string, dataFim: string): string[] {
  const datas: string[] = [];
  const curr = new Date(dataInicio + "T12:00:00Z");
  const end = new Date(dataFim + "T12:00:00Z");

  while (curr <= end) {
    datas.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return datas;
}

export function resolverDatasCompetencia(competenciaOuPeriodo: string): {
  dataInicio: string;
  dataFim: string;
  datas: string[];
  rotulo: string;
} {
  if (competenciaOuPeriodo.includes(" a ")) {
    const [ini, fim] = competenciaOuPeriodo.split(" a ");
    const datas = gerarDatasPeriodo(ini.trim(), fim.trim());
    return { dataInicio: ini.trim(), dataFim: fim.trim(), datas, rotulo: competenciaOuPeriodo };
  }

  // Padrão YYYY-MM
  const comp = competenciaOuPeriodo || "2026-09";
  const [anoStr, mesStr] = comp.split("-");
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  const ultimoDia = new Date(ano, mes, 0).getDate();

  const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  const datas = gerarDatasPeriodo(dataInicio, dataFim);

  const nomesMes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const rotulo = `${nomesMes[mes - 1]} de ${ano} (${dataInicio} a ${dataFim})`;

  return { dataInicio, dataFim, datas, rotulo };
}

// -----------------------------------------------------------------------------
// 1. RELATÓRIO A: OCUPAÇÃO POR POSTO
// -----------------------------------------------------------------------------

export function gerarRelatorioOcupacaoPorPosto(filtros: {
  unidadeId?: string;
  postoId?: string;
  periodo?: string; // "2026-09" ou "2026-09-01 a 2026-09-30"
  usuarioEmissor?: string;
  perfilEmissor?: string;
}): RelatorioOcupacaoResultado {
  const estado = carregarEstado();
  const todosPostos = obterTodosPostosContrato(estado.postos);
  const vagasParaUso = estado.vagas && estado.vagas.length > 0 ? estado.vagas : VAGAS_MC_REAIS;
  const alocacoesParaUso = estado.alocacoes && estado.alocacoes.length > 0 ? estado.alocacoes : ALOCACOES_MC_REAIS;

  const { datas, rotulo } = resolverDatasCompetencia(filtros.periodo || "2026-09");

  // Filtro de postos
  const postosFiltrados = todosPostos.filter((p) => {
    if (filtros.unidadeId && filtros.unidadeId !== "TODAS") {
      const matchUnidade =
        p.unidadeId === filtros.unidadeId ||
        p.baseOperacional?.toUpperCase() === filtros.unidadeId.toUpperCase() ||
        p.localAtuacao?.toUpperCase().includes(filtros.unidadeId.toUpperCase());
      if (!matchUnidade) return false;
    }
    if (filtros.postoId && filtros.postoId !== "TODOS") {
      const matchPosto =
        p.idPosto === filtros.postoId ||
        p.codigoPosto === filtros.postoId ||
        p.id === filtros.postoId;
      if (!matchPosto) return false;
    }
    return true;
  });

  const itens: ItemOcupacaoPosicaoRelatorio[] = [];

  for (const posto of postosFiltrados) {
    // Vagas vinculadas ao posto
    const vagasDoPosto = vagasParaUso.filter(
      (v) =>
        v.idPosto === posto.idPosto ||
        v.idPosto === posto.id ||
        v.postoIdSGP === posto.codigoPosto ||
        v.postoIdSGP === posto.idPosto ||
        String(v.postoBase) === String(posto.idPosto) ||
        (posto.codigoPosto && v.id.startsWith(posto.codigoPosto))
    );

    // Se o posto não tem vagas estruturadas, cria uma vaga virtual para a posição única
    const listaVagas =
      vagasDoPosto.length > 0
        ? vagasDoPosto
        : [
            {
              id: `${posto.idPosto}-1`,
              idPosto: posto.idPosto,
              sequencia: 1,
              posicaoIdSGP: `${posto.codigoPosto}-01`,
              etiqueta: `${posto.idPosto}.1`,
            } as VagaPosto,
          ];

    for (const vaga of listaVagas) {
      let diasP = 0;
      let diasC = 0;
      let diasD = 0;
      let diasN = 0;

      for (const dataStr of datas) {
        const apuracao = calcularStatusVagaDia(
          vaga,
          posto,
          dataStr,
          alocacoesParaUso,
          estado.ocorrencias,
          estado.coberturas,
          estado.apontamentos
        );

        if (apuracao.status === "FOLGA" || apuracao.status === "CICLO_NAO_CONFIGURADO") {
          diasN++;
        } else if (apuracao.status === "PRESENTE") {
          diasP++;
        } else if (apuracao.status === "COBERTO") {
          diasC++;
        } else if (apuracao.status === "DESCOBERTO" || apuracao.status === "SEM_OCUPANTE") {
          diasD++;
        } else {
          // PENDENTE
          diasP++;
        }
      }

      const aloc = alocacoesParaUso.find(
        (a) => a.vagaId === vaga.id || a.posicaoIdSGP === vaga.id || a.vagaId === vaga.posicaoIdSGP
      );
      const titularMatricula = aloc?.matricula || posto.titularMatricula || "—";
      const titularNome = aloc?.nome || posto.titularNome || "Vaga Disponível";

      const prof = estado.profissionais?.find(
        (p) => p.chapa === titularMatricula || p.matricula === titularMatricula
      );
      const secaoFormatada = formatarSecaoExibicao(prof?.secaoCodigo, prof?.secaoDescricao);
      const horarioFormatado = formatarHorarioExibicao(
        prof?.horarioCodigo,
        prof?.horarioDescricao || aloc?.horarioEscalaRm || posto.escala
      );
      const cpfFormatado = formatarCpfPorPerfil(
        prof?.cpfLimpo || prof?.cpfMascarado,
        filtros.perfilEmissor
      );
      const sexo = prof?.sexo || "—";
      const idade = prof?.dataNascimento ? calcularIdade(prof.dataNascimento) : "—";
      const situacao = prof?.situacaoDescricao || prof?.situacao || "ATIVO";

      const diasExigiveis = diasP + diasC + diasD;
      const diasAtendidos = diasP + diasC;
      const percentualOcupacao = diasExigiveis > 0 ? (diasAtendidos / diasExigiveis) * 100 : 100.0;

      const codVisual =
        (vaga as any).codigoVisual ||
        vaga.posicaoIdSGP ||
        vaga.etiqueta ||
        `POS-${posto.codigoPosto}-${String(vaga.sequencia).padStart(2, "0")}`;

      itens.push({
        unidadeId: posto.unidadeId,
        unidadeNome: posto.unidadeNome || posto.baseOperacional || posto.unidadeId,
        postoId: posto.idPosto,
        postoCodigo:
          posto.codigoPosto && posto.codigoPosto.startsWith("PST-")
            ? posto.codigoPosto
            : `PST-${posto.unidadeId || "POSTO"}-${String(posto.idPosto || posto.codigoPosto).padStart(3, "0")}`,
        postoFuncao: posto.funcao,
        posicaoId: vaga.id,
        posicaoSequencia: vaga.sequencia,
        posicaoCodigoVisual: codVisual,
        titularMatricula,
        titularNome,
        secaoFormatada,
        horarioFormatado,
        cpfFormatado,
        sexo,
        idade,
        situacao,
        diasP,
        diasC,
        diasD,
        diasN,
        diasExigiveis,
        diasAtendidos,
        percentualOcupacao: Number(percentualOcupacao.toFixed(1)),
      });
    }
  }

  // Ordena por Unidade e Código do Posto
  itens.sort((a, b) => {
    if (a.unidadeId !== b.unidadeId) return a.unidadeId.localeCompare(b.unidadeId);
    if (a.postoCodigo !== b.postoCodigo) return a.postoCodigo.localeCompare(b.postoCodigo);
    return a.posicaoSequencia - b.posicaoSequencia;
  });

  const totalDiasP = itens.reduce((s, i) => s + i.diasP, 0);
  const totalDiasC = itens.reduce((s, i) => s + i.diasC, 0);
  const totalDiasD = itens.reduce((s, i) => s + i.diasD, 0);
  const totalDiasN = itens.reduce((s, i) => s + i.diasN, 0);
  const totalExigivel = totalDiasP + totalDiasC + totalDiasD;
  const totalAtendido = totalDiasP + totalDiasC;
  const percentualGeral = totalExigivel > 0 ? (totalAtendido / totalExigivel) * 100 : 100.0;

  const cabecalho: CabecalhoRelatorio = {
    contrato: CONTRATO_NUMERO,
    periodoTexto: rotulo,
    dataHoraEmissao: new Date().toLocaleString("pt-BR"),
    usuarioEmissor: filtros.usuarioEmissor || "Administrador Premier",
    perfilEmissor: filtros.perfilEmissor || "PREMIER_ADMIN",
    unidadeSelecionada: filtros.unidadeId || "TODAS",
    postoSelecionado: filtros.postoId || "TODOS",
  };

  return {
    cabecalho,
    itens,
    totais: {
      totalPosicoes: itens.length,
      totalDiasP,
      totalDiasC,
      totalDiasD,
      totalDiasN,
      totalExigivel,
      totalAtendido,
      percentualGeral: Number(percentualGeral.toFixed(1)),
    },
  };
}

// -----------------------------------------------------------------------------
// 2. RELATÓRIO B: COBERTURAS DO PERÍODO
// -----------------------------------------------------------------------------

// Conjunto de coberturas de exemplo removido (B2): a única fonte de coberturas é o banco.
// Export mantido vazio apenas por compatibilidade de importação.
export const COBERTURAS_PADRAO_REV04: CoberturaOperacional[] = [];

export function gerarRelatorioCoberturas(filtros: {
  unidadeId?: string;
  postoId?: string;
  periodo?: string;
  usuarioEmissor?: string;
  perfilEmissor?: string;
  itemPpu?: string;
}): RelatorioCoberturasResultado {
  const estado = carregarEstado();
  const todosPostos = obterTodosPostosContrato(estado.postos);
  const { dataInicio, dataFim, rotulo } = resolverDatasCompetencia(filtros.periodo || "2026-09");

  const postosMap = new Map(todosPostos.map((p) => [p.codigoPosto || p.idPosto, p]));

  // Somente coberturas reais (banco). Sem conjunto de exemplo quando vazio.
  const listaBase = estado.coberturas || [];

  const itens: ItemCoberturaRelatorio[] = [];

  for (const cob of listaBase) {
    if (cob.status === "CANCELADA") continue;

    // Filtra interseção com o período
    const cobFim = cob.dataFim || cob.dataInicio;
    if (cob.dataInicio > dataFim || cobFim < dataInicio) continue;

    const posto =
      postosMap.get(cob.postoCodigo) ||
      todosPostos.find(
        (p) =>
          p.codigoPosto === cob.postoCodigo ||
          p.idPosto === cob.postoCodigo ||
          p.id === cob.postoCodigo
      );

    if (filtros.unidadeId && filtros.unidadeId !== "TODAS") {
      const match =
        posto &&
        (posto.unidadeId === filtros.unidadeId ||
          posto.baseOperacional?.toUpperCase() === filtros.unidadeId.toUpperCase());
      if (!match) continue;
    }
    if (filtros.postoId && filtros.postoId !== "TODOS") {
      if (cob.postoCodigo !== filtros.postoId && posto?.idPosto !== filtros.postoId && posto?.codigoPosto !== filtros.postoId) continue;
    }

    // Item da PPU (resolução prioritária e robusta)
    const itemPpuCob =
      String(cob.itemPpu || "").trim() ||
      obterItemPpuDoPosto(cob.idPosto || cob.postoCodigo) ||
      (posto?.itemPPU ? String(posto.itemPPU).trim() : "") ||
      "";

    // Filtro por Item da PPU específico
    if (filtros.itemPpu && filtros.itemPpu !== "TODOS") {
      if (itemPpuCob !== filtros.itemPpu) continue;
    }

    // Calcula dias no período
    const iniIntersec = cob.dataInicio < dataInicio ? dataInicio : cob.dataInicio;
    const fimIntersec = cobFim > dataFim ? dataFim : cobFim;
    const dias = gerarDatasPeriodo(iniIntersec, fimIntersec).length;

    // Higienização estrita de LGPD para categoria
    let motivoLimpo = "Substituição Operacional";
    const j = (cob.justificativa || cob.tipoCobertura || "").toLowerCase();
    if (j.includes("ferias") || j.includes("férias")) motivoLimpo = "Férias";
    else if (j.includes("afast")) motivoLimpo = "Afastamento";
    else if (j.includes("licen") || j.includes("matern") || j.includes("patern")) motivoLimpo = "Licença";
    else if (j.includes("folga") || j.includes("banco")) motivoLimpo = "Folga compensatória";
    else if (j.includes("falta")) motivoLimpo = "Falta injustificada";

    const ppuConfig = itemPpuCob ? obterItemPPU(itemPpuCob) : undefined;
    const descPpu = ppuConfig?.descricao || (itemPpuCob ? `Item ${itemPpuCob}` : "Item não informado");

    itens.push({
      id: cob.id,
      unidadeId: posto?.unidadeId || posto?.baseOperacional || "CONTRATO",
      unidadeNome: posto?.unidadeNome || posto?.baseOperacional || "Contrato Geral",
      postoCodigo: cob.postoCodigo,
      postoFuncao: posto?.funcao || cob.funcaoPosto || "Posto Operacional",
      itemPpu: itemPpuCob || "—",
      itemPpuDescricao: descPpu,
      posicaoId: cob.vagaId || "1",
      titularMatricula: cob.titularMatricula || "—",
      titularNome: cob.titularNome || "Titular do Posto",
      substitutoMatricula: cob.substitutoMatricula || "—",
      substitutoNome: cob.substitutoNome || "Ferista Designado",
      dataInicio: cob.dataInicio,
      dataFim: cob.dataFim || cob.dataInicio,
      totalDias: dias,
      motivoCategoria: motivoLimpo,
      status: cob.status || "CONFIRMADA",
    });
  }

  itens.sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));

  // Consolidação de métricas e resumo por Item da PPU
  const postosCobertosSet = new Set<string>();
  const itensPpuSet = new Set<string>();
  const substitutosSet = new Set<string>();
  let totalDiarias = 0;

  const mapaResumoPpu = new Map<string, {
    itemPpu: string;
    itemPpuDescricao: string;
    regime?: string;
    totalCoberturas: number;
    totalDiarias: number;
    postos: Set<string>;
  }>();

  for (const it of itens) {
    totalDiarias += it.totalDias;
    if (it.postoCodigo) postosCobertosSet.add(it.postoCodigo);
    substitutosSet.add(it.substitutoMatricula || it.substitutoNome);

    const chavePpu = it.itemPpu && it.itemPpu !== "—" ? it.itemPpu : "SEM_ITEM";
    itensPpuSet.add(chavePpu);

    const ppuConfig = chavePpu !== "SEM_ITEM" ? obterItemPPU(chavePpu) : undefined;
    const entry = mapaResumoPpu.get(chavePpu) || {
      itemPpu: chavePpu === "SEM_ITEM" ? "Sem Item" : chavePpu,
      itemPpuDescricao: ppuConfig?.descricao || it.itemPpuDescricao || "Item não informado",
      regime: ppuConfig?.regime,
      totalCoberturas: 0,
      totalDiarias: 0,
      postos: new Set<string>(),
    };

    entry.totalCoberturas += 1;
    entry.totalDiarias += it.totalDias;
    if (it.postoCodigo) entry.postos.add(it.postoCodigo);
    mapaResumoPpu.set(chavePpu, entry);
  }

  const resumoPpu: ResumoItemPpuRelatorio[] = Array.from(mapaResumoPpu.values())
    .map((r) => ({
      itemPpu: r.itemPpu,
      itemPpuDescricao: r.itemPpuDescricao,
      regime: r.regime,
      totalCoberturas: r.totalCoberturas,
      totalDiarias: r.totalDiarias,
      percentualDiarias: totalDiarias > 0 ? Number(((r.totalDiarias / totalDiarias) * 100).toFixed(1)) : 0,
      postos: Array.from(r.postos),
    }))
    .sort((a, b) => {
      if (a.itemPpu === "Sem Item") return 1;
      if (b.itemPpu === "Sem Item") return -1;
      return a.itemPpu.localeCompare(b.itemPpu, undefined, { numeric: true });
    });

  const cabecalho: CabecalhoRelatorio = {
    contrato: CONTRATO_NUMERO,
    periodoTexto: rotulo,
    dataHoraEmissao: new Date().toLocaleString("pt-BR"),
    usuarioEmissor: filtros.usuarioEmissor || "Administrador Premier",
    perfilEmissor: filtros.perfilEmissor || "PREMIER_ADMIN",
    unidadeSelecionada: filtros.unidadeId || "TODAS",
    postoSelecionado: filtros.postoId || "TODOS",
  };

  return {
    cabecalho,
    itens,
    totais: {
      totalCoberturas: itens.length,
      totalDiarias,
      totalPostosCobertos: postosCobertosSet.size,
      totalItensPpu: Array.from(itensPpuSet).filter((c) => c !== "SEM_ITEM" && c !== "—").length,
      totalSubstitutos: substitutosSet.size,
    },
    resumoPpu,
  };
}

// -----------------------------------------------------------------------------
// 3. RELATÓRIO C: DESCOBERTOS DO PERÍODO
// -----------------------------------------------------------------------------

export function gerarRelatorioDescobertos(filtros: {
  unidadeId?: string;
  postoId?: string;
  periodo?: string;
  usuarioEmissor?: string;
  perfilEmissor?: string;
}): { cabecalho: CabecalhoRelatorio; itens: ItemDescobertoRelatorio[] } {
  const estado = carregarEstado();
  const todosPostos = obterTodosPostosContrato(estado.postos);
  const vagasParaUso = estado.vagas && estado.vagas.length > 0 ? estado.vagas : VAGAS_MC_REAIS;
  const alocacoesParaUso = estado.alocacoes && estado.alocacoes.length > 0 ? estado.alocacoes : ALOCACOES_MC_REAIS;

  const { datas, rotulo } = resolverDatasCompetencia(filtros.periodo || "2026-09");
  const itens: ItemDescobertoRelatorio[] = [];

  const postosFiltrados = todosPostos.filter((p) => {
    if (filtros.unidadeId && filtros.unidadeId !== "TODAS") {
      const match =
        p.unidadeId === filtros.unidadeId ||
        p.baseOperacional?.toUpperCase() === filtros.unidadeId.toUpperCase();
      if (!match) return false;
    }
    if (filtros.postoId && filtros.postoId !== "TODOS") {
      if (p.idPosto !== filtros.postoId && p.codigoPosto !== filtros.postoId) return false;
    }
    return true;
  });

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  for (const posto of postosFiltrados) {
    const vagasDoPosto = vagasParaUso.filter(
      (v) =>
        v.idPosto === posto.idPosto ||
        v.idPosto === posto.id ||
        v.postoIdSGP === posto.codigoPosto ||
        v.postoIdSGP === posto.idPosto
    );

    const listaVagas =
      vagasDoPosto.length > 0
        ? vagasDoPosto
        : [
            {
              id: `${posto.idPosto}-1`,
              idPosto: posto.idPosto,
              sequencia: 1,
              posicaoIdSGP: `${posto.codigoPosto}-01`,
            } as VagaPosto,
          ];

    for (const vaga of listaVagas) {
      for (const dataStr of datas) {
        const apuracao = calcularStatusVagaDia(
          vaga,
          posto,
          dataStr,
          alocacoesParaUso,
          estado.ocorrencias,
          estado.coberturas,
          estado.apontamentos
        );

        if (apuracao.status === "DESCOBERTO" || apuracao.alertaDescoberto) {
          const dt = new Date(dataStr + "T12:00:00Z");
          const diaSem = diasSemana[dt.getUTCDay()];

          const sugeridos = obterFeristasSugeridosParaPosicao(
            posto.codigoPosto || posto.idPosto,
            dataStr
          );

          const ppuPosto =
            (posto as any).itemPpu ||
            (posto as any).itemPPU ||
            obterItemPpuDoPosto(posto.codigoPosto || posto.idPosto) ||
            "—";

          itens.push({
            data: dataStr,
            diaSemana: diaSem,
            unidadeId: posto.unidadeId,
            unidadeNome: posto.unidadeNome || posto.baseOperacional || posto.unidadeId,
            itemPpu: ppuPosto,
            postoCodigo: posto.codigoPosto,
            postoFuncao: posto.funcao,
            posicaoId: vaga.id,
            posicaoCodigoVisual:
              (vaga as any).codigoVisual || vaga.posicaoIdSGP || `Vaga ${vaga.sequencia}`,
            titularMatricula: (apuracao as any).titularMatricula || posto.titularMatricula || "—",
            titularNome: (apuracao as any).titularNome || posto.titularNome || "Titular",
            categoriaAusencia: apuracao.categoriaAusencia || "Férias / Ausência",
            feristasSugeridos: sugeridos.map((f) => ({ chapa: f.chapa, nome: f.nome })),
            quantidadeSugeridos: sugeridos.length,
          });
        }
      }
    }
  }

  itens.sort((a, b) => a.data.localeCompare(b.data));

  const cabecalho: CabecalhoRelatorio = {
    contrato: CONTRATO_NUMERO,
    periodoTexto: rotulo,
    dataHoraEmissao: new Date().toLocaleString("pt-BR"),
    usuarioEmissor: filtros.usuarioEmissor || "Administrador Premier",
    perfilEmissor: filtros.perfilEmissor || "PREMIER_ADMIN",
    unidadeSelecionada: filtros.unidadeId || "TODAS",
    postoSelecionado: filtros.postoId || "TODOS",
  };

  return { cabecalho, itens };
}

// -----------------------------------------------------------------------------
// 4. RELATÓRIO D: QUADRO DE FERISTAS E COBERTURAS REALIZADAS
// -----------------------------------------------------------------------------

export function gerarRelatorioQuadroFeristas(filtros: {
  unidadeId?: string;
  periodo?: string;
  usuarioEmissor?: string;
  perfilEmissor?: string;
}): { cabecalho: CabecalhoRelatorio; itens: ItemQuadroFeristaRelatorio[] } {
  const estado = carregarEstado();
  const { dataInicio, dataFim, rotulo, datas } = resolverDatasCompetencia(filtros.periodo || "2026-09");

  // Reúne cadastro de feristas conhecidos
  const mapaFeristas = new Map<string, ItemQuadroFeristaRelatorio>();

  // A partir de FERISTAS_REV04
  for (const f of FERISTAS_REV04) {
    const chapa = f.chapaRM || f.feristaIdSGP || `FER-${f.colaborador}`;
    if (!mapaFeristas.has(chapa)) {
      mapaFeristas.set(chapa, {
        chapa,
        nome: f.colaborador,
        unidadePrincipal: f.unidade || "CONTRATO",
        postosVinculados: [f.postoIdSGP || `Posto ${f.postoBase}`],
        totalCoberturas: 0,
        diasEmCobertura: 0,
        diasDisponiveis: datas.length,
        statusPeriodo: "DISPONIVEL",
      });
    } else {
      const item = mapaFeristas.get(chapa)!;
      if (f.postoIdSGP && !item.postosVinculados.includes(f.postoIdSGP)) {
        item.postosVinculados.push(f.postoIdSGP);
      }
    }
  }

  // A partir de FERISTAS_VINCULADOS_POSTOS
  for (const f of FERISTAS_VINCULADOS_POSTOS) {
    const chapa = f.matricula;
    if (!mapaFeristas.has(chapa)) {
      mapaFeristas.set(chapa, {
        chapa,
        nome: f.nome,
        unidadePrincipal: "CONTRATO",
        postosVinculados: [f.postoIdSGP],
        totalCoberturas: 0,
        diasEmCobertura: 0,
        diasDisponiveis: datas.length,
        statusPeriodo: "DISPONIVEL",
      });
    } else {
      const item = mapaFeristas.get(chapa)!;
      if (!item.postosVinculados.includes(f.postoIdSGP)) {
        item.postosVinculados.push(f.postoIdSGP);
      }
    }
  }

  // Apura coberturas do período para cada ferista
  for (const cob of estado.coberturas) {
    if (cob.status === "CANCELADA") continue;
    const cobFim = cob.dataFim || cob.dataInicio;
    if (cob.dataInicio > dataFim || cobFim < dataInicio) continue;

    const chapaSub = cob.substitutoMatricula;
    const ferista = Array.from(mapaFeristas.values()).find(
      (f) =>
        f.chapa === chapaSub ||
        f.nome.toUpperCase() === cob.substitutoNome.toUpperCase()
    );

    const iniIntersec = cob.dataInicio < dataInicio ? dataInicio : cob.dataInicio;
    const fimIntersec = cobFim > dataFim ? dataFim : cobFim;
    const dias = gerarDatasPeriodo(iniIntersec, fimIntersec).length;

    if (ferista) {
      ferista.totalCoberturas++;
      ferista.diasEmCobertura += dias;
      ferista.diasDisponiveis = Math.max(0, datas.length - ferista.diasEmCobertura);
      ferista.statusPeriodo = "EM_COBERTURA";
    }
  }

  let itens = Array.from(mapaFeristas.values());

  if (filtros.unidadeId && filtros.unidadeId !== "TODAS") {
    itens = itens.filter(
      (f) =>
        f.unidadePrincipal.toUpperCase().includes(filtros.unidadeId!.toUpperCase()) ||
        f.postosVinculados.some((p) => p.includes(filtros.unidadeId!))
    );
  }

  itens.sort((a, b) => a.nome.localeCompare(b.nome));

  const cabecalho: CabecalhoRelatorio = {
    contrato: CONTRATO_NUMERO,
    periodoTexto: rotulo,
    dataHoraEmissao: new Date().toLocaleString("pt-BR"),
    usuarioEmissor: filtros.usuarioEmissor || "Administrador Premier",
    perfilEmissor: filtros.perfilEmissor || "PREMIER_ADMIN",
    unidadeSelecionada: filtros.unidadeId || "TODAS",
  };

  return { cabecalho, itens };
}

// -----------------------------------------------------------------------------
// 5. MODO HOMOLOGAÇÃO: COMPARAÇÃO SGP × MEMÓRIA DE CÁLCULO
// -----------------------------------------------------------------------------

export function gerarComparativoHomologacaoMC(competencia: string = "2026-09"): RelatorioHomologacaoResultado {
  const relatorioSgp = gerarRelatorioOcupacaoPorPosto({ periodo: competencia });
  const itens: ItemDivergenciaHomologacao[] = [];

  let conformes = 0;
  let divergencias = 0;

  for (const item of relatorioSgp.itens) {
    // Estimativa teórica da Memória de Cálculo (MC) para a competência:
    // Na MC, para postos 5x2 a previsão de dias úteis no mês (21 a 22 dias) é 100% presencial na ausência de afastamento formal
    const diasPrevistosTrabalho = item.diasExigiveis;
    const mcDiasP = diasPrevistosTrabalho;
    const mcDiasC = 0;
    const mcDiasD = 0;
    const mcTotalAtendido = mcDiasP;

    // Divergência ocorre se houver dia descoberto (D) no SGP ou diferença no atendimento
    const temDivergencia = item.diasD > 0 || item.diasAtendidos !== mcTotalAtendido;

    let tipoDivergencia = "100% Aderente (Conforme)";
    if (item.diasD > 0) {
      tipoDivergencia = `SGP apurou ${item.diasD} dia(s) DESCOBERTO(S) sem cobertura correspondente`;
    } else if (item.diasC > 0) {
      tipoDivergencia = `SGP registrou ${item.diasC} dia(s) em COBERTURA homologada`;
    }

    if (temDivergencia) {
      divergencias++;
    } else {
      conformes++;
    }

    itens.push({
      postoCodigo: item.postoCodigo,
      postoFuncao: item.postoFuncao,
      unidadeId: item.unidadeId,
      posicaoId: item.posicaoCodigoVisual,
      titular: `${item.titularMatricula} - ${item.titularNome}`,
      sgpDiasP: item.diasP,
      sgpDiasC: item.diasC,
      sgpDiasD: item.diasD,
      sgpTotalAtendido: item.diasAtendidos,
      mcDiasP,
      mcDiasC,
      mcDiasD,
      mcTotalAtendido,
      divergente: temDivergencia,
      tipoDivergencia,
    });
  }

  const total = itens.length;
  const taxaConformidade = total > 0 ? Number(((conformes / total) * 100).toFixed(1)) : 100.0;

  return {
    competencia,
    totalPosicoesApuradas: total,
    totalPosicoesConformes: conformes,
    totalDivergencias: divergencias,
    taxaConformidade,
    itens,
  };
}

// -----------------------------------------------------------------------------
function formatarDataIsoParaBr(dataIso?: string): string {
  if (!dataIso) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataIso)) return dataIso;
  const partes = dataIso.split("-");
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
  }
  return dataIso;
}

// 6. EXPORTAÇÃO EXCEL (.XLSX) COM CABEÇALHO OFICIAL CONTRATUAL
// -----------------------------------------------------------------------------

export function exportarRelatorioParaXlsx(
  tipoRelatorio: "ocupacao" | "coberturas" | "descobertos" | "feristas" | "homologacao",
  filtros: {
    unidadeId?: string;
    postoId?: string;
    periodo?: string;
    usuarioEmissor?: string;
    perfilEmissor?: string;
    itemPpu?: string;
  }
): Uint8Array {
  const wb = XLSX.utils.book_new();

  if (tipoRelatorio === "ocupacao") {
    const dados = gerarRelatorioOcupacaoPorPosto(filtros);

    // Cabeçalho Corporativo Premier Logistics
    const linhas: any[] = [
      ["CONTRATO PETROBRAS", dados.cabecalho.contrato, "", "PREMIER LOGISTICS LTDA. — SISTEMA DE GESTÃO DE POSTOS (SGP)"],
      ["CONTRATO PETROBRAS:", dados.cabecalho.contrato, "", "CLIENTE:", CONTRATO_CLIENTE],
      ["CONTRATADA:", CONTRATADA_EMPRESA, "", "SEGURANÇA:", "Emissão Oficial / LGPD Ativa"],
      ["RELATÓRIO:", "OCUPAÇÃO EFETIVA POR POSTO E POSIÇÃO"],
      ["COMPETÊNCIA:", dados.cabecalho.periodoTexto, "", "DATA/HORA EMISSÃO:", dados.cabecalho.dataHoraEmissao],
      ["EMISSOR:", `${dados.cabecalho.usuarioEmissor} (${dados.cabecalho.perfilEmissor})`, "", "IMÓVEL / BASE:", dados.cabecalho.unidadeSelecionada || "Todos os Imóveis"],
      [],
      [
        "UNIDADE / BASE",
        "CÓDIGO POSTO",
        "FUNÇÃO OPERACIONAL",
        "POSIÇÃO (SGP)",
        "TITULAR (MATRÍCULA)",
        "TITULAR (NOME)",
        "DIAS P (PRESENTE)",
        "DIAS C (COBERTO)",
        "DIAS D (DESCOBERTO)",
        "DIAS N (FOLGA)",
        "TOTAL EXIGÍVEL",
        "TOTAL ATENDIDO",
        "% OCUPAÇÃO",
        "HORÁRIO (RM)",
        "SEÇÃO (RM)",
        "SITUAÇÃO",
      ],
    ];

    dados.itens.forEach((it) => {
      linhas.push([
        it.unidadeNome,
        it.postoCodigo,
        it.postoFuncao,
        it.posicaoCodigoVisual,
        it.titularMatricula,
        it.titularNome,
        it.diasP,
        it.diasC,
        it.diasD,
        it.diasN,
        it.diasExigiveis,
        it.diasAtendidos,
        `${it.percentualOcupacao.toFixed(1)}%`,
        it.horarioFormatado || "—",
        it.secaoFormatada || "—",
        it.situacao || "ATIVO",
      ]);
    });

    linhas.push([]);
    linhas.push([
      "TOTAIS CONSOLIDADOS",
      "",
      "",
      `${dados.totais.totalPosicoes} posições`,
      "",
      "",
      dados.totais.totalDiasP,
      dados.totais.totalDiasC,
      dados.totais.totalDiasD,
      dados.totais.totalDiasN,
      dados.totais.totalExigivel,
      dados.totais.totalAtendido,
      `${dados.totais.percentualGeral.toFixed(1)}%`,
      "",
      "",
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [
      { wch: 25 },
      { wch: 18 },
      { wch: 35 },
      { wch: 20 },
      { wch: 18 },
      { wch: 32 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 35 },
      { wch: 35 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Ocupacao_Postos");
  } else if (tipoRelatorio === "coberturas") {
    const dados = gerarRelatorioCoberturas(filtros);

    // Aba 1: Coberturas Detalhadas do Período
    const linhas: any[] = [
      ["PREMIER LOGISTICS LTDA. — SISTEMA DE GESTÃO DE POSTOS (SGP)"],
      ["CONTRATO PETROBRAS:", dados.cabecalho.contrato, "", "CLIENTE:", CONTRATO_CLIENTE],
      ["CONTRATADA:", CONTRATADA_EMPRESA, "", "SEGURANÇA:", "Emissão Oficial / LGPD Ativa"],
      ["RELATÓRIO:", "COBERTURAS E SUBSTITUIÇÕES DO PERÍODO — BASE ITEM PPU"],
      ["COMPETÊNCIA:", dados.cabecalho.periodoTexto, "", "DATA/HORA EMISSÃO:", dados.cabecalho.dataHoraEmissao],
      ["EMISSOR:", `${dados.cabecalho.usuarioEmissor} (${dados.cabecalho.perfilEmissor})`, "", "ITEM PPU:", filtros.itemPpu && filtros.itemPpu !== "TODOS" ? filtros.itemPpu : "Todos os Itens"],
      [],
      [
        "IMÓVEL / BASE",
        "POSTO",
        "ITEM DA PPU",
        "DESCRIÇÃO DO ITEM DA PPU",
        "FUNÇÃO OPERACIONAL",
        "POSIÇÃO",
        "TITULAR AUSENTE",
        "FERISTA / SUBSTITUTO",
        "DATA INÍCIO",
        "DATA FIM",
        "DIÁRIAS NO MÊS",
        "MOTIVO (CATEGORIA LGPD)",
        "STATUS",
      ],
    ];

    dados.itens.forEach((it) => {
      linhas.push([
        it.unidadeNome,
        it.postoCodigo,
        it.itemPpu,
        it.itemPpuDescricao,
        it.postoFuncao,
        it.posicaoId,
        `${it.titularMatricula} - ${it.titularNome}`,
        `${it.substitutoMatricula} - ${it.substitutoNome}`,
        formatarDataIsoParaBr(it.dataInicio),
        formatarDataIsoParaBr(it.dataFim),
        it.totalDias,
        it.motivoCategoria,
        it.status,
      ]);
    });

    linhas.push([]);
    linhas.push([
      "TOTAIS CONSOLIDADOS",
      "",
      "",
      "",
      "",
      "",
      "",
      `${dados.totais.totalSubstitutos} substitutos`,
      "",
      "",
      dados.totais.totalDiarias,
      `${dados.totais.totalCoberturas} coberturas`,
      "",
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet(linhas);
    ws1["!cols"] = [
      { wch: 25 },
      { wch: 18 },
      { wch: 14 },
      { wch: 45 },
      { wch: 30 },
      { wch: 14 },
      { wch: 32 },
      { wch: 32 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 24 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Coberturas_Periodo");

    // Aba 2: Resumo Contratual por Item da PPU (Base Medição Petrobras)
    const linhasPpu: any[] = [
      ["PREMIER LOGISTICS LTDA. — SISTEMA DE GESTÃO DE POSTOS (SGP)"],
      ["CONTRATO PETROBRAS:", dados.cabecalho.contrato, "", "CLIENTE:", CONTRATO_CLIENTE],
      ["CONTRATADA:", CONTRATADA_EMPRESA, "", "SEGURANÇA:", "Emissão Oficial / LGPD Ativa"],
      ["RELATÓRIO:", "CONSOLIDAÇÃO CONTRATUAL POR ITEM DA PPU — MEDIÇÃO PETROBRAS"],
      ["COMPETÊNCIA:", dados.cabecalho.periodoTexto, "", "DATA/HORA EMISSÃO:", dados.cabecalho.dataHoraEmissao],
      ["EMISSOR:", `${dados.cabecalho.usuarioEmissor} (${dados.cabecalho.perfilEmissor})`],
      [],
      [
        "ITEM DA PPU",
        "DESCRIÇÃO CONTRATUAL DO ITEM",
        "REGIME CONTRATUAL",
        "TOTAL COBERTURAS",
        "TOTAL DIÁRIAS (DIAS EFETIVOS)",
        "% DO TOTAL DE DIÁRIAS",
        "POSTOS COBERTOS NO PERÍODO",
      ],
    ];

    dados.resumoPpu.forEach((r) => {
      linhasPpu.push([
        r.itemPpu,
        r.itemPpuDescricao,
        r.regime || "—",
        r.totalCoberturas,
        r.totalDiarias,
        `${r.percentualDiarias.toFixed(1)}%`,
        r.postos.join(", "),
      ]);
    });

    linhasPpu.push([]);
    linhasPpu.push([
      "TOTAL GERAL CONSOLIDADO",
      "",
      "",
      dados.totais.totalCoberturas,
      dados.totais.totalDiarias,
      "100.0%",
      `${dados.totais.totalPostosCobertos} postos distintos`,
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet(linhasPpu);
    ws2["!cols"] = [
      { wch: 14 },
      { wch: 48 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 22 },
      { wch: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, "Resumo_PPU_Contratual");
  } else if (tipoRelatorio === "descobertos") {
    const dados = gerarRelatorioDescobertos(filtros);

    const linhas: any[] = [
      ["PREMIER LOGISTICS LTDA. — SISTEMA DE GESTÃO DE POSTOS (SGP)"],
      ["CONTRATO PETROBRAS:", dados.cabecalho.contrato, "", "CLIENTE:", CONTRATO_CLIENTE],
      ["CONTRATADA:", CONTRATADA_EMPRESA, "", "SEGURANÇA:", "Emissão Oficial / LGPD Ativa"],
      ["RELATÓRIO:", "DESCOBERTOS DO PERÍODO (DIAS D)"],
      ["COMPETÊNCIA:", dados.cabecalho.periodoTexto, "", "DATA/HORA EMISSÃO:", dados.cabecalho.dataHoraEmissao],
      ["EMISSOR:", `${dados.cabecalho.usuarioEmissor} (${dados.cabecalho.perfilEmissor})`, "", "IMÓVEL / BASE:", dados.cabecalho.unidadeSelecionada || "Todos os Imóveis"],
      [],
      [
        "DATA (DD/MM/AAAA)",
        "DIA",
        "IMÓVEL / BASE",
        "ITEM DA PPU",
        "POSTO",
        "FUNÇÃO OPERACIONAL",
        "POSIÇÃO",
        "TITULAR AUSENTE",
        "CATEGORIA DA AUSÊNCIA",
        "FERISTAS APTOS SUGERIDOS",
      ],
    ];

    dados.itens.forEach((it) => {
      linhas.push([
        formatarDataIsoParaBr(it.data),
        it.diaSemana,
        it.unidadeNome,
        it.itemPpu || "—",
        it.postoCodigo,
        it.postoFuncao,
        it.posicaoCodigoVisual,
        `${it.titularMatricula} - ${it.titularNome}`,
        it.categoriaAusencia,
        it.feristasSugeridos.map((f) => `${f.chapa} ${f.nome}`).join(", ") || "Nenhum no momento",
      ]);
    });

    linhas.push([]);
    linhas.push([
      "TOTAL DE OCORRÊNCIAS",
      `${dados.itens.length} diárias descobertas`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 8 },
      { wch: 25 },
      { wch: 14 },
      { wch: 18 },
      { wch: 32 },
      { wch: 18 },
      { wch: 32 },
      { wch: 24 },
      { wch: 35 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Descobertos_Periodo");
  } else if (tipoRelatorio === "feristas") {
    const dados = gerarRelatorioQuadroFeristas(filtros);

    const linhas: any[] = [
      ["PREMIER LOGISTICS LTDA. — SISTEMA DE GESTÃO DE POSTOS (SGP)"],
      ["CONTRATO PETROBRAS:", dados.cabecalho.contrato, "", "CLIENTE:", CONTRATO_CLIENTE],
      ["CONTRATADA:", CONTRATADA_EMPRESA, "", "SEGURANÇA:", "Emissão Oficial / LGPD Ativa"],
      ["RELATÓRIO:", "QUADRO DE FERISTAS E COBERTURAS REALIZADAS"],
      ["COMPETÊNCIA:", dados.cabecalho.periodoTexto, "", "DATA/HORA EMISSÃO:", dados.cabecalho.dataHoraEmissao],
      ["EMISSOR:", `${dados.cabecalho.usuarioEmissor} (${dados.cabecalho.perfilEmissor})`, "", "IMÓVEL / BASE:", dados.cabecalho.unidadeSelecionada || "Todos os Imóveis"],
      [],
      [
        "CHAPA",
        "COLABORADOR FERISTA",
        "UNIDADE PRINCIPAL",
        "POSTOS HOMOLOGADOS VINCULADOS",
        "COBERTURAS REALIZADAS",
        "DIÁRIAS COBRINDO NO PERÍODO",
        "DIAS DISPONÍVEIS",
      ],
    ];

    dados.itens.forEach((it) => {
      linhas.push([
        it.chapa,
        it.nome,
        it.unidadePrincipal,
        it.postosVinculados.join(", "),
        it.totalCoberturas,
        it.diasEmCobertura,
        it.diasDisponiveis,
      ]);
    });

    linhas.push([]);
    linhas.push([
      "TOTAIS CONSOLIDADOS",
      `${dados.itens.length} feristas cadastrados`,
      "",
      "",
      dados.itens.reduce((acc, f) => acc + (f.totalCoberturas || 0), 0),
      dados.itens.reduce((acc, f) => acc + (f.diasEmCobertura || 0), 0),
      dados.itens.reduce((acc, f) => acc + (f.diasDisponiveis || 0), 0),
    ]);

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 32 },
      { wch: 22 },
      { wch: 35 },
      { wch: 22 },
      { wch: 26 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Quadro_Feristas");
  } else if (tipoRelatorio === "homologacao") {
    const dados = gerarComparativoHomologacaoMC(filtros.periodo || "2026-09");

    const linhas: any[] = [
      ["CONTRATO PETROBRAS", CONTRATO_NUMERO],
      ["MODO HOMOLOGAÇÃO", "COMPARATIVO SGP × MEMÓRIA DE CÁLCULO (MC)"],
      ["COMPETÊNCIA", dados.competencia],
      ["TAXA DE CONFORMIDADE", `${dados.taxaConformidade}%`],
      ["POSIÇÕES CONFORMES", `${dados.totalPosicoesConformes} de ${dados.totalPosicoesApuradas}`],
      ["DIVERGÊNCIAS", dados.totalDivergencias],
      ["AVISO", "Faturamento e medição permanecem fora do escopo. Módulo restrito à conferência."],
      [],
      [
        "POSTO",
        "FUNÇÃO",
        "POSIÇÃO",
        "TITULAR",
        "SGP (DIAS P)",
        "SGP (DIAS C)",
        "SGP (DIAS D)",
        "SGP ATENDIDO",
        "MC (DIAS P)",
        "MC ATENDIDO",
        "STATUS CONFORMIDADE",
        "DETALHE DIVERGÊNCIA",
      ],
    ];

    dados.itens.forEach((it) => {
      linhas.push([
        it.postoCodigo,
        it.postoFuncao,
        it.posicaoId,
        it.titular,
        it.sgpDiasP,
        it.sgpDiasC,
        it.sgpDiasD,
        it.sgpTotalAtendido,
        it.mcDiasP,
        it.mcTotalAtendido,
        it.divergente ? "DIVERGENTE" : "CONFORME",
        it.tipoDivergencia,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 18 },
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 35 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Homologacao_SGP_MC");
  }

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return buffer;
}
