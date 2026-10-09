"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Lock,
  Phone,
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
  MapPin,
  ChevronRight,
  SlidersHorizontal,
  Sparkles,
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
  "almoxarife lider": "Almoxarife Líder",
  "almoxarife líder": "Almoxarife Líder",
  "auxiliar de almoxarifado i": "Auxiliar de Almoxarifado I",
  "auxiliar de almoxarifado ii": "Auxiliar de Almoxarifado II",
  "auxiliar de almoxarifado iii": "Auxiliar de Almoxarifado III",
  "operador de empilhadeira lider": "Operador de Empilhadeira Líder",
  "operador de empilhadeira líder": "Operador de Empilhadeira Líder",
  "operador de empilhadeira folguista": "Operador de Empilhadeira Folguista",
  "auxiliar de logistica": "Auxiliar de Logística",
  "auxiliar de logística": "Auxiliar de Logística",
  "assistente de logistica": "Assistente de Logística",
  "assistente de logística": "Assistente de Logística",
  "conferente de carga": "Conferente de Carga",
  "motorista de veiculo pesado": "Motorista de Veículo Pesado",
  "motorista operador de munck": "Motorista Operador de Munck",
};

/**
 * Unificação de estilos de texto: formata strings em Title Case,
 * mantendo preposições minúsculas, numerais romanos e códigos contratuais.
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
      if (palavra === "lider") return "Líder";
      if (palavra === "logistica") return "Logística";
      if (palavra === "veiculo") return "Veículo";
      if (palavra === "operacoes") return "Operações";
      if (palavra === "tecnico") return "Técnico";
      if (palavra === "seguranca") return "Segurança";
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
  if (s === "DESLIGADO") return "Desligado";
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

function formatarHorario(horario?: string): string {
  if (!horario) return "Horário Operacional Padrão";
  let clean = horario.replace(/^PETROBRAS\s*-\s*/i, "").trim();
  clean = clean.replace(/\s*-\s*ESCALA\s+[0-9X]+/i, "").trim();
  clean = clean.replace(/\bAS\b/i, "às");
  clean = clean.replace(/SEG\/DOM/i, "Seg a Dom");
  clean = clean.replace(/SEG\/SEX/i, "Seg a Sex");
  clean = clean.replace(/SEG\/SAB/i, "Seg a Sáb");
  return clean || horario;
}

function obterIniciais(nome: string): string {
  if (!nome) return "—";
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function obterGradienteAvatar(identificador: string): string {
  const gradientes = [
    "from-indigo-600 to-purple-800 text-white",
    "from-slate-700 to-slate-900 text-white",
    "from-blue-600 to-indigo-800 text-white",
    "from-teal-600 to-emerald-800 text-white",
    "from-violet-600 to-purple-900 text-white",
    "from-cyan-700 to-blue-900 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < identificador.length; i++) {
    hash = identificador.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradientes[Math.abs(hash) % gradientes.length];
}

export type TipoAbaProfissional = "TODOS" | "TITULARES" | "FERISTAS" | "RESERVA";

export default function ProfissionaisPage() {
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [marcacoesPonto, setMarcacoesPonto] = useState<MarcacaoPontoOriginal[]>([]);
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [busca, setBusca] = useState("");
  const [abaProfissionais, setAbaProfissionais] = useState<TipoAbaProfissional>("TODOS");

  // Filtros oficiais
  const [filtroSecao, setFiltroSecao] = useState("TODAS");
  const [filtroHorario, setFiltroHorario] = useState("TODOS");
  const [filtroFuncao, setFiltroFuncao] = useState("TODAS");
  const [filtroSituacao, setFiltroSituacao] = useState("TODAS");
  const [filtroSexo, setFiltroSexo] = useState("TODOS");
  const [filtroTipoEscala, setFiltroTipoEscala] = useState("TODAS");

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
  const [copiadoCpfId, setCopiadoCpfId] = useState<string | null>(null);
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

  const perfilEfetivo: string | null = sessao?.perfil ?? null;
  const ehGestor = perfilEfetivo === "PREMIER_GESTOR" || perfilEfetivo === "PREMIER_GESTOR_CONTRATO";
  const ehPerfilPetrobras = !podeVerDadosPessoaisCompletos(perfilEfetivo);

  const basesPermitidas = sessao?.basesVinculadas || ["TODAS"];
  const podeAcessarBase = (unidadeId: string) => {
    if (basesPermitidas.includes("TODAS")) return true;
    return basesPermitidas.includes(unidadeId);
  };

  // Mapeamentos da REV04 para cruzamento de titulares e feristas
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

  // Enriquecimento dos profissionais com alocação REV04
  const profissionaisEnriquecidos = useMemo(() => {
    return profissionais.map((p) => {
      const chapa = (p.chapa || p.matricula || "").trim();
      const chapaSemZeros = chapa.replace(/^0+/, "");

      const titular = mapaTitularesREV04.get(chapa) || (chapaSemZeros ? mapaTitularesREV04.get(chapaSemZeros) : undefined);
      const ferista = !titular ? (mapaFeristasREV04.get(chapa) || (chapaSemZeros ? mapaFeristasREV04.get(chapaSemZeros) : undefined)) : undefined;

      let tipoAlocacao: "TITULAR" | "FERISTA" | "RESERVA_TECNICA" = "RESERVA_TECNICA";
      let postoCodigoEfetivo = p.postoCodigo;
      let posicaoCodigoEfetivo: string | undefined;
      let imovelEfetivo = p.unidadeNome || p.unidadeId || "—";

      if (titular) {
        tipoAlocacao = "TITULAR";
        postoCodigoEfetivo = p.postoCodigo || titular.postoIdSGP;
        posicaoCodigoEfetivo = titular.posicaoIdSGP;
        imovelEfetivo = titular.unidade || imovelEfetivo;
      } else if (ferista) {
        tipoAlocacao = "FERISTA";
        postoCodigoEfetivo = p.postoCodigo || ferista.postoIdSGP;
        imovelEfetivo = ferista.unidade || imovelEfetivo;
      } else if (p.postoCodigo) {
        tipoAlocacao = "TITULAR";
        postoCodigoEfetivo = p.postoCodigo;
      }

      return {
        ...p,
        postoCodigo: postoCodigoEfetivo,
        posicaoCodigo: posicaoCodigoEfetivo,
        tipoAlocacao,
        imovelEfetivo,
        titularInfo: titular,
        feristaInfo: ferista,
      };
    });
  }, [profissionais, mapaTitularesREV04, mapaFeristasREV04]);

  // Totais do Quadro
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

  // Listas de opções derivadas dos cadastros oficiais
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
    obterTodasSituacoesRm().forEach((s) => mapa.set(s.codigo, `${s.codigo} - ${s.descricao}`));
    profissionais.forEach((p) => {
      if (p.situacaoCodigo && p.situacaoDescricao) {
        mapa.set(p.situacaoCodigo, `${p.situacaoCodigo} - ${p.situacaoDescricao}`);
      } else if (p.situacao) {
        mapa.set(p.situacao, p.situacao);
      }
    });
    return Array.from(mapa.entries()).map(([codigo, label]) => ({ codigo, label }));
  }, [profissionais]);

  const handleCopiarCpf = (cpfTexto: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(cpfTexto);
      setCopiadoCpfId(id);
      setTimeout(() => setCopiadoCpfId(null), 2000);
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
          `Usuário ${sessao.nome} (${sessao.perfil}) visualizou cadastro de ${prof.nomeSocial || prof.nome} (Chapa: ${prof.chapa || prof.matricula})`,
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

  // Filtragem combinada
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
        (pr.secaoCodigo && pr.secaoCodigo.toLowerCase().includes(q)) ||
        (pr.secaoDescricao && pr.secaoDescricao.toLowerCase().includes(q)) ||
        (pr.horarioCodigo && pr.horarioCodigo.toLowerCase().includes(q)) ||
        (pr.horarioDescricao && pr.horarioDescricao.toLowerCase().includes(q)) ||
        (pr.postoCodigo && pr.postoCodigo.toLowerCase().includes(q)) ||
        (pr.imovelEfetivo && pr.imovelEfetivo.toLowerCase().includes(q)) ||
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

      const matchSecao = filtroSecao === "TODAS" || pr.secaoCodigo === filtroSecao;
      const matchHorario = filtroHorario === "TODOS" || pr.horarioCodigo === filtroHorario;
      const matchFuncao = filtroFuncao === "TODAS" || pr.funcao.toUpperCase() === filtroFuncao.toUpperCase();
      const matchSituacao =
        filtroSituacao === "TODAS" ||
        pr.situacaoCodigo === filtroSituacao ||
        pr.situacao === filtroSituacao;
      const matchSexo = filtroSexo === "TODOS" || pr.sexo === filtroSexo;

      const tipoEscalaCalc = identificarTipoEscala(pr.horarioDescricao);
      const matchTipoEscala = filtroTipoEscala === "TODAS" || tipoEscalaCalc === filtroTipoEscala;

      const matchBase = podeAcessarBase(pr.unidadeId);

      return (
        matchTexto &&
        matchAba &&
        matchSecao &&
        matchHorario &&
        matchFuncao &&
        matchSituacao &&
        matchSexo &&
        matchTipoEscala &&
        matchBase
      );
    });
  }, [
    profissionaisEnriquecidos,
    busca,
    abaProfissionais,
    filtroSecao,
    filtroHorario,
    filtroFuncao,
    filtroSituacao,
    filtroSexo,
    filtroTipoEscala,
    basesPermitidas,
  ]);

  const filtrosAtivosCount = useMemo(() => {
    let count = 0;
    if (busca) count++;
    if (abaProfissionais !== "TODOS") count++;
    if (filtroSecao !== "TODAS") count++;
    if (filtroHorario !== "TODOS") count++;
    if (filtroFuncao !== "TODAS") count++;
    if (filtroSituacao !== "TODAS") count++;
    if (filtroSexo !== "TODOS") count++;
    if (filtroTipoEscala !== "TODAS") count++;
    return count;
  }, [
    busca,
    abaProfissionais,
    filtroSecao,
    filtroHorario,
    filtroFuncao,
    filtroSituacao,
    filtroSexo,
    filtroTipoEscala,
  ]);

  const limparTodosFiltros = () => {
    setBusca("");
    setAbaProfissionais("TODOS");
    setFiltroSecao("TODAS");
    setFiltroHorario("TODOS");
    setFiltroFuncao("TODAS");
    setFiltroSituacao("TODAS");
    setFiltroSexo("TODOS");
    setFiltroTipoEscala("TODAS");
  };

  // Candidatos para substituição com busca aberta
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
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* 1. Cabeçalho Executivo Moderno */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Base Oficial RM TOTVS
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                REV04 • 29 Unidades Petrobras
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Quadro de Profissionais
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Gestão integrada da força de trabalho, alocações ativas em postos do Anexo 1-A e monitoramento da reserva técnica.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
            <Link
              href="/mapa-ocupacao"
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-2xs transition-all cursor-pointer"
            >
              <span>Ver no Mapa</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </Link>
            <button
              onClick={() => setModalAberto(true)}
              className="inline-flex items-center gap-2 bg-[#28185A] hover:bg-[#1B1745] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#D8C7A0]" />
              <span>Novo Profissional</span>
            </button>
          </div>
        </div>

        {/* 2. Cards Executivos de Resumo (KPIs Interativos) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-100">
          {/* Card 1: Total */}
          <div
            onClick={() => setAbaProfissionais("TODOS")}
            className={`p-4 rounded-xl border transition-all cursor-pointer select-none group relative overflow-hidden ${
              abaProfissionais === "TODOS"
                ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10"
                : "bg-slate-50/60 hover:bg-slate-100/70 border-slate-200/80 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${abaProfissionais === "TODOS" ? "text-slate-300" : "text-slate-500"}`}>
                Total Geral
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${abaProfissionais === "TODOS" ? "bg-white/10 text-white" : "bg-white text-slate-700 shadow-2xs"}`}>
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight">{totalGeral}</span>
              <span className={`text-[11px] font-medium ${abaProfissionais === "TODOS" ? "text-slate-300" : "text-slate-500"}`}>
                colaboradores
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className={abaProfissionais === "TODOS" ? "text-slate-300" : "text-slate-500"}>Base RM completa</span>
              <span className={`font-semibold ${abaProfissionais === "TODOS" ? "text-emerald-400" : "text-emerald-700"}`}>100%</span>
            </div>
          </div>

          {/* Card 2: Titulares em Postos */}
          <div
            onClick={() => setAbaProfissionais("TITULARES")}
            className={`p-4 rounded-xl border transition-all cursor-pointer select-none group relative overflow-hidden ${
              abaProfissionais === "TITULARES"
                ? "bg-emerald-900 text-white border-emerald-900 shadow-md ring-2 ring-emerald-500/20"
                : "bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-200/60 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${abaProfissionais === "TITULARES" ? "text-emerald-200" : "text-emerald-800"}`}>
                Titulares em Postos
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${abaProfissionais === "TITULARES" ? "bg-white/10 text-emerald-200" : "bg-white text-emerald-700 shadow-2xs"}`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight">{totalTitulares}</span>
              <span className={`text-[11px] font-medium ${abaProfissionais === "TITULARES" ? "text-emerald-200" : "text-emerald-700"}`}>
                alocados
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className={abaProfissionais === "TITULARES" ? "text-emerald-200" : "text-slate-500"}>Postos contratuais</span>
              <span className={`font-semibold ${abaProfissionais === "TITULARES" ? "text-emerald-300" : "text-emerald-700"}`}>
                {((totalTitulares / (totalGeral || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Card 3: Equipe de Feristas */}
          <div
            onClick={() => setAbaProfissionais("FERISTAS")}
            className={`p-4 rounded-xl border transition-all cursor-pointer select-none group relative overflow-hidden ${
              abaProfissionais === "FERISTAS"
                ? "bg-indigo-950 text-white border-indigo-900 shadow-md ring-2 ring-indigo-500/20"
                : "bg-indigo-50/40 hover:bg-indigo-50/80 border-indigo-200/60 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${abaProfissionais === "FERISTAS" ? "text-indigo-200" : "text-indigo-800"}`}>
                Equipe de Feristas
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${abaProfissionais === "FERISTAS" ? "bg-white/10 text-indigo-200" : "bg-white text-indigo-700 shadow-2xs"}`}>
                <RefreshCw className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight">{totalFeristas}</span>
              <span className={`text-[11px] font-medium ${abaProfissionais === "FERISTAS" ? "text-indigo-200" : "text-indigo-700"}`}>
                cobertura
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className={abaProfissionais === "FERISTAS" ? "text-indigo-200" : "text-slate-500"}>Férias e folgas</span>
              <span className={`font-semibold ${abaProfissionais === "FERISTAS" ? "text-indigo-300" : "text-indigo-700"}`}>
                {((totalFeristas / (totalGeral || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Card 4: Reserva Técnica */}
          <div
            onClick={() => setAbaProfissionais("RESERVA")}
            className={`p-4 rounded-xl border transition-all cursor-pointer select-none group relative overflow-hidden ${
              abaProfissionais === "RESERVA"
                ? "bg-amber-950 text-white border-amber-900 shadow-md ring-2 ring-amber-500/20"
                : "bg-amber-50/40 hover:bg-amber-50/80 border-amber-200/60 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${abaProfissionais === "RESERVA" ? "text-amber-200" : "text-amber-800"}`}>
                Reserva Técnica
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${abaProfissionais === "RESERVA" ? "bg-white/10 text-amber-200" : "bg-white text-amber-700 shadow-2xs"}`}>
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight">{totalReserva}</span>
              <span className={`text-[11px] font-medium ${abaProfissionais === "RESERVA" ? "text-amber-200" : "text-amber-700"}`}>
                disponíveis
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className={abaProfissionais === "RESERVA" ? "text-amber-200" : "text-slate-500"}>Aptos para alocação</span>
              <span className={`font-semibold ${abaProfissionais === "RESERVA" ? "text-amber-300" : "text-amber-700"}`}>
                {((totalReserva / (totalGeral || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
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

      {/* 3. Barra de Abas e Filtros Avançados */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4 print:hidden">
        {/* Linha 1: Segmented Control + Barra de Busca */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
          {/* Segmented Control */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto">
            <button
              onClick={() => setAbaProfissionais("TODOS")}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                abaProfissionais === "TODOS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <span>Todos</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                {totalGeral}
              </span>
            </button>

            <button
              onClick={() => setAbaProfissionais("TITULARES")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                abaProfissionais === "TITULARES"
                  ? "bg-white text-emerald-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Titulares</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                {totalTitulares}
              </span>
            </button>

            <button
              onClick={() => setAbaProfissionais("FERISTAS")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                abaProfissionais === "FERISTAS"
                  ? "bg-white text-indigo-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
              <span>Feristas</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                {totalFeristas}
              </span>
            </button>

            <button
              onClick={() => setAbaProfissionais("RESERVA")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                abaProfissionais === "RESERVA"
                  ? "bg-white text-amber-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span>Reserva Técnica</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 font-bold">
                {totalReserva}
              </span>
            </button>
          </div>

          {/* Busca Rápida */}
          <div className="flex items-center gap-2 flex-1 lg:max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por colaborador, chapa, CPF, seção ou posto..."
                className="w-full pl-9 pr-9 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#28185A]/20 focus:border-[#28185A] transition-all shadow-2xs"
              />
              {busca && (
                <button
                  onClick={() => setBusca("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {filtrosAtivosCount > 0 && (
              <button
                type="button"
                onClick={limparTodosFiltros}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-all cursor-pointer shrink-0"
                title="Limpar todos os filtros ativos"
              >
                <span>Limpar</span>
                <span className="w-4 h-4 rounded-full bg-rose-200 text-rose-800 text-[10px] flex items-center justify-center font-bold">
                  {filtrosAtivosCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Linha 2: Dropdowns de Filtro em Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* 1. Filtro por Seção */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Seção / Base</label>
            <select
              value={filtroSecao}
              onChange={(e) => setFiltroSecao(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50/60 hover:bg-white rounded-xl px-2.5 py-1.5 text-slate-700 text-xs outline-none focus:border-[#28185A] font-medium cursor-pointer shadow-2xs truncate"
              title="Filtrar por Seção RM"
            >
              <option value="TODAS">Todas as Seções ({secoesDisponiveis.length})</option>
              {secoesDisponiveis.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {formatarSecaoExibicao(s.codigo, s.descricao)}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filtro por Horário */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Horário Oficial</label>
            <select
              value={filtroHorario}
              onChange={(e) => setFiltroHorario(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50/60 hover:bg-white rounded-xl px-2.5 py-1.5 text-slate-700 text-xs outline-none focus:border-[#28185A] font-medium cursor-pointer shadow-2xs truncate"
              title="Filtrar por Horário RM"
            >
              <option value="TODOS">Todos os Horários ({horariosDisponiveis.length})</option>
              {horariosDisponiveis.map((h) => (
                <option key={h.codigo} value={h.codigo}>
                  {formatarHorarioExibicao(h.codigo, h.descricao)}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filtro por Função */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Função Contratual</label>
            <select
              value={filtroFuncao}
              onChange={(e) => setFiltroFuncao(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50/60 hover:bg-white rounded-xl px-2.5 py-1.5 text-slate-700 text-xs outline-none focus:border-[#28185A] font-medium cursor-pointer shadow-2xs truncate"
              title="Filtrar por Função"
            >
              <option value="TODAS">Todas as Funções ({funcoesDisponiveis.length})</option>
              {funcoesDisponiveis.map((f) => (
                <option key={f} value={f}>
                  {formatarFuncao(f)}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Filtro por Situação */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Situação RM</label>
            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50/60 hover:bg-white rounded-xl px-2.5 py-1.5 text-slate-700 text-xs outline-none focus:border-[#28185A] font-medium cursor-pointer shadow-2xs truncate"
              title="Filtrar por Situação"
            >
              <option value="TODAS">Todas as Situações</option>
              {situacoesDisponiveis.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Filtro por Sexo */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Sexo / Gênero</label>
            <select
              value={filtroSexo}
              onChange={(e) => setFiltroSexo(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50/60 hover:bg-white rounded-xl px-2.5 py-1.5 text-slate-700 text-xs outline-none focus:border-[#28185A] font-medium cursor-pointer shadow-2xs"
              title="Filtrar por Sexo"
            >
              <option value="TODOS">Todos os Sexos</option>
              <option value="M">M — Masculino</option>
              <option value="F">F — Feminino</option>
            </select>
          </div>

          {/* 6. Tipo de Escala */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Tipo de Escala</label>
            <select
              value={filtroTipoEscala}
              onChange={(e) => setFiltroTipoEscala(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50/60 hover:bg-white rounded-xl px-2.5 py-1.5 text-slate-700 text-xs outline-none focus:border-[#28185A] font-medium cursor-pointer shadow-2xs"
              title="Tipo de escala apurado do horário"
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
      </div>

      {/* 4. Tabela Executiva Moderna */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 border-b border-slate-200 font-semibold tracking-wider uppercase text-[11px]">
                <th className="px-4 py-3.5">Colaborador / Chapa</th>
                <th className="px-4 py-3.5">Alocação / Posto SGP</th>
                <th className="px-4 py-3.5">Função Contratual</th>
                <th className="px-4 py-3.5">Seção / Base</th>
                <th className="px-4 py-3.5">Horário & Escala</th>
                <th className="px-3 py-3.5">CPF (LGPD)</th>
                <th className="px-2 py-3.5 text-center">Sexo / Idade</th>
                <th className="px-3 py-3.5 text-center">Situação</th>
                {podeVisualizarSalario(perfilEfetivo) && (
                  <th className="px-4 py-3.5 text-right">Salário</th>
                )}
                <th className="px-4 py-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profissionaisFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={podeVisualizarSalario(perfilEfetivo) ? 10 : 9}
                    className="px-6 py-14 text-center"
                  >
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">Nenhum profissional localizado</h4>
                      <p className="text-xs text-slate-500">
                        Não encontramos colaboradores com os filtros e busca informados. Tente ajustar os termos de pesquisa.
                      </p>
                      <button
                        onClick={limparTodosFiltros}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#28185A] hover:underline cursor-pointer"
                      >
                        Limpar todos os filtros
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                profissionaisFiltrados.map((prof) => {
                  const chapaFormatada = prof.chapa || prof.matricula;
                  const temNomeSocial = !!prof.nomeSocial;
                  const nomeExibicao = prof.nomeSocial || prof.nome;
                  const idadeCalc = prof.dataNascimento ? calcularIdadeDinamica(prof.dataNascimento) : null;
                  const cpfFormatadoPerfil = formatarCpfPorPerfil(prof.cpfLimpo, perfilEfetivo);
                  const iniciais = obterIniciais(nomeExibicao);
                  const gradiente = obterGradienteAvatar(chapaFormatada + nomeExibicao);

                  return (
                    <tr
                      key={prof.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* 1. Colaborador / Chapa */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradiente} flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}
                          >
                            {iniciais}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]" title={formatarNome(nomeExibicao)}>
                                {formatarNome(nomeExibicao)}
                              </span>
                              {temNomeSocial && (
                                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1 rounded font-medium">
                                  Nome Social
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/60">
                                {chapaFormatada}
                              </span>
                              <span className="text-[11px] text-slate-400 hidden sm:inline">•</span>
                              <span className="text-[11px] text-slate-500 truncate max-w-[130px]" title={prof.imovelEfetivo}>
                                {prof.imovelEfetivo}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Alocação / Posto SGP */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {prof.tipoAlocacao === "TITULAR" && prof.postoCodigo ? (
                          <div className="inline-flex flex-col gap-0.5 p-1.5 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200/80">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="font-mono font-bold text-emerald-900 text-xs">
                                {prof.postoCodigo}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-700 truncate max-w-[170px]" title={prof.imovelEfetivo}>
                              Titular • {prof.imovelEfetivo}
                            </span>
                          </div>
                        ) : prof.tipoAlocacao === "FERISTA" ? (
                          <div className="inline-flex flex-col gap-0.5 p-1.5 px-2.5 rounded-lg bg-indigo-50 border border-indigo-200/80">
                            <div className="flex items-center gap-1.5">
                              <RefreshCw className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span className="font-bold text-indigo-950 text-xs">
                                Ferista / Cobertura
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-indigo-700 truncate max-w-[170px]">
                              {prof.postoCodigo ? `Posto: ${prof.postoCodigo}` : `Base: ${prof.imovelEfetivo}`}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col gap-0.5 p-1.5 px-2.5 rounded-lg bg-amber-50/70 border border-amber-200/70">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="font-bold text-amber-900 text-xs">
                                Reserva Técnica
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-amber-700">
                              Disponível para alocação
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 3. Função Contratual */}
                      <td className="px-4 py-3 text-slate-800 font-medium text-xs max-w-[190px]">
                        <span className="line-clamp-2" title={formatarFuncao(prof.funcao)}>
                          {formatarFuncao(prof.funcao)}
                        </span>
                      </td>

                      {/* 4. Seção / Base */}
                      <td className="px-4 py-3 text-slate-700 text-xs max-w-[210px]" title={formatarSecaoExibicao(prof.secaoCodigo, prof.secaoDescricao || prof.unidadeNome)}>
                        <span className="line-clamp-2 leading-relaxed">
                          {formatarSecaoExibicao(prof.secaoCodigo, prof.secaoDescricao || prof.unidadeNome)}
                        </span>
                      </td>

                      {/* 5. Horário & Escala */}
                      <td className="px-4 py-3 text-slate-700 text-xs max-w-[230px]" title={formatarHorarioExibicao(prof.horarioCodigo, prof.horarioDescricao)}>
                        <div className="space-y-1">
                          <span className="line-clamp-2 font-medium text-[11px] leading-relaxed">
                            {formatarHorarioExibicao(prof.horarioCodigo, prof.horarioDescricao)}
                          </span>
                          <span className="inline-block text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            Escala: {identificarTipoEscala(prof.horarioDescricao)}
                          </span>
                        </div>
                      </td>

                      {/* 6. CPF (LGPD) */}
                      <td className="px-3 py-3 font-mono text-slate-700 text-[11px] whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{cpfFormatadoPerfil}</span>
                          <button
                            type="button"
                            onClick={() => handleCopiarCpf(cpfFormatadoPerfil, prof.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="Copiar CPF"
                          >
                            {copiadoCpfId === prof.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 7. Sexo / Idade */}
                      <td className="px-2 py-3 text-center whitespace-nowrap">
                        <span className="font-medium text-slate-700 text-xs">
                          {prof.sexo || "—"}
                        </span>
                        <span className="text-slate-400 mx-1">•</span>
                        <span className="font-semibold text-slate-800 text-xs">
                          {idadeCalc !== null ? `${idadeCalc}a` : "—"}
                        </span>
                      </td>

                      {/* 8. Situação */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            prof.situacao === "ATIVO" || prof.situacaoCodigo === "A"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : prof.situacao === "FERIAS" || prof.situacaoCodigo === "F"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : prof.situacao === "AFASTADO" || prof.situacaoCodigo === "P" || prof.situacaoCodigo === "E"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              prof.situacao === "ATIVO" || prof.situacaoCodigo === "A"
                                ? "bg-emerald-500"
                                : prof.situacao === "FERIAS" || prof.situacaoCodigo === "F"
                                ? "bg-blue-500"
                                : prof.situacao === "AFASTADO" || prof.situacaoCodigo === "P" || prof.situacaoCodigo === "E"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            }`}
                          />
                          <span>{prof.situacaoDescricao || formatarSituacao(prof.situacao)}</span>
                        </span>
                      </td>

                      {/* 9. Salário (Admin Only) */}
                      {podeVisualizarSalario(perfilEfetivo) && (
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                          {formatarSalarioPorPerfil(prof.dadosRestritos?.salario, perfilEfetivo)}
                        </td>
                      )}

                      {/* 10. Ações Rápidas */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAbrirFicha(prof)}
                            className="h-7.5 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-indigo-900 text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Ver Dossiê do Colaborador"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>Ficha</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirModalTransferencia(prof)}
                            className="h-7.5 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-indigo-900 text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer group/btn"
                            title="Trocar ou alocar posto"
                          >
                            <RefreshCw className="w-3 h-3 text-slate-400 group-hover/btn:rotate-90 transition-transform duration-300" />
                            <span>Trocar Posto</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé Executivo Dinâmico */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200/90 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              Exibindo {profissionaisFiltrados.length} de {totalGeral} colaboradores
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              {totalTitulares} Titulares, {totalFeristas} Feristas, {totalReserva} Reserva Técnica
            </span>
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Âmbito Contratual: 29 Unidades / 244 Postos Ativos (REV04)
          </div>
        </div>
      </div>

      {/* Modal Ficha do Colaborador (Dossiê Executivo) */}
      {profissionalSelecionado && (() => {
        const idadeCalculada = profissionalSelecionado.dataNascimento
          ? calcularIdade(profissionalSelecionado.dataNascimento)
          : null;
        const faixaEtaria = idadeCalculada !== null ? obterFaixaEtaria(idadeCalculada) : null;
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
              {/* Cabeçalho Hero Executivo */}
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
                              ? "bg-blue-500"
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
                              ? "bg-blue-500/20 text-blue-300"
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
                        <span>Base: {profissionalSelecionado.unidadeNome || profissionalSelecionado.unidadeId || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Abas do Modal */}
              <div className="flex items-center gap-2 px-6 bg-slate-50 border-b border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setAbaFicha("CONTRATO")}
                  className={`inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
                    abaFicha === "CONTRATO"
                      ? "border-[#28185A] text-[#28185A] bg-white shadow-2xs font-bold"
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
                      ? "border-[#28185A] text-[#28185A] bg-white shadow-2xs font-bold"
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
                      ? "border-[#28185A] text-[#28185A] bg-white shadow-2xs font-bold"
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
                          <Briefcase className="w-4 h-4 text-[#28185A]" />
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
                              <span className="text-[11px] text-[#28185A] font-semibold ml-1.5">
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
                                    className="text-[11px] text-[#28185A] hover:underline font-semibold ml-1"
                                    title="Abrir posto no Anexo 1-A"
                                  >
                                    Ver →
                                  </Link>
                                </>
                              ) : (
                                <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Reserva Técnica (Sem posto fixo)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Escala de Trabalho</span>
                            <span className="font-bold text-slate-900">
                              Escala {profissionalSelecionado.escala}
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
                          <Clock className="w-4 h-4 text-[#28185A]" />
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
                          className="h-8.5 px-3.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#28185A] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#28185A]" />
                          <span>Abrir Espelho Completo →</span>
                        </Link>
                      )}
                    </div>

                    {ocorrenciasColab.length === 0 ? (
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between text-xs text-slate-700">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Nenhuma falta injustificada, atraso ou atestado registrado no período.</span>
                        </div>
                        <Link href="/ocorrencias" className="text-[11px] text-[#28185A] hover:underline font-semibold ml-2">
                          Quadro Geral →
                        </Link>
                      </div>
                    ) : (
                      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                            Ocorrências Registradas ({ocorrenciasColab.length})
                          </h5>
                          <Link href="/ocorrencias" className="text-[11px] text-[#28185A] hover:underline font-semibold">
                            Ver Quadro Completo →
                          </Link>
                        </div>
                        <div className="space-y-1.5">
                          {ocorrenciasColab.map((oc) => (
                            <div key={oc.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-900">{oc.tipoOcorrencia.replace(/_/g, " ")}</span>
                              <span className="font-mono text-slate-600">
                                {oc.dataInicio === oc.dataFim ? oc.dataInicio : `${oc.dataInicio} a ${oc.dataFim}`} ({oc.diasAfetados}d)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                    className="h-9 px-4 rounded-xl bg-[#28185A] hover:bg-[#1B1745] text-white text-xs font-semibold shadow-xs inline-flex items-center gap-2 transition-all cursor-pointer"
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
            <div className="p-5 bg-gradient-to-r from-[#1B1745] to-[#28185A] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-[#D8C7A0]" />
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
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 uppercase font-mono text-slate-800 outline-none focus:border-[#28185A]"
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
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-[#28185A]"
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
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-800 outline-none focus:border-[#28185A]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Função Contratual <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Assistente de Logística"
                    value={formFuncao}
                    onChange={(e) => setFormFuncao(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-[#28185A]"
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
                    <option value="">Reserva Técnica (Sem posto fixo)</option>
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
                    <option value="5x2">5x2</option>
                    <option value="12x36">12x36</option>
                    <option value="6x1">6x1</option>
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
                  className="px-5 py-2 rounded-xl bg-[#28185A] hover:bg-[#1B1745] text-white font-semibold shadow-xs transition-colors cursor-pointer"
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
                  <RefreshCw className="w-4 h-4 text-[#D8C7A0]" />
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
                        ★ Reserva Técnica
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
                      className="text-[11px] text-[#28185A] hover:underline font-semibold cursor-pointer"
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
                        className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#28185A]/20 focus:border-[#28185A] outline-none shadow-2xs"
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
                          <span className="font-semibold text-amber-900">Mover titular atual para Reserva Técnica</span>
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
                                <span className="font-bold text-slate-900 group-hover:text-[#28185A] text-xs truncate">
                                  {formatarNome(cand.nome)}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {cand.chapa || cand.matricula}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {formatarFuncao(cand.funcao)} • Base {cand.imovelEfetivo || cand.unidadeId}
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
                                  Reserva Técnica
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
                            ★ Reserva Técnica
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
                          : `${formatarNome(colaboradorParaTransferir.nome)} será movido para a Reserva Técnica.`}
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
                      <span>Desocupar Posto — Mover para Reserva Técnica</span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      O colaborador <strong>{formatarNome(colaboradorParaTransferir.nome)}</strong> será desvinculado do <strong>Posto {colaboradorParaTransferir.postoCodigo}</strong> e movido para a <strong>Reserva Técnica</strong>. O posto ficará oficialmente <strong>VAGO</strong> no Anexo 1-A e no Mapa de Ocupação.
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
                      ? "bg-[#28185A] hover:bg-[#1B1745] text-white active:scale-[0.98]"
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
