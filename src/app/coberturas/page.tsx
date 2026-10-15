"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  UserCheck2,
  MessageSquare,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { usePermissoes } from "@/lib/auth/use-permissoes";
import { useSessaoUsuario } from "@/lib/auth/use-sessao-usuario";
import {
  carregarEstado,
  adicionarCobertura,
  atualizarCobertura,
  excluirCobertura,
  obterItemPpuDoPosto,
  obterTodosPostosContrato,
  obterMarcacoesPonto,
  obterCompetenciaCongeladaNoPeriodo,
  verificarConflitosCobertura,
  CoberturaOperacional,
  PostoOperacional,
  ProfissionalOperacional,
} from "@/lib/dados/estado-operacional";
import { exportarRelatorioParaXlsx } from "@/lib/servicos/relatorios-oficiais";
import { validarInterjornadaClt } from "@/lib/servicos/validacao-interjornada";
import { CampoItemPpu } from "@/components/cobertura/campo-item-ppu";
import { CATALOGO_ITEM_PPU, obterItemPPU } from "@/lib/dados/painel-calculo";

export type CategoriaMotivoLgpd = "Férias" | "Licença" | "Afastamento" | "Falta" | "Outros";

export interface CoberturaLinha {
  id: string;
  imovel: string;
  postoCodigo: string;
  postoFuncao: string;
  itemPpu: string;
  itemPpuDescricao: string;
  titularNome: string;
  titularMatricula: string;
  substitutoNome: string;
  substitutoMatricula: string;
  dataInicio: string;
  dataFim: string;
  periodoFormatado: string;
  diarias: number;
  motivoCategoria: CategoriaMotivoLgpd;
  status: "CONFIRMADA" | "PLANEJADA" | "CANCELADA";
  tipoCobertura: string;
  alertaInterjornada?: boolean;
  previaConferencia?: "PREVIA_1" | "PREVIA_2" | "PREVIA_3" | null;
  statusConferenciaPosto?: "COBERTO" | "DESCOBERTO" | null;
  comentarioConferencia?: string;
}

function normalizarItemPpu(codigo?: string): string {
  if (!codigo) return "1.1";
  const c = String(codigo).trim();
  const partes = c.split(".");
  if (partes.length === 2) {
    const p1 = parseInt(partes[0], 10);
    const p2 = parseInt(partes[1], 10);
    if (!isNaN(p1) && !isNaN(p2)) return `${p1}.${p2}`;
  }
  return c;
}

function formatarPeriodoDdMm(dInicio: string, dFim: string): string {
  if (!dInicio) return "—";
  const pIni = dInicio.split("-");
  const ddIni = pIni[2] || "01";
  const mmIni = pIni[1] || "01";
  if (!dFim || dInicio === dFim) {
    return `${ddIni}/${mmIni}`;
  }
  const pFim = dFim.split("-");
  const ddFim = pFim[2] || "01";
  const mmFim = pFim[1] || "01";
  return `${ddIni}/${mmIni} – ${ddFim}/${mmFim}`;
}

function calcularDiarias(dInicio: string, dFim: string): number {
  if (!dInicio || !dFim) return 1;
  const d1 = new Date(dInicio + "T00:00:00");
  const d2 = new Date(dFim + "T00:00:00");
  const diff = d2.getTime() - d1.getTime();
  if (isNaN(diff) || diff < 0) return 1;
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function classificarMotivoLgpd(motivo?: string): CategoriaMotivoLgpd {
  if (!motivo) return "Outros";
  const m = motivo.trim().toLowerCase();
  if (m.includes("férias") || m.includes("ferias")) return "Férias";
  if (m.includes("licença") || m.includes("licenca")) return "Licença";
  if (
    m.includes("afastamento") ||
    m.includes("médic") ||
    m.includes("medic") ||
    m.includes("saúde") ||
    m.includes("saude") ||
    m.includes("atestado") ||
    m.includes("cid")
  ) {
    return "Afastamento";
  }
  if (m.includes("falta") || m.includes("injustificada")) return "Falta";
  return "Outros";
}

function obterCorPontoStatus(status: string): string {
  switch (status) {
    case "CONFIRMADA":
      return "bg-emerald-500";
    case "PLANEJADA":
      return "bg-amber-500";
    case "CANCELADA":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PaginaGestaoCoberturas() {
  const { pode } = usePermissoes();
  const podeCriar = pode("CRIAR", "COBERTURAS");
  const podeExportar = pode("EXPORTAR", "COBERTURAS");
  const { sessao: usuario } = useSessaoUsuario();

  // Estados dos Filtros Compactos do Topo
  const [competencia, setCompetencia] = useState("2026-09");
  const [imovelFiltro, setImovelFiltro] = useState("TODOS");
  const [itemPpuFiltro, setItemPpuFiltro] = useState("TODOS");
  const [motivoFiltro, setMotivoFiltro] = useState("TODOS");
  const [statusFiltro, setStatusFiltro] = useState("TODOS");
  const [previaFiltro, setPreviaFiltro] = useState("TODOS");
  const [formPrevia, setFormPrevia] = useState<string>("");
  const [formStatusPostoPrevia, setFormStatusPostoPrevia] = useState<"COBERTO" | "DESCOBERTO">("COBERTO");
  const [formComentarioConferencia, setFormComentarioConferencia] = useState("");
  const [comentarioModal, setComentarioModal] = useState<{ posto: string; substituto: string; previa: string; statusPosto: string; comentario: string } | null>(null);

  // Estado da Paginação no Servidor (25 por página)
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [coberturas, setCoberturas] = useState<CoberturaLinha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [imoveisDisponiveis, setImoveisDisponiveis] = useState<string[]>([]);
  const [itensPpuDisponiveis, setItensPpuDisponiveis] = useState<string[]>([]);

  // Feedback e Modais
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [coberturaEmEdicao, setCoberturaEmEdicao] = useState<CoberturaOperacional | null>(null);

  // Formulário Modal de Cobertura
  const [formPostoCodigo, setFormPostoCodigo] = useState("");
  const [formVagaId, setFormVagaId] = useState("");
  const [formSubstitutoMatricula, setFormSubstitutoMatricula] = useState("");
  const [formDataInicio, setFormDataInicio] = useState(() => hojeISO());
  const [formDataFim, setFormDataFim] = useState(() => hojeISO());
  const [formTipo, setFormTipo] = useState<CoberturaOperacional["tipoCobertura"]>("SUBSTITUICAO_INTERNA");
  const [formJustificativa, setFormJustificativa] = useState("");
  const [formItemPpu, setFormItemPpu] = useState("1.1");
  const [cienteInterjornada, setCienciaInterjornada] = useState(false);

  // Cadastros auxiliares para o formulário
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);

  // 1. Carrega dados do servidor com paginação (25 por página)
  const carregarCoberturasServidor = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        competencia,
        imovel: imovelFiltro,
        itemPpu: itemPpuFiltro,
        motivo: motivoFiltro,
        status: statusFiltro,
        previa: previaFiltro,
        page: String(paginaAtual),
      });

      const res = await fetch(`/api/coberturas?${params.toString()}`, {
        cache: "no-store",
      });

      if (res.ok) {
        const dados = await res.json();
        if (dados.sucesso) {
          setCoberturas(dados.coberturas || []);
          setTotalPaginas(dados.totalPaginas || 1);
          setTotalRegistros(dados.totalRegistros || 0);
          if (dados.filtrosDisponiveis) {
            setImoveisDisponiveis(dados.filtrosDisponiveis.imoveis || []);
            setItensPpuDisponiveis(dados.filtrosDisponiveis.itensPpu || []);
          }
          return;
        }
      }
      // Fallback gracioso para estado local se a API não estiver disponível
      carregarCoberturasLocal();
    } catch (err) {
      console.warn("Falha ao consultar /api/coberturas. Carregando localmente:", err);
      carregarCoberturasLocal();
    } finally {
      setCarregando(false);
    }
  }, [competencia, imovelFiltro, itemPpuFiltro, motivoFiltro, statusFiltro, previaFiltro, paginaAtual]);

  // Fallback caso execução local sem rede
  const carregarCoberturasLocal = () => {
    const estado = carregarEstado();
    const postosTodos = obterTodosPostosContrato(estado.postos);
    setPostos(postosTodos);
    setProfissionais(estado.profissionais || []);

    const [anoComp, mesComp] = competencia.split("-").map(Number);
    const ultimoDia = new Date(anoComp, mesComp, 0).getDate();
    const dIniMes = `${competencia}-01`;
    const dFimMes = `${competencia}-${String(ultimoDia).padStart(2, "0")}`;

    const cobLocais: CoberturaLinha[] = (estado.coberturas || [])
      .filter((c) => c.dataInicio <= dFimMes && c.dataFim >= dIniMes)
      .map((c) => {
        const p = postosTodos.find((pt) => pt.codigoPosto === c.postoCodigo || pt.idPosto === c.postoCodigo);
        const imovel = p?.localAtuacao || p?.baseOperacional || p?.unidadeNome || "Base";
        const itemPpuCod = normalizarItemPpu(c.itemPpu || p?.itemPPU || "1.1");
        const itemPpuObj = obterItemPPU(itemPpuCod);

        return {
          id: c.id,
          imovel,
          postoCodigo: c.postoCodigo,
          postoFuncao: c.funcaoPosto || p?.funcao || "Operacional",
          itemPpu: itemPpuCod,
          itemPpuDescricao: itemPpuObj?.descricao || `Item ${itemPpuCod}`,
          titularNome: c.titularNome?.trim() || "Posto vago",
          titularMatricula: c.titularMatricula?.trim() || "—",
          substitutoNome: c.substitutoNome?.trim() || "Ferista",
          substitutoMatricula: c.substitutoMatricula?.trim() || "—",
          dataInicio: c.dataInicio,
          dataFim: c.dataFim,
          periodoFormatado: formatarPeriodoDdMm(c.dataInicio, c.dataFim),
          diarias: calcularDiarias(c.dataInicio, c.dataFim),
          motivoCategoria: classificarMotivoLgpd(c.justificativa),
          status: (c.status || "CONFIRMADA") as any,
          tipoCobertura: c.tipoCobertura || "SUBSTITUICAO_INTERNA",
          alertaInterjornada: c.alertaInterjornada,
          previaConferencia: c.previaConferencia || null,
          statusConferenciaPosto: c.statusConferenciaPosto || null,
          comentarioConferencia: c.comentarioConferencia || "",
        };
      });

    const filtradas = cobLocais.filter((item) => {
      if (imovelFiltro !== "TODOS" && item.imovel.toLowerCase() !== imovelFiltro.toLowerCase()) return false;
      if (itemPpuFiltro !== "TODOS" && normalizarItemPpu(item.itemPpu) !== normalizarItemPpu(itemPpuFiltro)) return false;
      if (motivoFiltro !== "TODOS" && item.motivoCategoria !== motivoFiltro) return false;
      if (statusFiltro !== "TODOS" && item.status !== statusFiltro) return false;
      if (previaFiltro !== "TODOS" && item.previaConferencia !== previaFiltro) return false;
      return true;
    });

    const pageSize = 25;
    const total = filtradas.length;
    const paginas = Math.max(1, Math.ceil(total / pageSize));
    const pagSegura = Math.min(paginaAtual, paginas);
    const paginadas = filtradas.slice((pagSegura - 1) * pageSize, pagSegura * pageSize);

    setCoberturas(paginadas);
    setTotalPaginas(paginas);
    setTotalRegistros(total);
  };

  useEffect(() => {
    carregarCoberturasServidor();
  }, [carregarCoberturasServidor]);

  // Carrega lista auxiliar de postos e profissionais para o modal
  useEffect(() => {
    try {
      const estado = carregarEstado();
      setPostos(obterTodosPostosContrato(estado.postos));
      setProfissionais(estado.profissionais || []);
    } catch {}
  }, []);

  // Reset de página ao alterar qualquer filtro
  const handleAlterarFiltro = (setter: (v: string) => void, valor: string) => {
    setter(valor);
    setPaginaAtual(1);
  };

  const handleLimparFiltros = () => {
    setImovelFiltro("TODOS");
    setItemPpuFiltro("TODOS");
    setMotivoFiltro("TODOS");
    setStatusFiltro("TODOS");
    setPaginaAtual(1);
  };

  const temFiltroAtivo =
    imovelFiltro !== "TODOS" ||
    itemPpuFiltro !== "TODOS" ||
    motivoFiltro !== "TODOS" ||
    statusFiltro !== "TODOS";

  // Exportação Excel
  const handleExportarXlsx = () => {
    try {
      const buffer = exportarRelatorioParaXlsx("coberturas", {
        periodo: competencia,
        unidadeId: imovelFiltro === "TODOS" ? undefined : imovelFiltro,
        itemPpu: itemPpuFiltro === "TODOS" ? undefined : itemPpuFiltro,
        usuarioEmissor: usuario?.nome || "Operador SGP",
        perfilEmissor: usuario?.perfil || "PREMIER_GESTOR",
      });

      const blob = new Blob([buffer as any], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `SGP_Coberturas_${competencia}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Falha ao exportar planilha.");
    }
  };

  // Abrir Modal de Inclusão
  const abrirModalIncluir = () => {
    setCoberturaEmEdicao(null);
    setFormPostoCodigo("");
    setFormVagaId("");
    setFormSubstitutoMatricula("");
    setFormDataInicio(hojeISO());
    setFormDataFim(hojeISO());
    setFormTipo("SUBSTITUICAO_INTERNA");
    setFormJustificativa("");
    setFormItemPpu("1.1");
    setCienciaInterjornada(false);
    setFormPrevia("");
    setFormStatusPostoPrevia("COBERTO");
    setFormComentarioConferencia("");
    setModalAberto(true);
  };

  // Abrir Modal de Edição
  const abrirModalEditar = (cobLinha: CoberturaLinha) => {
    const estado = carregarEstado();
    const cob = (estado.coberturas || []).find((c) => c.id === cobLinha.id);
    if (!cob) {
      // Se não estiver no local, monta objeto compatível
      setCoberturaEmEdicao({
        id: cobLinha.id,
        postoCodigo: cobLinha.postoCodigo,
        idPosto: cobLinha.postoCodigo,
        funcaoPosto: cobLinha.postoFuncao,
        substitutoMatricula: cobLinha.substitutoMatricula,
        substitutoNome: cobLinha.substitutoNome,
        titularNome: cobLinha.titularNome,
        titularMatricula: cobLinha.titularMatricula,
        dataInicio: cobLinha.dataInicio,
        dataFim: cobLinha.dataFim,
        tipoCobertura: "SUBSTITUICAO_INTERNA",
        status: cobLinha.status,
        justificativa: cobLinha.motivoCategoria,
        itemPpu: cobLinha.itemPpu,
        criadoEm: hojeISO(),
      });
    } else {
      setCoberturaEmEdicao(cob);
    }

    setFormPostoCodigo(cobLinha.postoCodigo);
    setFormVagaId("");
    setFormSubstitutoMatricula(cobLinha.substitutoMatricula);
    setFormDataInicio(cobLinha.dataInicio);
    setFormDataFim(cobLinha.dataFim);
    setFormTipo((cob?.tipoCobertura as any) || "SUBSTITUICAO_INTERNA");
    setFormJustificativa(cob?.justificativa || cobLinha.motivoCategoria);
    setFormItemPpu(cobLinha.itemPpu || "1.1");
    setCienciaInterjornada(cob?.alertaInterjornada || false);
    setFormPrevia(cob?.previaConferencia || cobLinha.previaConferencia || "");
    setFormStatusPostoPrevia((cob?.statusConferenciaPosto || cobLinha.statusConferenciaPosto || "COBERTO") as "COBERTO" | "DESCOBERTO");
    setFormComentarioConferencia(cob?.comentarioConferencia || cobLinha.comentarioConferencia || "");
    setModalAberto(true);
  };

  // Salvar Cobertura (Inclusão / Edição)
  const handleSubmitCobertura = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPostoCodigo || !formSubstitutoMatricula || !formDataInicio || !formDataFim) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const postoObj = postos.find((p) => p.codigoPosto === formPostoCodigo || p.id === formPostoCodigo);
    const substitutoObj = profissionais.find((pr) => pr.matricula === formSubstitutoMatricula);

    try {
      if (coberturaEmEdicao) {
        atualizarCobertura(coberturaEmEdicao.id, {
          postoCodigo: formPostoCodigo,
          funcaoPosto: postoObj?.funcao || "Operacional",
          itemPpu: formItemPpu,
          substitutoMatricula: formSubstitutoMatricula,
          substitutoNome: substitutoObj?.nome || coberturaEmEdicao.substitutoNome,
          dataInicio: formDataInicio,
          dataFim: formDataFim,
          tipoCobertura: formTipo,
          justificativa: formJustificativa,
          previaConferencia: (formPrevia as any) || null,
          statusConferenciaPosto: formStatusPostoPrevia,
          comentarioConferencia: formComentarioConferencia,
        });
        setMensagemSucesso("Cobertura atualizada com sucesso!");
      } else {
        adicionarCobertura({
          postoCodigo: formPostoCodigo,
          idPosto: postoObj?.idPosto || formPostoCodigo,
          funcaoPosto: postoObj?.funcao || "Operacional",
          itemPpu: formItemPpu,
          titularMatricula: postoObj?.titularMatricula,
          titularNome: postoObj?.titularNome,
          substitutoMatricula: formSubstitutoMatricula,
          substitutoNome: substitutoObj?.nome || "Ferista",
          dataInicio: formDataInicio,
          dataFim: formDataFim,
          tipoCobertura: formTipo,
          status: "CONFIRMADA",
          justificativa: formJustificativa || "Cobertura de posto",
          previaConferencia: (formPrevia as any) || null,
          statusConferenciaPosto: formStatusPostoPrevia,
          comentarioConferencia: formComentarioConferencia,
        });
        setMensagemSucesso("Cobertura registrada com sucesso!");
      }

      setModalAberto(false);
      carregarCoberturasServidor();
      setTimeout(() => setMensagemSucesso(""), 4000);
    } catch (err: any) {
      alert(err?.message || "Não foi possível salvar a cobertura.");
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4 py-2">
      {/* 1. TOPO EXECUTIVO LIMPO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck2 className="w-5 h-5 text-blue-700 shrink-0" />
            <span>Detalhamento Operacional de Coberturas</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle de coberturas e substituições mensais com vinculação ao Item da PPU (Contrato Petrobras).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {podeExportar && (
            <button
              onClick={handleExportarXlsx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              title="Baixar planilha Excel com abas Coberturas e Resumo PPU"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Exportar (.xlsx)</span>
            </button>
          )}

          {podeCriar && (
            <button
              onClick={abrirModalIncluir}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>Incluir Cobertura</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerta de Feedback */}
      {mensagemSucesso && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso("")} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. BARRA DE FILTROS COMPACTA NO TOPO */}
      {/* Competência (mês/ano), Imóvel, Item PPU, Motivo, Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Competência (mês/ano) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mês:</span>
            <input
              type="month"
              value={competencia}
              onChange={(e) => handleAlterarFiltro(setCompetencia, e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
              title="Filtrar por mês de competência"
            />
          </div>

          {/* Imóvel */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Imóvel:</span>
            <select
              value={imovelFiltro}
              onChange={(e) => handleAlterarFiltro(setImovelFiltro, e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs max-w-[170px]"
              title="Filtrar por Imóvel / Base"
            >
              <option value="TODOS">Todos os Imóveis</option>
              {imoveisDisponiveis.map((im) => (
                <option key={im} value={im}>{im}</option>
              ))}
            </select>
          </div>

          {/* Item PPU */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Item PPU:</span>
            <select
              value={itemPpuFiltro}
              onChange={(e) => handleAlterarFiltro(setItemPpuFiltro, e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs max-w-[160px]"
              title="Filtrar por Item da PPU Petrobras"
            >
              <option value="TODOS">Todos os Itens PPU</option>
              {CATALOGO_ITEM_PPU.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  Item {p.codigo} – {p.descricao.slice(0, 22)}...
                </option>
              ))}
            </select>
          </div>

          {/* Motivo (somente categorias oficiais) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Motivo:</span>
            <select
              value={motivoFiltro}
              onChange={(e) => handleAlterarFiltro(setMotivoFiltro, e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
              title="Filtrar por categoria do motivo (LGPD)"
            >
              <option value="TODOS">Todos os Motivos</option>
              <option value="Férias">Férias</option>
              <option value="Licença">Licença</option>
              <option value="Afastamento">Afastamento</option>
              <option value="Falta">Falta</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status:</span>
            <select
              value={statusFiltro}
              onChange={(e) => handleAlterarFiltro(setStatusFiltro, e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
              title="Filtrar por status"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="CONFIRMADA">Confirmada</option>
              <option value="PLANEJADA">Planejada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>

          {/* Prévia Petrobras (Prévia 1, 2 e 3) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Prévia:</span>
            <select
              value={previaFiltro}
              onChange={(e) => handleAlterarFiltro(setPreviaFiltro, e.target.value)}
              className="text-xs bg-amber-50/70 border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-amber-950 outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
              title="Filtrar por rodada de conferência Petrobras"
            >
              <option value="TODOS">Todas as Prévias</option>
              <option value="PREVIA_1">Prévia 1</option>
              <option value="PREVIA_2">Prévia 2</option>
              <option value="PREVIA_3">Prévia 3</option>
            </select>
          </div>

          {/* Botão Limpar Filtros */}
          {temFiltroAtivo && (
            <button
              onClick={handleLimparFiltros}
              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. TABELA OBJETIVA COM AS 9 COLUNAS NA ORDEM EXATA (CABE EM 1366PX SEM ROLAGEM HORIZONTAL) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse table-fixed bg-white">
          <thead className="bg-white border-b border-slate-200">
            <tr className="text-slate-400 font-medium text-[11px]">
              <th className="py-1.5 px-3 w-[11%]">Imóvel</th>
              <th className="py-1.5 px-2.5 w-[13%]">Posto</th>
              <th className="py-1.5 px-2.5 w-[8%]">Item PPU</th>
              <th className="py-1.5 px-3 w-[20%]">Titular ausente</th>
              <th className="py-1.5 px-3 w-[20%]">Cobertura</th>
              <th className="py-1.5 px-2.5 w-[11%]">Período</th>
              <th className="py-1.5 px-2 text-center w-[5%]">Diárias</th>
              <th className="py-1.5 px-2.5 w-[9%]">Motivo</th>
              <th className="py-1.5 px-2.5 w-[14%]">Conferência (Prévia)</th>
              <th className="py-1.5 px-2.5 w-[10%]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {carregando ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-400">
                  <div className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Carregando coberturas do servidor...</span>
                  </div>
                </td>
              </tr>
            ) : coberturas.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-400">
                  <UserCheck2 className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                  <p className="font-semibold text-slate-700">Nenhuma cobertura encontrada</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {temFiltroAtivo ? "Tente ajustar os filtros selecionados acima." : "Nenhuma cobertura no período."}
                  </p>
                </td>
              </tr>
            ) : (
              coberturas.map((cob) => (
                <tr
                  key={cob.id}
                  onClick={() => abrirModalEditar(cob)}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer group bg-white"
                >
                  {/* 1. Imóvel */}
                  <td className="py-1.5 px-3 truncate text-slate-700" title={`Imóvel / Base: ${cob.imovel}`}>
                    {cob.imovel}
                  </td>

                  {/* 2. Posto (só o código; descrição completa em tooltip) */}
                  <td
                    className="py-1.5 px-2.5 text-slate-800 font-medium truncate"
                    title={`Posto Contratual: ${cob.postoCodigo}\nDescrição / Função: ${cob.postoFuncao}`}
                  >
                    {cob.postoCodigo}
                  </td>

                  {/* 3. Item PPU (texto simples "1.1"; descrição no tooltip) */}
                  <td
                    className="py-1.5 px-2.5 text-slate-700 whitespace-nowrap"
                    title={cob.itemPpuDescricao ? `Item ${cob.itemPpu} - ${cob.itemPpuDescricao}` : `Item ${cob.itemPpu}`}
                  >
                    {cob.itemPpu}
                  </td>

                  {/* 4. Titular ausente (nome; matrícula em tooltip) */}
                  <td
                    className="py-1.5 px-3 text-slate-800 truncate"
                    title={cob.titularMatricula && cob.titularMatricula !== "—" ? `Matrícula: ${cob.titularMatricula}` : "Sem matrícula registrada"}
                  >
                    {cob.titularNome}
                  </td>

                  {/* 5. Cobertura (nome do substituto/ferista; chapa em tooltip) */}
                  <td
                    className="py-1.5 px-3 text-slate-800 truncate"
                    title={cob.substitutoMatricula && cob.substitutoMatricula !== "—" ? `Chapa / Matrícula: ${cob.substitutoMatricula}` : "Sem chapa registrada"}
                  >
                    {cob.substitutoNome}
                  </td>

                  {/* 6. Período (formato dd/mm – dd/mm) */}
                  <td
                    className="py-1.5 px-2.5 text-slate-700 whitespace-nowrap"
                    title={`Vigência: ${cob.dataInicio} até ${cob.dataFim}`}
                  >
                    {cob.periodoFormatado}
                  </td>

                  {/* 7. Diárias */}
                  <td className="py-1.5 px-2 text-center whitespace-nowrap text-slate-700">
                    {cob.diarias}
                  </td>

                  {/* 8. Motivo (texto simples, sem caixa) */}
                  <td
                    className="py-1.5 px-2.5 text-slate-700 whitespace-nowrap"
                    title={`Categoria Oficial: ${cob.motivoCategoria} (Conforme LGPD Contratual)`}
                  >
                    {cob.motivoCategoria}
                  </td>

                  {/* 8.1 Conferência Petrobras (Prévias 1, 2 ou 3) */}
                  <td className="py-1.5 px-2.5 whitespace-nowrap text-xs">
                    {cob.previaConferencia ? (
                      <div className="flex flex-col gap-0.5 items-start">
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            {cob.previaConferencia === "PREVIA_1" ? "Prévia 1" : cob.previaConferencia === "PREVIA_2" ? "Prévia 2" : "Prévia 3"}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            cob.statusConferenciaPosto === "DESCOBERTO" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {cob.statusConferenciaPosto === "DESCOBERTO" ? "Descoberto" : "Coberto"}
                          </span>
                        </div>
                        {cob.comentarioConferencia ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setComentarioModal({
                                posto: cob.postoCodigo,
                                substituto: cob.substitutoNome,
                                previa: cob.previaConferencia === "PREVIA_1" ? "Prévia 1" : cob.previaConferencia === "PREVIA_2" ? "Prévia 2" : "Prévia 3",
                                statusPosto: cob.statusConferenciaPosto === "DESCOBERTO" ? "Posto Descoberto" : "Posto Coberto",
                                comentario: cob.comentarioConferencia || "",
                              });
                            }}
                            className="text-[10px] text-blue-700 hover:text-blue-900 underline font-semibold flex items-center gap-0.5 cursor-pointer mt-0.5"
                          >
                            <MessageSquare className="w-2.5 h-2.5" />
                            <span>Ver parecer</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sem comentário</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
                  </td>

                  {/* 9. Status (apenas um ponto pequeno colorido ● antes do texto) */}
                  <td className="py-1.5 px-2.5 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-slate-700"
                        title={`Status: ${cob.status}${cob.alertaInterjornada ? " • Alerta CLT Art. 66 registrado" : ""}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${obterCorPontoStatus(cob.status)}`} />
                        <span>{cob.status === "CONFIRMADA" ? "Confirmada" : cob.status === "PLANEJADA" ? "Planejada" : "Cancelada"}</span>
                      </span>
                      {podeCriar && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirModalEditar(cob);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          title="Editar cobertura"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 4. PAGINAÇÃO NO SERVIDOR (25 REGISTROS POR PÁGINA) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
          <div className="font-medium text-slate-500">
            {totalRegistros > 0 ? (
              <>
                Exibindo <strong>{(paginaAtual - 1) * 25 + 1}</strong> a{" "}
                <strong>{Math.min(paginaAtual * 25, totalRegistros)}</strong> de{" "}
                <strong>{totalRegistros}</strong> coberturas (25 por página)
              </>
            ) : (
              "Nenhum registro"
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              disabled={paginaAtual <= 1 || carregando}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs font-semibold text-slate-700 inline-flex items-center gap-1 transition-all"
              title="Página anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>

            <span className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-300 rounded-lg shadow-2xs font-mono">
              {paginaAtual} / {totalPaginas}
            </span>

            <button
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual >= totalPaginas || carregando}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs font-semibold text-slate-700 inline-flex items-center gap-1 transition-all"
              title="Próxima página"
            >
              <span>Próxima</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE INCLUSÃO / EDIÇÃO DE COBERTURA */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs" onClick={() => setModalAberto(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck2 className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm">
                  {coberturaEmEdicao ? "Editar Cobertura de Posto" : "Incluir Nova Cobertura"}
                </h3>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="w-6 h-6 rounded text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCobertura} className="p-4 space-y-3.5 text-xs">
              {/* Posto */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Posto Contratual *</label>
                <select
                  value={formPostoCodigo}
                  onChange={(e) => {
                    const cod = e.target.value;
                    setFormPostoCodigo(cod);
                    const ppu = obterItemPpuDoPosto(cod);
                    if (ppu) setFormItemPpu(ppu);
                  }}
                  required
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono bg-white text-slate-800 outline-none focus:border-blue-600"
                >
                  <option value="">Selecione o posto...</option>
                  {postos.map((p) => (
                    <option key={p.codigoPosto || p.idPosto} value={p.codigoPosto || p.idPosto}>
                      {p.codigoPosto || p.idPosto} – {p.funcao} ({p.localAtuacao || p.baseOperacional || "Base"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Item da PPU */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Item da PPU (Base de Medição) *</label>
                <CampoItemPpu
                  valor={formItemPpu}
                  onChange={(v) => setFormItemPpu(v)}
                />
              </div>

              {/* Substituto / Ferista */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Substituto / Ferista Designado *</label>
                <select
                  value={formSubstitutoMatricula}
                  onChange={(e) => setFormSubstitutoMatricula(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 outline-none focus:border-blue-600"
                >
                  <option value="">Selecione o profissional substituto...</option>
                  {profissionais.map((pr) => (
                    <option key={pr.matricula} value={pr.matricula}>
                      {pr.nome} (Matrícula: {pr.matricula}) – {pr.funcao || "Operacional"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Datas Início e Fim */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data Início *</label>
                  <input
                    type="date"
                    value={formDataInicio}
                    onChange={(e) => setFormDataInicio(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 outline-none focus:border-blue-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data Fim *</label>
                  <input
                    type="date"
                    value={formDataFim}
                    onChange={(e) => setFormDataFim(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              {/* Motivo da Ausência */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo da Substituição *</label>
                <div className="flex gap-1.5 mb-1.5 flex-wrap">
                  {["Férias", "Licença", "Afastamento", "Falta", "Outros"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormJustificativa(cat)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                        formJustificativa.toLowerCase().includes(cat.toLowerCase())
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formJustificativa}
                  onChange={(e) => setFormJustificativa(e.target.value)}
                  placeholder="Ex.: Férias regulamentares do titular"
                  required
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 outline-none focus:border-blue-600"
                />
              </div>

              {/* SEÇÃO: CONFERÊNCIA PETROBRAS - PRÉVIAS 1, 2 E 3 */}
              <div className="bg-amber-50/80 border border-amber-300/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                      Conferência Petrobras (Prévias de Medição)
                    </span>
                  </div>
                  <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded font-bold">
                    Item 11.3 Petrobras
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Rodada de Conferência (Prévia)
                    </label>
                    <select
                      value={formPrevia}
                      onChange={(e) => setFormPrevia(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="">Sem Prévia Vinculada</option>
                      <option value="PREVIA_1">Prévia 1 (1ª Conferência)</option>
                      <option value="PREVIA_2">Prévia 2 (2ª Conferência / Ajustes)</option>
                      <option value="PREVIA_3">Prévia 3 (Fechamento Definitivo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Situação do Posto na Prévia
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormStatusPostoPrevia("COBERTO")}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          formStatusPostoPrevia === "COBERTO"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        ✓ Posto Coberto
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormStatusPostoPrevia("DESCOBERTO")}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          formStatusPostoPrevia === "DESCOBERTO"
                            ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        ✕ Posto Descoberto
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-xs">
                    Comentário / Parecer de Conferência Petrobras
                  </label>
                  <textarea
                    rows={2}
                    value={formComentarioConferencia}
                    onChange={(e) => setFormComentarioConferencia(e.target.value)}
                    placeholder="Descreva a conferência da Petrobras/fiscalização sobre o posto coberto ou descoberto..."
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between -mx-4 -mb-4 mt-4">
                {coberturaEmEdicao && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Remover esta cobertura?")) {
                        excluirCobertura(coberturaEmEdicao.id);
                        setModalAberto(false);
                        carregarCoberturasServidor();
                      }
                    }}
                    className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-900 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setModalAberto(false)}
                    className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL DE VISUALIZAÇÃO DO COMENTÁRIO DE PRÉVIA */}
      {comentarioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-3 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded">
                  {comentarioModal.previa}
                </span>
                <span className="text-sm font-bold text-slate-900">
                  Parecer de Conferência
                </span>
              </div>
              <button
                onClick={() => setComentarioModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1.5 text-slate-600">
              <div><strong>Posto:</strong> <span className="font-mono text-slate-800">{comentarioModal.posto}</span></div>
              <div><strong>Substituto:</strong> <span className="text-slate-800 font-medium">{comentarioModal.substituto}</span></div>
              <div><strong>Situação Apurada:</strong> <span className="font-bold text-slate-800">{comentarioModal.statusPosto}</span></div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {comentarioModal.comentario || "Nenhum comentário registrado."}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setComentarioModal(null)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
