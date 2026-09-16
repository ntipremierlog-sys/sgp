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
} from "lucide-react";
import {
  carregarEstado,
  adicionarOcorrencia,
  OcorrenciaOperacional,
  ProfissionalOperacional,
} from "@/lib/dados/estado-operacional";

function obterIniciais(nome: string): string {
  const partes = (nome || "").trim().split(/\s+/);
  if (!partes[0]) return "--";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function formatTipoTexto(tipo: string): { label: string; dotClass: string; avatarClass: string } {
  switch (tipo) {
    case "ATESTADO_MEDICO":
      return {
        label: "Atestado Médico",
        dotClass: "bg-blue-500",
        avatarClass: "bg-blue-100 text-blue-800",
      };
    case "FALTA_INJUSTIFICADA":
      return {
        label: "Falta Injustificada",
        dotClass: "bg-rose-500",
        avatarClass: "bg-rose-100 text-rose-800",
      };
    case "FALTA_JUSTIFICADA":
      return {
        label: "Falta Justificada",
        dotClass: "bg-amber-500",
        avatarClass: "bg-amber-100 text-amber-800",
      };
    case "FERIAS":
      return {
        label: "Férias Contratuais",
        dotClass: "bg-emerald-500",
        avatarClass: "bg-emerald-100 text-emerald-800",
      };
    case "TREINAMENTO":
      return {
        label: "Treinamento NR",
        dotClass: "bg-purple-500",
        avatarClass: "bg-purple-100 text-purple-800",
      };
    default:
      return {
        label: tipo,
        dotClass: "bg-slate-400",
        avatarClass: "bg-slate-100 text-slate-700",
      };
  }
}

export default function OcorrenciasPage() {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  const [perfilAtivo, setPerfilAtivo] = useState("PREMIER_ADMIN");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "ATESTADO" | "FALTA" | "OUTROS">("TODOS");
  const [modoVisualizacao, setModoVisualizacao] = useState<"CARDS" | "TABELA">("CARDS");

  // Modais
  const [modalAberto, setModalAberto] = useState(false);
  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] = useState<OcorrenciaOperacional | null>(null);

  // Formulário nova ocorrência
  const [formMatricula, setFormMatricula] = useState("");
  const [formTipo, setFormTipo] = useState<OcorrenciaOperacional["tipoOcorrencia"]>("ATESTADO_MEDICO");
  const [formDataInicio, setFormDataInicio] = useState("2026-09-15");
  const [formDataFim, setFormDataFim] = useState("2026-09-15");
  const [formObservacao, setFormObservacao] = useState("");
  const [formCid, setFormCid] = useState("");
  const [formMedico, setFormMedico] = useState("");
  const [formCrm, setFormCrm] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const carregarDados = () => {
    const estado = carregarEstado();
    setOcorrencias(estado.ocorrencias);
    setProfissionais(estado.profissionais);
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
      } else if (filtroTipo === "OUTROS") {
        matchTipo = oc.tipoOcorrencia === "TREINAMENTO" || oc.tipoOcorrencia === "FERIAS";
      }

      return matchBusca && matchTipo;
    });
  }, [ocorrencias, busca, filtroTipo]);

  // Indicadores
  const totalOcorrencias = ocorrencias.length;
  const atestados = ocorrencias.filter((o) => o.tipoOcorrencia === "ATESTADO_MEDICO").length;
  const faltasInjustificadas = ocorrencias.filter((o) => o.tipoOcorrencia === "FALTA_INJUSTIFICADA").length;
  const validadas = ocorrencias.filter((o) => o.status === "VALIDADA").length;

  const handleCopiarJustificativa = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setMensagemSucesso("Justificativa copiada para a área de transferência!");
    setTimeout(() => setMensagemSucesso(""), 3000);
  };

  const handleSubmitNovaOcorrencia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMatricula || !formDataInicio || !formDataFim) {
      alert("Preencha o colaborador e o período da ocorrência.");
      return;
    }

    const prof = profissionais.find((p) => p.matricula === formMatricula);
    if (!prof) return;

    const dIni = new Date(formDataInicio);
    const dFim = new Date(formDataFim);
    const diffTime = Math.abs(dFim.getTime() - dIni.getTime());
    const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let obsPadrao = formObservacao;
    if (!obsPadrao) {
      if (formTipo === "ATESTADO_MEDICO") obsPadrao = "Ausência justificada — atestado médico homologado pelo SESMT";
      else if (formTipo === "FALTA_INJUSTIFICADA") obsPadrao = "Ausência não justificada — passível de glosa na medição";
      else if (formTipo === "FALTA_JUSTIFICADA") obsPadrao = "Falta justificada nos termos legais";
      else if (formTipo === "TREINAMENTO") obsPadrao = "Treinamento obrigatório de Segurança NR-11";
      else if (formTipo === "FERIAS") obsPadrao = "Gozo regular de férias contratuais";
      else obsPadrao = "Ocorrência operacional registrada";
    }

    adicionarOcorrencia({
      matricula: prof.matricula,
      profissionalNome: prof.nome,
      postoCodigo: prof.postoCodigo,
      tipoOcorrencia: formTipo,
      dataInicio: formDataInicio,
      dataFim: formDataFim,
      diasAfetados: dias,
      status: "VALIDADA",
      observacaoPublica: obsPadrao,
      dadoSensivel:
        formTipo === "ATESTADO_MEDICO"
          ? {
              cid: formCid || undefined,
              profissionalEmissor: formMedico || undefined,
              crm: formCrm || undefined,
            }
          : undefined,
    });

    setMensagemSucesso(`Ocorrência registrada com sucesso para ${prof.nome}!`);
    setModalAberto(false);
    setFormMatricula("");
    setFormObservacao("");
    setFormCid("");
    setFormMedico("");
    setFormCrm("");

    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Topo Executivo Limpo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-sm">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            Ocorrências & Afastamentos
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Controle de atestados, faltas e afastamentos operacionais com salvaguarda de dados.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/coberturas"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 shadow-sm transition-all"
          >
            <span>Ver Coberturas</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Lançar Ocorrência</span>
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

      {/* Cards de Métricas Executivas (Clean & Diretos) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Total Ocorrências
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalOcorrencias}</span>
              <span className="text-xs text-slate-500">Mês vigente</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Atestados Homologados
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-700">{atestados}</span>
              <span className="text-xs text-blue-600 font-medium">Médicos / SESMT</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <HeartPulse className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Faltas Não Justificadas
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-700">{faltasInjustificadas}</span>
              <span className="text-xs text-rose-600 font-medium">Risco de glosa</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Status de Auditoria
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700">{validadas}</span>
              <span className="text-xs text-emerald-600 font-medium">Validadas</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Busca Rápida e Alternador de Visão */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Campo de Busca */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por colaborador, posto ou motivo..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-premier-700 transition-all"
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

        {/* Abas Rápidas e Alternador */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setFiltroTipo("TODOS")}
              className={`px-3 py-1 rounded-md transition-all ${
                filtroTipo === "TODOS"
                  ? "bg-white text-slate-900 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Todas ({totalOcorrencias})
            </button>
            <button
              onClick={() => setFiltroTipo("ATESTADO")}
              className={`px-3 py-1 rounded-md transition-all ${
                filtroTipo === "ATESTADO"
                  ? "bg-white text-blue-800 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Atestados ({atestados})
            </button>
            <button
              onClick={() => setFiltroTipo("FALTA")}
              className={`px-3 py-1 rounded-md transition-all ${
                filtroTipo === "FALTA"
                  ? "bg-white text-rose-800 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Faltas ({faltasInjustificadas})
            </button>
            <button
              onClick={() => setFiltroTipo("OUTROS")}
              className={`px-3 py-1 rounded-md transition-all ${
                filtroTipo === "OUTROS"
                  ? "bg-white text-slate-900 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Treinamentos / Férias
            </button>
          </div>

          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-slate-600">
            <button
              onClick={() => setModoVisualizacao("CARDS")}
              className={`p-1 rounded-md transition-all ${
                modoVisualizacao === "CARDS"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "hover:text-slate-900"
              }`}
              title="Modo Cards de Ocorrência (Recomendado)"
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

      {/* FEED DE OCORRÊNCIAS */}
      {ocorrenciasFiltradas.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200/80 shadow-sm text-slate-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-600">Nenhuma ocorrência encontrada.</p>
          <p className="text-xs text-slate-400 mt-1">Tente ajustar a busca ou os filtros de tipo.</p>
        </div>
      ) : modoVisualizacao === "CARDS" ? (
        /* MODO CARDS DE OCORRÊNCIA (Moderno, Fluido e Limpo) */
        <div className="space-y-4">
          {ocorrenciasFiltradas.map((oc) => {
            const tipoInfo = formatTipoTexto(oc.tipoOcorrencia);
            return (
              <div
                key={oc.id}
                className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden hover:border-slate-300 transition-all"
              >
                {/* Topo do Card */}
                <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-bold text-xs text-premier-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {oc.postoCodigo || "Reserva"}
                    </span>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${tipoInfo.dotClass}`} />
                      <span>{tipoInfo.label}</span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-mono">
                      {oc.dataInicio === oc.dataFim ? oc.dataInicio : `${oc.dataInicio} a ${oc.dataFim}`}
                    </span>
                    <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                      {oc.diasAfetados} {oc.diasAfetados === 1 ? "dia" : "dias"} de ausência
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          oc.status === "VALIDADA" ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="text-slate-700 font-medium">
                        {oc.status === "VALIDADA" ? "Homologada" : "Em Validação"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopiarJustificativa(oc.observacaoPublica)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                      title="Copiar justificativa"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Corpo do Card */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Colaborador com Avatar */}
                  <div className="md:col-span-4 flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${tipoInfo.avatarClass}`}
                    >
                      {obterIniciais(oc.profissionalNome)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm leading-snug">
                        {oc.profissionalNome}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Matrícula: {oc.matricula}
                      </div>
                    </div>
                  </div>

                  {/* Detalhes Médicos / LGPD */}
                  <div className="md:col-span-4">
                    {oc.dadoSensivel?.cid ? (
                      ehPerfilPetrobras ? (
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Diagnóstico protegido (Art. 11 LGPD)</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-700">
                          <div className="font-mono font-semibold text-blue-900">
                            CID-10: {oc.dadoSensivel.cid}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {oc.dadoSensivel.profissionalEmissor || "Dr. Homologador SESMT"}
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="text-xs text-slate-400">
                        Ausência administrativa / operacional
                      </div>
                    )}
                  </div>

                  {/* Ações Rápidas */}
                  <div className="md:col-span-4 flex items-center justify-end gap-2.5">
                    <Link
                      href="/coberturas"
                      className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all"
                    >
                      <span>Designar Cobertura</span>
                      <ArrowRight className="w-3 h-3 text-emerald-400" />
                    </Link>
                    <button
                      onClick={() => setOcorrenciaSelecionada(oc)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Ficha
                    </button>
                  </div>

                  {/* Justificativa / Rótulo Público em destaque */}
                  <div className="md:col-span-12 pt-2.5 mt-1 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700 shrink-0">Motivo Auditável:</span>
                    <p className="text-slate-800 leading-relaxed font-normal">
                      &quot;{oc.observacaoPublica}&quot;
                    </p>
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
                  <th className="py-3 px-4">Colaborador / Titular</th>
                  <th className="py-3 px-4">Posto</th>
                  <th className="py-3 px-4">Classificação</th>
                  <th className="py-3 px-4">Período de Ausência</th>
                  <th className="py-3 px-4">Rótulo Público (Auditável)</th>
                  <th className="py-3 px-4">Dado Sensível (LGPD)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ocorrenciasFiltradas.map((oc) => {
                  const tipoInfo = formatTipoTexto(oc.tipoOcorrencia);
                  return (
                    <tr key={oc.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Colaborador */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 text-xs">
                          {oc.profissionalNome}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {oc.matricula}
                        </div>
                      </td>

                      {/* Posto Titular (Sem caixa retangular) */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {oc.postoCodigo || "Reserva"}
                      </td>

                      {/* Classificação (Sem fundo de caixa / badge) */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${tipoInfo.dotClass}`} />
                          <span className="font-medium text-slate-800">
                            {tipoInfo.label}
                          </span>
                        </div>
                      </td>

                      {/* Período */}
                      <td className="py-3 px-4 font-mono text-slate-700">
                        <div>
                          {oc.dataInicio === oc.dataFim ? (
                            <span>{oc.dataInicio}</span>
                          ) : (
                            <span>{oc.dataInicio} a {oc.dataFim}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {oc.diasAfetados} dia(s)
                        </div>
                      </td>

                      {/* Rótulo Público */}
                      <td className="py-3 px-4 max-w-xs text-slate-700 font-normal">
                        <div className="line-clamp-2 leading-relaxed" title={oc.observacaoPublica}>
                          {oc.observacaoPublica}
                        </div>
                      </td>

                      {/* Dado Sensível (Sem caixa / pill) */}
                      <td className="py-3 px-4">
                        {oc.dadoSensivel?.cid ? (
                          ehPerfilPetrobras ? (
                            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-slate-400" /> Restrito LGPD
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono font-medium text-slate-700">
                              CID: {oc.dadoSensivel.cid}
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Sem dados clínicos
                          </span>
                        )}
                      </td>

                      {/* Status (Sem caixa retangular verde) */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 justify-center">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              oc.status === "VALIDADA" ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          <span className="text-slate-800 font-medium text-xs">
                            {oc.status}
                          </span>
                        </div>
                      </td>

                      {/* Ação */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setOcorrenciaSelecionada(oc)}
                          className="text-xs text-premier-900 hover:text-premier-700 font-semibold underline"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé da tabela com total */}
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Mostrando <strong>{ocorrenciasFiltradas.length}</strong> de{" "}
              <strong>{totalOcorrencias}</strong> ocorrências
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Setembro / 2026
            </span>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Ocorrência */}
      {ocorrenciaSelecionada && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-sm">Ficha da Ocorrência: {ocorrenciaSelecionada.id}</h3>
              </div>
              <button
                onClick={() => setOcorrenciaSelecionada(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Colaborador</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{ocorrenciaSelecionada.profissionalNome}</div>
                  <div className="font-mono text-slate-400 text-[11px]">Matrícula: {ocorrenciaSelecionada.matricula}</div>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Posto do Titular</span>
                  <div className="font-mono font-bold text-premier-900 mt-0.5">
                    {ocorrenciaSelecionada.postoCodigo || "Reserva Técnica"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Tipo</span>
                  <div className="font-medium text-slate-800 mt-0.5">{ocorrenciaSelecionada.tipoOcorrencia}</div>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Período</span>
                  <div className="font-mono text-slate-800 mt-0.5">
                    {ocorrenciaSelecionada.dataInicio} a {ocorrenciaSelecionada.dataFim}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Duração</span>
                  <div className="font-bold text-slate-800 mt-0.5">{ocorrenciaSelecionada.diasAfetados} dia(s)</div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">
                  Rótulo Público (Auditável Petrobras)
                </span>
                <p className="mt-1 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed font-normal">
                  &quot;{ocorrenciaSelecionada.observacaoPublica}&quot;
                </p>
              </div>

              {/* Seção Dado Sensível */}
              {ocorrenciaSelecionada.tipoOcorrencia === "ATESTADO_MEDICO" && (
                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
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
                      O diagnóstico e dados médicos do profissional são protegidos nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-400">CID-10:</span>
                        <div className="font-mono font-bold text-blue-900">{ocorrenciaSelecionada.dadoSensivel?.cid || "Não informado"}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">Profissional Emissor:</span>
                        <div className="font-medium text-slate-800">
                          {ocorrenciaSelecionada.dadoSensivel?.profissionalEmissor || "Dr. Homologador SESMT"} ({ocorrenciaSelecionada.dadoSensivel?.crm || "CRM"})
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setOcorrenciaSelecionada(null)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 text-xs transition-colors"
              >
                Fechar
              </button>
              <Link
                href="/coberturas"
                className="px-4 py-1.5 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded-lg text-xs shadow transition-colors"
              >
                Designar Cobertura para este Posto
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lançar Nova Ocorrência */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-sm">Lançar Ocorrência Operacional</h3>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovaOcorrencia} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Colaborador Afetado <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formMatricula}
                  onChange={(e) => setFormMatricula(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-premier-700 transition-colors"
                >
                  <option value="">Selecione o colaborador...</option>
                  {profissionais.map((p) => (
                    <option key={p.matricula} value={p.matricula}>
                      {p.nome} ({p.matricula}) — {p.postoCodigo || "Reserva"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tipo</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as OcorrenciaOperacional["tipoOcorrencia"])}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-800 outline-none focus:border-premier-700 transition-colors"
                  >
                    <option value="ATESTADO_MEDICO">Atestado Médico</option>
                    <option value="FALTA_INJUSTIFICADA">Falta Injustificada</option>
                    <option value="FALTA_JUSTIFICADA">Falta Justificada</option>
                    <option value="TREINAMENTO">Treinamento NR</option>
                    <option value="FERIAS">Férias</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Data Início</label>
                  <input
                    type="date"
                    required
                    value={formDataInicio}
                    onChange={(e) => setFormDataInicio(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-premier-700 transition-colors"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Data Término</label>
                  <input
                    type="date"
                    required
                    value={formDataFim}
                    onChange={(e) => setFormDataFim(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-premier-700 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Justificativa / Rótulo Público Auditável
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ausência justificada — atestado médico homologado"
                  value={formObservacao}
                  onChange={(e) => setFormObservacao(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-premier-700 transition-colors"
                />
              </div>

              {formTipo === "ATESTADO_MEDICO" && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <span className="font-semibold text-slate-700 block text-[11px]">
                    Dados Médicos Segregados (Acesso Exclusivo Premier RH)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">CID-10</label>
                      <input
                        type="text"
                        placeholder="Ex: M54.5"
                        value={formCid}
                        onChange={(e) => setFormCid(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Médico Emissor</label>
                      <input
                        type="text"
                        placeholder="Nome do médico"
                        value={formMedico}
                        onChange={(e) => setFormMedico(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">CRM</label>
                      <input
                        type="text"
                        placeholder="Ex: CRM/MS 12345"
                        value={formCrm}
                        onChange={(e) => setFormCrm(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded-lg shadow transition-colors"
                >
                  Confirmar Ocorrência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
