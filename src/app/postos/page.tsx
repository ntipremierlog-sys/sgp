"use client";

/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Postos de Serviço (Anexo 1-A) — Design Minimalista, Tipografia Unificada e Foco Operacional
 */

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  AlertTriangle,
  X,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  carregarEstado,
  adicionarPosto,
  trocarTitularPosto,
  obterTodosPostosContrato,
  obterMarcacoesPonto,
  calcularApuracaoPostoCiclo,
  ApuracaoPostoCiclo,
  VAGAS_MC_REAIS,
  ALOCACOES_MC_REAIS,
  PostoOperacional,
  ProfissionalOperacional,
  EstadoOperacionalCompleto,
  VagaPosto,
} from "@/lib/dados/estado-operacional";
import { MarcacaoPontoOriginal } from "@/lib/dados/ponto-tipos";
import { validarInterjornadaClt } from "@/lib/servicos/validacao-interjornada";
import { obterOcupacaoConsolidada } from "@/lib/servicos/adaptador-painel";
import { calcularPeriodoCompetencia } from "@/lib/servicos/periodo-competencia";

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
 * mantendo preposições minúsculas, numerais romanos e siglas contratuais em maiúsculo.
 */
function formatarTexto(str?: string): string {
  if (!str) return "—";
  const trim = str.trim();
  if (/^PST-[A-Z0-9-]+$/i.test(trim)) return trim.toUpperCase();
  if (/^UFN-[A-Z0-9-]+$/i.test(trim)) return trim.toUpperCase();

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
  if (s === "SUSPENSO") return "Suspenso";
  if (s === "ENCERRADO") return "Encerrado";
  return formatarTexto(sit);
}

export default function PostosPage() {
  const [estado, setEstado] = useState<EstadoOperacionalCompleto>(carregarEstado);
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  const [marcacoesPonto, setMarcacoesPonto] = useState<MarcacaoPontoOriginal[]>([]);

  // Apuração de ocupação e cumprimento consolidado
  const dadosPainel = useMemo(() => {
    return obterOcupacaoConsolidada(estado, { baseId: "TODAS" });
  }, [estado]);

  // Filtros
  const [abaPostos, setAbaPostos] = useState<"TODOS" | "OCUPADOS" | "VAGOS">("TODOS");
  const [busca, setBusca] = useState("");
  const [filtroEscala, setFiltroEscala] = useState("TODAS");
  const [filtroSituacao, setFiltroSituacao] = useState("TODAS");

  // Modais
  const [modalAberto, setModalAberto] = useState(false);
  const [postoSelecionado, setPostoSelecionado] = useState<PostoOperacional | null>(null);
  const [modalTrocaAberto, setModalTrocaAberto] = useState(false);
  const [postoParaTroca, setPostoParaTroca] = useState<PostoOperacional | null>(null);
  const [novoTitularMatricula, setNovoTitularMatricula] = useState("");
  const [cienteInterjornadaTroca, setCienciaInterjornadaTroca] = useState(false);

  // Formulário do novo posto
  const [formCodigo, setFormCodigo] = useState("");
  const [formFuncao, setFormFuncao] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formEscala, setFormEscala] = useState<"5x2" | "12x36" | "6x1">("5x2");
  const [formJornada, setFormJornada] = useState(44);
  const [formInicio, setFormInicio] = useState("07:00");
  const [formFim, setFormFim] = useState("16:48");
  const [formTitular, setFormTitular] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const abrirModalTroca = (posto: PostoOperacional) => {
    setPostoParaTroca(posto);
    setNovoTitularMatricula(posto.titularMatricula || "");
    setCienciaInterjornadaTroca(false);
    setModalTrocaAberto(true);
  };

  const handleSalvarTrocaTitular = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postoParaTroca) return;

    if (alertaInterjornadaTroca && !alertaInterjornadaTroca.atende && !cienteInterjornadaTroca) {
      alert(
        `ALERTA CLT ART. 66 (Interjornada):\n\nO colaborador possui apenas ${alertaInterjornadaTroca.horasDescansoFormatado} de descanso entre turnos (abaixo de 11h).\n\nPara confirmar a troca em caráter excepcional, marque a ciência no formulário.`
      );
      return;
    }

    const res = trocarTitularPosto(postoParaTroca.codigoPosto, novoTitularMatricula || undefined);
    if (res.sucesso) {
      setMensagemSucesso(res.mensagem);
      setModalTrocaAberto(false);
      setPostoParaTroca(null);
      setCienciaInterjornadaTroca(false);
      carregarDados();
      if (postoSelecionado && postoSelecionado.codigoPosto === postoParaTroca.codigoPosto) {
        setPostoSelecionado(null);
      }
      setTimeout(() => setMensagemSucesso(""), 4000);
    } else {
      alert(res.mensagem);
    }
  };

  const carregarDados = async () => {
    const e = carregarEstado();
    setEstado(e);
    setPostos(obterTodosPostosContrato(e.postos));
    setProfissionais(e.profissionais);

    let pts = obterMarcacoesPonto();
    if (!pts || pts.length === 0) {
      try {
        const res = await fetch("/api/ponto");
        if (res.ok) {
          const data = await res.json();
          if (data.sucesso && Array.isArray(data.marcacoes) && data.marcacoes.length > 0) {
            pts = data.marcacoes;
          }
        }
      } catch (err) {
        console.warn("Aviso ao carregar /api/ponto:", err);
      }
    }
    setMarcacoesPonto(pts || []);
  };

  useEffect(() => {
    carregarDados();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const aba = params.get("aba")?.toUpperCase();
      if (aba === "VAGOS" || aba === "OCUPADOS" || aba === "TODOS") {
        setAbaPostos(aba as "TODOS" | "OCUPADOS" | "VAGOS");
      }
    }
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // Alerta de interjornada reativo na troca de titular do posto
  const alertaInterjornadaTroca = useMemo(() => {
    if (!novoTitularMatricula || !postoParaTroca) return null;
    return validarInterjornadaClt({
      matricula: novoTitularMatricula,
      dataInicio: new Date().toISOString().substring(0, 10),
      postoDestinoCodigo: postoParaTroca.codigoPosto,
      postos,
      profissionais,
      marcacoesPonto,
    });
  }, [novoTitularMatricula, postoParaTroca, postos, profissionais, marcacoesPonto]);

  // Set de Marcações O(1)
  const marcacoesSet = useMemo(() => {
    const set = new Set<string>();
    marcacoesPonto.forEach((m: any) => {
      const mat = String(m.matricula || m.chapa || "").padStart(6, "0");
      const dt = m.dataLocal || m.dataHoraUtc || m.dataHora || m.data || "";
      if (mat && dt.length >= 10) {
        set.add(`${mat}_${dt.slice(0, 10)}`);
      }
    });
    return set;
  }, [marcacoesPonto]);

  // Vagas indexadas por Posto
  const vagasPorPosto = useMemo(() => {
    const map = new Map<string, VagaPosto[]>();
    const vagas = estado.vagas && estado.vagas.length > 0 ? estado.vagas : VAGAS_MC_REAIS;
    vagas.forEach((v) => {
      const chaves = new Set<string>();
      if (v.idPosto) chaves.add(String(v.idPosto));
      if (v.postoIdSGP) chaves.add(String(v.postoIdSGP));
      if (v.postoBase !== undefined && v.postoBase !== null) chaves.add(String(v.postoBase));
      chaves.forEach((ch) => {
        const lista = map.get(ch) || [];
        if (!lista.some((ex) => ex.id === v.id)) {
          lista.push(v);
          map.set(ch, lista);
        }
      });
    });
    return map;
  }, [estado.vagas]);

  // Período do Ciclo Contratual (10 do mês anterior ao dia 09 do mês de referência)
  const periodoCiclo = useMemo(() => {
    // Fonte única da regra: src/lib/servicos/periodo-competencia.ts
    const p = calcularPeriodoCompetencia("2026-09");
    return {
      ano: 2026,
      mesReferencia: 9,
      competencia: p.competencia,
      dataInicio: p.dataInicio,
      dataFim: p.dataFim,
      totalDias: p.datas.length,
      datas: p.datas,
    };
  }, []);

  // Apuração de cumprimento de presença oficial por posto
  const apuracaoCicloPorPosto = useMemo(() => {
    const map = new Map<string, ApuracaoPostoCiclo>();
    const alocacoes = estado.alocacoes && estado.alocacoes.length > 0 ? estado.alocacoes : ALOCACOES_MC_REAIS;
    postos.forEach((p) => {
      const chave = p.idPosto || p.id;
      const vgs = obterVagasDoPosto(p, vagasPorPosto);
      const res = calcularApuracaoPostoCiclo(
        p,
        periodoCiclo,
        alocacoes,
        estado.ocorrencias || [],
        estado.coberturas || [],
        estado.apontamentos || [],
        marcacoesSet,
        "2026-09-15",
        vgs
      );
      map.set(chave, res);
      if (p.codigoPosto) map.set(p.codigoPosto, res);
      if (p.id) map.set(p.id, res);
      if (p.postoIdSGP) map.set(p.postoIdSGP, res);
    });
    return map;
  }, [postos, periodoCiclo, estado, marcacoesSet, vagasPorPosto]);

  const totalPostos = postos.length;
  const postosOcupados = useMemo(() => postos.filter((p) => p.titularMatricula).length, [postos]);
  const postosVagos = useMemo(() => postos.filter((p) => !p.titularMatricula).length, [postos]);

  const cumpSelecionado = useMemo(() => {
    if (!postoSelecionado) return null;
    return (
      apuracaoCicloPorPosto.get(postoSelecionado.idPosto || "") ||
      apuracaoCicloPorPosto.get(postoSelecionado.codigoPosto) ||
      apuracaoCicloPorPosto.get(postoSelecionado.id) ||
      apuracaoCicloPorPosto.get(postoSelecionado.postoIdSGP || "") ||
      null
    );
  }, [postoSelecionado, apuracaoCicloPorPosto]);

  // Postos filtrados
  const postosFiltrados = useMemo(() => {
    return postos.filter((p) => {
      if (abaPostos === "OCUPADOS" && !p.titularMatricula) return false;
      if (abaPostos === "VAGOS" && p.titularMatricula) return false;

      const matchTexto =
        p.codigoPosto.toLowerCase().includes(busca.toLowerCase()) ||
        p.funcao.toLowerCase().includes(busca.toLowerCase()) ||
        (p.titularNome && p.titularNome.toLowerCase().includes(busca.toLowerCase())) ||
        (p.titularMatricula && p.titularMatricula.toLowerCase().includes(busca.toLowerCase())) ||
        (p.unidadeNome && p.unidadeNome.toLowerCase().includes(busca.toLowerCase())) ||
        (p.unidadeId && p.unidadeId.toLowerCase().includes(busca.toLowerCase()));

      const matchEscala = filtroEscala === "TODAS" || p.escala === filtroEscala;
      const matchSituacao = filtroSituacao === "TODAS" || p.situacao === filtroSituacao;

      return matchTexto && matchEscala && matchSituacao;
    });
  }, [postos, abaPostos, busca, filtroEscala, filtroSituacao]);

  const handleSubmitNovoPosto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCodigo || !formFuncao) {
      alert("Por favor, preencha o código do posto e a função contratual.");
      return;
    }

    const titularObj = profissionais.find((pr) => pr.matricula === formTitular);

    adicionarPosto({
      codigoPosto: formCodigo.toUpperCase().trim(),
      funcao: formFuncao.trim(),
      descricao: formDescricao.trim() || undefined,
      unidadeId: "UFN-III",
      unidadeNome: "UFN III – Três Lagoas/MS",
      escala: formEscala,
      jornadaSemanalHoras: Number(formJornada),
      horarioInicio: formInicio,
      horarioFim: formFim,
      titularMatricula: titularObj?.matricula,
      titularNome: titularObj?.nome,
      situacao: "ATIVO",
      dataInicioVigencia: new Date().toISOString().split("T")[0],
    });

    setMensagemSucesso(`Posto ${formCodigo.toUpperCase()} cadastrado com sucesso!`);
    setModalAberto(false);
    setFormCodigo("");
    setFormFuncao("");
    setFormDescricao("");
    setFormTitular("");

    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  return (
    <div className="space-y-3 pb-10 max-w-full mx-auto">
      {/* 1. Cabeçalho Limpo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Postos de Serviço (Anexo 1-A)</h1>
          <p className="text-xs text-slate-500">Cadastro oficial de postos contratuais, escalas e alocação de titulares</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-200 transition-colors"
          >
            <span>Ver no Mapa</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-200" />
            <span>Novo Posto</span>
          </button>
        </div>
      </div>

      {/* Alerta de Sucesso */}
      {mensagemSucesso && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-md text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso("")} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Barra de Controle em Linha Única (Abas Destacadas + Filtros) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 py-1">
        {/* Abas com Textos e Contadores em Destaque */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setAbaPostos("TODOS")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-semibold transition-all cursor-pointer ${
              abaPostos === "TODOS"
                ? "bg-slate-900 text-white shadow-xs font-bold"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-200/70"
            }`}
          >
            <span>Todos</span>
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-xs font-mono font-bold ${
                abaPostos === "TODOS" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"
              }`}
            >
              {totalPostos}
            </span>
          </button>

          <button
            onClick={() => setAbaPostos("OCUPADOS")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-semibold transition-all cursor-pointer ${
              abaPostos === "OCUPADOS"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50"
            }`}
          >
            <span>Com Titular</span>
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-xs font-mono font-bold ${
                abaPostos === "OCUPADOS" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {postosOcupados}
            </span>
          </button>

          <button
            onClick={() => setAbaPostos("VAGOS")}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-[13px] font-semibold transition-all cursor-pointer ${
              abaPostos === "VAGOS"
                ? "bg-amber-600 text-white shadow-xs font-bold"
                : "text-amber-800 hover:text-amber-950 hover:bg-amber-50"
            }`}
          >
            <span>100% Vagos</span>
            <span
              className={`ml-1.5 px-1.5 py-0.2 rounded-full text-xs font-mono font-bold ${
                abaPostos === "VAGOS" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
              }`}
            >
              {postosVagos}
            </span>
          </button>
        </div>

        {/* Busca e Filtros Rápidos */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-md px-2 py-1 bg-white focus-within:border-slate-400 text-xs w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar código, função, titular..."
              className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-400 text-xs"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={filtroEscala}
            onChange={(e) => setFiltroEscala(e.target.value)}
            className="border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer"
          >
            <option value="TODAS">Todas as Escalas</option>
            <option value="5x2">5x2</option>
            <option value="12x36">12x36</option>
            <option value="6x1">6x1</option>
          </select>

          <select
            value={filtroSituacao}
            onChange={(e) => setFiltroSituacao(e.target.value)}
            className="border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 text-xs outline-none hover:border-slate-300 font-medium cursor-pointer"
          >
            <option value="TODAS">Todas as Situações</option>
            <option value="ATIVO">Ativo</option>
            <option value="SUSPENSO">Suspenso</option>
          </select>
        </div>
      </div>

      {/* 3. Tabela Limpa com Tipografia Unificada */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
              <tr>
                <th className="px-4 py-2.5">Código do Posto</th>
                <th className="px-3 py-2.5">Função Contratual</th>
                <th className="px-3 py-2.5">Escala</th>
                <th className="px-3 py-2.5">Horário</th>
                <th className="px-3 py-2.5">Titular Alocado</th>
                <th className="px-3 py-2.5 text-center">Cumprimento</th>
                <th className="px-3 py-2.5 text-center">Situação</th>
                <th className="px-3 py-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {postosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Nenhum posto encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                postosFiltrados.map((posto) => {
                  const apPosto =
                    apuracaoCicloPorPosto.get(posto.idPosto || "") ||
                    apuracaoCicloPorPosto.get(posto.codigoPosto) ||
                    apuracaoCicloPorPosto.get(posto.id) ||
                    apuracaoCicloPorPosto.get(posto.postoIdSGP || "");

                  const percentual = apPosto?.percentualCiclo;
                  const percentualFmt = apPosto?.percentualCicloFormatado;
                  const exigiveis = apPosto?.totalPosicoesExigiveis || 0;
                  const atendidas = apPosto?.totalPosicoesAtendidas || 0;

                  return (
                  <tr key={posto.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Código */}
                    <td className="px-4 py-2.5 font-mono text-slate-800 text-[11px] font-medium">
                      {posto.codigoPosto}
                    </td>

                    {/* Função */}
                    <td className="px-3 py-2.5">
                      <div className="text-slate-900 font-medium text-xs">
                        {formatarFuncao(posto.funcao)}
                      </div>
                      {posto.descricao && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5" title={posto.descricao}>
                          {posto.descricao}
                        </div>
                      )}
                    </td>

                    {/* Escala */}
                    <td className="px-3 py-2.5 text-slate-700 text-xs font-medium">
                      {posto.escala} ({posto.jornadaSemanalHoras}h/sem)
                    </td>

                    {/* Horário */}
                    <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px]">
                      {posto.horarioInicio && posto.horarioFim
                        ? `${posto.horarioInicio} às ${posto.horarioFim}`
                        : (posto as any).tipoPostoNome || (posto.escala === "12x36" ? "Turno 12h" : "07:00 às 16:48")}
                    </td>

                    {/* Titular Alocado */}
                    <td className="px-3 py-2.5">
                      {posto.titularMatricula ? (
                        <div>
                          <div className="text-slate-900 font-medium text-xs">
                            {formatarNome(posto.titularNome)}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Matrícula: {posto.titularMatricula}
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-800 text-xs font-medium">
                          100% Vago
                        </span>
                      )}
                    </td>

                    {/* Cumprimento de Presença */}
                    <td className="px-3 py-2.5 text-center">
                      {percentualFmt && percentualFmt !== "–" && percentualFmt !== "—" ? (
                        <span
                          className={`font-mono text-xs font-medium ${
                            percentual === null || percentual === undefined
                              ? "text-slate-400"
                              : percentual >= 95
                              ? "text-slate-700"
                              : percentual >= 80
                              ? "text-slate-700"
                              : "text-amber-800 font-semibold"
                          }`}
                          title={`${atendidas} de ${exigiveis} dias/turnos atendidos no ciclo contratual (${percentualFmt})`}
                        >
                          {percentualFmt}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono text-xs" title="Sem posições exigíveis no período">
                          —
                        </span>
                      )}
                    </td>

                    {/* Situação */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-medium ${
                        posto.situacao === "ATIVO" ? "text-emerald-700" : "text-amber-700"
                      }`}>
                        {formatarSituacao(posto.situacao)}
                      </span>
                    </td>

                    {/* Ações — Caixa de Seleção */}
                    <td className="px-3 py-2.5 text-center">
                      <select
                        value=""
                        onChange={(e) => {
                          const valor = e.target.value;
                          if (valor === "detalhes") {
                            setPostoSelecionado(posto);
                          } else if (valor === "trocar") {
                            abrirModalTroca(posto);
                          }
                        }}
                        className="border border-slate-200 hover:border-slate-400 rounded-md px-2 py-1 text-xs text-slate-700 bg-white font-medium outline-none cursor-pointer shadow-2xs transition-colors"
                      >
                        <option value="" disabled>Ações...</option>
                        <option value="detalhes">Ver detalhes</option>
                        <option value="trocar">{posto.titularMatricula ? "Trocar titular" : "Alocar titular"}</option>
                      </select>
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
          <span>{postosFiltrados.length} postos exibidos</span>
          <span>Unidade: UFN III — Três Lagoas/MS</span>
        </div>
      </div>

      {/* Modal de Detalhes do Posto */}
      {postoSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Ficha do Posto: {postoSelecionado.codigoPosto}</h3>
                <span className="text-xs text-slate-400">{formatarTexto(postoSelecionado.funcao)}</span>
              </div>
              <button
                onClick={() => setPostoSelecionado(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 text-[11px] block">Função Contratual</span>
                  <div className="font-medium text-slate-900 text-sm mt-0.5">{formatarTexto(postoSelecionado.funcao)}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Unidade de Execução</span>
                  <div className="font-medium text-slate-800 mt-0.5">{postoSelecionado.unidadeNome}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-md border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[11px] block">Escala</span>
                  <div className="font-medium text-slate-800 mt-0.5">{postoSelecionado.escala}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Jornada Semanal</span>
                  <div className="font-medium text-slate-800 mt-0.5">{postoSelecionado.jornadaSemanalHoras} horas</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Horário do Turno</span>
                  <div className="font-mono text-slate-800 mt-0.5">
                    {postoSelecionado.horarioInicio && postoSelecionado.horarioFim
                      ? `${postoSelecionado.horarioInicio} - ${postoSelecionado.horarioFim}`
                      : (postoSelecionado as any).tipoPostoNome || (postoSelecionado.escala === "12x36" ? "Turno 12h" : "07:00 - 16:48")}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Cumprimento de Presença</span>
                  <div className="font-mono font-medium text-slate-800 mt-0.5">
                    {cumpSelecionado && cumpSelecionado.percentualCicloFormatado && cumpSelecionado.percentualCicloFormatado !== "–" ? (
                      <span>
                        <span className="font-semibold text-slate-900">{cumpSelecionado.percentualCicloFormatado}</span>
                        {cumpSelecionado.totalPosicoesExigiveis > 0 && (
                          <span className="text-[10px] text-slate-500 font-sans block">
                            {cumpSelecionado.totalPosicoesAtendidas}/{cumpSelecionado.totalPosicoesExigiveis} turnos atendidos
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block mb-1">Titular Atual Alocado</span>
                {postoSelecionado.titularMatricula ? (
                  <div className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{formatarNome(postoSelecionado.titularNome)}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Matrícula: {postoSelecionado.titularMatricula}
                        </div>
                      </div>
                      <Link
                        href="/profissionais"
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                      >
                        Ver Perfil →
                      </Link>
                    </div>
                    <button
                      onClick={() => abrirModalTroca(postoSelecionado)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-300 text-xs transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Trocar Titular Deste Posto</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                    <div>
                      Posto sem titular alocado (<strong>100% Vago</strong>).
                    </div>
                    <button
                      onClick={() => abrirModalTroca(postoSelecionado)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded text-xs transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-white" />
                      <span>Alocar Colaborador no Posto</span>
                    </button>
                  </div>
                )}
              </div>

              {postoSelecionado.descricao && (
                <div>
                  <span className="text-slate-400 text-[11px] block mb-1">Descrição das Atividades</span>
                  <p className="text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                    {postoSelecionado.descricao}
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setPostoSelecionado(null)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200 text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
              <Link
                href="/mapa-ocupacao"
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded text-xs transition-colors"
              >
                Ver no Mapa de Cobertura
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro de Novo Posto */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Cadastrar Posto no Anexo 1-A</h3>
                <span className="text-xs text-slate-400">Contrato ICJ 5900.0129796.25.2</span>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovoPosto} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">
                    Código do Posto <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PST-LOG-016"
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 uppercase font-mono text-slate-800 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">
                    Função Contratual <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Auxiliar de Almoxarifado"
                    value={formFuncao}
                    onChange={(e) => setFormFuncao(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Escala</label>
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

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Jornada Semanal</label>
                  <input
                    type="number"
                    value={formJornada}
                    onChange={(e) => setFormJornada(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Horário Início/Fim</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="07:00"
                      value={formInicio}
                      onChange={(e) => setFormInicio(e.target.value)}
                      className="w-1/2 border border-slate-300 rounded px-1.5 py-1.5 text-center font-mono text-slate-800 text-xs"
                    />
                    <span>-</span>
                    <input
                      type="text"
                      placeholder="16:48"
                      value={formFim}
                      onChange={(e) => setFormFim(e.target.value)}
                      className="w-1/2 border border-slate-300 rounded px-1.5 py-1.5 text-center font-mono text-slate-800 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">
                  Titular Inicial (Opcional)
                </label>
                <select
                  value={formTitular}
                  onChange={(e) => setFormTitular(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 outline-none"
                >
                  <option value="">Nenhum titular (Cadastrar como Posto Vago)</option>
                  {profissionais
                    .filter((pr) => pr.situacao === "ATIVO")
                    .map((pr) => (
                      <option key={pr.matricula} value={pr.matricula}>
                        {formatarNome(pr.nome)} ({pr.matricula}) — {formatarTexto(pr.funcao)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Descrição / Objeto</label>
                <textarea
                  rows={2}
                  placeholder="Escopo resumido do posto e local de atuação na UFN III..."
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 -mx-5 -mb-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded shadow-2xs transition-colors cursor-pointer"
                >
                  Salvar Posto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Troca de Titular */}
      {modalTrocaAberto && postoParaTroca && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Trocar Titular do Posto: {postoParaTroca.codigoPosto}</h3>
                <span className="text-xs text-slate-400">{formatarTexto(postoParaTroca.funcao)}</span>
              </div>
              <button
                onClick={() => {
                  setModalTrocaAberto(false);
                  setPostoParaTroca(null);
                }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarTrocaTitular} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-1">
                <div className="text-[11px] text-slate-500">Função Contratual</div>
                <div className="font-medium text-slate-900 text-sm">{formatarTexto(postoParaTroca.funcao)}</div>
                <div className="text-[11px] text-slate-600">
                  Escala: {postoParaTroca.escala} ({postoParaTroca.jornadaSemanalHoras}h/sem)
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Titular Atual no Contrato</label>
                <div className="p-2.5 bg-slate-100 rounded-md text-slate-800 font-medium">
                  {postoParaTroca.titularNome ? (
                    <span>{formatarNome(postoParaTroca.titularNome)} (Matrícula: {postoParaTroca.titularMatricula})</span>
                  ) : (
                    <span className="text-amber-800">100% Vago (Sem titular alocado)</span>
                  )}
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">
                  Selecione o Novo Titular Contratual <span className="text-rose-500">*</span>
                </label>
                <select
                  value={novoTitularMatricula}
                  onChange={(e) => setNovoTitularMatricula(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-2 bg-white text-slate-800 font-medium outline-none focus:border-slate-500"
                >
                  <option value="">Deixar como Posto Vago (Sem Titular)</option>
                  <optgroup label="Colaboradores na Reserva Técnica (Recomendados)">
                    {profissionais
                      .filter((pr) => pr.situacao === "ATIVO" && !pr.postoCodigo)
                      .map((pr) => (
                        <option key={pr.matricula} value={pr.matricula}>
                          ★ {formatarNome(pr.nome)} ({pr.matricula}) — {formatarTexto(pr.funcao)} [Reserva Técnica]
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Colaboradores Ativos (Titulares de Outros Postos)">
                    {profissionais
                      .filter((pr) => pr.situacao === "ATIVO" && pr.postoCodigo)
                      .map((pr) => (
                        <option key={pr.matricula} value={pr.matricula}>
                          {formatarNome(pr.nome)} ({pr.matricula}) — Atual no posto {pr.postoCodigo}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Ao selecionar um novo colaborador, o sistema atualiza automaticamente o registro no cadastro de Profissionais e no Mapa de Cobertura.
                </p>
              </div>

              {/* Alerta de Interjornada CLT Art. 66 */}
              {alertaInterjornadaTroca && !alertaInterjornadaTroca.atende && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2 text-xs animate-fadeIn">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Alerta CLT Art. 66 (Interjornada &lt; 11h)</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    O descanso apurado entre jornadas é de <strong>{alertaInterjornadaTroca.horasDescansoFormatado}</strong> (déficit de {alertaInterjornadaTroca.deficitFormatado} em relação às 11h mínimas legais).
                  </p>
                  <div className="p-2 bg-white rounded border border-rose-200 flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="checkCienciaTroca"
                      checked={cienteInterjornadaTroca}
                      onChange={(e) => setCienciaInterjornadaTroca(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 text-rose-600 rounded cursor-pointer"
                    />
                    <label htmlFor="checkCienciaTroca" className="text-[10px] text-rose-950 font-semibold cursor-pointer">
                      Declaro ciência da não observância do repouso de 11h e autorizo a troca em caráter excepcional.
                    </label>
                  </div>
                </div>
              )}

              <div className="p-3 bg-slate-50 border-t border-slate-200 -mx-5 -mb-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalTrocaAberto(false);
                    setPostoParaTroca(null);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded shadow-2xs transition-colors cursor-pointer"
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
