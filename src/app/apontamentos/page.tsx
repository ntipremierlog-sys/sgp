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
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "PENDENTES" | "RESPONDIDOS">("TODOS");
  const [modoVisualizacao, setModoVisualizacao] = useState<"CARDS" | "TABELA">("CARDS");

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalRespostaAberto, setModalRespostaAberto] = useState(false);
  const [apontamentoSelecionado, setApontamentoSelecionado] = useState<ApontamentoOperacional | null>(null);

  // Formulário novo apontamento
  const [formPostoCodigo, setFormPostoCodigo] = useState("");
  const [formDataReferencia, setFormDataReferencia] = useState("2026-09-08");
  const [formTexto, setFormTexto] = useState("");

  // Formulário de resposta Premier
  const [formResposta, setFormResposta] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const carregarDados = () => {
    const estado = carregarEstado();
    setApontamentos(estado.apontamentos);
    setPostos(estado.postos);
    setPerfilAtivo(estado.perfilAtivo);
  };

  useEffect(() => {
    carregarDados();
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  const ehPerfilPetrobras = perfilAtivo.startsWith("PETROBRAS");

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

      const matchStatus =
        filtroStatus === "TODOS" ||
        (filtroStatus === "PENDENTES" && (apt.status === "ABERTO" || apt.status === "EM_TRATAMENTO")) ||
        (filtroStatus === "RESPONDIDOS" && (apt.status === "RESPONDIDO" || apt.status === "ENCERRADO"));

      return matchBusca && matchStatus;
    });
  }, [apontamentos, busca, filtroStatus]);

  // Indicadores
  const totalApontamentos = apontamentos.length;
  const pendentes = apontamentos.filter((a) => a.status === "ABERTO" || a.status === "EM_TRATAMENTO").length;
  const respondidos = apontamentos.filter((a) => a.status === "RESPONDIDO" || a.status === "ENCERRADO").length;
  const taxaResolucao = totalApontamentos > 0 ? Math.round((respondidos / totalApontamentos) * 100) : 100;

  const handleCopiarTexto = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setMensagemSucesso("Texto do apontamento copiado para a área de transferência!");
    setTimeout(() => setMensagemSucesso(""), 3000);
  };

  const handleSubmitNovoApontamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPostoCodigo || !formTexto.trim()) {
      alert("Selecione o posto e informe o texto do apontamento.");
      return;
    }

    const postoObj = postos.find((p) => p.codigoPosto === formPostoCodigo);
    if (!postoObj) return;

    adicionarApontamento({
      postoCodigo: postoObj.codigoPosto,
      funcaoPosto: postoObj.funcao,
      dataReferencia: formDataReferencia,
      competencia: "Setembro / 2026",
      texto: formTexto.trim(),
      criadoPor: ehPerfilPetrobras
        ? "Fiscal Petrobras (Carlos Eduardo Mendes)"
        : "Auditoria Contratual Petrobras",
      status: "ABERTO",
    });

    setMensagemSucesso(`Apontamento formal registrado para o posto ${postoObj.codigoPosto}!`);
    setModalNovoAberto(false);
    setFormPostoCodigo("");
    setFormTexto("");
    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  const handleSubmitResposta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apontamentoSelecionado || !formResposta.trim()) {
      alert("Informe a resposta ou contra-evidência da Premier.");
      return;
    }

    responderApontamento(
      apontamentoSelecionado.id,
      formResposta.trim(),
      "Gestor Premier (Marcos Valério)"
    );

    setMensagemSucesso(`Manifestação gravada para o apontamento do posto ${apontamentoSelecionado.postoCodigo}!`);
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
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-sm">
              <MessageSquare className="w-4 h-4" />
            </div>
            Apontamentos da Fiscalização Petrobras
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Análise aprofundada de inconformidades, notificações de postos e contra-evidências operacionais.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 shadow-sm transition-all"
          >
            <span>Mapa de Cobertura</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>

          <button
            onClick={() => setModalNovoAberto(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Apontamento</span>
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

      {/* Cards de Métricas Executivas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Total de Notificações
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalApontamentos}</span>
              <span className="text-xs text-slate-500">Setembro/2026</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Pendentes de Resposta
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700">{pendentes}</span>
              <span className="text-xs text-amber-600 font-medium">Exigem ação</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Respondidos / Concluídos
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700">{respondidos}</span>
              <span className="text-xs text-emerald-600 font-medium">Com contraprova</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Taxa de Resolução
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{taxaResolucao}%</span>
              <span className="text-xs text-slate-500">Conformidade R2</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Busca e Alternador de Visão */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Campo de Busca de Análise */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar em textos de apontamento, postos ou respostas..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-700 transition-all"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Abas Rápidas e Alternador de Visualização */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Filtro Status em Tabs */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setFiltroStatus("TODOS")}
              className={`px-3 py-1 rounded-md transition-all ${
                filtroStatus === "TODOS"
                  ? "bg-white text-slate-900 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Todos ({totalApontamentos})
            </button>
            <button
              onClick={() => setFiltroStatus("PENDENTES")}
              className={`px-3 py-1 rounded-md transition-all ${
                filtroStatus === "PENDENTES"
                  ? "bg-white text-amber-800 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Pendentes ({pendentes})
            </button>
            <button
              onClick={() => setFiltroStatus("RESPONDIDOS")}
              className={`px-3 py-1 rounded-md transition-all ${
                filtroStatus === "RESPONDIDOS"
                  ? "bg-white text-emerald-800 shadow-sm font-semibold"
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
              className={`p-1 rounded-md transition-all ${
                modoVisualizacao === "CARDS"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "hover:text-slate-900"
              }`}
              title="Modo Análise em Cards (Recomendado para leitura)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setModoVisualizacao("TABELA")}
              className={`p-1 rounded-md transition-all ${
                modoVisualizacao === "TABELA"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "hover:text-slate-900"
              }`}
              title="Modo Tabela Compacta"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FEED DE APONTAMENTOS / ANÁLISE DE TEXTO */}
      {apontamentosFiltrados.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200/80 shadow-sm text-slate-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-600">Nenhum apontamento encontrado.</p>
          <p className="text-xs text-slate-400 mt-1">Tente ajustar o termo de busca ou o filtro de status.</p>
        </div>
      ) : modoVisualizacao === "CARDS" ? (
        /* MODO CARDS DE ANÁLISE (Foco total em ler, analisar e entender o contraponto) */
        <div className="space-y-4">
          {apontamentosFiltrados.map((apt) => {
            const tags = extrairTagsAnalise(apt.texto, apt.respostaPremier);
            const isRespondido = apt.status === "RESPONDIDO" || apt.status === "ENCERRADO";

            return (
              <div
                key={apt.id}
                className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden hover:border-slate-300 transition-all"
              >
                {/* Cabeçalho do Card */}
                <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-bold text-xs text-premier-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {apt.postoCodigo}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {apt.funcaoPosto}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-mono">
                      Ref: {apt.dataReferencia}
                    </span>

                    {/* Tags de análise técnica */}
                    <div className="flex items-center gap-1.5 ml-2">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-medium bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full"
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
                      <span className={isRespondido ? "text-emerald-800" : "text-amber-800"}>
                        {isRespondido ? "Respondido" : "Aguardando Resposta"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopiarTexto(apt.texto)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors ml-2"
                      title="Copiar texto do apontamento"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Corpo de Análise Comparativa (Petrobras x Premier) */}
                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Bloco Petrobras (Apontamento para análise) */}
                  <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-200/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                          Apontamento Formal da Fiscalização
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {apt.dataCriacao}
                        </span>
                      </div>

                      {/* Texto Completo e Confortável para Leitura */}
                      <p className="text-xs md:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                        &quot;{apt.texto}&quot;
                      </p>
                    </div>

                    <div className="mt-3 pt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-200/40">
                      <span>Registrado por: <strong>{apt.criadoPor}</strong></span>
                      <span className="text-[10px] font-mono text-slate-400">ID: {apt.id}</span>
                    </div>
                  </div>

                  {/* Bloco Premier (Manifestação / Resposta da Contratada) */}
                  <div
                    className={`rounded-xl p-4 border flex flex-col justify-between ${
                      apt.respostaPremier
                        ? "bg-emerald-50/40 border-emerald-200/70"
                        : "bg-amber-50/30 border-amber-200/60 border-dashed"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/50">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Manifestação / Contra-Evidência Premier
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
                            Pendente de Resposta da Contratada
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Analise a notificação ao lado e informe a justificativa ou aceite da glosa.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2 flex items-center justify-between border-t border-slate-200/40">
                      {apt.respostaPremier ? (
                        <>
                          <span className="text-[11px] text-slate-500">
                            Respondido por: <strong>{apt.respondidoPor}</strong>
                          </span>
                          <button
                            onClick={() => {
                              setApontamentoSelecionado(apt);
                              setFormResposta(apt.respostaPremier || "");
                              setModalRespostaAberto(true);
                            }}
                            className="text-xs text-slate-600 hover:text-slate-900 font-semibold underline"
                          >
                            Editar Resposta
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
                            className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all"
                          >
                            <Send className="w-3 h-3 text-emerald-400" />
                            <span>Registrar Resposta Premier</span>
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
        /* MODO TABELA COMPACTA (Visão tabular clássica moderna) */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Posto Notificado</th>
                  <th className="py-3 px-4">Data Ref.</th>
                  <th className="py-3 px-4">Apontamento Petrobras (Texto)</th>
                  <th className="py-3 px-4">Manifestação Premier</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apontamentosFiltrados.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      <div>{apt.postoCodigo}</div>
                      <div className="text-[10px] font-sans text-slate-500 font-normal">
                        {apt.funcaoPosto}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {apt.dataReferencia}
                    </td>
                    <td className="py-3 px-4 max-w-md text-slate-800">
                      <div className="leading-relaxed font-normal">
                        {apt.texto}
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-md text-slate-700">
                      {apt.respostaPremier ? (
                        <div className="leading-relaxed text-emerald-900 font-normal">
                          {apt.respostaPremier}
                        </div>
                      ) : (
                        <span className="text-amber-700 font-medium italic">
                          Aguardando resposta
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          apt.status === "RESPONDIDO" ? "text-emerald-700" : "text-amber-700"
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
                        className="text-xs text-premier-900 hover:text-premier-700 font-semibold underline"
                      >
                        {apt.respostaPremier ? "Editar" : "Responder"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Resposta / Manifestação Premier */}
      {modalRespostaAberto && apontamentoSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-sm">Manifestação Formal da Premier Logistics</h3>
              </div>
              <button
                onClick={() => setModalRespostaAberto(false)}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitResposta} className="p-5 space-y-4 text-xs">
              {/* Leitura da Alegação Petrobras para Apoio da Análise */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-slate-700 font-medium">
                  <span className="font-mono text-premier-900 font-bold">
                    {apontamentoSelecionado.postoCodigo} — {apontamentoSelecionado.funcaoPosto}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Ocorrência em: {apontamentoSelecionado.dataReferencia}
                  </span>
                </div>
                <div className="text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 text-xs md:text-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Apontamento Formal da Fiscalização:
                  </span>
                  &quot;{apontamentoSelecionado.texto}&quot;
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Resposta / Contra-Evidência da Premier <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formResposta}
                  onChange={(e) => setFormResposta(e.target.value)}
                  placeholder="Apresente as justificativas operacionais, substituição na escala ou reconhecimento de glosa para a Memória de Cálculo..."
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-premier-700 resize-none leading-relaxed transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalRespostaAberto(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded-lg shadow transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Gravar Manifestação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Apontamento Petrobras */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <h3 className="font-semibold text-sm">Novo Apontamento Formal da Fiscalização</h3>
              </div>
              <button
                onClick={() => setModalNovoAberto(false)}
                className="text-emerald-200 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovoApontamento} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Posto Notificado <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formPostoCodigo}
                    onChange={(e) => setFormPostoCodigo(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-emerald-700 transition-colors"
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
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-emerald-700 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Texto Formal do Apontamento <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formTexto}
                  onChange={(e) => setFormTexto(e.target.value)}
                  placeholder="Descreva com precisão a inconformidade de ocupação ou ausência verificada em campo na UFN III..."
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-emerald-700 resize-none leading-relaxed transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow transition-colors"
                >
                  Registrar Notificação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
