"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  ArrowRight,
  ShieldCheck,
  History,
  Clock,
  Filter,
  Eye,
  Users,
  RefreshCw,
  FileText,
  Check,
  ChevronRight,
  Search,
  Download,
  Trash2,
  Lock,
  ArrowUpRight,
  Building2,
  Calendar,
  Layers,
} from "lucide-react";
import { UsuarioSessao } from "@/lib/auth/tipos";
import {
  ResumoPreviaRm,
  processarEPreVisualizarArquivoRm,
  confirmarImportacaoRmAtomica,
  obterHistoricoLotesRm,
  obterTodosFuncionariosRm,
} from "@/lib/importadores/processador-rm-totvs";
import { LoteCargaRm } from "@/lib/dados/rm-tipos";

export default function ImportarFuncionariosRmPage() {
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Aba ativa: 'importar' ou 'historico'
  const [abaAtiva, setAbaAtiva] = useState<"importar" | "historico">("importar");

  // Estado do Arquivo e Upload
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [dataReferencia, setDataReferencia] = useState("2026-09-17");
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroFatal, setErroFatal] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Resultado da Pré-visualização
  const [previa, setPrevia] = useState<ResumoPreviaRm | null>(null);
  const [loteSalvoId, setLoteSalvoId] = useState<string | null>(null);

  // Sub-aba de detalhamento da prévia
  const [subAbaPrevia, setSubAbaPrevia] = useState<
    "todos" | "novos" | "alterados" | "naoConstam" | "horariosSecoes" | "errosAlertas"
  >("todos");

  // Filtros de busca na tabela de pré-visualização
  const [buscaTabela, setBuscaTabela] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("TODAS");

  // Histórico de Lotes
  const [historicoLotes, setHistoricoLotes] = useState<LoteCargaRm[]>([]);
  const [loteInspecionado, setLoteInspecionado] = useState<LoteCargaRm | null>(null);

  // Verifica sessão e permissão (Somente PREMIER_ADMIN)
  useEffect(() => {
    async function carregarSessao() {
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.autenticado && data.usuario) {
            setSessao(data.usuario);
          }
        }
      } catch (e) {
        console.error("Erro ao verificar sessão:", e);
      } finally {
        setCarregandoSessao(false);
      }
    }
    carregarSessao();
    carregarLotes();
  }, []);

  const carregarLotes = () => {
    const lotes = obterHistoricoLotesRm();
    setHistoricoLotes(lotes);
  };

  const ehAdminPremier = sessao?.perfil === "PREMIER_ADMIN";

  // Handler de seleção de arquivo
  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivoSelecionado(file);
      setPrevia(null);
      setErroFatal(null);
      setMensagemSucesso(null);
    }
  };

  // Executa simulação / pré-visualização do arquivo selecionado
  const handleSimularArquivo = async (fileParaProcessar?: File) => {
    const file = fileParaProcessar || arquivoSelecionado;
    if (!file) return;

    setProcessando(true);
    setErroFatal(null);
    setMensagemSucesso(null);

    try {
      const buffer = await file.arrayBuffer();
      const resultado = await processarEPreVisualizarArquivoRm(buffer, file.name, dataReferencia);
      setPrevia(resultado);
      setSubAbaPrevia(resultado.bloqueadosErros > 0 ? "errosAlertas" : "todos");
    } catch (err: any) {
      setErroFatal(err.message || "Erro ao processar arquivo RM.");
      setPrevia(null);
    } finally {
      setProcessando(false);
    }
  };

  // Atalho para carregar e testar diretamente a planilha oficial do servidor
  const handleCarregarPlanilhaOficialServidor = async () => {
    setProcessando(true);
    setErroFatal(null);
    setMensagemSucesso(null);

    try {
      const formData = new FormData();
      formData.append("usarArquivoServidor", "true");
      formData.append("dataReferencia", dataReferencia);

      const res = await fetch("/api/admin/importar-rm", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.erro || "Falha ao ler arquivo do servidor.");
      }

      const previaServidor: ResumoPreviaRm = await res.json();
      setPrevia(previaServidor);
      setArquivoSelecionado(new File([], previaServidor.nomeArquivo));
      setSubAbaPrevia(previaServidor.bloqueadosErros > 0 ? "errosAlertas" : "todos");
    } catch (err: any) {
      setErroFatal(err.message || "Erro ao processar planilha oficial do servidor.");
    } finally {
      setProcessando(false);
    }
  };

  // Confirmação atômica da importação
  const handleConfirmarImportacao = async () => {
    if (!previa) return;

    if (previa.arquivoJaImportado) {
      const confirma = confirm(
        `AVISO DE ARQUIVO JÁ IMPORTADO:\n\nEste arquivo (mesmo conteúdo SHA-256) já foi importado anteriormente em ${previa.loteAnteriorData}.\n\nDeseja realmente reprocessar e atualizar os registros?`
      );
      if (!confirma) return;
    }

    setSalvando(true);
    setErroFatal(null);

    try {
      const res = confirmarImportacaoRmAtomica(
        previa,
        sessao?.nome || "Administrador Premier"
      );
      setMensagemSucesso(res.mensagem);
      setLoteSalvoId(res.loteId);
      carregarLotes();
    } catch (err: any) {
      setErroFatal(err.message || "Erro fatal ao confirmar importação no banco de dados.");
    } finally {
      setSalvando(false);
    }
  };

  // Filtragem na tabela de pré-visualização
  const linhasFiltradas = useMemo(() => {
    if (!previa) return [];
    return previa.linhas.filter((l) => {
      // Filtro de sub-aba
      if (subAbaPrevia === "novos" && l.statusLinha !== "NOVO") return false;
      if (subAbaPrevia === "alterados" && l.statusLinha !== "ALTERADO") return false;
      if (subAbaPrevia === "errosAlertas" && l.inconsistencias.length === 0) return false;

      // Filtro de situação
      if (filtroSituacao !== "TODAS" && l.situacaoCodigo !== filtroSituacao) return false;

      // Busca por termo
      if (buscaTabela) {
        const termo = buscaTabela.toLowerCase();
        const match =
          l.chapa.toLowerCase().includes(termo) ||
          l.nome.toLowerCase().includes(termo) ||
          l.cpf.includes(termo) ||
          l.funcao.toLowerCase().includes(termo) ||
          l.secaoDescricao.toLowerCase().includes(termo) ||
          l.horarioDescricao.toLowerCase().includes(termo);
        if (!match) return false;
      }
      return true;
    });
  }, [previa, subAbaPrevia, filtroSituacao, buscaTabela]);

  // Se não estiver autorizado
  if (!carregandoSessao && !ehAdminPremier) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-rose-950">Acesso Restrito: Administração Premier</h2>
          <p className="text-sm text-rose-800 max-w-md mx-auto">
            A importação de funcionários do RM/TOTVS e gestão da folha de pagamento é exclusiva do perfil
            <strong> Administração Premier</strong>.
          </p>
          <div className="pt-2">
            <Link
              href="/painel"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Voltar ao Painel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Link href="/admin" className="hover:text-blue-600 transition-colors">
              Administração
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Importação RM / TOTVS</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Importar Funcionários (RM)
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Administração Premier
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Módulo oficial para upload periódico da planilha exportada do RM/TOTVS (Folha de Pagamento).
          </p>
        </div>

        {/* Abas Principais */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setAbaAtiva("importar")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              abaAtiva === "importar"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UploadCloud className="w-4 h-4 text-blue-600" />
            <span>Nova Importação</span>
          </button>
          <button
            onClick={() => setAbaAtiva("historico")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              abaAtiva === "historico"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-4 h-4 text-slate-600" />
            <span>Histórico de Cargas</span>
            {historicoLotes.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px]">
                {historicoLotes.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mensagens de Sucesso e Erros Fatais */}
      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start justify-between gap-3 text-emerald-950 animate-fadeIn">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block font-bold text-sm text-emerald-900">Importação Realizada com Sucesso!</strong>
              <p className="mt-0.5 leading-relaxed">{mensagemSucesso}</p>
              {loteSalvoId && (
                <span className="font-mono text-[10px] text-emerald-700 block mt-1">
                  ID do Lote: {loteSalvoId}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setMensagemSucesso(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {erroFatal && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-start justify-between gap-3 text-rose-950 animate-fadeIn">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block font-bold text-sm text-rose-900">Erro na Validação do Arquivo</strong>
              <pre className="mt-1 font-sans whitespace-pre-wrap leading-relaxed">{erroFatal}</pre>
            </div>
          </div>
          <button
            onClick={() => setErroFatal(null)}
            className="text-rose-700 hover:text-rose-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ABA 1: NOVA IMPORTAÇÃO */}
      {abaAtiva === "importar" && (
        <div className="space-y-6">
          {/* Card de Upload e Instruções */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  1. Seleção do Arquivo RM / TOTVS
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Formatos aceitos: <strong>.XLS antigo</strong> (Excel 97-2003, code page 1252), <strong>.xlsx</strong> e <strong>.csv</strong>. Mapeamento estrito por cabeçalho.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCarregarPlanilhaOficialServidor}
                  disabled={processando || salvando}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  title="Carregar diretamente o arquivo oficial FUNCIONÁRIOS PETROBRAS.XLS do servidor"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Usar Planilha Oficial (388 Linhas)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div className="md:col-span-3">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-xl p-6 transition-all cursor-pointer">
                  <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-xs font-semibold text-slate-700">
                    {arquivoSelecionado ? arquivoSelecionado.name : "Clique para selecionar ou arraste o arquivo do RM"}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    {arquivoSelecionado
                      ? `${(arquivoSelecionado.size / 1024).toFixed(1)} KB`
                      : ".XLS (Excel 97-2003), .XLSX ou .CSV com cabeçalho oficial"}
                  </span>
                  <input
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    onChange={handleSelecionarArquivo}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Referência
                  </label>
                  <input
                    type="date"
                    value={dataReferencia}
                    onChange={(e) => setDataReferencia(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Competência / data de corte da carga
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSimularArquivo()}
                  disabled={!arquivoSelecionado || processando || salvando}
                  className="w-full py-2 bg-premier-900 hover:bg-premier-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {processando ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Analisar e Pré-visualizar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* PRÉ-VISUALIZAÇÃO COMPLETA */}
          {previa && (
            <div className="space-y-5 animate-fadeIn">
              {/* Alerta de Arquivo Já Importado */}
              {previa.arquivoJaImportado && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-amber-950 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Aviso de Arquivo Duplicado:</strong> Este mesmo arquivo (Hash SHA-256 idêntico) já foi importado no lote{" "}
                      <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">{previa.loteAnteriorId}</code> em{" "}
                      <strong>{previa.loteAnteriorData}</strong>.
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                    Idempotente
                  </span>
                </div>
              )}

              {/* Banner de Divergência na 2ª Coluna Descrição Seção */}
              {previa.divergenciaSecaoDetectada && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Alerta de Seção:</strong> Foram detectadas linhas onde a 2ª ocorrência de "Descrição Seção" diverge da 1ª. A 1ª foi adotada como oficial.
                  </span>
                </div>
              )}

              {/* Grade de Resumo e Métricas (Bate exatamente com as expectativas do teste) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Linhas Lidas
                  </span>
                  <span className="text-2xl font-extrabold text-slate-900">{previa.totalLinhasLidas}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">100% da planilha</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                    Novos Funcionários
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-700">{previa.novos}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Cadastros inéditos</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                    Com Alteração
                  </span>
                  <span className="text-2xl font-extrabold text-blue-700">{previa.alterados}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Histórico com vigência</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Sem Alteração
                  </span>
                  <span className="text-2xl font-extrabold text-slate-700">{previa.semAlteracao}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">Dados mantidos</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                    Horários / Seções
                  </span>
                  <span className="text-2xl font-extrabold text-purple-700">
                    {previa.totalHorarios} / {previa.totalSecoes}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {previa.horariosNovos.length} novos horários
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                    Erros / Alertas
                  </span>
                  <span className="text-2xl font-extrabold text-slate-900">
                    <span className={previa.bloqueadosErros > 0 ? "text-rose-600" : "text-slate-800"}>
                      {previa.bloqueadosErros}
                    </span>
                    <span className="text-sm font-normal text-slate-400"> / {previa.comAlertas}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {previa.bloqueadosErros > 0 ? "Bloqueante" : "Aprovado para carga"}
                  </span>
                </div>
              </div>

              {/* Breakdown de Situações (Conforme teste do usuário: 307 ativos, 65 demitidos, 7 férias, 3 previdência, 2 licença-maternidade, 1 aviso prévio, 3 adm próx mês) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-bold text-slate-700">Distribuição por Situação:</span>
                {Object.entries(previa.contagemSituacoes).map(([sit, qtd]) => (
                  <span
                    key={sit}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 shadow-2xs font-medium"
                  >
                    <span>{sit}:</span>
                    <strong className="text-blue-700 font-bold">{qtd}</strong>
                  </span>
                ))}
              </div>

              {/* Abas e Filtros de Detalhamento da Prévia */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
                  {/* Navegação entre Sub-abas */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto">
                    <button
                      onClick={() => setSubAbaPrevia("todos")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        subAbaPrevia === "todos"
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Todos ({previa.totalLinhasLidas})
                    </button>
                    <button
                      onClick={() => setSubAbaPrevia("novos")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        subAbaPrevia === "novos"
                          ? "bg-emerald-700 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Novos ({previa.novos})
                    </button>
                    <button
                      onClick={() => setSubAbaPrevia("alterados")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        subAbaPrevia === "alterados"
                          ? "bg-blue-700 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Alterados ({previa.alterados})
                    </button>
                    <button
                      onClick={() => setSubAbaPrevia("naoConstam")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        subAbaPrevia === "naoConstam"
                          ? "bg-amber-700 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Não Constam ({previa.naoConstam.length})
                    </button>
                    <button
                      onClick={() => setSubAbaPrevia("horariosSecoes")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        subAbaPrevia === "horariosSecoes"
                          ? "bg-purple-700 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Horários & Seções ({previa.totalHorarios}/{previa.totalSecoes})
                    </button>
                    <button
                      onClick={() => setSubAbaPrevia("errosAlertas")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        subAbaPrevia === "errosAlertas"
                          ? "bg-rose-700 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Erros / Alertas ({previa.inconsistencias.length})
                    </button>
                  </div>

                  {/* Filtro de Busca */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Buscar chapa, nome, função..."
                        value={buscaTabela}
                        onChange={(e) => setBuscaTabela(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 w-56 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Conteúdo das Sub-abas */}
                {subAbaPrevia === "alterados" ? (
                  /* Tabela De/Para de Alterações */
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-3">Chapa</th>
                          <th className="p-3">Nome</th>
                          <th className="p-3">Campo Modificado</th>
                          <th className="p-3">Valor Anterior</th>
                          <th className="p-3">Valor Novo no RM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previa.linhas
                          .filter((l) => l.statusLinha === "ALTERADO")
                          .flatMap((l) =>
                            l.alteracoes.map((alt, idx) => (
                              <tr key={`${l.chapa}_${alt.campo}_${idx}`} className="hover:bg-slate-50">
                                <td className="p-3 font-mono font-bold text-blue-700">{l.chapa}</td>
                                <td className="p-3 font-semibold text-slate-800">{l.nome}</td>
                                <td className="p-3 font-medium text-slate-700">{alt.rotuloCampo}</td>
                                <td className="p-3 text-slate-500 line-through">
                                  {alt.descricaoAnterior || String(alt.valorAnterior)}
                                </td>
                                <td className="p-3 text-emerald-700 font-semibold">
                                  {alt.descricaoNova || String(alt.valorNovo)}
                                </td>
                              </tr>
                            ))
                          )}
                        {previa.alterados === 0 && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400">
                              Nenhuma alteração detectada em relação à base existente (carga inicial ou idêntica).
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : subAbaPrevia === "naoConstam" ? (
                  /* Tabela de Colaboradores Ausentes */
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-600">
                      Os colaboradores abaixo constavam no SGP mas <strong>não foram encontrados neste arquivo</strong>. Conforme a regra de negócio, eles <strong>NÃO serão apagados</strong>, permanecendo marcados como <em>"Não consta na última carga"</em> para fins de histórico e auditoria.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previa.naoConstam.map((chapa) => (
                        <span
                          key={chapa}
                          className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-mono font-bold"
                        >
                          Chapa {chapa}
                        </span>
                      ))}
                      {previa.naoConstam.length === 0 && (
                        <p className="text-xs text-slate-400 italic">
                          Nenhum colaborador anterior ausente. Todos os colaboradores estão presentes ou esta é a primeira carga.
                        </p>
                      )}
                    </div>
                  </div>
                ) : subAbaPrevia === "horariosSecoes" ? (
                  /* Listagem de Horários e Seções */
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        Horários Catalogados ({previa.totalHorarios})
                      </h3>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white text-xs">
                        {previa.horariosNovos.map((h) => (
                          <div key={h.codigo} className="p-2.5 flex items-start gap-2 hover:bg-slate-50">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                              {h.codigo}
                            </span>
                            <span className="text-slate-700 font-mono text-[11px] leading-tight">
                              {h.descricao}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-purple-600" />
                        Seções Catalogadas ({previa.totalSecoes})
                      </h3>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white text-xs">
                        {previa.secoesNovas.map((s) => (
                          <div key={s.codigo} className="p-2.5 flex items-start gap-2 hover:bg-slate-50">
                            <span className="font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 shrink-0">
                              {s.codigo}
                            </span>
                            <span className="text-slate-700 font-semibold">{s.descricao}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : subAbaPrevia === "errosAlertas" ? (
                  /* Tabela de Inconsistências */
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Linha</th>
                          <th className="p-3">Chapa</th>
                          <th className="p-3">Nome</th>
                          <th className="p-3">Coluna</th>
                          <th className="p-3">Mensagem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previa.inconsistencias.map((inc, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  inc.tipo === "ERRO"
                                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                                    : "bg-amber-100 text-amber-800 border border-amber-300"
                                }`}
                              >
                                {inc.tipo}
                              </span>
                            </td>
                            <td className="p-3 font-mono">{inc.linha}</td>
                            <td className="p-3 font-mono font-bold">{inc.chapa || "-"}</td>
                            <td className="p-3">{inc.nome || "-"}</td>
                            <td className="p-3 font-semibold text-slate-700">{inc.coluna || "-"}</td>
                            <td className="p-3 text-slate-800">{inc.mensagem}</td>
                          </tr>
                        ))}
                        {previa.inconsistencias.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400">
                              Nenhum erro ou alerta detectado. Arquivo 100% íntegro.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Tabela Geral de Colaboradores */
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-3">Chapa</th>
                          <th className="p-3">Nome</th>
                          <th className="p-3">CPF</th>
                          <th className="p-3">Função</th>
                          <th className="p-3">Seção</th>
                          <th className="p-3">Horário</th>
                          <th className="p-3">Situação</th>
                          <th className="p-3">Admissão</th>
                          <th className="p-3">Idade (Calc.)</th>
                          <th className="p-3">Salário</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {linhasFiltradas.slice(0, 100).map((l) => (
                          <tr key={l.chapa} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-blue-700">{l.chapa}</td>
                            <td className="p-3 font-semibold text-slate-800 max-w-xs truncate" title={l.nome}>
                              {l.nome}
                            </td>
                            <td className="p-3 font-mono text-slate-500">
                              {l.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4")}
                            </td>
                            <td className="p-3 text-slate-700 max-w-xs truncate" title={l.funcao}>
                              {l.funcao}
                            </td>
                            <td className="p-3 text-slate-600 max-w-xs truncate" title={l.secaoDescricao}>
                              <span className="font-mono text-[10px] text-slate-400 block">{l.secaoCodigo}</span>
                              {l.secaoDescricao}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-700" title={l.horarioDescricao}>
                              <span className="bg-slate-100 px-1 py-0.5 rounded font-bold mr-1">{l.horarioCodigo}</span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  l.situacaoCodigo === "A"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : l.situacaoCodigo === "D"
                                    ? "bg-slate-200 text-slate-700"
                                    : l.situacaoCodigo === "F"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {l.situacaoDescricao || l.situacaoCodigo}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 font-mono">{l.dataAdmissao}</td>
                            <td className="p-3 text-slate-700 font-semibold">{l.idadeCalculada} anos</td>
                            <td className="p-3 font-mono text-slate-700">
                              R$ {l.salarioMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  l.statusLinha === "NOVO"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : l.statusLinha === "ALTERADO"
                                    ? "bg-blue-100 text-blue-800"
                                    : l.statusLinha === "ERRO"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {l.statusLinha}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {linhasFiltradas.length > 100 && (
                      <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                        Exibindo os primeiros 100 colaboradores de um total de {linhasFiltradas.length}.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Ações de Confirmação da Carga */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Pronto para confirmar a carga?</h4>
                  <p className="text-[11px] text-slate-500">
                    A gravação é atômica (transação única). Se houver qualquer erro impeditivo, nada é gravado.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPrevia(null)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Descartar Análise
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarImportacao}
                    disabled={salvando || previa.bloqueadosErros > 0}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-premier-900 hover:bg-premier-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow transition-all cursor-pointer"
                  >
                    {salvando ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Gravando Transação...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Confirmar Importação de {previa.totalLinhasLidas} Registros</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: HISTÓRICO DE CARGAS (LOG AUDITÁVEL) */}
      {abaAtiva === "historico" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  Registro de Cargas de Funcionários (RM)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Log imutável de todas as cargas periódicas processadas com seus respectivos hashes SHA-256 e métricas.
                </p>
              </div>
              <button
                onClick={carregarLotes}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Arquivo</th>
                    <th className="p-3">Competência</th>
                    <th className="p-3">Total Lidos</th>
                    <th className="p-3">Novos</th>
                    <th className="p-3">Alterados</th>
                    <th className="p-3">Não Constam</th>
                    <th className="p-3">Responsável</th>
                    <th className="p-3">Hash SHA-256</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historicoLotes.map((lote) => (
                    <tr key={lote.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                        {new Date(lote.dataCarga).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 font-semibold text-slate-800 max-w-xs truncate" title={lote.nomeArquivo}>
                        {lote.nomeArquivo}
                      </td>
                      <td className="p-3 font-mono">{lote.dataReferencia}</td>
                      <td className="p-3 font-bold text-slate-900">{lote.totalLinhasLidas}</td>
                      <td className="p-3 text-emerald-700 font-bold">+{lote.novos}</td>
                      <td className="p-3 text-blue-700 font-bold">{lote.atualizados}</td>
                      <td className="p-3 text-amber-700 font-bold">{lote.totalNaoConstam}</td>
                      <td className="p-3 text-slate-600">{lote.usuarioProcesso || "Administrador Premier"}</td>
                      <td className="p-3 font-mono text-[10px] text-slate-400 max-w-[120px] truncate" title={lote.hashSha256}>
                        {lote.hashSha256.substring(0, 16)}...
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setLoteInspecionado(lote)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                  {historicoLotes.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        Nenhuma carga de funcionários registrada até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal de Detalhes do Lote */}
          {loteInspecionado && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-scaleIn">
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm">Detalhes do Lote: {loteInspecionado.id}</h3>
                    <span className="text-[11px] text-slate-300 font-mono block">
                      Arquivo: {loteInspecionado.nomeArquivo} ({loteInspecionado.formatoArquivo})
                    </span>
                  </div>
                  <button
                    onClick={() => setLoteInspecionado(null)}
                    className="text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block text-[10px]">Data da Carga</span>
                      <strong className="text-slate-800">
                        {new Date(loteInspecionado.dataCarga).toLocaleString("pt-BR")}
                      </strong>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block text-[10px]">Competência</span>
                      <strong className="text-slate-800">{loteInspecionado.dataReferencia}</strong>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block text-[10px]">Total Registros</span>
                      <strong className="text-slate-900">{loteInspecionado.totalLinhasLidas}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-700 block mb-1">Hash SHA-256</span>
                    <code className="p-2 bg-slate-100 rounded block font-mono text-[11px] text-slate-800 break-all select-all">
                      {loteInspecionado.hashSha256}
                    </code>
                  </div>

                  {loteInspecionado.chapasNaoConstantes.length > 0 && (
                    <div>
                      <span className="font-semibold text-slate-700 block mb-1">
                        Chapas Ausentes nesta Carga ({loteInspecionado.chapasNaoConstantes.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 max-h-32 overflow-y-auto">
                        {loteInspecionado.chapasNaoConstantes.map((chapa) => (
                          <span
                            key={chapa}
                            className="px-2 py-0.5 bg-amber-100 text-amber-900 font-mono text-[11px] rounded"
                          >
                            {chapa}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => setLoteInspecionado(null)}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
