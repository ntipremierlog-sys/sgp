"use client";

import React, { useState, useEffect } from "react";
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
  Calendar,
  Layers,
  FileText,
  Clock,
  Filter,
  Eye,
  Info,
  ChevronRight,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  identificarTipoArquivo,
  simularImportacaoFuncionariosRm,
  confirmarImportacaoFuncionariosRm,
  gerarRelatorioValidacaoXlsx,
  ResultadoIdentificacaoRm,
  ResultadoSimulacaoRm,
  ItemInconsistencia,
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
  carregarEstado,
  desfazerUltimoLote,
  LoteImportacaoOperacional,
} from "@/lib/dados/estado-operacional";
import { UsuarioSessao } from "@/lib/auth/tipos";

type ResultadoSimulacaoQualquer =
  | ResultadoSimulacaoRm
  | ResultadoSimulacaoSifac
  | ResultadoSimulacaoAbono;

export default function ImportacoesPage() {
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Etapa atual: 1 = Upload, 2 = Identificação, 3 = Pré-visualização, 4 = Concluído
  const [etapa, setEtapa] = useState<1 | 2 | 3 | 4>(1);

  // Formulário Etapa 1
  const [dataReferencia, setDataReferencia] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erroUpload, setErroUpload] = useState<string>("");

  // Resultados das etapas
  const [identificacao, setIdentificacao] = useState<ResultadoIdentificacaoRm | null>(null);
  const [simulacao, setSimulacao] = useState<ResultadoSimulacaoQualquer | null>(null);
  const [loteConfirmadoId, setLoteConfirmadoId] = useState<string | null>(null);
  const [mensagemFeedback, setMensagemFeedback] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  // Filtro de Inconsistências na Pré-visualização
  const [filtroTipoInconsistencia, setFiltroTipoInconsistencia] = useState<"TODAS" | "ERRO" | "ALERTA">("TODAS");
  const [buscaInconsistencia, setBuscaInconsistencia] = useState("");

  // Histórico de Lotes
  const [lotes, setLotes] = useState<LoteImportacaoOperacional[]>([]);
  const [filtroTipoLote, setFiltroTipoLote] = useState<string>("TODOS");
  const [modalDesfazerAberto, setModalDesfazerAberto] = useState(false);

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

  // Processa o arquivo selecionado
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setErroUpload("Formato inválido. Selecione apenas planilhas Excel (.xlsx ou .xls).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErroUpload("Arquivo excede o tamanho máximo permitido de 10 MB.");
      return;
    }

    setErroUpload("");
    setArquivoSelecionado(file);
    setProcessando(true);
    setEtapa(2);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const abaAlvo = wb.SheetNames.find((s) => s.trim().toLowerCase() === "modelo") || wb.SheetNames[0];
      const sheet = wb.Sheets[abaAlvo];
      const headerRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] || [];
      const cabecalhos = headerRows.map((c) => String(c || "").trim());

      // ETAPA 2: Identificação automática
      const resultadoId = identificarTipoArquivo(cabecalhos);
      setIdentificacao(resultadoId);

      if (!resultadoId.reconhecido) {
        setProcessando(false);
        return;
      }

      // ETAPA 3: Pré-visualização / Simulação
      let resultadoSim: any;
      if (resultadoId.tipo === "ALOCADOS_SIFAC") {
        resultadoSim = await simularImportacaoSifac(
          buffer,
          file.name,
          dataReferencia
        );
      } else if (resultadoId.tipo === "ABONO_RM") {
        resultadoSim = await simularImportacaoAbono(
          buffer,
          file.name,
          dataReferencia
        );
      } else {
        resultadoSim = await simularImportacaoFuncionariosRm(
          buffer,
          file.name,
          dataReferencia
        );
      }

      setSimulacao(resultadoSim);
      setEtapa(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao processar a planilha Excel.";
      setErroUpload(msg);
      setEtapa(1);
    } finally {
      setProcessando(false);
    }
  };

  const handleConfirmarImportacao = () => {
    if (!simulacao) return;

    try {
      setProcessando(true);
      const usuarioLogado = sessao ? `${sessao.nome} (${sessao.perfil})` : "Administrador Premier";
      let res: { sucesso: boolean; loteId: string; mensagem: string };

      if (simulacao.tipo === "ALOCADOS_SIFAC") {
        res = confirmarImportacaoSifac(simulacao, usuarioLogado);
      } else if (simulacao.tipo === "ABONO_RM") {
        res = confirmarImportacaoAbono(simulacao, usuarioLogado);
      } else {
        res = confirmarImportacaoFuncionariosRm(simulacao, usuarioLogado);
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

  const handleBaixarRelatorioValidacao = () => {
    if (!simulacao) return;
    const relatorioBytes =
      simulacao.tipo === "FUNCIONARIOS_RM"
        ? gerarRelatorioValidacaoXlsx(simulacao)
        : simulacao.tipo === "ABONO_RM"
        ? gerarRelatorioValidacaoAbonoXlsx(simulacao)
        : (() => {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(
              simulacao.inconsistencias && simulacao.inconsistencias.length > 0
                ? simulacao.inconsistencias
                : [{ Mensagem: "Nenhum erro ou alerta." }]
            );
            XLSX.utils.book_append_sheet(wb, ws, "Validação");
            return new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
          })();
    const blob = new Blob([relatorioBytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_validacao_${simulacao.tipo}_${simulacao.dataReferencia}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBaixarPlanilhaModelo = () => {
    const dadosModelo = [
      {
        Chapa: "000101",
        Nome: "CARLOS EDUARDO SILVA",
        "Nome Social": "",
        CPF: "52998224725",
        Sexo: "M",
        "Data de Nascimento": "15/04/1988",
        Situação: "A",
        "Descrição da Situação": "Ativo",
        "Data de Admissão": "02/01/2024",
        "Data de Demissão": "",
        Seção: "1.01.080.029",
        "Descrição Seção": "UFN-III (Três Lagoas - MS)",
        "Nome Funcão": "Almoxarife Líder",
        Horário: "001",
        "Descrição do Horario": "07:00 AS 16:48 - SEG/SEX",
        Jornada: "44,0",
        "Utiliza Ponto": "Sim",
      },
      {
        Chapa: "000102",
        Nome: "MARIANA SOUZA LIMA",
        "Nome Social": "",
        CPF: "11144477735",
        Sexo: "F",
        "Data de Nascimento": "20/09/1992",
        Situação: "A",
        "Descrição da Situação": "Ativo",
        "Data de Admissão": "05/01/2024",
        "Data de Demissão": "",
        Seção: "1.01.080.029",
        "Descrição Seção": "UFN-III (Três Lagoas - MS)",
        "Nome Funcão": "Auxiliar de Almoxarifado I",
        Horário: "001",
        "Descrição do Horario": "07:00 AS 16:48 - SEG/SEX",
        Jornada: "44,0",
        "Utiliza Ponto": "Sim",
      },
      {
        Chapa: "000104",
        Nome: "JOSE PEREIRA SANTOS",
        "Nome Social": "",
        CPF: "05299822472",
        Sexo: "M",
        "Data de Nascimento": "10/01/1985",
        Situação: "A",
        "Descrição da Situação": "Ativo",
        "Data de Admissão": "01/02/2024",
        "Data de Demissão": "",
        Seção: "1.01.080.029",
        "Descrição Seção": "UFN-III (Três Lagoas - MS)",
        "Nome Funcão": "Operador de Empilhadeira Líder",
        Horário: "002",
        "Descrição do Horario": "06:00 AS 18:00 - ESCALA 12X36",
        Jornada: "36,0",
        "Utiliza Ponto": "Sim",
      },
      {
        Chapa: "000114",
        Nome: "THIAGO BARBOSA",
        "Nome Social": "",
        CPF: "78912345601",
        Sexo: "M",
        "Data de Nascimento": "22/11/1995",
        Situação: "A",
        "Descrição da Situação": "Ativo",
        "Data de Admissão": "01/05/2024",
        "Data de Demissão": "",
        Seção: "1.01.080.029",
        "Descrição Seção": "UFN-III (Três Lagoas - MS)",
        "Nome Funcão": "Auxiliar de Pátio",
        Horário: "001",
        "Descrição do Horario": "07:00 AS 16:48 - SEG/SEX",
        Jornada: "44,0",
        "Utiliza Ponto": "Sim",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosModelo);
    XLSX.utils.book_append_sheet(wb, ws, "Modelo Funcionarios RM");
    XLSX.writeFile(wb, "modelo_funcionarios_rm_totvs.xlsx");
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

  const handleDesfazerUltimoLote = (tipo: string) => {
    const res = desfazerUltimoLote(
      tipo,
      sessao ? `${sessao.nome} (${sessao.perfil})` : "Administrador Premier"
    );
    setMensagemFeedback({
      tipo: res.sucesso ? "sucesso" : "erro",
      texto: res.mensagem,
    });
    setModalDesfazerAberto(false);
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
  const inconsistenciasFiltradas = (simulacao?.inconsistencias || []).filter((inc) => {
    const matchTipo =
      filtroTipoInconsistencia === "TODAS" ? true : inc.tipo === filtroTipoInconsistencia;
    const matchBusca =
      !buscaInconsistencia ||
      (inc.mensagem && inc.mensagem.toLowerCase().includes(buscaInconsistencia.toLowerCase())) ||
      (inc.chapa && inc.chapa.includes(buscaInconsistencia)) ||
      (inc.nome && inc.nome.toLowerCase().includes(buscaInconsistencia.toLowerCase()));
    return matchTipo && matchBusca;
  });

  const lotesFiltrados = lotes.filter((l) =>
    filtroTipoLote === "TODOS" ? true : l.tipo === filtroTipoLote
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wide">
              MOMENTO 1 · Carga Real
            </span>
            <span className="text-slate-400 text-xs">Contrato Petrobras ICJ 5900.0129796.25.2</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Importações de Dados</h1>
          <p className="text-xs text-slate-500">
            Pipeline estruturado em 4 etapas para carga dos setores da Premier (RM/TOTVS, SIFAC e Abono)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBaixarPlanilhaModelo}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            title="Baixar planilha modelo de funcionários no padrão RM/TOTVS com dados sintéticos"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Modelo RM</span>
          </button>
          <button
            onClick={handleBaixarModeloAbono}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            title="Baixar planilha modelo de Cubo de Abono (ocorrências/atestados)"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Modelo Cubo de Abono</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback (Sucesso / Erro) */}
      {mensagemFeedback && (
        <div
          className={`p-4 rounded-lg text-xs flex items-center justify-between border ${
            mensagemFeedback.tipo === "sucesso"
              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
              : "bg-rose-50 text-rose-900 border-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {mensagemFeedback.tipo === "sucesso" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{mensagemFeedback.texto}</span>
          </div>
          <button
            onClick={() => setMensagemFeedback(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stepper Visual em 4 Etapas */}
      <div className="grid grid-cols-4 gap-2 border border-slate-200 bg-white rounded-xl p-3 shadow-sm text-xs">
        <div
          className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
            etapa === 1
              ? "bg-blue-50 text-blue-900 font-bold border border-blue-200"
              : etapa > 1
              ? "text-emerald-700 font-medium"
              : "text-slate-400"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
              etapa === 1
                ? "bg-blue-600 text-white"
                : etapa > 1
                ? "bg-emerald-600 text-white"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {etapa > 1 ? "✓" : "1"}
          </div>
          <div className="truncate">
            <span className="block font-semibold">1. Upload</span>
            <span className="text-[10px] text-slate-500 block truncate">Arquivo e Data Ref.</span>
          </div>
        </div>

        <div
          className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
            etapa === 2
              ? "bg-blue-50 text-blue-900 font-bold border border-blue-200"
              : etapa > 2
              ? "text-emerald-700 font-medium"
              : "text-slate-400"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
              etapa === 2
                ? "bg-blue-600 text-white"
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
              ? "bg-blue-50 text-blue-900 font-bold border border-blue-200"
              : etapa > 3
              ? "text-emerald-700 font-medium"
              : "text-slate-400"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
              etapa === 3
                ? "bg-blue-600 text-white"
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
              ? "bg-emerald-50 text-emerald-900 font-bold border border-emerald-300"
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

      {/* CONTEÚDO PRINCIPAL DAS ETAPAS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
        {/* ETAPA 1 & 2: Upload e Seleção */}
        {etapa === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Campo Data de Referência */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Data de Referência da Carga <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={dataReferencia}
                    onChange={(e) => setDataReferencia(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Data em que a extração foi gerada no sistema RM/TOTVS (ex: competência de apuração).
                </p>
              </div>

              {/* Informações de Retenção e Regras */}
              <div className="md:col-span-2 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-slate-800 block">
                    Conformidade e Retenção Privada (LGPD)
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    O arquivo original é armazenado de forma restrita por 90 dias para fins de auditoria contratual. Apenas as colunas autorizadas pela Premier e Petrobras são lidas. O campo <strong>Idade</strong> nunca é gravado no banco de dados.
                  </p>
                </div>
              </div>
            </div>

            {/* Zona de Drop / Upload */}
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-xl p-8 text-center transition-all cursor-pointer relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm text-slate-800">
                  Clique para selecionar ou arraste o arquivo Excel aqui
                </span>
                <span className="text-xs text-slate-500">
                  Suporta arquivos .XLSX e .XLS de até 10 MB (exportações RM/TOTVS)
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

        {/* ETAPA 2: Falha de Identificação */}
        {etapa === 2 && identificacao && !identificacao.reconhecido && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-rose-950">
                Não foi possível reconhecer o tipo de arquivo
              </h3>
              <p className="text-xs text-rose-800 max-w-lg mx-auto">
                O arquivo <strong>{arquivoSelecionado?.name}</strong> não contém todos os cabeçalhos obrigatórios esperados para a exportação de <strong>Funcionários do RM/TOTVS</strong>.
              </p>
            </div>

            <div className="p-4 bg-white rounded-lg border border-rose-200 max-w-md mx-auto text-left text-xs space-y-2">
              <span className="font-bold text-slate-800 block">Colunas obrigatórias faltantes:</span>
              <ul className="list-disc list-inside text-rose-700 space-y-1 font-mono text-[11px]">
                {identificacao.colunasObrigatoriasFaltando.map((col) => (
                  <li key={col}>{col}</li>
                ))}
              </ul>
            </div>

            <button
              onClick={reiniciarFluxo}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors"
            >
              Tentar Novamente com Outro Arquivo
            </button>
          </div>
        )}

        {/* ETAPA 3: Pré-Visualização / Simulação */}
        {etapa === 3 && simulacao && (
          <div className="space-y-6">
            {/* Header da Simulação */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {simulacao.tipo === "ALOCADOS_SIFAC"
                      ? "Arquivo Identificado: Lista de Alocados (SIFAC)"
                      : simulacao.tipo === "ABONO_RM"
                      ? "Arquivo Identificado: Cubo de Abono e Ocorrências (RM)"
                      : "Arquivo Identificado: Funcionários (RM / TOTVS)"}
                  </span>
                  <span className="text-slate-400 text-xs">|</span>
                  <span className="text-xs text-slate-600 font-mono">{simulacao.arquivoNome}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                  <span>Data de Referência: <strong>{simulacao.dataReferencia}</strong></span>
                  <span>Hash SHA-256: <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">{simulacao.hashSha256.substring(0, 16)}...</code></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBaixarRelatorioValidacao}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Baixar Relatório de Validação (XLSX)</span>
                </button>
                <button
                  onClick={reiniciarFluxo}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Trocar Arquivo
                </button>
              </div>
            </div>

            {/* Alerta de Arquivo Duplicado (Bloqueio) */}
            {simulacao.arquivoDuplicado && (
              <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-sm">Bloqueio de Reimportação de Arquivo</strong>
                  <span>
                    Este arquivo exato (mesmo hash SHA-256) já foi importado anteriormente no lote{" "}
                    <strong>{simulacao.loteAnteriorId}</strong> em {simulacao.loteAnteriorData}. O sistema impede a reimportação duplicada para proteger a integridade dos dados e o histórico de alterações.
                  </span>
                </div>
              </div>
            )}

            {/* Aviso de Substituição de Lote por Competência (SIFAC) */}
            {simulacao.tipo === "ALOCADOS_SIFAC" && (simulacao as any).substituiLoteAnterior && (
              <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-sm">Substituição de Lote da Mesma Competência</strong>
                  <span>
                    Já existe um lote ativo cadastrado para a competência <strong>{(simulacao as any).competencia}</strong>. Conforme a regra de negócio do Momento 2, a confirmação desta importação substituirá o lote anterior e recalculará a conciliação cadastral.
                  </span>
                </div>
              </div>
            )}

            {/* Erro Bloqueante no Arquivo Inteiro (Contrato ou CNPJ divergente) */}
            {(simulacao as any).erroBloqueanteArquivo && (
              <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-sm">Arquivo Bloqueado para Gravação</strong>
                  <span>{(simulacao as any).erroBloqueanteArquivo}</span>
                </div>
              </div>
            )}

            {/* Cards de Métricas e Totais da Simulação */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Lidos</span>
                <span className="text-xl font-bold text-slate-900">{simulacao.totais.lidos}</span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Novos</span>
                <span className="text-xl font-bold text-emerald-800">{simulacao.totais.novos}</span>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Atualizados</span>
                <span className="text-xl font-bold text-blue-800">{simulacao.totais.atualizados}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Sem Alteração</span>
                <span className="text-xl font-bold text-slate-700">{simulacao.totais.semAlteracao}</span>
              </div>
              <div className={`p-3 rounded-xl text-center border ${simulacao.totais.erros > 0 ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
                <span className="text-[10px] font-bold uppercase block">Com Erro</span>
                <span className={`text-xl font-bold ${simulacao.totais.erros > 0 ? "text-rose-700" : "text-slate-700"}`}>
                  {simulacao.totais.erros}
                </span>
              </div>
              <div className={`p-3 rounded-xl text-center border ${simulacao.totais.alertas > 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
                <span className="text-[10px] font-bold uppercase block">Com Alerta</span>
                <span className={`text-xl font-bold ${simulacao.totais.alertas > 0 ? "text-amber-700" : "text-slate-700"}`}>
                  {simulacao.totais.alertas}
                </span>
              </div>
            </div>

            {/* Tabela de Inconsistências (Erros e Alertas) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Ocorrências Identificadas ({simulacao.inconsistencias.length})
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    (Erros impedem a importação da linha; Alertas sinalizam inconsistências sem bloquear)
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {/* Filtro de Tipo */}
                  <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px]">
                    <button
                      onClick={() => setFiltroTipoInconsistencia("TODAS")}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        filtroTipoInconsistencia === "TODAS"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Todas ({simulacao.inconsistencias.length})
                    </button>
                    <button
                      onClick={() => setFiltroTipoInconsistencia("ERRO")}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        filtroTipoInconsistencia === "ERRO"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-rose-600 hover:bg-rose-50"
                      }`}
                    >
                      Erros ({simulacao.totais.erros})
                    </button>
                    <button
                      onClick={() => setFiltroTipoInconsistencia("ALERTA")}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        filtroTipoInconsistencia === "ALERTA"
                          ? "bg-amber-500 text-white shadow-sm"
                          : "text-amber-700 hover:bg-amber-50"
                      }`}
                    >
                      Alertas ({simulacao.inconsistencias.filter((i) => i.tipo === "ALERTA").length})
                    </button>
                  </div>

                  {/* Busca */}
                  <div className="relative">
                    <input
                      type="text"
                      value={buscaInconsistencia}
                      onChange={(e) => setBuscaInconsistencia(e.target.value)}
                      placeholder="Filtrar por chapa, nome ou motivo..."
                      className="px-2.5 py-1 pl-7 border border-slate-300 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                  </div>
                </div>
              </div>

              {/* Tabela */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 w-16 text-center">Linha</th>
                        <th className="py-2.5 px-3 w-20 text-center">Tipo</th>
                        <th className="py-2.5 px-3 w-28">Chapa</th>
                        <th className="py-2.5 px-3 w-48">Colaborador</th>
                        <th className="py-2.5 px-3 w-36">Coluna</th>
                        <th className="py-2.5 px-3">Motivo da Inconsistência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                      {inconsistenciasFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            Nenhuma inconsistência encontrada para os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        inconsistenciasFiltradas.map((inc, i) => (
                          <tr key={i} className={inc.tipo === "ERRO" ? "bg-rose-50/40" : "bg-amber-50/30"}>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                              {inc.linha === 0 ? "—" : inc.linha}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  inc.tipo === "ERRO"
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : "bg-amber-100 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {inc.tipo}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                              {inc.chapa || "—"}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-900 truncate max-w-[180px]">
                              {inc.nome || "—"}
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-semibold">{inc.coluna || "—"}</td>
                            <td className="py-2 px-3 font-medium text-slate-800 leading-snug">
                              {inc.mensagem}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Ações da Etapa 3 */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={reiniciarFluxo}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar Carga
              </button>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500">
                  Transação atômica única: apenas registros válidos serão gravados.
                </span>
                <button
                  onClick={handleConfirmarImportacao}
                  disabled={
                    processando ||
                    simulacao.arquivoDuplicado ||
                    !!(simulacao as any).erroBloqueanteArquivo ||
                    (simulacao.totais.novos === 0 && simulacao.totais.atualizados === 0)
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-premier-900 text-white hover:bg-premier-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Confirmar e Gravar Lote no Sistema</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 4: Concluído com Sucesso */}
        {etapa === 4 && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Importação Concluída com Sucesso!</h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                O lote <strong>{loteConfirmadoId}</strong> foi processado e registrado na base operacional e na trilha de auditoria do sistema.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3">
              <button
                onClick={reiniciarFluxo}
                className="px-4 py-2 bg-premier-900 text-white font-bold rounded-lg text-xs hover:bg-premier-800 transition-colors"
              >
                Importar Outro Arquivo
              </button>
              {simulacao?.tipo === "ALOCADOS_SIFAC" && (
                <Link
                  href={`/conciliacao-sifac?competencia=${(simulacao as any).competencia || "2026-08"}`}
                  className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg text-xs hover:bg-emerald-600 transition-colors inline-flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ir para Conciliação SIFAC</span>
                </Link>
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

      {/* PAINEL DE CONTROLE POR LOTE E HISTÓRICO */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Histórico de Lotes de Importação</h2>
            <p className="text-xs text-slate-500">
              Rastreabilidade de cargas, retenção por 90 dias e opção de rollback (desfazer lote)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filtroTipoLote}
              onChange={(e) => setFiltroTipoLote(e.target.value)}
              className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs focus:outline-none"
            >
              <option value="TODOS">Todos os tipos</option>
              <option value="FUNCIONARIOS_RM">Funcionários (RM/TOTVS)</option>
              <option value="ALOCADOS_SIFAC">Alocados SIFAC (Momento 2)</option>
              <option value="ABONO_RM">Cubo de Abono (Momento 3)</option>
            </select>
          </div>
        </div>

        {/* Tabela de Lotes */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">ID do Lote</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Arquivo</th>
                <th className="py-2.5 px-3 text-center">Data Ref.</th>
                <th className="py-2.5 px-3">Executado Por</th>
                <th className="py-2.5 px-3 text-center">Data / Hora</th>
                <th className="py-2.5 px-3 text-center">Totais</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
              {lotesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Nenhum lote de importação registrado até o momento.
                  </td>
                </tr>
              ) : (
                lotesFiltrados.map((lote, index) => {
                  const ehUltimoConcluido =
                    lote.status === "CONCLUIDO" &&
                    lotes.find((l) => l.tipo === lote.tipo && l.status === "CONCLUIDO")?.id === lote.id;

                  return (
                    <tr key={lote.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{lote.id}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {lote.tipo === "FUNCIONARIOS_RM"
                            ? "Funcionários RM"
                            : lote.tipo === "ALOCADOS_SIFAC"
                            ? "Alocados SIFAC"
                            : "Cubo Abono"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 truncate max-w-[160px]" title={lote.arquivoNome}>
                        {lote.arquivoNome}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                        {lote.dataReferencia}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{lote.usuario}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                        {lote.dataHora}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[10px] font-mono text-slate-600">
                          +{lote.totais.novos} / ~{lote.totais.atualizados}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            lote.status === "CONCLUIDO"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {lote.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {ehUltimoConcluido ? (
                          <button
                            onClick={() => setModalDesfazerAberto(true)}
                            className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-900 font-bold text-[11px] bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded transition-colors"
                            title="Desfaz as alterações deste lote restaurando o estado anterior"
                          >
                            <RotateCcw className="w-3 h-3 text-rose-600" />
                            <span>Desfazer Lote</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
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

      {/* Modal de Confirmação para Desfazer Lote */}
      {modalDesfazerAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Desfazer Último Lote de Importação?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Esta ação reverterá o estado operacional do sistema para o momento imediatamente anterior à confirmação do lote selecionado. O cancelamento será registrado permanentemente na trilha de auditoria.
            </p>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setModalDesfazerAberto(false)}
                className="px-3.5 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDesfazerUltimoLote("FUNCIONARIOS_RM")}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors"
              >
                Confirmar e Desfazer Lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
