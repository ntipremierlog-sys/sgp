/**
 * SGP — Sistema de Gestão de Postos
 * Contrato Petrobras ICJ 5900.0129796.25.2
 *
 * Módulo Central de Dados Contratuais e Funções de Cálculo do Painel
 *
 * Hierarquia Oficial:
 * IMÓVEL → ITEM DA PPU → POSTO → POSIÇÃO → COLABORADOR
 *
 * Regras Contratuais:
 * 1. Medição por POSTO (Especificação Técnica, item 10.6.5): 1 posto = 1 unidade de medida/mês. Posto NÃO é pessoa.
 * 2. Posição = vaga de pessoa dentro do posto, definida pelo regime:
 *    Adm/09h = 1 · Adm/12h = 2 · Turno/12h = 2 · Adm/16h = 2 · Turno/16h = 3 · Turno/24h = 4.
 * 3. Ferista e substituto NÃO criam posição nem posto; são recurso de cobertura.
 * 4. Faturamento e valores em R$ estão FORA do escopo desta fase.
 */

import postosRev04Json from "./postos-rev04.json";
import posicoesRev04Json from "./posicoes-rev04.json";
import feristasRev04Json from "./feristas-rev04.json";
import imoveisRev04Json from "./imoveis-rev04.json";

// =============================================================================
// 1. TABELA / ENUM IMOVEL
// =============================================================================

export type StatusImovel = "ATIVO" | "INATIVO" | "EM_MOBILIZACAO" | "DESMOBILIZADO";

export interface Imovel {
  id?: string;
  nome: string;
  cidade: string;
  uf: string;
  gerencia: string;
  preposto?: string | null;
  status_imovel: StatusImovel;
  data_comunicacao_petrobras?: string | Date | null;
  prazo_limite?: string | Date | null;
  postosCount?: number;
  posicoesCount?: number;
  posicoesOcupadas?: number;
  vagasCount?: number;
}

export const IMOVEIS_REV04: Imovel[] = imoveisRev04Json as unknown as Imovel[];

export const MAPA_IMOVEIS_REV04: Record<string, Imovel> = Object.fromEntries(
  IMOVEIS_REV04.map((im) => [im.nome, im])
);

/**
 * Retorna o imóvel pelo nome (busca insensível a maiúsculas/acentos).
 */
export function obterImovelPorNome(nome: string): Imovel | undefined {
  if (!nome) return undefined;
  const n = String(nome).trim();
  if (MAPA_IMOVEIS_REV04[n]) return MAPA_IMOVEIS_REV04[n];
  const nNorm = n
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return IMOVEIS_REV04.find((im) => {
    const imNorm = im.nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    return imNorm === nNorm || im.id === n;
  });
}

/**
 * Retorna o município e UF correto do imóvel no formato "Cidade/UF".
 * Elimina o fallback incorreto de "Paulínia/SP".
 */
export function obterCidadeUfImovel(nomeOuId: string): string {
  if (!nomeOuId) return "";
  const im = obterImovelPorNome(nomeOuId);
  if (im && im.cidade) {
    return im.uf ? `${im.cidade}/${im.uf}` : im.cidade;
  }
  // Se for UFN-III ou Replan ou Macaé
  const n = String(nomeOuId).trim().toUpperCase();
  if (n === "UFN-III" || n === "UFN III") return "Três Lagoas/MS";
  if (n === "BOAVENTURA") return "Itaboraí/RJ";
  if (n === "REDUC") return "Duque de Caxias/RJ";
  if (n === "EDIHB" || n === "EDISEN" || n === "CENPES" || n === "FRONAPE") return "Rio de Janeiro/RJ";
  if (n === "CABIUNAS" || n === "IMBETIBA" || n === "IMBOASSICA" || n === "MACAE") return "Macaé/RJ";
  if (n === "EDISA" || n === "SANTOS") return "Santos/SP";
  if (n === "REPLAN" || n === "PAULINIA") return "Paulínia/SP";
  return nomeOuId;
}

/**
 * Retorna a carga inicial completa a partir da REV04:
 * 29 imóveis, 244 postos, 311 posições e 23 feristas.
 */
export function carregarEstruturaCompletaREV04() {
  return {
    imoveis: IMOVEIS_REV04,
    totalImoveis: IMOVEIS_REV04.length, // 29
    postos: postosRev04Json,
    totalPostos: postosRev04Json.length, // 244
    posicoes: posicoesRev04Json,
    totalPosicoes: posicoesRev04Json.length, // 311
    feristas: feristasRev04Json,
    totalFeristas: feristasRev04Json.length, // 23
  };
}

/**
 * Calcula o prazo limite da mobilização/desmobilização:
 * data_comunicacao + 30 dias corridos (itens 9.2 e 9.3 da Especificação Técnica).
 */
export function calcularPrazoLimite(dataComunicacao: string | Date | null | undefined): string | null {
  if (!dataComunicacao) return null;
  const d = typeof dataComunicacao === "string" ? new Date(dataComunicacao.includes("T") ? dataComunicacao : `${dataComunicacao}T00:00:00`) : new Date(dataComunicacao.getTime());
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/**
 * Determina o status do imóvel pelas regras contratuais:
 * - ATIVO = imóvel com postos mobilizados em operação
 * - EM_MOBILIZACAO = Petrobras solicitou postos e a mobilização ainda não foi concluída
 * - DESMOBILIZADO = Petrobras comunicou a desmobilização (manter histórico, não apagar)
 * - INATIVO = imóvel cadastrado sem postos solicitados
 */
export function determinarStatusImovel(
  qtdPostosMobilizados: number,
  solicitouMobilizacao?: boolean,
  comunicouDesmobilizacao?: boolean
): StatusImovel {
  if (comunicouDesmobilizacao) return "DESMOBILIZADO";
  if (solicitouMobilizacao) return "EM_MOBILIZACAO";
  if (qtdPostosMobilizados > 0) return "ATIVO";
  return "INATIVO";
}

// =============================================================================
// 2. TABELA ITEM_PPU (CATÁLOGO FIXO DO CONTRATO — SOMENTE ITENS DE POSTO)
// Itens de offshore (DS), serviços adicionais (HS), receptivo (12.x) e vistorias (13.x)
// NÃO são postos e não entram no Painel.
// =============================================================================

export interface ItemPPU {
  codigo: string;
  descricao: string;
  regime: string;
  posicoesPorPosto: number;
}

export const CATALOGO_ITEM_PPU: readonly ItemPPU[] = [
  { codigo: "1.1", descricao: "Serviços de Apoio Logístico (Adm 09h)", regime: "Adm/09h", posicoesPorPosto: 1 },
  { codigo: "1.2", descricao: "Serviços de Apoio Logístico (Turno 12h)", regime: "Turno/12h", posicoesPorPosto: 2 },
  { codigo: "2.1", descricao: "Suporte à Fiscalização de Mobilidade (Adm 09h)", regime: "Adm/09h", posicoesPorPosto: 1 },
  { codigo: "2.2", descricao: "Suporte à Fiscalização de Mobilidade (Turno 12h)", regime: "Turno/12h", posicoesPorPosto: 2 },
  { codigo: "3.1", descricao: "Suporte à Operação de Mobilidade (Adm 09h)", regime: "Adm/09h", posicoesPorPosto: 1 },
  { codigo: "3.2", descricao: "Suporte à Operação de Mobilidade (Adm 12h)", regime: "Adm/12h", posicoesPorPosto: 2 },
  { codigo: "3.3", descricao: "Suporte à Operação de Mobilidade (Adm 16h)", regime: "Adm/16h", posicoesPorPosto: 2 },
  { codigo: "3.4", descricao: "Suporte à Operação de Mobilidade (Turno 12h)", regime: "Turno/12h", posicoesPorPosto: 2 },
  { codigo: "3.5", descricao: "Suporte à Operação de Mobilidade (Turno 16h)", regime: "Turno/16h", posicoesPorPosto: 3 },
  { codigo: "3.6", descricao: "Suporte à Operação de Mobilidade (Turno 24h)", regime: "Turno/24h", posicoesPorPosto: 4 },
  { codigo: "4.1", descricao: "Suporte à Coordenação de Mobilidade (Adm 09h)", regime: "Adm/09h", posicoesPorPosto: 1 },
  { codigo: "4.2", descricao: "Suporte à Coordenação de Mobilidade (Turno 12h)", regime: "Turno/12h", posicoesPorPosto: 2 },
  { codigo: "5.1", descricao: "Apoio em Análise de Logística", regime: "Adm/09h", posicoesPorPosto: 1 },
  { codigo: "6.1", descricao: "Apoio em Análise de Mobilidade Corporativa", regime: "Adm/09h", posicoesPorPosto: 1 },
  { codigo: "7.1", descricao: "Análise de Projeto de Mobilidade Corporativa", regime: "Adm/09h", posicoesPorPosto: 1 },
  { codigo: "8.1", descricao: "Análise de Sistemas", regime: "Adm/09h", posicoesPorPosto: 1 },
  { codigo: "9.1", descricao: "Gestão e Liderança nas Atividades Técnicas de Mobilidade", regime: "Adm/09h", posicoesPorPosto: 1 },
  { codigo: "10.1", descricao: "Apoio em Análise de Engenharia", regime: "Adm/09h", posicoesPorPosto: 1 },
  { codigo: "11.1", descricao: "Gerenciamento de Mobilidade Corporativa (Adm 09h)", regime: "Adm/09h", posicoesPorPosto: 1 },
] as const;

export const MAPA_ITEM_PPU: Record<string, ItemPPU> = Object.fromEntries(
  CATALOGO_ITEM_PPU.map((item) => [item.codigo, item])
);

/**
 * Retorna se o código informado pertence aos 19 itens de postos contratuais do Painel.
 */
export function ehItemPostoValido(codigo: string): boolean {
  const c = String(codigo || "").trim();
  return Boolean(MAPA_ITEM_PPU[c]);
}

/**
 * Busca item da PPU pelo código.
 */
export function obterItemPPU(codigo: string): ItemPPU | undefined {
  const c = String(codigo || "").trim();
  return MAPA_ITEM_PPU[c];
}

// =============================================================================
// 3. TABELA POSTO
// =============================================================================

export interface PostoContratual {
  posto_id_sgp: string; // Chave única
  imovel_id: string; // ID ou nome do imóvel
  item_ppu: string;
  regime: string;
  periculosidade: "SIM" | "NÃO";
  fator_medicao: number; // 1,0 se periculosidade = SIM; 0,8 se NÃO (ET 10.6; informativo)
  qtd_posicoes: number; // Vem do regime: Adm/09h=1, Adm/12h=2, Turno/12h=2, Adm/16h=2, Turno/16h=3, Turno/24h=4
  descricao?: string;
  unidade?: string;
  gerencia?: string;
  municipio?: string;
}

/**
 * Fator de medição informativo (ET item 10.6):
 * 1,0 se periculosidade = SIM; 0,8 se NÃO
 */
export function calcularFatorMedicao(periculosidade: "SIM" | "NÃO" | string): number {
  return String(periculosidade || "").trim().toUpperCase() === "SIM" ? 1.0 : 0.8;
}

/**
 * Posições por posto definidas pelo regime contratual:
 * Adm/09h = 1 · Adm/12h = 2 · Turno/12h = 2 · Adm/16h = 2 · Turno/16h = 3 · Turno/24h = 4
 */
export function obterQtdPosicoesDoRegime(regimeOuItem: string): number {
  const r = String(regimeOuItem || "").trim().toUpperCase();
  if (r.includes("TURNO/24H") || r.includes("TURNO 24H") || r === "TURNO_24H" || r === "3.6") return 4;
  if (r.includes("TURNO/16H") || r.includes("TURNO 16H") || r === "TURNO_16H" || r === "3.5") return 3;
  if (
    r.includes("TURNO/12H") ||
    r.includes("TURNO 12H") ||
    r.includes("ADM/12H") ||
    r.includes("ADM 12H") ||
    r.includes("ADM/16H") ||
    r.includes("ADM 16H") ||
    r === "TURNO_12H" ||
    r === "ADM_12H" ||
    r === "ADM_16H" ||
    r === "1.2" ||
    r === "2.2" ||
    r === "3.2" ||
    r === "3.3" ||
    r === "3.4" ||
    r === "4.2"
  ) {
    return 2;
  }
  return 1;
}

// =============================================================================
// 4. TABELA POSICAO E FERISTA_POSTO
// =============================================================================

export interface PosicaoContratual {
  posicao_id_sgp: string; // Chave única e permanente
  posto_id: string; // posto_id_sgp
  codigo_estrutural: string; // Ex.: 7.3
  chapa_titular?: string | null;
  nome_titular?: string | null;
  situacao_rm?: string | null;
  horario_rm?: string | null;
  escala_tipo?: string | null;
  faixa_horaria?: string | null;
  escala_pendente: boolean; // bool: escala cíclica 12x36/4x4/4x2 sem fase ou data-base
  data_base_escala?: string | null;
  fase_ciclo?: string | null;
  grupo_revezamento?: string | null;
}

export interface FeristaPostoContratual {
  posto_id: string;
  chapa: string;
  nome: string;
  situacao_rm?: string | null;
}

/**
 * Identifica se a posição possui escala cíclica pendente:
 * escala cíclica 12x36/4x4/4x2 sem fase ou data-base.
 */
export function verificarEscalaPendente(posicao: {
  escala_tipo?: string | null;
  escalaTipo?: string | null;
  fase_ciclo?: string | null;
  faseCiclo?: string | null;
  data_base_escala?: string | null;
  dataBaseEscala?: string | null;
}): boolean {
  const escala = String(posicao.escala_tipo || posicao.escalaTipo || "").toUpperCase();
  const ehCiclica = escala.includes("12X36") || escala.includes("4X4") || escala.includes("4X2") || escala.includes("TURNO");
  const temFase = Boolean(posicao.fase_ciclo || posicao.faseCiclo);
  const temDataBase = Boolean(posicao.data_base_escala || posicao.dataBaseEscala);
  return ehCiclica && (!temFase || !temDataBase);
}

// =============================================================================
// 5. FUNÇÕES DE CÁLCULO CONTRATUAL DO PAINEL (FONTE ÚNICA DE VERDADE)
// =============================================================================

/**
 * posicao_ocupada = tem titular E o titular existe no RM
 * (qualquer situação: Ativo, Férias, Licença, Afastado, Aviso Prévio)
 */
export function isPosicaoOcupada(
  posicao: {
    chapa_titular?: string | null;
    chapaTitular?: string | null;
    nome_titular?: string | null;
    titularReferencia?: string | null;
    situacao_rm?: string | null;
    statusRMTitular?: string | null;
    statusOcupacaoMC?: string | null;
    ehVaga?: boolean;
  },
  funcionariosRM?: Map<string, any> | Array<{ chapa: string }> | Set<string>
): boolean {
  const chapa = (posicao.chapa_titular ?? posicao.chapaTitular ?? "").trim();
  const temChapa = Boolean(chapa && chapa !== "-" && chapa !== "SEM TITULAR");

  // Se foi fornecida base externa do RM, valida existência formal pela chapa
  if (funcionariosRM) {
    if (!temChapa) return false;
    if (funcionariosRM instanceof Set) return funcionariosRM.has(chapa);
    if (funcionariosRM instanceof Map) return funcionariosRM.has(chapa);
    if (Array.isArray(funcionariosRM)) return funcionariosRM.some((f) => f.chapa === chapa);
  }

  // Validação padrão pela situação do titular no RM
  const situacao = (posicao.situacao_rm ?? posicao.statusRMTitular ?? "").trim();
  const temSituacaoRM = Boolean(
    situacao &&
      situacao !== "-" &&
      situacao !== "SEM TITULAR" &&
      situacao !== "NÃO LOCALIZADO" &&
      situacao !== "NÃO CONSTA"
  );

  return temChapa && temSituacaoRM;
}

/**
 * posto_ocupado = TODAS as posições do posto ocupadas
 */
export function isPostoOcupado(
  postoId: string,
  posicoesDoPosto: Array<any>,
  funcionariosRM?: Map<string, any> | Array<{ chapa: string }> | Set<string>
): boolean {
  if (!posicoesDoPosto || posicoesDoPosto.length === 0) return false;
  return posicoesDoPosto.every((p) => isPosicaoOcupada(p, funcionariosRM));
}

export interface MetricasPainel {
  /** Quantidade de postos (unidades da PPU) */
  postos_mobilizados: number;
  /** Quantidade de postos com todas as posições ocupadas */
  postos_ocupados: number;
  /** Quantidade de POSIÇÕES sem titular (pessoas a contratar) */
  vagas_em_aberto: number;
  /** Quantidade de postos com ao menos 1 posição vaga */
  postos_com_vaga: number;
  /** Taxa de ocupação = postos_ocupados / postos_mobilizados */
  taxa_ocupacao: number;
  /** Quantidade total de posições (vagas estruturais) */
  posicoes_total: number;
}

export interface MetricasImovel extends MetricasPainel {
  imovel: string;
}

export interface ResultadoPainelCalculo {
  totais: MetricasPainel;
  por_imovel: Record<string, MetricasImovel>;
  lista_imoveis: MetricasImovel[];
}

/**
 * Calcula as métricas consolidadas por imóvel e no total do contrato.
 * Fonte única reutilizada no Painel e nos relatórios.
 *
 * @param listaPostos Lista de postos (padrão: base REV04 oficial com 244 postos)
 * @param listaPosicoes Lista de posições (padrão: base REV04 oficial com 311 posições)
 * @param funcionariosRM Cadastro opcional do RM para checagem estrita
 */
export function calcularMetricasPainel(
  listaPostos: any[] = postosRev04Json,
  listaPosicoes: any[] = posicoesRev04Json,
  funcionariosRM?: Map<string, any> | Array<{ chapa: string }> | Set<string>
): ResultadoPainelCalculo {
  // 1. Agrupar posições por posto
  const posicoesPorPosto = new Map<string, any[]>();
  for (const p of listaPosicoes) {
    const postoId = p.posto_id ?? p.postoIdSGP ?? p.idPosto;
    if (!posicoesPorPosto.has(postoId)) posicoesPorPosto.set(postoId, []);
    posicoesPorPosto.get(postoId)!.push(p);
  }

  // 2. Agrupar postos por imóvel
  const postosPorImovel = new Map<string, any[]>();
  for (const p of listaPostos) {
    const imovel = p.imovel ?? p.unidade ?? p.unidadeNome ?? p.localAtuacao ?? "NÃO INFORMADO";
    if (!postosPorImovel.has(imovel)) postosPorImovel.set(imovel, []);
    postosPorImovel.get(imovel)!.push(p);
  }

  let totalPostosMobilizados = listaPostos.length;
  let totalPostosOcupados = 0;
  let totalVagasEmAberto = 0;
  let totalPostosComVaga = 0;
  let totalPosicoes = listaPosicoes.length;

  const porImovel: Record<string, MetricasImovel> = {};
  const listaImoveis: MetricasImovel[] = [];

  for (const [imovel, postosDoImovel] of postosPorImovel.entries()) {
    const imovelPostosMobilizados = postosDoImovel.length;
    let imovelPostosOcupados = 0;
    let imovelVagasEmAberto = 0;
    let imovelPostosComVaga = 0;
    let imovelPosicoes = 0;

    for (const posto of postosDoImovel) {
      const postoId = posto.posto_id_sgp ?? posto.postoIdSGP ?? posto.id;
      const ps = posicoesPorPosto.get(postoId) || [];
      imovelPosicoes += ps.length;

      let postoComVaga = false;
      if (ps.length === 0) {
        postoComVaga = true;
      } else {
        for (const pos of ps) {
          const ocupada = isPosicaoOcupada(pos, funcionariosRM);
          if (!ocupada) {
            imovelVagasEmAberto++;
            postoComVaga = true;
          }
        }
      }

      if (postoComVaga) {
        imovelPostosComVaga++;
      } else {
        imovelPostosOcupados++;
      }
    }

    const taxa = imovelPostosMobilizados > 0 ? imovelPostosOcupados / imovelPostosMobilizados : 0;
    const metrica: MetricasImovel = {
      imovel,
      postos_mobilizados: imovelPostosMobilizados,
      postos_ocupados: imovelPostosOcupados,
      vagas_em_aberto: imovelVagasEmAberto,
      postos_com_vaga: imovelPostosComVaga,
      taxa_ocupacao: taxa,
      posicoes_total: imovelPosicoes,
    };

    porImovel[imovel] = metrica;
    listaImoveis.push(metrica);

    totalPostosOcupados += imovelPostosOcupados;
    totalVagasEmAberto += imovelVagasEmAberto;
    totalPostosComVaga += imovelPostosComVaga;
  }

  // Ordenar lista de imóveis alfabeticamente
  listaImoveis.sort((a, b) => a.imovel.localeCompare(b.imovel));

  const taxaTotal = totalPostosMobilizados > 0 ? totalPostosOcupados / totalPostosMobilizados : 0;

  return {
    totais: {
      postos_mobilizados: totalPostosMobilizados,
      postos_ocupados: totalPostosOcupados,
      vagas_em_aberto: totalVagasEmAberto,
      postos_com_vaga: totalPostosComVaga,
      taxa_ocupacao: taxaTotal,
      posicoes_total: totalPosicoes,
    },
    por_imovel: porImovel,
    lista_imoveis: listaImoveis,
  };
}

/**
 * Retorna as métricas contratuais do Painel já processadas a partir da REV04.
 */
export function obterDadosPainelContratual(): ResultadoPainelCalculo {
  return calcularMetricasPainel();
}

/**
 * Retorna a lista oficial de feristas vinculados por posto (recurso de cobertura).
 */
export function obterFeristasREV04(): FeristaPostoContratual[] {
  return (feristasRev04Json as any[]).map((f) => ({
    posto_id: f.postoIdSGP,
    chapa: f.chapaRM || f.feristaIdSGP,
    nome: f.colaborador,
    situacao_rm: f.statusRM || "Ativo",
  }));
}

// =============================================================================
// 6. ÁRVORE ESTRUTURAL DO IMÓVEL (ETAPA 2 / PAINEL INTERATIVO)
// IMÓVEL → ITEM PPU → POSTO → POSIÇÃO / FERISTA
// =============================================================================

export interface FeristaCobertura {
  nome: string;
  chapa: string;
  situacao_rm?: string | null;
}

export interface PosicaoArvore {
  posicao_id: string;
  codigo_estrutural: string;
  ocupada: boolean;
  titular_nome?: string | null;
  titular_chapa?: string | null;
  horario_rm?: string | null;
  escala_tipo?: string | null;
  faixa_horaria?: string | null;
  situacao_rm?: string | null;
  categoria_situacao: "ativo" | "ferias" | "afastado" | "indefinido";
  escala_pendente: boolean;
  eh_vaga: boolean;
  motivo_vaga?: string | null;
}

export interface PostoArvore {
  posto_id: string;
  item_ppu: string;
  regime: string;
  qtd_posicoes: number;
  periculosidade: "SIM" | "NÃO";
  tem_periculosidade: boolean;
  fator_medicao: number;
  posicoes: PosicaoArvore[];
  feristas: FeristaCobertura[];
  ocupado: boolean;
  vagas_count: number;
}

export interface ItemPPUArvore {
  codigo: string;
  descricao: string;
  regime: string;
  postos: PostoArvore[];
  total_postos: number;
  postos_ocupados: number;
  vagas_count: number;
}

export interface ImovelArvore {
  imovel: string;
  id: string;
  cidade: string;
  uf: string;
  cidadeUf: string;
  gerencia: string;
  preposto: string;
  itens_ppu: ItemPPUArvore[];
  total_itens_ppu: number;
  total_postos: number;
  total_posicoes: number;
  total_vagas: number;
  taxa_ocupacao: number;
  status: StatusImovel;
}

/**
 * Categoriza a situação no RM para estilização em etiqueta:
 * - Ativo (verde)
 * - Férias (roxo)
 * - Licença / Afastado / Aviso (âmbar)
 */
export function categorizarSituacaoRM(situacao?: string | null): "ativo" | "ferias" | "afastado" | "indefinido" {
  if (!situacao) return "indefinido";
  const s = situacao.trim().toLowerCase();
  if (s.includes("ativo")) return "ativo";
  if (s.includes("férias") || s.includes("ferias")) return "ferias";
  if (s.includes("licença") || s.includes("licenca") || s.includes("afastad") || s.includes("aviso")) return "afastado";
  return "indefinido";
}

/**
 * Determina o motivo da vaga em aberto:
 * - "Sem titular na MC"
 * - "<nome> (MC) não está no RM"
 */
export function determinarMotivoVaga(posicao: any): string {
  const nomeMC = (posicao.titularReferencia || posicao.nome_titular || "").trim();
  const chapaMC = (posicao.chapaTitular || posicao.chapa_titular || "").trim();
  const statusRM = (posicao.statusRMTitular || posicao.situacao_rm || "").trim().toUpperCase();

  const temNomeValido = Boolean(
    nomeMC &&
    nomeMC !== "-" &&
    nomeMC !== "SEM TITULAR" &&
    nomeMC !== "NÃO LOCALIZADO" &&
    nomeMC !== "NAO LOCALIZADO"
  );

  const temChapaValida = Boolean(
    chapaMC &&
    chapaMC !== "-" &&
    chapaMC !== "SEM TITULAR"
  );

  if (
    temNomeValido &&
    (!temChapaValida ||
      statusRM === "NÃO LOCALIZADO" ||
      statusRM === "NAO LOCALIZADO" ||
      statusRM === "NÃO CONSTA" ||
      statusRM === "NAO CONSTA" ||
      !statusRM)
  ) {
    return `${nomeMC} (MC) não está no RM`;
  }

  return "Sem titular na MC";
}

/**
 * Constrói a árvore estrutural completa para um imóvel específico.
 */
export function obterArvoreEstruturalImovel(
  nomeOuIdImovel: string,
  funcionariosRM?: Map<string, any> | Array<{ chapa: string }> | Set<string>
): ImovelArvore | null {
  const imovelCadastrado = obterImovelPorNome(nomeOuIdImovel);
  const nomeOficial = imovelCadastrado ? imovelCadastrado.nome : nomeOuIdImovel;

  // 1. Filtrar postos do imóvel
  const postosDoImovel = (postosRev04Json as any[]).filter((p) => {
    const u = (p.unidade || p.imovel || "").trim().toUpperCase();
    return u === nomeOficial.toUpperCase() || (imovelCadastrado?.id && u === imovelCadastrado.id.toUpperCase());
  });

  if (postosDoImovel.length === 0 && !imovelCadastrado) return null;

  // 2. Mapear feristas por posto
  const feristasPorPosto = new Map<string, FeristaCobertura[]>();
  for (const f of feristasRev04Json as any[]) {
    const pId = f.postoIdSGP;
    if (!feristasPorPosto.has(pId)) feristasPorPosto.set(pId, []);
    feristasPorPosto.get(pId)!.push({
      nome: f.colaborador || f.nome,
      chapa: f.chapaRM || f.matricula || f.chapa,
      situacao_rm: f.statusRM || "Ativo",
    });
  }

  // 3. Mapear posições por posto
  const posicoesPorPosto = new Map<string, any[]>();
  for (const pos of posicoesRev04Json as any[]) {
    const pId = pos.posto_id || pos.postoIdSGP || pos.idPosto;
    if (!posicoesPorPosto.has(pId)) posicoesPorPosto.set(pId, []);
    posicoesPorPosto.get(pId)!.push(pos);
  }

  // 4. Agrupar postos por Item PPU
  const gruposItemPPU = new Map<string, PostoArvore[]>();

  for (const p of postosDoImovel) {
    const postoId = p.postoIdSGP || p.posto_id_sgp || p.id;
    const itemPPUCodigo = String(p.itemPPU || p.item_ppu || "").trim() || "3.1";
    const regime = p.tipoPostoNome || p.regime || "Adm/09h";
    const periculosidade = (String(p.periculosidade || "").trim().toUpperCase() === "SIM" ? "SIM" : "NÃO") as "SIM" | "NÃO";
    const temPericulosidade = periculosidade === "SIM";
    const fatorMedicao = calcularFatorMedicao(periculosidade);

    const posicoesOriginais = posicoesPorPosto.get(postoId) || [];
    const posicoesArvore: PosicaoArvore[] = posicoesOriginais.map((pos) => {
      const ocupada = isPosicaoOcupada(pos, funcionariosRM);
      const codigoEstrutural = pos.codigoPosicaoEstrutural || pos.codigo_estrutural || pos.etiqueta || "1.1";
      const situacao = pos.statusRMTitular || pos.situacao_rm || null;
      const horario = pos.horario_rm || pos.horarioRm || null;
      const escala = pos.escala_tipo || pos.escalaTipo || null;
      const faixa = pos.faixa_horaria || pos.faixaHoraria || null;
      const pendente = verificarEscalaPendente(pos);

      return {
        posicao_id: pos.posicaoIdSGP || pos.posicao_id_sgp || pos.id,
        codigo_estrutural: codigoEstrutural,
        ocupada,
        titular_nome: ocupada ? pos.titularReferencia || pos.nome_titular : null,
        titular_chapa: ocupada ? pos.chapaTitular || pos.chapa_titular : null,
        horario_rm: horario,
        escala_tipo: escala,
        faixa_horaria: faixa,
        situacao_rm: situacao,
        categoria_situacao: categorizarSituacaoRM(situacao),
        escala_pendente: pendente,
        eh_vaga: !ocupada,
        motivo_vaga: !ocupada ? determinarMotivoVaga(pos) : null,
      };
    });

    const vagasCount = posicoesArvore.filter((p) => p.eh_vaga).length;
    const ocupado = isPostoOcupado(postoId, posicoesOriginais, funcionariosRM);
    const qtdPosicoes = posicoesArvore.length > 0 ? posicoesArvore.length : (p.qtdEstruturalConfirmada || obterQtdPosicoesDoRegime(regime));

    const postoArvore: PostoArvore = {
      posto_id: postoId,
      item_ppu: itemPPUCodigo,
      regime,
      qtd_posicoes: qtdPosicoes,
      periculosidade,
      tem_periculosidade: temPericulosidade,
      fator_medicao: fatorMedicao,
      posicoes: posicoesArvore,
      feristas: feristasPorPosto.get(postoId) || [],
      ocupado,
      vagas_count: vagasCount,
    };

    if (!gruposItemPPU.has(itemPPUCodigo)) gruposItemPPU.set(itemPPUCodigo, []);
    gruposItemPPU.get(itemPPUCodigo)!.push(postoArvore);
  }

  // 5. Montar lista de Itens PPU
  const itensPPUArvore: ItemPPUArvore[] = [];
  let totalPosicoes = 0;
  let totalVagas = 0;
  let totalPostosOcupados = 0;

  for (const [codigo, postosDoItem] of gruposItemPPU.entries()) {
    const catalogo = obterItemPPU(codigo);
    const descricao = catalogo?.descricao || postosDoItem[0]?.regime || `Item ${codigo}`;
    const regime = catalogo?.regime || postosDoItem[0]?.regime || "Adm/09h";

    let postosOcupados = 0;
    let vagasItem = 0;

    for (const p of postosDoItem) {
      if (p.ocupado) postosOcupados++;
      vagasItem += p.vagas_count;
      totalPosicoes += p.posicoes.length;
    }

    totalVagas += vagasItem;
    totalPostosOcupados += postosOcupados;

    itensPPUArvore.push({
      codigo,
      descricao,
      regime,
      postos: postosDoItem,
      total_postos: postosDoItem.length,
      postos_ocupados: postosOcupados,
      vagas_count: vagasItem,
    });
  }

  // Ordenar Itens PPU numericamente pelo código (ex.: 1.1, 2.1, 3.1, 3.2, 3.6, etc.)
  itensPPUArvore.sort((a, b) => {
    const numA = parseFloat(a.codigo) || 0;
    const numB = parseFloat(b.codigo) || 0;
    if (numA !== numB) return numA - numB;
    return a.codigo.localeCompare(b.codigo);
  });

  const totalPostos = postosDoImovel.length;
  const taxa = totalPostos > 0 ? totalPostosOcupados / totalPostos : 0;

  return {
    imovel: nomeOficial,
    id: imovelCadastrado?.id || nomeOficial,
    cidade: imovelCadastrado?.cidade || "",
    uf: imovelCadastrado?.uf || "",
    cidadeUf: obterCidadeUfImovel(nomeOficial),
    gerencia: imovelCadastrado?.gerencia || "COMPARTILHADO",
    preposto: imovelCadastrado?.preposto || "Não informado",
    itens_ppu: itensPPUArvore,
    total_itens_ppu: itensPPUArvore.length,
    total_postos: totalPostos,
    total_posicoes: totalPosicoes,
    total_vagas: totalVagas,
    taxa_ocupacao: taxa,
    status: imovelCadastrado?.status_imovel || "ATIVO",
  };
}

