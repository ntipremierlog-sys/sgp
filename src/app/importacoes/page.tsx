"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Calendar as CalendarIcon,
  Layers,
  FileText,
  Clock,
  Filter,
  Eye,
  Info,
  ChevronRight,
  Search,
  Lock,
  Unlock,
  AlertCircle,
  Sparkles,
  Building2,
  UserX,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  identificarTipoArquivo,
  conferirCabecalhosComTipo,
  simularImportacaoFuncionariosRm,
  confirmarImportacaoFuncionariosRm,
  gerarRelatorioValidacaoXlsx,
  gerarPlanilhaLinhasRejeitadasXlsx,
  gerarModeloFuncionariosXlsx,
  ResultadoIdentificacaoRm,
  ResultadoSimulacaoRm,
  ItemInconsistencia,
  ItemLinhaRejeitada,
  TipoArquivoRm,
} from "@/lib/importadores/rm-funcionarios";
import {
  simularImportacaoSifac,
  confirmarImportacaoSifac,
  ResultadoSimulacaoSifac,
} from "@/lib/importadores/sifac-alocados";
import {
  simularImportacaoAbono,
  confirmarImportacaoAbono,
  gerarRelatorioValidacaoAbonoXlsx,
  gerarModeloCuboAbonoXlsx,
  ResultadoSimulacaoAbono,
} from "@/lib/importadores/cubo-abono";
import {
  simularImportacaoPonto,
  confirmarImportacaoPonto,
  gerarRelatorioValidacaoPontoXlsx,
  gerarModeloPontoXlsx,
  ResultadoSimulacaoPonto,
} from "@/lib/importadores/planilha-ponto";
import {
  carregarEstado,
  salvarEstado,
  desfazerUltimoLote,
  desfazerLotePorId,
  LoteImportacaoOperacional,
} from "@/lib/dados/estado-operacional";
import {
  obterPeriodoCompetencia,
  gerarCalendarioCompetencia,
  obterCalendarioCompetencia,
  marcarCalendarioDesatualizado,
  ResultadoCalendarioCompetencia,
} from "@/lib/servicos/calendario-competencia";
import {
  processarMemoriaCalculo,
  confirmarImportacaoMC,
  ResultadoImportacaoMC,
  obterCicloEsperadoCompetencia,
} from "@/lib/importadores/memoria-calculo";
import {
  processarPlanilhaREV04,
  ResultadoImportacaoREV04,
} from "@/lib/importadores/base-estruturada-rev02";
import { UsuarioSessao } from "@/lib/auth/tipos";

type TipoCargaCompetencia =
  | "FUNCIONARIOS_RM"
  | "REGISTROS_PONTO_RM"
  | "ABONO_RM"
  | "ALOCADOS_SIFAC"
  | "MEMORIA_CALCULO"
  | "BASE_REV04";

type ResultadoSimulacaoQualquer = any;

export default function ImportacoesPage() {
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Competência selecionada (Ano-Mês de apuração)
  const [competencia, setCompetencia] = useState<string>("2026-09");
  const listaCompetencias = ["2026-10", "2026-09", "2026-08", "2026-07"];

  // Configuração do período de medição por competência (padrão dia 10 ao dia 09)
  const [diaInicioCiclo, setDiaInicioCiclo] = useState<number>(10);
  const [diaFimCiclo, setDiaFimCiclo] = useState<number>(9);

  // Tipo ativo para importação (selecionado via cartão ou padrão)
  const [tipoAlvo, setTipoAlvo] = useState<TipoCargaCompetencia>("FUNCIONARIOS_RM");

  // Etapa atual: 1 = Upload, 2 = Identificação, 3 = Pré-visualização, 4 = Concluído
  const [etapa, setEtapa] = useState<1 | 2 | 3 | 4>(1);

  // Formulário Etapa 1
  const [dataExtracao, setDataExtracao] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erroUpload, setErroUpload] = useState<string>("");

  // Resultados das etapas
  const [identificacao, setIdentificacao] = useState<{
    reconhecido: boolean;
    avisoOutroTipo?: string;
    colunasFaltantes: string[];
    colunasEncontradas: string[];
  } | null>(null);
  const [simulacao, setSimulacao] = useState<ResultadoSimulacaoQualquer | null>(null);
  const [loteConfirmadoId, setLoteConfirmadoId] = useState<string | null>(null);
  const [mensagemFeedback, setMensagemFeedback] = useState<{
    tipo: "sucesso" | "erro" | "alerta";
    texto: string;
  } | null>(null);

  // Aba selecionada na Pré-visualização (Etapa 3)
  const [abaPrevia, setAbaPrevia] = useState<"NORMALIZADOS" | "REJEITADAS" | "ALERTAS">("NORMALIZADOS");
  const [abaPreviaMC, setAbaPreviaMC] = useState<"INCONSISTENCIAS" | "A_ALOCAR" | "IGNORADOS" | "VINCULADOS">("INCONSISTENCIAS");
  const [abaPreviaREV04, setAbaPreviaREV04] = useState<"IMOVEIS" | "FERISTAS" | "POSICOES">("IMOVEIS");
  const [filtroTipoInconsistencia, setFiltroTipoInconsistencia] = useState<"TODAS" | "ERRO" | "ALERTA">("TODAS");
  const [buscaInconsistencia, setBuscaInconsistencia] = useState("");
  const [buscaMC, setBuscaMC] = useState("");
  const [buscaREV04, setBuscaREV04] = useState("");

  // Histórico de Lotes & Filtros
  const [lotes, setLotes] = useState<LoteImportacaoOperacional[]>([]);
  const [filtroTipoLote, setFiltroTipoLote] = useState<string>("TODOS");
  const [filtroCompetenciaLote, setFiltroCompetenciaLote] = useState<string>("TODAS");

  // Modais
  const [modalCascataAberto, setModalCascataAberto] = useState(false);
  const [loteParaDesfazerCascata, setLoteParaDesfazerCascata] = useState<LoteImportacaoOperacional | null>(null);
  const [modalCalendarioAberto, setModalCalendarioAberto] = useState(false);
  const [resultadoCalendarioModal, setResultadoCalendarioModal] = useState<ResultadoCalendarioCompetencia | null>(null);

  // Período da competência calculada
  const periodoCompetencia = useMemo(() => {
    return obterPeriodoCompetencia(competencia);
  }, [competencia]);

  const carregarDados = () => {
    const estado = carregarEstado();
    setLotes(estado.lotesImportacao || []);
  };

  useEffect(() => {
    const carregarSessao = async () => {
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.autenticado && data.usuario) {
            setSessao(data.usuario);
          }
        }
      } catch {
        // fallback
      } finally {
        setCarregandoSessao(false);
      }
    };

    carregarSessao();
    carregarDados();

    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  const ehAdmin = sessao ? sessao.perfil === "PREMIER_ADMIN" : true;

  // Lotes específicos da competência selecionada
  const loteFuncionariosCompetencia = useMemo(() => {
    return lotes.find(
      (l) => l.tipo === "FUNCIONARIOS_RM" && l.competencia === competencia && l.status === "CONCLUIDO"
    );
  }, [lotes, competencia]);

  const lotePontoCompetencia = useMemo(() => {
    return lotes.find(
      (l) =>
        (l.tipo === "REGISTROS_PONTO_RM" || l.tipo === "AFD_PONTO") &&
        l.competencia === competencia &&
        l.status === "CONCLUIDO"
    );
  }, [lotes, competencia]);

  const loteAbonoCompetencia = useMemo(() => {
    return lotes.find(
      (l) => l.tipo === "ABONO_RM" && l.competencia === competencia && l.status === "CONCLUIDO"
    );
  }, [lotes, competencia]);

  const loteExistenteMesmoTipoECompetencia = useMemo(() => {
    if (!competencia || !tipoAlvo) return null;
    return lotes.find((l) => l.tipo === tipoAlvo && l.competencia === competencia && l.status === "CONCLUIDO");
  }, [lotes, competencia, tipoAlvo]);

  // Regra de ordem: Ponto e Abonos ficam bloqueados até haver lote de Funcionários concluído
  const temFuncionariosConcluido = !!loteFuncionariosCompetencia;
  const todosTresConcluidos = temFuncionariosConcluido && !!lotePontoCompetencia && !!loteAbonoCompetencia;

  // Informações do calendário da competência
  const statusCalendario = useMemo(() => {
    return obterCalendarioCompetencia(competencia);
  }, [competencia, lotes]);

  // Dispara a seleção de um tipo para iniciar a importação
  const handleSelecionarTipoParaImportar = (tipo: TipoCargaCompetencia) => {
    if (
      tipo !== "FUNCIONARIOS_RM" &&
      tipo !== "ALOCADOS_SIFAC" &&
      tipo !== "MEMORIA_CALCULO" &&
      tipo !== "BASE_REV04" &&
      !temFuncionariosConcluido
    ) {
      setMensagemFeedback({
        tipo: "alerta",
        texto: "Importe primeiro o arquivo de Funcionários desta competência para liberar Ponto e Abonos.",
      });
      return;
    }
    setTipoAlvo(tipo);
    setEtapa(1);
    setArquivoSelecionado(null);
    setIdentificacao(null);
    setSimulacao(null);
    setErroUpload("");
    setAbaPrevia("NORMALIZADOS");
    setAbaPreviaMC("INCONSISTENCIAS");
    setAbaPreviaREV04("IMOVEIS");

    // Rola suavemente até o stepper
    const elem = document.getElementById("secao-stepper-importacao");
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Processa o arquivo selecionado
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const nomeArquivo = (file.name || "").toLowerCase();
    if (!nomeArquivo.endsWith(".xlsx") && !nomeArquivo.endsWith(".xls")) {
      setErroUpload("Formato inválido. Selecione planilhas Excel (.xlsx ou .xls) de até 10 MB.");
      return;
    }

    // Permite re-selecionar o mesmo arquivo no file input se necessário
    e.target.value = "";

    if (file.size > 10 * 1024 * 1024) {
      setErroUpload("O arquivo excede o limite máximo permitido de 10 MB.");
      return;
    }

    setErroUpload("");
    setArquivoSelecionado(file);
    setProcessando(true);
    setEtapa(2);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      let cabecalhos: string[] = [];
      const primeiraAba = wb.SheetNames[0];
      const sheet = wb.Sheets[primeiraAba];

      // Ponto/Registros tem cabeçalho na linha 2 (ou linha 1 se normalizado)
      if (tipoAlvo === "REGISTROS_PONTO_RM") {
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        const row1 = (rows[0] || []).map((c) => String(c || "").trim());
        const row2 = (rows[1] || []).map((c) => String(c || "").trim());
        cabecalhos = row2.some((c) => c.toUpperCase().includes("DATA") || c.toUpperCase().includes("CHAPA"))
          ? row2
          : row1;
      } else {
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        cabecalhos = (rows[0] || []).map((c) => String(c || "").trim());
      }

      // Tratamento especial para Memória de Cálculo e Base REV04
      if (tipoAlvo === "MEMORIA_CALCULO") {
        const resMC = processarMemoriaCalculo(buffer, {
          competencia,
          diaInicioCiclo,
          diaFimCiclo,
        });
        setSimulacao({ ...(resMC as any), tipo: "MEMORIA_CALCULO" });
        setIdentificacao({
          reconhecido: true,
          colunasFaltantes: [],
          colunasEncontradas: cabecalhos,
        });
        setEtapa(3);
        setProcessando(false);
        return;
      }

      if (tipoAlvo === "BASE_REV04") {
        const resREV04 = processarPlanilhaREV04(Buffer.from(buffer), file.name);
        setSimulacao({ ...(resREV04 as any), tipo: "BASE_REV04" });
        setIdentificacao({
          reconhecido: true,
          colunasFaltantes: [],
          colunasEncontradas: cabecalhos,
        });
        setEtapa(3);
        setProcessando(false);
        return;
      }

      // ETAPA 2: Validação e conferência de cabeçalhos
      const conferido = conferirCabecalhosComTipo(tipoAlvo as any, cabecalhos);

      setIdentificacao({
        reconhecido: conferido.compativel,
        avisoOutroTipo: conferido.avisoDivergencia,
        colunasFaltantes: conferido.colunasFaltando,
        colunasEncontradas: cabecalhos,
      });

      if (!conferido.compativel && conferido.colunasFaltando.length > 0) {
        setProcessando(false);
        return;
      }

      // ETAPA 3: Simulação / Pré-visualização
      let resultadoSim: ResultadoSimulacaoQualquer;
      if (tipoAlvo === "ALOCADOS_SIFAC") {
        resultadoSim = await simularImportacaoSifac(buffer, file.name, dataExtracao);
      } else if (tipoAlvo === "ABONO_RM") {
        resultadoSim = await simularImportacaoAbono(buffer, file.name, dataExtracao, {
          competencia,
          dataExtracao,
        });
      } else if (tipoAlvo === "REGISTROS_PONTO_RM") {
        resultadoSim = await simularImportacaoPonto(buffer, file.name, dataExtracao, {
          competencia,
          dataExtracao,
        });
      } else {
        resultadoSim = await simularImportacaoFuncionariosRm(buffer, file.name, dataExtracao, {
          competencia,
          dataExtracao,
        });
      }

      setSimulacao(resultadoSim);
      setEtapa(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao processar o arquivo selecionado.";
      setErroUpload(msg);
      setEtapa(1);
    } finally {
      setProcessando(false);
    }
  };

  const handleConfirmarImportacao = async () => {
    if (!simulacao) return;

    try {
      setProcessando(true);
      const usuarioLogado = sessao ? `${sessao.nome} (${sessao.perfil})` : "Administrador Premier";
      let res: { sucesso: boolean; loteId: string; mensagem: string };

      if (simulacao.tipo === "MEMORIA_CALCULO") {
        const resMC = confirmarImportacaoMC(simulacao as any, usuarioLogado);
        // Lista "A alocar" alimenta o alerta "Admissões aguardando alocação" do Painel
        salvarEstado({ pessoasAAlocar: [...((simulacao as any).pessoasAAlocar || [])] });
        res = { sucesso: true, loteId: resMC.loteId, mensagem: resMC.mensagem };
      } else if (simulacao.tipo === "BASE_REV04") {
        const loteId = `LOTE-REV04-${Date.now().toString(36).toUpperCase()}`;
        res = {
          sucesso: true,
          loteId,
          mensagem: `Base Estruturada REV04 carregada: ${(simulacao as any).totalImoveis} imóveis, ${(simulacao as any).totalPostos} postos, ${(simulacao as any).totalPosicoes} posições e ${(simulacao as any).totalFeristas} feristas vinculados com sucesso.`,
        };
      } else if (simulacao.tipo === "ALOCADOS_SIFAC") {
        res = confirmarImportacaoSifac(simulacao, usuarioLogado);
      } else if (simulacao.tipo === "ABONO_RM") {
        res = confirmarImportacaoAbono(simulacao, usuarioLogado);
      } else if (simulacao.tipo === "REGISTROS_PONTO_RM" || (simulacao as any).tipo === "AFD_PONTO") {
        res = confirmarImportacaoPonto(simulacao as any, usuarioLogado);
        try {
          const simPonto = simulacao as any;
          await fetch("/api/ponto", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lote: { id: res.loteId, tipo: simPonto.tipo, competencia: simPonto.competencia, dataReferencia: simPonto.dataReferencia },
              marcacoes: simPonto.marcacoesExtraidas || [],
              diasFolgaRm: simPonto.diasSemJornadaPrevista || [],
            }),
          });
        } catch (apiErr) {
          console.warn("Aviso ao sincronizar ponto com o servidor:", apiErr);
        }
      } else {
        res = confirmarImportacaoFuncionariosRm(simulacao as any, usuarioLogado);
      }

      setLoteConfirmadoId(res.loteId);
      setMensagemFeedback({ tipo: "sucesso", texto: res.mensagem });
      setEtapa(4);
      carregarDados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao confirmar a importação.";
      setMensagemFeedback({ tipo: "erro", texto: msg });
    } finally {
      setProcessando(false);
    }
  };

  // Gerar Calendário da Competência
  const handleGerarCalendario = () => {
    if (!todosTresConcluidos) {
      setMensagemFeedback({
        tipo: "alerta",
        texto: "Para gerar o calendário, os 3 arquivos da competência (Funcionários, Ponto e Abonos) precisam estar concluídos.",
      });
      return;
    }

    try {
      const usuarioLogado = sessao ? `${sessao.nome} (${sessao.perfil})` : "Administrador Premier";
      const resultado = gerarCalendarioCompetencia(competencia, usuarioLogado);
      setResultadoCalendarioModal(resultado);
      setModalCalendarioAberto(true);
      setMensagemFeedback({
        tipo: "sucesso",
        texto: `Calendário da competência ${competencia} gerado com sucesso! (${resultado.periodo.datas.length} dias consolidados, cobertura média: ${resultado.metricasGerais.taxaCoberturaMedia.toFixed(1)}%).`,
      });
      carregarDados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar calendário da competência.";
      setMensagemFeedback({ tipo: "erro", texto: msg });
    }
  };

  // Download do Modelo Funcionários (2 abas: CADASTRO e AFASTAMENTOS_FERIAS)
  const handleBaixarModeloFuncionarios = () => {
    const bytes = gerarModeloFuncionariosXlsx();
    const blob = new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_funcionarios_rm.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBaixarModeloAbono = () => {
    const bytes = gerarModeloCuboAbonoXlsx();
    const blob = new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_cubo_abono_rm.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBaixarModeloPonto = () => {
    const bytes = gerarModeloPontoXlsx();
    const blob = new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_ponto_registros_rm.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBaixarRelatorioValidacao = () => {
    if (!simulacao) return;
    let relatorioBytes: Uint8Array;
    if (simulacao.tipo === "FUNCIONARIOS_RM") {
      relatorioBytes = gerarRelatorioValidacaoXlsx(simulacao as any);
    } else if (simulacao.tipo === "ABONO_RM") {
      relatorioBytes = gerarRelatorioValidacaoAbonoXlsx(simulacao as any);
    } else if (simulacao.tipo === "REGISTROS_PONTO_RM" || (simulacao as any).tipo === "AFD_PONTO") {
      relatorioBytes = gerarRelatorioValidacaoPontoXlsx((simulacao as any).resultadoPontoCompleto);
    } else {
      const wb = XLSX.utils.book_new();
      const incs = (simulacao as any)?.inconsistencias;
      const ws = XLSX.utils.json_to_sheet(
        incs && incs.length > 0 ? incs : [{ Mensagem: "Nenhum erro ou alerta." }]
      );
      XLSX.utils.book_append_sheet(wb, ws, "Validação");
      relatorioBytes = new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
    }
    const blob = new Blob([relatorioBytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_validacao_${simulacao.tipo}_${(simulacao as any).dataReferencia || competencia}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download das Linhas Rejeitadas
  const handleBaixarLinhasRejeitadas = () => {
    if (!simulacao) return;
    const incsLista = ((simulacao as any).inconsistencias || []) as any[];
    const itensRejeitados: ItemLinhaRejeitada[] =
      (simulacao as any).linhasRejeitadasLista ||
      incsLista
        .filter((i: any) => i.tipo === "ERRO" || (i as any).gravidade === "ERRO")
        .map((i: any) => ({
          linha: i.linha,
          aba: "DADOS",
          chapa: i.chapa || "—",
          coluna: i.coluna || "Geral",
          motivo: i.mensagem || (i as any).motivo || "Erro de validação",
        }));

    const bytes = gerarPlanilhaLinhasRejeitadasXlsx(itensRejeitados);
    const blob = new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linhas_rejeitadas_${simulacao.tipo}_${competencia}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Desfazer Lote com verificação de cascata
  const handleClicarDesfazerLote = (lote: LoteImportacaoOperacional) => {
    if (lote.tipo === "FUNCIONARIOS_RM" && lote.competencia) {
      // Verifica se existem lotes de Ponto ou Abono na mesma competência
      const temPontoOuAbono = lotes.some(
        (l) =>
          l.competencia === lote.competencia &&
          (l.tipo === "REGISTROS_PONTO_RM" || l.tipo === "ABONO_RM" || l.tipo === "AFD_PONTO") &&
          l.status === "CONCLUIDO"
      );

      if (temPontoOuAbono) {
        setLoteParaDesfazerCascata(lote);
        setModalCascataAberto(true);
        return;
      }
    }

    // Desfaz diretamente se não houver dependência em cascata
    const usuarioLogado = sessao ? `${sessao.nome} (${sessao.perfil})` : "Administrador Premier";
    const res = desfazerLotePorId(lote.id, usuarioLogado, false);
    setMensagemFeedback({
      tipo: res.sucesso ? "sucesso" : "erro",
      texto: res.mensagem,
    });
    carregarDados();
  };

  const handleConfirmarDesfazerCascata = () => {
    if (!loteParaDesfazerCascata) return;
    const usuarioLogado = sessao ? `${sessao.nome} (${sessao.perfil})` : "Administrador Premier";
    const res = desfazerLotePorId(loteParaDesfazerCascata.id, usuarioLogado, true);
    setModalCascataAberto(false);
    setLoteParaDesfazerCascata(null);
    setMensagemFeedback({
      tipo: res.sucesso ? "sucesso" : "erro",
      texto: res.mensagem,
    });
    carregarDados();
  };

  const reiniciarFluxo = () => {
    setEtapa(1);
    setArquivoSelecionado(null);
    setIdentificacao(null);
    setSimulacao(null);
    setErroUpload("");
  };

  // Se o usuário não for administrador, exibe bloqueio de acesso
  if (!carregandoSessao && !ehAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Acesso Restrito ao Módulo de Importações</h2>
        <p className="text-sm text-slate-600">
          O módulo <strong>Importações de Dados</strong> é de acesso exclusivo para o perfil{" "}
          <strong>Administrador Premier</strong>. Usuários com outros perfis não possuem permissão para executar cargas operacionais ou rollback de lotes contratuais.
        </p>
        <div className="pt-4">
          <Link
            href="/painel"
            className="inline-flex items-center gap-2 px-4 py-2 bg-premier-900 text-white font-medium rounded-lg text-sm hover:bg-premier-800 transition-colors"
          >
            Voltar ao Painel Geral
          </Link>
        </div>
      </div>
    );
  }

  // Filtragem da tabela de inconsistências
  const inconsistenciasFiltradas = (((simulacao as any)?.inconsistencias || []) as any[]).filter((inc: any) => {
    const tipoItem = inc.tipo || inc.gravidade;
    const matchTipo = filtroTipoInconsistencia === "TODAS" ? true : tipoItem === filtroTipoInconsistencia;
    const matchBusca =
      !buscaInconsistencia ||
      (inc.mensagem && inc.mensagem.toLowerCase().includes(buscaInconsistencia.toLowerCase())) ||
      (inc.chapa && inc.chapa.includes(buscaInconsistencia)) ||
      (inc.nome && inc.nome.toLowerCase().includes(buscaInconsistencia.toLowerCase()));
    return matchTipo && matchBusca;
  });

  // Linhas rejeitadas para exibição na aba
  const linhasRejeitadasExibicao = (simulacao as any)?.linhasRejeitadasLista || [];

  // Filtragem do histórico de lotes
  const lotesFiltrados = lotes.filter((l) => {
    const matchTipo = filtroTipoLote === "TODOS" ? true : l.tipo === filtroTipoLote;
    const matchComp = filtroCompetenciaLote === "TODAS" ? true : l.competencia === filtroCompetenciaLote;
    return matchTipo && matchComp;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans">
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold text-slate-700 border border-slate-200 bg-white uppercase tracking-wide">
              MOMENTO 1 · Carga Real
            </span>
            <span className="text-slate-400 text-xs">Contrato Petrobras ICJ 5900.0129796.25.2</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Importações de Dados</h1>
          <p className="text-xs text-slate-500">
            Carga mensal por competência: Funcionários → Ponto → Abonos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBaixarModeloFuncionarios}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            title="Baixar planilha modelo com abas CADASTRO e AFASTAMENTOS_FERIAS"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Modelo Funcionários</span>
          </button>
          <button
            onClick={handleBaixarModeloAbono}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            title="Baixar planilha modelo de Cubo de Abono (ocorrências/atestados)"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Modelo Cubo de Abono</span>
          </button>
          <button
            onClick={handleBaixarModeloPonto}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            title="Baixar planilha modelo de Ponto / Cubo de Registros"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Modelo Ponto / Registros</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback (Sucesso / Erro / Alerta) */}
      {mensagemFeedback && (
        <div
          className={`p-4 rounded-lg text-xs flex items-center justify-between border ${
            mensagemFeedback.tipo === "sucesso"
              ? "bg-white text-emerald-900 border-emerald-300 shadow-xs"
              : mensagemFeedback.tipo === "alerta"
              ? "bg-white text-amber-900 border-amber-300 shadow-xs"
              : "bg-white text-rose-900 border-rose-300 shadow-xs"
          }`}
        >
          <div className="flex items-center gap-2">
            {mensagemFeedback.tipo === "sucesso" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : mensagemFeedback.tipo === "alerta" ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{mensagemFeedback.texto}</span>
          </div>
          <button
            onClick={() => setMensagemFeedback(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. NOVO BLOCO "COMPETÊNCIA" (acima do stepper) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Controle Mensal da Competência
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <select
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {listaCompetencias.map((comp) => (
                    <option key={comp} value={comp}>
                      Competência {comp}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200 font-medium">
                  Período de Apuração: <strong className="text-slate-800">{periodoCompetencia.textoFormatado}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Botão Gerar Calendário e Status de Desatualização */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            {statusCalendario?.status === "DESATUALIZADO" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Calendário desatualizado — reprocessar</span>
              </span>
            )}
            <button
              onClick={handleGerarCalendario}
              disabled={!todosTresConcluidos}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-premier-900 text-white hover:bg-premier-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
              title={
                !todosTresConcluidos
                  ? "Conclua os 3 arquivos (Funcionários, Ponto e Abonos) para gerar o calendário"
                  : "Consolida os 3 arquivos gerando a escala dia a dia por colaborador e posição"
              }
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gerar calendário da competência</span>
            </button>
          </div>
        </div>

        {/* 3 Cartões em Linha: Funcionários | Ponto | Abonos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Funcionários */}
          <div
            className={`border rounded-xl p-4 transition-all ${
              loteFuncionariosCompetencia
                ? "bg-emerald-50/30 border-emerald-300"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-800">1. Funcionários</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  loteFuncionariosCompetencia
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {loteFuncionariosCompetencia ? "Concluído" : "Não carregado"}
              </span>
            </div>

            <div className="text-[11px] text-slate-600 space-y-1 my-3">
              <div>
                <span className="text-slate-400">Lote: </span>
                <strong className="text-slate-800">{loteFuncionariosCompetencia?.id || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Data/Hora: </span>
                <span>{loteFuncionariosCompetencia?.dataHora || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Usuário: </span>
                <span>{loteFuncionariosCompetencia?.usuario || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Linhas: </span>
                <span>
                  Aceitas:{" "}
                  <strong className="text-emerald-700">
                    {loteFuncionariosCompetencia
                      ? loteFuncionariosCompetencia.totais.novos + loteFuncionariosCompetencia.totais.atualizados
                      : 0}
                  </strong>{" "}
                  | Rejeitadas:{" "}
                  <strong className="text-rose-700">
                    {loteFuncionariosCompetencia?.linhasRejeitadas ?? loteFuncionariosCompetencia?.totais.erros ?? 0}
                  </strong>{" "}
                  | Alertas:{" "}
                  <strong className="text-amber-700">
                    {loteFuncionariosCompetencia?.totais.alertas ?? 0}
                  </strong>
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleSelecionarTipoParaImportar("FUNCIONARIOS_RM")}
                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-center bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                {loteFuncionariosCompetencia ? "Substituir Lote" : "Importar Funcionários"}
              </button>
            </div>
          </div>

          {/* Card 2: Ponto / Registros */}
          <div
            className={`border rounded-xl p-4 transition-all ${
              !temFuncionariosConcluido
                ? "bg-slate-50/70 border-slate-200 opacity-80"
                : lotePontoCompetencia
                ? "bg-emerald-50/30 border-emerald-300"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800">2. Ponto / Registros</span>
                {!temFuncionariosConcluido && (
                  <span title="Importe primeiro o arquivo de Funcionários desta competência" className="inline-flex items-center">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  !temFuncionariosConcluido
                    ? "bg-slate-100 text-slate-500 border border-slate-200"
                    : lotePontoCompetencia
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {!temFuncionariosConcluido ? "Bloqueado" : lotePontoCompetencia ? "Concluído" : "Não carregado"}
              </span>
            </div>

            <div className="text-[11px] text-slate-600 space-y-1 my-3">
              <div>
                <span className="text-slate-400">Lote: </span>
                <strong className="text-slate-800">{lotePontoCompetencia?.id || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Data/Hora: </span>
                <span>{lotePontoCompetencia?.dataHora || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Usuário: </span>
                <span>{lotePontoCompetencia?.usuario || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Linhas: </span>
                <span>
                  Aceitas:{" "}
                  <strong className="text-emerald-700">
                    {lotePontoCompetencia
                      ? lotePontoCompetencia.totais.novos + lotePontoCompetencia.totais.atualizados
                      : 0}
                  </strong>{" "}
                  | Rejeitadas:{" "}
                  <strong className="text-rose-700">
                    {lotePontoCompetencia?.linhasRejeitadas ?? lotePontoCompetencia?.totais.erros ?? 0}
                  </strong>{" "}
                  | Alertas:{" "}
                  <strong className="text-amber-700">
                    {lotePontoCompetencia?.totais.alertas ?? 0}
                  </strong>
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                disabled={!temFuncionariosConcluido}
                onClick={() => handleSelecionarTipoParaImportar("REGISTROS_PONTO_RM")}
                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-center bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer"
                title={
                  !temFuncionariosConcluido
                    ? "Importe primeiro o arquivo de Funcionários desta competência"
                    : ""
                }
              >
                {lotePontoCompetencia ? "Substituir Lote" : "Importar Ponto"}
              </button>
            </div>
          </div>

          {/* Card 3: Cubo de Abono */}
          <div
            className={`border rounded-xl p-4 transition-all ${
              !temFuncionariosConcluido
                ? "bg-slate-50/70 border-slate-200 opacity-80"
                : loteAbonoCompetencia
                ? "bg-emerald-50/30 border-emerald-300"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800">3. Cubo de Abono</span>
                {!temFuncionariosConcluido && (
                  <span title="Importe primeiro o arquivo de Funcionários desta competência" className="inline-flex items-center">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  !temFuncionariosConcluido
                    ? "bg-slate-100 text-slate-500 border border-slate-200"
                    : loteAbonoCompetencia
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {!temFuncionariosConcluido ? "Bloqueado" : loteAbonoCompetencia ? "Concluído" : "Não carregado"}
              </span>
            </div>

            <div className="text-[11px] text-slate-600 space-y-1 my-3">
              <div>
                <span className="text-slate-400">Lote: </span>
                <strong className="text-slate-800">{loteAbonoCompetencia?.id || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Data/Hora: </span>
                <span>{loteAbonoCompetencia?.dataHora || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Usuário: </span>
                <span>{loteAbonoCompetencia?.usuario || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Linhas: </span>
                <span>
                  Aceitas:{" "}
                  <strong className="text-emerald-700">
                    {loteAbonoCompetencia
                      ? loteAbonoCompetencia.totais.novos + loteAbonoCompetencia.totais.atualizados
                      : 0}
                  </strong>{" "}
                  | Rejeitadas:{" "}
                  <strong className="text-rose-700">
                    {loteAbonoCompetencia?.linhasRejeitadas ?? loteAbonoCompetencia?.totais.erros ?? 0}
                  </strong>{" "}
                  | Alertas:{" "}
                  <strong className="text-amber-700">
                    {loteAbonoCompetencia?.totais.alertas ?? 0}
                  </strong>
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                disabled={!temFuncionariosConcluido}
                onClick={() => handleSelecionarTipoParaImportar("ABONO_RM")}
                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-center bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer"
                title={
                  !temFuncionariosConcluido
                    ? "Importe primeiro o arquivo de Funcionários desta competência"
                    : ""
                }
              >
                {loteAbonoCompetencia ? "Substituir Lote" : "Importar Abonos"}
              </button>
            </div>
          </div>
        </div>

        {/* Cartões Adicionais: Memória de Cálculo e Base Estruturada REV04 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          {/* Card 4: Memória de Cálculo (MC) */}
          <div
            className={`border rounded-xl p-4 transition-all ${
              tipoAlvo === "MEMORIA_CALCULO"
                ? "bg-blue-50/50 border-blue-400 ring-2 ring-blue-200"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span className="text-xs font-bold text-slate-800">4. Memória de Cálculo (MC)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Mensal da Competência
              </span>
            </div>

            <p className="text-[11px] text-slate-600 mb-3">
              Carga das alocações e medição da competência com saneamento automático, vinculação por IDENTIFICADOR e bloqueio impeditivo se o ciclo das linhas divergir.
            </p>

            <div className="text-[11px] text-slate-600 space-y-1 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400">Ciclo configurado: </span>
                <strong className="text-slate-800">
                  {obterCicloEsperadoCompetencia(competencia, diaInicioCiclo, diaFimCiclo).texto}
                </strong>{" "}
                <span className="text-slate-400">(dia {String(diaInicioCiclo).padStart(2, "0")} ao dia {String(diaFimCiclo).padStart(2, "0")})</span>
              </div>
              <div>
                <span className="text-slate-400">Regra de Bloqueio: </span>
                <span className="text-rose-700 font-semibold">Bloqueia se o ciclo das linhas divergir da competência</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleSelecionarTipoParaImportar("MEMORIA_CALCULO")}
                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-center bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
              >
                Importar Memória de Cálculo (MC)
              </button>
            </div>
          </div>

          {/* Card 5: Base Estruturada REV04 */}
          <div
            className={`border rounded-xl p-4 transition-all ${
              tipoAlvo === "BASE_REV04"
                ? "bg-indigo-50/50 border-indigo-400 ring-2 ring-indigo-200"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                <span className="text-xs font-bold text-slate-800">5. Base Estruturada Oficial (REV04)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                Modelo Etapa 1
              </span>
            </div>

            <p className="text-[11px] text-slate-600 mb-3">
              Carga oficial do modelo estrutural: 29 Imóveis com cidade/UF corrigidos (Unidade_RM), 244 Postos, 311 Posições e 23 Feristas de cobertura.
            </p>

            <div className="text-[11px] text-slate-600 space-y-1 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400">Totais Oficiais: </span>
                <strong className="text-slate-800">29 Imóveis | 244 Postos | 311 Posições | 23 Feristas</strong>
              </div>
              <div>
                <span className="text-slate-400">Municípios Corrigidos: </span>
                <span className="text-emerald-700 font-semibold">Zero imóveis com cidade errada (Paulínia apenas na REPLAN)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleSelecionarTipoParaImportar("BASE_REV04")}
                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-center bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
              >
                Carregar Base Estruturada REV04
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé do Bloco de Competência */}
        {statusCalendario?.dataProcessamento && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Último processamento do calendário: <strong>{statusCalendario.dataProcessamento}</strong> por{" "}
                <strong>{statusCalendario.geradoPor || "Admin"}</strong>. Total de dias consolidados:{" "}
                <strong>{statusCalendario.periodo.datas.length}</strong>. Cobertura média:{" "}
                <strong>{statusCalendario.metricasGerais.taxaCoberturaMedia.toFixed(1)}%</strong>.
              </span>
            </div>
            {statusCalendario.status === "GERADO" ? (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Sincronizado
              </span>
            ) : (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Desatualizado
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. STEPPER (4 ETAPAS) */}
      <div id="secao-stepper-importacao" className="space-y-4">
        {/* Barra Visual das 4 Etapas */}
        <div className="grid grid-cols-4 gap-2 border border-slate-200 bg-white rounded-xl p-3 shadow-xs text-xs">
          <div
            className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
              etapa === 1
                ? "bg-slate-100 text-slate-900 font-bold border border-slate-300"
                : etapa > 1
                ? "text-emerald-700 font-medium"
                : "text-slate-400"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                etapa === 1
                  ? "bg-slate-800 text-white"
                  : etapa > 1
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {etapa > 1 ? "✓" : "1"}
            </div>
            <div className="truncate">
              <span className="block font-semibold">1. Upload</span>
              <span className="text-[10px] text-slate-500 block truncate">Arquivo e Extração</span>
            </div>
          </div>

          <div
            className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
              etapa === 2
                ? "bg-slate-100 text-slate-900 font-bold border border-slate-300"
                : etapa > 2
                ? "text-emerald-700 font-medium"
                : "text-slate-400"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                etapa === 2
                  ? "bg-slate-800 text-white"
                  : etapa > 2
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {etapa > 2 ? "✓" : "2"}
            </div>
            <div className="truncate">
              <span className="block font-semibold">2. Identificação</span>
              <span className="text-[10px] text-slate-500 block truncate">Cabeçalhos das Colunas</span>
            </div>
          </div>

          <div
            className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
              etapa === 3
                ? "bg-slate-100 text-slate-900 font-bold border border-slate-300"
                : etapa > 3
                ? "text-emerald-700 font-medium"
                : "text-slate-400"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                etapa === 3
                  ? "bg-slate-800 text-white"
                  : etapa > 3
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {etapa > 3 ? "✓" : "3"}
            </div>
            <div className="truncate">
              <span className="block font-semibold">3. Pré-Visualização</span>
              <span className="text-[10px] text-slate-500 block truncate">Simulação e Erros</span>
            </div>
          </div>

          <div
            className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
              etapa === 4
                ? "bg-slate-100 text-slate-900 font-bold border border-slate-300"
                : "text-slate-400"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                etapa === 4 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              {etapa === 4 ? "✓" : "4"}
            </div>
            <div className="truncate">
              <span className="block font-semibold">4. Confirmação</span>
              <span className="text-[10px] text-slate-500 block truncate">Lote e Gravação</span>
            </div>
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL DO STEPPER */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          {/* ETAPA 1: Upload */}
          {etapa === 1 && (
            <div className="space-y-6">
              {/* Etiqueta fixa do tipo selecionado e competência */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Fluxo Ativo:</span>
                  <span className="px-2.5 py-1 rounded-md font-bold text-xs bg-premier-900 text-white shadow-2xs">
                    {tipoAlvo === "FUNCIONARIOS_RM"
                      ? "1. Funcionários (Cadastro + Afastamentos/Férias)"
                      : tipoAlvo === "REGISTROS_PONTO_RM"
                      ? "2. Ponto / Registros"
                      : tipoAlvo === "ABONO_RM"
                      ? "3. Cubo de Abono"
                      : tipoAlvo === "MEMORIA_CALCULO"
                      ? "4. Memória de Cálculo (MC)"
                      : tipoAlvo === "BASE_REV04"
                      ? "5. Base Estruturada REV04"
                      : "Lista de Alocados SIFAC"}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-700 font-semibold">
                    Competência: <strong className="text-slate-900">{competencia}</strong> (
                    {periodoCompetencia.textoFormatado})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>A estrutura contratual REV04 não é alterada por esta carga.</span>
                </div>
              </div>

              {/* Bloco de Configuração de Período para Memória de Cálculo (Item 4) */}
              {tipoAlvo === "MEMORIA_CALCULO" && (
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-900">
                      Configuração do Período de Medição da Competência {competencia}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Dia de Início do Ciclo (Mês Anterior)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={diaInicioCiclo}
                        onChange={(e) => setDiaInicioCiclo(parseInt(e.target.value, 10) || 10)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Dia de Término do Ciclo (Mês Atual)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={diaFimCiclo}
                        onChange={(e) => setDiaFimCiclo(parseInt(e.target.value, 10) || 9)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-blue-900 bg-white/80 p-2.5 rounded-lg border border-blue-100 flex items-center justify-between">
                    <div>
                      Ciclo esperado para validação:{" "}
                      <strong className="text-blue-700">
                        {obterCicloEsperadoCompetencia(competencia, diaInicioCiclo, diaFimCiclo).texto}
                      </strong>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Padrão atual: dia 10 ao dia 09
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Campo Data de Extração no RM */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Data de extração no RM <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dataExtracao}
                    onChange={(e) => setDataExtracao(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">
                    Informativo, gravado no lote. A competência da apuração vem do seletor superior (
                    {competencia}).
                  </p>
                </div>

                {/* 7. LGPD Card Atualizado */}
                <div className="md:col-span-2 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 block">
                      Segurança e Conformidade LGPD
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      O arquivo original fica guardado por 90 dias para auditoria contratual. Só as
                      colunas autorizadas são lidas. Idade e CID nunca são gravados. Tipo de atestado
                      e de afastamento ficam visíveis apenas para RH/Gestão Premier. O perfil Fiscal
                      Petrobras vê apenas: Trabalhado, Folga, Férias, Afastamento, Ausência justificada,
                      Abono do gestor, Falta.
                    </p>
                  </div>
                </div>
              </div>

              {/* Zona de Drop / Upload */}
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-xl p-8 text-center transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .XLSX, .XLS, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center text-blue-600 shadow-xs">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-sm text-slate-800">
                    Clique para selecionar ou arraste o arquivo Excel (.xlsx ou .xls) aqui
                  </span>
                  <span className="text-xs text-slate-500">
                    Arquivos Excel até 10 MB para a competência {competencia}
                  </span>
                </div>
              </div>

              {erroUpload && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{erroUpload}</span>
                </div>
              )}
            </div>
          )}

          {/* ETAPA 2: Identificação e Alerta Cruzado */}
          {etapa === 2 && identificacao && (
            <div className="space-y-5">
              {/* Aviso se os cabeçalhos combinarem com OUTRO tipo */}
              {identificacao.avisoOutroTipo && (
                <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs flex items-start gap-3 shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-bold text-sm">
                      Divergência de Tipo de Arquivo Detectada
                    </strong>
                    <span>
                      Você selecionou importar <strong>{tipoAlvo}</strong>, mas os cabeçalhos deste
                      arquivo combinam com <strong>{identificacao.avisoOutroTipo}</strong>. Deseja
                      prosseguir com o tipo atual ou prefere alternar?
                    </span>
                  </div>
                </div>
              )}

              {/* Se faltarem colunas obrigatórias */}
              {!identificacao.reconhecido && identificacao.colunasFaltantes.length > 0 ? (
                <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-4">
                  <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-rose-950">
                      Colunas Obrigatórias Não Encontradas
                    </h3>
                    <p className="text-xs text-rose-800 max-w-lg mx-auto">
                      O arquivo <strong>{arquivoSelecionado?.name}</strong> não possui todas as colunas
                      obrigatórias para o tipo selecionado ({tipoAlvo}).
                    </p>
                  </div>

                  <div className="p-4 bg-white rounded-lg border border-rose-200 max-w-md mx-auto text-left text-xs space-y-2">
                    <span className="font-bold text-slate-800 block">Colunas obrigatórias ausentes:</span>
                    <ul className="list-disc list-inside text-rose-700 space-y-1 font-mono text-[11px]">
                      {identificacao.colunasFaltantes.map((col) => (
                        <li key={col}>{col}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={reiniciarFluxo}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Selecionar Outro Arquivo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Cabeçalhos validados com sucesso para o layout esperado!</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Todas as colunas obrigatórias foram localizadas. O sistema realizou a normalização
                    da CHAPA com 6 dígitos e associou as unidades operacionais pela coluna DESC. SECAO.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ETAPA 3: Pré-Visualização / Simulação */}
          {etapa === 3 && simulacao && (
            <div className="space-y-6">
              {/* Header da Simulação */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold text-slate-800 border border-slate-300 bg-white">
                      Tipo: {simulacao.tipo}
                    </span>
                    <span className="text-slate-400 text-xs">|</span>
                    <span className="text-xs text-slate-600 font-mono">{simulacao.arquivoNome}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                    <span>
                      Competência: <strong>{(simulacao as any).competencia || competencia}</strong> (
                      {periodoCompetencia.textoFormatado})
                    </span>
                    <span>
                      Hash SHA-256:{" "}
                      <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">
                        {simulacao.hashSha256 ? `${simulacao.hashSha256.substring(0, 16)}...` : "AUDITORIA-INTEGRADA"}
                      </code>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {simulacao.tipo !== "MEMORIA_CALCULO" && simulacao.tipo !== "BASE_REV04" && (
                    <button
                      onClick={handleBaixarRelatorioValidacao}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Relatório Completo (XLSX)</span>
                    </button>
                  )}
                  <button
                    onClick={reiniciarFluxo}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Trocar Arquivo
                  </button>
                </div>
              </div>

              {/* Aviso se já existir lote da mesma competência (Substituição) */}
              {(() => {
                const loteExistenteMesmoTipo = lotes.find(
                  (l) =>
                    l.tipo === simulacao.tipo &&
                    l.competencia === ((simulacao as any).competencia || competencia) &&
                    l.status === "CONCLUIDO"
                );
                if (loteExistenteMesmoTipo) {
                  return (
                    <div className="p-4 bg-white border border-amber-300 text-amber-900 rounded-xl text-xs flex items-start gap-3 shadow-xs">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold text-sm">
                          Substituir o lote {loteExistenteMesmoTipo.id}?
                        </strong>
                        <span className="text-[11px] leading-relaxed">
                          Já existe um lote concluído de <strong>{simulacao.tipo}</strong> para a
                          competência <strong>{(simulacao as any).competencia || competencia}</strong>. A confirmação
                          deste arquivo <strong>desfará o lote anterior e gravará o novo</strong> (não haverá soma de dados).
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Renderização Condicional da Simulação: MC vs BASE_REV04 vs RM Padrão */}
              {simulacao.tipo === "MEMORIA_CALCULO" ? (
                (simulacao as any).bloqueado ? (
                  /* Banner Impeditivo de Bloqueio da MC */
                  <div className="p-6 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                        <XCircle className="w-7 h-7" />
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white uppercase tracking-wider">
                            Carga Bloqueada
                          </span>
                          <span className="text-xs font-semibold text-rose-800">
                            Regra Contratual · Validação de Período de Medição
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-rose-950 leading-tight">
                          {(simulacao as any).mensagemBloqueio ||
                            "O ciclo das linhas não corresponde à competência informada. Atualize a MC e importe novamente."}
                        </h3>
                        <p className="text-xs text-rose-800 leading-relaxed max-w-3xl">
                          Para garantir a integridade da medição e evitar faturamento incorreto, o sistema exige que as datas das colunas de apuração na planilha correspondam estritamente ao período da competência informada.
                        </p>
                      </div>
                    </div>

                    {/* Quadro comparativo dos ciclos */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 bg-white rounded-xl border border-rose-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Cabeçalho da Planilha</span>
                        <span className="text-sm font-bold text-slate-800 font-mono">{(simulacao as any).cicloCabecalho || "—"}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Período indicado na célula A1</span>
                      </div>
                      <div className="p-3.5 bg-rose-100/70 rounded-xl border border-rose-300 shadow-2xs">
                        <span className="text-[10px] font-bold text-rose-700 uppercase block">Ciclo Detectado nas Linhas</span>
                        <span className="text-sm font-bold text-rose-900 font-mono">{(simulacao as any).cicloLinhas || "—"}</span>
                        <span className="text-[10px] text-rose-600 block mt-0.5">Colunas de apuração diária</span>
                      </div>
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Ciclo Esperado ({competencia})</span>
                        <span className="text-sm font-bold text-blue-700 font-mono">
                          {obterCicloEsperadoCompetencia(competencia, diaInicioCiclo, diaFimCiclo).texto}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Padrão configurado no sistema</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white/80 rounded-xl border border-rose-200 text-xs text-rose-900 flex items-center justify-between">
                      <span>
                        ⚠️ A gravação deste arquivo foi impedida. Atualize as colunas diárias da Memória de Cálculo para a competência correta antes de tentar importar novamente.
                      </span>
                      <button
                        onClick={reiniciarFluxo}
                        className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
                      >
                        Selecionar Nova Planilha
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Tela de Resultado da MC */
                  <div className="space-y-6">
                    {/* 4 Cards de Métricas da MC */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* 1. Total Importado */}
                      <div className="p-3.5 bg-emerald-50/40 border border-emerald-200 rounded-xl text-center shadow-xs">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Importado</span>
                        <span className="text-2xl font-bold text-emerald-800">{(simulacao as any).totalImportado}</span>
                        <span className="text-[10px] text-emerald-600 block mt-0.5">Alocações nos 19 postos homologados</span>
                      </div>

                      {/* 2. Total Ignorado */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center shadow-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Ignorado</span>
                        <span className="text-2xl font-bold text-slate-700">{(simulacao as any).totalIgnorado}</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Itens fora do catálogo (offshore/serviços)</span>
                      </div>

                      {/* 3. Inconsistências */}
                      <div className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-xl text-center shadow-xs">
                        <span className="text-[10px] font-bold text-amber-700 uppercase block">Inconsistências</span>
                        <span className="text-2xl font-bold text-amber-800">{(simulacao as any).inconsistencias?.length || 0}</span>
                        <span className="text-[10px] text-amber-600 block mt-0.5">Valores '-' saneados e ligações por nome</span>
                      </div>

                      {/* 4. Pessoas A Alocar */}
                      <div className="p-3.5 bg-rose-50/40 border border-rose-200 rounded-xl text-center shadow-xs">
                        <span className="text-[10px] font-bold text-rose-700 uppercase block">Pessoas "A alocar"</span>
                        <span className="text-2xl font-bold text-rose-800">{(simulacao as any).pessoasAAlocar?.length || 0}</span>
                        <span className="text-[10px] text-rose-600 block mt-0.5">Sem posição no SGP (não criadas)</span>
                      </div>
                    </div>

                    {/* Abas da MC */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setAbaPreviaMC("INCONSISTENCIAS")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              abaPreviaMC === "INCONSISTENCIAS"
                                ? "bg-amber-600 text-white shadow-2xs"
                                : "text-amber-800 hover:bg-amber-50"
                            }`}
                          >
                            Inconsistências ({(simulacao as any).inconsistencias?.length || 0})
                          </button>
                          <button
                            onClick={() => setAbaPreviaMC("A_ALOCAR")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              abaPreviaMC === "A_ALOCAR"
                                ? "bg-rose-700 text-white shadow-2xs"
                                : "text-rose-800 hover:bg-rose-50"
                            }`}
                          >
                            Pessoas "A alocar" ({(simulacao as any).pessoasAAlocar?.length || 0})
                          </button>
                          <button
                            onClick={() => setAbaPreviaMC("IGNORADOS")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              abaPreviaMC === "IGNORADOS"
                                ? "bg-slate-700 text-white shadow-2xs"
                                : "text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            Itens Ignorados ({(simulacao as any).totalIgnorado})
                          </button>
                          <button
                            onClick={() => setAbaPreviaMC("VINCULADOS")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              abaPreviaMC === "VINCULADOS"
                                ? "bg-premier-900 text-white shadow-2xs"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            Alocações Vinculadas ({(simulacao as any).totalImportado})
                          </button>
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            value={buscaMC}
                            onChange={(e) => setBuscaMC(e.target.value)}
                            placeholder="Buscar por linha, colaborador, posto..."
                            className="px-2.5 py-1 pl-7 border border-slate-300 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 w-56"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                        </div>
                      </div>

                      {/* Conteúdo Aba 1: Inconsistências MC */}
                      {abaPreviaMC === "INCONSISTENCIAS" && (
                        <div className="space-y-3">
                          <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-[11px] leading-relaxed">
                              <strong>Saneamento Contratual Aplicado:</strong> Valores <code>"-"</code> em campos numéricos foram tratados como vazios e registrados aqui para auditoria. Ligações por nome normalizado (quando não há ID) são identificadas para conferência.
                            </div>
                          </div>
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="max-h-72 overflow-y-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-amber-50 text-amber-900 font-bold border-b border-amber-200 sticky top-0">
                                  <tr>
                                    <th className="py-2.5 px-3 w-16 text-center">Linha</th>
                                    <th className="py-2.5 px-3 w-32">Campo</th>
                                    <th className="py-2.5 px-3 w-48">Colaborador</th>
                                    <th className="py-2.5 px-3 w-28 text-center">Valor Original</th>
                                    <th className="py-2.5 px-3">Motivo da Inconsistência</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                                  {((simulacao as any).inconsistencias || [])
                                    .filter((inc: any) => {
                                      if (!buscaMC) return true;
                                      const t = buscaMC.toLowerCase();
                                      return (
                                        String(inc.linha).includes(t) ||
                                        (inc.colaborador && inc.colaborador.toLowerCase().includes(t)) ||
                                        (inc.campo && inc.campo.toLowerCase().includes(t)) ||
                                        (inc.motivo && inc.motivo.toLowerCase().includes(t))
                                      );
                                    })
                                    .map((inc: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">{inc.linha}</td>
                                        <td className="py-2 px-3 font-semibold text-slate-800">{inc.campo || "—"}</td>
                                        <td className="py-2 px-3 font-medium text-slate-900">{inc.colaborador || "—"}</td>
                                        <td className="py-2 px-3 text-center font-mono text-slate-600 bg-slate-50">{String(inc.valorOriginal ?? "—")}</td>
                                        <td className="py-2 px-3 text-amber-900 leading-snug">{inc.motivo}</td>
                                      </tr>
                                    ))}
                                  {((simulacao as any).inconsistencias || []).length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="py-6 text-center text-slate-400">
                                        Nenhuma inconsistência detectada nesta planilha.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Conteúdo Aba 2: Pessoas A Alocar MC */}
                      {abaPreviaMC === "A_ALOCAR" && (
                        <div className="space-y-3">
                          <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                            <Info className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div className="text-[11px] leading-relaxed">
                              <strong>Regra de Ouro da Estrutura:</strong> Colaboradores da MC sem posição cadastrada no SGP não criam postos ou posições automaticamente. Eles são mantidos na lista <em>"A alocar"</em> para que a equipe de gestão vincule ou cadastre a posição formalmente.
                            </div>
                          </div>
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="max-h-72 overflow-y-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-200 sticky top-0">
                                  <tr>
                                    <th className="py-2.5 px-3 w-16 text-center">Linha</th>
                                    <th className="py-2.5 px-3 w-28 font-mono">ID / Chapa</th>
                                    <th className="py-2.5 px-3 w-48">Nome do Colaborador</th>
                                    <th className="py-2.5 px-3 w-40">Local de Atuação</th>
                                    <th className="py-2.5 px-3 w-32">Função / Item</th>
                                    <th className="py-2.5 px-3">Situação</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                                  {((simulacao as any).pessoasAAlocar || [])
                                    .filter((p: any) => {
                                      if (!buscaMC) return true;
                                      const t = buscaMC.toLowerCase();
                                      return (
                                        String(p.linha).includes(t) ||
                                        (p.identificador && p.identificador.toLowerCase().includes(t)) ||
                                        (p.colaborador && p.colaborador.toLowerCase().includes(t)) ||
                                        (p.local && p.local.toLowerCase().includes(t))
                                      );
                                    })
                                    .map((p: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">{p.linha}</td>
                                        <td className="py-2 px-3 font-mono font-bold text-rose-900">{p.identificador || "—"}</td>
                                        <td className="py-2 px-3 font-medium text-slate-900">{p.colaborador || "—"}</td>
                                        <td className="py-2 px-3 text-slate-600">{p.local || "—"}</td>
                                        <td className="py-2 px-3 text-slate-600">{p.itemPpu || p.funcao || "—"}</td>
                                        <td className="py-2 px-3">
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                            {p.motivo}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  {((simulacao as any).pessoasAAlocar || []).length === 0 && (
                                    <tr>
                                      <td colSpan={6} className="py-6 text-center text-slate-400">
                                        Nenhuma pessoa pendente de alocação nesta planilha.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Conteúdo Aba 3: Itens Ignorados MC */}
                      {abaPreviaMC === "IGNORADOS" && (
                        <div className="space-y-3">
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            <div className="text-[11px] leading-relaxed">
                              <strong>Itens Fora do Catálogo dos 19 Postos:</strong> Linhas referentes a serviços adicionais, vistorias, receptivo ou operações offshore são descartadas do cálculo do Painel de Postos contratuais.
                            </div>
                          </div>
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="max-h-72 overflow-y-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                                  <tr>
                                    <th className="py-2.5 px-3 w-16 text-center">Linha</th>
                                    <th className="py-2.5 px-3 w-28 font-mono">Item PPU</th>
                                    <th className="py-2.5 px-3 w-56">Colaborador / Descrição</th>
                                    <th className="py-2.5 px-3">Motivo do Descarte</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                                  {((simulacao as any).itensIgnorados || [])
                                    .filter((it: any) => {
                                      if (!buscaMC) return true;
                                      const t = buscaMC.toLowerCase();
                                      return (
                                        String(it.linha).includes(t) ||
                                        (it.itemPpu && it.itemPpu.toLowerCase().includes(t)) ||
                                        (it.colaborador && it.colaborador.toLowerCase().includes(t)) ||
                                        (it.motivo && it.motivo.toLowerCase().includes(t))
                                      );
                                    })
                                    .map((it: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">{it.linha}</td>
                                        <td className="py-2 px-3 font-mono font-bold text-slate-900 bg-slate-50">{it.itemPpu || "—"}</td>
                                        <td className="py-2 px-3 text-slate-800">{it.colaborador || it.descricao || "—"}</td>
                                        <td className="py-2 px-3 text-slate-500">{it.motivo}</td>
                                      </tr>
                                    ))}
                                  {((simulacao as any).itensIgnorados || []).length === 0 && (
                                    <tr>
                                      <td colSpan={4} className="py-6 text-center text-slate-400">
                                        Nenhum item ignorado.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Conteúdo Aba 4: Alocações Vinculadas MC */}
                      {abaPreviaMC === "VINCULADOS" && (
                        <div className="space-y-3">
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="max-h-72 overflow-y-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                                  <tr>
                                    <th className="py-2.5 px-3 w-16 text-center">Linha</th>
                                    <th className="py-2.5 px-3 w-32 font-mono">Posto SGP</th>
                                    <th className="py-2.5 px-3 w-28 font-mono">Posição</th>
                                    <th className="py-2.5 px-3 w-24">Item PPU</th>
                                    <th className="py-2.5 px-3 w-48">Colaborador</th>
                                    <th className="py-2.5 px-3 w-24 font-mono">ID</th>
                                    <th className="py-2.5 px-3 text-center">Tipo Ligação</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                                  {((simulacao as any).linhasLigadas || [])
                                    .slice(0, 100)
                                    .filter((l: any) => {
                                      if (!buscaMC) return true;
                                      const t = buscaMC.toLowerCase();
                                      return (
                                        String(l.linha).includes(t) ||
                                        (l.postoIdSGP && l.postoIdSGP.toLowerCase().includes(t)) ||
                                        (l.colaborador && l.colaborador.toLowerCase().includes(t)) ||
                                        (l.identificador && l.identificador.toLowerCase().includes(t))
                                      );
                                    })
                                    .map((l: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">{l.linha}</td>
                                        <td className="py-2 px-3 font-mono font-bold text-blue-900">{l.postoIdSGP || "—"}</td>
                                        <td className="py-2 px-3 font-mono text-slate-600">{l.posicaoIdSGP || "—"}</td>
                                        <td className="py-2 px-3 font-mono text-slate-800">{l.itemPpu || "—"}</td>
                                        <td className="py-2 px-3 font-medium text-slate-900">{l.colaborador || "—"}</td>
                                        <td className="py-2 px-3 font-mono text-slate-600">{l.identificador || "—"}</td>
                                        <td className="py-2 px-3 text-center">
                                          <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                              l.tipoLigacao === "CHAVE_PRINCIPAL"
                                                ? "bg-emerald-100 text-emerald-800"
                                                : l.tipoLigacao === "IDENTIFICADOR"
                                                ? "bg-blue-100 text-blue-800"
                                                : "bg-amber-100 text-amber-800"
                                            }`}
                                          >
                                            {l.tipoLigacao === "CHAVE_PRINCIPAL"
                                              ? "Posto SGP"
                                              : l.tipoLigacao === "IDENTIFICADOR"
                                              ? "Identificador (ID)"
                                              : "Nome Normalizado"}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 text-right">
                            Mostrando primeiras 100 de {(simulacao as any).linhasLigadas?.length || 0} alocações vinculadas.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : simulacao.tipo === "BASE_REV04" ? (
                /* Tela de Resultado da Base Estruturada REV04 */
                <div className="space-y-6">
                  {/* 4 Cards de Métricas da Base REV04 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* 1. Imóveis */}
                    <div className="p-3.5 bg-emerald-50/40 border border-emerald-200 rounded-xl text-center shadow-xs">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">Imóveis Oficiais</span>
                      <span className="text-2xl font-bold text-emerald-800">{(simulacao as any).totalImoveis || 29}</span>
                      <span className="text-[10px] text-emerald-600 block mt-0.5">Municípios extraídos de Unidade_RM</span>
                    </div>

                    {/* 2. Postos */}
                    <div className="p-3.5 bg-blue-50/40 border border-blue-200 rounded-xl text-center shadow-xs">
                      <span className="text-[10px] font-bold text-blue-700 uppercase block">Postos Estruturais</span>
                      <span className="text-2xl font-bold text-blue-800">{(simulacao as any).totalPostos || 244}</span>
                      <span className="text-[10px] text-blue-600 block mt-0.5">02_POSTOS (Catálogo contratual)</span>
                    </div>

                    {/* 3. Posições */}
                    <div className="p-3.5 bg-indigo-50/40 border border-indigo-200 rounded-xl text-center shadow-xs">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase block">Posições Mapeadas</span>
                      <span className="text-2xl font-bold text-indigo-800">{(simulacao as any).totalPosicoes || 311}</span>
                      <span className="text-[10px] text-indigo-600 block mt-0.5">03_POSICOES (Linhas válidas)</span>
                    </div>

                    {/* 4. Feristas */}
                    <div className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-xl text-center shadow-xs">
                      <span className="text-[10px] font-bold text-amber-700 uppercase block">Feristas Cobertura</span>
                      <span className="text-2xl font-bold text-amber-800">{(simulacao as any).totalFeristas || 23}</span>
                      <span className="text-[10px] text-amber-600 block mt-0.5">07_FERISTAS_COBERTURA</span>
                    </div>
                  </div>

                  {/* Abas da REV04 */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAbaPreviaREV04("IMOVEIS")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            abaPreviaREV04 === "IMOVEIS"
                              ? "bg-premier-900 text-white shadow-2xs"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          29 Imóveis Consolidados
                        </button>
                        <button
                          onClick={() => setAbaPreviaREV04("FERISTAS")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            abaPreviaREV04 === "FERISTAS"
                              ? "bg-amber-600 text-white shadow-2xs"
                              : "text-amber-700 hover:bg-amber-50"
                          }`}
                        >
                          23 Feristas de Cobertura
                        </button>
                        <button
                          onClick={() => setAbaPreviaREV04("POSICOES")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            abaPreviaREV04 === "POSICOES"
                              ? "bg-indigo-700 text-white shadow-2xs"
                              : "text-indigo-700 hover:bg-indigo-50"
                          }`}
                        >
                          Resumo Postos e Posições (244 / 311)
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={buscaREV04}
                          onChange={(e) => setBuscaREV04(e.target.value)}
                          placeholder="Buscar por unidade, cidade, preposto..."
                          className="px-2.5 py-1 pl-7 border border-slate-300 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 w-56"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                      </div>
                    </div>

                    {/* Conteúdo Aba 1: Imóveis */}
                    {abaPreviaREV04 === "IMOVEIS" && (
                      <div className="space-y-3">
                        <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="text-[11px] leading-relaxed">
                            <strong>Saneamento de Municípios Concluído:</strong> Cidades e Estados extraídos corretamente da coluna <code>Unidade_RM</code> (ex.: <em>BOAVENTURA (Itaboraí - RJ)</em> → Itaboraí / RJ). Corrigido o erro legado em que todos os imóveis apareciam como "Paulínia/SP". Prepostos associados da aba do Relatório Mensal de Atividades.
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="max-h-72 overflow-y-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                                <tr>
                                  <th className="py-2.5 px-3 w-16 text-center">#</th>
                                  <th className="py-2.5 px-3 w-64">Nome do Imóvel (Unidade)</th>
                                  <th className="py-2.5 px-3 w-48">Município / UF</th>
                                  <th className="py-2.5 px-3 w-36 text-center">Status Inicial</th>
                                  <th className="py-2.5 px-3">Preposto Responsável</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                                {((simulacao as any).imoveis || [])
                                  .filter((im: any) => {
                                    if (!buscaREV04) return true;
                                    const t = buscaREV04.toLowerCase();
                                    return (
                                      (im.nome && im.nome.toLowerCase().includes(t)) ||
                                      (im.cidade && im.cidade.toLowerCase().includes(t)) ||
                                      (im.uf && im.uf.toLowerCase().includes(t)) ||
                                      (im.preposto && im.preposto.toLowerCase().includes(t))
                                    );
                                  })
                                  .map((im: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                                      <td className="py-2 px-3 font-bold text-slate-900">{im.nome}</td>
                                      <td className="py-2 px-3 text-emerald-800 font-semibold">
                                        {im.cidade} / {im.uf}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        <span
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            im.status === "ATIVO"
                                              ? "bg-emerald-100 text-emerald-800"
                                              : "bg-amber-100 text-amber-800"
                                          }`}
                                        >
                                          {im.status || "ATIVO"}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 font-medium text-slate-800">{im.preposto || "—"}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Conteúdo Aba 2: Feristas */}
                    {abaPreviaREV04 === "FERISTAS" && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="max-h-72 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-amber-50 text-amber-900 font-bold border-b border-amber-200 sticky top-0">
                              <tr>
                                <th className="py-2.5 px-3 w-16 text-center">#</th>
                                <th className="py-2.5 px-3 w-28 font-mono">Chapa</th>
                                <th className="py-2.5 px-3 w-64">Nome do Ferista</th>
                                <th className="py-2.5 px-3 w-40 font-mono">Posto Vinculado</th>
                                <th className="py-2.5 px-3">Unidade Operacional</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                              {((simulacao as any).feristas || [])
                                .filter((f: any) => {
                                  if (!buscaREV04) return true;
                                  const t = buscaREV04.toLowerCase();
                                  return (
                                    (f.nome && f.nome.toLowerCase().includes(t)) ||
                                    (f.chapa && f.chapa.toLowerCase().includes(t)) ||
                                    (f.postoId && f.postoId.toLowerCase().includes(t))
                                  );
                                })
                                .map((f: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{f.chapa}</td>
                                    <td className="py-2 px-3 font-medium text-slate-900">{f.nome}</td>
                                    <td className="py-2 px-3 font-mono text-blue-900">{f.postoId || "—"}</td>
                                    <td className="py-2 px-3 text-slate-600">{f.unidade || "—"}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Conteúdo Aba 3: Posições */}
                    {abaPreviaREV04 === "POSICOES" && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="max-h-72 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-indigo-50 text-indigo-900 font-bold border-b border-indigo-200 sticky top-0">
                              <tr>
                                <th className="py-2.5 px-3 w-28 font-mono">Código Posição</th>
                                <th className="py-2.5 px-3 w-32 font-mono">Posto SGP</th>
                                <th className="py-2.5 px-3 w-56">Perfil / Função</th>
                                <th className="py-2.5 px-3 w-32">Regime</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                              {((simulacao as any).posicoes || [])
                                .slice(0, 100)
                                .map((p: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-indigo-50/20 transition-colors">
                                    <td className="py-2 px-3 font-mono font-bold text-indigo-900">{p.id}</td>
                                    <td className="py-2 px-3 font-mono text-slate-700">{p.postoId}</td>
                                    <td className="py-2 px-3 font-medium text-slate-800">{p.perfilProfissional || p.funcao || "—"}</td>
                                    <td className="py-2 px-3 text-slate-600">{p.regime || "—"}</td>
                                    <td className="py-2 px-3 text-center">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                        {p.status || "OCUPADA"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Tela de Resultado Padrão RM */
                <>
                  {/* Cards de Métricas e Totais da Simulação */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Linhas Lidas</span>
                      <span className="text-xl font-bold text-slate-900">{simulacao.totais.lidos}</span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Aceitas</span>
                      <span className="text-xl font-bold text-emerald-700">
                        {simulacao.totais.novos + simulacao.totais.atualizados}
                      </span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Rejeitadas</span>
                      <span
                        className={`text-xl font-bold ${
                          simulacao.totais.erros > 0 ? "text-rose-700" : "text-slate-700"
                        }`}
                      >
                        {simulacao.totais.erros}
                      </span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Alertas</span>
                      <span
                        className={`text-xl font-bold ${
                          simulacao.totais.alertas > 0 ? "text-amber-700" : "text-slate-700"
                        }`}
                      >
                        {simulacao.totais.alertas}
                      </span>
                    </div>
                  </div>

                  {/* Abas da Pré-Visualização */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAbaPrevia("NORMALIZADOS")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            abaPrevia === "NORMALIZADOS"
                              ? "bg-premier-900 text-white shadow-2xs"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Primeiras 50 Linhas Normalizadas
                        </button>
                        <button
                          onClick={() => setAbaPrevia("REJEITADAS")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            abaPrevia === "REJEITADAS"
                              ? "bg-rose-700 text-white shadow-2xs"
                              : "text-rose-700 hover:bg-rose-50"
                          }`}
                        >
                          Linhas Rejeitadas ({simulacao.totais.erros})
                        </button>
                        <button
                          onClick={() => setAbaPrevia("ALERTAS")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            abaPrevia === "ALERTAS"
                              ? "bg-amber-600 text-white shadow-2xs"
                              : "text-amber-700 hover:bg-amber-50"
                          }`}
                        >
                          Alertas e Inconsistências ({simulacao.inconsistencias.length})
                        </button>
                      </div>

                      {abaPrevia === "REJEITADAS" && simulacao.totais.erros > 0 && (
                        <button
                          onClick={handleBaixarLinhasRejeitadas}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-rose-600" />
                          <span>Baixar Rejeitadas em Excel</span>
                        </button>
                      )}
                    </div>

                    {/* Conteúdo da Aba: 50 Primeiras Linhas */}
                    {abaPrevia === "NORMALIZADOS" && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="max-h-72 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                              <tr>
                                <th className="py-2.5 px-3 w-16 text-center">Linha</th>
                                <th className="py-2.5 px-3 w-28">Chapa</th>
                                <th className="py-2.5 px-3">Nome / Detalhe</th>
                                <th className="py-2.5 px-3">Seção / Unidade</th>
                                <th className="py-2.5 px-3">Função / Tipo</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                              {((simulacao as any).linhas || []).slice(0, 50).map((l: any, idx: number) => {
                                const d = l.dados || {};
                                return (
                                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-2 px-3 text-center font-mono text-slate-500">
                                      {l.linha || idx + 1}
                                    </td>
                                    <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                      {d.chapa || d.matricula || "—"}
                                    </td>
                                    <td className="py-2 px-3 font-medium text-slate-800">
                                      {d.nome || d.nomeFuncionario || d.descricaoAbono || "—"}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600">
                                      {d.secaoDescricao || d.unidadeNome || "—"}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600">
                                      {d.funcao || d.categoriaAusencia || d.tipoAbono || "—"}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          l.validaParaGravacao
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-rose-100 text-rose-800"
                                        }`}
                                      >
                                        {l.validaParaGravacao ? "Aceito" : "Rejeitado"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Conteúdo da Aba: Rejeitadas com Motivo */}
                    {abaPrevia === "REJEITADAS" && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="max-h-72 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-rose-50/80 text-rose-900 font-bold border-b border-rose-200 sticky top-0">
                              <tr>
                                <th className="py-2.5 px-3 w-16 text-center">Linha</th>
                                <th className="py-2.5 px-3 w-28">Chapa</th>
                                <th className="py-2.5 px-3 w-36">Aba / Coluna</th>
                                <th className="py-2.5 px-3">Motivo da Rejeição</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                              {linhasRejeitadasExibicao.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="py-8 text-center text-slate-400">
                                    Nenhuma linha rejeitada neste arquivo! Todos os registros são válidos.
                                  </td>
                                </tr>
                              ) : (
                                linhasRejeitadasExibicao.map((rej: ItemLinhaRejeitada, idx: number) => (
                                  <tr key={idx} className="hover:bg-rose-50/40 transition-colors">
                                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                                      {rej.linha}
                                    </td>
                                    <td className="py-2 px-3 font-mono font-bold text-rose-900">
                                      {rej.chapa}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 font-medium">
                                      {rej.aba ? `${rej.aba} (${rej.coluna || ""})` : rej.coluna || "—"}
                                    </td>
                                    <td className="py-2 px-3 font-medium text-rose-800 leading-snug">
                                      {rej.motivo}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Conteúdo da Aba: Inconsistências e Alertas */}
                    {abaPrevia === "ALERTAS" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px]">
                            <button
                              onClick={() => setFiltroTipoInconsistencia("TODAS")}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                                filtroTipoInconsistencia === "TODAS"
                                  ? "bg-white text-slate-800 shadow-2xs"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Todas ({simulacao.inconsistencias.length})
                            </button>
                            <button
                              onClick={() => setFiltroTipoInconsistencia("ERRO")}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                                filtroTipoInconsistencia === "ERRO"
                                  ? "bg-rose-600 text-white shadow-2xs"
                                  : "text-rose-600 hover:bg-rose-50"
                              }`}
                            >
                              Erros ({simulacao.totais.erros})
                            </button>
                            <button
                              onClick={() => setFiltroTipoInconsistencia("ALERTA")}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                                filtroTipoInconsistencia === "ALERTA"
                                  ? "bg-amber-500 text-white shadow-2xs"
                                  : "text-amber-700 hover:bg-amber-50"
                              }`}
                            >
                              Alertas ({simulacao.totais.alertas})
                            </button>
                          </div>

                          <div className="relative">
                            <input
                              type="text"
                              value={buscaInconsistencia}
                              onChange={(e) => setBuscaInconsistencia(e.target.value)}
                              placeholder="Buscar por chapa, nome..."
                              className="px-2.5 py-1 pl-7 border border-slate-300 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                            />
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="max-h-72 overflow-y-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                                <tr>
                                  <th className="py-2.5 px-3 w-16 text-center">Linha</th>
                                  <th className="py-2.5 px-3 w-20 text-center">Tipo</th>
                                  <th className="py-2.5 px-3 w-28">Chapa</th>
                                  <th className="py-2.5 px-3 w-36">Coluna</th>
                                  <th className="py-2.5 px-3">Inconsistência</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                                {inconsistenciasFiltradas.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400">
                                      Nenhum registro encontrado para o filtro.
                                    </td>
                                  </tr>
                                ) : (
                                  inconsistenciasFiltradas.map((inc: any, i: number) => {
                                    const tipo = inc.tipo || (inc as any).gravidade;
                                    return (
                                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                                          {inc.linha || "—"}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          <span
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                              tipo === "ERRO"
                                                ? "bg-rose-100 text-rose-700"
                                                : "bg-amber-100 text-amber-700"
                                            }`}
                                          >
                                            {tipo}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                                          {inc.chapa || (inc as any).identificador || "—"}
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 font-semibold">
                                          {inc.coluna || "—"}
                                        </td>
                                        <td className="py-2 px-3 font-medium text-slate-800 leading-snug">
                                          {inc.mensagem || (inc as any).motivo}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Ações da Etapa 3 */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={reiniciarFluxo}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar Carga
                </button>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                  {loteExistenteMesmoTipoECompetencia && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                      ⚠️ Substituirá o lote <strong>{loteExistenteMesmoTipoECompetencia.id}</strong> (não somará registros).
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500">
                    Transação atômica única: apenas registros aceitos serão gravados no lote.
                  </span>
                  <button
                    onClick={handleConfirmarImportacao}
                    disabled={
                      processando ||
                      (simulacao as any).bloqueado ||
                      ((simulacao as any).arquivoDuplicado && !competencia) ||
                      ((simulacao as any).tipo === "MEMORIA_CALCULO"
                        ? (simulacao as any).totalImportado === 0
                        : false) ||
                      ((simulacao as any).totais ? (simulacao as any).totais.lidos === 0 : false)
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-premier-900 text-white hover:bg-premier-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      {(simulacao as any).bloqueado
                        ? "Carga Bloqueada (Ciclo Divergente)"
                        : (simulacao as any).tipo === "MEMORIA_CALCULO"
                        ? "Confirmar e Gravar Memória de Cálculo (MC)"
                        : (simulacao as any).tipo === "BASE_REV04"
                        ? "Confirmar e Gravar Base Estruturada REV04"
                        : loteExistenteMesmoTipoECompetencia
                        ? `Substituir Lote ${loteExistenteMesmoTipoECompetencia.id}`
                        : "Confirmar e Gravar Lote no Sistema"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 4: Concluído com Sucesso */}
          {etapa === 4 && (
            <div className="p-8 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">Importação Concluída com Sucesso!</h2>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  O lote <strong>{loteConfirmadoId}</strong> da competência{" "}
                  <strong>{competencia}</strong> foi gravado na base operacional com controle de hash
                  SHA-256 e trilha de auditoria.
                </p>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={reiniciarFluxo}
                  className="px-4 py-2 bg-premier-900 text-white font-bold rounded-lg text-xs hover:bg-premier-800 transition-colors cursor-pointer"
                >
                  Importar Próximo Arquivo
                </button>

                {todosTresConcluidos && (
                  <button
                    onClick={handleGerarCalendario}
                    className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg text-xs hover:bg-emerald-600 transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Gerar Calendário da Competência</span>
                  </button>
                )}

                <Link
                  href="/profissionais"
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg text-xs hover:bg-slate-50 transition-colors"
                >
                  Ver Lista de Profissionais
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. HISTÓRICO DE LOTES */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Histórico de Lotes de Importação</h2>
            <p className="text-xs text-slate-500">
              Rastreabilidade de cargas, retenção por 90 dias e opção de rollback (desfazer lote)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filtroTipoLote}
              onChange={(e) => setFiltroTipoLote(e.target.value)}
              className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Todos os tipos</option>
              <option value="FUNCIONARIOS_RM">Funcionários (RM/TOTVS)</option>
              <option value="REGISTROS_PONTO_RM">Ponto / Registros</option>
              <option value="ABONO_RM">Cubo de Abono</option>
              <option value="ALOCADOS_SIFAC">Alocados SIFAC</option>
            </select>

            <select
              value={filtroCompetenciaLote}
              onChange={(e) => setFiltroCompetenciaLote(e.target.value)}
              className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs focus:outline-none cursor-pointer"
            >
              <option value="TODAS">Todas as competências</option>
              {listaCompetencias.map((comp) => (
                <option key={comp} value={comp}>
                  Competência {comp}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabela de Lotes */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-2.5 px-3">ID do Lote</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3 text-center">Competência</th>
                <th className="py-2.5 px-3">Arquivo</th>
                <th className="py-2.5 px-3 text-center">Data Extração</th>
                <th className="py-2.5 px-3">Executado Por</th>
                <th className="py-2.5 px-3 text-center">Data / Hora</th>
                <th className="py-2.5 px-3 text-center">Linhas Aceitas</th>
                <th className="py-2.5 px-3 text-center">Rejeitadas</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-medium">
              {lotesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    Nenhum lote de importação registrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                lotesFiltrados.map((lote) => {
                  const ehConcluido = lote.status === "CONCLUIDO";

                  return (
                    <tr key={lote.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{lote.id}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs font-semibold text-slate-800">
                          {lote.tipo === "FUNCIONARIOS_RM"
                            ? "Funcionários RM"
                            : lote.tipo === "ALOCADOS_SIFAC"
                            ? "Alocados SIFAC"
                            : lote.tipo === "ABONO_RM"
                            ? "Cubo Abono"
                            : lote.tipo === "REGISTROS_PONTO_RM" || lote.tipo === "AFD_PONTO"
                            ? "Ponto RM"
                            : lote.tipo}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        {lote.competencia || "—"}
                      </td>
                      <td
                        className="py-2.5 px-3 font-medium text-slate-800 truncate max-w-[150px]"
                        title={lote.arquivoNome}
                      >
                        {lote.arquivoNome}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                        {lote.dataExtracao || lote.dataReferencia}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[120px]">{lote.usuario}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                        {lote.dataHora}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-xs font-mono font-bold text-emerald-700">
                          +{lote.totais.novos + lote.totais.atualizados}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-xs font-mono font-bold ${
                            (lote.linhasRejeitadas ?? lote.totais.erros ?? 0) > 0
                              ? "text-rose-700"
                              : "text-slate-500"
                          }`}
                        >
                          {lote.linhasRejeitadas ?? lote.totais.erros ?? 0}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            lote.status === "CONCLUIDO"
                              ? "text-emerald-700"
                              : lote.status === "DESFEITO"
                              ? "text-slate-400 line-through"
                              : "text-slate-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              lote.status === "CONCLUIDO"
                                ? "bg-emerald-500"
                                : "bg-slate-400"
                            }`}
                          />
                          <span>
                            {lote.status === "CONCLUIDO"
                              ? "Concluído"
                              : lote.status === "DESFEITO"
                              ? "Desfeito"
                              : lote.status}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {ehConcluido ? (
                          <button
                            type="button"
                            onClick={() => handleClicarDesfazerLote(lote)}
                            className="h-7 px-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 hover:border-rose-300 text-rose-600 hover:text-rose-800 text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                            title={`Desfaz o lote ${lote.id} e reverte as alterações`}
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                            <span>Desfazer lote</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Confirmação de Desfazer em Cascata */}
      {modalCascataAberto && loteParaDesfazerCascata && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Atenção: Desfazer em Cascata
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você solicitou desfazer o lote de Funcionários{" "}
              <strong>{loteParaDesfazerCascata.id}</strong> da competência{" "}
              <strong>{loteParaDesfazerCascata.competencia}</strong>.
            </p>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 font-medium space-y-1">
              <span>⚠️ <strong>Isto também desfará os lotes de Ponto e Abonos desta competência</strong>, pois ambos dependem do cadastro de funcionários para validação e apuração.</span>
              <span className="block text-[11px] text-amber-800 mt-1">
                O calendário da competência será marcado imediatamente como desatualizado.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalCascataAberto(false);
                  setLoteParaDesfazerCascata(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarDesfazerCascata}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Confirmar e Desfazer em Cascata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Resumo da Geração do Calendário */}
      {modalCalendarioAberto && resultadoCalendarioModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Calendário da Competência Consolidado
                </h3>
                <span className="text-xs text-slate-500">
                  Competência {resultadoCalendarioModal.competencia} ({resultadoCalendarioModal.periodo.textoFormatado})
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O motor de regras consolidou os 3 arquivos (Funcionários, Ponto e Abonos) aplicando
              as 6 regras contratuais dia a dia por colaborador e posição.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">
                  Colaboradores Apurados
                </span>
                <span className="text-lg font-bold text-slate-900">
                  {resultadoCalendarioModal.colaboradores.length}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">
                  Dias Apurados
                </span>
                <span className="text-lg font-bold text-slate-900">
                  {resultadoCalendarioModal.periodo.datas.length}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-emerald-700 block text-[10px] font-bold uppercase">
                  Cobertura Média do Contrato
                </span>
                <span className="text-lg font-bold text-emerald-800">
                  {resultadoCalendarioModal.metricasGerais.taxaCoberturaMedia.toFixed(1)}%
                </span>
              </div>
              <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                <span className="text-rose-700 block text-[10px] font-bold uppercase">
                  Faltas Apontadas
                </span>
                <span className="text-lg font-bold text-rose-800">
                  {resultadoCalendarioModal.alertasGestor.length}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalCalendarioAberto(false)}
                className="px-4 py-2 bg-premier-900 hover:bg-premier-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
