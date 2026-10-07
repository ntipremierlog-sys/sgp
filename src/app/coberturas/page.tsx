"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  UserCheck2,
  UserPlus,
  Search,
  Plus,
  ShieldCheck,
  CheckCircle2,
  X,
  ArrowRight,
  Copy,
  LayoutGrid,
  List,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Ban,
  Pencil,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Layers,
  HelpCircle,
  Lock,
} from "lucide-react";
import {
  carregarEstado,
  adicionarCobertura,
  atualizarCobertura,
  cancelarCobertura,
  excluirCobertura,
  trocarTitularPosto,
  obterTodosPostosContrato,
  obterMarcacoesPonto,
  obterCompetenciaCongeladaNoPeriodo,
  verificarConflitosCobertura,
  obterAlocacaoVigenteVaga,
  CoberturaOperacional,
  PostoOperacional,
  ProfissionalOperacional,
  VagaPosto,
  AlocacaoVaga,
  OcorrenciaOperacional,
} from "@/lib/dados/estado-operacional";
import { MarcacaoPontoOriginal } from "@/lib/dados/ponto-tipos";
import { useSessaoUsuario } from "@/lib/auth/use-sessao-usuario";
import { podeVerDadosPessoaisCompletos } from "@/lib/dados/rm-tipos";
import { ItemAlocadoSifac } from "@/lib/dados/conciliacao-sifac";
import { VAGAS_MC_REAIS, ALOCACOES_MC_REAIS, FERISTAS_REV04 } from "@/lib/dados/estrutura-postos";
import { validarInterjornadaClt } from "@/lib/servicos/validacao-interjornada";
import { obterPeriodoCompetencia } from "@/lib/servicos/calendario-competencia";

// =============================================================================
// TIPOS E UTILITÁRIOS
// =============================================================================

export type CategoriaJustificativa =
  | "Falta"
  | "Férias"
  | "Folga"
  | "Afastamento"
  | "Outros";

export interface InfoJustificativa {
  categoria: CategoriaJustificativa;
  rotuloExibicao: string;
  classeBadge: string;
  classeBarra: string;
  textoCompletoSeguro: string;
}

const DIAS_SEMANA_ABREV = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES_NOMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatarDataBr(dataStr?: string): string {
  if (!dataStr) return "—";
  const partes = dataStr.split("-");
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataStr;
}

function formatarDataComDiaSemana(dataIso: string): string {
  if (!dataIso) return "—";
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  if (!ano || !mes || !dia) return dataIso;
  const d = new Date(ano, mes - 1, dia);
  const diaSemana = DIAS_SEMANA_ABREV[d.getDay()] || "";
  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  return `${diaSemana} ${dd}/${mm}`;
}

function formatarPeriodoResumido(dataInicio: string, dataFim: string): string {
  if (!dataInicio) return "—";
  if (!dataFim || dataInicio === dataFim) {
    return formatarDataComDiaSemana(dataInicio);
  }
  const [, m1, d1] = dataInicio.split("-");
  const [, m2, d2] = dataFim.split("-");
  return `${d1}/${m1} a ${d2}/${m2}`;
}

function formatarMesAnoExtenso(comp: string): string {
  if (!comp) return "";
  const [ano, mes] = comp.split("-").map(Number);
  if (!ano || !mes) return comp;
  const nomeMes = MESES_NOMES[mes - 1] || String(mes);
  return `${nomeMes}/${ano}`;
}

function obterCompetenciaAnterior(comp: string): string {
  if (!comp || !comp.includes("-")) return "";
  const [ano, mes] = comp.split("-").map(Number);
  if (mes === 1) {
    return `${ano - 1}-12`;
  }
  return `${ano}-${String(mes - 1).padStart(2, "0")}`;
}

function formatarTexto(str?: string): string {
  if (!str) return "—";
  const trim = str.trim();
  if (/^PST-[A-Z0-9-]+$/i.test(trim)) return trim.toUpperCase();
  if (/^UFN-[A-Z0-9-]+$/i.test(trim)) return trim.toUpperCase();
  if (/^PRM-[A-Z0-9-]+$/i.test(trim)) return trim.toUpperCase();

  const preposicoes = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "com", "na", "no"]);
  const romanos = new Set(["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]);

  const textoLimpo = trim.replace(/_/g, " ");
  return textoLimpo
    .toLowerCase()
    .split(/\s+/)
    .map((palavra, idx) => {
      if (romanos.has(palavra)) return palavra.toUpperCase();
      if (idx > 0 && preposicoes.has(palavra)) return palavra;
      if (palavra === "lider") return "Líder";
      if (palavra === "logistica") return "Logística";
      if (palavra === "veiculo") return "Veículo";
      if (palavra === "operacoes") return "Operações";
      if (palavra === "tecnico") return "Técnico";
      if (palavra === "seguranca") return "Segurança";
      if (palavra === "medico") return "Médico";
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}

function formatarNome(nome?: string): string {
  if (!nome) return "—";
  return formatarTexto(nome);
}

function obterIniciais(nome: string): string {
  const partes = (nome || "").trim().split(/\s+/);
  if (!partes[0]) return "--";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function calcularDias(inicio: string, fim: string): number {
  if (!inicio || !fim) return 1;
  const d1 = new Date(inicio + "T00:00:00");
  const d2 = new Date(fim + "T00:00:00");
  const diffTime = d2.getTime() - d1.getTime();
  if (isNaN(diffTime) || diffTime < 0) return 0;
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function limitesCompetencia(comp: string): { inicio: string; fim: string; diasNoMes: number; datas: string[] } {
  if (!comp || !comp.includes("-")) {
    const hoje = hojeISO();
    return { inicio: hoje, fim: hoje, diasNoMes: 30, datas: [hoje] };
  }
  const periodo = obterPeriodoCompetencia(comp);
  if (periodo && periodo.dataInicio && periodo.dataFim && periodo.datas && periodo.datas.length > 0) {
    return {
      inicio: periodo.dataInicio,
      fim: periodo.dataFim,
      diasNoMes: periodo.datas.length,
      datas: periodo.datas,
    };
  }
  const [ano, mes] = comp.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const datas: string[] = [];
  for (let d = 1; d <= ultimoDia; d++) {
    datas.push(`${comp}-${String(d).padStart(2, "0")}`);
  }
  return {
    inicio: `${comp}-01`,
    fim: `${comp}-${String(ultimoDia).padStart(2, "0")}`,
    diasNoMes: ultimoDia,
    datas,
  };
}

export interface ItemDescobertoPainel {
  id: string;
  postoCodigo: string;
  funcaoPosto: string;
  base: string;
  vagaId: string;
  posicaoRotulo: string;
  titularNome: string;
  titularMatricula: string;
  data: string;
  motivo: string;
  categoria: CategoriaJustificativa;
  ocorrenciaId?: string;
}

/** Estilo visual e rótulos por categoria de justificativa/ausência. */
function obterEstiloCategoria(
  categoria: CategoriaJustificativa,
  ehFiscalPetrobras?: boolean
): { rotuloExibicao: string; classeBadge: string; classeBarra: string } {
  if (categoria === "Afastamento" && ehFiscalPetrobras) {
    return {
      rotuloExibicao: "Afastamento justificado",
      classeBadge: "bg-purple-50 text-purple-800 border-purple-200",
      classeBarra: "bg-purple-500",
    };
  }

  switch (categoria) {
    case "Férias":
      return {
        rotuloExibicao: "Férias",
        classeBadge: "bg-blue-50 text-blue-700 border-blue-200",
        classeBarra: "bg-blue-500",
      };
    case "Afastamento":
      return {
        rotuloExibicao: "Afastamento",
        classeBadge: "bg-purple-50 text-purple-700 border-purple-200",
        classeBarra: "bg-purple-500",
      };
    case "Falta":
      return {
        rotuloExibicao: "Falta",
        classeBadge: "bg-rose-100 text-rose-800 border-rose-200",
        classeBarra: "bg-rose-500",
      };
    case "Folga":
      return {
        rotuloExibicao: "Folga",
        classeBadge: "bg-slate-100 text-slate-700 border-slate-200",
        classeBarra: "bg-slate-400",
      };
    case "Outros":
    default:
      return {
        rotuloExibicao: "Outros",
        classeBadge: "bg-slate-100 text-slate-600 border-slate-200",
        classeBarra: "bg-slate-300",
      };
  }
}

/** Classificação por categoria e tratamento estrito de LGPD para Perfil Fiscal Petrobras. */
function categorizarJustificativa(
  justificativaOriginal?: string | null,
  titularNome?: string | null,
  ehFiscalPetrobras?: boolean
): InfoJustificativa {
  const texto = (justificativaOriginal || "").trim();
  const textoLower = texto.toLowerCase();

  let categoria: CategoriaJustificativa = "Outros";

  // 1. Verificação se o texto já é o próprio nome da categoria
  if (textoLower === "férias" || textoLower === "ferias") {
    categoria = "Férias";
  } else if (textoLower === "afastamento" || textoLower === "afastamento justificado") {
    categoria = "Afastamento";
  } else if (textoLower === "falta") {
    categoria = "Falta";
  } else if (textoLower === "folga") {
    categoria = "Folga";
  } else if (textoLower === "outros") {
    categoria = "Outros";
  } else {
    // 2. Classificação semântica por prioridade
    const ehFerias = textoLower.includes("férias") || textoLower.includes("ferias");

    const ehAfastamentoOuMedico =
      textoLower.includes("atestado") ||
      textoLower.includes("médic") ||
      textoLower.includes("medic") ||
      textoLower.includes("cid") ||
      textoLower.includes("saúde") ||
      textoLower.includes("saude") ||
      textoLower.includes("licença") ||
      textoLower.includes("licenca") ||
      textoLower.includes("afastamento");

    const ehFalta =
      textoLower.includes("falta") ||
      textoLower.includes("injustificada") ||
      textoLower.includes("ausência injustificada");

    const ehFolga =
      textoLower.includes("folga") ||
      textoLower.includes("compensatória") ||
      textoLower.includes("compensatoria") ||
      textoLower.includes("compensação");

    if (ehFerias) {
      categoria = "Férias";
    } else if (ehAfastamentoOuMedico) {
      categoria = "Afastamento";
    } else if (ehFalta) {
      categoria = "Falta";
    } else if (ehFolga) {
      categoria = "Folga";
    } else {
      categoria = "Outros";
    }
  }

  const estilo = obterEstiloCategoria(categoria, ehFiscalPetrobras);

  // LGPD Fiscal Petrobras: motivos médicos aparecem só como "Afastamento justificado". Nunca exibir CID, diagnóstico ou atestado.
  const ehAfastamentoOuMedico =
    categoria === "Afastamento" ||
    textoLower.includes("atestado") ||
    textoLower.includes("médic") ||
    textoLower.includes("medic") ||
    textoLower.includes("cid") ||
    textoLower.includes("saúde") ||
    textoLower.includes("saude");

  if (ehFiscalPetrobras && ehAfastamentoOuMedico) {
    return {
      categoria: "Afastamento",
      rotuloExibicao: "Afastamento justificado",
      classeBadge: estilo.classeBadge,
      classeBarra: estilo.classeBarra,
      textoCompletoSeguro: "Afastamento justificado (Dados médicos protegidos por sigilo legal e LGPD)",
    };
  }

  return {
    categoria,
    rotuloExibicao: estilo.rotuloExibicao,
    classeBadge: estilo.classeBadge,
    classeBarra: estilo.classeBarra,
    textoCompletoSeguro: texto || estilo.rotuloExibicao,
  };
}

function obterBasePosto(
  cob: CoberturaOperacional,
  mapaBases: Map<string, string>
): { base: string; semBase: boolean } {
  const chave = cob.postoCodigo || cob.idPosto || "";
  let base = mapaBases.get(chave) || (cob.idPosto ? mapaBases.get(cob.idPosto) : "") || "";
  if (!base && cob.titularMatricula) {
    base = mapaBases.get(`MATR_${cob.titularMatricula}`) || "";
  }
  if (!base && cob.substitutoMatricula) {
    base = mapaBases.get(`MATR_${cob.substitutoMatricula}`) || "";
  }
  if (!base || !base.trim()) {
    return { base: "Sem base", semBase: true };
  }
  return { base: formatarTexto(base), semBase: false };
}

function obterPosicoesDoPosto(posto: PostoOperacional | undefined, vagas: VagaPosto[]): VagaPosto[] {
  if (!posto) return [];
  const ids = [
    posto.idPosto,
    posto.id,
    posto.postoIdSGP,
    posto.codigoPosto,
    posto.idReferencia !== undefined && posto.idReferencia !== null ? String(posto.idReferencia) : undefined,
  ].filter(Boolean) as string[];
  for (const id of ids) {
    const lista = vagas.filter((v) =>
      [v.idPosto, v.postoIdSGP, v.postoBase].some((ch) => ch !== undefined && ch !== null && String(ch) === id)
    );
    if (lista.length > 0) return [...lista].sort((a, b) => a.sequencia - b.sequencia);
  }
  return [];
}

const MODALIDADES_NOMES: Record<string, string> = {
  SUBSTITUICAO_INTERNA: "Reserva Técnica (Padrão)",
  REMANEJAMENTO_ENTRE_POSTOS: "Remanejamento",
  HORA_EXTRA_TITULAR_OUTRO_POSTO: "Hora Extra",
  CONTRATACAO_TEMPORARIA: "Contratação Temp.",
};

type CampoOrdenacao =
  | "posto"
  | "base"
  | "titular"
  | "substituto"
  | "data"
  | "dias"
  | "modalidade"
  | "justificativa";

const ITENS_POR_PAGINA_OPCOES = [25, 50, 100];

const SUGESTOES_JUSTIFICATIVA = [
  "Férias do Titular",
  "Atestado Médico",
  "Licença / Afastamento Legal",
  "Folga Compensatória",
  "Falta Injustificada",
  "Treinamento / Reciclagem",
  "Posto Vago (Aguardando Admissão)",
  "Remanejamento Operacional",
];

// Interface para agrupamento na tabela
interface GrupoTabela {
  chave: string;
  substitutoMatricula: string;
  substitutoNome: string;
  postoCodigo: string;
  funcaoPosto: string;
  base: string;
  semBase: boolean;
  itens: CoberturaOperacional[];
  totalDiasNoMes: number;
  totalDiasGeral: number;
  dataInicioMaisAntiga: string;
  dataFimMaisRecente: string;
  datasResumidas: string;
  temAlertaClt: boolean;
  modalidadesDistintas: string[];
  titularesDistintos: string[];
  categoriaDominante: CategoriaJustificativa;
  categoriaRotulo: string;
  categoriaClasse: string;
  todasReservaTecnica: boolean;
}

// Filtro ativo a partir dos cards clicáveis
type FiltroCardAtivo = "TODOS" | "DESCOBERTOS" | "RESERVA_TECNICA" | "ALERTAS_CLT";

export default function CoberturasPage() {
  const { perfil, carregando: sessaoCarregando } = useSessaoUsuario();
  const ehFiscalPetrobras = !podeVerDadosPessoaisCompletos(perfil);

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [coberturas, setCoberturas] = useState<CoberturaOperacional[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  const [vagas, setVagas] = useState<VagaPosto[]>([]);
  const [alocacoes, setAlocacoes] = useState<AlocacaoVaga[]>([]);
  const [marcacoesPonto, setMarcacoesPonto] = useState<MarcacaoPontoOriginal[]>([]);
  const [alocadosSifac, setAlocadosSifac] = useState<ItemAlocadoSifac[]>([]);

  // Filtros Globais
  const [competenciaRelatorio, setCompetenciaRelatorio] = useState(() => hojeISO().slice(0, 7));
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODAS" | "ALERTA_CLT">("TODAS");
  const [filtroBase, setFiltroBase] = useState<string>("TODAS");
  const [filtroModalidade, setFiltroModalidade] = useState<string>("TODAS");
  const [filtroCardAtivo, setFiltroCardAtivo] = useState<FiltroCardAtivo>("TODOS");
  const [modoVisualizacao, setModoVisualizacao] = useState<"CARDS" | "TABELA">("TABELA");

  // Ordenação e Paginação da Tabela
  const [ordenacao, setOrdenacao] = useState<{ campo: CampoOrdenacao; direcao: "asc" | "desc" }>({
    campo: "data",
    direcao: "desc",
  });
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);

  // Painel lateral e grupos expandidos
  const [coberturaPainel, setCoberturaPainel] = useState<CoberturaOperacional | null>(null);
  const [modalDescobertosAberto, setModalDescobertosAberto] = useState(false);
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());

  // Tooltip do Mapa de Calor
  const [tooltipHeatmap, setTooltipHeatmap] = useState<{
    visivel: boolean;
    x: number;
    y: number;
    posto: string;
    funcao: string;
    base: string;
    data: string;
    status: "COBERTO" | "DESCOBERTO" | "NORMAL";
    titular?: string;
    substituto?: string;
    motivo?: string;
  } | null>(null);

  // Controles e filtros exclusivos do Mapa de Calor (Heatmap)
  const [modoHeatmap, setModoHeatmap] = useState<"APENAS_COBERTURAS" | "TODOS_POSTOS">("APENAS_COBERTURAS");
  const [buscaHeatmap, setBuscaHeatmap] = useState("");

  // Relatório mensal XLSX
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);

  // Modais de Inclusão / Edição
  const [modalAberto, setModalAberto] = useState(false);
  const [coberturaEmEdicao, setCoberturaEmEdicao] = useState<CoberturaOperacional | null>(null);
  const [formPostoCodigo, setFormPostoCodigo] = useState("");
  const [formVagaId, setFormVagaId] = useState("");
  const [formSubstitutoMatricula, setFormSubstitutoMatricula] = useState("");
  const [formDataInicio, setFormDataInicio] = useState(() => hojeISO());
  const [formDataFim, setFormDataFim] = useState(() => hojeISO());
  const [formTipo, setFormTipo] = useState<CoberturaOperacional["tipoCobertura"]>("SUBSTITUICAO_INTERNA");
  const [formJustificativa, setFormJustificativa] = useState("");
  const [efetivarTrocaPermanente, setEfetivarTrocaPermanente] = useState(false);
  const [cienteInterjornada, setCienciaInterjornada] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const alternarExpansaoGrupo = (chave: string) => {
    setGruposExpandidos((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  };

  const inserirMotivoJustificativa = (motivo: string) => {
    setFormJustificativa((prev) => {
      const limpo = prev.trim();
      if (!limpo) return motivo;
      if (limpo.toLowerCase().includes(motivo.toLowerCase())) return limpo;
      return `${limpo} • ${motivo}`;
    });
  };

  const abrirModalIncluir = (
    postoPadrao?: string,
    dataPadrao?: string,
    vagaPadrao?: string,
    dataFimPadrao?: string,
    justificativaPadrao?: string
  ) => {
    setCoberturaEmEdicao(null);
    setFormPostoCodigo(postoPadrao || "");
    setFormVagaId(vagaPadrao || "");
    setFormSubstitutoMatricula("");
    setFormDataInicio(dataPadrao || hojeISO());
    setFormDataFim(dataFimPadrao || dataPadrao || hojeISO());
    setFormTipo("SUBSTITUICAO_INTERNA");
    setFormJustificativa(justificativaPadrao ? `Cobertura de ausência: ${justificativaPadrao}` : "");
    setEfetivarTrocaPermanente(false);
    setCienciaInterjornada(false);
    setModalAberto(true);
  };

  const abrirModalEditar = (cob: CoberturaOperacional) => {
    setCoberturaEmEdicao(cob);
    setFormPostoCodigo(cob.postoCodigo);
    setFormVagaId(cob.vagaId || "");
    setFormSubstitutoMatricula(cob.substitutoMatricula);
    setFormDataInicio(cob.dataInicio);
    setFormDataFim(cob.dataFim);
    setFormTipo(cob.tipoCobertura);
    setFormJustificativa(cob.justificativa || "");
    setEfetivarTrocaPermanente(false);
    setCienciaInterjornada(cob.alertaInterjornada || false);
    setCoberturaPainel(null);
    setModalAberto(true);
  };

  const carregarDados = () => {
    setCarregandoDados(true);
    try {
      const estado = carregarEstado();
      setCoberturas(estado.coberturas || []);
      setOcorrencias(estado.ocorrencias || []);
      setPostos(obterTodosPostosContrato(estado.postos));
      setProfissionais(estado.profissionais || []);
      setVagas(estado.vagas && estado.vagas.length > 0 ? estado.vagas : VAGAS_MC_REAIS);
      setAlocacoes(estado.alocacoes && estado.alocacoes.length > 0 ? estado.alocacoes : ALOCACOES_MC_REAIS);
      setMarcacoesPonto(obterMarcacoesPonto());
      setAlocadosSifac(estado.alocadosSifac || []);

      // Se a competência selecionada ainda for o mês calendário atual ("2026-10") ou não houver dados,
      // inicializa com a competência mais recente disponível nos lotes ou ocorrências (ex: "2026-09")
      const compLotes = estado.lotesImportacao?.find((l) => l.competencia && l.status === "CONCLUIDO")?.competencia;
      const compOcorr = estado.ocorrencias?.[0]?.dataInicio?.slice(0, 7);
      const compSugerida = compLotes || (compOcorr === "2026-08" ? "2026-09" : compOcorr) || "2026-09";
      setCompetenciaRelatorio((prev) => (prev === hojeISO().slice(0, 7) || !prev ? compSugerida : prev));
    } finally {
      setCarregandoDados(false);
    }
  };

  useEffect(() => {
    carregarDados();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const postoParam = params.get("posto");
      const dataParam = params.get("data");
      const vagaParam = params.get("vaga");
      const buscaParam = params.get("busca");
      const editarParam = params.get("editar");
      if (editarParam) {
        const estadoAtual = carregarEstado();
        const cobAlvo = estadoAtual.coberturas.find((c) => c.id === editarParam);
        if (cobAlvo) {
          abrirModalEditar(cobAlvo);
        }
      } else if (postoParam) {
        abrirModalIncluir(postoParam, dataParam || undefined, vagaParam || undefined);
      }
      if (buscaParam) {
        setBusca(buscaParam);
      }
    }
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // Validação reativa de Interjornada CLT Art. 66 no formulário
  const validacaoInterjornada = useMemo(() => {
    if (!formSubstitutoMatricula || !formPostoCodigo || !formDataInicio) return null;
    return validarInterjornadaClt({
      matricula: formSubstitutoMatricula,
      dataInicio: formDataInicio,
      postoDestinoCodigo: formPostoCodigo,
      postos,
      profissionais,
      coberturas,
      marcacoesPonto,
    });
  }, [formSubstitutoMatricula, formPostoCodigo, formDataInicio, postos, profissionais, coberturas, marcacoesPonto]);

  useEffect(() => {
    setCienciaInterjornada(false);
  }, [formSubstitutoMatricula, formPostoCodigo, formDataInicio]);

  // Posições do posto no formulário
  const posicoesDoPostoForm = useMemo(() => {
    const posto = postos.find((p) => p.codigoPosto === formPostoCodigo || p.id === formPostoCodigo);
    return obterPosicoesDoPosto(posto, vagas).map((v) => {
      const aloc = obterAlocacaoVigenteVaga(v.id, alocacoes, formDataInicio || hojeISO());
      const matricula = (aloc?.matricula || v.chapaTitular || "").trim();
      const prof = matricula ? profissionais.find((pr) => pr.matricula === matricula) : undefined;
      const nome = prof?.nome || (aloc as { nomeProfissional?: string } | undefined)?.nomeProfissional || v.titularReferencia || "";
      const rotulo = v.codigoPosicaoEstrutural || v.etiqueta || v.codigoVisual || `Posição ${v.sequencia}`;
      return { vaga: v, rotulo, titularMatricula: matricula, titularNome: nome };
    });
  }, [postos, vagas, alocacoes, profissionais, formPostoCodigo, formDataInicio]);

  useEffect(() => {
    if (formVagaId && posicoesDoPostoForm.length > 0 && !posicoesDoPostoForm.some((p) => p.vaga.id === formVagaId)) {
      setFormVagaId("");
    }
  }, [posicoesDoPostoForm, formVagaId]);

  // Mapa robusto de bases (cadastro de postos REV04 + SIFAC)
  const mapaBases = useMemo(() => {
    const mapa = new Map<string, string>();
    postos.forEach((p) => {
      const base = (p.localAtuacao || p.baseOperacional || p.unidadeNome || p.unidadeId || p.municipio || "").trim();
      if (!base) return;
      if (p.codigoPosto) mapa.set(String(p.codigoPosto), base);
      if (p.idPosto) mapa.set(String(p.idPosto), base);
      if (p.id) mapa.set(String(p.id), base);
      if (p.postoIdSGP) mapa.set(String(p.postoIdSGP), base);
      if (p.postoBase) mapa.set(String(p.postoBase), base);
    });

    alocadosSifac.forEach((s) => {
      const baseSifac = (s.unidadeNome || s.unidadeId || s.municipioPrestacao || "").trim();
      if (!baseSifac) return;
      if (s.chapaRm) mapa.set(`MATR_${s.chapaRm}`, baseSifac);
    });

    return mapa;
  }, [postos, alocadosSifac]);

  // Bases distintas cadastradas para o seletor de filtro
  const basesDisponiveis = useMemo(() => {
    const setB = new Set<string>();
    postos.forEach((p) => {
      const b = (p.localAtuacao || p.baseOperacional || p.unidadeNome || "").trim();
      if (b) setB.add(b);
    });
    return Array.from(setB).sort();
  }, [postos]);

  // Limites da competência selecionada e da competência anterior (para comparativo)
  const { inicio: inicioMes, fim: fimMes, diasNoMes: totalDiasDoMes, datas: datasCompetencia } = useMemo(
    () => limitesCompetencia(competenciaRelatorio),
    [competenciaRelatorio]
  );

  const competenciaAnterior = useMemo(
    () => obterCompetenciaAnterior(competenciaRelatorio),
    [competenciaRelatorio]
  );

  const { inicio: inicioMesAnt, fim: fimMesAnt } = useMemo(
    () => limitesCompetencia(competenciaAnterior),
    [competenciaAnterior]
  );

  // 1. Coberturas que pertencem ao mês selecionado (período toca o mês)
  const coberturasDoMes = useMemo(() => {
    return coberturas.filter(
      (c) => c.status !== "CANCELADA" && c.dataInicio <= fimMes && c.dataFim >= inicioMes
    );
  }, [coberturas, inicioMes, fimMes]);

  // Coberturas do mês anterior para comparativo nos cards
  const coberturasDoMesAnterior = useMemo(() => {
    if (!competenciaAnterior) return [];
    return coberturas.filter(
      (c) => c.status !== "CANCELADA" && c.dataInicio <= fimMesAnt && c.dataFim >= inicioMesAnt
    );
  }, [coberturas, inicioMesAnt, fimMesAnt, competenciaAnterior]);

  // 2. Coberturas filtradas dinamicamente (mês + base + modalidade + busca + status + card ativo)
  const coberturasFiltradas = useMemo(() => {
    return coberturasDoMes.filter((cob) => {
      const termo = busca.toLowerCase();
      const matchBusca =
        !busca ||
        cob.postoCodigo.toLowerCase().includes(termo) ||
        cob.funcaoPosto.toLowerCase().includes(termo) ||
        cob.substitutoNome.toLowerCase().includes(termo) ||
        cob.substitutoMatricula.toLowerCase().includes(termo) ||
        (cob.titularNome && cob.titularNome.toLowerCase().includes(termo)) ||
        (cob.justificativa && cob.justificativa.toLowerCase().includes(termo));

      const matchStatus =
        filtroStatus === "TODAS" ? true : Boolean(cob.alertaInterjornada);

      const { base } = obterBasePosto(cob, mapaBases);
      const matchBase =
        filtroBase === "TODAS" || (base && base.toLowerCase() === filtroBase.toLowerCase());

      const matchModalidade =
        filtroModalidade === "TODAS" || cob.tipoCobertura === filtroModalidade;

      // Filtro contextual de card clicável
      let matchCard = true;
      if (filtroCardAtivo === "RESERVA_TECNICA") {
        matchCard = cob.tipoCobertura === "SUBSTITUICAO_INTERNA";
      } else if (filtroCardAtivo === "ALERTAS_CLT") {
        matchCard = Boolean(cob.alertaInterjornada);
      }

      return matchBusca && matchStatus && matchBase && matchModalidade && matchCard;
    });
  }, [coberturasDoMes, busca, filtroStatus, filtroBase, filtroModalidade, filtroCardAtivo, mapaBases]);

  // ===========================================================================
  // CÁLCULO DOS 5 INDICADORES EXECUTIVOS DO PAINEL (COM COMPARATIVO ANTERIOR)
  // ===========================================================================

  // Indicador 1: Dias Cobertos no Mês e Taxa de Cobertura
  const totalDiasCobertosMes = useMemo(() => {
    return coberturasFiltradas.reduce((acc, c) => {
      const dInicio = c.dataInicio < inicioMes ? inicioMes : c.dataInicio;
      const dFim = c.dataFim > fimMes ? fimMes : c.dataFim;
      return acc + calcularDias(dInicio, dFim);
    }, 0);
  }, [coberturasFiltradas, inicioMes, fimMes]);

  const totalDiasCobertosMesAnt = useMemo(() => {
    return coberturasDoMesAnterior.reduce((acc, c) => {
      const dInicio = c.dataInicio < inicioMesAnt ? inicioMesAnt : c.dataInicio;
      const dFim = c.dataFim > fimMesAnt ? fimMesAnt : c.dataFim;
      return acc + calcularDias(dInicio, dFim);
    }, 0);
  }, [coberturasDoMesAnterior, inicioMesAnt, fimMesAnt]);

  // Indicador 2: Dias Descobertos no Mês
  // Cruzamento automático de ausências contratuais (ocorrencias) com postos/vagas e coberturas
  const listaDescobertosNoMes = useMemo(() => {
    const descobertos: ItemDescobertoPainel[] = [];
    const chavesRegistradas = new Set<string>();

    // Indexa coberturas ativas por postoCodigo_data e vagaId_data
    const cobPorPostoData = new Set<string>();
    coberturas.forEach((c) => {
      if (c.status === "CANCELADA") return;
      const dIni = c.dataInicio < inicioMes ? inicioMes : c.dataInicio;
      const dFim = c.dataFim > fimMes ? fimMes : c.dataFim;
      const dt = new Date(dIni + "T00:00:00");
      const dtFim = new Date(dFim + "T00:00:00");
      while (dt <= dtFim) {
        const iso = dt.toISOString().slice(0, 10);
        cobPorPostoData.add(`${c.postoCodigo}_${iso}`);
        if (c.vagaId) {
          cobPorPostoData.add(`${c.vagaId}_${iso}`);
        }
        dt.setDate(dt.getDate() + 1);
      }
    });

    // Mapeia chapa/matrícula para posto e vaga do titular
    const mapaChapaAloc = new Map<string, { posto: PostoOperacional | undefined; vaga: VagaPosto | undefined; aloc: AlocacaoVaga | undefined }>();
    alocacoes.forEach((aloc) => {
      if (!aloc.matricula) return;
      const chapaNorm = String(aloc.matricula).replace(/\D/g, "").padStart(6, "0");
      const v = vagas.find((vg) => vg.id === aloc.vagaId);
      const p = postos.find((pt) => pt.codigoPosto === v?.postoIdSGP || pt.idPosto === v?.idPosto || pt.id === v?.idPosto);
      mapaChapaAloc.set(chapaNorm, { posto: p, vaga: v, aloc });
      mapaChapaAloc.set(aloc.matricula, { posto: p, vaga: v, aloc });
    });

    // Analisa ausências das ocorrências operacionais no período
    ocorrencias.forEach((oc) => {
      if (oc.status === "CANCELADA") return;
      const dIni = oc.dataInicio < inicioMes ? inicioMes : oc.dataInicio;
      const dFim = oc.dataFim > fimMes ? fimMes : oc.dataFim;
      if (dIni > fimMes || dFim < inicioMes) return;

      const chapaNorm = String(oc.matricula || "").replace(/\D/g, "").padStart(6, "0");
      const vinculo = mapaChapaAloc.get(chapaNorm) || mapaChapaAloc.get(oc.matricula);

      // Código do posto
      const postoCod = oc.postoCodigo || vinculo?.posto?.codigoPosto || vinculo?.vaga?.postoIdSGP || vinculo?.vaga?.idPosto || vinculo?.aloc?.postoIdSGP;
      if (!postoCod) return;

      const postoObj = postos.find((p) => p.codigoPosto === postoCod || p.idPosto === postoCod || p.id === postoCod) || vinculo?.posto;
      const baseNome = (postoObj?.localAtuacao || postoObj?.baseOperacional || postoObj?.unidadeNome || "Base").trim();
      const funcaoNome = postoObj?.funcao || "Operacional";
      const vagaId = vinculo?.vaga?.id || `vaga-${postoCod}`;
      const posicaoRotulo = vinculo?.vaga?.codigoPosicaoEstrutural || vinculo?.vaga?.etiqueta || `Posição ${vinculo?.vaga?.sequencia || 1}`;

      const infoJust = categorizarJustificativa(oc.observacaoPublica || oc.tipoOcorrencia, oc.profissionalNome, ehFiscalPetrobras);

      const dt = new Date(dIni + "T00:00:00");
      const dtFim = new Date(dFim + "T00:00:00");

      while (dt <= dtFim) {
        const diaIso = dt.toISOString().slice(0, 10);
        if (diaIso >= inicioMes && diaIso <= fimMes) {
          const diaSem = dt.getDay();
          const escala = (postoObj?.escala || "5x2").toUpperCase();
          const ehFimDeSemana = diaSem === 0 || diaSem === 6;
          const ehDiaTrabalho = !(escala.includes("5X2") && ehFimDeSemana);

          if (ehDiaTrabalho) {
            const coberto = cobPorPostoData.has(`${postoCod}_${diaIso}`) || cobPorPostoData.has(`${vagaId}_${diaIso}`);
            if (!coberto) {
              const chaveItem = `${postoCod}_${vagaId}_${diaIso}`;
              if (!chavesRegistradas.has(chaveItem)) {
                chavesRegistradas.add(chaveItem);

                const matchBase = filtroBase === "TODAS" || baseNome.toLowerCase() === filtroBase.toLowerCase();
                const termo = busca.toLowerCase();
                const matchBusca =
                  !busca ||
                  postoCod.toLowerCase().includes(termo) ||
                  funcaoNome.toLowerCase().includes(termo) ||
                  oc.profissionalNome.toLowerCase().includes(termo) ||
                  chapaNorm.includes(termo) ||
                  infoJust.rotuloExibicao.toLowerCase().includes(termo);

                if (matchBase && matchBusca) {
                  descobertos.push({
                    id: `desc-${postoCod}-${diaIso}`,
                    postoCodigo: postoCod,
                    funcaoPosto: funcaoNome,
                    base: baseNome,
                    vagaId,
                    posicaoRotulo,
                    titularNome: oc.profissionalNome,
                    titularMatricula: chapaNorm,
                    data: diaIso,
                    motivo: oc.observacaoPublica || infoJust.rotuloExibicao,
                    categoria: infoJust.categoria,
                    ocorrenciaId: oc.id,
                  });
                }
              }
            }
          }
        }
        dt.setDate(dt.getDate() + 1);
      }
    });

    return descobertos;
  }, [ocorrencias, coberturas, inicioMes, fimMes, alocacoes, vagas, postos, filtroBase, busca, ehFiscalPetrobras]);

  const totalDiasDescobertos = listaDescobertosNoMes.length;
  const totalAusenciasNoMes = totalDiasCobertosMes + totalDiasDescobertos;

  const taxaCoberturaPct = useMemo(() => {
    if (totalAusenciasNoMes === 0) return 100;
    return (totalDiasCobertosMes / totalAusenciasNoMes) * 100;
  }, [totalDiasCobertosMes, totalAusenciasNoMes]);

  const taxaCoberturaMesAntPct = useMemo(() => {
    return totalDiasCobertosMesAnt > 0 ? 100 : 100;
  }, [totalDiasCobertosMesAnt]);

  const diffTaxaCobertura = taxaCoberturaPct - taxaCoberturaMesAntPct;
  const diffDiasCobertos = totalDiasCobertosMes - totalDiasCobertosMesAnt;

  // Indicador 3: Uso da Reserva Técnica (Pessoas físicas alocadas no mês / pessoas disponíveis)
  const profissionaisRtTotal = useMemo(() => {
    const matriculasFeristas = new Set(FERISTAS_REV04.map((f) => f.chapaRM).filter(Boolean) as string[]);
    const daLista = profissionais.filter((p) => matriculasFeristas.has(p.matricula) || matriculasFeristas.has(p.chapa));
    return daLista.length > 0 ? daLista : (FERISTAS_REV04 as unknown as ProfissionalOperacional[]);
  }, [profissionais]);

  const substitutosRtUsadosNoMes = useMemo(() => {
    const setMatriculas = new Set(coberturasFiltradas.map((c) => c.substitutoMatricula));
    return Array.from(setMatriculas).filter((mat) =>
      profissionaisRtTotal.some((p) => p.matricula === mat)
    );
  }, [coberturasFiltradas, profissionaisRtTotal]);

  const qtdRtDisponiveis = profissionaisRtTotal.length;
  const qtdRtUsados = substitutosRtUsadosNoMes.length;

  const pctUsoRt = useMemo(() => {
    if (qtdRtDisponiveis === 0) return 0;
    return (qtdRtUsados / qtdRtDisponiveis) * 100;
  }, [qtdRtUsados, qtdRtDisponiveis]);

  // Indicador 5: Alertas CLT Art. 66 e Art. 67
  const alertasArt66 = useMemo(() => {
    return coberturasFiltradas.filter((c) => c.alertaInterjornada).length;
  }, [coberturasFiltradas]);

  // Art. 67: Substitutos com 7 ou mais dias consecutivos de trabalho sem folga no mês
  const alertasArt67 = useMemo(() => {
    // Agrupa coberturas por substituto para analisar dias consecutivos
    let contagem = 0;
    const porSubstituto = new Map<string, Set<string>>();
    coberturasFiltradas.forEach((c) => {
      if (!porSubstituto.has(c.substitutoMatricula)) {
        porSubstituto.set(c.substitutoMatricula, new Set());
      }
      const setDatas = porSubstituto.get(c.substitutoMatricula)!;
      // Adiciona todos os dias cobertos no mês
      const dt = new Date(c.dataInicio + "T00:00:00");
      const fim = new Date(c.dataFim + "T00:00:00");
      while (dt <= fim) {
        const str = dt.toISOString().slice(0, 10);
        if (str >= inicioMes && str <= fimMes) {
          setDatas.add(str);
        }
        dt.setDate(dt.getDate() + 1);
      }
    });

    porSubstituto.forEach((setDatas) => {
      const datas = Array.from(setDatas).sort();
      let consecutivos = 0;
      let maxConsecutivos = 0;
      let prevTime: number | null = null;

      for (const d of datas) {
        const time = new Date(d + "T00:00:00").getTime();
        if (prevTime !== null && time - prevTime === 86400000) {
          consecutivos++;
        } else {
          consecutivos = 1;
        }
        if (consecutivos > maxConsecutivos) maxConsecutivos = consecutivos;
        prevTime = time;
      }

      if (maxConsecutivos >= 7) contagem++;
    });

    return contagem;
  }, [coberturasFiltradas, inicioMes, fimMes]);

  const totalAlertasClt = alertasArt66 + alertasArt67;

  // ===========================================================================
  // DADOS DOS GRÁFICOS ANALÍTICOS
  // ===========================================================================

  // Métricas de contagem para o Mapa de Calor
  const totalPostosComCobertura = useMemo(() => {
    const setCodigos = new Set<string>();
    coberturasFiltradas.forEach((c) => setCodigos.add(c.postoCodigo));
    listaDescobertosNoMes.forEach((d) => setCodigos.add(d.postoCodigo));
    return setCodigos.size;
  }, [coberturasFiltradas, listaDescobertosNoMes]);

  const totalPostosDisponiveis = useMemo(() => {
    return postos.filter((p) => {
      const base = (p.localAtuacao || p.baseOperacional || p.unidadeNome || "").trim();
      return filtroBase === "TODAS" || base.toLowerCase() === filtroBase.toLowerCase();
    }).length;
  }, [postos, filtroBase]);

  // 1. Dados do Mapa de Calor (Heatmap): Postos com coberturas ou todos os postos
  const heatmapPostos = useMemo(() => {
    const mapCob = new Map<
      string,
      {
        posto: PostoOperacional | undefined;
        cobDias: Map<string, CoberturaOperacional>;
        descDias: Map<string, ItemDescobertoPainel>;
      }
    >();

    // 1. Mapeia coberturas registradas
    coberturasFiltradas.forEach((c) => {
      if (!mapCob.has(c.postoCodigo)) {
        const pObj = postos.find((p) => p.codigoPosto === c.postoCodigo || p.id === c.postoCodigo);
        mapCob.set(c.postoCodigo, { posto: pObj, cobDias: new Map(), descDias: new Map() });
      }
      const item = mapCob.get(c.postoCodigo)!;

      const dt = new Date(c.dataInicio + "T00:00:00");
      const fim = new Date(c.dataFim + "T00:00:00");
      while (dt <= fim) {
        const iso = dt.toISOString().slice(0, 10);
        if (iso >= inicioMes && iso <= fimMes) {
          item.cobDias.set(iso, c);
        }
        dt.setDate(dt.getDate() + 1);
      }
    });

    // 2. Mapeia postos descobertos identificados
    listaDescobertosNoMes.forEach((d) => {
      if (!mapCob.has(d.postoCodigo)) {
        const pObj = postos.find((p) => p.codigoPosto === d.postoCodigo || p.id === d.postoCodigo);
        mapCob.set(d.postoCodigo, { posto: pObj, cobDias: new Map(), descDias: new Map() });
      }
      const item = mapCob.get(d.postoCodigo)!;
      item.descDias.set(d.data, d);
    });

    let lista: Array<{
      codigoPosto: string;
      funcaoPosto: string;
      base: string;
      cobDias: Map<string, CoberturaOperacional>;
      descDias: Map<string, ItemDescobertoPainel>;
      totalDiasCobertos: number;
      totalDiasDescobertos: number;
    }> = [];

    if (modoHeatmap === "APENAS_COBERTURAS") {
      lista = Array.from(mapCob.entries()).map(([codigoPosto, dados]) => ({
        codigoPosto,
        funcaoPosto: dados.posto?.funcao || "Suporte Operacional",
        base: (dados.posto?.localAtuacao || dados.posto?.baseOperacional || "Unidade").trim(),
        cobDias: dados.cobDias,
        descDias: dados.descDias,
        totalDiasCobertos: dados.cobDias.size,
        totalDiasDescobertos: dados.descDias.size,
      }));
    } else {
      // TODOS OS POSTOS (respeitando filtro geral de base, se ativo)
      const postosFiltradosBase = postos.filter((p) => {
        const base = (p.localAtuacao || p.baseOperacional || p.unidadeNome || "").trim();
        return filtroBase === "TODAS" || base.toLowerCase() === filtroBase.toLowerCase();
      });

      lista = postosFiltradosBase.map((p) => {
        const codigoPosto = p.codigoPosto || p.id;
        const dados = mapCob.get(codigoPosto);
        const cobDias = dados ? dados.cobDias : new Map<string, CoberturaOperacional>();
        const descDias = dados ? dados.descDias : new Map<string, ItemDescobertoPainel>();
        return {
          codigoPosto,
          funcaoPosto: p.funcao || "Suporte Operacional",
          base: (p.localAtuacao || p.baseOperacional || "Unidade").trim(),
          cobDias,
          descDias,
          totalDiasCobertos: cobDias.size,
          totalDiasDescobertos: descDias.size,
        };
      });
    }

    // Filtro adicional de busca rápida no próprio gráfico
    if (buscaHeatmap.trim()) {
      const termo = buscaHeatmap.trim().toLowerCase();
      lista = lista.filter((item) => {
        return (
          item.codigoPosto.toLowerCase().includes(termo) ||
          item.funcaoPosto.toLowerCase().includes(termo) ||
          item.base.toLowerCase().includes(termo)
        );
      });
    }

    return lista.sort(
      (a, b) =>
        b.totalDiasDescobertos - a.totalDiasDescobertos ||
        b.totalDiasCobertos - a.totalDiasCobertos ||
        a.codigoPosto.localeCompare(b.codigoPosto)
    );
  }, [coberturasFiltradas, listaDescobertosNoMes, postos, inicioMes, fimMes, modoHeatmap, buscaHeatmap, filtroBase]);

  // 2. Gráfico de Barras: Ausências por Motivo no Mês (Total de ausências = cobertas + descobertas)
  const ausenciasPorMotivo = useMemo(() => {
    const mapa = new Map<CategoriaJustificativa, number>([
      ["Férias", 0],
      ["Afastamento", 0],
      ["Falta", 0],
      ["Folga", 0],
      ["Outros", 0],
    ]);

    // 1. Ausências que foram cobertas
    coberturasFiltradas.forEach((c) => {
      const info = categorizarJustificativa(c.justificativa, c.titularNome, ehFiscalPetrobras);
      const dInicio = c.dataInicio < inicioMes ? inicioMes : c.dataInicio;
      const dFim = c.dataFim > fimMes ? fimMes : c.dataFim;
      const dias = calcularDias(dInicio, dFim);
      mapa.set(info.categoria, (mapa.get(info.categoria) || 0) + dias);
    });

    // 2. Ausências que ficaram descobertas
    listaDescobertosNoMes.forEach((d) => {
      mapa.set(d.categoria, (mapa.get(d.categoria) || 0) + 1);
    });

    const totalGeralAusencias = Array.from(mapa.values()).reduce((a, b) => a + b, 0);

    const lista = Array.from(mapa.entries()).map(([categoria, dias]) => {
      const estilo = obterEstiloCategoria(categoria, ehFiscalPetrobras);
      return {
        categoria,
        rotulo: estilo.rotuloExibicao,
        dias,
        classeBarra: estilo.classeBarra,
        porcentagem: totalGeralAusencias > 0 ? (dias / totalGeralAusencias) * 100 : 0,
      };
    });

    return lista.sort((a, b) => b.dias - a.dias);
  }, [coberturasFiltradas, listaDescobertosNoMes, inicioMes, fimMes, ehFiscalPetrobras]);

  // 3. Concentração da Reserva Técnica: Top 5 Substitutos com mais dias de cobertura e sequência máxima
  const topSubstitutosReserva = useMemo(() => {
    const mapa = new Map<string, { nome: string; matricula: string; datas: Set<string> }>();

    coberturasFiltradas.forEach((c) => {
      if (!mapa.has(c.substitutoMatricula)) {
        mapa.set(c.substitutoMatricula, {
          nome: c.substitutoNome,
          matricula: c.substitutoMatricula,
          datas: new Set(),
        });
      }
      const entry = mapa.get(c.substitutoMatricula)!;
      const dt = new Date(c.dataInicio + "T00:00:00");
      const fim = new Date(c.dataFim + "T00:00:00");
      while (dt <= fim) {
        const iso = dt.toISOString().slice(0, 10);
        if (iso >= inicioMes && iso <= fimMes) {
          entry.datas.add(iso);
        }
        dt.setDate(dt.getDate() + 1);
      }
    });

    const resultado = Array.from(mapa.values()).map((sub) => {
      const datas = Array.from(sub.datas).sort();
      let consecutivos = 0;
      let maxDiasSeguidos = 0;
      let prevTime: number | null = null;

      for (const d of datas) {
        const time = new Date(d + "T00:00:00").getTime();
        if (prevTime !== null && time - prevTime === 86400000) {
          consecutivos++;
        } else {
          consecutivos = 1;
        }
        if (consecutivos > maxDiasSeguidos) maxDiasSeguidos = consecutivos;
        prevTime = time;
      }

      return {
        matricula: sub.matricula,
        nome: formatarNome(sub.nome),
        totalDias: sub.datas.size,
        maxDiasSeguidos,
      };
    });

    return resultado.sort((a, b) => b.totalDias - a.totalDias).slice(0, 5);
  }, [coberturasFiltradas, inicioMes, fimMes]);

  // 4. Postos com Mais Coberturas no Mês (Top 5)
  const topPostosCobertos = useMemo(() => {
    const mapa = new Map<string, { codigoPosto: string; funcao: string; base: string; dias: number; coberturasCount: number }>();

    coberturasFiltradas.forEach((c) => {
      if (!mapa.has(c.postoCodigo)) {
        const { base } = obterBasePosto(c, mapaBases);
        mapa.set(c.postoCodigo, {
          codigoPosto: c.postoCodigo,
          funcao: formatarTexto(c.funcaoPosto),
          base,
          dias: 0,
          coberturasCount: 0,
        });
      }
      const entry = mapa.get(c.postoCodigo)!;
      const dInicio = c.dataInicio < inicioMes ? inicioMes : c.dataInicio;
      const dFim = c.dataFim > fimMes ? fimMes : c.dataFim;
      entry.dias += calcularDias(dInicio, dFim);
      entry.coberturasCount += 1;
    });

    return Array.from(mapa.values()).sort((a, b) => b.dias - a.dias).slice(0, 5);
  }, [coberturasFiltradas, inicioMes, fimMes, mapaBases]);

  // 5. Titulares com Mais Ausências no Mês (Top 5) — Visível SOMENTE para Perfil Premier
  const topTitularesAusencias = useMemo(() => {
    if (ehFiscalPetrobras) return [];

    const mapa = new Map<string, { nome: string; matricula: string; postoCodigo: string; motivoPrincipal: string; dias: number }>();

    coberturasFiltradas.forEach((c) => {
      const titularNome = (c.titularNome || "").trim();
      if (!titularNome || titularNome.toLowerCase().includes("vago")) return;

      const chave = c.titularMatricula || titularNome;
      if (!mapa.has(chave)) {
        const info = categorizarJustificativa(c.justificativa, c.titularNome, false);
        mapa.set(chave, {
          nome: formatarNome(titularNome),
          matricula: c.titularMatricula || "—",
          postoCodigo: c.postoCodigo,
          motivoPrincipal: info.rotuloExibicao,
          dias: 0,
        });
      }
      const entry = mapa.get(chave)!;
      const dInicio = c.dataInicio < inicioMes ? inicioMes : c.dataInicio;
      const dFim = c.dataFim > fimMes ? fimMes : c.dataFim;
      entry.dias += calcularDias(dInicio, dFim);
    });

    return Array.from(mapa.values()).sort((a, b) => b.dias - a.dias).slice(0, 5);
  }, [coberturasFiltradas, inicioMes, fimMes, ehFiscalPetrobras]);

  // ===========================================================================
  // AGRUPAMENTO E PAGINAÇÃO PARA MODO TABELA
  // ===========================================================================

  const gruposTabela = useMemo(() => {
    const mapa = new Map<string, CoberturaOperacional[]>();

    for (const c of coberturasFiltradas) {
      const chave = `${c.substitutoMatricula}__${c.postoCodigo}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, []);
      }
      mapa.get(chave)!.push(c);
    }

    const resultado: GrupoTabela[] = [];

    for (const [chave, itens] of mapa.entries()) {
      itens.sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const { base, semBase } = obterBasePosto(primeiro, mapaBases);

      let totalDiasNoMes = 0;
      let totalDiasGeral = 0;
      let temAlertaClt = false;
      const modalidadesSet = new Set<string>();
      const titularesSet = new Set<string>();
      const datasFormatadas: string[] = [];

      itens.forEach((c) => {
        const dInicio = c.dataInicio < inicioMes ? inicioMes : c.dataInicio;
        const dFim = c.dataFim > fimMes ? fimMes : c.dataFim;
        totalDiasNoMes += calcularDias(dInicio, dFim);
        totalDiasGeral += calcularDias(c.dataInicio, c.dataFim);

        if (c.alertaInterjornada) temAlertaClt = true;
        modalidadesSet.add(c.tipoCobertura);
        titularesSet.add(c.titularNome ? c.titularNome.trim() : "Sem titular");

        if (c.dataInicio === c.dataFim) {
          const [, m, d] = c.dataInicio.split("-");
          datasFormatadas.push(`${d}/${m}`);
        } else {
          const [, m1, d1] = c.dataInicio.split("-");
          const [, m2, d2] = c.dataFim.split("-");
          datasFormatadas.push(`${d1}/${m1} a ${d2}/${m2}`);
        }
      });

      let datasResumidas = "";
      if (itens.length === 1) {
        datasResumidas = formatarPeriodoResumido(primeiro.dataInicio, primeiro.dataFim);
      } else {
        const maxAmostra = 3;
        const amostra = datasFormatadas.slice(0, maxAmostra).join(", ");
        const resto = datasFormatadas.length > maxAmostra ? "..." : "";
        datasResumidas = `${totalDiasNoMes} dias (${amostra}${resto})`;
      }

      const infoJust = categorizarJustificativa(
        primeiro.justificativa,
        primeiro.titularNome,
        ehFiscalPetrobras
      );

      const todasReservaTecnica = Array.from(modalidadesSet).every(
        (m) => m === "SUBSTITUICAO_INTERNA"
      );

      resultado.push({
        chave,
        substitutoMatricula: primeiro.substitutoMatricula,
        substitutoNome: primeiro.substitutoNome,
        postoCodigo: primeiro.postoCodigo,
        funcaoPosto: primeiro.funcaoPosto,
        base,
        semBase,
        itens,
        totalDiasNoMes,
        totalDiasGeral,
        dataInicioMaisAntiga: primeiro.dataInicio,
        dataFimMaisRecente: ultimo.dataFim,
        datasResumidas,
        temAlertaClt,
        modalidadesDistintas: Array.from(modalidadesSet),
        titularesDistintos: Array.from(titularesSet),
        categoriaDominante: infoJust.categoria,
        categoriaRotulo: infoJust.rotuloExibicao,
        categoriaClasse: infoJust.classeBadge,
        todasReservaTecnica,
      });
    }

    return resultado;
  }, [coberturasFiltradas, mapaBases, inicioMes, fimMes, ehFiscalPetrobras]);

  const alternarOrdenacao = (campo: CampoOrdenacao) => {
    setOrdenacao((atual) =>
      atual.campo === campo
        ? { campo, direcao: atual.direcao === "asc" ? "desc" : "asc" }
        : { campo, direcao: campo === "data" || campo === "dias" ? "desc" : "asc" }
    );
  };

  const gruposOrdenados = useMemo(() => {
    const valor = (g: GrupoTabela): string | number => {
      switch (ordenacao.campo) {
        case "posto": return g.postoCodigo;
        case "base": return g.base;
        case "titular": return g.titularesDistintos[0] || "";
        case "substituto": return g.substitutoNome || "";
        case "data": return g.dataFimMaisRecente;
        case "dias": return g.totalDiasNoMes;
        case "modalidade": return g.modalidadesDistintas[0] || "";
        case "justificativa": return g.categoriaRotulo;
      }
    };
    const fator = ordenacao.direcao === "asc" ? 1 : -1;
    return [...gruposTabela].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
      return cmp * fator;
    });
  }, [gruposTabela, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(gruposOrdenados.length / itensPorPagina));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const gruposPagina = gruposOrdenados.slice(
    (paginaSegura - 1) * itensPorPagina,
    paginaSegura * itensPorPagina
  );

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroStatus, filtroBase, filtroModalidade, filtroCardAtivo, competenciaRelatorio, ordenacao, itensPorPagina]);

  // ===========================================================================
  // RELATÓRIO XLSX: DUAS ABAS ("RESUMO" E "COBERTURAS")
  // ===========================================================================

  const handleGerarRelatorioMensal = async () => {
    if (!competenciaRelatorio) {
      alert("Selecione o mês do relatório.");
      return;
    }
    const [ano, mes] = competenciaRelatorio.split("-");
    if (coberturasFiltradas.length === 0) {
      alert(`Nenhuma cobertura registrada em ${mes}/${ano} para os filtros selecionados.`);
      return;
    }

    setGerandoRelatorio(true);
    try {
      const XLSX = await import("xlsx");

      // 1. Aba "Resumo" com os Indicadores Executivos e Gráficos
      const linhasResumo = [
        { "Indicador": "Mês de Referência", "Valor": `${formatarMesAnoExtenso(competenciaRelatorio)}` },
        { "Indicador": "Taxa de Cobertura Operacional", "Valor": `${taxaCoberturaPct.toFixed(1)}%` },
        { "Indicador": "Dias Cobertos no Mês", "Valor": totalDiasCobertosMes },
        { "Indicador": "Dias Descobertos no Mês", "Valor": totalDiasDescobertos },
        { "Indicador": "Uso da Reserva Técnica", "Valor": `${qtdRtUsados} de ${qtdRtDisponiveis} profissionais (${pctUsoRt.toFixed(1)}%)` },
        { "Indicador": "Alertas CLT Art. 66 (< 11h repouso)", "Valor": alertasArt66 },
        { "Indicador": "Alertas CLT Art. 67 (Descanso semanal)", "Valor": alertasArt67 },
        { "Indicador": "Filtro de Base Aplicado", "Valor": filtroBase },
        { "Indicador": "Filtro de Modalidade Aplicado", "Valor": filtroModalidade },
        { "Indicador": "Busca Aplicada", "Valor": busca || "Nenhuma" },
      ];

      const wsResumo = XLSX.utils.json_to_sheet(linhasResumo);
      wsResumo["!cols"] = [{ wch: 42 }, { wch: 40 }];

      // 2. Aba "Coberturas" com Detalhamento Linha a Linha
      const linhasCoberturas = coberturasFiltradas.map((c) => {
        const { base } = obterBasePosto(c, mapaBases);
        const infoJust = categorizarJustificativa(c.justificativa, c.titularNome, ehFiscalPetrobras);
        const inicioNoMes = c.dataInicio < inicioMes ? inicioMes : c.dataInicio;
        const fimNoMes = c.dataFim > fimMes ? fimMes : c.dataFim;
        const diasNoMes = calcularDias(inicioNoMes, fimNoMes);
        const diasTotal = calcularDias(c.dataInicio, c.dataFim);

        return {
          "Posto": c.postoCodigo,
          "Função": formatarTexto(c.funcaoPosto),
          "Base / Unidade": base,
          "Titular": c.titularNome ? formatarNome(c.titularNome) : "Sem titular",
          "Matrícula Titular": c.titularMatricula || "",
          "Substituto": formatarNome(c.substitutoNome),
          "Matrícula Substituto": c.substitutoMatricula,
          "Início": formatarDataBr(c.dataInicio),
          "Fim": formatarDataBr(c.dataFim),
          "Dias no Mês": diasNoMes,
          "Dias (Total)": diasTotal,
          "Modalidade": MODALIDADES_NOMES[c.tipoCobertura] || c.tipoCobertura.replace(/_/g, " "),
          "Categoria": infoJust.rotuloExibicao,
          "Justificativa": infoJust.textoCompletoSeguro,
        };
      });

      const wsCoberturas = XLSX.utils.json_to_sheet(linhasCoberturas);
      wsCoberturas["!cols"] = [
        { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 30 }, { wch: 14 },
        { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 45 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
      XLSX.utils.book_append_sheet(wb, wsCoberturas, "Coberturas");
      XLSX.writeFile(wb, `Relatorio_Coberturas_${ano}-${mes}.xlsx`);

      setMensagemSucesso(`Relatório de ${mes}/${ano} gerado com abas Resumo e Coberturas (${coberturasFiltradas.length} linhas).`);
      setTimeout(() => setMensagemSucesso(""), 4500);
    } catch (erro) {
      console.error("Falha ao gerar relatório de coberturas:", erro);
      alert("Não foi possível gerar o relatório.");
    } finally {
      setGerandoRelatorio(false);
    }
  };

  const handleCopiarJustificativa = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setMensagemSucesso("Justificativa copiada!");
    setTimeout(() => setMensagemSucesso(""), 3000);
  };

  const handleCancelarCobertura = (id: string) => {
    if (confirm("Deseja realmente cancelar esta cobertura operacional?")) {
      try {
        cancelarCobertura(id);
      } catch (erro) {
        alert(erro instanceof Error ? erro.message : "Não foi possível cancelar a cobertura.");
        return;
      }
      setMensagemSucesso("Cobertura cancelada com sucesso!");
      setCoberturaPainel(null);
      carregarDados();
      setTimeout(() => setMensagemSucesso(""), 4000);
    }
  };

  const handleExcluirCobertura = (id: string) => {
    if (confirm("Deseja remover permanentemente este registro de cobertura?")) {
      try {
        excluirCobertura(id);
      } catch (erro) {
        alert(erro instanceof Error ? erro.message : "Não foi possível excluir a cobertura.");
        return;
      }
      setMensagemSucesso("Registro de cobertura excluído com sucesso!");
      setCoberturaPainel(null);
      setCoberturaEmEdicao(null);
      setModalAberto(false);
      carregarDados();
      setTimeout(() => setMensagemSucesso(""), 4000);
    }
  };

  const handleSubmitCobertura = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPostoCodigo || !formSubstitutoMatricula || !formDataInicio || !formDataFim) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    if (formDataFim < formDataInicio) {
      alert("A data de término não pode ser anterior à data de início.");
      return;
    }

    const compCongelada =
      obterCompetenciaCongeladaNoPeriodo(formDataInicio, formDataFim) ||
      (coberturaEmEdicao ? obterCompetenciaCongeladaNoPeriodo(coberturaEmEdicao.dataInicio, coberturaEmEdicao.dataFim) : null);
    if (compCongelada) {
      alert(
        `BLOQUEIO DE COMPETÊNCIA CONGELADA:\n\nO período envolve a competência ${compCongelada.split("-").reverse().join("/")}, que se encontra CONGELADA (Snapshot Imutável).`
      );
      return;
    }

    const postoObj = postos.find((p) => p.codigoPosto === formPostoCodigo || p.id === formPostoCodigo);
    const substitutoObj =
      profissionais.find((pr) => pr.matricula === formSubstitutoMatricula) ||
      (coberturaEmEdicao && coberturaEmEdicao.substitutoMatricula === formSubstitutoMatricula
        ? {
            matricula: coberturaEmEdicao.substitutoMatricula,
            nome: coberturaEmEdicao.substitutoNome,
          }
        : null);

    if (!postoObj) {
      alert(`O posto ${formPostoCodigo} não foi encontrado no cadastro atual.`);
      return;
    }
    if (!substitutoObj) {
      alert(`O profissional de matrícula ${formSubstitutoMatricula} não foi encontrado.`);
      return;
    }

    const posicaoSel = posicoesDoPostoForm.find((p) => p.vaga.id === formVagaId);
    if (posicoesDoPostoForm.length > 0 && !posicaoSel) {
      alert("Selecione a posição do posto que será coberta.");
      return;
    }
    const titularMatriculaCob = posicaoSel ? posicaoSel.titularMatricula || undefined : postoObj.titularMatricula;
    const titularNomeCob = posicaoSel ? posicaoSel.titularNome || undefined : postoObj.titularNome;

    if (titularMatriculaCob && substitutoObj.matricula === titularMatriculaCob) {
      alert("O substituto não pode ser o próprio titular da posição.");
      return;
    }

    const conflitos = verificarConflitosCobertura(
      {
        postoCodigo: postoObj.codigoPosto,
        vagaId: posicaoSel?.vaga.id,
        titularMatricula: titularMatriculaCob,
        substitutoMatricula: substitutoObj.matricula,
        dataInicio: formDataInicio,
        dataFim: formDataFim,
      },
      coberturaEmEdicao?.id
    );
    if (conflitos.bloqueios.length > 0) {
      alert(`Não foi possível salvar a cobertura:\n\n- ${conflitos.bloqueios.join("\n- ")}`);
      return;
    }
    if (
      conflitos.alertas.length > 0 &&
      !confirm(`Atenção:\n\n- ${conflitos.alertas.join("\n- ")}\n\nDeseja salvar mesmo assim?`)
    ) {
      return;
    }

    const violouInterjornada = validacaoInterjornada ? !validacaoInterjornada.atende : false;
    if (violouInterjornada && !cienteInterjornada) {
      alert(
        `ALERTA CLT ART. 66 (Interjornada):\n\nO colaborador ${substitutoObj.nome} possui apenas ${validacaoInterjornada?.horasDescansoFormatado} de descanso entre turnos (< 11h).\n\nPara efetivar esta cobertura em caráter excepcional/emergencial, marque a caixa de ciência.`
      );
      return;
    }

    let justificativaFinal = formJustificativa.trim();
    if (violouInterjornada) {
      const notaClt = `[ALERTA CLT ART. 66: Descanso apurado de ${validacaoInterjornada?.horasDescansoFormatado} (< 11h mínimas)]`;
      justificativaFinal = justificativaFinal ? `${notaClt} ${justificativaFinal}` : `${notaClt} Cobertura do posto ${postoObj.codigoPosto}`;
    } else if (!justificativaFinal) {
      justificativaFinal = `Cobertura operacional do posto ${postoObj.codigoPosto} por ${substitutoObj.nome}`;
    }

    try {
      if (coberturaEmEdicao) {
        atualizarCobertura(coberturaEmEdicao.id, {
          postoCodigo: postoObj.codigoPosto,
          idPosto: postoObj.idPosto || postoObj.codigoPosto,
          vagaId: posicaoSel?.vaga.id,
          funcaoPosto: postoObj.funcao,
          titularMatricula: titularMatriculaCob,
          titularNome: titularNomeCob,
          substitutoMatricula: substitutoObj.matricula,
          substitutoNome: substitutoObj.nome,
          dataInicio: formDataInicio,
          dataFim: formDataFim,
          tipoCobertura: formTipo,
          status: coberturaEmEdicao.status || "CONFIRMADA",
          justificativa: justificativaFinal,
          alertaInterjornada: violouInterjornada,
          horasDescansoApuradas: validacaoInterjornada?.horasDescanso,
          detalhesInterjornada: validacaoInterjornada?.mensagem,
        });

        setMensagemSucesso(`Cobertura (${coberturaEmEdicao.postoCodigo}) atualizada com sucesso!`);
      } else {
        adicionarCobertura({
          postoCodigo: postoObj.codigoPosto,
          idPosto: postoObj.idPosto || postoObj.codigoPosto,
          vagaId: posicaoSel?.vaga.id,
          funcaoPosto: postoObj.funcao,
          titularMatricula: titularMatriculaCob,
          titularNome: titularNomeCob,
          substitutoMatricula: substitutoObj.matricula,
          substitutoNome: substitutoObj.nome,
          dataInicio: formDataInicio,
          dataFim: formDataFim,
          tipoCobertura: formTipo,
          status: "CONFIRMADA",
          justificativa: justificativaFinal,
          alertaInterjornada: violouInterjornada,
          horasDescansoApuradas: validacaoInterjornada?.horasDescanso,
          detalhesInterjornada: validacaoInterjornada?.mensagem,
        });

        if (efetivarTrocaPermanente) {
          trocarTitularPosto(postoObj.codigoPosto, substitutoObj.matricula);
        }

        setMensagemSucesso(`Cobertura incluída com sucesso! ${substitutoObj.nome} atenderá o posto ${postoObj.codigoPosto}.`);
      }
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : "Não foi possível salvar a cobertura.");
      return;
    }

    setModalAberto(false);
    setCoberturaEmEdicao(null);
    setFormPostoCodigo("");
    setFormVagaId("");
    setFormSubstitutoMatricula("");
    setFormJustificativa("");
    setEfetivarTrocaPermanente(false);
    setCienciaInterjornada(false);
    carregarDados();

    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  // Helper de badge de taxa de cobertura
  const getBadgeTaxaCobertura = (taxa: number) => {
    if (taxa >= 100) {
      return {
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        text: "text-emerald-800",
        bar: "bg-emerald-500",
      };
    }
    if (taxa >= 90) {
      return {
        bg: "bg-amber-50",
        border: "border-amber-200",
        text: "text-amber-800",
        bar: "bg-amber-500",
      };
    }
    return {
      bg: "bg-rose-50",
      border: "border-rose-200",
      text: "text-rose-800",
      bar: "bg-rose-500",
    };
  };

  const estiloTaxa = getBadgeTaxaCobertura(taxaCoberturaPct);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Topo Executivo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-200/70">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-xs">
              <UserCheck2 className="w-5 h-5" />
            </div>
            <span>Coberturas & Substituições de Posto</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Painel integrado de conformidade operacional, alocação de reserva técnica e auditoria de turnos.
          </p>
        </div>

        {/* Ações Primárias do Topo */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <Link
            href="/feristas"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all"
          >
            <UserCheck2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Feristas por Unidade</span>
          </Link>

          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all"
          >
            <span>Ver no Mapa</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>

          <button
            onClick={() => abrirModalIncluir()}
            className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Incluir Cobertura</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {mensagemSucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso("")} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. INDICADORES DO PAINEL DE ANÁLISE (CARDS CLICÁVEIS COM COMPARATIVO) */}
      {/* ===================================================================== */}
      {carregandoDados || sessaoCarregando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl border border-slate-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Taxa de Cobertura */}
          <div
            onClick={() => setFiltroCardAtivo((prev) => (prev === "TODOS" ? "TODOS" : "TODOS"))}
            className={`p-3.5 rounded-2xl border shadow-xs transition-all cursor-pointer relative overflow-hidden group ${
              filtroCardAtivo === "TODOS" ? "ring-2 ring-blue-600/70" : "hover:border-slate-300"
            } ${estiloTaxa.bg} ${estiloTaxa.border}`}
            title="Clique para redefinir filtros e visualizar todas as coberturas"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Cobertura de Ausências
              </span>
              <Activity className={`w-4 h-4 ${estiloTaxa.text}`} />
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold tracking-tight ${estiloTaxa.text}`}>
                {taxaCoberturaPct.toFixed(1)}%
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {totalDiasCobertosMes} de {totalAusenciasNoMes}d cobertos
              </span>
            </div>

            {/* Comparação com Mês Anterior */}
            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">vs {competenciaAnterior ? formatarMesAnoExtenso(competenciaAnterior) : "anterior"}:</span>
              <span
                className={`font-semibold inline-flex items-center gap-0.5 ${
                  diffTaxaCobertura > 0
                    ? "text-emerald-700"
                    : diffTaxaCobertura < 0
                    ? "text-rose-700"
                    : "text-slate-600"
                }`}
              >
                {diffTaxaCobertura > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : diffTaxaCobertura < 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                <span>{diffTaxaCobertura >= 0 ? `+${diffTaxaCobertura.toFixed(1)}%` : `${diffTaxaCobertura.toFixed(1)}%`}</span>
              </span>
            </div>
          </div>

          {/* Card 2: Dias Descobertos */}
          <div
            onClick={() => {
              setModalDescobertosAberto(true);
            }}
            className={`p-3.5 rounded-2xl border shadow-xs transition-all cursor-pointer relative overflow-hidden group ${
              totalDiasDescobertos > 0
                ? "bg-rose-50/80 border-rose-300 hover:border-rose-400"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
            title="Clique para listar postos e datas com postos descobertos"
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${totalDiasDescobertos > 0 ? "text-rose-800" : "text-slate-500"}`}>
                Diárias a Cobrir
              </span>
              <Building2 className={`w-4 h-4 ${totalDiasDescobertos > 0 ? "text-rose-600" : "text-slate-400"}`} />
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold tracking-tight ${totalDiasDescobertos > 0 ? "text-rose-900" : "text-slate-900"}`}>
                {totalDiasDescobertos}
              </span>
              <span className={`text-[11px] font-medium ${totalDiasDescobertos > 0 ? "text-rose-700 font-semibold" : "text-slate-500"}`}>
                {totalDiasDescobertos > 0 ? `dias ausentes em ${totalPostosComCobertura} postos` : "100% coberto"}
              </span>
            </div>

            {/* Comparação com Mês Anterior */}
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">vs {competenciaAnterior ? formatarMesAnoExtenso(competenciaAnterior) : "anterior"}:</span>
              <span className="font-semibold text-emerald-700 inline-flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>0 descobertos</span>
              </span>
            </div>
          </div>

          {/* Card 3: Uso da Reserva Técnica (Pessoas físicas alocadas no mês / pessoas disponíveis) */}
          <div
            onClick={() => {
              setFiltroCardAtivo((prev) => (prev === "RESERVA_TECNICA" ? "TODOS" : "RESERVA_TECNICA"));
            }}
            className={`p-3.5 rounded-2xl border shadow-xs transition-all cursor-pointer relative overflow-hidden group ${
              filtroCardAtivo === "RESERVA_TECNICA"
                ? "ring-2 ring-blue-600 bg-blue-50/70 border-blue-300"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
            title="Clique para filtrar coberturas atendidas pela Reserva Técnica (pessoas físicas, não horas)"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Equipe de Feristas / RT
              </span>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-premier-900 tracking-tight">
                {pctUsoRt.toFixed(1)}%
              </span>
              <span className="text-[11px] text-blue-700 font-medium">
                {qtdRtUsados} de {qtdRtDisponiveis} feristas
              </span>
            </div>

            {/* Legenda explicativa estrita */}
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">feristas em atuação:</span>
              <span className="font-semibold text-blue-900">
                {qtdRtUsados} pessoas físicas
              </span>
            </div>
          </div>

          {/* Card 4: Alertas CLT Art. 66 e Art. 67 */}
          <div
            onClick={() => {
              setFiltroCardAtivo((prev) => (prev === "ALERTAS_CLT" ? "TODOS" : "ALERTAS_CLT"));
            }}
            className={`p-3.5 rounded-2xl border shadow-xs transition-all cursor-pointer relative overflow-hidden group ${
              filtroCardAtivo === "ALERTAS_CLT"
                ? "ring-2 ring-amber-500 bg-amber-50/80 border-amber-300"
                : totalAlertasClt > 0
                ? "bg-amber-50/60 border-amber-300"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
            title="Clique para filtrar coberturas com alerta CLT Art. 66 ou Art. 67"
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${totalAlertasClt > 0 ? "text-amber-800" : "text-slate-500"}`}>
                Alertas CLT (Art. 66 e 67)
              </span>
              {totalAlertasClt > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
            </div>

            <div className="flex items-baseline gap-1.5">
              {totalAlertasClt === 0 ? (
                <>
                  <span className="text-lg font-bold text-emerald-800 tracking-tight flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Nenhum alerta
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold text-amber-900 tracking-tight">
                    {totalAlertasClt}
                  </span>
                  <span className="text-[11px] font-semibold text-amber-800">
                    {alertasArt66} Art. 66 · {alertasArt67} Art. 67
                  </span>
                </>
              )}
            </div>

            {/* Comparação com Mês Anterior */}
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">vs {competenciaAnterior ? formatarMesAnoExtenso(competenciaAnterior) : "anterior"}:</span>
              <span className="font-semibold text-emerald-700">0 pendências</span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. GRÁFICOS DO PAINEL (MAPA DE CALOR, AUSÊNCIAS, RESERVA, TOP POSTOS/TITULARES) */}
      {/* ===================================================================== */}
      <div className="space-y-4">
        {/* GRÁFICO 1: MAPA DE CALOR POSTO × DIA DO MÊS (VISÃO PRINCIPAL) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Mapa de Calor Operacional: Posto × Dia do Mês</span>
                <span className="text-xs font-normal text-slate-500 font-mono">
                  ({formatarMesAnoExtenso(competenciaRelatorio)})
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Distribuição diária de coberturas e postos. Passe o mouse sobre a célula para visualizar titular, substituto e motivo.
              </p>
            </div>

            {/* Legenda do Mapa de Calor */}
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500 shadow-2xs" />
                <span>Coberto ({totalDiasCobertosMes}d)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500 shadow-2xs" />
                <span>Descoberto ({totalDiasDescobertos}d)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" />
                <span>Sem ausência</span>
              </span>
            </div>
          </div>

          {/* BARRA DE CONTROLE E FILTRO EXCLUSIVO DO MAPA DE CALOR */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 pb-1 border-b border-slate-100">
            {/* Seletor de Modo: Apenas com coberturas vs Todos os postos */}
            <div className="inline-flex items-center p-0.5 bg-slate-100/90 rounded-lg border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => setModoHeatmap("APENAS_COBERTURAS")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  modoHeatmap === "APENAS_COBERTURAS"
                    ? "bg-white text-blue-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Com Coberturas / Ocorrências ({totalPostosComCobertura})
              </button>
              <button
                type="button"
                onClick={() => setModoHeatmap("TODOS_POSTOS")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  modoHeatmap === "TODOS_POSTOS"
                    ? "bg-white text-blue-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Todos os Postos ({totalPostosDisponiveis})
              </button>
            </div>

            {/* Campo de Busca Rápida e Contador */}
            <div className="flex items-center gap-2.5">
              <div className="relative min-w-[200px] sm:min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buscaHeatmap}
                  onChange={(e) => setBuscaHeatmap(e.target.value)}
                  placeholder="Filtrar posto no mapa..."
                  className="w-full pl-8 pr-7 py-1 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-800"
                />
                {buscaHeatmap && (
                  <button
                    type="button"
                    onClick={() => setBuscaHeatmap("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Limpar busca no mapa"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <span className="text-[11px] font-medium text-slate-500 shrink-0">
                {heatmapPostos.length} {heatmapPostos.length === 1 ? "posto exibido" : "postos exibidos"}
              </span>
            </div>
          </div>

          {/* Grid do Mapa de Calor */}
          {heatmapPostos.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs space-y-2">
              <p>
                {buscaHeatmap
                  ? `Nenhum posto encontrado para "${buscaHeatmap}".`
                  : `Nenhuma cobertura ou ausência registrada para os filtros selecionados em ${formatarMesAnoExtenso(competenciaRelatorio)}.`}
              </p>
              {buscaHeatmap ? (
                <button
                  type="button"
                  onClick={() => setBuscaHeatmap("")}
                  className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Limpar filtro de busca no mapa
                </button>
              ) : modoHeatmap === "APENAS_COBERTURAS" ? (
                <button
                  type="button"
                  onClick={() => setModoHeatmap("TODOS_POSTOS")}
                  className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Visualizar todos os postos do contrato
                </button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[920px]">
                {/* Cabeçalho dos Dias da Competência - Sticky para rolagem suave */}
                <div className="sticky top-0 bg-white z-10 grid grid-cols-[220px_repeat(31,minmax(20px,1fr))] gap-1 items-center py-1.5 border-b border-slate-100 text-[10px] font-mono text-slate-400 text-center font-bold">
                  <div className="text-left font-sans text-slate-500 font-semibold uppercase tracking-wider pl-1">
                    Posto
                  </div>
                  {datasCompetencia.map((isoDia) => (
                    <div key={isoDia} className="py-0.5" title={formatarDataBr(isoDia)}>
                      {isoDia.slice(8, 10)}
                    </div>
                  ))}
                </div>

                {/* Linhas de Postos com max-h e overflow se houver muitos postos */}
                <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1 mt-1">
                  {heatmapPostos.map((hp) => (
                    <div
                      key={hp.codigoPosto}
                      className="grid grid-cols-[220px_repeat(31,minmax(20px,1fr))] gap-1 items-center hover:bg-slate-50/60 p-0.5 rounded-lg transition-colors group"
                    >
                      <div className="flex items-center justify-between pr-2 min-w-0">
                        <div className="truncate min-w-0">
                          <div className="font-mono font-semibold text-slate-900 text-xs truncate" title={hp.codigoPosto}>
                            {hp.codigoPosto}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate" title={`${hp.base} • ${hp.funcaoPosto}`}>
                            {hp.base}
                          </div>
                        </div>
                        {hp.totalDiasDescobertos > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const primeiraDataDesc = datasCompetencia.find((d) => hp.descDias.has(d));
                              const descItem = primeiraDataDesc ? hp.descDias.get(primeiraDataDesc) : undefined;
                              const todasDatas = datasCompetencia.filter((d) => hp.descDias.has(d));
                              const ultimaDataDesc = todasDatas[todasDatas.length - 1];
                              abrirModalIncluir(hp.codigoPosto, primeiraDataDesc, descItem?.vagaId, ultimaDataDesc, descItem?.motivo);
                            }}
                            className="ml-1.5 shrink-0 px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:scale-95 border border-rose-200/90 rounded-md transition-all flex items-center gap-1 shadow-2xs hover:border-rose-400 cursor-pointer"
                            title={`Designar cobertura para ${hp.codigoPosto} (${hp.totalDiasDescobertos} dia(s) descoberto(s))`}>
                            <UserPlus className="w-3 h-3 text-rose-600" />
                            <span>Designar</span>
                          </button>
                        )}
                      </div>

                      {/* Células diárias */}
                      {datasCompetencia.map((isoDia) => {
                        const cob = hp.cobDias.get(isoDia);
                        const desc = hp.descDias.get(isoDia);
                        const status: "COBERTO" | "DESCOBERTO" | "NORMAL" = cob
                          ? "COBERTO"
                          : desc
                          ? "DESCOBERTO"
                          : "NORMAL";

                        const infoJust = cob
                          ? categorizarJustificativa(cob.justificativa, cob.titularNome, ehFiscalPetrobras)
                          : desc
                          ? categorizarJustificativa(desc.motivo, desc.titularNome, ehFiscalPetrobras)
                          : null;

                        return (
                          <div
                            key={isoDia}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltipHeatmap({
                                visivel: true,
                                x: rect.left + rect.width / 2,
                                y: rect.top - 8,
                                posto: hp.codigoPosto,
                                funcao: hp.funcaoPosto,
                                base: hp.base,
                                data: formatarDataBr(isoDia),
                                status,
                                titular: cob?.titularNome || desc?.titularNome || "—",
                                substituto: cob?.substitutoNome || (status === "DESCOBERTO" ? "SEM COBERTURA" : undefined),
                                motivo: infoJust?.rotuloExibicao,
                              });
                            }}
                            onMouseLeave={() => setTooltipHeatmap(null)}
                            onClick={() => {
                              if (cob) {
                                setCoberturaPainel(cob);
                              } else if (desc) {
                                abrirModalIncluir(hp.codigoPosto, isoDia, desc.vagaId, isoDia, desc.motivo);
                              }
                            }}
                            className={`h-6 rounded transition-all cursor-pointer flex items-center justify-center text-[9px] font-mono font-bold ${
                              status === "COBERTO"
                                ? "bg-emerald-500 text-white shadow-2xs hover:scale-110"
                                : status === "DESCOBERTO"
                                ? "bg-rose-500 text-white shadow-2xs hover:scale-110 cursor-pointer animate-pulse ring-1 ring-rose-600/30"
                                : "bg-slate-100 hover:bg-slate-200 text-transparent"
                            }`}
                            title={status === "DESCOBERTO" ? "Posto Descoberto! Clique para designar cobertura nesta data." : undefined}
                          >
                            {status === "COBERTO" ? "C" : status === "DESCOBERTO" ? "D" : ""}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LINHA 2 DE GRÁFICOS: AUSÊNCIAS POR MOTIVO + CONCENTRAÇÃO DA RESERVA TÉCNICA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* GRÁFICO 2: BARRAS HORIZONTAIS DE AUSÊNCIAS POR MOTIVO */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                <span>Ausências por Motivo no Mês</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                Total: <strong>{totalDiasCobertosMes} dias</strong>
              </span>
            </div>

            <div className="space-y-2.5">
              {ausenciasPorMotivo.map((item) => (
                <div key={item.categoria} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{item.rotulo}</span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {item.dias}d ({item.porcentagem.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${item.classeBarra}`}
                      style={{ width: `${Math.min(100, Math.max(item.dias > 0 ? 5 : 0, item.porcentagem))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GRÁFICO 3: CONCENTRAÇÃO DA RESERVA TÉCNICA (TOP 5 SUBSTITUTOS COM DIAS SEGUIDOS) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Concentração da Reserva (Top 5)</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                Dias e Sequência Máxima
              </span>
            </div>

            {topSubstitutosReserva.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum substituto alocado no período filtrado.
              </div>
            ) : (
              <div className="space-y-2.5">
                {topSubstitutosReserva.map((sub, idx) => (
                  <div key={sub.matricula} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800 truncate" title={sub.nome}>
                          {sub.nome}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          ({sub.matricula})
                        </span>
                      </div>
                      <div className="text-right text-[11px] font-mono shrink-0 pl-2">
                        <strong className="text-blue-900">{sub.totalDias}d</strong>
                        <span className="text-slate-400 ml-1">
                          (máx. {sub.maxDiasSeguidos}d seguidos)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (sub.totalDias / totalDiasDoMes) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* LINHA 3 DE GRÁFICOS: POSTOS COM MAIS COBERTURAS + TITULARES COM MAIS AUSÊNCIAS (PREMIER ONLY) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* GRÁFICO 4: POSTOS COM MAIS COBERTURAS NO MÊS (TOP 5) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Postos com Mais Coberturas (Top 5)</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                Demanda no mês
              </span>
            </div>

            {topPostosCobertos.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum posto atendido no período filtrado.
              </div>
            ) : (
              <div className="space-y-2.5">
                {topPostosCobertos.map((p, idx) => (
                  <div key={p.codigoPosto} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-mono font-semibold text-slate-900">
                          {p.codigoPosto}
                        </span>
                        <span className="text-slate-400 text-xs hidden sm:inline">•</span>
                        <span className="text-slate-600 text-[11px] truncate">
                          {p.funcao}
                        </span>
                      </div>
                      <div className="text-right text-[11px] font-mono shrink-0 pl-2">
                        <strong className="text-emerald-800">{p.dias}d</strong>
                        <span className="text-slate-400 ml-1">
                          ({p.coberturasCount} cob.)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (p.dias / totalDiasDoMes) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GRÁFICO 5: TITULARES COM MAIS AUSÊNCIAS (TOP 5) — LGPD STRICT (PREMIER APENAS) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-rose-600" />
                <span>Titulares com Mais Ausências (Top 5)</span>
              </h3>
              {ehFiscalPetrobras ? (
                <span className="text-[10px] font-bold uppercase text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  LGPD Restrito
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">
                  Visão Premier
                </span>
              )}
            </div>

            {ehFiscalPetrobras ? (
              <div className="py-6 px-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-center space-y-1.5">
                <Lock className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">
                  Proteção de Dados Pessoais (LGPD)
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  O ranking individualizado de ausências por colaborador é restrito à gestão interna Premier Logistics e não é exibido para o Perfil Fiscal Petrobras.
                </p>
              </div>
            ) : topTitularesAusencias.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhuma ausência de titular identificada no período.
              </div>
            ) : (
              <div className="space-y-2.5">
                {topTitularesAusencias.map((t, idx) => (
                  <div key={t.matricula + t.nome} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800 truncate" title={t.nome}>
                          {t.nome}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          ({t.postoCodigo})
                        </span>
                      </div>
                      <div className="text-right text-[11px] font-mono shrink-0 pl-2">
                        <strong className="text-rose-800">{t.dias}d</strong>
                        <span className="text-slate-400 ml-1">
                          ({t.motivoPrincipal})
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (t.dias / totalDiasDoMes) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TOOLTIP FLUTUANTE DO MAPA DE CALOR */}
      {tooltipHeatmap && tooltipHeatmap.visivel && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs max-w-xs animate-scaleIn space-y-1"
          style={{ left: `${tooltipHeatmap.x}px`, top: `${tooltipHeatmap.y}px` }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
            <span className="font-mono font-bold text-blue-400">{tooltipHeatmap.posto}</span>
            <span className="text-[10px] text-slate-400 font-mono">{tooltipHeatmap.data}</span>
          </div>
          <div className="text-[11px] text-slate-300 font-medium">
            {tooltipHeatmap.base} • {formatarTexto(tooltipHeatmap.funcao)}
          </div>
          <div className="pt-1 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                tooltipHeatmap.status === "COBERTO"
                  ? "bg-emerald-400"
                  : tooltipHeatmap.status === "DESCOBERTO"
                  ? "bg-rose-400"
                  : "bg-slate-400"
              }`}
            />
            <span className="font-semibold">
              {tooltipHeatmap.status === "COBERTO"
                ? "Posto Coberto"
                : tooltipHeatmap.status === "DESCOBERTO"
                ? "Posto Descoberto"
                : "Sem Ausência"}
            </span>
          </div>
          {tooltipHeatmap.status === "COBERTO" && (
            <div className="text-[11px] text-slate-300 space-y-0.5 pt-0.5">
              <div>Substituto: <strong className="text-white">{tooltipHeatmap.substituto}</strong></div>
              <div>Titular Ausente: <span>{tooltipHeatmap.titular}</span></div>
              {tooltipHeatmap.motivo && (
                <div>Motivo: <span className="text-blue-300">{tooltipHeatmap.motivo}</span></div>
              )}
            </div>
          )}
          {tooltipHeatmap.status === "DESCOBERTO" && (
            <div className="text-[11px] text-rose-200 space-y-0.5 pt-0.5 border-t border-slate-800">
              <div>Titular Ausente: <strong className="text-white">{tooltipHeatmap.titular}</strong></div>
              {tooltipHeatmap.motivo && (
                <div>Motivo: <span className="text-rose-300">{tooltipHeatmap.motivo}</span></div>
              )}
              <div className="pt-1 text-[10px] font-semibold text-rose-400">
                👉 Clique nesta célula para designar cobertura
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. BARRA DE FILTROS, MÊS E RELATÓRIO XLSX */}
      {/* ===================================================================== */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Busca + Filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0">
            {/* Campo de Busca */}
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar posto, substituto, titular ou motivo..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
              />
              {busca && (
                <button
                  onClick={() => setBusca("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Limpar busca"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filtro de Base / Unidade */}
            <div className="w-full sm:w-40">
              <select
                value={filtroBase}
                onChange={(e) => setFiltroBase(e.target.value)}
                className="w-full py-1.5 px-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all font-medium cursor-pointer"
                title="Filtrar por Base / Unidade"
              >
                <option value="TODAS">Todas as Bases</option>
                {basesDisponiveis.map((base) => (
                  <option key={base} value={base}>
                    {formatarTexto(base)}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro de Modalidade */}
            <div className="w-full sm:w-44">
              <select
                value={filtroModalidade}
                onChange={(e) => setFiltroModalidade(e.target.value)}
                className="w-full py-1.5 px-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all font-medium cursor-pointer"
                title="Filtrar por Modalidade de Cobertura"
              >
                <option value="TODAS">Todas as Modalidades</option>
                <option value="SUBSTITUICAO_INTERNA">Reserva Técnica</option>
                <option value="REMANEJAMENTO_ENTRE_POSTOS">Remanejamento</option>
                <option value="HORA_EXTRA_TITULAR_OUTRO_POSTO">Hora Extra</option>
                <option value="CONTRATACAO_TEMPORARIA">Contratação Temporária</option>
              </select>
            </div>
          </div>

          {/* Seletor do Mês + Emissão XLSX + Alternador de Visualização */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            {/* Filtro Mês */}
            <div className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50/70 shadow-2xs overflow-hidden">
              <span className="text-[11px] font-semibold text-emerald-900 pl-2.5">Mês:</span>
              <input
                type="month"
                value={competenciaRelatorio}
                onChange={(e) => setCompetenciaRelatorio(e.target.value)}
                className="text-xs bg-transparent px-2 py-1.5 text-emerald-950 font-semibold outline-none cursor-pointer"
                title="Filtrar coberturas pelo mês de competência"
                aria-label="Mês do relatório de coberturas"
              />
              <button
                id="btn-relatorio-coberturas-mes"
                onClick={handleGerarRelatorioMensal}
                disabled={gerandoRelatorio}
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 transition-colors cursor-pointer"
                title="Baixar relatório oficial em planilha Excel com abas Resumo e Coberturas (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{gerandoRelatorio ? "Gerando..." : "Relatório XLSX"}</span>
              </button>
            </div>

            {/* Alternador Tabela / Cards */}
            <div className="inline-flex bg-slate-100/90 p-1 rounded-xl text-slate-600 border border-slate-200/60 shadow-2xs">
              <button
                onClick={() => setModoVisualizacao("TABELA")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  modoVisualizacao === "TABELA"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "hover:text-slate-900 hover:bg-white/40"
                }`}
                title="Modo Tabela (Padrão)"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setModoVisualizacao("CARDS")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  modoVisualizacao === "CARDS"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "hover:text-slate-900 hover:bg-white/40"
                }`}
                title="Modo Cards Operacionais"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Linha Inferior: Abas de Status CLT / Todas e Contador "Exibindo X de Y" */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="inline-flex bg-slate-100/90 p-0.5 rounded-xl text-xs font-medium text-slate-600 border border-slate-200/60">
            <button
              onClick={() => {
                setFiltroStatus("TODAS");
                setFiltroCardAtivo("TODOS");
              }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                filtroStatus === "TODAS" && filtroCardAtivo === "TODOS"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "hover:text-slate-900 hover:bg-white/40"
              }`}
            >
              <span>Todas no Mês</span>
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold bg-slate-200 text-slate-700">
                {coberturasDoMes.length}
              </span>
            </button>
            <button
              onClick={() => {
                setFiltroStatus("ALERTA_CLT");
                setFiltroCardAtivo("ALERTAS_CLT");
              }}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                filtroStatus === "ALERTA_CLT" || filtroCardAtivo === "ALERTAS_CLT"
                  ? "bg-amber-600 text-white shadow-xs font-semibold"
                  : "hover:text-amber-900 text-slate-600 hover:bg-white/40"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Alertas CLT Art. 66/67</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                  filtroStatus === "ALERTA_CLT" || filtroCardAtivo === "ALERTAS_CLT" ? "bg-amber-700 text-white" : "bg-amber-100 text-amber-800"
                }`}
              >
                {coberturasDoMes.filter((c) => c.alertaInterjornada).length}
              </span>
            </button>
          </div>

          {/* Filtro Ativo do Card Badge */}
          {filtroCardAtivo !== "TODOS" && (
            <div className="inline-flex items-center gap-1.5 text-xs text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              <span className="font-medium">Filtro do Card:</span>
              <strong className="uppercase font-semibold text-[11px]">
                {filtroCardAtivo === "RESERVA_TECNICA"
                  ? "Reserva Técnica"
                  : "Alertas CLT"}
              </strong>
              <button
                onClick={() => setFiltroCardAtivo("TODOS")}
                className="ml-1 text-blue-600 hover:text-blue-900 p-0.5"
                title="Remover filtro do card"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Contador Exibindo X de Y estritamente sincronizado com o mês e filtros */}
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <span>
              Exibindo <strong>{coberturasFiltradas.length}</strong> de <strong>{coberturasDoMes.length}</strong> coberturas em {formatarMesAnoExtenso(competenciaRelatorio)}
            </span>
            {(busca || filtroBase !== "TODAS" || filtroModalidade !== "TODAS" || filtroStatus !== "TODAS" || filtroCardAtivo !== "TODOS") && (
              <button
                onClick={() => {
                  setBusca("");
                  setFiltroBase("TODAS");
                  setFiltroModalidade("TODAS");
                  setFiltroStatus("TODAS");
                  setFiltroCardAtivo("TODOS");
                }}
                className="text-blue-600 hover:text-blue-800 font-semibold underline ml-1 cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. FEED DE COBERTURAS: MODO CARDS OU MODO TABELA COMPACTA (1366PX) */}
      {/* ===================================================================== */}
      {coberturasFiltradas.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-xs text-slate-400">
          <UserCheck2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-700 text-sm">
            Nenhuma cobertura em {formatarMesAnoExtenso(competenciaRelatorio)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {busca || filtroBase !== "TODAS" || filtroModalidade !== "TODAS" || filtroStatus !== "TODAS" || filtroCardAtivo !== "TODOS"
              ? "Tente ajustar a busca ou os filtros operacionais acima para esta competência."
              : "Não há registros de substituições operacionais cadastradas para o mês selecionado."}
          </p>
        </div>
      ) : modoVisualizacao === "CARDS" ? (
        /* MODO CARDS DE ANÁLISE OPERACIONAL */
        <div className="space-y-3">
          {coberturasFiltradas.map((cob) => {
            const { base, semBase } = obterBasePosto(cob, mapaBases);
            const infoJust = categorizarJustificativa(cob.justificativa, cob.titularNome, ehFiscalPetrobras);
            const ehPostoVago = !cob.titularNome || cob.titularNome.toLowerCase().includes("vago") || cob.titularNome === "Posto vago";

            return (
              <div
                key={cob.id}
                onClick={() => setCoberturaPainel(cob)}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all overflow-hidden cursor-pointer group"
              >
                <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50/90 to-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-xs text-slate-900">
                      {cob.postoCodigo}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {formatarTexto(cob.funcaoPosto)}
                    </span>
                    <span className="text-slate-300 text-xs hidden sm:inline">•</span>

                    {/* Base */}
                    {semBase ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        Sem base
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {base}
                      </span>
                    )}

                    {/* Período */}
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{formatarPeriodoResumido(cob.dataInicio, cob.dataFim)}</span>
                    </span>

                    {/* Modalidade (Apenas se diferente do padrão) */}
                    {cob.tipoCobertura !== "SUBSTITUICAO_INTERNA" && (
                      <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full">
                        {MODALIDADES_NOMES[cob.tipoCobertura] || cob.tipoCobertura}
                      </span>
                    )}

                    {/* Justificativa Pill */}
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${infoJust.classeBadge}`}>
                      {infoJust.rotuloExibicao}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {cob.alertaInterjornada && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full shadow-2xs">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>CLT Art. 66 ({cob.horasDescansoApuradas ? cob.horasDescansoApuradas.toFixed(1) + "h" : "< 11h"})</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Titular */}
                    <div className="md:col-span-5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {obterIniciais(cob.titularNome || "Posto Vago")}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Titular Ausente
                        </span>
                        {ehPostoVago ? (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            Posto vago
                          </span>
                        ) : (
                          <div className="font-semibold text-slate-900 text-xs break-words leading-tight">
                            {formatarNome(cob.titularNome)}
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Matr. {cob.titularMatricula || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-1 flex items-center justify-center text-slate-300">
                      <ArrowRight className="w-4 h-4" />
                    </div>

                    {/* Substituto */}
                    <div className="md:col-span-5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {obterIniciais(cob.substitutoNome)}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                          Substituto Designado
                        </span>
                        <div className="font-semibold text-blue-950 text-xs break-words leading-tight">
                          {formatarNome(cob.substitutoNome)}
                        </div>
                        <div className="text-[10px] font-mono text-blue-700 mt-0.5">
                          Matr. {cob.substitutoMatricula}
                        </div>
                      </div>
                    </div>

                    {/* Ação */}
                    <div className="md:col-span-1 flex items-center justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirModalEditar(cob);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Editar cobertura"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MODO TABELA COMPACTA (CABE EM 1366PX SEM ROLAGEM HORIZONTAL) */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse table-auto">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                {(
                  [
                    { campo: "posto", rotulo: "Posto / Função", largura: "w-[19%] px-3 py-3" },
                    { campo: "base", rotulo: "Base", largura: "w-[11%] px-2.5 py-3" },
                    { campo: "titular", rotulo: "Titular", largura: "w-[19%] px-2.5 py-3" },
                    { campo: "substituto", rotulo: "Substituto", largura: "w-[18%] px-2.5 py-3" },
                    { campo: "data", rotulo: "Período", largura: "w-[13%] px-2.5 py-3" },
                    { campo: "dias", rotulo: "Dias", alinhar: "text-center", largura: "w-[5%] px-2 py-3 text-center" },
                    { campo: "modalidade", rotulo: "Modalidade", largura: "w-[7%] px-2 py-3" },
                    { campo: "justificativa", rotulo: "Motivo", largura: "w-[11%] px-2.5 py-3" },
                  ] as { campo: CampoOrdenacao; rotulo: string; alinhar?: string; largura?: string }[]
                ).map((col) => {
                  const ativa = ordenacao.campo === col.campo;
                  const Icone = !ativa ? ChevronsUpDown : ordenacao.direcao === "asc" ? ChevronUp : ChevronDown;
                  return (
                    <th key={col.campo} className={`whitespace-nowrap ${col.largura || "py-3 px-2"} ${col.alinhar || ""}`}>
                      <button
                        type="button"
                        onClick={() => alternarOrdenacao(col.campo)}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-slate-900 transition-colors ${
                          ativa ? "text-blue-700 font-bold" : ""
                        }`}
                        title={`Ordenar por ${col.rotulo}`}
                      >
                        <span>{col.rotulo}</span>
                        <Icone className={`w-3 h-3 ${ativa ? "text-blue-600" : "text-slate-400"}`} />
                      </button>
                    </th>
                  );
                })}
                <th className="py-3 px-2.5 text-right w-[4%] whitespace-nowrap">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gruposPagina.map((grupo) => {
                const ehGrupoExpandido = gruposExpandidos.has(grupo.chave);
                const temMultiplas = grupo.itens.length > 1;
                const primeiroItem = grupo.itens[0];

                const semTitularGeral =
                  !grupo.titularesDistintos[0] ||
                  grupo.titularesDistintos[0] === "Sem titular" ||
                  grupo.titularesDistintos[0] === "Posto vago";

                return (
                  <React.Fragment key={grupo.chave}>
                    <tr
                      onClick={() => {
                        if (temMultiplas) {
                          alternarExpansaoGrupo(grupo.chave);
                        } else {
                          setCoberturaPainel(primeiroItem);
                        }
                      }}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                        ehGrupoExpandido ? "bg-slate-50/70" : ""
                      }`}
                    >
                      {/* Posto / Função */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          {temMultiplas && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                alternarExpansaoGrupo(grupo.chave);
                              }}
                              className="p-0.5 rounded hover:bg-slate-200 text-slate-500 transition-colors"
                              title={ehGrupoExpandido ? "Recolher dias" : "Expandir cada dia"}
                            >
                              {ehGrupoExpandido ? (
                                <ChevronDown className="w-3.5 h-3.5 text-blue-700" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                              )}
                            </button>
                          )}
                          <span className="font-mono font-semibold text-slate-900 text-xs">
                            {grupo.postoCodigo}
                          </span>
                          {temMultiplas && (
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full">
                              {grupo.itens.length}x
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal leading-tight mt-0.5">
                          {formatarTexto(grupo.funcaoPosto)}
                        </div>
                      </td>

                      {/* Base */}
                      <td className="py-2.5 px-2.5">
                        {grupo.semBase ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Sem base
                          </span>
                        ) : (
                          <span className="text-xs text-slate-700 font-medium">
                            {grupo.base}
                          </span>
                        )}
                      </td>

                      {/* Titular */}
                      <td className="py-2.5 px-2.5">
                        {temMultiplas && grupo.titularesDistintos.length > 1 ? (
                          <div className="text-xs font-semibold text-slate-700 leading-tight">
                            Múltiplos titulares ({grupo.titularesDistintos.length})
                          </div>
                        ) : semTitularGeral ? (
                          <span className="text-slate-400 text-xs italic">
                            Sem titular
                          </span>
                        ) : (
                          <div>
                            <div className="text-xs font-semibold text-slate-800 break-words whitespace-normal leading-tight">
                              {formatarNome(grupo.titularesDistintos[0])}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              Matr. {primeiroItem.titularMatricula || "—"}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Substituto */}
                      <td className="py-2.5 px-2.5">
                        <div className="text-xs font-semibold text-blue-950 break-words whitespace-normal leading-tight">
                          {formatarNome(grupo.substitutoNome)}
                        </div>
                        <div className="text-[10px] font-mono text-blue-700 mt-0.5">
                          Matr. {grupo.substitutoMatricula}
                        </div>
                      </td>

                      {/* Período */}
                      <td className="py-2.5 px-2.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {grupo.datasResumidas}
                        </div>
                      </td>

                      {/* Dias */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200/60">
                          {grupo.totalDiasNoMes}
                        </span>
                      </td>

                      {/* Modalidade (Apenas se diferente do padrão Reserva Técnica) */}
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        {grupo.todasReservaTecnica ? (
                          <span className="text-slate-300 text-xs">—</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            {MODALIDADES_NOMES[grupo.modalidadesDistintas[0]] || grupo.modalidadesDistintas[0]}
                          </span>
                        )}
                        {grupo.temAlertaClt && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300 ml-1"
                            title="CLT Art. 66: repouso < 11h"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            CLT
                          </span>
                        )}
                      </td>

                      {/* Motivo / Justificativa Category Badge */}
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${grupo.categoriaClasse}`}
                        >
                          {grupo.categoriaRotulo}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirModalEditar(primeiroItem);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar cobertura"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* Linhas Filhas Expandidas */}
                    {temMultiplas &&
                      ehGrupoExpandido &&
                      grupo.itens.map((subCob, idxSub) => {
                        const infoSub = categorizarJustificativa(
                          subCob.justificativa,
                          subCob.titularNome,
                          ehFiscalPetrobras
                        );
                        const subDias = calcularDias(subCob.dataInicio, subCob.dataFim);
                        const ehSubVago =
                          !subCob.titularNome ||
                          subCob.titularNome === "Sem titular" ||
                          subCob.titularNome === "Posto vago";

                        return (
                          <tr
                            key={subCob.id}
                            onClick={() => setCoberturaPainel(subCob)}
                            className="bg-blue-50/20 hover:bg-blue-50/50 transition-colors cursor-pointer text-[11px]"
                          >
                            <td className="py-2 px-3 pl-8 text-slate-500 font-mono flex items-center gap-1.5">
                              <span className="text-slate-400 font-mono">↳ dia {idxSub + 1}</span>
                            </td>
                            <td className="py-2 px-2.5 text-slate-400">—</td>
                            <td className="py-2 px-2.5">
                              {ehSubVago ? (
                                <span className="text-slate-400 text-xs italic">
                                  Sem titular
                                </span>
                              ) : (
                                <div className="font-medium text-slate-800 break-words leading-tight">
                                  {formatarNome(subCob.titularNome)}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 font-medium">
                              {formatarNome(subCob.substitutoNome)}
                            </td>
                            <td className="py-2 px-2.5 font-mono text-slate-700 whitespace-nowrap">
                              {formatarPeriodoResumido(subCob.dataInicio, subCob.dataFim)}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-600 font-medium">
                              {subDias}d
                            </td>
                            <td className="py-2 px-2 text-slate-400 whitespace-nowrap">
                              {subCob.tipoCobertura !== "SUBSTITUICAO_INTERNA" ? (
                                <span className="inline-block px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
                                  {MODALIDADES_NOMES[subCob.tipoCobertura] || subCob.tipoCobertura}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${infoSub.classeBadge}`}
                              >
                                {infoSub.rotuloExibicao}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalEditar(subCob);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Editar este dia de cobertura"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Paginação */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200/80 bg-slate-50/50 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-medium">
                Exibindo <strong>{(paginaSegura - 1) * itensPorPagina + 1}</strong> a{" "}
                <strong>{Math.min(paginaSegura * itensPorPagina, gruposOrdenados.length)}</strong> de{" "}
                <strong>{gruposOrdenados.length}</strong> registros agrupados ({coberturasFiltradas.length} coberturas)
              </span>
              <span className="text-slate-300">|</span>
              <label className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Por página:</span>
                <select
                  value={itensPorPagina}
                  onChange={(e) => setItensPorPagina(Number(e.target.value))}
                  className="border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 font-medium outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                >
                  {ITENS_POR_PAGINA_OPCOES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                disabled={paginaSegura <= 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs text-slate-700 font-medium inline-flex items-center gap-1 transition-all"
                title="Página anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
              <span className="px-3 py-1 font-semibold text-slate-800 bg-white border border-slate-200/80 rounded-lg shadow-2xs">
                {paginaSegura} / {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaSegura >= totalPaginas}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs text-slate-700 font-medium inline-flex items-center gap-1 transition-all"
                title="Próxima página"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. MODAL DE LISTAGEM DE POSTOS DESCOBERTOS */}
      {/* ===================================================================== */}
      {modalDescobertosAberto && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setModalDescobertosAberto(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-rose-400" />
                <h3 className="font-semibold text-sm">
                  Detalhamento de Postos Descobertos ({formatarMesAnoExtenso(competenciaRelatorio)})
                </h3>
              </div>
              <button
                onClick={() => setModalDescobertosAberto(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
              {totalDiasDescobertos === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-slate-800 text-sm">
                    Nenhum Posto Descoberto
                  </div>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
                    Todas as ausências de postos previstas para {formatarMesAnoExtenso(competenciaRelatorio)} foram devidamente cobertas. 100% de conformidade operacional.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-slate-600 font-medium">
                    Dias em que postos permaneceram sem profissional alocado:
                  </p>
                  {/* Se houver postos descobertos mapeados, lista-os */}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setModalDescobertosAberto(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. PAINEL LATERAL (DRAWER) DE DETALHES COMPLETOS DA COBERTURA */}
      {/* ===================================================================== */}
      {coberturaPainel && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity animate-fadeIn"
            onClick={() => setCoberturaPainel(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-slideLeft">
              {/* Topo do Painel */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
                    <UserCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Ficha da Cobertura</h3>
                    <p className="text-[11px] text-slate-300 font-mono">
                      {coberturaPainel.postoCodigo}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCoberturaPainel(null)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                  title="Fechar painel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Corpo com Rolagem */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {/* Cartão de Identificação do Posto & Base */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Posto & Base Operacional
                    </span>
                    {(() => {
                      const { base, semBase } = obterBasePosto(coberturaPainel, mapaBases);
                      return semBase ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Sem base
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {base}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-sm">
                    {coberturaPainel.postoCodigo}
                  </div>
                  <div className="text-slate-600 font-medium">
                    {formatarTexto(coberturaPainel.funcaoPosto)}
                  </div>
                </div>

                {/* Titular vs Substituto */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Titular Ausente
                    </span>
                    {!coberturaPainel.titularNome ||
                    coberturaPainel.titularNome.toLowerCase().includes("vago") ||
                    coberturaPainel.titularNome === "Posto vago" ? (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold text-xs flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Posto vago (Ausência de titular permanente)</span>
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-slate-800 text-xs">
                          {formatarNome(coberturaPainel.titularNome)}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Matrícula: {coberturaPainel.titularMatricula || "—"}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block mb-1">
                      Substituto Designado
                    </span>
                    <div className="font-bold text-blue-950 text-xs">
                      {formatarNome(coberturaPainel.substitutoNome)}
                    </div>
                    <div className="text-[11px] font-mono text-blue-700 mt-0.5">
                      Matrícula: {coberturaPainel.substitutoMatricula}
                    </div>
                  </div>
                </div>

                {/* Período e Modalidade */}
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Período
                    </span>
                    <div className="font-mono text-slate-800 mt-1 font-semibold">
                      {formatarPeriodoResumido(coberturaPainel.dataInicio, coberturaPainel.dataFim)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {formatarDataBr(coberturaPainel.dataInicio)} a {formatarDataBr(coberturaPainel.dataFim)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Modalidade
                    </span>
                    <div className="mt-1 font-medium text-slate-800">
                      {MODALIDADES_NOMES[coberturaPainel.tipoCobertura] || coberturaPainel.tipoCobertura}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Total: {calcularDias(coberturaPainel.dataInicio, coberturaPainel.dataFim)} dia(s)
                    </div>
                  </div>
                </div>

                {/* Justificativa e Motivo (com LGPD para Fiscal Petrobras) */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  {(() => {
                    const info = categorizarJustificativa(
                      coberturaPainel.justificativa,
                      coberturaPainel.titularNome,
                      ehFiscalPetrobras
                    );
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Motivo & Justificativa
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${info.classeBadge}`}>
                            {info.rotuloExibicao}
                          </span>
                        </div>
                        <p className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                          {info.textoCompletoSeguro}
                        </p>
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleCopiarJustificativa(info.textoCompletoSeguro)}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copiar justificativa</span>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Conformidade Interjornada CLT Artigo 66 */}
                {coberturaPainel.alertaInterjornada ? (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Alerta de Quebra de Interjornada — CLT Art. 66</span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      {coberturaPainel.detalhesInterjornada ||
                        `Descanso apurado de ${coberturaPainel.horasDescansoApuradas ? coberturaPainel.horasDescansoApuradas.toFixed(1) + "h" : "< 11h"} entre jornadas consecutivas (abaixo do intervalo legal de 11h).`}
                    </p>
                    <div className="text-[10px] text-amber-800 font-medium">
                      Status: Cobertura autorizada em caráter excepcional com registro em auditoria.
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-[11px] font-medium">
                      <strong>Conformidade CLT Art. 66:</strong> Intervalo mínimo de 11 horas cumprido.
                    </span>
                  </div>
                )}
              </div>

              {/* Rodapé de Ações do Painel */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  {coberturaPainel.status !== "CANCELADA" && (
                    <button
                      onClick={() => handleCancelarCobertura(coberturaPainel.id)}
                      className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-semibold px-2 py-1.5 rounded hover:bg-amber-100/60 cursor-pointer"
                      title="Cancelar cobertura"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancelar</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleExcluirCobertura(coberturaPainel.id)}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1.5 rounded hover:bg-rose-100/60 cursor-pointer"
                    title="Excluir cobertura"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => abrirModalEditar(coberturaPainel)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => setCoberturaPainel(null)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 text-xs transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. MODAL INCLUIR / EDITAR COBERTURA */}
      {/* ===================================================================== */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200/80 overflow-hidden animate-scaleIn">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-start justify-between border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  {coberturaEmEdicao ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-100">
                    {coberturaEmEdicao ? `Editar Cobertura — Posto ${coberturaEmEdicao.postoCodigo}` : "Nova Cobertura"}
                  </h3>
                  {coberturaEmEdicao ? (
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      <span className="font-medium text-slate-200">
                        {coberturaEmEdicao.funcaoPosto}
                      </span>
                      <span className="text-slate-500"> • </span>
                      <span className="text-slate-400">Titular: </span>
                      <strong className="text-slate-200">
                        {coberturaEmEdicao.titularNome || "Posto vago"}
                      </strong>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Informe o posto, substituto e o período de cobertura
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalAberto(false);
                  setCoberturaEmEdicao(null);
                }}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCobertura} className="p-5 space-y-3.5 text-xs">
              {!coberturaEmEdicao && (
                <div>
                  <label className="font-medium text-slate-700 block mb-1">
                    Posto que Requer Cobertura <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formPostoCodigo}
                    onChange={(e) => setFormPostoCodigo(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
                  >
                    <option value="">Selecione o posto...</option>
                    {postos.map((p) => (
                      <option key={p.codigoPosto || p.id} value={p.codigoPosto || p.id}>
                        {p.codigoPosto || p.id} — {p.funcao} ({p.localAtuacao || p.unidadeNome || "Sem base"}) [Titular: {p.titularNome || "VAGO"}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formPostoCodigo && posicoesDoPostoForm.length > 0 && (
                <div>
                  <label className="font-medium text-slate-700 block mb-1">
                    Posição Coberta <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formVagaId}
                    onChange={(e) => setFormVagaId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
                  >
                    <option value="">Selecione a posição...</option>
                    {posicoesDoPostoForm.map((p) => (
                      <option key={p.vaga.id} value={p.vaga.id}>
                        {p.rotulo} — Titular: {p.titularNome || "VAGO"}{p.titularMatricula ? ` (${p.titularMatricula})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-medium text-slate-700 block mb-1">
                  Profissional Substituto <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formSubstitutoMatricula}
                  onChange={(e) => setFormSubstitutoMatricula(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
                >
                  <option value="">Selecione o substituto...</option>
                  {formSubstitutoMatricula &&
                    !profissionais.some((p) => p.matricula === formSubstitutoMatricula) && (
                      <option value={formSubstitutoMatricula}>
                        {coberturaEmEdicao?.substitutoNome || formSubstitutoMatricula} ({formSubstitutoMatricula}) [Atual]
                      </option>
                  )}
                  <optgroup label="⚡ Feristas Dedicados do Contrato (Equipe de Cobertura)">
                    {FERISTAS_REV04.filter((f) => f.chapaRM).map((f) => {
                      const mat = f.chapaRM!;
                      return (
                        <option key={mat} value={mat}>
                          ⚡ {f.colaborador} ({mat}) — Base {f.unidade}
                        </option>
                      );
                    })}
                  </optgroup>
                  <optgroup label="Reserva Técnica">
                    {profissionais
                      .filter(
                        (pr) =>
                          pr.situacao === "ATIVO" &&
                          !pr.postoCodigo &&
                          pr.matricula !== postos.find((p) => p.codigoPosto === formPostoCodigo)?.titularMatricula
                      )
                      .map((pr) => (
                        <option key={pr.matricula} value={pr.matricula}>
                          ★ {pr.nome} ({pr.matricula})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Remanejamento de Outro Posto">
                    {profissionais
                      .filter(
                        (pr) =>
                          pr.situacao === "ATIVO" &&
                          pr.postoCodigo &&
                          pr.matricula !== postos.find((p) => p.codigoPosto === formPostoCodigo)?.titularMatricula
                      )
                      .map((pr) => (
                        <option key={pr.matricula} value={pr.matricula}>
                          {pr.nome} ({pr.matricula}) — Titular em {pr.postoCodigo}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Data Início</label>
                  <input
                    type="date"
                    required
                    value={formDataInicio}
                    onChange={(e) => setFormDataInicio(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Data Término</label>
                  <input
                    type="date"
                    required
                    value={formDataFim}
                    onChange={(e) => setFormDataFim(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
                  />
                </div>
              </div>

              {/* Alerta CLT Art. 66 */}
              {validacaoInterjornada && !validacaoInterjornada.atende && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between text-amber-900 font-bold">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Descanso de {validacaoInterjornada.horasDescansoFormatado} (CLT Art. 66 &lt; 11h)
                    </span>
                    <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-mono">
                      Déficit: -{validacaoInterjornada.deficitFormatado}
                    </span>
                  </div>
                  <label className="flex items-start gap-2 pt-0.5 text-[11px] text-amber-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cienteInterjornada}
                      onChange={(e) => setCienciaInterjornada(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Ciente do intervalo inferior a 11h. Autorizo em caráter excepcional.</span>
                  </label>
                </div>
              )}

              {/* Modalidade */}
              <div>
                <label className="font-medium text-slate-700 block mb-1">Modalidade da Cobertura</label>
                <select
                  value={formTipo}
                  onChange={(e) => setFormTipo(e.target.value as CoberturaOperacional["tipoCobertura"])}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
                >
                  <option value="SUBSTITUICAO_INTERNA">Reserva Técnica (Padrão)</option>
                  <option value="REMANEJAMENTO_ENTRE_POSTOS">Remanejamento entre Postos</option>
                  <option value="HORA_EXTRA_TITULAR_OUTRO_POSTO">Extensão de Jornada / Hora Extra</option>
                  <option value="CONTRATACAO_TEMPORARIA">Contratação Temporária</option>
                </select>
              </div>

              {/* Justificativa */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-slate-700 block">
                    Justificativa Operacional <span className="text-slate-400 font-normal text-[11px]">(obrigatória)</span>
                  </label>
                  {formJustificativa && (
                    <button
                      type="button"
                      onClick={() => setFormJustificativa("")}
                      className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {SUGESTOES_JUSTIFICATIVA.map((motivo) => {
                    const ativo = formJustificativa.toLowerCase().includes(motivo.toLowerCase());
                    return (
                      <button
                        key={motivo}
                        type="button"
                        onClick={() => inserirMotivoJustificativa(motivo)}
                        className={`text-[11px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                          ativo
                            ? "bg-blue-50 text-blue-700 border-blue-200 font-semibold"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        + {motivo}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={3}
                  placeholder="Descreva o motivo da ausência e da cobertura..."
                  value={formJustificativa}
                  onChange={(e) => setFormJustificativa(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition-all text-xs resize-y min-h-[64px]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalAberto(false);
                    setCoberturaEmEdicao(null);
                  }}
                  className="px-3.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium rounded-lg transition-colors cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer text-xs"
                >
                  {coberturaEmEdicao ? "Salvar Alterações" : "Confirmar Cobertura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: DETALHAMENTO DE POSTOS DESCOBERTOS */}
      {modalDescobertosAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-gradient-to-r from-rose-50 to-white border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Detalhamento de Postos Descobertos ({totalDiasDescobertos})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ausências operacionais sem substituto designado para a competência {formatarMesAnoExtenso(competenciaRelatorio)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalDescobertosAberto(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {listaDescobertosNoMes.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="font-bold text-slate-800 text-sm">Operação 100% Conforme!</p>
                  <p className="text-xs text-slate-500">Nenhum posto ou posição descoberta na competência selecionada.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Posto / Posição</th>
                        <th className="py-2.5 px-3">Base</th>
                        <th className="py-2.5 px-3">Titular Ausente</th>
                        <th className="py-2.5 px-3">Motivo</th>
                        <th className="py-2.5 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {listaDescobertosNoMes.map((item) => (
                        <tr key={item.id} className="hover:bg-rose-50/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatarDataBr(item.data)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-slate-900 block">{item.postoCodigo}</span>
                            <span className="text-[10px] text-slate-500">{item.funcaoPosto} • {item.posicaoRotulo}</span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                            {item.base}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {formatarNome(item.titularNome)}
                            <span className="block text-[10px] font-mono text-slate-400">Matr. {item.titularMatricula}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                              item.categoria === "Férias"
                                ? "bg-blue-100 text-blue-800"
                                : item.categoria === "Afastamento"
                                ? "bg-purple-100 text-purple-800"
                                : item.categoria === "Falta"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-800"
                            }`}>
                              {item.motivo}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setModalDescobertosAberto(false);
                                abrirModalIncluir(item.postoCodigo, item.data, item.vagaId);
                              }}
                              className="inline-flex items-center gap-1 bg-premier-900 hover:bg-premier-800 text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                            >
                              <Plus className="w-3 h-3 text-emerald-400" />
                              <span>Designar Cobertura</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setModalDescobertosAberto(false)}
                className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
