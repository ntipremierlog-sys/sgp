"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  UserCheck2,
  Search,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Clock,
  X,
  ArrowRight,
  Copy,
  LayoutGrid,
  List,
  UserX,
  AlertTriangle,
} from "lucide-react";
import {
  carregarEstado,
  adicionarCobertura,
  trocarTitularPosto,
  obterMarcacoesPonto,
  CoberturaOperacional,
  PostoOperacional,
  ProfissionalOperacional,
} from "@/lib/dados/estado-operacional";
import { MarcacaoPontoOriginal } from "@/lib/dados/ponto-tipos";
import {
  validarInterjornadaClt,
  ResultadoValidacaoInterjornada,
} from "@/lib/servicos/validacao-interjornada";

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
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return isNaN(diffDays) ? 1 : diffDays;
}

const MODALIDADES_NOMES: Record<string, string> = {
  SUBSTITUICAO_INTERNA: "Reserva Técnica (Padrão)",
  REMANEJAMENTO_ENTRE_POSTOS: "Remanejamento de Posto",
  HORA_EXTRA_TITULAR_OUTRO_POSTO: "Extensão de Jornada / HE",
  CONTRATACAO_TEMPORARIA: "Contratação Temporária",
};

export default function CoberturasPage() {
  const [coberturas, setCoberturas] = useState<CoberturaOperacional[]>([]);
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  const [marcacoesPonto, setMarcacoesPonto] = useState<MarcacaoPontoOriginal[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODAS" | "CONFIRMADA" | "PLANEJADA" | "ALERTA_CLT">("TODAS");
  const [modoVisualizacao, setModoVisualizacao] = useState<"CARDS" | "TABELA">("CARDS");

  // Modais
  const [modalAberto, setModalAberto] = useState(false);
  const [coberturaSelecionada, setCoberturaSelecionada] = useState<CoberturaOperacional | null>(null);

  // Formulário nova cobertura
  const [formPostoCodigo, setFormPostoCodigo] = useState("");
  const [formSubstitutoMatricula, setFormSubstitutoMatricula] = useState("");
  const [formDataInicio, setFormDataInicio] = useState("2026-09-15");
  const [formDataFim, setFormDataFim] = useState("2026-09-15");
  const [formTipo, setFormTipo] = useState<CoberturaOperacional["tipoCobertura"]>("SUBSTITUICAO_INTERNA");
  const [formJustificativa, setFormJustificativa] = useState("");
  const [efetivarTrocaPermanente, setEfetivarTrocaPermanente] = useState(false);
  const [cienteInterjornada, setCienciaInterjornada] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const carregarDados = () => {
    const estado = carregarEstado();
    setCoberturas(estado.coberturas);
    setPostos(estado.postos);
    setProfissionais(estado.profissionais);
    setMarcacoesPonto(obterMarcacoesPonto());
  };

  useEffect(() => {
    carregarDados();
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

  // Limpa confirmação de ciência ao alterar parâmetros
  useEffect(() => {
    setCienciaInterjornada(false);
  }, [formSubstitutoMatricula, formPostoCodigo, formDataInicio]);

  // Contagem de alertas CLT
  const totalAlertasClt = useMemo(() => {
    return coberturas.filter((c) => c.alertaInterjornada).length;
  }, [coberturas]);

  // Filtragem dinâmica
  const coberturasFiltradas = useMemo(() => {
    return coberturas.filter((cob) => {
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
        filtroStatus === "TODAS"
          ? true
          : filtroStatus === "ALERTA_CLT"
          ? Boolean(cob.alertaInterjornada)
          : cob.status === filtroStatus;

      return matchBusca && matchStatus;
    });
  }, [coberturas, busca, filtroStatus]);

  // Indicadores
  const totalCoberturas = coberturas.length;
  const confirmadas = coberturas.filter((c) => c.status === "CONFIRMADA").length;
  const planejadas = coberturas.filter((c) => c.status === "PLANEJADA").length;
  const reservaTecnicaTotal = profissionais.filter((p) => p.situacao === "ATIVO" && !p.postoCodigo).length;

  const handleCopiarJustificativa = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setMensagemSucesso("Justificativa copiada para a área de transferência!");
    setTimeout(() => setMensagemSucesso(""), 3000);
  };

  const handleSubmitNovaCobertura = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPostoCodigo || !formSubstitutoMatricula || !formDataInicio || !formDataFim) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const postoObj = postos.find((p) => p.codigoPosto === formPostoCodigo);
    const substitutoObj = profissionais.find((pr) => pr.matricula === formSubstitutoMatricula);

    if (!postoObj || !substitutoObj) return;

    if (substitutoObj.matricula === postoObj.titularMatricula) {
      alert("O substituto não pode ser o próprio titular do posto.");
      return;
    }

    // Validação estrita CLT Artigo 66
    const violouInterjornada = validacaoInterjornada ? !validacaoInterjornada.atende : false;
    if (violouInterjornada && !cienteInterjornada) {
      alert(
        `ALERTA CLT ART. 66 (Interjornada):\n\nO colaborador ${substitutoObj.nome} possui apenas ${validacaoInterjornada?.horasDescansoFormatado} de descanso entre turnos (déficit de ${validacaoInterjornada?.deficitFormatado} em relação ao mínimo de 11h).\n\nPara efetivar esta cobertura em caráter excepcional/emergencial, marque a caixa de ciência no formulário.`
      );
      return;
    }

    let justificativaFinal = formJustificativa.trim();
    if (violouInterjornada) {
      const notaClt = `[ALERTA CLT ART. 66: Descanso apurado de ${validacaoInterjornada?.horasDescansoFormatado} (< 11h mínimas) - Designação autorizada em caráter excepcional/emergencial]`;
      justificativaFinal = justificativaFinal ? `${notaClt} ${justificativaFinal}` : `${notaClt} Cobertura do posto ${postoObj.codigoPosto} (${postoObj.funcao}) por ${substitutoObj.nome}`;
    } else if (!justificativaFinal) {
      justificativaFinal = `Cobertura operacional do posto ${postoObj.codigoPosto} (${postoObj.funcao}) por ${substitutoObj.nome}`;
    }

    adicionarCobertura({
      postoCodigo: postoObj.codigoPosto,
      funcaoPosto: postoObj.funcao,
      titularMatricula: postoObj.titularMatricula,
      titularNome: postoObj.titularNome,
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

    setMensagemSucesso(
      `Cobertura designada com sucesso! ${substitutoObj.nome} atenderá o posto ${postoObj.codigoPosto}.${
        violouInterjornada ? " (Alerta de interjornada CLT registrado na auditoria)." : ""
      }${efetivarTrocaPermanente ? " Titularidade do posto atualizada no contrato." : ""}`
    );
    setModalAberto(false);
    setFormPostoCodigo("");
    setFormSubstitutoMatricula("");
    setFormJustificativa("");
    setEfetivarTrocaPermanente(false);
    setCienciaInterjornada(false);

    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Topo Executivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shadow-sm">
              <UserCheck2 className="w-4 h-4" />
            </div>
            Coberturas & Substituições de Posto
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Gestão de substitutos temporários, proteção anti-glosa e validação de sobreposição de turno.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 shadow-sm transition-all"
          >
            <span>Ver no Mapa</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>

          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Designar Cobertura</span>
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

      {/* Cards de Métricas Executivas (Clean & Interativos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Total de Coberturas
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalCoberturas}</span>
              <span className="text-xs text-slate-500">Setembro</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <UserCheck2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Efetivas (Confirmadas)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700">{confirmadas}</span>
              <span className="text-xs text-emerald-600 font-medium">COBERTO</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Planejadas / Validação
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700">{planejadas}</span>
              <span className="text-xs text-amber-600 font-medium">Futuras</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Reserva Técnica Ativa
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-700">{reservaTecnicaTotal}</span>
              <span className="text-xs text-blue-600 font-medium">Disponíveis</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-sm flex items-center justify-between transition-all ${
          totalAlertasClt > 0
            ? "bg-amber-50/80 border-amber-200"
            : "bg-white border-slate-200/80"
        }`}>
          <div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider block mb-1 ${
              totalAlertasClt > 0 ? "text-amber-800" : "text-slate-400"
            }`}>
              Alertas CLT Art. 66
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${totalAlertasClt > 0 ? "text-amber-900" : "text-slate-900"}`}>
                {totalAlertasClt}
              </span>
              <span className={`text-xs font-medium ${totalAlertasClt > 0 ? "text-amber-700" : "text-slate-500"}`}>
                &lt; 11h repouso
              </span>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
            totalAlertasClt > 0
              ? "bg-amber-100 border-amber-300 text-amber-700 shadow-sm"
              : "bg-slate-50 border-slate-100 text-slate-400"
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Busca, Abas Rápidas e Alternador de Visão */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Campo de Busca Rápida */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por posto, titular, substituto ou motivo..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-700 transition-all"
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
              onClick={() => setFiltroStatus("TODAS")}
              className={`px-3 py-1 rounded-md transition-all ${
                filtroStatus === "TODAS"
                  ? "bg-white text-slate-900 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Todas ({totalCoberturas})
            </button>
            <button
              onClick={() => setFiltroStatus("CONFIRMADA")}
              className={`px-3 py-1 rounded-md transition-all ${
                filtroStatus === "CONFIRMADA"
                  ? "bg-white text-emerald-800 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Confirmadas ({confirmadas})
            </button>
            <button
              onClick={() => setFiltroStatus("PLANEJADA")}
              className={`px-3 py-1 rounded-md transition-all ${
                filtroStatus === "PLANEJADA"
                  ? "bg-white text-amber-800 shadow-sm font-semibold"
                  : "hover:text-slate-900"
              }`}
            >
              Planejadas ({planejadas})
            </button>
            <button
              onClick={() => setFiltroStatus("ALERTA_CLT")}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                filtroStatus === "ALERTA_CLT"
                  ? "bg-amber-600 text-white shadow-sm font-semibold"
                  : "hover:text-amber-900 text-slate-600"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Alertas CLT ({totalAlertasClt})</span>
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
              title="Modo Análise Operacional (Cards)"
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

      {/* FEED DE COBERTURAS */}
      {coberturasFiltradas.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200/80 shadow-sm text-slate-400">
          <UserCheck2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-600">Nenhuma cobertura encontrada.</p>
          <p className="text-xs text-slate-400 mt-1">Tente ajustar a busca ou clique em &apos;Designar Cobertura&apos;.</p>
        </div>
      ) : modoVisualizacao === "CARDS" ? (
        /* MODO CARDS DE ANÁLISE OPERACIONAL (Fluxo Titular ➔ Substituto) */
        <div className="space-y-4">
          {coberturasFiltradas.map((cob) => {
            const diasDuracao = calcularDias(cob.dataInicio, cob.dataFim);
            const isConfirmada = cob.status === "CONFIRMADA";

            return (
              <div
                key={cob.id}
                className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden hover:border-slate-300 transition-all"
              >
                {/* Topo do Card */}
                <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-bold text-xs text-premier-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {cob.postoCodigo}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {cob.funcaoPosto}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-mono">
                      {cob.dataInicio === cob.dataFim
                        ? cob.dataInicio
                        : `${cob.dataInicio} a ${cob.dataFim}`}
                    </span>
                    <span className="text-[10px] font-medium bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full border border-blue-100">
                      {diasDuracao} {diasDuracao === 1 ? "dia" : "dias"}
                    </span>
                    <span className="text-[10px] font-medium bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full">
                      {MODALIDADES_NOMES[cob.tipoCobertura] || cob.tipoCobertura.replace(/_/g, " ")}
                    </span>
                    {cob.alertaInterjornada && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full shadow-xs"
                        title={cob.detalhesInterjornada || "Interjornada inferior a 11 horas (CLT Artigo 66)"}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>CLT Art. 66 ({cob.horasDescansoApuradas ? cob.horasDescansoApuradas.toFixed(1) + "h" : "< 11h"})</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isConfirmada ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className={isConfirmada ? "text-emerald-800 font-semibold" : "text-amber-800 font-semibold"}>
                        {isConfirmada ? "Confirmada (Anti-Glosa)" : "Planejada"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopiarJustificativa(cob.justificativa)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                      title="Copiar justificativa"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Corpo: Fluxo Titular ➔ Substituto */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Titular Ausente */}
                  <div className="md:col-span-4 bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1">
                      <UserX className="w-3 h-3 text-rose-500" />
                      Titular Ausente
                    </span>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {obterIniciais(cob.titularNome || "Sem Titular")}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-xs leading-snug">
                          {cob.titularNome || "Posto Vago"}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {cob.titularMatricula || "Sem Matrícula"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seta Indicativa do Fluxo */}
                  <div className="md:col-span-1 flex items-center justify-center text-slate-300">
                    <ArrowRight className="w-5 h-5 hidden md:block text-slate-400" />
                    <span className="md:hidden text-xs text-slate-400 font-semibold">Substituído por:</span>
                  </div>

                  {/* Substituto Designado */}
                  <div className="md:col-span-4 bg-blue-50/50 rounded-xl p-3.5 border border-blue-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-1.5 flex items-center gap-1">
                      <UserCheck2 className="w-3 h-3 text-blue-600" />
                      Profissional Substituto
                    </span>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                        {obterIniciais(cob.substitutoNome)}
                      </div>
                      <div>
                        <div className="font-semibold text-blue-950 text-xs leading-snug">
                          {cob.substitutoNome}
                        </div>
                        <div className="text-[11px] font-mono text-blue-600">
                          {cob.substitutoMatricula}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ação / Detalhes */}
                  <div className="md:col-span-3 flex flex-col items-end justify-center gap-2">
                    <button
                      onClick={() => setCoberturaSelecionada(cob)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all"
                    >
                      <span>Ficha Completa</span>
                    </button>
                    <Link
                      href="/mapa-ocupacao"
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline inline-flex items-center gap-1"
                    >
                      <span>Conferir no Mapa</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Linha de Justificativa Contratual Ampla */}
                  <div className="md:col-span-12 pt-2 mt-1 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700 shrink-0">Justificativa:</span>
                    <p className="text-slate-700 leading-relaxed font-normal">
                      &quot;{cob.justificativa}&quot;
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
                  <th className="py-3 px-4">Posto Coberto</th>
                  <th className="py-3 px-4">Titular Ausente</th>
                  <th className="py-3 px-4">Substituto Designado</th>
                  <th className="py-3 px-4">Período</th>
                  <th className="py-3 px-4">Modalidade</th>
                  <th className="py-3 px-4">Justificativa</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coberturasFiltradas.map((cob) => (
                  <tr key={cob.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      <div>{cob.postoCodigo}</div>
                      <div className="text-[10px] font-sans text-slate-500 font-normal">
                        {cob.funcaoPosto}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 text-xs">
                        {cob.titularNome || "Sem titular"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {cob.titularMatricula}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-blue-900 text-xs">
                        {cob.substitutoNome}
                      </div>
                      <div className="text-[10px] font-mono text-blue-600">
                        {cob.substitutoMatricula}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {cob.dataInicio === cob.dataFim ? cob.dataInicio : `${cob.dataInicio} a ${cob.dataFim}`}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {MODALIDADES_NOMES[cob.tipoCobertura] || cob.tipoCobertura.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 px-4 max-w-xs text-slate-700">
                      <div className="truncate" title={cob.justificativa}>
                        {cob.justificativa}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            cob.status === "CONFIRMADA" ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              cob.status === "CONFIRMADA" ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          {cob.status === "CONFIRMADA" ? "Confirmada" : "Planejada"}
                        </span>
                        {cob.alertaInterjornada && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-full"
                            title={cob.detalhesInterjornada || "Interjornada inferior a 11 horas (CLT Artigo 66)"}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            CLT &lt; 11h
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setCoberturaSelecionada(cob)}
                        className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Ficha Completa de Cobertura */}
      {coberturaSelecionada && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-sm">Ficha de Cobertura: {coberturaSelecionada.id}</h3>
              </div>
              <button
                onClick={() => setCoberturaSelecionada(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Posto Vinculado</span>
                  <div className="font-bold text-premier-900 text-sm mt-0.5 font-mono">
                    {coberturaSelecionada.postoCodigo}
                  </div>
                  <div className="text-slate-600 font-medium text-[11px]">{coberturaSelecionada.funcaoPosto}</div>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Status no Mapa</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-emerald-800">COBERTO (R$ 0 Glosa)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Titular Ausente</span>
                  <div className="font-semibold text-slate-800 text-xs mt-1">{coberturaSelecionada.titularNome || "Posto Vago"}</div>
                  <div className="text-[11px] font-mono text-slate-400">{coberturaSelecionada.titularMatricula}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
                  <span className="text-blue-800 font-semibold uppercase text-[10px] block">Substituto Alocado</span>
                  <div className="font-bold text-blue-950 text-xs mt-1">{coberturaSelecionada.substitutoNome}</div>
                  <div className="text-[11px] font-mono text-blue-700">{coberturaSelecionada.substitutoMatricula}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Período de Atuação</span>
                  <div className="font-mono text-slate-800 mt-0.5 font-bold">
                    {coberturaSelecionada.dataInicio} a {coberturaSelecionada.dataFim}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Modalidade</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {MODALIDADES_NOMES[coberturaSelecionada.tipoCobertura] || coberturaSelecionada.tipoCobertura.replace(/_/g, " ")}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Justificativa Operacional</span>
                <p className="mt-1 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed font-normal">
                  &quot;{coberturaSelecionada.justificativa}&quot;
                </p>
              </div>

              {/* Status de Conformidade CLT Art. 66 */}
              {coberturaSelecionada.alertaInterjornada ? (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Registro de Quebra de Interjornada — CLT Art. 66</span>
                  </div>
                  <p className="text-[11px] text-amber-900/90 leading-relaxed">
                    {coberturaSelecionada.detalhesInterjornada ||
                      `Descanso apurado de ${coberturaSelecionada.horasDescansoApuradas ? coberturaSelecionada.horasDescansoApuradas.toFixed(1) + "h" : "< 11h"} entre jornadas consecutivas (abaixo do mínimo legal de 11 horas).`}
                  </p>
                  <div className="text-[10px] text-amber-800 font-medium">
                    Status: Autorizado em caráter excepcional com registro na trilha de auditoria (Passivo de horas extras Súmula 110/TST).
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-medium">
                    <strong>Conformidade CLT Art. 66:</strong> Intervalo interjornada mínimo de 11 horas consecutivas cumprido integralmente.
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handleCopiarJustificativa(coberturaSelecionada.justificativa)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar para Relatório</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCoberturaSelecionada(null)}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 text-xs transition-colors"
                >
                  Fechar
                </button>
                <Link
                  href="/mapa-ocupacao"
                  className="px-4 py-1.5 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded-lg text-xs shadow transition-colors"
                >
                  Conferir no Mapa
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Designar Nova Cobertura */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-sm">Designar Cobertura para Posto</h3>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovaCobertura} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Posto que Requer Cobertura <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formPostoCodigo}
                  onChange={(e) => setFormPostoCodigo(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-blue-700 transition-colors"
                >
                  <option value="">Selecione o posto...</option>
                  {postos.map((p) => (
                    <option key={p.codigoPosto} value={p.codigoPosto}>
                      {p.codigoPosto} — {p.funcao} (Titular: {p.titularNome || "VAGO"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Profissional Substituto <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formSubstitutoMatricula}
                  onChange={(e) => setFormSubstitutoMatricula(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-blue-700 transition-colors"
                >
                  <option value="">Selecione o substituto...</option>
                  <optgroup label="Reserva Técnica (Recomendados)">
                    {profissionais
                      .filter(
                        (pr) =>
                          pr.situacao === "ATIVO" &&
                          !pr.postoCodigo &&
                          pr.matricula !== postos.find((p) => p.codigoPosto === formPostoCodigo)?.titularMatricula
                      )
                      .map((pr) => (
                        <option key={pr.matricula} value={pr.matricula}>
                          ★ {pr.nome} ({pr.matricula}) — Reserva Técnica
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
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Priorize colaboradores com ★ da Reserva Técnica para manter a cobertura sem desfalques.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Data Início</label>
                  <input
                    type="date"
                    required
                    value={formDataInicio}
                    onChange={(e) => setFormDataInicio(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-blue-700 transition-colors"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Data Término</label>
                  <input
                    type="date"
                    required
                    value={formDataFim}
                    onChange={(e) => setFormDataFim(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-blue-700 transition-colors"
                  />
                </div>
              </div>

              {/* Apuração em Tempo Real de Interjornada (CLT Artigo 66) */}
              {validacaoInterjornada && (
                <div className="space-y-2">
                  {!validacaoInterjornada.atende ? (
                    <div className="p-3.5 bg-amber-50/95 border-2 border-amber-400 rounded-xl space-y-2.5 shadow-sm animate-fadeIn">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Alerta CLT Art. 66 — Descanso Mínimo Não Cumprido</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full shrink-0">
                          Déficit: -{validacaoInterjornada.deficitFormatado}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/90 p-2.5 rounded-lg border border-amber-200">
                        <div>
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">Descanso Apurado</span>
                          <span className="font-bold text-rose-700 text-sm">{validacaoInterjornada.horasDescansoFormatado}</span>
                          <span className="text-[10px] text-slate-500 block">Mínimo legal: 11h consecutivas</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">Déficit a Indenizar</span>
                          <span className="font-bold text-rose-600 text-sm">{validacaoInterjornada.deficitFormatado}</span>
                          <span className="text-[10px] text-slate-500 block">Hora extra com 50% (Súm. 110/TST)</span>
                        </div>
                      </div>

                      {validacaoInterjornada.ultimoTurnoFim && (
                        <div className="text-[11px] text-slate-700 space-y-1 bg-amber-100/60 p-2 rounded-lg border border-amber-200/80">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Último término apurado:</span>
                            <strong className="text-slate-800">{validacaoInterjornada.ultimoTurnoFim.dataHoraFormatada}</strong>
                          </div>
                          <div className="text-[10px] text-slate-500 italic truncate" title={validacaoInterjornada.ultimoTurnoFim.descricaoOrigem}>
                            Origem: {validacaoInterjornada.ultimoTurnoFim.descricaoOrigem}
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-amber-200">
                            <span className="text-slate-500">Início da cobertura:</span>
                            <strong className="text-blue-900">{validacaoInterjornada.novoTurnoInicio.dataHoraFormatada}</strong>
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-amber-950/80 leading-relaxed">
                        <strong>Passivo Trabalhista & Fiscalização:</strong> Conforme o Art. 66 da CLT e Súmula 110 do TST, o descumprimento do intervalo de 11h obriga o pagamento de horas extras com adicional de 50% sobre o período suprimido e enseja apontamento em auditoria Petrobras.
                      </p>

                      <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg flex items-start gap-2">
                        <input
                          type="checkbox"
                          id="checkCienciaInterjornada"
                          checked={cienteInterjornada}
                          onChange={(e) => setCienciaInterjornada(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                        <label htmlFor="checkCienciaInterjornada" className="text-[11px] font-semibold text-rose-950 cursor-pointer leading-tight">
                          Declaro ciência da não observância do intervalo de 11h (Art. 66 da CLT) e autorizo a substituição em caráter excepcional/emergencial.
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-900">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="text-[11px]">
                          <strong className="font-semibold text-emerald-800">Interjornada Conforme (CLT Art. 66):</strong>{" "}
                          Descanso apurado de <strong>{validacaoInterjornada.horasDescansoFormatado}</strong> entre turnos.
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                        ✓ 100% Legal
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Modalidade de Cobertura</label>
                <select
                  value={formTipo}
                  onChange={(e) => setFormTipo(e.target.value as CoberturaOperacional["tipoCobertura"])}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-blue-700 transition-colors"
                >
                  <option value="SUBSTITUICAO_INTERNA">Substituição por Reserva Técnica (Padrão)</option>
                  <option value="REMANEJAMENTO_ENTRE_POSTOS">Remanejamento Entre Postos</option>
                  <option value="HORA_EXTRA_TITULAR_OUTRO_POSTO">Extensão de Jornada / Hora Extra</option>
                  <option value="CONTRATACAO_TEMPORARIA">Contratação Temporária Homologada</option>
                </select>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/80 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="checkEfetivarDefinitivo"
                  checked={efetivarTrocaPermanente}
                  onChange={(e) => setEfetivarTrocaPermanente(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-700 focus:ring-blue-600 cursor-pointer"
                />
                <label htmlFor="checkEfetivarDefinitivo" className="text-[11px] font-semibold text-blue-950 cursor-pointer leading-tight">
                  Tornar esta troca definitiva no contrato (atualiza a titularidade permanente no Anexo 1-A)
                </label>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Justificativa Operacional</label>
                <textarea
                  rows={2}
                  placeholder="Justificativa formal auditável que fundamenta a substituição..."
                  value={formJustificativa}
                  onChange={(e) => setFormJustificativa(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-blue-700 resize-none leading-relaxed transition-colors"
                />
              </div>

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
                  Confirmar Cobertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
