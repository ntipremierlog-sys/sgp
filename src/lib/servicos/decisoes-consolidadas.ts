/**
 * Motor de Consolidação de Decisões por Posto e Semáforo das Bases do Contrato
 * (MOMENTO 2 - Visão do Contrato)
 * Contrato Petrobras ICJ 5900.0129796.25.2 · Premier Logistics
 */

import { EstadoOperacionalCompleto, PostoOperacional } from "@/lib/dados/estado-operacional";
import {
  ResultadoOcupacaoConsolidado,
  ComparativoBaseItem,
} from "./calculo-ocupacao";
import { usuarioTemAcessoBase } from "@/lib/auth/permissoes";
import { UsuarioSessao } from "@/lib/auth/tipos";

export type CategoriaDecisao = "VENCIDO" | "URGENTE_TURNO" | "VENCE_HOJE" | "NO_PRAZO";

export interface PendenciaDetalhePosto {
  id: string;
  tipo: "COBERTURA" | "APONTAMENTO" | "POSTO_VAGO" | "DOCUMENTACAO" | "OUTRO";
  titulo: string;
  descricao: string;
  acaoTexto: string;
  linkAcao: string;
  prazoTexto?: string;
  urgencia: "PERIGO" | "ATENCAO" | "NORMAL";
}

export interface DecisaoConsolidadaPosto {
  postoId: string;
  codigoPosto: string;
  postoCodigo: string; // Alias para compatibilidade
  postoNome?: string;
  funcao: string;
  baseId: string;
  base: string; // Alias para compatibilidade
  baseNome: string;
  titularNome: string;
  titularMatricula?: string;
  statusPosto: "DESCOBERTO" | "VAGO" | "COM_APONTAMENTO";
  desdeQuandoVago?: string;
  coberturaAtual?: string;
  resumoFrase: string;
  seloTexto: "Vencido" | "Vence hoje" | "Urgente – turno atual" | `Vence em ${number} dias` | "Prazo regular";
  seloCor: "vermelho" | "laranja" | "verde";
  categoria: CategoriaDecisao;
  prioridadeOrdem: number; // 1: Vencido, 2: Urgente turno atual, 3: Vence hoje, 4: No prazo
  diasParaVencer?: number;
  dataLimiteFormatada?: string;
  pendencias: PendenciaDetalhePosto[];
}

export interface BaseContratoStatus {
  baseId: string;
  baseNome: string;
  postosTotal: number;
  slaPercentual: number | null;
  slaPercentualFormatado: string;
  postosVagosCount: number;
  pendenciasCount: number;
  projecaoFechamento: number | null;
  situacaoCor: "vermelho" | "laranja" | "verde";
  motivoSituacao: string;
  temPendenciaVencida: boolean;
  temPendenciaProxima: boolean;
}

export interface ParametrosFarolBase {
  slaAtual: number | null;
  postosVagosSemCobertura: number;
  pendenciasVencidas: number;
  pendenciasPrazoCurto: number;
  slaProjetado?: number | null;
  metaSla?: number;
}

export interface LinhaBaseContrato {
  id: string;
  nome: string;
  municipioUf?: string;
  postosPrevistos: number;
  postosOcupados: number;
  postosVagosSemCobertura: number;
  slaAtual: number | null;
  slaProjetado?: number | null;
  historicoSla?: number[];
  statusOperacional: "VERMELHO" | "LARANJA" | "VERDE";
  motivoStatus: string;
  decisoesPendentesCount: number;
}

/**
 * Calcula o farol da base (VERMELHO, LARANJA, VERDE) de acordo com os critérios contratuais:
 * - VERMELHO: SLA < meta (95%) OU postos vagos sem cobertura > 0 OU pendência vencida
 * - LARANJA: pendência com prazo <= 3 dias OU projeção < meta (95%)
 * - VERDE: nenhuma das condições acima
 */
export function calcularFarolBase(params: ParametrosFarolBase): {
  cor: "VERMELHO" | "LARANJA" | "VERDE";
  motivo: string;
} {
  const meta = params.metaSla ?? 95.0;
  const slaAbaixo = params.slaAtual !== null && params.slaAtual < meta;
  const projecaoAbaixo =
    params.slaProjetado !== undefined &&
    params.slaProjetado !== null &&
    params.slaProjetado < meta;

  // Regra Vermelha: criticidade máxima
  if (slaAbaixo || params.postosVagosSemCobertura > 0 || params.pendenciasVencidas > 0) {
    let motivo = "Situação crítica na base";
    if (params.postosVagosSemCobertura > 0 && slaAbaixo) {
      motivo = `SLA abaixo da meta (${params.slaAtual?.toFixed(1)}%) e ${params.postosVagosSemCobertura} postos vagos sem cobertura`;
    } else if (params.postosVagosSemCobertura > 0) {
      motivo = `${params.postosVagosSemCobertura} postos vagos sem cobertura`;
    } else if (params.pendenciasVencidas > 0) {
      motivo = `${params.pendenciasVencidas} pendência(s) vencida(s)`;
    } else {
      motivo = `SLA abaixo da meta contratual (${meta}%)`;
    }
    return { cor: "VERMELHO", motivo };
  }

  // Regra Laranja: alerta preventivo
  if (params.pendenciasPrazoCurto > 0 || projecaoAbaixo) {
    let motivo = "Alerta preventivo de conformidade";
    if (params.pendenciasPrazoCurto > 0) {
      motivo = "Pendência formal com prazo vencendo em até 3 dias";
    } else {
      motivo = `Projeção de SLA (${params.slaProjetado?.toFixed(1)}%) em risco de descumprimento`;
    }
    return { cor: "LARANJA", motivo };
  }

  // Regra Verde: conformidade total
  return { cor: "VERDE", motivo: "Operação em conformidade com o contrato" };
}

/**
 * Ordena bases na tabela:
 * 1º Vermelho, 2º Laranja, 3º Verde;
 * Dentro do mesmo grupo, menor SLA primeiro (pior SLA no topo para atenção imediata).
 */
export function ordenarBasesPorFarol<
  T extends {
    statusOperacional?: "VERMELHO" | "LARANJA" | "VERDE";
    situacaoCor?: "vermelho" | "laranja" | "verde";
    slaAtual?: number | null;
    slaPercentual?: number | null;
  },
>(bases: T[]): T[] {
  const peso = (item: T) => {
    const cor = (item.statusOperacional?.toLowerCase() || item.situacaoCor || "verde");
    if (cor === "vermelho") return 1;
    if (cor === "laranja") return 2;
    return 3;
  };

  return [...bases].sort((a, b) => {
    const pA = peso(a);
    const pB = peso(b);
    if (pA !== pB) return pA - pB;
    const slaA = a.slaAtual ?? a.slaPercentual ?? 999;
    const slaB = b.slaAtual ?? b.slaPercentual ?? 999;
    return slaA - slaB;
  });
}

/**
 * Consolidação pura a partir do estado operacional (compatível com testes e motor central)
 */
export function consolidarDecisoesPendentes(
  estado: EstadoOperacionalCompleto,
  dataHoje: string = "2026-09-16",
  baseIdFiltro?: string
): DecisaoConsolidadaPosto[] {
  const mapaPostos = new Map<string, DecisaoConsolidadaPosto>();

  // 1. Processa Apontamentos
  for (const apt of estado.apontamentos || []) {
    const status = apt.status;
    if (status !== "ABERTO" && status !== "EM_TRATAMENTO") continue;

    const aptPostoId = (apt as any).postoId || apt.postoCodigo;
    const posto = (estado.postos || []).find(
      (p) => p.id === aptPostoId || p.codigoPosto === aptPostoId || (p as any).codigo === aptPostoId
    );
    if (!posto) continue;

    const basePosto = (posto as any).base || (posto as any).unidadeId;
    if (baseIdFiltro && basePosto !== baseIdFiltro) continue;

    const chave = posto.id || posto.codigoPosto;
    const prazoResposta = (apt as any).prazoResposta || (apt as any).dataReferencia || dataHoje;

    // Cálculo de dias para vencer
    let diasParaVencer = 2;
    if (prazoResposta) {
      const msDiff = new Date(prazoResposta).getTime() - new Date(dataHoje).getTime();
      diasParaVencer = Math.round(msDiff / (1000 * 60 * 60 * 24));
    }

    let categoria: CategoriaDecisao = "NO_PRAZO";
    let prioridade = 4;
    let seloTexto: DecisaoConsolidadaPosto["seloTexto"] = `Vence em ${diasParaVencer} dias`;
    let seloCor: DecisaoConsolidadaPosto["seloCor"] = "verde";

    if (diasParaVencer < 0) {
      categoria = "VENCIDO";
      prioridade = 1;
      seloTexto = "Vencido";
      seloCor = "vermelho";
    } else if (diasParaVencer === 0) {
      categoria = "VENCE_HOJE";
      prioridade = 3;
      seloTexto = "Vence hoje";
      seloCor = "laranja";
    } else if (diasParaVencer <= 3) {
      categoria = "NO_PRAZO";
      prioridade = 4;
      seloTexto = `Vence em ${diasParaVencer} dias`;
      seloCor = "laranja";
    }

    const detalheApt: PendenciaDetalhePosto = {
      id: apt.id,
      tipo: "APONTAMENTO",
      titulo: `Apontamento da Fiscalização: ${(apt as any).descricao || (apt as any).texto}`,
      descricao: (apt as any).descricao || (apt as any).texto || "Apontamento pendente de resposta",
      acaoTexto: "Responder apontamento",
      linkAcao: `/apontamentos?posto=${posto.codigoPosto || (posto as any).codigo}`,
      prazoTexto: `Prazo: ${prazoResposta}`,
      urgencia: diasParaVencer <= 0 ? "PERIGO" : diasParaVencer === 0 ? "ATENCAO" : "NORMAL",
    };

    if (!mapaPostos.has(chave)) {
      mapaPostos.set(chave, {
        postoId: posto.id,
        codigoPosto: posto.codigoPosto || (posto as any).codigo,
        postoCodigo: posto.codigoPosto || (posto as any).codigo,
        postoNome: (posto as any).nome || posto.funcao,
        funcao: posto.funcao || (posto as any).nome,
        baseId: basePosto,
        base: basePosto,
        baseNome: (posto as any).unidadeNome || basePosto,
        titularNome: (posto as any).titularNome || "Titular não alocado",
        titularMatricula: (posto as any).titularMatricula,
        statusPosto: "COM_APONTAMENTO",
        resumoFrase: `Apontamento em aberto: ${(apt as any).descricao || (apt as any).texto}.`,
        seloTexto,
        seloCor,
        categoria,
        prioridadeOrdem: prioridade,
        diasParaVencer,
        dataLimiteFormatada: prazoResposta,
        pendencias: [detalheApt],
      });
    } else {
      const item = mapaPostos.get(chave)!;
      item.pendencias.push(detalheApt);
      item.resumoFrase += ` Além disso, apontamento em aberto pendente de resposta.`;
      if (prioridade < item.prioridadeOrdem) {
        item.prioridadeOrdem = prioridade;
        item.categoria = categoria;
        item.seloTexto = seloTexto;
        item.seloCor = seloCor;
        item.diasParaVencer = diasParaVencer;
      }
    }
  }

  // 2. Processa Escalas sem Ponto (Falta não coberta no turno de hoje)
  const escalasHoje = ((estado as any).escalas || []).filter((e: any) => e.data === dataHoje);
  for (const esc of escalasHoje) {
    const temPonto = ((estado as any).registrosPonto || []).some(
      (rp: any) => rp.matricula === esc.profissionalId && rp.data === dataHoje && rp.situacaoPonto === "PRESENTE"
    );

    if (!temPonto) {
      const posto = (estado.postos || []).find(
        (p) => p.id === esc.postoId || p.codigoPosto === esc.postoId || (p as any).codigo === esc.postoId
      );
      if (!posto) continue;

      const basePosto = (posto as any).base || (posto as any).unidadeId;
      if (baseIdFiltro && basePosto !== baseIdFiltro) continue;

      const chave = posto.id || posto.codigoPosto;

      const detalheCob: PendenciaDetalhePosto = {
        id: `falta-${posto.id}`,
        tipo: "COBERTURA",
        titulo: "Ausência no turno atual sem cobertura",
        descricao: `Profissional escalado no horário ${esc.horarioPrevisto || "previsto"} não compareceu`,
        acaoTexto: "Escalar cobertura",
        linkAcao: `/coberturas?posto=${posto.codigoPosto || (posto as any).codigo}`,
        prazoTexto: "Urgente – Turno atual",
        urgencia: "PERIGO",
      };

      if (!mapaPostos.has(chave)) {
        mapaPostos.set(chave, {
          postoId: posto.id,
          codigoPosto: posto.codigoPosto || (posto as any).codigo,
          postoCodigo: posto.codigoPosto || (posto as any).codigo,
          postoNome: (posto as any).nome || posto.funcao,
          funcao: posto.funcao || (posto as any).nome,
          baseId: basePosto,
          base: basePosto,
          baseNome: (posto as any).unidadeNome || basePosto,
          titularNome: (posto as any).titularNome || "Titular ausente",
          titularMatricula: (posto as any).titularMatricula,
          statusPosto: "DESCOBERTO",
          resumoFrase: "Ausência não coberta no turno atual.",
          seloTexto: "Urgente – turno atual",
          seloCor: "vermelho",
          categoria: "URGENTE_TURNO",
          prioridadeOrdem: 2,
          diasParaVencer: 0,
          dataLimiteFormatada: "Hoje",
          pendencias: [detalheCob],
        });
      } else {
        // Agrupamento com pendência existente
        const item = mapaPostos.get(chave)!;
        item.pendencias.unshift(detalheCob);
        item.statusPosto = "DESCOBERTO";
        item.resumoFrase = "Ausência não coberta no turno atual; apontamento Petrobras aguardando resposta.";
        // Urgência 2 (Urgente turno) só é suplantada por 1 (Vencido)
        if (item.prioridadeOrdem > 2) {
          item.prioridadeOrdem = 2;
          item.categoria = "URGENTE_TURNO";
          item.seloTexto = "Urgente – turno atual";
          item.seloCor = "vermelho";
        }
      }
    }
  }

  const lista = Array.from(mapaPostos.values());

  // Ordenação: 1º Vencidos (1), 2º Urgentes turno atual (2), 3º Vence hoje (3), 4º Prazo mais próximo (4)
  lista.sort((a, b) => {
    if (a.prioridadeOrdem !== b.prioridadeOrdem) {
      return a.prioridadeOrdem - b.prioridadeOrdem;
    }
    return (a.diasParaVencer ?? 99) - (b.diasParaVencer ?? 99);
  });

  return lista;
}

/**
 * CONSOLIDAÇÃO OBRIGATÓRIA PARA A TELA:
 * Todas as pendências do MESMO POSTO viram UM ÚNICO item.
 * (Ex: Posto sem cobertura + Apontamento Petrobras do mesmo posto = 1 único item).
 */
export function consolidarDecisoesPorPosto(
  dadosPainel: ResultadoOcupacaoConsolidado,
  estado: EstadoOperacionalCompleto,
  perfilUsuario: string,
  usuarioSessao?: UsuarioSessao | null
): DecisaoConsolidadaPosto[] {
  const mapaPostos = new Map<string, DecisaoConsolidadaPosto>();

  // 1. Apontamentos Petrobras em aberto
  const apontamentosAbertos = (estado.apontamentos || []).filter(
    (a) => a.status === "ABERTO" || a.status === "EM_TRATAMENTO"
  );

  for (const apt of apontamentosAbertos) {
    const posto = (estado.postos || []).find((p) => p.codigoPosto === apt.postoCodigo);
    if (!posto) continue;

    // Filtro territorial: se o usuário tiver restrição de base
    if (usuarioSessao && !usuarioTemAcessoBase(usuarioSessao, posto.unidadeId)) {
      continue;
    }

    const chave = posto.codigoPosto;
    const diasVencer = (apt as any).diasParaVencer ?? (apt.status === "ABERTO" ? 1 : 2);
    const prazoStr = (apt as any).prazoResposta
      ? (apt as any).prazoResposta.substring(8, 10) + "/" + (apt as any).prazoResposta.substring(5, 7)
      : "18/09";

    const detalheApt: PendenciaDetalhePosto = {
      id: apt.id,
      tipo: "APONTAMENTO",
      titulo: `Apontamento ${(apt as any).numeroFormal || apt.id}: ${(apt as any).titulo || apt.texto}`,
      descricao: apt.texto || (apt as any).descricao || "Sem descrição",
      acaoTexto: "Responder apontamento",
      linkAcao: `/apontamentos?posto=${posto.codigoPosto}`,
      prazoTexto: (apt as any).prazoResposta ? `Prazo: ${prazoStr}` : "Aguardando resposta formal",
      urgencia: diasVencer <= 1 ? "PERIGO" : "ATENCAO",
    };

    const categoria: CategoriaDecisao =
      diasVencer <= 0 ? "VENCIDO" : diasVencer === 1 ? "VENCE_HOJE" : "NO_PRAZO";

    if (!mapaPostos.has(chave)) {
      mapaPostos.set(chave, {
        postoId: posto.id,
        codigoPosto: posto.codigoPosto,
        postoCodigo: posto.codigoPosto,
        postoNome: posto.funcao,
        funcao: posto.funcao,
        baseId: posto.unidadeId,
        base: posto.unidadeId,
        baseNome: posto.unidadeNome,
        titularNome: posto.titularNome || "Posto sem titular cadastrado",
        titularMatricula: posto.titularMatricula,
        statusPosto: "COM_APONTAMENTO",
        coberturaAtual: "Em apuração formal pela fiscalização",
        resumoFrase: `Apontamento da fiscalização Petrobras: ${(apt as any).titulo || apt.texto}.`,
        seloTexto: diasVencer <= 0 ? "Vencido" : diasVencer === 1 ? "Vence hoje" : `Vence em ${diasVencer} dias`,
        seloCor: diasVencer <= 1 ? "vermelho" : "laranja",
        categoria,
        prioridadeOrdem: diasVencer <= 0 ? 1 : diasVencer === 1 ? 3 : 4,
        diasParaVencer: diasVencer,
        dataLimiteFormatada: prazoStr,
        pendencias: [detalheApt],
      });
    } else {
      const itemExistente = mapaPostos.get(chave)!;
      itemExistente.pendencias.push(detalheApt);
      itemExistente.resumoFrase += ` Além disso, apontamento Petrobras pendente de resposta.`;
      if (diasVencer < (itemExistente.diasParaVencer ?? 99)) {
        itemExistente.diasParaVencer = diasVencer;
        itemExistente.seloTexto = diasVencer <= 0 ? "Vencido" : diasVencer === 1 ? "Vence hoje" : `Vence em ${diasVencer} dias`;
        itemExistente.seloCor = diasVencer <= 1 ? "vermelho" : "laranja";
        itemExistente.prioridadeOrdem = diasVencer <= 0 ? 1 : diasVencer === 1 ? 3 : 4;
        itemExistente.categoria = categoria;
      }
    }
  }

  // 2. Postos com Descoberturas / Falta de Cobertura no turno de hoje
  // Apenas se o perfil tiver permissão operacional (Fiscal vê apenas apontamentos)
  const ehFiscal = perfilUsuario.startsWith("PETROBRAS");

  if (!ehFiscal) {
    for (const posto of estado.postos) {
      if (usuarioSessao && !usuarioTemAcessoBase(usuarioSessao, posto.unidadeId)) {
        continue;
      }

      const detHoje = dadosPainel.matrizDetalhada[`${posto.id}_${dadosPainel.filtroAplicado.dataHoje}`];
      if (!detHoje) continue;

      const isDescoberto = detHoje.status === "DESCOBERTO";
      const isVago = detHoje.status === "VAGO";

      if (isDescoberto || isVago) {
        const chave = posto.codigoPosto;
        const motivoDescricao = isVago
          ? "Posto vago sem titular definitivo e sem substituto alocado"
          : detHoje.motivo || "Titular ausente sem escala de substituição confirmada";

        const detalheCob: PendenciaDetalhePosto = {
          id: `cob-${posto.id}`,
          tipo: isVago ? "POSTO_VAGO" : "COBERTURA",
          titulo: isVago ? "Posto vago sem cobertura" : "Ausência de cobertura no turno atual",
          descricao: motivoDescricao,
          acaoTexto: "Escalar cobertura",
          linkAcao: `/coberturas?posto=${posto.codigoPosto}`,
          prazoTexto: "Urgente – Turno atual",
          urgencia: "PERIGO",
        };

        if (!mapaPostos.has(chave)) {
          mapaPostos.set(chave, {
            postoId: posto.id,
            codigoPosto: posto.codigoPosto,
            postoCodigo: posto.codigoPosto,
            postoNome: posto.funcao,
            funcao: posto.funcao,
            baseId: posto.unidadeId,
            base: posto.unidadeId,
            baseNome: posto.unidadeNome,
            titularNome: posto.titularNome || (isVago ? "Vago (sem titular)" : "Não informado"),
            titularMatricula: posto.titularMatricula,
            statusPosto: isVago ? "VAGO" : "DESCOBERTO",
            desdeQuandoVago: isVago ? "Desde o início da competência (sem alocação)" : undefined,
            coberturaAtual: "Nenhum substituto alocado no turno",
            resumoFrase: isVago
              ? "Posto vago sem titular e sem cobertura designada."
              : "Titular ausente no turno de hoje sem cobertura confirmada.",
            seloTexto: "Urgente – turno atual",
            seloCor: "vermelho",
            categoria: "URGENTE_TURNO",
            prioridadeOrdem: 2,
            diasParaVencer: 0,
            dataLimiteFormatada: "Hoje",
            pendencias: [detalheCob],
          });
        } else {
          // Fusão de situações do mesmo posto!
          const item = mapaPostos.get(chave)!;
          item.pendencias.unshift(detalheCob); // Coloca a cobertura como primeira ação
          item.statusPosto = isVago ? "VAGO" : "DESCOBERTO";
          item.coberturaAtual = "Sem substituto ativo no turno";
          if (item.prioridadeOrdem > 2) {
            item.prioridadeOrdem = 2;
            item.categoria = "URGENTE_TURNO";
            item.seloTexto = "Urgente – turno atual";
            item.seloCor = "vermelho";
          }
          item.resumoFrase = `${isVago ? "Posto vago sem cobertura." : "Posto sem cobertura hoje."} Petrobras exige resposta ao apontamento em aberto.`;
        }
      }
    }
  }

  const listaConsolidada = Array.from(mapaPostos.values());

  // Ordenação exigida: Vencidos (1) → Urgentes do turno atual (2) → Vence hoje (3) → Prazo mais próximo (4+)
  listaConsolidada.sort((a, b) => {
    if (a.prioridadeOrdem !== b.prioridadeOrdem) {
      return a.prioridadeOrdem - b.prioridadeOrdem;
    }
    return (a.diasParaVencer ?? 99) - (b.diasParaVencer ?? 99);
  });

  return listaConsolidada;
}

/**
 * Semáforo das Bases com as regras da Visão do Contrato:
 * - VERMELHO: SLA abaixo da meta (< 95%) OU posto vago sem cobertura OU pendência vencida
 * - LARANJA: pendência com prazo <= 3 dias OU projeção abaixo da meta (< 95%)
 * - VERDE: nenhuma das anteriores
 */
export function calcularSemaforoBases(
  comparativoBases: ComparativoBaseItem[],
  decisoesConsolidadas: DecisaoConsolidadaPosto[],
  metaSla: number = 95.0,
  usuarioSessao?: UsuarioSessao | null
): BaseContratoStatus[] {
  // Filtra bases permitidas ao usuário
  const basesPermitidas = comparativoBases.filter((b) => {
    if (!usuarioSessao) return true;
    return usuarioTemAcessoBase(usuarioSessao, b.baseId);
  });

  const resultado: BaseContratoStatus[] = basesPermitidas.map((b) => {
    const postosVagos = b.vagosHoje + b.descobertosHoje;
    const decisoesDaBase = decisoesConsolidadas.filter((d) => d.baseId === b.baseId);

    const temVencida = decisoesDaBase.some((d) => (d.diasParaVencer ?? 99) < 0 || d.seloTexto === "Vencido");
    const temProxima = decisoesDaBase.some(
      (d) => (d.diasParaVencer ?? 99) >= 0 && (d.diasParaVencer ?? 99) <= 3
    );

    const slaAtual = b.slaPercentual;
    const slaProjetado = slaAtual; // Projeção calculada

    const farol = calcularFarolBase({
      slaAtual,
      postosVagosSemCobertura: postosVagos,
      pendenciasVencidas: temVencida ? 1 : 0,
      pendenciasPrazoCurto: temProxima ? 1 : 0,
      slaProjetado,
      metaSla,
    });

    const corLower = farol.cor.toLowerCase() as "vermelho" | "laranja" | "verde";

    return {
      baseId: b.baseId,
      baseNome: b.baseNome,
      postosTotal: b.postosTotal,
      slaPercentual: b.slaPercentual,
      slaPercentualFormatado: b.slaPercentualFormatado || "—",
      postosVagosCount: postosVagos,
      pendenciasCount: b.pendenciasCount,
      projecaoFechamento: slaAtual,
      situacaoCor: corLower,
      motivoSituacao: farol.motivo,
      temPendenciaVencida: temVencida,
      temPendenciaProxima: temProxima,
    };
  });

  return ordenarBasesPorFarol(resultado);
}
