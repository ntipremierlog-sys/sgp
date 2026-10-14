"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  ArrowRight,
  FileCheck,
  Copy,
  Clock,
  LayoutGrid,
  List,
  Building2,
  Briefcase,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import {
  carregarEstado,
  adicionarApontamento,
  responderApontamento,
  ApontamentoOperacional,
  PostoOperacional,
} from "@/lib/dados/estado-operacional";

// Função para extrair tags inteligentes de análise com base nas palavras-chave do texto
function extrairTagsAnalise(texto: string, resposta?: string): string[] {
  const tags: string[] = [];
  const combinado = `${texto} ${resposta || ""}`.toLowerCase();

  if (combinado.includes("desocupad") || combinado.includes("ausên") || combinado.includes("sem presença")) {
    tags.push("Desocupação de Posto");
  }
  if (combinado.includes("glosa") || combinado.includes("diária") || combinado.includes("medição")) {
    tags.push("Impacto em Glosa");
  }
  if (combinado.includes("substitut") || combinado.includes("cobertura") || combinado.includes("escala")) {
    tags.push("Cobertura Operacional");
  }
  if (combinado.includes("vago") || combinado.includes("alocação") || combinado.includes("admiss")) {
    tags.push("Posto Vago / Alocação");
  }
  if (combinado.includes("disciplinar") || combinado.includes("advertência")) {
    tags.push("Ação Disciplinar");
  }

  if (tags.length === 0) {
    tags.push("Conformidade Contratual");
  }

  return tags;
}

export default function ApontamentosPage() {
  const [apontamentos, setApontamentos] = useState<ApontamentoOperacional[]>([]);
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [perfilAtivo, setPerfilAtivo] = useState("PREMIER_ADMIN");
  const [busca, setBusca] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState<"TODAS" | "PETROBRAS" | "PREMIER">("TODAS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "PENDENTES" | "RESPONDIDOS">("TODOS");
  const [modoVisualizacao, setModoVisualizacao] = useState<"CARDS" | "TABELA">("CARDS");

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalRespostaAberto, setModalRespostaAberto] = useState(false);
  const [apontamentoSelecionado, setApontamentoSelecionado] = useState<ApontamentoOperacional | null>(null);

  // Formulário novo apontamento / observação
  const [formOrigem, setFormOrigem] = useState<"PETROBRAS" | "PREMIER">("PETROBRAS");
  const [formPostoCodigo, setFormPostoCodigo] = useState("");
  const [formDataReferencia, setFormDataReferencia] = useState("2026-09-08");
  const [formTexto, setFormTexto] = useState("");

  // Formulário de resposta / manifestação
  const [formResposta, setFormResposta] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const carregarDados = () => {
    const estado = carregarEstado();
    setApontamentos(estado.apontamentos || []);
    setPostos(estado.postos || []);
    setPerfilAtivo(estado.perfilAtivo || "PREMIER_ADMIN");
  };

  useEffect(() => {
    carregarDados();
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  const ehPerfilPetrobras = perfilAtivo.startsWith("PETROBRAS");

  // Ao abrir o modal, pré-configura a origem recomendada para o perfil
  const handleAbrirNovoModal = (origemInicial?: "PETROBRAS" | "PREMIER") => {
    if (origemInicial) {
      setFormOrigem(origemInicial);
    } else {
      setFormOrigem(ehPerfilPetrobras ? "PETROBRAS" : "PREMIER");
    }
    setModalNovoAberto(true);
  };

  // Filtragem dinâmica
  const apontamentosFiltrados = useMemo(() => {
    return apontamentos.filter((apt) => {
      const termo = busca.toLowerCase();
      const matchBusca =
        !busca ||
        apt.postoCodigo.toLowerCase().includes(termo) ||
        apt.funcaoPosto.toLowerCase().includes(termo) ||
        apt.texto.toLowerCase().includes(termo) ||
        (apt.respostaPremier && apt.respostaPremier.toLowerCase().includes(termo)) ||
        apt.criadoPor.toLowerCase().includes(termo);

      const origemItem = apt.origem || "PETROBRAS";
      const matchOrigem =
        filtroOrigem === "TODAS" ||
        (filtroOrigem === "PETROBRAS" && origemItem === "PETROBRAS") ||
        (filtroOrigem === "PREMIER" && origemItem === "PREMIER");

      const matchStatus =
        filtroStatus === "TODOS" ||
        (filtroStatus === "PENDENTES" && (apt.status === "ABERTO" || apt.status === "EM_TRATAMENTO")) ||
        (filtroStatus === "RESPONDIDOS" && (apt.status === "RESPONDIDO" || apt.status === "ENCERRADO"));

      return matchBusca && matchOrigem && matchStatus;
    });
  }, [apontamentos, busca, filtroOrigem, filtroStatus]);

  // Indicadores
  const totalApontamentos = apontamentos.length;
  const totalPetrobras = apontamentos.filter((a) => (a.origem || "PETROBRAS") === "PETROBRAS").length;
  const totalPremier = apontamentos.filter((a) => a.origem === "PREMIER").length;
  const pendentes = apontamentos.filter((a) => a.status === "ABERTO" || a.status === "EM_TRATAMENTO").length;
  const respondidos = apontamentos.filter((a) => a.status === "RESPONDIDO" || a.status === "ENCERRADO").length;

  const handleCopiarTexto = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setMensagemSucesso("Texto copiado para a área de transferência!");
    setTimeout(() => setMensagemSucesso(""), 3000);
  };

  const handleSubmitNovoApontamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPostoCodigo || !formTexto.trim()) {
      alert("Selecione o posto e informe o texto do apontamento/observação.");
      return;
    }

    const postoObj = postos.find((p) => p.codigoPosto === formPostoCodigo);
    if (!postoObj) return;

    const autor =
      formOrigem === "PETROBRAS"
        ? ehPerfilPetrobras
          ? "Fiscal Técnico Petrobras (Carlos Eduardo Mendes)"
          : "Fiscalização Petrobras"
        : "Marcos Valério (Preposto / Gestor Premier)";

    adicionarApontamento({
      postoCodigo: postoObj.codigoPosto,
      funcaoPosto: postoObj.funcao,
      dataReferencia: formDataReferencia,
      competencia: "Setembro / 2026",
      origem: formOrigem,
      texto: formTexto.trim(),
      criadoPor: autor,
      status: "ABERTO",
    });

    const rotuloTipo = formOrigem === "PETROBRAS" ? "Apontamento Petrobras" : "Observação Premier";
    setMensagemSucesso(`${rotuloTipo} registrado com sucesso para o posto ${postoObj.codigoPosto}!`);
    setModalNovoAberto(false);
    setFormPostoCodigo("");
    setFormTexto("");
    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  const handleSubmitResposta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apontamentoSelecionado || !formResposta.trim()) {
      alert("Informe a resposta ou manifestação.");
      return;
    }

    const autorResposta = ehPerfilPetrobras
      ? "Fiscal Técnico Petrobras"
      : "Gestor Premier (Marcos Valério)";

    responderApontamento(
      apontamentoSelecionado.id,
      formResposta.trim(),
      autorResposta
    );

    setMensagemSucesso(`Manifestação gravada para o posto ${apontamentoSelecionado.postoCodigo}!`);
    setModalRespostaAberto(false);
    setApontamentoSelecionado(null);
    setFormResposta("");
    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Topo Executivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            Apontamentos
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Registro e acompanhamento de apontamentos da fiscalização Petrobras e observações operacionais da Premier.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 shadow-xs transition-all"
          >
            <span>Mapa de Cobertura</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>

          <button
            onClick={() => handleAbrirNovoModal()}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Registro</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {mensagemSucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso("")} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cards de Métricas Executivas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Total de Registros
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalApontamentos}</span>
              <span className="text-xs text-slate-500">Geral</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Petrobras (Fiscalização)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalPetrobras}</span>
              <span className="text-xs text-slate-500">Notificações</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Premier (Operacional)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalPremier}</span>
              <span className="text-xs text-slate-500">Observações</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Pendentes de Resposta
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700">{pendentes}</span>
              <span className="text-xs text-amber-600 font-medium">{pendentes > 0 ? "Requer ação" : "Em dia"}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Busca e Alternador de Visão */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Campo de Busca */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar em textos, postos ou manifestações..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-all"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros em Abas e Alternador de Modo */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* Filtro de Origem: Todas | Petrobras | Premier */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setFiltroOrigem("TODAS")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                filtroOrigem === "TODAS"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Todas ({totalApontamentos})
            </button>
            <button
              onClick={() => setFiltroOrigem("PETROBRAS")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                filtroOrigem === "PETROBRAS"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Petrobras ({totalPetrobras})
            </button>
            <button
              onClick={() => setFiltroOrigem("PREMIER")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                filtroOrigem === "PREMIER"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Premier ({totalPremier})
            </button>
          </div>

          {/* Filtro Status em Tabs */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setFiltroStatus("TODOS")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                filtroStatus === "TODOS"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroStatus("PENDENTES")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                filtroStatus === "PENDENTES"
                  ? "bg-white text-amber-800 shadow-xs font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Pendentes ({pendentes})
            </button>
            <button
              onClick={() => setFiltroStatus("RESPONDIDOS")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                filtroStatus === "RESPONDIDOS"
                  ? "bg-white text-emerald-800 shadow-xs font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Respondidos ({respondidos})
            </button>
          </div>

          {/* Alternador de Modo */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-slate-600">
            <button
              onClick={() => setModoVisualizacao("CARDS")}
              className={`p-1 rounded-md transition-all cursor-pointer ${
                modoVisualizacao === "CARDS"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "hover:text-slate-900"
              }`}
              title="Modo Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setModoVisualizacao("TABELA")}
              className={`p-1 rounded-md transition-all cursor-pointer ${
                modoVisualizacao === "TABELA"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "hover:text-slate-900"
              }`}
              title="Modo Tabela"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FEED DE APONTAMENTOS / ANÁLISE DE TEXTO */}
      {apontamentosFiltrados.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs text-slate-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-600">Nenhum apontamento ou observação encontrado.</p>
          <p className="text-xs text-slate-400 mt-1">Tente ajustar os filtros de busca ou origem.</p>
        </div>
      ) : modoVisualizacao === "CARDS" ? (
        /* MODO CARDS */
        <div className="space-y-4">
          {apontamentosFiltrados.map((apt) => {
            const tags = extrairTagsAnalise(apt.texto, apt.respostaPremier);
            const isRespondido = apt.status === "RESPONDIDO" || apt.status === "ENCERRADO";
            const ehPetrobras = (apt.origem || "PETROBRAS") === "PETROBRAS";

            return (
              <div
                key={apt.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden hover:border-slate-300 transition-all"
              >
                {/* Cabeçalho do Card */}
                <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Badge de Origem */}
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border inline-flex items-center gap-1.5 ${
                        ehPetrobras
                          ? "bg-slate-100 text-slate-800 border-slate-300"
                          : "bg-blue-50 text-blue-900 border-blue-200"
                      }`}
                    >
                      {ehPetrobras ? (
                        <>
                          <Building2 className="w-3 h-3 text-slate-600" />
                          <span>Petrobras</span>
                        </>
                      ) : (
                        <>
                          <Briefcase className="w-3 h-3 text-blue-600" />
                          <span>Premier</span>
                        </>
                      )}
                    </span>

                    <span className="font-mono font-bold text-xs text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {apt.postoCodigo}
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {apt.funcaoPosto}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-mono">
                      Ref: {apt.dataReferencia}
                    </span>

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 ml-2">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isRespondido ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className={isRespondido ? "text-slate-700" : "text-amber-800"}>
                        {isRespondido ? "Respondido" : "Aguardando Resposta"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopiarTexto(apt.texto)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors ml-2 cursor-pointer"
                      title="Copiar texto"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Corpo Comparativo */}
                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Bloco de Origem (Quem abriu o registro) */}
                  <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          {ehPetrobras ? (
                            <>
                              <Building2 className="w-3.5 h-3.5 text-slate-600" />
                              Apontamento da Fiscalização Petrobras
                            </>
                          ) : (
                            <>
                              <Briefcase className="w-3.5 h-3.5 text-slate-600" />
                              Observação Operacional da Premier
                            </>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {apt.dataCriacao}
                        </span>
                      </div>

                      <p className="text-xs md:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                        &quot;{apt.texto}&quot;
                      </p>
                    </div>

                    <div className="mt-3 pt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-200">
                      <span>Registrado por: <strong className="text-slate-700">{apt.criadoPor}</strong></span>
                      <span className="text-[10px] font-mono text-slate-400">ID: {apt.id}</span>
                    </div>
                  </div>

                  {/* Bloco de Resposta / Contra-Evidência */}
                  <div
                    className={`rounded-xl p-4 border flex flex-col justify-between ${
                      apt.respostaPremier
                        ? "bg-white border-slate-200"
                        : "bg-amber-50/40 border-amber-200 border-dashed"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                          {ehPetrobras ? "Manifestação / Resposta Premier" : "Parecer da Fiscalização / Tratativa"}
                        </span>
                        {apt.respondidoEm && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {apt.respondidoEm}
                          </span>
                        )}
                      </div>

                      {apt.respostaPremier ? (
                        <p className="text-xs md:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                          &quot;{apt.respostaPremier}&quot;
                        </p>
                      ) : (
                        <div className="py-4 text-center">
                          <Clock className="w-6 h-6 text-amber-500 mx-auto mb-1.5" />
                          <p className="text-xs font-semibold text-amber-900">
                            Aguardando Manifestação
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {ehPetrobras
                              ? "A Premier deve analisar a notificação e registrar a contra-evidência."
                              : "Observação registrada para acompanhamento conjunto de fiscalização."}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2 flex items-center justify-between border-t border-slate-200">
                      {apt.respostaPremier ? (
                        <>
                          <span className="text-[11px] text-slate-500">
                            Manifestado por: <strong className="text-slate-700">{apt.respondidoPor}</strong>
                          </span>
                          <button
                            onClick={() => {
                              setApontamentoSelecionado(apt);
                              setFormResposta(apt.respostaPremier || "");
                              setModalRespostaAberto(true);
                            }}
                            className="text-xs text-slate-700 hover:text-slate-900 font-medium underline cursor-pointer"
                          >
                            Editar Manifestação
                          </button>
                        </>
                      ) : (
                        <div className="w-full flex justify-end">
                          <button
                            onClick={() => {
                              setApontamentoSelecionado(apt);
                              setFormResposta("");
                              setModalRespostaAberto(true);
                            }}
                            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer"
                          >
                            <Send className="w-3 h-3 text-slate-300" />
                            <span>Registrar Manifestação</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MODO TABELA */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Posto</th>
                  <th className="py-3 px-4">Origem</th>
                  <th className="py-3 px-4">Data Ref.</th>
                  <th className="py-3 px-4">Texto do Registro</th>
                  <th className="py-3 px-4">Manifestação / Resposta</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apontamentosFiltrados.map((apt) => {
                  const ehPetrobras = (apt.origem || "PETROBRAS") === "PETROBRAS";
                  return (
                    <tr key={apt.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        <div>{apt.postoCodigo}</div>
                        <div className="text-[10px] font-sans text-slate-500 font-normal">
                          {apt.funcaoPosto}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                            ehPetrobras
                              ? "bg-slate-100 text-slate-800 border-slate-300"
                              : "bg-blue-50 text-blue-900 border-blue-200"
                          }`}
                        >
                          {ehPetrobras ? "Petrobras" : "Premier"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {apt.dataReferencia}
                      </td>
                      <td className="py-3 px-4 max-w-sm text-slate-800">
                        <div className="leading-relaxed font-normal">
                          {apt.texto}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Por: {apt.criadoPor}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-sm text-slate-700">
                        {apt.respostaPremier ? (
                          <div className="leading-relaxed font-normal text-slate-800">
                            {apt.respostaPremier}
                          </div>
                        ) : (
                          <span className="text-amber-700 font-medium italic">
                            Aguardando manifestação
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            apt.status === "RESPONDIDO" ? "text-slate-800" : "text-amber-800"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              apt.status === "RESPONDIDO" ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          {apt.status === "RESPONDIDO" ? "Respondido" : "Pendente"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setApontamentoSelecionado(apt);
                            setFormResposta(apt.respostaPremier || "");
                            setModalRespostaAberto(true);
                          }}
                          className="px-2.5 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded font-medium transition-colors cursor-pointer"
                        >
                          {apt.respostaPremier ? "Editar" : "Responder"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Resposta / Manifestação */}
      {modalRespostaAberto && apontamentoSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-slate-300" />
                <h3 className="font-semibold text-sm">
                  {apontamentoSelecionado.origem === "PREMIER"
                    ? "Parecer / Tratativa do Registro"
                    : "Manifestação Formal da Premier Logistics"}
                </h3>
              </div>
              <button
                onClick={() => setModalRespostaAberto(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitResposta} className="p-5 space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-slate-700 font-medium">
                  <span className="font-mono text-slate-900 font-bold">
                    {apontamentoSelecionado.postoCodigo} — {apontamentoSelecionado.funcaoPosto}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Data: {apontamentoSelecionado.dataReferencia}
                  </span>
                </div>
                <div className="text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 text-xs md:text-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    {apontamentoSelecionado.origem === "PREMIER"
                      ? "Observação Registrada pela Premier:"
                      : "Apontamento Registrado pela Fiscalização Petrobras:"}
                  </span>
                  &quot;{apontamentoSelecionado.texto}&quot;
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Manifestação / Resposta <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formResposta}
                  onChange={(e) => setFormResposta(e.target.value)}
                  placeholder="Apresente as justificativas operacionais, substituição na escala, contraprova ou esclarecimentos..."
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-slate-400 resize-none leading-relaxed transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalRespostaAberto(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gravar Manifestação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Registro (Petrobras ou Premier) */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <h3 className="font-semibold text-sm">Novo Apontamento / Observação</h3>
              </div>
              <button
                onClick={() => setModalNovoAberto(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovoApontamento} className="p-5 space-y-4 text-xs">
              {/* Seletor de Origem: Petrobras x Premier */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Origem do Registro <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormOrigem("PETROBRAS")}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      formOrigem === "PETROBRAS"
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Petrobras (Fiscalização)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormOrigem("PREMIER")}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      formOrigem === "PREMIER"
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Premier (Operação / RH)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Posto Notificado / Observado <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formPostoCodigo}
                    onChange={(e) => setFormPostoCodigo(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                  >
                    <option value="">Selecione o posto...</option>
                    {postos.map((p) => (
                      <option key={p.codigoPosto} value={p.codigoPosto}>
                        {p.codigoPosto} — {p.funcao}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Data da Ocorrência <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDataReferencia}
                    onChange={(e) => setFormDataReferencia(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {formOrigem === "PETROBRAS"
                    ? "Texto Formal do Apontamento da Fiscalização"
                    : "Observação Operacional da Premier"}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formTexto}
                  onChange={(e) => setFormTexto(e.target.value)}
                  placeholder={
                    formOrigem === "PETROBRAS"
                      ? "Descreva com precisão a inconformidade de ocupação ou ausência verificada no posto..."
                      : "Descreva a observação operacional, contingência, justificativa de escala ou aviso da Premier..."
                  }
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-slate-400 resize-none leading-relaxed transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {formOrigem === "PETROBRAS" ? "Registrar Apontamento" : "Registrar Observação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
