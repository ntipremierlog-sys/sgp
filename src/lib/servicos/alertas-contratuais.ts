/**
 * SGP — Alertas contratuais do Painel (substitui a faixa "Atenção Gerencial")
 * Contrato Petrobras ICJ 5900.0129796.25.2
 *
 * Cada alerta é curto, mostra a quantidade e leva à lista filtrada correspondente
 * (/alertas?tipo=<slug>). Somente alertas com quantidade > 0 são exibidos.
 *
 *  1. Férias sem consulta à Petrobras ............ ET 9.4.1
 *  2. Substituição vencendo (7 dias úteis) ........ ET 9.4.2
 *  3. Mobilização / desmobilização (30 dias) ...... ET 9.2 e 9.3
 *  4. Admissões do RM aguardando alocação ......... 04_PENDENTES_RM + lista "A alocar"
 *  5. Escala cíclica sem fase/data-base ........... 09_PENDENCIAS_ESCALA
 *  6. Validações MC × RM pendentes ................ 05_VALIDACOES (status "A VALIDAR")
 *  7. Preposto acima de 20 profissionais .......... ET 11.1.1
 *
 * Cores: VERMELHO = prazo vencido · ÂMBAR = prazo a vencer / pendência de cadastro ·
 *        ROXO = informativo.
 *
 * Módulo PURO (sem acesso a localStorage) — os dados entram por parâmetro.
 * Nenhum CPF ou CID é lido ou exposto.
 */

import imoveisRev04Json from "@/lib/dados/imoveis-rev04.json";
import posicoesRev04Json from "@/lib/dados/posicoes-rev04.json";
import feristasRev04Json from "@/lib/dados/feristas-rev04.json";
import pendentesRmJson from "@/lib/dados/pendentes-rm-rev02.json";
import validacoesJson from "@/lib/dados/validacoes-rev02.json";
import pendenciasEscalaJson from "@/lib/dados/pendencias-escala-rev04.json";

// =============================================================================
// PARÂMETROS CONTRATUAIS
// =============================================================================

/** ET 9.4.1 — antecedência mínima da consulta à fiscalização para férias. */
export const ANTECEDENCIA_CONSULTA_FERIAS_DIAS = 60;
/** ET 9.4.2 — prazo para substituição de afastamento, em dias úteis. */
export const PRAZO_SUBSTITUICAO_DIAS_UTEIS = 7;
/** Substituição considerada "vencendo" quando restam até N dias úteis. */
export const LIMIAR_SUBSTITUICAO_VENCENDO_DIAS_UTEIS = 2;
/** ET 9.2 / 9.3 — prazo de mobilização/desmobilização (dias corridos). */
export const PRAZO_MOBILIZACAO_DIAS = 30;
/** Alerta de mobilização quando faltam até N dias corridos. */
export const LIMIAR_MOBILIZACAO_DIAS = 7;
/** ET 11.1.1 — limite de profissionais por preposto. */
export const LIMITE_PROFISSIONAIS_POR_PREPOSTO = 20;

// =============================================================================
// TIPOS
// =============================================================================

export type TipoAlertaContratual =
  | "ferias-sem-consulta"
  | "substituicao-vencendo"
  | "mobilizacao"
  | "admissoes-a-alocar"
  | "escala-sem-fase"
  | "validacoes-mc-rm"
  | "preposto-acima-limite";

export type CorAlerta = "VERMELHO" | "AMBAR" | "ROXO";
export type SituacaoItemAlerta = "VENCIDO" | "A_VENCER" | "PENDENTE" | "INFORMATIVO";

export interface ItemAlerta {
  id: string;
  titulo: string;
  unidade?: string;
  detalhe?: string;
  /** Prazo de referência (YYYY-MM-DD) quando houver */
  prazo?: string | null;
  /** Dias até o prazo (negativo = vencido). Unidade em `unidadePrazo`. */
  diasParaPrazo?: number | null;
  unidadePrazo?: "corridos" | "uteis";
  situacao: SituacaoItemAlerta;
}

export interface AlertaContratual {
  tipo: TipoAlertaContratual;
  ordem: number;
  cor: CorAlerta;
  quantidade: number;
  /** Rótulo curto (cabe no chip do Painel) */
  rotulo: string;
  /** Explicação da regra contratual */
  descricao: string;
  referencia: string;
  href: string;
  itens: ItemAlerta[];
  vencidos: number;
}

/** Ausência (subconjunto de OcorrenciaOperacional) */
export interface AusenciaParaAlerta {
  id: string;
  matricula: string;
  profissionalNome: string;
  postoCodigo?: string;
  tipoOcorrencia: string;
  categoriaAusencia?: string;
  dataInicio: string;
  dataFim?: string;
  status?: string;
  observacaoPublica?: string;
  data_consulta_petrobras?: string | null;
  substituicao_aprovada?: boolean | null;
  substituto_chapa?: string | null;
}

export interface ImovelParaAlerta {
  id?: string;
  nome: string;
  preposto?: string | null;
  status_imovel?: string;
  statusImovel?: string;
  data_comunicacao_petrobras?: string | Date | null;
  prazo_limite?: string | Date | null;
}

export interface PendenteRMParaAlerta {
  chapa?: string;
  nome: string;
  unidadeRM?: string;
  dataAdmissao?: string | number;
  motivo?: string;
  alocarNoSGP?: string;
}

export interface PessoaAAlocarParaAlerta {
  identificador?: string;
  colaborador: string;
  local?: string;
  motivo?: string;
}

export interface PendenciaEscalaParaAlerta {
  id: string;
  unidade?: string;
  posicao?: string;
  titular?: string;
  horarioRM?: string;
  dadoFaltante?: string;
  status?: string;
}

export interface ValidacaoParaAlerta {
  id: string;
  prioridade?: string;
  tipo?: string;
  unidade?: string;
  referencia?: string;
  colaboradores?: string;
  achado?: string;
  status?: string;
}

export interface EntradaAlertasContratuais {
  /** Data de referência (YYYY-MM-DD). Padrão: hoje. */
  hoje?: string;
  ausencias?: AusenciaParaAlerta[];
  imoveis?: ImovelParaAlerta[];
  pendentesRM?: PendenteRMParaAlerta[];
  pessoasAAlocar?: PessoaAAlocarParaAlerta[];
  pendenciasEscala?: PendenciaEscalaParaAlerta[];
  validacoes?: ValidacaoParaAlerta[];
  posicoes?: any[];
  feristas?: any[];
  /** Feriados (YYYY-MM-DD) desconsiderados na contagem de dias úteis */
  feriados?: string[];
}

// =============================================================================
// UTILITÁRIOS DE DATA E TEXTO
// =============================================================================

const normalizar = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

function paraData(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  const s = String(valor).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hojeISO(): string {
  return iso(new Date());
}

/** Diferença em dias corridos (b - a). */
export function diasCorridosEntre(a: string | Date, b: string | Date): number {
  const da = paraData(a);
  const db = paraData(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

function ehDiaUtil(d: Date, feriados: Set<string>): boolean {
  const dow = d.getDay();
  return dow !== 0 && dow !== 6 && !feriados.has(iso(d));
}

/** Soma N dias úteis a uma data (o dia inicial não conta). */
export function somarDiasUteis(data: string, dias: number, feriados: string[] = []): string {
  const set = new Set(feriados);
  const d = paraData(data);
  if (!d) return data;
  let restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    if (ehDiaUtil(d, set)) restantes--;
  }
  return iso(d);
}

/**
 * Dias úteis de `de` até `ate` (exclusivo do dia inicial).
 * Negativo quando `ate` é anterior a `de`.
 */
export function diasUteisEntre(de: string, ate: string, feriados: string[] = []): number {
  const set = new Set(feriados);
  const a = paraData(de);
  const b = paraData(ate);
  if (!a || !b) return 0;
  if (a.getTime() === b.getTime()) return 0;
  const sinal = b > a ? 1 : -1;
  const cursor = new Date(a);
  let total = 0;
  while (cursor.getTime() !== b.getTime()) {
    cursor.setDate(cursor.getDate() + sinal);
    if (ehDiaUtil(cursor, set)) total += sinal;
  }
  return total;
}

function chapaValida(c: unknown): string {
  const s = String(c ?? "").trim();
  if (!s || s === "-" || normalizar(s) === "SEM TITULAR") return "";
  return s;
}

// =============================================================================
// CLASSIFICAÇÃO DAS AUSÊNCIAS
// =============================================================================

function ativa(a: AusenciaParaAlerta): boolean {
  return normalizar(a.status) !== "CANCELADA";
}

export function ehFerias(a: AusenciaParaAlerta): boolean {
  return a.tipoOcorrencia === "FERIAS" || normalizar(a.categoriaAusencia).includes("FERIAS");
}

/** Afastamento que exige substituição: licença, afastamento, desligamento. */
export function ehAfastamentoComSubstituicao(a: AusenciaParaAlerta): boolean {
  if (ehFerias(a)) return false;
  const cat = normalizar(a.categoriaAusencia);
  return cat.includes("AFAST") || cat.includes("LICEN") || cat.includes("DESLIG");
}

function temSubstituto(a: AusenciaParaAlerta): boolean {
  return Boolean(chapaValida(a.substituto_chapa)) || a.substituicao_aprovada === true;
}

// =============================================================================
// REGRAS INDIVIDUAIS
// =============================================================================

/** 1. Férias a menos de 60 dias sem registro de consulta à fiscalização (ET 9.4.1). */
export function feriasSemConsulta(ausencias: AusenciaParaAlerta[], hoje: string): ItemAlerta[] {
  return ausencias
    .filter((a) => ativa(a) && ehFerias(a) && !a.data_consulta_petrobras)
    .filter((a) => {
      const dias = diasCorridosEntre(hoje, a.dataInicio);
      return dias >= 0 && dias < ANTECEDENCIA_CONSULTA_FERIAS_DIAS;
    })
    .map((a) => {
      const prazoConsulta = iso(new Date(paraData(a.dataInicio)!.getTime() - ANTECEDENCIA_CONSULTA_FERIAS_DIAS * 86_400_000));
      const diasParaInicio = diasCorridosEntre(hoje, a.dataInicio);
      return {
        id: a.id,
        titulo: `${a.profissionalNome} · chapa ${a.matricula}`,
        unidade: a.postoCodigo,
        detalhe: `Férias a partir de ${formatarDataBR(a.dataInicio)} (em ${diasParaInicio} dias) · ${
          a.substituicao_aprovada ? "substituição aprovada" : "sem substituição aprovada — desconto na medição"
        }`,
        prazo: prazoConsulta,
        diasParaPrazo: diasCorridosEntre(hoje, prazoConsulta),
        unidadePrazo: "corridos" as const,
        // A consulta deveria ter ocorrido 60 dias antes do início → prazo já vencido
        situacao: "VENCIDO" as const,
      };
    })
    .sort((x, y) => String(x.prazo).localeCompare(String(y.prazo)));
}

/** 2. Afastamento sem substituto com prazo de 7 dias úteis vencendo ou vencido (ET 9.4.2). */
export function substituicoesVencendo(
  ausencias: AusenciaParaAlerta[],
  hoje: string,
  feriados: string[] = []
): ItemAlerta[] {
  const itens: ItemAlerta[] = [];
  for (const a of ausencias) {
    if (!ativa(a) || !ehAfastamentoComSubstituicao(a) || temSubstituto(a)) continue;
    // Afastamento já encerrado não exige mais substituição
    if (a.dataFim && diasCorridosEntre(hoje, a.dataFim) < 0) continue;
    if (diasCorridosEntre(hoje, a.dataInicio) > 0) continue; // ainda não começou

    const prazo = somarDiasUteis(a.dataInicio, PRAZO_SUBSTITUICAO_DIAS_UTEIS, feriados);
    const restantes = diasUteisEntre(hoje, prazo, feriados);
    if (restantes > LIMIAR_SUBSTITUICAO_VENCENDO_DIAS_UTEIS) continue;

    itens.push({
      id: a.id,
      titulo: `${a.profissionalNome} · chapa ${a.matricula}`,
      unidade: a.postoCodigo,
      detalhe: `${a.categoriaAusencia || "Afastamento"} desde ${formatarDataBR(a.dataInicio)} · sem substituto`,
      prazo,
      diasParaPrazo: restantes,
      unidadePrazo: "uteis",
      situacao: restantes < 0 ? "VENCIDO" : "A_VENCER",
    });
  }
  return itens.sort((x, y) => (x.diasParaPrazo ?? 0) - (y.diasParaPrazo ?? 0));
}

/** 3. Imóveis EM_MOBILIZACAO / DESMOBILIZADO com prazo (30 dias) a vencer em até 7 dias ou vencido. */
export function mobilizacoesNoPrazo(imoveis: ImovelParaAlerta[], hoje: string): ItemAlerta[] {
  const itens: ItemAlerta[] = [];
  for (const im of imoveis) {
    const status = normalizar(im.status_imovel || im.statusImovel);
    if (status !== "EM_MOBILIZACAO" && status !== "DESMOBILIZADO") continue;

    let prazo = im.prazo_limite ? iso(paraData(im.prazo_limite as any)!) : null;
    if (!prazo && im.data_comunicacao_petrobras) {
      const base = paraData(im.data_comunicacao_petrobras as any);
      if (base) {
        base.setDate(base.getDate() + PRAZO_MOBILIZACAO_DIAS);
        prazo = iso(base);
      }
    }
    if (!prazo) continue;

    const dias = diasCorridosEntre(hoje, prazo);
    if (dias > LIMIAR_MOBILIZACAO_DIAS) continue;

    itens.push({
      id: im.id || im.nome,
      titulo: im.nome,
      unidade: im.nome,
      detalhe: status === "EM_MOBILIZACAO" ? "Em mobilização" : "Desmobilização",
      prazo,
      diasParaPrazo: dias,
      unidadePrazo: "corridos",
      situacao: dias < 0 ? "VENCIDO" : "A_VENCER",
    });
  }
  return itens.sort((x, y) => (x.diasParaPrazo ?? 0) - (y.diasParaPrazo ?? 0));
}

/** 4. Admissões do RM aguardando alocação (04_PENDENTES_RM + "A alocar" da MC, sem duplicar). */
export function admissoesAguardandoAlocacao(
  pendentesRM: PendenteRMParaAlerta[],
  pessoasAAlocar: PessoaAAlocarParaAlerta[],
  posicoes: any[]
): ItemAlerta[] {
  const chapasAlocadas = new Set(
    posicoes.map((p) => chapaValida(p.chapaTitular ?? p.chapa_titular)).filter(Boolean)
  );
  const vistos = new Set<string>();
  const itens: ItemAlerta[] = [];

  const registrar = (chave: string[], item: ItemAlerta) => {
    const chaves = chave.filter(Boolean);
    if (chaves.some((k) => vistos.has(k))) return;
    chaves.forEach((k) => vistos.add(k));
    itens.push(item);
  };

  for (const p of pendentesRM) {
    const chapa = chapaValida(p.chapa);
    const status = normalizar(p.alocarNoSGP);
    if (status === "ALOCADO" || status === "RESOLVIDO") continue;
    if (chapa && chapasAlocadas.has(chapa)) continue;
    registrar([chapa && `C:${chapa}`, `N:${normalizar(p.nome)}`], {
      id: `RM-${chapa || normalizar(p.nome)}`,
      titulo: `${p.nome}${chapa ? ` · chapa ${chapa}` : ""}`,
      unidade: p.unidadeRM,
      detalhe: p.motivo || "Admissão no RM sem posição no SGP",
      situacao: "PENDENTE",
    });
  }

  for (const p of pessoasAAlocar) {
    const id = chapaValida(p.identificador);
    if (id && chapasAlocadas.has(id)) continue;
    registrar([id && `C:${id}`, `N:${normalizar(p.colaborador)}`], {
      id: `MC-${id || normalizar(p.colaborador)}`,
      titulo: `${p.colaborador}${id ? ` · ID ${id}` : ""}`,
      unidade: p.local,
      detalhe: p.motivo || 'Lista "A alocar" da MC',
      situacao: "PENDENTE",
    });
  }

  return itens;
}

const STATUS_RESOLVIDO = new Set(["RESOLVIDO", "RESOLVIDA", "VALIDADO", "VALIDADA", "CONCLUIDO", "CONCLUIDA", "OK"]);

/** 5. Posições com escala cíclica sem fase/data-base (09_PENDENCIAS_ESCALA). */
export function escalasSemFase(pendencias: PendenciaEscalaParaAlerta[]): ItemAlerta[] {
  return pendencias
    .filter((p) => !STATUS_RESOLVIDO.has(normalizar(p.status)))
    .map((p) => ({
      id: p.id,
      titulo: `Posição ${p.posicao ?? "—"}${p.titular ? ` · ${p.titular}` : ""}`,
      unidade: p.unidade,
      detalhe: `${p.horarioRM ?? ""}${p.dadoFaltante ? ` · falta: ${p.dadoFaltante}` : ""}`.trim(),
      situacao: "PENDENTE" as const,
    }));
}

/** 6. Validações MC × RM com status "A VALIDAR" (05_VALIDACOES). */
export function validacoesPendentes(validacoes: ValidacaoParaAlerta[]): ItemAlerta[] {
  return validacoes
    .filter((v) => normalizar(v.status) === "A VALIDAR")
    .map((v) => ({
      id: v.id,
      titulo: `${v.id} · ${v.colaboradores || v.referencia || ""}`.trim(),
      unidade: v.unidade,
      detalhe: `${v.prioridade ? `[${v.prioridade}] ` : ""}${v.achado ?? ""}`,
      situacao: "PENDENTE" as const,
    }));
}

/** Quantidade de prepostos num campo (ex.: "Juliana ... e Daniela Wood" = 2). */
export function contarPrepostos(preposto: string): number {
  const partes = String(preposto || "")
    .split(/\s+e\s+|\/|;|,|&/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return Math.max(1, partes.length);
}

/** 7. Grupos (preposto → imóveis) acima de 20 profissionais por preposto (ET 11.1.1). */
export function prepostosAcimaDoLimite(
  imoveis: ImovelParaAlerta[],
  posicoes: any[],
  feristas: any[]
): ItemAlerta[] {
  const prepostoPorImovel = new Map<string, string>();
  for (const im of imoveis) {
    if (im.preposto) prepostoPorImovel.set(normalizar(im.nome), String(im.preposto).trim());
  }

  const grupos = new Map<string, { nome: string; imoveis: Set<string>; pessoas: Set<string> }>();
  const adicionar = (unidade: string, pessoa: string) => {
    const preposto = prepostoPorImovel.get(normalizar(unidade));
    if (!preposto || !pessoa) return;
    const chave = normalizar(preposto);
    if (!grupos.has(chave)) grupos.set(chave, { nome: preposto, imoveis: new Set(), pessoas: new Set() });
    const g = grupos.get(chave)!;
    g.imoveis.add(String(unidade).trim());
    g.pessoas.add(pessoa);
  };

  for (const p of posicoes) {
    const chapa = chapaValida(p.chapaTitular ?? p.chapa_titular);
    if (chapa) adicionar(p.unidade ?? p.imovel ?? "", `C:${chapa}`);
  }
  for (const f of feristas) {
    const chapa = chapaValida(f.chapaRM ?? f.chapa) || normalizar(f.colaborador ?? f.nome);
    adicionar(f.unidade ?? "", `C:${chapa}`);
  }

  const itens: Array<ItemAlerta & { _carga: number }> = [];
  for (const [chave, g] of grupos) {
    const qtdPrepostos = contarPrepostos(g.nome);
    const porPreposto = g.pessoas.size / qtdPrepostos;
    if (porPreposto <= LIMITE_PROFISSIONAIS_POR_PREPOSTO) continue;
    itens.push({
      id: `PREP-${chave}`,
      titulo: g.nome,
      unidade: Array.from(g.imoveis).sort().join(", "),
      detalhe: `${g.pessoas.size} profissionais${
        qtdPrepostos > 1 ? ` / ${qtdPrepostos} prepostos = ${Math.round(porPreposto)} por preposto` : ""
      } (limite ${LIMITE_PROFISSIONAIS_POR_PREPOSTO})`,
      diasParaPrazo: null,
      situacao: "INFORMATIVO",
      _carga: porPreposto,
    });
  }
  return itens
    .sort((a, b) => b._carga - a._carga)
    .map(({ _carga, ...item }) => item);
}

// =============================================================================
// CONSOLIDAÇÃO
// =============================================================================

export const DEFINICOES_ALERTAS: Record<
  TipoAlertaContratual,
  { ordem: number; rotulo: (n: number) => string; descricao: string; referencia: string; corBase: CorAlerta }
> = {
  "ferias-sem-consulta": {
    ordem: 1,
    rotulo: (n) => `${n} ${n === 1 ? "férias sem consulta" : "férias sem consulta"} à Petrobras`,
    descricao:
      "Férias programadas a menos de 60 dias sem registro de consulta à fiscalização. Sem substituição aprovada, há desconto na medição.",
    referencia: "ET 9.4.1",
    corBase: "VERMELHO",
  },
  "substituicao-vencendo": {
    ordem: 2,
    rotulo: (n) => `${n} ${n === 1 ? "substituição vencendo" : "substituições vencendo"}`,
    descricao: "Afastamento (licença, desligamento etc.) sem substituto com prazo de 7 dias úteis vencendo ou vencido.",
    referencia: "ET 9.4.2",
    corBase: "AMBAR",
  },
  mobilizacao: {
    ordem: 3,
    rotulo: (n) => `${n} ${n === 1 ? "mobilização/desmobilização" : "mobilizações/desmobilizações"} no prazo`,
    descricao: "Imóveis em mobilização ou desmobilização com prazo de 30 dias corridos a vencer em até 7 dias ou vencido.",
    referencia: "ET 9.2 e 9.3",
    corBase: "AMBAR",
  },
  "admissoes-a-alocar": {
    ordem: 4,
    rotulo: (n) => `${n} ${n === 1 ? "admissão aguardando" : "admissões aguardando"} alocação`,
    descricao: 'Admissões do RM sem posição no SGP (04_PENDENTES_RM + lista "A alocar" da MC).',
    referencia: "04_PENDENTES_RM",
    corBase: "AMBAR",
  },
  "escala-sem-fase": {
    ordem: 5,
    rotulo: (n) => `${n} ${n === 1 ? "posição" : "posições"} com escala sem fase/data-base`,
    descricao: "Posições com escala cíclica sem grupo/fase de revezamento ou data-base.",
    referencia: "09_PENDENCIAS_ESCALA",
    corBase: "AMBAR",
  },
  "validacoes-mc-rm": {
    ordem: 6,
    rotulo: (n) => `${n} ${n === 1 ? "validação" : "validações"} MC × RM`,
    descricao: 'Validações MC × RM com status "A VALIDAR".',
    referencia: "05_VALIDACOES",
    corBase: "AMBAR",
  },
  "preposto-acima-limite": {
    ordem: 7,
    rotulo: (n) => `${n} ${n === 1 ? "preposto" : "prepostos"} acima de 20 profissionais`,
    descricao: "Imóveis/grupos acima de 20 profissionais por preposto.",
    referencia: "ET 11.1.1",
    corBase: "ROXO",
  },
};

export const TIPOS_ALERTA_ORDENADOS = (Object.keys(DEFINICOES_ALERTAS) as TipoAlertaContratual[]).sort(
  (a, b) => DEFINICOES_ALERTAS[a].ordem - DEFINICOES_ALERTAS[b].ordem
);

export function ehTipoAlertaValido(v: string | null | undefined): v is TipoAlertaContratual {
  return Boolean(v && v in DEFINICOES_ALERTAS);
}

function montarAlerta(tipo: TipoAlertaContratual, itens: ItemAlerta[]): AlertaContratual {
  const def = DEFINICOES_ALERTAS[tipo];
  const vencidos = itens.filter((i) => i.situacao === "VENCIDO").length;
  const cor: CorAlerta = def.corBase === "ROXO" ? "ROXO" : vencidos > 0 ? "VERMELHO" : "AMBAR";
  return {
    tipo,
    ordem: def.ordem,
    cor,
    quantidade: itens.length,
    rotulo: def.rotulo(itens.length),
    descricao: def.descricao,
    referencia: def.referencia,
    href: `/alertas?tipo=${tipo}`,
    itens,
    vencidos,
  };
}

/**
 * Calcula TODOS os alertas (inclusive os zerados). Use `filtrarAlertasVisiveis`
 * para exibir somente os que tiverem quantidade > 0.
 * Campos não informados assumem a carga oficial da REV04.
 */
export function calcularAlertasContratuais(entrada: EntradaAlertasContratuais = {}): AlertaContratual[] {
  const hoje = entrada.hoje || hojeISO();
  const ausencias = entrada.ausencias ?? [];
  const imoveis = entrada.imoveis ?? (imoveisRev04Json as ImovelParaAlerta[]);
  const posicoes = entrada.posicoes ?? (posicoesRev04Json as any[]);
  const feristas = entrada.feristas ?? (feristasRev04Json as any[]);
  const pendentesRM = entrada.pendentesRM ?? (pendentesRmJson as PendenteRMParaAlerta[]);
  const pessoasAAlocar = entrada.pessoasAAlocar ?? [];
  const pendenciasEscala = entrada.pendenciasEscala ?? (pendenciasEscalaJson as PendenciaEscalaParaAlerta[]);
  const validacoes = entrada.validacoes ?? (validacoesJson as ValidacaoParaAlerta[]);
  const feriados = entrada.feriados ?? [];

  return [
    montarAlerta("ferias-sem-consulta", feriasSemConsulta(ausencias, hoje)),
    montarAlerta("substituicao-vencendo", substituicoesVencendo(ausencias, hoje, feriados)),
    montarAlerta("mobilizacao", mobilizacoesNoPrazo(imoveis, hoje)),
    montarAlerta("admissoes-a-alocar", admissoesAguardandoAlocacao(pendentesRM, pessoasAAlocar, posicoes)),
    montarAlerta("escala-sem-fase", escalasSemFase(pendenciasEscala)),
    montarAlerta("validacoes-mc-rm", validacoesPendentes(validacoes)),
    montarAlerta("preposto-acima-limite", prepostosAcimaDoLimite(imoveis, posicoes, feristas)),
  ];
}

export function filtrarAlertasVisiveis(alertas: AlertaContratual[]): AlertaContratual[] {
  return alertas.filter((a) => a.quantidade > 0);
}

export function formatarDataBR(data?: string | null): string {
  if (!data) return "—";
  const m = String(data).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(data);
}
