"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Lock,
  Eye,
  EyeOff,
  Phone,
  X,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  FileText,
  Briefcase,
  BarChart3,
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
  CreditCard,
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
  formatarDescricaoHorarioParaTela,
} from "@/lib/dados/rm-tipos";
import {
  obterTodasSecoesRm,
  obterTodosHorariosRm,
  obterTodasSituacoesRm,
  obterTodasFuncoesRm,
} from "@/lib/importadores/processador-rm-totvs";

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

function formatarCpf(cpfLimpo?: string, cpfMascarado?: string, mascarar: boolean = false): string {
  const limpo = (cpfLimpo || "").replace(/\D/g, "");
  if (mascarar) {
    if (cpfMascarado) return cpfMascarado;
    if (limpo.length === 11) {
      return `***.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-**`;
    }
    return "—";
  }
  if (limpo.length === 11) {
    return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9, 11)}`;
  }
  if (cpfMascarado) return cpfMascarado;
  return "—";
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

export default function ProfissionaisPage() {
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [marcacoesPonto, setMarcacoesPonto] = useState<MarcacaoPontoOriginal[]>([]);
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [busca, setBusca] = useState("");
  const [abaProfissionais, setAbaProfissionais] = useState<"TODOS" | "COM_POSTO" | "SEM_POSTO">("TODOS");
  // Filtros oficiais com os cadastros importados do RM
  const [filtroSecao, setFiltroSecao] = useState("TODAS");
  const [filtroHorario, setFiltroHorario] = useState("TODOS");
  const [filtroFuncao, setFiltroFuncao] = useState("TODAS");
  const [filtroSituacao, setFiltroSituacao] = useState("TODAS");
  const [filtroSexo, setFiltroSexo] = useState("TODOS");
  const [filtroTipoEscala, setFiltroTipoEscala] = useState("TODAS");
  const [filtroPosto, setFiltroPosto] = useState("TODOS");
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
  const [copiadoMatricula, setCopiadoMatricula] = useState(false);
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

  // Lista dinâmica de candidatos para substituição com busca aberta por nome, matrícula, função ou posto
  const candidatosSubstitutos = useMemo(() => {
    if (!colaboradorParaTransferir) return [];
    const q = buscaSubstituto.trim().toLowerCase();
    const qNum = q.replace(/\D/g, "");

    const filtrados = profissionais.filter((pr) => {
      if (pr.matricula === colaboradorParaTransferir.matricula) return false;
      if (!q) return true;
      const matchNome = pr.nome.toLowerCase().includes(q) || (pr.nomeSocial && pr.nomeSocial.toLowerCase().includes(q));
      const matchMatricula = pr.matricula.toLowerCase().includes(q) || (pr.chapa && pr.chapa.toLowerCase().includes(q));
      const matchFuncao = pr.funcao.toLowerCase().includes(q);
      const matchPosto = pr.postoCodigo ? pr.postoCodigo.toLowerCase().includes(q) : false;
      const matchCpf = qNum.length >= 3 ? pr.cpfLimpo.includes(qNum) : false;
      return matchNome || matchMatricula || matchFuncao || matchPosto || matchCpf;
    });

    // Ordenação: 1º Mesma função, 2º Reserva Técnica, 3º Ativos
    return filtrados
      .sort((a, b) => {
        const aFuncao = a.funcao.toLowerCase() === colaboradorParaTransferir.funcao.toLowerCase() ? 1 : 0;
        const bFuncao = b.funcao.toLowerCase() === colaboradorParaTransferir.funcao.toLowerCase() ? 1 : 0;
        if (aFuncao !== bFuncao) return bFuncao - aFuncao;

        const aReserva = !a.postoCodigo ? 1 : 0;
        const bReserva = !b.postoCodigo ? 1 : 0;
        if (aReserva !== bReserva) return bReserva - aReserva;

        const aAtivo = a.situacao === "ATIVO" ? 1 : 0;
        const bAtivo = b.situacao === "ATIVO" ? 1 : 0;
        return bAtivo - aAtivo;
      })
      .slice(0, 10);
  }, [profissionais, colaboradorParaTransferir, buscaSubstituto]);

  // Apuração de interjornada na transferência de posto do colaborador
  const alertaInterjornadaTransferencia = useMemo(() => {
    if (!colaboradorParaTransferir) return null;
    if (moverParaReserva) return null;

    const postoAlvo = substitutoSelecionado && colaboradorParaTransferir.postoCodigo
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
  }, [colaboradorParaTransferir, destinoPostoCodigo, substitutoSelecionado, moverParaReserva, postos, profissionais, marcacoesPonto]);

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
      // Mover o titular atual para a Reserva Técnica (desocupar o posto)
      res = transferirColaboradorPosto(colaboradorParaTransferir.matricula, undefined);
    } else if (substitutoSelecionado) {
      if (modoPermuta && colaboradorParaTransferir.postoCodigo && substitutoSelecionado.postoCodigo) {
        // Permuta mútua entre dois titulares
        res = permutarTitularesPostos(colaboradorParaTransferir.matricula, substitutoSelecionado.matricula);
      } else if (colaboradorParaTransferir.postoCodigo) {
        // Substituição no posto do titular atual
        res = trocarTitularPosto(colaboradorParaTransferir.postoCodigo, substitutoSelecionado.matricula);
      } else if (substitutoSelecionado.postoCodigo) {
        // Colaborador atual que estava na reserva assume o posto do substituto
        res = trocarTitularPosto(substitutoSelecionado.postoCodigo, colaboradorParaTransferir.matricula);
      } else {
        res = { sucesso: false, mensagem: "Ambos os colaboradores estão na Reserva Técnica. Nenhum posto para alocação." };
      }
    } else if (destinoPostoCodigo) {
      // Transferência direta
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
      if (
        profissionalSelecionado &&
        (profissionalSelecionado.matricula === colaboradorParaTransferir.matricula ||
          (substitutoSelecionado && profissionalSelecionado.matricula === substitutoSelecionado.matricula))
      ) {
        setProfissionalSelecionado(null);
      }
      setTimeout(() => setMensagemSucesso(""), 4000);
    } else {
      alert(res.mensagem);
    }
  };

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
        // Sem sessão: perfil permanece null → visão restrita (LGPD fail-closed)
      }
    };
    carregarSessao();

    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // Perfil exclusivamente da sessão real. Sem sessão (carregando/falha) = null = visão restrita.
  const perfilEfetivo: string | null = sessao?.perfil ?? null;
  const ehAdmin = perfilEfetivo === "PREMIER_ADMIN";
  const ehGestor = perfilEfetivo === "PREMIER_GESTOR" || perfilEfetivo === "PREMIER_GESTOR_CONTRATO";
  const ehPerfilPetrobras = !podeVerDadosPessoaisCompletos(perfilEfetivo);

  const basesPermitidas = sessao?.basesVinculadas || ["TODAS"];
  const podeAcessarBase = (unidadeId: string) => {
    if (basesPermitidas.includes("TODAS")) return true;
    return basesPermitidas.includes(unidadeId);
  };

  // Listas de opções derivadas dos cadastros oficiais importados do RM
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
          `Usuário ${sessao.nome} (${sessao.perfil}) visualizou cadastro individual de ${prof.nomeSocial || prof.nome} (Chapa: ${prof.chapa || prof.matricula})`,
          null,
          `Base: ${prof.unidadeId}`
        );
      } catch {
        // fallback
      }
    }
  };

  const handleCopiarMatricula = (matricula: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(matricula);
      setCopiadoMatricula(true);
      setTimeout(() => setCopiadoMatricula(false), 2000);
    }
  };

  const profissionaisFiltrados = useMemo(() => {
    return profissionais.filter((pr) => {
      const matchTexto =
        !busca.trim() ||
        pr.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (pr.nomeSocial && pr.nomeSocial.toLowerCase().includes(busca.toLowerCase())) ||
        (pr.chapa && pr.chapa.toLowerCase().includes(busca.toLowerCase())) ||
        pr.matricula.toLowerCase().includes(busca.toLowerCase()) ||
        pr.funcao.toLowerCase().includes(busca.toLowerCase()) ||
        (pr.secaoCodigo && pr.secaoCodigo.toLowerCase().includes(busca.toLowerCase())) ||
        (pr.secaoDescricao && pr.secaoDescricao.toLowerCase().includes(busca.toLowerCase())) ||
        (pr.horarioCodigo && pr.horarioCodigo.toLowerCase().includes(busca.toLowerCase())) ||
        (pr.horarioDescricao && pr.horarioDescricao.toLowerCase().includes(busca.toLowerCase())) ||
        (pr.postoCodigo && pr.postoCodigo.toLowerCase().includes(busca.toLowerCase())) ||
        pr.cpfLimpo.includes(busca.replace(/\D/g, ""));

      const matchAba =
        abaProfissionais === "TODOS"
          ? true
          : abaProfissionais === "COM_POSTO"
          ? !!pr.postoCodigo
          : !pr.postoCodigo;

      // Filtro por Seção usando cadastros importados
      const matchSecao = filtroSecao === "TODAS" || pr.secaoCodigo === filtroSecao;

      // Filtro por Horário usando cadastros importados
      const matchHorario = filtroHorario === "TODOS" || pr.horarioCodigo === filtroHorario;

      // Filtro por Função usando cadastros importados
      const matchFuncao = filtroFuncao === "TODAS" || pr.funcao.toUpperCase() === filtroFuncao.toUpperCase();

      // Filtro por Situação usando situações do RM
      const matchSituacao =
        filtroSituacao === "TODAS" ||
        pr.situacaoCodigo === filtroSituacao ||
        pr.situacao === filtroSituacao;

      // Filtro por Sexo
      const matchSexo = filtroSexo === "TODOS" || pr.sexo === filtroSexo;

      // Campo auxiliar SOMENTE PARA FILTRO: "Tipo de escala", identificado a partir do texto do horário
      const tipoEscalaCalc = identificarTipoEscala(pr.horarioDescricao);
      const matchTipoEscala = filtroTipoEscala === "TODAS" || tipoEscalaCalc === filtroTipoEscala;

      const matchPosto =
        filtroPosto === "TODOS"
          ? true
          : filtroPosto === "COM_POSTO"
          ? !!pr.postoCodigo
          : filtroPosto === "SEM_POSTO"
          ? !pr.postoCodigo
          : pr.postoCodigo === filtroPosto;

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
        matchPosto &&
        matchBase
      );
    });
  }, [
    profissionais,
    busca,
    abaProfissionais,
    filtroSecao,
    filtroHorario,
    filtroFuncao,
    filtroSituacao,
    filtroSexo,
    filtroTipoEscala,
    filtroPosto,
    basesPermitidas,
  ]);

  const totalColaboradores = profissionais.length;
  const ativos = profissionais.filter((p) => p.situacao === "ATIVO").length;
  const titulares = profissionais.filter((p) => p.postoCodigo).length;
  const reservaTecnica = profissionais.filter((p) => !p.postoCodigo).length;

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
      unidadeId: "UFN-III",
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
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. Visão Geral da Tabela de Profissionais (Oculta na Impressão Oficial do Dossiê) */}
      <div className="space-y-4 print:hidden no-print">
        {/* 1. Cabeçalho Compacto e Direto */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Quadro de Profissionais
            </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastro oficial de colaboradores, vínculo a postos e controle de reserva técnica
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <span>Ver no Mapa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Novo Profissional</span>
          </button>
        </div>
      </div>

      {/* Alerta de Sucesso */}
      {mensagemSucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso("")} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Barra de Segmentos e Filtros Rápidos (Padrão Executivo SGP) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-[#E3E6EB] shadow-2xs">
        {/* Segmented Control / Abas Operacionais */}
        <div className="flex items-center gap-1 bg-[#F4F5F8] p-1 rounded-lg border border-[#E3E6EB]">
          <button
            onClick={() => setAbaProfissionais("TODOS")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
              abaProfissionais === "TODOS"
                ? "bg-white text-[#1A2230] shadow-2xs font-semibold"
                : "text-[#5B6474] hover:text-[#1A2230] hover:bg-white/50"
            }`}
          >
            <span>Todos</span>
            <span
              className={`ml-1.5 text-xs font-mono ${
                abaProfissionais === "TODOS" ? "text-[#1A2230] font-bold" : "text-[#858D9D]"
              }`}
            >
              ({totalColaboradores})
            </span>
          </button>

          <button
            onClick={() => setAbaProfissionais("COM_POSTO")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
              abaProfissionais === "COM_POSTO"
                ? "bg-white text-[#1A2230] shadow-2xs font-semibold"
                : "text-[#5B6474] hover:text-[#1A2230] hover:bg-white/50"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
            <span>Com Posto</span>
            <span
              className={`ml-1 text-xs font-mono ${
                abaProfissionais === "COM_POSTO" ? "text-emerald-700 font-bold" : "text-[#858D9D]"
              }`}
            >
              ({titulares})
            </span>
          </button>

          <button
            onClick={() => setAbaProfissionais("SEM_POSTO")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
              abaProfissionais === "SEM_POSTO"
                ? "bg-white text-[#1A2230] shadow-2xs font-semibold"
                : "text-[#5B6474] hover:text-[#1A2230] hover:bg-white/50"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
            <span>Reserva Técnica</span>
            <span
              className={`ml-1 text-xs font-mono ${
                abaProfissionais === "SEM_POSTO" ? "text-amber-700 font-bold" : "text-[#858D9D]"
              }`}
            >
              ({reservaTecnica})
            </span>
          </button>
        </div>

        {/* Busca e Barra de Filtros Importados do RM */}
        <div className="flex flex-col gap-2.5 w-full">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 border border-[#D0D5DD] rounded-lg px-2.5 py-1.5 bg-white focus-within:border-[#1F4FD1] text-xs flex-1 shadow-2xs">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por colaborador, chapa, CPF, seção ou horário..."
                className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-400 text-xs"
              />
              {busca && (
                <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {(filtroSecao !== "TODAS" ||
              filtroHorario !== "TODOS" ||
              filtroFuncao !== "TODAS" ||
              filtroSituacao !== "TODAS" ||
              filtroSexo !== "TODOS" ||
              filtroTipoEscala !== "TODAS" ||
              filtroPosto !== "TODOS" ||
              busca) && (
              <button
                type="button"
                onClick={() => {
                  setFiltroSecao("TODAS");
                  setFiltroHorario("TODOS");
                  setFiltroFuncao("TODAS");
                  setFiltroSituacao("TODAS");
                  setFiltroSexo("TODOS");
                  setFiltroTipoEscala("TODAS");
                  setFiltroPosto("TODOS");
                  setBusca("");
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer shrink-0"
              >
                Limpar Filtros
              </button>
            )}
          </div>

          {/* Linha de Dropdowns de Filtro usando Cadastros Importados */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            {/* 1. Filtro por Seção */}
            <select
              value={filtroSecao}
              onChange={(e) => setFiltroSecao(e.target.value)}
              className="border border-[#D0D5DD] rounded-lg px-2 py-1.5 bg-white text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer shadow-2xs truncate"
              title="Filtrar por Seção importada"
            >
              <option value="TODAS">Todas as Seções ({secoesDisponiveis.length})</option>
              {secoesDisponiveis.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {formatarSecaoExibicao(s.codigo, s.descricao)}
                </option>
              ))}
            </select>

            {/* 2. Filtro por Horário */}
            <select
              value={filtroHorario}
              onChange={(e) => setFiltroHorario(e.target.value)}
              className="border border-[#D0D5DD] rounded-lg px-2 py-1.5 bg-white text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer shadow-2xs truncate"
              title="Filtrar por Horário importado"
            >
              <option value="TODOS">Todos os Horários ({horariosDisponiveis.length})</option>
              {horariosDisponiveis.map((h) => (
                <option key={h.codigo} value={h.codigo}>
                  {formatarHorarioExibicao(h.codigo, h.descricao)}
                </option>
              ))}
            </select>

            {/* 3. Filtro por Função */}
            <select
              value={filtroFuncao}
              onChange={(e) => setFiltroFuncao(e.target.value)}
              className="border border-[#D0D5DD] rounded-lg px-2 py-1.5 bg-white text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer shadow-2xs truncate"
              title="Filtrar por Função"
            >
              <option value="TODAS">Todas as Funções ({funcoesDisponiveis.length})</option>
              {funcoesDisponiveis.map((f) => (
                <option key={f} value={f}>
                  {formatarFuncao(f)}
                </option>
              ))}
            </select>

            {/* 4. Filtro por Situação */}
            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
              className="border border-[#D0D5DD] rounded-lg px-2 py-1.5 bg-white text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer shadow-2xs truncate"
              title="Filtrar por Situação"
            >
              <option value="TODAS">Todas as Situações</option>
              {situacoesDisponiveis.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* 5. Filtro por Sexo */}
            <select
              value={filtroSexo}
              onChange={(e) => setFiltroSexo(e.target.value)}
              className="border border-[#D0D5DD] rounded-lg px-2 py-1.5 bg-white text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer shadow-2xs"
              title="Filtrar por Sexo"
            >
              <option value="TODOS">Todos os Sexos</option>
              <option value="M">M - Masculino</option>
              <option value="F">F - Feminino</option>
            </select>

            {/* 6. Campo auxiliar SOMENTE PARA FILTRO: Tipo de escala */}
            <select
              value={filtroTipoEscala}
              onChange={(e) => setFiltroTipoEscala(e.target.value)}
              className="border border-[#D0D5DD] rounded-lg px-2 py-1.5 bg-white text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer shadow-2xs"
              title="Tipo de escala (campo auxiliar apenas para filtro)"
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

      {/* 3. Tabela com Horário e Seção "código – descrição" e Regras LGPD por Perfil */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
              <tr>
                <th className="px-3 py-2.5">Chapa</th>
                <th className="px-3 py-2.5">Colaborador</th>
                <th className="px-3 py-2.5">CPF</th>
                <th className="px-3 py-2.5">Função</th>
                <th className="px-3 py-2.5">Seção</th>
                <th className="px-3 py-2.5">Horário</th>
                <th className="px-2 py-2.5 text-center">Sexo</th>
                <th className="px-2 py-2.5 text-center">Idade</th>
                <th className="px-3 py-2.5 text-center">Data Nasc.</th>
                <th className="px-3 py-2.5 text-center">Situação</th>
                {podeVisualizarSalario(perfilEfetivo) && (
                  <th className="px-3 py-2.5 text-right">Salário</th>
                )}
                <th className="px-3 py-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profissionaisFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={podeVisualizarSalario(perfilEfetivo) ? 12 : 11}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Nenhum colaborador encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                profissionaisFiltrados.map((prof) => {
                  const chapaFormatada = prof.chapa || prof.matricula;
                  const temNomeSocial = !!prof.nomeSocial;
                  const nomeExibicao = prof.nomeSocial || prof.nome;
                  const idadeCalc = prof.dataNascimento
                    ? calcularIdadeDinamica(prof.dataNascimento)
                    : null;

                  return (
                    <tr key={prof.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-slate-800 text-[11px] font-semibold">
                        {chapaFormatada}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900 text-xs">
                            {formatarNome(nomeExibicao)}
                          </span>
                          {temNomeSocial && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1 rounded font-medium">
                              Nome Social
                            </span>
                          )}
                        </div>
                        {prof.postoCodigo && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            Posto: <span className="font-medium text-slate-700">{prof.postoCodigo}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 text-[11px] whitespace-nowrap">
                        {formatarCpfPorPerfil(prof.cpfLimpo, perfilEfetivo)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-800 font-medium text-xs">
                        {formatarFuncao(prof.funcao)}
                      </td>
                      {/* Seção no padrão "código – descrição" */}
                      <td className="px-3 py-2.5 text-slate-700 text-xs max-w-[220px]" title={formatarSecaoExibicao(prof.secaoCodigo, prof.secaoDescricao || prof.unidadeNome)}>
                        <span className="line-clamp-2">
                          {formatarSecaoExibicao(prof.secaoCodigo, prof.secaoDescricao || prof.unidadeNome)}
                        </span>
                      </td>
                      {/* Horário no padrão "código – descrição" */}
                      <td className="px-3 py-2.5 text-slate-700 text-xs max-w-[240px]" title={formatarHorarioExibicao(prof.horarioCodigo, prof.horarioDescricao)}>
                        <span className="line-clamp-2">
                          {formatarHorarioExibicao(prof.horarioCodigo, prof.horarioDescricao)}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center text-slate-700 text-xs font-medium">
                        {prof.sexo || "—"}
                      </td>
                      <td className="px-2 py-2.5 text-center text-slate-700 text-xs font-medium">
                        {idadeCalc !== null ? `${idadeCalc}a` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-600 text-[11px] whitespace-nowrap">
                        {formatarDataNascimentoPorPerfil(prof.dataNascimento, perfilEfetivo)}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            prof.situacao === "ATIVO" || prof.situacaoCodigo === "A"
                              ? "text-emerald-700"
                              : prof.situacao === "FERIAS" || prof.situacaoCodigo === "F"
                              ? "text-blue-700"
                              : prof.situacao === "AFASTADO" || prof.situacaoCodigo === "P" || prof.situacaoCodigo === "E"
                              ? "text-amber-700"
                              : "text-slate-500"
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
                          {prof.situacaoDescricao || formatarSituacao(prof.situacao)}
                        </span>
                      </td>
                      {podeVisualizarSalario(perfilEfetivo) && (
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 text-[11px] whitespace-nowrap">
                          {formatarSalarioPorPerfil(prof.dadosRestritos?.salario, perfilEfetivo)}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAbrirFicha(prof)}
                            className="h-7 px-2.5 rounded-md border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] hover:border-[#1F4FD1] text-[#344054] hover:text-[#1F4FD1] text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Ver ficha do colaborador"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1F4FD1]" />
                            <span>Ficha</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirModalTransferencia(prof)}
                            className="h-7 px-2.5 rounded-md border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] hover:border-[#1F4FD1] text-[#344054] hover:text-[#1F4FD1] text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer group"
                            title="Trocar posto do colaborador"
                          >
                            <RefreshCw className="w-3 h-3 text-slate-400 group-hover:text-[#1F4FD1] group-hover:rotate-45 transition-transform" />
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

        {/* Rodapé Compacto */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-between">
          <span>{profissionaisFiltrados.length} colaboradores exibidos</span>
          <span>Unidade: UFN III — Três Lagoas/MS</span>
        </div>
      </div>
    </div>

      {/* Modal Ficha do Colaborador (Modernizada, Analítica e Despoluída) */}
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
        const iniciais = nomePrincipal
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0].toUpperCase())
          .join("");

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
            {/* Backdrop com fechamento ao clicar */}
            <div
              className="fixed inset-0 cursor-pointer ficha-rh-backdrop print:hidden"
              onClick={() => setProfissionalSelecionado(null)}
              aria-hidden="true"
            />

            {/* Modal Central Amplo de RH (Estilo Workday / Deel / Senior HCM) - Apenas Visualização em Tela */}
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-scaleIn ficha-rh-drawer print:hidden">
              {/* 1. Cabeçalho Hero Executivo de RH (Topo do Modal) */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-6 relative shrink-0">
                {/* Barra Superior com Título de Governança e Botão Fechar */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10 print:hidden">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                      <span>Ficha do Colaborador</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfissionalSelecionado(null)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                    title="Fechar (Esc)"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Linha do Perfil com Avatar e Informações Centrais */}
                <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar com Anel de Status Pulsante */}
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white/10 border-2 border-white/20 backdrop-blur-md flex items-center justify-center text-xl sm:text-2xl font-bold text-white shadow-lg print:border print:text-black print:bg-white">
                        {iniciais}
                      </div>
                      {/* Status Dot Pulsante */}
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 print:hidden">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            profissionalSelecionado.situacao === "ATIVO"
                              ? "bg-emerald-400"
                              : profissionalSelecionado.situacao === "FERIAS"
                              ? "bg-blue-400"
                              : profissionalSelecionado.situacao === "AFASTADO"
                              ? "bg-amber-400"
                              : "bg-slate-400"
                          }`}
                        />
                        <span
                          className={`relative inline-flex rounded-full h-4 w-4 border-2 border-slate-900 ${
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

                    {/* Nome, Cargo e Identificação */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight print:text-black">
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

                      <p className="text-sm font-semibold text-blue-300 mt-0.5 print:text-slate-800">
                        {formatarFuncao(profissionalSelecionado.funcao)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Barra de Abas Corporativas de RH */}
              <div className="flex items-center gap-2 px-6 bg-slate-50 border-b border-slate-200 shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => setAbaFicha("CONTRATO")}
                  className={`inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
                    abaFicha === "CONTRATO"
                      ? "border-[#1F4FD1] text-[#1F4FD1] bg-white shadow-2xs font-bold"
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
                      ? "border-[#1F4FD1] text-[#1F4FD1] bg-white shadow-2xs font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Ponto & Frequência</span>
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
                      ? "border-[#1F4FD1] text-[#1F4FD1] bg-white shadow-2xs font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Documentos & DP</span>
                </button>
              </div>

              {/* 3. Conteúdo da Ficha por Abas (Espaçoso, Funcional e Organizado) */}
              <div className="flex-1 overflow-y-auto p-6 bg-[#FAFAFC] print:bg-white print:overflow-visible print:p-4">
                
                {/* ABA 1: CONTRATO & LOTAÇÃO (Objetivo e Limpo) */}
                {(abaFicha === "CONTRATO" || typeof window === "undefined") && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Card 1: Vínculo Contratual */}
                      <div className="p-4 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <Briefcase className="w-4 h-4 text-[#1F4FD1]" />
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
                              <span className="text-[11px] text-[#1F4FD1] font-semibold ml-1.5">
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

                      {/* Card 2: Lotação & Escala Operacional */}
                      <div className="p-4 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                          <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                            Lotação & Escala
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
                                    className="text-[11px] text-[#1F4FD1] hover:underline font-semibold ml-1 print:hidden"
                                    title="Abrir posto no Anexo 1-A"
                                  >
                                    Ver →
                                  </Link>
                                </>
                              ) : (
                                <span className="font-semibold text-slate-800">
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
                            {profissionalSelecionado.situacao === "DESLIGADO" ? (
                              <span className="inline-flex items-center gap-1.5 text-slate-600 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                Contrato Rescindido
                              </span>
                            ) : profissionalSelecionado.situacao === "FERIAS" ? (
                              <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                Em Férias Regulamentares
                              </span>
                            ) : profissionalSelecionado.situacao === "AFASTADO" ? (
                              <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Afastado Temporariamente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                Regular no Contrato
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA 2: PONTO & FREQUÊNCIA (Objetivo e Limpo) */}
                {abaFicha === "PONTO" && (
                  <div className="space-y-4 animate-fadeIn">
                    {/* Linha de Indicadores Rápidos (Executive Stats Strip) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs">
                        <span className="text-[11px] font-medium text-slate-400 block">Situação da Folha</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="font-bold text-xs text-slate-800">
                            {profissionalSelecionado.situacao === "DESLIGADO" ? "Rescindido" : "Folha Regular"}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs">
                        <span className="text-[11px] font-medium text-slate-400 block">Aproveitamento</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`font-bold text-xs ${ocorrenciasColab.length === 0 ? "text-emerald-700" : "text-amber-800"}`}>
                            {ocorrenciasColab.length === 0 ? "100% Presença" : `${diasAfetadosTotal}d ausência`}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs">
                        <span className="text-[11px] font-medium text-slate-400 block">Ocorrências no Mês</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-bold text-xs text-slate-800">
                            {ocorrenciasColab.length} {ocorrenciasColab.length === 1 ? "registro" : "registros"}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs">
                        <span className="text-[11px] font-medium text-slate-400 block">Marcações no Lote</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-bold text-xs text-slate-800">
                            {marcacoesColab.length > 0 ? `${marcacoesColab.length} batidas` : "Sincronizado"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card de Espelho de Ponto Oficial */}
                    <div className="p-4 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#1F4FD1]" />
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
                          className="h-8.5 px-3.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1F4FD1] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto shrink-0 print:hidden"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#1F4FD1]" />
                          <span>Abrir Espelho Completo →</span>
                        </Link>
                      )}
                    </div>

                    {/* Resumo de Ocorrências */}
                    {ocorrenciasColab.length === 0 ? (
                      <div className="p-3.5 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs flex items-center justify-between text-xs text-slate-700">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Nenhuma falta injustificada, atraso ou atestado médico registrado no período.</span>
                        </div>
                        <Link
                          href="/ocorrencias"
                          className="text-[11px] text-[#1F4FD1] hover:underline font-semibold shrink-0 print:hidden ml-2"
                        >
                          Quadro Geral →
                        </Link>
                      </div>
                    ) : (
                      <div className="p-4 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                            Ocorrências Registradas ({ocorrenciasColab.length})
                          </h5>
                          <Link
                            href="/ocorrencias"
                            className="text-[11px] text-[#1F4FD1] hover:underline font-semibold print:hidden"
                          >
                            Ver Quadro Completo →
                          </Link>
                        </div>
                        <div className="space-y-1.5">
                          {ocorrenciasColab.map((oc) => (
                            <div
                              key={oc.id}
                              className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                            >
                              <span className="font-semibold text-slate-900">
                                {oc.tipoOcorrencia.replace(/_/g, " ")}
                              </span>
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

                {/* ABA 3: DOCUMENTOS & DP (Objetivo e Limpo) */}
                {abaFicha === "DOCUMENTOS" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Card Documentos Gerais */}
                      <div className="p-4 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs space-y-3">
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
                                <span className="text-slate-500 ml-1.5 font-normal">
                                  ({idadeCalculada} anos)
                                </span>
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
                                : profissionalSelecionado.sexo || "Não informado"}
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

                      {/* Card Dados Salariais & Domicílio (Conforme LGPD por Perfil) */}
                      <div className="p-4 bg-white rounded-xl border border-[#E3E6EB] shadow-2xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-amber-600" />
                            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                              Departamento Pessoal & Salário (LGPD)
                            </h4>
                          </div>
                          {podeVisualizarSalario(perfilEfetivo) && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                              Acesso Autorizado (Admin)
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

              {/* 4. Rodapé Fixo Executivo do Modal */}
              <div className="p-4 px-6 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 print:hidden">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleImprimirFicha}
                    className="h-9 px-4 rounded-lg bg-[#1F4FD1] hover:bg-[#183FB3] active:scale-[0.98] text-white text-xs font-semibold shadow-xs hover:shadow inline-flex items-center gap-2 transition-all cursor-pointer group"
                    title="Imprimir ou exportar ficha funcional em PDF"
                  >
                    <Printer className="w-4 h-4 text-white group-hover:scale-110 transition-transform shrink-0" />
                    <span>Imprimir / Exportar Ficha (PDF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirModalTransferencia(profissionalSelecionado)}
                    className="h-9 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 hover:text-slate-950 text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer group"
                    title="Movimentar ou transferir de posto operacional"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#1F4FD1] group-hover:rotate-180 transition-all duration-500 shrink-0" />
                    <span>Movimentar / Trocar Posto</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setProfissionalSelecionado(null)}
                  className="h-9 px-4 rounded-lg bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-medium text-xs transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* ======================================================== */}
            {/* DOCUMENTO OFICIAL EXCLUSIVO PARA IMPRESSÃO / EXPORTAÇÃO EM PDF */}
            {/* ======================================================== */}
            <div className="hidden print:block w-full max-w-4xl mx-auto bg-white text-slate-900 font-sans p-6 sm:p-8 space-y-5 ficha-impressao-oficial">
              {/* 1. Timbre Oficial de Cabeçalho */}
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

              {/* 2. Título do Documento */}
              <div className="text-center py-2 bg-slate-100 rounded border border-slate-300">
                <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Ficha Funcional do Colaborador • Dossiê Oficial de Recursos Humanos
                </h1>
              </div>

              {/* 3. Identificação Cadastral Principal */}
              <div className="border border-slate-300 rounded p-4 space-y-3 avoid-break">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>1. Identificação do Colaborador</span>
                  <span className="font-mono text-slate-600 font-normal">Matrícula: {chapaCodigo}</span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 block font-medium">Nome Completo:</span>
                    <span className="font-bold text-slate-900 text-sm">{formatarNome(nomePrincipal)}</span>
                    {temNomeSocial && (
                      <span className="text-[11px] text-purple-700 block">(Nome Social Registrado)</span>
                    )}
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
                  <div>
                    <span className="text-slate-500 block font-medium">Data de Nascimento / Idade:</span>
                    <span className="font-semibold text-slate-800">
                      {profissionalSelecionado.dataNascimento
                        ? new Date(profissionalSelecionado.dataNascimento + "T00:00:00").toLocaleDateString("pt-BR")
                        : "—"}
                      {idadeCalculada !== null && ` (${idadeCalculada} anos)`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Sexo / Gênero:</span>
                    <span className="font-semibold text-slate-800">
                      {profissionalSelecionado.sexo === "M" ? "Masculino" : profissionalSelecionado.sexo === "F" ? "Feminino" : "Não informado"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Telefone Corporativo:</span>
                    <span className="font-semibold text-slate-800">
                      {profissionalSelecionado.telefoneCorporativo || "Não cadastrado"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Telefone Pessoal:</span>
                    <span className="font-semibold text-slate-800">
                      {profissionalSelecionado.dadosRestritos?.telefonePessoal || "Sob sigilo LGPD"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Vínculo Trabalhista & Lotação Operacional */}
              <div className="border border-slate-300 rounded p-4 space-y-3 avoid-break">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1.5">
                  2. Vínculo Trabalhista & Lotação Operacional
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 block font-medium">Regime Jurídico:</span>
                    <span className="font-semibold text-slate-800">CLT (Prazo Indeterminado)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Base de Lotação:</span>
                    <span className="font-bold text-slate-900">{formatarTexto(profissionalSelecionado.unidadeId)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Data de Admissão:</span>
                    <span className="font-semibold text-slate-900">
                      {profissionalSelecionado.dataAdmissao ? profissionalSelecionado.dataAdmissao.split("-").reverse().join("/") : "—"}
                      {" "}({calcularTempoCasa(profissionalSelecionado.dataAdmissao)})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Posto Anexo 1-A:</span>
                    <span className="font-bold text-slate-900">
                      {profissionalSelecionado.postoCodigo
                        ? `Posto ${profissionalSelecionado.postoCodigo}${postoVinculado ? ` — ${formatarFuncao(postoVinculado.funcao)}` : ""}`
                        : "Reserva Técnica (Sem posto fixo)"}
                    </span>
                  </div>
                  {profissionalSelecionado.dataDesligamento && (
                    <div>
                      <span className="text-slate-500 block font-medium">Data de Desligamento:</span>
                      <span className="font-bold text-rose-700">
                        {profissionalSelecionado.dataDesligamento.split("-").reverse().join("/")} (Rescisão)
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block font-medium">Escala / Turno de Trabalho:</span>
                    <span className="font-semibold text-slate-800">
                      Escala {profissionalSelecionado.escala} — {formatarHorario(profissionalSelecionado.horarioDescricao)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Carga Horária Semanal:</span>
                    <span className="font-semibold text-slate-800">44 horas CLT</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Contrato Petrobras:</span>
                    <span className="font-mono text-slate-800 font-semibold">ICJ 5900.0129796.25.2</span>
                  </div>
                </div>
              </div>

              {/* 5. Frequência & Ocorrências Apuradas */}
              <div className="border border-slate-300 rounded p-4 space-y-3 avoid-break">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1.5">
                  3. Frequência & Ocorrências (Competência Vigente)
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Situação da Folha</span>
                    <span className="font-bold text-slate-900">
                      {profissionalSelecionado.situacao === "DESLIGADO" ? "Rescindido" : "Folha Regular"}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Marcações no Lote</span>
                    <span className="font-bold text-slate-900">
                      {marcacoesColab.length > 0 ? `${marcacoesColab.length} batidas` : "Sincronizado"}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Ocorrências no Período</span>
                    <span className="font-bold text-slate-900">
                      {ocorrenciasColab.length === 0 ? "0 ocorrências (100% Presença)" : `${ocorrenciasColab.length} ocorrência(s) (${diasAfetadosTotal}d)`}
                    </span>
                  </div>
                </div>

                {ocorrenciasColab.length > 0 && (
                  <table className="w-full text-left text-xs border border-slate-200 mt-2">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="p-1.5 font-bold text-slate-700">Tipo de Ocorrência</th>
                        <th className="p-1.5 font-bold text-slate-700">Período</th>
                        <th className="p-1.5 font-bold text-slate-700 text-right">Dias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocorrenciasColab.map((oc) => (
                        <tr key={oc.id} className="border-b border-slate-100">
                          <td className="p-1.5 font-medium text-slate-900">{oc.tipoOcorrencia.replace(/_/g, " ")}</td>
                          <td className="p-1.5 font-mono text-slate-600">{oc.dataInicio === oc.dataFim ? oc.dataInicio : `${oc.dataInicio} a ${oc.dataFim}`}</td>
                          <td className="p-1.5 text-right font-semibold text-slate-800">{oc.diasAfetados}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 6. Declaração Oficial e Termo de Assinaturas */}
              <div className="border border-slate-300 rounded p-4 space-y-6 pt-4 avoid-break">
                <p className="text-[11px] text-slate-600 text-justify leading-relaxed">
                  Declaramos para os devidos fins de direito e fiscalização que os dados cadastrais, contratuais e de frequência constantes neste documento são autênticos, extraídos do Sistema de Gestão de Postos (SGP) e em estrita conformidade com a legislação trabalhista vigente e as cláusulas do Contrato ICJ 5900.0129796.25.2 firmado com a Petrobras.
                </p>

                <div className="grid grid-cols-2 gap-12 pt-6">
                  <div className="text-center">
                    <div className="border-t border-slate-900 pt-2 font-bold text-xs text-slate-900">
                      {formatarNome(nomePrincipal)}
                    </div>
                    <div className="text-[10px] text-slate-500">Assinatura do Colaborador</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      CPF: {ehPerfilPetrobras ? profissionalSelecionado.cpfMascarado : cpfFormatado}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="border-t border-slate-900 pt-2 font-bold text-xs text-slate-900">
                      Premier Logistics Ltda.
                    </div>
                    <div className="text-[10px] text-slate-500">Visto de Recursos Humanos / Departamento Pessoal</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">Gestão Contratual SGP</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Admissão de Novo Colaborador */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Admitir Colaborador no Contrato</h3>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovoColaborador} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Matrícula <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PRM-00117"
                    value={formMatricula}
                    onChange={(e) => setFormMatricula(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 uppercase font-mono text-slate-800 outline-none focus:border-premier-700"
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
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:border-premier-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    CPF (Somente Números) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={14}
                    placeholder="123.456.789-01"
                    value={formCpf}
                    onChange={(e) => setFormCpf(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 outline-none focus:border-premier-700"
                  />
                  <span className="text-[10px] text-slate-500">Salvo cifrado e mascarado para Petrobras</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Função Contratual <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Auxiliar de Almoxarifado"
                    value={formFuncao}
                    onChange={(e) => setFormFuncao(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:border-premier-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vincular a Posto (Anexo 1-A)</label>
                  <select
                    value={formPosto}
                    onChange={(e) => setFormPosto(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 outline-none"
                  >
                    <option value="">Reserva Técnica (Sem posto fixo)</option>
                    {postos.map((p) => (
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
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 outline-none"
                  >
                    <option value="5x2">5x2</option>
                    <option value="12x36">12x36</option>
                    <option value="6x1">6x1</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefone Corporativo</label>
                  <input
                    type="text"
                    placeholder="(67) 99888-0000"
                    value={formTelefone}
                    onChange={(e) => setFormTelefone(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Salário Base (Restrito Premier)</label>
                  <input
                    type="number"
                    placeholder="2800.00"
                    value={formSalario}
                    onChange={(e) => setFormSalario(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none"
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
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none"
                />
              </div>

              <div className="p-3 bg-slate-100 border-t border-slate-200 -mx-5 -mb-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded shadow transition-colors"
                >
                  Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Troca/Transferência de Posto do Colaborador (Busca Aberta por Nome ou Matrícula) */}
      {modalTransferenciaAberto && colaboradorParaTransferir && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:hidden animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn flex flex-col max-h-[92vh]">
            {/* 1. Topo do Modal */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-blue-400" />
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

            {/* 2. Formulário com Busca Aberta */}
            <form onSubmit={handleSalvarTransferencia} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Card Colaborador de Origem */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Colaborador Atual</div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{formatarNome(colaboradorParaTransferir.nome)}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Matrícula: <strong className="font-mono">{colaboradorParaTransferir.matricula}</strong> • Função: <strong>{formatarFuncao(colaboradorParaTransferir.funcao)}</strong>
                    </div>
                  </div>
                  <div>
                    {colaboradorParaTransferir.postoCodigo ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 font-bold text-[11px]">
                        Posto {colaboradorParaTransferir.postoCodigo}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px]">
                        ★ Reserva Técnica
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Seção: Escolha do Substituto com Busca Aberta */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs">
                    Quem irá substituir o posto? <span className="text-rose-500">*</span>
                  </label>
                  {(substitutoSelecionado || moverParaReserva) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubstitutoSelecionado(null);
                        setMoverParaReserva(false);
                        setBuscaSubstituto("");
                      }}
                      className="text-[11px] text-[#1F4FD1] hover:underline font-semibold cursor-pointer"
                    >
                      Alterar seleção
                    </button>
                  )}
                </div>

                {/* Caso 1: Nenhum substituto e não escolheu mover para reserva -> Exibir Input de Busca */}
                {!substitutoSelecionado && !moverParaReserva && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="text"
                        value={buscaSubstituto}
                        onChange={(e) => setBuscaSubstituto(e.target.value)}
                        placeholder="Digite o nome ou matrícula do substituto..."
                        className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1F4FD1] focus:border-[#1F4FD1] outline-none shadow-2xs"
                        autoFocus
                      />
                      {buscaSubstituto && (
                        <button
                          type="button"
                          onClick={() => setBuscaSubstituto("")}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Botão de Atalho Rápido para Reserva Técnica */}
                    {colaboradorParaTransferir.postoCodigo && (
                      <button
                        type="button"
                        onClick={() => {
                          setMoverParaReserva(true);
                          setSubstitutoSelecionado(null);
                        }}
                        className="w-full p-2.5 rounded-xl border border-dashed border-slate-300 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/50 text-slate-700 hover:purple-900 flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <UserMinus className="w-4 h-4 text-purple-600 shrink-0" />
                          <span className="font-semibold text-purple-900">Mover titular atual para Reserva Técnica</span>
                        </div>
                        <span className="text-[11px] text-slate-400">(Deixar posto vago)</span>
                      </button>
                    )}

                    {/* Lista Dinâmica de Candidatos */}
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
                            className="p-2.5 hover:bg-blue-50/70 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 group-hover:text-[#1F4FD1] text-xs truncate">
                                  {formatarNome(cand.nome)}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {cand.matricula}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {formatarFuncao(cand.funcao)} • Base {cand.unidadeId}
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              {cand.postoCodigo ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                                  Posto {cand.postoCodigo}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-semibold border border-purple-200">
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

                {/* Caso 2: Substituto Selecionado */}
                {substitutoSelecionado && (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Substituto Confirmado</span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                        Matrícula: {substitutoSelecionado.matricula}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-emerald-200">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {formatarNome(substitutoSelecionado.nome)}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Função: <strong>{formatarFuncao(substitutoSelecionado.funcao)}</strong> • Base {substitutoSelecionado.unidadeId}
                        </div>
                      </div>
                      <div>
                        {substitutoSelecionado.postoCodigo ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 font-bold text-[11px]">
                            Titular do Posto {substitutoSelecionado.postoCodigo}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-[11px]">
                            ★ Reserva Técnica
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Resumo da Ação Operacional */}
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

                    {/* Opção de Permuta (se ambos possuem postos) */}
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

                {/* Caso 3: Mover Titular Atual para Reserva Técnica */}
                {moverParaReserva && (
                  <div className="p-4 bg-purple-50/70 border border-purple-300 rounded-xl space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                      <UserMinus className="w-4 h-4 text-purple-600" />
                      <span>Desocupar Posto — Mover para Reserva Técnica</span>
                    </div>
                    <p className="text-[11px] text-purple-900 leading-relaxed">
                      O colaborador <strong>{formatarNome(colaboradorParaTransferir.nome)}</strong> será desvinculado do <strong>Posto {colaboradorParaTransferir.postoCodigo}</strong> e movido para a <strong>Reserva Técnica</strong>. O posto ficará oficialmente <strong>VAGO</strong> no Anexo 1-A e no Mapa de Cobertura.
                    </p>
                  </div>
                )}
              </div>

              {/* Alerta de Interjornada CLT Art. 66 */}
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

              {/* 3. Rodapé do Modal */}
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
                  className="h-9 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!substitutoSelecionado && !moverParaReserva && !destinoPostoCodigo}
                  className={`h-9 px-5 rounded-lg font-semibold text-xs shadow-xs transition-all cursor-pointer ${
                    substitutoSelecionado || moverParaReserva || destinoPostoCodigo
                      ? "bg-[#1F4FD1] hover:bg-[#183FB3] text-white active:scale-[0.98]"
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
