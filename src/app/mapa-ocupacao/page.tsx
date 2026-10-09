"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  X,
  Clock,
  Building2,
  FilterX,
  ChevronRight,
  ChevronDown,
  Calendar,
  Layers,
  History,
  Briefcase,
  AlertTriangle,
  UserX,
  SlidersHorizontal,
  Users,
  Trash2,
} from "lucide-react";
import { BadgeStatus, StatusOcupacao } from "@/components/ui/badge-status";
import { CampoItemPpu } from "@/components/cobertura/campo-item-ppu";
import { BASES_SGP_SISTEMA } from "@/lib/dados/secoes-horarios";
import {
  carregarEstado,
  calcularStatusDia,
  calcularStatusVagaDia,
  calcularTotaisVagaCiclo,
  obterPeriodoCicloPadrao,
  obterTodosPostosContrato,
  obterMarcacoesPonto,
  obterDataReferenciaPonto,
  obterHistoricoAlocacoesVaga,
  obterAlocacaoVigenteVaga,
  obterTipoPosto,
  verificarFeriadoBase,
  calcularApuracaoPostoCiclo,
  atualizarEscalaPosicao,
  registrarAjusteManualDia,
  removerAjusteManualDia,
  obterAjusteManualDia,
  validarVinculoFeristaPosto,
  registrarCoberturaComValidacao,
  obterItemPpuDoPosto,
  isCoberturaAtivaParaPosicao,
  excluirCobertura,
  obterProgressoProgramacaoEscalas,
  registrarLogAuditoria,
  ApuracaoPostoCiclo,
  VAGAS_MC_REAIS,
  ALOCACOES_MC_REAIS,
  PostoOperacional,
  VagaPosto,
  AlocacaoVaga,
  OcorrenciaOperacional,
  CoberturaOperacional,
  ApontamentoOperacional,
  OcupacaoDiaDetalhada,
  OcupacaoVagaDia,
  TotaisVagaCiclo,
  StatusAgregadoPosto,
  MarcacaoPontoOriginal,
  ProfissionalOperacional,
} from "@/lib/dados/estado-operacional";
import { calcularPeriodoCompetencia } from "@/lib/servicos/periodo-competencia";
import { obterItemPPU } from "@/lib/dados/painel-calculo";
import {
  PENDENCIAS_ESCALA_REV04,
  FERISTAS_REV04,
  VINCULOS_FERISTAS_POSTOS,
  PendenciaEscalaItem,
} from "@/lib/dados/estrutura-postos";
import { obterFeristasSugeridosParaPosicao } from "@/lib/servicos/sugestao-cobertura";
import {
  formatarHorarioExibicao,
  formatarSecaoExibicao,
  formatarCpfPorPerfil,
  formatarDataNascimentoPorPerfil,
  calcularIdade,
  podeVisualizarSalario,
  formatarSalarioPorPerfil,
  ehPerfilFiscalPetrobras,
  podeVerDadosPessoaisCompletos,
} from "@/lib/dados/rm-tipos";
import { useSessaoUsuario } from "@/lib/auth/use-sessao-usuario";
import { limparDadosOperacionaisOcupacao } from "@/lib/dados/limpeza-dados-demo";
import { analisarJornadaDia, montarEspelhoPeriodo } from "@/lib/servicos/analise-jornada";
import type { CicloEscalaColaborador } from "@/lib/dados/ponto-tipos";
import {
  RegistrosPontoDia,
  ModalEspelhoPeriodo,
  PessoaRegistroPonto,
} from "@/components/ponto/registros-ponto-dia";

/** Exigibilidade de jornada derivada do status apurado da posição no dia. */
function exigivelDoStatusPosicao(status: string): boolean | undefined {
  if (status === "PRESENTE" || status === "COBERTO" || status === "DESCOBERTO" || status === "PENDENTE") return true;
  if (status === "FOLGA") return false;
  return undefined; // decide pela escala do RM
}

const chapa6 = (c?: string | null) => String(c || "").replace(/\D/g, "").padStart(6, "0");

interface DiaCiclo {
  dataStr: string; // YYYY-MM-DD
  diaNumero: number;
  mes: number;
  ano: number;
  diaSemana: string; // DOM, SEG, TER...
  isFimDeSemana: boolean;
  isHoje: boolean;
}

/**
 * Passo 1 & 2: Obtém o código visual da posição (ex.: "7.1", "7.2")
 */
function obterCodigoVisualPosicao(vaga: VagaPosto, posto?: PostoOperacional): string {
  if ((vaga as any).codigoVisual) return String((vaga as any).codigoVisual);
  if (vaga.id.includes(".")) {
    const partes = vaga.id.split("-");
    const ult = partes[partes.length - 1];
    if (ult.includes(".")) return ult;
    return vaga.id;
  }
  const ref = posto?.idReferencia ?? posto?.idPosto ?? vaga.postoBase ?? vaga.idPosto;
  return `${ref}.${vaga.sequencia}`;
}

/**
 * Obtém as vagas/posições associadas a um posto através de múltiplas estratégias de chaveamento.
 */
function obterVagasDoPosto(posto: PostoOperacional, mapVagas: Map<string, VagaPosto[]>): VagaPosto[] {
  const idsParaTestar = [
    posto.idPosto,
    posto.id,
    posto.postoIdSGP,
    posto.codigoPosto,
    posto.idReferencia !== undefined && posto.idReferencia !== null ? String(posto.idReferencia) : undefined,
  ].filter(Boolean) as string[];

  for (const id of idsParaTestar) {
    const list = mapVagas.get(id);
    if (list && list.length > 0) return list;
  }
  return [];
}

/**
 * Passo 5: Identifica se a posição possui status "A VALIDAR"
 */
function ehPosicaoAValidar(vaga: VagaPosto): boolean {
  const status = (vaga.statusValidacao || (vaga as any).status || "").toUpperCase();
  return status === "A VALIDAR" || status === "A_VALIDAR" || vaga.conflitoCadastro === "REVISAR";
}

/**
 * Passo 2: Horário e escala abreviados em texto menor (ex.: "07h-16h48 • 5x2")
 */
function obterHorarioEEscalaAbreviados(
  vaga: VagaPosto,
  posto: PostoOperacional,
  alocVigente?: AlocacaoVaga
): string {
  // Fonte única: horário RM do ocupante vigente; depois o cadastro da posição; por último o posto.
  const horarioRm = String(
    alocVigente?.horarioEscalaRm || alocVigente?.horarioRM || (vaga as any).horarioRm || (vaga as any).horario_rm || ""
  ).toUpperCase();
  const escalaUpper = String(horarioRm || (vaga as any).escalaTipo || posto.escala || "5x2").toUpperCase();
  let escalaAbr = escalaUpper;
  if (escalaUpper.includes("12X36") || escalaUpper.includes("12 X 36")) escalaAbr = "12x36";
  else if (escalaUpper.includes("4X4") || escalaUpper.includes("4 X 4")) escalaAbr = "4x4";
  else if (escalaUpper.includes("4X2") || escalaUpper.includes("4 X 2")) escalaAbr = "4x2";
  else if (escalaUpper.includes("6X1") || escalaUpper.includes("6 X 1")) escalaAbr = "6x1";
  else if (escalaUpper.includes("5X2") || escalaUpper.includes("SEG/SEX")) escalaAbr = "5x2";
  else if (escalaUpper.includes("SEG/DOM")) escalaAbr = "Seg/Dom";

  const fmt = (h: string) => h.padStart(5, "0").replace(":00", "h").replace(":", "h");
  const faixa = String((vaga as any).faixaHoraria || (vaga as any).faixa_horaria || "");
  const m =
    horarioRm.match(/(\d{1,2}:\d{2})\s*(?:AS|ÀS|A|-)\s*(\d{1,2}:\d{2})/) ||
    faixa.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);

  let horarioAbr = "";
  if (m) {
    horarioAbr = `${fmt(m[1])}-${fmt(m[2])}`;
  } else if (posto.horarioInicio && posto.horarioFim) {
    horarioAbr = `${fmt(posto.horarioInicio.slice(0, 5))}-${fmt(posto.horarioFim.slice(0, 5))}`;
  } else if (posto.tipoPostoId?.includes("09H")) {
    horarioAbr = "07h-16h48";
  } else {
    horarioAbr = "07h-19h";
  }

  return `${horarioAbr} • ${escalaAbr}`;
}

/**
 * Paleta do Mapa de Calor (Item 3):
 * - P = verde bem claro | C = azul claro | N = branco/vazio | ? = cinza com hachura
 * - Sem dado = cinza tracejado | D = vermelho sólido (única cor forte da tela)
 * - Células SÓ com cor, SEM letras.
 */
function getEstiloCelulaHeatmap(status: string) {
  switch (status) {
    case "PRESENTE":
    case "TITULAR_PRESENTE":
      return {
        sigla: "P",
        label: "Presença do titular",
        classes: "bg-emerald-50 text-emerald-700/80 hover:bg-emerald-100 font-semibold",
        borda: "border border-emerald-100",
      };
    case "COBERTO":
      return {
        sigla: "C",
        label: "Cobertura (substituto)",
        classes: "bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold",
        borda: "border border-sky-200",
      };
    case "DESCOBERTO":
      return {
        sigla: "D",
        label: "Posição Descoberta (ausência sem cobertura)",
        classes: "bg-rose-600 text-white hover:bg-rose-700 font-bold",
        borda: "border border-rose-700",
      };
    case "SEM_DADO":
      return {
        sigla: "–",
        label: "Sem dado de presença ou ausência importado",
        classes: "bg-[#F3F4F6] text-slate-400 border border-dashed border-[#D1D5DB] hover:bg-slate-200 font-normal",
        borda: "",
      };
    case "CICLO_NAO_CONFIGURADO":
      return {
        sigla: "·",
        label: "Escala em aberto (clique para incluir)",
        classes:
          "bg-white text-slate-300 border border-slate-200 hover:bg-blue-50/70 hover:border-blue-300 font-normal transition-colors cursor-pointer",
        borda: "border border-slate-200",
      };
    case "SEM_OCUPANTE":
    case "POSTO_VAGO":
      return {
        sigla: "V",
        label: "Sem ocupante alocado",
        classes: "bg-[#FEF08A] text-amber-900 hover:bg-[#FDE047] font-bold",
        borda: "border border-[#FDE047]",
      };
    case "FOLGA":
    case "NAO_EXIGIVEL":
    case "NAO_PROGRAMADO":
    default:
      return {
        sigla: "F",
        label: "Folga (não programado pela escala)",
        classes: "bg-white text-slate-300 hover:bg-slate-50 font-medium",
        borda: "border border-slate-100",
      };
  }
}

/**
 * Passo 3 — Células da posição (compatibilidade com visões legadas):
 */
function getCelulaEstiloPosicao(status: string) {
  switch (status) {
    case "PRESENTE":
    case "TITULAR_PRESENTE":
      return {
        sigla: "P",
        label: "Presença do titular",
        classes: "bg-emerald-50 text-emerald-700/80 border border-emerald-100 hover:bg-emerald-100 font-semibold",
      };
    case "COBERTO":
      return {
        sigla: "C",
        label: "Cobertura",
        classes: "bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100 font-bold",
      };
    case "DESCOBERTO":
      return {
        sigla: "D",
        label: "Descoberto",
        classes: "bg-rose-600 text-white border border-rose-700 hover:bg-rose-700 font-bold",
      };
    case "SEM_DADO":
      return {
        sigla: "–",
        label: "Sem dado",
        classes: "bg-[#F3F4F6] text-slate-500 border border-dashed border-[#D1D5DB] hover:bg-slate-200 font-medium",
      };
    case "SEM_OCUPANTE":
    case "POSTO_VAGO":
      return {
        sigla: "V",
        label: "Sem Ocupante",
        classes: "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 font-bold",
      };
    case "FOLGA":
    case "NAO_EXIGIVEL":
    case "NAO_PROGRAMADO":
      return {
        sigla: "F",
        label: "Folga",
        classes: "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 font-normal",
      };
    case "PENDENTE":
    case "PENDENTE_APURACAO":
      return {
        sigla: "–",
        label: "Pendente de apuração",
        classes: "bg-slate-50/70 text-slate-400 border-slate-300 border-dashed hover:bg-slate-100 font-medium",
      };
    case "CICLO_NAO_CONFIGURADO":
      return {
        sigla: "·",
        label: "Escala em aberto (clique para incluir)",
        classes: "bg-white text-slate-300 border border-slate-200 hover:bg-blue-50/70 hover:border-blue-300 font-normal transition-colors cursor-pointer",
      };
    default:
      return {
        sigla: "F",
        label: "Folga",
        classes: "bg-slate-50 text-slate-400 border-slate-200 font-normal",
      };
  }
}

/**
 * Formata o título do posto em capitalização normal e sem repetição de regime (Item 5):
 * Ex.: "Posto 1 · Suporte à Operação de Mobilidade"
 */
function formatarTituloPosto(posto: PostoOperacional): string {
  let raw = posto.funcao || posto.descricao || "Posto";
  if (raw.includes("|")) {
    const partes = raw.split("|");
    raw = partes[partes.length - 1].trim();
  }
  raw = raw.replace(/\s*[-/]\s*(adm\s*0?9h|12x36|4x4|5x2|turno|adm)\b/gi, "").trim();
  raw = raw.replace(/^posto\s+\d+\s*[-·:]\s*/i, "").trim();

  const palavras = raw.split(" ");
  const excecoesMinusculas = new Set(["de", "da", "do", "das", "dos", "e", "em", "à", "ao", "na", "no", "por", "para"]);
  const capitalizado = palavras
    .filter(Boolean)
    .map((p, idx) => {
      const lower = p.toLowerCase();
      if (idx > 0 && excecoesMinusculas.has(lower)) {
        return lower;
      }
      if (["nti", "sgp", "ppu", "nf", "sms", "ti", "rt", "ufn", "adm", "mc"].includes(lower)) {
        return lower.toUpperCase();
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");

  const ref = posto.idReferencia ?? (posto as any).postoBase ?? posto.idPosto ?? posto.codigoPosto;
  const postoIdSGP = posto.postoIdSGP || (posto as any).posto_id_sgp || posto.id;
  return `${postoIdSGP ? `${postoIdSGP} (ID ${ref})` : `Posto ${ref}`} · ${capitalizado || "Serviço Operacional"}`;
}

/**
 * Formata regime em UMA etiqueta discreta: "Adm 9h · 1 posição" (Item 5)
 */
function formatarEtiquetaRegime(posto: PostoOperacional, qtdPosicoes: number, vagasPosto: VagaPosto[] = []): string {
  // Escala real: a predominante no horário RM das posições do posto (não presumir 12x36 para todo Turno)
  const contagem = new Map<string, number>();
  for (const v of vagasPosto) {
    const t = String((v as any).horarioRm || (v as any).escalaTipo || "").toUpperCase();
    const e = t.includes("12X36") ? "12x36" : t.includes("4X4") ? "4x4" : t.includes("4X2") ? "4x2" : t.includes("SEG/SEX") ? "5x2" : "";
    if (e) contagem.set(e, (contagem.get(e) || 0) + 1);
  }
  const escalaPredominante = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  let regime = "Adm 9h";
  if (posto.tipoPostoId?.includes("TURNO")) {
    const horas = posto.tipoPostoId.match(/(\d{2})H/)?.[1];
    regime = `Turno${horas ? ` ${horas}h` : ""}${escalaPredominante ? ` ${escalaPredominante}` : ""}`;
  } else if (posto.tipoPostoId?.includes("09H")) {
    regime = "Adm 9h";
  } else if (posto.tipoPostoId?.includes("08H")) {
    regime = "Adm 8h";
  } else if (posto.escala) {
    regime = posto.escala;
  }
  const posTexto = qtdPosicoes === 1 ? "1 posição" : `${qtdPosicoes} posições`;
  return `${regime} · ${posTexto}`;
}

/**
 * Passo 4 — Células de percentual do posto:
 * - 100%: verde
 * - de 1% a 99%: âmbar, com o número
 * - 0%: vermelho
 * - sem exigência: "–" em cinza
 */
function getCelulaEstiloPercentualPosto(percentual: number | null, posicoesExigiveis: number) {
  if (posicoesExigiveis === 0 || percentual === null) {
    return {
      texto: "–",
      classes: "bg-slate-50 text-slate-400 border-slate-200 font-normal",
    };
  }
  if (percentual === 100) {
    return {
      texto: "100%",
      classes: "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold",
    };
  }
  if (percentual === 0) {
    return {
      texto: "0%",
      classes: "bg-rose-50 text-rose-800 border-rose-300 font-bold",
    };
  }
  return {
    texto: `${Math.round(percentual)}%`,
    classes: "bg-amber-50 text-amber-800 border-amber-300 font-bold",
  };
}

/**
 * Passo 2: Selo do percentual do ciclo no cabeçalho do posto
 */
function getSeloEstiloPercentualCiclo(percentual: number | null, formatado: string) {
  if (percentual === null || formatado === "–") {
    return "bg-slate-100 text-slate-500 border-slate-200 font-medium";
  }
  if (percentual === 100) {
    return "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
  }
  if (percentual === 0) {
    return "bg-rose-100 text-rose-800 border-rose-300 font-bold";
  }
  return "bg-amber-100 text-amber-800 border-amber-300 font-bold";
}

export default function MapaOcupacaoPage() {
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [vagas, setVagas] = useState<VagaPosto[]>([]);
  const [alocacoes, setAlocacoes] = useState<AlocacaoVaga[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);
  const [coberturas, setCoberturas] = useState<CoberturaOperacional[]>([]);
  const [apontamentos, setApontamentos] = useState<ApontamentoOperacional[]>([]);
  const [marcacoes, setMarcacoes] = useState<MarcacaoPontoOriginal[]>([]);
  const [dataRefLote, setDataRefLote] = useState<string | null>(null);
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);

  // Perfil e Permissões (definido pelo perfil sem seletor de modo)
  // Perfil REAL da sessão (/api/auth). Enquanto carrega ou se falhar, é null → visão restrita (LGPD fail-closed).
  const { perfil: perfilAtivo, sessao: sessaoUsuario } = useSessaoUsuario();
  const [pendenciasEscala, setPendenciasEscala] = useState<PendenciaEscalaItem[]>([]);

  // Limpeza de Dados Operacionais do Mapa (mantém posições, exclui presença/cobertura/descoberto)
  const [modalConfirmarLimpezaOperacional, setModalConfirmarLimpezaOperacional] = useState(false);
  const [limpandoOperacional, setLimpandoOperacional] = useState(false);
  const [mensagemLimpezaSucesso, setMensagemLimpezaSucesso] = useState("");

  const handleLimparDadosOperacionais = async () => {
    setLimpandoOperacional(true);
    try {
      limparDadosOperacionaisOcupacao(
        sessaoUsuario?.nome || "Administrador Premier"
      );
      setModalConfirmarLimpezaOperacional(false);
      setMensagemLimpezaSucesso(
        "Dados operacionais de presença, cobertura e ausências excluídos com sucesso. Todas as posições contratuais foram preservadas!"
      );
      await carregarDados();
      setTimeout(() => setMensagemLimpezaSucesso(""), 6000);
    } catch (err) {
      console.error("Erro ao limpar dados operacionais do mapa:", err);
    } finally {
      setLimpandoOperacional(false);
    }
  };

  // Visões: Grade de Ocupação, Árvore e Painel de Pendências (Premier)
  const [abaVisao, setAbaVisao] = useState<"GRADE" | "PPU" | "PENDENCIAS">("GRADE");

  // Filtros
  const [competencia, setCompetencia] = useState<string>("2026-09");
  const [filtroBase, setFiltroBase] = useState<string>("TODAS");
  const [filtroStatusAgregado, setFiltroStatusAgregado] = useState<string>("TODOS");
  const [busca, setBusca] = useState<string>("");

  // Filtros RM / Cadastros Importados
  const [filtroFuncao, setFiltroFuncao] = useState<string>("TODAS");
  const [filtroSituacao, setFiltroSituacao] = useState<string>("TODAS");
  const [mostrarMaisFiltros, setMostrarMaisFiltros] = useState<boolean>(false);

  // Intervalo de Datas do Filtro (Data Início e Data Fim)
  const [dataInicioFiltro, setDataInicioFiltro] = useState<string>("2026-08-10");
  const [dataFimFiltro, setDataFimFiltro] = useState<string>("2026-09-09");
  const diaReferenciaStr = dataInicioFiltro === dataFimFiltro ? dataInicioFiltro : "2026-09-02";

  // Controle de expansão da árvore (inicia fechado por padrão conforme Item 4)
  const [basesExpandidas, setBasesExpandidas] = useState<Set<string>>(new Set());
  const [postosExpandidos, setPostosExpandidos] = useState<Set<string>>(new Set());
  const [itensPpuExpandidos, setItensPpuExpandidos] = useState<Set<string>>(new Set());

  // Opção "Mostrar só exceções" (desativado por padrão)
  const [mostrarApenasExcecoes, setMostrarApenasExcecoes] = useState<boolean>(false);

  // Filtro ao clicar no Card Descobertos (Item 1: grade filtra só posições com D)
  const [filtroApenasDescobertos, setFiltroApenasDescobertos] = useState<boolean>(false);

  // Tooltip Flutuante no Hover da Grade/Quadro de Ocupação (Quem está cumprindo no dia)
  const [ativarTooltipHover, setAtivarTooltipHover] = useState<boolean>(true);
  const [tooltipOcupacao, setTooltipOcupacao] = useState<{
    rect: { top: number; left: number; width: number; height: number; bottom: number };
    vaga: VagaPosto;
    posto: PostoOperacional;
    dataStr: string;
    diaSemana: string;
    diaNumero: number;
    mes: number;
    statusVaga: OcupacaoVagaDia;
    estilo: { sigla: string; label: string; classes: string; borda?: string };
    codigoVisual: string;
    alocRef?: AlocacaoVaga;
    batidasReais?: string[];
  } | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drawer de Inspeção do Dia e Posição (Item 1: Código, escala, faixa horária, regime, grupo/fase/data-base, titular e mapa diário)
  const [drawerInspecao, setDrawerInspecao] = useState<{
    vaga: VagaPosto;
    posto: PostoOperacional;
    dataStr: string;
    ocupacao: OcupacaoVagaDia;
    postoOcupacao?: OcupacaoDiaDetalhada;
  } | null>(null);

  // Registros de ponto do dia (colaborador selecionado) e Espelho completo do período
  const [pessoaPontoAtiva, setPessoaPontoAtiva] = useState(0);
  const [espelhoPeriodoAberto, setEspelhoPeriodoAberto] = useState<{
    chapa: string;
    nome: string;
    horarioDescricao?: string;
    ehTitular: boolean;
  } | null>(null);

  // Estados de Edição da Escala da Posição (Item 5: Grupo, fase e data-base)
  const [editandoEscala, setEditandoEscala] = useState(false);
  const [formGrupo, setFormGrupo] = useState("");
  const [formFase, setFormFase] = useState("");
  const [formDataBase, setFormDataBase] = useState("");
  const [mensagemEscalaSucesso, setMensagemEscalaSucesso] = useState("");
  const [mensagemAjusteSucesso, setMensagemAjusteSucesso] = useState("");

  // Estados de Registro de Cobertura da Posição (Item 4: Posição, titular, quem cobre, período, motivo e validação de vínculo)
  const [registrandoCobertura, setRegistrandoCobertura] = useState(false);
  const [formSubstitutoChapa, setFormSubstitutoChapa] = useState("");
  const [formSubstitutoNome, setFormSubstitutoNome] = useState("");
  const [formDataInicioCob, setFormDataInicioCob] = useState("");
  const [formDataFimCob, setFormDataFimCob] = useState("");
  const [formMotivoCob, setFormMotivoCob] = useState("COBERTURA OPERACIONAL");
  const [formJustificativaNaoVinculado, setFormJustificativaNaoVinculado] = useState("");
  const [avisoVinculoSubstituto, setAvisoVinculoSubstituto] = useState<{ vinculado: boolean; mensagem: string } | null>(null);
  const [mensagemCoberturaSucesso, setMensagemCoberturaSucesso] = useState("");
  const [erroCobertura, setErroCobertura] = useState("");
  // Item da PPU da cobertura (base de cálculo da medição Petrobras)
  const [formItemPpuCob, setFormItemPpuCob] = useState("");
  useEffect(() => {
    if (registrandoCobertura && drawerInspecao) {
      setFormItemPpuCob(
        obterItemPpuDoPosto(drawerInspecao.posto.idPosto || drawerInspecao.posto.id) || ""
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrandoCobertura, drawerInspecao?.posto?.id]);

  // Filtros da aba de Pendências (Item 6)
  const [filtroPendenciaUnidade, setFiltroPendenciaUnidade] = useState<string>("TODAS");
  const [filtroPendenciaTipo, setFiltroPendenciaTipo] = useState<string>("TODOS");
  const [filtroPendenciaPrioridade, setFiltroPendenciaPrioridade] = useState<string>("TODAS");

  // Modal de Histórico de Alocações da Vaga
  const [modalHistorico, setModalHistorico] = useState<{
    vaga: VagaPosto;
    posto: PostoOperacional;
    alocacoes: AlocacaoVaga[];
  } | null>(null);

  // Carregamento de dados
  const carregarDados = useCallback(async () => {
    const estado = carregarEstado();

    const todosPostos = obterTodosPostosContrato(estado.postos);
    setPostos(todosPostos);
    setVagas(estado.vagas && estado.vagas.length > 0 ? estado.vagas : VAGAS_MC_REAIS);
    setAlocacoes(estado.alocacoes && estado.alocacoes.length > 0 ? estado.alocacoes : ALOCACOES_MC_REAIS);
    setOcorrencias([...(estado.ocorrencias || [])]);
    setCoberturas([...(estado.coberturas || [])]);
    setApontamentos(estado.apontamentos || []);
    setProfissionais(estado.profissionais || []);
    setPendenciasEscala(
      estado.pendenciasEscala && estado.pendenciasEscala.length > 0
        ? estado.pendenciasEscala
        : [...PENDENCIAS_ESCALA_REV04]
    );

    let pts = obterMarcacoesPonto();
    let dataRef = obterDataReferenciaPonto();

    if (!pts || pts.length === 0) {
      try {
        const res = await fetch("/api/ponto");
        if (res.ok) {
          const data = await res.json();
          if (data.sucesso && Array.isArray(data.marcacoes) && data.marcacoes.length > 0) {
            pts = data.marcacoes;
            dataRef = data.dataReferencia || dataRef;
          }
        }
      } catch (err) {
        console.warn("Aviso: Falha ao carregar ponto via /api/ponto:", err);
      }
    }

    setMarcacoes(pts || []);
    setDataRefLote(dataRef || null);

    // Bases iniciam fechadas por padrão conforme Item 4
    setBasesExpandidas(new Set());
  }, []);

  useEffect(() => {
    carregarDados();
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, [carregarDados]);

  // Set de Marcações O(1)
  const marcacoesSet = useMemo(() => {
    const set = new Set<string>();
    marcacoes.forEach((m: any) => {
      const matRaw = m.matricula || m.chapa || "";
      if (!matRaw) return;
      const chapa = String(matRaw).padStart(6, "0");
      const dataStr = m.dataLocal || m.dataHoraUtc || m.dataHora || m.data || "";
      if (typeof dataStr === "string" && dataStr.length >= 10) {
        set.add(`${chapa}_${dataStr.slice(0, 10)}`);
      }
    });
    return set;
  }, [marcacoes]);

  // Passo 1 & 2: Dias do ciclo padrão (dia 10 ao dia 09 do mês seguinte)
  const diasCiclo: DiaCiclo[] = useMemo(() => {
    // Fonte única da regra de competência (igual à MC): 10 do mês anterior a 09 do mês da competência
    const periodo = calcularPeriodoCompetencia(competencia);
    const [anoIni, mesIni, diaIni] = periodo.dataInicio.split("-").map(Number);
    const [anoFim, mesFim, diaFim] = periodo.dataFim.split("-").map(Number);

    const dtInicio = new Date(anoIni, mesIni - 1, diaIni);
    const dtFim = new Date(anoFim, mesFim - 1, diaFim);
    const hojeStr = new Date().toISOString().slice(0, 10);

    const lista: DiaCiclo[] = [];
    const dt = new Date(dtInicio);
    const nomesSemana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

    while (dt <= dtFim) {
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const d = dt.getDate();
      const dataStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = dt.getDay();

      lista.push({
        dataStr,
        diaNumero: d,
        mes: m,
        ano: y,
        diaSemana: nomesSemana[dayOfWeek],
        isFimDeSemana: dayOfWeek === 0 || dayOfWeek === 6,
        isHoje: dataStr === hojeStr,
      });

      dt.setDate(dt.getDate() + 1);
    }

    return lista;
  }, [competencia]);

  const datasDoCicloStr = useMemo(() => diasCiclo.map((d) => d.dataStr), [diasCiclo]);

  // Intervalo de dias visíveis no filtro (Data Início a Data Fim)
  const diasExibidosCiclo = useMemo(() => {
    if (diasCiclo.length === 0) return [];
    const ini = dataInicioFiltro || diasCiclo[0].dataStr;
    const fim = dataFimFiltro || diasCiclo[diasCiclo.length - 1].dataStr;
    return diasCiclo.filter((d) => d.dataStr >= ini && d.dataStr <= fim);
  }, [diasCiclo, dataInicioFiltro, dataFimFiltro]);

  // Mapeamento de vagas por Posto
  const vagasPorPosto = useMemo(() => {
    const map = new Map<string, VagaPosto[]>();
    vagas.forEach((v) => {
      const chaves = new Set<string>();
      if (v.idPosto) chaves.add(String(v.idPosto));
      if (v.postoIdSGP) chaves.add(String(v.postoIdSGP));
      if (v.postoBase !== undefined && v.postoBase !== null) chaves.add(String(v.postoBase));

      chaves.forEach((ch) => {
        const lista = map.get(ch) || [];
        if (!lista.some((existente) => existente.id === v.id)) {
          lista.push(v);
          map.set(ch, lista);
        }
      });
    });
    map.forEach((lista) => {
      lista.sort((a, b) => a.sequencia - b.sequencia);
    });
    return map;
  }, [vagas]);

  // Cache de cálculo do status diário por vaga e posto no dia de referência
  const statusNoDiaRefPorPosto = useMemo(() => {
    const map = new Map<string, OcupacaoDiaDetalhada>();
    const dataAlvo = diaReferenciaStr === "CICLO_COMPLETO" ? (diasCiclo[diasCiclo.length - 1]?.dataStr || "2026-09-02") : diaReferenciaStr;
    if (!dataAlvo) return map;

    const parts = dataAlvo.split("-").map(Number);
    const diaNum = parts[2];
    const mesNum = parts[1] - 1;
    const anoNum = parts[0];

    postos.forEach((p) => {
      const chave = p.idPosto || p.id;
      const vgs = obterVagasDoPosto(p, vagasPorPosto);
      const res = calcularStatusDia(
        p,
        diaNum,
        anoNum,
        mesNum,
        ocorrencias,
        coberturas,
        apontamentos,
        marcacoesSet,
        dataRefLote || "2026-09-15",
        vgs,
        alocacoes
      );
      map.set(chave, res);
    });

    return map;
  }, [postos, diaReferenciaStr, vagasPorPosto, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote, alocacoes]);

  // Passo 2 & 7: Apuração do ciclo completo por posto (com cada dia e percentual do ciclo)
  const apuracaoCicloPorPosto = useMemo(() => {
    const map = new Map<string, ApuracaoPostoCiclo>();
    if (diasCiclo.length === 0) return map;

    const periodoCiclo = {
      ano: diasCiclo[0].ano,
      mesReferencia: diasCiclo[diasCiclo.length - 1].mes,
      dataInicio: diasCiclo[0].dataStr,
      dataFim: diasCiclo[diasCiclo.length - 1].dataStr,
      totalDias: diasCiclo.length,
      datas: datasDoCicloStr,
    };

    postos.forEach((p) => {
      const chave = p.idPosto || p.id;
      const vgs = obterVagasDoPosto(p, vagasPorPosto);
      const res = calcularApuracaoPostoCiclo(
        p,
        periodoCiclo,
        alocacoes,
        ocorrencias,
        coberturas,
        apontamentos,
        marcacoesSet,
        dataRefLote || "2026-09-15",
        vgs
      );
      map.set(chave, res);
    });

    return map;
  }, [postos, diasCiclo, datasDoCicloStr, vagasPorPosto, alocacoes, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote]);

  // Listas únicas para filtros
  const listaBases = useMemo(() => {
    const set = new Set<string>();
    postos.forEach((p) => {
      const base = p.localAtuacao || p.baseOperacional || p.unidadeNome || p.unidadeId;
      if (base) set.add(base.trim());
    });
    return Array.from(set).sort();
  }, [postos]);

  const listaGerencias = useMemo(() => {
    const set = new Set<string>();
    postos.forEach((p) => {
      if (p.gerenciaPetrobras) set.add(p.gerenciaPetrobras.trim());
    });
    return Array.from(set).sort();
  }, [postos]);

  // Map de profissionais por chapa para acesso rápido O(1)
  const mapaProfissionaisPorChapa = useMemo(() => {
    const map = new Map<string, ProfissionalOperacional>();
    profissionais.forEach((p) => {
      if (p.chapa) map.set(p.chapa.trim(), p);
      if (p.matricula) map.set(p.matricula.trim(), p);
    });
    return map;
  }, [profissionais]);

  // Opções de filtros derivados dos cadastros RM
  const funcoesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    profissionais.forEach((p) => {
      if (p.funcao) set.add(p.funcao.trim());
    });
    postos.forEach((p) => {
      if (p.funcao) set.add(p.funcao.trim());
    });
    return Array.from(set).sort();
  }, [profissionais, postos]);

  const situacoesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    profissionais.forEach((p) => {
      const s = p.situacaoDescricao || p.situacao;
      if (s) set.add(s.trim());
    });
    return Array.from(set).sort();
  }, [profissionais]);

  // Filtragem dos Postos
  const postosFiltrados = useMemo(() => {
    return postos.filter((p) => {
      const idChave = p.idPosto || p.id;
      const base = p.localAtuacao || p.baseOperacional || p.unidadeNome || p.unidadeId || "";
      const statusRef = statusNoDiaRefPorPosto.get(idChave);
      const statusAgregado = statusRef?.statusAgregado || "COMPLETO";

      if (filtroBase !== "TODAS" && base.toUpperCase().trim() !== filtroBase.toUpperCase().trim()) {
        return false;
      }

      // Filtro rápido de descobertos (ao clicar no card "Descobertos" do topo)
      if (filtroApenasDescobertos) {
        const apCiclo = apuracaoCicloPorPosto.get(idChave);
        const temD = apCiclo?.dias?.some((d) =>
          d.vagasDetalhe?.some((vd) => vd.status === "DESCOBERTO")
        );
        if (!temD) return false;
      }

      if (filtroStatusAgregado !== "TODOS") {
        const apCiclo = apuracaoCicloPorPosto.get(idChave);
        if (filtroStatusAgregado === "DESCOBERTO") {
          const temD = apCiclo?.dias?.some((d) =>
            d.vagasDetalhe?.some((vd) => vd.status === "DESCOBERTO")
          );
          if (!temD) return false;
        } else if (filtroStatusAgregado === "SEM_DADO") {
          const temSemDado = apCiclo?.dias?.some((d) =>
            d.vagasDetalhe?.some((vd) => vd.status === "SEM_DADO")
          );
          if (!temSemDado) return false;
        } else if (filtroStatusAgregado === "CICLO_NAO_CONFIGURADO") {
          const temSemCiclo = apCiclo?.dias?.some((d) =>
            d.vagasDetalhe?.some((vd) => vd.status === "CICLO_NAO_CONFIGURADO")
          );
          if (!temSemCiclo) return false;
        } else if (statusAgregado !== filtroStatusAgregado) {
          return false;
        }
      }

      // Filtros RM (Cadastros Importados)
      const temFiltroRM =
        filtroFuncao !== "TODAS" ||
        filtroSituacao !== "TODAS";

      if (temFiltroRM) {
        const vgs = obterVagasDoPosto(p, vagasPorPosto);
        const atende = vgs.some((v) => {
          const aloc = alocacoes.find(
            (a) => a.vagaId === v.id || a.posicaoIdSGP === v.id || (v.id && a.vagaId?.includes(v.id))
          );
          const chapa = aloc?.matricula || (v as any).chapaTitular;
          const prof = chapa ? mapaProfissionaisPorChapa.get(chapa.trim()) : null;

          if (filtroFuncao !== "TODAS") {
            const func = prof?.funcao || p.funcao || "";
            if (func.toUpperCase().trim() !== filtroFuncao.toUpperCase().trim()) return false;
          }

          if (filtroSituacao !== "TODAS") {
            const sit = prof?.situacaoDescricao || prof?.situacao || "";
            if (sit.toUpperCase().trim() !== filtroSituacao.toUpperCase().trim()) return false;
          }

          return true;
        });

        if (!atende) {
          let atendePosto = true;
          if (filtroFuncao !== "TODAS" && p.funcao?.toUpperCase().trim() !== filtroFuncao.toUpperCase().trim()) {
            atendePosto = false;
          }
          if (!atendePosto || filtroSituacao !== "TODAS") {
            return false;
          }
        }
      }

      if (busca.trim()) {
        const termo = busca.trim().toLowerCase();
        const vgs = obterVagasDoPosto(p, vagasPorPosto);
        const matchVagas = vgs.some((v) => {
          const cod = obterCodigoVisualPosicao(v, p).toLowerCase();
          const titular = ((v as any).titularReferencia || "").toLowerCase();
          return cod.includes(termo) || v.id.toLowerCase().includes(termo) || titular.includes(termo);
        });

        const matchPosto =
          (p.idPosto || "").toLowerCase().includes(termo) ||
          (p.codigoPosto || "").toLowerCase().includes(termo) ||
          (p.funcao || "").toLowerCase().includes(termo) ||
          base.toLowerCase().includes(termo) ||
          (p.gerenciaPetrobras || "").toLowerCase().includes(termo);

        if (!matchPosto && !matchVagas) {
          return false;
        }
      }

      return true;
    });
  }, [
    postos,
    filtroBase,
    filtroStatusAgregado,
    filtroApenasDescobertos,
    filtroFuncao,
    filtroSituacao,
    mapaProfissionaisPorChapa,
    alocacoes,
    busca,
    statusNoDiaRefPorPosto,
    vagasPorPosto,
    apuracaoCicloPorPosto,
  ]);

  // Agrupamento por Unidade / Base com resumo e ordenação de descobertos primeiro (Item 4)
  const gruposPorBaseComResumo = useMemo(() => {
    const map = new Map<string, PostoOperacional[]>();
    postosFiltrados.forEach((p) => {
      const base = p.localAtuacao || p.baseOperacional || p.unidadeNome || "BASE NÃO INFORMADA";
      const lista = map.get(base) || [];
      lista.push(p);
      map.set(base, lista);
    });

    const resumos: Array<{
      baseNome: string;
      postos: PostoOperacional[];
      totalPostos: number;
      totalPosicoes: number;
      totalDiasD: number;
      taxaOcupacao: number;
    }> = [];

    map.forEach((postosDaBase, baseNome) => {
      let totalPosicoes = 0;
      let totalDiasD = 0;
      let somaExig = 0;
      let somaAtend = 0;

      postosDaBase.forEach((p) => {
        const idChave = p.idPosto || p.id;
        const vgs = obterVagasDoPosto(p, vagasPorPosto);
        totalPosicoes += vgs.length;

        const apCiclo = apuracaoCicloPorPosto.get(idChave);
        if (apCiclo) {
          somaExig += apCiclo.totalPosicoesExigiveis;
          somaAtend += apCiclo.totalPosicoesAtendidas;
          if (apCiclo.dias) {
            apCiclo.dias.forEach((d) => {
              if (d.vagasDetalhe) {
                d.vagasDetalhe.forEach((vd) => {
                  if (vd.status === "DESCOBERTO") {
                    totalDiasD++;
                  }
                });
              }
            });
          }
        }
      });

      const taxa = somaExig > 0 ? Math.round((somaAtend / somaExig) * 1000) / 10 : 100;

      resumos.push({
        baseNome,
        postos: postosDaBase,
        totalPostos: postosDaBase.length,
        totalPosicoes,
        totalDiasD,
        taxaOcupacao: taxa,
      });
    });

    // Ordenação (Item 4): Unidades com descobertos primeiro (descendente por totalDiasD), depois alfabética
    resumos.sort((a, b) => {
      if (a.totalDiasD > 0 && b.totalDiasD === 0) return -1;
      if (b.totalDiasD > 0 && a.totalDiasD === 0) return 1;
      if (a.totalDiasD !== b.totalDiasD) return b.totalDiasD - a.totalDiasD;
      return a.baseNome.localeCompare(b.baseNome);
    });

    return resumos;
  }, [postosFiltrados, vagasPorPosto, apuracaoCicloPorPosto]);

  // Lista compatível de grupos por base para as outras abas
  const gruposPorBase = useMemo(() => {
    return gruposPorBaseComResumo.map((r) => [r.baseNome, r.postos] as [string, PostoOperacional[]]);
  }, [gruposPorBaseComResumo]);

  // Agrupamento por Item da PPU (base da medição Petrobras): item → postos de todas as unidades
  const gruposPorItemPpu = useMemo(() => {
    const map = new Map<string, PostoOperacional[]>();
    postosFiltrados.forEach((p) => {
      const codigo = String(p.itemPPU || obterItemPpuDoPosto(p.postoIdSGP || p.idPosto || p.id) || "").trim() || "Sem item";
      const lista = map.get(codigo) || [];
      lista.push(p);
      map.set(codigo, lista);
    });

    const grupos = [...map.entries()].map(([codigo, postosDoItem]) => {
      let totalPosicoes = 0;
      let totalDiasD = 0;
      let somaExig = 0;
      let somaAtend = 0;
      const bases = new Set<string>();
      postosDoItem.forEach((p) => {
        bases.add(p.localAtuacao || p.baseOperacional || p.unidadeNome || "");
        totalPosicoes += obterVagasDoPosto(p, vagasPorPosto).length;
        const ap = apuracaoCicloPorPosto.get(p.idPosto || p.id);
        if (ap) {
          somaExig += ap.totalPosicoesExigiveis;
          somaAtend += ap.totalPosicoesAtendidas;
          ap.dias?.forEach((d) => d.vagasDetalhe?.forEach((vd) => { if (vd.status === "DESCOBERTO") totalDiasD++; }));
        }
      });
      const item = obterItemPPU(codigo);
      const postosOrdenados = [...postosDoItem].sort((a, b) =>
        String(a.localAtuacao || a.baseOperacional || "").localeCompare(String(b.localAtuacao || b.baseOperacional || "")) ||
        String(a.postoIdSGP || a.id).localeCompare(String(b.postoIdSGP || b.id), "pt-BR", { numeric: true })
      );
      return {
        codigo,
        descricao: item?.descricao || (codigo === "Sem item" ? "Postos sem item da PPU informado" : "Item fora do catálogo"),
        postos: postosOrdenados,
        totalPostos: postosDoItem.length,
        totalPosicoes,
        totalBases: bases.size,
        totalDiasD,
        taxaOcupacao: somaExig > 0 ? Math.round((somaAtend / somaExig) * 1000) / 10 : 100,
      };
    });

    // Ordem do catálogo (1.1, 1.2, 2.1 ... 11.1); "Sem item" por último
    return grupos.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
  }, [postosFiltrados, vagasPorPosto, apuracaoCicloPorPosto]);

  // 1. CARDS DO TOPO: Reduzir para 4 cards na mesma unidade de medida (Posições)
  const metricasCards = useMemo(() => {
    let totalPosicoes = 0;
    let posicoesExigiveisDiaRef = 0;
    let posicoesAtendidasDiaRef = 0;
    const posicoesDescobertasCicloSet = new Set<string>();

    const datasAlvoSet = new Set(diasExibidosCiclo.map((d) => d.dataStr));

    postosFiltrados.forEach((p) => {
      const idChave = p.idPosto || p.id;
      const vgs = obterVagasDoPosto(p, vagasPorPosto);
      totalPosicoes += vgs.length;

      const apCiclo = apuracaoCicloPorPosto.get(idChave);
      if (apCiclo?.dias) {
        apCiclo.dias.forEach((d) => {
          if (datasAlvoSet.has((d as any).dataStr || d.data)) {
            posicoesExigiveisDiaRef += d.posicoesExigiveis;
            posicoesAtendidasDiaRef += d.posicoesAtendidas;
          }
          if (d.vagasDetalhe) {
            d.vagasDetalhe.forEach((vd) => {
              if (vd.status === "DESCOBERTO") {
                posicoesDescobertasCicloSet.add(`${idChave}_${vd.vagaId || vd.posicaoId}`);
              }
            });
          }
        });
      }
    });

    const posicoesDescobertasDiaRef = Math.max(0, posicoesExigiveisDiaRef - posicoesAtendidasDiaRef);

    const taxaOcupacaoDiaRef =
      posicoesExigiveisDiaRef > 0
        ? Math.round((posicoesAtendidasDiaRef / posicoesExigiveisDiaRef) * 1000) / 10
        : 100;

    const totalPendenciasEscala = pendenciasEscala.filter(
      (p) => p.status !== "RESOLVIDA" && p.status !== "BAIXADA"
    ).length;

    return {
      totalPosicoes,
      taxaOcupacaoDiaRef: taxaOcupacaoDiaRef.toFixed(1),
      posicoesAtendidasDiaRef,
      posicoesExigiveisDiaRef,
      posicoesDescobertasDiaRef,
      posicoesDescobertasCiclo: posicoesDescobertasCicloSet.size,
      totalPendenciasEscala,
    };
  }, [
    postosFiltrados,
    vagasPorPosto,
    apuracaoCicloPorPosto,
    pendenciasEscala,
    diasExibidosCiclo,
  ]);

  const toggleBase = (base: string) => {
    setBasesExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(base)) next.delete(base);
      else next.add(base);
      return next;
    });
  };

  const togglePosto = (idPosto: string) => {
    setPostosExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(idPosto)) next.delete(idPosto);
      else next.add(idPosto);
      return next;
    });
  };

  const expandirTodasBases = () => {
    setBasesExpandidas(new Set(gruposPorBase.map(([base]) => base)));
  };

  const recolherTodasBases = () => {
    setBasesExpandidas(new Set());
    setPostosExpandidos(new Set());
  };

  // Permissões operacionais: Fiscal Petrobras tem perfil somente-leitura restrito. Usuários operacionais / Premier podem designar e registrar coberturas
  const ehFiscal = ehPerfilFiscalPetrobras(perfilAtivo);
  const podeEditarOperacao = !ehFiscal;
  const ehPremier = podeVerDadosPessoaisCompletos(perfilAtivo);

  // Lista de feristas e colaboradores candidatos para substituição
  const listaCandidatosCobertura = useMemo(() => {
    const list: Array<{ matricula: string; nome: string; ehFerista: boolean }> = [];
    const setMat = new Set<string>();

    (FERISTAS_REV04 || []).forEach((f) => {
      const mat = f.chapaRM || f.colaborador;
      if (mat && !setMat.has(mat)) {
        setMat.add(mat);
        list.push({ matricula: mat, nome: f.colaborador, ehFerista: true });
      }
    });

    profissionais.forEach((p) => {
      if (p.matricula && !setMat.has(p.matricula)) {
        setMat.add(p.matricula);
        list.push({
          matricula: p.matricula,
          nome: p.nome,
          ehFerista: p.tipoColaborador === "FERISTA" || p.statusAlocacao === "FERISTA",
        });
      }
    });

    return list.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [profissionais]);

  // Item 6: Contador "posições com programação completa / total"
  const progressoProgramacao = useMemo(() => {
    return obterProgressoProgramacaoEscalas(vagas, pendenciasEscala);
  }, [vagas, pendenciasEscala]);

  // Lista de pendências filtradas (Item 6)
  const pendenciasFiltradas = useMemo(() => {
    return pendenciasEscala.filter((p) => {
      if (filtroPendenciaUnidade !== "TODAS") {
        const un = (p.unidade || "").toUpperCase().trim();
        if (un !== filtroPendenciaUnidade.toUpperCase().trim()) return false;
      }
      if (filtroPendenciaTipo !== "TODOS") {
        if (p.tipo !== filtroPendenciaTipo) return false;
      }
      if (filtroPendenciaPrioridade !== "TODAS") {
        if (p.prioridade !== filtroPendenciaPrioridade) return false;
      }
      return true;
    });
  }, [pendenciasEscala, filtroPendenciaUnidade, filtroPendenciaTipo, filtroPendenciaPrioridade]);

  // Sugestão de Feristas Vinculados Disponíveis para Posição Descoberta inspecionada (Item 3)
  const feristasSugeridosDrawer = useMemo(() => {
    if (!drawerInspecao || drawerInspecao.ocupacao.status !== "DESCOBERTO") return [];
    return obterFeristasSugeridosParaPosicao(
      drawerInspecao.posto.idPosto || drawerInspecao.posto.id,
      drawerInspecao.dataStr,
      { postos, vagas, alocacoes, ocorrencias, coberturas } as any
    );
  }, [drawerInspecao, postos, vagas, alocacoes, ocorrencias, coberturas]);

  // Contexto de jornada prevista da posição (horário RM da posição/titular e data-base da escala)
  const obterContextoPontoVaga = useCallback(
    (vaga: VagaPosto, dataStr: string) => {
      const titular: any = obterAlocacaoVigenteVaga(vaga.id, alocacoes, dataStr);
      const chapaTitular: string | undefined = titular?.matricula || (vaga as any).chapaTitular || undefined;
      const profTitular = chapaTitular ? mapaProfissionaisPorChapa.get(String(chapaTitular).trim()) : undefined;
      const horarioPosicao: string | undefined =
        (vaga as any).horario_rm || (vaga as any).horarioRm || profTitular?.horarioDescricao || titular?.horarioEscalaRm || undefined;
      const dataBase: string | undefined =
        (vaga as any).dataBaseEscala || (vaga as any).data_base_escala || (vaga as any).dataBaseCiclo || undefined;
      const ciclo: CicloEscalaColaborador | undefined = dataBase
        ? { colaboradorId: "", chapa: chapaTitular || "", horarioCodigo: "", dataBaseCiclo: dataBase, confirmado: true }
        : undefined;
      return { titular, chapaTitular, profTitular, horarioPosicao, ciclo };
    },
    [alocacoes, mapaProfissionaisPorChapa]
  );

  // Pessoas com registros de ponto no dia inspecionado (ocupante/cobertura e titular)
  const pessoasPontoDrawer = useMemo(() => {
    if (!drawerInspecao || ehFiscal) return [] as Array<PessoaRegistroPonto & { horarioDescricao?: string; ehTitular: boolean }>;
    const { vaga, dataStr, ocupacao } = drawerInspecao;
    const ctx = obterContextoPontoVaga(vaga, dataStr);
    const lista: Array<PessoaRegistroPonto & { horarioDescricao?: string; ehTitular: boolean }> = [];
    const adicionar = (chapa: string | undefined, nome: string | undefined, papel: string, exigivel: boolean | undefined) => {
      if (!chapa) return;
      if (lista.some((p) => chapa6(p.chapa) === chapa6(chapa))) return;
      const prof = mapaProfissionaisPorChapa.get(String(chapa).trim()) || mapaProfissionaisPorChapa.get(chapa6(chapa));
      const ehTitular = Boolean(ctx.chapaTitular) && chapa6(ctx.chapaTitular) === chapa6(chapa);
      // Titular: faixa da posição. Cobertura no dia: faixa da posição que está cobrindo.
      const horarioDescricao = ctx.horarioPosicao || prof?.horarioDescricao;
      lista.push({
        chapa: chapa6(chapa),
        nome: nome || prof?.nome || chapa,
        papel,
        horarioDescricao: ehTitular ? horarioDescricao : prof?.horarioDescricao || horarioDescricao,
        ehTitular,
        analise: analisarJornadaDia({
          dataStr,
          chapa,
          marcacoes,
          horarioDescricao,
          ciclo: ehTitular ? ctx.ciclo : undefined,
          jornadaExigivel: exigivel,
        }),
      });
    };
    const chapaOcupante = ocupacao.ocupanteMatricula || ocupacao.ocupante?.matricula;
    if (chapaOcupante) {
      const ehTit = Boolean(ctx.chapaTitular) && chapa6(chapaOcupante) === chapa6(ctx.chapaTitular);
      adicionar(
        chapaOcupante,
        ocupacao.ocupanteNome || ocupacao.ocupante?.nome,
        ehTit ? "Titular" : ocupacao.status === "COBERTO" ? "Cobertura" : "Ocupante",
        exigivelDoStatusPosicao(ocupacao.status)
      );
    }
    adicionar(
      ctx.chapaTitular,
      ctx.profTitular?.nome || ctx.titular?.nome,
      "Titular",
      ocupacao.status === "FOLGA" ? false : ocupacao.status === "PRESENTE" ? true : undefined
    );
    return lista;
  }, [drawerInspecao, ehFiscal, obterContextoPontoVaga, mapaProfissionaisPorChapa, marcacoes]);

  // Espelho completo do período (ciclo da competência) para o colaborador selecionado
  const espelhoPeriodo = useMemo(() => {
    if (!espelhoPeriodoAberto || !drawerInspecao || ehFiscal || diasCiclo.length === 0) return null;
    const { vaga, posto } = drawerInspecao;
    const datas = diasCiclo.map((d) => d.dataStr);
    const statusPorData = new Map<string, OcupacaoVagaDia>();
    datas.forEach((dt) =>
      statusPorData.set(
        dt,
        calcularStatusVagaDia(vaga, posto, dt, alocacoes, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote || "2026-09-15")
      )
    );
    const ctx = obterContextoPontoVaga(vaga, datas[0]);
    const alvo = chapa6(espelhoPeriodoAberto.chapa);
    const resultado = montarEspelhoPeriodo(
      datas,
      {
        chapa: espelhoPeriodoAberto.chapa,
        marcacoes,
        horarioDescricao: espelhoPeriodoAberto.horarioDescricao,
        ciclo: espelhoPeriodoAberto.ehTitular ? ctx.ciclo : undefined,
      },
      (dt) => {
        const st = statusPorData.get(dt);
        if (!st) return undefined;
        const ocup = st.ocupanteMatricula || st.ocupante?.matricula;
        // Exigibilidade pelo mapa apenas quando a pessoa ocupava esta posição no dia; caso contrário, pela escala do RM
        if (ocup && chapa6(ocup) === alvo) return exigivelDoStatusPosicao(st.status);
        if (espelhoPeriodoAberto.ehTitular && st.status === "FOLGA") return false;
        return undefined;
      }
    );
    return { ...resultado, statusPorData };
  }, [espelhoPeriodoAberto, drawerInspecao, ehFiscal, diasCiclo, alocacoes, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote, marcacoes, obterContextoPontoVaga]);

  const abrirEspelhoPeriodo = (idx: number) => {
    const p = pessoasPontoDrawer[idx];
    if (!p) return;
    setEspelhoPeriodoAberto({ chapa: p.chapa, nome: p.nome, horarioDescricao: p.horarioDescricao, ehTitular: p.ehTitular });
    registrarLogAuditoria(
      "CONSULTA_ESPELHO_PONTO_INDIVIDUAL",
      `Profissional (${p.chapa})`,
      `Visualização do espelho de ponto do período via Mapa de Ocupação — ${p.nome} (Chapa ${p.chapa}).`,
      perfilAtivo || "PREMIER_ADMIN"
    );
  };

  // Abrir inspeção da posição no dia selecionado (Item 1)
  const abrirInspecaoDia = (vaga: VagaPosto, posto: PostoOperacional, dataStr: string) => {
    const apuracao = calcularStatusVagaDia(
      vaga,
      posto,
      dataStr,
      alocacoes,
      ocorrencias,
      coberturas,
      apontamentos,
      marcacoesSet,
      dataRefLote || "2026-09-15"
    );

    const parts = dataStr.split("-").map(Number);
    const postoApurado = calcularStatusDia(
      posto,
      parts[2],
      parts[0],
      parts[1] - 1,
      ocorrencias,
      coberturas,
      apontamentos,
      marcacoesSet,
      dataRefLote || "2026-09-15",
      vagasPorPosto.get(posto.idPosto || posto.id) || [vaga],
      alocacoes
    );

    setDrawerInspecao({
      vaga,
      posto,
      dataStr,
      ocupacao: apuracao,
      postoOcupacao: postoApurado,
    });

    // Inicializa valores da edição de escala
    setFormGrupo(vaga.grupoRevezamento || vaga.grupo_revezamento || "");
    setFormFase(vaga.faseCiclo || vaga.fase_ciclo || "");
    setFormDataBase(vaga.dataBaseEscala || vaga.data_base_escala || vaga.dataBaseCiclo || "");
    setEditandoEscala(false);
    setMensagemEscalaSucesso("");
    setMensagemAjusteSucesso("");
    setPessoaPontoAtiva(0);

    // Inicializa valores do formulário de cobertura
    setRegistrandoCobertura(false);
    setFormSubstitutoChapa("");
    setFormSubstitutoNome("");
    setFormDataInicioCob(dataStr);
    setFormDataFimCob(dataStr);
    setFormMotivoCob(
      apuracao.categoriaAusencia ||
      apuracao.motivoPublico ||
      "COBERTURA OPERACIONAL"
    );
    setFormJustificativaNaoVinculado("");
    setAvisoVinculoSubstituto(null);
    setMensagemCoberturaSucesso("");
    setErroCobertura("");
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltipOcupacao(null);
  };

  // Callbacks para exibição do Tooltip Flutuante (Quem está cumprindo no dia)
  const mostrarTooltipHover = useCallback(
    (
      e: React.MouseEvent<HTMLElement>,
      vaga: VagaPosto,
      posto: PostoOperacional,
      d: DiaCiclo,
      statusVaga?: OcupacaoVagaDia,
      estilo?: { sigla: string; label: string; classes: string; borda?: string },
      codigoVisual?: string,
      alocRef?: AlocacaoVaga
    ) => {
      if (!ativarTooltipHover) return;

      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const cod = codigoVisual || obterCodigoVisualPosicao(vaga, posto);
      const aloc = alocRef || obterAlocacaoVigenteVaga(vaga.id, alocacoes, d.dataStr);

      const apuracao =
        statusVaga ||
        calcularStatusVagaDia(
          vaga,
          posto,
          d.dataStr,
          alocacoes,
          ocorrencias,
          coberturas,
          apontamentos,
          marcacoesSet,
          dataRefLote || "2026-09-15"
        );

      const est = estilo || getEstiloCelulaHeatmap(apuracao.status);

      // Batidas reais extraídas do ponto para o colaborador daquela posição no dia
      const chapa = apuracao.ocupanteMatricula || apuracao.ocupante?.matricula || aloc?.matricula;
      let batidasReais: string[] = [];
      if (chapa && marcacoes && marcacoes.length > 0) {
        const chapaLimpa = chapa.replace(/\D/g, "");
        const chapaPad = chapaLimpa.padStart(6, "0");
        batidasReais = marcacoes
          .filter(
            (m) =>
              (m.chapa === chapaPad || m.chapa === chapa || m.chapa === chapaLimpa) &&
              m.dataLocal === d.dataStr
          )
          .map((m) => m.horaLocal.slice(0, 5))
          .sort();
      }

      tooltipTimeoutRef.current = setTimeout(() => {
        setTooltipOcupacao({
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            bottom: rect.bottom,
          },
          vaga,
          posto,
          dataStr: d.dataStr,
          diaSemana: d.diaSemana,
          diaNumero: d.diaNumero,
          mes: d.mes,
          statusVaga: apuracao,
          estilo: est,
          codigoVisual: cod,
          alocRef: aloc,
          batidasReais,
        });
      }, 40);
    },
    [ativarTooltipHover, alocacoes, ocorrencias, coberturas, apontamentos, marcacoesSet, dataRefLote, marcacoes]
  );

  const esconderTooltipHover = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipOcupacao(null);
    }, 250);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (tooltipOcupacao) {
        setTooltipOcupacao(null);
      }
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [tooltipOcupacao]);

  // Muda o dia selecionado na régua do drawer sem fechar a inspeção
  const selecionarDiaDrawer = (dataStr: string) => {
    if (!drawerInspecao) return;
    const apuracao = calcularStatusVagaDia(
      drawerInspecao.vaga,
      drawerInspecao.posto,
      dataStr,
      alocacoes,
      ocorrencias,
      coberturas,
      apontamentos,
      marcacoesSet,
      dataRefLote || "2026-09-15"
    );

    setDrawerInspecao({
      ...drawerInspecao,
      dataStr,
      ocupacao: apuracao,
    });

    setFormDataInicioCob(dataStr);
    setFormDataFimCob(dataStr);
  };

  // Salvar escala da posição (Item 5: Grupo, fase e data-base)
  const handleSalvarEscala = async () => {
    if (!drawerInspecao) return;
    const res = atualizarEscalaPosicao(drawerInspecao.vaga.id, {
      grupo: formGrupo.trim(),
      fase: formFase.trim(),
      dataBase: formDataBase.trim(),
    });

    if (res.sucesso && res.vagaAtualizada) {
      setMensagemEscalaSucesso(
        `Escala atualizada com sucesso! Grupo: ${formGrupo || "-"}, Fase: ${formFase || "-"}, Data-Base: ${formDataBase || "-"}. O mapa foi recalculado e a pendência ${res.pendenciaBaixadaId || ""} foi baixada.`
      );
      setEditandoEscala(false);
      await carregarDados();

      // Atualiza os dados no próprio drawer
      const novaApuracao = calcularStatusVagaDia(
        res.vagaAtualizada,
        drawerInspecao.posto,
        drawerInspecao.dataStr,
        alocacoes,
        ocorrencias,
        coberturas,
        apontamentos,
        marcacoesSet,
        dataRefLote || "2026-09-15"
      );

      setDrawerInspecao((prev) =>
        prev
          ? {
              ...prev,
              vaga: res.vagaAtualizada!,
              ocupacao: novaApuracao,
            }
          : null
      );
    }
  };

  // Apontar status individual do dia em escala em aberto
  const handleApontarStatusDia = async (status: "PRESENTE" | "FOLGA" | "DESCOBERTO") => {
    if (!drawerInspecao) return;
    const nomeStatus =
      status === "PRESENTE"
        ? "Presença (P)"
        : status === "FOLGA"
        ? "Folga (F)"
        : "Falta/Descoberto (D)";

    registrarAjusteManualDia({
      posicaoId: drawerInspecao.vaga.id,
      data: drawerInspecao.dataStr,
      status,
      justificativa: `Inclusão manual de ${nomeStatus} pelo usuário`,
    });

    setMensagemAjusteSucesso(`Dia apontado com sucesso como ${nomeStatus}!`);
    await carregarDados();

    const novaApuracao = calcularStatusVagaDia(
      drawerInspecao.vaga,
      drawerInspecao.posto,
      drawerInspecao.dataStr,
      alocacoes,
      ocorrencias,
      coberturas,
      apontamentos,
      marcacoesSet,
      dataRefLote || "2026-09-15"
    );

    setDrawerInspecao((prev) =>
      prev
        ? {
            ...prev,
            ocupacao: novaApuracao,
          }
        : null
    );
  };

  // Remover apontamento manual de dia (reabrir escala daquele dia)
  const handleRemoverAjusteDia = async () => {
    if (!drawerInspecao) return;
    removerAjusteManualDia(drawerInspecao.vaga.id, drawerInspecao.dataStr);
    setMensagemAjusteSucesso("Apontamento manual removido. A escala do dia voltou a ficar em aberto.");
    await carregarDados();

    const novaApuracao = calcularStatusVagaDia(
      drawerInspecao.vaga,
      drawerInspecao.posto,
      drawerInspecao.dataStr,
      alocacoes,
      ocorrencias,
      coberturas,
      apontamentos,
      marcacoesSet,
      dataRefLote || "2026-09-15"
    );

    setDrawerInspecao((prev) =>
      prev
        ? {
            ...prev,
            ocupacao: novaApuracao,
          }
        : null
    );
  };

  // Excluir cobertura diretamente a partir do Drawer de Inspeção
  const handleExcluirCoberturaDrawer = async (coberturaId: string) => {
    if (!confirm("Deseja excluir permanentemente este registro de cobertura? O mapa será recalculado imediatamente.")) {
      return;
    }
    try {
      excluirCobertura(coberturaId);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : "Não foi possível excluir a cobertura.");
      return;
    }
    setMensagemCoberturaSucesso("Cobertura excluída com sucesso! O mapa foi recalculado.");
    await carregarDados();

    if (drawerInspecao) {
      const novaApuracao = calcularStatusVagaDia(
        drawerInspecao.vaga,
        drawerInspecao.posto,
        drawerInspecao.dataStr,
        alocacoes,
        ocorrencias,
        coberturas.filter((c) => c.id !== coberturaId),
        apontamentos,
        marcacoesSet,
        dataRefLote || "2026-09-15"
      );
      setDrawerInspecao((prev) =>
        prev
          ? {
              ...prev,
              ocupacao: novaApuracao,
            }
          : null
      );
    }
  };

  // Selecionar substituto no form de cobertura e validar vínculo (Item 4)
  const handleSelecionarSubstituto = (matricula: string) => {
    setFormSubstitutoChapa(matricula);
    const cand = listaCandidatosCobertura.find((c) => c.matricula === matricula);
    setFormSubstitutoNome(cand ? cand.nome : "");

    if (!drawerInspecao || !matricula) {
      setAvisoVinculoSubstituto(null);
      return;
    }

    const postoIdSGP = drawerInspecao.posto.idPosto || drawerInspecao.posto.id;
    const validacao = validarVinculoFeristaPosto(matricula, postoIdSGP);
    setAvisoVinculoSubstituto(validacao);
  };

  // Registrar cobertura com validação de vínculo (Item 4)
  const handleRegistrarCobertura = async () => {
    if (!drawerInspecao) return;
    if (!formSubstitutoChapa) {
      setErroCobertura("Por favor, selecione quem irá cobrir a posição.");
      return;
    }
    if (!formDataInicioCob || !formDataFimCob) {
      setErroCobertura("Informe o período da cobertura (data início e data fim).");
      return;
    }
    if (!formItemPpuCob) {
      setErroCobertura("Informe o Item da PPU da cobertura.");
      return;
    }

    const titularVig = obterAlocacaoVigenteVaga(
      drawerInspecao.vaga.id,
      alocacoes,
      drawerInspecao.dataStr
    );

    const postoIdSGP = drawerInspecao.posto.idPosto || drawerInspecao.posto.id;
    const res = registrarCoberturaComValidacao({
      posicaoId: drawerInspecao.vaga.id,
      postoIdSGP,
      titularMatricula: titularVig?.matricula,
      titularNome: titularVig?.nome || (drawerInspecao.vaga as any).titularReferencia,
      substitutoMatricula: formSubstitutoChapa,
      substitutoNome: formSubstitutoNome,
      dataInicio: formDataInicioCob,
      dataFim: formDataFimCob,
      motivo: formMotivoCob,
      justificativaNaoVinculado: formJustificativaNaoVinculado,
      itemPpu: formItemPpuCob,
    });

    if (!res.sucesso) {
      setErroCobertura(res.erro || "Falha ao registrar cobertura.");
      return;
    }

    setMensagemCoberturaSucesso(
      `Cobertura registrada com sucesso para ${formSubstitutoNome}! Mapa recalculado.`
    );
    setRegistrandoCobertura(false);
    setErroCobertura("");
    await carregarDados();

    // Recalcula ocupação no dia atual do drawer
    const novaApuracao = calcularStatusVagaDia(
      drawerInspecao.vaga,
      drawerInspecao.posto,
      drawerInspecao.dataStr,
      alocacoes,
      ocorrencias,
      [...(coberturas || []), res.cobertura!],
      apontamentos,
      marcacoesSet,
      dataRefLote || "2026-09-15"
    );

    setDrawerInspecao((prev) =>
      prev
        ? {
            ...prev,
            ocupacao: novaApuracao,
          }
        : null
    );
  };

  // Renderizador do Formulário de Cobertura Operacional (reutilizável no drawer e em cards)
  const renderFormularioCobertura = (posicaoCodigoTxt?: string, titularNomeTxt?: string) => {
    return (
      <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
          <span className="font-bold text-amber-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-700" />
            <span>Designar Cobertura Operacional</span>
          </span>
          <button
            type="button"
            onClick={() => setRegistrandoCobertura(false)}
            className="text-slate-400 hover:text-slate-700 text-xs font-semibold px-2 py-0.5 rounded hover:bg-amber-100 transition-colors cursor-pointer"
          >
            ✕ Fechar
          </button>
        </div>

        {erroCobertura && (
          <div className="p-2 bg-rose-100 border border-rose-300 text-rose-900 rounded text-xs font-medium">
            {erroCobertura}
          </div>
        )}

        <div className="space-y-2.5 text-xs">
          <div className="grid grid-cols-2 gap-2 bg-white/70 p-2 rounded border border-amber-200/60">
            <div>
              <span className="text-[10px] font-semibold text-slate-600 uppercase block">Posição</span>
              <span className="font-bold text-slate-900 text-xs">{posicaoCodigoTxt || (drawerInspecao ? obterCodigoVisualPosicao(drawerInspecao.vaga, drawerInspecao.posto) : "")}</span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-600 uppercase block">Titular Ausente</span>
              {(() => {
                const titNome = titularNomeTxt || (drawerInspecao ? (drawerInspecao.ocupacao.ocupanteNome || (drawerInspecao.vaga as any).titularReferencia || obterAlocacaoVigenteVaga(drawerInspecao.vaga.id, alocacoes, drawerInspecao.dataStr)?.nome) : "") || "Vaga sem titular";
                return <span className="font-bold text-slate-900 text-xs truncate block">{titNome}</span>;
              })()}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-700 uppercase block">
              Quem Cobre (Substituto / Ferista) *
            </label>
            <select
              value={formSubstitutoChapa}
              onChange={(e) => handleSelecionarSubstituto(e.target.value)}
              className="w-full mt-1 border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="">Selecione o colaborador / ferista...</option>
              {listaCandidatosCobertura.map((c) => (
                <option key={c.matricula} value={c.matricula}>
                  {c.nome} ({c.matricula}) {c.ehFerista ? "• [Ferista Homologado]" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Alerta de Vínculo Não Homologado */}
          {avisoVinculoSubstituto && !avisoVinculoSubstituto.vinculado && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-900 rounded text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Colaborador não vinculado previamente a este posto</span>
              </div>
              <p className="text-[11px] text-rose-700">
                {avisoVinculoSubstituto.mensagem}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-700 uppercase block">Data Início</label>
              <input
                type="date"
                value={formDataInicioCob}
                onChange={(e) => setFormDataInicioCob(e.target.value)}
                className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5 bg-white text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-700 uppercase block">Data Fim</label>
              <input
                type="date"
                value={formDataFimCob}
                onChange={(e) => setFormDataFimCob(e.target.value)}
                className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5 bg-white text-xs font-semibold"
              />
            </div>
          </div>

          <CampoItemPpu
            id="mapa-cobertura-item-ppu"
            valor={formItemPpuCob}
            onChange={setFormItemPpuCob}
            itemDoPosto={
              drawerInspecao
                ? obterItemPpuDoPosto(drawerInspecao.posto.idPosto || drawerInspecao.posto.id)
                : undefined
            }
          />

          <div>
            <label className="text-[10px] font-semibold text-slate-700 uppercase block">Motivo da Cobertura</label>
            <select
              value={formMotivoCob}
              onChange={(e) => setFormMotivoCob(e.target.value)}
              className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5 bg-white text-xs font-semibold"
            >
              <option value="LICENÇA / AFASTAMENTO">LICENÇA / AFASTAMENTO</option>
              <option value="FÉRIAS DO TITULAR">FÉRIAS DO TITULAR</option>
              <option value="FOLGA DA ESCALA">FOLGA DA ESCALA</option>
              <option value="COBERTURA OPERACIONAL">COBERTURA OPERACIONAL</option>
              <option value="TREINAMENTO / RECICLAGEM">TREINAMENTO / RECICLAGEM</option>
            </select>
          </div>

          {/* Justificativa Obrigatória se não vinculado */}
          {avisoVinculoSubstituto && !avisoVinculoSubstituto.vinculado && (
            <div>
              <label className="text-[10px] font-bold text-rose-800 uppercase block">
                Justificativa Operacional (Obrigatória) *
              </label>
              <textarea
                rows={2}
                value={formJustificativaNaoVinculado}
                onChange={(e) => setFormJustificativaNaoVinculado(e.target.value)}
                placeholder="Descreva o motivo excepcional para a designação de colaborador não vinculado a este posto..."
                className="w-full mt-1 border border-rose-300 rounded p-2 bg-white text-xs"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-amber-200">
          <button
            type="button"
            onClick={() => setRegistrandoCobertura(false)}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded text-xs hover:bg-slate-50 cursor-pointer font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleRegistrarCobertura}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded text-xs font-bold shadow-xs hover:shadow cursor-pointer flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Confirmar Cobertura</span>
          </button>
        </div>
      </div>
    );
  };

  // Exportação XLSX (sem valores nem medição)
  const handleExportarXlsx = async () => {
    try {
      const XLSX = await import("xlsx");
      const linhas: Record<string, string | number>[] = [];

      postosFiltrados.forEach((p) => {
        const idPosto = p.idPosto || p.id;
        const vgs = vagasPorPosto.get(idPosto) || [];
        const base = p.localAtuacao || p.baseOperacional || p.unidadeNome || "NÃO INFORMADA";
        const tipoPostoObj = obterTipoPosto(p.tipoPostoId);
        const tipoPostoNome = tipoPostoObj ? tipoPostoObj.nome : p.tipoPostoId || "-";

        vgs.forEach((v) => {
          const codVisual = obterCodigoVisualPosicao(v, p);
          datasDoCicloStr.forEach((dataStr) => {
            const apuracao = calcularStatusVagaDia(
              v,
              p,
              dataStr,
              alocacoes,
              ocorrencias,
              coberturas,
              apontamentos,
              marcacoesSet,
              dataRefLote || "2026-09-15"
            );
            linhas.push({
              "Posto ID": p.idReferencia || p.idPosto || p.id,
              "Função": p.funcao,
              "Tipo de Posto": tipoPostoNome,
              "Unidade": base,
              "Posição": codVisual,
              "Data": dataStr,
              "Status": apuracao.status,
              "Tipo Ocupação": apuracao.tipoOcupacao || "",
              "Observação": apuracao.motivoPublico,
            });
          });
        });
      });

      const ws = XLSX.utils.json_to_sheet(linhas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mapa Cobertura");
      XLSX.writeFile(wb, `Mapa_Cobertura_${competencia}.xlsx`);
    } catch (err) {
      console.error("Falha ao exportar XLSX:", err);
    }
  };

  // Detalhes do posto (parâmetros + quem ocupa cada posição no dia de referência).
  // Antes ficavam na visão "Por Posto"; agora abrem ao clicar no cabeçalho do posto (Grade e Por Item PPU).
  const renderDetalhesPosto = (posto: PostoOperacional, vgs: VagaPosto[]) => {
    const idPostoChave = posto.idPosto || posto.id;
    const tipoPostoObj = obterTipoPosto(posto.tipoPostoId);
    const vagasExigidas = tipoPostoObj ? tipoPostoObj.vagas : vgs.length || 1;
    const idPostoParaFerista = posto.postoIdSGP || idPostoChave;
    const feristasDestePosto = FERISTAS_REV04.filter(
      (f) => f.postoIdSGP === idPostoParaFerista || f.postoIdSGP === posto.id || f.postoIdSGP === posto.idPosto
    );
    const fmtDM = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

    return (
      <>
        {/* Parâmetros do posto em linha (sem caixas) */}
        <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-500">
          <span>Gerência <span className="text-slate-800 font-medium">{posto.gerenciaPetrobras || "Não informada"}</span></span>
          <span>Item PPU <span className="text-slate-800 font-medium font-mono">{posto.itemPPU || obterItemPpuDoPosto(posto.postoIdSGP || idPostoChave) || "–"}</span></span>
          <span>Vagas exigidas <span className="text-slate-800 font-medium">{vagasExigidas}</span></span>
          <span>Periculosidade <span className={`font-medium ${posto.periculosidade === "SIM" ? "text-amber-700" : "text-slate-800"}`}>{posto.periculosidade === "SIM" ? "Sim" : "Não"}</span></span>
          {feristasDestePosto.length > 0 && (
            <span className="inline-flex items-center gap-1.5" title="Recurso de cobertura (não cria posição no posto)">
              <Users className="w-3 h-3 text-slate-400" />
              Feristas{" "}
              <span className="text-slate-800 font-medium">
                {feristasDestePosto.map((f) => `${f.colaborador}${f.chapaRM ? ` (${f.chapaRM})` : ""}`).join(" · ")}
              </span>
            </span>
          )}
        </div>

        {/* Quem ocupa cada posição no dia de referência */}
        <div className="overflow-x-auto border-b border-slate-100">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 text-left">
                <th className="px-3 py-1.5 font-semibold text-slate-800 w-[120px]">Posição</th>
                <th className="px-3 py-1.5 font-semibold text-slate-800">Ocupante</th>
                <th className="px-3 py-1.5 font-semibold text-slate-800">Horário</th>
                <th className="px-3 py-1.5 font-semibold text-slate-800 hidden xl:table-cell">Seção</th>
                <th className="px-3 py-1.5 font-semibold text-slate-800">Status em {fmtDM(diaReferenciaStr)}</th>
                <th className="px-3 py-1.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {vgs.map((vaga) => {
                const codigoVisual = (vaga as any).codigoPosicaoEstrutural || vaga.etiqueta || vaga.codigoVisual || obterCodigoVisualPosicao(vaga, posto);
                const ehVagaReal = Boolean((vaga as any).ehVaga || (vaga as any).posicaoSemTitularMC === "SIM");
                const ehAValidar = ehPosicaoAValidar(vaga) || (vaga as any).statusMapeamento === "A VALIDAR MAPEAMENTO";
                const alocVigente = obterAlocacaoVigenteVaga(vaga.id, alocacoes, diaReferenciaStr);
                const statusVagaDia = calcularStatusVagaDia(
                  vaga,
                  posto,
                  diaReferenciaStr,
                  alocacoes,
                  ocorrencias,
                  coberturas,
                  apontamentos,
                  marcacoesSet,
                  dataRefLote || "2026-09-15"
                );
                const coberturaVaga = coberturas.find((c) =>
                  isCoberturaAtivaParaPosicao(c, diaReferenciaStr, posto, vaga, alocVigente?.matricula)
                );
                const alocDet = (alocVigente as any)?.alocacaoDetalhe;
                const alertaSemChapa = Boolean(alocDet?.alertaSemChapaRM || (!ehVagaReal && alocVigente && !alocVigente.matricula));
                const alertaUnidadeDivergente = Boolean(alocDet?.alertaUnidadeDivergente || (alocVigente as any)?.unidadeConfere === "REVISAR");
                const alertaMapeamentoAValidar = Boolean(alocDet?.alertaMapeamentoAValidar || ehAValidar || (vaga as any).statusMapeamentoREV03 === "A VALIDAR MAPEAMENTO");
                const chapaAloc = alocVigente?.matricula || (vaga as any).chapaTitular;
                const profAloc = chapaAloc ? mapaProfissionaisPorChapa.get(chapaAloc.trim()) : null;
                const horarioFormatado = formatarHorarioExibicao(
                  profAloc?.horarioCodigo,
                  profAloc?.horarioDescricao || vaga.horario_rm || (vaga as any).horario || alocVigente?.horarioEscalaRm || posto.escala
                );
                const secaoFormatada = formatarSecaoExibicao(profAloc?.secaoCodigo, profAloc?.secaoDescricao);
                const ehSubstituto = alocVigente?.motivo === "substituicao" || (alocVigente as any)?.tipoAlocacao?.includes("SUBSTITUT");

                return (
                  <tr key={vaga.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors align-top">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-800">{codigoVisual}</span>
                        {ehAValidar && (
                          <span title="Posição com premissa a validar">
                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {ehVagaReal || !alocVigente ? (
                        <span className="text-amber-700 font-medium">Vaga · sem titular</span>
                      ) : (
                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                          <span className="text-slate-900 font-medium">{alocVigente.nome}</span>
                          {alocVigente.matricula && (
                            <span className="font-mono text-[11px] text-slate-400">{alocVigente.matricula}</span>
                          )}
                          {ehSubstituto && <span className="text-[11px] text-sky-700 font-medium">substituto</span>}
                        </div>
                      )}
                      {(alertaSemChapa || alertaUnidadeDivergente || alertaMapeamentoAValidar || coberturaVaga) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10.5px] text-slate-500">
                          {coberturaVaga && (
                            <span
                              className="inline-flex items-center gap-1"
                              title={`Substituto: ${coberturaVaga.substitutoNome} (${coberturaVaga.substitutoMatricula})`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                              Substituição {fmtDM(coberturaVaga.dataInicio)} a {fmtDM(coberturaVaga.dataFim)}
                            </span>
                          )}
                          {alertaSemChapa && (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Não localizado no RM
                            </span>
                          )}
                          {alertaUnidadeDivergente && (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Unidade RM divergente
                            </span>
                          )}
                          {alertaMapeamentoAValidar && (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              Mapeamento a validar
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 font-mono text-[11px] max-w-[260px] truncate" title={horarioFormatado}>
                      {horarioFormatado}
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-[11px] max-w-[220px] truncate hidden xl:table-cell" title={secaoFormatada}>
                      {secaoFormatada && secaoFormatada !== "–" ? secaoFormatada : "–"}
                    </td>
                    <td className="px-3 py-2">
                      <BadgeStatus status={statusVagaDia.statusVaga} tamanho="sm" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const historico = obterHistoricoAlocacoesVaga(vaga.id, alocacoes);
                          setModalHistorico({ vaga, posto, alocacoes: historico });
                        }}
                        className="p-1 rounded text-slate-400 hover:text-[#1F4FD1] hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Ver histórico de alocações da posição"
                        aria-label={`Histórico da posição ${codigoVisual}`}
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  // Cartão do posto (cabeçalho clicável + detalhes opcionais + matriz do ciclo) — mesmo padrão nas visões Grade e Por Item PPU
  const renderCartaoPosto = (
    posto: PostoOperacional,
    posicoesFiltradas: VagaPosto[],
    opcoes?: { unidade?: string }
  ) => {
    const idPostoChave = posto.idPosto || posto.id;
    const vgs = obterVagasDoPosto(posto, vagasPorPosto);
    const apuracaoCiclo = apuracaoCicloPorPosto.get(idPostoChave);
    const postoAberto = postosExpandidos.has(idPostoChave);

    return (
      <div key={idPostoChave} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
        <button
          onClick={() => togglePosto(idPostoChave)}
          aria-expanded={postoAberto}
          title={postoAberto ? "Ocultar detalhes do posto" : "Ver parâmetros e ocupantes do posto"}
          className="w-full p-2.5 bg-white hover:bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer transition-colors"
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {postoAberto ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className="text-xs font-semibold text-slate-800">{formatarTituloPosto(posto)}</span>
            <span className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
              {formatarEtiquetaRegime(posto, vgs.length, vgs)}
            </span>
            {opcoes?.unidade && (
              <span className="text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                {opcoes.unidade}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-600 font-medium">
            Ciclo: <span className="text-slate-900 font-semibold">{apuracaoCiclo?.percentualCicloFormatado ?? "–"}</span>
          </div>
        </button>

        {postoAberto && renderDetalhesPosto(posto, vgs)}

        {renderTabelaCicloPosto(posto, vgs, apuracaoCiclo, posicoesFiltradas)}
      </div>
    );
  };

  // Filtro de exceções/descobertos aplicado às posições de um posto (mesma regra da Grade)
  const obterPosicoesVisiveis = (posto: PostoOperacional, vgs: VagaPosto[]): VagaPosto[] => {
    if (!mostrarApenasExcecoes && !filtroApenasDescobertos) return vgs;
    const apCiclo = apuracaoCicloPorPosto.get(posto.idPosto || posto.id);
    return vgs.filter((vaga) =>
      apCiclo?.dias?.some((d) =>
        d.vagasDetalhe?.some((vd: OcupacaoVagaDia) => {
          if (vd.vagaId !== vaga.id && vd.posicaoId !== vaga.id) return false;
          if (filtroApenasDescobertos) return vd.status === "DESCOBERTO";
          return (
            vd.status === "DESCOBERTO" ||
            vd.status === "CICLO_NAO_CONFIGURADO" ||
            vd.status === "SEM_DADO" ||
            vd.status === "PENDENTE"
          );
        })
      )
    );
  };

  // Grade (heatmap) do ciclo de um posto — usada nas visões Grade e Por Posto (mesmo padrão visual)
  const renderTabelaCicloPosto = (
    posto: PostoOperacional,
    vgs: VagaPosto[],
    apuracaoCiclo: ApuracaoPostoCiclo | undefined,
    posicoesFiltradas: VagaPosto[]
  ) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
            {/* Coluna 1 Fixa: Posição */}
            <th className="p-1.5 text-left sticky left-0 bg-slate-50 border-r border-slate-200 z-20 min-w-[130px] max-w-[150px]">
              <div className="font-semibold text-slate-800 text-xs">Posição</div>
              <div className="text-[9px] text-slate-500 font-normal leading-tight mt-0.5">
                % diário quando &lt; 100%
              </div>
            </th>
            {/* Colunas: Dias do Ciclo */}
            {diasExibidosCiclo.map((d) => {
              const isDiaRef = dataInicioFiltro === dataFimFiltro && d.dataStr === dataInicioFiltro;
              const isViradaMes = d.diaNumero === 1;

              let headerClass =
                "p-1 text-center border-r border-slate-100 min-w-[30px] w-7.5";
              if (isViradaMes) {
                headerClass += " border-l-2 border-l-slate-300";
              }
              if (isDiaRef) {
                headerClass +=
                  " ring-1 ring-[#1F4FD1] bg-blue-50/50 text-[#1F4FD1] font-bold";
              } else if (d.isFimDeSemana) {
                headerClass += " bg-slate-100/70 text-slate-500";
              } else {
                headerClass += " bg-slate-50/80 text-slate-600";
              }

              const diaDetalhe = apuracaoCiclo?.dias?.find(
                (ad) => ((ad as any).dataStr || ad.data) === d.dataStr
              );
              const posExig = diaDetalhe?.posicoesExigiveis ?? 0;
              const posAtendidas = diaDetalhe?.posicoesAtendidas ?? 0;
              const percDia = diaDetalhe?.percentualCobertura ?? null;
              const percDiaFmt = diaDetalhe?.percentualCoberturaFormatado ?? "–";
              const todosSemDado =
                posExig > 0 &&
                posAtendidas === 0 &&
                diaDetalhe?.vagasDetalhe &&
                diaDetalhe.vagasDetalhe.length > 0 &&
                diaDetalhe.vagasDetalhe.every(
                  (vd: any) =>
                    vd.status === "SEM_DADO" ||
                    vd.status === "FOLGA" ||
                    vd.status === "NAO_EXIGIVEL" ||
                    vd.status === "PENDENTE"
                );

              return (
                <th
                  key={d.dataStr}
                  className={headerClass}
                  title={`Dia ${String(d.diaNumero).padStart(2, "0")}/${String(d.mes).padStart(2, "0")} (${d.diaSemana})${d.isHoje ? " • Hoje" : ""}${isDiaRef ? " • Dia de Referência" : ""}\nCumprimento no dia: ${posExig > 0 ? (todosSemDado ? "Sem dado de ponto importado" : `${posAtendidas}/${posExig} atendidas (${percDiaFmt})`) : "Sem exigência (Folga)"}`}
                >
                  <div className="text-[10px] leading-tight font-medium">{d.diaNumero}</div>
                  <div className="text-[8px] opacity-75 font-normal leading-tight">
                    {d.diaSemana}
                  </div>
                  <div
                    className={`text-[8.5px] leading-tight mt-0.5 tracking-tight ${
                      posExig === 0
                        ? "text-slate-300 font-normal"
                        : todosSemDado
                        ? "text-slate-400 font-normal"
                        : percDia === 100
                        ? "text-transparent select-none"
                        : percDia && percDia > 0
                        ? "text-amber-700 font-semibold"
                        : "text-rose-600 font-semibold"
                    }`}
                  >
                    {posExig === 0 ? "·" : todosSemDado ? "–" : percDia === 100 ? "·" : percDiaFmt}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {posicoesFiltradas.map((vaga) => {
            const codigoVisual = obterCodigoVisualPosicao(vaga, posto);
            const ehAValidar = ehPosicaoAValidar(vaga);
            const alocRef = obterAlocacaoVigenteVaga(
              vaga.id,
              alocacoes,
              diaReferenciaStr
            );
            const horarioEscala = obterHorarioEEscalaAbreviados(
              vaga,
              posto,
              alocRef
            );

            return (
              <tr
                key={vaga.id}
                className="hover:bg-slate-50/50 transition-colors border-b border-slate-100"
              >
                {/* Coluna 1 Fixa: Posição (sem nome do colaborador na linha) */}
                <td
                  className="p-1.5 sticky left-0 bg-white border-r border-slate-200 z-10"
                  title={`Posição ${codigoVisual}\nOcupante: ${alocRef ? `${alocRef.nome} (${alocRef.matricula})` : "Sem titular alocado"}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-xs text-slate-800">
                      {codigoVisual}
                    </span>
                    {ehAValidar && (
                      <span title="Posição com premissa a validar">
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                      </span>
                    )}
                    <span
                      className="text-[10px] text-slate-400 truncate max-w-[80px]"
                      title={horarioEscala}
                    >
                      {horarioEscala}
                    </span>
                  </div>
                </td>

                {/* Células do Heatmap */}
                {diasExibidosCiclo.map((d) => {
                  const diaDetalhe = apuracaoCiclo?.dias?.find((ad) => ((ad as any).dataStr || ad.data) === d.dataStr);
                  const statusVaga = diaDetalhe?.vagasDetalhe?.find(
                    (vd: OcupacaoVagaDia) =>
                      vd.vagaId === vaga.id || vd.posicaoId === vaga.id
                  );
                  const statusStr = statusVaga?.status || "FOLGA";
                  const estilo = getEstiloCelulaHeatmap(statusStr);
                  const isViradaMes = d.diaNumero === 1;
                  const isDiaRef = dataInicioFiltro === dataFimFiltro && d.dataStr === dataInicioFiltro;

                  let tdClass =
                    "p-[1px] text-center border-r border-slate-100 min-w-[30px] w-7.5";
                  if (isViradaMes) {
                    tdClass += " border-l-2 border-l-slate-300";
                  }
                  if (d.isFimDeSemana) {
                    tdClass += " bg-slate-50/50";
                  }
                  if (isDiaRef) {
                    tdClass += " bg-blue-50/20";
                  }

                  return (
                    <td
                      key={d.dataStr}
                      onClick={() => abrirInspecaoDia(vaga, posto, d.dataStr)}
                      onMouseEnter={(e) =>
                        mostrarTooltipHover(
                          e,
                          vaga,
                          posto,
                          d,
                          statusVaga,
                          estilo,
                          codigoVisual,
                          alocRef
                        )
                      }
                      onMouseLeave={esconderTooltipHover}
                      className={tdClass}
                      title={
                        ativarTooltipHover
                          ? undefined
                          : `Posição ${codigoVisual} • ${d.dataStr} (${d.diaSemana})\nStatus: ${estilo.label} (${estilo.sigla})\n${statusVaga?.motivoPublico || ""}\nClique para ver detalhes`
                      }
                    >
                      <div
                        className={`w-full h-5 rounded-[2px] flex items-center justify-center cursor-pointer transition-transform hover:scale-110 select-none text-[10px] leading-none ${estilo.classes} ${estilo.borda}`}
                      >
                        {estilo.sigla}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {/* Item 3: Barra fina de cor e percentual diário no rodapé do posto para postos com mais de 1 posição */}
          {vgs.length > 1 && (
            <tr className="bg-slate-50/60 border-t border-slate-200">
              <td className="p-1 sticky left-0 bg-slate-50 border-r border-slate-200 z-10 text-[10px] font-medium text-slate-600">
                <div className="flex items-center justify-between pr-1">
                  <span>% Total do Posto</span>
                  <span className="font-mono text-[9px] text-slate-400 font-normal">dia</span>
                </div>
              </td>
              {diasExibidosCiclo.map((d) => {
                const apuracaoDia = apuracaoCiclo?.dias?.find((ad) => ((ad as any).dataStr || ad.data) === d.dataStr);
                const percentual = apuracaoDia?.percentualCobertura ?? null;
                const posExig = apuracaoDia?.posicoesExigiveis ?? 0;
                const posAtendidas = apuracaoDia?.posicoesAtendidas ?? 0;
                const isViradaMes = d.diaNumero === 1;

                const todosSemDado =
                  posExig > 0 &&
                  posAtendidas === 0 &&
                  apuracaoDia?.vagasDetalhe &&
                  apuracaoDia.vagasDetalhe.length > 0 &&
                  apuracaoDia.vagasDetalhe.every(
                    (vd: any) =>
                      vd.status === "SEM_DADO" ||
                      vd.status === "FOLGA" ||
                      vd.status === "NAO_EXIGIVEL" ||
                      vd.status === "PENDENTE"
                  );

                let barColor = "bg-transparent";
                let textColor = "text-slate-300";
                let desc = "Sem exigência";
                if (posExig > 0 && percentual !== null) {
                  if (todosSemDado) {
                    barColor = "bg-slate-200";
                    textColor = "text-slate-400 font-normal";
                    desc = "Sem dado importado";
                  } else if (percentual === 100) {
                    barColor = "bg-emerald-500";
                    textColor = "text-emerald-700 font-bold";
                    desc = "100% atendido";
                  } else if (percentual > 0) {
                    barColor = "bg-amber-400";
                    textColor = "text-amber-700 font-bold";
                    desc = `${percentual}% atendido`;
                  } else {
                    barColor = "bg-[#B42318]";
                    textColor = "text-rose-700 font-bold";
                    desc = "0% atendido (descoberto)";
                  }
                }

                let tdClass =
                  "p-[1px] text-center border-r border-slate-100 min-w-[30px] w-7.5";
                if (isViradaMes) tdClass += " border-l-2 border-l-slate-300";

                return (
                  <td
                    key={d.dataStr}
                    className={tdClass}
                    title={`Cumprimento do posto em ${d.dataStr}: ${desc} (${posAtendidas}/${posExig} posições)`}
                  >
                    <div className="flex flex-col items-center justify-center py-0.5">
                      <div className={`w-full h-1 rounded-[1px] ${barColor}`} />
                      <span className={`text-[8.5px] leading-tight mt-0.5 tracking-tight ${textColor}`}>
                        {posExig === 0 ? "—" : todosSemDado ? "–" : `${percentual !== null ? `${percentual}%` : "—"}`}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4 max-w-full mx-auto">
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-premier-900/5 flex items-center justify-center text-premier-900">
            <CalendarCheck className="w-5 h-5 text-[#1F4FD1]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">Mapa de Cobertura</h1>
            </div>
            <p className="text-xs text-slate-500">
              Gestão de postos e posições por unidade operacional · Ciclo dia 10 ao 09
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Item 2: Controle segmentado discreto à direita do título */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-md border border-slate-200 text-xs">
            <button
              onClick={() => setAbaVisao("GRADE")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                abaVisao === "GRADE"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Grade
            </button>
            <button
              onClick={() => setAbaVisao("PPU")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                abaVisao === "PPU"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Por Item PPU
            </button>
            {podeEditarOperacao && (
              <button
                onClick={() => setAbaVisao("PENDENCIAS")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                  abaVisao === "PENDENCIAS"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <span>Pendências</span>
                {metricasCards.totalPendenciasEscala > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            )}
          </div>

          {podeEditarOperacao && (
            <button
              onClick={() => setModalConfirmarLimpezaOperacional(true)}
              className="inline-flex items-center justify-center w-7 h-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
              title="Limpar dados de presença, coberturas e ausências do mapa mantendo todas as posições"
              aria-label="Limpar dados do mapa"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleExportarXlsx}
            className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium px-2.5 py-1 rounded shadow-2xs transition-colors cursor-pointer"
            title="Exportar dados para XLSX"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>XLSX</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback de Limpeza Operacional */}
      {mensagemLimpezaSucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{mensagemLimpezaSucesso}</span>
          </div>
          <button
            onClick={() => setMensagemLimpezaSucesso("")}
            className="text-emerald-700 hover:text-emerald-950 p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. INDICADORES (faixa única; cor só quando há problema) */}
      <div className="grid grid-cols-2 md:grid-cols-4 rounded-lg border border-slate-200 bg-white divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {/* Posições (total) */}
        <div className="px-4 py-3">
          <div className="text-xs text-slate-500">Posições</div>
          <div className="text-xl font-semibold tabular-nums text-slate-900 mt-0.5">
            {metricasCards.totalPosicoes}
          </div>
        </div>

        {/* Ocupação no período / dia (%) */}
        <div className="px-4 py-3">
          <div className="text-xs text-slate-500">
            {dataInicioFiltro === dataFimFiltro ? "Ocupação no dia" : "Ocupação no período"}
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-semibold tabular-nums text-slate-900">
              {metricasCards.taxaOcupacaoDiaRef}%
            </span>
            <span
              className="text-[11px] text-slate-400 tabular-nums truncate"
              title={dataInicioFiltro === dataFimFiltro ? "posições atendidas / exigíveis" : "posições-dia atendidas / exigíveis"}
            >
              {metricasCards.posicoesAtendidasDiaRef}/{metricasCards.posicoesExigiveisDiaRef}
            </span>
          </div>
        </div>

        {/* Descobertos (clicável - filtra só posições com D) */}
        <button
          onClick={() => setFiltroApenasDescobertos((prev) => !prev)}
          className={`px-4 py-3 text-left transition-colors cursor-pointer ${
            filtroApenasDescobertos ? "bg-slate-50" : "hover:bg-slate-50"
          }`}
          aria-pressed={filtroApenasDescobertos}
          title={filtroApenasDescobertos ? "Clique para desativar filtro de descobertos" : "Clique para filtrar apenas posições com descobertos"}
        >
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Descobertos no ciclo</span>
            {filtroApenasDescobertos && (
              <span className="text-[10px] font-medium text-slate-700 bg-white border border-slate-200 rounded px-1.5">
                Filtrando
              </span>
            )}
          </div>
          <div
            className={`text-xl font-semibold tabular-nums mt-0.5 ${
              metricasCards.posicoesDescobertasCiclo > 0 ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {metricasCards.posicoesDescobertasCiclo}
          </div>
        </button>

        {/* Pendências de escala */}
        <div className="px-4 py-3">
          <div className="text-xs text-slate-500">Escalas a parametrizar</div>
          <div className="text-xl font-semibold tabular-nums text-slate-900 mt-0.5">
            {metricasCards.totalPendenciasEscala}
          </div>
        </div>
      </div>

      {/* 3. BARRA DE FILTROS (uma linha; Função/Situação em "Mais filtros") */}
      {(() => {
        const qtdFiltrosExtras = (filtroFuncao !== "TODAS" ? 1 : 0) + (filtroSituacao !== "TODAS" ? 1 : 0);
        const temFiltroAtivo =
          filtroFuncao !== "TODAS" ||
          filtroSituacao !== "TODAS" ||
          filtroBase !== "TODAS" ||
          filtroStatusAgregado !== "TODOS" ||
          busca !== "" ||
          filtroApenasDescobertos;
        const campo =
          "h-8 text-xs border border-slate-200 rounded-md px-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300";
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Busca */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="mapa-busca"
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar posto ou ID"
                  className={`${campo} w-full pl-8 pr-7`}
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Base */}
              <select
                id="mapa-filtro-base"
                value={filtroBase}
                onChange={(e) => setFiltroBase(e.target.value)}
                className={`${campo} max-w-[200px] truncate`}
                aria-label="Base"
              >
                <option value="TODAS">Todas as bases ({listaBases.length})</option>
                {listaBases.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              {/* Status */}
              <select
                id="mapa-filtro-status"
                value={filtroStatusAgregado}
                onChange={(e) => setFiltroStatusAgregado(e.target.value)}
                className={campo}
                aria-label="Status"
              >
                <option value="TODOS">Todos os status</option>
                <option value="COMPLETO">Completo (100%)</option>
                <option value="PARCIAL">Parcial</option>
                <option value="DESCOBERTO">Descoberto</option>
                <option value="SEM_DADO">Com sem dado</option>
                <option value="CICLO_NAO_CONFIGURADO">Escala em aberto</option>
              </select>

              {/* Período */}
              <div className="inline-flex items-center gap-1.5">
                <input
                  id="mapa-data-inicio"
                  type="date"
                  value={dataInicioFiltro}
                  onChange={(e) => setDataInicioFiltro(e.target.value)}
                  className={campo}
                  aria-label="Data início"
                />
                <span className="text-xs text-slate-400">até</span>
                <input
                  id="mapa-data-fim"
                  type="date"
                  value={dataFimFiltro}
                  onChange={(e) => setDataFimFiltro(e.target.value)}
                  className={campo}
                  aria-label="Data fim"
                />
              </div>

              {/* Mais filtros */}
              <button
                id="mapa-mais-filtros"
                onClick={() => setMostrarMaisFiltros((v) => !v)}
                aria-expanded={mostrarMaisFiltros}
                className={`h-8 px-2.5 text-xs rounded-md border inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  mostrarMaisFiltros || qtdFiltrosExtras > 0
                    ? "border-slate-300 bg-slate-50 text-slate-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Mais filtros
                {qtdFiltrosExtras > 0 && (
                  <span className="min-w-4 h-4 px-1 rounded-full bg-slate-800 text-white text-[10px] inline-flex items-center justify-center">
                    {qtdFiltrosExtras}
                  </span>
                )}
              </button>

              {temFiltroAtivo && (
                <button
                  onClick={() => {
                    setFiltroBase("TODAS");
                    setFiltroStatusAgregado("TODOS");
                    setBusca("");
                    setFiltroFuncao("TODAS");
                    setFiltroSituacao("TODAS");
                    setFiltroApenasDescobertos(false);
                  }}
                  className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                  title="Limpar todos os filtros"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {/* Linha opcional: Função e Situação (cadastros importados RM) */}
            {(mostrarMaisFiltros || qtdFiltrosExtras > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id="mapa-filtro-funcao"
                  value={filtroFuncao}
                  onChange={(e) => setFiltroFuncao(e.target.value)}
                  className={`${campo} max-w-[260px] truncate`}
                  aria-label="Função"
                >
                  <option value="TODAS">Todas as funções ({funcoesDisponiveis.length})</option>
                  {funcoesDisponiveis.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <select
                  id="mapa-filtro-situacao"
                  value={filtroSituacao}
                  onChange={(e) => setFiltroSituacao(e.target.value)}
                  className={`${campo} max-w-[220px] truncate`}
                  aria-label="Situação"
                >
                  <option value="TODAS">Todas as situações</option>
                  {situacoesDisponiveis.map((sit) => (
                    <option key={sit} value={sit}>{sit}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })()}

      {/* 4. VISÃO GRADE DE OCUPAÇÃO POR UNIDADE */}
      {abaVisao === "GRADE" && (
        <div className="space-y-3">
          {/* Sub-barra: Mostrar só exceções, Totais da base, Legenda compacta e controles */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 px-1 py-0.5">
            {/* Esquerda: Totais e Opção de Hover */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-500 text-[11px]">
                {postosFiltrados.length} postos · {metricasCards.totalPosicoes} posições · {gruposPorBaseComResumo.length} unidades
              </span>
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
                <label
                  className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-700 hover:text-slate-900 font-medium"
                  title="Ao passar o mouse sobre um dia, mostra quem cumpriu o posto, ocorrências e coberturas"
                >
                  <input
                    type="checkbox"
                    checked={ativarTooltipHover}
                    onChange={(e) => setAtivarTooltipHover(e.target.checked)}
                    className="rounded text-[#1F4FD1] focus:ring-[#1F4FD1] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Detalhes do dia ao passar o mouse</span>
                </label>
              </div>
            </div>

            {/* Direita: Legenda inline compacta + Ações de Expansão */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="hidden lg:flex items-center gap-2.5 text-[11px] text-slate-600">
                <span className="text-slate-400">Legenda:</span>
                <span className="inline-flex items-center gap-1" title="Presença do titular">
                  <span className="w-4 h-4 rounded-[3px] bg-emerald-50 border border-emerald-100 inline-flex items-center justify-center text-[9px] font-semibold text-emerald-700/80">P</span>
                  <span>Presença</span>
                </span>
                <span className="inline-flex items-center gap-1" title="Cobertura (substituto)">
                  <span className="w-4 h-4 rounded-[3px] bg-sky-50 border border-sky-200 inline-flex items-center justify-center text-[9px] font-semibold text-sky-700">C</span>
                  <span>Cobertura</span>
                </span>
                <span className="inline-flex items-center gap-1" title="Folga (não programado pela escala)">
                  <span className="w-4 h-4 rounded-[3px] bg-white border border-slate-100 inline-flex items-center justify-center text-[9px] font-medium text-slate-300">F</span>
                  <span>Folga</span>
                </span>
                <span className="inline-flex items-center gap-1" title="Escala em aberto (clique para incluir)">
                  <span className="w-4 h-4 rounded-[3px] bg-white border border-slate-200 inline-flex items-center justify-center text-[10px] text-slate-400 font-bold">·</span>
                  <span>Em aberto</span>
                </span>
                <span className="inline-flex items-center gap-1" title="Sem dado de presença ou ausência">
                  <span className="w-4 h-4 rounded-[3px] bg-[#F3F4F6] border border-dashed border-[#D1D5DB] inline-flex items-center justify-center text-[9px] text-slate-400">–</span>
                  <span>Sem dado</span>
                </span>
                <span className="inline-flex items-center gap-1" title="Descoberto (ausência sem cobertura)">
                  <span className="w-4 h-4 rounded-[3px] bg-rose-600 border border-rose-700 inline-flex items-center justify-center text-[9px] font-bold text-white">D</span>
                  <span>Descoberto</span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <button
                  onClick={expandirTodasBases}
                  className="text-[#1F4FD1] hover:underline cursor-pointer font-medium"
                >
                  Expandir todas
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={recolherTodasBases}
                  className="text-slate-500 hover:underline cursor-pointer"
                >
                  Recolher todas
                </button>
              </div>
            </div>
          </div>

          {/* Acordeão de Unidades (Item 4: Fechadas por padrão, ordenadas com descobertos primeiro) */}
          {gruposPorBaseComResumo.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="font-semibold text-sm">Nenhum posto encontrado para os filtros selecionados.</div>
              <p className="text-xs text-slate-400 mt-1">Ajuste os filtros de busca ou selecione outra base.</p>
            </div>
          ) : (
            gruposPorBaseComResumo.map((resumo) => {
              const { baseNome, postos: postosDaBase, totalPostos, totalPosicoes, totalDiasD, taxaOcupacao } = resumo;
              const baseAberta = basesExpandidas.has(baseNome);

              return (
                <div key={baseNome} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                  {/* Linha da Unidade (Acordeão) */}
                  <button
                    onClick={() => toggleBase(baseNome)}
                    className="w-full flex items-center justify-between p-3 bg-white hover:bg-slate-50 border-b border-slate-100 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {baseAberta ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-900 text-sm">{baseNome}</span>
                      <span className="text-xs text-slate-400 font-normal">
                        · {totalPostos} {totalPostos === 1 ? "posto" : "postos"} · {totalPosicoes} {totalPosicoes === 1 ? "posição" : "posições"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 font-medium">
                        {taxaOcupacao}% ocupação
                      </span>

                      {/* Indicador de dias D sem fundo destacado */}
                      {totalDiasD > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {totalDiasD} {totalDiasD === 1 ? "dia descoberto" : "dias descobertos"}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Conteúdo da Unidade Expandida */}
                  {baseAberta && (
                    <div className="p-3 space-y-4 bg-slate-50/40">
                      {(() => {
                        // Filtra postos e posições quando "Mostrar só exceções" ou "filtroApenasDescobertos" estiver ativo
                        const postosComExcecao = postosDaBase.filter((posto) => {
                          const idPostoChave = posto.idPosto || posto.id;
                          const apCiclo = apuracaoCicloPorPosto.get(idPostoChave);
                          const vgs = obterVagasDoPosto(posto, vagasPorPosto);

                          if (!mostrarApenasExcecoes && !filtroApenasDescobertos) return true;

                          return vgs.some((vaga) => {
                            if (filtroApenasDescobertos) {
                              return apCiclo?.dias?.some((d) =>
                                d.vagasDetalhe?.some(
                                  (vd: OcupacaoVagaDia) =>
                                    (vd.vagaId === vaga.id || vd.posicaoId === vaga.id) &&
                                    vd.status === "DESCOBERTO"
                                )
                              );
                            }
                            if (mostrarApenasExcecoes) {
                              return apCiclo?.dias?.some((d) =>
                                d.vagasDetalhe?.some((vd: OcupacaoVagaDia) => {
                                  if (vd.vagaId !== vaga.id && vd.posicaoId !== vaga.id) return false;
                                  return (
                                    vd.status === "DESCOBERTO" ||
                                    vd.status === "CICLO_NAO_CONFIGURADO" ||
                                    vd.status === "SEM_DADO" ||
                                    vd.status === "PENDENTE"
                                  );
                                })
                              );
                            }
                            return true;
                          });
                        });

                        if (postosComExcecao.length === 0) {
                          return (
                            <div className="p-4 text-center text-xs text-slate-500 bg-white rounded border border-slate-200">
                              Nenhuma exceção nesta unidade. Todas as posições estão regulares. Desmarque &quot;Mostrar só exceções&quot; para visualizar todas as posições.
                            </div>
                          );
                        }

                        return postosComExcecao.map((posto) => {
                          const idPostoChave = posto.idPosto || posto.id;
                          const idReferencia = posto.idReferencia || posto.idPosto || posto.id;
                          const vgs = obterVagasDoPosto(posto, vagasPorPosto);
                          const apuracaoCiclo = apuracaoCicloPorPosto.get(idPostoChave);
                          const percentualCicloFmt = apuracaoCiclo?.percentualCicloFormatado ?? "–";

                          const posicoesFiltradas = vgs.filter((vaga) => {
                            if (filtroApenasDescobertos) {
                              return apuracaoCiclo?.dias?.some((d) =>
                                d.vagasDetalhe?.some(
                                  (vd: OcupacaoVagaDia) =>
                                    (vd.vagaId === vaga.id || vd.posicaoId === vaga.id) &&
                                    vd.status === "DESCOBERTO"
                                )
                              );
                            }
                            if (mostrarApenasExcecoes) {
                              return apuracaoCiclo?.dias?.some((d) =>
                                d.vagasDetalhe?.some((vd: OcupacaoVagaDia) => {
                                  if (vd.vagaId !== vaga.id && vd.posicaoId !== vaga.id) return false;
                                  return (
                                    vd.status === "DESCOBERTO" ||
                                    vd.status === "CICLO_NAO_CONFIGURADO" ||
                                    vd.status === "SEM_DADO" ||
                                    vd.status === "PENDENTE"
                                  );
                                })
                              );
                            }
                            return true;
                          });

                          return renderCartaoPosto(posto, posicoesFiltradas);
                        });
                      })()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VISÃO POR ITEM DA PPU (item → postos de todas as unidades → matriz do ciclo) */}
      {/* ========================================================================= */}
      {abaVisao === "PPU" && (
        <div className="space-y-3">
          {/* Sub-barra no mesmo padrão da Grade */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 px-1 py-0.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-500 text-[11px]">
                {gruposPorItemPpu.length} itens da PPU · {postosFiltrados.length} postos · {metricasCards.totalPosicoes} posições
              </span>
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
                <label
                  className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-700 hover:text-slate-900 font-medium"
                  title="Ao passar o mouse sobre um dia, mostra quem cumpriu o posto, ocorrências e coberturas"
                >
                  <input
                    type="checkbox"
                    checked={ativarTooltipHover}
                    onChange={(e) => setAtivarTooltipHover(e.target.checked)}
                    className="rounded text-[#1F4FD1] focus:ring-[#1F4FD1] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Detalhes do dia ao passar o mouse</span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                onClick={() => setItensPpuExpandidos(new Set(gruposPorItemPpu.map((g) => g.codigo)))}
                className="text-[#1F4FD1] hover:underline cursor-pointer font-medium"
              >
                Expandir todos
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={() => {
                  setItensPpuExpandidos(new Set());
                  setPostosExpandidos(new Set());
                }}
                className="text-slate-500 hover:underline cursor-pointer"
              >
                Recolher todos
              </button>
            </div>
          </div>

          {gruposPorItemPpu.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="font-semibold text-sm">Nenhum posto encontrado para os filtros selecionados.</div>
              <p className="text-xs text-slate-400 mt-1">Ajuste os filtros de busca ou selecione outra base.</p>
            </div>
          ) : (
            gruposPorItemPpu.map((grupo) => {
              const aberto = itensPpuExpandidos.has(grupo.codigo);
              const postosVisiveis = grupo.postos
                .map((p) => ({ posto: p, posicoes: obterPosicoesVisiveis(p, obterVagasDoPosto(p, vagasPorPosto)) }))
                .filter((x) => x.posicoes.length > 0 || (!mostrarApenasExcecoes && !filtroApenasDescobertos));

              return (
                <div key={grupo.codigo} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                  {/* Linha do Item PPU (Acordeão) — mesmo padrão da linha de unidade da Grade */}
                  <button
                    onClick={() =>
                      setItensPpuExpandidos((prev) => {
                        const next = new Set(prev);
                        if (next.has(grupo.codigo)) next.delete(grupo.codigo);
                        else next.add(grupo.codigo);
                        return next;
                      })
                    }
                    aria-expanded={aberto}
                    className="w-full flex items-center justify-between gap-3 p-3 bg-white hover:bg-slate-50 border-b border-slate-100 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                      {aberto ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-mono font-semibold text-slate-900 text-sm w-10">{grupo.codigo}</span>
                      <span className="font-semibold text-slate-900 text-sm">{grupo.descricao}</span>
                      <span className="text-xs text-slate-400 font-normal">
                        · {grupo.totalPostos} {grupo.totalPostos === 1 ? "posto" : "postos"} · {grupo.totalPosicoes}{" "}
                        {grupo.totalPosicoes === 1 ? "posição" : "posições"} · {grupo.totalBases}{" "}
                        {grupo.totalBases === 1 ? "unidade" : "unidades"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-600 font-medium">{grupo.taxaOcupacao}% ocupação</span>
                      {grupo.totalDiasD > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {grupo.totalDiasD} {grupo.totalDiasD === 1 ? "dia descoberto" : "dias descobertos"}
                        </span>
                      )}
                    </div>
                  </button>

                  {aberto && (
                    <div className="p-3 space-y-4 bg-slate-50/40">
                      {postosVisiveis.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 bg-white rounded border border-slate-200">
                          Nenhuma exceção neste item. Todas as posições estão regulares.
                        </div>
                      ) : (
                        postosVisiveis.map(({ posto, posicoes }) =>
                          renderCartaoPosto(posto, posicoes, {
                            unidade: posto.localAtuacao || posto.baseOperacional || posto.unidadeNome,
                          })
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VISÃO PAINEL DE PENDÊNCIAS (Item 6 - Apenas Perfil Premier) */}
      {/* ========================================================================= */}
      {abaVisao === "PENDENCIAS" && podeEditarOperacao && (
        <div className="space-y-4">
          {/* Card de Contador: "posições com programação completa / total" */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Status de Programação das Posições (Item 6)
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
                  <span>{progressoProgramacao.completas} / {progressoProgramacao.total}</span>
                  <span className="text-sm font-semibold text-slate-600">posições com programação completa</span>
                  <span className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full ml-1">
                    {progressoProgramacao.percentual}%
                  </span>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                <span>Pendências de escala ativas: <strong>{pendenciasEscala.filter(p => p.status !== "RESOLVIDA" && p.status !== "BAIXADA").length}</strong></span>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressoProgramacao.percentual}%` }}
              />
            </div>
          </div>

          {/* Filtros de Pendências */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold">Unidade:</span>
                <select
                  value={filtroPendenciaUnidade}
                  onChange={(e) => setFiltroPendenciaUnidade(e.target.value)}
                  className="border border-slate-300 rounded px-2.5 py-1 bg-white text-slate-800 font-medium"
                >
                  <option value="TODAS">Todas as Unidades ({listaBases.length})</option>
                  {listaBases.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold">Tipo:</span>
                <select
                  value={filtroPendenciaTipo}
                  onChange={(e) => setFiltroPendenciaTipo(e.target.value)}
                  className="border border-slate-300 rounded px-2.5 py-1 bg-white text-slate-800 font-medium"
                >
                  <option value="TODOS">Todos os Tipos</option>
                  <option value="ESCALA_SEM_PROGRAMACAO">Escala Sem Programação</option>
                  <option value="INCONSISTENCIA_CADASTRO">Inconsistência de Cadastro</option>
                  <option value="FAIXA_DUPLA">Faixa Horária Dupla</option>
                  <option value="CICLICA_SEM_FASE">Cíclica Sem Fase / Data-Base</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold">Prioridade:</span>
                <select
                  value={filtroPendenciaPrioridade}
                  onChange={(e) => setFiltroPendenciaPrioridade(e.target.value)}
                  className="border border-slate-300 rounded px-2.5 py-1 bg-white text-slate-800 font-medium"
                >
                  <option value="TODAS">Todas as Prioridades</option>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Média</option>
                  <option value="BAIXA">Baixa</option>
                </select>
              </div>
            </div>

            {(filtroPendenciaUnidade !== "TODAS" || filtroPendenciaTipo !== "TODOS" || filtroPendenciaPrioridade !== "TODAS") && (
              <button
                onClick={() => {
                  setFiltroPendenciaUnidade("TODAS");
                  setFiltroPendenciaTipo("TODOS");
                  setFiltroPendenciaPrioridade("TODAS");
                }}
                className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
              >
                <FilterX className="w-3 h-3" />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>

          {/* Tabela de Pendências */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                Pendências Identificadas ({pendenciasFiltradas.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Ao preencher a escala, a pendência é baixada automaticamente
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-left">
                    <th className="p-2.5 font-bold">ID</th>
                    <th className="p-2.5 font-bold">Unidade</th>
                    <th className="p-2.5 font-bold">Posição</th>
                    <th className="p-2.5 font-bold">Tipo</th>
                    <th className="p-2.5 font-bold">Descrição da Pendência</th>
                    <th className="p-2.5 font-bold text-center">Prioridade</th>
                    <th className="p-2.5 font-bold text-center">Status</th>
                    <th className="p-2.5 font-bold text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendenciasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Nenhuma pendência encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    pendenciasFiltradas.map((pend) => {
                      const resolvida = pend.status === "RESOLVIDA" || pend.status === "BAIXADA";

                      const vagaAlvo = vagas.find(
                        (v) =>
                          (v as any).codigoVisual === pend.posicao ||
                          v.id === pend.posicao ||
                          v.posicaoIdSGP === pend.posicao ||
                          (pend.postoBase && String(v.postoBase) === String(pend.postoBase))
                      );

                      const postoAlvo = postos.find(
                        (p) =>
                          p.idReferencia === pend.postoBase ||
                          p.idPosto === pend.postoBase ||
                          p.idPosto === vagaAlvo?.idPosto ||
                          p.id === vagaAlvo?.idPosto
                      );

                      return (
                        <tr key={pend.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-2.5 font-mono font-bold text-slate-600">{pend.id}</td>
                          <td className="p-2.5 font-medium text-slate-800">{pend.unidade || "-"}</td>
                          <td className="p-2.5 font-mono font-bold text-blue-900">{pend.posicao}</td>
                          <td className="p-2.5 font-medium text-slate-700">{pend.tipo}</td>
                          <td className="p-2.5 text-slate-600 max-w-md">{pend.descricao}</td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                pend.prioridade === "ALTA"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : pend.prioridade === "MEDIA"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {pend.prioridade}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                resolvida
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {resolvida ? "RESOLVIDA" : pend.status || "PENDENTE"}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {resolvida ? (
                              <span className="text-[11px] text-emerald-700 font-semibold flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Baixada
                              </span>
                            ) : vagaAlvo && postoAlvo ? (
                              <button
                                onClick={() => {
                                  abrirInspecaoDia(vagaAlvo, postoAlvo, diaReferenciaStr);
                                  setEditandoEscala(true);
                                }}
                                className="px-2.5 py-1 bg-premier-900 hover:bg-premier-800 text-white rounded text-[11px] font-bold cursor-pointer transition-colors"
                              >
                                Configurar Escala
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">–</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PAINEL ÚNICO DE INSPEÇÃO DA POSIÇÃO (Item 1, 2, 4 e 5) */}
      {/* ========================================================================= */}
      {drawerInspecao && (() => {
        const titularVigente = obterAlocacaoVigenteVaga(
          drawerInspecao.vaga.id,
          alocacoes,
          drawerInspecao.dataStr
        );
        const chapaTitular = titularVigente?.matricula || (drawerInspecao.vaga as any).chapaTitular;
        const titularProf = chapaTitular ? mapaProfissionaisPorChapa.get(chapaTitular.trim()) : null;
        const horarioFormatado = formatarHorarioExibicao(
          titularProf?.horarioCodigo,
          titularProf?.horarioDescricao || drawerInspecao.vaga.horario_rm || titularVigente?.horarioEscalaRm || drawerInspecao.posto.escala
        );
        const secaoFormatada = formatarSecaoExibicao(
          titularProf?.secaoCodigo,
          titularProf?.secaoDescricao
        );
        const codigoPosicao = obterCodigoVisualPosicao(drawerInspecao.vaga, drawerInspecao.posto);
        const escalaTexto = drawerInspecao.vaga.tipoEscala || drawerInspecao.vaga.escalaTipo || drawerInspecao.posto.escala || "Não informado";
        const faixaHorariaTexto = drawerInspecao.vaga.faixaHoraria || drawerInspecao.vaga.faixa_horaria || (drawerInspecao.posto.horarioInicio && drawerInspecao.posto.horarioFim ? `${drawerInspecao.posto.horarioInicio} às ${drawerInspecao.posto.horarioFim}` : "Não informado");
        const regimeDiasTexto = drawerInspecao.vaga.regimeDias || drawerInspecao.vaga.regime_dias || drawerInspecao.posto.tipoPostoId || "Não informado";
        const grupoTexto = drawerInspecao.vaga.grupoRevezamento || drawerInspecao.vaga.grupo_revezamento || "Não informado";
        const faseTexto = drawerInspecao.vaga.faseCiclo || drawerInspecao.vaga.fase_ciclo || "Não informado";
        const dataBaseTexto = drawerInspecao.vaga.dataBaseEscala || drawerInspecao.vaga.data_base_escala || drawerInspecao.vaga.dataBaseCiclo || "Não informado";

        return (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
              <div className="p-5 sm:p-6 space-y-4">
                {/* Topo do Painel */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm bg-blue-900 text-white px-2.5 py-0.5 rounded shadow-2xs shrink-0">
                        Posição {codigoPosicao}
                      </span>
                      <span className="text-sm font-bold text-slate-900 leading-snug">
                        {drawerInspecao.posto.funcao}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Posto ID {drawerInspecao.posto.idReferencia || drawerInspecao.posto.idPosto} • Regime: {drawerInspecao.posto.tipoPostoId || "Turno/16h"} • Base: {drawerInspecao.posto.localAtuacao || drawerInspecao.posto.baseOperacional}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDrawerInspecao(null);
                      setEditandoEscala(false);
                      setRegistrandoCobertura(false);
                    }}
                    className="text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mensagens de Sucesso */}
                {mensagemEscalaSucesso && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center justify-between">
                    <span className="font-medium">{mensagemEscalaSucesso}</span>
                    <button onClick={() => setMensagemEscalaSucesso("")} className="text-emerald-700 font-bold ml-2">×</button>
                  </div>
                )}
                {mensagemCoberturaSucesso && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center justify-between">
                    <span className="font-medium">{mensagemCoberturaSucesso}</span>
                    <button onClick={() => setMensagemCoberturaSucesso("")} className="text-emerald-700 font-bold ml-2">×</button>
                  </div>
                )}
                {mensagemAjusteSucesso && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs flex items-center justify-between">
                    <span className="font-medium">{mensagemAjusteSucesso}</span>
                    <button onClick={() => setMensagemAjusteSucesso("")} className="text-blue-700 font-bold ml-2 cursor-pointer">×</button>
                  </div>
                )}

                {/* PAINEL ÚNICO: Código, escala, faixa horária, regime de dias, grupo/fase/data-base, titular atual (Item 1) */}
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3.5 space-y-2.5">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span>Parâmetros Operacionais da Posição</span>
                    {podeEditarOperacao && !editandoEscala && (
                      <button
                        onClick={() => {
                          setEditandoEscala(true);
                          setRegistrandoCobertura(false);
                        }}
                        className="text-blue-700 hover:text-blue-900 font-semibold cursor-pointer text-xs"
                      >
                        Editar Escala
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Código</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {codigoPosicao}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Horário (RM)</span>
                      <span className="font-mono font-bold text-slate-900 text-xs block truncate" title={horarioFormatado}>
                        {horarioFormatado}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Seção (RM)</span>
                      <span className="font-mono font-bold text-slate-900 text-xs block truncate" title={secaoFormatada}>
                        {secaoFormatada}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Faixa / Regime</span>
                      <span className="font-medium text-slate-800 text-xs truncate block" title={`${faixaHorariaTexto} • ${regimeDiasTexto}`}>
                        {faixaHorariaTexto}
                      </span>
                    </div>
                  </div>

                  {/* Grupo / Fase / Data-Base */}
                  <div className="grid grid-cols-3 gap-3 pt-2.5 border-t border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Grupo</span>
                      <span className="font-semibold text-slate-800">
                        {grupoTexto}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Fase</span>
                      <span className="font-semibold text-slate-800">
                        {faseTexto}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Data-Base</span>
                      <span className="font-semibold text-slate-800">
                        {dataBaseTexto}
                      </span>
                    </div>
                  </div>

                  {/* Titular Atual & Ficha Cadastral Segregada LGPD */}
                  <div className="pt-2 border-t border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                        Titular da Posição (Cadastro RM)
                      </span>
                      {ehPerfilFiscalPetrobras(perfilAtivo) && (
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium border border-slate-200">
                          Visão Fiscal Petrobras (LGPD ativa)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div>
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {titularProf?.nome || titularVigente?.nome || (drawerInspecao.vaga as any).titularReferencia || "Vaga sem titular alocado"}
                        </span>
                        {(titularProf?.chapa || chapaTitular) && (
                          <span className="text-slate-500 text-xs font-mono ml-2">
                            (Chapa {titularProf?.chapa || chapaTitular})
                          </span>
                        )}
                      </div>
                      {podeEditarOperacao && !registrandoCobertura && (
                        <button
                          onClick={() => {
                            setRegistrandoCobertura(true);
                            setEditandoEscala(false);
                            setFormDataInicioCob(drawerInspecao.dataStr);
                            setFormDataFimCob(drawerInspecao.dataStr);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs hover:shadow transition-all cursor-pointer border border-emerald-500"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Registrar Cobertura</span>
                        </button>
                      )}
                    </div>

                    {/* Ficha LGPD conforme Perfil */}
                    {titularProf && (
                      <div className="bg-white rounded border border-slate-200 p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mt-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Função RM</span>
                          <span className="font-semibold text-slate-800 truncate block" title={titularProf.funcao}>{titularProf.funcao}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Situação</span>
                          <span className="font-semibold text-slate-800">{titularProf.situacaoDescricao || titularProf.situacao}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Sexo / Idade</span>
                          <span className="font-semibold text-slate-800">
                            {titularProf.sexo || "—"} • {titularProf.dataNascimento ? `${calcularIdade(titularProf.dataNascimento)} anos` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">CPF</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {formatarCpfPorPerfil(titularProf.cpfLimpo || titularProf.cpfMascarado, perfilAtivo)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Data de Nascimento</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {formatarDataNascimentoPorPerfil(titularProf.dataNascimento, perfilAtivo)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Salário</span>
                          {podeVisualizarSalario(perfilAtivo) ? (
                            <span className="font-mono font-bold text-emerald-700">
                              {formatarSalarioPorPerfil(titularProf.dadosRestritos?.salario, perfilAtivo)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Restrito (LGPD)</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* LGPD: Dias de Ausência e Comentários MC (Regra 7) */}
                  {ehPremier ? (
                    (() => {
                      const alocDet = (titularVigente as any)?.alocacaoDetalhe || titularVigente;
                      const temComentario = Boolean(alocDet?.comentarioMC);
                      const temDias = alocDet?.diasAusenciaMC !== undefined && alocDet?.diasAusenciaMC !== null;
                      if (!temComentario && !temDias) return null;
                      return (
                        <div className="pt-2.5 border-t border-slate-200 text-xs space-y-1 bg-amber-50/60 p-2.5 rounded-md border border-amber-200">
                          <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px] uppercase tracking-wider">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            <span>Dados de Ausência & Motivos (Confidencial LGPD — Apenas Premier)</span>
                          </div>
                          {temDias && (
                            <p className="text-slate-700">
                              <strong>Dias de Ausência (MC):</strong> {alocDet.diasAusenciaMC} dia(s)
                            </p>
                          )}
                          {temComentario && (
                            <p className="text-slate-700">
                              <strong>Comentário MC:</strong> {alocDet.comentarioMC}
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="pt-2 border-t border-slate-200">
                      <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[11px] text-slate-500 italic">
                        Dados de atestados e motivos de ausência ocultados conforme diretriz LGPD (visualização restrita à Administração Premier).
                      </div>
                    </div>
                  )}
                </div>

                {/* FORMULÁRIO DE EDIÇÃO DE ESCALA DA POSIÇÃO (Item 5 - Perfil Premier) */}
                {editandoEscala && podeEditarOperacao && (
                  <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                      <span className="font-bold text-blue-950 text-xs uppercase tracking-wide">
                        Configurar Escala da Posição
                      </span>
                      <button
                        onClick={() => setEditandoEscala(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                    <p className="text-[11px] text-blue-900">
                      Preencha grupo, fase e data-base. Ao salvar, o mapa recalcula imediatamente e a pendência de escala é baixada de forma automática.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-700 uppercase block">Grupo de Revezamento</label>
                        <input
                          type="text"
                          value={formGrupo}
                          onChange={(e) => setFormGrupo(e.target.value)}
                          placeholder="Ex.: GRUPO 1"
                          className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-700 uppercase block">Fase do Ciclo</label>
                        <input
                          type="text"
                          value={formFase}
                          onChange={(e) => setFormFase(e.target.value)}
                          placeholder="Ex.: 1"
                          className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5 bg-white text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-700 uppercase block">Data-Base da Escala</label>
                        <input
                          type="date"
                          value={formDataBase}
                          onChange={(e) => setFormDataBase(e.target.value)}
                          className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5 bg-white text-xs font-semibold"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditandoEscala(false)}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSalvarEscala}
                        className="px-3 py-1.5 bg-premier-900 hover:bg-premier-800 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Salvar Escala & Baixar Pendência
                      </button>
                    </div>
                  </div>
                )}

                {/* FORMULÁRIO DE REGISTRO DE COBERTURA (quando aberto fora de dia descoberto) */}
                {registrandoCobertura && podeEditarOperacao && drawerInspecao.ocupacao.status !== "DESCOBERTO" && (
                  renderFormularioCobertura(codigoPosicao, titularProf?.nome || titularVigente?.nome)
                )}

                {/* MAPA DIÁRIO DO CICLO (Item 1 & 2) */}
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                        Mapa Diário do Ciclo
                      </span>
                      {diasCiclo.length > 0 && (
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {String(diasCiclo[0].diaNumero).padStart(2, "0")}/{String(diasCiclo[0].mes).padStart(2, "0")} a {String(diasCiclo[diasCiclo.length - 1].diaNumero).padStart(2, "0")}/{String(diasCiclo[diasCiclo.length - 1].mes).padStart(2, "0")} ({diasCiclo.length} dias)
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">Clique no dia para inspecionar</span>
                  </div>

                  {/* Régua de dias com siglas P, C, D, F, ? */}
                  <div className="overflow-x-auto pb-1.5 scrollbar-thin">
                    <div className="grid grid-cols-[repeat(31,minmax(0,1fr))] gap-0.5 sm:gap-1 min-w-[700px] sm:min-w-0 w-full">
                      {diasCiclo.map((d) => {
                        const apuracao = calcularStatusVagaDia(
                          drawerInspecao.vaga,
                          drawerInspecao.posto,
                          d.dataStr,
                          alocacoes,
                          ocorrencias,
                          coberturas,
                          apontamentos,
                          marcacoesSet,
                          dataRefLote || "2026-09-15"
                        );
                        const estilo = getCelulaEstiloPosicao(apuracao.status);
                        const selecionado = d.dataStr === drawerInspecao.dataStr;

                        return (
                          <button
                            key={d.dataStr}
                            onClick={() => selecionarDiaDrawer(d.dataStr)}
                            className={`w-full h-8 flex flex-col items-center justify-center rounded border transition-all cursor-pointer ${
                              estilo.classes
                            } ${
                              selecionado ? "ring-2 ring-blue-600 scale-105 shadow-xs font-black z-10" : "hover:brightness-95"
                            } ${
                              d.diaNumero === 1 ? "border-l-2 border-l-slate-400" : ""
                            }`}
                            title={`Dia ${String(d.diaNumero).padStart(2, "0")}/${String(d.mes).padStart(2, "0")} (${d.diaSemana})\nStatus: ${estilo.label}\n${apuracao.motivoPublico}`}
                          >
                            <span className="text-[10px] sm:text-[11px] leading-none font-bold">{estilo.sigla}</span>
                            <span className="text-[8px] opacity-75 leading-none mt-0.5">{d.diaNumero}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* DETALHE DO DIA SELECIONADO NA RÉGUA */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Dia Selecionado</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {drawerInspecao.dataStr.split("-").reverse().join("/")}
                      </span>
                    </div>
                    <div>
                      <BadgeStatus status={drawerInspecao.ocupacao.statusVaga} tamanho="md" />
                    </div>
                  </div>

                  {/* Se COBERTURA (C): Mostrar quem cobriu (Item 2) */}
                  {drawerInspecao.ocupacao.status === "COBERTO" && (
                    <div className="p-3 rounded-lg bg-sky-50 border border-sky-300 text-sky-950 space-y-1.5">
                      <span className="text-[10px] font-bold text-sky-800 uppercase block tracking-wider">
                        Substituição / Cobertura Ativa
                      </span>
                      <div className="text-xs">
                        <strong>Substituído por:</strong> <span className="font-bold text-sky-900">{drawerInspecao.ocupacao.ocupanteNome}</span>
                        {drawerInspecao.ocupacao.ocupanteMatricula && (
                          <span className="font-mono text-sky-800 text-[11px] ml-1">
                            (Chapa {drawerInspecao.ocupacao.ocupanteMatricula})
                          </span>
                        )}
                      </div>
                      {drawerInspecao.ocupacao.titularSubstituido && (
                        <div className="text-[11px] text-sky-800">
                          Titular ausente: <strong>{drawerInspecao.ocupacao.titularSubstituido.nome}</strong> ({drawerInspecao.ocupacao.titularSubstituido.matricula})
                        </div>
                      )}
                      <div className="text-[11px] text-sky-700 pt-0.5">
                        Motivo registrado: {drawerInspecao.ocupacao.motivoPublico}
                      </div>

                      {drawerInspecao.ocupacao.coberturaId && podeEditarOperacao && (
                        <div className="pt-2 border-t border-sky-200/80 flex items-center justify-between gap-2">
                          <Link
                            href="/coberturas"
                            className="text-[11px] text-sky-800 hover:text-sky-950 underline font-semibold inline-flex items-center gap-1"
                          >
                            <span>Gerenciar no Painel de Coberturas →</span>
                          </Link>
                          <button
                            onClick={() => handleExcluirCoberturaDrawer(drawerInspecao.ocupacao.coberturaId!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-rose-700 hover:text-white hover:bg-rose-600 rounded border border-rose-300 hover:border-rose-600 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                            title="Excluir permanentemente esta cobertura"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Excluir Cobertura</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Se PRESENTE (P) */}
                  {drawerInspecao.ocupacao.status === "PRESENTE" && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs space-y-1">
                      <span className="font-bold block text-emerald-800 uppercase text-[10px]">Titular Presente</span>
                      <div>
                        Ocupante: <strong>{drawerInspecao.ocupacao.ocupanteNome}</strong> ({drawerInspecao.ocupacao.ocupanteMatricula})
                      </div>
                      {drawerInspecao.ocupacao.batidas && (
                        <div className="text-[11px] text-emerald-800 mt-1">
                          Entrada: {drawerInspecao.ocupacao.batidas.entrada} • Saída: {drawerInspecao.ocupacao.batidas.saida} • Horas apuradas: {drawerInspecao.ocupacao.batidas.horas}h
                        </div>
                      )}
                    </div>
                  )}

                  {/* Se DESCOBERTO (D) */}
                  {drawerInspecao.ocupacao.status === "DESCOBERTO" && (
                    <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-950 text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold block text-rose-800 uppercase text-[10px]">
                          Posição Descoberta (D)
                        </span>
                        {drawerInspecao.ocupacao.categoriaAusencia && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-200 font-bold text-[10px]">
                            {drawerInspecao.ocupacao.categoriaAusencia}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-rose-900 leading-relaxed">
                        {drawerInspecao.ocupacao.motivoPublico}
                      </p>

                      {/* Botão Principal de Ação Imediata para Designar Cobertura */}
                      {podeEditarOperacao && !registrandoCobertura && (
                        <button
                          type="button"
                          onClick={() => {
                            setRegistrandoCobertura(true);
                            setEditandoEscala(false);
                            setFormDataInicioCob(drawerInspecao.dataStr);
                            setFormDataFimCob(drawerInspecao.dataStr);
                            setFormMotivoCob(
                              drawerInspecao.ocupacao.categoriaAusencia ||
                              drawerInspecao.ocupacao.motivoPublico ||
                              "LICENÇA / AFASTAMENTO"
                            );
                          }}
                          className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>+ Designar Cobertura para este Posto</span>
                        </button>
                      )}

                      {/* Se o formulário de cobertura estiver ativo para este dia descoberto */}
                      {podeEditarOperacao && registrandoCobertura && (
                        <div className="pt-1">
                          {renderFormularioCobertura(
                            codigoPosicao,
                            drawerInspecao.ocupacao.ocupanteNome || titularProf?.nome || titularVigente?.nome
                          )}
                        </div>
                      )}

                      {/* Sugestão de Feristas Vinculados Disponíveis (Item 3) */}
                      <div className="pt-2 border-t border-rose-200/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-rose-900 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                            Feristas Vinculados Disponíveis:
                          </span>
                          <Link
                            href="/descobertos"
                            className="text-[10px] text-blue-700 hover:text-blue-900 underline font-semibold"
                          >
                            Ver painel geral →
                          </Link>
                        </div>

                        {feristasSugeridosDrawer.length > 0 ? (
                          <div className="space-y-1">
                            {feristasSugeridosDrawer.map((f) => (
                              <div
                                key={f.chapa}
                                className="flex items-center justify-between p-1.5 bg-white rounded border border-rose-200 text-[11px]"
                              >
                                <span className="font-semibold text-slate-800">
                                  {f.nome} <span className="font-mono text-slate-500 font-normal">({f.chapa})</span>
                                </span>
                                {podeEditarOperacao && !registrandoCobertura && (
                                  <button
                                    onClick={() => {
                                      setFormSubstitutoChapa(f.chapa);
                                      setFormSubstitutoNome(f.nome);
                                      setRegistrandoCobertura(true);
                                      setFormDataInicioCob(drawerInspecao.dataStr);
                                      setFormDataFimCob(drawerInspecao.dataStr);
                                      setFormMotivoCob(
                                        drawerInspecao.ocupacao.categoriaAusencia ||
                                        drawerInspecao.ocupacao.motivoPublico ||
                                        "COBERTURA OPERACIONAL"
                                      );
                                    }}
                                    className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 cursor-pointer"
                                  >
                                    Designar
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">
                            Nenhum ferista vinculado à escala deste posto livre nesta data.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Se NÃO PROGRAMADO (N) */}
                  {drawerInspecao.ocupacao.status === "FOLGA" && (
                    <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs">
                      <span className="font-bold block text-slate-600 uppercase text-[10px]">Não programado pela escala (N)</span>
                      <p className="text-[11px] text-slate-600 mt-0.5">{drawerInspecao.ocupacao.motivoPublico}</p>
                    </div>
                  )}

                  {/* Se houver apontamento manual ativo neste dia */}
                  {(() => {
                    const ajusteManualAtivo = obterAjusteManualDia(drawerInspecao.vaga.id, drawerInspecao.dataStr);
                    if (!ajusteManualAtivo) return null;
                    return (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-900 uppercase text-[10px] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
                            Apontamento Manual Ativo ({ajusteManualAtivo.status})
                          </span>
                          <button
                            onClick={handleRemoverAjusteDia}
                            className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                          >
                            Reabrir dia / Desfazer
                          </button>
                        </div>
                        <p className="text-[11px] text-amber-900">
                          {ajusteManualAtivo.justificativa || "Status inserido manualmente pelo usuário para este dia."}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Se ESCALA EM ABERTO (CICLO_NAO_CONFIGURADO) */}
                  {drawerInspecao.ocupacao.status === "CICLO_NAO_CONFIGURADO" && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-50/60 to-slate-50 border border-blue-200 text-slate-800 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                          <span className="font-bold text-blue-950 uppercase text-[11px] tracking-wide">
                            Escala em Aberto · Inclusão de Dados
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                          {escalaTexto}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Esta posição opera em regime de escala ({escalaTexto}) e está com a escala em aberto para esta data ({drawerInspecao.dataStr.split("-").reverse().join("/")}). Você pode fazer a inclusão individual ou configurar a escala completa:
                      </p>

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                          1. Apontar Este Dia ({drawerInspecao.dataStr.split("-").reverse().join("/")}):
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <button
                            onClick={() => handleApontarStatusDia("PRESENTE")}
                            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                            title="Apontar presença do titular nesta data"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Presença (P)</span>
                          </button>

                          <button
                            onClick={() => handleApontarStatusDia("FOLGA")}
                            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 shadow-xs transition-all cursor-pointer"
                            title="Apontar folga de escala nesta data"
                          >
                            <span>Folga (F)</span>
                          </button>

                          <button
                            onClick={() => {
                              setRegistrandoCobertura(true);
                              setEditandoEscala(false);
                            }}
                            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                            title="Designar substituto para cobrir esta posição"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Cobertura (C)</span>
                          </button>

                          <button
                            onClick={() => handleApontarStatusDia("DESCOBERTO")}
                            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                            title="Apontar ausência/falta não coberta"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Falta (D)</span>
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-blue-200/70 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-600">
                          Ou configure a escala para calcular o mês inteiro automaticamente:
                        </span>
                        {podeEditarOperacao && !editandoEscala && (
                          <button
                            onClick={() => {
                              setEditandoEscala(true);
                              setRegistrandoCobertura(false);
                            }}
                            className="text-xs font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                          >
                            Configurar Escala (Grupo/Fase/Data) →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* REGISTROS DE PONTO DO DIA (previsto × realizado) — oculto para Fiscal Petrobras (LGPD) */}
                  {!ehFiscal ? (
                    <RegistrosPontoDia
                      pessoas={pessoasPontoDrawer}
                      pessoaAtiva={pessoaPontoAtiva}
                      onSelecionarPessoa={setPessoaPontoAtiva}
                      onAbrirEspelho={abrirEspelhoPeriodo}
                    />
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[11px] text-slate-500 italic">
                      Marcações individuais de ponto não são exibidas ao perfil Fiscal Petrobras (LGPD). Consulte a situação consolidada do posto.
                    </div>
                  )}

                  {/* Evidência Operacional */}
                  <div className="pt-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Evidência Operacional</span>
                    <p className="text-[11px] text-slate-700 mt-0.5 leading-relaxed">
                      {drawerInspecao.ocupacao.motivoPublico}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rodapé do Drawer */}
              <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => {
                    setDrawerInspecao(null);
                    setEditandoEscala(false);
                    setRegistrandoCobertura(false);
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 text-xs cursor-pointer"
                >
                  Fechar Painel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 6.1 MODAL DO ESPELHO DE PONTO COMPLETO DO PERÍODO */}
      {espelhoPeriodoAberto && espelhoPeriodo && (
        <ModalEspelhoPeriodo
          aberto
          onFechar={() => setEspelhoPeriodoAberto(null)}
          nome={espelhoPeriodoAberto.nome}
          chapa={espelhoPeriodoAberto.chapa}
          periodoTexto={
            diasCiclo.length > 0
              ? `Ciclo ${diasCiclo[0].dataStr.split("-").reverse().join("/")} a ${diasCiclo[diasCiclo.length - 1].dataStr.split("-").reverse().join("/")} • Posição ${drawerInspecao ? obterCodigoVisualPosicao(drawerInspecao.vaga, drawerInspecao.posto) : ""}`
              : ""
          }
          dias={espelhoPeriodo.dias}
          resumo={espelhoPeriodo.resumo}
          statusPosto={(dt) => {
            const st = espelhoPeriodo.statusPorData.get(dt);
            return st ? getCelulaEstiloPosicao(st.status) : undefined;
          }}
          onSelecionarDia={(dt) => {
            selecionarDiaDrawer(dt);
            setEspelhoPeriodoAberto(null);
          }}
        />
      )}

      {/* 7. MODAL DE HISTÓRICO DE ALOCAÇÕES DA POSIÇÃO */}
      {modalHistorico && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm">Histórico de Alocações da Posição</h3>
                  <div className="text-xs text-slate-300">
                    Posição <strong>{obterCodigoVisualPosicao(modalHistorico.vaga, modalHistorico.posto)}</strong> • Posto ID <strong>{modalHistorico.posto.idReferencia || modalHistorico.posto.idPosto}</strong> ({modalHistorico.posto.funcao})
                  </div>
                </div>
              </div>
              <button
                onClick={() => setModalHistorico(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
              {modalHistorico.alocacoes.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  Nenhum registro de alocação encontrado para esta posição.
                </div>
              ) : (
                modalHistorico.alocacoes.map((aloc, idx) => (
                  <div
                    key={aloc.id || idx}
                    className={`p-3 rounded-lg border space-y-1.5 ${
                      !aloc.dataFim
                        ? "bg-emerald-50/40 border-emerald-300"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">{aloc.nome}</span>
                        {!aloc.dataFim ? (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            Vigente
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                            Encerrada
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                        Motivo: {aloc.motivo}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 pt-1">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-semibold">Chapa RM</span>
                        <span className="font-mono font-bold text-slate-800">{aloc.matricula}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-semibold">Período</span>
                        <span className="font-medium text-slate-800">
                          {aloc.dataInicio} até {aloc.dataFim || "Vigente"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-semibold">Escala RM</span>
                        <span className="font-medium text-slate-800 truncate block" title={aloc.horarioEscalaRm}>
                          {aloc.horarioEscalaRm || modalHistorico.posto.escala}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setModalHistorico(null)}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded border border-slate-300 text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL DE CONFIRMAÇÃO DE LIMPEZA OPERACIONAL DO MAPA */}
      {modalConfirmarLimpezaOperacional && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-sm">Limpeza de Dados Operacionais</h3>
              </div>
              <button
                onClick={() => setModalConfirmarLimpezaOperacional(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-600">
              <p className="leading-relaxed">
                Esta ação remove todas as informações operacionais registradas no Mapa de Ocupação:
              </p>
              <ul className="space-y-1.5 list-disc list-inside bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700">
                <li><strong className="text-emerald-700">Preserva integralmente:</strong> Todas as posições e postos do contrato.</li>
                <li><strong className="text-rose-700">Exclui presenças:</strong> Marcações de ponto e batidas importadas.</li>
                <li><strong className="text-rose-700">Exclui coberturas:</strong> Substituições temporárias registradas.</li>
                <li><strong className="text-rose-700">Exclui descobertos:</strong> Faltas, atestados, ocorrências e apontamentos.</li>
                <li><strong className="text-rose-700">Exclui apontamentos manuais:</strong> Ajustes diários aplicados na escala.</li>
              </ul>
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-900 text-[11px] leading-relaxed">
                Um backup completo do estado atual será gerado automaticamente antes da limpeza.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setModalConfirmarLimpezaOperacional(false)}
                disabled={limpandoOperacional}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleLimparDadosOperacionais}
                disabled={limpandoOperacional}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{limpandoOperacional ? "Limpando..." : "Confirmar Limpeza"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip Flutuante Instantâneo no Hover do Quadro (Quem está cumprindo no dia) */}
      {tooltipOcupacao &&
        (() => {
          const {
            rect,
            vaga,
            posto,
            dataStr,
            diaSemana,
            diaNumero,
            mes,
            statusVaga,
            estilo,
            codigoVisual,
            alocRef,
            batidasReais,
          } = tooltipOcupacao;

          const tooltipWidth = 320;
          let left = rect.left + rect.width / 2 - tooltipWidth / 2;
          if (typeof window !== "undefined") {
            if (left < 12) left = 12;
            if (left + tooltipWidth > window.innerWidth - 12) {
              left = window.innerWidth - tooltipWidth - 12;
            }
          }

          const alturaTooltip = 210;
          const posicionarAcima = rect.top > alturaTooltip + 20;
          const top = posicionarAcima ? rect.top - 8 : rect.bottom + 8;
          const transform = posicionarAcima ? "translateY(-100%)" : "translateY(0)";

          const nomeColaborador =
            statusVaga.ocupanteNome || statusVaga.ocupante?.nome || alocRef?.nome;
          const matriculaColaborador =
            statusVaga.ocupanteMatricula ||
            statusVaga.ocupante?.matricula ||
            alocRef?.matricula;
          const isCobertura =
            statusVaga.tipoOcupacao === "cobertura" || statusVaga.status === "COBERTO";
          const titularSubstituido = statusVaga.titularSubstituido;
          const titularMat = matriculaColaborador || alocRef?.matricula;
          const profTooltip = titularMat ? mapaProfissionaisPorChapa.get(titularMat.trim()) : null;
          const horario = formatarHorarioExibicao(
            profTooltip?.horarioCodigo,
            profTooltip?.horarioDescricao || statusVaga.horarioPrevisto || alocRef?.horarioEscalaRm || posto.escala
          );

          return (
            <div
              style={{
                position: "fixed",
                top: `${top}px`,
                left: `${left}px`,
                transform,
                zIndex: 9999,
                pointerEvents: "none",
              }}
              className="w-[320px] bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/80 p-3 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/40 text-xs"
            >
              {/* Cabeçalho do Card */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                    Posição {codigoVisual}
                  </span>
                  <span className="text-[11px] text-slate-300 font-medium">
                    {String(diaNumero).padStart(2, "0")}/{String(mes).padStart(2, "0")} ({diaSemana})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[11px] ${estilo.classes}`}
                  >
                    {estilo.sigla}
                  </span>
                  <span className="text-[10px] text-slate-300 font-medium truncate max-w-[100px]">
                    {estilo.label}
                  </span>
                </div>
              </div>

              {/* Seção Principal: Quem está cumprindo no dia */}
              <div className="pt-2 pb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-blue-400" />
                  <span>Quem está cumprindo no dia:</span>
                </div>

                {statusVaga.status === "DESCOBERTO" ? (
                  <div className="bg-rose-950/60 border border-rose-800/80 rounded-lg p-2.5">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-rose-600/30 border border-rose-500/50 flex items-center justify-center shrink-0 mt-0.5">
                        <UserX className="w-3.5 h-3.5 text-rose-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-rose-200">
                          Posição Descoberta (Sem cumprimento)
                        </div>
                        {nomeColaborador && (
                          <div className="text-[10px] text-rose-300/90 mt-0.5">
                            Titular Ausente:{" "}
                            <span className="font-semibold text-white">{nomeColaborador}</span>
                            {matriculaColaborador && (
                              <span className="text-slate-400 font-mono ml-1">
                                ({matriculaColaborador})
                              </span>
                            )}
                          </div>
                        )}
                        <div className="text-[10px] text-rose-300 font-semibold mt-1">
                          {statusVaga.motivoPublico ||
                            statusVaga.categoriaAusencia ||
                            "Ausência sem cobertura registrada"}
                        </div>
                        
                      </div>
                    </div>
                  </div>
                ) : statusVaga.status === "SEM_OCUPANTE" || (statusVaga as any).status === "POSTO_VAGO" || statusVaga.statusVaga === "POSTO_VAGO" ? (
                  <div className="bg-amber-950/50 border border-amber-800/70 rounded-lg p-2.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-[11px] font-bold text-amber-200">
                          Posição Vaga / Sem Ocupante
                        </div>
                        <div className="text-[10px] text-amber-300/80 mt-0.5">
                          Não há colaborador alocado para esta vaga no SGP.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : statusVaga.status === "FOLGA" || (statusVaga as any).status === "NAO_EXIGIVEL" || statusVaga.statusVaga === "NAO_EXIGIVEL" ? (
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                          <Calendar className="w-3 h-3 text-slate-300" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-slate-200">
                            Folga Programada da Escala
                          </div>
                          {nomeColaborador ? (
                            <div className="text-[10px] text-slate-400 truncate">
                              Titular: <span className="text-slate-200">{nomeColaborador}</span>
                              {matriculaColaborador && (
                                <span className="text-slate-400 font-mono ml-1">
                                  ({matriculaColaborador})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">
                              {statusVaga.motivoPublico || "Dia não exigível pela escala"}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] bg-slate-700/80 text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold">
                        FOLGA
                      </span>
                    </div>
                  </div>
                ) : (
                  /* PRESENTE, COBERTO ou PENDENTE */
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs ${
                            isCobertura
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          }`}
                        >
                          {nomeColaborador ? nomeColaborador.charAt(0) : "P"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-white truncate leading-tight">
                            {nomeColaborador || "Profissional em atividade"}
                          </div>
                          {matriculaColaborador && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Chapa / Matrícula:{" "}
                              <span className="text-slate-200 font-semibold">
                                {matriculaColaborador}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isCobertura ? (
                        <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                          Cobertura / Ferista
                        </span>
                      ) : (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                          Titular
                        </span>
                      )}
                    </div>

                    {/* Se for cobertura, indica quem foi substituído */}
                    {isCobertura && titularSubstituido && (
                      <div className="bg-blue-950/40 border border-blue-900/60 rounded px-2 py-1 text-[10px] text-blue-200 flex items-center gap-1.5 mt-1">
                        <span className="text-blue-400 font-semibold">Substituindo titular:</span>
                        <span className="font-bold text-white truncate">
                          {titularSubstituido.nome}
                        </span>
                        {titularSubstituido.matricula && (
                          <span className="text-slate-400 font-mono text-[9px]">
                            ({titularSubstituido.matricula})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Linha de Horário e Marcações de Ponto */}
              <div className="pt-2 border-t border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Horário Previsto:</span>
                  </span>
                  <span className="font-mono font-medium text-slate-200">{horario}</span>
                </div>

                {/* Batidas reais de ponto apuradas */}
                {batidasReais && batidasReais.length > 0 ? (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Batidas no Ponto:</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-300 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/60">
                      {batidasReais.join(" • ")}
                    </span>
                  </div>
                ) : statusVaga.batidas?.entrada && statusVaga.batidas?.saida ? (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Batidas Registradas:</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-300 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/60">
                      {statusVaga.batidas.entrada} → {statusVaga.batidas.saida}
                      {statusVaga.batidas.horas ? ` (${statusVaga.batidas.horas}h)` : ""}
                    </span>
                  </div>
                ) : statusVaga.status === "PRESENTE" ||
                  (statusVaga as any).status === "TITULAR_PRESENTE" ||
                  statusVaga.status === "COBERTO" ? (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-slate-400" />
                      <span>Presença:</span>
                    </span>
                    <span className="text-emerald-300 font-medium">
                      Confirmada no espelho / homologação
                    </span>
                  </div>
                ) : null}

                {/* Ocorrência / Motivo detalhado se houver */}
                {statusVaga.ocorrencia && (
                  <div className="bg-slate-800/60 rounded px-2 py-1 text-[10px] text-amber-300 border border-amber-800/40 mt-1 flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        {statusVaga.ocorrencia.tipo || "Ocorrência"}:
                      </span>{" "}
                      <span>
                        {statusVaga.ocorrencia.observacaoPublica ||
                          statusVaga.ocorrencia.justificativa}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé / Dica de Interação */}
              {statusVaga.status === "DESCOBERTO" ? (
                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                    <span>Posto Descoberto</span>
                  </span>
                  <span className="text-blue-400 font-medium text-[9px]">
                    Clique para abrir inspeção
                  </span>
                </div>
              ) : (
                <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400">
                  <span className="truncate max-w-[180px]">
                    {formatarTituloPosto(posto)}
                  </span>
                  <span className="text-blue-400 font-medium shrink-0 ml-1">
                    Clique para abrir inspeção
                  </span>
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
}
