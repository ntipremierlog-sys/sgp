"use client";

/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Tela de Gestão: Descobertos do Período (Item 11.3 Petrobras)
 *
 * Funcionalidades:
 * - Lista de posições com D (Descoberto) por unidade e data
 * - Filtros por Base, Período, Categoria de Ausência e Busca Textual
 * - Sugestão de feristas vinculados disponíveis no mesmo dia
 * - Conflitos operacionais e pendências de escala/cobertura
 * - Exportação oficial para Excel (.xlsx)
 * - Nenhuma informação médica/sensível exibida (Conformidade LGPD)
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  carregarEstado,
  salvarEstado,
  calcularStatusVagaDia,
  obterTodosPostosContrato,
  PostoOperacional,
  VagaPosto,
  AlocacaoVaga,
  OcorrenciaOperacional,
  CoberturaOperacional,
  registrarLogAuditoria,
} from "@/lib/dados/estado-operacional";
import { VAGAS_MC_REAIS, ALOCACOES_MC_REAIS } from "@/lib/dados/estrutura-postos";
import {
  obterFeristasSugeridosParaPosicao,
  FeristaSugerido,
} from "@/lib/servicos/sugestao-cobertura";
import {
  detectarConflitosOperacionais,
  ConflitoOperacional,
} from "@/lib/servicos/conflitos-operacionais";
import {
  gerarPlanilhaDescobertosXlsx,
  ItemDescobertoExportacao,
} from "@/lib/exportadores/descobertos-xlsx";
import {
  AlertTriangle,
  Search,
  FileSpreadsheet,
  Filter,
  Calendar,
  Building2,
  UserCheck,
  Clock,
  CheckCircle2,
  X,
  Info,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from "lucide-react";

interface ItemDescobertoCompleto {
  id: string; // `${posicaoId}_${data}`
  posicaoId: string;
  codigoVisual?: string;
  postoId: string;
  codigoPosto: string;
  funcao: string;
  unidade: string;
  dataStr: string;
  diaSemana: string;
  titularNome: string;
  titularChapa: string;
  categoriaAusencia: string;
  motivoPublico: string;
  horario: string;
  feristasSugeridos: FeristaSugerido[];
  postoObj: PostoOperacional;
  vagaObj: VagaPosto;
}

export default function DescobertosPeriodoPage() {
  const [carregando, setCarregando] = useState(true);
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [vagas, setVagas] = useState<VagaPosto[]>([]);
  const [alocacoes, setAlocacoes] = useState<AlocacaoVaga[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);
  const [coberturas, setCoberturas] = useState<CoberturaOperacional[]>([]);
  const [conflitos, setConflitos] = useState<ConflitoOperacional[]>([]);

  // Filtros
  const [mesAno, setMesAno] = useState("2026-08");
  const [dataInicio, setDataInicio] = useState("2026-08-01");
  const [dataFim, setDataFim] = useState("2026-08-31");
  const [filtroBase, setFiltroBase] = useState("TODAS");
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");
  const [busca, setBusca] = useState("");
  const [mostrarConflitos, setMostrarConflitos] = useState(false);

  // Modal de Cobertura Rápida
  const [itemSelecionado, setItemSelecionado] = useState<ItemDescobertoCompleto | null>(null);
  const [substitutoChapa, setSubstitutoChapa] = useState("");
  const [substitutoNome, setSubstitutoNome] = useState("");
  const [salvandoCobertura, setSalvandoCobertura] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Carregar dados
  const carregarDadosDoSistema = () => {
    const estado = carregarEstado();
    const todosPostos = obterTodosPostosContrato();
    setPostos(todosPostos);
    setVagas(estado.vagas || VAGAS_MC_REAIS);
    setAlocacoes(estado.alocacoes || ALOCACOES_MC_REAIS);
    setOcorrencias(estado.ocorrencias || []);
    setCoberturas(estado.coberturas || []);
    setConflitos(detectarConflitosOperacionais(estado));
    setCarregando(false);
  };

  useEffect(() => {
    carregarDadosDoSistema();
    const handleAtualizacao = () => carregarDadosDoSistema();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // Atualiza datas quando o mês selecionado muda
  const handleMudarMesAno = (novoMesAno: string) => {
    setMesAno(novoMesAno);
    const [ano, mes] = novoMesAno.split("-").map(Number);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    setDataInicio(`${novoMesAno}-01`);
    setDataFim(`${novoMesAno}-${String(ultimoDia).padStart(2, "0")}`);
  };

  // Bases operacionais únicas
  const listaBases = useMemo(() => {
    const set = new Set<string>();
    postos.forEach((p) => {
      const b = p.baseOperacional || p.localAtuacao || p.unidadeNome || p.unidadeId;
      if (b) set.add(b.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [postos]);

  // Lista de dias dentro do período
  const diasDoPeriodo = useMemo(() => {
    const lista: string[] = [];
    if (!dataInicio || !dataFim || dataInicio > dataFim) return lista;

    const dt = new Date(dataInicio + "T00:00:00");
    const fim = new Date(dataFim + "T00:00:00");

    while (dt <= fim) {
      lista.push(dt.toISOString().slice(0, 10));
      dt.setDate(dt.getDate() + 1);
    }
    return lista;
  }, [dataInicio, dataFim]);

  // Apuração de todos os Descobertos (D) no período
  const todosDescobertos = useMemo(() => {
    const lista: ItemDescobertoCompleto[] = [];
    const diasSemanaNomes = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

    vagas.forEach((vaga) => {
      const posto = postos.find(
        (p) =>
          p.idPosto === vaga.idPosto ||
          p.id === vaga.idPosto ||
          (p as any).postoIdSGP === vaga.postoIdSGP ||
          p.codigoPosto === vaga.idPosto
      );
      if (!posto) return;

      diasDoPeriodo.forEach((dtStr) => {
        const apuracao = calcularStatusVagaDia(
          vaga,
          posto,
          dtStr,
          alocacoes,
          ocorrencias,
          coberturas
        );

        if (apuracao.status === "DESCOBERTO") {
          const dtObj = new Date(dtStr + "T00:00:00");
          const diaSemana = diasSemanaNomes[dtObj.getDay()];

          const sugeridos = obterFeristasSugeridosParaPosicao(
            posto.idPosto || posto.id,
            dtStr,
            { postos, vagas, alocacoes, ocorrencias, coberturas } as any
          );

          const categoriaAus =
            apuracao.categoriaAusencia ||
            apuracao.ocorrencia?.categoriaAusencia ||
            apuracao.ocorrencia?.tipo ||
            "Ausência Sem Cobertura";

          lista.push({
            id: `${vaga.id}_${dtStr}`,
            posicaoId: vaga.posicaoIdSGP || vaga.id,
            codigoVisual: (vaga as any).codigoVisual || vaga.etiqueta || vaga.sequencia?.toString(),
            postoId: posto.idPosto || posto.id,
            codigoPosto: posto.codigoPosto || posto.idPosto,
            funcao: posto.funcao,
            unidade: posto.baseOperacional || posto.localAtuacao || posto.unidadeNome || "Unidade",
            dataStr: dtStr,
            diaSemana,
            titularNome: apuracao.ocupanteNome || posto.titularNome || "Titular Não Identificado",
            titularChapa: apuracao.ocupanteMatricula || posto.titularMatricula || "—",
            categoriaAusencia: categoriaAus,
            motivoPublico: apuracao.motivoPublico,
            horario: apuracao.horarioPrevisto || `${posto.horarioInicio || "07:00"} às ${posto.horarioFim || "17:00"}`,
            feristasSugeridos: sugeridos,
            postoObj: posto,
            vagaObj: vaga,
          });
        }
      });
    });

    return lista.sort((a, b) => a.dataStr.localeCompare(b.dataStr) || a.unidade.localeCompare(b.unidade));
  }, [vagas, postos, diasDoPeriodo, alocacoes, ocorrencias, coberturas]);

  // Descobertos com filtros aplicados
  const descobertosFiltrados = useMemo(() => {
    return todosDescobertos.filter((d) => {
      // 1. Filtro de Base
      if (filtroBase !== "TODAS") {
        if (d.unidade.trim().toUpperCase() !== filtroBase.trim().toUpperCase()) return false;
      }

      // 2. Filtro de Categoria
      if (filtroCategoria !== "TODAS") {
        if (d.categoriaAusencia.trim().toUpperCase() !== filtroCategoria.trim().toUpperCase()) {
          return false;
        }
      }

      // 3. Busca textual
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const match =
          d.titularNome.toLowerCase().includes(q) ||
          d.titularChapa.toLowerCase().includes(q) ||
          d.codigoPosto.toLowerCase().includes(q) ||
          d.posicaoId.toLowerCase().includes(q) ||
          d.funcao.toLowerCase().includes(q) ||
          d.unidade.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [todosDescobertos, filtroBase, filtroCategoria, busca]);

  // Lista de categorias únicas para o filtro
  const listaCategorias = useMemo(() => {
    const set = new Set<string>();
    todosDescobertos.forEach((d) => {
      if (d.categoriaAusencia) set.add(d.categoriaAusencia);
    });
    return Array.from(set).sort();
  }, [todosDescobertos]);

  // Contadores para KPIs
  const totalDiarias = descobertosFiltrados.length;
  const posicoesUnicas = useMemo(() => {
    return new Set(descobertosFiltrados.map((d) => d.posicaoId)).size;
  }, [descobertosFiltrados]);
  const unidadesAfetadas = useMemo(() => {
    return new Set(descobertosFiltrados.map((d) => d.unidade)).size;
  }, [descobertosFiltrados]);
  const comFeristasDisponiveis = useMemo(() => {
    return descobertosFiltrados.filter((d) => d.feristasSugeridos.length > 0).length;
  }, [descobertosFiltrados]);

  // Exportar para Excel
  const handleExportarExcel = () => {
    const dadosExportar: ItemDescobertoExportacao[] = descobertosFiltrados.map((d) => ({
      unidade: d.unidade,
      posicaoId: d.posicaoId,
      codigoVisual: d.codigoVisual,
      codigoPosto: d.codigoPosto,
      funcao: d.funcao,
      data: d.dataStr.split("-").reverse().join("/"),
      diaSemana: d.diaSemana,
      titularNome: d.titularNome,
      titularChapa: d.titularChapa,
      categoriaAusencia: d.categoriaAusencia,
      horario: d.horario,
      feristasSugeridos: d.feristasSugeridos.map((f) => `${f.nome} (${f.chapa})`).join("; "),
      status: "DESCOBERTO (D)",
    }));

    const buffer = gerarPlanilhaDescobertosXlsx(
      dadosExportar,
      `${dataInicio.split("-").reverse().join("/")} a ${dataFim.split("-").reverse().join("/")}`
    );

    const blob = new Blob([buffer as any], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SGP_Descobertos_Periodo_${mesAno}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Abrir Modal de Cobertura
  const handleAbrirModalCobertura = (item: ItemDescobertoCompleto) => {
    setItemSelecionado(item);
    if (item.feristasSugeridos.length > 0) {
      setSubstitutoChapa(item.feristasSugeridos[0].chapa);
      setSubstitutoNome(item.feristasSugeridos[0].nome);
    } else {
      setSubstitutoChapa("");
      setSubstitutoNome("");
    }
  };

  // Confirmar Cobertura (Critério: ao registrar, D passa a C)
  const handleConfirmarCobertura = async () => {
    if (!itemSelecionado || !substitutoChapa || !substitutoNome) return;
    setSalvandoCobertura(true);

    const estadoAtual = carregarEstado();
    const dataHoraAtual = new Date().toISOString().replace("T", " ").substring(0, 19);

    const novaCobertura: CoberturaOperacional = {
      id: `cob-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      postoCodigo: itemSelecionado.codigoPosto,
      idPosto: itemSelecionado.postoId,
      vagaId: itemSelecionado.posicaoId,
      funcaoPosto: itemSelecionado.funcao,
      titularMatricula: itemSelecionado.titularChapa,
      titularNome: itemSelecionado.titularNome,
      substitutoMatricula: substitutoChapa,
      substitutoNome: substitutoNome,
      dataInicio: itemSelecionado.dataStr,
      dataFim: itemSelecionado.dataStr,
      tipoCobertura: "SUBSTITUICAO_INTERNA",
      status: "CONFIRMADA",
      justificativa: `Cobertura registrada para suprir ${itemSelecionado.categoriaAusencia} na posição ${itemSelecionado.posicaoId}`,
      criadoEm: dataHoraAtual,
    };

    const coberturasAtualizadas = [novaCobertura, ...(estadoAtual.coberturas || [])];

    salvarEstado({
      coberturas: coberturasAtualizadas,
    });

    registrarLogAuditoria(
      "REGISTRO_COBERTURA_DESCOBERTO",
      `Posição (${itemSelecionado.posicaoId})`,
      `Cobertura registrada para o dia ${itemSelecionado.dataStr}: substituto ${substitutoNome} (${substitutoChapa}) cobrindo titular ${itemSelecionado.titularNome}. Posição passa de D para C.`,
      "Gestor Operacional Premier"
    );

    setSalvandoCobertura(false);
    setMensagemSucesso(
      `Cobertura registrada com sucesso para ${substitutoNome} em ${itemSelecionado.dataStr.split("-").reverse().join("/")}. A posição passou de Descoberto (D) para Coberto (C)!`
    );
    setItemSelecionado(null);
    carregarDadosDoSistema();

    setTimeout(() => {
      setMensagemSucesso(null);
    }, 6000);
  };

  if (carregando) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Clock className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Carregando mapa de descobertos do contrato...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
              FISCALIZAÇÃO TÉCNICA · ITEM 11.3
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Conformidade LGPD Estrita
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Descobertos do Período</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoramento analítico de diárias não cobertas (D) passíveis de glosa na medição da Petrobras.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMostrarConflitos(!mostrarConflitos)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              conflitos.length > 0
                ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Conflitos Operacionais ({conflitos.length})
            {mostrarConflitos ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </button>

          <button
            onClick={handleExportarExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Banner de Mensagem de Sucesso */}
      {mensagemSucesso && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{mensagemSucesso}</span>
          </div>
          <button
            onClick={() => setMensagemSucesso(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Painel Retrátil de Conflitos Operacionais (Item 4) */}
      {mostrarConflitos && (
        <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <h2 className="text-sm font-bold text-amber-950">
                Conflitos Operacionais & Pendências do Período ({conflitos.length})
              </h2>
            </div>
            <span className="text-[11px] text-amber-800">
              Sinalizações preventivas de dupla alocação ou divergência com o RM
            </span>
          </div>

          {conflitos.length === 0 ? (
            <p className="text-xs text-amber-800 italic">
              Nenhum conflito de dupla cobertura ou inconsistência com o RM detectado no período.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {conflitos.map((conf) => (
                <div
                  key={conf.id}
                  className="p-3 bg-white rounded-lg border border-amber-300 shadow-sm text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 uppercase">
                      {conf.tipoDescricao}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-slate-500">
                      {conf.data.split("-").reverse().join("/")}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-900">{conf.titulo}</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{conf.descricao}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Diárias Descobertas (D)</span>
            <div className="text-2xl font-black text-rose-600 mt-1">{totalDiarias}</div>
            <span className="text-[11px] text-slate-400">Passíveis de glosa contratual</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Posições Afetadas</span>
            <div className="text-2xl font-black text-slate-800 mt-1">{posicoesUnicas}</div>
            <span className="text-[11px] text-slate-400">Postos com ao menos 1 falta</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Unidades com Descobertos</span>
            <div className="text-2xl font-black text-slate-800 mt-1">{unidadesAfetadas}</div>
            <span className="text-[11px] text-slate-400">De 29 bases contratuais</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Filter className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Com Feristas Disponíveis</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{comFeristasDisponiveis}</div>
            <span className="text-[11px] text-slate-400">Prontos para cobertura imediata</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-blue-600" />
          Filtros de Apuração Contratual
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Seletor de Competência Rápida */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Mês / Competência</label>
            <select
              value={mesAno}
              onChange={(e) => handleMudarMesAno(e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="2026-08">Agosto / 2026</option>
              <option value="2026-09">Setembro / 2026</option>
              <option value="2026-07">Julho / 2026</option>
            </select>
          </div>

          {/* Período Data Inicial e Final */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>

          {/* Base Operacional */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Base Operacional</label>
            <select
              value={filtroBase}
              onChange={(e) => setFiltroBase(e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              <option value="TODAS">Todas as Bases ({listaBases.length})</option>
              {listaBases.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Categoria de Ausência */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Categoria de Ausência</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              <option value="TODAS">Todas as Categorias</option>
              {listaCategorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Busca por texto */}
        <div className="pt-1">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nome do titular, matrícula RM, código de posto ou posição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Descobertos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <h3 className="text-sm font-bold text-slate-900">
              Posições Descobertas no Período ({descobertosFiltrados.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Exibindo registros entre {dataInicio.split("-").reverse().join("/")} e {dataFim.split("-").reverse().join("/")}
          </span>
        </div>

        {descobertosFiltrados.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">Nenhum posto descoberto no período selecionado</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Todas as posições programadas possuem titular presente (P) ou cobertura confirmada (C) no intervalo consultado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                  <th className="p-3">Data</th>
                  <th className="p-3">Unidade / Base</th>
                  <th className="p-3">Posição SGP</th>
                  <th className="p-3">Função</th>
                  <th className="p-3">Titular Ausente</th>
                  <th className="p-3">Categoria Ausência</th>
                  <th className="p-3">Horário Previsto</th>
                  <th className="p-3">Feristas Sugeridos (Disponíveis)</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {descobertosFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Data */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {item.dataStr.split("-").reverse().join("/")}
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">{item.diaSemana}</span>
                    </td>

                    {/* Unidade */}
                    <td className="p-3 font-semibold text-slate-800">{item.unidade}</td>

                    {/* Posição */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-blue-900">{item.posicaoId}</div>
                      {item.codigoVisual && item.codigoVisual !== item.posicaoId && (
                        <span className="text-[10px] text-slate-500 font-mono">Visual: {item.codigoVisual}</span>
                      )}
                    </td>

                    {/* Função */}
                    <td className="p-3 text-slate-700 font-medium max-w-[200px] truncate" title={item.funcao}>
                      {item.funcao}
                    </td>

                    {/* Titular Ausente */}
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{item.titularNome}</div>
                      <div className="text-[10px] font-mono text-slate-500">Chapa: {item.titularChapa}</div>
                    </td>

                    {/* Categoria Ausência (Sem Dados Médicos) */}
                    <td className="p-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                          item.categoriaAusencia.toUpperCase().includes("FÉRIAS") || item.categoriaAusencia.toUpperCase().includes("FERIAS")
                            ? "bg-amber-100 text-amber-900 border-amber-200"
                            : item.categoriaAusencia.toUpperCase().includes("AFASTAMENTO")
                            ? "bg-rose-100 text-rose-900 border-rose-200"
                            : item.categoriaAusencia.toUpperCase().includes("LICENÇA")
                            ? "bg-blue-100 text-blue-900 border-blue-200"
                            : "bg-slate-100 text-slate-800 border-slate-200"
                        }`}
                      >
                        {item.categoriaAusencia}
                      </span>
                    </td>

                    {/* Horário */}
                    <td className="p-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {item.horario}
                    </td>

                    {/* Feristas Sugeridos (Disponíveis) */}
                    <td className="p-3 max-w-[280px]">
                      {item.feristasSugeridos.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.feristasSugeridos.slice(0, 2).map((f) => (
                            <span
                              key={f.chapa}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium"
                              title={`Ferista vinculado: ${f.nome} (Chapa ${f.chapa})`}
                            >
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              {f.nome.split(" ")[0]} ({f.chapa})
                            </span>
                          ))}
                          {item.feristasSugeridos.length > 2 && (
                            <span className="text-[10px] text-slate-400 font-semibold self-center">
                              +{item.feristasSugeridos.length - 2} outros
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Nenhum ferista vinculado livre nesta data
                        </span>
                      )}
                    </td>

                    {/* Ação */}
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleAbrirModalCobertura(item)}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 font-bold text-xs border border-blue-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Cobrir</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Registro de Cobertura */}
      {itemSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            {/* Cabeçalho do Modal */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Registrar Cobertura de Posição</h3>
              </div>
              <button
                onClick={() => setItemSelecionado(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Posição / Posto:</span>
                  <span className="font-bold text-slate-800">{itemSelecionado.posicaoId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Data do Descoberto:</span>
                  <span className="font-bold text-slate-800">
                    {itemSelecionado.dataStr.split("-").reverse().join("/")} ({itemSelecionado.diaSemana})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Titular Ausente:</span>
                  <span className="font-bold text-slate-800">
                    {itemSelecionado.titularNome} ({itemSelecionado.titularChapa})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Categoria da Ausência:</span>
                  <span className="font-bold text-rose-700">{itemSelecionado.categoriaAusencia}</span>
                </div>
              </div>

              {/* Lista de Feristas Sugeridos */}
              <div className="space-y-2">
                <label className="font-bold text-slate-800 block text-xs">
                  Feristas Vinculados Sugeridos (Disponíveis):
                </label>

                {itemSelecionado.feristasSugeridos.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                    {itemSelecionado.feristasSugeridos.map((f) => (
                      <label
                        key={f.chapa}
                        className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                          substitutoChapa === f.chapa
                            ? "bg-blue-50 border-blue-400 text-blue-950 font-bold"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="feristaSugerido"
                            checked={substitutoChapa === f.chapa}
                            onChange={() => {
                              setSubstitutoChapa(f.chapa);
                              setSubstitutoNome(f.nome);
                            }}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span>{f.nome}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">Chapa: {f.chapa}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    Nenhum ferista vinculado à escala deste posto está disponível sem cobertura nesta data.
                    Informe a matrícula de outro colaborador abaixo.
                  </div>
                )}
              </div>

              {/* Informar manualmente se preferir */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="font-bold text-slate-800 block text-xs">
                  Ou digite a Matrícula / Nome do Substituto:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Chapa (ex: 036830)"
                    value={substitutoChapa}
                    onChange={(e) => setSubstitutoChapa(e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Nome completo do substituto"
                    value={substitutoNome}
                    onChange={(e) => setSubstitutoNome(e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setItemSelecionado(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarCobertura}
                disabled={!substitutoChapa || !substitutoNome || salvandoCobertura}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                {salvandoCobertura ? "Gravando..." : "Confirmar Cobertura (Mudar para C)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
