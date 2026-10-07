"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Search,
  Plus,
  CheckCircle2,
  FileText,
  X,
  ArrowRight,
  HeartPulse,
  Lock,
  LayoutGrid,
  List,
  Copy,
  Clock,
  User,
  ShieldCheck,
  Stethoscope,
  Briefcase,
  Info,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  carregarEstado,
  adicionarOcorrencia,
  atualizarOcorrencia,
  cancelarOcorrencia,
  verificarConflitosOcorrencia,
  OcorrenciaOperacional,
  ProfissionalOperacional,
} from "@/lib/dados/estado-operacional";
import { useSessaoUsuario } from "@/lib/auth/use-sessao-usuario";
import { podeVerDadosPessoaisCompletos } from "@/lib/dados/rm-tipos";
import { obterPeriodoCompetencia } from "@/lib/servicos/calendario-competencia";

const NOMES_MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Data de hoje no fuso local, no formato YYYY-MM-DD. */
function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Retorna a competência de apuração YYYY-MM (dia 10 do mês anterior a dia 09 do mês de referência). */
function obterCompetenciaDaData(dataIso?: string): string {
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}/.test(dataIso)) return "";
  const [anoStr, mesStr, diaStr] = dataIso.split("-");
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  const dia = parseInt(diaStr, 10);
  if (dia >= 10) {
    const proximoMes = mes === 12 ? 1 : mes + 1;
    const proximoAno = mes === 12 ? ano + 1 : ano;
    return `${proximoAno}-${String(proximoMes).padStart(2, "0")}`;
  } else {
    return `${ano}-${String(mes).padStart(2, "0")}`;
  }
}

const TIPOS_DISPONIVEIS: {
  tipo: OcorrenciaOperacional["tipoOcorrencia"];
  label: string;
  descricao: string;
  dotClass: string;
}[] = [
  {
    tipo: "ATESTADO_MEDICO",
    label: "Atestado Médico",
    descricao: "Homologação clínica SESMT",
    dotClass: "bg-blue-500",
  },
  {
    tipo: "FALTA_INJUSTIFICADA",
    label: "Falta Injustificada",
    descricao: "Passível de desconto / glosa",
    dotClass: "bg-rose-500",
  },
  {
    tipo: "FALTA_JUSTIFICADA",
    label: "Falta Justificada",
    descricao: "Autorizada conforme legislação",
    dotClass: "bg-amber-500",
  },
  {
    tipo: "ABONO_LEGAL",
    label: "Abono Legal",
    descricao: "Abono chefia / Cubo RM",
    dotClass: "bg-indigo-500",
  },
  {
    tipo: "TREINAMENTO",
    label: "Treinamento NR",
    descricao: "Capacitação obrigatória",
    dotClass: "bg-purple-500",
  },
  {
    tipo: "FERIAS",
    label: "Férias Contratuais",
    descricao: "Gozo regular de férias",
    dotClass: "bg-emerald-500",
  },
];

const SUGESTOES_JUSTIFICATIVA: Record<string, string> = {
  ATESTADO_MEDICO: "Ausência justificada — atestado médico homologado pelo SESMT",
  FALTA_INJUSTIFICADA: "Ausência não justificada — passível de glosa na medição",
  FALTA_JUSTIFICADA: "Falta justificada nos termos legais e normativas internas",
  ABONO_LEGAL: "Abono legal homologado pela gestão operacional",
  TREINAMENTO: "Treinamento obrigatório de Segurança Operacional (NR)",
  FERIAS: "Gozo regular de férias contratuais",
  OUTROS: "Ocorrência operacional registrada",
};

/**
 * Unificação de estilos de texto: formata strings em Title Case,
 * mantendo preposições minúsculas, numerais romanos e siglas contratuais em maiúsculo.
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
      if (palavra === "medico") return "Médico";
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}

function formatarNome(nome?: string): string {
  if (!nome) return "—";
  return formatarTexto(nome);
}

function formatarDataBr(dataStr?: string): string {
  if (!dataStr) return "—";
  const partes = dataStr.split("-");
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataStr;
}

function formatarPeriodo(dataInicio: string, dataFim: string): string {
  const ini = formatarDataBr(dataInicio);
  const fim = formatarDataBr(dataFim);
  if (ini === fim) return ini;
  return `${ini} a ${fim}`;
}

function formatarJustificativa(obs?: string): string {
  if (!obs) return "—";
  const limpo = obs.replace(/^Abono\/Ocorrência:\s*/i, "").trim();
  if (limpo === limpo.toUpperCase() && limpo.length > 5) {
    return formatarTexto(limpo);
  }
  return limpo;
}

/**
 * Separa a justificativa em um resumo curto e o detalhamento completo.
 */
function extrairResumoJustificativa(obs?: string): { resumo: string; detalhe: string } {
  if (!obs) return { resumo: "Sem motivo informado", detalhe: "Nenhuma justificativa detalhada registrada." };

  const limpo = obs.replace(/^Abono\/Ocorrência:\s*/i, "").trim();
  const detalheFormatado = formatarTexto(limpo);

  // Se houver parênteses com escala/dia, ex: "ATESTADO DE ACOMPANHAMENTO (SEG) - FAROL..."
  const matchParenteses = limpo.match(/^([^(—\-]+)(.*)$/);
  if (matchParenteses && matchParenteses[1].trim().length >= 4) {
    const partePrincipal = matchParenteses[1].trim();
    return {
      resumo: formatarTexto(partePrincipal),
      detalhe: detalheFormatado,
    };
  }

  // Se houver travessão ou traço separador
  if (limpo.includes("—") || limpo.includes(" - ")) {
    const separador = limpo.includes("—") ? "—" : "-";
    const partes = limpo.split(separador);
    return {
      resumo: formatarTexto(partes[0].trim()),
      detalhe: detalheFormatado,
    };
  }

  // Fallback resumido
  if (limpo.length > 32) {
    return {
      resumo: formatarTexto(limpo.slice(0, 30) + "..."),
      detalhe: detalheFormatado,
    };
  }

  return {
    resumo: formatarTexto(limpo),
    detalhe: detalheFormatado,
  };
}

function obterIniciais(nome: string): string {
  const partes = (nome || "").trim().split(/\s+/);
  if (!partes[0]) return "--";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function formatTipoTexto(tipo: string): { label: string; dotClass: string; avatarClass: string; badgeClass: string } {
  switch (tipo) {
    case "ATESTADO_MEDICO":
      return {
        label: "Atestado Médico",
        dotClass: "bg-blue-500",
        avatarClass: "bg-blue-100 text-blue-800",
        badgeClass: "bg-blue-50 text-blue-800 border-blue-200/80",
      };
    case "FALTA_INJUSTIFICADA":
      return {
        label: "Falta Injustificada",
        dotClass: "bg-rose-500",
        avatarClass: "bg-rose-100 text-rose-800",
        badgeClass: "bg-rose-50 text-rose-800 border-rose-200/80",
      };
    case "FALTA_JUSTIFICADA":
      return {
        label: "Falta Justificada",
        dotClass: "bg-amber-500",
        avatarClass: "bg-amber-100 text-amber-800",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200/80",
      };
    case "FERIAS":
      return {
        label: "Férias Contratuais",
        dotClass: "bg-emerald-500",
        avatarClass: "bg-emerald-100 text-emerald-800",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
      };
    case "TREINAMENTO":
      return {
        label: "Treinamento NR",
        dotClass: "bg-purple-500",
        avatarClass: "bg-purple-100 text-purple-800",
        badgeClass: "bg-purple-50 text-purple-800 border-purple-200/80",
      };
    case "ABONO_LEGAL":
      return {
        label: "Abono Legal",
        dotClass: "bg-indigo-500",
        avatarClass: "bg-indigo-100 text-indigo-800",
        badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200/80",
      };
    default:
      return {
        label: formatarTexto(tipo),
        dotClass: "bg-slate-400",
        avatarClass: "bg-slate-100 text-slate-700",
        badgeClass: "bg-slate-50 text-slate-700 border-slate-200/80",
      };
  }
}

export default function OcorrenciasPage() {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  // Perfil REAL da sessão (null enquanto carrega ou se falhar → dados sensíveis ocultos)
  const { perfil: perfilSessao } = useSessaoUsuario();
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "ATESTADO" | "FALTA" | "ABONO" | "OUTROS">("TODOS");
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>("TODAS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "VALIDADA" | "EM_VALIDACAO">("TODOS");
  const [modoVisualizacao, setModoVisualizacao] = useState<"TABELA" | "CARDS">("TABELA");

  // Modais
  const [modalAberto, setModalAberto] = useState(false);
  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] = useState<OcorrenciaOperacional | null>(null);
  const [justificativaAbertaId, setJustificativaAbertaId] = useState<string | null>(null);
  const [ocorrenciaEmEdicao, setOcorrenciaEmEdicao] = useState<OcorrenciaOperacional | null>(null);

  // Formulário nova ocorrência
  const [formMatricula, setFormMatricula] = useState("");
  const [formBuscaColaborador, setFormBuscaColaborador] = useState("");
  const [formTipo, setFormTipo] = useState<OcorrenciaOperacional["tipoOcorrencia"]>("ATESTADO_MEDICO");
  const [formDataInicio, setFormDataInicio] = useState(() => hojeISO());
  const [formDataFim, setFormDataFim] = useState(() => hojeISO());
  const [formObservacao, setFormObservacao] = useState(SUGESTOES_JUSTIFICATIVA["ATESTADO_MEDICO"]);
  const [formCid, setFormCid] = useState("");
  const [formMedico, setFormMedico] = useState("");
  const [formCrm, setFormCrm] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const carregarDados = () => {
    const estado = carregarEstado();
    setOcorrencias(estado.ocorrencias);
    setProfissionais(estado.profissionais);
  };

  useEffect(() => {
    carregarDados();
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // LGPD: CID, médico e CRM só para perfis Premier. Qualquer outro perfil — inclusive
  // sessão ainda não carregada ou com falha — recebe a visão restrita (fail-closed).
  const ehPerfilPremier = podeVerDadosPessoaisCompletos(perfilSessao);
  const ehPerfilPetrobras = !ehPerfilPremier;

  // Opções de competência derivadas dos próprios registros e do período de apuração (dia 10 a dia 09)
  const competenciasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    ocorrencias.forEach((o) => {
      const comp = obterCompetenciaDaData(o.dataInicio);
      if (comp) set.add(comp);
      if (o.dataInicio && /^\d{4}-\d{2}/.test(o.dataInicio)) set.add(o.dataInicio.slice(0, 7));
    });
    set.add("2026-09");
    return Array.from(set).sort().reverse();
  }, [ocorrencias]);

  // Filtragem dinâmica
  const ocorrenciasFiltradas = useMemo(() => {
    return ocorrencias.filter((oc) => {
      const termo = busca.toLowerCase();
      const matchBusca =
        !busca ||
        oc.profissionalNome.toLowerCase().includes(termo) ||
        oc.matricula.toLowerCase().includes(termo) ||
        (oc.postoCodigo && oc.postoCodigo.toLowerCase().includes(termo)) ||
        oc.observacaoPublica.toLowerCase().includes(termo);

      let matchTipo = true;
      if (filtroTipo === "ATESTADO") {
        matchTipo = oc.tipoOcorrencia === "ATESTADO_MEDICO";
      } else if (filtroTipo === "FALTA") {
        matchTipo = oc.tipoOcorrencia.startsWith("FALTA");
      } else if (filtroTipo === "ABONO") {
        matchTipo = oc.tipoOcorrencia === "ABONO_LEGAL";
      } else if (filtroTipo === "OUTROS") {
        matchTipo =
          oc.tipoOcorrencia === "TREINAMENTO" ||
          oc.tipoOcorrencia === "FERIAS" ||
          oc.tipoOcorrencia === "FOLGA_ESCALA" ||
          oc.tipoOcorrencia === "OUTROS";
      }

      let matchComp = true;
      if (filtroCompetencia !== "TODAS") {
        const periodo = obterPeriodoCompetencia(filtroCompetencia);
        if (periodo && periodo.dataInicio && periodo.dataFim) {
          const ocIni = oc.dataInicio?.slice(0, 10) || "";
          const ocFim = (oc.dataFim || oc.dataInicio)?.slice(0, 10) || ocIni;
          matchComp = ocIni <= periodo.dataFim && ocFim >= periodo.dataInicio;
        } else {
          matchComp =
            oc.dataInicio.startsWith(filtroCompetencia) ||
            obterCompetenciaDaData(oc.dataInicio) === filtroCompetencia;
        }
      }

      const matchStatus =
        filtroStatus === "TODOS" || oc.status === filtroStatus;

      return matchBusca && matchTipo && matchComp && matchStatus;
    });
  }, [ocorrencias, busca, filtroTipo, filtroCompetencia, filtroStatus]);

  // Indicadores
  const totalOcorrencias = ocorrencias.length;
  const atestados = ocorrencias.filter((o) => o.tipoOcorrencia === "ATESTADO_MEDICO").length;
  const abonosLegais = ocorrencias.filter((o) => o.tipoOcorrencia === "ABONO_LEGAL").length;
  const faltas = ocorrencias.filter((o) => o.tipoOcorrencia.startsWith("FALTA")).length;
  const outras = ocorrencias.filter((o) =>
    ["TREINAMENTO", "FERIAS", "FOLGA_ESCALA", "OUTROS"].includes(o.tipoOcorrencia)
  ).length;

  const handleCopiarJustificativa = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setMensagemSucesso("Justificativa copiada para a área de transferência!");
    setTimeout(() => setMensagemSucesso(""), 3000);
  };

  // Cálculo dinâmico do período no modal
  const diasCalculados = useMemo(() => {
    if (!formDataInicio || !formDataFim) return 1;
    const dIni = new Date(formDataInicio + "T00:00:00");
    const dFim = new Date(formDataFim + "T00:00:00");
    if (dFim < dIni) return 0;
    const diffTime = Math.abs(dFim.getTime() - dIni.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [formDataInicio, formDataFim]);

  // Colaboradores filtrados para busca no modal
  const colaboradoresFiltradosForm = useMemo(() => {
    if (!formBuscaColaborador.trim()) return profissionais;
    const termo = formBuscaColaborador.toLowerCase();
    return profissionais.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        p.matricula.toLowerCase().includes(termo) ||
        (p.postoCodigo && p.postoCodigo.toLowerCase().includes(termo))
    );
  }, [profissionais, formBuscaColaborador]);

  const colaboradorSelecionado = useMemo(() => {
    return profissionais.find((p) => p.matricula === formMatricula);
  }, [profissionais, formMatricula]);

  const handleSelecionarTipo = (tipo: OcorrenciaOperacional["tipoOcorrencia"]) => {
    setFormTipo(tipo);
    if (!formObservacao || Object.values(SUGESTOES_JUSTIFICATIVA).includes(formObservacao)) {
      setFormObservacao(SUGESTOES_JUSTIFICATIVA[tipo] || "");
    }
  };

  const limparFormulario = () => {
    setOcorrenciaEmEdicao(null);
    setFormMatricula("");
    setFormBuscaColaborador("");
    setFormTipo("ATESTADO_MEDICO");
    setFormDataInicio(hojeISO());
    setFormDataFim(hojeISO());
    setFormObservacao(SUGESTOES_JUSTIFICATIVA["ATESTADO_MEDICO"]);
    setFormCid("");
    setFormMedico("");
    setFormCrm("");
  };

  const abrirEdicaoOcorrencia = (oc: OcorrenciaOperacional) => {
    setOcorrenciaEmEdicao(oc);
    setFormMatricula(oc.matricula);
    setFormBuscaColaborador("");
    setFormTipo(oc.tipoOcorrencia);
    setFormDataInicio(oc.dataInicio);
    setFormDataFim(oc.dataFim);
    setFormObservacao(oc.observacaoPublica || "");
    setFormCid(oc.dadoSensivel?.cid || "");
    setFormMedico(oc.dadoSensivel?.profissionalEmissor || "");
    setFormCrm(oc.dadoSensivel?.crm || "");
    setOcorrenciaSelecionada(null);
    setModalAberto(true);
  };

  const handleExcluirOcorrencia = (oc: OcorrenciaOperacional) => {
    if (!confirm(`Deseja excluir a ausência de ${formatarNome(oc.profissionalNome)} (${formatarPeriodo(oc.dataInicio, oc.dataFim)})?`)) return;
    try {
      cancelarOcorrencia(oc.id);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : "Não foi possível excluir a ocorrência.");
      return;
    }
    setOcorrenciaSelecionada(null);
    carregarDados();
    setMensagemSucesso("Ocorrência excluída com sucesso (registrada na auditoria).");
    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  const handleSubmitNovaOcorrencia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMatricula || !formDataInicio || !formDataFim) {
      alert("Preencha o colaborador e o período da ocorrência.");
      return;
    }

    if (diasCalculados <= 0) {
      alert("A data de término deve ser posterior ou igual à data de início.");
      return;
    }

    const profBase = profissionais.find((p) => p.matricula === formMatricula);
    const prof =
      profBase ||
      (ocorrenciaEmEdicao && ocorrenciaEmEdicao.matricula === formMatricula
        ? { matricula: ocorrenciaEmEdicao.matricula, nome: ocorrenciaEmEdicao.profissionalNome, postoCodigo: ocorrenciaEmEdicao.postoCodigo }
        : null);
    if (!prof) {
      alert(`O colaborador de matrícula ${formMatricula} não foi encontrado na base importada do RM.`);
      return;
    }

    const conflitos = verificarConflitosOcorrencia(
      { matricula: prof.matricula, dataInicio: formDataInicio, dataFim: formDataFim },
      ocorrenciaEmEdicao?.id
    );
    if (conflitos.length > 0) {
      alert(`Não foi possível salvar a ocorrência (período sobreposto):\n\n- ${conflitos.join("\n- ")}`);
      return;
    }

    let obsPadrao = formObservacao.trim();
    if (!obsPadrao) {
      obsPadrao = SUGESTOES_JUSTIFICATIVA[formTipo] || "Ocorrência operacional registrada";
    }

    const dadosOcorrencia = {
      matricula: prof.matricula,
      profissionalNome: prof.nome,
      postoCodigo: prof.postoCodigo,
      tipoOcorrencia: formTipo,
      dataInicio: formDataInicio,
      dataFim: formDataFim,
      diasAfetados: diasCalculados,
      observacaoPublica: obsPadrao,
      dadoSensivel:
        formTipo === "ATESTADO_MEDICO"
          ? {
              cid: formCid.trim() || undefined,
              profissionalEmissor: formMedico.trim() || undefined,
              crm: formCrm.trim() || undefined,
            }
          : undefined,
    };

    try {
      if (ocorrenciaEmEdicao) {
        atualizarOcorrencia(ocorrenciaEmEdicao.id, dadosOcorrencia);
        setMensagemSucesso(`Ocorrência de ${formatarNome(prof.nome)} atualizada com sucesso!`);
      } else {
        adicionarOcorrencia({ ...dadosOcorrencia, status: "VALIDADA" });
        setMensagemSucesso(`Ocorrência registrada com sucesso para ${formatarNome(prof.nome)}!`);
      }
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : "Não foi possível salvar a ocorrência.");
      return;
    }

    setModalAberto(false);
    limparFormulario();
    carregarDados();

    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. Cabeçalho Compacto e Direto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Quadro de Ocorrências & Afastamentos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle oficial de atestados médicos, faltas e ausências operacionais do contrato
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/coberturas"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <span>Ver Coberturas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => {
              limparFormulario();
              setModalAberto(true);
            }}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Nova Ocorrência</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {mensagemSucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs flex items-center justify-between shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso("")} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Barra de Segmentos e Filtros Rápidos (Padrão Unificado) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Segmented Control / Abas por Tipo de Ocorrência */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl overflow-x-auto border border-slate-200/60">
          <button
            onClick={() => setFiltroTipo("TODOS")}
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filtroTipo === "TODOS"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <span>Todas</span>
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                filtroTipo === "TODOS" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {totalOcorrencias}
            </span>
          </button>

          <button
            onClick={() => setFiltroTipo("ATESTADO")}
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filtroTipo === "ATESTADO"
                ? "bg-white text-blue-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <span>Atestados</span>
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                filtroTipo === "ATESTADO" ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-800"
              }`}
            >
              {atestados}
            </span>
          </button>

          <button
            onClick={() => setFiltroTipo("FALTA")}
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filtroTipo === "FALTA"
                ? "bg-white text-rose-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <span>Faltas</span>
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                filtroTipo === "FALTA" ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-800"
              }`}
            >
              {faltas}
            </span>
          </button>

          <button
            onClick={() => setFiltroTipo("ABONO")}
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filtroTipo === "ABONO"
                ? "bg-white text-indigo-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <span>Abonos</span>
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                filtroTipo === "ABONO" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-800"
              }`}
            >
              {abonosLegais}
            </span>
          </button>

          <button
            onClick={() => setFiltroTipo("OUTROS")}
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filtroTipo === "OUTROS"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <span>Outras</span>
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                filtroTipo === "OUTROS" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {outras}
            </span>
          </button>
        </div>

        {/* Busca, Competência e Alternador */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 focus-within:bg-white focus-within:border-premier-700 focus-within:ring-1 focus-within:ring-premier-700 text-xs w-full sm:w-64 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar colaborador, posto, motivo..."
              className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-400 text-xs"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-600 p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={filtroCompetencia}
            onChange={(e) => setFiltroCompetencia(e.target.value)}
            className="border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer transition-colors"
          >
            <option value="TODAS">Todas as Competências</option>
            {competenciasDisponiveis.map((comp) => {
              const [ano, mes] = comp.split("-");
              const mesNum = Number(mes);
              const mesAnt = mesNum === 1 ? 12 : mesNum - 1;
              return (
                <option key={comp} value={comp}>
                  Competência {mes}/{ano} (10/{String(mesAnt).padStart(2, "0")} a 09/{mes})
                </option>
              );
            })}
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as "TODOS" | "VALIDADA" | "EM_VALIDACAO")}
            className="border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer transition-colors"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="VALIDADA">Homologada</option>
            <option value="EM_VALIDACAO">Em Validação</option>
          </select>

          {/* Alternador de Visualização */}
          <div className="flex items-center border border-slate-200/60 rounded-xl p-1 bg-slate-100/90">
            <button
              onClick={() => setModoVisualizacao("TABELA")}
              className={`p-1.5 rounded-lg text-slate-600 transition-colors cursor-pointer ${
                modoVisualizacao === "TABELA" ? "bg-white text-slate-900 shadow-xs font-semibold" : "hover:text-slate-900"
              }`}
              title="Modo Tabela Unificada"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setModoVisualizacao("CARDS")}
              className={`p-1.5 rounded-lg text-slate-600 transition-colors cursor-pointer ${
                modoVisualizacao === "CARDS" ? "bg-white text-slate-900 shadow-xs font-semibold" : "hover:text-slate-900"
              }`}
              title="Modo Cards Compactos"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Conteúdo: Tabela ou Cards */}
      {ocorrenciasFiltradas.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-xs text-slate-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-700 text-sm">Nenhuma ocorrência encontrada.</p>
          <p className="text-xs text-slate-400 mt-1">Tente ajustar a busca ou os filtros operacionais acima.</p>
        </div>
      ) : modoVisualizacao === "TABELA" ? (
        /* MODO TABELA LIMPA COM TIPOGRAFIA HARMONIOSA E DESIGN PREMIUM */
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Colaborador</th>
                  <th className="px-3.5 py-3.5">Posto</th>
                  <th className="px-3.5 py-3.5">Tipo de Ocorrência</th>
                  <th className="px-3.5 py-3.5">Período</th>
                  <th className="px-3.5 py-3.5">Motivo / Justificativa</th>
                  <th className="px-3.5 py-3.5">Dado Clínico (LGPD)</th>
                  <th className="px-3.5 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ocorrenciasFiltradas.map((oc) => {
                  const tipoInfo = formatTipoTexto(oc.tipoOcorrencia);
                  return (
                    <tr key={oc.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Colaborador */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {obterIniciais(oc.profissionalNome)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-xs sm:text-[13px] leading-snug">
                              {formatarNome(oc.profissionalNome)}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                              Matrícula: {oc.matricula}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Posto */}
                      <td className="px-3.5 py-3">
                        {oc.postoCodigo ? (
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                            {oc.postoCodigo}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                            Reserva Técnica
                          </span>
                        )}
                      </td>

                      {/* Tipo com Badge Semântico Moderno */}
                      <td className="px-3.5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${tipoInfo.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tipoInfo.dotClass}`} />
                          <span>{tipoInfo.label}</span>
                        </span>
                      </td>

                      {/* Período */}
                      <td className="px-3.5 py-3 font-mono text-slate-800 text-xs">
                        <div className="font-medium">{formatarPeriodo(oc.dataInicio, oc.dataFim)}</div>
                        <div className="text-[11px] font-medium text-slate-500 font-sans mt-0.5">
                          {oc.diasAfetados} {oc.diasAfetados === 1 ? "dia" : "dias"}
                        </div>
                      </td>

                      {/* Resumo com Tooltip e Popover Limpo (Sem poluição de ícone em cada linha) */}
                      <td className="px-3.5 py-3 max-w-[240px]">
                        {(() => {
                          const infoJust = extrairResumoJustificativa(oc.observacaoPublica);
                          const aberto = justificativaAbertaId === oc.id;

                          return (
                            <div className="relative inline-block group">
                              <button
                                type="button"
                                onClick={() => setJustificativaAbertaId(aberto ? null : oc.id)}
                                className={`text-xs font-medium transition-colors cursor-pointer text-left block truncate max-w-[230px] ${
                                  aberto
                                    ? "text-blue-700 font-semibold underline underline-offset-2"
                                    : "text-slate-700 hover:text-slate-950 hover:underline hover:underline-offset-2"
                                }`}
                                title="Clique para fixar detalhes ou passe o cursor"
                              >
                                {infoJust.resumo}
                              </button>

                              {/* Tooltip ao passar o cursor (Hover) */}
                              {!aberto && (
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:flex flex-col w-72 bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl z-30 pointer-events-none border border-slate-700 animate-fadeIn">
                                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                                    <span>Justificativa Completa</span>
                                    <span className="text-emerald-400">Clique p/ fixar</span>
                                  </div>
                                  <p className="text-slate-200 leading-relaxed font-normal">
                                    {infoJust.detalhe}
                                  </p>
                                  <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 absolute -bottom-1 left-4" />
                                </div>
                              )}

                              {/* Popover interativo ao Clicar */}
                              {aberto && (
                                <div className="absolute left-0 top-full mt-1.5 w-80 bg-white text-slate-900 rounded-xl p-3.5 shadow-2xl border border-slate-200 z-40 animate-scaleIn text-xs">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                                      Detalhamento do Motivo
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setJustificativaAbertaId(null);
                                      }}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="py-1 text-slate-700 leading-relaxed font-normal">
                                    &quot;{infoJust.detalhe}&quot;
                                  </div>

                                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-400 font-mono">
                                      {oc.matricula} • {oc.postoCodigo || "Reserva"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopiarJustificativa(oc.observacaoPublica)}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer"
                                    >
                                      <Copy className="w-3 h-3 text-slate-500" />
                                      <span>Copiar</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Dado Clínico / LGPD */}
                      <td className="px-3.5 py-3">
                        {oc.dadoSensivel?.cid ? (
                          ehPerfilPetrobras ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                              <Lock className="w-3 h-3 text-slate-400" /> Restrito LGPD
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              CID: {oc.dadoSensivel.cid}
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-300 font-mono">
                            —
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            oc.status === "VALIDADA"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                              : "bg-amber-50 text-amber-800 border-amber-200/80"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              oc.status === "VALIDADA" ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          {oc.status === "VALIDADA" ? "Homologada" : "Em Validação"}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setOcorrenciaSelecionada(oc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                            title="Ver detalhes da ficha"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>Ficha</span>
                          </button>
                          <Link
                            href={oc.postoCodigo ? `/coberturas?posto=${oc.postoCodigo}` : "/coberturas"}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-all cursor-pointer group"
                            title="Designar cobertura para a ausência"
                          >
                            <span>Cobertura</span>
                            <ArrowRight className="w-3 h-3 text-blue-500 transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé Compacto */}
          <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between font-medium">
            <span>{ocorrenciasFiltradas.length} ocorrências exibidas</span>
            <span>Contrato ICJ 5900.0129796.25.2</span>
          </div>
        </div>
      ) : (
        /* MODO CARDS COMPACTOS E MODERNOS */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {ocorrenciasFiltradas.map((oc) => {
            const tipoInfo = formatTipoTexto(oc.tipoOcorrencia);
            return (
              <div
                key={oc.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all p-4 flex flex-col justify-between gap-3.5"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {oc.postoCodigo || "Reserva Técnica"}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${tipoInfo.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tipoInfo.dotClass}`} />
                      <span>{tipoInfo.label}</span>
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      oc.status === "VALIDADA"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                        : "bg-amber-50 text-amber-800 border-amber-200/80"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        oc.status === "VALIDADA" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {oc.status === "VALIDADA" ? "Homologada" : "Em Validação"}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {obterIniciais(oc.profissionalNome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 text-sm truncate">
                        {formatarNome(oc.profissionalNome)}
                      </h4>
                      <span className="font-mono text-[11px] text-slate-500">
                        Matrícula: {oc.matricula}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600 font-mono bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{formatarPeriodo(oc.dataInicio, oc.dataFim)}</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-sans text-[11px] text-slate-600 font-semibold">
                      {oc.diasAfetados} {oc.diasAfetados === 1 ? "dia" : "dias"}
                    </span>
                  </div>

                  {/* Resumo com hover tooltip e clique */}
                  <div className="pt-0.5">
                    {(() => {
                      const infoJust = extrairResumoJustificativa(oc.observacaoPublica);
                      const aberto = justificativaAbertaId === oc.id;
                      return (
                        <div className="relative inline-block group w-full">
                          <button
                            type="button"
                            onClick={() => setJustificativaAbertaId(aberto ? null : oc.id)}
                            className={`inline-flex items-center justify-between gap-1.5 text-xs font-medium transition-colors cursor-pointer text-left w-full ${
                              aberto
                                ? "text-blue-700 font-semibold underline underline-offset-2"
                                : "text-slate-700 hover:text-slate-950 hover:underline hover:underline-offset-2"
                            }`}
                          >
                            <span className="truncate">{infoJust.resumo}</span>
                            <Info className={`w-3.5 h-3.5 shrink-0 ${aberto ? "text-blue-600" : "text-slate-400"}`} />
                          </button>

                          {!aberto && (
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:flex flex-col w-72 bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl z-30 pointer-events-none border border-slate-700 animate-fadeIn">
                              <p className="text-slate-200 leading-relaxed font-normal">
                                {infoJust.detalhe}
                              </p>
                              <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 absolute -bottom-1 left-4" />
                            </div>
                          )}

                          {aberto && (
                            <div className="absolute left-0 top-full mt-1.5 w-full bg-white text-slate-900 rounded-xl p-3 shadow-2xl border border-slate-200 z-40 text-xs">
                              <p className="text-slate-800 leading-relaxed font-normal">
                                &quot;{infoJust.detalhe}&quot;
                              </p>
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleCopiarJustificativa(oc.observacaoPublica)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-300 cursor-pointer"
                                >
                                  <Copy className="w-3 h-3 text-slate-500" />
                                  <span>Copiar</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
                  <div>
                    {oc.dadoSensivel?.cid && !ehPerfilPetrobras ? (
                      <span className="font-mono text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        CID: {oc.dadoSensivel.cid}
                      </span>
                    ) : oc.dadoSensivel?.cid ? (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Restrito LGPD
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setOcorrenciaSelecionada(oc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ficha</span>
                    </button>
                    <Link
                      href={oc.postoCodigo ? `/coberturas?posto=${oc.postoCodigo}` : "/coberturas"}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-all cursor-pointer group"
                    >
                      <span>Cobertura</span>
                      <ArrowRight className="w-3 h-3 text-blue-500 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Modal Ficha da Ocorrência */}
      {ocorrenciaSelecionada && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Ficha da Ocorrência: {ocorrenciaSelecionada.id}</h3>
              </div>
              <button
                onClick={() => setOcorrenciaSelecionada(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto">
              {/* Colaborador & Posto */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">Colaborador</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {formatarNome(ocorrenciaSelecionada.profissionalNome)}
                  </div>
                  <div className="font-mono text-slate-400 text-[11px]">
                    Matrícula: {ocorrenciaSelecionada.matricula}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">Posto Titular</span>
                  <div className="font-mono font-bold text-slate-800 mt-0.5">
                    {ocorrenciaSelecionada.postoCodigo || "Reserva Técnica"}
                  </div>
                </div>
              </div>

              {/* Dados da Ausência */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-white rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">Tipo</span>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {formatTipoTexto(ocorrenciaSelecionada.tipoOcorrencia).label}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">Período</span>
                  <div className="font-mono text-slate-800 mt-0.5">
                    {formatarPeriodo(ocorrenciaSelecionada.dataInicio, ocorrenciaSelecionada.dataFim)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">Duração</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {ocorrenciaSelecionada.diasAfetados} dia(s)
                  </div>
                </div>
              </div>

              {/* Justificativa Auditável */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-500 font-bold uppercase text-[10px] block">
                    Justificativa / Rótulo Público (Auditável)
                  </span>
                  <button
                    onClick={() => handleCopiarJustificativa(ocorrenciaSelecionada.observacaoPublica)}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-medium cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copiar texto</span>
                  </button>
                </div>
                <div className="py-1.5 text-slate-800 leading-relaxed font-normal text-xs sm:text-sm">
                  &quot;{ocorrenciaSelecionada.observacaoPublica}&quot;
                </div>
              </div>

              {/* Dados Clínicos (se houver) */}
              {ocorrenciaSelecionada.tipoOcorrencia === "ATESTADO_MEDICO" && (
                <div className="p-3.5 bg-blue-50/50 rounded-lg border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-950 flex items-center gap-1.5">
                      <HeartPulse className="w-4 h-4 text-blue-600" />
                      <span>Dados Clínicos Segregados (LGPD)</span>
                    </span>
                    {ehPerfilPetrobras ? (
                      <span className="text-[10px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Restrito Petrobras
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Acesso Premier RH
                      </span>
                    )}
                  </div>

                  {ehPerfilPetrobras ? (
                    <p className="text-[11px] text-slate-500">
                      O diagnóstico e dados médicos do profissional são protegidos nos termos do Art. 11 da Lei nº 13.709/2018 (LGPD).
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-500 font-bold block">CID-10:</span>
                        <div className="font-mono font-bold text-blue-900 mt-0.5">
                          {ocorrenciaSelecionada.dadoSensivel?.cid || "Não informado"}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 font-bold block">Profissional Emissor / CRM:</span>
                        <div className="font-medium text-slate-800 mt-0.5">
                          {ocorrenciaSelecionada.dadoSensivel?.profissionalEmissor || "Dr. Homologador SESMT"}{" "}
                          {ocorrenciaSelecionada.dadoSensivel?.crm ? `(${ocorrenciaSelecionada.dadoSensivel.crm})` : ""}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={() => setOcorrenciaSelecionada(null)}
                className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
              {ehPerfilPremier && (
                <div className="flex items-center gap-2">
                  <button
                    id="btn-editar-ocorrencia"
                    onClick={() => abrirEdicaoOcorrencia(ocorrenciaSelecionada)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 text-xs transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    id="btn-excluir-ocorrencia"
                    onClick={() => handleExcluirOcorrencia(ocorrenciaSelecionada)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 font-semibold rounded border border-rose-200 text-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>
              )}
              <Link
                href={ocorrenciaSelecionada.postoCodigo ? `/coberturas?posto=${ocorrenciaSelecionada.postoCodigo}` : "/coberturas"}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded text-xs transition-colors"
              >
                Designar Cobertura para este Posto
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal Lançar Nova Ocorrência (Campo de Ocorrências Moderno & Funcional) */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full border border-slate-200 overflow-hidden animate-scaleIn max-h-[92vh] flex flex-col">
            {/* Topo do Formulário */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">{ocorrenciaEmEdicao ? "Editar Ocorrência Operacional" : "Lançar Ocorrência Operacional"}</h3>
                  <p className="text-[11px] text-slate-400">
                    Registro de ausência, justificativa e apuração de cobertura
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalAberto(false);
                  limparFormulario();
                }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovaOcorrencia} className="p-5 space-y-4 text-xs overflow-y-auto">
              {/* Campo 1: Colaborador com Filtro Rápido */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">
                    Colaborador Afetado <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {colaboradoresFiltradosForm.length} disponíveis
                  </span>
                </div>

                {/* Input de filtro rápido */}
                <div className="flex items-center gap-1.5 border border-slate-200 rounded-md px-2.5 py-1.5 bg-slate-50 focus-within:bg-white focus-within:border-slate-400">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={formBuscaColaborador}
                    onChange={(e) => setFormBuscaColaborador(e.target.value)}
                    placeholder="Filtrar por nome ou matrícula para selecionar..."
                    className="w-full bg-transparent border-none outline-none text-slate-800 text-xs placeholder:text-slate-400"
                  />
                  {formBuscaColaborador && (
                    <button
                      type="button"
                      onClick={() => setFormBuscaColaborador("")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Seletor do Colaborador */}
                <select
                  required
                  value={formMatricula}
                  onChange={(e) => setFormMatricula(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-2.5 py-2 bg-white text-slate-800 text-xs font-medium outline-none focus:border-slate-500 cursor-pointer"
                >
                  <option value="">Selecione o colaborador...</option>
                  {colaboradoresFiltradosForm.map((p) => (
                    <option key={p.matricula} value={p.matricula}>
                      {formatarNome(p.nome)} ({p.matricula}) — {p.postoCodigo ? `Posto ${p.postoCodigo}` : "Reserva Técnica"}
                    </option>
                  ))}
                </select>

                {/* Preview do Colaborador Selecionado */}
                {colaboradorSelecionado && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="font-bold text-slate-900">
                          {formatarNome(colaboradorSelecionado.nome)}
                        </span>
                        <span className="text-slate-500 ml-1.5 font-mono text-[11px]">
                          ({colaboradorSelecionado.matricula})
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {colaboradorSelecionado.postoCodigo ? `Posto ${colaboradorSelecionado.postoCodigo}` : "Reserva Técnica"}
                    </span>
                  </div>
                )}
              </div>

              {/* Campo 2: Seletor Interativo do Tipo de Ocorrência */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Classificação da Ocorrência <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TIPOS_DISPONIVEIS.map((item) => {
                    const ativo = formTipo === item.tipo;
                    return (
                      <button
                        key={item.tipo}
                        type="button"
                        onClick={() => handleSelecionarTipo(item.tipo)}
                        className={`p-2 rounded-md border text-left transition-all cursor-pointer ${
                          ativo
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              ativo ? "bg-emerald-400" : item.dotClass
                            }`}
                          />
                          <span className="font-bold text-xs">{item.label}</span>
                        </div>
                        <p className={`text-[10px] mt-0.5 ${ativo ? "text-slate-300" : "text-slate-400"}`}>
                          {item.descricao}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campo 3: Período e Cálculo de Duração em Tempo Real */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">
                    Período de Ausência <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      diasCalculados > 0
                        ? "bg-emerald-100 text-emerald-800 font-mono"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {diasCalculados > 0
                      ? `${diasCalculados} ${diasCalculados === 1 ? "dia afetado" : "dias afetados"}`
                      : "Data inválida"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block mb-1">
                      Data Início
                    </span>
                    <input
                      type="date"
                      required
                      value={formDataInicio}
                      onChange={(e) => setFormDataInicio(e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-mono text-xs outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block mb-1">
                      Data Término
                    </span>
                    <input
                      type="date"
                      required
                      value={formDataFim}
                      onChange={(e) => setFormDataFim(e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 font-mono text-xs outline-none focus:border-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Campo 4: Justificativa / Rótulo Público Auditável */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">
                    Justificativa / Rótulo Público Auditável
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormObservacao(SUGESTOES_JUSTIFICATIVA[formTipo] || "")}
                    className="text-[11px] text-blue-700 hover:text-blue-900 font-medium cursor-pointer"
                  >
                    Restaurar padrão
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={formObservacao}
                  onChange={(e) => setFormObservacao(e.target.value)}
                  placeholder="Texto oficial auditável para prestação de contas Petrobras..."
                  className="w-full border border-slate-300 rounded-md p-2.5 text-slate-800 text-xs outline-none focus:border-slate-500 leading-relaxed"
                />
              </div>

              {/* Campo 5: Dados Clínicos Segregados (Exibido apenas em Atestado Médico) */}
              {formTipo === "ATESTADO_MEDICO" && (
                <div className="p-3.5 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-blue-950 text-xs">
                      <Stethoscope className="w-4 h-4 text-blue-600" />
                      <span>Dados Clínicos Homologados (SESMT)</span>
                    </div>
                    <span className="text-[10px] font-mono text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                      Art. 11 LGPD Protegido
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                        CID-10
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: M54.5"
                        value={formCid}
                        onChange={(e) => setFormCid(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 font-mono text-xs outline-none focus:border-blue-500 uppercase"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                        Médico Emissor
                      </label>
                      <input
                        type="text"
                        placeholder="Nome do profissional"
                        value={formMedico}
                        onChange={(e) => setFormMedico(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                        CRM / UF
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: CRM/MS 12345"
                        value={formCrm}
                        onChange={(e) => setFormCrm(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Rodapé do Formulário */}
              <div className="p-3 bg-slate-100 border-t border-slate-200 -mx-5 -mb-5 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setModalAberto(false);
                    limparFormulario();
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded text-xs shadow transition-colors cursor-pointer"
                >
                  {ocorrenciaEmEdicao ? "Salvar Alterações" : "Registrar Ocorrência"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
