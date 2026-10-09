"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Lock,
  X,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  FileText,
  Briefcase,
  Clock,
  ShieldCheck,
  Printer,
  Copy,
  Check,
  Building2,
  Calendar,
  UserCheck,
  UserMinus,
  Download,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import {
  carregarEstado,
  adicionarProfissional,
  transferirColaboradorPosto,
  trocarTitularPosto,
  permutarTitularesPostos,
  obterMarcacoesPonto,
  calcularIdade,
  obterFaixaEtaria,
  ProfissionalOperacional,
  PostoOperacional,
  OcorrenciaOperacional,
  definirSessaoAtiva,
} from "@/lib/dados/estado-operacional";
import { MarcacaoPontoOriginal } from "@/lib/dados/ponto-tipos";
import { validarInterjornadaClt } from "@/lib/servicos/validacao-interjornada";
import { UsuarioSessao } from "@/lib/auth/tipos";
import { registrarLogAuditoriaAdmin } from "@/lib/auth/usuarios";
import {
  formatarHorarioExibicao,
  formatarSecaoExibicao,
  identificarTipoEscala,
  LISTA_TIPOS_ESCALA_FILTRO,
  formatarCpfPorPerfil,
  formatarDataNascimentoPorPerfil,
  formatarSalarioPorPerfil,
  podeVisualizarSalario,
  ehPerfilFiscalPetrobras,
  podeVerDadosPessoaisCompletos,
  calcularIdadeDinamica,
} from "@/lib/dados/rm-tipos";
import {
  obterTodasSecoesRm,
  obterTodosHorariosRm,
  obterTodasSituacoesRm,
  obterTodasFuncoesRm,
} from "@/lib/importadores/processador-rm-totvs";
import posicoesRev04Json from "@/lib/dados/posicoes-rev04.json";
import feristasRev04Json from "@/lib/dados/feristas-rev04.json";

const FUNCOES_PADRAO: Record<string, string> = {
  "almoxarife lider": "Almoxarife líder",
  "almoxarife líder": "Almoxarife líder",
  "auxiliar de almoxarifado i": "Auxiliar de almoxarifado I",
  "auxiliar de almoxarifado ii": "Auxiliar de almoxarifado II",
  "auxiliar de almoxarifado iii": "Auxiliar de almoxarifado III",
  "operador de empilhadeira lider": "Operador de empilhadeira líder",
  "operador de empilhadeira líder": "Operador de empilhadeira líder",
  "operador de empilhadeira folguista": "Operador de empilhadeira folguista",
  "auxiliar de logistica": "Auxiliar de logística",
  "auxiliar de logística": "Auxiliar de logística",
  "assistente de logistica": "Assistente de logística",
  "assistente de logística": "Assistente de logística",
  "conferente de carga": "Conferente de carga",
  "motorista de veiculo pesado": "Motorista de veículo pesado",
  "motorista operador de munck": "Motorista operador de munck",
  "analista de riscos": "Analista de riscos",
  "supervisor operacional": "Supervisor operacional",
  "auxiliar operacional": "Auxiliar operacional",
};

/**
 * Formata texto mantendo regras contratuais e Title Case limpo
 */
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
      if (palavra === "lider") return "líder";
      if (palavra === "logistica") return "logística";
      if (palavra === "veiculo") return "veículo";
      if (palavra === "operacoes") return "operações";
      if (palavra === "tecnico") return "técnico";
      if (palavra === "seguranca") return "segurança";
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}

function formatarFuncao(funcao?: string): string {
  if (!funcao) return "—";
  const chave = funcao.trim().toLowerCase();
  if (FUNCOES_PADRAO[chave]) return FUNCOES_PADRAO[chave];
  return formatarTexto(funcao);
}

function formatarNome(nome?: string): string {
  if (!nome) return "—";
  return formatarTexto(nome);
}

function formatarSituacao(sit?: string): string {
  if (!sit) return "—";
  const s = sit.toUpperCase();
  if (s === "ATIVO") return "Ativo";
  if (s === "AFASTADO") return "Afastado";
  if (s === "FERIAS") return "Férias";
  if (s === "DESLIGADO" || s === "DEMITIDO") return "Demitido";
  return formatarTexto(sit);
}

function calcularTempoCasa(dataAdmissaoStr?: string): string {
  if (!dataAdmissaoStr) return "—";
  const adm = new Date(dataAdmissaoStr + "T00:00:00");
  const hoje = new Date();
  if (isNaN(adm.getTime())) return "—";
  let anos = hoje.getFullYear() - adm.getFullYear();
  let meses = hoje.getMonth() - adm.getMonth();
  if (hoje.getDate() < adm.getDate()) {
    meses--;
  }
  if (meses < 0) {
    anos--;
    meses += 12;
  }
  if (anos <= 0 && meses <= 0) return "< 1 mês";
  if (anos === 0) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  if (meses === 0) return `${anos} ${anos === 1 ? "ano" : "anos"}`;
  return `${anos}a ${meses}m`;
}

function formatarEscalaMultiplicacao(escala?: string, horarioDesc?: string): string {
  const tipo = identificarTipoEscala(horarioDesc);
  const esc = (escala || "").toUpperCase();
  const raw = tipo !== "Não identificado" ? tipo : esc;
  if (/5[xX]2/.test(raw) || raw === "SEG/SEX") return "5 × 2";
  if (/12[xX]36/.test(raw)) return "12 × 36";
  if (/4[xX]4/.test(raw)) return "4 × 4";
  if (/4[xX]2/.test(raw)) return "4 × 2";
  if (/6[xX]1/.test(raw)) return "6 × 1";
  return raw || "5 × 2";
}

function normalizarBase(texto?: string): string {
  if (!texto) return "—";
  const t = texto.toUpperCase();
  if (t.includes("UFN-III") || t.includes("UFN III") || t.includes("TRÊS LAGOAS") || t.includes("TRES LAGOAS")) return "UFN-III";
  if (t.includes("REDUC")) return "REDUC";
  if (t.includes("RNEST")) return "RNEST";
  if (t.includes("REVAP")) return "REVAP";
  if (t.includes("REGAP")) return "REGAP";
  if (t.includes("RECAP")) return "RECAP";
  if (t.includes("REPLAN")) return "REPLAN";
  if (t.includes("REFAP")) return "REFAP";
  if (t.includes("RPBC")) return "RPBC";
  if (t.includes("LUBNOR")) return "LUBNOR";
  if (t.includes("EDISA")) return "EDISA";
  if (t.includes("EDIHB")) return "EDIHB";
  if (t.includes("EDIBRA")) return "EDIBRA";
  if (t.includes("CABIUNAS") || t.includes("CABIÚNAS")) return "CABIUNAS";
  if (t.includes("BOAVENTURA")) return "BOAVENTURA";
  if (t.includes("CENPES")) return "CENPES";
  if (t.includes("IMBETIBA")) return "IMBETIBA";
  if (t.includes("IMBOASSICA")) return "IMBOASSICA";
  if (t.includes("FAROL")) return "FAROL DE SÃO TOMÉ";
  if (t.includes("TAQUIPE")) return "BASE TAQUIPE";
  if (t.includes("PITUBA")) return "PITUBA";
  if (t.includes("REPAR")) return "REPAR";
  if (t.includes("EDISEN")) return "EDISEN";
  if (t.includes("EDISER")) return "EDISER";
  if (t.includes("FRONAPE")) return "FRONAPE";
  if (t.includes("EDIRN")) return "EDIRN";
  if (t.includes("EDMAN")) return "EDMAN";
  if (t.includes("UTG")) return "UTG";
  if (t.includes("EDIVIT")) return "EDIVIT";
  return texto.split(/[-–(]/)[0].trim().toUpperCase();
}

function obterIniciais(nome: string): string {
  if (!nome) return "—";
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export type TipoAbaProfissional = "TODOS" | "TITULARES" | "FERISTAS" | "RESERVA";

export default function ProfissionaisPage() {
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [marcacoesPonto, setMarcacoesPonto] = useState<MarcacaoPontoOriginal[]>([]);
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);

  // Filtros principais
  const [busca, setBusca] = useState("");
  const [abaProfissionais, setAbaProfissionais] = useState<TipoAbaProfissional>("TODOS");
  const [filtroBase, setFiltroBase] = useState("TODAS");
  const [filtroSituacao, setFiltroSituacao] = useState("TODAS");

  // Filtros secundários ("Mais filtros")
  const [mostrarMaisFiltros, setMostrarMaisFiltros] = useState(false);
  const [filtroSecao, setFiltroSecao] = useState("TODAS");
  const [filtroHorario, setFiltroHorario] = useState("TODOS");
  const [filtroFuncao, setFiltroFuncao] = useState("TODAS");
  const [filtroSexo, setFiltroSexo] = useState("TODOS");
  const [filtroTipoEscala, setFiltroTipoEscala] = useState("TODAS");

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(10);

  // Seleção de linhas (Checkboxes)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Menu de ações da linha (...)
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Modais e seleções
  const [modalAberto, setModalAberto] = useState(false);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<ProfissionalOperacional | null>(null);
  const [modalTransferenciaAberto, setModalTransferenciaAberto] = useState(false);
  const [colaboradorParaTransferir, setColaboradorParaTransferir] = useState<ProfissionalOperacional | null>(null);
  const [destinoPostoCodigo, setDestinoPostoCodigo] = useState("");
  const [buscaSubstituto, setBuscaSubstituto] = useState("");
  const [substitutoSelecionado, setSubstitutoSelecionado] = useState<ProfissionalOperacional | null>(null);
  const [modoPermuta, setModoPermuta] = useState(false);
  const [moverParaReserva, setMoverParaReserva] = useState(false);
  const [cienteInterjornadaTransferencia, setCienciaInterjornadaTransferencia] = useState(false);
  const [abaFicha, setAbaFicha] = useState<"CONTRATO" | "PONTO" | "DOCUMENTOS">("CONTRATO");
  const [copiadoFeedback, setCopiadoFeedback] = useState<string | null>(null);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);

  // Formulário novo profissional
  const [formMatricula, setFormMatricula] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formFuncao, setFormFuncao] = useState("");
  const [formPosto, setFormPosto] = useState("");
  const [formEscala, setFormEscala] = useState<"5x2" | "12x36" | "6x1">("5x2");
  const [formTelefone, setFormTelefone] = useState("");
  const [formSalario, setFormSalario] = useState("");
  const [formEndereco, setFormEndereco] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const carregarDados = () => {
    const estado = carregarEstado();
    setProfissionais(estado.profissionais);
    setPostos(estado.postos);
    setMarcacoesPonto(obterMarcacoesPonto());
    setOcorrencias(estado.ocorrencias || []);
  };

  useEffect(() => {
    carregarDados();

    const carregarSessao = async () => {
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.autenticado && data.usuario) {
            setSessao(data.usuario);
            definirSessaoAtiva({ id: data.usuario.id, nome: data.usuario.nome, perfil: data.usuario.perfil });
          }
        }
      } catch {
        // fail-closed
      }
    };
    carregarSessao();

    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // Fechar dropdown de ações ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbertoId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const perfilEfetivo: string | null = sessao?.perfil ?? null;
  const ehGestor = perfilEfetivo === "PREMIER_GESTOR" || perfilEfetivo === "PREMIER_GESTOR_CONTRATO";
  const ehPerfilPetrobras = !podeVerDadosPessoaisCompletos(perfilEfetivo);

  const basesPermitidas = sessao?.basesVinculadas || ["TODAS"];
  const podeAcessarBase = (unidadeId: string) => {
    if (basesPermitidas.includes("TODAS")) return true;
    return basesPermitidas.includes(unidadeId);
  };

  // Mapeamentos REV04 para cruzamento exato de titulares e feristas
  const mapaTitularesREV04 = useMemo(() => {
    const map = new Map<string, { postoIdSGP: string; posicaoIdSGP: string; unidade: string; postoDeServico?: string }>();
    (posicoesRev04Json as any[]).forEach((p) => {
      if (p.chapaTitular) {
        const chapa = String(p.chapaTitular).trim();
        if (!map.has(chapa)) {
          map.set(chapa, {
            postoIdSGP: p.postoIdSGP,
            posicaoIdSGP: p.posicaoIdSGP,
            unidade: p.unidade,
            postoDeServico: p.postoDeServico,
          });
        }
      }
    });
    return map;
  }, []);

  const mapaFeristasREV04 = useMemo(() => {
    const map = new Map<string, { feristaIdSGP: string; postoIdSGP?: string; unidade: string; postoDeServico?: string; papel?: string }>();
    (feristasRev04Json as any[]).forEach((f) => {
      if (f.chapaRM) {
        const chapa = String(f.chapaRM).trim();
        if (!map.has(chapa)) {
          map.set(chapa, {
            feristaIdSGP: f.feristaIdSGP,
            postoIdSGP: f.postoIdSGP,
            unidade: f.unidade,
            postoDeServico: f.postoDeServico,
            papel: f.papel,
          });
        }
      }
    });
    return map;
  }, []);

  // Enriquecimento dos profissionais
  const profissionaisEnriquecidos = useMemo(() => {
    return profissionais.map((p) => {
      const chapa = (p.chapa || p.matricula || "").trim();
      const chapaSemZeros = chapa.replace(/^0+/, "");

      const titular = mapaTitularesREV04.get(chapa) || (chapaSemZeros ? mapaTitularesREV04.get(chapaSemZeros) : undefined);
      const ferista = !titular ? (mapaFeristasREV04.get(chapa) || (chapaSemZeros ? mapaFeristasREV04.get(chapaSemZeros) : undefined)) : undefined;

      let tipoAlocacao: "TITULAR" | "FERISTA" | "RESERVA_TECNICA" = "RESERVA_TECNICA";
      let postoCodigoEfetivo = p.postoCodigo;
      let posicaoCodigoEfetivo: string | undefined;
      const rawBase = titular?.unidade || ferista?.unidade || p.unidadeNome || p.unidadeId || p.secaoDescricao;
      const baseNormalizada = normalizarBase(rawBase);

      if (titular) {
        tipoAlocacao = "TITULAR";
        postoCodigoEfetivo = p.postoCodigo || titular.postoIdSGP;
        posicaoCodigoEfetivo = titular.posicaoIdSGP;
      } else if (ferista) {
        tipoAlocacao = "FERISTA";
        postoCodigoEfetivo = p.postoCodigo || ferista.postoIdSGP;
      } else if (p.postoCodigo) {
        tipoAlocacao = "TITULAR";
        postoCodigoEfetivo = p.postoCodigo;
      }

      return {
        ...p,
        postoCodigo: postoCodigoEfetivo,
        posicaoCodigo: posicaoCodigoEfetivo,
        tipoAlocacao,
        baseNormalizada,
        titularInfo: titular,
        feristaInfo: ferista,
      };
    });
  }, [profissionais, mapaTitularesREV04, mapaFeristasREV04]);

  // Contadores oficiais
  const totalGeral = profissionaisEnriquecidos.length;
  const totalTitulares = useMemo(
    () => profissionaisEnriquecidos.filter((p) => p.tipoAlocacao === "TITULAR").length,
    [profissionaisEnriquecidos]
  );
  const totalFeristas = useMemo(
    () => profissionaisEnriquecidos.filter((p) => p.tipoAlocacao === "FERISTA").length,
    [profissionaisEnriquecidos]
  );
  const totalReserva = useMemo(
    () => profissionaisEnriquecidos.filter((p) => p.tipoAlocacao === "RESERVA_TECNICA").length,
    [profissionaisEnriquecidos]
  );

  // Lista de bases únicas disponíveis para o filtro
  const basesDisponiveis = useMemo(() => {
    const mapa = new Map<string, number>();
    profissionaisEnriquecidos.forEach((p) => {
      const b = p.baseNormalizada;
      if (b && b !== "—") {
        mapa.set(b, (mapa.get(b) || 0) + 1);
      }
    });
    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([nome, count]) => ({ nome, count }));
  }, [profissionaisEnriquecidos]);

  // Listas de opções secundárias
  const secoesDisponiveis = useMemo(() => {
    const mapa = new Map<string, { codigo: string; descricao: string }>();
    obterTodasSecoesRm().forEach((s) => mapa.set(s.codigo, { codigo: s.codigo, descricao: s.descricao }));
    profissionais.forEach((p) => {
      if (p.secaoCodigo) {
        mapa.set(p.secaoCodigo, {
          codigo: p.secaoCodigo,
          descricao: p.secaoDescricao || p.unidadeNome || p.secaoCodigo,
        });
      }
    });
    return Array.from(mapa.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [profissionais]);

  const horariosDisponiveis = useMemo(() => {
    const mapa = new Map<string, { codigo: string; descricao: string }>();
    obterTodosHorariosRm().forEach((h) => mapa.set(h.codigo, { codigo: h.codigo, descricao: h.descricao }));
    profissionais.forEach((p) => {
      if (p.horarioCodigo) {
        mapa.set(p.horarioCodigo, {
          codigo: p.horarioCodigo,
          descricao: p.horarioDescricao || p.horarioCodigo,
        });
      }
    });
    return Array.from(mapa.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [profissionais]);

  const funcoesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    obterTodasFuncoesRm().forEach((f) => set.add(f.nome));
    profissionais.forEach((p) => {
      if (p.funcao) set.add(p.funcao);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [profissionais]);

  const situacoesDisponiveis = useMemo(() => {
    const mapa = new Map<string, string>();
    obterTodasSituacoesRm().forEach((s) => mapa.set(s.codigo, `${s.descricao}`));
    profissionais.forEach((p) => {
      if (p.situacaoCodigo && p.situacaoDescricao) {
        mapa.set(p.situacaoCodigo, p.situacaoDescricao);
      } else if (p.situacao) {
        mapa.set(p.situacao, formatarSituacao(p.situacao));
      }
    });
    return Array.from(mapa.entries()).map(([codigo, label]) => ({ codigo, label }));
  }, [profissionais]);

  // Filtragem
  const profissionaisFiltrados = useMemo(() => {
    return profissionaisEnriquecidos.filter((pr) => {
      const q = busca.trim().toLowerCase();
      const qNum = q.replace(/\D/g, "");

      const matchTexto =
        !q ||
        pr.nome.toLowerCase().includes(q) ||
        (pr.nomeSocial && pr.nomeSocial.toLowerCase().includes(q)) ||
        (pr.chapa && pr.chapa.toLowerCase().includes(q)) ||
        pr.matricula.toLowerCase().includes(q) ||
        pr.funcao.toLowerCase().includes(q) ||
        (pr.postoCodigo && pr.postoCodigo.toLowerCase().includes(q)) ||
        (pr.baseNormalizada && pr.baseNormalizada.toLowerCase().includes(q)) ||
        (qNum.length >= 3 && pr.cpfLimpo.includes(qNum));

      // Aba / Segmento
      const matchAba =
        abaProfissionais === "TODOS"
          ? true
          : abaProfissionais === "TITULARES"
          ? pr.tipoAlocacao === "TITULAR"
          : abaProfissionais === "FERISTAS"
          ? pr.tipoAlocacao === "FERISTA"
          : pr.tipoAlocacao === "RESERVA_TECNICA";

      // Filtro Base
      const matchBase = filtroBase === "TODAS" || pr.baseNormalizada === filtroBase;

      // Filtro Situação
      const matchSituacao =
        filtroSituacao === "TODAS" ||
        pr.situacaoCodigo === filtroSituacao ||
        pr.situacao === filtroSituacao ||
        (filtroSituacao === "ATIVO" && pr.situacao === "ATIVO") ||
        (filtroSituacao === "FERIAS" && (pr.situacao === "FERIAS" || pr.situacaoCodigo === "F")) ||
        (filtroSituacao === "AFASTADO" && (pr.situacao === "AFASTADO" || pr.situacaoCodigo === "P" || pr.situacaoCodigo === "E")) ||
        (filtroSituacao === "DESLIGADO" && (pr.situacao === "DESLIGADO" || pr.situacaoCodigo === "D"));

      // Filtros secundários
      const matchSecao = filtroSecao === "TODAS" || pr.secaoCodigo === filtroSecao;
      const matchHorario = filtroHorario === "TODOS" || pr.horarioCodigo === filtroHorario;
      const matchFuncao = filtroFuncao === "TODAS" || pr.funcao.toUpperCase() === filtroFuncao.toUpperCase();
      const matchSexo = filtroSexo === "TODOS" || pr.sexo === filtroSexo;

      const tipoEscalaCalc = identificarTipoEscala(pr.horarioDescricao);
      const matchTipoEscala = filtroTipoEscala === "TODAS" || tipoEscalaCalc === filtroTipoEscala;

      const matchAcessoBase = podeAcessarBase(pr.unidadeId);

      return (
        matchTexto &&
        matchAba &&
        matchBase &&
        matchSituacao &&
        matchSecao &&
        matchHorario &&
        matchFuncao &&
        matchSexo &&
        matchTipoEscala &&
        matchAcessoBase
      );
    });
  }, [
    profissionaisEnriquecidos,
    busca,
    abaProfissionais,
    filtroBase,
    filtroSituacao,
    filtroSecao,
    filtroHorario,
    filtroFuncao,
    filtroSexo,
    filtroTipoEscala,
    basesPermitidas,
  ]);

  // Resetar página quando filtros mudam
  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, abaProfissionais, filtroBase, filtroSituacao, filtroSecao, filtroHorario, filtroFuncao, filtroSexo, filtroTipoEscala]);

  // Paginação dos itens visíveis
  const totalPaginas = Math.max(1, Math.ceil(profissionaisFiltrados.length / itensPorPagina));
  const inicioIndice = (paginaAtual - 1) * itensPorPagina;
  const fimIndice = Math.min(inicioIndice + itensPorPagina, profissionaisFiltrados.length);
  const itensVisiveis = useMemo(() => {
    return profissionaisFiltrados.slice(inicioIndice, fimIndice);
  }, [profissionaisFiltrados, inicioIndice, fimIndice]);

  // Seleção de linhas
  const todosSelecionados = itensVisiveis.length > 0 && itensVisiveis.every((p) => selecionados.has(p.id));
  const toggleSelecionarTodos = () => {
    if (todosSelecionados) {
      setSelecionados(new Set());
    } else {
      const novo = new Set(selecionados);
      itensVisiveis.forEach((p) => novo.add(p.id));
      setSelecionados(novo);
    }
  };

  const toggleSelecionarLinha = (id: string) => {
    const novo = new Set(selecionados);
    if (novo.has(id)) {
      novo.delete(id);
    } else {
      novo.add(id);
    }
    setSelecionados(novo);
  };

  // Exportar lista atual para CSV
  const handleExportarCsv = () => {
    const cabecalho = ["Chapa", "Nome", "CPF", "Funcao", "Base", "Alocacao", "Escala", "Situacao", "Horario"];
    const linhas = profissionaisFiltrados.map((p) => [
      `"${p.chapa || p.matricula}"`,
      `"${p.nome}"`,
      `"${p.cpfLimpo}"`,
      `"${formatarFuncao(p.funcao)}"`,
      `"${p.baseNormalizada}"`,
      `"${p.tipoAlocacao === "RESERVA_TECNICA" ? "Reserva técnica" : p.postoCodigo || "—"}"`,
      `"${formatarEscalaMultiplicacao(p.escala, p.horarioDescricao)}"`,
      `"${p.situacaoDescricao || formatarSituacao(p.situacao)}"`,
      `"${p.horarioDescricao || "—"}"`,
    ]);

    const csvConteudo = "\uFEFF" + [cabecalho.join(";"), ...linhas.map((l) => l.join(";"))].join("\n");
    const blob = new Blob([csvConteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Profissionais_SGP_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopiarTexto = (texto: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(texto);
      setCopiadoFeedback(label);
      setTimeout(() => setCopiadoFeedback(null), 2000);
    }
  };

  const handleAbrirFicha = (prof: ProfissionalOperacional) => {
    setProfissionalSelecionado(prof);
    setAbaFicha("CONTRATO");

    if (sessao) {
      try {
        registrarLogAuditoriaAdmin(
          sessao,
          "CONSULTAR_CADASTRO_INDIVIDUAL",
          "PROFISSIONAL",
          prof.chapa || prof.matricula,
          `Usuário ${sessao.nome} (${sessao.perfil}) visualizou ficha de ${prof.nomeSocial || prof.nome} (Chapa: ${prof.chapa || prof.matricula})`,
          null,
          `Base: ${prof.unidadeId}`
        );
      } catch {
        // fallback
      }
    }
  };

  const abrirModalTransferencia = (pr: ProfissionalOperacional) => {
    setColaboradorParaTransferir(pr);
    setDestinoPostoCodigo(pr.postoCodigo || "");
    setBuscaSubstituto("");
    setSubstitutoSelecionado(null);
    setMoverParaReserva(false);
    setModoPermuta(false);
    setCienciaInterjornadaTransferencia(false);
    setModalTransferenciaAberto(true);
  };

  // Candidatos para substituição
  const candidatosSubstitutos = useMemo(() => {
    if (!colaboradorParaTransferir) return [];
    const q = buscaSubstituto.trim().toLowerCase();
    const qNum = q.replace(/\D/g, "");

    const filtrados = profissionaisEnriquecidos.filter((pr) => {
      if (pr.matricula === colaboradorParaTransferir.matricula) return false;
      if (!q) return true;
      const matchNome = pr.nome.toLowerCase().includes(q) || (pr.nomeSocial && pr.nomeSocial.toLowerCase().includes(q));
      const matchMatricula = pr.matricula.toLowerCase().includes(q) || (pr.chapa && pr.chapa.toLowerCase().includes(q));
      const matchFuncao = pr.funcao.toLowerCase().includes(q);
      const matchPosto = pr.postoCodigo ? pr.postoCodigo.toLowerCase().includes(q) : false;
      const matchCpf = qNum.length >= 3 ? pr.cpfLimpo.includes(qNum) : false;
      return matchNome || matchMatricula || matchFuncao || matchPosto || matchCpf;
    });

    return filtrados
      .sort((a, b) => {
        const aFuncao = a.funcao.toLowerCase() === colaboradorParaTransferir.funcao.toLowerCase() ? 1 : 0;
        const bFuncao = b.funcao.toLowerCase() === colaboradorParaTransferir.funcao.toLowerCase() ? 1 : 0;
        if (aFuncao !== bFuncao) return bFuncao - aFuncao;

        const aReserva = a.tipoAlocacao === "RESERVA_TECNICA" ? 1 : 0;
        const bReserva = b.tipoAlocacao === "RESERVA_TECNICA" ? 1 : 0;
        if (aReserva !== bReserva) return bReserva - aReserva;

        const aAtivo = a.situacao === "ATIVO" ? 1 : 0;
        const bAtivo = b.situacao === "ATIVO" ? 1 : 0;
        return bAtivo - aAtivo;
      })
      .slice(0, 10);
  }, [profissionaisEnriquecidos, colaboradorParaTransferir, buscaSubstituto]);

  // Alerta interjornada
  const alertaInterjornadaTransferencia = useMemo(() => {
    if (!colaboradorParaTransferir) return null;
    if (moverParaReserva) return null;

    const postoAlvo =
      substitutoSelecionado && colaboradorParaTransferir.postoCodigo
        ? colaboradorParaTransferir.postoCodigo
        : destinoPostoCodigo;

    const matriculaAlvo = substitutoSelecionado ? substitutoSelecionado.matricula : colaboradorParaTransferir.matricula;
    if (!postoAlvo) return null;

    return validarInterjornadaClt({
      matricula: matriculaAlvo,
      dataInicio: new Date().toISOString().substring(0, 10),
      postoDestinoCodigo: postoAlvo,
      postos,
      profissionais,
      marcacoesPonto,
    });
  }, [
    colaboradorParaTransferir,
    destinoPostoCodigo,
    substitutoSelecionado,
    moverParaReserva,
    postos,
    profissionais,
    marcacoesPonto,
  ]);

  const handleSalvarTransferencia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorParaTransferir) return;

    if (alertaInterjornadaTransferencia && !alertaInterjornadaTransferencia.atende && !cienteInterjornadaTransferencia) {
      alert(
        `ALERTA CLT ART. 66 (Interjornada):\n\nO colaborador possui apenas ${alertaInterjornadaTransferencia.horasDescansoFormatado} de descanso entre turnos (déficit de ${alertaInterjornadaTransferencia.deficitFormatado} para as 11h mínimas).\n\nPara efetivar a troca em caráter excepcional, marque a ciência no formulário.`
      );
      return;
    }

    let res: { sucesso: boolean; mensagem: string };

    if (moverParaReserva) {
      res = transferirColaboradorPosto(colaboradorParaTransferir.matricula, undefined);
    } else if (substitutoSelecionado) {
      if (modoPermuta && colaboradorParaTransferir.postoCodigo && substitutoSelecionado.postoCodigo) {
        res = permutarTitularesPostos(colaboradorParaTransferir.matricula, substitutoSelecionado.matricula);
      } else if (colaboradorParaTransferir.postoCodigo) {
        res = trocarTitularPosto(colaboradorParaTransferir.postoCodigo, substitutoSelecionado.matricula);
      } else if (substitutoSelecionado.postoCodigo) {
        res = trocarTitularPosto(substitutoSelecionado.postoCodigo, colaboradorParaTransferir.matricula);
      } else {
        res = { sucesso: false, mensagem: "Ambos os colaboradores estão na Reserva Técnica. Nenhum posto para alocação." };
      }
    } else if (destinoPostoCodigo) {
      res = transferirColaboradorPosto(colaboradorParaTransferir.matricula, destinoPostoCodigo);
    } else {
      alert("Selecione um substituto para o posto ou opte por mover para a Reserva Técnica.");
      return;
    }

    if (res.sucesso) {
      setMensagemSucesso(res.mensagem);
      setModalTransferenciaAberto(false);
      setColaboradorParaTransferir(null);
      setSubstitutoSelecionado(null);
      setBuscaSubstituto("");
      setMoverParaReserva(false);
      setModoPermuta(false);
      setCienciaInterjornadaTransferencia(false);
      carregarDados();
      setTimeout(() => setMensagemSucesso(""), 4000);
    } else {
      alert(res.mensagem);
    }
  };

  const handleSubmitNovoColaborador = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMatricula || !formNome || !formCpf || !formFuncao) {
      alert("Preencha os campos obrigatórios (Matrícula, Nome, CPF e Função).");
      return;
    }

    const cpfNumerico = formCpf.replace(/\D/g, "");
    if (cpfNumerico.length !== 11) {
      alert("CPF deve conter 11 dígitos numéricos válidos.");
      return;
    }

    adicionarProfissional({
      matricula: formMatricula.toUpperCase().trim(),
      nome: formNome.trim(),
      cpfLimpo: cpfNumerico,
      funcao: formFuncao.trim(),
      unidadeId: "BASE OPERACIONAL",
      postoCodigo: formPosto || undefined,
      escala: formEscala,
      situacao: "ATIVO",
      dataAdmissao: new Date().toISOString().split("T")[0],
      telefoneCorporativo: formTelefone.trim() || undefined,
      dadosRestritos: {
        salario: formSalario ? parseFloat(formSalario) : undefined,
        endereco: formEndereco.trim() || undefined,
      },
    });

    setMensagemSucesso(`Colaborador ${formNome} (${formMatricula.toUpperCase()}) cadastrado com sucesso!`);
    setModalAberto(false);
    setFormMatricula("");
    setFormNome("");
    setFormCpf("");
    setFormFuncao("");
    setFormPosto("");
    setFormTelefone("");
    setFormSalario("");
    setFormEndereco("");

    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Breadcrumbs e Cabeçalho Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-medium">
            Operação <span className="mx-1 text-slate-400">/</span> <span className="text-slate-800 font-semibold">Profissionais</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Profissionais
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Gerencie os colaboradores e suas alocações.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportarCsv}
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all cursor-pointer"
            title="Exportar dados para CSV"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exportar</span>
          </button>

          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-2 bg-[#0B132B] hover:bg-[#1C2541] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Novo profissional</span>
          </button>
        </div>
      </div>

      {/* Alerta de Sucesso */}
      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl text-xs flex items-center justify-between shadow-xs animate-fadeIn print:hidden">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold text-sm">{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso("")} className="text-emerald-700 hover:text-emerald-950 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Abas com Underline (Todos, Titulares, Feristas, Reserva Técnica) */}
      <div className="border-b border-slate-200 flex items-center gap-6 sm:gap-8 overflow-x-auto print:hidden">
        <button
          type="button"
          onClick={() => setAbaProfissionais("TODOS")}
          className={`pb-3 inline-flex items-center gap-2 text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
            abaProfissionais === "TODOS"
              ? "font-bold text-slate-900 border-b-2 border-slate-900 -mb-px"
              : "font-medium text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Todos</span>
          <span className={`text-xs ${abaProfissionais === "TODOS" ? "font-bold text-slate-900" : "font-semibold text-slate-600"}`}>
            {totalGeral}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAbaProfissionais("TITULARES")}
          className={`pb-3 inline-flex items-center gap-2 text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
            abaProfissionais === "TITULARES"
              ? "font-bold text-slate-900 border-b-2 border-slate-900 -mb-px"
              : "font-medium text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Titulares</span>
          <span className="text-xs font-bold text-emerald-600">
            {totalTitulares}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAbaProfissionais("FERISTAS")}
          className={`pb-3 inline-flex items-center gap-2 text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
            abaProfissionais === "FERISTAS"
              ? "font-bold text-slate-900 border-b-2 border-slate-900 -mb-px"
              : "font-medium text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Feristas</span>
          <span className="text-xs font-bold text-indigo-600">
            {totalFeristas}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAbaProfissionais("RESERVA")}
          className={`pb-3 inline-flex items-center gap-2 text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
            abaProfissionais === "RESERVA"
              ? "font-bold text-slate-900 border-b-2 border-slate-900 -mb-px"
              : "font-medium text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Reserva técnica</span>
          <span className="text-xs font-semibold text-slate-600">
            {totalReserva}
          </span>
        </button>
      </div>

      {/* 3. Barra de Busca e Filtros Rápidos */}
      <div className="space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Busca por nome ou chapa */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou chapa"
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all shadow-2xs"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown 1: Todas as bases */}
          <div className="relative min-w-[190px]">
            <select
              value={filtroBase}
              onChange={(e) => setFiltroBase(e.target.value)}
              className="w-full appearance-none border border-slate-200/90 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 text-xs font-medium outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 cursor-pointer shadow-2xs pr-8"
            >
              <option value="TODAS">Todas as bases</option>
              {basesDisponiveis.map((b) => (
                <option key={b.nome} value={b.nome}>
                  {b.nome} ({b.count})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Dropdown 2: Todas as situações */}
          <div className="relative min-w-[190px]">
            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
              className="w-full appearance-none border border-slate-200/90 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 text-xs font-medium outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 cursor-pointer shadow-2xs pr-8"
            >
              <option value="TODAS">Todas as situações</option>
              <option value="ATIVO">Ativo</option>
              <option value="FERIAS">Férias</option>
              <option value="AFASTADO">Afastado</option>
              <option value="DESLIGADO">Demitido</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Botão: Mais filtros */}
          <button
            type="button"
            onClick={() => setMostrarMaisFiltros(!mostrarMaisFiltros)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-2xs ${
              mostrarMaisFiltros ||
              filtroSecao !== "TODAS" ||
              filtroHorario !== "TODOS" ||
              filtroFuncao !== "TODAS" ||
              filtroSexo !== "TODOS" ||
              filtroTipoEscala !== "TODAS"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Mais filtros</span>
            {(filtroSecao !== "TODAS" ||
              filtroHorario !== "TODOS" ||
              filtroFuncao !== "TODAS" ||
              filtroSexo !== "TODOS" ||
              filtroTipoEscala !== "TODAS") && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Expansor de "Mais filtros" */}
        {mostrarMaisFiltros && (
          <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs animate-fadeIn">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Seção RM</label>
              <select
                value={filtroSecao}
                onChange={(e) => setFiltroSecao(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 text-xs outline-none"
              >
                <option value="TODAS">Todas as Seções ({secoesDisponiveis.length})</option>
                {secoesDisponiveis.map((s) => (
                  <option key={s.codigo} value={s.codigo}>
                    {formatarSecaoExibicao(s.codigo, s.descricao)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Horário RM</label>
              <select
                value={filtroHorario}
                onChange={(e) => setFiltroHorario(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 text-xs outline-none"
              >
                <option value="TODOS">Todos os Horários ({horariosDisponiveis.length})</option>
                {horariosDisponiveis.map((h) => (
                  <option key={h.codigo} value={h.codigo}>
                    {formatarHorarioExibicao(h.codigo, h.descricao)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Função</label>
              <select
                value={filtroFuncao}
                onChange={(e) => setFiltroFuncao(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 text-xs outline-none"
              >
                <option value="TODAS">Todas as Funções ({funcoesDisponiveis.length})</option>
                {funcoesDisponiveis.map((f) => (
                  <option key={f} value={f}>
                    {formatarFuncao(f)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Sexo / Gênero</label>
              <select
                value={filtroSexo}
                onChange={(e) => setFiltroSexo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 text-xs outline-none"
              >
                <option value="TODOS">Todos os Sexos</option>
                <option value="M">M — Masculino</option>
                <option value="F">F — Feminino</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Tipo de Escala</label>
              <select
                value={filtroTipoEscala}
                onChange={(e) => setFiltroTipoEscala(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 text-xs outline-none"
              >
                <option value="TODAS">Tipo Escala: Todas</option>
                {LISTA_TIPOS_ESCALA_FILTRO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 4. Tabela Executiva no Padrão da Imagem */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-semibold text-xs bg-white">
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    onChange={toggleSelecionarTodos}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Colaborador</th>
                <th className="px-4 py-3.5">Função</th>
                <th className="px-4 py-3.5">Base</th>
                <th className="px-4 py-3.5">Alocação</th>
                <th className="px-4 py-3.5">Escala</th>
                <th className="px-4 py-3.5">Situação</th>
                <th className="w-28 px-4 py-3.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itensVisiveis.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <h4 className="font-bold text-slate-800 text-sm">Nenhum colaborador encontrado</h4>
                      <p className="text-xs text-slate-500">
                        Nenhum resultado corresponde aos critérios de busca ou filtros selecionados.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                itensVisiveis.map((prof) => {
                  const chapaFormatada = prof.chapa || prof.matricula;
                  const nomeExibicao = prof.nomeSocial || prof.nome;
                  const iniciais = obterIniciais(nomeExibicao);
                  const isChecked = selecionados.has(prof.id);
                  const escalaFormatada = formatarEscalaMultiplicacao(prof.escala, prof.horarioDescricao);

                  return (
                    <tr
                      key={prof.id}
                      className={`hover:bg-slate-50/70 transition-colors group ${
                        isChecked ? "bg-slate-50/90" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelecionarLinha(prof.id)}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                      </td>

                      {/* Colaborador (Avatar + Nome + Chapa) */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0">
                            {iniciais}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 text-xs truncate max-w-[220px]" title={formatarNome(nomeExibicao)}>
                              {formatarNome(nomeExibicao)}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                              Chapa: {chapaFormatada}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Função */}
                      <td className="px-4 py-3.5 text-slate-700 text-xs">
                        <span className="line-clamp-1" title={formatarFuncao(prof.funcao)}>
                          {formatarFuncao(prof.funcao)}
                        </span>
                      </td>

                      {/* Base */}
                      <td className="px-4 py-3.5 text-slate-800 font-medium text-xs whitespace-nowrap">
                        {prof.baseNormalizada}
                      </td>

                      {/* Alocação */}
                      <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                        {prof.tipoAlocacao === "RESERVA_TECNICA" ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-700 font-normal">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            <span>Reserva técnica</span>
                          </span>
                        ) : prof.tipoAlocacao === "FERISTA" ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-slate-800 text-xs">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                            <span>{prof.postoCodigo || "Ferista"}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-slate-800 text-xs">
                            {prof.postoCodigo || "—"}
                          </span>
                        )}
                      </td>

                      {/* Escala */}
                      <td className="px-4 py-3.5 text-slate-700 text-xs whitespace-nowrap">
                        {escalaFormatada}
                      </td>

                      {/* Situação */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        {prof.situacao === "ATIVO" || prof.situacaoCodigo === "A" ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>Ativo</span>
                          </span>
                        ) : prof.situacao === "FERIAS" || prof.situacaoCodigo === "F" ? (
                          <span className="inline-flex items-center gap-1.5 text-indigo-700 font-medium">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                            <span>Férias</span>
                          </span>
                        ) : prof.situacao === "AFASTADO" || prof.situacaoCodigo === "P" || prof.situacaoCodigo === "E" ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            <span>Afastado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                            <span>Demitido</span>
                          </span>
                        )}
                      </td>

                      {/* Ações (Botão Ver perfil + Menu ...) */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 relative">
                          <button
                            type="button"
                            onClick={() => handleAbrirFicha(prof)}
                            className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 text-xs font-medium shadow-2xs transition-all cursor-pointer"
                          >
                            Ver perfil
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuAbertoId(menuAbertoId === prof.id ? null : prof.id);
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                              title="Opções adicionais"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>

                            {/* Dropdown de Ações */}
                            {menuAbertoId === prof.id && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 text-xs text-left animate-fadeIn"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAbrirFicha(prof);
                                    setMenuAbertoId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Dossiê completo</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    abrirModalTransferencia(prof);
                                    setMenuAbertoId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Trocar posto</span>
                                </button>
                                <div className="my-1 border-t border-slate-100" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleCopiarTexto(chapaFormatada, "Chapa");
                                    setMenuAbertoId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Copiar chapa</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleCopiarTexto(formatarCpfPorPerfil(prof.cpfLimpo, perfilEfetivo), "CPF");
                                    setMenuAbertoId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Copiar CPF</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Rodapé com Paginação */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 print:hidden">
          <div>
            Exibindo{" "}
            <span className="font-semibold text-slate-800">
              {profissionaisFiltrados.length === 0 ? "0" : `${inicioIndice + 1}–${fimIndice}`}
            </span>{" "}
            de <span className="font-semibold text-slate-800">{profissionaisFiltrados.length}</span> profissionais
            {copiadoFeedback && (
              <span className="ml-3 font-semibold text-emerald-600 animate-fadeIn">
                {copiadoFeedback} copiado para a área de transferência!
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de itens por página */}
            <div className="relative">
              <select
                value={itensPorPagina}
                onChange={(e) => {
                  setItensPorPagina(Number(e.target.value));
                  setPaginaAtual(1);
                }}
                className="appearance-none border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 text-xs font-medium outline-none pr-7 cursor-pointer hover:border-slate-300"
              >
                <option value={10}>10 por página</option>
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Controles de Navegação */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                disabled={paginaAtual <= 1}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Página anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Botões numéricos de página */}
              {Array.from({ length: Math.min(5, totalPaginas) }).map((_, i) => {
                let num = i + 1;
                if (totalPaginas > 5 && paginaAtual > 3) {
                  num = paginaAtual - 2 + i;
                  if (num > totalPaginas) num = totalPaginas - (4 - i);
                }
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPaginaAtual(num)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                      paginaAtual === num
                        ? "bg-[#0B132B] text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {num}
                  </button>
                );
              })}

              {totalPaginas > 5 && paginaAtual < totalPaginas - 2 && (
                <>
                  <span className="text-slate-400 px-1">...</span>
                  <button
                    type="button"
                    onClick={() => setPaginaAtual(totalPaginas)}
                    className="w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    {totalPaginas}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual >= totalPaginas}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Próxima página"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Ficha do Colaborador (Dossiê Executivo) */}
      {profissionalSelecionado && (() => {
        const idadeCalculada = profissionalSelecionado.dataNascimento
          ? calcularIdade(profissionalSelecionado.dataNascimento)
          : null;
        const cpfFormatado = profissionalSelecionado.cpfLimpo.replace(
          /(\d{3})(\d{3})(\d{3})(\d{2})/,
          "$1.$2.$3-$4"
        );
        const temNomeSocial = !!profissionalSelecionado.nomeSocial;
        const nomePrincipal = profissionalSelecionado.nomeSocial || profissionalSelecionado.nome;
        const chapaCodigo = profissionalSelecionado.chapa || profissionalSelecionado.matricula;

        const ocorrenciasColab = ocorrencias.filter(
          (oc) => oc.matricula === profissionalSelecionado.matricula || oc.matricula === profissionalSelecionado.chapa
        );
        const diasAfetadosTotal = ocorrenciasColab.reduce((acc, curr) => acc + (curr.diasAfetados || 1), 0);
        const marcacoesColab = marcacoesPonto.filter(
          (m) => m.chapa === profissionalSelecionado.chapa || m.chapa === profissionalSelecionado.matricula
        );
        const postoVinculado = postos.find((p) => p.codigoPosto === profissionalSelecionado.postoCodigo);
        const iniciais = obterIniciais(nomePrincipal);

        const handleImprimirFicha = () => {
          const tituloOriginal = document.title;
          const nomeArquivo = `Ficha_Funcional_${chapaCodigo}_${nomePrincipal.replace(/\s+/g, "_")}`;
          document.title = nomeArquivo;
          window.print();
          setTimeout(() => {
            document.title = tituloOriginal;
          }, 1000);
        };

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn ficha-rh-container">
            <div
              className="fixed inset-0 cursor-pointer ficha-rh-backdrop print:hidden"
              onClick={() => setProfissionalSelecionado(null)}
              aria-hidden="true"
            />

            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-scaleIn ficha-rh-drawer print:hidden">
              {/* Topo do Modal */}
              <div className="bg-gradient-to-r from-[#1B1745] via-[#28185A] to-slate-900 text-white p-5 sm:p-6 relative shrink-0">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-[#D8C7A0]" />
                      <span>Dossiê Funcional do Colaborador</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfissionalSelecionado(null)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                    title="Fechar"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white/10 border-2 border-white/20 backdrop-blur-md flex items-center justify-center text-xl sm:text-2xl font-bold text-white shadow-lg">
                        {iniciais}
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                        <span
                          className={`relative inline-flex rounded-full h-4 w-4 border-2 border-[#28185A] ${
                            profissionalSelecionado.situacao === "ATIVO"
                              ? "bg-emerald-500"
                              : profissionalSelecionado.situacao === "FERIAS"
                              ? "bg-indigo-500"
                              : profissionalSelecionado.situacao === "AFASTADO"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          }`}
                        />
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                          {formatarNome(nomePrincipal)}
                        </h2>
                        {temNomeSocial && (
                          <span className="text-[11px] bg-purple-500/20 border border-purple-400/30 text-purple-200 px-2 py-0.5 rounded-full font-medium">
                            Nome Social
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            profissionalSelecionado.situacao === "ATIVO"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : profissionalSelecionado.situacao === "FERIAS"
                              ? "bg-indigo-500/20 text-indigo-300"
                              : profissionalSelecionado.situacao === "AFASTADO"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-white/10 text-slate-300"
                          }`}
                        >
                          {formatarSituacao(profissionalSelecionado.situacao)}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-[#D8C7A0] mt-0.5">
                        {formatarFuncao(profissionalSelecionado.funcao)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-300 font-mono">
                        <span>Chapa: {chapaCodigo}</span>
                        <span>•</span>
                        <span>Base: {normalizarBase(profissionalSelecionado.unidadeNome || profissionalSelecionado.unidadeId)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Abas da Ficha */}
              <div className="flex items-center gap-2 px-6 bg-slate-50 border-b border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setAbaFicha("CONTRATO")}
                  className={`inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
                    abaFicha === "CONTRATO"
                      ? "border-slate-900 text-slate-900 bg-white shadow-2xs font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Contrato & Lotação</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaFicha("PONTO")}
                  className={`inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
                    abaFicha === "PONTO"
                      ? "border-slate-900 text-slate-900 bg-white shadow-2xs font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Ponto & Ocorrências</span>
                  {ocorrenciasColab.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      {ocorrenciasColab.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAbaFicha("DOCUMENTOS")}
                  className={`inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
                    abaFicha === "DOCUMENTOS"
                      ? "border-slate-900 text-slate-900 bg-white shadow-2xs font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Documentos & LGPD</span>
                </button>
              </div>

              {/* Conteúdo da Ficha */}
              <div className="flex-1 overflow-y-auto p-6 bg-[#FAFAFC]">
                {abaFicha === "CONTRATO" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Vínculo Contratual */}
                      <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <Briefcase className="w-4 h-4 text-slate-900" />
                          <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                            Vínculo Contratual
                          </h4>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Cargo Contratual</span>
                            <span className="font-semibold text-slate-900 text-right">
                              {formatarFuncao(profissionalSelecionado.funcao)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Regime Trabalhista</span>
                            <span className="font-semibold text-slate-800">CLT (Indeterminado)</span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Data de Admissão</span>
                            <div className="text-right">
                              <span className="font-semibold text-slate-900">
                                {profissionalSelecionado.dataAdmissao
                                  ? profissionalSelecionado.dataAdmissao.split("-").reverse().join("/")
                                  : "—"}
                              </span>
                              <span className="text-[11px] text-slate-700 font-semibold ml-1.5">
                                ({calcularTempoCasa(profissionalSelecionado.dataAdmissao)})
                              </span>
                            </div>
                          </div>

                          {profissionalSelecionado.dataDesligamento && (
                            <div className="flex items-center justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500 font-medium">Data de Desligamento</span>
                              <span className="font-semibold text-rose-700">
                                {profissionalSelecionado.dataDesligamento.split("-").reverse().join("/")} (Rescisão)
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Carga Horária Semanal</span>
                            <span className="font-semibold text-slate-800">44 horas CLT</span>
                          </div>

                          <div className="flex items-center justify-between py-1">
                            <span className="text-slate-500 font-medium">Contrato Petrobras</span>
                            <span className="font-mono text-slate-800 font-semibold">
                              ICJ 5900.0129796.25.2
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Lotação & Escala */}
                      <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                          <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                            Lotação & Escala Operacional
                          </h4>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Seção / Lotação</span>
                            <span className="font-bold text-slate-900 text-right">
                              {formatarSecaoExibicao(
                                profissionalSelecionado.secaoCodigo,
                                profissionalSelecionado.secaoDescricao || profissionalSelecionado.unidadeNome
                              )}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Posto Anexo 1-A</span>
                            <div className="flex items-center gap-2">
                              {profissionalSelecionado.postoCodigo ? (
                                <>
                                  <span className="font-mono font-bold text-slate-900">
                                    {profissionalSelecionado.postoCodigo}
                                  </span>
                                  {postoVinculado && (
                                    <span className="text-slate-600 font-medium">
                                      — {formatarFuncao(postoVinculado.funcao)}
                                    </span>
                                  )}
                                  <Link
                                    href="/postos"
                                    className="text-[11px] text-slate-900 hover:underline font-semibold ml-1"
                                    title="Abrir posto no Anexo 1-A"
                                  >
                                    Ver →
                                  </Link>
                                </>
                              ) : (
                                <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Reserva técnica (Sem posto fixo)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Escala de Trabalho</span>
                            <span className="font-bold text-slate-900">
                              {formatarEscalaMultiplicacao(profissionalSelecionado.escala, profissionalSelecionado.horarioDescricao)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Turno / Horário</span>
                            <span className="text-slate-800 font-semibold text-right" title={profissionalSelecionado.horarioDescricao}>
                              {formatarHorarioExibicao(
                                profissionalSelecionado.horarioCodigo,
                                profissionalSelecionado.horarioDescricao
                              )}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1">
                            <span className="text-slate-500 font-medium">Status Operacional</span>
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              Regular no Contrato
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {abaFicha === "PONTO" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[11px] font-medium text-slate-400 block">Situação da Folha</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="font-bold text-xs text-slate-800">
                            {profissionalSelecionado.situacao === "DESLIGADO" ? "Rescindido" : "Folha Regular"}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[11px] font-medium text-slate-400 block">Aproveitamento</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`font-bold text-xs ${ocorrenciasColab.length === 0 ? "text-emerald-700" : "text-amber-800"}`}>
                            {ocorrenciasColab.length === 0 ? "100% Presença" : `${diasAfetadosTotal}d ausência`}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[11px] font-medium text-slate-400 block">Ocorrências no Mês</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-bold text-xs text-slate-800">
                            {ocorrenciasColab.length} registros
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[11px] font-medium text-slate-400 block">Marcações no Lote</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-bold text-xs text-slate-800">
                            {marcacoesColab.length > 0 ? `${marcacoesColab.length} batidas` : "Sincronizado"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-900" />
                          <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                            Espelho Mensal de Ponto • Competência Oficial
                          </h4>
                        </div>
                        <p className="text-xs text-slate-500">
                          {marcacoesColab.length > 0
                            ? `${marcacoesColab.length} marcações apuradas no lote oficial de ponto.`
                            : "Marcações sincronizadas e aptas para medição contratual Petrobras."}
                        </p>
                      </div>

                      {!ehPerfilPetrobras && (
                        <Link
                          href={`/profissionais/${chapaCodigo}/espelho-ponto`}
                          className="h-8.5 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-900" />
                          <span>Abrir Espelho Completo →</span>
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {abaFicha === "DOCUMENTOS" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Identificação */}
                      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <ShieldCheck className="w-4 h-4 text-slate-700" />
                          <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                            Identificação Pessoal (LGPD)
                          </h4>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">CPF</span>
                            <div className="font-mono font-bold text-slate-900">
                              <span>{formatarCpfPorPerfil(profissionalSelecionado.cpfLimpo, perfilEfetivo)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Data de Nascimento</span>
                            <div className="text-right">
                              <span className="font-semibold text-slate-800">
                                {formatarDataNascimentoPorPerfil(profissionalSelecionado.dataNascimento, perfilEfetivo)}
                              </span>
                              {idadeCalculada !== null && (
                                <span className="text-slate-500 ml-1.5 font-normal">({idadeCalculada} anos)</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Sexo / Gênero</span>
                            <span className="font-semibold text-slate-800">
                              {profissionalSelecionado.sexo === "M"
                                ? "Masculino"
                                : profissionalSelecionado.sexo === "F"
                                ? "Feminino"
                                : "Não informado"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1">
                            <span className="text-slate-500 font-medium">Telefone Corporativo</span>
                            <span className="font-semibold text-slate-800">
                              {profissionalSelecionado.telefoneCorporativo || "Não cadastrado"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* DP e Salário */}
                      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-amber-600" />
                            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                              Departamento Pessoal & Salário (LGPD)
                            </h4>
                          </div>
                          {podeVisualizarSalario(perfilEfetivo) && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                              Acesso Autorizado
                            </span>
                          )}
                        </div>

                        {podeVisualizarSalario(perfilEfetivo) ? (
                          <div className="space-y-2.5 text-xs animate-fadeIn">
                            <div className="flex items-center justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500 font-medium">Salário Mensal CLT</span>
                              <span className="font-bold text-slate-900 text-sm">
                                {formatarSalarioPorPerfil(profissionalSelecionado.dadosRestritos?.salario, perfilEfetivo)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500 font-medium">Telefone Pessoal</span>
                              <span className="font-semibold text-slate-800">
                                {profissionalSelecionado.dadosRestritos?.telefonePessoal || "Não informado"}
                              </span>
                            </div>

                            <div className="py-1">
                              <span className="text-slate-500 font-medium block">Endereço Residencial</span>
                              <span className="text-slate-800 font-medium block mt-0.5">
                                {profissionalSelecionado.dadosRestritos?.endereco || "Não informado no cadastro"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="py-5 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                              <Lock className="w-4 h-4 text-slate-500" />
                            </div>
                            <span className="text-slate-700 font-semibold mt-1">Dados Salariais Sob Sigilo LGPD</span>
                            <span className="text-[11px] text-slate-400 max-w-xs">
                              {ehGestor
                                ? "O perfil Gestor Premier não possui permissão para visualizar salários."
                                : "O perfil Fiscal Petrobras não possui acesso a salários por diretriz da LGPD."}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé do Modal */}
              <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 print:hidden">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleImprimirFicha}
                    className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-2 transition-all cursor-pointer"
                    title="Imprimir ou exportar ficha funcional em PDF"
                  >
                    <Printer className="w-4 h-4 text-white" />
                    <span>Imprimir / Exportar Ficha (PDF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirModalTransferencia(profissionalSelecionado)}
                    className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer"
                    title="Movimentar ou transferir de posto operacional"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Movimentar / Trocar Posto</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setProfissionalSelecionado(null)}
                  className="h-9 px-4 rounded-xl hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Timbre de Impressão Oficial */}
            <div className="hidden print:block w-full max-w-4xl mx-auto bg-white text-slate-900 font-sans p-6 sm:p-8 space-y-5 ficha-impressao-oficial">
              <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                <div>
                  <div className="text-base font-extrabold text-slate-900 tracking-wide uppercase">
                    Premier Logistics Ltda.
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    Sistema de Gestão de Postos (SGP) • Contrato Petrobras ICJ 5900.0129796.25.2
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-500 font-mono">
                  <div>Data de Emissão: {new Date().toLocaleDateString("pt-BR")}</div>
                  <div>Hora: {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>

              <div className="text-center py-2 bg-slate-100 rounded border border-slate-300">
                <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Ficha Funcional do Colaborador • Dossiê Oficial de Recursos Humanos
                </h1>
              </div>

              <div className="border border-slate-300 rounded p-4 space-y-3 avoid-break">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>1. Identificação do Colaborador</span>
                  <span className="font-mono text-slate-600 font-normal">Matrícula: {chapaCodigo}</span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 block font-medium">Nome Completo:</span>
                    <span className="font-bold text-slate-900 text-sm">{formatarNome(nomePrincipal)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Cargo / Função Contratual:</span>
                    <span className="font-bold text-slate-900">{formatarFuncao(profissionalSelecionado.funcao)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">CPF:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {ehPerfilPetrobras ? profissionalSelecionado.cpfMascarado : cpfFormatado}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Situação Cadastral:</span>
                    <span className="font-bold text-slate-900">{formatarSituacao(profissionalSelecionado.situacao)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Admissão de Novo Colaborador */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-5 bg-[#0B132B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Admitir Colaborador no Contrato</h3>
                  <p className="text-[11px] text-slate-300">Cadastro de força de trabalho e vínculo a posto</p>
                </div>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-300 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovoColaborador} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Matrícula / Chapa <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 046900"
                    value={formMatricula}
                    onChange={(e) => setFormMatricula(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 uppercase font-mono text-slate-800 outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Gabriel Alves Moreira"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    CPF (11 dígitos) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={14}
                    placeholder="123.456.789-01"
                    value={formCpf}
                    onChange={(e) => setFormCpf(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-800 outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Função Contratual <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Assistente de logística"
                    value={formFuncao}
                    onChange={(e) => setFormFuncao(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vincular a Posto (Anexo 1-A)</label>
                  <select
                    value={formPosto}
                    onChange={(e) => setFormPosto(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-2.5 py-2 bg-white text-slate-800 outline-none"
                  >
                    <option value="">Reserva técnica (Sem posto fixo)</option>
                    {postos.slice(0, 100).map((p) => (
                      <option key={p.codigoPosto} value={p.codigoPosto}>
                        {p.codigoPosto} — {p.funcao}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Escala Padrão</label>
                  <select
                    value={formEscala}
                    onChange={(e) => setFormEscala(e.target.value as "5x2" | "12x36" | "6x1")}
                    className="w-full border border-slate-300 rounded-xl px-2.5 py-2 bg-white text-slate-800 outline-none"
                  >
                    <option value="5x2">5 × 2</option>
                    <option value="12x36">12 × 36</option>
                    <option value="6x1">6 × 1</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefone Corporativo</label>
                  <input
                    type="text"
                    placeholder="(21) 99888-0000"
                    value={formTelefone}
                    onChange={(e) => setFormTelefone(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Salário Base (Restrito Premier)</label>
                  <input
                    type="number"
                    placeholder="2800.00"
                    value={formSalario}
                    onChange={(e) => setFormSalario(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Endereço Residencial (Restrito Premier)</label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro, cidade/UF..."
                  value={formEndereco}
                  onChange={(e) => setFormEndereco(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0B132B] hover:bg-[#1C2541] text-white font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Troca/Transferência de Posto do Colaborador */}
      {modalTransferenciaAberto && colaboradorParaTransferir && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:hidden animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn flex flex-col max-h-[92vh]">
            <div className="bg-gradient-to-r from-[#1B1745] to-[#28185A] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white leading-tight">Trocar Posto / Substituição</h3>
                  <p className="text-[11px] text-slate-300">Contrato Petrobras ICJ 5900.0129796.25.2</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalTransferenciaAberto(false);
                  setColaboradorParaTransferir(null);
                  setSubstitutoSelecionado(null);
                  setBuscaSubstituto("");
                  setMoverParaReserva(false);
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarTransferencia} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Colaborador Atual</div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{formatarNome(colaboradorParaTransferir.nome)}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Chapa: <strong className="font-mono">{colaboradorParaTransferir.chapa || colaboradorParaTransferir.matricula}</strong> • Função: <strong>{formatarFuncao(colaboradorParaTransferir.funcao)}</strong>
                    </div>
                  </div>
                  <div>
                    {colaboradorParaTransferir.postoCodigo ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                        Posto {colaboradorParaTransferir.postoCodigo}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                        ★ Reserva técnica
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs">
                    Quem irá assumir o posto? <span className="text-rose-500">*</span>
                  </label>
                  {(substitutoSelecionado || moverParaReserva) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubstitutoSelecionado(null);
                        setMoverParaReserva(false);
                        setBuscaSubstituto("");
                      }}
                      className="text-[11px] text-slate-900 hover:underline font-semibold cursor-pointer"
                    >
                      Alterar seleção
                    </button>
                  )}
                </div>

                {!substitutoSelecionado && !moverParaReserva && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="text"
                        value={buscaSubstituto}
                        onChange={(e) => setBuscaSubstituto(e.target.value)}
                        placeholder="Digite o nome, chapa ou CPF do substituto..."
                        className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none shadow-2xs"
                        autoFocus
                      />
                      {buscaSubstituto && (
                        <button
                          type="button"
                          onClick={() => setBuscaSubstituto("")}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {colaboradorParaTransferir.postoCodigo && (
                      <button
                        type="button"
                        onClick={() => {
                          setMoverParaReserva(true);
                          setSubstitutoSelecionado(null);
                        }}
                        className="w-full p-2.5 rounded-xl border border-dashed border-slate-300 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/50 text-slate-700 flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <UserMinus className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="font-semibold text-amber-900">Mover titular atual para Reserva técnica</span>
                        </div>
                        <span className="text-[11px] text-slate-400">(Deixar posto vago)</span>
                      </button>
                    )}

                    <div className="border border-slate-200 rounded-xl bg-white shadow-xs max-h-56 overflow-y-auto divide-y divide-slate-100">
                      <div className="p-2 bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {buscaSubstituto
                          ? `Resultados para "${buscaSubstituto}" (${candidatosSubstitutos.length})`
                          : `Colaboradores sugeridos para substituição (${candidatosSubstitutos.length})`}
                      </div>

                      {candidatosSubstitutos.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs">
                          Nenhum colaborador encontrado com os termos digitados.
                        </div>
                      ) : (
                        candidatosSubstitutos.map((cand) => (
                          <div
                            key={cand.matricula}
                            onClick={() => {
                              setSubstitutoSelecionado(cand);
                              setBuscaSubstituto("");
                              setMoverParaReserva(false);
                            }}
                            className="p-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 group-hover:text-slate-900 text-xs truncate">
                                  {formatarNome(cand.nome)}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {cand.chapa || cand.matricula}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {formatarFuncao(cand.funcao)} • Base {cand.baseNormalizada || cand.unidadeId}
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              {cand.tipoAlocacao === "TITULAR" && cand.postoCodigo ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                                  Posto {cand.postoCodigo}
                                </span>
                              ) : cand.tipoAlocacao === "FERISTA" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-200">
                                  Ferista
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                                  Reserva técnica
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {substitutoSelecionado && (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Substituto Confirmado</span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                        Chapa: {substitutoSelecionado.chapa || substitutoSelecionado.matricula}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-emerald-200">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {formatarNome(substitutoSelecionado.nome)}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Função: <strong>{formatarFuncao(substitutoSelecionado.funcao)}</strong>
                        </div>
                      </div>
                      <div>
                        {substitutoSelecionado.postoCodigo ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                            Posto {substitutoSelecionado.postoCodigo}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                            ★ Reserva técnica
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 bg-emerald-100/60 rounded-lg text-[11px] text-emerald-950 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>
                          {formatarNome(substitutoSelecionado.nome)} assumirá a titularidade do{" "}
                          <strong>
                            {colaboradorParaTransferir.postoCodigo
                              ? `Posto ${colaboradorParaTransferir.postoCodigo}`
                              : "posto selecionado"}
                          </strong>.
                        </span>
                      </div>
                      <div className="text-emerald-800 pl-5">
                        {modoPermuta && substitutoSelecionado.postoCodigo
                          ? `Permuta mútua: ${formatarNome(colaboradorParaTransferir.nome)} assumirá o Posto ${substitutoSelecionado.postoCodigo}.`
                          : `${formatarNome(colaboradorParaTransferir.nome)} será movido para a Reserva técnica.`}
                      </div>
                    </div>

                    {colaboradorParaTransferir.postoCodigo && substitutoSelecionado.postoCodigo && (
                      <div className="p-2 bg-white rounded border border-emerald-200 flex items-start gap-2">
                        <input
                          type="checkbox"
                          id="checkModoPermuta"
                          checked={modoPermuta}
                          onChange={(e) => setModoPermuta(e.target.checked)}
                          className="mt-0.5 w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                        />
                        <label htmlFor="checkModoPermuta" className="text-[11px] text-slate-800 font-medium cursor-pointer">
                          <strong>Realizar Permuta (Troca Mútua):</strong> {formatarNome(colaboradorParaTransferir.nome)} assumirá o Posto {substitutoSelecionado.postoCodigo} de {formatarNome(substitutoSelecionado.nome)}.
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {moverParaReserva && (
                  <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <UserMinus className="w-4 h-4 text-amber-600" />
                      <span>Desocupar Posto — Mover para Reserva técnica</span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      O colaborador <strong>{formatarNome(colaboradorParaTransferir.nome)}</strong> será desvinculado do <strong>Posto {colaboradorParaTransferir.postoCodigo}</strong> e movido para a <strong>Reserva técnica</strong>. O posto ficará oficialmente <strong>VAGO</strong> no Anexo 1-A e no Mapa de Ocupação.
                    </p>
                  </div>
                )}
              </div>

              {alertaInterjornadaTransferencia && !alertaInterjornadaTransferencia.atende && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2 text-xs animate-fadeIn">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Alerta CLT Art. 66 (Interjornada &lt; 11h)</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    O descanso apurado entre o turno anterior e o posto de destino é de <strong>{alertaInterjornadaTransferencia.horasDescansoFormatado}</strong> (déficit de {alertaInterjornadaTransferencia.deficitFormatado} em relação às 11h mínimas legais).
                  </p>
                  <div className="p-2 bg-white rounded border border-rose-200 flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="checkCienciaTransferencia"
                      checked={cienteInterjornadaTransferencia}
                      onChange={(e) => setCienciaInterjornadaTransferencia(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 text-rose-600 rounded cursor-pointer"
                    />
                    <label htmlFor="checkCienciaTransferencia" className="text-[10px] text-rose-950 font-semibold cursor-pointer">
                      Declaro ciência da não observância do repouso de 11h e autorizo a troca em caráter excepcional.
                    </label>
                  </div>
                </div>
              )}

              <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 -mx-5 -mb-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setModalTransferenciaAberto(false);
                    setColaboradorParaTransferir(null);
                    setSubstitutoSelecionado(null);
                    setBuscaSubstituto("");
                    setMoverParaReserva(false);
                  }}
                  className="h-9 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!substitutoSelecionado && !moverParaReserva && !destinoPostoCodigo}
                  className={`h-9 px-5 rounded-xl font-semibold text-xs shadow-xs transition-all cursor-pointer ${
                    substitutoSelecionado || moverParaReserva || destinoPostoCodigo
                      ? "bg-[#0B132B] hover:bg-[#1C2541] text-white active:scale-[0.98]"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  Confirmar Troca de Posto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
