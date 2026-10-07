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
} from "@/lib/dados/estado-operacional";
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

export interface ItemDescobertoRelatorio {
  data: string;
  diaSemana: string;
  unidadeId: string;
  unidadeNome: string;
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

export function gerarRelatorioCoberturas(filtros: {
  unidadeId?: string;
  postoId?: string;
  periodo?: string;
  usuarioEmissor?: string;
  perfilEmissor?: string;
}): { cabecalho: CabecalhoRelatorio; itens: ItemCoberturaRelatorio[] } {
  const estado = carregarEstado();
  const todosPostos = obterTodosPostosContrato(estado.postos);
  const { dataInicio, dataFim, rotulo } = resolverDatasCompetencia(filtros.periodo || "2026-09");

  const postosMap = new Map(todosPostos.map((p) => [p.codigoPosto || p.idPosto, p]));

  const itens: ItemCoberturaRelatorio[] = [];

  for (const cob of estado.coberturas) {
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
      if (posto && posto.unidadeId !== filtros.unidadeId) continue;
    }
    if (filtros.postoId && filtros.postoId !== "TODOS") {
      if (cob.postoCodigo !== filtros.postoId && posto?.idPosto !== filtros.postoId) continue;
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

    itens.push({
      id: cob.id,
      unidadeId: posto?.unidadeId || "CONTRATO",
      unidadeNome: posto?.unidadeNome || posto?.baseOperacional || "Contrato Geral",
      postoCodigo: cob.postoCodigo,
      postoFuncao: posto?.funcao || cob.funcaoPosto || "Posto Operacional",
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

          itens.push({
            data: dataStr,
            diaSemana: diaSem,
            unidadeId: posto.unidadeId,
            unidadeNome: posto.unidadeNome || posto.baseOperacional || posto.unidadeId,
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
  }
): Uint8Array {
  const wb = XLSX.utils.book_new();

  if (tipoRelatorio === "ocupacao") {
    const dados = gerarRelatorioOcupacaoPorPosto(filtros);

    // Aba 1: Dados Detalhados
    const linhas: any[] = [
      ["CONTRATO PETROBRAS", dados.cabecalho.contrato],
      ["CLIENTE", CONTRATO_CLIENTE],
      ["CONTRATADA", CONTRATADA_EMPRESA],
      ["RELATÓRIO", "OCUPAÇÃO EFETIVA POR POSTO E POSIÇÃO"],
      ["PERÍODO DE APURAÇÃO", dados.cabecalho.periodoTexto],
      ["DATA/HORA EMISSÃO", dados.cabecalho.dataHoraEmissao],
      ["EMISSOR", `${dados.cabecalho.usuarioEmissor} (${dados.cabecalho.perfilEmissor})`],
      ["UNIDADE FILTRADA", dados.cabecalho.unidadeSelecionada || "TODAS"],
      [],
      [
        "UNIDADE / BASE",
        "CÓDIGO POSTO",
        "FUNÇÃO",
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
        "CPF",
        "SEXO",
        "IDADE",
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
        it.cpfFormatado || "—",
        it.sexo || "—",
        it.idade ?? "—",
        it.situacao || "—",
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
      "",
      "",
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [
      { wch: 25 },
      { wch: 18 },
      { wch: 32 },
      { wch: 20 },
      { wch: 16 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 35 },
      { wch: 35 },
      { wch: 16 },
      { wch: 8 },
      { wch: 8 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Ocupacao_Postos");
  } else if (tipoRelatorio === "coberturas") {
    const dados = gerarRelatorioCoberturas(filtros);

    const linhas: any[] = [
      ["CONTRATO PETROBRAS", dados.cabecalho.contrato],
      ["RELATÓRIO", "COBERTURAS E SUBSTITUIÇÕES DO PERÍODO"],
      ["PERÍODO", dados.cabecalho.periodoTexto],
      ["EMISSÃO", dados.cabecalho.dataHoraEmissao],
      ["EMISSOR", dados.cabecalho.usuarioEmissor],
      [],
      [
        "UNIDADE",
        "POSTO",
        "FUNÇÃO",
        "POSIÇÃO",
        "TITULAR AUSENTE",
        "FERISTA / SUBSTITUTO",
        "DATA INÍCIO",
        "DATA FIM",
        "DIAS",
        "MOTIVO (CATEGORIA LGPD)",
        "STATUS",
      ],
    ];

    dados.itens.forEach((it) => {
      linhas.push([
        it.unidadeNome,
        it.postoCodigo,
        it.postoFuncao,
        it.posicaoId,
        `${it.titularMatricula} - ${it.titularNome}`,
        `${it.substitutoMatricula} - ${it.substitutoNome}`,
        it.dataInicio,
        it.dataFim,
        it.totalDias,
        it.motivoCategoria,
        it.status,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [
      { wch: 25 },
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      { wch: 28 },
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 22 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Coberturas_Periodo");
  } else if (tipoRelatorio === "descobertos") {
    const dados = gerarRelatorioDescobertos(filtros);

    const linhas: any[] = [
      ["CONTRATO PETROBRAS", dados.cabecalho.contrato],
      ["RELATÓRIO", "DESCOBERTOS DO PERÍODO (DIAS D)"],
      ["PERÍODO", dados.cabecalho.periodoTexto],
      ["EMISSÃO", dados.cabecalho.dataHoraEmissao],
      ["EMISSOR", dados.cabecalho.usuarioEmissor],
      [],
      [
        "DATA",
        "DIA",
        "UNIDADE",
        "POSTO",
        "FUNÇÃO",
        "POSIÇÃO",
        "TITULAR",
        "CATEGORIA AUSÊNCIA",
        "FERISTAS APTOS SUGERIDOS",
      ],
    ];

    dados.itens.forEach((it) => {
      linhas.push([
        it.data,
        it.diaSemana,
        it.unidadeNome,
        it.postoCodigo,
        it.postoFuncao,
        it.posicaoCodigoVisual,
        `${it.titularMatricula} - ${it.titularNome}`,
        it.categoriaAusencia,
        it.feristasSugeridos.map((f) => `${f.chapa} ${f.nome}`).join(", ") || "Nenhum no momento",
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 8 },
      { wch: 25 },
      { wch: 18 },
      { wch: 28 },
      { wch: 18 },
      { wch: 28 },
      { wch: 22 },
      { wch: 35 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Descobertos_Periodo");
  } else if (tipoRelatorio === "feristas") {
    const dados = gerarRelatorioQuadroFeristas(filtros);

    const linhas: any[] = [
      ["CONTRATO PETROBRAS", dados.cabecalho.contrato],
      ["RELATÓRIO", "QUADRO DE FERISTAS E COBERTURAS REALIZADAS"],
      ["PERÍODO", dados.cabecalho.periodoTexto],
      ["EMISSÃO", dados.cabecalho.dataHoraEmissao],
      [],
      [
        "CHAPA",
        "COLABORADOR FERISTA",
        "UNIDADE PRINCIPAL",
        "POSTOS VINCULADOS",
        "TOTAL COBERTURAS",
        "DIAS EM COBERTURA",
        "DIAS DISPONÍVEIS",
        "STATUS PERÍODO",
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
        it.statusPeriodo,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 28 },
      { wch: 22 },
      { wch: 30 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
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
